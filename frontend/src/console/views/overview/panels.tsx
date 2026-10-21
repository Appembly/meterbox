"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CircleCheck,
  Copy,
  Database,
  Gauge,
  GitBranch,
  Inbox,
  KeyRound,
  Pause,
  Play,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { classicHref } from "../../nav";
import {
  formatCompact,
  formatCurrency,
  formatLatencyUs,
  formatNumber,
  formatPercent,
  humanizeKey,
  relativeTime,
  shortId,
} from "../../lib/format";
import {
  Card,
  CardHeader,
  EmptyState,
  Pagination,
  Pill,
  ProgressBar,
  Skeleton,
  Sparkline,
  StatusDot,
  Tone,
  toneColor,
  usePagination,
} from "../../ui/primitives";

/* ----------------------------------------------------------------------------
 * KPI card
 * --------------------------------------------------------------------------*/

export const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  footer?: React.ReactNode;
  icon: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  delay?: number;
}> = ({ label, value, detail, footer, icon, tone, loading, delay = 0 }) => (
  <Card className="p-4 flex flex-col" delay={delay}>
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] font-medium text-[var(--muted-foreground)]">{label}</span>
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{
          color: tone ? toneColor(tone) : "var(--muted-foreground)",
          background: tone ? `color-mix(in srgb, ${toneColor(tone)} 12%, transparent)` : "var(--surface-subtle)",
        }}
      >
        {icon}
      </span>
    </div>
    {loading ? (
      <>
        <Skeleton className="mt-3 h-7 w-24" />
        <Skeleton className="mt-2 h-3.5 w-36" />
      </>
    ) : (
      <>
        <div className="mt-2 text-[26px] font-semibold tracking-[-0.03em] leading-tight mbx-num">{value}</div>
        {detail && <div className="mt-1 text-[12.5px] text-[var(--muted-foreground)] truncate">{detail}</div>}
      </>
    )}
    {footer && <div className="mt-auto pt-3">{footer}</div>}
  </Card>
);

/* ----------------------------------------------------------------------------
 * KPI row
 * --------------------------------------------------------------------------*/

export const KpiRow: React.FC<{
  meterName: string;
  meterTotal: number;
  meterSpark: number[];
  meterLoading: boolean;
  rangeLabel: string;
}> = ({ meterName, meterTotal, meterSpark, meterLoading, rangeLabel }) => {
  const { snapshot, entitlementUsage, status } = useConsole();
  const t = snapshot.telemetry;
  const loading = status === "loading";

  const laneTotal = (t?.realtimeEvents || 0) + (t?.bulkEvents || 0);
  const realtimeShare = laneTotal > 0 ? (t?.realtimeEvents || 0) / laneTotal : 1;

  const now = Date.now();
  const currentInvoices = snapshot.invoices.filter((inv) => {
    const s = Date.parse(inv.period_start);
    const e = Date.parse(inv.period_end);
    return Number.isFinite(s) && Number.isFinite(e) ? s <= now && now <= e : true;
  });
  const invoiced = currentInvoices.reduce((a, i) => a + i.total_cents, 0);
  const credits = currentInvoices.reduce((a, i) => a + i.credits_applied_cents, 0);
  const currency = currentInvoices[0]?.currency || "USD";

  const near = entitlementUsage.filter((u) => u.ratio >= 0.8);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Events ingested"
        icon={<Zap className="w-3.5 h-3.5" />}
        loading={loading}
        value={formatNumber(t?.ingestedEvents || 0)}
        detail={`${formatNumber(t?.dedupHits || 0)} duplicates absorbed`}
        footer={
          <div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--surface-subtle)]">
              <div className="mbx-bar-fill h-full" style={{ width: `${realtimeShare * 100}%`, background: "var(--primary)" }} />
              <div className="mbx-bar-fill h-full" style={{ width: `${(1 - realtimeShare) * 100}%`, background: "var(--info)" }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11.5px] text-[var(--muted-foreground)] mbx-num">
              <span>Realtime {formatCompact(t?.realtimeEvents || 0)}</span>
              <span>Bulk {formatCompact(t?.bulkEvents || 0)}</span>
            </div>
          </div>
        }
      />
      <KpiCard
        label={meterName || "Metered usage"}
        icon={<Gauge className="w-3.5 h-3.5" />}
        loading={meterLoading && meterTotal === 0}
        value={formatCompact(meterTotal)}
        detail={`Last ${rangeLabel}`}
        footer={<Sparkline values={meterSpark} height={28} />}
        delay={40}
      />
      <KpiCard
        label="Invoiced this period"
        icon={<ShieldCheck className="w-3.5 h-3.5" />}
        loading={loading}
        value={formatCurrency(invoiced, currency)}
        detail={`${currentInvoices.length} invoice${currentInvoices.length === 1 ? "" : "s"} · ${formatCurrency(credits, currency)} credits applied`}
        delay={80}
      />
      <KpiCard
        label="Customers near limit"
        icon={<Gauge className="w-3.5 h-3.5" />}
        tone={near.length > 0 ? "warn" : "ok"}
        loading={loading}
        value={near.length}
        detail={`of ${entitlementUsage.length} metered allowance${entitlementUsage.length === 1 ? "" : "s"} at ≥80%`}
        delay={120}
      />
    </div>
  );
};

