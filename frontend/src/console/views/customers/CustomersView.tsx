"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Coins, CreditCard, Gauge, Layers, Plus, ShieldCheck, Users, Zap } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { apiGet, apiPost } from "../../lib/api";
import {
  formatCompact,
  formatCurrency,
  formatLatencyUs,
  formatNumber,
  formatPercent,
  humanizeKey,
  relativeTime,
} from "../../lib/format";
import {
  Button,
  Card,
  CardHeader,
  Drawer,
  EmptyState,
  Field,
  Input,
  Notice,
  PageHeader,
  Pagination,
  Pill,
  ProgressBar,
  Segmented,
  Skeleton,
  StatusDot,
  Tone,
  usePagination,
} from "../../ui/primitives";

type ProfileTab = "entitlements" | "grants" | "usage" | "billing";

interface EdgeEvalResult {
  has_access: boolean;
  usage: number;
  limit: number;
  credit_balance: number;
  soft_limit: boolean;
  latency_us: number;
  cache_hit: boolean;
}

export const CustomersView: React.FC = () => {
  const { org, env, namespace, snapshot, entitlementUsage, status, refresh, searchParamsStr } = useConsole();
  const searchParams = useSearchParams();
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ProfileTab>("entitlements");
  const [drawer, setDrawer] = useState<"subject" | "entitlement" | "grant" | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; title: string; detail?: string } | null>(null);

  // Edge quota evaluator state
  const [evalFeature, setEvalFeature] = useState<string>("");
  const [evalResult, setEvalResult] = useState<EdgeEvalResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  // Forms
  const [subKey, setSubKey] = useState("");
  const [subName, setSubName] = useState("");
  const [subStripe, setSubStripe] = useState("");

  const [entFeature, setEntFeature] = useState("");
  const [entMeter, setEntMeter] = useState("");
  const [entLimit, setEntLimit] = useState("");
  const [entSoft, setEntSoft] = useState(true);

  const [grantEntId, setGrantEntId] = useState("");
  const [grantName, setGrantName] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantPriority, setGrantPriority] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const qsParams = new URLSearchParams(searchParamsStr);
    const fromQuery = qsParams.get("subject") || searchParams?.get("subject");
    if (fromQuery && snapshot.subjects.some((s) => s.key === fromQuery)) {
      setSelectedKey(fromQuery);
      return;
    }
    if (!selectedKey && snapshot.subjects.length > 0) {
      const withEnt = snapshot.subjects.find((s) =>
        snapshot.entitlements.some((e) => e.subject_key === s.key),
      );
      setSelectedKey((withEnt || snapshot.subjects[0]).key);
    }
  }, [searchParams, searchParamsStr, snapshot.subjects, snapshot.entitlements, selectedKey]);

  const activeSubject = snapshot.subjects.find((s) => s.key === selectedKey) || snapshot.subjects[0];

  const subjectEntitlements = useMemo(
    () => snapshot.entitlements.filter((e) => e.subject_key === activeSubject?.key),
    [snapshot.entitlements, activeSubject?.key],
  );

  const subjectUsage = useMemo(
    () => entitlementUsage.filter((u) => u.subjectKey === activeSubject?.key),
    [entitlementUsage, activeSubject?.key],
  );

  const subjectGrants = useMemo(
    () =>
      snapshot.grants
        .filter((g) => g.subject_key === activeSubject?.key)
        .sort((a, b) => a.priority - b.priority),
    [snapshot.grants, activeSubject?.key],
  );

  const subjectEvents = useMemo(
    () => (snapshot.telemetry?.recentEvents || []).filter((e) => e.subject === activeSubject?.key),
    [snapshot.telemetry?.recentEvents, activeSubject?.key],
  );

  const subjectSubs = useMemo(
    () => snapshot.subscriptions.filter((s) => s.subject_key === activeSubject?.key),
    [snapshot.subscriptions, activeSubject?.key],
  );

  const subjectInvoices = useMemo(
    () => snapshot.invoices.filter((i) => i.subject_key === activeSubject?.key),
    [snapshot.invoices, activeSubject?.key],
  );

  const subjectCost = useMemo(
    () => snapshot.costIntel?.by_subject?.find((c) => c.subject_key === activeSubject?.key),
    [snapshot.costIntel?.by_subject, activeSubject?.key],
  );

  useEffect(() => {
    if (subjectEntitlements.length > 0) {
      setEvalFeature(subjectEntitlements[0].feature_key);
      setGrantEntId(subjectEntitlements[0].id);
    } else {
      setEvalFeature("");
      setGrantEntId("");
    }
  }, [subjectEntitlements]);

  const runEdgeEval = async (subjectKey: string, featureKey: string) => {
    if (!subjectKey || !featureKey) return;
    setEvaluating(true);
    const t0 = performance.now();
    try {
      const raw = await apiGet<Record<string, unknown>>(
        `/api/v1/subjects/${encodeURIComponent(subjectKey)}/entitlements/${encodeURIComponent(featureKey)}/value`,
        namespace,
      );
      const clientUs = Math.round((performance.now() - t0) * 1000);
      setEvalResult({
        has_access: Boolean(raw.has_access ?? true),
        usage: Number(raw.usage ?? raw.usage_in_period ?? 0),
        limit: Number(raw.limit ?? raw.total_granted ?? 0),
        credit_balance: Number(raw.credit_balance ?? raw.balance ?? 0),
        soft_limit: Boolean(raw.soft_limit ?? raw.is_soft_limit ?? false),
        latency_us: Number(raw.latency_us ?? raw.evaluation_us ?? raw.evaluation_latency_us ?? snapshot.telemetry?.avgCheckLatencyUs ?? clientUs),
        cache_hit: Boolean(raw.cache_hit ?? true),
      });
    } catch {
      setEvalResult(null);
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    if (activeSubject?.key && evalFeature) {
      runEdgeEval(activeSubject.key, evalFeature);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubject?.key, evalFeature, namespace]);

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.subjects.filter(
      (s) => !q || s.key.toLowerCase().includes(q) || s.display_name.toLowerCase().includes(q),
    );
  }, [snapshot.subjects, search]);

  const subjectListPagination = usePagination(filteredSubjects, 6);
  const subjectEventsPagination = usePagination(subjectEvents, 8);
  const subjectGrantsPagination = usePagination(subjectGrants, 6);
  const subjectInvoicesPagination = usePagination(subjectInvoices, 6);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subKey.trim()) return;
    setSubmitting(true);
    try {
      await apiPost(
        "/api/v1/subjects",
        {
          key: subKey.trim(),
          display_name: subName.trim() || subKey.trim(),
          stripe_customer_id: subStripe.trim() || `cus_${subKey.trim()}`,
        },
        namespace,
      );
      const created = subKey.trim();
      setSubKey("");
      setSubName("");
      setSubStripe("");
      setDrawer(null);
      await refresh();
      setSelectedKey(created);
      setNotice({
        tone: "ok",
        title: `Customer "${created}" provisioned`,
        detail: "Ready for metered entitlements, credit grants, and plan subscriptions.",
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Failed to create customer",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEntitlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject || !entFeature.trim()) return;
    setSubmitting(true);
    const amt = Number(entLimit) || 100000;
    try {
      await apiPost(
        "/api/v1/entitlements",
        {
          subject_key: activeSubject.key,
          feature_key: entFeature.trim(),
          feature_name: humanizeKey(entFeature.trim()),
          type: "metered",
          meter_slug: entMeter,
          limit: amt,
          issue_after_reset: amt,
          initial_grant_amount: amt,
          soft_limit: entSoft,
          is_soft_limit: entSoft,
          reset_period: "MONTH",
        },
        namespace,
      );
      setDrawer(null);
      await refresh();
      setEvalFeature(entFeature.trim());
      setNotice({
        tone: "ok",
        title: `Entitlement "${entFeature.trim()}" attached to ${activeSubject.display_name}`,
        detail: `Monthly limit: ${formatNumber(amt)} (${entSoft ? "Soft limit — overage billed" : "Hard stop"})`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Failed to attach entitlement",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEntId || !grantName.trim()) return;
    setSubmitting(true);
    const amt = Number(grantAmount) || 100000;
    try {
      await apiPost(
        `/api/v1/entitlements/${encodeURIComponent(grantEntId)}/grants`,
        {
          subject_key: activeSubject?.key,
          name: grantName.trim(),
          amount: amt,
          priority: Number(grantPriority) || 1,
        },
        namespace,
      );
      setDrawer(null);
      await refresh();
      if (activeSubject?.key && evalFeature) {
        await runEdgeEval(activeSubject.key, evalFeature);
      }
      setNotice({
        tone: "ok",
        title: `Credit grant "${grantName.trim()}" issued`,
        detail: `+${formatNumber(amt)} units added at priority ${grantPriority}.`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Failed to issue credit grant",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        orgName={org?.name}
        envType={env?.type}
        envName={env?.name}
        title="Customers & Quotas"
        subtitle="Customer 360° directory, metered allowances, sub-5ms edge quota evaluation, and priority credit grant waterfall."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDrawer("entitlement")} disabled={!activeSubject}>
              <ShieldCheck className="w-3.5 h-3.5" />
              Attach entitlement
            </Button>
            <Button variant="secondary" onClick={() => setDrawer("grant")} disabled={subjectEntitlements.length === 0}>
              <Coins className="w-3.5 h-3.5" />
              Issue credit grant
            </Button>
            <Button variant="primary" onClick={() => setDrawer("subject")}>
              <Plus className="w-3.5 h-3.5" />
              New customer
            </Button>
          </>
        }
      />

      {notice && <Notice tone={notice.tone} title={notice.title} detail={notice.detail} onDismiss={() => setNotice(null)} />}

      {/* Main Customer 360 Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Customer Directory */}
        <Card className="lg:col-span-4 flex flex-col">
          <CardHeader
            title="Customer directory"
            subtitle={`${snapshot.subjects.length} active subject${snapshot.subjects.length === 1 ? "" : "s"}`}
          />
          <div className="px-3 pb-3 space-y-2.5">
            <Input
              placeholder="Search customers by name or key…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {status === "loading" ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : filteredSubjects.length === 0 ? (
              <EmptyState title="No customers found" description="Create a customer subject to track usage and quotas." />
            ) : (
              <div className="space-y-2">
                {subjectListPagination.pageItems.map((s) => {
                  const selected = s.key === activeSubject?.key;
                  const usageList = entitlementUsage.filter((u) => u.subjectKey === s.key);
                  const topUsage = usageList.sort((a, b) => b.ratio - a.ratio)[0];
                  const sub = snapshot.subscriptions.find((subItem) => subItem.subject_key === s.key);
                  const ratio = topUsage?.ratio || 0;
                  const tone: Tone = ratio >= 1 ? (topUsage?.softLimit ? "warn" : "err") : ratio >= 0.8 ? "warn" : "ok";

                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSelectedKey(s.key)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                        selected
                          ? "border-[var(--primary)] bg-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold truncate">{s.display_name}</div>
                          <div className="text-[11.5px] mbx-mono text-[var(--muted-foreground)]">{s.key}</div>
                        </div>
                        {sub && (
                          <Pill tone="ok" mono>
                            {sub.plan_slug}
                          </Pill>
                        )}
                      </div>

                      {topUsage && (
                        <div className="mt-2.5">
                          <div className="flex justify-between text-[11.5px] mbx-num mb-1">
                            <span className="text-[var(--muted-foreground)] truncate">
                              {topUsage.featureName || humanizeKey(topUsage.featureKey)}
                            </span>
                            <span className="font-semibold">{formatPercent(ratio)}</span>
                          </div>
                          <ProgressBar value={ratio} tone={tone} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {filteredSubjects.length > 0 && (
            <Pagination
              state={subjectListPagination}
              pageSizeOptions={[4, 6, 12]}
              itemLabel="customers"
              compact
            />
          )}
        </Card>

        {/* Right: Customer 360 Profile */}
        <div className="lg:col-span-8 space-y-4">
          {!activeSubject ? (
            <Card className="p-8">
              <EmptyState title="Select a customer" description="Choose a customer on the left to inspect their 360° profile." />
            </Card>
          ) : (
            <>
              {/* Customer Header Card */}
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-[var(--accent)] text-[var(--primary)] flex items-center justify-center font-semibold">
                        {activeSubject.display_name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <h2 className="text-[18px] font-semibold tracking-[-0.015em]">{activeSubject.display_name}</h2>
                        <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] mbx-mono">
                          <span>subject: {activeSubject.key}</span>
                          {activeSubject.stripe_customer_id && <span>· stripe: {activeSubject.stripe_customer_id}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Segmented<ProfileTab>
                    ariaLabel="Customer 360 tabs"
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: "entitlements", label: `Quotas (${subjectEntitlements.length})` },
                      { value: "grants", label: `Credit Grants (${subjectGrants.length})` },
                      { value: "usage", label: `Events (${subjectEvents.length})` },
                      { value: "billing", label: `Invoices (${subjectInvoices.length})` },
                    ]}
                  />
                </div>

                {/* Mini customer telemetry row */}
                <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12.5px]">
                  <div>
                    <div className="text-[var(--muted-foreground)]">Active Plan</div>
                    <div className="mt-0.5 font-semibold mbx-mono">{subjectSubs[0]?.plan_slug || "Pay-as-you-go"}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted-foreground)]">Credit Pool Remaining</div>
                    <div className="mt-0.5 font-semibold mbx-num">
                      {formatCompact(subjectGrants.reduce((a, g) => a + g.remaining, 0))} units
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted-foreground)]">AI Cost / Revenue</div>
                    <div className="mt-0.5 font-semibold mbx-num">
                      {subjectCost
                        ? `$${subjectCost.cost_usd.toFixed(2)} / $${subjectCost.revenue_usd.toFixed(2)}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted-foreground)]">Gross Margin</div>
                    <div className="mt-0.5 font-semibold mbx-num">
                      {subjectCost ? `${subjectCost.margin_pct.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Tab 1: Entitlements & Sub-5ms Evaluator */}
              {tab === "entitlements" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader
                      title="Metered allowances & quotas"
                      subtitle="Real-time usage tracked against period limits and credit grants"
                      actions={
                        <Button size="sm" variant="secondary" onClick={() => setDrawer("entitlement")}>
                          <Plus className="w-3.5 h-3.5" /> Attach entitlement
                        </Button>
                      }
                    />
                    <div className="px-5 pb-5 space-y-4">
                      {subjectUsage.length === 0 ? (
                        <EmptyState
                          icon={<ShieldCheck className="w-5 h-5" />}
                          title="No entitlements attached"
                          description="Attach a metered entitlement to enforce hard or soft usage limits for this customer."
                        />
                      ) : (
                        subjectUsage.map((u) => {
                          const tone: Tone = u.ratio >= 1 ? (u.softLimit ? "warn" : "err") : u.ratio >= 0.8 ? "warn" : "ok";
                          return (
                            <div key={u.featureKey} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[14px] font-semibold">{u.featureName || humanizeKey(u.featureKey)}</div>
                                  <div className="text-[11.5px] mbx-mono text-[var(--muted-foreground)]">
                                    feature: {u.featureKey} · meter: {u.meterSlug}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Pill tone={u.softLimit ? "info" : "neutral"}>
                                    {u.softLimit ? "Soft limit (overage billed)" : "Hard stop"}
                                  </Pill>
                                  <Pill tone={u.hasAccess ? "ok" : "err"} mono>
                                    {u.hasAccess ? "ACCESS_GRANTED" : "QUOTA_EXCEEDED"}
                                  </Pill>
                                </div>
                              </div>
                              <div className="mt-3">
                                <div className="flex justify-between text-[12.5px] mbx-num mb-1.5">
                                  <span>
                                    Used <strong>{formatNumber(u.usage)}</strong> of{" "}
                                    <strong>{formatNumber(u.limit)}</strong>
                                  </span>
                                  <span className="font-semibold">{formatPercent(u.ratio)}</span>
                                </div>
                                <ProgressBar value={u.ratio} tone={tone} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>

                  {/* Sub-5ms Edge Quota Evaluator */}
                  <Card>
                    <CardHeader
                      title={
                        <span className="inline-flex items-center gap-2">
                          <Zap className="w-4 h-4 text-[var(--primary)]" />
                          Sub-5ms Edge Quota Evaluator
                        </span>
                      }
                      subtitle="Test the synchronous write-through Redis/Edge entitlement check endpoint"
                      actions={
                        <div className="flex items-center gap-2">
                          {subjectEntitlements.length > 0 && (
                            <select
                              value={evalFeature}
                              onChange={(e) => setEvalFeature(e.target.value)}
                              className="h-7 px-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] mbx-mono"
                            >
                              {subjectEntitlements.map((e) => (
                                <option key={e.feature_key} value={e.feature_key}>
                                  {e.feature_key}
                                </option>
                              ))}
                            </select>
                          )}
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={!evalFeature || evaluating}
                            onClick={() => runEdgeEval(activeSubject.key, evalFeature)}
                          >
                            <Gauge className="w-3.5 h-3.5" />
                            {evaluating ? "Checking…" : "Evaluate now"}
                          </Button>
                        </div>
                      }
                    />
                    <div className="px-5 pb-5">
                      {evalResult ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
                          <div>
                            <div className="text-[11.5px] text-[var(--muted-foreground)]">Decision</div>
                            <div className="mt-1 flex items-center gap-1.5 font-semibold text-[14px]">
                              <StatusDot tone={evalResult.has_access ? "ok" : "err"} live />
                              {evalResult.has_access ? "ALLOW (200 OK)" : "DENY (429 Quota)"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11.5px] text-[var(--muted-foreground)]">Edge Latency</div>
                            <div className="mt-1 font-semibold text-[14px] mbx-num">
                              {formatLatencyUs(evalResult.latency_us)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11.5px] text-[var(--muted-foreground)]">Period Usage</div>
                            <div className="mt-1 font-semibold text-[14px] mbx-num">
                              {formatCompact(evalResult.usage)} / {formatCompact(evalResult.limit)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11.5px] text-[var(--muted-foreground)]">Credit Balance</div>
                            <div className="mt-1 font-semibold text-[14px] mbx-num">
                              {formatCompact(evalResult.credit_balance)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[12.5px] text-[var(--muted-foreground)]">
                          Attach an entitlement above to run live sub-5ms edge quota evaluations.
                        </p>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {/* Tab 2: Priority Credit Grant Waterfall */}
              {tab === "grants" && (
                <Card>
                  <CardHeader
                    title="Priority Credit Grant Waterfall"
                    subtitle="Grants are consumed in strict priority order (Priority 1 burns first, then earliest expiration)"
                    actions={
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setDrawer("grant")}
                        disabled={subjectEntitlements.length === 0}
                      >
                        <Plus className="w-3.5 h-3.5" /> Issue credit grant
                      </Button>
                    }
                  />
                  <div className="px-5 pb-5 space-y-3">
                    {subjectGrants.length === 0 ? (
                      <EmptyState
                        icon={<Coins className="w-5 h-5" />}
                        title="No credit grants issued"
                        description="Issue a promotional or prepaid credit grant to offset metered usage for this customer."
                      />
                    ) : (
                      subjectGrantsPagination.pageItems.map((g, idx) => {
                        const used = g.used_balance != null ? g.used_balance : Math.max(0, g.amount - g.remaining);
                        const ratio = g.amount > 0 ? used / g.amount : 0;
                        const exhausted = g.remaining <= 0;
                        return (
                          <div key={g.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-md bg-[var(--surface-subtle)] text-[11.5px] font-semibold mbx-mono flex items-center justify-center">
                                  P{g.priority || idx + 1}
                                </span>
                                <div>
                                  <div className="text-[13.5px] font-semibold">{g.name}</div>
                                  <div className="text-[11.5px] mbx-mono text-[var(--muted-foreground)]">
                                    id: {g.id} {g.expires_at ? `· expires ${new Date(g.expires_at).toLocaleDateString()}` : ""}
                                  </div>
                                </div>
                              </div>
                              <Pill tone={exhausted ? "warn" : "ok"} mono>
                                {exhausted ? "EXHAUSTED" : `${formatCompact(g.remaining)} REMAINING`}
                              </Pill>
                            </div>
                            <div className="mt-3">
                              <div className="flex justify-between text-[12px] mbx-num text-[var(--muted-foreground)] mb-1">
                                <span>Consumed: {formatNumber(used)}</span>
                                <span>Granted: {formatNumber(g.amount)}</span>
                              </div>
                              <ProgressBar value={ratio} tone={exhausted ? "warn" : "ok"} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {subjectGrants.length > 0 && (
                    <Pagination
                      state={subjectGrantsPagination}
                      pageSizeOptions={[4, 6, 12]}
                      itemLabel="grants"
                      compact
                    />
                  )}
                </Card>
              )}

              {/* Tab 3: Customer Usage & CloudEvents */}
              {tab === "usage" && (
                <Card>
                  <CardHeader
                    title={`Recent CloudEvents for ${activeSubject.display_name}`}
                    subtitle={`Showing ${subjectEvents.length} recent events attributed to ${activeSubject.key}`}
                  />
                  <div className="overflow-x-auto mbx-scroll">
                    {subjectEvents.length === 0 ? (
                      <EmptyState
                        icon={<Layers className="w-5 h-5" />}
                        title="No recent events for this customer"
                        description="Send events with this customer's subject key in the Ingest Playground."
                      />
                    ) : (
                      <table className="min-w-[640px] w-full text-[12.5px]">
                        <thead>
                          <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                            <th className="px-5 py-2 text-left">Time</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Source</th>
                            <th className="px-5 py-2 text-left">Payload</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectEventsPagination.pageItems.map((e) => (
                            <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                              <td className="px-5 py-2 whitespace-nowrap text-[var(--muted-foreground)] mbx-num">
                                {relativeTime(e.time)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <Pill mono>{e.type}</Pill>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap mbx-mono text-[11.5px] text-[var(--muted-foreground)]">
                                {e.source}
                              </td>
                              <td className="px-5 py-2 mbx-mono text-[11.5px] text-[var(--muted-foreground)] truncate max-w-[340px]">
                                {JSON.stringify(e.data)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {subjectEvents.length > 0 && (
                    <Pagination
                      state={subjectEventsPagination}
                      pageSizeOptions={[5, 8, 15]}
                      itemLabel="events"
                    />
                  )}
                </Card>
              )}

              {/* Tab 4: Customer Invoices */}
              {tab === "billing" && (
                <Card>
                  <CardHeader
                    title="Customer Subscriptions & Invoices"
                    subtitle="Issued invoices with automated prepaid credit deductions and Stripe sync status"
                  />
                  <div className="px-5 pb-5 space-y-3">
                    {subjectInvoices.length === 0 ? (
                      <EmptyState
                        icon={<CreditCard className="w-5 h-5" />}
                        title="No invoices issued yet"
                        description="Generate an invoice for this customer under Revenue → Invoices."
                      />
                    ) : (
                      subjectInvoicesPagination.pageItems.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold mbx-mono text-[13px]">{inv.id}</span>
                              <Pill tone="ok" mono>
                                {inv.status}
                              </Pill>
                            </div>
                            <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                              Plan: <span className="mbx-mono">{inv.plan_slug}</span> · Stripe:{" "}
                              <span className="mbx-mono">{inv.stripe_invoice_id}</span>
                            </div>
                          </div>
                          <div className="text-right mbx-num">
                            <div className="text-[16px] font-semibold">
                              {formatCurrency(inv.total_cents, inv.currency)}
                            </div>
                            <div className="text-[11.5px] text-[var(--muted-foreground)]">
                              Subtotal {formatCurrency(inv.subtotal_cents, inv.currency)} − Credits{" "}
                              {formatCurrency(inv.credits_applied_cents, inv.currency)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {subjectInvoices.length > 0 && (
                    <Pagination
                      state={subjectInvoicesPagination}
                      pageSizeOptions={[4, 6, 12]}
                      itemLabel="invoices"
                      compact
                    />
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Drawer: New Customer */}
      <Drawer
        open={drawer === "subject"}
        onClose={() => setDrawer(null)}
        title="Register new customer"
        subtitle="Create a customer subject to meter usage, attach quotas, and bill subscriptions."
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <Field label="Subject key" hint="Immutable identifier used in CloudEvents.subject">
            <Input
              mono
              required
              placeholder="e.g. cust_enterprise_01"
              value={subKey}
              onChange={(e) => setSubKey(e.target.value)}
            />
          </Field>
          <Field label="Display name">
            <Input
              required
              placeholder="e.g. Enterprise Corp"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
            />
          </Field>
          <Field label="Stripe customer ID" hint="Optional Stripe billing mapping">
            <Input
              mono
              placeholder="cus_..."
              value={subStripe}
              onChange={(e) => setSubStripe(e.target.value)}
            />
          </Field>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              <Users className="w-3.5 h-3.5" />
              {submitting ? "Creating…" : "Create customer"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Attach Entitlement */}
      <Drawer
        open={drawer === "entitlement"}
        onClose={() => setDrawer(null)}
        title={`Attach entitlement · ${activeSubject?.display_name || ""}`}
        subtitle="Bind a feature key and meter limit to this customer."
      >
        <form onSubmit={handleCreateEntitlement} className="space-y-4">
          <Field label="Feature key">
            <Input
              mono
              required
              placeholder="monthly_llm_tokens"
              value={entFeature}
              onChange={(e) => setEntFeature(e.target.value)}
            />
          </Field>
          <Field label="Backing meter">
            <select
              value={entMeter}
              onChange={(e) => setEntMeter(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
            >
              {snapshot.meters.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name} ({m.slug})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Period allowance limit" hint="Resets monthly">
            <Input
              mono
              type="number"
              required
              value={entLimit}
              onChange={(e) => setEntLimit(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input
              type="checkbox"
              checked={entSoft}
              onChange={(e) => setEntSoft(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            <span>Soft limit (allow usage above quota and bill overages)</span>
          </label>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving…" : "Attach entitlement"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Issue Credit Grant */}
      <Drawer
        open={drawer === "grant"}
        onClose={() => setDrawer(null)}
        title={`Issue credit grant · ${activeSubject?.display_name || ""}`}
        subtitle="Add prepaid or promotional credits into the priority burn-down waterfall."
      >
        <form onSubmit={handleCreateGrant} className="space-y-4">
          <Field label="Target entitlement">
            <select
              value={grantEntId}
              onChange={(e) => setGrantEntId(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
            >
              {subjectEntitlements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.feature_key} ({e.id})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grant name">
            <Input
              required
              value={grantName}
              onChange={(e) => setGrantName(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Credit amount (units)">
              <Input
                mono
                type="number"
                required
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
              />
            </Field>
            <Field label="Burn priority" hint="1 = highest priority">
              <Input
                mono
                type="number"
                min={1}
                max={10}
                required
                value={grantPriority}
                onChange={(e) => setGrantPriority(e.target.value)}
              />
            </Field>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Issuing…" : "Issue credit grant"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
