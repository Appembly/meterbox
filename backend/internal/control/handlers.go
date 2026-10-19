package control

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/meterbox/meterbox/internal/auth"
	"github.com/meterbox/meterbox/internal/billing"
	"github.com/meterbox/meterbox/internal/entitlement"
	"github.com/meterbox/meterbox/internal/ingest"
	"github.com/meterbox/meterbox/internal/models"
	"github.com/meterbox/meterbox/internal/store"
)

// Server wires the Control Plane API, the OpenMeter-compatible v1 API, and the Customer Portal API.
type Server struct {
	Store       *store.MultiTenantStore
	Ingest      *ingest.Pipeline
	Entitlement *entitlement.Engine
	Billing     *billing.Engine
}

func NewServer(s *store.MultiTenantStore) *Server {
	return &Server{
		Store:       s,
		Ingest:      ingest.NewPipeline(s),
		Entitlement: entitlement.NewEngine(s),
		Billing:     billing.NewEngine(s),
	}
}

// Router returns the complete HTTP handler with CORS and Scoped Auth & Namespace Injection Middleware.
func (s *Server) Router() http.Handler {
	mux := http.NewServeMux()

	// Interactive Control Plane UI on root
	mux.HandleFunc("GET /{$}", s.serveDashboardHTML)

	// Health check (unauthenticated)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"service": "meterbox-control-plane-and-edge-gateway",
		})
	})

	// Protected API tree (wrapped in auth.Middleware)
	apiMux := http.NewServeMux()

	// ========================================================================
	// 1. OPENMETER-COMPATIBLE DATA & METERING API (`/api/v1/*`)
	// ========================================================================
	apiMux.HandleFunc("POST /api/v1/events", s.handleIngestEvents)
	apiMux.HandleFunc("GET /api/v1/events", s.handleListEvents)

	apiMux.HandleFunc("GET /api/v1/meters", s.handleListMeters)
	apiMux.HandleFunc("POST /api/v1/meters", s.handleCreateMeter)
	apiMux.HandleFunc("GET /api/v1/meters/{slug}/query", s.handleQueryMeter)

	apiMux.HandleFunc("GET /api/v1/subjects", s.handleListSubjects)
	apiMux.HandleFunc("POST /api/v1/subjects", s.handleUpsertSubject)

	apiMux.HandleFunc("GET /api/v1/entitlements", s.handleListEntitlements)
	apiMux.HandleFunc("POST /api/v1/entitlements", s.handleCreateEntitlement)
	apiMux.HandleFunc("GET /api/v1/grants", s.handleListGrants)
	apiMux.HandleFunc("POST /api/v1/entitlements/{id}/grants", s.handleCreateGrant)
	apiMux.HandleFunc("GET /api/v1/subjects/{subject}/entitlements/{feature}/value", s.handleEvaluateEntitlement)

	apiMux.HandleFunc("GET /api/v1/plans", s.handleListPlans)
	apiMux.HandleFunc("POST /api/v1/plans", s.handleCreatePlan)
	apiMux.HandleFunc("GET /api/v1/subscriptions", s.handleListSubscriptions)
	apiMux.HandleFunc("POST /api/v1/subscriptions", s.handleCreateSubscription)
	apiMux.HandleFunc("GET /api/v1/invoices", s.handleListInvoices)
	apiMux.HandleFunc("POST /api/v1/invoices/generate", s.handleGenerateInvoice)

	apiMux.HandleFunc("POST /api/v1/portal/tokens", s.handleCreatePortalToken)

	// Native PostHog Ingestion & User Profile Hydration Bridge
	apiMux.HandleFunc("POST /api/v1/posthog/capture", s.handlePostHogCapture)
	apiMux.HandleFunc("POST /api/v1/posthog/batch", s.handlePostHogBatch)

	// ========================================================================
	// 2. METERBOX CONTROL PLANE API (`/api/control/v1/*`)
	// ========================================================================
	apiMux.HandleFunc("GET /api/control/v1/snapshot", s.handleGetSnapshot)
	apiMux.HandleFunc("GET /api/control/v1/cost-intelligence", s.handleGetCostIntelligence)
	apiMux.HandleFunc("GET /api/control/v1/analytics", s.handleGetProductAnalytics)

	apiMux.HandleFunc("GET /api/control/v1/organizations", s.handleListOrganizations)
	apiMux.HandleFunc("POST /api/control/v1/organizations", s.handleCreateOrganization)
	apiMux.HandleFunc("GET /api/control/v1/environments", s.handleListEnvironments)
	apiMux.HandleFunc("POST /api/control/v1/environments", s.handleCreateEnvironment)
	apiMux.HandleFunc("POST /api/control/v1/environments/reset", s.handleResetSandbox)
	apiMux.HandleFunc("GET /api/control/v1/telemetry", s.handleGetTelemetry)

	apiMux.HandleFunc("GET /api/control/v1/api-keys", s.handleListAPIKeys)
	apiMux.HandleFunc("POST /api/control/v1/api-keys", s.handleCreateAPIKey)
	apiMux.HandleFunc("DELETE /api/control/v1/api-keys/{id}", s.handleRevokeAPIKey)

	apiMux.HandleFunc("GET /api/control/v1/dlq", s.handleListDLQ)
	apiMux.HandleFunc("POST /api/control/v1/dlq/{id}/replay", s.handleReplayDLQ)

	apiMux.HandleFunc("GET /api/control/v1/dogfood", s.handleGetDogfoodUsage)

	// ========================================================================
	// 3. EMBEDDABLE CUSTOMER USAGE PORTAL API (`/api/portal/v1/*`)
	// ========================================================================
	apiMux.HandleFunc("GET /api/portal/v1/summary", s.handlePortalSummary)

	protected := auth.Middleware(s.Store)(apiMux)
	mux.Handle("/api/", protected)

	return corsMiddleware(mux)
}

