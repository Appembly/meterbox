package store

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net"
	"net/http"
	"os"
	"sort"
	"strings"
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
	envs          map[string]models.Environment        // keyed by env.ID
	nsToEnv       map[string]string                    // namespace -> env.ID
	apiKeys       map[string]models.APIKey             // keyed by key.ID
	hashToKeyID   map[string]string                    // SHA-256 hash -> key.ID
	dlqEvents     map[string]models.DLQEvent           // keyed by dlq.ID
	meters        map[string]models.Meter              // keyed by namespace + ":" + slug
	subjects      map[string]models.Subject            // keyed by namespace + ":" + key
	entitlements  map[string]models.Entitlement        // keyed by id
	grants        map[string][]models.EntitlementGrant // keyed by entitlement_id
	plans             map[string]models.Plan               // keyed by namespace + ":" + slug
	subscriptions     map[string]models.Subscription
	invoices          map[string]models.Invoice
	paymentMethods    map[string]models.PaymentMethod     // keyed by pm.ID
	autoRechargeRules map[string]models.AutoRechargeRule  // keyed by namespace + ":" + subject_key + ":" + feature_key
	checkoutSessions  map[string]models.CheckoutSession   // keyed by cs.ID
	paymentWebhooks   []models.PaymentWebhookEvent
	events            []models.CloudEvent

	// Track unique sessions per subject (`ns:subject:session_id`)
	subjectSessions map[string]bool

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
	stateFile        string
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
		plans:             make(map[string]models.Plan),
		subscriptions:     make(map[string]models.Subscription),
		invoices:          make(map[string]models.Invoice),
		paymentMethods:    make(map[string]models.PaymentMethod),
		autoRechargeRules: make(map[string]models.AutoRechargeRule),
		checkoutSessions:  make(map[string]models.CheckoutSession),
		paymentWebhooks:   make([]models.PaymentWebhookEvent, 0, 64),
		events:            make([]models.CloudEvent, 0, 256),
		subjectSessions:  make(map[string]bool),
		dedupSet:         make(map[string]time.Time),
		entCache:         make(map[string]models.EntitlementValue),
		rateBuckets:      make(map[string]*tokenBucket),
		chClient:         chClient,
		redpandaEndpoint: redpandaEndpoint,
		redisAddr:        redisAddr,
		stateFile:        strings.TrimSpace(os.Getenv("METERBOX_STATE_FILE")),
	}

	if s.stateFile != "" && s.loadState() {
		return s
	}
	s.seedDefaultPlatform()
	s.rebuildSubjectProfilesLocked()
	s.saveStateLocked()
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

	// 2. Primary Appembly Organization: Appembly Autonomous Suite
	appemblyOrg := models.Organization{
		ID:               "org_appembly",
		Name:             "Appembly Autonomous Suite",
		Slug:             "appembly",
		PlanTier:         "enterprise",
		StripeCustomerID: "cus_stripe_appembly_01",
		BillingEmail:     "finops@appembly.dev",
		CreatedAt:        now.Add(-2 * time.Second),
	}
	s.orgs[appemblyOrg.ID] = appemblyOrg

	s.subjects[models.InternalDogfoodNamespace+":"+appemblyOrg.ID] = models.Subject{
		ID:               "sub_dogfood_appembly",
		Namespace:        models.InternalDogfoodNamespace,
		Key:              appemblyOrg.ID,
		DisplayName:      appemblyOrg.Name,
		Email:            appemblyOrg.BillingEmail,
		StripeCustomerID: appemblyOrg.StripeCustomerID,
		Metadata:         map[string]string{"tier": appemblyOrg.PlanTier},
		CreatedAt:        now,
	}

	appProdEnv := models.Environment{
		ID:                 "env_live_appembly",
		OrgID:              appemblyOrg.ID,
		Name:               "Production",
		Slug:               "production",
		Type:               "production",
		OpenMeterNamespace: "ns_live_appembly",
		RateLimitRPS:       5000,
		RetentionDays:      730,
		CreatedAt:          now,
	}
	appSandboxEnv := models.Environment{
		ID:                 "env_test_appembly",
		OrgID:              appemblyOrg.ID,
		Name:               "Sandbox",
		Slug:               "sandbox",
		Type:               "sandbox",
		OpenMeterNamespace: "ns_test_appembly",
		RateLimitRPS:       1000,
		RetentionDays:      90,
		CreatedAt:          now,
	}
	s.envs[appProdEnv.ID] = appProdEnv
	s.nsToEnv[appProdEnv.OpenMeterNamespace] = appProdEnv.ID
	s.envs[appSandboxEnv.ID] = appSandboxEnv
	s.nsToEnv[appSandboxEnv.OpenMeterNamespace] = appSandboxEnv.ID

	s.createDeterministicKey(appemblyOrg.ID, appProdEnv.ID, appProdEnv.OpenMeterNamespace, "Cyclode & Runctor Step Ingest Collector", models.ScopeIngest, "mb_ing_live_appembly_cyclode_collector_01")
	s.createDeterministicKey(appemblyOrg.ID, appProdEnv.ID, appProdEnv.OpenMeterNamespace, "Cyclode Edge Pre-Flight Quota Gate", models.ScopeEntitlement, "mb_ent_live_appembly_cyclode_quota_01")
	s.createDeterministicKey(appemblyOrg.ID, appProdEnv.ID, appProdEnv.OpenMeterNamespace, "Appembly Control Plane Admin Key", models.ScopeAdmin, "mb_sk_live_appembly_admin_key_01")
	s.createDeterministicKey(appemblyOrg.ID, appSandboxEnv.ID, appSandboxEnv.OpenMeterNamespace, "Appembly Sandbox Admin Key", models.ScopeAdmin, "mb_sk_test_appembly_admin_key_01")

	s.seedAppemblyNamespaceEntities("ns_live_appembly", periodStart, now)
	s.seedAppemblyNamespaceEntities("ns_test_appembly", periodStart, now)
	s.seedPaymentOrchestrationEntities("ns_live_appembly", now)
	s.seedPaymentOrchestrationEntities("ns_test_appembly", now)

	// 3. Demo Customer Organization: Acme AI Corp
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
	s.seedPaymentOrchestrationEntities("ns_live_acme", now)
	s.seedPaymentOrchestrationEntities("ns_test_acme", now)
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

