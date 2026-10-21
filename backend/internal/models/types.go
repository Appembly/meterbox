package models

import "time"

type KeyScope string

const (
	ScopeIngest      KeyScope = "ingest"      // mb_ing_live_* / mb_ing_test_* (POST /api/v1/events only)
	ScopeEntitlement KeyScope = "entitlement" // mb_ent_live_* / mb_ent_test_* (GET entitlements & portal tokens)
	ScopeAdmin       KeyScope = "admin"       // mb_sk_live_*  / mb_sk_test_*  (Full OpenMeter & Control Plane CRUD)
	ScopePortal      KeyScope = "portal"      // mb_portal_*   (Locked to single namespace + subject)
)

const InternalDogfoodNamespace = "ns_meterbox_internal"

type Organization struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Slug             string    `json:"slug"`
	PlanTier         string    `json:"plan_tier"`
	BillingTier      string    `json:"billing_tier"`
	RateLimitEPS     int       `json:"rate_limit_eps"`
	BurstCapacity    int       `json:"burst_capacity"`
	StripeCustomerID string    `json:"stripe_customer_id,omitempty"`
	BillingEmail     string    `json:"billing_email"`
	CreatedAt        time.Time `json:"created_at"`
}

type Environment struct {
	ID                 string    `json:"id"`
	OrgID              string    `json:"org_id"`
	Name               string    `json:"name"`
	Slug               string    `json:"slug"`
	Type               string    `json:"type"` // "production" | "sandbox"
	OpenMeterNamespace string    `json:"openmeter_namespace"`
	RateLimitRPS       int       `json:"rate_limit_rps"`
	RetentionDays      int       `json:"retention_days"`
	CreatedAt          time.Time `json:"created_at"`
}

