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
	KeyHash            string     `json:"-"`
	RawKey             string     `json:"raw_key,omitempty"` // Only returned once on creation
	Scope              KeyScope   `json:"scope"`
	SubjectFilter      string     `json:"subject_filter,omitempty"`
	RateLimitRPS       int        `json:"rate_limit_rps"`
	LastUsedAt         *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt          *time.Time `json:"expires_at,omitempty"`
	RevokedAt          *time.Time `json:"revoked_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

type TenantContext struct {
	OrgID         string   `json:"org_id"`
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
	EventID            string                 `json:"event_id"`
	RawPayload         map[string]interface{} `json:"raw_payload"`
	ErrorCode          string                 `json:"error_code"`
	ErrorReason        string                 `json:"error_reason"`
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
	Value       float64           `json:"value"`
	EventCount  int               `json:"event_count"`
}

type MeterQueryResult struct {
	MeterSlug   string          `json:"meter_slug"`
	Namespace   string          `json:"namespace"`
	Aggregation string          `json:"aggregation"`
	TotalValue  float64         `json:"total_value"`
	TotalEvents int             `json:"total_events"`
	Data        []MeterQueryRow `json:"data"`
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
	IsSoftLimit     bool              `json:"is_soft_limit"`
	StaticConfig    map[string]string `json:"static_config,omitempty"`
	ResetPeriod     string            `json:"reset_period"`
	PeriodStart     time.Time         `json:"period_start"`
	CreatedAt       time.Time         `json:"created_at"`
}

type EntitlementGrant struct {
	ID              string     `json:"id"`
	Namespace       string     `json:"namespace"`
	EntitlementID   string     `json:"entitlement_id"`
	Name            string     `json:"name"`
	Amount          float64    `json:"amount"`
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
	UsageInPeriod  float64           `json:"usage_in_period"`
	TotalGranted   float64           `json:"total_granted"`
	Overage        float64           `json:"overage"`
	IsSoftLimit    bool              `json:"is_soft_limit"`
	StaticConfig   map[string]string `json:"static_config,omitempty"`
	GrantBreakdown []GrantBurnDown   `json:"grant_breakdown,omitempty"`
	CacheStatus    string            `json:"cache_status"` // "HIT" | "MISS"
	EvaluationUs   int64             `json:"evaluation_us"`
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
	Description   string  `json:"description"`
	MeterSlug     string  `json:"meter_slug,omitempty"`
	Quantity      float64 `json:"quantity"`
	IncludedUnits float64 `json:"included_units"`
	BillableUnits float64 `json:"billable_units"`
	AmountCents   int     `json:"amount_cents"`
}

type Invoice struct {
	ID              string            `json:"id"`
	Namespace       string            `json:"namespace"`
	SubjectKey      string            `json:"subject_key"`
	PlanSlug        string            `json:"plan_slug"`
	Currency        string            `json:"currency"`
	SubtotalCents   int               `json:"subtotal_cents"`
	TaxCents        int               `json:"tax_cents"`
	TotalCents      int               `json:"total_cents"`
	Status          string            `json:"status"` // "draft" | "issued" | "synced_stripe"
	StripeInvoiceID string            `json:"stripe_invoice_id,omitempty"`
	LineItems       []InvoiceLineItem `json:"line_items"`
	PeriodStart     time.Time         `json:"period_start"`
	PeriodEnd       time.Time         `json:"period_end"`
	CreatedAt       time.Time         `json:"created_at"`
}

type TelemetrySnapshot struct {
	ActiveNamespace       string  `json:"active_namespace"`
	TotalEventsIngested   int     `json:"total_events_ingested"`
	RealtimeLaneEvents    int     `json:"realtime_lane_events"`
	BulkLaneEvents        int     `json:"bulk_lane_events"`
	DeduplicatedDropped   int     `json:"deduplicated_dropped"`
	PendingDLQEvents      int     `json:"pending_dlq_events"`
	ActiveMeters          int     `json:"active_meters"`
	ActiveSubjects        int     `json:"active_subjects"`
	ActiveEntitlements    int     `json:"active_entitlements"`
	EdgeCacheHits         int64   `json:"edge_cache_hits"`
	EdgeCacheMisses       int64   `json:"edge_cache_misses"`
	EdgeCacheHitRatioPct  float64 `json:"edge_cache_hit_ratio_pct"`
	DogfoodOrgEventsBilled float64 `json:"dogfood_org_events_billed"`
	DogfoodEstimatedCents int     `json:"dogfood_estimated_cents"`
	ClickHouseConnected   bool    `json:"clickhouse_connected"`
	RedpandaConnected     bool    `json:"redpanda_connected"`
	RedisConnected        bool    `json:"redis_connected"`
}
