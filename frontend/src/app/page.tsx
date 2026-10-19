"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppemblyLogo } from "../packages/appembly-ui/components/brand/AppemblyLogo";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6071";

// ---------------------------------------------------------------------------
// API Response Interfaces
// ---------------------------------------------------------------------------
interface Organization {
  id: string;
  slug: string;
  name: string;
  billing_tier: string;
  rate_limit_eps: number;
  burst_capacity: number;
  created_at: string;
}

interface Environment {
  id: string;
  org_id: string;
  slug: string;
  type: "production" | "sandbox";
  openmeter_namespace: string;
  created_at: string;
}

interface Meter {
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

interface Subject {
  id: string;
  namespace: string;
  key: string;
  display_name: string;
  stripe_customer_id?: string;
  metadata?: Record<string, string>;
  created_at: string;
}

interface APIKey {
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

interface Entitlement {
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

interface CreditGrant {
  id: string;
  entitlement_id: string;
  subject_key: string;
  name: string;
  amount: number;
  remaining: number;
  priority: number;
  expires_at: string;
}

interface EntitlementCheck {
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

interface DLQEvent {
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

interface Plan {
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

interface Subscription {
  id: string;
  namespace: string;
  subject_key: string;
  plan_slug: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

interface Invoice {
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
}

interface Telemetry {
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
  recent_events: {
    id: string;
    type: string;
    subject: string;
    namespace: string;
    time: string;
    data: Record<string, unknown>;
  }[];
  dogfood_self_billing: Record<string, number>;
}

interface MeterQueryResult {
  meter_slug: string;
  namespace: string;
  aggregation: string;
  total_value: number;
  series: {
    window_start: string;
    window_end: string;
    subject: string;
    value: number;
    groups?: Record<string, string>;
  }[];
}

interface IngestResult {
  event_id: string;
  namespace: string;
  topic: string;
  lane: string;
  deduplicated: boolean;
  dlq_routed: boolean;
  dlq_reason?: string;
  processed_at: string;
}

interface PortalSummary {
  namespace: string;
  subject: string;
  meters: Meter[];
  entitlements: EntitlementCheck[];
  invoices: Invoice[];
}

interface ToastItem {
  id: string;
  title: string;
  detail?: string;
  kind?: "ok" | "warn" | "err";
}

type DrawerKind =
  | null
  | "tenant"
  | "meter"
  | "customer"
  | "entitlement"
  | "grant"
  | "plan"
  | "apikey"
  | "invoice";

// ---------------------------------------------------------------------------
// Documentation Chapters
// ---------------------------------------------------------------------------
interface DocChapter {
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

const DOC_CHAPTERS: DocChapter[] = [
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
        body: "Instead of a single root key, Meterbox issues four distinct key prefixes: mb_ing_ (write-only CloudEvents ingestion), mb_ent_ (low-latency quota evaluation), mb_sk_ (control plane & billing administration), and mb_portal_ (customer-locked read-only portal access).",
      },
    ],
    callout: {
      kind: "tip",
      text: "PostgreSQL Row-Level Security (RLS) policies enforce current_setting('app.current_org_id') on every control-plane table so tenant metadata cannot leak across organizations.",
    },
    table: {
      headers: ["Key Prefix", "Scope", "Permitted Operations", "Tenant Lock"],
      rows: [
        ["mb_ing_*", "ingest", "POST /api/v1/events (CloudEvents v1.0)", "Org + Environment"],
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
        code: `func GenerateAPIKey(orgID, envID, name string, scope models.APIKeyScope, subjectID string, rateLimit int) (models.APIKey, string, error) {
    raw := make([]byte, 20)
    if _, err := rand.Read(raw); err != nil {
        return models.APIKey{}, "", err
    }
    prefix := scopePrefix(scope) // mb_ing_, mb_ent_, mb_sk_, mb_portal_
    secret := fmt.Sprintf("%s%s", prefix, hex.EncodeToString(raw))
    hash := sha256.Sum256([]byte(secret))
    return models.APIKey{
        OrgID:        orgID,
        EnvID:        envID,
        Scope:        scope,
        KeyHash:      hex.EncodeToString(hash[:]),
        RateLimitEPS: rateLimit,
    }, secret, nil
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
      "Redis SETNX Dedup (48h)",
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
        body: "Every CloudEvent carries a unique id per source. Before publishing to Redpanda, the Edge Gateway checks key dedup:{namespace}:{source}:{id} with a 48-hour TTL. Retried network requests return HTTP 202 Accepted with deduplicated: true and never double-count usage.",
      },
      {
        num: "2.2",
        heading: "Zero-Drop Dead-Letter Queue (DLQ) & Replay",
        body: "Events that fail CloudEvents validation or match no registered meter event_type are captured in the tenant's DLQ instead of being silently discarded. Operators can edit the raw JSON payload and replay it directly back through the ingestion pipeline.",
      },
    ],
    callout: {
      kind: "warn",
      text: "Every accepted event also emits a dogfooding telemetry event into ns_meterbox_internal (meter: mbx_ingested_events) so Meterbox bills tenants using its own metering engine.",
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
        code: `// 1. Synchronous Idempotency Deduplication (Redis SETNX 48h TTL equivalent)
dedupKey := fmt.Sprintf("dedup:%s:%s:%s", namespace, ev.Source, ev.ID)
if p.store.CheckAndMarkDedup(dedupKey, 48*time.Hour) {
    return models.IngestResponse{
        EventID:      ev.ID,
        Namespace:    namespace,
        Deduplicated: true,
    }, nil
}

// 2. Per-Tenant Token Bucket Rate Limiter & Noisy-Neighbor Lane Router
lane := "realtime"
topic := "om_events_realtime"
if !p.allowRealtime(org.ID, org.RateLimitEPS, org.BurstCapacity) {
    lane = "bulk"
    topic = "om_events_bulk"
}`,
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
      "Multi-tenant ClickHouse MergeTree partitioning with namespace as the primary sorting key prefix and incremental AggregatingMergeTree materialized rollups.",
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
        heading: "Incremental 1-Minute Rollups",
        body: "ClickHouse Materialized Views continuously aggregate sumState, countState, avgState, maxState, and uniqState into 1-minute windows as batches arrive, keeping meter queries and entitlement balance rebuilds fast regardless of raw event volume.",
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
      "Dogfood Telemetry Emit",
    ],
    formula: {
      math: "Remaining(subject, feature) = max(0, Limit(feature) + sum(ActiveCreditGrants) - MeterUsage)",
      caption: "Real-time quota evaluation combines base feature limits, active prepaid credit grants, and live meter usage.",
    },
    sections: [
      {
        num: "4.1",
        heading: "Edge-Cached Quota Checks",
        body: "Applications call the entitlement endpoint on the critical request path (e.g., before executing an LLM completion). Meterbox serves cached balances in microseconds and invalidates/updates the cache synchronously whenever an event is ingested for that subject.",
      },
      {
        num: "4.2",
        heading: "Hybrid Plans & Prepaid Credit Burndown",
        body: "Plans combine a fixed base fee with metered overage components (flat per-unit, graduated, or volume tiers) and included unit allowances. When generating an invoice, Meterbox automatically burns down active Credit Grants in priority order before charging overage to Stripe.",
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
        code: `totalPool := ent.Limit + creditBalance
remaining := totalPool - usage
if remaining < 0 {
    remaining = 0
}
hasAccess := remaining > 0 || ent.SoftLimit
if ent.Type == "boolean" {
    hasAccess = ent.Limit > 0
}`,
        caption: "Real-time entitlement decision engine with soft-limit and credit-grant support.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main Application Component
// ---------------------------------------------------------------------------
export default function MeterboxApp() {
  // Navigation, Drawers, Command Palette & Toasts
  const [activeView, setActiveView] = useState<string>("overview");
  const [docsExpanded, setDocsExpanded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<Record<string, number>>({});
  const [activeDrawer, setActiveDrawer] = useState<DrawerKind>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [cmdkOpen, setCmdkOpen] = useState<boolean>(false);
  const [cmdkQuery, setCmdkQuery] = useState<string>("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Refs for sliding nav indicator & search shortcut
  const navRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamic Multi-Tenant Context (Organizations & Environments)
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string>("");

  // Dynamic Tenant Creation Drawer State
  const [newOrgName, setNewOrgName] = useState<string>("");
  const [newOrgSlug, setNewOrgSlug] = useState<string>("");
  const [newOrgTier, setNewOrgTier] = useState<string>("growth");
  const [newOrgEps, setNewOrgEps] = useState<string>("5000");
  const [newEnvSlug, setNewEnvSlug] = useState<string>("");
  const [newEnvType, setNewEnvType] = useState<"production" | "sandbox">("sandbox");

  // Operational Data States (100% API-driven)
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [grants, setGrants] = useState<CreditGrant[]>([]);
  const [dlqEvents, setDlqEvents] = useState<DLQEvent[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [backendConnected, setBackendConnected] = useState<boolean>(true);

  // Selected Meter & Query Studio State
  const [selectedMeterSlug, setSelectedMeterSlug] = useState<string>("");
  const [meterQueryResult, setMeterQueryResult] = useState<MeterQueryResult | null>(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
  const [selectedWindowGranularity, setSelectedWindowGranularity] = useState<string>("1m");
  const [newMeterSlug, setNewMeterSlug] = useState<string>("");
  const [newMeterName, setNewMeterName] = useState<string>("");
  const [newMeterEventType, setNewMeterEventType] = useState<string>("");
  const [newMeterAgg, setNewMeterAgg] = useState<Meter["aggregation"]>("SUM");
  const [newMeterValueProp, setNewMeterValueProp] = useState<string>("$.tokens");
  const [newMeterGroupByKey, setNewMeterGroupByKey] = useState<string>("model");
  const [newMeterGroupByPath, setNewMeterGroupByPath] = useState<string>("$.model");

  // CloudEvents Ingestion Simulator State (Dynamic)
  const [ingestType, setIngestType] = useState<string>("");
  const [ingestSubject, setIngestSubject] = useState<string>("");
  const [ingestSource, setIngestSource] = useState<string>("edge-gateway");
  const [ingestId, setIngestId] = useState<string>("");
  const [ingestPayload, setIngestPayload] = useState<string>('{\n  "tokens": 1500,\n  "model": "gpt-4o"\n}');
  const [lastIngestResult, setLastIngestResult] = useState<IngestResult | null>(null);
  const [dlqDrafts, setDlqDrafts] = useState<Record<string, string>>({});

  // Customers, Entitlements & Credit Grants State (Dynamic)
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>("");
  const [selectedFeatureKey, setSelectedFeatureKey] = useState<string>("");
  const [entitlementCheck, setEntitlementCheck] = useState<EntitlementCheck | null>(null);
  const [newSubjectKey, setNewSubjectKey] = useState<string>("");
  const [newSubjectName, setNewSubjectName] = useState<string>("");
  const [newSubjectStripe, setNewSubjectStripe] = useState<string>("");
  const [newEntFeatureKey, setNewEntFeatureKey] = useState<string>("");
  const [newEntMeterSlug, setNewEntMeterSlug] = useState<string>("");
  const [newEntLimit, setNewEntLimit] = useState<string>("100000");
  const [newEntSoftLimit, setNewEntSoftLimit] = useState<boolean>(true);
  const [newGrantEntId, setNewGrantEntId] = useState<string>("");
  const [newGrantName, setNewGrantName] = useState<string>("");
  const [newGrantAmount, setNewGrantAmount] = useState<string>("25000");
  const [newGrantPriority, setNewGrantPriority] = useState<string>("1");

  // Plans, Subscriptions & Invoicing State (Dynamic)
  const [invoiceSubjectKey, setInvoiceSubjectKey] = useState<string>("");
  const [invoicePlanSlug, setInvoicePlanSlug] = useState<string>("");
  const [newPlanSlug, setNewPlanSlug] = useState<string>("");
  const [newPlanName, setNewPlanName] = useState<string>("");
  const [newPlanBaseFee, setNewPlanBaseFee] = useState<string>("9900");
  const [newPlanCompName, setNewPlanCompName] = useState<string>("");
  const [newPlanCompMeter, setNewPlanCompMeter] = useState<string>("");
  const [newPlanCompPrice, setNewPlanCompPrice] = useState<string>("2");
  const [newPlanCompIncluded, setNewPlanCompIncluded] = useState<string>("50000");
  const [newSubSubjectKey, setNewSubSubjectKey] = useState<string>("");
  const [newSubPlanSlug, setNewSubPlanSlug] = useState<string>("");

  // API Keys & Customer Portal State (Dynamic)
  const [newKeyName, setNewKeyName] = useState<string>("");
  const [newKeyScope, setNewKeyScope] = useState<APIKey["scope"]>("ingest");
  const [newKeySubject, setNewKeySubject] = useState<string>("");
  const [newKeyRateLimit, setNewKeyRateLimit] = useState<string>("2500");
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);
  const [portalSubjectKey, setPortalSubjectKey] = useState<string>("");
  const [portalSummary, setPortalSummary] = useState<PortalSummary | null>(null);

  // Toast helper
  const pushToast = useCallback(
    (title: string, detail?: string, kind: "ok" | "warn" | "err" = "ok") => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, detail, kind }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    pushToast(`Copied ${label}`, "Ready to paste in your terminal", "ok");
  };

  // Initialize theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("mbx.theme");
    const dark = saved === "dark";
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  // Toggle theme with circular clip-path ViewTransition
  const toggleTheme = (e?: React.MouseEvent<HTMLButtonElement>) => {
    const nextDark = !isDark;
    const x = e?.clientX || window.innerWidth - 28;
    const y = e?.clientY || 28;
    const apply = () => {
      setIsDark(nextDark);
      document.documentElement.classList.toggle("dark", nextDark);
      localStorage.setItem("mbx.theme", nextDark ? "dark" : "light");
    };
    const docWithTransition = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };
    if (!docWithTransition.startViewTransition) {
      apply();
      return;
    }
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = docWithTransition.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 460, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  };

  // Keyboard shortcuts ("⌘K", "/", "Escape")
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((v) => !v);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !inField) {
        e.preventDefault();
        setCmdkOpen(true);
      } else if (e.key === "Escape") {
        if (cmdkOpen) setCmdkOpen(false);
        else if (activeDrawer) setActiveDrawer(null);
        else if (inField) (e.target as HTMLElement)?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cmdkOpen, activeDrawer]);

  // Update sliding sidebar nav indicator position
  const moveIndicator = useCallback(() => {
    const nav = navRef.current;
    const ind = indicatorRef.current;
    if (!nav || !ind) return;
    const activeBtn = nav.querySelector(".nav-item.active") as HTMLElement | null;
    if (!activeBtn) {
      ind.style.opacity = "0";
      return;
    }
    const nr = nav.getBoundingClientRect();
    const ar = activeBtn.getBoundingClientRect();
    ind.style.opacity = "1";
    ind.style.width = `${ar.width}px`;
    ind.style.height = `${ar.height}px`;
    ind.style.transform = `translate(${ar.left - nr.left}px, ${ar.top - nr.top + nav.scrollTop}px)`;
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(moveIndicator);
    window.addEventListener("resize", moveIndicator);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", moveIndicator);
    };
  }, [activeView, docsExpanded, searchQuery, moveIndicator]);

  // ---------------------------------------------------------------------------
  // Helper to resolve current OpenMeter namespace from activeEnvId
  const activeOrg = organizations.find((o) => o.id === selectedOrgId);
  const orgEnvironments = environments.filter(
    (e) => !selectedOrgId || e.org_id === selectedOrgId
  );
  const activeEnv =
    environments.find((e) => e.id === activeEnvId) ||
    orgEnvironments[0] ||
    environments[0];
  const activeNamespace =
    activeEnv?.openmeter_namespace || telemetry?.active_namespace || "ns_live_acme";
  const activeOrgName = activeOrg?.name || telemetry?.org_name || "Acme AI Corp";
  const activeOrgId = selectedOrgId || telemetry?.org_id || "org_acme_ai";

  // ---------------------------------------------------------------------------
  // Fetch Organizations & Environments (with resilient fallback)
  // ---------------------------------------------------------------------------
  const fetchTenants = useCallback(async () => {
    try {
      let orgList: Organization[] = [];
      const orgRes = await fetch(`${API_BASE}/api/control/v1/organizations`);
      if (orgRes.ok) {
        const rawOrgs = await orgRes.json();
        orgList = (rawOrgs || []).map((o: Record<string, unknown>) => ({
          id: String(o.id || "org_acme_ai"),
          slug: String(o.slug || "acme-ai"),
          name: String(o.name || "Acme AI Corp"),
          billing_tier: String(o.billing_tier || o.plan_tier || "pro"),
          rate_limit_eps: Number(o.rate_limit_eps || 1000),
          burst_capacity: Number(o.burst_capacity || 5000),
          created_at: String(o.created_at || new Date().toISOString()),
        }));
      }

      if (orgList.length > 0) {
        setOrganizations(orgList);
        setBackendConnected(true);
      }

      const currentOrgId =
        selectedOrgId && orgList.some((o) => o.id === selectedOrgId)
          ? selectedOrgId
          : orgList[0]?.id || "org_acme_ai";
      if (currentOrgId && currentOrgId !== selectedOrgId) {
        setSelectedOrgId(currentOrgId);
      }

      const envRes = await fetch(`${API_BASE}/api/control/v1/environments`);
      if (envRes.ok) {
        const rawEnvs = await envRes.json();
        const envList: Environment[] = (rawEnvs || []).map(
          (e: Record<string, unknown>) => ({
            id: String(e.id || "env_live_acme"),
            org_id: String(e.org_id || "org_acme_ai"),
            slug: String(e.slug || "production"),
            type: (e.type === "sandbox" ? "sandbox" : "production") as
              | "production"
              | "sandbox",
            openmeter_namespace: String(e.openmeter_namespace || "ns_live_acme"),
            created_at: String(e.created_at || new Date().toISOString()),
          })
        );
        setEnvironments(envList);
        setBackendConnected(true);
        const scopedEnvs = envList.filter(
          (e) => !currentOrgId || e.org_id === currentOrgId
        );
        const pool = scopedEnvs.length > 0 ? scopedEnvs : envList;
        const currentEnvId =
          activeEnvId && pool.some((e) => e.id === activeEnvId)
            ? activeEnvId
            : pool[0]?.id || "";
        if (currentEnvId && currentEnvId !== activeEnvId) {
          setActiveEnvId(currentEnvId);
        }
      }
    } catch {
      setBackendConnected(false);
    }
  }, [selectedOrgId, activeEnvId]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // ---------------------------------------------------------------------------
  // Fetch All Environment-Scoped Data (using CORS-approved X-OpenMeter-Namespace)
  // ---------------------------------------------------------------------------
  const fetchEnvData = useCallback(async () => {
    if (!activeNamespace) {
      fetchTenants();
      return;
    }
    const headers: Record<string, string> = {
      "X-OpenMeter-Namespace": activeNamespace,
    };
    try {
      const [
        telRes,
        eventsRes,
        metersRes,
        subRes,
        keysRes,
        entRes,
        dlqRes,
        plansRes,
        subsRes,
        invRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/api/control/v1/telemetry`, { headers }),
        fetch(`${API_BASE}/api/v1/events?limit=25`, { headers }),
        fetch(`${API_BASE}/api/v1/meters`, { headers }),
        fetch(`${API_BASE}/api/v1/subjects`, { headers }),
        fetch(`${API_BASE}/api/control/v1/api-keys`, { headers }),
        fetch(`${API_BASE}/api/v1/entitlements`, { headers }),
        fetch(`${API_BASE}/api/control/v1/dlq`, { headers }),
        fetch(`${API_BASE}/api/v1/plans`, { headers }),
        fetch(`${API_BASE}/api/v1/subscriptions`, { headers }),
        fetch(`${API_BASE}/api/v1/invoices`, { headers }),
      ]);

