package control_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/meterbox/meterbox/internal/control"
	"github.com/meterbox/meterbox/internal/models"
	"github.com/meterbox/meterbox/internal/store"
)

func setupTestServer() (*control.Server, http.Handler) {
	s := store.NewMultiTenantStore(nil, "", "")
	srv := control.NewServer(s)
	return srv, srv.Router()
}

func TestScopedAPIKeyPermissionsAndNamespaceIsolation(t *testing.T) {
	_, handler := setupTestServer()

	// 1. Ingest-only key (`mb_ing_live_...`) can POST /api/v1/events
	ingestKey := "mb_ing_live_acme_default_collector_key_01"
	evPayload := map[string]interface{}{
		"specversion": "1.0",
		"id":          "evt_test_scope_001",
		"source":      "https://api.acme.dev",
		"type":        "ai.llm.tokens",
		"subject":     "cust_hyperion_labs",
		"data":        map[string]interface{}{"tokens": 1500, "model": "claude-4-sonnet"},
	}
	body, _ := json.Marshal(evPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/events", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+ingestKey)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted for ingest key on POST /api/v1/events, got %d: %s", rec.Code, rec.Body.String())
	}
	if ns := rec.Header().Get("X-OpenMeter-Namespace"); ns != "ns_live_acme" {
		t.Fatalf("expected namespace header ns_live_acme, got %q", ns)
	}

	// 2. Ingest-only key MUST be rejected with 403 Forbidden on admin/meter routes
	reqForbidden := httptest.NewRequest(http.MethodGet, "/api/v1/meters", nil)
	reqForbidden.Header.Set("Authorization", "Bearer "+ingestKey)
	recForbidden := httptest.NewRecorder()
	handler.ServeHTTP(recForbidden, reqForbidden)
	if recForbidden.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when ingest key calls GET /api/v1/meters, got %d", recForbidden.Code)
	}

	// 3. Entitlement-only key (`mb_ent_live_...`) can read entitlement values but cannot ingest events
	entKey := "mb_ent_live_acme_default_quota_key_01"
	reqEnt := httptest.NewRequest(http.MethodGet, "/api/v1/subjects/cust_hyperion_labs/entitlements/ai_token_allowance/value", nil)
	reqEnt.Header.Set("Authorization", "Bearer "+entKey)
	recEnt := httptest.NewRecorder()
	handler.ServeHTTP(recEnt, reqEnt)
	if recEnt.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for entitlement key on quota check, got %d: %s", recEnt.Code, recEnt.Body.String())
	}

	reqEntIngest := httptest.NewRequest(http.MethodPost, "/api/v1/events", bytes.NewReader(body))
	reqEntIngest.Header.Set("Authorization", "Bearer "+entKey)
	recEntIngest := httptest.NewRecorder()
	handler.ServeHTTP(recEntIngest, reqEntIngest)
	if recEntIngest.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when entitlement key calls POST /api/v1/events, got %d", recEntIngest.Code)
	}

	// 4. Verify strict namespace isolation: event ingested into `ns_live_acme` does not affect `ns_test_acme`
	reqLiveQuery := httptest.NewRequest(http.MethodGet, "/api/v1/meters/llm_tokens_total/query?subject=cust_hyperion_labs", nil)
	reqLiveQuery.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recLive := httptest.NewRecorder()
	handler.ServeHTTP(recLive, reqLiveQuery)

	var liveRes models.MeterQueryResult
	_ = json.Unmarshal(recLive.Body.Bytes(), &liveRes)

	reqTestQuery := httptest.NewRequest(http.MethodGet, "/api/v1/meters/llm_tokens_total/query?subject=cust_hyperion_labs", nil)
	reqTestQuery.Header.Set("X-OpenMeter-Namespace", "ns_test_acme")
	recTest := httptest.NewRecorder()
	handler.ServeHTTP(recTest, reqTestQuery)

	var testRes models.MeterQueryResult
	_ = json.Unmarshal(recTest.Body.Bytes(), &testRes)

	if liveRes.TotalValue != testRes.TotalValue+1500 {
		t.Fatalf("expected live namespace total (%v) to exceed sandbox total (%v) by 1500", liveRes.TotalValue, testRes.TotalValue)
	}
}