type APIKey struct {
	ID                 string     `json:"id"`
	OrgID              string     `json:"org_id"`
	EnvID              string     `json:"env_id"`
	OpenMeterNamespace string     `json:"openmeter_namespace"`
	Name               string     `json:"name"`
	KeyPrefix          string     `json:"key_prefix"`
	KeyPreview         string     `json:"key_preview"`
	Prefix             string     `json:"prefix"`
	KeyHash            string     `json:"-"`
	RawKey             string     `json:"raw_key,omitempty"` // Only returned once on creation
	Scope              KeyScope   `json:"scope"`
	SubjectFilter      string     `json:"subject_filter,omitempty"`
	SubjectID          string     `json:"subject_id,omitempty"`
	RateLimitRPS       int        `json:"rate_limit_rps"`
	RateLimitEPS       int        `json:"rate_limit_eps"`
	LastUsedAt         *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt          *time.Time `json:"expires_at,omitempty"`
	RevokedAt          *time.Time `json:"revoked_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

type TenantContext struct {
	OrgID         string   `json:"org_id"`
	AllowedOrgIDs []string `json:"allowed_org_ids,omitempty"`
	EnvID         string   `json:"env_id"`
	EnvType       string   `json:"env_type"`
	Namespace     string   `json:"namespace"`
	Scope         KeyScope `json:"scope"`
	SubjectFilter string   `json:"subject_filter,omitempty"`
	RateLimitRPS  int      `json:"rate_limit_rps"`
}

type CloudEvent struct {
	SpecVersion string                 `json:"specversion"`
	ID          string                 `json:"id"`
	Source      string                 `json:"source"`
	Type        string                 `json:"type"`
	Subject     string                 `json:"subject"`
	Time        time.Time              `json:"time"`
	Data        map[string]interface{} `json:"data"`
	Namespace   string                 `json:"namespace,omitempty"`
	IngestedAt  time.Time              `json:"ingested_at,omitempty"`
	StoredAt    time.Time              `json:"stored_at,omitempty"`
	Lane        string                 `json:"lane,omitempty"` // "realtime" | "bulk"
}

type IngestResult struct {
	Accepted     int      `json:"accepted"`
	Deduplicated int      `json:"deduplicated"`
	RoutedLane   string   `json:"routed_lane"`
	DLQCount     int      `json:"dlq_count"`
	DLQEventIDs  []string `json:"dlq_event_ids,omitempty"`
	Namespace    string   `json:"namespace"`
}

type DLQEvent struct {
	ID                 string                 `json:"id"`
	OpenMeterNamespace string                 `json:"openmeter_namespace"`
	Namespace          string                 `json:"namespace"`
	EventID            string                 `json:"event_id"`
	RawPayload         map[string]interface{} `json:"raw_payload"`
	ErrorCode          string                 `json:"error_code"`
	ErrorReason        string                 `json:"error_reason"`
	FailureReason      string                 `json:"failure_reason"`
	Status             string                 `json:"status"` // "pending" | "replayed" | "discarded"
	FailedAt           time.Time              `json:"failed_at"`
	ReplayedAt         *time.Time             `json:"replayed_at,omitempty"`
}

type MeterAggregation string

const (
	AggregationCount       MeterAggregation = "COUNT"
	AggregationSum         MeterAggregation = "SUM"
	AggregationMax         MeterAggregation = "MAX"
	AggregationAvg         MeterAggregation = "AVG"
	AggregationUniqueCount MeterAggregation = "UNIQUE_COUNT"
)

type Meter struct {
	ID            string            `json:"id"`
	Namespace     string            `json:"namespace"`
	Slug          string            `json:"slug"`
	Name          string            `json:"name"`
	Description   string            `json:"description,omitempty"`
	Aggregation   MeterAggregation  `json:"aggregation"`
	EventType     string            `json:"event_type"`
	ValueProperty string            `json:"value_property,omitempty"` // e.g., "$.tokens"
	GroupBy       map[string]string `json:"group_by,omitempty"`       // e.g., {"model": "$.model"}
	WindowSize    string            `json:"window_size"`              // "MINUTE" | "HOUR" | "DAY"
	CreatedAt     time.Time         `json:"created_at"`
}

type MeterQueryRow struct {
	WindowStart time.Time         `json:"window_start"`
	WindowEnd   time.Time         `json:"window_end"`
	Subject     string            `json:"subject,omitempty"`
	GroupBy     map[string]string `json:"group_by,omitempty"`
	Groups      map[string]string `json:"groups,omitempty"`
	Value       float64           `json:"value"`
	EventCount  int               `json:"event_count"`
}

type MeterQueryResult struct {
	MeterSlug   string          `json:"meter_slug"`
	Namespace   string          `json:"namespace"`
	Aggregation string          `json:"aggregation"`
	WindowSize  string          `json:"window_size"`
	TotalValue  float64         `json:"total_value"`
	TotalEvents int             `json:"total_events"`
	Data        []MeterQueryRow `json:"data"`
	Series      []MeterQueryRow `json:"series"`
	QueryEngine string          `json:"query_engine"`
	ExecutionMs float64         `json:"execution_ms"`
}

type Subject struct {
	ID               string            `json:"id"`
	Namespace        string            `json:"namespace"`
	Key              string            `json:"key"`
	DisplayName      string            `json:"display_name"`
	Email            string            `json:"email,omitempty"`
	StripeCustomerID string            `json:"stripe_customer_id,omitempty"`
	PlanName         string            `json:"plan_name,omitempty"`
	CountryCode      string            `json:"country_code,omitempty"`
	CountryName      string            `json:"country_name,omitempty"`
	City             string            `json:"city,omitempty"`
	Region           string            `json:"region,omitempty"`
	Timezone         string            `json:"timezone,omitempty"`
	Browser          string            `json:"browser,omitempty"`
	OS               string            `json:"os,omitempty"`
	DeviceType       string            `json:"device_type,omitempty"`
	PageviewCount    int               `json:"pageview_count"`
	EventCount       int               `json:"event_count"`
	SessionCount     int               `json:"session_count"`
	TotalTokens      float64           `json:"total_tokens"`
	TotalCostUSD     float64           `json:"total_cost_usd"`
	LastPathname     string            `json:"last_pathname,omitempty"`
	FirstSeenAt      *time.Time        `json:"first_seen_at,omitempty"`
	LastSeenAt       *time.Time        `json:"last_seen_at,omitempty"`
	Metadata         map[string]string `json:"metadata,omitempty"`
	CreatedAt        time.Time         `json:"created_at"`
}

type Entitlement struct {
	ID              string            `json:"id"`
	Namespace       string            `json:"namespace"`
	SubjectKey      string            `json:"subject_key"`
	FeatureKey      string            `json:"feature_key"`
	FeatureName     string            `json:"feature_name"`
	Type            string            `json:"type"` // "metered" | "boolean" | "static"
	MeterSlug       string            `json:"meter_slug,omitempty"`
	IssueAfterReset float64           `json:"issue_after_reset"`
	Limit           float64           `json:"limit"`
	IsSoftLimit     bool              `json:"is_soft_limit"`
	SoftLimit       bool              `json:"soft_limit"`
	StaticConfig    map[string]string `json:"static_config,omitempty"`
	ResetPeriod     string            `json:"reset_period"`
	PeriodStart     time.Time         `json:"period_start"`
	CreatedAt       time.Time         `json:"created_at"`
}

type EntitlementGrant struct {
	ID              string     `json:"id"`
	Namespace       string     `json:"namespace"`
	EntitlementID   string     `json:"entitlement_id"`
	SubjectKey      string     `json:"subject_key"`
	FeatureKey      string     `json:"feature_key,omitempty"`
	Name            string     `json:"name"`
	Amount          float64    `json:"amount"`
	UsedBalance     float64    `json:"used_balance"`
	Remaining       float64    `json:"remaining"`
	Priority        int        `json:"priority"`
	RolloverEnabled bool       `json:"rollover_enabled"`
	EffectiveAt     time.Time  `json:"effective_at"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type GrantBurnDown struct {
	GrantID   string  `json:"grant_id"`
	GrantName string  `json:"grant_name"`
	Priority  int     `json:"priority"`
	Initial   float64 `json:"initial"`
	Used      float64 `json:"used"`
	Remaining float64 `json:"remaining"`
}

type EntitlementValue struct {
	Namespace      string            `json:"namespace"`
	SubjectKey     string            `json:"subject_key"`
	FeatureKey     string            `json:"feature_key"`
	Type           string            `json:"type"`
	HasAccess      bool              `json:"has_access"`
	Balance        float64           `json:"balance"`
	Remaining      float64           `json:"remaining"`
	UsageInPeriod  float64           `json:"usage_in_period"`
	Usage          float64           `json:"usage"`
	TotalGranted   float64           `json:"total_granted"`
	Limit          float64           `json:"limit"`
	CreditBalance  float64           `json:"credit_balance"`
	Overage        float64           `json:"overage"`
	IsSoftLimit    bool              `json:"is_soft_limit"`
	SoftLimit      bool              `json:"soft_limit"`
	StaticConfig   map[string]string `json:"static_config,omitempty"`
	GrantBreakdown []GrantBurnDown   `json:"grant_breakdown,omitempty"`
	CacheStatus    string            `json:"cache_status"` // "HIT" | "MISS"
	CacheSource    string            `json:"cache_source"`
	EvaluationUs   int64             `json:"evaluation_us"`
	LatencyUs      int64             `json:"latency_us"`
	EvaluatedAt    time.Time         `json:"evaluated_at"`
}

type RateCardTier struct {
	UpToAmount     *float64 `json:"up_to_amount,omitempty"` // nil = infinity
	UnitPriceCents float64  `json:"unit_price_cents"`
	FlatFeeCents   int      `json:"flat_fee_cents"`
}

type RateCard struct {
	FeatureKey       string         `json:"feature_key"`
	MeterSlug        string         `json:"meter_slug"`
	Name             string         `json:"name"`
	PricingModel     string         `json:"pricing_model"` // "graduated" | "flat_per_unit" | "package"
	IncludedQuantity float64        `json:"included_quantity"`
	PackageSize      float64        `json:"package_size"`
	Tiers            []RateCardTier `json:"tiers"`
}

type Plan struct {
	ID              string     `json:"id"`
	Namespace       string     `json:"namespace"`
	Slug            string     `json:"slug"`
	Name            string     `json:"name"`
	Description     string     `json:"description"`
	Currency        string     `json:"currency"`
	BasePriceCents  int        `json:"base_price_cents"`
	BaseFeeCents    int        `json:"base_fee_cents"`
	BillingCadence  string     `json:"billing_cadence"`
	IncludedCredits float64    `json:"included_credits"`
	RateCards       []RateCard `json:"rate_cards"`
	CreatedAt       time.Time  `json:"created_at"`
}

type Subscription struct {
	ID                   string    `json:"id"`
	Namespace            string    `json:"namespace"`
	SubjectKey           string    `json:"subject_key"`
	PlanSlug             string    `json:"plan_slug"`
	Status               string    `json:"status"`
	StripeSubscriptionID string    `json:"stripe_subscription_id,omitempty"`
	CurrentPeriodStart   time.Time `json:"current_period_start"`
	CurrentPeriodEnd     time.Time `json:"current_period_end"`
	CreatedAt            time.Time `json:"created_at"`
}

type InvoiceLineItem struct {
	Description    string  `json:"description"`
	MeterSlug      string  `json:"meter_slug,omitempty"`
	Quantity       float64 `json:"quantity"`
	IncludedUnits  float64 `json:"included_units"`
	BillableUnits  float64 `json:"billable_units"`
	UnitPriceCents float64 `json:"unit_price_cents"`
	AmountCents    int     `json:"amount_cents"`
}

type Invoice struct {
	ID                  string            `json:"id"`
	Namespace           string            `json:"namespace"`
	SubjectKey          string            `json:"subject_key"`
	PlanSlug            string            `json:"plan_slug"`
	Currency            string            `json:"currency"`
	SubtotalCents       int               `json:"subtotal_cents"`
	CreditsAppliedCents int               `json:"credits_applied_cents"`
	TaxCents            int               `json:"tax_cents"`
	TotalCents          int               `json:"total_cents"`
	Status              string            `json:"status"` // "draft" | "issued" | "synced_stripe" | "paid" | "payment_failed"
	StripeInvoiceID     string            `json:"stripe_invoice_id,omitempty"`
	PaymentIntentID     string            `json:"payment_intent_id,omitempty"`
	LineItems           []InvoiceLineItem `json:"line_items"`
	PeriodStart         time.Time         `json:"period_start"`
	PeriodEnd           time.Time         `json:"period_end"`
	IssuedAt            time.Time         `json:"issued_at"`
	PaidAt              *time.Time        `json:"paid_at,omitempty"`
	CreatedAt           time.Time         `json:"created_at"`
}

// ---------------------------------------------------------------------------
// Payment Provider Orchestration (Vaulted Cards, Top-Ups, Auto-Recharge, Webhooks)
// ---------------------------------------------------------------------------

// PaymentMethod stores a non-PCI provider token (`pm_...`) and display metadata
// for off-session invoice collection and automatic credit recharge.
type PaymentMethod struct {
	ID                      string    `json:"id"`
	Namespace               string    `json:"namespace"`
	SubjectKey              string    `json:"subject_key"`
	Provider                string    `json:"provider"`                   // "stripe" | "paystack" | "paddle"
	ProviderCustomerID      string    `json:"provider_customer_id"`       // e.g., "cus_stripe_appembly_01"
	ProviderPaymentMethodID string    `json:"provider_payment_method_id"` // e.g., "pm_1QxStripe4242"
	Brand                   string    `json:"brand"`                      // "visa" | "mastercard" | "amex"
	Last4                   string    `json:"last4"`                      // "4242"
	ExpMonth                int       `json:"exp_month"`
	ExpYear                 int       `json:"exp_year"`
	IsDefault               bool      `json:"is_default"`
	Status                  string    `json:"status"` // "active" | "detached" | "requires_action"
	CreatedAt               time.Time `json:"created_at"`
}

// AutoRechargeRule configures automatic off-session credit grant top-ups when a
// subject's metered entitlement balance drops below `ThresholdUnits`.
type AutoRechargeRule struct {
	ID                string     `json:"id"`
	Namespace         string     `json:"namespace"`
	SubjectKey        string     `json:"subject_key"`
	FeatureKey        string     `json:"feature_key"`
	Enabled           bool       `json:"enabled"`
	ThresholdUnits    float64    `json:"threshold_units"`
	RechargeUnits     float64    `json:"recharge_units"`
	ChargeAmountCents int        `json:"charge_amount_cents"`
	Currency          string     `json:"currency"`
	PaymentMethodID   string     `json:"payment_method_id,omitempty"`
	CooldownMinutes   int        `json:"cooldown_minutes"`
	LastTriggeredAt   *time.Time `json:"last_triggered_at,omitempty"`
	TotalTriggers     int        `json:"total_triggers"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// CheckoutSession tracks a hosted card-setup, one-time credit top-up, or
// off-session auto-recharge payment intent orchestrated with Stripe/Paystack.
type CheckoutSession struct {
	ID                string     `json:"id"`
	Namespace         string     `json:"namespace"`
	SubjectKey        string     `json:"subject_key"`
	Provider          string     `json:"provider"` // "stripe" | "paystack"
	ProviderSessionID string     `json:"provider_session_id"`
	Mode              string     `json:"mode"` // "setup" | "topup" | "auto_recharge" | "invoice_collection"
	FeatureKey        string     `json:"feature_key,omitempty"`
	GrantUnits        float64    `json:"grant_units,omitempty"`
	AmountCents       int        `json:"amount_cents"`
	Currency          string     `json:"currency"`
	CheckoutURL       string     `json:"checkout_url"`
	Status            string     `json:"status"` // "open" | "succeeded" | "failed"
	PaymentIntentID   string     `json:"payment_intent_id,omitempty"`
	GrantID           string     `json:"grant_id,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
}

// PaymentWebhookEvent records inbound provider webhooks (`payment_intent.succeeded`,
// `invoice.paid`, `invoice.payment_failed`, `setup_intent.succeeded`) and the ledger action taken.
type PaymentWebhookEvent struct {
	ID                string    `json:"id"`
	Namespace         string    `json:"namespace"`
	Provider          string    `json:"provider"`
	EventID           string    `json:"event_id"`
	EventType         string    `json:"event_type"`
	SubjectKey        string    `json:"subject_key"`
	ObjectID          string    `json:"object_id"`
	AmountCents       int       `json:"amount_cents"`
	Currency          string    `json:"currency"`
	Status            string    `json:"status"` // "processed" | "ignored" | "failed"
	ActionTaken       string    `json:"action_taken"`
	SignatureVerified bool      `json:"signature_verified"`
	ReceivedAt        time.Time `json:"received_at"`
}

type TelemetrySnapshot struct {
	OrgID                  string             `json:"org_id"`
	OrgName                string             `json:"org_name"`
	ActiveNamespace        string             `json:"active_namespace"`
	TotalEventsIngested    int                `json:"total_events_ingested"`
	IngestedEvents         int                `json:"ingested_events"`
	RealtimeLaneEvents     int                `json:"realtime_lane_events"`
	BulkLaneEvents         int                `json:"bulk_lane_events"`
	DeduplicatedDropped    int                `json:"deduplicated_dropped"`
	DeduplicatedHits       int                `json:"deduplicated_hits"`
	PendingDLQEvents       int                `json:"pending_dlq_events"`
	DLQPendingCount        int                `json:"dlq_pending_count"`
	ActiveMeters           int                `json:"active_meters"`
	ActiveSubjects         int                `json:"active_subjects"`
	ActiveEntitlements     int                `json:"active_entitlements"`
	EntitlementChecks      int64              `json:"entitlement_checks"`
	AvgCheckLatencyUs      int64              `json:"avg_check_latency_us"`
	EdgeCacheHits          int64              `json:"edge_cache_hits"`
	EdgeCacheMisses        int64              `json:"edge_cache_misses"`
	EdgeCacheHitRatioPct   float64            `json:"edge_cache_hit_ratio_pct"`
	CacheHitRatio          float64            `json:"cache_hit_ratio"`
	DogfoodOrgEventsBilled float64            `json:"dogfood_org_events_billed"`
	DogfoodEstimatedCents  int                `json:"dogfood_estimated_cents"`
	DogfoodSelfBilling     map[string]float64 `json:"dogfood_self_billing"`
	RecentEvents           []CloudEvent       `json:"recent_events"`
	ClickHouseConnected    bool               `json:"clickhouse_connected"`
	RedpandaConnected      bool               `json:"redpanda_connected"`
	RedisConnected         bool               `json:"redis_connected"`
}

// ---------------------------------------------------------------------------
// Real-Time AI Cost Intelligence & Token Economics Report
// ---------------------------------------------------------------------------

type DimensionCostBreakdown struct {
	Dimension  string  `json:"dimension"`
	Tokens     float64 `json:"tokens"`
	SharePct   float64 `json:"share_pct"`
	CostUSD    float64 `json:"cost_usd"`
	RevenueUSD float64 `json:"revenue_usd"`
	MarginPct  float64 `json:"margin_pct"`
	EventCount int     `json:"event_count"`
}

type SubjectMarginBreakdown struct {
	SubjectKey  string  `json:"subject_key"`
	DisplayName string  `json:"display_name"`
	Tokens      float64 `json:"tokens"`
	CostUSD     float64 `json:"cost_usd"`
	RevenueUSD  float64 `json:"revenue_usd"`
	MarginPct   float64 `json:"margin_pct"`
	Status      string  `json:"status"`
}

type CostIntelligenceReport struct {
	Namespace       string                   `json:"namespace"`
	TotalTokens     float64                  `json:"total_tokens"`
	InputTokens     float64                  `json:"input_tokens"`
	CachedTokens    float64                  `json:"cached_tokens"`
	ReasoningTokens float64                  `json:"reasoning_tokens"`
	OutputTokens    float64                  `json:"output_tokens"`
	TotalCostUSD    float64                  `json:"total_cost_usd"`
	TotalBilledUSD  float64                  `json:"total_billed_usd"`
	GrossMarginPct  float64                  `json:"gross_margin_pct"`
	CacheSavingsUSD float64                  `json:"cache_savings_usd"`
	ByModel         []DimensionCostBreakdown `json:"by_model"`
	ByTool          []DimensionCostBreakdown `json:"by_tool"`
	ByPersona       []DimensionCostBreakdown `json:"by_persona"`
	BySubject       []SubjectMarginBreakdown `json:"by_subject"`
}

// ---------------------------------------------------------------------------
// PostHog Product Analytics & User Profile Telemetry Report
// ---------------------------------------------------------------------------

type LocationBreakdown struct {
	CountryCode string  `json:"country_code"`
	CountryName string  `json:"country_name"`
	City        string  `json:"city"`
	Users       int     `json:"users"`
	Events      int     `json:"events"`
	Pageviews   int     `json:"pageviews"`
	Tokens      float64 `json:"tokens"`
	SharePct    float64 `json:"share_pct"`
}

type PageviewBreakdown struct {
	Pathname string `json:"pathname"`
	Views    int    `json:"views"`
	Users    int    `json:"users"`
}

type EventTypeBreakdown struct {
	EventType string  `json:"event_type"`
	Count     int     `json:"count"`
	Users     int     `json:"users"`
	SharePct  float64 `json:"share_pct"`
}

type DeviceBreakdown struct {
	Label    string  `json:"label"`
	Users    int     `json:"users"`
	SharePct float64 `json:"share_pct"`
}

type ProductAnalyticsReport struct {
	Namespace          string               `json:"namespace"`
	TotalUsers         int                  `json:"total_users"`
	ActiveUsers24h     int                  `json:"active_users_24h"`
	TotalPageviews     int                  `json:"total_pageviews"`
	TotalProductEvents int                  `json:"total_product_events"`
	TotalSessions      int                  `json:"total_sessions"`
	UniqueCountries    int                  `json:"unique_countries"`
	Locations          []LocationBreakdown  `json:"locations"`
	TopPages           []PageviewBreakdown  `json:"top_pages"`
	EventBreakdown     []EventTypeBreakdown `json:"event_breakdown"`
	Devices            []DeviceBreakdown    `json:"devices"`
}

// ---------------------------------------------------------------------------
// Consolidated Namespace Snapshot (`/api/control/v1/snapshot`)
// ---------------------------------------------------------------------------

type NamespaceSnapshot struct {
	Namespace         string                 `json:"namespace"`
	Organizations     []Organization         `json:"organizations"`
	Environments      []Environment          `json:"environments"`
	Telemetry         TelemetrySnapshot      `json:"telemetry"`
	Meters            []Meter                `json:"meters"`
	Subjects          []Subject              `json:"subjects"`
	APIKeys           []APIKey               `json:"api_keys"`
	Entitlements      []Entitlement          `json:"entitlements"`
	Grants            []EntitlementGrant     `json:"grants"`
	DLQEvents         []DLQEvent             `json:"dlq_events"`
	Plans             []Plan                 `json:"plans"`
	Subscriptions     []Subscription         `json:"subscriptions"`
	Invoices          []Invoice              `json:"invoices"`
	PaymentMethods    []PaymentMethod        `json:"payment_methods"`
	AutoRechargeRules []AutoRechargeRule     `json:"auto_recharge_rules"`
	CheckoutSessions  []CheckoutSession      `json:"checkout_sessions"`
	PaymentWebhooks   []PaymentWebhookEvent  `json:"payment_webhooks"`
	RecentEvents      []CloudEvent           `json:"recent_events"`
	CostIntelligence  CostIntelligenceReport `json:"cost_intelligence"`
	ProductAnalytics  ProductAnalyticsReport `json:"product_analytics"`
}