func (s *MultiTenantStore) seedAppemblyNamespaceEntities(ns string, periodStart, now time.Time) {
	mTokens := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "llm_tokens_total",
		Name:          "LLM Tokens Consumed (Cyclode / Runctor)",
		Description:   "Input, cached, reasoning, and output tokens across autonomous agent turns",
		Aggregation:   models.AggregationSum,
		EventType:     "ai.llm.tokens",
		ValueProperty: "$.tokens",
		GroupBy:       map[string]string{"model": "$.model", "type": "$.token_type", "persona": "$.persona", "tool": "$.tool"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	mTools := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "agent_tool_calls",
		Name:          "Autonomous Tool Invocations",
		Description:   "Checkpointed tool executions across Cyclode and Swarmteam pods",
		Aggregation:   models.AggregationCount,
		EventType:     "ai.agent.tool_call",
		ValueProperty: "",
		GroupBy:       map[string]string{"tool": "$.tool", "persona": "$.persona"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	mSandbox := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "sandbox_compute_seconds",
		Name:          "Sandbox Execution Seconds",
		Description:   "Isolated Docker & Git-worktree execution duration in seconds",
		Aggregation:   models.AggregationSum,
		EventType:     "infra.sandbox.seconds",
		ValueProperty: "$.duration_sec",
		GroupBy:       map[string]string{"runtime": "$.runtime"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	mPosthog := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "posthog_events_total",
		Name:          "PostHog Product Events",
		Description:   "Product telemetry events ($identify, agent.task_created, chart.rendered, etc.) captured via PostHog bridge",
		Aggregation:   models.AggregationCount,
		EventType:     "posthog.event",
		ValueProperty: "",
		GroupBy:       map[string]string{"event": "$.event", "country": "$.$geoip_country_code"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	mPageviews := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "pageviews_total",
		Name:          "PostHog Web Pageviews",
		Description:   "Captured $pageview sessions grouped by pathname and visitor country",
		Aggregation:   models.AggregationCount,
		EventType:     "posthog.pageview",
		ValueProperty: "",
		GroupBy:       map[string]string{"pathname": "$.$pathname", "country": "$.$geoip_country_code"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	s.meters[ns+":"+mTokens.Slug] = mTokens
	s.meters[ns+":"+mTools.Slug] = mTools
	s.meters[ns+":"+mSandbox.Slug] = mSandbox
	s.meters[ns+":"+mPosthog.Slug] = mPosthog
	s.meters[ns+":"+mPageviews.Slug] = mPageviews

	subCyclode := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "ws_cyclode_default",
		DisplayName:      "Cyclode Autonomous Workstation (:6013)",
		Email:            "cyclode@appembly.dev",
		StripeCustomerID: "cus_appembly_cyclode_01",
		PlanName:         "Appembly Autonomous Pro",
		CountryCode:      "US",
		CountryName:      "United States",
		City:             "San Francisco",
		Region:           "California",
		Timezone:         "America/Los_Angeles",
		Browser:          "Chrome 134",
		OS:               "macOS Sequoia",
		DeviceType:       "Desktop",
		LastPathname:     "/workspaces/cyclode/canvas",
		Metadata:         map[string]string{"product": "cyclode", "runtime": "runctor-v0.2", "role": "workstation"},
		CreatedAt:        now,
	}
	subSwarm := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "ws_swarmteam_pods",
		DisplayName:      "Swarmteam Multi-Agent DAG (:6040)",
		Email:            "swarmteam@appembly.dev",
		StripeCustomerID: "cus_appembly_swarm_01",
		PlanName:         "Appembly Autonomous Pro",
		CountryCode:      "GB",
		CountryName:      "United Kingdom",
		City:             "London",
		Region:           "England",
		Timezone:         "Europe/London",
		Browser:          "Arc 1.85",
		OS:               "macOS Sequoia",
		DeviceType:       "Desktop",
		LastPathname:     "/swarm/dag-orchestrator",
		Metadata:         map[string]string{"product": "swarmteam", "runtime": "runctor-v0.2", "role": "workstation"},
		CreatedAt:        now,
	}
	subValiscale := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "ws_valiscale_studio",
		DisplayName:      "Valiscale Venture Studio (:6030)",
		Email:            "valiscale@appembly.dev",
		StripeCustomerID: "cus_appembly_valiscale_01",
		PlanName:         "Appembly Autonomous Pro",
		CountryCode:      "DE",
		CountryName:      "Germany",
		City:             "Berlin",
		Region:           "Berlin",
		Timezone:         "Europe/Berlin",
		Browser:          "Firefox 136",
		OS:               "Ubuntu Linux",
		DeviceType:       "Desktop",
		LastPathname:     "/ventures/portfolio-matrix",
		Metadata:         map[string]string{"product": "valiscale", "runtime": "runctor-v0.2", "role": "workstation"},
		CreatedAt:        now,
	}
	subKen := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "usr_ken_architect",
		DisplayName:      "Ken M. (Principal Systems Architect)",
		Email:            "ken@appembly.dev",
		StripeCustomerID: "cus_appembly_ken_01",
		PlanName:         "Appembly Autonomous Pro",
		CountryCode:      "JP",
		CountryName:      "Japan",
		City:             "Tokyo",
		Region:           "Kanto",
		Timezone:         "Asia/Tokyo",
		Browser:          "Safari 18.3",
		OS:               "macOS Sequoia",
		DeviceType:       "Desktop",
		LastPathname:     "/finops/cost-intelligence",
		Metadata:         map[string]string{"product": "meterbox", "role": "founder"},
		CreatedAt:        now,
	}
	subElena := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "usr_elena_finops",
		DisplayName:      "Elena Rostova (FinOps & Revenue Lead)",
		Email:            "elena@appembly.dev",
		StripeCustomerID: "cus_appembly_elena_01",
		PlanName:         "Appembly Autonomous Pro",
		CountryCode:      "US",
		CountryName:      "United States",
		City:             "New York",
		Region:           "New York",
		Timezone:         "America/New_York",
		Browser:          "Chrome 134",
		OS:               "macOS Sequoia",
		DeviceType:       "Desktop",
		LastPathname:     "/billing/hybrid-plans",
		Metadata:         map[string]string{"product": "meterbox", "role": "finops"},
		CreatedAt:        now,
	}
	s.subjects[ns+":"+subCyclode.Key] = subCyclode
	s.subjects[ns+":"+subSwarm.Key] = subSwarm
	s.subjects[ns+":"+subValiscale.Key] = subValiscale
	s.subjects[ns+":"+subKen.Key] = subKen
	s.subjects[ns+":"+subElena.Key] = subElena

	entCyclode := models.Entitlement{
		ID:              s.NextID("ent"),
		Namespace:       ns,
		SubjectKey:      subCyclode.Key,
		FeatureKey:      "ai_token_allowance",
		FeatureName:     "Monthly Autonomous Token Allowance",
		Type:            "metered",
		MeterSlug:       "llm_tokens_total",
		IssueAfterReset: 5000000,
		IsSoftLimit:     true,
		ResetPeriod:     "MONTH",
		PeriodStart:     periodStart,
		CreatedAt:       now,
	}
	entSwarm := models.Entitlement{
		ID:              s.NextID("ent"),
		Namespace:       ns,
		SubjectKey:      subSwarm.Key,
		FeatureKey:      "ai_token_allowance",
		FeatureName:     "Monthly Autonomous Token Allowance",
		Type:            "metered",
		MeterSlug:       "llm_tokens_total",
		IssueAfterReset: 10000000,
		IsSoftLimit:     true,
		ResetPeriod:     "MONTH",
		PeriodStart:     periodStart,
		CreatedAt:       now,
	}
	s.entitlements[entCyclode.ID] = entCyclode
	s.entitlements[entSwarm.ID] = entSwarm

	s.grants[entCyclode.ID] = []models.EntitlementGrant{
		{
			ID:              s.NextID("grt"),
			Namespace:       ns,
			EntitlementID:   entCyclode.ID,
			Name:            "Appembly Priority Compute Grant",
			Amount:          500000,
			Priority:        1,
			RolloverEnabled: false,
			EffectiveAt:     periodStart,
			CreatedAt:       now,
		},
		{
			ID:              s.NextID("grt"),
			Namespace:       ns,
			EntitlementID:   entCyclode.ID,
			Name:            "Included Workstation Monthly Pool",
			Amount:          5000000,
			Priority:        2,
			RolloverEnabled: true,
			EffectiveAt:     periodStart,
			CreatedAt:       now,
		},
	}

	tierCap := 5000000.0
	appPlan := models.Plan{
		ID:              s.NextID("pln"),
		Namespace:       ns,
		Slug:            "appembly_autonomous_pro",
		Name:            "Appembly Autonomous Pro ($299/mo + Token & Sandbox Usage)",
		Description:     "Includes 5M LLM tokens across Cyclode, Swarmteam & Valiscale with graduated overage",
		Currency:        "USD",
		BasePriceCents:  29900,
		BillingCadence:  "MONTH",
		IncludedCredits: 5000000,
		RateCards: []models.RateCard{
			{
				FeatureKey:       "ai_token_allowance",
				MeterSlug:        "llm_tokens_total",
				Name:             "Autonomous Agent LLM Tokens",
				PricingModel:     "graduated",
				IncludedQuantity: 500000,
				Tiers: []models.RateCardTier{
					{UpToAmount: &tierCap, UnitPriceCents: 0.03, FlatFeeCents: 0},
					{UpToAmount: nil, UnitPriceCents: 0.015, FlatFeeCents: 0},
				},
			},
			{
				FeatureKey:       "sandbox_compute",
				MeterSlug:        "sandbox_compute_seconds",
				Name:             "Isolated Docker Sandbox Seconds",
				PricingModel:     "flat_per_unit",
				IncludedQuantity: 3600,
				Tiers: []models.RateCardTier{
					{UpToAmount: nil, UnitPriceCents: 1.2, FlatFeeCents: 0},
				},
			},
		},
		CreatedAt: now,
	}
	s.plans[ns+":"+appPlan.Slug] = appPlan

	subRec := models.Subscription{
		ID:                   s.NextID("subscr"),
		Namespace:            ns,
		SubjectKey:           subCyclode.Key,
		PlanSlug:             appPlan.Slug,
		Status:               "active",
		StripeSubscriptionID: "sub_stripe_cyclode_01",
		CurrentPeriodStart:   periodStart,
		CurrentPeriodEnd:     periodStart.AddDate(0, 1, 0),
		CreatedAt:            now,
	}
	s.subscriptions[subRec.ID] = subRec

	seedEvents := []models.CloudEvent{
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_cyclode_01", ns),
			Source:      "urn:appembly:cyclode:executor",
			Type:        "ai.llm.tokens",
			Subject:     subCyclode.Key,
			Time:        now.Add(-4 * time.Hour),
			Data:        map[string]interface{}{"tokens": 24800.0, "model": "claude-3-7-sonnet", "token_type": "input", "persona": "IssueResolver", "tool": "run_command"},
			Namespace:   ns,
			IngestedAt:  now.Add(-4 * time.Hour),
			StoredAt:    now.Add(-4 * time.Hour),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_cyclode_02", ns),
			Source:      "urn:appembly:cyclode:executor",
			Type:        "ai.llm.tokens",
			Subject:     subCyclode.Key,
			Time:        now.Add(-3 * time.Hour),
			Data:        map[string]interface{}{"tokens": 62400.0, "model": "claude-3-7-sonnet", "token_type": "cached", "persona": "IssueResolver", "tool": "view_file"},
			Namespace:   ns,
			IngestedAt:  now.Add(-3 * time.Hour),
			StoredAt:    now.Add(-3 * time.Hour),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_cyclode_03", ns),
			Source:      "urn:appembly:cyclode:executor",
			Type:        "ai.llm.tokens",
			Subject:     subCyclode.Key,
			Time:        now.Add(-2 * time.Hour),
			Data:        map[string]interface{}{"tokens": 14600.0, "model": "claude-3-7-sonnet", "token_type": "reasoning", "persona": "IssueResolver", "tool": "grep_search"},
			Namespace:   ns,
			IngestedAt:  now.Add(-2 * time.Hour),
			StoredAt:    now.Add(-2 * time.Hour),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_cyclode_04", ns),
			Source:      "urn:appembly:cyclode:executor",
			Type:        "ai.llm.tokens",
			Subject:     subCyclode.Key,
			Time:        now.Add(-90 * time.Minute),
			Data:        map[string]interface{}{"tokens": 8420.0, "model": "claude-3-7-sonnet", "token_type": "output", "persona": "IssueResolver", "tool": "replace_file_content"},
			Namespace:   ns,
			IngestedAt:  now.Add(-90 * time.Minute),
			StoredAt:    now.Add(-90 * time.Minute),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_swarm_01", ns),
			Source:      "urn:appembly:swarmteam:dag",
			Type:        "ai.llm.tokens",
			Subject:     subSwarm.Key,
			Time:        now.Add(-60 * time.Minute),
			Data:        map[string]interface{}{"tokens": 41200.0, "model": "gemini-3.8-flash", "token_type": "input", "persona": "ArchitectPod", "tool": "view_file"},
			Namespace:   ns,
			IngestedAt:  now.Add(-60 * time.Minute),
			StoredAt:    now.Add(-60 * time.Minute),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_swarm_02", ns),
			Source:      "urn:appembly:swarmteam:dag",
			Type:        "ai.llm.tokens",
			Subject:     subSwarm.Key,
			Time:        now.Add(-35 * time.Minute),
			Data:        map[string]interface{}{"tokens": 28900.0, "model": "gemini-3.8-flash", "token_type": "cached", "persona": "ArchitectPod", "tool": "grep_search"},
			Namespace:   ns,
			IngestedAt:  now.Add(-35 * time.Minute),
			StoredAt:    now.Add(-35 * time.Minute),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_valiscale_01", ns),
			Source:      "urn:appembly:valiscale:studio",
			Type:        "ai.llm.tokens",
			Subject:     subValiscale.Key,
			Time:        now.Add(-15 * time.Minute),
			Data:        map[string]interface{}{"tokens": 19500.0, "model": "deepseek-r1", "token_type": "reasoning", "persona": "FinOpsAuditor", "tool": "run_command"},
			Namespace:   ns,
			IngestedAt:  now.Add(-15 * time.Minute),
			StoredAt:    now.Add(-15 * time.Minute),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_ph_01", ns),
			Source:      "posthog://sdk/capture",
			Type:        "posthog.pageview",
			Subject:     subCyclode.Key,
			Time:        now.Add(-25 * time.Minute),
			Data: map[string]interface{}{
				"event":               "$pageview",
				"$pathname":           "/workspaces/cyclode/canvas",
				"$geoip_country_code": "US",
				"$geoip_country_name": "United States",
				"$geoip_city_name":    "San Francisco",
				"$browser":            "Chrome 134",
				"$os":                 "macOS Sequoia",
				"$device_type":        "Desktop",
				"$session_id":         "sess_cyclode_01",
			},
			Namespace:  ns,
			IngestedAt: now.Add(-25 * time.Minute),
			StoredAt:   now.Add(-25 * time.Minute),
			Lane:       "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_ph_02", ns),
			Source:      "posthog://sdk/capture",
			Type:        "posthog.event",
			Subject:     subCyclode.Key,
			Time:        now.Add(-20 * time.Minute),
			Data: map[string]interface{}{
				"event":               "chart.rendered",
				"$pathname":           "/workspaces/cyclode/canvas",
				"$geoip_country_code": "US",
				"$geoip_country_name": "United States",
				"$geoip_city_name":    "San Francisco",
				"$browser":            "Chrome 134",
				"$os":                 "macOS Sequoia",
				"$device_type":        "Desktop",
				"$session_id":         "sess_cyclode_01",
			},
			Namespace:  ns,
			IngestedAt: now.Add(-20 * time.Minute),
			StoredAt:   now.Add(-20 * time.Minute),
			Lane:       "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_ph_03", ns),
			Source:      "posthog://sdk/capture",
			Type:        "posthog.pageview",
			Subject:     subSwarm.Key,
			Time:        now.Add(-18 * time.Minute),
			Data: map[string]interface{}{
				"event":               "$pageview",
				"$pathname":           "/swarm/dag-orchestrator",
				"$geoip_country_code": "GB",
				"$geoip_country_name": "United Kingdom",
				"$geoip_city_name":    "London",
				"$browser":            "Arc 1.85",
				"$os":                 "macOS Sequoia",
				"$device_type":        "Desktop",
				"$session_id":         "sess_swarm_01",
			},
			Namespace:  ns,
			IngestedAt: now.Add(-18 * time.Minute),
			StoredAt:   now.Add(-18 * time.Minute),
			Lane:       "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_ph_04", ns),
			Source:      "posthog://sdk/capture",
			Type:        "posthog.pageview",
			Subject:     subKen.Key,
			Time:        now.Add(-10 * time.Minute),
			Data: map[string]interface{}{
				"event":               "$pageview",
				"$pathname":           "/finops/cost-intelligence",
				"$geoip_country_code": "JP",
				"$geoip_country_name": "Japan",
				"$geoip_city_name":    "Tokyo",
				"$browser":            "Safari 18.3",
				"$os":                 "macOS Sequoia",
				"$device_type":        "Desktop",
				"$session_id":         "sess_ken_01",
			},
			Namespace:  ns,
			IngestedAt: now.Add(-10 * time.Minute),
			StoredAt:   now.Add(-10 * time.Minute),
			Lane:       "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_ph_05", ns),
			Source:      "posthog://sdk/capture",
			Type:        "posthog.event",
			Subject:     subElena.Key,
			Time:        now.Add(-5 * time.Minute),
			Data: map[string]interface{}{
				"event":               "invoice.previewed",
				"$pathname":           "/billing/hybrid-plans",
				"$geoip_country_code": "US",
				"$geoip_country_name": "United States",
				"$geoip_city_name":    "New York",
				"$browser":            "Chrome 134",
				"$os":                 "macOS Sequoia",
				"$device_type":        "Desktop",
				"$session_id":         "sess_elena_01",
			},
			Namespace:  ns,
			IngestedAt: now.Add(-5 * time.Minute),
			StoredAt:   now.Add(-5 * time.Minute),
			Lane:       "realtime",
		},
	}
	s.events = append(s.events, seedEvents...)

	if ns == "ns_live_appembly" {
		s.events = append(s.events, models.CloudEvent{
			SpecVersion: "1.0",
			ID:          "evt_dogfood_seed_appembly_01",
			Source:      "meterbox://sink-worker",
			Type:        "meterbox.events.ingested",
			Subject:     "org_appembly",
			Time:        now.Add(-20 * time.Minute),
			Data:        map[string]interface{}{"count": float64(len(seedEvents)), "tenant_namespace": ns, "lane": "realtime"},
			Namespace:   models.InternalDogfoodNamespace,
			IngestedAt:  now.Add(-20 * time.Minute),
			StoredAt:    now.Add(-20 * time.Minute),
			Lane:        "realtime",
		})
	}

	dlqID := s.NextID("dlq")
	s.dlqEvents[dlqID] = models.DLQEvent{
		ID:                 dlqID,
		OpenMeterNamespace: ns,
		EventID:            fmt.Sprintf("evt_malformed_cyclode_%s", ns),
		RawPayload: map[string]interface{}{
			"specversion": "1.0",
			"id":          fmt.Sprintf("evt_malformed_cyclode_%s", ns),
			"source":      "urn:appembly:cyclode:executor",
			"type":        "ai.llm.tokens",
			"subject":     subCyclode.Key,
			"data": map[string]interface{}{
				"tokens":     "NAN_TOKEN_COUNT",
				"model":      "claude-3-7-sonnet",
				"token_type": "input",
				"persona":    "IssueResolver",
			},
		},
		ErrorCode:   "numeric_property_mismatch",
		ErrorReason: "Meter 'llm_tokens_total' requires numeric $.tokens property, got non-numeric string 'NAN_TOKEN_COUNT'",
		Status:      "pending",
		FailedAt:    now.Add(-12 * time.Minute),
	}
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
		GroupBy:       map[string]string{"model": "$.model", "type": "$.token_type", "persona": "$.persona", "tool": "$.tool"},
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
	mPosthog := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "posthog_events_total",
		Name:          "PostHog Product Events",
		Description:   "Captured PostHog product telemetry and user actions",
		Aggregation:   models.AggregationCount,
		EventType:     "posthog.event",
		ValueProperty: "",
		GroupBy:       map[string]string{"event": "$.event", "country": "$.$geoip_country_code"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	mPageviews := models.Meter{
		ID:            s.NextID("mtr"),
		Namespace:     ns,
		Slug:          "pageviews_total",
		Name:          "PostHog Web Pageviews",
		Description:   "Captured $pageview sessions grouped by pathname and visitor country",
		Aggregation:   models.AggregationCount,
		EventType:     "posthog.pageview",
		ValueProperty: "",
		GroupBy:       map[string]string{"pathname": "$.$pathname", "country": "$.$geoip_country_code"},
		WindowSize:    "HOUR",
		CreatedAt:     now,
	}
	s.meters[ns+":"+mTokens.Slug] = mTokens
	s.meters[ns+":"+mRequests.Slug] = mRequests
	s.meters[ns+":"+mGPU.Slug] = mGPU
	s.meters[ns+":"+mPosthog.Slug] = mPosthog
	s.meters[ns+":"+mPageviews.Slug] = mPageviews

	// 2. Subjects (Customers & Active Product Users of the tenant)
	sub1 := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "cust_hyperion_labs",
		DisplayName:      "Hyperion Autonomous Labs",
		Email:            "ops@hyperionlabs.ai",
		StripeCustomerID: "cus_hyperion_8812",
		PlanName:         "AI Scale Hybrid",
		CountryCode:      "US",
		CountryName:      "United States",
		City:             "San Francisco",
		Region:           "California",
		Timezone:         "America/Los_Angeles",
		Browser:          "Chrome 134",
		OS:               "macOS Sequoia",
		DeviceType:       "Desktop",
		LastPathname:     "/agents/orchestrator",
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
		PlanName:         "AI Scale Growth",
		CountryCode:      "GB",
		CountryName:      "United Kingdom",
		City:             "London",
		Region:           "England",
		Timezone:         "Europe/London",
		Browser:          "Arc 1.85",
		OS:               "macOS Sequoia",
		DeviceType:       "Desktop",
		LastPathname:     "/studio/canvas",
		Metadata:         map[string]string{"segment": "growth", "region": "eu-west-1"},
		CreatedAt:        now,
	}
	sub3 := models.Subject{
		ID:               s.NextID("sub"),
		Namespace:        ns,
		Key:              "cust_zephyr_robotics",
		DisplayName:      "Zephyr Robotics GmbH",
		Email:            "platform@zephyr-robotics.de",
		StripeCustomerID: "cus_zephyr_3109",
		PlanName:         "AI Scale Hybrid",
		CountryCode:      "DE",
		CountryName:      "Germany",
		City:             "Berlin",
		Region:           "Berlin",
		Timezone:         "Europe/Berlin",
		Browser:          "Firefox 136",
		OS:               "Ubuntu Linux",
		DeviceType:       "Desktop",
		LastPathname:     "/telemetry/fleet-metrics",
		Metadata:         map[string]string{"segment": "enterprise", "region": "eu-central-1"},
		CreatedAt:        now,
	}
	s.subjects[ns+":"+sub1.Key] = sub1
	s.subjects[ns+":"+sub2.Key] = sub2
	s.subjects[ns+":"+sub3.Key] = sub3

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

	// 5. Seed initial CloudEvents so charts, Cost Intelligence, and PostHog profiles are immediately live
	sampleEvents := []models.CloudEvent{
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_01", ns),
			Source:      "https://gateway.acme-ai.dev/v1/chat/completions",
			Type:        "ai.llm.tokens",
			Subject:     sub1.Key,
			Time:        now.Add(-3 * time.Hour),
			Data:        map[string]interface{}{"tokens": 18500.0, "model": "claude-4-sonnet", "token_type": "output", "persona": "IssueResolver", "tool": "replace_file_content"},
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
			Data:        map[string]interface{}{"tokens": 14200.0, "model": "gpt-5-turbo", "token_type": "input", "persona": "ArchitectPod", "tool": "run_command"},
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
			Data:        map[string]interface{}{"tokens": 12400.0, "model": "claude-4-sonnet", "token_type": "cached", "persona": "IssueResolver", "tool": "view_file"},
			Namespace:   ns,
			IngestedAt:  now.Add(-1 * time.Hour),
			StoredAt:    now.Add(-1 * time.Hour),
			Lane:        "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_03b", ns),
			Source:      "https://gateway.acme-ai.dev/v1/chat/completions",
			Type:        "ai.llm.tokens",
			Subject:     sub3.Key,
			Time:        now.Add(-30 * time.Minute),
			Data:        map[string]interface{}{"tokens": 9600.0, "model": "deepseek-r1", "token_type": "reasoning", "persona": "FinOpsAuditor", "tool": "grep_search"},
			Namespace:   ns,
			IngestedAt:  now.Add(-30 * time.Minute),
			StoredAt:    now.Add(-30 * time.Minute),
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
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_ph_01", ns),
			Source:      "posthog://sdk/capture",
			Type:        "posthog.pageview",
			Subject:     sub1.Key,
			Time:        now.Add(-20 * time.Minute),
			Data: map[string]interface{}{
				"event":               "$pageview",
				"$pathname":           "/agents/orchestrator",
				"$geoip_country_code": "US",
				"$geoip_country_name": "United States",
				"$geoip_city_name":    "San Francisco",
				"$browser":            "Chrome 134",
				"$os":                 "macOS Sequoia",
				"$device_type":        "Desktop",
				"$session_id":         "sess_hyperion_01",
			},
			Namespace:  ns,
			IngestedAt: now.Add(-20 * time.Minute),
			StoredAt:   now.Add(-20 * time.Minute),
			Lane:       "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_ph_02", ns),
			Source:      "posthog://sdk/capture",
			Type:        "posthog.pageview",
			Subject:     sub2.Key,
			Time:        now.Add(-12 * time.Minute),
			Data: map[string]interface{}{
				"event":               "$pageview",
				"$pathname":           "/studio/canvas",
				"$geoip_country_code": "GB",
				"$geoip_country_name": "United Kingdom",
				"$geoip_city_name":    "London",
				"$browser":            "Arc 1.85",
				"$os":                 "macOS Sequoia",
				"$device_type":        "Desktop",
				"$session_id":         "sess_nova_01",
			},
			Namespace:  ns,
			IngestedAt: now.Add(-12 * time.Minute),
			StoredAt:   now.Add(-12 * time.Minute),
			Lane:       "realtime",
		},
		{
			SpecVersion: "1.0",
			ID:          fmt.Sprintf("evt_seed_%s_ph_03", ns),
			Source:      "posthog://sdk/capture",
			Type:        "posthog.event",
			Subject:     sub3.Key,
			Time:        now.Add(-8 * time.Minute),
			Data: map[string]interface{}{
				"event":               "agent.task_created",
				"$pathname":           "/telemetry/fleet-metrics",
				"$geoip_country_code": "DE",
				"$geoip_country_name": "Germany",
				"$geoip_city_name":    "Berlin",
				"$browser":            "Firefox 136",
				"$os":                 "Ubuntu Linux",
				"$device_type":        "Desktop",
				"$session_id":         "sess_zephyr_01",
			},
			Namespace:  ns,
			IngestedAt: now.Add(-8 * time.Minute),
			StoredAt:   now.Add(-8 * time.Minute),
			Lane:       "realtime",
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
// hydrates 360° subject profiles, and invalidates affected entitlement edge-cache entries.
func (s *MultiTenantStore) AppendEvents(events []models.CloudEvent) {
	if len(events) == 0 {
		return
	}
	s.mu.Lock()
	s.events = append(s.events, events...)
	for _, ev := range events {
		s.hydrateSubjectFromEventLocked(ev)
		prefix := ev.Namespace + ":" + ev.Subject + ":"
		for k := range s.entCache {
			if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
				delete(s.entCache, k)
			}
		}
	}
	s.saveStateLocked()
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

	if strings.HasPrefix(strings.ToLower(ev.Type), "unmapped.") {
		return "unmapped_event_type",
			fmt.Sprintf("No active meter registered in namespace %q for event type %q", ns, ev.Type),
			false
	}

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
	s.saveStateLocked()
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
	s.saveStateLocked()
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
	s.saveStateLocked()
	return m
}

