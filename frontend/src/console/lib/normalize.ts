/**
 * Response normalisation for the Meterbox control-plane API.
 * Ported from the classic console so both UIs interpret the backend identically
 * (the backend uses a few alternate field names, e.g. `plan_tier`, `key_preview`, `issue_after_reset`).
 */
import type {
  APIKey,
  CloudEventRecord,
  CostIntelligenceReport,
  CreditGrant,
  DLQEvent,
  Entitlement,
  Environment,
  Invoice,
  Meter,
  Organization,
  Plan,
  ProductAnalyticsReport,
  Subject,
  Subscription,
} from "../../types/meterbox";

type Raw = Record<string, unknown>;

export interface ConsoleTelemetry {
  orgId: string;
  orgName: string;
  namespace: string;
  ingestedEvents: number;
  dedupHits: number;
  realtimeEvents: number;
  bulkEvents: number;
  dlqPending: number;
  entitlementChecks: number;
  avgCheckLatencyUs: number;
  cacheHitRatio: number;
  clickhouseConnected: boolean | null;
  recentEvents: CloudEventRecord[];
}

export interface Snapshot {
  telemetry: ConsoleTelemetry | null;
  meters: Meter[];
  subjects: Subject[];
  apiKeys: APIKey[];
  entitlements: (Entitlement & { feature_name?: string })[];
  grants: CreditGrant[];
  dlqEvents: DLQEvent[];
  plans: Plan[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  costIntel: CostIntelligenceReport | null;
  productAnalytics: ProductAnalyticsReport | null;
}

export const EMPTY_SNAPSHOT: Snapshot = {
  telemetry: null,
  meters: [],
  subjects: [],
  apiKeys: [],
  entitlements: [],
  grants: [],
  dlqEvents: [],
  plans: [],
  subscriptions: [],
  invoices: [],
  costIntel: null,
  productAnalytics: null,
};

const str = (v: unknown, fallback = "") => (v == null || v === "" ? fallback : String(v));
const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function normalizeOrganizations(raw: unknown): Organization[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: Raw) => ({
    id: str(o.id),
    slug: str(o.slug, str(o.id)),
    name: str(o.name, str(o.slug)),
    billing_tier: str(o.billing_tier) || str(o.plan_tier, "standard"),
    rate_limit_eps: num(o.rate_limit_eps),
    burst_capacity: num(o.burst_capacity),
    created_at: str(o.created_at),
  }));
}

export function normalizeEnvironments(raw: unknown): (Environment & { name: string; rate_limit_rps: number })[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: Raw) => ({
    id: str(e.id),
    org_id: str(e.org_id),
    slug: str(e.slug, e.type === "sandbox" ? "sandbox" : "production"),
    name: str(e.name, e.type === "sandbox" ? "Sandbox" : "Production"),
    type: e.type === "sandbox" ? "sandbox" : "production",
    openmeter_namespace: str(e.openmeter_namespace),
    rate_limit_rps: num(e.rate_limit_rps),
    created_at: str(e.created_at),
  }));
}

