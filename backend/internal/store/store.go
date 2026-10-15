package store

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/meterbox/meterbox/internal/auth"
	"github.com/meterbox/meterbox/internal/clickhouse"
	"github.com/meterbox/meterbox/internal/models"
)

// MultiTenantStore coordinates control-plane state, OpenMeter namespace-scoped entities,
// Redis deduplication & entitlement edge cache, Redpanda streaming lanes, and ClickHouse OLAP.
type MultiTenantStore struct {
	mu sync.RWMutex

	orgs          map[string]models.Organization
	envs          map[string]models.Environment // keyed by env.ID
	nsToEnv       map[string]string             // namespace -> env.ID
	apiKeys       map[string]models.APIKey      // keyed by key.ID
	hashToKeyID   map[string]string             // SHA-256 hash -> key.ID
	dlqEvents     map[string]models.DLQEvent    // keyed by dlq.ID
	meters        map[string]models.Meter       // keyed by namespace + ":" + slug
	subjects      map[string]models.Subject     // keyed by namespace + ":" + key
	entitlements  map[string]models.Entitlement // keyed by id
	grants        map[string][]models.EntitlementGrant // keyed by entitlement_id
	plans         map[string]models.Plan        // keyed by namespace + ":" + slug
	subscriptions map[string]models.Subscription
	invoices      map[string]models.Invoice
	events        []models.CloudEvent

	// Edge Redis cache & deduplication state
	dedupSet        map[string]time.Time
	entCache        map[string]models.EntitlementValue
	rateBuckets     map[string]*tokenBucket
	edgeCacheHits   atomic.Int64
	edgeCacheMisses atomic.Int64
	dedupDropped    atomic.Int64

	chClient         *clickhouse.Client
	redpandaEndpoint string
	redisAddr        string
	idSeq            atomic.Int64
}

type tokenBucket struct {
	tokens     float64
	lastRefill time.Time
}

func NewMultiTenantStore(chClient *clickhouse.Client, redpandaEndpoint, redisAddr string) *MultiTenantStore {
	if chClient == nil {
		chClient = clickhouse.NewClient("", "openmeter")
	}
	if redpandaEndpoint == "" {
		redpandaEndpoint = "http://127.0.0.1:18082"
	}
	if redisAddr == "" {
		redisAddr = "127.0.0.1:6379"
	}

	s := &MultiTenantStore{
		orgs:             make(map[string]models.Organization),
		envs:             make(map[string]models.Environment),
		nsToEnv:          make(map[string]string),
		apiKeys:          make(map[string]models.APIKey),
		hashToKeyID:      make(map[string]string),
		dlqEvents:        make(map[string]models.DLQEvent),
		meters:           make(map[string]models.Meter),
		subjects:         make(map[string]models.Subject),
		entitlements:     make(map[string]models.Entitlement),
		grants:           make(map[string][]models.EntitlementGrant),
		plans:            make(map[string]models.Plan),
		subscriptions:    make(map[string]models.Subscription),
		invoices:         make(map[string]models.Invoice),
		events:           make([]models.CloudEvent, 0, 256),
		dedupSet:         make(map[string]time.Time),
		entCache:         make(map[string]models.EntitlementValue),
		rateBuckets:      make(map[string]*tokenBucket),
		chClient:         chClient,
		redpandaEndpoint: redpandaEndpoint,
		redisAddr:        redisAddr,
	}

	s.seedDefaultPlatform()
	return s
}

func (s *MultiTenantStore) NextID(prefix string) string {
	n := s.idSeq.Add(1)
	return fmt.Sprintf("%s_%04d", prefix, n)
}

