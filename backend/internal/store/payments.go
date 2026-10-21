package store

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/meterbox/meterbox/internal/models"
)

func (s *MultiTenantStore) seedPaymentOrchestrationEntities(ns string, now time.Time) {
	isAppembly := strings.Contains(ns, "appembly")
	primarySub := "ws_cyclode_default"
	secondarySub := "ws_swarmteam_pods"
	primaryCus := "cus_appembly_cyclode_01"
	secondaryCus := "cus_appembly_swarm_01"
	featureKey := "ai_token_allowance"

	if !isAppembly {
		primarySub = "sub_enterprise_alpha"
		secondarySub = "sub_startup_beta"
		primaryCus = "cus_demo_alpha_01"
		secondaryCus = "cus_demo_beta_01"
		featureKey = "llm_tokens_monthly"
	}

	pm1 := models.PaymentMethod{
		ID:                      s.NextID("pm_mbx"),
		Namespace:               ns,
		SubjectKey:              primarySub,
		Provider:                "stripe",
		ProviderCustomerID:      primaryCus,
		ProviderPaymentMethodID: fmt.Sprintf("pm_1QxStripe4242_%s", primarySub),
		Brand:                   "visa",
		Last4:                   "4242",
		ExpMonth:                12,
		ExpYear:                 2028,
		IsDefault:               true,
		Status:                  "active",
		CreatedAt:               now.Add(-72 * time.Hour),
	}
	pm2 := models.PaymentMethod{
		ID:                      s.NextID("pm_mbx"),
		Namespace:               ns,
		SubjectKey:              secondarySub,
		Provider:                "stripe",
		ProviderCustomerID:      secondaryCus,
		ProviderPaymentMethodID: fmt.Sprintf("pm_1QxStripe8819_%s", secondarySub),
		Brand:                   "mastercard",
		Last4:                   "8819",
		ExpMonth:                8,
		ExpYear:                 2027,
		IsDefault:               true,
		Status:                  "active",
		CreatedAt:               now.Add(-48 * time.Hour),
	}
	s.paymentMethods[pm1.ID] = pm1
	s.paymentMethods[pm2.ID] = pm2

	lastTrig := now.Add(-6 * time.Hour)
	rule1 := models.AutoRechargeRule{
		ID:                s.NextID("ar"),
		Namespace:         ns,
		SubjectKey:        primarySub,
		FeatureKey:        featureKey,
		Enabled:           true,
		ThresholdUnits:    500000,
		RechargeUnits:     2500000,
		ChargeAmountCents: 5000,
		Currency:          "USD",
		PaymentMethodID:   pm1.ID,
		CooldownMinutes:   15,
		LastTriggeredAt:   &lastTrig,
		TotalTriggers:     1,
		UpdatedAt:         now.Add(-6 * time.Hour),
	}
	rule2 := models.AutoRechargeRule{
		ID:                s.NextID("ar"),
		Namespace:         ns,
		SubjectKey:        secondarySub,
		FeatureKey:        featureKey,
		Enabled:           true,
		ThresholdUnits:    1000000,
		RechargeUnits:     5000000,
		ChargeAmountCents: 9500,
		Currency:          "USD",
		PaymentMethodID:   pm2.ID,
		CooldownMinutes:   15,
		TotalTriggers:     0,
		UpdatedAt:         now.Add(-24 * time.Hour),
	}
	s.autoRechargeRules[ns+":"+rule1.SubjectKey+":"+rule1.FeatureKey] = rule1
	s.autoRechargeRules[ns+":"+rule2.SubjectKey+":"+rule2.FeatureKey] = rule2

	compAt := now.Add(-6 * time.Hour)
	cs1 := models.CheckoutSession{
		ID:                s.NextID("cs_mbx"),
		Namespace:         ns,
		SubjectKey:        primarySub,
		Provider:          "stripe",
		ProviderSessionID: fmt.Sprintf("cs_live_topup_%s_01", primarySub),
		Mode:              "auto_recharge",
		FeatureKey:        featureKey,
		GrantUnits:        2500000,
		AmountCents:       5000,
		Currency:          "USD",
		CheckoutURL:       fmt.Sprintf("https://checkout.stripe.com/c/pay/cs_live_topup_%s_01", primarySub),
		Status:            "succeeded",
		PaymentIntentID:   fmt.Sprintf("pi_3QxAutoRecharge_%s_01", primarySub),
		GrantID:           "grt_0001",
		CreatedAt:         compAt,
		CompletedAt:       &compAt,
	}
	s.checkoutSessions[cs1.ID] = cs1

	s.paymentWebhooks = append(s.paymentWebhooks,
		models.PaymentWebhookEvent{
			ID:                s.NextID("wh"),
			Namespace:         ns,
			Provider:          "stripe",
			EventID:           fmt.Sprintf("evt_setup_%s_01", primarySub),
			EventType:         "setup_intent.succeeded",
			SubjectKey:        primarySub,
			ObjectID:          pm1.ProviderPaymentMethodID,
			AmountCents:       0,
			Currency:          "USD",
			Status:            "processed",
			ActionTaken:       fmt.Sprintf("Vaulted default Visa •••• %s (%s) for off-session charges", pm1.Last4, pm1.ID),
			SignatureVerified: true,
			ReceivedAt:        now.Add(-72 * time.Hour),
		},
		models.PaymentWebhookEvent{
			ID:                s.NextID("wh"),
			Namespace:         ns,
			Provider:          "stripe",
			EventID:           fmt.Sprintf("evt_pi_succeeded_%s_01", primarySub),
			EventType:         "payment_intent.succeeded",
			SubjectKey:        primarySub,
			ObjectID:          cs1.PaymentIntentID,
			AmountCents:       5000,
			Currency:          "USD",
			Status:            "processed",
			ActionTaken:       "Auto-recharge ($50.00): minted Priority-1 Credit Grant (+2,500,000 units) & invalidated edge cache",
			SignatureVerified: true,
			ReceivedAt:        compAt,
		},
	)
}

