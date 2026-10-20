package control

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/meterbox/meterbox/internal/auth"
	"github.com/meterbox/meterbox/internal/models"
)

func (s *Server) handleListPaymentMethods(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	subject := r.URL.Query().Get("subject")
	writeJSON(w, http.StatusOK, s.Store.ListPaymentMethods(tc.Namespace, subject))
}

func (s *Server) handleAttachPaymentMethod(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var pm models.PaymentMethod
	if err := json.NewDecoder(r.Body).Decode(&pm); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if pm.SubjectKey == "" {
		writeError(w, http.StatusBadRequest, "missing_subject", "subject_key is required to attach a payment method")
		return
	}
	pm.Namespace = tc.Namespace
	created := s.Store.AttachPaymentMethod(pm)
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleSetDefaultPaymentMethod(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	id := r.PathValue("id")
	pm, ok := s.Store.SetDefaultPaymentMethod(tc.Namespace, id)
	if !ok {
		writeError(w, http.StatusNotFound, "payment_method_not_found", "Payment method not found in namespace")
		return
	}
	writeJSON(w, http.StatusOK, pm)
}

func (s *Server) handleDetachPaymentMethod(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	id := r.PathValue("id")
	if !s.Store.DetachPaymentMethod(tc.Namespace, id) {
		writeError(w, http.StatusNotFound, "payment_method_not_found", "Payment method not found in namespace")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "detached", "id": id})
}

func (s *Server) handleListCheckoutSessions(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	subject := r.URL.Query().Get("subject")
	writeJSON(w, http.StatusOK, s.Store.ListCheckoutSessions(tc.Namespace, subject))
}