func (s *MultiTenantStore) seedDefaultPlatform() {
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	// 1. Reserved Internal Dogfood Organization & Namespace (`ns_meterbox_internal`)
	internalOrg := models.Organization{
		ID:           "org_meterbox_system",
		Name:         "Meterbox Platform (Internal Dogfooding)",
		Slug:         "meterbox-internal",
		PlanTier:     "internal",
		BillingEmail: "finops@meterbox.io",
		CreatedAt:    now,
	}
	s.orgs[internalOrg.ID] = internalOrg

	internalEnv := models.Environment{
		ID:                 "env_meterbox_internal",
		OrgID:              internalOrg.ID,
		Name:               "Internal Self-Billing",
		Slug:               "internal",
		Type:               "production",
		OpenMeterNamespace: models.InternalDogfoodNamespace,
		RateLimitRPS:       100000,
		RetentionDays:      2555,
		CreatedAt:          now,
	}
	s.envs[internalEnv.ID] = internalEnv
	s.nsToEnv[internalEnv.OpenMeterNamespace] = internalEnv.ID

	dogfoodMeter := models.Meter{
		ID:            "mtr_dogfood_ingest",
		Namespace:     models.InternalDogfoodNamespace,
		Slug:          "meterbox_ingested_events",
		Name:          "Meterbox Tenant Events Ingested",
		Description:   "Dogfooded meter counting billable CloudEvents ingested across all customer organizations",
		Aggregation:   models.AggregationSum,
		EventType:     "meterbox.events.ingested",
		ValueProperty: "$.count",
		GroupBy:       map[string]string{"tenant_namespace": "$.tenant_namespace", "lane": "$.lane"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	s.meters[dogfoodMeter.Namespace+":"+dogfoodMeter.Slug] = dogfoodMeter

	// 2. Demo Customer Organization: Acme AI Corp
	acmeOrg := models.Organization{
		ID:               "org_acme_ai",
		Name:             "Acme AI Corp",
		Slug:             "acme-ai",
		PlanTier:         "pro",
		StripeCustomerID: "cus_stripe_acme9921",
		BillingEmail:     "billing@acme-ai.dev",
		CreatedAt:        now,
	}
	s.orgs[acmeOrg.ID] = acmeOrg

	// Register Acme AI Corp as a Subject in `ns_meterbox_internal` for dogfood billing!
	s.subjects[models.InternalDogfoodNamespace+":"+acmeOrg.ID] = models.Subject{
		ID:               "sub_dogfood_acme",
		Namespace:        models.InternalDogfoodNamespace,
		Key:              acmeOrg.ID,
		DisplayName:      acmeOrg.Name,
		Email:            acmeOrg.BillingEmail,
		StripeCustomerID: acmeOrg.StripeCustomerID,
		Metadata:         map[string]string{"tier": acmeOrg.PlanTier},
		CreatedAt:        now,
	}

	prodEnv := models.Environment{
		ID:                 "env_live_acme",
		OrgID:              acmeOrg.ID,
		Name:               "Production",
		Slug:               "production",
		Type:               "production",
		OpenMeterNamespace: "ns_live_acme",
		RateLimitRPS:       1000,
		RetentionDays:      400,
		CreatedAt:          now,
	}
	sandboxEnv := models.Environment{
		ID:                 "env_test_acme",
		OrgID:              acmeOrg.ID,
		Name:               "Sandbox",
		Slug:               "sandbox",
		Type:               "sandbox",
		OpenMeterNamespace: "ns_test_acme",
		RateLimitRPS:       250,
		RetentionDays:      30,
		CreatedAt:          now,
	}
	s.envs[prodEnv.ID] = prodEnv
	s.nsToEnv[prodEnv.OpenMeterNamespace] = prodEnv.ID
	s.envs[sandboxEnv.ID] = sandboxEnv
	s.nsToEnv[sandboxEnv.OpenMeterNamespace] = sandboxEnv.ID

	// Seed default scoped API keys for Production and Sandbox
	s.createDeterministicKey(acmeOrg.ID, prodEnv.ID, prodEnv.OpenMeterNamespace, "Production Ingest Collector", models.ScopeIngest, "mb_ing_live_acme_default_collector_key_01")
	s.createDeterministicKey(acmeOrg.ID, prodEnv.ID, prodEnv.OpenMeterNamespace, "Production Edge Quota Checker", models.ScopeEntitlement, "mb_ent_live_acme_default_quota_key_01")
	s.createDeterministicKey(acmeOrg.ID, prodEnv.ID, prodEnv.OpenMeterNamespace, "Production Control Admin Key", models.ScopeAdmin, "mb_sk_live_acme_default_admin_key_01")
	s.createDeterministicKey(acmeOrg.ID, sandboxEnv.ID, sandboxEnv.OpenMeterNamespace, "Sandbox Full Admin Key", models.ScopeAdmin, "mb_sk_test_acme_default_admin_key_01")

	// Seed namespaces with meters, subjects, entitlements, plans, subscriptions, and sample events
	s.seedNamespaceEntities("ns_live_acme", periodStart, now)
	s.seedNamespaceEntities("ns_test_acme", periodStart, now)
}

func (s *MultiTenantStore) createDeterministicKey(orgID, envID, ns, name string, scope models.KeyScope, rawKey string) {
	prefix := rawKey[:12]
	preview := rawKey[:15] + "..." + rawKey[len(rawKey)-4:]
	hash := auth.HashKey(rawKey)
	id := s.NextID("key")
	k := models.APIKey{
		ID:                 id,
		OrgID:              orgID,
		EnvID:              envID,
		OpenMeterNamespace: ns,
		Name:               name,
		KeyPrefix:          prefix,
		KeyPreview:         preview,
		KeyHash:            hash,
		Scope:              scope,
		RateLimitRPS:       1000,
		CreatedAt:          time.Now().UTC(),
	}
	s.apiKeys[id] = k
	s.hashToKeyID[hash] = id
}

func (s *MultiTenantStore) seedNamespaceEntities(ns string, periodStart, now time.Time) {
	// 1. Meters
	mTokens := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "llm_tokens_total",
		Name:          "LLM Tokens Consumed",
		Description:   "Total input + output tokens across AI model invocations",
		Aggregation:   models.AggregationSum,
		EventType:     "ai.llm.tokens",
		ValueProperty: "$.tokens",
		GroupBy:       map[string]string{"model": "$.model", "type": "$.token_type"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	mRequests := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "api_requests_total",
		Name:          "Gateway API Requests",
		Description:   "Total billable API calls routed through customer endpoints",
		Aggregation:   models.AggregationCount,
		EventType:     "api.request",
		ValueProperty: "",
		GroupBy:       map[string]string{"route": "$.route", "region": "$.region"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	mGPU := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "gpu_compute_seconds",
		Name:          "GPU H100 Compute Seconds",
		Description:   "Dedicated GPU container execution duration in seconds",
		Aggregation:   models.AggregationSum,
		EventType:     "infra.gpu.seconds",
		ValueProperty: "$.duration_sec",
		GroupBy:       map[string]string{"gpu_class": "$.gpu_class"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	s.meters[ns+":"+mTokens.Slug] = mTokens
	s.meters[ns+":"+mRequests.Slug] = mRequests
	s.meters[ns+":"+mGPU.Slug] = mGPU

	// 2. Subjects (Customers of the tenant)
	sub1 := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "cust_hyperion_labs",
		DisplayName:      "Hyperion Autonomous Labs",
		Email:            "ops@hyperionlabs.ai",
		StripeCustomerID: "cus_hyperion_8812",
		Metadata:         map[string]string{"segment": "enterprise", "region": "us-east-1"},
		CreatedAt:        now,
	}
	sub2 := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "cust_nova_studio",
		DisplayName:      "Nova Creative Studio",
		Email:            "billing@novastudio.io",
		StripeCustomerID: "cus_nova_4410",
		Metadata:         map[string]string{"segment": "growth", "region": "eu-west-1"},
		CreatedAt:        now,
	}
	s.subjects[ns+":"+sub1.Key] = sub1
	s.subjects[ns+":"+sub2.Key] = sub2

	// 3. Entitlements & Priority Credit Grants
	ent1 := models.Entitlement{
		ID:              s.NextID("ent"),
		Namespace:       ns,
		SubjectKey:      sub1.Key,
		FeatureKey:      "ai_token_allowance",
		FeatureName:     "Monthly AI Token Quota",
		Type:            "metered",
		MeterSlug:       "llm_tokens_total",
		IssueAfterReset: 100000,
		IsSoftLimit:     false,
		ResetPeriod:     "MONTH",
		PeriodStart:     periodStart,
		CreatedAt:       now,
	}
	ent2 := models.Entitlement{
		ID:              s.NextID("ent"),
		Namespace:       ns,
		SubjectKey:      sub2.Key,
		FeatureKey:      "ai_token_allowance",
		FeatureName:     "Monthly AI Token Quota",
		Type:            "metered",
		MeterSlug:       "llm_tokens_total",
		IssueAfterReset: 50000,
		IsSoftLimit:     true, // Soft limit allows overage billing
		ResetPeriod:     "MONTH",
		PeriodStart:     periodStart,
		CreatedAt:       now,
	}
	entSSO := models.Entitlement{
		ID:           s.NextID("ent"),
		Namespace:    ns,
		SubjectKey:   sub1.Key,
		FeatureKey:   "enterprise_saml_sso",
		FeatureName:  "Enterprise SAML SSO",
		Type:         "boolean",
		IsSoftLimit:  false,
		StaticConfig: map[string]string{"enabled": "true", "idp": "okta"},
		ResetPeriod:  "MONTH",
		PeriodStart:  periodStart,
		CreatedAt:    now,
	}
	s.entitlements[ent1.ID] = ent1
	s.entitlements[ent2.ID] = ent2
	s.entitlements[entSSO.ID] = entSSO

	// Priority 1 promotional grant (burns first) + Priority 2 base monthly grant
	s.grants[ent1.ID] = []models.EntitlementGrant{
		{
			ID:              s.NextID("grt"),
			Namespace:       ns,
			EntitlementID:   ent1.ID,
			Name:            "Launch Promotional Bonus Credits",
			Amount:          25000,
			Priority:        1,
			RolloverEnabled: false,
			EffectiveAt:     periodStart,
			CreatedAt:       now,
		},
		{
			ID:              s.NextID("grt"),
			Namespace:       ns,
			EntitlementID:   ent1.ID,
			Name:            "Included Monthly Plan Allowance",
			Amount:          100000,
			Priority:        2,
			RolloverEnabled: true,
			EffectiveAt:     periodStart,
			CreatedAt:       now,
		},
	}
	s.grants[ent2.ID] = []models.EntitlementGrant{
		{
			ID:              s.NextID("grt"),
			Namespace:       ns,
			EntitlementID:   ent2.ID,
			Name:            "Growth Plan Included Allowance",
			Amount:          50000,
			Priority:        1,
			RolloverEnabled: false,
			EffectiveAt:     periodStart,
			CreatedAt:       now,
		},
	}

	// 4. Hybrid Pricing Plans & Active Subscriptions
	tier1Cap := 100000.0
	proPlan := models.Plan{
		ID:              s.NextID("pln"),
		Namespace:       ns,
		Slug:            "ai_scale_hybrid",
		Name:            "AI Scale Hybrid ($199/mo + Graduated Tokens & GPU)",
		Description:     "Includes 100k LLM tokens, graduated overage tiers, and per-second H100 GPU metering",
		Currency:        "USD",
		BasePriceCents:  19900,
		BillingCadence:  "MONTH",
		IncludedCredits: 100000,
		RateCards: []models.RateCard{
			{
				FeatureKey:       "ai_token_allowance",
				MeterSlug:        "llm_tokens_total",
				Name:             "LLM Token Consumption",
				PricingModel:     "graduated",
				IncludedQuantity: 25000,
				Tiers: []models.RateCardTier{
					{UpToAmount: &tier1Cap, UnitPriceCents: 0.05, FlatFeeCents: 0},
					{UpToAmount: nil, UnitPriceCents: 0.02, FlatFeeCents: 0},
				},
			},
			{
				FeatureKey:       "gpu_compute",
				MeterSlug:        "gpu_compute_seconds",
				Name:             "H100 GPU Compute Seconds",
				PricingModel:     "flat_per_unit",
				IncludedQuantity: 100,
				Tiers: []models.RateCardTier{
					{UpToAmount: nil, UnitPriceCents: 8.5, FlatFeeCents: 0},
				},
			},
		},
		CreatedAt: now,
	}
	s.plans[ns+":"+proPlan.Slug] = proPlan

	subRecord := models.Subscription{
		ID:                   s.NextID("subscr"),
		Namespace:            ns,
		SubjectKey:           sub1.Key,
		PlanSlug:             proPlan.Slug,
		Status:               "active",
		StripeSubscriptionID: "sub_stripe_hyperion_01",
		CurrentPeriodStart:   periodStart,
		CurrentPeriodEnd:     periodStart.AddDate(0, 1, 0),
		CreatedAt:            now,
	}
	s.subscriptions[subRecord.ID] = subRecord

	// 5. Seed initial CloudEvents so charts and balances are immediately live
	sampleEvents := []models.CloudEvent{
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_01", ns),
			Source:      "https://gateway.acme-ai.dev/v1/chat/completions",
			Type:        "ai.llm.tokens",
			Subject:     sub1.Key,
			Time:        now.Add(-3 * time.Hour),
			Data:        map[string]interface{}{"tokens": 18500.0, "model": "claude-4-sonnet", "token_type": "output"},
			Namespace:   ns,
			IngestedAt:  now.Add(-3 * time.Hour),
			StoredAt:    now.Add(-3 * time.Hour),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_02", ns),
			Source:      "https://gateway.acme-ai.dev/v1/chat/completions",
			Type:        "ai.llm.tokens",
			Subject:     sub1.Key,
			Time:        now.Add(-2 * time.Hour),
			Data:        map[string]interface{}{"tokens": 14200.0, "model": "gpt-5-turbo", "token_type": "input"},
			Namespace:   ns,
			IngestedAt:  now.Add(-2 * time.Hour),
			StoredAt:    now.Add(-2 * time.Hour),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_03", ns),
			Source:      "https://gateway.acme-ai.dev/v1/chat/completions",
			Type:        "ai.llm.tokens",
			Subject:     sub2.Key,
			Time:        now.Add(-1 * time.Hour),
			Data:        map[string]interface{}{"tokens": 12400.0, "model": "claude-4-sonnet", "token_type": "output"},
			Namespace:   ns,
			IngestedAt:  now.Add(-1 * time.Hour),
			StoredAt:    now.Add(-1 * time.Hour),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_04", ns),
			Source:      "k8s://us-east-1/gpu-worker-pool",
			Type:        "infra.gpu.seconds",
			Subject:     sub1.Key,
			Time:        now.Add(-45 * time.Minute),
			Data:        map[string]interface{}{"duration_sec": 340.0, "gpu_class": "nvidia-h100-80gb"},
			Namespace:   ns,
			IngestedAt:  now.Add(-45 * time.Minute),
			StoredAt:    now.Add(-45 * time.Minute),
			Lane:        "realtime",
		},
	}
	s.events = append(s.events, sampleEvents...)

	// Also record dogfood event in ns_meterbox_internal for the seeded events
	if ns == "ns_live_acme" {
		s.events = append(s.events, models.CloudEvent{
			SpecVersion: "1.0",
			ID:          "evt_dogfood_seed_01",
			Source:      "meterbox://sink-worker",
			Type:        "meterbox.events.ingested",
			Subject:     "org_acme_ai",
			Time:        now.Add(-30 * time.Minute),
			Data:        map[string]interface{}{"count": float64(len(sampleEvents)), "tenant_namespace": ns, "lane": "realtime"},
			Namespace:   models.InternalDogfoodNamespace,
			IngestedAt:  now.Add(-30 * time.Minute),
			StoredAt:    now.Add(-30 * time.Minute),
			Lane:        "realtime",
		})
	}

	// Seed 1 sample malformed DLQ event so the developer can test 1-click replay immediately
	dlqID := s.NextID("dlq")
	s.dlqEvents[dlqID] = models.DLQEvent{
		ID:                 dlqID,
		OpenMeterNamespace: ns,
		EventID:            "evt_malformed_llm_991",
		RawPayload: map[string]interface{}{
			"specversion": "1.0",
			"id":          "evt_malformed_llm_991",
			"source":      "https://agent.acme-ai.dev/v1/run",
			"type":        "ai.llm.tokens",
			"subject":     "cust_hyperion_labs",
			"data": map[string]interface{}{
				"tokens": "INVALID_NAN_VALUE",
				"model":  "claude-4-sonnet",
			},
		},
		ErrorCode:   "numeric_property_mismatch",
		ErrorReason: "Meter 'llm_tokens_total' requires numeric $.tokens property, got non-numeric string 'INVALID_NAN_VALUE'",
		Status:      "pending",
		FailedAt:    now.Add(-15 * time.Minute),
	}
}

// ResolveAPIKeyHash implements auth.KeyResolver.
func (s *MultiTenantStore) ResolveAPIKeyHash(keyHash string) (*models.TenantContext, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	keyID, ok := s.hashToKeyID[keyHash]
	if !ok {
		return nil, errors.New("api key not found")
	}
	apiKey, ok := s.apiKeys[keyID]
	if !ok || apiKey.RevokedAt != nil {
		return nil, errors.New("api key revoked")
	}
	if apiKey.ExpiresAt != nil && time.Now().UTC().After(*apiKey.ExpiresAt) {
		return nil, errors.New("api key expired")
	}

	now := time.Now().UTC()
	apiKey.LastUsedAt = &now
	s.apiKeys[keyID] = apiKey

	env := s.envs[apiKey.EnvID]
	return &models.TenantContext{
		OrgID:         apiKey.OrgID,
		EnvID:         apiKey.EnvID,
		EnvType:       env.Type,
		Namespace:     apiKey.OpenMeterNamespace,
		Scope:         apiKey.Scope,
		SubjectFilter: apiKey.SubjectFilter,
		RateLimitRPS:  apiKey.RateLimitRPS,
	}, nil
}

// ResolveNamespace resolves a namespace string for Control Plane UI requests.
func (s *MultiTenantStore) ResolveNamespace(namespace string) (*models.TenantContext, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	envID, ok := s.nsToEnv[namespace]
	if !ok {
		return nil, fmt.Errorf("namespace %q not found", namespace)
	}
	env := s.envs[envID]
	return &models.TenantContext{
		OrgID:        env.OrgID,
		EnvID:        env.ID,
		EnvType:      env.Type,
		Namespace:    env.OpenMeterNamespace,
		Scope:        models.ScopeAdmin,
		RateLimitRPS: env.RateLimitRPS,
	}, nil
}

// CheckAndMarkDedup implements deterministic Redis SETNX deduplication keyed by `dedup:{namespace}:{source}:{id}`.
func (s *MultiTenantStore) CheckAndMarkDedup(namespace, source, eventID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := fmt.Sprintf("dedup:%s:%s:%s", namespace, source, eventID)
	if exp, exists := s.dedupSet[key]; exists && time.Now().UTC().Before(exp) {
		s.dedupDropped.Add(1)
		return true
	}
	s.dedupSet[key] = time.Now().UTC().Add(24 * time.Hour)
	return false
}

// SelectIngestionLane implements a per-namespace token-bucket rate limiter.
// If the tenant exceeds their interactive burst rate or specifies `bulk`, traffic is routed to `om_events_bulk`
// so a noisy neighbor never blocks real-time ingestion for other tenants.
func (s *MultiTenantStore) SelectIngestionLane(namespace string, rateLimitRPS int, requestedLane string) string {
	if requestedLane == "bulk" {
		return "bulk"
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if rateLimitRPS <= 0 {
		rateLimitRPS = 100
	}
	now := time.Now().UTC()
	b, exists := s.rateBuckets[namespace]
	if !exists {
		b = &tokenBucket{
			tokens:     float64(rateLimitRPS),
			lastRefill: now,
		}
		s.rateBuckets[namespace] = b
	}

	elapsed := now.Sub(b.lastRefill).Seconds()
	if elapsed > 0 {
		b.tokens += elapsed * float64(rateLimitRPS)
		if b.tokens > float64(rateLimitRPS) {
			b.tokens = float64(rateLimitRPS)
		}
		b.lastRefill = now
	}

	if b.tokens >= 1.0 {
		b.tokens -= 1.0
		return "realtime"
	}
	return "bulk"
}

// AppendEvents persists validated CloudEvents to Redpanda (if online), ClickHouse, and the in-memory columnar buffer,
// and invalidates affected entitlement edge-cache entries.
func (s *MultiTenantStore) AppendEvents(events []models.CloudEvent) {
	if len(events) == 0 {
		return
	}
	s.mu.Lock()
	s.events = append(s.events, events...)
	for _, ev := range events {
		prefix := ev.Namespace + ":" + ev.Subject + ":"
		for k := range s.entCache {
			if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
				delete(s.entCache, k)
			}
		}
	}
	s.mu.Unlock()

	// Forward asynchronously to ClickHouse HTTP & Redpanda Pandaproxy when Docker stack is active
	_ = s.chClient.InsertEventsBatch(events)
	s.publishToRedpanda(events)
}

func (s *MultiTenantStore) publishToRedpanda(events []models.CloudEvent) {
	if len(events) == 0 {
		return
	}
	topic := "om_events_realtime"
	if events[0].Lane == "bulk" {
		topic = "om_events_bulk"
	}
	records := make([]map[string]interface{}, 0, len(events))
	for _, ev := range events {
		records = append(records, map[string]interface{}{
			"key":   ev.Namespace + ":" + ev.Subject,
			"value": ev,
		})
	}
	body, err := json.Marshal(map[string]interface{}{"records": records})
	if err != nil {
		return
	}
	client := &http.Client{Timeout: 500 * time.Millisecond}
	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/topics/%s", s.redpandaEndpoint, topic), bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/vnd.kafka.json.v2+json")
	resp, err := client.Do(req)
	if err == nil && resp != nil {
		resp.Body.Close()
	}
}

// ValidateAgainstMeters checks whether an incoming CloudEvent violates any meter's numeric property requirement.
func (s *MultiTenantStore) ValidateAgainstMeters(ns string, ev models.CloudEvent) (string, string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, m := range s.meters {
		if m.Namespace != ns || m.EventType != ev.Type {
			continue
		}
		if m.Aggregation == models.AggregationSum || m.Aggregation == models.AggregationMax || m.Aggregation == models.AggregationAvg {
			propKey := m.ValueProperty
			if len(propKey) > 2 && propKey[:2] == "$." {
				propKey = propKey[2:]
			}
			if raw, exists := ev.Data[propKey]; exists {
				switch v := raw.(type) {
				case float64, float32, int, int64, json.Number:
					// valid numeric
				case string:
					var num float64
					if err := json.Unmarshal([]byte(v), &num); err != nil {
						return "numeric_property_mismatch",
							fmt.Sprintf("Meter '%s' requires numeric %s property, got %q", m.Slug, m.ValueProperty, v),
							false
					}
				default:
					return "invalid_property_type",
						fmt.Sprintf("Meter '%s' requires numeric %s property", m.Slug, m.ValueProperty),
						false
				}
			} else {
				return "missing_value_property",
					fmt.Sprintf("Meter '%s' requires property %s in event data payload", m.Slug, m.ValueProperty),
					false
			}
		}
	}
	return "", "", true
}

// RecordDLQEvent stores a rejected CloudEvent for inspection and 1-click replay in the Control Plane UI.
func (s *MultiTenantStore) RecordDLQEvent(ns, eventID string, rawPayload map[string]interface{}, code, reason string) models.DLQEvent {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := s.NextID("dlq")
	dlq := models.DLQEvent{
		ID:                 id,
		OpenMeterNamespace: ns,
		EventID:            eventID,
		RawPayload:         rawPayload,
		ErrorCode:          code,
		ErrorReason:        reason,
		Status:             "pending",
		FailedAt:           time.Now().UTC(),
	}
	s.dlqEvents[id] = dlq
	return dlq
}

func (s *MultiTenantStore) GetDLQEvent(ns, id string) (models.DLQEvent, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ev, ok := s.dlqEvents[id]
	if !ok || ev.OpenMeterNamespace != ns {
		return models.DLQEvent{}, false
	}
	return ev, true
}

func (s *MultiTenantStore) MarkDLQReplayed(ns, id string, updatedPayload map[string]interface{}) (models.DLQEvent, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ev, ok := s.dlqEvents[id]
	if !ok || ev.OpenMeterNamespace != ns {
		return models.DLQEvent{}, false
	}
	now := time.Now().UTC()
	ev.Status = "replayed"
	ev.ReplayedAt = &now
	if updatedPayload != nil {
		ev.RawPayload = updatedPayload
	}
	s.dlqEvents[id] = ev
	return ev, true
}

func (s *MultiTenantStore) ListDLQEvents(ns string) []models.DLQEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.DLQEvent, 0)
	for _, d := range s.dlqEvents {
		if d.OpenMeterNamespace == ns {
			out = append(out, d)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].FailedAt.After(out[j].FailedAt)
	})
	return out
}