func (s *MultiTenantStore) ListPaymentMethods(ns, subjectFilter string) []models.PaymentMethod {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.PaymentMethod, 0)
	for _, pm := range s.paymentMethods {
		if pm.Namespace == ns && pm.Status != "detached" && (subjectFilter == "" || pm.SubjectKey == subjectFilter) {
			out = append(out, pm)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].SubjectKey == out[j].SubjectKey {
			if out[i].IsDefault != out[j].IsDefault {
				return out[i].IsDefault
			}
			return out[i].CreatedAt.After(out[j].CreatedAt)
		}
		return out[i].SubjectKey < out[j].SubjectKey
	})
	return out
}

func (s *MultiTenantStore) GetDefaultPaymentMethodLocked(ns, subjectKey string) (models.PaymentMethod, bool) {
	var fallback *models.PaymentMethod
	for _, pm := range s.paymentMethods {
		if pm.Namespace == ns && pm.SubjectKey == subjectKey && pm.Status == "active" {
			if pm.IsDefault {
				return pm, true
			}
			if fallback == nil {
				cp := pm
				fallback = &cp
			}
		}
	}
	if fallback != nil {
		return *fallback, true
	}
	return models.PaymentMethod{}, false
}

func (s *MultiTenantStore) AttachPaymentMethod(pm models.PaymentMethod) models.PaymentMethod {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	pm.ID = s.NextID("pm_mbx")
	pm.CreatedAt = now
	if pm.Provider == "" {
		pm.Provider = "stripe"
	}
	if pm.Brand == "" {
		pm.Brand = "visa"
	}
	if len(pm.Last4) != 4 {
		pm.Last4 = "4242"
	}
	if pm.ExpMonth <= 0 || pm.ExpMonth > 12 {
		pm.ExpMonth = 12
	}
	if pm.ExpYear < 2026 {
		pm.ExpYear = 2029
	}
	if pm.ProviderPaymentMethodID == "" {
		pm.ProviderPaymentMethodID = fmt.Sprintf("pm_%s_%s_%d", pm.Provider, pm.Last4, now.Unix()%10000)
	}
	if pm.ProviderCustomerID == "" {
		if sub, ok := s.subjects[pm.Namespace+":"+pm.SubjectKey]; ok && sub.StripeCustomerID != "" {
			pm.ProviderCustomerID = sub.StripeCustomerID
		} else {
			pm.ProviderCustomerID = fmt.Sprintf("cus_%s_%s", pm.Provider, pm.SubjectKey)
		}
	}
	pm.Status = "active"

	// If first active card for subject or explicitly marked default, clear previous defaults
	hasDefault := false
	for id, existing := range s.paymentMethods {
		if existing.Namespace == pm.Namespace && existing.SubjectKey == pm.SubjectKey && existing.Status == "active" {
			if pm.IsDefault {
				existing.IsDefault = false
				s.paymentMethods[id] = existing
			} else if existing.IsDefault {
				hasDefault = true
			}
		}
	}
	if !hasDefault {
		pm.IsDefault = true
	}

	s.paymentMethods[pm.ID] = pm

	// Record setup_intent.succeeded webhook log
	s.paymentWebhooks = append(s.paymentWebhooks, models.PaymentWebhookEvent{
		ID:                s.NextID("wh"),
		Namespace:         pm.Namespace,
		Provider:          pm.Provider,
		EventID:           fmt.Sprintf("evt_setup_%d", now.UnixNano()%1000000),
		EventType:         "setup_intent.succeeded",
		SubjectKey:        pm.SubjectKey,
		ObjectID:          pm.ProviderPaymentMethodID,
		AmountCents:       0,
		Currency:          "USD",
		Status:            "processed",
		ActionTaken:       fmt.Sprintf("Vaulted %s •••• %s (%s) via %s SetupIntent", strings.Title(pm.Brand), pm.Last4, pm.ID, strings.Title(pm.Provider)),
		SignatureVerified: true,
		ReceivedAt:        now,
	})

	s.saveStateLocked()
	return pm
}

