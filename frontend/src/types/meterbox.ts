export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6071";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  billing_tier: string;
  rate_limit_eps: number;
  burst_capacity: number;
  created_at: string;
}

export interface Environment {
  id: string;
  org_id: string;
  slug: string;
  type: "production" | "sandbox";
  openmeter_namespace: string;
  created_at: string;
}

export interface Meter {
  id: string;
  namespace: string;
  slug: string;
  name: string;
  aggregation: "SUM" | "COUNT" | "AVG" | "UNIQUE_COUNT" | "MAX";
  event_type: string;
  value_property: string;
  group_by: Record<string, string>;
  window_size: string;
  created_at: string;
}

export interface Subject {
  id: string;
  namespace: string;
  key: string;
  display_name: string;
  email?: string;
  stripe_customer_id?: string;
  plan_name?: string;
  country_code?: string;
  country_name?: string;
  city?: string;
  region?: string;
  timezone?: string;
  browser?: string;
  os?: string;
  device_type?: string;
  pageview_count?: number;
  event_count?: number;
  session_count?: number;
  total_tokens?: number;
  total_cost_usd?: number;
  last_pathname?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  metadata?: Record<string, string>;
  created_at: string;
}

export interface APIKey {
  id: string;
  org_id: string;
  env_id: string;
  name: string;
  scope: "ingest" | "entitlement" | "admin" | "portal";
  prefix: string;
  subject_id?: string;
  rate_limit_eps: number;
  created_at: string;
}

export interface Entitlement {
  id: string;
  namespace: string;
  subject_key: string;
  feature_key: string;
  type: "metered" | "static" | "boolean";
  meter_slug: string;
  limit: number;
  soft_limit: boolean;
  reset_period: string;
}

export interface CreditGrant {
  id: string;
  entitlement_id: string;
  subject_key: string;
  feature_key?: string;
  name: string;
  amount: number;
  used_balance?: number;
  remaining: number;
  priority: number;
  expires_at: string;
}

export interface EntitlementCheck {
  has_access: boolean;
  subject_key: string;
  feature_key: string;
  limit: number;
  usage: number;
  credit_balance: number;
  remaining: number;
  soft_limit: boolean;
  cache_source: string;
  latency_us: number;
  evaluated_at: string;
}

export interface DLQEvent {
  id: string;
  org_id: string;
  env_id: string;
  namespace: string;
  raw_payload: string;
  failure_reason: string;
  error_code: string;
  status: "pending" | "replayed" | "discarded";
  failed_at: string;
}

export interface Plan {
  id: string;
  namespace: string;
  slug: string;
  name: string;
  currency: string;
  base_fee_cents: number;
  billing_cadence: string;
  components: {
    id: string;
    name: string;
    meter_slug: string;
    model: "flat_per_unit" | "graduated" | "volume";
    unit_price_cents: number;
    included_units: number;
  }[];
}

export interface Subscription {
  id: string;
  namespace: string;
  subject_key: string;
  plan_slug: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  namespace: string;
  subject_key: string;
  plan_slug: string;
  currency: string;
  subtotal_cents: number;
  credits_applied_cents: number;
  total_cents: number;
  status: string;
  stripe_invoice_id: string;
  payment_intent_id?: string;
  line_items: {
    description: string;
    meter_slug?: string;
    quantity: number;
    unit_price_cents: number;
    amount_cents: number;
  }[];
  period_start: string;
  period_end: string;
  issued_at: string;
  paid_at?: string;
}

export interface PaymentMethod {
  id: string;
  namespace: string;
  subject_key: string;
  provider: string;
  provider_customer_id: string;
  provider_payment_method_id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  status: string;
  created_at: string;
}

export interface AutoRechargeRule {
  id: string;
  namespace: string;
  subject_key: string;
  feature_key: string;
  enabled: boolean;
  threshold_units: number;
  recharge_units: number;
  charge_amount_cents: number;
  currency: string;
  payment_method_id?: string;
  cooldown_minutes: number;
  last_triggered_at?: string;
  total_triggers: number;
  updated_at: string;
}

export interface CheckoutSession {
  id: string;
  namespace: string;
  subject_key: string;
  provider: string;
  provider_session_id: string;
  mode: string;
  feature_key?: string;
  grant_units?: number;
  amount_cents: number;
  currency: string;
  checkout_url: string;
  status: string;
  payment_intent_id?: string;
  grant_id?: string;
  created_at: string;
  completed_at?: string;
}

export interface PaymentWebhookEvent {
  id: string;
  namespace: string;
  provider: string;
  event_id: string;
  event_type: string;
  subject_key: string;
  object_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  action_taken: string;
  signature_verified: boolean;
  received_at: string;
}