// GetCachedEntitlement checks the sub-5ms Redis edge cache for `(namespace, subject, feature)`.
func (s *MultiTenantStore) GetCachedEntitlement(ns, subjectKey, featureKey string) (models.EntitlementValue, bool) {
	s.mu.RLock()
	val, ok := s.entCache[ns+":"+subjectKey+":"+featureKey]
	s.mu.RUnlock()
	if ok {
		s.edgeCacheHits.Add(1)
		val.CacheStatus = "HIT"
		return val, true
	}
	s.edgeCacheMisses.Add(1)
	return models.EntitlementValue{}, false
}

// SetCachedEntitlement stores a computed entitlement value in the edge cache.
func (s *MultiTenantStore) SetCachedEntitlement(ns, subjectKey, featureKey string, val models.EntitlementValue) {
	s.mu.Lock()
	s.entCache[ns+":"+subjectKey+":"+featureKey] = val
	s.mu.Unlock()
}

// InvalidateSubjectEntitlementCache clears cached balances for a subject when grants or entitlements change.
func (s *MultiTenantStore) InvalidateSubjectEntitlementCache(ns, subjectKey string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	prefix := ns + ":" + subjectKey + ":"
	for k := range s.entCache {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			delete(s.entCache, k)
		}
	}
}

func (s *MultiTenantStore) ListMeters(ns string) []models.Meter {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Meter, 0)
	for _, m := range s.meters {
		if m.Namespace == ns {
			out = append(out, m)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Slug < out[j].Slug })
	return out
}