func (s *MultiTenantStore) SetDefaultPaymentMethod(ns, id string) (models.PaymentMethod, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	target, ok := s.paymentMethods[id]
	if !ok || target.Namespace != ns || target.Status == "detached" {
		return models.PaymentMethod{}, false
	}
	for k, pm := range s.paymentMethods {
		if pm.Namespace == ns && pm.SubjectKey == target.SubjectKey {
			pm.IsDefault = (k == id)
			s.paymentMethods[k] = pm
		}
	}
	target.IsDefault = true
	s.saveStateLocked()
	return target, true
}

func (s *MultiTenantStore) DetachPaymentMethod(ns, id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	target, ok := s.paymentMethods[id]
	if !ok || target.Namespace != ns {
		return false
	}
	target.Status = "detached"
	target.IsDefault = false
	s.paymentMethods[id] = target
	s.saveStateLocked()
	return true
}

func (s *MultiTenantStore) ListAutoRechargeRules(ns, subjectFilter string) []models.AutoRechargeRule {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.AutoRechargeRule, 0)
	for _, r := range s.autoRechargeRules {
		if r.Namespace == ns && (subjectFilter == "" || r.SubjectKey == subjectFilter) {
			out = append(out, r)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].SubjectKey == out[j].SubjectKey {
			return out[i].FeatureKey < out[j].FeatureKey
		}
		return out[i].SubjectKey < out[j].SubjectKey
	})
	return out
}