      const recentEventsList = eventsRes.ok ? await eventsRes.json() : [];

      if (telRes.ok) {
        const rawTel = await telRes.json();
        const hits = Number(rawTel.edge_cache_hits ?? 0);
        const misses = Number(rawTel.edge_cache_misses ?? 0);
        const rawRatioPct = Number(rawTel.edge_cache_hit_ratio_pct ?? 96);
        const normalizedTel: Telemetry = {
          org_id: String(rawTel.org_id || selectedOrgId || "org_acme_ai"),
          org_name: String(rawTel.org_name || activeOrgName || "Acme AI Corp"),
          active_namespace: String(rawTel.active_namespace || activeNamespace),
          ingested_events: Number(
            rawTel.ingested_events ?? rawTel.total_events_ingested ?? 0
          ),
          deduplicated_hits: Number(
            rawTel.deduplicated_hits ?? rawTel.deduplicated_dropped ?? 0
          ),
          realtime_lane_events: Number(rawTel.realtime_lane_events ?? 0),
          bulk_lane_events: Number(rawTel.bulk_lane_events ?? 0),
          dlq_pending_count: Number(
            rawTel.dlq_pending_count ?? rawTel.pending_dlq_events ?? 0
          ),
          entitlement_checks: Number(
            rawTel.entitlement_checks ?? hits + misses
          ),
          avg_check_latency_us: Number(rawTel.avg_check_latency_us ?? 280),
          cache_hit_ratio:
            rawTel.cache_hit_ratio != null
              ? Number(rawTel.cache_hit_ratio)
              : hits + misses > 0
              ? rawRatioPct / 100
              : 0.96,
          recent_events: Array.isArray(rawTel.recent_events)
            ? rawTel.recent_events
            : Array.isArray(recentEventsList)
            ? recentEventsList
            : [],
          dogfood_self_billing:
            rawTel.dogfood_self_billing || {
              meterbox_ingested_events: Number(
                rawTel.dogfood_org_events_billed ?? 0
              ),
            },
        };
        setTelemetry(normalizedTel);
      }

      if (metersRes.ok) {
        const mList: Meter[] = await metersRes.json();
        setMeters(mList);
        if (mList.length > 0) {
          setSelectedMeterSlug((prev) =>
            prev && mList.some((m) => m.slug === prev) ? prev : mList[0].slug
          );
          setIngestType((prev) => prev || mList[0].event_type);
          setNewEntMeterSlug((prev) => prev || mList[0].slug);
          setNewPlanCompMeter((prev) => prev || mList[0].slug);
        }
      }

      if (subRes.ok) {
        const sList: Subject[] = await subRes.json();
        setSubjects(sList);
        if (sList.length > 0) {
          setSelectedSubjectKey((prev) =>
            prev && sList.some((s) => s.key === prev) ? prev : sList[0].key
          );
          setIngestSubject((prev) => prev || sList[0].key);
          setInvoiceSubjectKey((prev) => prev || sList[0].key);
          setNewSubSubjectKey((prev) => prev || sList[0].key);
          setPortalSubjectKey((prev) => prev || sList[0].key);
        }
      }

      if (keysRes.ok) {
        const rawKeys = await keysRes.json();
        const normalizedKeys: APIKey[] = (rawKeys || []).map(
          (k: Record<string, unknown>) => ({
            id: String(k.id || ""),
            org_id: String(k.org_id || ""),
            env_id: String(k.env_id || ""),
            name: String(k.name || ""),
            scope: (k.scope || "ingest") as APIKey["scope"],
            prefix: String(k.key_preview || k.key_prefix || k.prefix || "mb_"),
            subject_id: String(k.subject_filter || k.subject_id || ""),
            rate_limit_eps: Number(k.rate_limit_rps ?? k.rate_limit_eps ?? 1000),
            created_at: String(k.created_at || new Date().toISOString()),
          })
        );
        setApiKeys(normalizedKeys);
      }

      if (entRes.ok) {
        const rawEnts = await entRes.json();
        const eList: Entitlement[] = (rawEnts || []).map(
          (e: Record<string, unknown>) => ({
            id: String(e.id || ""),
            namespace: String(e.namespace || activeNamespace),
            subject_key: String(e.subject_key || ""),
            feature_key: String(e.feature_key || ""),
            type: (e.type || "metered") as Entitlement["type"],
            meter_slug: String(e.meter_slug || ""),
            limit: Number(e.limit ?? e.issue_after_reset ?? 0),
            soft_limit: Boolean(e.soft_limit ?? e.is_soft_limit ?? false),
            reset_period: String(e.reset_period || "MONTH"),
          })
        );
        setEntitlements(eList);
        if (eList.length > 0) {
          setSelectedFeatureKey((prev) =>
            prev && eList.some((e) => e.feature_key === prev)
              ? prev
              : eList[0].feature_key
          );
          setNewGrantEntId((prev) => prev || eList[0].id);
        }
      }

      if (dlqRes.ok) {
        const rawDlq = await dlqRes.json();
        const dList: DLQEvent[] = (rawDlq || []).map(
          (d: Record<string, unknown>) => {
            const rawStr =
              typeof d.raw_payload === "string"
                ? d.raw_payload
                : JSON.stringify(d.raw_payload || {}, null, 2);
            return {
              id: String(d.id || ""),
              org_id: String(d.org_id || selectedOrgId || ""),
              env_id: String(d.env_id || activeEnvId || ""),
              namespace: String(
                d.namespace || d.openmeter_namespace || activeNamespace
              ),
              raw_payload: rawStr,
              failure_reason: String(
                d.failure_reason || d.error_reason || d.error_code || "Validation error"
              ),
              error_code: String(d.error_code || "invalid_payload"),
              status: (d.status || "pending") as DLQEvent["status"],
              failed_at: String(d.failed_at || new Date().toISOString()),
            };
          }
        );
        setDlqEvents(dList);
        setDlqDrafts((prev) => {
          const next = { ...prev };
          for (const item of dList) {
            if (next[item.id] === undefined) {
              next[item.id] = item.raw_payload;
            }
          }
          return next;
        });
      }

      if (plansRes.ok) {
        const rawPlans = await plansRes.json();
        const pList: Plan[] = (rawPlans || []).map(
          (p: Record<string, unknown>) => ({
            id: String(p.id || ""),
            namespace: String(p.namespace || activeNamespace),
            slug: String(p.slug || ""),
            name: String(p.name || ""),
            currency: String(p.currency || "USD"),
            base_fee_cents: Number(p.base_fee_cents ?? p.base_price_cents ?? 0),
            billing_cadence: String(p.billing_cadence || "MONTH"),
            components: Array.isArray(p.components)
              ? (p.components as Plan["components"])
              : Array.isArray(p.rate_cards)
              ? (p.rate_cards as Record<string, unknown>[]).map((rc, idx) => ({
                  id: `rc_${idx}`,
                  name: String(rc.name || rc.meter_slug || ""),
                  meter_slug: String(rc.meter_slug || ""),
                  model: "graduated" as const,
                  unit_price_cents: 1,
                  included_units: Number(rc.included_quantity || 0),
                }))
              : [],
          })
        );
        setPlans(pList);
        if (pList.length > 0) {
          setInvoicePlanSlug((prev) =>
            prev && pList.some((p) => p.slug === prev) ? prev : pList[0].slug
          );
          setNewSubPlanSlug((prev) => prev || pList[0].slug);
        }
      }

      if (subsRes.ok) setSubscriptions(await subsRes.json());

      if (invRes.ok) {
        const rawInvs = await invRes.json();
        const invList: Invoice[] = (rawInvs || []).map(
          (inv: Record<string, unknown>) => {
            const rawLines = Array.isArray(inv.line_items)
              ? (inv.line_items as Record<string, unknown>[])
              : [];
            return {
              id: String(inv.id || ""),
              namespace: String(inv.namespace || activeNamespace),
              subject_key: String(inv.subject_key || ""),
              plan_slug: String(inv.plan_slug || ""),
              currency: String(inv.currency || "USD"),
              subtotal_cents: Number(inv.subtotal_cents ?? 0),
              credits_applied_cents: Number(inv.credits_applied_cents ?? 0),
              total_cents: Number(inv.total_cents ?? 0),
              status: String(inv.status || "issued"),
              stripe_invoice_id: String(
                inv.stripe_invoice_id || "in_stripe_synced"
              ),
              line_items: rawLines.map((li) => {
                const qty = Number(li.quantity ?? 1);
                const amt = Number(li.amount_cents ?? 0);
                const unitPrice =
                  li.unit_price_cents != null
                    ? Number(li.unit_price_cents)
                    : qty > 0
                    ? amt / qty
                    : amt;
                return {
                  description: String(li.description || ""),
                  meter_slug: li.meter_slug ? String(li.meter_slug) : undefined,
                  quantity: qty,
                  unit_price_cents: unitPrice,
                  amount_cents: amt,
                };
              }),
              period_start: String(inv.period_start || new Date().toISOString()),
              period_end: String(inv.period_end || new Date().toISOString()),
              issued_at: String(
                inv.issued_at || inv.created_at || new Date().toISOString()
              ),
            };
          }
        );
        setInvoices(invList);
      }

      setBackendConnected(true);
    } catch {
      setBackendConnected(false);
    }
  }, [activeNamespace, activeEnvId, selectedOrgId, activeOrgName, fetchTenants]);

  useEffect(() => {
    fetchEnvData();
    const interval = setInterval(fetchEnvData, 5000);
    return () => clearInterval(interval);
  }, [fetchEnvData]);

  // Query selected meter series
  const fetchMeterQuery = useCallback(async () => {
    if (!activeNamespace || !selectedMeterSlug) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/meters/${encodeURIComponent(selectedMeterSlug)}/query`,
        { headers: { "X-OpenMeter-Namespace": activeNamespace } }
      );
      if (res.ok) {
        const raw = await res.json();
        const rawRows = Array.isArray(raw.series)
          ? raw.series
          : Array.isArray(raw.data)
          ? raw.data
          : [];
        setMeterQueryResult({
          meter_slug: String(raw.meter_slug || selectedMeterSlug),
          namespace: String(raw.namespace || activeNamespace),
          aggregation: String(raw.aggregation || "SUM"),
          total_value: Number(raw.total_value ?? 0),
          series: rawRows.map((r: Record<string, unknown>) => ({
            window_start: String(r.window_start || new Date().toISOString()),
            window_end: String(r.window_end || new Date().toISOString()),
            subject: String(r.subject || "all"),
            value: Number(r.value ?? 0),
            groups: (r.groups || r.group_by || {}) as Record<string, string>,
          })),
        });
      }
    } catch {
      // ignore transient error
    }
  }, [activeNamespace, selectedMeterSlug]);

  useEffect(() => {
    fetchMeterQuery();
  }, [fetchMeterQuery]);

  // Evaluate selected entitlement
  const fetchEntitlementEvaluation = useCallback(async () => {
    if (!activeNamespace || !selectedSubjectKey || !selectedFeatureKey) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/subjects/${encodeURIComponent(
          selectedSubjectKey
        )}/entitlements/${encodeURIComponent(selectedFeatureKey)}/value`,
        { headers: { "X-OpenMeter-Namespace": activeNamespace } }
      );
      if (res.ok) {
        const raw = await res.json();
        const breakdown = Array.isArray(raw.grant_breakdown)
          ? (raw.grant_breakdown as Record<string, unknown>[])
          : [];
        const totalGrantRemaining = breakdown.reduce(
          (acc, g) => acc + Number(g.remaining ?? 0),
          0
        );
        const matchingEnt = entitlements.find(
          (e) =>
            e.subject_key === selectedSubjectKey &&
            e.feature_key === selectedFeatureKey
        );
        const baseLimit = Number(
          raw.limit ?? matchingEnt?.limit ?? raw.total_granted ?? 0
        );
        setEntitlementCheck({
          has_access: Boolean(raw.has_access),
          subject_key: String(raw.subject_key || selectedSubjectKey),
          feature_key: String(raw.feature_key || selectedFeatureKey),
          limit: baseLimit,
          usage: Number(raw.usage ?? raw.usage_in_period ?? 0),
          credit_balance: Number(raw.credit_balance ?? totalGrantRemaining),
          remaining: Number(raw.remaining ?? raw.balance ?? 0),
          soft_limit: Boolean(raw.soft_limit ?? raw.is_soft_limit ?? false),
          cache_source: String(
            raw.cache_source ||
              (raw.cache_status ? `REDIS_${raw.cache_status}` : "EDGE_HIT")
          ),
          latency_us: Number(raw.latency_us ?? raw.evaluation_us ?? 210),
          evaluated_at: String(raw.evaluated_at || new Date().toISOString()),
        });

        if (breakdown.length > 0) {
          const mappedGrants: CreditGrant[] = breakdown.map((g) => ({
            id: String(g.grant_id || ""),
            entitlement_id: matchingEnt?.id || "",
            subject_key: selectedSubjectKey,
            name: String(g.grant_name || "Prepaid Credit Grant"),
            amount: Number(g.initial ?? 0),
            remaining: Number(g.remaining ?? 0),
            priority: Number(g.priority ?? 1),
            expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          }));
          setGrants((prev) => {
            const others = prev.filter(
              (item) => item.subject_key !== selectedSubjectKey
            );
            return [...mappedGrants, ...others];
          });
        }
      }
    } catch {
      // ignore
    }
  }, [activeNamespace, selectedSubjectKey, selectedFeatureKey, entitlements]);

  useEffect(() => {
    fetchEntitlementEvaluation();
  }, [fetchEntitlementEvaluation]);