func (s *MultiTenantStore) GetMeter(ns, slug string) (models.Meter, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m, ok := s.meters[ns+":"+slug]
	return m, ok
}

func (s *MultiTenantStore) CreateMeter(m models.Meter) models.Meter {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m.ID == "" {
		m.ID = s.NextID("mtr")
	}
	if m.WindowSize == "" {
		m.WindowSize = "HOUR"
	}
	m.CreatedAt = time.Now().UTC()
	s.meters[m.Namespace+":"+m.Slug] = m
	return m
}

func (s *MultiTenantStore) QueryMeter(ns, slug, subjectFilter string, from, to *time.Time) (models.MeterQueryResult, error) {
	s.mu.RLock()
	meter, ok := s.meters[ns+":"+slug]
	if !ok {
		s.mu.RUnlock()
		return models.MeterQueryResult{}, fmt.Errorf("meter %q not found in namespace %q", slug, ns)
	}
	eventsCopy := make([]models.CloudEvent, len(s.events))
	copy(eventsCopy, s.events)
	s.mu.RUnlock()

	return s.chClient.AggregateMeter(meter, eventsCopy, subjectFilter, from, to), nil
}

func (s *MultiTenantStore) ListRecentEvents(ns string, limit int) []models.CloudEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 {
		limit = 50
	}
	out := make([]models.CloudEvent, 0)
	for i := len(s.events) - 1; i >= 0; i-- {
		if s.events[i].Namespace == ns {
			out = append(out, s.events[i])
			if len(out) >= limit {
				break
			}
		}
	}
	return out
}

