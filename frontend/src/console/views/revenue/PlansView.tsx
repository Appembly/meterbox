"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileText, Layers, Plus, Users } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { apiPost } from "../../lib/api";
import { formatCompact, formatCurrency, humanizeKey } from "../../lib/format";
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
  Skeleton,
  usePagination,
} from "../../ui/primitives";

export const PlansView: React.FC = () => {
  const { org, env, namespace, snapshot, status, refresh } = useConsole();
  const [drawer, setDrawer] = useState<"plan" | "subscription" | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; title: string; detail?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Plan form
  const [planSlug, setPlanSlug] = useState("");
  const [planName, setPlanName] = useState("");
  const [planBaseFeeCents, setPlanBaseFeeCents] = useState("49900");
  const [planMeter, setPlanMeter] = useState("llm_tokens_total");
  const [planIncluded, setPlanIncluded] = useState("1000000");
  const [planUnitPriceCents, setPlanUnitPriceCents] = useState("2");

  // Subscription form
  const [subSubject, setSubSubject] = useState("");
  const [subPlan, setSubPlan] = useState("");

  useEffect(() => {
    if (!subSubject && snapshot.subjects.length > 0) setSubSubject(snapshot.subjects[0].key);
    if (!subPlan && snapshot.plans.length > 0) setSubPlan(snapshot.plans[0].slug);
    if (snapshot.meters.length > 0 && !snapshot.meters.some((m) => m.slug === planMeter)) {
      setPlanMeter(snapshot.meters[0].slug);
    }
  }, [snapshot.subjects, snapshot.plans, snapshot.meters, subSubject, subPlan, planMeter]);

  const subjectNameMap = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.key, s.display_name])),
    [snapshot.subjects],
  );
  const subPagination = usePagination(snapshot.subscriptions, 10);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planSlug.trim() || !planName.trim()) return;
    setSubmitting(true);
    const baseCents = Number(planBaseFeeCents) || 0;
    const incUnits = Number(planIncluded) || 0;
    const unitPrice = Number(planUnitPriceCents) || 1;
    try {
      await apiPost(
        "/api/v1/plans",
        {
          slug: planSlug.trim(),
          name: planName.trim(),
          currency: "USD",
          base_fee_cents: baseCents,
          base_price_cents: baseCents,
          billing_cadence: "MONTH",
          included_credits: incUnits,
          rate_cards: planMeter
            ? [
                {
                  feature_key: planMeter,
                  meter_slug: planMeter,
                  name: `${humanizeKey(planMeter)} overage`,
                  pricing_model: "flat_per_unit",
                  included_quantity: incUnits,
                  tiers: [{ unit_price_cents: unitPrice, flat_fee_cents: 0 }],
                },
              ]
            : [],
        },
        namespace,
      );
      const created = planSlug.trim();
      setPlanSlug("");
      setPlanName("");
      setDrawer(null);
      await refresh();
      setNotice({
        tone: "ok",
        title: `Pricing plan "${created}" published`,
        detail: "Available immediately for customer subscriptions and automated invoicing.",
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Could not publish plan",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subSubject || !subPlan) return;
    setSubmitting(true);
    try {
      await apiPost(
        "/api/v1/subscriptions",
        {
          subject_key: subSubject,
          plan_slug: subPlan,
        },
        namespace,
      );
      setDrawer(null);
      await refresh();
      setNotice({
        tone: "ok",
        title: `Subscribed ${subjectNameMap.get(subSubject) || subSubject} to ${subPlan}`,
        detail: "Metered usage will now be rated against this plan's rate cards.",
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Could not create subscription",
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
        title="Plans & Subscriptions"
        subtitle="Hybrid subscription base fees combined with graduated, volume, or per-unit metered rate cards."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDrawer("subscription")}>
              <Users className="w-3.5 h-3.5" />
              Assign subscription
            </Button>
            <Button variant="primary" onClick={() => setDrawer("plan")}>
              <Plus className="w-3.5 h-3.5" />
              Create plan
            </Button>
          </>
        }
      />

      {notice && <Notice tone={notice.tone} title={notice.title} detail={notice.detail} onDismiss={() => setNotice(null)} />}

      {/* Pricing Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {status === "loading" ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-56 w-full" />)
        ) : snapshot.plans.length === 0 ? (
          <Card className="md:col-span-2">
            <EmptyState
              icon={<FileText className="w-5 h-5" />}
              title="No pricing plans configured"
              description="Create a hybrid pricing plan combining a monthly base fee with usage-based rate cards."
              action={
                <Button variant="primary" size="sm" onClick={() => setDrawer("plan")}>
                  <Plus className="w-3.5 h-3.5" /> Create plan
                </Button>
              }
            />
          </Card>
        ) : (
          snapshot.plans.map((p) => {
            const subCount = snapshot.subscriptions.filter((s) => s.plan_slug === p.slug).length;
            return (
              <Card key={p.id || p.slug} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[16px] font-semibold tracking-[-0.015em]">{p.name}</h2>
                      <div className="text-[12px] mbx-mono text-[var(--muted-foreground)]">{p.slug}</div>
                    </div>
                    <Pill tone="ok" mono>
                      {subCount} active sub{subCount === 1 ? "" : "s"}
                    </Pill>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-[28px] font-semibold tracking-[-0.03em] mbx-num">
                      {formatCurrency(p.base_fee_cents, p.currency)}
                    </span>
                    <span className="text-[12.5px] text-[var(--muted-foreground)]">
                      / {p.billing_cadence.toLowerCase()} base fee
                    </span>
                  </div>

                  {/* Metered rate cards */}
                  <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2.5">
                    <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Metered Rate Cards ({p.components?.length || 0})
                    </div>
                    {(!p.components || p.components.length === 0) ? (
                      <p className="text-[12.5px] text-[var(--muted-foreground)]">Flat subscription only</p>
                    ) : (
                      p.components.map((comp, idx) => (
                        <div
                          key={`${comp.meter_slug}-${idx}`}
                          className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[12px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{comp.name || comp.meter_slug}</span>
                            <Pill mono>{comp.model || "flat_per_unit"}</Pill>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[var(--muted-foreground)] mbx-num">
                            <span className="mbx-mono">meter: {comp.meter_slug}</span>
                            <span>Included: {formatCompact(comp.included_units || 0)} units</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Active Subscriptions Table */}
      <Card>
        <CardHeader
          title="Active customer subscriptions"
          subtitle="Customers bound to pricing plans for automated period rating and Stripe invoicing"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setDrawer("subscription")}>
              <Plus className="w-3.5 h-3.5" /> Assign subscription
            </Button>
          }
        />
        <div className="overflow-x-auto mbx-scroll">
          {snapshot.subscriptions.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-5 h-5" />}
              title="No active subscriptions"
              description="Assign a customer to a pricing plan to generate usage-based invoices."
            />
          ) : (
            <table className="min-w-[640px] w-full text-[12.5px]">
              <thead>
                <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                  <th className="px-5 py-2.5 text-left">Subscription ID</th>
                  <th className="px-3 py-2.5 text-left">Customer</th>
                  <th className="px-3 py-2.5 text-left">Plan</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-5 py-2.5 text-right">Current Period</th>
                </tr>
              </thead>
              <tbody>
                {subPagination.pageItems.map((sub) => (
                  <tr key={sub.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-5 py-2.5 mbx-mono text-[12px]">{sub.id}</td>
                    <td className="px-3 py-2.5 font-medium">
                      {subjectNameMap.get(sub.subject_key) || sub.subject_key}
                      <span className="ml-1.5 text-[11px] mbx-mono text-[var(--muted-foreground)]">
                        ({sub.subject_key})
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone="ok" mono>
                        {sub.plan_slug}
                      </Pill>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={sub.status === "active" ? "ok" : "neutral"} mono>
                        {sub.status}
                      </Pill>
                    </td>
                    <td className="px-5 py-2.5 text-right text-[var(--muted-foreground)] mbx-num">
                      {sub.current_period_start
                        ? `${new Date(sub.current_period_start).toLocaleDateString()} → ${new Date(
                            sub.current_period_end,
                          ).toLocaleDateString()}`
                        : "Current month"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {snapshot.subscriptions.length > 0 && (
          <Pagination
            state={subPagination}
            pageSizeOptions={[5, 10, 20]}
            itemLabel="subscriptions"
          />
        )}
      </Card>

      {/* Drawer: Create Plan */}
      <Drawer
        open={drawer === "plan"}
        onClose={() => setDrawer(null)}
        title="Create hybrid pricing plan"
        subtitle="Combine a recurring base fee with a metered overage rate card."
      >
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <Field label="Plan slug" hint="Unique identifier">
            <Input
              mono
              required
              placeholder="e.g. enterprise_ai_scale"
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value)}
            />
          </Field>
          <Field label="Plan display name">
            <Input
              required
              placeholder="e.g. Enterprise AI Scale"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </Field>
          <Field label="Monthly base fee (cents)" hint="49900 = $499.00">
            <Input
              mono
              type="number"
              required
              value={planBaseFeeCents}
              onChange={(e) => setPlanBaseFeeCents(e.target.value)}
            />
          </Field>
          <Field label="Metered component">
            <select
              value={planMeter}
              onChange={(e) => setPlanMeter(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
            >
              {snapshot.meters.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name} ({m.slug})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Included monthly units">
              <Input
                mono
                type="number"
                value={planIncluded}
                onChange={(e) => setPlanIncluded(e.target.value)}
              />
            </Field>
            <Field label="Overage unit price (cents)">
              <Input
                mono
                type="number"
                value={planUnitPriceCents}
                onChange={(e) => setPlanUnitPriceCents(e.target.value)}
              />
            </Field>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Publishing…" : "Publish plan"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Assign Subscription */}
      <Drawer
        open={drawer === "subscription"}
        onClose={() => setDrawer(null)}
        title="Assign customer subscription"
        subtitle="Bind a customer subject to an active pricing plan."
      >
        <form onSubmit={handleCreateSubscription} className="space-y-4">
          <Field label="Customer (subject)">
            <select
              value={subSubject}
              onChange={(e) => setSubSubject(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pricing plan">
            <select
              value={subPlan}
              onChange={(e) => setSubPlan(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
            >
              {snapshot.plans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} ({p.slug})
                </option>
              ))}
            </select>
          </Field>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Assigning…" : "Assign subscription"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