/* ----------------------------------------------------------------------------
 * Needs attention
 * --------------------------------------------------------------------------*/

interface AttentionItem {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  actionLabel: string;
  actionRoute: string;
}

export const AttentionPanel: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const { snapshot, entitlementUsage, status, href, navigate } = useConsole();
  const subjectName = useSubjectName();

  const items = useMemo<AttentionItem[]>(() => {
    const list: AttentionItem[] = [];
    const pendingDlq = snapshot.dlqEvents.filter((d) => d.status === "pending");
    const dlqCount = Math.max(pendingDlq.length, snapshot.telemetry?.dlqPending || 0);
    if (dlqCount > 0) {
      list.push({
        id: "dlq",
        tone: "warn",
        title: `${dlqCount} event${dlqCount === 1 ? "" : "s"} in the dead-letter queue`,
        detail: pendingDlq[0]?.failure_reason || "Events failed validation and are held for repair.",
        actionLabel: "Repair",
        actionRoute: "dlq",
      });
    }
    for (const u of [...entitlementUsage].sort((a, b) => b.ratio - a.ratio)) {
      if (u.ratio < 0.8) continue;
      const over = u.ratio >= 1;
      list.push({
        id: `ent-${u.subjectKey}-${u.featureKey}`,
        tone: over && !u.softLimit ? "err" : "warn",
        title: `${subjectName(u.subjectKey)} ${over ? "is over" : "is at"} ${formatPercent(u.ratio)} of allowance`,
        detail: `${u.featureName || humanizeKey(u.featureKey)} · ${formatCompact(u.usage)} of ${formatCompact(u.limit)}${
          over && u.softLimit ? " · soft limit, overage billed" : ""
        }`,
        actionLabel: "View",
        actionRoute: `customers?subject=${encodeURIComponent(u.subjectKey)}`,
      });
    }
    for (const g of snapshot.grants) {
      if (g.amount > 0 && g.remaining <= 0) {
        list.push({
          id: `grant-${g.id}`,
          tone: "info",
          title: `Credit grant exhausted for ${subjectName(g.subject_key)}`,
          detail: `${g.name} · ${formatCompact(g.amount)} fully consumed`,
          actionLabel: "Top up",
          actionRoute: `customers?subject=${encodeURIComponent(g.subject_key)}`,
        });
      }
    }
    for (const inv of snapshot.invoices) {
      if (["draft", "failed", "past_due", "uncollectible"].includes(inv.status)) {
        list.push({
          id: `inv-${inv.id}`,
          tone: inv.status === "draft" ? "info" : "err",
          title: `Invoice ${inv.status.replace("_", " ")} for ${subjectName(inv.subject_key)}`,
          detail: `${formatCurrency(inv.total_cents, inv.currency)} · ${inv.id}`,
          actionLabel: "Open",
          actionRoute: "invoices",
        });
      }
    }
    if (snapshot.telemetry?.clickhouseConnected === false) {
      list.push({
        id: "olap",
        tone: "warn",
        title: "Analytics store is offline",
        detail: "ClickHouse is unreachable — usage rollups are being served from the fallback store.",
        actionLabel: "Details",
        actionRoute: "meters",
      });
    }
    return list;
  }, [snapshot, entitlementUsage, subjectName]);

  return (
    <Card className="flex flex-col" delay={delay}>
      <CardHeader
        title="Needs attention"
        subtitle={status === "ready" ? (items.length ? `${items.length} item${items.length === 1 ? "" : "s"} to review` : "Nothing to review") : " "}
      />
      <div className="flex-1">
        {status === "loading" ? (
          <div className="space-y-2 px-5 pb-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CircleCheck className="w-5 h-5" style={{ color: "var(--ok)" }} />}
            title="All clear"
            description="No failed events, exhausted credits, or customers near their limits."
          />
        ) : (
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {items.slice(0, 6).map((item) => (
              <li key={item.id}>
                <a
                  href={href(item.actionRoute)}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                      e.preventDefault();
                      navigate(item.actionRoute);
                    }
                  }}
                  className="group flex items-start gap-3 px-5 py-3 mbx-hover transition-colors"
                >
                  <StatusDot tone={item.tone} className="mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium leading-snug text-[var(--foreground)]">{item.title}</div>
                    <div className="mt-0.5 text-[12.5px] text-[var(--muted-foreground)] line-clamp-1">{item.detail}</div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[12.5px] font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
                    {item.actionLabel}
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

/* ----------------------------------------------------------------------------
 * Allowance usage
 * --------------------------------------------------------------------------*/

export const AllowancePanel: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const { entitlementUsage, status, href, navigate } = useConsole();
  const subjectName = useSubjectName();
  const sorted = [...entitlementUsage].sort((a, b) => b.ratio - a.ratio);

  return (
    <Card className="flex flex-col" delay={delay}>
      <CardHeader
        title="Allowance usage"
        subtitle="Current period, by customer"
        actions={
          <a
            href={href("customers")}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                e.preventDefault();
                navigate("customers");
              }
            }}
            className="text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-0.5"
          >
            All customers <ArrowUpRight className="w-3 h-3" />
          </a>
        }
      />
      <div className="flex-1 px-5 pb-4">
        {status === "loading" ? (
          <div className="space-y-4 pt-1">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState title="No metered allowances" description="Create an entitlement to track customer usage against a limit." />
        ) : (
          <ul className="space-y-4 pt-1">
            {sorted.slice(0, 6).map((u) => {
              const tone: Tone = u.ratio >= 1 ? (u.softLimit ? "warn" : "err") : u.ratio >= 0.8 ? "warn" : "ok";
              return (
                <li key={`${u.subjectKey}-${u.featureKey}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium truncate">{subjectName(u.subjectKey)}</span>
                    <span className="text-[12px] font-semibold mbx-num" style={{ color: toneColor(tone) }}>
                      {formatPercent(u.ratio)}
                    </span>
                  </div>
                  <ProgressBar value={u.ratio} tone={tone} className="mt-1.5" label={`${subjectName(u.subjectKey)} allowance usage`} />
                  <div className="mt-1 flex justify-between text-[11.5px] text-[var(--muted-foreground)] mbx-num">
                    <span className="truncate">{u.featureName || humanizeKey(u.featureKey)}</span>
                    <span className="shrink-0">
                      {formatCompact(u.usage)} / {formatCompact(u.limit)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};

/* ----------------------------------------------------------------------------
 * Pipeline health strip (Single-Surface 5-Column Grid — 3-Second Scan)
 * --------------------------------------------------------------------------*/

export const PipelineStrip: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const { snapshot, status } = useConsole();
  const t = snapshot.telemetry;

  const stages: { id: string; name: string; tone: Tone; metric: string; detail: string }[] = [
    {
      id: "gateway",
      name: "API key gateway",
      tone: snapshot.apiKeys.length > 0 ? "ok" : "neutral",
      metric: `${snapshot.apiKeys.length} key${snapshot.apiKeys.length === 1 ? "" : "s"}`,
      detail: "Scoped credentials active",
    },
    {
      id: "dedup",
      name: "Idempotency guard",
      tone: "ok",
      metric: `${formatCompact(t?.dedupHits || 0)} absorbed`,
      detail: "Retries never double-count",
    },
    {
      id: "lanes",
      name: "Ingestion router",
      tone: (t?.dlqPending || 0) > 0 ? "warn" : "ok",
      metric: `${formatCompact(t?.realtimeEvents || 0)} / ${formatCompact(t?.bulkEvents || 0)}`,
      detail: `${t?.dlqPending || 0} in dead-letter queue`,
    },
    {
      id: "rollups",
      name: "OLAP rollups",
      tone: t?.clickhouseConnected === false ? "warn" : "ok",
      metric: `${snapshot.meters.length} meter${snapshot.meters.length === 1 ? "" : "s"}`,
      detail: t?.clickhouseConnected === false ? "Fallback store active" : "ClickHouse connected",
    },
    {
      id: "quotas",
      name: "Edge quota checks",
      tone: "ok",
      metric: formatLatencyUs(t?.avgCheckLatencyUs || 0),
      detail: `${formatPercent(t?.cacheHitRatio || 0)} cache hit rate`,
    },
  ];

  const degraded = stages.filter((s) => s.tone === "warn" || s.tone === "err").length;

  return (
    <Card delay={delay}>
      <CardHeader
        title="Pipeline health"
        subtitle="End-to-end posture from event ingestion to edge quota evaluation"
        actions={
          status === "ready" ? (
            <Pill tone={degraded ? "warn" : "ok"}>
              <StatusDot tone={degraded ? "warn" : "ok"} live />
              {degraded ? `${degraded} stage${degraded === 1 ? "" : "s"} degraded` : "All systems normal"}
            </Pill>
          ) : null
        }
      />
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)] border-t border-[var(--border)]">
        {stages.map((s) => (
          <li key={s.id} className="px-5 py-4 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--muted-foreground)] truncate">{s.name}</span>
              <StatusDot tone={s.tone} live={s.tone === "ok"} />
            </div>
            {status === "loading" ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <>
                <div className="text-[20px] font-semibold tracking-[-0.02em] mbx-num text-[var(--foreground)]">
                  {s.metric}
                </div>
                <div className="text-[12px] text-[var(--muted-foreground)] truncate">{s.detail}</div>
              </>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
};

/* ----------------------------------------------------------------------------
 * Live events
 * --------------------------------------------------------------------------*/

const EMPTY_EVENTS: never[] = [];

export const LiveEvents: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const { snapshot, status, href, navigate } = useConsole();
  const subjectName = useSubjectName();
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(snapshot.telemetry?.recentEvents || []);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [, setNowTick] = useState(0);

  const live = snapshot.telemetry?.recentEvents ?? EMPTY_EVENTS;

  useEffect(() => {
    if (paused) return;
    const sorted = [...live].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    if (seen.current) {
      const newIds = sorted.filter((e) => !seen.current!.has(e.id)).map((e) => e.id);
      if (newIds.length) setFresh(new Set(newIds));
    }
    seen.current = new Set(sorted.map((e) => e.id));
    setFrozen(sorted);
  }, [live, paused]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const copy = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
  };

  const pagination = usePagination(frozen, 8);
  const rows = pagination.pageItems;

  return (
    <Card className="flex flex-col" delay={delay}>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            Live events
            {!paused && status === "ready" && <StatusDot tone="ok" live />}
          </span>
        }
        subtitle={paused ? "Paused — new events are buffered" : "Most recent CloudEvents across all meters"}
        actions={
          <>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12.5px] font-medium border border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
              aria-pressed={paused}
            >
              {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {paused ? "Resume" : "Pause"}
            </button>
            <a
              href={href("events")}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                  e.preventDefault();
                  navigate("events");
                }
              }}
              className="text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-0.5"
            >
              All events <ArrowUpRight className="w-3 h-3" />
            </a>
          </>
        }
      />
      <div className="flex-1 overflow-x-auto mbx-scroll">
        {status === "loading" ? (
          <div className="px-5 pb-4 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Inbox className="w-5 h-5" />} title="No events yet" description="Send a CloudEvent to this environment to see it appear here in real time." />
        ) : (
          <table className="min-w-[680px] text-[12.5px]">
            <thead>
              <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                <th className="px-5 py-2 w-[96px]">Time</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-5 py-2 text-right">Event ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const data = (e.data || {}) as Record<string, unknown>;
                const detail = [data.model, data.tool, data.persona, data.tokens != null ? `${formatCompact(Number(data.tokens))} tok` : null]
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(" · ");
                return (
                  <tr key={e.id} className={`border-b border-[var(--border)] last:border-0 ${fresh.has(e.id) ? "mbx-row-new" : ""}`}>
                    <td className="px-5 py-2 whitespace-nowrap text-[var(--muted-foreground)] mbx-num" title={new Date(e.time).toLocaleString()}>
                      {relativeTime(e.time)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Pill mono>{e.type}</Pill>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium max-w-[200px] truncate">{subjectName(e.subject)}</td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)] max-w-[240px] truncate">{detail || "—"}</td>
                    <td className="px-5 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => copy(e.id)}
                        className="group inline-flex items-center gap-1.5 mbx-mono text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        title={`Copy ${e.id}`}
                      >
                        {copied === e.id ? "Copied" : shortId(e.id, 8, 8)}
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Pagination state={pagination} pageSizeOptions={[5, 8, 15, 35]} itemLabel="events" />
    </Card>
  );
};

/* ----------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------*/

/** Resolve a subject key to a friendly display name (strips role suffixes like "(FinOps Lead)"). */
function useSubjectName() {
  const { snapshot } = useConsole();
  return useMemo(() => {
    const map = new Map(snapshot.subjects.map((s) => [s.key, s.display_name]));
    return (key: string) => {
      const name = map.get(key);
      return name ? name.replace(/\s*\(.*\)\s*$/, "") : humanizeKey(key);
    };
  }, [snapshot.subjects]);
}