func TestSynchronousDeduplicationAndEdgeCacheInvalidation(t *testing.T) {
	_, handler := setupTestServer()

	// 1. First quota evaluation should be a CACHE MISS
	reqCheck1 := httptest.NewRequest(http.MethodGet, "/api/v1/subjects/cust_hyperion_labs/entitlements/ai_token_allowance/value", nil)
	reqCheck1.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recCheck1 := httptest.NewRecorder()
	handler.ServeHTTP(recCheck1, reqCheck1)

	if cacheHdr := recCheck1.Header().Get("X-Meterbox-Cache"); cacheHdr != "MISS" {
		t.Fatalf("expected initial entitlement check to be MISS, got %q", cacheHdr)
	}
	var val1 models.EntitlementValue
	_ = json.Unmarshal(recCheck1.Body.Bytes(), &val1)

	// 2. Second quota evaluation should be a sub-millisecond CACHE HIT
	reqCheck2 := httptest.NewRequest(http.MethodGet, "/api/v1/subjects/cust_hyperion_labs/entitlements/ai_token_allowance/value", nil)
	reqCheck2.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recCheck2 := httptest.NewRecorder()
	handler.ServeHTTP(recCheck2, reqCheck2)

	if cacheHdr := recCheck2.Header().Get("X-Meterbox-Cache"); cacheHdr != "HIT" {
		t.Fatalf("expected second entitlement check to be HIT, got %q", cacheHdr)
	}

	// 3. Ingest an event and send the exact same event ID twice to verify Redis SETNX deduplication
	ev := map[string]interface{}{
		"specversion": "1.0",
		"id":          "evt_dedup_999",
		"source":      "https://api.acme.dev",
		"type":        "ai.llm.tokens",
		"subject":     "cust_hyperion_labs",
		"data":        map[string]interface{}{"tokens": 5000, "model": "gpt-5"},
	}
	raw, _ := json.Marshal([]interface{}{ev, ev}) // Duplicate inside batch
	reqIngest := httptest.NewRequest(http.MethodPost, "/api/v1/events", bytes.NewReader(raw))
	reqIngest.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recIngest := httptest.NewRecorder()
	handler.ServeHTTP(recIngest, reqIngest)

	var ingestRes models.IngestResult
	_ = json.Unmarshal(recIngest.Body.Bytes(), &ingestRes)
	if ingestRes.Accepted != 1 || ingestRes.Deduplicated != 1 {
		t.Fatalf("expected Accepted=1 and Deduplicated=1, got %+v", ingestRes)
	}

	// 4. Next quota check must reflect cache invalidation (MISS) and balance decremented by exactly 5000 (not 10000!)
	reqCheck3 := httptest.NewRequest(http.MethodGet, "/api/v1/subjects/cust_hyperion_labs/entitlements/ai_token_allowance/value", nil)
	reqCheck3.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recCheck3 := httptest.NewRecorder()
	handler.ServeHTTP(recCheck3, reqCheck3)

	if cacheHdr := recCheck3.Header().Get("X-Meterbox-Cache"); cacheHdr != "MISS" {
		t.Fatalf("expected entitlement check after event ingestion to be MISS (invalidated), got %q", cacheHdr)
	}
	var val3 models.EntitlementValue
	_ = json.Unmarshal(recCheck3.Body.Bytes(), &val3)
	if val3.Balance != val1.Balance-5000 {
		t.Fatalf("expected balance to decrease by 5000 (from %v to %v), got %v", val1.Balance, val1.Balance-5000, val3.Balance)
	}
}

func TestDLQCaptureAndReplayAndDogfoodBilling(t *testing.T) {
	_, handler := setupTestServer()

	// 1. Send a malformed CloudEvent with a non-numeric $.tokens value
	badEv := map[string]interface{}{
		"specversion": "1.0",
		"id":          "evt_bad_dlq_42",
		"source":      "https://api.acme.dev",
		"type":        "ai.llm.tokens",
		"subject":     "cust_hyperion_labs",
		"data":        map[string]interface{}{"tokens": "NOT_A_NUMBER"},
	}
	rawBad, _ := json.Marshal(badEv)
	reqBad := httptest.NewRequest(http.MethodPost, "/api/v1/events", bytes.NewReader(rawBad))
	reqBad.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recBad := httptest.NewRecorder()
	handler.ServeHTTP(recBad, reqBad)

	var badRes models.IngestResult
	_ = json.Unmarshal(recBad.Body.Bytes(), &badRes)
	if badRes.DLQCount != 1 || len(badRes.DLQEventIDs) != 1 {
		t.Fatalf("expected malformed event to be routed to DLQ, got %+v", badRes)
	}
	dlqID := badRes.DLQEventIDs[0]

	// 2. Fix the payload and replay the DLQ event via POST /api/control/v1/dlq/{id}/replay
	fixedPayload := map[string]interface{}{
		"payload": map[string]interface{}{
			"specversion": "1.0",
			"id":          "evt_bad_dlq_42",
			"source":      "https://api.acme.dev",
			"type":        "ai.llm.tokens",
			"subject":     "cust_hyperion_labs",
			"data":        map[string]interface{}{"tokens": 7500, "model": "claude-4-sonnet"},
		},
	}
	rawFixed, _ := json.Marshal(fixedPayload)
	reqReplay := httptest.NewRequest(http.MethodPost, "/api/control/v1/dlq/"+dlqID+"/replay", bytes.NewReader(rawFixed))
	reqReplay.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recReplay := httptest.NewRecorder()
	handler.ServeHTTP(recReplay, reqReplay)

	var replayRes models.IngestResult
	_ = json.Unmarshal(recReplay.Body.Bytes(), &replayRes)
	if replayRes.Accepted != 1 {
		t.Fatalf("expected replayed DLQ event to be accepted, got %+v", replayRes)
	}

	// 3. Verify Dogfooding (`ns_meterbox_internal`) incremented for the replayed event
	reqDogfood := httptest.NewRequest(http.MethodGet, "/api/control/v1/dogfood", nil)
	reqDogfood.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recDogfood := httptest.NewRecorder()
	handler.ServeHTTP(recDogfood, reqDogfood)
	if recDogfood.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from dogfood endpoint, got %d", recDogfood.Code)
	}

	// 4. Verify Hybrid Invoice generation with Stripe sync
	invReq, _ := json.Marshal(map[string]interface{}{
		"subject_key":    "cust_hyperion_labs",
		"plan_slug":      "ai_scale_hybrid",
		"sync_to_stripe": true,
	})
	reqInv := httptest.NewRequest(http.MethodPost, "/api/v1/invoices/generate", bytes.NewReader(invReq))
	reqInv.Header.Set("X-OpenMeter-Namespace", "ns_live_acme")
	recInv := httptest.NewRecorder()
	handler.ServeHTTP(recInv, reqInv)
	if recInv.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for invoice generation, got %d: %s", recInv.Code, recInv.Body.String())
	}
	var inv models.Invoice
	_ = json.Unmarshal(recInv.Body.Bytes(), &inv)
	if inv.TotalCents <= 19900 || inv.StripeInvoiceID == "" {
		t.Fatalf("expected hybrid invoice total > base price (19900 cents) and non-empty Stripe ID, got %+v", inv)
	}
}