export interface CloudEventRecord {
  id: string;
  type: string;
  subject: string;
  namespace: string;
  source?: string;
  lane?: string;
  time: string;
  data: Record<string, unknown>;
}

export interface Telemetry {
  org_id: string;
  org_name: string;
  active_namespace: string;
  ingested_events: number;
  deduplicated_hits: number;
  realtime_lane_events: number;
  bulk_lane_events: number;
  dlq_pending_count: number;
  entitlement_checks: number;
  avg_check_latency_us: number;
  cache_hit_ratio: number;
  recent_events: CloudEventRecord[];
  dogfood_self_billing: Record<string, number>;
}

export interface MeterQueryResult {
  meter_slug: string;
  namespace: string;
  aggregation: string;
  window_size?: string;
  total_value: number;
  series: {
    window_start: string;
    window_end: string;
    subject: string;
    value: number;
    groups?: Record<string, string>;
  }[];
}

export interface IngestResult {
  event_id: string;
  namespace: string;
  topic: string;
  lane: string;
  deduplicated: boolean;
  dlq_routed: boolean;
  dlq_reason?: string;
  processed_at: string;
}

export interface PortalSummary {
  namespace: string;
  subject: string;
  meters: Meter[];
  entitlements: EntitlementCheck[];
  invoices: Invoice[];
}

export interface DimensionCostBreakdown {
  dimension: string;
  tokens: number;
  share_pct: number;
  cost_usd: number;
  revenue_usd?: number;
  margin_pct?: number;
  event_count: number;
}

export interface SubjectMarginBreakdown {
  subject_key: string;
  display_name: string;
  tokens: number;
  cost_usd: number;
  revenue_usd: number;
  margin_pct: number;
  status: string;
}

export interface CostIntelligenceReport {
  namespace: string;
  total_tokens: number;
  input_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  output_tokens: number;
  total_cost_usd: number;
  total_billed_usd: number;
  gross_margin_pct: number;
  cache_savings_usd: number;
  by_model: DimensionCostBreakdown[];
  by_tool: DimensionCostBreakdown[];
  by_persona: DimensionCostBreakdown[];
  by_subject: SubjectMarginBreakdown[];
}

export interface LocationBreakdown {
  country_code: string;
  country_name: string;
  city: string;
  users: number;
  events: number;
  pageviews: number;
  tokens: number;
  share_pct: number;
}

export interface PageviewBreakdown {
  pathname: string;
  views: number;
  users: number;
}

export interface EventTypeBreakdown {
  event_type: string;
  count: number;
  users: number;
  share_pct: number;
}

export interface DeviceBreakdown {
  label: string;
  users: number;
  share_pct: number;
}

export interface ProductAnalyticsReport {
  namespace: string;
  total_users: number;
  active_users_24h: number;
  total_pageviews: number;
  total_product_events: number;
  total_sessions: number;
  unique_countries: number;
  locations: LocationBreakdown[];
  top_pages: PageviewBreakdown[];
  event_breakdown: EventTypeBreakdown[];
  devices: DeviceBreakdown[];
}

export interface ToastItem {
  id: string;
  title: string;
  detail?: string;
  kind?: "ok" | "warn" | "err";
}

export type DrawerKind =
  | null
  | "tenant"
  | "meter"
  | "customer"
  | "entitlement"
  | "grant"
  | "plan"
  | "apikey"
  | "invoice";

export interface DocChapter {
  id: string;
  num: string;
  title: string;
  tag: string;
  summary: string;
  flow: string[];
  formula?: { math: string; caption: string };
  sections: { num: string; heading: string; body: string }[];
  callout: { kind: "tip" | "warn"; text: string };
  table: { headers: string[]; rows: string[][] };
  codeTabs: {
    label: string;
    badge: "src" | "use";
    file: string;
    code: string;
    caption: string;
  }[];
}