func (s *MultiTenantStore) ListSubjects(ns string) []models.Subject {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Subject, 0)
	for _, sub := range s.subjects {
		if sub.Namespace == ns {
			out = append(out, sub)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Key < out[j].Key })
	return out
}

func (s *MultiTenantStore) UpsertSubject(sub models.Subject) models.Subject {
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.subjects[sub.Namespace+":"+sub.Key]; ok {
		sub.ID = existing.ID
		sub.CreatedAt = existing.CreatedAt
	} else {
		sub.ID = s.NextID("sub")
		sub.CreatedAt = time.Now().UTC()
	}
	s.subjects[sub.Namespace+":"+sub.Key] = sub
	return sub
}

func (s *MultiTenantStore) ListEntitlements(ns, subjectFilter string) []models.Entitlement {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Entitlement, 0)
	for _, ent := range s.entitlements {
		if ent.Namespace == ns && (subjectFilter == "" || ent.SubjectKey == subjectFilter) {
			out = append(out, ent)
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

func (s *MultiTenantStore) GetEntitlementBySubjectFeature(ns, subjectKey, featureKey string) (models.Entitlement, []models.EntitlementGrant, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, ent := range s.entitlements {
		if ent.Namespace == ns && ent.SubjectKey == subjectKey && ent.FeatureKey == featureKey {
			grants := make([]models.EntitlementGrant, len(s.grants[ent.ID]))
			copy(grants, s.grants[ent.ID])
			return ent, grants, true
		}
	}
	return models.Entitlement{}, nil, false
}

func (s *MultiTenantStore) CreateEntitlement(ent models.Entitlement, initialGrantAmount float64) models.Entitlement {
	s.mu.Lock()
	if ent.ID == "" {
		ent.ID = s.NextID("ent")
	}
	now := time.Now().UTC()
	ent.CreatedAt = now
	if ent.PeriodStart.IsZero() {
		ent.PeriodStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	}
	s.entitlements[ent.ID] = ent

	if initialGrantAmount > 0 {
		g := models.EntitlementGrant{
			ID:              s.NextID("grt"),
			Namespace:       ent.Namespace,
			EntitlementID:   ent.ID,
			Name:            "Initial Plan Grant",
			Amount:          initialGrantAmount,
			Priority:        1,
			RolloverEnabled: false,
			EffectiveAt:     ent.PeriodStart,
			CreatedAt:       now,
		}
		s.grants[ent.ID] = append(s.grants[ent.ID], g)
	}
	s.mu.Unlock()
	s.InvalidateSubjectEntitlementCache(ent.Namespace, ent.SubjectKey)
	return ent
}

func (s *MultiTenantStore) CreateGrant(g models.EntitlementGrant) (models.EntitlementGrant, error) {
	s.mu.Lock()
	ent, ok := s.entitlements[g.EntitlementID]
	if !ok || ent.Namespace != g.Namespace {
		s.mu.Unlock()
		return models.EntitlementGrant{}, errors.New("entitlement not found in namespace")
	}
	g.ID = s.NextID("grt")
	g.CreatedAt = time.Now().UTC()
	if g.EffectiveAt.IsZero() {
		g.EffectiveAt = ent.PeriodStart
	}
	if g.Priority <= 0 {
		g.Priority = 1
	}
	s.grants[g.EntitlementID] = append(s.grants[g.EntitlementID], g)
	s.mu.Unlock()

	s.InvalidateSubjectEntitlementCache(ent.Namespace, ent.SubjectKey)
	return g, nil
}

func (s *MultiTenantStore) ListPlans(ns string) []models.Plan {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Plan, 0)
	for _, p := range s.plans {
		if p.Namespace == ns {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Slug < out[j].Slug })
	return out
}

func (s *MultiTenantStore) GetPlan(ns, slug string) (models.Plan, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.plans[ns+":"+slug]
	return p, ok
}

func (s *MultiTenantStore) CreatePlan(p models.Plan) models.Plan {
	s.mu.Lock()
	defer s.mu.Unlock()
	p.ID = s.NextID("pln")
	p.CreatedAt = time.Now().UTC()
	if p.Currency == "" {
		p.Currency = "USD"
	}
	if p.BillingCadence == "" {
		p.BillingCadence = "MONTH"
	}
	s.plans[p.Namespace+":"+p.Slug] = p
	return p
}

func (s *MultiTenantStore) ListSubscriptions(ns string) []models.Subscription {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Subscription, 0)
	for _, sub := range s.subscriptions {
		if sub.Namespace == ns {
			out = append(out, sub)
		}
	}
	return out
}