func (s *Server) handleIngestEvents(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	requestedLane := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Meterbox-Lane")))

	var rawBody interface{}
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Request body must be valid CloudEvent JSON object or array")
		return
	}

	var batch []map[string]interface{}
	switch v := rawBody.(type) {
	case map[string]interface{}:
		batch = []map[string]interface{}{v}
	case []interface{}:
		for _, item := range v {
			if m, ok := item.(map[string]interface{}); ok {
				batch = append(batch, m)
			}
		}
	default:
		writeError(w, http.StatusBadRequest, "invalid_payload", "Expected CloudEvent object or array")
		return
	}

	res := s.Ingest.IngestBatch(tc, batch, requestedLane)
	w.Header().Set("X-Meterbox-Lane", res.RoutedLane)
	writeJSON(w, http.StatusAccepted, res)
}

func (s *Server) handleListEvents(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	events := s.Store.ListRecentEvents(tc.Namespace, limit)
	writeJSON(w, http.StatusOK, events)
}

func (s *Server) handleListMeters(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.ListMeters(tc.Namespace))
}

func (s *Server) handleCreateMeter(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var m models.Meter
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if m.Slug == "" || m.EventType == "" || m.Aggregation == "" {
		writeError(w, http.StatusBadRequest, "missing_fields", "slug, event_type, and aggregation are required")
		return
	}
	m.Namespace = tc.Namespace
	created := s.Store.CreateMeter(m)
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleQueryMeter(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	slug := r.PathValue("slug")
	subject := r.URL.Query().Get("subject")
	window := r.URL.Query().Get("window")
	res, err := s.Store.QueryMeter(tc.Namespace, slug, subject, nil, nil, window)
	if err != nil {
		writeError(w, http.StatusNotFound, "meter_not_found", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleListSubjects(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.ListSubjects(tc.Namespace))
}

func (s *Server) handleUpsertSubject(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var sub models.Subject
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if sub.Key == "" {
		writeError(w, http.StatusBadRequest, "missing_key", "subject key is required")
		return
	}
	sub.Namespace = tc.Namespace
	if sub.DisplayName == "" {
		sub.DisplayName = sub.Key
	}
	writeJSON(w, http.StatusCreated, s.Store.UpsertSubject(sub))
}

func (s *Server) handleListEntitlements(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	subject := r.URL.Query().Get("subject")
	writeJSON(w, http.StatusOK, s.Store.ListEntitlements(tc.Namespace, subject))
}

func (s *Server) handleCreateEntitlement(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var req struct {
		SubjectKey         string            `json:"subject_key"`
		FeatureKey         string            `json:"feature_key"`
		FeatureName        string            `json:"feature_name"`
		Type               string            `json:"type"`
		MeterSlug          string            `json:"meter_slug"`
		IssueAfterReset    float64           `json:"issue_after_reset"`
		IsSoftLimit        bool              `json:"is_soft_limit"`
		StaticConfig       map[string]string `json:"static_config"`
		InitialGrantAmount float64           `json:"initial_grant_amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if req.SubjectKey == "" || req.FeatureKey == "" {
		writeError(w, http.StatusBadRequest, "missing_fields", "subject_key and feature_key are required")
		return
	}
	if req.Type == "" {
		req.Type = "metered"
	}
	if req.FeatureName == "" {
		req.FeatureName = req.FeatureKey
	}
	grantAmt := req.InitialGrantAmount
	if grantAmt == 0 && req.IssueAfterReset > 0 {
		grantAmt = req.IssueAfterReset
	}
	ent := s.Store.CreateEntitlement(models.Entitlement{
		Namespace:       tc.Namespace,
		SubjectKey:      req.SubjectKey,
		FeatureKey:      req.FeatureKey,
		FeatureName:     req.FeatureName,
		Type:            req.Type,
		MeterSlug:       req.MeterSlug,
		IssueAfterReset: req.IssueAfterReset,
		IsSoftLimit:     req.IsSoftLimit,
		StaticConfig:    req.StaticConfig,
		ResetPeriod:     "MONTH",
	}, grantAmt)
	writeJSON(w, http.StatusCreated, ent)
}

func (s *Server) handleCreateGrant(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	entID := r.PathValue("id")
	var g models.EntitlementGrant
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	g.Namespace = tc.Namespace
	g.EntitlementID = entID
	created, err := s.Store.CreateGrant(g)
	if err != nil {
		writeError(w, http.StatusNotFound, "entitlement_not_found", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleEvaluateEntitlement(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	subject := r.PathValue("subject")
	feature := r.PathValue("feature")

	val, err := s.Entitlement.Evaluate(tc.Namespace, subject, feature)
	if err != nil {
		writeError(w, http.StatusNotFound, "entitlement_not_found", err.Error())
		return
	}
	w.Header().Set("X-Meterbox-Cache", val.CacheStatus)
	writeJSON(w, http.StatusOK, val)
}

func (s *Server) handleListPlans(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.ListPlans(tc.Namespace))
}

func (s *Server) handleCreatePlan(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var p models.Plan
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	p.Namespace = tc.Namespace
	writeJSON(w, http.StatusCreated, s.Store.CreatePlan(p))
}

func (s *Server) handleListSubscriptions(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.ListSubscriptions(tc.Namespace))
}

func (s *Server) handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var sub models.Subscription
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	sub.Namespace = tc.Namespace
	writeJSON(w, http.StatusCreated, s.Store.CreateSubscription(sub))
}

func (s *Server) handleListInvoices(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.ListInvoices(tc.Namespace))
}

func (s *Server) handleGenerateInvoice(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var req struct {
		SubjectKey   string `json:"subject_key"`
		PlanSlug     string `json:"plan_slug"`
		SyncToStripe bool   `json:"sync_to_stripe"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	inv, err := s.Billing.GenerateInvoice(tc.Namespace, req.SubjectKey, req.PlanSlug, req.SyncToStripe)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invoice_generation_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, inv)
}

func (s *Server) handleCreatePortalToken(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var req struct {
		SubjectKey string `json:"subject_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SubjectKey == "" {
		writeError(w, http.StatusBadRequest, "missing_subject", "subject_key is required to mint a Customer Portal token")
		return
	}
	k, err := s.Store.CreateAPIKey(tc.Namespace, "Customer Portal Session ("+req.SubjectKey+")", models.ScopePortal, req.SubjectKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token_creation_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, k)
}

func (s *Server) handleListOrganizations(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.Store.ListOrganizations())
}

func (s *Server) handleCreateOrganization(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name         string `json:"name"`
		Slug         string `json:"slug"`
		BillingEmail string `json:"billing_email"`
		PlanTier     string `json:"plan_tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	org, envs, err := s.Store.CreateOrganization(req.Name, req.Slug, req.BillingEmail, req.PlanTier)
	if err != nil {
		writeError(w, http.StatusBadRequest, "org_creation_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"organization": org,
		"environments": envs,
	})
}

func (s *Server) handleListEnvironments(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.Store.ListEnvironments())
}

func (s *Server) handleCreateEnvironment(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var req struct {
		OrgID        string `json:"org_id"`
		Name         string `json:"name"`
		Slug         string `json:"slug"`
		Type         string `json:"type"`
		RateLimitRPS int    `json:"rate_limit_rps"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	orgID := req.OrgID
	if orgID == "" && tc != nil {
		orgID = tc.OrgID
	}
	env, err := s.Store.CreateEnvironment(orgID, req.Name, req.Slug, req.Type, req.RateLimitRPS)
	if err != nil {
		writeError(w, http.StatusBadRequest, "env_creation_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, env)
}

func (s *Server) handleResetSandbox(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	if err := s.Store.ResetSandboxNamespace(tc.Namespace); err != nil {
		writeError(w, http.StatusBadRequest, "sandbox_reset_rejected", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "reset_complete",
		"namespace": tc.Namespace,
	})
}

func (s *Server) handleGetTelemetry(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.GetTelemetry(tc.Namespace))
}

func (s *Server) handleListAPIKeys(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.ListAPIKeys(tc.Namespace))
}

func (s *Server) handleCreateAPIKey(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var req struct {
		Name          string          `json:"name"`
		Scope         models.KeyScope `json:"scope"`
		SubjectFilter string          `json:"subject_filter"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if req.Name == "" {
		req.Name = "Generated Key"
	}
	if req.Scope == "" {
		req.Scope = models.ScopeIngest
	}
	k, err := s.Store.CreateAPIKey(tc.Namespace, req.Name, req.Scope, req.SubjectFilter)
	if err != nil {
		writeError(w, http.StatusBadRequest, "key_creation_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, k)
}

func (s *Server) handleRevokeAPIKey(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	id := r.PathValue("id")
	if !s.Store.RevokeAPIKey(tc.Namespace, id) {
		writeError(w, http.StatusNotFound, "key_not_found", "API key not found in namespace")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked", "id": id})
}

func (s *Server) handleListDLQ(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.ListDLQEvents(tc.Namespace))
}

func (s *Server) handleReplayDLQ(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	dlqID := r.PathValue("id")
	var req struct {
		Payload map[string]interface{} `json:"payload"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	res, err := s.Ingest.ReplayDLQEvent(tc, dlqID, req.Payload)
	if err != nil {
		writeError(w, http.StatusNotFound, "dlq_not_found", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleGetDogfoodUsage(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	orgID := ""
	if tc != nil {
		orgID = tc.OrgID
	}
	res, err := s.Store.QueryMeter(models.InternalDogfoodNamespace, "meterbox_ingested_events", orgID, nil, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "dogfood_query_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"internal_namespace": models.InternalDogfoodNamespace,
		"organization_id":    orgID,
		"meter_result":       res,
	})
}

func (s *Server) handlePortalSummary(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	subject := tc.SubjectFilter
	if subject == "" {
		subject = r.URL.Query().Get("subject")
	}
	if subject == "" {
		subs := s.Store.ListSubjects(tc.Namespace)
		if len(subs) > 0 {
			subject = subs[0].Key
		}
	}

	ents := s.Store.ListEntitlements(tc.Namespace, subject)
	evaluatedEnts := make([]models.EntitlementValue, 0, len(ents))
	for _, e := range ents {
		if val, err := s.Entitlement.Evaluate(tc.Namespace, subject, e.FeatureKey); err == nil {
			evaluatedEnts = append(evaluatedEnts, val)
		}
	}

	meters := s.Store.ListMeters(tc.Namespace)
	meterSummaries := make([]models.MeterQueryResult, 0, len(meters))
	for _, m := range meters {
		if qRes, err := s.Store.QueryMeter(tc.Namespace, m.Slug, subject, nil, nil); err == nil {
			meterSummaries = append(meterSummaries, qRes)
		}
	}

	invoices := s.Store.ListInvoices(tc.Namespace)
	subjectInvoices := make([]models.Invoice, 0)
	for _, inv := range invoices {
		if inv.SubjectKey == subject {
			subjectInvoices = append(subjectInvoices, inv)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"namespace":    tc.Namespace,
		"subject_key":  subject,
		"entitlements": evaluatedEnts,
		"meters":       meterSummaries,
		"invoices":     subjectInvoices,
	})
}

func (s *Server) handleListGrants(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	subject := r.URL.Query().Get("subject")
	writeJSON(w, http.StatusOK, s.Store.ListAllGrants(tc.Namespace, subject))
}

func (s *Server) handlePostHogCapture(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var rawBody interface{}
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Request body must be valid PostHog capture JSON")
		return
	}

	var batch []map[string]interface{}
	switch v := rawBody.(type) {
	case map[string]interface{}:
		if innerBatch, ok := v["batch"].([]interface{}); ok {
			for _, item := range innerBatch {
				if m, ok := item.(map[string]interface{}); ok {
					batch = append(batch, m)
				}
			}
		} else {
			batch = []map[string]interface{}{v}
		}
	case []interface{}:
		for _, item := range v {
			if m, ok := item.(map[string]interface{}); ok {
				batch = append(batch, m)
			}
		}
	default:
		writeError(w, http.StatusBadRequest, "invalid_payload", "Expected PostHog event object or batch array")
		return
	}

	res := s.Ingest.IngestPostHogBatch(tc, batch)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":        1,
		"ingest_result": res,
	})
}

func (s *Server) handlePostHogBatch(w http.ResponseWriter, r *http.Request) {
	s.handlePostHogCapture(w, r)
}

func (s *Server) handleGetCostIntelligence(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.GetCostIntelligence(tc.Namespace))
}

func (s *Server) handleGetProductAnalytics(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.GetProductAnalytics(tc.Namespace))
}

func (s *Server) handleGetSnapshot(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	ns := tc.Namespace
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 35
	}

	snap := models.NamespaceSnapshot{
		Namespace:        ns,
		Organizations:    s.Store.ListOrganizations(),
		Environments:     s.Store.ListEnvironments(),
		Telemetry:        s.Store.GetTelemetry(ns),
		Meters:           s.Store.ListMeters(ns),
		Subjects:         s.Store.ListSubjects(ns),
		Entitlements:     s.Store.ListEntitlements(ns, ""),
		Grants:           s.Store.ListAllGrants(ns, ""),
		Plans:            s.Store.ListPlans(ns),
		Subscriptions:    s.Store.ListSubscriptions(ns),
		Invoices:         s.Store.ListInvoices(ns),
		APIKeys:          s.Store.ListAPIKeys(ns),
		DLQEvents:        s.Store.ListDLQEvents(ns),
		RecentEvents:     s.Store.ListRecentEvents(ns, limit),
		CostIntelligence: s.Store.GetCostIntelligence(ns),
		ProductAnalytics: s.Store.GetProductAnalytics(ns),
	}
	writeJSON(w, http.StatusOK, snap)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Meterbox-Key, X-OpenMeter-Namespace, X-Meterbox-Env-ID, X-Meterbox-Lane")
		w.Header().Set("Access-Control-Expose-Headers", "X-OpenMeter-Namespace, X-Meterbox-Cache, X-Meterbox-Lane")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]interface{}{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