func (s *Server) handleCreateCheckoutSession(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var req struct {
		SubjectKey      string  `json:"subject_key"`
		Provider        string  `json:"provider"`
		Mode            string  `json:"mode"` // "topup" | "setup"
		FeatureKey      string  `json:"feature_key"`
		GrantUnits      float64 `json:"grant_units"`
		AmountCents     int     `json:"amount_cents"`
		Currency        string  `json:"currency"`
		InstantComplete bool    `json:"instant_complete"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if req.SubjectKey == "" {
		writeError(w, http.StatusBadRequest, "missing_subject", "subject_key is required")
		return
	}
	cs, grant, err := s.Store.CreateCheckoutSession(models.CheckoutSession{
		Namespace:   tc.Namespace,
		SubjectKey:  req.SubjectKey,
		Provider:    req.Provider,
		Mode:        req.Mode,
		FeatureKey:  req.FeatureKey,
		GrantUnits:  req.GrantUnits,
		AmountCents: req.AmountCents,
		Currency:    req.Currency,
	}, req.InstantComplete)
	if err != nil {
		writeError(w, http.StatusBadRequest, "checkout_session_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"session": cs,
		"grant":   grant,
	})
}

func (s *Server) handleListAutoRechargeRules(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	subject := r.URL.Query().Get("subject")
	writeJSON(w, http.StatusOK, s.Store.ListAutoRechargeRules(tc.Namespace, subject))
}

func (s *Server) handleUpsertAutoRechargeRule(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	var rule models.AutoRechargeRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if rule.SubjectKey == "" {
		writeError(w, http.StatusBadRequest, "missing_subject", "subject_key is required")
		return
	}
	rule.Namespace = tc.Namespace
	if rule.ThresholdUnits <= 0 {
		rule.ThresholdUnits = 500000
	}
	if rule.RechargeUnits <= 0 {
		rule.RechargeUnits = 2500000
	}
	if rule.ChargeAmountCents <= 0 {
		rule.ChargeAmountCents = 5000
	}
	saved := s.Store.UpsertAutoRechargeRule(rule)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleTriggerAutoRecharge(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	subject := r.PathValue("subject")
	var req struct {
		FeatureKey string `json:"feature_key"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	grant, session, err := s.Store.MaybeTriggerAutoRecharge(tc.Namespace, subject, req.FeatureKey, 0, true)
	if err != nil {
		writeError(w, http.StatusBadRequest, "auto_recharge_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "recharged",
		"grant":   grant,
		"session": session,
	})
}

func (s *Server) handleListPaymentWebhooks(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	writeJSON(w, http.StatusOK, s.Store.ListPaymentWebhooks(tc.Namespace))
}

func (s *Server) handlePaymentWebhook(w http.ResponseWriter, r *http.Request) {
	tc := auth.TenantFromContext(r.Context())
	ns := "ns_live_appembly"
	if tc != nil && tc.Namespace != "" {
		ns = tc.Namespace
	}
	s.processWebhookRequest(w, r, ns)
}

func (s *Server) handlePublicStripeWebhook(w http.ResponseWriter, r *http.Request) {
	ns := strings.TrimSpace(r.Header.Get("X-OpenMeter-Namespace"))
	if ns == "" {
		ns = r.URL.Query().Get("namespace")
	}
	if ns == "" {
		ns = "ns_live_appembly"
	}
	s.processWebhookRequest(w, r, ns)
}

func (s *Server) processWebhookRequest(w http.ResponseWriter, r *http.Request, defaultNamespace string) {
	rawBody, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeError(w, http.StatusBadRequest, "read_failed", err.Error())
		return
	}

	// Verify HMAC-SHA256 Stripe-Signature when STRIPE_WEBHOOK_SECRET is configured
	webhookSecret := strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET"))
	sigHeader := strings.TrimSpace(r.Header.Get("Stripe-Signature"))
	sigVerified := true
	if webhookSecret != "" {
		sigVerified = verifyStripeSignature(rawBody, sigHeader, webhookSecret)
		if !sigVerified {
			writeError(w, http.StatusUnauthorized, "invalid_signature", "Stripe-Signature HMAC-SHA256 verification failed")
			return
		}
	}

	var payload struct {
		ID          string `json:"id"`
		Type        string `json:"type"`
		EventType   string `json:"event_type"`
		Provider    string `json:"provider"`
		Namespace   string `json:"namespace"`
		SubjectKey  string `json:"subject_key"`
		ObjectID    string `json:"object_id"`
		FeatureKey  string `json:"feature_key"`
		AmountCents int    `json:"amount_cents"`
		GrantUnits  float64 `json:"grant_units"`
		Data        struct {
			Object map[string]interface{} `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	ns := payload.Namespace
	if ns == "" {
		ns = defaultNamespace
	}
	evType := payload.EventType
	if evType == "" {
		evType = payload.Type
	}
	if evType == "" {
		writeError(w, http.StatusBadRequest, "missing_event_type", "event_type (or Stripe 'type') is required")
		return
	}

	// Support native Stripe webhook envelope (`data.object`) as well as direct control-plane payloads
	if payload.Data.Object != nil {
		obj := payload.Data.Object
		if payload.ObjectID == "" {
			if idStr, ok := obj["id"].(string); ok {
				payload.ObjectID = idStr
			}
		}
		if payload.AmountCents == 0 {
			if amt, ok := obj["amount"].(float64); ok {
				payload.AmountCents = int(amt)
			} else if amtPaid, ok := obj["amount_paid"].(float64); ok {
				payload.AmountCents = int(amtPaid)
			}
		}
		if meta, ok := obj["metadata"].(map[string]interface{}); ok {
			if payload.SubjectKey == "" {
				if sk, ok := meta["subject_key"].(string); ok {
					payload.SubjectKey = sk
				}
			}
			if payload.FeatureKey == "" {
				if fk, ok := meta["feature_key"].(string); ok {
					payload.FeatureKey = fk
				}
			}
			if ns == defaultNamespace {
				if mns, ok := meta["namespace"].(string); ok && mns != "" {
					ns = mns
				}
			}
		}
	}

	wh, err := s.Store.ProcessPaymentWebhook(
		ns,
		payload.Provider,
		payload.ID,
		evType,
		payload.SubjectKey,
		payload.ObjectID,
		payload.FeatureKey,
		payload.AmountCents,
		payload.GrantUnits,
		sigVerified,
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, "webhook_processing_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, wh)
}

func verifyStripeSignature(payload []byte, sigHeader, secret string) bool {
	if sigHeader == "" {
		return false
	}
	var timestamp, v1Sig string
	for _, part := range strings.Split(sigHeader, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			v1Sig = kv[1]
		}
	}
	if timestamp == "" || v1Sig == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(v1Sig))
}