export function normalizeSnapshot(snap: Raw, namespace: string): Snapshot {
  const t = (snap.telemetry || null) as Raw | null;
  const hits = num(t?.edge_cache_hits);
  const misses = num(t?.edge_cache_misses);

  const telemetry: ConsoleTelemetry | null = t
    ? {
        orgId: str(t.org_id),
        orgName: str(t.org_name),
        namespace: str(t.active_namespace, namespace),
        ingestedEvents: num(t.ingested_events ?? t.total_events_ingested),
        dedupHits: num(t.deduplicated_hits ?? t.deduplicated_dropped),
        realtimeEvents: num(t.realtime_lane_events),
        bulkEvents: num(t.bulk_lane_events),
        dlqPending: num(t.dlq_pending_count ?? t.pending_dlq_events),
        entitlementChecks: num(t.entitlement_checks, hits + misses),
        avgCheckLatencyUs: num(t.avg_check_latency_us),
        cacheHitRatio:
          t.cache_hit_ratio != null
            ? num(t.cache_hit_ratio)
            : hits + misses > 0
            ? num(t.edge_cache_hit_ratio_pct) / 100
            : 0,
        clickhouseConnected: typeof t.clickhouse_connected === "boolean" ? t.clickhouse_connected : null,
        recentEvents: (Array.isArray(snap.recent_events)
          ? snap.recent_events
          : Array.isArray(t.recent_events)
          ? t.recent_events
          : []) as CloudEventRecord[],
      }
    : null;

  const apiKeys: APIKey[] = Array.isArray(snap.api_keys)
    ? (snap.api_keys as Raw[]).map((k) => ({
        id: str(k.id),
        org_id: str(k.org_id),
        env_id: str(k.env_id),
        name: str(k.name),
        scope: (str(k.scope, "ingest") as APIKey["scope"]),
        prefix: str(k.prefix) || str(k.key_preview) || str(k.key_prefix, "mb_"),
        subject_id: str(k.subject_id) || str(k.subject_filter),
        rate_limit_eps: num(k.rate_limit_eps ?? k.rate_limit_rps),
        created_at: str(k.created_at),
      }))
    : [];

  const entitlements = Array.isArray(snap.entitlements)
    ? (snap.entitlements as Raw[]).map((e) => ({
        id: str(e.id),
        namespace: str(e.namespace, namespace),
        subject_key: str(e.subject_key),
        feature_key: str(e.feature_key),
        feature_name: e.feature_name ? str(e.feature_name) : undefined,
        type: (str(e.type, "metered") as Entitlement["type"]),
        meter_slug: str(e.meter_slug),
        limit: num(e.limit) || num(e.issue_after_reset),
        soft_limit: Boolean(e.soft_limit || e.is_soft_limit),
        reset_period: str(e.reset_period, "MONTH"),
      }))
    : [];

  const grants: CreditGrant[] = Array.isArray(snap.grants)
    ? (snap.grants as Raw[]).map((g) => ({
        id: str(g.id),
        entitlement_id: str(g.entitlement_id),
        subject_key: str(g.subject_key),
        feature_key: g.feature_key ? str(g.feature_key) : undefined,
        name: str(g.name, "Credit grant"),
        amount: num(g.amount),
        used_balance: g.used_balance != null ? num(g.used_balance) : undefined,
        remaining: num(g.remaining ?? g.remaining_balance ?? g.amount),
        priority: num(g.priority, 1),
        expires_at: str(g.expires_at),
      }))
    : [];

  const dlqEvents: DLQEvent[] = Array.isArray(snap.dlq_events)
    ? (snap.dlq_events as Raw[]).map((d) => ({
        id: str(d.id),
        org_id: str(d.org_id),
        env_id: str(d.env_id),
        namespace: str(d.namespace) || str(d.openmeter_namespace, namespace),
        raw_payload: typeof d.raw_payload === "string" ? d.raw_payload : JSON.stringify(d.raw_payload ?? {}, null, 2),
        failure_reason: str(d.failure_reason) || str(d.error_reason, "Validation error"),
        error_code: str(d.error_code, "invalid_payload"),
        status: (str(d.status, "pending") as DLQEvent["status"]),
        failed_at: str(d.failed_at),
      }))
    : [];

  const plans: Plan[] = Array.isArray(snap.plans)
    ? (snap.plans as Raw[]).map((p) => ({
        id: str(p.id),
        namespace: str(p.namespace, namespace),
        slug: str(p.slug),
        name: str(p.name),
        currency: str(p.currency, "USD"),
        base_fee_cents: num(p.base_fee_cents ?? p.base_price_cents),
        billing_cadence: str(p.billing_cadence, "MONTH"),
        components: Array.isArray(p.components) ? (p.components as Plan["components"]) : [],
      }))
    : [];

  const invoices: Invoice[] = Array.isArray(snap.invoices)
    ? (snap.invoices as Raw[]).map((inv) => {
        const lines = Array.isArray(inv.line_items) ? (inv.line_items as Raw[]) : [];
        return {
          id: str(inv.id),
          namespace: str(inv.namespace, namespace),
          subject_key: str(inv.subject_key),
          plan_slug: str(inv.plan_slug),
          currency: str(inv.currency, "USD"),
          subtotal_cents: num(inv.subtotal_cents),
          credits_applied_cents: num(inv.credits_applied_cents),
          total_cents: num(inv.total_cents),
          status: str(inv.status, "issued"),
          stripe_invoice_id: str(inv.stripe_invoice_id),
          line_items: lines.map((li) => {
            const qty = num(li.quantity, 1);
            const amt = num(li.amount_cents);
            return {
              description: str(li.description),
              meter_slug: li.meter_slug ? str(li.meter_slug) : undefined,
              quantity: qty,
              unit_price_cents: li.unit_price_cents != null ? num(li.unit_price_cents) : qty > 0 ? amt / qty : amt,
              amount_cents: amt,
            };
          }),
          period_start: str(inv.period_start),
          period_end: str(inv.period_end),
          issued_at: str(inv.issued_at) || str(inv.created_at),
        };
      })
    : [];

  return {
    telemetry,
    meters: Array.isArray(snap.meters) ? (snap.meters as Meter[]) : [],
    subjects: Array.isArray(snap.subjects) ? (snap.subjects as Subject[]) : [],
    apiKeys,
    entitlements,
    grants,
    dlqEvents,
    plans,
    subscriptions: Array.isArray(snap.subscriptions) ? (snap.subscriptions as Subscription[]) : [],
    invoices,
    costIntel: (snap.cost_intelligence as CostIntelligenceReport) || null,
    productAnalytics: (snap.product_analytics as ProductAnalyticsReport) || null,
  };
}

export interface EntitlementUsage {
  subjectKey: string;
  featureKey: string;
  featureName?: string;
  meterSlug: string;
  limit: number;
  usage: number;
  creditBalance: number;
  hasAccess: boolean;
  softLimit: boolean;
  ratio: number;
}

export function normalizeEntitlementValue(raw: Raw, ent: Snapshot["entitlements"][number]): EntitlementUsage {
  const limit = num(raw.limit) || ent.limit || num(raw.total_granted);
  const usage = num(raw.usage ?? raw.usage_in_period);
  return {
    subjectKey: ent.subject_key,
    featureKey: ent.feature_key,
    featureName: ent.feature_name,
    meterSlug: ent.meter_slug,
    limit,
    usage,
    creditBalance: num(raw.credit_balance ?? raw.balance),
    hasAccess: Boolean(raw.has_access ?? true),
    softLimit: Boolean(raw.soft_limit ?? raw.is_soft_limit ?? ent.soft_limit),
    ratio: limit > 0 ? usage / limit : 0,
  };
}