func (s *MultiTenantStore) UpsertAutoRechargeRule(rule models.AutoRechargeRule) models.AutoRechargeRule {
	s.mu.Lock()
	defer s.mu.Unlock()

	if rule.FeatureKey == "" {
		// Pick first metered entitlement feature for subject if omitted
		for _, ent := range s.entitlements {
			if ent.Namespace == rule.Namespace && ent.SubjectKey == rule.SubjectKey {
				rule.FeatureKey = ent.FeatureKey
				break
			}
		}
		if rule.FeatureKey == "" {
			rule.FeatureKey = "ai_token_allowance"
		}
	}

	key := rule.Namespace + ":" + rule.SubjectKey + ":" + rule.FeatureKey
	existing, exists := s.autoRechargeRules[key]
	if exists {
		rule.ID = existing.ID
		rule.LastTriggeredAt = existing.LastTriggeredAt
		rule.TotalTriggers = existing.TotalTriggers
	} else {
		rule.ID = s.NextID("ar")
	}

	if rule.Currency == "" {
		rule.Currency = "USD"
	}
	if rule.CooldownMinutes <= 0 {
		rule.CooldownMinutes = 15
	}
	if rule.PaymentMethodID == "" {
		if pm, ok := s.GetDefaultPaymentMethodLocked(rule.Namespace, rule.SubjectKey); ok {
			rule.PaymentMethodID = pm.ID
		}
	}
	rule.UpdatedAt = time.Now().UTC()
	s.autoRechargeRules[key] = rule
	s.saveStateLocked()
	return rule
}