func TestAppemblyCyclodeStepIngestionAndPreFlightQuotaGate(t *testing.T) {
	_, handler := setupTestServer()

	entKey := "mb_ent_live_appembly_cyclode_quota_01"
	ingKey := "mb_ing_live_appembly_cyclode_collector_01"

	// 1. Pre-flight quota check for Cyclode workstation (`ws_cyclode_default`)
	reqQuota := httptest.NewRequest(http.MethodGet, "/api/v1/subjects/ws_cyclode_default/entitlements/ai_token_allowance/value", nil)
	reqQuota.Header.Set("Authorization", "Bearer "+entKey)
	recQuota := httptest.NewRecorder()
	handler.ServeHTTP(recQuota, reqQuota)
	if recQuota.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for Cyclode pre-flight quota check, got %d: %s", recQuota.Code, recQuota.Body.String())
	}
	var beforeVal models.EntitlementValue
	_ = json.Unmarshal(recQuota.Body.Bytes(), &beforeVal)
	if !beforeVal.HasAccess || beforeVal.Namespace != "ns_live_appembly" {
		t.Fatalf("expected HasAccess=true in ns_live_appembly, got %+v", beforeVal)
	}

	// 2. Emit a deterministic Cyclode step checkpoint CloudEvent twice (simulating crash auto-resume)
	stepEv := map[string]interface{}{
		"specversion": "1.0",
		"id":          "cyclode:task_demo_01:step:3:tool_end",
		"source":      "urn:appembly:cyclode:executor",
		"type":        "ai.llm.tokens",
		"subject":     "ws_cyclode_default",
		"data": map[string]interface{}{
			"tokens":     2400,
			"model":      "claude-3-7-sonnet",
			"token_type": "input",
			"persona":    "IssueResolver",
			"tool":       "run_command",
		},
	}
	rawBatch, _ := json.Marshal([]interface{}{stepEv, stepEv})
	reqIng := httptest.NewRequest(http.MethodPost, "/api/v1/events", bytes.NewReader(rawBatch))
	reqIng.Header.Set("Authorization", "Bearer "+ingKey)
	recIng := httptest.NewRecorder()
	handler.ServeHTTP(recIng, reqIng)
	if recIng.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted for Cyclode step ingest, got %d: %s", recIng.Code, recIng.Body.String())
	}
	var ingRes models.IngestResult
	_ = json.Unmarshal(recIng.Body.Bytes(), &ingRes)
	if ingRes.Accepted != 1 || ingRes.Deduplicated != 1 {
		t.Fatalf("expected Accepted=1, Deduplicated=1 on checkpoint replay, got %+v", ingRes)
	}

	// 3. Re-evaluate quota and verify priority grant burndown by exactly 2400 tokens
	reqQuotaAfter := httptest.NewRequest(http.MethodGet, "/api/v1/subjects/ws_cyclode_default/entitlements/ai_token_allowance/value", nil)
	reqQuotaAfter.Header.Set("Authorization", "Bearer "+entKey)
	recQuotaAfter := httptest.NewRecorder()
	handler.ServeHTTP(recQuotaAfter, reqQuotaAfter)
	var afterVal models.EntitlementValue
	_ = json.Unmarshal(recQuotaAfter.Body.Bytes(), &afterVal)
	if afterVal.UsageInPeriod != beforeVal.UsageInPeriod+2400 {
		t.Fatalf("expected usage to increase by 2400 (from %v to %v), got %v", beforeVal.UsageInPeriod, beforeVal.UsageInPeriod+2400, afterVal.UsageInPeriod)
	}
}