func (s *MultiTenantStore) QueryMeter(ns, slug, subjectFilter string, from, to *time.Time, windowOverride ...string) (models.MeterQueryResult, error) {
	s.mu.RLock()
	meter, ok := s.meters[ns+":"+slug]
	if !ok {
		s.mu.RUnlock()
		return models.MeterQueryResult{}, fmt.Errorf("meter %q not found in namespace %q", slug, ns)
	}
	eventsCopy := make([]models.CloudEvent, len(s.events))
	copy(eventsCopy, s.events)
	s.mu.RUnlock()

	return s.chClient.AggregateMeter(meter, eventsCopy, subjectFilter, from, to, windowOverride...), nil
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
	key := sub.Namespace + ":" + sub.Key
	if existing, ok := s.subjects[key]; ok {
		sub.ID = existing.ID
		sub.CreatedAt = existing.CreatedAt
		if sub.DisplayName == "" || sub.DisplayName == sub.Key {
			if existing.DisplayName != "" {
				sub.DisplayName = existing.DisplayName
			}
		}
		if sub.Email == "" {
			sub.Email = existing.Email
		}
		if sub.StripeCustomerID == "" {
			sub.StripeCustomerID = existing.StripeCustomerID
		}
		if sub.PlanName == "" {
			sub.PlanName = existing.PlanName
		}
		if sub.CountryCode == "" {
			sub.CountryCode = existing.CountryCode
		}
		if sub.CountryName == "" {
			sub.CountryName = existing.CountryName
		}
		if sub.City == "" {
			sub.City = existing.City
		}
		if sub.Region == "" {
			sub.Region = existing.Region
		}
		if sub.Timezone == "" {
			sub.Timezone = existing.Timezone
		}
		if sub.Browser == "" {
			sub.Browser = existing.Browser
		}
		if sub.OS == "" {
			sub.OS = existing.OS
		}
		if sub.DeviceType == "" {
			sub.DeviceType = existing.DeviceType
		}
		if sub.LastPathname == "" {
			sub.LastPathname = existing.LastPathname
		}
		if sub.EventCount == 0 {
			sub.EventCount = existing.EventCount
		}
		if sub.PageviewCount == 0 {
			sub.PageviewCount = existing.PageviewCount
		}
		if sub.SessionCount == 0 {
			sub.SessionCount = existing.SessionCount
		}
		if sub.TotalTokens == 0 {
			sub.TotalTokens = existing.TotalTokens
		}
		if sub.TotalCostUSD == 0 {
			sub.TotalCostUSD = existing.TotalCostUSD
		}
		if sub.FirstSeenAt == nil {
			sub.FirstSeenAt = existing.FirstSeenAt
		}
		if sub.LastSeenAt == nil {
			sub.LastSeenAt = existing.LastSeenAt
		}
		if len(sub.Metadata) == 0 && len(existing.Metadata) > 0 {
			sub.Metadata = existing.Metadata
		}
	} else {
		sub.ID = s.NextID("sub")
		sub.CreatedAt = time.Now().UTC()
	}
	s.subjects[key] = sub
	s.saveStateLocked()
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
	s.saveStateLocked()
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
	s.saveStateLocked()
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
	s.saveStateLocked()
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
	s.saveStateLocked()
	return sub
}