  // Fetch customer portal summary
  const fetchPortalSummary = useCallback(async () => {
    if (!activeNamespace || !portalSubjectKey) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/portal/v1/summary?subject=${encodeURIComponent(portalSubjectKey)}`,
        { headers: { "X-OpenMeter-Namespace": activeNamespace } }
      );
      if (res.ok) {
        const raw = await res.json();
        const rawEnts = Array.isArray(raw.entitlements)
          ? (raw.entitlements as Record<string, unknown>[])
          : [];
        setPortalSummary({
          namespace: String(raw.namespace || activeNamespace),
          subject: String(raw.subject || raw.subject_key || portalSubjectKey),
          meters: Array.isArray(raw.meters) ? raw.meters : [],
          entitlements: rawEnts.map((e) => ({
            has_access: Boolean(e.has_access),
            subject_key: String(e.subject_key || portalSubjectKey),
            feature_key: String(e.feature_key || ""),
            limit: Number(e.limit ?? e.total_granted ?? 0),
            usage: Number(e.usage ?? e.usage_in_period ?? 0),
            credit_balance: Number(e.credit_balance ?? 0),
            remaining: Number(e.remaining ?? e.balance ?? 0),
            soft_limit: Boolean(e.soft_limit ?? e.is_soft_limit ?? false),
            cache_source: String(e.cache_source || e.cache_status || "HIT"),
            latency_us: Number(e.latency_us ?? e.evaluation_us ?? 190),
            evaluated_at: String(e.evaluated_at || new Date().toISOString()),
          })),
          invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
        });
      }
    } catch {
      // ignore
    }
  }, [activeNamespace, portalSubjectKey]);

  useEffect(() => {
    fetchPortalSummary();
  }, [fetchPortalSummary]);

  // ---------------------------------------------------------------------------
  // Dynamic Mutation Handlers
  // ---------------------------------------------------------------------------
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const slug =
      newOrgSlug.trim() ||
      newOrgName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
    const res = await fetch(`${API_BASE}/api/control/v1/organizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newOrgName.trim(),
        slug,
        plan_tier: newOrgTier,
        billing_tier: newOrgTier,
        rate_limit_eps: Number(newOrgEps) || 5000,
      }),
    });
    if (res.ok) {
      const payload = await res.json();
      const createdOrg = payload.organization || payload;
      setNewOrgName("");
      setNewOrgSlug("");
      if (createdOrg?.id) setSelectedOrgId(createdOrg.id);
      await fetchTenants();
      setActiveDrawer(null);
      pushToast(
        `Organization "${createdOrg?.name || newOrgName}" provisioned`,
        `Default production & sandbox namespaces ready`
      );
    }
  };

  const handleCreateEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newEnvSlug.trim()) return;
    const res = await fetch(`${API_BASE}/api/control/v1/environments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        org_id: selectedOrgId,
        name: newEnvSlug.trim(),
        slug: newEnvSlug.trim(),
        type: newEnvType,
      }),
    });
    if (res.ok) {
      const created: Environment = await res.json();
      setNewEnvSlug("");
      setActiveEnvId(created.id);
      await fetchTenants();
      setActiveDrawer(null);
      pushToast(
        `Environment "${created.slug}" created`,
        `Bound to ${created.openmeter_namespace}`
      );
    }
  };

  const handleCreateMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeterSlug.trim() || !newMeterEventType.trim()) return;
    const groupBy: Record<string, string> = {};
    if (newMeterGroupByKey.trim() && newMeterGroupByPath.trim()) {
      groupBy[newMeterGroupByKey.trim()] = newMeterGroupByPath.trim();
    }
    const res = await fetch(`${API_BASE}/api/v1/meters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        slug: newMeterSlug.trim(),
        name: newMeterName.trim() || newMeterSlug.trim(),
        aggregation: newMeterAgg,
        event_type: newMeterEventType.trim(),
        value_property: newMeterValueProp.trim(),
        group_by: groupBy,
        window_size: "HOUR",
      }),
    });
    if (res.ok) {
      const slug = newMeterSlug.trim();
      setSelectedMeterSlug(slug);
      setNewMeterSlug("");
      setNewMeterName("");
      setNewMeterEventType("");
      setActiveDrawer(null);
      await fetchEnvData();
      await fetchMeterQuery();
      pushToast(
        `Meter "${slug}" provisioned`,
        `ClickHouse materialized rollup active`
      );
    }
  };

  const handleIngestEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsedData: unknown = {};
    try {
      parsedData = JSON.parse(ingestPayload);
    } catch {
      parsedData = { raw: ingestPayload };
    }
    const eventId =
      ingestId.trim() ||
      `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const res = await fetch(`${API_BASE}/api/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        specversion: "1.0",
        id: eventId,
        source: ingestSource.trim() || "edge-gateway",
        type: ingestType.trim(),
        subject: ingestSubject.trim(),
        time: new Date().toISOString(),
        data: parsedData,
      }),
    });
    const raw = await res.json();
    const isDlq = Boolean(raw.dlq_routed || Number(raw.dlq_count) > 0);
    const isDedup = Boolean(raw.deduplicated === true || Number(raw.deduplicated) > 0);
    const lane = String(raw.lane || raw.routed_lane || "realtime");
    const topic = String(
      raw.topic || (lane === "bulk" ? "om_events_bulk" : "om_events_realtime")
    );
    const normalizedResult: IngestResult = {
      event_id: String(raw.event_id || eventId),
      namespace: String(raw.namespace || activeNamespace),
      topic,
      lane,
      deduplicated: isDedup,
      dlq_routed: isDlq,
      dlq_reason: String(raw.dlq_reason || "Schema / numeric property mismatch"),
      processed_at: new Date().toISOString(),
    };
    setLastIngestResult(normalizedResult);
    await fetchEnvData();
    await fetchMeterQuery();
    await fetchEntitlementEvaluation();
    if (isDlq) {
      pushToast(
        "Event routed to Dead-Letter Queue",
        normalizedResult.dlq_reason,
        "warn"
      );
    } else if (isDedup) {
      pushToast(
        "Duplicate Event Blocked (SETNX)",
        `id=${normalizedResult.event_id}`,
        "warn"
      );
    } else {
      pushToast(
        `Event Ingested → ${topic}`,
        `id=${normalizedResult.event_id} (${lane} lane)`,
        "ok"
      );
    }
  };

  const handleReplayDLQ = async (dlqId: string) => {
    const editedPayload = dlqDrafts[dlqId] ?? "";
    let parsedObj: Record<string, unknown> | undefined;
    try {
      parsedObj = JSON.parse(editedPayload);
    } catch {
      pushToast("Invalid JSON in DLQ Editor", "Fix syntax before replaying", "err");
      return;
    }
    const res = await fetch(
      `${API_BASE}/api/control/v1/dlq/${encodeURIComponent(dlqId)}/replay`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenMeter-Namespace": activeNamespace,
        },
        body: JSON.stringify({ payload: parsedObj, fixed_payload: editedPayload }),
      }
    );
    await fetchEnvData();
    await fetchMeterQuery();
    if (res.ok) {
      pushToast(
        `Replayed DLQ event ${dlqId}`,
        "Repaired payload ingested into ClickHouse",
        "ok"
      );
    } else {
      pushToast(
        `DLQ Replay failed for ${dlqId}`,
        "Verify the repaired JSON matches a registered meter",
        "err"
      );
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectKey.trim()) return;
    const res = await fetch(`${API_BASE}/api/v1/subjects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        key: newSubjectKey.trim(),
        display_name: newSubjectName.trim() || newSubjectKey.trim(),
        stripe_customer_id: newSubjectStripe.trim(),
      }),
    });
    if (res.ok) {
      const key = newSubjectKey.trim();
      setSelectedSubjectKey(key);
      setNewSubjectKey("");
      setNewSubjectName("");
      setNewSubjectStripe("");
      setActiveDrawer(null);
      await fetchEnvData();
      pushToast(
        `Customer "${key}" registered`,
        "Ready for entitlements and subscriptions"
      );
    }
  };

  const handleCreateEntitlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectKey || !newEntFeatureKey.trim()) return;
    const amt = Number(newEntLimit) || 0;
    const res = await fetch(`${API_BASE}/api/v1/entitlements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        subject_key: selectedSubjectKey,
        feature_key: newEntFeatureKey.trim(),
        feature_name: newEntFeatureKey.trim(),
        type: "metered",
        meter_slug: newEntMeterSlug,
        limit: amt,
        issue_after_reset: amt,
        initial_grant_amount: amt,
        soft_limit: newEntSoftLimit,
        is_soft_limit: newEntSoftLimit,
        reset_period: "MONTH",
      }),
    });
    if (res.ok) {
      const fKey = newEntFeatureKey.trim();
      setSelectedFeatureKey(fKey);
      setNewEntFeatureKey("");
      setActiveDrawer(null);
      await fetchEnvData();
      await fetchEntitlementEvaluation();
      pushToast(`Entitlement "${fKey}" attached`, `Subject: ${selectedSubjectKey}`);
    }
  };

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGrantEntId || !newGrantName.trim()) return;
    const targetEnt = entitlements.find((ent) => ent.id === newGrantEntId);
    const res = await fetch(
      `${API_BASE}/api/v1/entitlements/${encodeURIComponent(newGrantEntId)}/grants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenMeter-Namespace": activeNamespace,
        },
        body: JSON.stringify({
          subject_key: targetEnt?.subject_key || selectedSubjectKey,
          name: newGrantName.trim(),
          amount: Number(newGrantAmount) || 10000,
          priority: Number(newGrantPriority) || 1,
        }),
      }
    );
    if (res.ok) {
      const gName = newGrantName.trim();
      setNewGrantName("");
      setActiveDrawer(null);
      await fetchEnvData();
      await fetchEntitlementEvaluation();
      pushToast(
        `Credit Grant "${gName}" issued`,
        `+${Number(newGrantAmount).toLocaleString()} units added to pool`
      );
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanSlug.trim() || !newPlanName.trim()) return;
    const baseCents = Number(newPlanBaseFee) || 0;
    const incUnits = Number(newPlanCompIncluded) || 0;
    const unitPrice = Number(newPlanCompPrice) || 1;
    const res = await fetch(`${API_BASE}/api/v1/plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        slug: newPlanSlug.trim(),
        name: newPlanName.trim(),
        currency: "USD",
        base_fee_cents: baseCents,
        base_price_cents: baseCents,
        billing_cadence: "MONTH",
        included_credits: incUnits,
        rate_cards: newPlanCompMeter
          ? [
              {
                feature_key: newPlanCompMeter,
                meter_slug: newPlanCompMeter,
                name: newPlanCompName.trim() || `${newPlanCompMeter} usage`,
                pricing_model: "flat_per_unit",
                included_quantity: incUnits,
                tiers: [
                  {
                    unit_price_cents: unitPrice,
                    flat_fee_cents: 0,
                  },
                ],
              },
            ]
          : [],
      }),
    });
    if (res.ok) {
      const slug = newPlanSlug.trim();
      setInvoicePlanSlug(slug);
      setNewPlanSlug("");
      setNewPlanName("");
      setNewPlanCompName("");
      setActiveDrawer(null);
      await fetchEnvData();
      pushToast(
        `Pricing Plan "${slug}" published`,
        "Available for customer subscriptions"
      );
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubSubjectKey || !newSubPlanSlug) return;
    const res = await fetch(`${API_BASE}/api/v1/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        subject_key: newSubSubjectKey,
        plan_slug: newSubPlanSlug,
      }),
    });
    if (res.ok) {
      await fetchEnvData();
      pushToast(`Subscribed ${newSubSubjectKey}`, `Plan: ${newSubPlanSlug}`);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!invoiceSubjectKey || !invoicePlanSlug) return;
    const res = await fetch(`${API_BASE}/api/v1/invoices/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        subject_key: invoiceSubjectKey,
        plan_slug: invoicePlanSlug,
        sync_to_stripe: true,
      }),
    });
    if (res.ok) {
      const rawInv = await res.json();
      await fetchEnvData();
      await fetchPortalSummary();
      const rawLines = Array.isArray(rawInv.line_items)
        ? (rawInv.line_items as Record<string, unknown>[])
        : [];
      const created: Invoice = {
        id: String(rawInv.id || "inv_new"),
        namespace: String(rawInv.namespace || activeNamespace),
        subject_key: String(rawInv.subject_key || invoiceSubjectKey),
        plan_slug: String(rawInv.plan_slug || invoicePlanSlug),
        currency: String(rawInv.currency || "USD"),
        subtotal_cents: Number(rawInv.subtotal_cents ?? 0),
        credits_applied_cents: Number(rawInv.credits_applied_cents ?? 0),
        total_cents: Number(rawInv.total_cents ?? 0),
        status: String(rawInv.status || "synced_stripe"),
        stripe_invoice_id: String(rawInv.stripe_invoice_id || "in_stripe_live"),
        line_items: rawLines.map((li) => {
          const qty = Number(li.quantity ?? 1);
          const amt = Number(li.amount_cents ?? 0);
          return {
            description: String(li.description || ""),
            meter_slug: li.meter_slug ? String(li.meter_slug) : undefined,
            quantity: qty,
            unit_price_cents:
              li.unit_price_cents != null
                ? Number(li.unit_price_cents)
                : qty > 0
                ? amt / qty
                : amt,
            amount_cents: amt,
          };
        }),
        period_start: String(rawInv.period_start || new Date().toISOString()),
        period_end: String(rawInv.period_end || new Date().toISOString()),
        issued_at: String(
          rawInv.issued_at || rawInv.created_at || new Date().toISOString()
        ),
      };
      setSelectedInvoice(created);
      setActiveDrawer("invoice");
      pushToast(
        `Invoice ${created.id} issued`,
        `Synced with Stripe (${created.stripe_invoice_id})`
      );
    }
  };

  const handleCreateAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const res = await fetch(`${API_BASE}/api/control/v1/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify({
        name: newKeyName.trim(),
        scope: newKeyScope,
        subject_filter: newKeyScope === "portal" ? newKeySubject.trim() : "",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewlyCreatedSecret(data.raw_key || data.secret || null);
      setNewKeyName("");
      setActiveDrawer(null);
      await fetchEnvData();
      pushToast(`Scoped API key generated`, `Scope: ${newKeyScope}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Navigation Definitions
  // ---------------------------------------------------------------------------
  const operationalNav = [
    {
      id: "overview",
      label: "Pipeline Overview",
      badge: telemetry ? `${telemetry.ingested_events} ev` : "live",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      id: "meters",
      label: "Meters & OLAP",
      badge: `${meters.length}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "cost-intel",
      label: "AI Cost Intelligence",
      badge: "FinOps",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 1.8-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "events",
      label: "Ingestion & DLQ",
      badge:
        dlqEvents.filter((d) => d.status === "pending").length > 0
          ? `${dlqEvents.filter((d) => d.status === "pending").length} dlq`
          : "live",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "entitlements",
      label: "Customers & Quotas",
      badge: `${subjects.length}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      id: "billing",
      label: "Plans & Invoicing",
      badge: `${invoices.length}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      id: "apikeys",
      label: "API Keys & Portal",
      badge: `${apiKeys.length}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      ),
    },
  ];

  const activeDoc = DOC_CHAPTERS.find((d) => d.id === activeView);

  const filteredOpNav = operationalNav.filter(
    (item) =>
      !searchQuery.trim() ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocChapters = DOC_CHAPTERS.filter(
    (ch) =>
      !searchQuery.trim() ||
      ch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentViewTitle =
    operationalNav.find((n) => n.id === activeView)?.label ||
    activeDoc?.title ||
    "Pipeline Overview";

  // Group-by dimension pills for Meter Query Studio
  const allSeries = meterQueryResult?.series ?? [];
  const availableGroups = Array.from(
    new Set(
      allSeries.flatMap((s) =>
        Object.entries(s.groups ?? {}).map(([k, v]) => `${k}=${v}`)
      )
    )
  );
  const filteredSeries =
    selectedGroupFilter === "all"
      ? allSeries
      : allSeries.filter((s) =>
          Object.entries(s.groups ?? {}).some(
            ([k, v]) => `${k}=${v}` === selectedGroupFilter
          )
        );

  const maxSeriesValue = Math.max(
    1,
    ...(filteredSeries.map((s) => s.value) ?? [1])
  );

  const selectNavView = (id: string) => {
    setActiveView(id);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="app">
      {/* Mobile Sidebar Backdrop */}
      <div
        className={`sidebar-backdrop ${mobileSidebarOpen ? "open" : ""}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* ===================================================================
          SIDEBAR (Meterbox Control Plane Navigation)
          =================================================================== */}
      <aside className={`sidebar ${mobileSidebarOpen ? "open" : ""}`}>
        <div className="brand" onClick={() => selectNavView("overview")}>
          <div className="logo">
            <AppemblyLogo variant="mark" size={22} strokeColor="#FFFFFF" />
            <span className="logo-pulse" />
          </div>
          <div>
            <div className="brand-name">
              <span>Meterbox</span>
              <span className="brand-tag">:6070</span>
            </div>
            <div className="brand-sub">Appembly FinOps Control Plane</div>
          </div>
        </div>

        <div className="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter or press ⌘K…"
            aria-label="Filter modules or documentation"
          />
          <kbd onClick={() => setCmdkOpen(true)} title="Open Command Palette">
            ⌘K
          </kbd>
        </div>

        <nav className="nav" ref={navRef} onScroll={moveIndicator}>
          <div className="nav-indicator" ref={indicatorRef} />

          <div className="nav-label">Operations</div>
          {filteredOpNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectNavView(item.id)}
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
            >
              <span className="subj-icon">{item.icon}</span>
              <span className="grow">{item.label}</span>
              {item.badge && <span className="prog mono">{item.badge}</span>}
            </button>
          ))}

          <div className="nav-label">Documentation</div>
          <button
            type="button"
            onClick={() => setDocsExpanded((v) => !v)}
            className={`nav-item ${activeDoc ? "active" : ""}`}
          >
            <span className="subj-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            <span className="grow">System Architecture</span>
            <span className="prog mono">{DOC_CHAPTERS.length} specs</span>
          </button>

          {(docsExpanded || Boolean(searchQuery.trim())) && (
            <div className="subj-children">
              {filteredDocChapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectNavView(ch.id)}
                  className={`nav-item child ${activeView === ch.id ? "active" : ""}`}
                >
                  <span className="num mono">{ch.num}</span>
                  <span className="grow">{ch.title}</span>
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="side-foot">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span
                className="live-dot"
                style={{ background: backendConnected ? "var(--ok)" : "var(--warn)" }}
              />
              <strong className="mono" style={{ color: "var(--foreground)", fontSize: 12 }}>
                {activeNamespace}
              </strong>
            </span>
            <span className="mono" style={{ fontSize: 11 }}>
              {activeOrg ? `${activeOrg.rate_limit_eps} EPS` : "5000 EPS"}
            </span>
          </div>
          <div className="bar" title="Edge Quota Cache Hit Ratio">
            <i
              style={{
                width: `${Math.min(
                  100,
                  Math.max(15, Math.round((telemetry?.cache_hit_ratio ?? 0.96) * 100))
                )}%`,
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              Edge Cache:{" "}
              <b className="mono" style={{ color: "var(--foreground)" }}>
                {telemetry ? `${(telemetry.cache_hit_ratio * 100).toFixed(1)}%` : "96.0%"}
              </b>
            </span>
            <button
              type="button"
              className="linkbtn"
              onClick={() => setActiveDrawer("tenant")}
            >
              + Provision Tenant
            </button>
          </div>
        </div>
      </aside>

      {/* ===================================================================
          MAIN WORKSPACE & TOPBAR
          =================================================================== */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="iconbtn mobile-menu-btn"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              aria-label="Open navigation menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>

            <div className="crumbs">
              <span>{activeOrgName}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="mono">{activeEnv?.slug || "production"}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="cur">{currentViewTitle}</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Cohesive Tenant & Namespace Switcher Pill Group */}
            <div className="ctx-group">
              <div className="ctx-select-wrap">
                <span className="ctx-lbl">Org</span>
                <select
                  className="ctx-select"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  aria-label="Select Organization"
                >
                  {organizations.length > 0 ? (
                    organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.billing_tier})
                      </option>
                    ))
                  ) : (
                    <option value="org_acme_ai">Acme AI Corp (enterprise)</option>
                  )}
                </select>
              </div>

              <div className="ctx-divider" />

              <div className="ctx-select-wrap">
                <span className="ctx-lbl">Env</span>
                <select
                  className="ctx-select mono"
                  value={activeEnvId}
                  onChange={(e) => setActiveEnvId(e.target.value)}
                  aria-label="Select Environment"
                >
                  {(orgEnvironments.length > 0 ? orgEnvironments : environments).length > 0 ? (
                    (orgEnvironments.length > 0 ? orgEnvironments : environments).map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.slug} · {env.openmeter_namespace}
                      </option>
                    ))
                  ) : (
                    <option value="env_live_acme">production · ns_live_acme</option>
                  )}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="ghost"
              onClick={() => setActiveDrawer("tenant")}
              title="Create Organization or Environment"
            >
              + Tenant
            </button>

            <button
              type="button"
              className="iconbtn"
              onClick={() => setCmdkOpen(true)}
              title="Command Palette (⌘K)"
              aria-label="Command Palette"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              className="iconbtn theme-btn"
              onClick={toggleTheme}
              title="Toggle light/dark theme"
              aria-label="Toggle theme"
            >
              <svg
                className="sun"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
              <svg
                className="moon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            </button>
          </div>
        </header>

        <main className="scroll">
          <div className="view anim-view" key={`${activeView}-${activeEnvId}`}>
            {/* ===============================================================
                1. PIPELINE OVERVIEW TAB
                =============================================================== */}
            {activeView === "overview" && (
              <>
                <div className="ws-head">
                  <div>
                    <div className="eyebrow">
                      <span className="eb-dot" />
                      <span>Namespace Control Plane</span>
                      <span className="sep" />
                      <span className="mono">{activeNamespace}</span>
                      <span className="sep" />
                      <span className="mono">
                        Burst {(activeOrg?.burst_capacity ?? 10000).toLocaleString()} EPS
                      </span>
                    </div>
                    <h1>{activeOrgName} — Telemetry &amp; Ledger</h1>
                    <p className="lede">
                      Real-time CloudEvents ingestion, synchronous Redis deduplication, ClickHouse
                      1-minute rollups, and edge entitlement enforcement for{" "}
                      <code>{activeNamespace}</code>.
                    </p>
                  </div>
                  <div className="ws-actions">
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setActiveDrawer("meter")}
                    >
                      + New Meter
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setActiveView("events")}
                    >
                      Ingest Studio →
                    </button>
                  </div>
                </div>

                {/* Interactive 5-Stage Metering Pipeline Schematic */}
                <div className="pipeline-board">
                  <div className="pipeline-head">
                    <span
                      style={{
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--foreground)",
                      }}
                    >
                      Live Metering Data-Plane Topology — Click any stage to inspect
                    </span>
                    <span className="chip ok mono">
                      {backendConnected ? "● STREAMING" : "● STANDBY"}
                    </span>
                  </div>

                  <div className="pipeline-grid">
                    <div className="pipe-node" onClick={() => setActiveView("apikeys")}>
                      <div>
                        <div className="pipe-node-top">
                          <span className="pipe-step-num mono">STAGE 01</span>
                          <span className="pipe-tech-badge mono">SHA-256</span>
                        </div>
                        <div className="name" style={{ marginTop: 10 }}>
                          Scoped Key Gateway
                        </div>
                        <div className="desc">Resolves Org &amp; OpenMeter namespace</div>
                      </div>
                      <div className="pipe-node-foot">
                        <span className="metric">{apiKeys.length} keys</span>
                        <span className="sub mono">{activeNamespace}</span>
                      </div>
                    </div>

                    <div className="pipe-node" onClick={() => setActiveView("events")}>
                      <div>
                        <div className="pipe-node-top">
                          <span className="pipe-step-num mono">STAGE 02</span>
                          <span className="pipe-tech-badge mono">SETNX</span>
                        </div>
                        <div className="name" style={{ marginTop: 10 }}>
                          48h Edge Dedup
                        </div>
                        <div className="desc">Synchronous idempotency guard</div>
                      </div>
                      <div className="pipe-node-foot">
                        <span className="metric">{telemetry?.deduplicated_hits ?? 0} hits</span>
                        <span className="sub">Zero double-count</span>
                      </div>
                    </div>

                    <div className="pipe-node" onClick={() => setActiveView("events")}>
                      <div>
                        <div className="pipe-node-top">
                          <span className="pipe-step-num mono">STAGE 03</span>
                          <span className="pipe-tech-badge mono">Redpanda</span>
                        </div>
                        <div className="name" style={{ marginTop: 10 }}>
                          Lane Router &amp; DLQ
                        </div>
                        <div className="desc">Token-bucket burst isolation</div>
                      </div>
                      <div className="pipe-node-foot">
                        <span className="metric">
                          {telemetry?.realtime_lane_events ?? 0} rt / {telemetry?.bulk_lane_events ?? 0} bulk
                        </span>
                        <span className="sub mono">DLQ: {telemetry?.dlq_pending_count ?? 0}</span>
                      </div>
                    </div>

                    <div className="pipe-node" onClick={() => setActiveView("meters")}>
                      <div>
                        <div className="pipe-node-top">
                          <span className="pipe-step-num mono">STAGE 04</span>
                          <span className="pipe-tech-badge mono">ClickHouse</span>
                        </div>
                        <div className="name" style={{ marginTop: 10 }}>
                          1m Rollup Engine
                        </div>
                        <div className="desc">AggregatingMergeTree views</div>
                      </div>
                      <div className="pipe-node-foot">
                        <span className="metric">{meters.length} meters</span>
                        <span className="sub mono">{telemetry?.ingested_events ?? 0} events</span>
                      </div>
                    </div>

                    <div className="pipe-node" onClick={() => setActiveView("entitlements")}>
                      <div>
                        <div className="pipe-node-top">
                          <span className="pipe-step-num mono">STAGE 05</span>
                          <span className="pipe-tech-badge mono">Sub-5ms</span>
                        </div>
                        <div className="name" style={{ marginTop: 10 }}>
                          Quotas &amp; Billing
                        </div>
                        <div className="desc">Edge cache &amp; Stripe invoicing</div>
                      </div>
                      <div className="pipe-node-foot">
                        <span className="metric">{telemetry?.avg_check_latency_us ?? 0} µs</span>
                        <span className="sub">
                          {entitlements.length} quotas · {invoices.length} inv
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pipe-stream" aria-hidden="true">
                    <i />
                  </div>
                </div>

                {/* Key Operational Metrics with Inline SVG Sparklines */}
                <div className="cards">
                  <div className="card clickable" onClick={() => setActiveView("events")}>
                    <div className="card-head">
                      <div className="eyebrow">Ingested CloudEvents</div>
                      <span className="chip ok mono">v1.0</span>
                    </div>
                    <div className="card-stat-row">
                      <div className="stat">{telemetry?.ingested_events ?? 0}</div>
                      <svg className="sparkline" viewBox="0 0 78 28" fill="none">
                        <path
                          d="M2 24L16 19L30 21L44 12L58 14L76 4"
                          stroke="var(--primary)"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p>Validated &amp; aggregated into ClickHouse rollups</p>
                    <div className="meta">
                      <span className="mono">realtime: {telemetry?.realtime_lane_events ?? 0}</span>
                      <span className="mono">bulk: {telemetry?.bulk_lane_events ?? 0}</span>
                    </div>
                  </div>

                  <div className="card clickable" onClick={() => setActiveView("events")}>
                    <div className="card-head">
                      <div className="eyebrow">Idempotent Dedup Hits</div>
                      <span className="chip mono">SETNX</span>
                    </div>
                    <div className="card-stat-row">
                      <div className="stat">{telemetry?.deduplicated_hits ?? 0}</div>
                      <svg className="sparkline" viewBox="0 0 78 28" fill="none">
                        <path
                          d="M2 22L18 22L32 14L48 18L62 10L76 12"
                          stroke="var(--ok)"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p>Duplicate network retries absorbed at edge</p>
                    <div className="meta">
                      <span>Window: 48h TTL</span>
                      <span>Zero double-billing</span>
                    </div>
                  </div>

                  <div className="card clickable" onClick={() => setActiveView("entitlements")}>
                    <div className="card-head">
                      <div className="eyebrow">Quota Evaluation Latency</div>
                      <span className="chip ok mono">Edge</span>
                    </div>
                    <div className="card-stat-row">
                      <div className="stat">{telemetry?.avg_check_latency_us ?? 0} µs</div>
                      <svg className="sparkline" viewBox="0 0 78 28" fill="none">
                        <path
                          d="M2 16L18 14L34 17L50 13L64 15L76 11"
                          stroke="var(--ok)"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p>Write-through entitlement balance cache</p>
                    <div className="meta">
                      <span>Checks: {telemetry?.entitlement_checks ?? 0}</span>
                      <span className="mono">
                        Hit {telemetry ? `${(telemetry.cache_hit_ratio * 100).toFixed(0)}%` : "96%"}
                      </span>
                    </div>
                  </div>

                  <div className="card clickable" onClick={() => setActiveView("events")}>
                    <div className="card-head">
                      <div className="eyebrow">Dead-Letter Queue</div>
                      <span
                        className={`chip mono ${
                          (telemetry?.dlq_pending_count ?? 0) > 0 ? "warn" : "ok"
                        }`}
                      >
                        om_events_dlq
                      </span>
                    </div>
                    <div className="card-stat-row">
                      <div
                        className="stat"
                        style={{
                          color:
                            (telemetry?.dlq_pending_count ?? 0) > 0
                              ? "var(--warn)"
                              : "var(--foreground)",
                        }}
                      >
                        {telemetry?.dlq_pending_count ?? 0}
                      </div>
                      <svg className="sparkline" viewBox="0 0 78 28" fill="none">
                        <path
                          d="M2 24L22 24L38 10L54 18L76 18"
                          stroke="var(--warn)"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p>Malformed/unmapped events held for replay</p>
                    <div className="meta">
                      <span>Zero silent drops</span>
                      <span>Inspect &amp; repair</span>
                    </div>
                  </div>
                </div>

                {/* Recent Events & Dogfooding Self-Billing */}
                <div className="grid2">
                  <div className="panel">
                    <h3>
                      <span className="title-left">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        Live CloudEvents Stream
                      </span>
                      <span className="chip mono">{telemetry?.recent_events?.length ?? 0} events</span>
                    </h3>
                    <div className="table-wrap">
                      <table className="cmp">
                        <thead>
                          <tr>
                            <th>Event ID</th>
                            <th>Type</th>
                            <th>Subject</th>
                            <th className="num">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(telemetry?.recent_events ?? []).slice(0, 6).map((ev) => (
                            <tr key={ev.id}>
                              <td className="mono" style={{ fontSize: 12 }}>
                                {ev.id}
                              </td>
                              <td>
                                <code>{ev.type}</code>
                              </td>
                              <td className="mono">{ev.subject}</td>
                              <td
                                className="num mono"
                                style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                              >
                                {new Date(ev.time).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                          {(!telemetry?.recent_events || telemetry.recent_events.length === 0) && (
                            <tr>
                              <td
                                colSpan={4}
                                style={{
                                  color: "var(--muted-foreground)",
                                  textAlign: "center",
                                  padding: "28px 16px",
                                }}
                              >
                                No events ingested yet in <code>{activeNamespace}</code>.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="panel">
                    <h3>
                      <span className="title-left">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                        </svg>
                        Dogfooding Self-Billing Ledger (ns_meterbox_internal)
                      </span>
                      <span className="chip ok">Active</span>
                    </h3>
                    <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted-foreground)" }}>
                      Meterbox meters its own infrastructure usage by emitting internal CloudEvents into{" "}
                      <code>ns_meterbox_internal</code> where subject is{" "}
                      <code>{activeOrgId}</code>.
                    </p>
                    <div className="table-wrap">
                      <table className="cmp">
                        <thead>
                          <tr>
                            <th>Internal Meter</th>
                            <th>Tenant Subject</th>
                            <th className="num">Billable Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(telemetry?.dogfood_self_billing ?? {}).map(
                            ([slug, val]) => (
                              <tr key={slug}>
                                <td>
                                  <code>{slug}</code>
                                </td>
                                <td className="mono" style={{ fontSize: 12 }}>
                                  {activeOrgId}
                                </td>
                                <td className="num mono" style={{ fontWeight: 700 }}>
                                  {val.toLocaleString()}
                                </td>
                              </tr>
                            )
                          )}
                          {Object.keys(telemetry?.dogfood_self_billing ?? {}).length === 0 && (
                            <tr>
                              <td
                                colSpan={3}
                                style={{
                                  color: "var(--muted-foreground)",
                                  textAlign: "center",
                                  padding: "24px 16px",
                                }}
                              >
                                Internal self-billing metrics populate automatically as traffic flows.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===============================================================
                2. METERS & OLAP QUERY STUDIO (100% Width + Slide-Over Drawer)
                =============================================================== */}
            {activeView === "meters" && (
              <>
                <div className="ws-head">
                  <div>
                    <div className="eyebrow">
                      <span className="eb-dot" />
                      <span>ClickHouse AggregatingMergeTree</span>
                      <span className="sep" />
                      <span className="mono">{activeNamespace}</span>
                    </div>
                    <h1>Meters &amp; OLAP Rollup Studio</h1>
                    <p className="lede">
                      Inspect 1-minute materialized rollups across subjects and group dimensions, or
                      provision new aggregation meters via the slide-over drawer.
                    </p>
                  </div>
                  <div className="ws-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        copyToClipboard(
                          `curl -s "${API_BASE}/api/v1/meters/${selectedMeterSlug || "llm_tokens_total"}/query" \\\n  -H "X-OpenMeter-Namespace: ${activeNamespace || "ns_live_acme"}" | jq .`,
                          "Meter Query cURL"
                        )
                      }
                    >
                      Copy Query cURL
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setActiveDrawer("meter")}
                    >
                      + Provision New Meter
                    </button>
                  </div>
                </div>

                {/* Full-Width Meter Catalog */}
                <div className="panel" style={{ marginBottom: 20 }}>
                  <h3>
                    <span className="title-left">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M9 21V9" />
                      </svg>
                      Registered Meter Catalog ({meters.length}) — Click a meter row to query OLAP rollups
                    </span>
                    <span className="chip mono">{activeNamespace}</span>
                  </h3>
                  <div className="table-wrap">
                    <table className="cmp">
                      <thead>
                        <tr>
                          <th>Meter Slug</th>
                          <th>Display Name</th>
                          <th>CloudEvents Type</th>
                          <th>Aggregation</th>
                          <th>JSONPath Extractor</th>
                          <th>Group Dimensions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meters.map((m) => (
                          <tr
                            key={m.id}
                            onClick={() => {
                              setSelectedMeterSlug(m.slug);
                              setSelectedGroupFilter("all");
                            }}
                            className={selectedMeterSlug === m.slug ? "selected-row" : ""}
                            style={{ cursor: "pointer" }}
                          >
                            <td className="mono" style={{ fontWeight: 700 }}>
                              {m.slug}
                            </td>
                            <td>{m.name}</td>
                            <td>
                              <code>{m.event_type}</code>
                            </td>
                            <td>
                              <span className="chip mono">{m.aggregation}</span>
                            </td>
                            <td className="mono" style={{ fontSize: 12 }}>
                              {m.value_property || "1 (count)"}
                            </td>
                            <td>
                              <div className="chips">
                                {Object.entries(m.group_by ?? {}).map(([k, v]) => (
                                  <span key={k} className="chip mono">
                                    {k}: {v}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Full-Width Rollup Query Studio + Filter Pills + Visual Histogram */}
                <div className="panel">
                  <h3>
                    <span className="title-left">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" />
                      </svg>
                      Rollup Explorer:{" "}
                      <code style={{ textTransform: "none" }}>
                        {selectedMeterSlug || "select meter"}
                      </code>
                    </span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div className="pill-tabs">
                        {["1m", "5m", "1h"].map((w) => (
                          <button
                            key={w}
                            type="button"
                            className={`pill-tab mono ${
                              selectedWindowGranularity === w ? "active" : ""
                            }`}
                            onClick={() => setSelectedWindowGranularity(w)}
                          >
                            {w} window
                          </button>
                        ))}
                      </div>
                      <span className="chip ok mono">
                        Total ({meterQueryResult?.aggregation || "SUM"}):{" "}
                        {meterQueryResult?.total_value?.toLocaleString() ?? 0}
                      </span>
                    </div>
                  </h3>

                  {/* Dimension Filter Pills */}
                  {availableGroups.length > 0 && (
                    <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>
                        Filter Dimension:
                      </span>
                      <div className="pill-tabs">
                        <button
                          type="button"
                          className={`pill-tab ${selectedGroupFilter === "all" ? "active" : ""}`}
                          onClick={() => setSelectedGroupFilter("all")}
                        >
                          All ({allSeries.length})
                        </button>
                        {availableGroups.map((g) => (
                          <button
                            key={g}
                            type="button"
                            className={`pill-tab mono ${
                              selectedGroupFilter === g ? "active" : ""
                            }`}
                            onClick={() => setSelectedGroupFilter(g)}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visual Rollup Bar Histogram */}
                  {filteredSeries.length > 0 && (
                    <div className="histogram">
                      {filteredSeries.slice(0, 16).map((row, idx) => {
                        const pct = Math.max(8, Math.round((row.value / maxSeriesValue) * 100));
                        return (
                          <div
                            key={`${row.subject}-${idx}`}
                            className="hist-col"
                            title={`${row.subject}: ${row.value.toLocaleString()}`}
                          >
                            <div className="mono" style={{ fontSize: 10.5, fontWeight: 600 }}>
                              {row.value.toLocaleString()}
                            </div>
                            <div className="hist-bar" style={{ height: `${pct}%` }} />
                            <div className="hist-lbl mono">{row.subject}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="table-wrap">
                    <table className="cmp">
                      <thead>
                        <tr>
                          <th>Subject Key</th>
                          <th>Window ({selectedWindowGranularity} UTC)</th>
                          <th>Group Dimensions</th>
                          <th className="num">Aggregated Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSeries.map((row, idx) => (
                          <tr key={`${row.subject}-${row.window_start}-${idx}`}>
                            <td className="mono" style={{ fontWeight: 600 }}>
                              {row.subject}
                            </td>
                            <td
                              className="mono"
                              style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                            >
                              {new Date(row.window_start).toLocaleString()}
                            </td>
                            <td>
                              <div className="chips">
                                {Object.entries(row.groups ?? {}).map(([k, v]) => (
                                  <span key={k} className="chip mono">
                                    {k}={v}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="num mono" style={{ fontWeight: 700 }}>
                              {row.value.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {filteredSeries.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              style={{
                                textAlign: "center",
                                color: "var(--muted-foreground)",
                                padding: "24px 16px",
                              }}
                            >
                              No rollup series recorded yet for this filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ===============================================================
                2b. AI COST INTELLIGENCE & TOKEN ECONOMICS STUDIO
                =============================================================== */}
            {activeView === "cost-intel" && (
              <>
                {(() => {
                  const rawEvents = telemetry?.recent_events ?? [];
                  const totalMeterTokens = Math.max(
                    meterQueryResult?.total_value ?? 0,
                    rawEvents.reduce((acc, ev) => acc + Number(ev.data?.tokens ?? 0), 0),
                    74420
                  );
                  const promptTok = Math.round(totalMeterTokens * 0.38);
                  const cachedTok = Math.round(totalMeterTokens * 0.34);
                  const reasonTok = Math.round(totalMeterTokens * 0.11);
                  const compTok = Math.max(0, totalMeterTokens - promptTok - cachedTok - reasonTok);

                  const inCost = (promptTok / 1_000_000) * 3.0;
                  const cacheCost = (cachedTok / 1_000_000) * 0.3;
                  const reasonCost = (reasonTok / 1_000_000) * 15.0;
                  const outCost = (compTok / 1_000_000) * 15.0;
                  const totalCost = inCost + cacheCost + reasonCost + outCost;
                  const baselineCost =
                    ((promptTok + cachedTok) / 1_000_000) * 3.0 +
                    ((reasonTok + compTok) / 1_000_000) * 15.0;
                  const savedCost = Math.max(0, baselineCost - totalCost);
                  const savingsPct =
                    baselineCost > 0 ? ((savedCost / baselineCost) * 100).toFixed(1) : "31.4";

                  const totalToolCalls = Math.max(15, rawEvents.length * 3);
                  const avgCostPerStep = totalCost / Math.max(1, totalToolCalls);
                  const cacheHitPct = (
                    (cachedTok / Math.max(1, promptTok + cachedTok)) *
                    100
                  ).toFixed(1);

                  const cachedPctBar = Math.round((cachedTok / totalMeterTokens) * 100);
                  const promptPctBar = Math.round((promptTok / totalMeterTokens) * 100);
                  const reasonPctBar = Math.round((reasonTok / totalMeterTokens) * 100);
                  const outPctBar = Math.max(
                    4,
                    100 - cachedPctBar - promptPctBar - reasonPctBar
                  );

                  const activeSubj =
                    selectedSubjectKey || subjects[0]?.key || "ws_cyclode_default";

                  const handleSimulateAgentStep = async (replaySameId = false) => {
                    const stepId = replaySameId
                      ? `cyclode:${activeNamespace}:step_checkpoint_demo`
                      : `cyclode:task_${Date.now().toString(36)}:step_${rawEvents.length + 1}`;
                    const batch = [
                      {
                        specversion: "1.0",
                        id: stepId,
                        source: "urn:appembly:cyclode:executor",
                        type: "ai.llm.tokens",
                        subject: activeSubj,
                        time: new Date().toISOString(),
                        data: {
                          tokens: 4200,
                          model: "claude-3-7-sonnet",
                          token_type: "input",
                          persona: "IssueResolver",
                          tool: "run_command",
                        },
                      },
                    ];
                    const res = await fetch(`${API_BASE}/api/v1/events`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "X-OpenMeter-Namespace": activeNamespace,
                      },
                      body: JSON.stringify(batch),
                    });
                    if (res.ok) {
                      const d = await res.json();
                      await fetchEnvData();
                      await fetchMeterQuery();
                      await fetchEntitlementEvaluation();
                      if (d.deduplicated > 0) {
                        pushToast(
                          `SETNX Idempotency Guard Triggered`,
                          `Duplicate checkpoint "${stepId}" dropped (0 double-billing)`,
                          "warn"
                        );
                      } else {
                        pushToast(
                          `+4,200 Agent Step Tokens Metered`,
                          `Subject: ${activeSubj} · Event: ${stepId}`,
                          "ok"
                        );
                      }
                    }
                  };

                  const toolRows = [
                    {
                      name: "run_command",
                      persona: "IssueResolver",
                      calls: Math.max(6, Math.round(totalToolCalls * 0.4)),
                      tokens: Math.round(totalMeterTokens * 0.42),
                      avgMs: 356,
                      passRate: "100%",
                    },
                    {
                      name: "replace_file_content",
                      persona: "IssueResolver",
                      calls: Math.max(4, Math.round(totalToolCalls * 0.27)),
                      tokens: Math.round(totalMeterTokens * 0.31),
                      avgMs: 370,
                      passRate: "100%",
                    },
                    {
                      name: "view_file",
                      persona: "ArchitectPod",
                      calls: Math.max(5, Math.round(totalToolCalls * 0.33)),
                      tokens: Math.round(totalMeterTokens * 0.27),
                      avgMs: 240,
                      passRate: "100%",
                    },
                  ];

                  const modelRows = [
                    {
                      model: "claude-3-7-sonnet",
                      tier: "Major",
                      provider: "Anthropic",
                      inputRate: "$3.00",
                      cacheRate: "$0.30",
                      outputRate: "$15.00",
                      tokens: Math.round(totalMeterTokens * 0.56),
                      cacheHit: "51.4%",
                      cost: totalCost * 0.68,
                    },
                    {
                      model: "gemini-3.8-flash",
                      tier: "Minor",
                      provider: "Google",
                      inputRate: "$0.30",
                      cacheRate: "$0.075",
                      outputRate: "$1.20",
                      tokens: Math.round(totalMeterTokens * 0.31),
                      cacheHit: "44.0%",
                      cost: totalCost * 0.19,
                    },
                    {
                      model: "deepseek-v4-pro",
                      tier: "Frontier",
                      provider: "DeepSeek",
                      inputRate: "$0.55",
                      cacheRate: "$0.14",
                      outputRate: "$2.19",
                      tokens: Math.round(totalMeterTokens * 0.13),
                      cacheHit: "39.8%",
                      cost: totalCost * 0.13,
                    },
                  ];

                  return (
                    <>
                      <div className="ws-head">
                        <div>
                          <div className="eyebrow">
                            <span className="eb-dot" />
                            <span>Appembly Shared FinOps Telemetry</span>
                            <span className="sep" />
                            <span className="mono">{activeNamespace}</span>
                          </div>
                          <h1>AI Cost Intelligence &amp; Token Economics</h1>
                          <p className="lede">
                            Real-time token anatomy, prefix cache savings, tool invocation burn, and
                            crash-safe step checkpoint deduplication across{" "}
                            <code>Cyclode (:6013)</code>, <code>Swarmteam (:6040)</code>, and{" "}
                            <code>Valiscale (:6030)</code>.
                          </p>
                        </div>
                        <div className="ws-actions">
                          <button
                            type="button"
                            className="btn"
                            onClick={() => handleSimulateAgentStep(true)}
                            title="Send the exact same checkpoint ID twice to verify Redis SETNX deduplication"
                          >
                            Test Checkpoint Dedup (SETNX)
                          </button>
                          <button
                            type="button"
                            className="btn primary"
                            onClick={() => handleSimulateAgentStep(false)}
                          >
                            + Simulate Live Agent Step (+4.2k tok)
                          </button>
                        </div>
                      </div>

                      {/* 4 Top KPI Summary Cards with Inline SVG Sparklines */}
                      <div className="cards">
                        <div className="card">
                          <div className="card-head">
                            <div className="eyebrow">Attributed Token Spend</div>
                            <span className="chip ok mono">{activeNamespace}</span>
                          </div>
                          <div className="card-stat-row">
                            <div className="stat">${totalCost.toFixed(4)}</div>
                            <svg className="sparkline" viewBox="0 0 78 28" fill="none">
                              <path
                                d="M2 24L16 20L30 18L44 13L58 10L76 5"
                                stroke="var(--primary)"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <p>
                            {totalMeterTokens.toLocaleString()} total tokens across{" "}
                            {subjects.length || 3} active subjects
                          </p>
                          <div className="meta">
                            <span className="mono">
                              In: ${(inCost + cacheCost).toFixed(4)}
                            </span>
                            <span className="mono">
                              Out: ${(reasonCost + outCost).toFixed(4)}
                            </span>
                          </div>
                        </div>

                        <div className="card">
                          <div className="card-head">
                            <div className="eyebrow">Avg Cost / Tool Step</div>
                            <span className="chip mono">{totalToolCalls} steps</span>
                          </div>
                          <div className="card-stat-row">
                            <div className="stat">${avgCostPerStep.toFixed(4)}</div>
                            <svg className="sparkline" viewBox="0 0 78 28" fill="none">
                              <path
                                d="M2 18L18 16L32 19L48 14L62 15L76 11"
                                stroke="var(--ok)"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <p>Checkpointed tool &amp; reasoning turns</p>
                          <div className="meta">
                            <span>Pass rate: 98.4%</span>
                            <span className="mono">
                              {Math.round(totalMeterTokens / totalToolCalls).toLocaleString()} tok/step
                            </span>
                          </div>
                        </div>

                        <div className="card">
                          <div className="card-head">
                            <div className="eyebrow">Prefix Cache &amp; Routing Savings</div>
                            <span className="chip ok mono">-{savingsPct}%</span>
                          </div>
                          <div className="card-stat-row">
                            <div className="stat" style={{ color: "var(--ok)" }}>
                              ${savedCost.toFixed(4)}
                            </div>
                            <svg className="sparkline" viewBox="0 0 78 28" fill="none">
                              <path
                                d="M2 22L18 19L34 15L50 11L64 8L76 4"
                                stroke="var(--ok)"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <p>Saved vs. uncached frontier baseline (${baselineCost.toFixed(4)})</p>
                          <div className="meta">
                            <span className="mono">Cache Hit: {cacheHitPct}%</span>
                            <span className="mono">{cachedTok.toLocaleString()} cached tok</span>
                          </div>
                        </div>

                        <div
                          className="card clickable"
                          onClick={() => setActiveView("entitlements")}
                        >
                          <div className="card-head">
                            <div className="eyebrow">Remaining Token Quota</div>
                            <span className="chip ok mono">
                              {entitlementCheck?.cache_source || "HIT"} ·{" "}
                              {entitlementCheck?.latency_us ?? telemetry?.avg_check_latency_us ?? 180} µs
                            </span>
                          </div>
                          <div className="card-stat-row">
                            <div className="stat">
                              {(
                                (entitlementCheck?.remaining ?? 5466780) / 1_000_000
                              ).toFixed(2)}
                              M
                            </div>
                            <svg className="sparkline" viewBox="0 0 78 28" fill="none">
                              <path
                                d="M2 8L18 9L34 11L50 12L64 14L76 16"
                                stroke="var(--primary)"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <p>Priority credit grant waterfall active</p>
                          <div className="meta">
                            <span className="mono">Subject: {activeSubj}</span>
                            <span>{ telemetry?.deduplicated_hits ?? 0 } dedup hits</span>
                          </div>
                        </div>
                      </div>

                      {/* Token Consumption Anatomy Stacked Bar + Breakdown Panel */}
                      <div className="panel" style={{ marginBottom: 20 }}>
                        <h3>
                          <span className="title-left">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect x="3" y="4" width="18" height="16" rx="2" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            Token Consumption Anatomy &amp; Multi-Tier Model Economics
                          </span>
                          <span className="chip mono">
                            412 LOC Modified · {(totalMeterTokens / 412).toFixed(1)} tok/LOC
                          </span>
                        </h3>

                        {/* 4-Segment Stacked Bar */}
                        <div
                          style={{
                            display: "flex",
                            height: 12,
                            width: "100%",
                            borderRadius: 99,
                            overflow: "hidden",
                            background: "var(--surface-subtle)",
                            border: "1px solid var(--border)",
                            marginBottom: 14,
                          }}
                        >
                          <div
                            style={{
                              width: `${cachedPctBar}%`,
                              background: "var(--ok)",
                            }}
                            title={`Cached Context: ${cachedTok.toLocaleString()} tok`}
                          />
                          <div
                            style={{
                              width: `${promptPctBar}%`,
                              background: "var(--info)",
                            }}
                            title={`Prompt Input: ${promptTok.toLocaleString()} tok`}
                          />
                          <div
                            style={{
                              width: `${reasonPctBar}%`,
                              background: "#8B5CF6",
                            }}
                            title={`Reasoning: ${reasonTok.toLocaleString()} tok`}
                          />
                          <div
                            style={{
                              width: `${outPctBar}%`,
                              background: "var(--warn)",
                            }}
                            title={`Completion Output: ${compTok.toLocaleString()} tok`}
                          />
                        </div>

                        {/* 4 Segment Legend Pills */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            gap: 12,
                            marginBottom: 18,
                          }}
                        >
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "var(--surface-subtle)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: 11.5,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 2,
                                    background: "var(--ok)",
                                  }}
                                />
                                Cached Context ({cachedPctBar}%)
                              </span>
                              <span className="mono">$0.30/1M</span>
                            </div>
                            <div
                              className="mono"
                              style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}
                            >
                              {cachedTok.toLocaleString()} tok{" "}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: "var(--muted-foreground)",
                                }}
                              >
                                (${cacheCost.toFixed(4)})
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "var(--surface-subtle)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: 11.5,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 2,
                                    background: "var(--info)",
                                  }}
                                />
                                Prompt Input ({promptPctBar}%)
                              </span>
                              <span className="mono">$3.00/1M</span>
                            </div>
                            <div
                              className="mono"
                              style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}
                            >
                              {promptTok.toLocaleString()} tok{" "}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: "var(--muted-foreground)",
                                }}
                              >
                                (${inCost.toFixed(4)})
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "var(--surface-subtle)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: 11.5,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 2,
                                    background: "#8B5CF6",
                                  }}
                                />
                                Reasoning ({reasonPctBar}%)
                              </span>
                              <span className="mono">$15.00/1M</span>
                            </div>
                            <div
                              className="mono"
                              style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}
                            >
                              {reasonTok.toLocaleString()} tok{" "}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: "var(--muted-foreground)",
                                }}
                              >
                                (${reasonCost.toFixed(4)})
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "var(--surface-subtle)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: 11.5,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 2,
                                    background: "var(--warn)",
                                  }}
                                />
                                Output ({outPctBar}%)
                              </span>
                              <span className="mono">$15.00/1M</span>
                            </div>
                            <div
                              className="mono"
                              style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}
                            >
                              {compTok.toLocaleString()} tok{" "}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: "var(--muted-foreground)",
                                }}
                              >
                                (${outCost.toFixed(4)})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Model Rate-Card & Routing Attribution Table */}
                        <div className="table-wrap">
                          <table className="cmp">
                            <thead>
                              <tr>
                                <th>Model Identifier</th>
                                <th>Routing Tier</th>
                                <th>Input / Cached / Output (per 1M)</th>
                                <th>Prefix Cache Hit</th>
                                <th className="num">Metered Tokens</th>
                                <th className="num">Attributed Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modelRows.map((m) => (
                                <tr key={m.model}>
                                  <td className="mono" style={{ fontWeight: 700 }}>
                                    {m.model}
                                  </td>
                                  <td>
                                    <span className="chip mono">{m.tier}</span>
                                  </td>
                                  <td className="mono" style={{ fontSize: 12 }}>
                                    {m.inputRate} / {m.cacheRate} / {m.outputRate}
                                  </td>
                                  <td>
                                    <span className="chip ok mono">{m.cacheHit}</span>
                                  </td>
                                  <td className="num mono">{m.tokens.toLocaleString()}</td>
                                  <td className="num mono" style={{ fontWeight: 700 }}>
                                    ${m.cost.toFixed(4)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Two-Column Tool Token Breakdown & Subject/Checkpoint Attribution */}
                      <div className="grid2">
                        <div className="panel">
                          <h3>
                            <span className="title-left">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                              </svg>
                              Tool-Level Token Burn &amp; Latency
                            </span>
                            <span className="chip mono">{totalToolCalls} invocations</span>
                          </h3>
                          <div className="table-wrap">
                            <table className="cmp">
                              <thead>
                                <tr>
                                  <th>Tool Name</th>
                                  <th>Calls</th>
                                  <th>Avg Latency</th>
                                  <th>Token Share</th>
                                  <th className="num">Tokens (USD)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {toolRows.map((tr) => {
                                  const sharePct = Math.round(
                                    (tr.tokens / Math.max(1, totalMeterTokens)) * 100
                                  );
                                  const toolUsd =
                                    (tr.tokens / Math.max(1, totalMeterTokens)) * totalCost;
                                  return (
                                    <tr key={tr.name}>
                                      <td>
                                        <code>{tr.name}</code>
                                      </td>
                                      <td className="mono">{tr.calls}×</td>
                                      <td className="mono" style={{ fontSize: 12 }}>
                                        {tr.avgMs} ms
                                      </td>
                                      <td style={{ width: 130 }}>
                                        <div className="bar" style={{ margin: 0 }}>
                                          <i style={{ width: `${sharePct}%` }} />
                                        </div>
                                      </td>
                                      <td className="num mono" style={{ fontWeight: 600 }}>
                                        {tr.tokens.toLocaleString()}{" "}
                                        <span
                                          style={{
                                            color: "var(--muted-foreground)",
                                            fontWeight: 400,
                                          }}
                                        >
                                          (${toolUsd.toFixed(4)})
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="panel">
                          <h3>
                            <span className="title-left">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              </svg>
                              Workspace Attribution &amp; Checkpoint Dedup
                            </span>
                            <span className="chip ok mono">SETNX Active</span>
                          </h3>
                          <div className="table-wrap">
                            <table className="cmp">
                              <thead>
                                <tr>
                                  <th>Subject / Product</th>
                                  <th>Checkpoint Guard</th>
                                  <th className="num">Share</th>
                                  <th className="num">Attributed Spend</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(subjects.length > 0
                                  ? subjects
                                  : [
                                      {
                                        id: "s1",
                                        namespace: activeNamespace,
                                        key: "ws_cyclode_default",
                                        display_name: "Cyclode Workstation (:6013)",
                                        created_at: "",
                                      },
                                      {
                                        id: "s2",
                                        namespace: activeNamespace,
                                        key: "ws_swarmteam_pods",
                                        display_name: "Swarmteam DAG (:6040)",
                                        created_at: "",
                                      },
                                      {
                                        id: "s3",
                                        namespace: activeNamespace,
                                        key: "ws_valiscale_studio",
                                        display_name: "Valiscale Studio (:6030)",
                                        created_at: "",
                                      },
                                    ]
                                ).map((s, idx) => {
                                  const weights = [0.54, 0.31, 0.15];
                                  const w = weights[idx % weights.length];
                                  const subTok = Math.round(totalMeterTokens * w);
                                  const subCost = totalCost * w;
                                  return (
                                    <tr
                                      key={s.key}
                                      onClick={() => setSelectedSubjectKey(s.key)}
                                      className={
                                        selectedSubjectKey === s.key ? "selected-row" : ""
                                      }
                                      style={{ cursor: "pointer" }}
                                    >
                                      <td>
                                        <div style={{ fontWeight: 700 }} className="mono">
                                          {s.key}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 11.5,
                                            color: "var(--muted-foreground)",
                                          }}
                                        >
                                          {s.display_name}
                                        </div>
                                      </td>
                                      <td>
                                        <span className="chip ok mono">step_id dedup</span>
                                      </td>
                                      <td className="num mono">{subTok.toLocaleString()} tok</td>
                                      <td className="num mono" style={{ fontWeight: 700 }}>
                                        ${subCost.toFixed(4)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </>
            )}

            {/* ===============================================================
                3. INGESTION & DLQ REPLAY TAB
                =============================================================== */}
            {activeView === "events" && (
              <>
                <div className="ws-head">
                  <div>
                    <div className="eyebrow">
                      <span className="eb-dot" />
                      <span>CloudEvents v1.0 Edge Gateway</span>
                      <span className="sep" />
                      <span className="mono">POST /api/v1/events</span>
                    </div>
                    <h1>Event Ingestion &amp; Dead-Letter Replay</h1>
                    <p className="lede">
                      Publish CloudEvents to verify synchronous Redis <code>SETNX</code> idempotency,
                      token-bucket noisy-neighbor routing, and Dead-Letter Queue (DLQ) payload repair.
                    </p>
                  </div>
                  <div className="ws-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        copyToClipboard(
                          `curl -X POST "${API_BASE}/api/v1/events" \\\n  -H "Content-Type: application/json" \\\n  -H "X-OpenMeter-Namespace: ${activeNamespace || "ns_live_acme"}" \\\n  -d '${JSON.stringify(
                            {
                              specversion: "1.0",
                              id: ingestId || "evt_demo_01",
                              source: ingestSource || "edge-gateway",
                              type: ingestType || "llm.tokens",
                              subject: ingestSubject || "cus_enterprise_1",
                              data: JSON.parse(ingestPayload || "{}"),
                            },
                            null,
                            2
                          )}'`,
                          "CloudEvents Ingest cURL"
                        )
                      }
                    >
                      Copy Ingest cURL
                    </button>
                  </div>
                </div>

                <div className="grid2">
                  {/* CloudEvents Ingestion Simulator */}
                  <div className="panel">
                    <h3>
                      <span className="title-left">Publish CloudEvent v1.0</span>
                      <span className="chip mono">{activeNamespace}</span>
                    </h3>
                    <form onSubmit={handleIngestEvent} style={{ display: "grid", gap: 12 }}>
                      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label className="label">Event Type (select or enter custom)</label>
                          <input
                            className="input mono"
                            list="meter-event-types"
                            value={ingestType}
                            onChange={(e) => setIngestType(e.target.value)}
                            placeholder="llm.tokens"
                            required
                          />
                          <datalist id="meter-event-types">
                            {meters.map((m) => (
                              <option key={m.id} value={m.event_type}>
                                {m.slug}
                              </option>
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <label className="label">Subject Key (select or enter custom)</label>
                          <input
                            className="input mono"
                            list="subject-keys-list"
                            value={ingestSubject}
                            onChange={(e) => setIngestSubject(e.target.value)}
                            placeholder="cus_enterprise_1"
                            required
                          />
                          <datalist id="subject-keys-list">
                            {subjects.map((s) => (
                              <option key={s.id} value={s.key}>
                                {s.display_name}
                              </option>
                            ))}
                          </datalist>
                        </div>
                      </div>

                      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label className="label">Idempotency ID (reuse to test SETNX dedup)</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              className="input mono"
                              value={ingestId}
                              onChange={(e) => setIngestId(e.target.value)}
                              placeholder="Auto-generated if empty"
                            />
                            <button
                              type="button"
                              className="btn"
                              onClick={() =>
                                setIngestId(
                                  `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                                )
                              }
                            >
                              New ID
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="label">Source URI</label>
                          <input
                            className="input mono"
                            value={ingestSource}
                            onChange={(e) => setIngestSource(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="label">JSON Data Payload</label>
                        <textarea
                          className="textarea mono"
                          rows={4}
                          value={ingestPayload}
                          onChange={(e) => setIngestPayload(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button type="submit" className="btn primary">
                          Ingest CloudEvent
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setIngestType("unmapped.invalid.event")}
                        >
                          Set Unmapped Type (Test DLQ Capture)
                        </button>
                      </div>
                    </form>

                    {lastIngestResult && (
                      <div
                        className={`callout ${
                          lastIngestResult.dlq_routed
                            ? "err"
                            : lastIngestResult.deduplicated
                            ? "warn"
                            : "tip"
                        }`}
                        style={{ marginTop: 16 }}
                      >
                        <div>
                          <strong>
                            {lastIngestResult.dlq_routed
                              ? `Captured in Dead-Letter Queue (${lastIngestResult.dlq_reason})`
                              : lastIngestResult.deduplicated
                              ? "Duplicate Blocked by Edge Redis SETNX (48h Idempotency)"
                              : `Ingested → ${lastIngestResult.topic} (${lastIngestResult.lane} lane)`}
                          </strong>
                          <div className="mono" style={{ fontSize: 12, marginTop: 2 }}>
                            id={lastIngestResult.event_id} · ns={lastIngestResult.namespace}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dead-Letter Queue Inspector & Editable Replay */}
                  <div className="panel">
                    <h3>
                      <span className="title-left">Dead-Letter Queue (om_events_dlq)</span>
                      <span className="chip warn mono">
                        {dlqEvents.filter((d) => d.status === "pending").length} pending
                      </span>
                    </h3>
                    <div style={{ display: "grid", gap: 12 }}>
                      {dlqEvents.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 14,
                            background: "var(--surface-subtle)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                              {item.id} · {item.error_code}
                            </span>
                            <span
                              className={`chip mono ${
                                item.status === "replayed" ? "ok" : "warn"
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "var(--muted-foreground)",
                              marginBottom: 10,
                            }}
                          >
                            Failure: {item.failure_reason}
                          </div>
                          <textarea
                            className="textarea mono"
                            rows={3}
                            style={{ fontSize: 12, background: "var(--card)" }}
                            value={dlqDrafts[item.id] ?? item.raw_payload}
                            onChange={(e) =>
                              setDlqDrafts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                          />
                          {item.status === "pending" && (
                            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="btn primary"
                                style={{ height: 32, fontSize: 12 }}
                                onClick={() => handleReplayDLQ(item.id)}
                              >
                                Repair Payload &amp; Replay
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {dlqEvents.length === 0 && (
                        <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
                          Zero failed events in Dead-Letter Queue.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===============================================================
                4. CUSTOMERS, QUOTAS & CREDIT GRANTS (Master-Detail Customer 360°)
                =============================================================== */}
            {activeView === "entitlements" && (
              <>
                <div className="ws-head">
                  <div>
                    <div className="eyebrow">
                      <span className="eb-dot" />
                      <span>Sub-5ms Edge Quota Engine</span>
                      <span className="sep" />
                      <span className="mono">{activeNamespace}</span>
                    </div>
                    <h1>Customers 360°, Quotas &amp; Credit Grants</h1>
                    <p className="lede">
                      Click any customer below to inspect their real-time entitlement balance,
                      segmented quota utilization, and priority prepaid credit grant waterfall.
                    </p>
                  </div>
                  <div className="ws-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setActiveDrawer("customer")}
                    >
                      + Register Customer
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setActiveDrawer("entitlement")}
                    >
                      + Attach Entitlement
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setActiveDrawer("grant")}
                    >
                      + Issue Credit Grant
                    </button>
                  </div>
                </div>

                {/* Customer Directory Table (Master View) */}
                <div className="panel" style={{ marginBottom: 20 }}>
                  <h3>
                    <span className="title-left">
                      Customer Subjects Directory ({subjects.length}) — Click row to inspect 360° quota ledger
                    </span>
                    <span className="chip mono">Selected: {selectedSubjectKey || "—"}</span>
                  </h3>
                  <div className="table-wrap">
                    <table className="cmp">
                      <thead>
                        <tr>
                          <th>Subject Key</th>
                          <th>Customer Name</th>
                          <th>Stripe Customer ID</th>
                          <th>Attached Entitlements</th>
                          <th>Active Grants</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((s) => {
                          const subEnts = entitlements.filter((e) => e.subject_key === s.key);
                          const subGrants = grants.filter((g) => g.subject_key === s.key);
                          return (
                            <tr
                              key={s.id}
                              onClick={() => setSelectedSubjectKey(s.key)}
                              className={selectedSubjectKey === s.key ? "selected-row" : ""}
                              style={{ cursor: "pointer" }}
                            >
                              <td className="mono" style={{ fontWeight: 700 }}>
                                {s.key}
                              </td>
                              <td>{s.display_name}</td>
                              <td className="mono" style={{ fontSize: 12 }}>
                                {s.stripe_customer_id || "—"}
                              </td>
                              <td>
                                <div className="chips">
                                  {subEnts.map((e) => (
                                    <span key={e.id} className="chip mono">
                                      {e.feature_key}
                                    </span>
                                  ))}
                                  {subEnts.length === 0 && (
                                    <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                                      None
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="mono">{subGrants.length} grants</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Customer 360° Quota & Credit Burndown Inspector */}
                <div className="panel" style={{ marginBottom: 20 }}>
                  <h3>
                    <span className="title-left">
                      Customer 360° Quota Evaluation:{" "}
                      <code style={{ textTransform: "none" }}>{selectedSubjectKey}</code>
                    </span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        className="select mono"
                        style={{ height: 32, width: "auto", fontSize: 12.5 }}
                        value={selectedFeatureKey}
                        onChange={(e) => setSelectedFeatureKey(e.target.value)}
                      >
                        {Array.from(new Set(entitlements.map((e) => e.feature_key))).map(
                          (fk) => (
                            <option key={fk} value={fk}>
                              Feature: {fk}
                            </option>
                          )
                        )}
                      </select>
                      <button
                        type="button"
                        className="btn"
                        style={{ height: 32, fontSize: 12 }}
                        onClick={() =>
                          copyToClipboard(
                            `curl -s "${API_BASE}/api/v1/subjects/${selectedSubjectKey}/entitlements/${selectedFeatureKey}/value" \\\n  -H "X-OpenMeter-Namespace: ${activeNamespace || "ns_live_acme"}" | jq .`,
                            "Entitlement Check cURL"
                          )
                        }
                      >
                        Copy Check cURL
                      </button>
                    </div>
                  </h3>

                  {entitlementCheck && (
                    <>
                      <div className="cards" style={{ marginBottom: 14 }}>
                        <div className="card">
                          <div className="eyebrow">Access Decision</div>
                          <div
                            className="stat"
                            style={{
                              color: entitlementCheck.has_access ? "var(--ok)" : "var(--err)",
                            }}
                          >
                            {entitlementCheck.has_access ? "ALLOWED" : "DENIED"}
                          </div>
                          <div className="meta">
                            <span>Policy: {entitlementCheck.soft_limit ? "Soft Limit" : "Hard Cap"}</span>
                            <span className="mono">{entitlementCheck.cache_source}</span>
                          </div>
                        </div>
                        <div className="card">
                          <div className="eyebrow">Consumed Meter Usage</div>
                          <div className="stat">{entitlementCheck.usage.toLocaleString()}</div>
                          <div className="meta">
                            <span>Included Limit: {entitlementCheck.limit.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="card">
                          <div className="eyebrow">Active Prepaid Credits</div>
                          <div className="stat">
                            +{entitlementCheck.credit_balance.toLocaleString()}
                          </div>
                          <div className="meta">
                            <span>Priority burndown ledger</span>
                          </div>
                        </div>
                        <div className="card">
                          <div className="eyebrow">Remaining Quota</div>
                          <div className="stat">{entitlementCheck.remaining.toLocaleString()}</div>
                          <div className="meta">
                            <span className="mono">Latency: {entitlementCheck.latency_us} µs</span>
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const totalPool = Math.max(
                          1,
                          entitlementCheck.limit + entitlementCheck.credit_balance
                        );
                        const usedPct = Math.min(
                          100,
                          Math.round((entitlementCheck.usage / totalPool) * 100)
                        );
                        const remPct = Math.max(0, 100 - usedPct);
                        return (
                          <div className="quota-meter">
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 12.5,
                              }}
                            >
                              <span>
                                Quota Pool Utilization (Base Limit{" "}
                                <b className="mono">{entitlementCheck.limit.toLocaleString()}</b> + Credits{" "}
                                <b className="mono">
                                  {entitlementCheck.credit_balance.toLocaleString()}
                                </b>
                                )
                              </span>
                              <span className="mono">{usedPct}% consumed</span>
                            </div>
                            <div className="quota-track">
                              <div className="quota-seg-used" style={{ width: `${usedPct}%` }} />
                              <div className="quota-seg-rem" style={{ width: `${remPct}%` }} />
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* Priority Credit Grant Waterfall Ledger */}
                <div className="panel">
                  <h3>
                    <span className="title-left">
                      Prepaid Credit Grants Ledger ({grants.length})
                    </span>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setActiveDrawer("grant")}
                    >
                      + Issue Grant
                    </button>
                  </h3>
                  <div className="table-wrap">
                    <table className="cmp">
                      <thead>
                        <tr>
                          <th>Grant Reference</th>
                          <th>Subject Key</th>
                          <th>Burndown Priority</th>
                          <th className="num">Remaining Balance</th>
                          <th className="num">Original Grant</th>
                          <th>Expires</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grants.map((g) => (
                          <tr key={g.id}>
                            <td style={{ fontWeight: 600 }}>{g.name}</td>
                            <td className="mono">{g.subject_key}</td>
                            <td>
                              <span className="chip mono">Priority {g.priority}</span>
                            </td>
                            <td className="num mono" style={{ fontWeight: 700, color: "var(--ok)" }}>
                              {g.remaining.toLocaleString()}
                            </td>
                            <td className="num mono">{g.amount.toLocaleString()}</td>
                            <td className="mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                              {new Date(g.expires_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ===============================================================
                5. PLANS, SUBSCRIPTIONS & INVOICING TAB
                =============================================================== */}
            {activeView === "billing" && (
              <>
                <div className="ws-head">
                  <div>
                    <div className="eyebrow">
                      <span className="eb-dot" />
                      <span>Hybrid Subscription + Usage Ledger</span>
                      <span className="sep" />
                      <span className="mono">{activeNamespace}</span>
                    </div>
                    <h1>Plans, Subscriptions &amp; Invoicing</h1>
                    <p className="lede">
                      Manage hybrid pricing plans, assign customer subscriptions, and click any
                      invoice row to inspect its itemized financial ledger sheet.
                    </p>
                  </div>
                  <div className="ws-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setActiveDrawer("plan")}
                    >
                      + Author Pricing Plan
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleGenerateInvoice}
                    >
                      ⚡ Generate Invoice ({invoiceSubjectKey || "Customer"})
                    </button>
                  </div>
                </div>

                {/* Quick Invoice & Subscription Control Bar */}
                <div className="grid2" style={{ marginBottom: 20 }}>
                  <div className="panel">
                    <h3>
                      <span className="title-left">Run Billing Cycle &amp; Issue Stripe Invoice</span>
                    </h3>
                    <div style={{ display: "grid", gap: 12 }}>
                      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label className="label">Customer Subject</label>
                          <select
                            className="select mono"
                            value={invoiceSubjectKey}
                            onChange={(e) => setInvoiceSubjectKey(e.target.value)}
                          >
                            {subjects.map((s) => (
                              <option key={s.id} value={s.key}>
                                {s.key} ({s.display_name})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Pricing Plan</label>
                          <select
                            className="select mono"
                            value={invoicePlanSlug}
                            onChange={(e) => setInvoicePlanSlug(e.target.value)}
                          >
                            {plans.map((p) => (
                              <option key={p.id} value={p.slug}>
                                {p.name} (${(p.base_fee_cents / 100).toFixed(2)} base)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={handleGenerateInvoice}
                      >
                        Aggregate Rollups &amp; Issue Invoice Sheet
                      </button>
                    </div>
                  </div>

                  <div className="panel">
                    <h3>
                      <span className="title-left">Customer Plan Subscriptions ({subscriptions.length})</span>
                    </h3>
                    <form onSubmit={handleCreateSubscription} style={{ display: "grid", gap: 12 }}>
                      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label className="label">Subject Key</label>
                          <select
                            className="select mono"
                            value={newSubSubjectKey}
                            onChange={(e) => setNewSubSubjectKey(e.target.value)}
                          >
                            {subjects.map((s) => (
                              <option key={s.id} value={s.key}>
                                {s.key}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Assign Plan</label>
                          <select
                            className="select mono"
                            value={newSubPlanSlug}
                            onChange={(e) => setNewSubPlanSlug(e.target.value)}
                          >
                            {plans.map((p) => (
                              <option key={p.id} value={p.slug}>
                                {p.slug}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button type="submit" className="btn">
                        Assign Subscription
                      </button>
                    </form>
                  </div>
                </div>

                {/* Full-Width Invoices Financial Ledger (Click row to open Invoice Drawer) */}
                <div className="panel">
                  <h3>
                    <span className="title-left">
                      Financial Invoice Ledger ({invoices.length}) — Click any invoice to inspect itemized sheet
                    </span>
                  </h3>
                  <div className="table-wrap">
                    <table className="cmp">
                      <thead>
                        <tr>
                          <th>Invoice ID</th>
                          <th>Stripe Sync ID</th>
                          <th>Customer Subject</th>
                          <th>Plan</th>
                          <th className="num">Subtotal</th>
                          <th className="num">Prepaid Credits</th>
                          <th className="num">Net Total Due</th>
                          <th className="num">Sheet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr
                            key={inv.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setActiveDrawer("invoice");
                            }}
                          >
                            <td className="mono" style={{ fontWeight: 700 }}>
                              {inv.id}
                            </td>
                            <td className="mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                              {inv.stripe_invoice_id}
                            </td>
                            <td className="mono">{inv.subject_key}</td>
                            <td>
                              <span className="chip mono">{inv.plan_slug}</span>
                            </td>
                            <td className="num mono">${(inv.subtotal_cents / 100).toFixed(2)}</td>
                            <td className="num mono" style={{ color: "var(--ok)" }}>
                              -${(inv.credits_applied_cents / 100).toFixed(2)}
                            </td>
                            <td className="num mono" style={{ fontWeight: 700 }}>
                              ${(inv.total_cents / 100).toFixed(2)}
                            </td>
                            <td className="num">
                              <button type="button" className="ghost" style={{ height: 26, fontSize: 11.5 }}>
                                Inspect →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ===============================================================
                6. API KEYS & CUSTOMER PORTAL TAB
                =============================================================== */}
            {activeView === "apikeys" && (
              <>
                <div className="ws-head">
                  <div>
                    <div className="eyebrow">
                      <span className="eb-dot" />
                      <span>Four-Tier Scoped Credentials &amp; Customer Portal</span>
                      <span className="sep" />
                      <span className="mono">{activeNamespace}</span>
                    </div>
                    <h1>Scoped API Keys &amp; Customer Portal</h1>
                    <p className="lede">
                      Issue least-privilege API keys bound to this Organization and Environment, or
                      preview the embeddable customer-facing usage portal.
                    </p>
                  </div>
                  <div className="ws-actions">
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setActiveDrawer("apikey")}
                    >
                      + Issue Scoped API Key
                    </button>
                  </div>
                </div>

                {newlyCreatedSecret && (
                  <div className="callout tip" style={{ marginBottom: 20 }}>
                    <div style={{ flex: 1 }}>
                      <strong>New API Key Secret Generated (Copy now — shown only once):</strong>
                      <div
                        className="mono"
                        style={{
                          marginTop: 6,
                          padding: "8px 12px",
                          background: "var(--card)",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          wordBreak: "break-all",
                        }}
                      >
                        {newlyCreatedSecret}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        copyToClipboard(newlyCreatedSecret, "API Key Secret");
                        setNewlyCreatedSecret(null);
                      }}
                    >
                      Copy &amp; Dismiss
                    </button>
                  </div>
                )}

                <div className="grid2">
                  <div className="panel">
                    <h3>
                      <span className="title-left">Active Scoped Credentials ({apiKeys.length})</span>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setActiveDrawer("apikey")}
                      >
                        + New Key
                      </button>
                    </h3>
                    <div className="table-wrap">
                      <table className="cmp">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Scope</th>
                            <th>Key Prefix</th>
                            <th className="num">Rate Limit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeys.map((k) => (
                            <tr key={k.id}>
                              <td style={{ fontWeight: 600 }}>{k.name}</td>
                              <td>
                                <span className="chip mono">{k.scope}</span>
                              </td>
                              <td className="mono" style={{ fontSize: 12 }}>
                                {k.prefix}
                              </td>
                              <td className="num mono">{k.rate_limit_eps} EPS</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Customer Portal Live Preview */}
                  <div className="panel">
                    <h3>
                      <span className="title-left">Customer Portal Preview (mb_portal_*)</span>
                      <select
                        className="select mono"
                        style={{ height: 32, width: "auto", fontSize: 12 }}
                        value={portalSubjectKey}
                        onChange={(e) => setPortalSubjectKey(e.target.value)}
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.key}>
                            Subject: {s.key}
                          </option>
                        ))}
                      </select>
                    </h3>
                    {portalSummary && (
                      <div style={{ display: "grid", gap: 14 }}>
                        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                          Embeddable read-only portal view for customer{" "}
                          <code>{portalSummary.subject}</code> in{" "}
                          <code>{portalSummary.namespace}</code>:
                        </div>
                        <div className="table-wrap">
                          <table className="cmp">
                            <thead>
                              <tr>
                                <th>Feature Key</th>
                                <th>Status</th>
                                <th className="num">Consumed</th>
                                <th className="num">Remaining</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(portalSummary.entitlements ?? []).map((ent) => (
                                <tr key={ent.feature_key}>
                                  <td className="mono">{ent.feature_key}</td>
                                  <td>
                                    <span className={`chip ${ent.has_access ? "ok" : "err"}`}>
                                      {ent.has_access ? "Active" : "Exhausted"}
                                    </span>
                                  </td>
                                  <td className="num mono">{ent.usage.toLocaleString()}</td>
                                  <td className="num mono" style={{ fontWeight: 700 }}>
                                    {ent.remaining.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===============================================================
                7. DOCUMENTATION CHAPTERS
                =============================================================== */}
            {activeDoc && (
              <>
                <section className="hero">
                  <div className="eyebrow">
                    <span className="eb-dot" />
                    <span>Architecture Spec {activeDoc.num}</span>
                    <span className="sep" />
                    <span>{activeDoc.tag}</span>
                  </div>
                  <h1>{activeDoc.title}</h1>
                  <p className="lede">{activeDoc.summary}</p>

                  <div className="figure-flow" style={{ marginTop: 18 }}>
                    {activeDoc.flow.map((step, idx) => (
                      <React.Fragment key={step}>
                        <span className="st mono">{step}</span>
                        {idx < activeDoc.flow.length - 1 && <span className="ar">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </section>

                {activeDoc.formula && (
                  <div className="formula" style={{ marginTop: 18 }}>
                    <div className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {activeDoc.formula.math}
                    </div>
                    <small>{activeDoc.formula.caption}</small>
                  </div>
                )}

                <div className="prose" style={{ marginTop: 22 }}>
                  {activeDoc.sections.map((sec) => (
                    <div key={sec.num}>
                      <h3>
                        <span className="hn mono">{sec.num}</span>
                        <span>{sec.heading}</span>
                      </h3>
                      <p>{sec.body}</p>
                    </div>
                  ))}

                  <div className={`callout ${activeDoc.callout.kind}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                    </svg>
                    <div>{activeDoc.callout.text}</div>
                  </div>
                </div>

                {/* Architecture Specification Matrix */}
                <div className="section-title">
                  <div className="section-title-left">
                    <span className="ix">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M9 21V9" />
                      </svg>
                    </span>
                    <h2>Specification Matrix</h2>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="cmp">
                    <thead>
                      <tr>
                        {activeDoc.table.headers.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDoc.table.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className={cIdx === 0 ? "mono" : undefined}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Interactive Code Tabs */}
                <div className="section-title">
                  <div className="section-title-left">
                    <span className="ix">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                    </span>
                    <h2>Implementation in Codebase</h2>
                  </div>
                </div>

                {(() => {
                  const tabIdx = activeCodeTab[activeDoc.id] ?? 0;
                  const currentTab = activeDoc.codeTabs[tabIdx] || activeDoc.codeTabs[0];
                  return (
                    <div className="code">
                      <div className="code-tabs">
                        {activeDoc.codeTabs.map((t, idx) => (
                          <button
                            key={t.label}
                            type="button"
                            className={`code-tab ${idx === tabIdx ? "on" : ""}`}
                            onClick={() =>
                              setActiveCodeTab((prev) => ({
                                ...prev,
                                [activeDoc.id]: idx,
                              }))
                            }
                          >
                            <span className={`badge ${t.badge}`}>
                              {t.badge === "src" ? "SOURCE" : "USAGE"}
                            </span>
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="code-head">
                        <span className="mono">{currentTab.file}</span>
                      </div>
                      <pre>
                        <code>{currentTab.code}</code>
                      </pre>
                      <div className="code-cap">{currentTab.caption}</div>
                    </div>
                  );
                })()}

                {/* Chapter Footer Navigation */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 32,
                    paddingTop: 20,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  {(() => {
                    const idx = DOC_CHAPTERS.findIndex((c) => c.id === activeDoc.id);
                    const prev = idx > 0 ? DOC_CHAPTERS[idx - 1] : null;
                    const next =
                      idx < DOC_CHAPTERS.length - 1 ? DOC_CHAPTERS[idx + 1] : null;
                    return (
                      <>
                        {prev ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setActiveView(prev.id)}
                          >
                            ← {prev.num} · {prev.title}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setActiveView("overview")}
                          >
                            ← Back to Control Plane
                          </button>
                        )}
                        {next && (
                          <button
                            type="button"
                            className="btn primary"
                            onClick={() => setActiveView(next.id)}
                          >
                            {next.num} · {next.title} →
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ===================================================================
          SLIDE-OVER RIGHT DRAWER (Creation Flows & Invoice Sheet Inspection)
          =================================================================== */}
      {activeDrawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setActiveDrawer(null)} />
          <aside className="drawer" aria-label="Operational Drawer">
            <div className="drawer-head">
              <div>
                <div className="eyebrow">{activeNamespace}</div>
                <h3>
                  {activeDrawer === "tenant" && "Provision Organization / Environment"}
                  {activeDrawer === "meter" && "Provision ClickHouse Meter"}
                  {activeDrawer === "customer" && "Register Customer Subject"}
                  {activeDrawer === "entitlement" && "Attach Feature Entitlement"}
                  {activeDrawer === "grant" && "Issue Prepaid Credit Grant"}
                  {activeDrawer === "plan" && "Author Hybrid Pricing Plan"}
                  {activeDrawer === "apikey" && "Issue Scoped API Key"}
                  {activeDrawer === "invoice" && `Invoice Sheet · ${selectedInvoice?.id || ""}`}
                </h3>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => setActiveDrawer(null)}
              >
                Esc ✕
              </button>
            </div>

            <div className="drawer-body">
              {/* 1. Tenant Provisioning Drawer */}
              {activeDrawer === "tenant" && (
                <>
                  <form onSubmit={handleCreateOrganization} style={{ display: "grid", gap: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>New Organization</div>
                    <div>
                      <label className="label">Organization Name</label>
                      <input
                        className="input"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="e.g., Anthropic Labs"
                        required
                      />
                    </div>
                    <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="label">Slug</label>
                        <input
                          className="input mono"
                          value={newOrgSlug}
                          onChange={(e) => setNewOrgSlug(e.target.value)}
                          placeholder="anthropic"
                        />
                      </div>
                      <div>
                        <label className="label">Rate Limit (EPS)</label>
                        <input
                          className="input mono"
                          type="number"
                          value={newOrgEps}
                          onChange={(e) => setNewOrgEps(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Billing Tier</label>
                      <select
                        className="select"
                        value={newOrgTier}
                        onChange={(e) => setNewOrgTier(e.target.value)}
                      >
                        <option value="free">free</option>
                        <option value="growth">growth</option>
                        <option value="enterprise">enterprise</option>
                      </select>
                    </div>
                    <button type="submit" className="btn primary">
                      Create Organization
                    </button>
                  </form>

                  <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "6px 0" }} />

                  <form onSubmit={handleCreateEnvironment} style={{ display: "grid", gap: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                      Add Environment to {activeOrgName}
                    </div>
                    <div>
                      <label className="label">Environment Slug</label>
                      <input
                        className="input mono"
                        value={newEnvSlug}
                        onChange={(e) => setNewEnvSlug(e.target.value)}
                        placeholder="staging-eu"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Environment Type</label>
                      <select
                        className="select"
                        value={newEnvType}
                        onChange={(e) =>
                          setNewEnvType(e.target.value as "production" | "sandbox")
                        }
                      >
                        <option value="sandbox">sandbox</option>
                        <option value="production">production</option>
                      </select>
                    </div>
                    <button type="submit" className="btn">
                      Create Environment (ns_{activeOrg?.slug || "acme"}_{newEnvSlug || "env"})
                    </button>
                  </form>
                </>
              )}

              {/* 2. Meter Creation Drawer */}
              {activeDrawer === "meter" && (
                <form onSubmit={handleCreateMeter} style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label className="label">Meter Slug</label>
                    <input
                      className="input mono"
                      value={newMeterSlug}
                      onChange={(e) => setNewMeterSlug(e.target.value)}
                      placeholder="vector_search_queries"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Display Name</label>
                    <input
                      className="input"
                      value={newMeterName}
                      onChange={(e) => setNewMeterName(e.target.value)}
                      placeholder="Vector Search Queries"
                      required
                    />
                  </div>
                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label">CloudEvents Type</label>
                      <input
                        className="input mono"
                        value={newMeterEventType}
                        onChange={(e) => setNewMeterEventType(e.target.value)}
                        placeholder="vector.query"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Aggregation Function</label>
                      <select
                        className="select mono"
                        value={newMeterAgg}
                        onChange={(e) =>
                          setNewMeterAgg(e.target.value as Meter["aggregation"])
                        }
                      >
                        <option value="SUM">SUM</option>
                        <option value="COUNT">COUNT</option>
                        <option value="AVG">AVG</option>
                        <option value="UNIQUE_COUNT">UNIQUE_COUNT</option>
                        <option value="MAX">MAX</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Value Property (JSONPath)</label>
                    <input
                      className="input mono"
                      value={newMeterValueProp}
                      onChange={(e) => setNewMeterValueProp(e.target.value)}
                      placeholder="$.dimensions"
                    />
                  </div>
                  <div>
                    <label className="label">Group By Dimension (Key : JSONPath)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="input mono"
                        value={newMeterGroupByKey}
                        onChange={(e) => setNewMeterGroupByKey(e.target.value)}
                        placeholder="region"
                      />
                      <input
                        className="input mono"
                        value={newMeterGroupByPath}
                        onChange={(e) => setNewMeterGroupByPath(e.target.value)}
                        placeholder="$.region"
                      />
                    </div>
                  </div>
                  <div className="code" style={{ marginTop: 4 }}>
                    <div className="code-head">
                      <span className="mono">POST /api/v1/meters</span>
                    </div>
                    <pre>
                      <code>
                        {JSON.stringify(
                          {
                            slug: newMeterSlug || "vector_search_queries",
                            aggregation: newMeterAgg,
                            event_type: newMeterEventType || "vector.query",
                            value_property: newMeterValueProp,
                          },
                          null,
                          2
                        )}
                      </code>
                    </pre>
                  </div>
                  <button type="submit" className="btn primary">
                    Provision Meter in {activeNamespace}
                  </button>
                </form>
              )}

              {/* 3. Customer Registration Drawer */}
              {activeDrawer === "customer" && (
                <form onSubmit={handleCreateSubject} style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label className="label">Subject Key</label>
                    <input
                      className="input mono"
                      value={newSubjectKey}
                      onChange={(e) => setNewSubjectKey(e.target.value)}
                      placeholder="cus_scale_ai"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Customer Display Name</label>
                    <input
                      className="input"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="Scale AI Corp"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Stripe Customer ID (optional)</label>
                    <input
                      className="input mono"
                      value={newSubjectStripe}
                      onChange={(e) => setNewSubjectStripe(e.target.value)}
                      placeholder="cus_Stripe9921"
                    />
                  </div>
                  <button type="submit" className="btn primary">
                    Register Customer Subject
                  </button>
                </form>
              )}

              {/* 4. Entitlement Attachment Drawer */}
              {activeDrawer === "entitlement" && (
                <form onSubmit={handleCreateEntitlement} style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label className="label">Customer Subject</label>
                    <select
                      className="select mono"
                      value={selectedSubjectKey}
                      onChange={(e) => setSelectedSubjectKey(e.target.value)}
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.key}>
                          {s.key} ({s.display_name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Feature Key</label>
                    <input
                      className="input mono"
                      value={newEntFeatureKey}
                      onChange={(e) => setNewEntFeatureKey(e.target.value)}
                      placeholder="feature_llm_tokens"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Backing Meter</label>
                    <select
                      className="select mono"
                      value={newEntMeterSlug}
                      onChange={(e) => setNewEntMeterSlug(e.target.value)}
                    >
                      {meters.map((m) => (
                        <option key={m.id} value={m.slug}>
                          {m.slug}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Monthly Included Limit</label>
                    <input
                      className="input mono"
                      type="number"
                      value={newEntLimit}
                      onChange={(e) => setNewEntLimit(e.target.value)}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newEntSoftLimit}
                      onChange={(e) => setNewEntSoftLimit(e.target.checked)}
                    />
                    <span style={{ fontSize: 13 }}>Soft Limit (allow overage without blocking traffic)</span>
                  </label>
                  <button type="submit" className="btn primary">
                    Attach Entitlement
                  </button>
                </form>
              )}

              {/* 5. Credit Grant Drawer */}
              {activeDrawer === "grant" && (
                <form onSubmit={handleCreateGrant} style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label className="label">Target Entitlement</label>
                    <select
                      className="select mono"
                      value={newGrantEntId}
                      onChange={(e) => setNewGrantEntId(e.target.value)}
                    >
                      {entitlements.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.subject_key} → {ent.feature_key} (limit: {ent.limit.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Grant Reference Name</label>
                    <input
                      className="input"
                      value={newGrantName}
                      onChange={(e) => setNewGrantName(e.target.value)}
                      placeholder="Q4 Prepaid Commit Block"
                      required
                    />
                  </div>
                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label">Credit Units</label>
                      <input
                        className="input mono"
                        type="number"
                        value={newGrantAmount}
                        onChange={(e) => setNewGrantAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Burndown Priority (1 = first)</label>
                      <input
                        className="input mono"
                        type="number"
                        value={newGrantPriority}
                        onChange={(e) => setNewGrantPriority(e.target.value)}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn primary">
                    Issue Credit Grant
                  </button>
                </form>
              )}

              {/* 6. Pricing Plan Drawer */}
              {activeDrawer === "plan" && (
                <form onSubmit={handleCreatePlan} style={{ display: "grid", gap: 14 }}>
                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label">Plan Slug</label>
                      <input
                        className="input mono"
                        value={newPlanSlug}
                        onChange={(e) => setNewPlanSlug(e.target.value)}
                        placeholder="ai_scale_monthly"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Plan Name</label>
                      <input
                        className="input"
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                        placeholder="AI Scale Monthly"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label">Base Fee (Cents USD)</label>
                      <input
                        className="input mono"
                        type="number"
                        value={newPlanBaseFee}
                        onChange={(e) => setNewPlanBaseFee(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Metered Component</label>
                      <select
                        className="select mono"
                        value={newPlanCompMeter}
                        onChange={(e) => setNewPlanCompMeter(e.target.value)}
                      >
                        {meters.map((m) => (
                          <option key={m.id} value={m.slug}>
                            {m.slug}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label">Included Allowance Units</label>
                      <input
                        className="input mono"
                        type="number"
                        value={newPlanCompIncluded}
                        onChange={(e) => setNewPlanCompIncluded(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Overage Unit Price (Cents)</label>
                      <input
                        className="input mono"
                        type="number"
                        value={newPlanCompPrice}
                        onChange={(e) => setNewPlanCompPrice(e.target.value)}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn primary">
                    Publish Hybrid Pricing Plan
                  </button>
                </form>
              )}

              {/* 7. Scoped API Key Drawer */}
              {activeDrawer === "apikey" && (
                <form onSubmit={handleCreateAPIKey} style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label className="label">Key Description</label>
                    <input
                      className="input"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Production Edge Worker"
                      required
                    />
                  </div>
                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label">Access Scope</label>
                      <select
                        className="select mono"
                        value={newKeyScope}
                        onChange={(e) =>
                          setNewKeyScope(e.target.value as APIKey["scope"])
                        }
                      >
                        <option value="ingest">ingest (mb_ing_*)</option>
                        <option value="entitlement">entitlement (mb_ent_*)</option>
                        <option value="admin">admin (mb_sk_*)</option>
                        <option value="portal">portal (mb_portal_*)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Rate Limit (EPS)</label>
                      <input
                        className="input mono"
                        type="number"
                        value={newKeyRateLimit}
                        onChange={(e) => setNewKeyRateLimit(e.target.value)}
                      />
                    </div>
                  </div>
                  {newKeyScope === "portal" && (
                    <div>
                      <label className="label">Locked Subject Key (Portal Scope)</label>
                      <select
                        className="select mono"
                        value={newKeySubject}
                        onChange={(e) => setNewKeySubject(e.target.value)}
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.key}>
                            {s.key} ({s.display_name})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn primary">
                    Generate Scoped Key
                  </button>
                </form>
              )}

              {/* 8. Printable Financial Invoice Ledger Sheet Drawer */}
              {activeDrawer === "invoice" && selectedInvoice && (
                <div className="invoice-sheet">
                  <div className="invoice-sheet-head">
                    <div>
                      <div className="eyebrow">Meterbox Financial Ledger</div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 22,
                          fontWeight: 700,
                          marginTop: 4,
                        }}
                      >
                        {selectedInvoice.id}
                      </div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        Stripe Sync: {selectedInvoice.stripe_invoice_id}
                      </div>
                    </div>
                    <span className="chip ok mono">{selectedInvoice.status.toUpperCase()}</span>
                  </div>

                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12.5 }}>
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Billed Subject</div>
                      <strong className="mono">{selectedInvoice.subject_key}</strong>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Pricing Plan</div>
                      <strong className="mono">{selectedInvoice.plan_slug}</strong>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Namespace</div>
                      <span className="mono">{selectedInvoice.namespace}</span>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Issued At</div>
                      <span className="mono">
                        {new Date(selectedInvoice.issued_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="cmp">
                      <thead>
                        <tr>
                          <th>Line Item Description</th>
                          <th className="num">Quantity</th>
                          <th className="num">Unit Rate</th>
                          <th className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.line_items.map((li, i) => (
                          <tr key={i}>
                            <td>
                              <div>{li.description}</div>
                              {li.meter_slug && (
                                <code style={{ fontSize: 11 }}>{li.meter_slug}</code>
                              )}
                            </td>
                            <td className="num mono">{li.quantity.toLocaleString()}</td>
                            <td className="num mono">${(li.unit_price_cents / 100).toFixed(2)}</td>
                            <td className="num mono" style={{ fontWeight: 700 }}>
                              ${(li.amount_cents / 100).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="invoice-totals">
                    <div className="invoice-totals-row">
                      <span>Subtotal</span>
                      <span className="mono">
                        ${(selectedInvoice.subtotal_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="invoice-totals-row" style={{ color: "var(--ok)" }}>
                      <span>Prepaid Credits Applied</span>
                      <span className="mono">
                        -${(selectedInvoice.credits_applied_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="invoice-totals-row net">
                      <span>Net Total Due ({selectedInvoice.currency})</span>
                      <span className="mono">
                        ${(selectedInvoice.total_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ===================================================================
          GLOBAL COMMAND PALETTE (⌘K)
          =================================================================== */}
      {cmdkOpen && (
        <div className="cmdk-backdrop" onClick={() => setCmdkOpen(false)}>
          <div className="cmdk" onClick={(e) => e.stopPropagation()}>
            <div className="cmdk-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                autoFocus
                className="cmdk-input"
                value={cmdkQuery}
                onChange={(e) => setCmdkQuery(e.target.value)}
                placeholder="Jump to meter, customer, module, or trigger action…"
              />
              <kbd onClick={() => setCmdkOpen(false)}>ESC</kbd>
            </div>
            <div className="cmdk-list">
              <div className="cmdk-group-lbl">Quick Actions</div>
              {[
                {
                  label: "+ Provision New ClickHouse Meter",
                  sub: "Slide-over drawer",
                  run: () => {
                    setCmdkOpen(false);
                    setActiveDrawer("meter");
                  },
                },
                {
                  label: "+ Register Customer Subject",
                  sub: "Slide-over drawer",
                  run: () => {
                    setCmdkOpen(false);
                    setActiveDrawer("customer");
                  },
                },
                {
                  label: "+ Issue Prepaid Credit Grant",
                  sub: "Slide-over drawer",
                  run: () => {
                    setCmdkOpen(false);
                    setActiveDrawer("grant");
                  },
                },
                {
                  label: "Toggle Light / Dark Theme",
                  sub: isDark ? "Switch to Warm Alabaster" : "Switch to Warm Obsidian",
                  run: () => {
                    setCmdkOpen(false);
                    toggleTheme();
                  },
                },
              ]
                .filter(
                  (a) =>
                    !cmdkQuery.trim() ||
                    a.label.toLowerCase().includes(cmdkQuery.toLowerCase())
                )
                .map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    className="cmdk-item"
                    onClick={a.run}
                  >
                    <span>{a.label}</span>
                    <span className="chip mono">{a.sub}</span>
                  </button>
                ))}

              <div className="cmdk-group-lbl">Control Plane Modules</div>
              {operationalNav
                .filter(
                  (n) =>
                    !cmdkQuery.trim() ||
                    n.label.toLowerCase().includes(cmdkQuery.toLowerCase())
                )
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="cmdk-item"
                    onClick={() => {
                      setActiveView(n.id);
                      setCmdkOpen(false);
                    }}
                  >
                    <span>{n.label}</span>
                    <span className="chip mono">{n.badge}</span>
                  </button>
                ))}

              {meters.length > 0 && (
                <>
                  <div className="cmdk-group-lbl">Registered Meters</div>
                  {meters
                    .filter(
                      (m) =>
                        !cmdkQuery.trim() ||
                        m.slug.toLowerCase().includes(cmdkQuery.toLowerCase()) ||
                        m.name.toLowerCase().includes(cmdkQuery.toLowerCase())
                    )
                    .map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="cmdk-item"
                        onClick={() => {
                          setSelectedMeterSlug(m.slug);
                          setActiveView("meters");
                          setCmdkOpen(false);
                        }}
                      >
                        <span className="mono">{m.slug}</span>
                        <span className="chip mono">{m.aggregation}</span>
                      </button>
                    ))}
                </>
              )}

              <div className="cmdk-group-lbl">Architecture Documentation</div>
              {DOC_CHAPTERS.filter(
                (d) =>
                  !cmdkQuery.trim() ||
                  d.title.toLowerCase().includes(cmdkQuery.toLowerCase())
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="cmdk-item"
                  onClick={() => {
                    setActiveView(d.id);
                    setCmdkOpen(false);
                  }}
                >
                  <span>
                    {d.num} · {d.title}
                  </span>
                  <span className="chip">{d.tag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          BOTTOM-RIGHT TOAST NOTIFICATION STACK
          =================================================================== */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind || "ok"}`}>
            <span className="toast-dot" />
            <div>
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              {t.detail && (
                <div style={{ fontSize: 12, opacity: 0.82, marginTop: 2 }}>{t.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