export const DOC_CHAPTERS: DocChapter[] = [
  {
    id: "doc-tenancy",
    num: "01",
    title: "Multi-Tenancy & Scoped Auth",
    tag: "Control Plane",
    summary:
      "How Meterbox layers Organizations, isolated Environments (production vs. sandbox), and 4-tier scoped API keys on top of OpenMeter OSS namespaces.",
    flow: [
      "Bearer mb_ing_*",
      "SHA-256 Digest Lookup",
      "Resolve (org_id, env_id)",
      "Inject OpenMeter Namespace",
      "PostgreSQL RLS Context",
    ],
    sections: [
      {
        num: "1.1",
        heading: "1:1 Environment-to-Namespace Mapping",
        body: "OpenMeter OSS uses a flat namespace string to isolate meters and events. Meterbox maps every Organization Environment (e.g., Production or Sandbox) 1:1 to a deterministic OpenMeter namespace (ns_{org}_{env}). Clients never pass a namespace header—the Edge Gateway resolves it cryptographically from the Bearer token and overwrites the internal request context.",
      },
      {
        num: "1.2",
        heading: "Four-Tier Scoped API Keys",
        body: "Instead of a single root key, Meterbox issues four distinct key prefixes: mb_ing_ (write-only CloudEvents & PostHog ingestion), mb_ent_ (low-latency quota evaluation), mb_sk_ (control plane & billing administration), and mb_portal_ (customer-locked read-only portal access).",
      },
    ],
    callout: {
      kind: "tip",
      text: "PostgreSQL Row-Level Security (RLS) policies enforce current_setting('app.current_org_id') on every control-plane table so tenant metadata cannot leak across organizations.",
    },
    table: {
      headers: ["Key Prefix", "Scope", "Permitted Operations", "Tenant Lock"],
      rows: [
        ["mb_ing_*", "ingest", "POST /api/v1/events & /api/v1/posthog/*", "Org + Environment"],
        ["mb_ent_*", "entitlement", "GET /api/v1/subjects/{sub}/entitlements/{feat}/value", "Org + Environment"],
        ["mb_sk_*", "admin", "Meters, Plans, Grants, DLQ Replay, Invoices", "Org + Environment"],
        ["mb_portal_*", "portal", "GET /api/portal/v1/summary", "Org + Env + Subject Key"],
      ],
    },
    codeTabs: [
      {
        label: "API Key Generator",
        badge: "src",
        file: "backend/internal/auth/apikey.go",
        code: `func GenerateScopedKey(scope models.KeyScope, envType string) (rawKey, prefix, preview, hash string, err error) {
    buf := make([]byte, 16)
    if _, err := rand.Read(buf); err != nil {
        return "", "", "", "", err
    }
    secretPart := hex.EncodeToString(buf)
    rawKey = prefix + secretPart
    hash = HashKey(rawKey)
    return rawKey, prefix, preview, hash, nil
}`,
        caption: "Plaintext secrets are returned once upon creation; only the SHA-256 digest is persisted.",
      },
      {
        label: "Postgres RLS Policy",
        badge: "src",
        file: "infra/postgres/init-db.sql",
        code: `ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlq_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_environments ON environments
    USING (org_id::text = current_setting('app.current_org_id', true));`,
        caption: "Database-level isolation guarantees tenant boundary enforcement on all control-plane queries.",
      },
    ],
  },
  {
    id: "doc-ingest",
    num: "02",
    title: "Ingestion, Dedup & Lanes",
    tag: "Edge Gateway",
    summary:
      "Synchronous Redis SETNX idempotency, token-bucket noisy-neighbor routing (realtime vs. bulk Redpanda topics), and Dead-Letter Queue (DLQ) capture.",
    flow: [
      "CloudEvents v1.0 POST",
      "Schema Validation",
      "Redis SETNX Dedup (24h)",
      "Token-Bucket Rate Check",
      "Redpanda Topic Routing",
    ],
    formula: {
      math: "Topic(e) = om_events_realtime (if tokens >= 1)  |  om_events_bulk (if burst exceeded)",
      caption: "Noisy-neighbor isolation spills high-volume historical backfills to the bulk topic instead of dropping events or delaying real-time tenants.",
    },
    sections: [
      {
        num: "2.1",
        heading: "Synchronous Idempotency at the Edge",
        body: "Every CloudEvent carries a unique id per source. Before publishing to Redpanda, the Edge Gateway checks key dedup:{namespace}:{source}:{id}. Retried network requests return HTTP 202 Accepted with deduplicated: 1 and never double-count usage.",
      },
      {
        num: "2.2",
        heading: "Zero-Drop Dead-Letter Queue (DLQ) & Replay",
        body: "Events that fail CloudEvents validation or numeric meter property checks are captured in the tenant's DLQ instead of being silently discarded. Operators can edit the raw JSON payload and replay it directly back through the ingestion pipeline.",
      },
    ],
    callout: {
      kind: "warn",
      text: "Every accepted event also emits a dogfooding telemetry event into ns_meterbox_internal (meter: meterbox_ingested_events) so Meterbox bills tenants using its own metering engine.",
    },
    table: {
      headers: ["Kafka / Redpanda Topic", "Purpose", "Consumer SLA", "Routing Trigger"],
      rows: [
        ["om_events_realtime", "Interactive customer traffic", "< 50ms end-to-end", "Within tenant token-bucket burst"],
        ["om_events_bulk", "Batch backfills & noisy neighbors", "Async throughput optimized", "Exceeds tenant EPS burst threshold"],
        ["om_events_dlq", "Malformed or unmapped events", "Operator inspection & replay", "Schema / meter lookup failure"],
      ],
    },
    codeTabs: [
      {
        label: "Ingestion Pipeline",
        badge: "src",
        file: "backend/internal/ingest/pipeline.go",
        code: `// 1. Synchronous Redis Deduplication (SETNX dedup:{namespace}:{source}:{id})
if p.store.CheckAndMarkDedup(tc.Namespace, evSource, evID) {
    deduplicated++
    continue
}

// 2. Token-Bucket Rate Limit & Lane Selection (realtime vs bulk)
lane := p.store.SelectIngestionLane(tc.Namespace, tc.RateLimitRPS, requestedLane)
candidate.Lane = lane`,
        caption: "Edge pipeline in backend/internal/ingest/pipeline.go.",
      },
    ],
  },
  {
    id: "doc-clickhouse",
    num: "03",
    title: "ClickHouse OLAP Schema",
    tag: "Storage Engine",
    summary:
      "Multi-tenant ClickHouse MergeTree partitioning with namespace as the primary sorting key prefix and dynamic 1m / 5m / 1h / 1d window rollups.",
    flow: [
      "Redpanda Consumer",
      "om_events_raw (MergeTree)",
      "Materialized View Trigger",
      "om_meter_rollups_1m",
      "Sub-10ms OLAP Query",
    ],
    sections: [
      {
        num: "3.1",
        heading: "Why namespace Leads the Sorting Key",
        body: "Instead of creating separate ClickHouse tables per customer—which causes ZooKeeper/ClickHouseKeeper metadata explosion beyond a few hundred tenants—Meterbox stores all tenants in shared tables ordered by (namespace, type, subject, toStartOfHour(time), id). Every tenant query prunes 99.9% of granules at the primary index level.",
      },
      {
        num: "3.2",
        heading: "Dynamic Multi-Granularity Rollups (1m / 5m / 1h / 1d)",
        body: "ClickHouse Materialized Views continuously aggregate sumState, countState, avgState, maxState, and uniqState into 1-minute windows, while the query engine supports on-demand ?window=1m|5m|1h|1d bucketing.",
      },
    ],
    callout: {
      kind: "tip",
      text: "Monthly partitioning (PARTITION BY toYYYYMM(time)) combined with namespace-prefixed ORDER BY enables instant tenant data retention policies and zero-downtime partition drops.",
    },
    table: {
      headers: ["Table / View", "Engine", "Partition Key", "Primary Sort Key (ORDER BY)"],
      rows: [
        ["om_events_raw", "MergeTree()", "toYYYYMM(time)", "(namespace, type, subject, toStartOfHour(time), id)"],
        ["om_meter_rollups_1m", "AggregatingMergeTree()", "toYYYYMM(window_start)", "(namespace, event_type, subject, window_start)"],
        ["om_meter_rollups_1m_mv", "Materialized View", "N/A (Stream Trigger)", "Populates om_meter_rollups_1m on insert"],
      ],
    },
    codeTabs: [
      {
        label: "ClickHouse DDL",
        badge: "src",
        file: "infra/clickhouse/init-db.sql",
        code: `CREATE TABLE IF NOT EXISTS meterbox.om_events_raw (
    namespace LowCardinality(String),
    id String,
    type LowCardinality(String),
    subject String,
    time DateTime64(3, 'UTC'),
    numeric_value Float64 DEFAULT 0,
    properties Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(time)
ORDER BY (namespace, type, subject, toStartOfHour(time), id);`,
        caption: "Multi-tenant ClickHouse table schema with LowCardinality(String) namespace prefixing.",
      },
    ],
  },
  {
    id: "doc-entitlements",
    num: "04",
    title: "Sub-5ms Quotas & Billing",
    tag: "Monetization Layer",
    summary:
      "Write-through cached entitlement balance evaluations, priority-ordered prepaid credit grant burndown, and hybrid subscription + usage invoice generation.",
    flow: [
      "GET /entitlements/{feature}/value",
      "Edge Balance Cache Lookup",
      "Priority Credit Grant Ledger",
      "Evaluate Remaining Quota",
      "Invoice Credit Deduction",
    ],
    formula: {
      math: "Remaining(subject, feature) = max(0, sum(ActivePriorityGrants) - MeterUsage)",
      caption: "Real-time quota evaluation burns down priority-ordered credit grants and deducts promotional credits on invoice generation.",
    },
    sections: [
      {
        num: "4.1",
        heading: "Edge-Cached Quota Checks",
        body: "Applications call the entitlement endpoint on the critical request path (e.g., before executing an LLM completion). Meterbox serves cached balances in microseconds and invalidates the cache synchronously whenever an event is ingested for that subject.",
      },
      {
        num: "4.2",
        heading: "Hybrid Plans & Prepaid Credit Burndown",
        body: "Plans combine a fixed base fee with metered overage components (flat per-unit, graduated, or volume tiers) and included unit allowances. When generating an invoice, Meterbox automatically applies priority credit grant offsets before charging overage to Stripe.",
      },
    ],
    callout: {
      kind: "tip",
      text: "Soft-limit entitlements return has_access: true even when remaining balance reaches 0, enabling overage billing alerts without hard-blocking production customer traffic.",
    },
    table: {
      headers: ["Entitlement Type", "Access Logic", "Credit Grant Support", "Typical Use Case"],
      rows: [
        ["metered (hard limit)", "remaining > 0", "Yes (priority burndown)", "Free tier API call caps"],
        ["metered (soft limit)", "Always true (tracks overage)", "Yes (offsets invoice)", "Production pay-as-you-go AI tokens"],
        ["static / boolean", "Feature flag / config limit", "No", "SSO enabled, max seat count"],
      ],
    },
    codeTabs: [
      {
        label: "Entitlement Evaluator",
        badge: "src",
        file: "backend/internal/entitlement/engine.go",
        code: `balance := totalGranted - usage
overage := 0.0
if balance < 0 {
    overage = -balance
}
hasAccess := balance > 0 || ent.IsSoftLimit`,
        caption: "Real-time entitlement decision engine with soft-limit and priority credit-grant waterfall.",
      },
    ],
  },
  {
    id: "doc-posthog",
    num: "05",
    title: "PostHog & 360° User Profiles",
    tag: "Product + FinOps",
    summary:
      "Native PostHog capture/batch ingestion bridge that unifies product analytics ($pageview, $identify, sessions, GeoIP locations, device traits) with AI token spend per user.",
    flow: [
      "POST /api/v1/posthog/capture",
      "Extract Distinct ID & GeoIP",
      "Hydrate 360° Subject Profile",
      "Emit OpenMeter CloudEvent",
      "Correlate Usage & AI Spend",
    ],
    sections: [
      {
        num: "5.1",
        heading: "Unified Product Telemetry & FinOps Attribution",
        body: "PostHog SDKs and webhooks can point directly at /api/v1/posthog/capture or /api/v1/posthog/batch using any mb_ing_* key. Meterbox translates $pageview, $identify, and custom product events into canonical CloudEvents while enriching the Subject profile with GeoIP country/city, timezone, browser/OS, session count, and last visited route.",
      },
      {
        num: "5.2",
        heading: "Unit Economics per User Location & Cohort",
        body: "Because PostHog distinct_id maps 1:1 to an OpenMeter Subject key, operators can inspect any user or workstation profile to see both their product engagement (pageviews, sessions, feature clicks) and their exact AI model token burn and gross margin in one unified view.",
      },
    ],
    callout: {
      kind: "tip",
      text: "Use the same distinct_id / subject key across PostHog frontend tracking and backend AI step telemetry to get automatic 360° user profitability profiles.",
    },
    table: {
      headers: ["PostHog Property", "Subject Profile Field", "Metering & Analytics Usage"],
      rows: [
        ["distinct_id", "subject.key", "Primary join key across product events, quotas, and AI cost"],
        ["$geoip_country_code / $geoip_city_name", "country_code / city", "Geographic user & token distribution breakdown"],
        ["$browser / $os / $device_type", "browser / os / device_type", "Client environment & platform cohort matrix"],
        ["$pathname / $session_id", "last_pathname / session_count", "Top pages funnel & active session tracking"],
      ],
    },
    codeTabs: [
      {
        label: "PostHog Capture Bridge",
        badge: "src",
        file: "backend/internal/ingest/pipeline.go",
        code: `func (p *Pipeline) IngestPostHogBatch(tc *models.TenantContext, rawEvents []map[string]interface{}) models.IngestResult {
    // Maps PostHog {event, distinct_id, properties} -> CloudEvent
    // Hydrates Subject GeoIP, Browser/OS, Pageviews, Sessions & Token Spend
    return p.IngestBatch(tc, cloudEvents, "realtime")
}`,
        caption: "Zero-config PostHog event bridge in backend/internal/ingest/pipeline.go.",
      },
    ],
  },
];