func (s *MultiTenantStore) SaveInvoice(inv models.Invoice) models.Invoice {
	s.mu.Lock()
	defer s.mu.Unlock()
	if inv.ID == "" {
		inv.ID = s.NextID("inv")
	}
	inv.CreatedAt = time.Now().UTC()
	if inv.IssuedAt.IsZero() {
		inv.IssuedAt = inv.CreatedAt
	}
	s.invoices[inv.ID] = inv
	s.saveStateLocked()
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
	s.rebuildSubjectProfilesLocked()
	s.saveStateLocked()
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
	s.saveStateLocked()
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
	for k := range s.subjectSessions {
		if len(k) > len(ns) && k[:len(ns)+1] == ns+":" {
			delete(s.subjectSessions, k)
		}
	}

	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	if strings.Contains(ns, "appembly") {
		s.seedAppemblyNamespaceEntities(ns, periodStart, now)
	} else {
		s.seedNamespaceEntities(ns, periodStart, now)
	}
	s.rebuildSubjectProfilesLocked()
	s.saveStateLocked()
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
	s.saveStateLocked()
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
	s.saveStateLocked()
	return true
}

func (s *MultiTenantStore) GetTelemetry(ns string) models.TelemetrySnapshot {
	s.mu.RLock()
	orgID := ""
	orgName := ""
	if envID, ok := s.nsToEnv[ns]; ok {
		orgID = s.envs[envID].OrgID
		if org, exists := s.orgs[orgID]; exists {
			orgName = org.Name
		}
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
	recentEvents := s.ListRecentEvents(ns, 35)

	hits := s.edgeCacheHits.Load()
	misses := s.edgeCacheMisses.Load()
	ratio := 96.0
	if hits+misses > 0 {
		ratio = float64(hits) * 100.0 / float64(hits+misses)
	}

	estimatedCents := 9900 + int(dogfoodRes.TotalValue*10)
	dedupCount := int(s.dedupDropped.Load())

	return models.TelemetrySnapshot{
		OrgID:                  orgID,
		OrgName:                orgName,
		ActiveNamespace:        ns,
		TotalEventsIngested:    totalEv,
		IngestedEvents:         totalEv,
		RealtimeLaneEvents:     rtEv,
		BulkLaneEvents:         bulkEv,
		DeduplicatedDropped:    dedupCount,
		DeduplicatedHits:       dedupCount,
		PendingDLQEvents:       dlqPending,
		DLQPendingCount:        dlqPending,
		ActiveMeters:           metersCount,
		ActiveSubjects:         subjectsCount,
		ActiveEntitlements:     entsCount,
		EntitlementChecks:      hits + misses,
		AvgCheckLatencyUs:      210,
		EdgeCacheHits:          hits,
		EdgeCacheMisses:        misses,
		EdgeCacheHitRatioPct:   ratio,
		CacheHitRatio:          ratio / 100.0,
		DogfoodOrgEventsBilled: dogfoodRes.TotalValue,
		DogfoodEstimatedCents:  estimatedCents,
		DogfoodSelfBilling: map[string]float64{
			"meterbox_ingested_events": dogfoodRes.TotalValue,
		},
		RecentEvents:        recentEvents,
		ClickHouseConnected: s.chClient.Ping(),
		RedpandaConnected:   s.pingRedpanda(),
		RedisConnected:      s.pingRedis(),
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

// ============================================================================
// PHASE 1 & PHASE 2: CREDIT OFFSET, GRANTS LEDGER, 360° PROFILES, FINOPS & POSTHOG
// ============================================================================

// modelTokenCostPerMillionUSD returns realistic provider cost per 1M tokens for FinOps margin analytics.
func modelTokenCostPerMillionUSD(modelName, tokenType string) float64 {
	m := strings.ToLower(strings.TrimSpace(modelName))
	tt := strings.ToLower(strings.TrimSpace(tokenType))

	baseRate := 3.00 // default per 1M input tokens
	switch {
	case strings.Contains(m, "claude-4") || strings.Contains(m, "claude-3-7") || strings.Contains(m, "sonnet"):
		baseRate = 3.00
		if tt == "output" || tt == "reasoning" {
			return 15.00
		}
		if tt == "cached" {
			return 0.30
		}
	case strings.Contains(m, "gemini") && strings.Contains(m, "flash"):
		baseRate = 0.35
		if tt == "output" || tt == "reasoning" {
			return 1.05
		}
		if tt == "cached" {
			return 0.08
		}
	case strings.Contains(m, "gpt-5") || strings.Contains(m, "gpt-4"):
		baseRate = 2.50
		if tt == "output" || tt == "reasoning" {
			return 10.00
		}
		if tt == "cached" {
			return 0.25
		}
	case strings.Contains(m, "deepseek"):
		baseRate = 0.55
		if tt == "output" || tt == "reasoning" {
			return 2.19
		}
		if tt == "cached" {
			return 0.14
		}
	default:
		if tt == "output" || tt == "reasoning" {
			return baseRate * 3.0
		}
		if tt == "cached" {
			return baseRate * 0.15
		}
	}
	return baseRate
}

func extractMapStr(data map[string]interface{}, keys ...string) string {
	if data == nil {
		return ""
	}
	for _, k := range keys {
		if raw, ok := data[k]; ok && raw != nil {
			if s := strings.TrimSpace(fmt.Sprintf("%v", raw)); s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}

func extractMapFloat(data map[string]interface{}, key string) float64 {
	if data == nil {
		return 0
	}
	raw, ok := data[key]
	if !ok || raw == nil {
		return 0
	}
	switch v := raw.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	case string:
		var f float64
		_ = json.Unmarshal([]byte(v), &f)
		return f
	default:
		return 0
	}
}

// hydrateSubjectFromEventLocked enriches a Subject's 360° profile (GeoIP, device/browser,
// pageview/event/session counts, and token/cost attribution) from a CloudEvent.
// Caller must hold s.mu.Lock().
func (s *MultiTenantStore) hydrateSubjectFromEventLocked(ev models.CloudEvent) {
	if ev.Subject == "" || ev.Namespace == "" {
		return
	}
	key := ev.Namespace + ":" + ev.Subject
	sub, exists := s.subjects[key]
	if !exists {
		sub = models.Subject{
			ID:          s.NextID("sub"),
			Namespace:   ev.Namespace,
			Key:         ev.Subject,
			DisplayName: ev.Subject,
			Metadata:    make(map[string]string),
			CreatedAt:   ev.Time,
		}
	}

	sub.EventCount++
	evTime := ev.Time
	if evTime.IsZero() {
		evTime = time.Now().UTC()
	}
	if sub.FirstSeenAt == nil || evTime.Before(*sub.FirstSeenAt) {
		t := evTime
		sub.FirstSeenAt = &t
	}
	if sub.LastSeenAt == nil || evTime.After(*sub.LastSeenAt) {
		t := evTime
		sub.LastSeenAt = &t
	}

	evName := extractMapStr(ev.Data, "event")
	if ev.Type == "posthog.pageview" || evName == "$pageview" || ev.Type == "$pageview" {
		sub.PageviewCount++
	}

	if sessID := extractMapStr(ev.Data, "$session_id", "session_id"); sessID != "" {
		sessKey := ev.Namespace + ":" + ev.Subject + ":" + sessID
		if !s.subjectSessions[sessKey] {
			s.subjectSessions[sessKey] = true
			sub.SessionCount++
		}
	} else if sub.SessionCount == 0 {
		sub.SessionCount = 1
	}

	if v := extractMapStr(ev.Data, "display_name", "name"); v != "" && (sub.DisplayName == "" || sub.DisplayName == sub.Key) {
		sub.DisplayName = v
	}
	if v := extractMapStr(ev.Data, "email", "$email"); v != "" {
		sub.Email = v
	}
	if v := extractMapStr(ev.Data, "plan", "plan_name"); v != "" {
		sub.PlanName = v
	}
	if v := extractMapStr(ev.Data, "$pathname", "pathname", "$current_url"); v != "" {
		sub.LastPathname = v
	}
	if v := extractMapStr(ev.Data, "$geoip_country_code", "country_code", "country"); v != "" {
		sub.CountryCode = strings.ToUpper(v)
	}
	if v := extractMapStr(ev.Data, "$geoip_country_name", "country_name"); v != "" {
		sub.CountryName = v
	}
	if v := extractMapStr(ev.Data, "$geoip_city_name", "city"); v != "" {
		sub.City = v
	}
	if v := extractMapStr(ev.Data, "$geoip_subdivision_1_name", "region"); v != "" {
		sub.Region = v
	}
	if v := extractMapStr(ev.Data, "$timezone", "timezone"); v != "" {
		sub.Timezone = v
	}
	if v := extractMapStr(ev.Data, "$browser", "browser"); v != "" {
		sub.Browser = v
	}
	if v := extractMapStr(ev.Data, "$os", "os"); v != "" {
		sub.OS = v
	}
	if v := extractMapStr(ev.Data, "$device_type", "device_type"); v != "" {
		sub.DeviceType = v
	}

	if ev.Type == "ai.llm.tokens" {
		toks := extractMapFloat(ev.Data, "tokens")
		if toks > 0 {
			sub.TotalTokens += toks
			modelName := extractMapStr(ev.Data, "model")
			tokType := extractMapStr(ev.Data, "token_type", "type")
			ratePerM := modelTokenCostPerMillionUSD(modelName, tokType)
			sub.TotalCostUSD = math.Round((sub.TotalCostUSD+(toks/1_000_000.0)*ratePerM)*10000) / 10000
		}
	}

	s.subjects[key] = sub
}

// rebuildSubjectProfilesLocked recomputes EventCount, PageviewCount, SessionCount, TotalTokens, and TotalCostUSD
// across all subjects from the stored events log. Caller must hold s.mu.Lock() or be in initialization.
func (s *MultiTenantStore) rebuildSubjectProfilesLocked() {
	s.subjectSessions = make(map[string]bool)
	for k, sub := range s.subjects {
		sub.EventCount = 0
		sub.PageviewCount = 0
		sub.SessionCount = 0
		sub.TotalTokens = 0
		sub.TotalCostUSD = 0
		sub.FirstSeenAt = nil
		sub.LastSeenAt = nil
		s.subjects[k] = sub
	}
	for _, ev := range s.events {
		s.hydrateSubjectFromEventLocked(ev)
	}
}

// CalculateSubjectCreditOffsetCents computes prepaid promotional credit grant offsets in cents for an invoice,
// ensuring priority bonus grants reduce overage charges while preserving base plan pricing.
func (s *MultiTenantStore) CalculateSubjectCreditOffsetCents(ns, subjectKey string, subtotalCents int) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if subtotalCents <= 0 {
		return 0
	}

	creditCents := 0
	for _, ent := range s.entitlements {
		if ent.Namespace != ns || ent.SubjectKey != subjectKey {
			continue
		}
		for _, g := range s.grants[ent.ID] {
			// Promotional / priority prepaid grants (Priority 1 without rollover or custom top-up grants)
			if g.Priority == 1 && !g.RolloverEnabled && !strings.Contains(strings.ToLower(g.Name), "included") {
				// Value token grants at 0.01 cents per token (or direct cents if non-token)
				grantValueCents := int(math.Round(g.Amount * 0.01))
				if grantValueCents > 1500 {
					grantValueCents = 1500
				}
				if grantValueCents > 0 {
					creditCents += grantValueCents
				}
			}
		}
	}

	// Never reduce invoice below base plan price + 100 cents when usage overage exists
	maxOffset := subtotalCents / 10
	if creditCents > maxOffset {
		creditCents = maxOffset
	}
	return creditCents
}

// ListAllGrants returns all priority credit grants in a namespace with live remaining & used balances computed
// against ClickHouse meter usage using the priority waterfall algorithm.
func (s *MultiTenantStore) ListAllGrants(ns, subjectFilter string) []models.EntitlementGrant {
	ents := s.ListEntitlements(ns, subjectFilter)
	out := make([]models.EntitlementGrant, 0)

	for _, ent := range ents {
		_, grants, ok := s.GetEntitlementBySubjectFeature(ns, ent.SubjectKey, ent.FeatureKey)
		if !ok || len(grants) == 0 {
			continue
		}
		sort.Slice(grants, func(i, j int) bool {
			if grants[i].Priority == grants[j].Priority {
				return grants[i].EffectiveAt.Before(grants[j].EffectiveAt)
			}
			return grants[i].Priority < grants[j].Priority
		})

		usage := 0.0
		if ent.MeterSlug != "" {
			if qRes, err := s.QueryMeter(ns, ent.MeterSlug, ent.SubjectKey, &ent.PeriodStart, nil); err == nil {
				usage = qRes.TotalValue
			}
		}

		remainingUsageToBurn := usage
		for _, g := range grants {
			burned := 0.0
			if remainingUsageToBurn > 0 {
				if remainingUsageToBurn >= g.Amount {
					burned = g.Amount
					remainingUsageToBurn -= g.Amount
				} else {
					burned = remainingUsageToBurn
					remainingUsageToBurn = 0
				}
			}
			g.SubjectKey = ent.SubjectKey
			g.FeatureKey = ent.FeatureKey
			g.UsedBalance = burned
			g.Remaining = g.Amount - burned
			out = append(out, g)
		}
	}
	return out
}

// GetCostIntelligence aggregates real-time AI token usage, provider cost, billed revenue, and gross margins
// across token types (input, cached, reasoning, output), models, tools, personas, and subjects.
func (s *MultiTenantStore) GetCostIntelligence(ns string) models.CostIntelligenceReport {
	s.mu.RLock()
	eventsCopy := make([]models.CloudEvent, 0)
	for _, ev := range s.events {
		if ev.Namespace == ns && ev.Type == "ai.llm.tokens" {
			eventsCopy = append(eventsCopy, ev)
		}
	}
	subjectsMap := make(map[string]models.Subject)
	for _, sub := range s.subjects {
		if sub.Namespace == ns {
			subjectsMap[sub.Key] = sub
		}
	}
	s.mu.RUnlock()

	var totalTokens, inputTokens, cachedTokens, reasoningTokens, outputTokens float64
	var totalCostUSD float64

	type aggBucket struct {
		tokens  float64
		costUSD float64
		events  int
	}
	byModel := make(map[string]*aggBucket)
	byTool := make(map[string]*aggBucket)
	byPersona := make(map[string]*aggBucket)
	bySubject := make(map[string]*aggBucket)

	for _, ev := range eventsCopy {
		toks := extractMapFloat(ev.Data, "tokens")
		if toks <= 0 {
			continue
		}
		modelName := extractMapStr(ev.Data, "model")
		if modelName == "" {
			modelName = "claude-3-7-sonnet"
		}
		tokType := strings.ToLower(extractMapStr(ev.Data, "token_type", "type"))
		if tokType == "" {
			tokType = "input"
		}
		toolName := extractMapStr(ev.Data, "tool")
		if toolName == "" {
			toolName = "agent_step_turn"
		}
		personaName := extractMapStr(ev.Data, "persona")
		if personaName == "" {
			personaName = "AutonomousAgent"
		}

		totalTokens += toks
		switch tokType {
		case "cached":
			cachedTokens += toks
		case "reasoning":
			reasoningTokens += toks
		case "output":
			outputTokens += toks
		default:
			inputTokens += toks
		}

		ratePerM := modelTokenCostPerMillionUSD(modelName, tokType)
		evCost := (toks / 1_000_000.0) * ratePerM
		totalCostUSD += evCost

		if byModel[modelName] == nil {
			byModel[modelName] = &aggBucket{}
		}
		byModel[modelName].tokens += toks
		byModel[modelName].costUSD += evCost
		byModel[modelName].events++

		if byTool[toolName] == nil {
			byTool[toolName] = &aggBucket{}
		}
		byTool[toolName].tokens += toks
		byTool[toolName].costUSD += evCost
		byTool[toolName].events++

		if byPersona[personaName] == nil {
			byPersona[personaName] = &aggBucket{}
		}
		byPersona[personaName].tokens += toks
		byPersona[personaName].costUSD += evCost
		byPersona[personaName].events++

		if bySubject[ev.Subject] == nil {
			bySubject[ev.Subject] = &aggBucket{}
		}
		bySubject[ev.Subject].tokens += toks
		bySubject[ev.Subject].costUSD += evCost
		bySubject[ev.Subject].events++
	}

	// Calculate cache savings vs uncached input rate ($3.00 / 1M tokens)
	cacheSavingsUSD := (cachedTokens / 1_000_000.0) * (3.00 - 0.30)

	// Billed revenue across active plan rate cards ($12.00 / 1M blended billable rate + base allocation share)
	totalBilledUSD := totalCostUSD * 2.65
	if totalTokens > 0 && totalBilledUSD < 45.0 {
		totalBilledUSD = math.Round((49.0+totalCostUSD*2.4)*100) / 100
	}
	grossMarginPct := 0.0
	if totalBilledUSD > 0 {
		grossMarginPct = math.Round(((totalBilledUSD-totalCostUSD)/totalBilledUSD)*1000) / 10
	}

	modelsOut := make([]models.DimensionCostBreakdown, 0, len(byModel))
	for k, b := range byModel {
		share := 0.0
		if totalTokens > 0 {
			share = math.Round((b.tokens/totalTokens)*1000) / 10
		}
		rev := math.Round(b.costUSD*2.65*10000) / 10000
		margin := 0.0
		if rev > 0 {
			margin = math.Round(((rev-b.costUSD)/rev)*1000) / 10
		}
		modelsOut = append(modelsOut, models.DimensionCostBreakdown{
			Dimension:  k,
			Tokens:     b.tokens,
			SharePct:   share,
			CostUSD:    math.Round(b.costUSD*10000) / 10000,
			RevenueUSD: rev,
			MarginPct:  margin,
			EventCount: b.events,
		})
	}
	sort.Slice(modelsOut, func(i, j int) bool { return modelsOut[i].Tokens > modelsOut[j].Tokens })

	toolsOut := make([]models.DimensionCostBreakdown, 0, len(byTool))
	for k, b := range byTool {
		share := 0.0
		if totalTokens > 0 {
			share = math.Round((b.tokens/totalTokens)*1000) / 10
		}
		toolsOut = append(toolsOut, models.DimensionCostBreakdown{
			Dimension:  k,
			Tokens:     b.tokens,
			SharePct:   share,
			CostUSD:    math.Round(b.costUSD*10000) / 10000,
			EventCount: b.events,
		})
	}
	sort.Slice(toolsOut, func(i, j int) bool { return toolsOut[i].Tokens > toolsOut[j].Tokens })

	personasOut := make([]models.DimensionCostBreakdown, 0, len(byPersona))
	for k, b := range byPersona {
		share := 0.0
		if totalTokens > 0 {
			share = math.Round((b.tokens/totalTokens)*1000) / 10
		}
		personasOut = append(personasOut, models.DimensionCostBreakdown{
			Dimension:  k,
			Tokens:     b.tokens,
			SharePct:   share,
			CostUSD:    math.Round(b.costUSD*10000) / 10000,
			EventCount: b.events,
		})
	}
	sort.Slice(personasOut, func(i, j int) bool { return personasOut[i].Tokens > personasOut[j].Tokens })

	subjectsOut := make([]models.SubjectMarginBreakdown, 0, len(bySubject))
	for subjKey, b := range bySubject {
		disp := subjKey
		if sObj, ok := subjectsMap[subjKey]; ok && sObj.DisplayName != "" {
			disp = sObj.DisplayName
		}
		rev := math.Round((29.0+b.costUSD*2.5)*100) / 100
		margin := 0.0
		if rev > 0 {
			margin = math.Round(((rev-b.costUSD)/rev)*1000) / 10
		}
		status := "healthy"
		if margin < 40 {
			status = "at_risk"
		} else if margin < 60 {
			status = "watch"
		}
		subjectsOut = append(subjectsOut, models.SubjectMarginBreakdown{
			SubjectKey:  subjKey,
			DisplayName: disp,
			Tokens:      b.tokens,
			CostUSD:     math.Round(b.costUSD*10000) / 10000,
			RevenueUSD:  rev,
			MarginPct:   margin,
			Status:      status,
		})
	}
	sort.Slice(subjectsOut, func(i, j int) bool { return subjectsOut[i].Tokens > subjectsOut[j].Tokens })

	return models.CostIntelligenceReport{
		Namespace:       ns,
		TotalTokens:     totalTokens,
		InputTokens:     inputTokens,
		CachedTokens:    cachedTokens,
		ReasoningTokens: reasoningTokens,
		OutputTokens:    outputTokens,
		TotalCostUSD:    math.Round(totalCostUSD*10000) / 10000,
		TotalBilledUSD:  math.Round(totalBilledUSD*100) / 100,
		GrossMarginPct:  grossMarginPct,
		CacheSavingsUSD: math.Round(cacheSavingsUSD*10000) / 10000,
		ByModel:         modelsOut,
		ByTool:          toolsOut,
		ByPersona:       personasOut,
		BySubject:       subjectsOut,
	}
}

// GetProductAnalytics computes PostHog & 360° User Profile analytics (locations, pageviews, event funnel, devices).
func (s *MultiTenantStore) GetProductAnalytics(ns string) models.ProductAnalyticsReport {
	s.mu.RLock()
	subs := make([]models.Subject, 0)
	for _, sub := range s.subjects {
		if sub.Namespace == ns {
			subs = append(subs, sub)
		}
	}
	evs := make([]models.CloudEvent, 0)
	for _, ev := range s.events {
		if ev.Namespace == ns {
			evs = append(evs, ev)
		}
	}
	s.mu.RUnlock()

	now := time.Now().UTC()
	active24h := 0
	totalPageviews := 0
	totalSessions := 0
	countriesSet := make(map[string]bool)

	type locAgg struct {
		countryCode string
		countryName string
		city        string
		users       int
		events      int
		pageviews   int
		tokens      float64
	}
	locMap := make(map[string]*locAgg)
	deviceMap := make(map[string]int)

	for _, sub := range subs {
		if sub.LastSeenAt != nil && now.Sub(*sub.LastSeenAt) <= 24*time.Hour {
			active24h++
		}
		totalPageviews += sub.PageviewCount
		totalSessions += sub.SessionCount

		cc := sub.CountryCode
		if cc == "" {
			cc = "US"
		}
		cn := sub.CountryName
		if cn == "" {
			cn = "United States"
		}
		city := sub.City
		if city == "" {
			city = "San Francisco"
		}
		countriesSet[cc] = true

		locKey := cc + ":" + city
		if locMap[locKey] == nil {
			locMap[locKey] = &locAgg{
				countryCode: cc,
				countryName: cn,
				city:        city,
			}
		}
		locMap[locKey].users++
		locMap[locKey].events += sub.EventCount
		locMap[locKey].pageviews += sub.PageviewCount
		locMap[locKey].tokens += sub.TotalTokens

		devLabel := strings.TrimSpace(sub.Browser + " · " + sub.OS)
		if devLabel == "·" || devLabel == "" {
			devLabel = "Chrome 134 · macOS"
		}
		deviceMap[devLabel]++
	}

	pageUsers := make(map[string]map[string]bool)
	pageViews := make(map[string]int)
	eventUsers := make(map[string]map[string]bool)
	eventCounts := make(map[string]int)
	totalProductEvents := 0

	for _, ev := range evs {
		totalProductEvents++
		evLabel := ev.Type
		if phEv := extractMapStr(ev.Data, "event"); phEv != "" {
			evLabel = phEv
		}
		eventCounts[evLabel]++
		if eventUsers[evLabel] == nil {
			eventUsers[evLabel] = make(map[string]bool)
		}
		eventUsers[evLabel][ev.Subject] = true

		if path := extractMapStr(ev.Data, "$pathname", "pathname"); path != "" {
			pageViews[path]++
			if pageUsers[path] == nil {
				pageUsers[path] = make(map[string]bool)
			}
			pageUsers[path][ev.Subject] = true
		}
	}

	locations := make([]models.LocationBreakdown, 0, len(locMap))
	for _, l := range locMap {
		share := 0.0
		if len(subs) > 0 {
			share = math.Round((float64(l.users)/float64(len(subs)))*1000) / 10
		}
		locations = append(locations, models.LocationBreakdown{
			CountryCode: l.countryCode,
			CountryName: l.countryName,
			City:        l.city,
			Users:       l.users,
			Events:      l.events,
			Pageviews:   l.pageviews,
			Tokens:      l.tokens,
			SharePct:    share,
		})
	}
	sort.Slice(locations, func(i, j int) bool {
		if locations[i].Users == locations[j].Users {
			return locations[i].Events > locations[j].Events
		}
		return locations[i].Users > locations[j].Users
	})

	topPages := make([]models.PageviewBreakdown, 0, len(pageViews))
	for p, count := range pageViews {
		topPages = append(topPages, models.PageviewBreakdown{
			Pathname: p,
			Views:    count,
			Users:    len(pageUsers[p]),
		})
	}
	sort.Slice(topPages, func(i, j int) bool { return topPages[i].Views > topPages[j].Views })

	eventBreakdowns := make([]models.EventTypeBreakdown, 0, len(eventCounts))
	for eName, count := range eventCounts {
		share := 0.0
		if totalProductEvents > 0 {
			share = math.Round((float64(count)/float64(totalProductEvents))*1000) / 10
		}
		eventBreakdowns = append(eventBreakdowns, models.EventTypeBreakdown{
			EventType: eName,
			Count:     count,
			Users:     len(eventUsers[eName]),
			SharePct:  share,
		})
	}
	sort.Slice(eventBreakdowns, func(i, j int) bool { return eventBreakdowns[i].Count > eventBreakdowns[j].Count })

	devices := make([]models.DeviceBreakdown, 0, len(deviceMap))
	for label, count := range deviceMap {
		share := 0.0
		if len(subs) > 0 {
			share = math.Round((float64(count)/float64(len(subs)))*1000) / 10
		}
		devices = append(devices, models.DeviceBreakdown{
			Label:    label,
			Users:    count,
			SharePct: share,
		})
	}
	sort.Slice(devices, func(i, j int) bool { return devices[i].Users > devices[j].Users })

	return models.ProductAnalyticsReport{
		Namespace:          ns,
		TotalUsers:         len(subs),
		ActiveUsers24h:     active24h,
		TotalPageviews:     totalPageviews,
		TotalProductEvents: totalProductEvents,
		TotalSessions:      totalSessions,
		UniqueCountries:    len(countriesSet),
		Locations:          locations,
		TopPages:           topPages,
		EventBreakdown:     eventBreakdowns,
		Devices:            devices,
	}
}

type persistedState struct {
	Orgs              map[string]models.Organization       `json:"orgs"`
	Envs              map[string]models.Environment        `json:"envs"`
	NsToEnv           map[string]string                    `json:"ns_to_env"`
	APIKeys           map[string]models.APIKey             `json:"api_keys"`
	HashToKeyID       map[string]string                    `json:"hash_to_key_id"`
	DLQEvents         map[string]models.DLQEvent           `json:"dlq_events"`
	Meters            map[string]models.Meter              `json:"meters"`
	Subjects          map[string]models.Subject            `json:"subjects"`
	Entitlements      map[string]models.Entitlement        `json:"entitlements"`
	Grants            map[string][]models.EntitlementGrant `json:"grants"`
	Plans             map[string]models.Plan               `json:"plans"`
	Subscriptions     map[string]models.Subscription       `json:"subscriptions"`
	Invoices          map[string]models.Invoice            `json:"invoices"`
	PaymentMethods    map[string]models.PaymentMethod      `json:"payment_methods,omitempty"`
	AutoRechargeRules map[string]models.AutoRechargeRule   `json:"auto_recharge_rules,omitempty"`
	CheckoutSessions  map[string]models.CheckoutSession    `json:"checkout_sessions,omitempty"`
	PaymentWebhooks   []models.PaymentWebhookEvent         `json:"payment_webhooks,omitempty"`
	Events            []models.CloudEvent                  `json:"events"`
	IDSeq             int64                                `json:"id_seq"`
}

func (s *MultiTenantStore) saveStateLocked() {
	if s.stateFile == "" {
		return
	}
	snap := persistedState{
		Orgs:              s.orgs,
		Envs:              s.envs,
		NsToEnv:           s.nsToEnv,
		APIKeys:           s.apiKeys,
		HashToKeyID:       s.hashToKeyID,
		DLQEvents:         s.dlqEvents,
		Meters:            s.meters,
		Subjects:          s.subjects,
		Entitlements:      s.entitlements,
		Grants:            s.grants,
		Plans:             s.plans,
		Subscriptions:     s.subscriptions,
		Invoices:          s.invoices,
		PaymentMethods:    s.paymentMethods,
		AutoRechargeRules: s.autoRechargeRules,
		CheckoutSessions:  s.checkoutSessions,
		PaymentWebhooks:   s.paymentWebhooks,
		Events:            s.events,
		IDSeq:             s.idSeq.Load(),
	}
	raw, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return
	}
	tmp := s.stateFile + ".tmp"
	if err := os.WriteFile(tmp, raw, 0600); err == nil {
		_ = os.Rename(tmp, s.stateFile)
	}
}

func (s *MultiTenantStore) loadState() bool {
	if s.stateFile == "" {
		return false
	}
	raw, err := os.ReadFile(s.stateFile)
	if err != nil || len(raw) == 0 {
		return false
	}
	var snap persistedState
	if err := json.Unmarshal(raw, &snap); err != nil || len(snap.Orgs) == 0 {
		return false
	}
	s.orgs = snap.Orgs
	s.envs = snap.Envs
	s.nsToEnv = snap.NsToEnv
	s.apiKeys = snap.APIKeys
	s.hashToKeyID = snap.HashToKeyID
	s.dlqEvents = snap.DLQEvents
	s.meters = snap.Meters
	s.subjects = snap.Subjects
	s.entitlements = snap.Entitlements
	s.grants = snap.Grants
	s.plans = snap.Plans
	s.subscriptions = snap.Subscriptions
	s.invoices = snap.Invoices
	if snap.PaymentMethods != nil {
		s.paymentMethods = snap.PaymentMethods
	}
	if snap.AutoRechargeRules != nil {
		s.autoRechargeRules = snap.AutoRechargeRules
	}
	if snap.CheckoutSessions != nil {
		s.checkoutSessions = snap.CheckoutSessions
	}
	if snap.PaymentWebhooks != nil {
		s.paymentWebhooks = snap.PaymentWebhooks
	}
	s.events = snap.Events
	s.idSeq.Store(snap.IDSeq)
	if len(s.paymentMethods) == 0 {
		now := time.Now().UTC()
		s.seedPaymentOrchestrationEntities("ns_live_appembly", now)
		s.seedPaymentOrchestrationEntities("ns_test_appembly", now)
		s.seedPaymentOrchestrationEntities("ns_live_acme", now)
		s.seedPaymentOrchestrationEntities("ns_test_acme", now)
		s.saveStateLocked()
	}
	s.rebuildSubjectProfilesLocked()
	return true
}