func (s *MultiTenantStore) ListCheckoutSessions(ns, subjectFilter string) []models.CheckoutSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.CheckoutSession, 0)
	for _, cs := range s.checkoutSessions {
		if cs.Namespace == ns && (subjectFilter == "" || cs.SubjectKey == subjectFilter) {
			out = append(out, cs)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

// findOrCreateEntitlementLocked locates the target metered entitlement for `(ns, subjectKey, featureKey)`.
func (s *MultiTenantStore) findOrCreateEntitlementLocked(ns, subjectKey, featureKey string) models.Entitlement {
	for _, ent := range s.entitlements {
		if ent.Namespace == ns && ent.SubjectKey == subjectKey && (featureKey == "" || ent.FeatureKey == featureKey) {
			return ent
		}
	}
	// If subject has no entitlement yet, create a default metered entitlement
	if featureKey == "" {
		featureKey = "ai_token_allowance"
	}
	meterSlug := "llm_tokens_total"
	for _, m := range s.meters {
		if m.Namespace == ns {
			meterSlug = m.Slug
			break
		}
	}
	now := time.Now().UTC()
	ent := models.Entitlement{
		ID:              s.NextID("ent"),
		Namespace:       ns,
		SubjectKey:      subjectKey,
		FeatureKey:      featureKey,
		FeatureName:     "Prepaid Metered Allowance",
		Type:            "metered",
		MeterSlug:       meterSlug,
		IssueAfterReset: 1000000,
		IsSoftLimit:     true,
		ResetPeriod:     "MONTH",
		PeriodStart:     time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC),
		CreatedAt:       now,
	}
	s.entitlements[ent.ID] = ent
	return ent
}

func (s *MultiTenantStore) CreateCheckoutSession(cs models.CheckoutSession, instantComplete bool) (models.CheckoutSession, *models.EntitlementGrant, error) {
	if cs.SubjectKey == "" {
		return models.CheckoutSession{}, nil, errors.New("subject_key is required")
	}
	s.mu.Lock()
	now := time.Now().UTC()
	cs.ID = s.NextID("cs_mbx")
	if cs.Provider == "" {
		cs.Provider = "stripe"
	}
	if cs.Mode == "" {
		cs.Mode = "topup"
	}
	if cs.Currency == "" {
		cs.Currency = "USD"
	}
	if cs.AmountCents <= 0 && cs.Mode != "setup" {
		cs.AmountCents = 5000
	}
	if cs.GrantUnits <= 0 && cs.Mode != "setup" {
		cs.GrantUnits = 2500000
	}
	cs.ProviderSessionID = fmt.Sprintf("cs_live_%s_%d", cs.SubjectKey, now.UnixNano()%1000000)
	cs.PaymentIntentID = fmt.Sprintf("pi_3Qx_%s_%d", cs.SubjectKey, now.UnixNano()%1000000)
	cs.CheckoutURL = fmt.Sprintf("https://checkout.stripe.com/c/pay/%s", cs.ProviderSessionID)
	cs.Status = "open"
	cs.CreatedAt = now
	s.checkoutSessions[cs.ID] = cs
	s.saveStateLocked()
	s.mu.Unlock()

	if instantComplete {
		_, grant, err := s.completeTopUpSession(cs.Namespace, cs.ID, cs.PaymentIntentID, "Top-Up Checkout")
		if err != nil {
			return cs, nil, err
		}
		s.mu.RLock()
		updated := s.checkoutSessions[cs.ID]
		s.mu.RUnlock()
		return updated, grant, nil
	}

	return cs, nil, nil
}

func (s *MultiTenantStore) completeTopUpSession(ns, sessionID, paymentIntentID, label string) (models.PaymentWebhookEvent, *models.EntitlementGrant, error) {
	s.mu.Lock()
	cs, ok := s.checkoutSessions[sessionID]
	if !ok || cs.Namespace != ns {
		s.mu.Unlock()
		return models.PaymentWebhookEvent{}, nil, errors.New("checkout session not found")
	}

	now := time.Now().UTC()
	ent := s.findOrCreateEntitlementLocked(ns, cs.SubjectKey, cs.FeatureKey)
	grant := models.EntitlementGrant{
		ID:              s.NextID("grt"),
		Namespace:       ns,
		EntitlementID:   ent.ID,
		SubjectKey:      cs.SubjectKey,
		FeatureKey:      ent.FeatureKey,
		Name:            fmt.Sprintf("%s ($%.2f)", label, float64(cs.AmountCents)/100.0),
		Amount:          cs.GrantUnits,
		Remaining:       cs.GrantUnits,
		Priority:        1,
		RolloverEnabled: true,
		EffectiveAt:     now,
		CreatedAt:       now,
	}
	s.grants[ent.ID] = append(s.grants[ent.ID], grant)

	cs.Status = "succeeded"
	cs.GrantID = grant.ID
	cs.CompletedAt = &now
	if paymentIntentID != "" {
		cs.PaymentIntentID = paymentIntentID
	}
	s.checkoutSessions[cs.ID] = cs

	wh := models.PaymentWebhookEvent{
		ID:                s.NextID("wh"),
		Namespace:         ns,
		Provider:          cs.Provider,
		EventID:           fmt.Sprintf("evt_pi_%d", now.UnixNano()%1000000),
		EventType:         "payment_intent.succeeded",
		SubjectKey:        cs.SubjectKey,
		ObjectID:          cs.PaymentIntentID,
		AmountCents:       cs.AmountCents,
		Currency:          cs.Currency,
		Status:            "processed",
		ActionTaken:       fmt.Sprintf("Minted Priority-1 Credit Grant %s (+%.0f units) on %s & invalidated edge cache", grant.ID, grant.Amount, ent.FeatureKey),
		SignatureVerified: true,
		ReceivedAt:        now,
	}
	s.paymentWebhooks = append(s.paymentWebhooks, wh)
	s.saveStateLocked()
	s.mu.Unlock()

	s.InvalidateSubjectEntitlementCache(ns, cs.SubjectKey)
	return wh, &grant, nil
}

// MaybeTriggerAutoRecharge checks if `(ns, subjectKey, featureKey)` has an enabled AutoRechargeRule
// whose threshold has been crossed (`currentBalance <= rule.ThresholdUnits`), and if an active card
// is on file, charges it off-session and mints a Priority-1 credit grant immediately.
func (s *MultiTenantStore) MaybeTriggerAutoRecharge(ns, subjectKey, featureKey string, currentBalance float64, force bool) (*models.EntitlementGrant, *models.CheckoutSession, error) {
	s.mu.Lock()
	var matchedKey string
	var rule models.AutoRechargeRule
	found := false
	for k, r := range s.autoRechargeRules {
		if r.Namespace == ns && r.SubjectKey == subjectKey && (featureKey == "" || r.FeatureKey == featureKey || r.FeatureKey == "") {
			matchedKey = k
			rule = r
			found = true
			break
		}
	}
	if !found {
		s.mu.Unlock()
		return nil, nil, errors.New("no auto-recharge rule configured for subject")
	}
	if !force {
		if !rule.Enabled {
			s.mu.Unlock()
			return nil, nil, errors.New("auto-recharge rule is disabled")
		}
		if currentBalance > rule.ThresholdUnits {
			s.mu.Unlock()
			return nil, nil, errors.New("balance is above threshold")
		}
		if rule.LastTriggeredAt != nil && time.Since(*rule.LastTriggeredAt) < time.Duration(rule.CooldownMinutes)*time.Minute {
			s.mu.Unlock()
			return nil, nil, errors.New("auto-recharge is within cooldown window")
		}
	}

	pm, hasCard := s.GetDefaultPaymentMethodLocked(ns, subjectKey)
	if !hasCard {
		s.mu.Unlock()
		return nil, nil, errors.New("no active saved payment method on file for subject")
	}

	now := time.Now().UTC()
	ent := s.findOrCreateEntitlementLocked(ns, subjectKey, rule.FeatureKey)
	grant := models.EntitlementGrant{
		ID:              s.NextID("grt"),
		Namespace:       ns,
		EntitlementID:   ent.ID,
		SubjectKey:      subjectKey,
		FeatureKey:      ent.FeatureKey,
		Name:            fmt.Sprintf("Auto-Recharge (%s •••• %s · $%.2f)", strings.Title(pm.Brand), pm.Last4, float64(rule.ChargeAmountCents)/100.0),
		Amount:          rule.RechargeUnits,
		Remaining:       rule.RechargeUnits,
		Priority:        1,
		RolloverEnabled: true,
		EffectiveAt:     now,
		CreatedAt:       now,
	}
	s.grants[ent.ID] = append(s.grants[ent.ID], grant)

	piID := fmt.Sprintf("pi_auto_%s_%d", subjectKey, now.UnixNano()%1000000)
	cs := models.CheckoutSession{
		ID:                s.NextID("cs_mbx"),
		Namespace:         ns,
		SubjectKey:        subjectKey,
		Provider:          pm.Provider,
		ProviderSessionID: fmt.Sprintf("cs_auto_%s_%d", subjectKey, now.UnixNano()%1000000),
		Mode:              "auto_recharge",
		FeatureKey:        ent.FeatureKey,
		GrantUnits:        rule.RechargeUnits,
		AmountCents:       rule.ChargeAmountCents,
		Currency:          rule.Currency,
		CheckoutURL:       fmt.Sprintf("https://dashboard.stripe.com/payments/%s", piID),
		Status:            "succeeded",
		PaymentIntentID:   piID,
		GrantID:           grant.ID,
		CreatedAt:         now,
		CompletedAt:       &now,
	}
	s.checkoutSessions[cs.ID] = cs

	rule.LastTriggeredAt = &now
	rule.TotalTriggers++
	rule.UpdatedAt = now
	s.autoRechargeRules[matchedKey] = rule

	s.paymentWebhooks = append(s.paymentWebhooks, models.PaymentWebhookEvent{
		ID:                s.NextID("wh"),
		Namespace:         ns,
		Provider:          pm.Provider,
		EventID:           fmt.Sprintf("evt_auto_%d", now.UnixNano()%1000000),
		EventType:         "payment_intent.succeeded",
		SubjectKey:        subjectKey,
		ObjectID:          piID,
		AmountCents:       rule.ChargeAmountCents,
		Currency:          rule.Currency,
		Status:            "processed",
		ActionTaken:       fmt.Sprintf("Off-session charge on %s •••• %s ($%.2f) -> minted grant %s (+%.0f units)", strings.Title(pm.Brand), pm.Last4, float64(rule.ChargeAmountCents)/100.0, grant.ID, grant.Amount),
		SignatureVerified: true,
		ReceivedAt:        now,
	})

	s.saveStateLocked()
	s.mu.Unlock()

	s.InvalidateSubjectEntitlementCache(ns, subjectKey)
	return &grant, &cs, nil
}

// ProcessPaymentWebhook processes inbound Stripe/Paystack webhook events (`payment_intent.succeeded`,
// `invoice.paid`, `invoice.payment_failed`, `setup_intent.succeeded`) idempotently.
func (s *MultiTenantStore) ProcessPaymentWebhook(
	ns, provider, eventID, eventType, subjectKey, objectID, featureKey string,
	amountCents int,
	grantUnits float64,
	signatureVerified bool,
) (models.PaymentWebhookEvent, error) {
	if provider == "" {
		provider = "stripe"
	}
	now := time.Now().UTC()
	if eventID == "" {
		eventID = fmt.Sprintf("evt_%s_%d", provider, now.UnixNano()%1000000)
	}

	s.mu.Lock()
	// Idempotency check on webhook EventID
	for _, existing := range s.paymentWebhooks {
		if existing.Namespace == ns && existing.EventID == eventID {
			s.mu.Unlock()
			return existing, nil
		}
	}

	if subjectKey == "" {
		for _, sub := range s.subjects {
			if sub.Namespace == ns {
				subjectKey = sub.Key
				break
			}
		}
	}

	var actionTaken string
	status := "processed"

	switch eventType {
	case "payment_intent.succeeded", "checkout.session.completed":
		if amountCents <= 0 {
			amountCents = 5000
		}
		if grantUnits <= 0 {
			grantUnits = 2500000
		}
		if objectID == "" {
			objectID = fmt.Sprintf("pi_3Qx_%s_%d", subjectKey, now.Unix()%100000)
		}
		ent := s.findOrCreateEntitlementLocked(ns, subjectKey, featureKey)
		grant := models.EntitlementGrant{
			ID:              s.NextID("grt"),
			Namespace:       ns,
			EntitlementID:   ent.ID,
			SubjectKey:      subjectKey,
			FeatureKey:      ent.FeatureKey,
			Name:            fmt.Sprintf("Webhook Credit Top-Up ($%.2f)", float64(amountCents)/100.0),
			Amount:          grantUnits,
			Remaining:       grantUnits,
			Priority:        1,
			RolloverEnabled: true,
			EffectiveAt:     now,
			CreatedAt:       now,
		}
		s.grants[ent.ID] = append(s.grants[ent.ID], grant)

		cs := models.CheckoutSession{
			ID:                s.NextID("cs_mbx"),
			Namespace:         ns,
			SubjectKey:        subjectKey,
			Provider:          provider,
			ProviderSessionID: fmt.Sprintf("cs_wh_%d", now.UnixNano()%1000000),
			Mode:              "topup",
			FeatureKey:        ent.FeatureKey,
			GrantUnits:        grantUnits,
			AmountCents:       amountCents,
			Currency:          "USD",
			CheckoutURL:       fmt.Sprintf("https://dashboard.stripe.com/payments/%s", objectID),
			Status:            "succeeded",
			PaymentIntentID:   objectID,
			GrantID:           grant.ID,
			CreatedAt:         now,
			CompletedAt:       &now,
		}
		s.checkoutSessions[cs.ID] = cs
		actionTaken = fmt.Sprintf("Minted Priority-1 Credit Grant %s (+%.0f units) for %s & invalidated edge cache", grant.ID, grant.Amount, subjectKey)

	case "invoice.paid":
		var targetInv *models.Invoice
		for id, inv := range s.invoices {
			if inv.Namespace == ns && (inv.ID == objectID || inv.StripeInvoiceID == objectID || (objectID == "" && inv.SubjectKey == subjectKey && inv.Status != "paid")) {
				cp := inv
				targetInv = &cp
				objectID = id
				break
			}
		}
		if targetInv == nil {
			// Fall back to most recent invoice in namespace
			for id, inv := range s.invoices {
				if inv.Namespace == ns {
					cp := inv
					targetInv = &cp
					objectID = id
					break
				}
			}
		}
		if targetInv != nil {
			targetInv.Status = "paid"
			targetInv.PaidAt = &now
			if targetInv.PaymentIntentID == "" {
				targetInv.PaymentIntentID = fmt.Sprintf("pi_inv_%s_%d", targetInv.ID, now.Unix()%10000)
			}
			s.invoices[targetInv.ID] = *targetInv
			subjectKey = targetInv.SubjectKey
			amountCents = targetInv.TotalCents
			objectID = targetInv.StripeInvoiceID
			if objectID == "" {
				objectID = targetInv.ID
			}
			actionTaken = fmt.Sprintf("Marked invoice %s (%s) as PAID ($%.2f)", targetInv.ID, objectID, float64(targetInv.TotalCents)/100.0)
		} else {
			actionTaken = "Recorded invoice.paid webhook (no matching open invoice in namespace)"
		}

	case "invoice.payment_failed":
		var targetInv *models.Invoice
		for id, inv := range s.invoices {
			if inv.Namespace == ns && (inv.ID == objectID || inv.StripeInvoiceID == objectID || (objectID == "" && inv.SubjectKey == subjectKey)) {
				cp := inv
				targetInv = &cp
				objectID = id
				break
			}
		}
		if targetInv != nil {
			targetInv.Status = "payment_failed"
			s.invoices[targetInv.ID] = *targetInv
			subjectKey = targetInv.SubjectKey
			amountCents = targetInv.TotalCents
			objectID = targetInv.StripeInvoiceID
			if objectID == "" {
				objectID = targetInv.ID
			}
			actionTaken = fmt.Sprintf("Marked invoice %s as PAYMENT_FAILED & flagged subject %s for dunning", targetInv.ID, subjectKey)
		} else {
			actionTaken = fmt.Sprintf("Flagged subject %s for failed invoice payment attempt", subjectKey)
		}

	case "setup_intent.succeeded":
		if objectID == "" {
			objectID = fmt.Sprintf("pm_1Qx_%s_%d", subjectKey, now.Unix()%10000)
		}
		actionTaken = fmt.Sprintf("Verified vaulted payment method %s for %s", objectID, subjectKey)

	default:
		status = "ignored"
		actionTaken = fmt.Sprintf("Unhandled event type %q recorded for audit", eventType)
	}

	wh := models.PaymentWebhookEvent{
		ID:                s.NextID("wh"),
		Namespace:         ns,
		Provider:          provider,
		EventID:           eventID,
		EventType:         eventType,
		SubjectKey:        subjectKey,
		ObjectID:          objectID,
		AmountCents:       amountCents,
		Currency:          "USD",
		Status:            status,
		ActionTaken:       actionTaken,
		SignatureVerified: signatureVerified,
		ReceivedAt:        now,
	}
	s.paymentWebhooks = append(s.paymentWebhooks, wh)
	s.saveStateLocked()
	s.mu.Unlock()

	if subjectKey != "" {
		s.InvalidateSubjectEntitlementCache(ns, subjectKey)
	}
	return wh, nil
}

func (s *MultiTenantStore) ListPaymentWebhooks(ns string) []models.PaymentWebhookEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.PaymentWebhookEvent, 0)
	for _, wh := range s.paymentWebhooks {
		if wh.Namespace == ns {
			out = append(out, wh)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ReceivedAt.After(out[j].ReceivedAt) })
	return out
}