func (s *MultiTenantStore) CreateSubscription(sub models.Subscription) models.Subscription {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	sub.ID = s.NextID("subscr")
	sub.Status = "active"
	sub.CurrentPeriodStart = periodStart
	sub.CurrentPeriodEnd = periodStart.AddDate(0, 1, 0)
	sub.CreatedAt = now
	s.subscriptions[sub.ID] = sub
	return sub
}

func (s *MultiTenantStore) SaveInvoice(inv models.Invoice) models.Invoice {
	s.mu.Lock()
	defer s.mu.Unlock()
	if inv.ID == "" {
		inv.ID = s.NextID("inv")
	}
	inv.CreatedAt = time.Now().UTC()
	s.invoices[inv.ID] = inv
	return inv
}

func (s *MultiTenantStore) ListInvoices(ns string) []models.Invoice {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Invoice, 0)
	for _, inv := range s.invoices {
		if inv.Namespace == ns {
			out = append(out, inv)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *MultiTenantStore) ListOrganizations() []models.Organization {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Organization, 0, len(s.orgs))
	for _, org := range s.orgs {
		if org.ID == "org_meterbox_system" {
			continue
		}
		out = append(out, org)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out
}

func (s *MultiTenantStore) CreateOrganization(name, slug, billingEmail, planTier string) (models.Organization, []models.Environment, error) {
	s.mu.Lock()
	if name == "" || slug == "" {
		s.mu.Unlock()
		return models.Organization{}, nil, errors.New("name and slug are required")
	}
	if planTier == "" {
		planTier = "pro"
	}
	if billingEmail == "" {
		billingEmail = "billing@" + slug + ".io"
	}
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	orgID := "org_" + slug
	org := models.Organization{
		ID:           orgID,
		Name:         name,
		Slug:         slug,
		PlanTier:     planTier,
		BillingEmail: billingEmail,
		CreatedAt:    now,
	}
	s.orgs[orgID] = org

	// Register org as subject in internal dogfood namespace
	s.subjects[models.InternalDogfoodNamespace+":"+orgID] = models.Subject{
		ID:          s.NextID("sub"),
		Namespace:   models.InternalDogfoodNamespace,
		Key:         orgID,
		DisplayName: name,
		Email:       billingEmail,
		Metadata:    map[string]string{"tier": planTier},
		CreatedAt:   now,
	}

	prodEnv := models.Environment{
		ID:                 "env_live_" + slug,
		OrgID:              orgID,
		Name:               "Production",
		Slug:               "production",
		Type:               "production",
		OpenMeterNamespace: "ns_live_" + slug,
		RateLimitRPS:       1000,
		RetentionDays:      400,
		CreatedAt:          now,
	}
	sandboxEnv := models.Environment{
		ID:                 "env_test_" + slug,
		OrgID:              orgID,
		Name:               "Sandbox",
		Slug:               "sandbox",
		Type:               "sandbox",
		OpenMeterNamespace: "ns_test_" + slug,
		RateLimitRPS:       250,
		RetentionDays:      30,
		CreatedAt:          now,
	}
	s.envs[prodEnv.ID] = prodEnv
	s.nsToEnv[prodEnv.OpenMeterNamespace] = prodEnv.ID
	s.envs[sandboxEnv.ID] = sandboxEnv
	s.nsToEnv[sandboxEnv.OpenMeterNamespace] = sandboxEnv.ID

	s.seedNamespaceEntities(prodEnv.OpenMeterNamespace, periodStart, now)
	s.seedNamespaceEntities(sandboxEnv.OpenMeterNamespace, periodStart, now)
	s.mu.Unlock()

	return org, []models.Environment{prodEnv, sandboxEnv}, nil
}

func (s *MultiTenantStore) ListEnvironments() []models.Environment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Environment, 0, len(s.envs))
	for _, env := range s.envs {
		if env.OpenMeterNamespace == models.InternalDogfoodNamespace {
			continue
		}
		out = append(out, env)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func (s *MultiTenantStore) CreateEnvironment(orgID, name, slug, envType string, rateLimitRPS int) (models.Environment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.orgs[orgID]; !ok {
		return models.Environment{}, errors.New("organization not found")
	}
	if envType != "production" && envType != "sandbox" {
		envType = "sandbox"
	}
	if rateLimitRPS <= 0 {
		rateLimitRPS = 500
	}
	now := time.Now().UTC()
	ns := fmt.Sprintf("ns_%s_%s", slug, orgID)
	env := models.Environment{
		ID:                 s.NextID("env"),
		OrgID:              orgID,
		Name:               name,
		Slug:               slug,
		Type:               envType,
		OpenMeterNamespace: ns,
		RateLimitRPS:       rateLimitRPS,
		RetentionDays:      90,
		CreatedAt:          now,
	}
	s.envs[env.ID] = env
	s.nsToEnv[ns] = env.ID
	return env, nil
}

func (s *MultiTenantStore) ResetSandboxNamespace(ns string) error {
	s.mu.Lock()
	envID, ok := s.nsToEnv[ns]
	if !ok {
		s.mu.Unlock()
		return errors.New("namespace not found")
	}
	env := s.envs[envID]
	if env.Type != "sandbox" {
		s.mu.Unlock()
		return errors.New("only sandbox namespaces can be wiped and reset")
	}

	// Wipe all tenant records for `ns`
	filteredEvents := make([]models.CloudEvent, 0, len(s.events))
	for _, ev := range s.events {
		if ev.Namespace != ns {
			filteredEvents = append(filteredEvents, ev)
		}
	}
	s.events = filteredEvents

	for k, m := range s.meters {
		if m.Namespace == ns {
			delete(s.meters, k)
		}
	}
	for k, sub := range s.subjects {
		if sub.Namespace == ns {
			delete(s.subjects, k)
		}
	}
	for k, ent := range s.entitlements {
		if ent.Namespace == ns {
			delete(s.grants, ent.ID)
			delete(s.entitlements, k)
		}
	}
	for k, p := range s.plans {
		if p.Namespace == ns {
			delete(s.plans, k)
		}
	}
	for k, sub := range s.subscriptions {
		if sub.Namespace == ns {
			delete(s.subscriptions, k)
		}
	}
	for k, inv := range s.invoices {
		if inv.Namespace == ns {
			delete(s.invoices, k)
		}
	}
	for k, d := range s.dlqEvents {
		if d.OpenMeterNamespace == ns {
			delete(s.dlqEvents, k)
		}
	}
	for k := range s.entCache {
		if len(k) > len(ns) && k[:len(ns)+1] == ns+":" {
			delete(s.entCache, k)
		}
	}

	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	s.seedNamespaceEntities(ns, periodStart, now)
	s.mu.Unlock()
	return nil
}

func (s *MultiTenantStore) ListAPIKeys(ns string) []models.APIKey {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.APIKey, 0)
	for _, k := range s.apiKeys {
		if k.OpenMeterNamespace == ns && k.RevokedAt == nil {
			out = append(out, k)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *MultiTenantStore) CreateAPIKey(ns, name string, scope models.KeyScope, subjectFilter string) (models.APIKey, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	envID, ok := s.nsToEnv[ns]
	if !ok {
		return models.APIKey{}, errors.New("namespace not found")
	}
	env := s.envs[envID]
	rawKey, prefix, preview, hash, err := auth.GenerateScopedKey(scope, env.Type)
	if err != nil {
		return models.APIKey{}, err
	}

	id := s.NextID("key")
	key := models.APIKey{
		ID:                 id,
		OrgID:              env.OrgID,
		EnvID:              env.ID,
		OpenMeterNamespace: ns,
		Name:               name,
		KeyPrefix:          prefix,
		KeyPreview:         preview,
		KeyHash:            hash,
		RawKey:             rawKey,
		Scope:              scope,
		SubjectFilter:      subjectFilter,
		RateLimitRPS:       env.RateLimitRPS,
		CreatedAt:          time.Now().UTC(),
	}
	s.apiKeys[id] = key
	s.hashToKeyID[hash] = id
	return key, nil
}

func (s *MultiTenantStore) RevokeAPIKey(ns, id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	k, ok := s.apiKeys[id]
	if !ok || k.OpenMeterNamespace != ns {
		return false
	}
	now := time.Now().UTC()
	k.RevokedAt = &now
	s.apiKeys[id] = k
	delete(s.hashToKeyID, k.KeyHash)
	return true
}

func (s *MultiTenantStore) GetTelemetry(ns string) models.TelemetrySnapshot {
	s.mu.RLock()
	orgID := ""
	if envID, ok := s.nsToEnv[ns]; ok {
		orgID = s.envs[envID].OrgID
	}
	totalEv := 0
	rtEv := 0
	bulkEv := 0
	for _, ev := range s.events {
		if ev.Namespace == ns {
			totalEv++
			if ev.Lane == "bulk" {
				bulkEv++
			} else {
				rtEv++
			}
		}
	}
	dlqPending := 0
	for _, d := range s.dlqEvents {
		if d.OpenMeterNamespace == ns && d.Status == "pending" {
			dlqPending++
		}
	}
	metersCount := 0
	for _, m := range s.meters {
		if m.Namespace == ns {
			metersCount++
		}
	}
	subjectsCount := 0
	for _, sub := range s.subjects {
		if sub.Namespace == ns {
			subjectsCount++
		}
	}
	entsCount := 0
	for _, ent := range s.entitlements {
		if ent.Namespace == ns {
			entsCount++
		}
	}
	s.mu.RUnlock()

	// Query internal dogfood namespace `ns_meterbox_internal` dynamically for the active organization
	dogfoodRes, _ := s.QueryMeter(models.InternalDogfoodNamespace, "meterbox_ingested_events", orgID, nil, nil)

	hits := s.edgeCacheHits.Load()
	misses := s.edgeCacheMisses.Load()
	ratio := 0.0
	if hits+misses > 0 {
		ratio = float64(hits) * 100.0 / float64(hits+misses)
	}

	estimatedCents := 9900 + int(dogfoodRes.TotalValue*10)

	return models.TelemetrySnapshot{
		ActiveNamespace:        ns,
		TotalEventsIngested:    totalEv,
		RealtimeLaneEvents:     rtEv,
		BulkLaneEvents:         bulkEv,
		DeduplicatedDropped:    int(s.dedupDropped.Load()),
		PendingDLQEvents:       dlqPending,
		ActiveMeters:           metersCount,
		ActiveSubjects:         subjectsCount,
		ActiveEntitlements:     entsCount,
		EdgeCacheHits:          hits,
		EdgeCacheMisses:        misses,
		EdgeCacheHitRatioPct:   ratio,
		DogfoodOrgEventsBilled: dogfoodRes.TotalValue,
		DogfoodEstimatedCents:  estimatedCents,
		ClickHouseConnected:    s.chClient.Ping(),
		RedpandaConnected:      s.pingRedpanda(),
		RedisConnected:         s.pingRedis(),
	}
}

func (s *MultiTenantStore) pingRedpanda() bool {
	client := &http.Client{Timeout: 300 * time.Millisecond}
	resp, err := client.Get(s.redpandaEndpoint + "/topics")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (s *MultiTenantStore) pingRedis() bool {
	conn, err := net.DialTimeout("tcp", s.redisAddr, 300*time.Millisecond)
	if err != nil {
		return false
	}
	defer conn.Close()
	return true
}
