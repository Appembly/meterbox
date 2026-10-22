"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Copy,
  CreditCard,
  FileText,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Webhook,
  Zap,
} from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { apiPost } from "../../lib/api";
import { formatCompact, formatCurrency, humanizeKey, relativeTime } from "../../lib/format";
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
  Select,
  Skeleton,
  usePagination,
} from "../../ui/primitives";
import type { Invoice } from "../../../types/meterbox";

type RevenueTab = "invoices" | "cards" | "recharge" | "webhooks";

export const InvoicesView: React.FC = () => {
  const { org, env, namespace, snapshot, status, refresh, navigate } = useConsole();
  const [activeTab, setActiveTab] = useState<RevenueTab>("invoices");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Drawers
  const [genOpen, setGenOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);

  // Form states
  const [genSubject, setGenSubject] = useState("");
  const [genPlan, setGenPlan] = useState("pay_as_you_go");
  const [submitting, setSubmitting] = useState(false);

  const [cardSubject, setCardSubject] = useState("");
  const [cardProvider, setCardProvider] = useState("stripe");
  const [cardBrand, setCardBrand] = useState("visa");
  const [cardLast4, setCardLast4] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");

  const [topupSubject, setTopupSubject] = useState("");
  const [topupUnits, setTopupUnits] = useState("2500000");
  const [topupCents, setTopupCents] = useState("5000");
  const [topupInstant, setTopupInstant] = useState(true);

  const [ruleSubject, setRuleSubject] = useState("");
  const [ruleFeature, setRuleFeature] = useState("ai_token_allowance");
  const [ruleThreshold, setRuleThreshold] = useState("500000");
  const [ruleRecharge, setRuleRecharge] = useState("2500000");
  const [ruleCents, setRuleCents] = useState("5000");

  const [whType, setWhType] = useState("payment_intent.succeeded");
  const [whSubject, setWhSubject] = useState("");
  const [whObjectId, setWhObjectId] = useState("");
  const [whCents, setWhCents] = useState("5000");
  const [whUnits, setWhUnits] = useState("2500000");

  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; title: string; detail?: string } | null>(null);

  useEffect(() => {
    if (snapshot.subjects.length > 0) {
      const defSub = snapshot.subjects[0].key;
      if (!genSubject) setGenSubject(defSub);
      if (!cardSubject) setCardSubject(defSub);
      if (!topupSubject) setTopupSubject(defSub);
      if (!ruleSubject) setRuleSubject(defSub);
      if (!whSubject) setWhSubject(defSub);
    }
    if ((!genPlan || genPlan === "pay_as_you_go") && snapshot.plans.length > 0) {
      setGenPlan(snapshot.plans[0].slug);
    }
  }, [snapshot.subjects, snapshot.plans, genSubject, cardSubject, topupSubject, ruleSubject, whSubject, genPlan]);

  const subjectNameMap = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.key, s.display_name])),
    [snapshot.subjects],
  );
  const planNameMap = useMemo(
    () =>
      new Map([
        ["pay_as_you_go", "Pay-as-you-go (Direct Metered Usage)"],
        ...snapshot.plans.map((p) => [p.slug, p.name] as [string, string]),
      ]),
    [snapshot.plans],
  );

  const invPagination = usePagination(snapshot.invoices, 10);
  const cardsPagination = usePagination(snapshot.paymentMethods, 10);
  const sessionsPagination = usePagination(snapshot.checkoutSessions, 8);
  const webhooksPagination = usePagination(snapshot.paymentWebhooks, 10);

  const totals = useMemo(() => {
    const subtotal = snapshot.invoices.reduce((a, i) => a + i.subtotal_cents, 0);
    const credits = snapshot.invoices.reduce((a, i) => a + i.credits_applied_cents, 0);
    const net = snapshot.invoices.reduce((a, i) => a + i.total_cents, 0);
    const topupVolume = snapshot.checkoutSessions
      .filter((c) => c.status === "succeeded")
      .reduce((a, c) => a + c.amount_cents, 0);
    return { subtotal, credits, net, topupVolume };
  }, [snapshot.invoices, snapshot.checkoutSessions]);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genSubject) return;
    setSubmitting(true);
    try {
      const raw = await apiPost<Record<string, unknown>>(
        "/api/v1/invoices/generate",
        {
          subject_key: genSubject,
          plan_slug: genPlan || "pay_as_you_go",
          sync_to_stripe: true,
        },
        namespace,
      );
      setGenOpen(false);
      await refresh();
      setNotice({
        tone: "ok",
        title: `Invoice ${String(raw.id || "inv_new")} issued & synced to Stripe`,
        detail: `Stripe invoice: ${String(raw.stripe_invoice_id || "in_stripe_live")}`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Invoice generation failed",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkInvoicePaid = async (inv: Invoice) => {
    setSubmitting(true);
    try {
      await apiPost(
        "/api/v1/webhooks/stripe",
        {
          type: "invoice.paid",
          subject_key: inv.subject_key,
          object_id: inv.stripe_invoice_id || inv.id,
          amount_cents: inv.total_cents,
        },
        namespace,
      );
      await refresh();
      setSelectedInvoice((prev) => (prev && prev.id === inv.id ? { ...prev, status: "paid" } : prev));
      setNotice({
        tone: "ok",
        title: `Processed invoice.paid webhook for ${inv.id}`,
        detail: `Marked ${inv.stripe_invoice_id || inv.id} as PAID (${formatCurrency(inv.total_cents, inv.currency)})`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Webhook simulation failed",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedLast4 = cardLast4.trim() || "4242";
    const resolvedExpMonth = Number(cardExpMonth) || 12;
    const resolvedExpYear = Number(cardExpYear) || 2029;
    setSubmitting(true);
    try {
      const raw = await apiPost<Record<string, unknown>>(
        "/api/v1/payment-methods",
        {
          subject_key: cardSubject,
          provider: cardProvider,
          brand: cardBrand,
          last4: resolvedLast4,
          exp_month: resolvedExpMonth,
          exp_year: resolvedExpYear,
          is_default: true,
        },
        namespace,
      );
      setCardOpen(false);
      setCardLast4("");
      setCardExpMonth("");
      setCardExpYear("");
      await refresh();
      setNotice({
        tone: "ok",
        title: `Vaulted ${cardBrand.toUpperCase()} •••• ${resolvedLast4} (${String(raw.id || "pm_mbx")})`,
        detail: `Token: ${String(raw.provider_payment_method_id || "pm_live")} set as default for ${cardSubject}`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Failed to attach payment method",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefaultCard = async (pmId: string) => {
    try {
      await apiPost(`/api/v1/payment-methods/${pmId}/default`, {}, namespace);
      await refresh();
      setNotice({ tone: "ok", title: `Updated default payment method (${pmId})` });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Could not update default card",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  const handleCreateTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const raw = await apiPost<{ session?: Record<string, unknown>; grant?: Record<string, unknown> }>(
        "/api/v1/checkout/sessions",
        {
          subject_key: topupSubject,
          provider: "stripe",
          mode: "topup",
          feature_key: "ai_token_allowance",
          grant_units: Number(topupUnits) || 2500000,
          amount_cents: Number(topupCents) || 5000,
          instant_complete: topupInstant,
        },
        namespace,
      );
      setTopupOpen(false);
      await refresh();
      setNotice({
        tone: "ok",
        title: topupInstant
          ? `Credit top-up completed & Priority-1 grant ${String(raw.grant?.id || "grt_new")} minted`
          : `Created Stripe Checkout session ${String(raw.session?.provider_session_id || "cs_live")}`,
        detail: topupInstant
          ? `+${formatCompact(Number(topupUnits))} units added to ${topupSubject} and edge cache invalidated`
          : `Checkout URL: ${String(raw.session?.checkout_url || "")}`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Checkout session creation failed",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost(
        "/api/v1/auto-recharge",
        {
          subject_key: ruleSubject,
          feature_key: ruleFeature,
          enabled: true,
          threshold_units: Number(ruleThreshold) || 500000,
          recharge_units: Number(ruleRecharge) || 2500000,
          charge_amount_cents: Number(ruleCents) || 5000,
          currency: "USD",
        },
        namespace,
      );
      setRuleOpen(false);
      await refresh();
      setNotice({
        tone: "ok",
        title: `Saved auto-recharge rule for ${ruleSubject}`,
        detail: `When < ${formatCompact(Number(ruleThreshold))} units → recharge +${formatCompact(Number(ruleRecharge))} units (${formatCurrency(Number(ruleCents))})`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Could not save auto-recharge rule",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerRecharge = async (subjectKey: string, featureKey: string) => {
    setSubmitting(true);
    try {
      const raw = await apiPost<{ grant?: Record<string, unknown>; session?: Record<string, unknown> }>(
        `/api/v1/auto-recharge/${encodeURIComponent(subjectKey)}/trigger`,
        { feature_key: featureKey },
        namespace,
      );
      await refresh();
      setNotice({
        tone: "ok",
        title: `Auto-recharge executed for ${subjectKey}`,
        detail: `Charged default card (${String(raw.session?.payment_intent_id || "pi_auto")}) & minted grant ${String(raw.grant?.id || "grt_auto")}`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Auto-recharge trigger failed",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const raw = await apiPost<Record<string, unknown>>(
        "/api/v1/webhooks/stripe",
        {
          type: whType,
          subject_key: whSubject,
          object_id: whObjectId || undefined,
          amount_cents: Number(whCents) || 5000,
          grant_units: Number(whUnits) || 2500000,
        },
        namespace,
      );
      setWebhookOpen(false);
      await refresh();
      setNotice({
        tone: "ok",
        title: `Processed ${whType} (${String(raw.event_id || "evt_stripe")})`,
        detail: String(raw.action_taken || "Webhook processed"),
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Webhook simulation failed",
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
        title="Invoices & Payment Orchestration"
        subtitle="Usage-rated invoices, vaulted payment methods, automated credit top-ups, and Stripe / Paystack webhook orchestration."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setCardOpen(true)}>
              <CreditCard className="w-3.5 h-3.5" />
              Vault card
            </Button>
            <Button variant="secondary" onClick={() => setTopupOpen(true)}>
              <Zap className="w-3.5 h-3.5" />
              Top up credits
            </Button>
            <Button variant="primary" onClick={() => setGenOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Generate invoice
            </Button>
          </div>
        }
      />

      {notice && <Notice tone={notice.tone} title={notice.title} detail={notice.detail} onDismiss={() => setNotice(null)} />}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Net invoiced revenue</span>
            <CircleDollarSign className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{formatCurrency(totals.net)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            {formatCurrency(totals.subtotal)} gross − {formatCurrency(totals.credits)} credits
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Saved payment methods</span>
            <CreditCard className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{snapshot.paymentMethods.length}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Tokenized cards ready for off-session billing
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Active auto-recharge rules</span>
            <RefreshCw className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">
            {snapshot.autoRechargeRules.filter((r) => r.enabled).length}
          </div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            {formatCurrency(totals.topupVolume)} recharged across {snapshot.checkoutSessions.length} sessions
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Verified payment webhooks</span>
            <Webhook className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{snapshot.paymentWebhooks.length}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            `invoice.paid` &amp; `payment_intent.succeeded`
          </div>
        </Card>
      </div>

      {/* Sub-navigation Tabs (Calm Underline Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-1 -mb-px">
          {(
            [
              { id: "invoices", label: "Invoices Ledger", count: snapshot.invoices.length, icon: Receipt },
              { id: "cards", label: "Saved Payment Methods", count: snapshot.paymentMethods.length, icon: CreditCard },
              {
                id: "recharge",
                label: "Top-Ups & Auto-Recharge",
                count: snapshot.autoRechargeRules.length,
                icon: RefreshCw,
              },
              { id: "webhooks", label: "Webhook Events", count: snapshot.paymentWebhooks.length, icon: Webhook },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 h-10 px-3.5 border-b-2 text-[13px] transition-colors cursor-pointer ${
                  active
                    ? "border-[var(--primary)] text-[var(--foreground)] font-semibold"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-medium"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-[var(--primary)]" : ""}`} />
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold mbx-num ${
                    active
                      ? "bg-[var(--accent)] text-[var(--primary)]"
                      : "bg-[var(--surface-subtle)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pb-2">
          <Button variant="secondary" size="sm" onClick={() => setWebhookOpen(true)}>
            <Webhook className="w-3.5 h-3.5" />
            Test webhook delivery
          </Button>
        </div>
      </div>

      {/* TAB 1: INVOICES LEDGER */}
      {activeTab === "invoices" && (
        <Card>
          <CardHeader
            title="Issued invoices ledger"
            subtitle="Click any invoice to inspect itemized rating or record payment collection"
          />
          <div className="overflow-x-auto mbx-scroll">
            {status === "loading" ? (
              <div className="p-5 space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : snapshot.invoices.length === 0 ? (
              <EmptyState
                icon={<Receipt className="w-5 h-5" />}
                title="No invoices issued yet"
                description="Generate a usage-rated invoice for any customer subscription."
                action={
                  <Button variant="primary" size="sm" onClick={() => setGenOpen(true)}>
                    <Plus className="w-3.5 h-3.5" /> Generate invoice
                  </Button>
                }
              />
            ) : (
              <table className="min-w-[780px] w-full text-[13px]">
                <thead>
                  <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                    <th className="px-5 py-2.5 text-left">Invoice ID</th>
                    <th className="px-3 py-2.5 text-left">Customer</th>
                    <th className="px-3 py-2.5 text-left">Plan</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                    <th className="px-3 py-2.5 text-right">Credits</th>
                    <th className="px-3 py-2.5 text-right">Net Total</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-5 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invPagination.pageItems.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-semibold mbx-mono">{inv.id}</td>
                      <td className="px-3 py-3 font-medium">
                        {subjectNameMap.get(inv.subject_key) || inv.subject_key}
                      </td>
                      <td className="px-3 py-3 text-[var(--muted-foreground)]">
                        {planNameMap.get(inv.plan_slug) || humanizeKey(inv.plan_slug)}
                      </td>
                      <td className="px-3 py-3 text-right mbx-num text-[var(--muted-foreground)]">
                        {formatCurrency(inv.subtotal_cents, inv.currency)}
                      </td>
                      <td className="px-3 py-3 text-right mbx-num text-[var(--primary)]">
                        −{formatCurrency(inv.credits_applied_cents, inv.currency)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold mbx-num">
                        {formatCurrency(inv.total_cents, inv.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <Pill
                          tone={inv.status === "paid" ? "ok" : inv.status === "payment_failed" ? "err" : "info"}
                        >
                          {inv.status === "paid"
                            ? "Paid"
                            : inv.status === "payment_failed"
                            ? "Failed"
                            : inv.status.replace("_", " ")}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {inv.status !== "paid" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={submitting}
                            onClick={() => handleMarkInvoicePaid(inv)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Charge card
                          </Button>
                        ) : (
                          <span className="text-[12px] text-[var(--muted-foreground)] mbx-num">
                            {inv.paid_at ? relativeTime(inv.paid_at) : "Paid"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {snapshot.invoices.length > 0 && (
            <Pagination state={invPagination} pageSizeOptions={[5, 10, 20]} itemLabel="invoices" />
          )}
        </Card>
      )}

      {/* TAB 2: SAVED PAYMENT METHODS */}
      {activeTab === "cards" && (
        <div className="space-y-4">
          {snapshot.paymentMethods.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {snapshot.paymentMethods.slice(0, 6).map((pm) => (
                <div
                  key={pm.id}
                  className={`relative rounded-[14px] p-4 border transition-all ${
                    pm.is_default
                      ? "bg-[var(--card)] border-[var(--primary)]/45 shadow-sm"
                      : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[var(--surface-subtle)] border border-[var(--border)] text-[11px] font-bold uppercase tracking-wider mbx-mono text-[var(--foreground)]">
                        {pm.brand}
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wider mbx-mono text-[var(--muted-foreground)]">
                        {pm.provider}
                      </span>
                    </div>
                    {pm.is_default ? (
                      <Pill tone="ok">Default card</Pill>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleSetDefaultCard(pm.id)}>
                        Set default
                      </Button>
                    )}
                  </div>

                  <div className="mt-3.5 flex items-baseline justify-between">
                    <div className="text-[16px] font-semibold tracking-[0.12em] mbx-mono text-[var(--foreground)]">
                      •••• •••• •••• {pm.last4}
                    </div>
                    <div className="text-[12px] mbx-mono text-[var(--muted-foreground)]">
                      Exp {String(pm.exp_month).padStart(2, "0")}/{String(pm.exp_year).slice(-2)}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--foreground)] truncate">
                      {subjectNameMap.get(pm.subject_key) || pm.subject_key}
                    </span>
                    <span className="text-[11px] mbx-mono text-[var(--muted-foreground)] truncate max-w-[150px]">
                      {pm.provider_payment_method_id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardHeader
              title="Vaulted customer payment methods"
              subtitle="Non-PCI payment tokens (`pm_...`) stored via Stripe / Paystack SetupIntents for off-session charges"
              actions={
                <Button variant="primary" size="sm" onClick={() => setCardOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Vault payment method
                </Button>
              }
            />
            <div className="overflow-x-auto mbx-scroll">
              {snapshot.paymentMethods.length === 0 ? (
                <EmptyState
                  icon={<CreditCard className="w-5 h-5" />}
                  title="No saved payment methods"
                  description="Vault a customer card via Stripe or Paystack SetupIntent to enable off-session billing and auto-recharge."
                  action={
                    <Button variant="primary" size="sm" onClick={() => setCardOpen(true)}>
                      <Plus className="w-3.5 h-3.5" /> Vault payment method
                    </Button>
                  }
                />
              ) : (
                <table className="min-w-[780px] w-full text-[12.5px]">
                  <thead>
                    <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                      <th className="px-5 py-2.5 text-left">Card / Method</th>
                      <th className="px-3 py-2.5 text-left">Customer (Subject)</th>
                      <th className="px-3 py-2.5 text-left">Provider Token</th>
                      <th className="px-3 py-2.5 text-left">Customer ID</th>
                      <th className="px-3 py-2.5 text-left">Expires</th>
                      <th className="px-3 py-2.5 text-left">Status</th>
                      <th className="px-5 py-2.5 text-right">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardsPagination.pageItems.map((pm) => (
                      <tr key={pm.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]">
                        <td className="px-5 py-2.5 font-semibold">
                          <span className="uppercase">{pm.brand}</span> •••• {pm.last4}
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {subjectNameMap.get(pm.subject_key) || pm.subject_key}
                          <div className="text-[11px] mbx-mono text-[var(--muted-foreground)]">{pm.subject_key}</div>
                        </td>
                        <td className="px-3 py-2.5 mbx-mono text-[12px] text-[var(--muted-foreground)]">
                          {pm.provider_payment_method_id}
                        </td>
                        <td className="px-3 py-2.5 mbx-mono text-[12px] text-[var(--muted-foreground)]">
                          {pm.provider_customer_id}
                        </td>
                        <td className="px-3 py-2.5 mbx-num">
                          {String(pm.exp_month).padStart(2, "0")}/{pm.exp_year}
                        </td>
                        <td className="px-3 py-2.5">
                          <Pill tone="ok" mono>
                            {pm.provider.toUpperCase()} · {pm.status.toUpperCase()}
                          </Pill>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          {pm.is_default ? (
                            <Pill tone="ok">Default card</Pill>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleSetDefaultCard(pm.id)}>
                              Set default
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {snapshot.paymentMethods.length > 0 && (
              <Pagination state={cardsPagination} pageSizeOptions={[5, 10, 20]} itemLabel="payment methods" />
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: TOP-UPS & AUTO-RECHARGE */}
      {activeTab === "recharge" && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Auto-recharge threshold rules"
              subtitle="When a customer's remaining entitlement balance drops below the threshold, Meterbox charges their default card off-session and mints a Priority-1 credit grant"
              actions={
                <Button variant="primary" size="sm" onClick={() => setRuleOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Configure rule
                </Button>
              }
            />
            <div className="overflow-x-auto mbx-scroll">
              <table className="min-w-[820px] w-full text-[12.5px]">
                <thead>
                  <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                    <th className="px-5 py-2.5 text-left">Customer</th>
                    <th className="px-3 py-2.5 text-left">Feature</th>
                    <th className="px-3 py-2.5 text-right">Trigger Threshold</th>
                    <th className="px-3 py-2.5 text-right">Recharge Grant</th>
                    <th className="px-3 py-2.5 text-right">Off-Session Charge</th>
                    <th className="px-3 py-2.5 text-left">Triggers</th>
                    <th className="px-5 py-2.5 text-right">Test Action</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.autoRechargeRules.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]">
                      <td className="px-5 py-2.5 font-medium">
                        {subjectNameMap.get(r.subject_key) || r.subject_key}
                        <div className="text-[11px] mbx-mono text-[var(--muted-foreground)]">{r.subject_key}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill mono>{r.feature_key}</Pill>
                      </td>
                      <td className="px-3 py-2.5 text-right mbx-num">
                        &lt; {formatCompact(r.threshold_units)} units
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[var(--primary)] mbx-num">
                        +{formatCompact(r.recharge_units)} units
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold mbx-num">
                        {formatCurrency(r.charge_amount_cents, r.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted-foreground)] mbx-num">
                        {r.total_triggers}×{" "}
                        {r.last_triggered_at ? `· last ${relativeTime(r.last_triggered_at)}` : "· armed"}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={submitting}
                          onClick={() => handleTriggerRecharge(r.subject_key, r.feature_key)}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Trigger recharge
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Checkout & off-session recharge sessions"
              subtitle="Hosted Stripe Checkout top-ups and automated off-session PaymentIntents"
              actions={
                <Button variant="secondary" size="sm" onClick={() => setTopupOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> New top-up session
                </Button>
              }
            />
            <div className="overflow-x-auto mbx-scroll">
              <table className="min-w-[780px] w-full text-[12.5px]">
                <thead>
                  <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                    <th className="px-5 py-2.5 text-left">Session ID</th>
                    <th className="px-3 py-2.5 text-left">Customer</th>
                    <th className="px-3 py-2.5 text-left">Mode</th>
                    <th className="px-3 py-2.5 text-right">Units Granted</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-left">Minted Grant</th>
                    <th className="px-5 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsPagination.pageItems.map((cs) => (
                    <tr key={cs.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]">
                      <td className="px-5 py-2.5 mbx-mono font-semibold">{cs.id}</td>
                      <td className="px-3 py-2.5 font-medium">
                        {subjectNameMap.get(cs.subject_key) || cs.subject_key}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill mono>{cs.mode}</Pill>
                      </td>
                      <td className="px-3 py-2.5 text-right mbx-num text-[var(--primary)] font-medium">
                        {cs.grant_units ? `+${formatCompact(cs.grant_units)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right mbx-num font-semibold">
                        {formatCurrency(cs.amount_cents, cs.currency)}
                      </td>
                      <td className="px-3 py-2.5 mbx-mono text-[12px] text-[var(--muted-foreground)]">
                        {cs.grant_id || cs.payment_intent_id || "pending"}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Pill tone={cs.status === "succeeded" ? "ok" : "info"} mono>
                          {cs.status.toUpperCase()}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {snapshot.checkoutSessions.length > 0 && (
              <Pagination state={sessionsPagination} pageSizeOptions={[5, 8, 15]} itemLabel="sessions" />
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: WEBHOOK EVENTS LEDGER */}
      {activeTab === "webhooks" && (
        <Card>
          <CardHeader
            title="Payment provider webhook ledger (`/webhooks/stripe`)"
            subtitle="Idempotent processing of `payment_intent.succeeded`, `invoice.paid`, `invoice.payment_failed`, and `setup_intent.succeeded`"
            actions={
              <Button variant="primary" size="sm" onClick={() => setWebhookOpen(true)}>
                <Webhook className="w-3.5 h-3.5" /> Simulate webhook
              </Button>
            }
          />
          <div className="overflow-x-auto mbx-scroll">
            <table className="min-w-[840px] w-full text-[12.5px]">
              <thead>
                <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                  <th className="px-5 py-2.5 text-left">Event Type</th>
                  <th className="px-3 py-2.5 text-left">Customer</th>
                  <th className="px-3 py-2.5 text-left">Provider Object</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-left">Orchestration Action Taken</th>
                  <th className="px-5 py-2.5 text-right">Received</th>
                </tr>
              </thead>
              <tbody>
                {webhooksPagination.pageItems.map((wh) => (
                  <tr key={wh.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Pill
                          tone={
                            wh.event_type.includes("failed")
                              ? "err"
                              : wh.event_type.includes("succeeded") || wh.event_type.includes("paid")
                              ? "ok"
                              : "info"
                          }
                          mono
                        >
                          {wh.event_type}
                        </Pill>
                        {wh.signature_verified && (
                          <span title="HMAC-SHA256 Stripe-Signature verified" className="text-[var(--primary)]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      {subjectNameMap.get(wh.subject_key) || wh.subject_key}
                    </td>
                    <td className="px-3 py-2.5 mbx-mono text-[12px] text-[var(--muted-foreground)]">
                      {wh.object_id}
                    </td>
                    <td className="px-3 py-2.5 text-right mbx-num font-medium">
                      {wh.amount_cents > 0 ? formatCurrency(wh.amount_cents, wh.currency) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--muted-foreground)] max-w-[340px] truncate">
                      {wh.action_taken}
                    </td>
                    <td className="px-5 py-2.5 text-right text-[var(--muted-foreground)] mbx-num">
                      {wh.received_at ? relativeTime(wh.received_at) : "just now"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {snapshot.paymentWebhooks.length > 0 && (
            <Pagination state={webhooksPagination} pageSizeOptions={[5, 10, 20]} itemLabel="webhook events" />
          )}
        </Card>
      )}

      {/* Printable Invoice Sheet Drawer */}
      <Drawer
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice ? `Invoice ${selectedInvoice.id}` : "Invoice Sheet"}
        subtitle={selectedInvoice ? `Stripe Invoice ID: ${selectedInvoice.stripe_invoice_id}` : ""}
        width="max-w-[580px]"
        variant="sheet"
      >
        {selectedInvoice && (
          <div className="space-y-5">
            <div className="flex items-start justify-between p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
              <div>
                <div className="text-[11.5px] text-[var(--muted-foreground)]">Billed To</div>
                <div className="mt-0.5 text-[15px] font-semibold">
                  {subjectNameMap.get(selectedInvoice.subject_key) || selectedInvoice.subject_key}
                </div>
                <div className="text-[12px] mbx-mono text-[var(--muted-foreground)]">
                  subject: {selectedInvoice.subject_key} · plan: {selectedInvoice.plan_slug}
                </div>
              </div>
              <div className="text-right">
                <Pill tone={selectedInvoice.status === "paid" ? "ok" : "info"} mono>
                  {selectedInvoice.status.toUpperCase()}
                </Pill>
                <div className="mt-2 text-[22px] font-semibold mbx-num">
                  {formatCurrency(selectedInvoice.total_cents, selectedInvoice.currency)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[12.5px] font-semibold mb-2">Itemized Line Items</div>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border)] text-[11px] text-[var(--muted-foreground)]">
                      <th className="px-3.5 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3.5 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.line_items.map((li, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium">{li.description}</div>
                          {li.meter_slug && (
                            <div className="text-[11px] mbx-mono text-[var(--muted-foreground)]">
                              meter: {li.meter_slug}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right mbx-num">{formatCompact(li.quantity)}</td>
                        <td className="px-3.5 py-2.5 text-right font-medium mbx-num">
                          {formatCurrency(li.amount_cents, selectedInvoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] space-y-1.5 text-[13px] mbx-num">
              <div className="flex justify-between text-[var(--muted-foreground)]">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedInvoice.subtotal_cents, selectedInvoice.currency)}</span>
              </div>
              <div className="flex justify-between text-[var(--primary)]">
                <span>Prepaid credits applied</span>
                <span>−{formatCurrency(selectedInvoice.credits_applied_cents, selectedInvoice.currency)}</span>
              </div>
              <div className="pt-2 border-t border-[var(--border)] flex justify-between font-semibold text-[15px]">
                <span>Total Due</span>
                <span>{formatCurrency(selectedInvoice.total_cents, selectedInvoice.currency)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              {selectedInvoice.status !== "paid" ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => handleMarkInvoicePaid(selectedInvoice)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Collect on saved card (`invoice.paid`)
                </Button>
              ) : (
                <span className="text-[12px] text-[var(--primary)] font-medium">
                  ✓ Paid via Stripe ({selectedInvoice.payment_intent_id || selectedInvoice.stripe_invoice_id})
                </span>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigator.clipboard?.writeText(JSON.stringify(selectedInvoice, null, 2))}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy JSON
                </Button>
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5" /> Print PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Drawer: Generate Invoice */}
      <Drawer
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="Generate period invoice"
        subtitle="Rate current ClickHouse usage against a customer's plan, deduct credit grants, and sync to Stripe."
      >
        <form onSubmit={handleGenerateInvoice} className="space-y-4">
          <Field label="Customer (subject)">
            <Select
              value={genSubject}
              onChange={(e) => setGenSubject(e.target.value)}
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Pricing plan"
            hint={snapshot.plans.length === 0 ? "Optional — rates raw metered usage when no plan is selected" : "Select a plan or bill pay-as-you-go"}
          >
            <Select
              value={genPlan || "pay_as_you_go"}
              onChange={(e) => setGenPlan(e.target.value)}
            >
              <option value="pay_as_you_go">Pay-as-you-go · Direct Metered Usage (no base plan)</option>
              {snapshot.plans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} ({p.slug})
                </option>
              ))}
            </Select>
            {snapshot.plans.length === 0 && (
              <div className="pt-1 flex items-center justify-between text-[11.5px] text-[var(--muted-foreground)]">
                <span>No custom subscription plans defined in this workspace yet.</span>
                <button
                  type="button"
                  onClick={() => {
                    setGenOpen(false);
                    navigate("plans");
                  }}
                  className="font-medium text-[var(--primary)] hover:underline cursor-pointer"
                >
                  + Create plan →
                </button>
              </div>
            )}
          </Field>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting || !genSubject}>
              {submitting ? "Rating & syncing…" : "Generate & sync to Stripe"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Vault Payment Method */}
      <Drawer
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        title="Vault customer payment method"
        subtitle="Store a tokenized card from a completed Stripe or Paystack SetupIntent."
        width="max-w-[500px]"
      >
        <form onSubmit={handleAttachCard} className="space-y-4">
          {/* Live Interactive Payment Card Preview (explicit inline surface so it never renders white-on-white) */}
          <div
            style={{
              background: "linear-gradient(135deg, #131D18 0%, #1E3229 55%, #2B473B 100%)",
              color: "#F6F7F5",
              borderColor: "rgba(255, 255, 255, 0.14)",
              boxShadow: "0 16px 36px -14px rgba(17, 24, 20, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
            }}
            className="relative overflow-hidden rounded-2xl p-5 border"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.14)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                  }}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10.5px] font-semibold tracking-wider uppercase mbx-mono"
                >
                  {cardProvider}
                </span>
                <span style={{ color: "rgba(246, 247, 245, 0.72)" }} className="text-[11.5px] inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#78B898" }} />
                  SetupIntent Verified
                </span>
              </div>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#FFFFFF",
                }}
                className="text-[11.5px] font-bold tracking-wider uppercase mbx-mono px-2.5 py-0.5 rounded-md"
              >
                {cardBrand === "amex" ? "AMEX" : cardBrand === "mastercard" ? "MASTERCARD" : "VISA"}
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Metallic EMV Chip */}
                <span
                  style={{
                    width: 34,
                    height: 24,
                    borderRadius: 5,
                    background: "linear-gradient(135deg, #E6C687 0%, #B8924A 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.35)",
                    boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.25)",
                  }}
                  className="inline-block shrink-0"
                />
                <div
                  style={{ color: "#FFFFFF", letterSpacing: "0.14em" }}
                  className="text-[17px] font-semibold mbx-mono"
                >
                  •••• •••• •••• {(cardLast4 || "••••").padEnd(4, "•")}
                </div>
              </div>
            </div>

            <div
              style={{ borderColor: "rgba(255, 255, 255, 0.14)" }}
              className="mt-4 pt-3 border-t flex items-center justify-between text-[11.5px]"
            >
              <div className="truncate max-w-[270px]">
                <span style={{ color: "rgba(246, 247, 245, 0.55)" }} className="uppercase text-[10px] mr-2 tracking-wider">
                  Customer
                </span>
                <span style={{ color: "#FFFFFF" }} className="font-medium">
                  {subjectNameMap.get(cardSubject) || cardSubject || "Select customer"}
                </span>
              </div>
              <div className="mbx-mono">
                <span style={{ color: "rgba(246, 247, 245, 0.55)" }} className="mr-1.5 text-[10px]">
                  EXP
                </span>
                <span style={{ color: "#FFFFFF" }} className="font-semibold">
                  {cardExpMonth ? String(cardExpMonth).padStart(2, "0") : "MM"}/
                  {cardExpYear ? String(cardExpYear).slice(-2) : "YY"}
                </span>
              </div>
            </div>
          </div>

          <Field label="Customer (subject)">
            <Select
              value={cardSubject}
              onChange={(e) => setCardSubject(e.target.value)}
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Payment provider">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-[10px] bg-[var(--surface-subtle)] border border-[var(--border)]">
                {(["stripe", "paystack", "paddle"] as const).map((prov) => {
                  const active = cardProvider === prov;
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setCardProvider(prov)}
                      className={`h-7 px-2 rounded-[7px] text-[12px] font-medium capitalize inline-flex items-center justify-center text-center transition-all cursor-pointer ${
                        active
                          ? "bg-[var(--card)] text-[var(--primary)] font-semibold shadow-xs border border-[var(--border)]"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-transparent"
                      }`}
                    >
                      {prov}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Card network">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-[10px] bg-[var(--surface-subtle)] border border-[var(--border)]">
                {[
                  { id: "visa", label: "Visa" },
                  { id: "mastercard", label: "Master" },
                  { id: "amex", label: "Amex" },
                ].map((b) => {
                  const active = cardBrand === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setCardBrand(b.id)}
                      className={`h-7 px-2 rounded-[7px] text-[12px] font-medium inline-flex items-center justify-center text-center transition-all cursor-pointer ${
                        active
                          ? "bg-[var(--card)] text-[var(--primary)] font-semibold shadow-xs border border-[var(--border)]"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-transparent"
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Last 4 digits" hint="e.g. 4242">
              <Input
                mono
                maxLength={4}
                placeholder="4242"
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </Field>
            <Field label="Exp month" hint="MM">
              <Input
                mono
                type="number"
                min={1}
                max={12}
                placeholder="12"
                value={cardExpMonth}
                onChange={(e) => setCardExpMonth(e.target.value)}
              />
            </Field>
            <Field label="Exp year" hint="YYYY">
              <Input
                mono
                type="number"
                min={2026}
                max={2040}
                placeholder="2029"
                value={cardExpYear}
                onChange={(e) => setCardExpYear(e.target.value)}
              />
            </Field>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={() => setCardOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Vaulting…" : "Vault default card"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Credit Top-Up Checkout Session */}
      <Drawer
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        title="Prepaid credit top-up session"
        subtitle="Create a Stripe Checkout session or charge the customer's saved card to mint a Priority-1 credit grant."
        width="max-w-[510px]"
      >
        <form onSubmit={handleCreateTopup} className="space-y-4">
          <Field label="Customer (subject)">
            <Select
              value={topupSubject}
              onChange={(e) => setTopupSubject(e.target.value)}
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </Select>
          </Field>

          {/* Quick-Select Package Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[var(--muted-foreground)]">Quick-select credit package</span>
              <span className="text-[11px] mbx-mono text-[var(--muted-foreground)]">$20 / 1M tokens</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "1M tokens", sub: "$20", units: "1000000", cents: "2000" },
                { label: "2.5M tokens", sub: "$50", units: "2500000", cents: "5000" },
                { label: "5M tokens", sub: "$100", units: "5000000", cents: "10000" },
                { label: "10M tokens", sub: "$200", units: "10000000", cents: "20000" },
              ].map((preset) => {
                const active = topupUnits === preset.units && topupCents === preset.cents;
                return (
                  <button
                    key={preset.units}
                    type="button"
                    onClick={() => {
                      setTopupUnits(preset.units);
                      setTopupCents(preset.cents);
                    }}
                    className={`px-2.5 py-2 rounded-[10px] border text-left transition-all ${
                      active
                        ? "bg-[var(--card)] border-[var(--primary)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_15%,transparent)]"
                        : "bg-[var(--surface-subtle)]/50 border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className={`text-[12px] font-semibold mbx-num ${active ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                      {preset.sub}
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)] mbx-num">{preset.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Grant units">
              <Input
                mono
                type="number"
                placeholder="2500000"
                suffix="tokens"
                value={topupUnits}
                onChange={(e) => setTopupUnits(e.target.value)}
              />
            </Field>
            <Field label="Charge amount (cents)">
              <Input
                mono
                type="number"
                placeholder="5000"
                suffix={`$${((Number(topupCents) || 0) / 100).toFixed(2)}`}
                value={topupCents}
                onChange={(e) => setTopupCents(e.target.value)}
              />
            </Field>
          </div>

          {/* Settlement Mode Selector Cards */}
          <div className="space-y-1.5">
            <span className="text-[12.5px] font-semibold text-[var(--foreground)]">Settlement method</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTopupInstant(true)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  topupInstant
                    ? "bg-[var(--card)] border-[var(--primary)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_14%,transparent)]"
                    : "bg-[var(--surface-subtle)]/40 border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[var(--foreground)]">Instant card charge</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      topupInstant ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)]"
                    }`}
                  >
                    {topupInstant && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--muted-foreground)] leading-snug">
                  Charge saved default card off-session &amp; mint Priority-1 grant now.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTopupInstant(false)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  !topupInstant
                    ? "bg-[var(--card)] border-[var(--primary)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_14%,transparent)]"
                    : "bg-[var(--surface-subtle)]/40 border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[var(--foreground)]">Hosted Checkout URL</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      !topupInstant ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)]"
                    }`}
                  >
                    {!topupInstant && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--muted-foreground)] leading-snug">
                  Create a Stripe Checkout link; credits mint upon webhook callback.
                </p>
              </button>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={() => setTopupOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Processing…" : topupInstant ? "Charge & mint credits" : "Create Checkout URL"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Configure Auto-Recharge Rule */}
      <Drawer
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        title="Configure auto-recharge threshold"
        subtitle="Automatically charge the customer's vaulted card and mint a Priority-1 credit grant when balance drops below threshold."
      >
        <form onSubmit={handleSaveRule} className="space-y-4">
          <Field label="Customer (subject)">
            <Select
              value={ruleSubject}
              onChange={(e) => setRuleSubject(e.target.value)}
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entitlement feature key">
            <Input
              mono
              placeholder="e.g. ai_token_allowance"
              value={ruleFeature}
              onChange={(e) => setRuleFeature(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Threshold">
              <Input
                mono
                type="number"
                placeholder="500000"
                suffix="units"
                value={ruleThreshold}
                onChange={(e) => setRuleThreshold(e.target.value)}
              />
            </Field>
            <Field label="Recharge grant">
              <Input
                mono
                type="number"
                placeholder="2500000"
                suffix="units"
                value={ruleRecharge}
                onChange={(e) => setRuleRecharge(e.target.value)}
              />
            </Field>
            <Field label="Charge (cents)">
              <Input
                mono
                type="number"
                placeholder="5000"
                suffix={`$${((Number(ruleCents) || 0) / 100).toFixed(0)}`}
                value={ruleCents}
                onChange={(e) => setRuleCents(e.target.value)}
              />
            </Field>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={() => setRuleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving…" : "Save auto-recharge rule"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Simulate Provider Webhook */}
      <Drawer
        open={webhookOpen}
        onClose={() => setWebhookOpen(false)}
        title="Simulate payment provider webhook"
        subtitle="Dispatch a signed Stripe / Paystack webhook event to test ledger orchestration."
      >
        <form onSubmit={handleSimulateWebhook} className="space-y-4">
          <Field label="Webhook event type">
            <Select
              mono
              value={whType}
              onChange={(e) => setWhType(e.target.value)}
            >
              <option value="payment_intent.succeeded">payment_intent.succeeded (Mint credit grant)</option>
              <option value="invoice.paid">invoice.paid (Mark invoice paid)</option>
              <option value="invoice.payment_failed">invoice.payment_failed (Flag invoice failed)</option>
              <option value="setup_intent.succeeded">setup_intent.succeeded (Verify vaulted card)</option>
            </Select>
          </Field>
          <Field label="Customer (subject)">
            <Select
              value={whSubject}
              onChange={(e) => setWhSubject(e.target.value)}
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Provider object ID" hint="Optional — e.g. in_stripe_... or pi_...">
            <Input
              mono
              placeholder="Auto-generated or matches open invoice"
              value={whObjectId}
              onChange={(e) => setWhObjectId(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (cents)">
              <Input
                mono
                type="number"
                placeholder="5000"
                suffix={`$${((Number(whCents) || 0) / 100).toFixed(2)}`}
                value={whCents}
                onChange={(e) => setWhCents(e.target.value)}
              />
            </Field>
            <Field label="Grant units">
              <Input
                mono
                type="number"
                placeholder="2500000"
                suffix="tokens"
                value={whUnits}
                onChange={(e) => setWhUnits(e.target.value)}
              />
            </Field>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={() => setWebhookOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Dispatching…" : "Send webhook event"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
