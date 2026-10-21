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
import { formatCompact, formatCurrency, relativeTime } from "../../lib/format";
import {
  Button,
  Card,
  CardHeader,
  Drawer,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Pagination,
  Pill,
  Skeleton,
  usePagination,
} from "../../ui/primitives";
import type { Invoice } from "../../../types/meterbox";

type RevenueTab = "invoices" | "cards" | "recharge" | "webhooks";

export const InvoicesView: React.FC = () => {
  const { org, env, namespace, snapshot, status, refresh } = useConsole();
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
  const [genPlan, setGenPlan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [cardSubject, setCardSubject] = useState("");
  const [cardProvider, setCardProvider] = useState("stripe");
  const [cardBrand, setCardBrand] = useState("visa");
  const [cardLast4, setCardLast4] = useState("4242");
  const [cardExpMonth, setCardExpMonth] = useState("12");
  const [cardExpYear, setCardExpYear] = useState("2029");

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
    if (!genPlan && snapshot.plans.length > 0) {
      setGenPlan(snapshot.plans[0].slug);
    }
  }, [snapshot.subjects, snapshot.plans, genSubject, cardSubject, topupSubject, ruleSubject, whSubject, genPlan]);

  const subjectNameMap = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.key, s.display_name])),
    [snapshot.subjects],
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
    if (!genSubject || !genPlan) return;
    setSubmitting(true);
    try {
      const raw = await apiPost<Record<string, unknown>>(
        "/api/v1/invoices/generate",
        {
          subject_key: genSubject,
          plan_slug: genPlan,
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
    setSubmitting(true);
    try {
      const raw = await apiPost<Record<string, unknown>>(
        "/api/v1/payment-methods",
        {
          subject_key: cardSubject,
          provider: cardProvider,
          brand: cardBrand,
          last4: cardLast4,
          exp_month: Number(cardExpMonth) || 12,
          exp_year: Number(cardExpYear) || 2029,
          is_default: true,
        },
        namespace,
      );
      setCardOpen(false);
      await refresh();
      setNotice({
        tone: "ok",
        title: `Vaulted ${cardBrand.toUpperCase()} •••• ${cardLast4} (${String(raw.id || "pm_mbx")})`,
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
            <span>Vaulted payment methods</span>
            <CreditCard className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{snapshot.paymentMethods.length}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            PCI-free provider tokens (`pm_...`) ready for off-session billing
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

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
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
                className={`inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[12.5px] font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-[var(--primary)] text-[#F6F7F5]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] mbx-num ${
                    active ? "bg-white/20 text-white" : "bg-[var(--surface-subtle)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <Button variant="secondary" size="sm" onClick={() => setWebhookOpen(true)}>
          <Webhook className="w-3.5 h-3.5" />
          Test webhook delivery
        </Button>
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
              <table className="min-w-[820px] w-full text-[12.5px]">
                <thead>
                  <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                    <th className="px-5 py-2.5 text-left">Invoice ID</th>
                    <th className="px-3 py-2.5 text-left">Customer</th>
                    <th className="px-3 py-2.5 text-left">Plan</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                    <th className="px-3 py-2.5 text-right">Credits</th>
                    <th className="px-3 py-2.5 text-right">Net Total</th>
                    <th className="px-3 py-2.5 text-left">Payment Status</th>
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
                      <td className="px-5 py-2.5 font-semibold mbx-mono">{inv.id}</td>
                      <td className="px-3 py-2.5 font-medium">
                        {subjectNameMap.get(inv.subject_key) || inv.subject_key}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill mono>{inv.plan_slug}</Pill>
                      </td>
                      <td className="px-3 py-2.5 text-right mbx-num text-[var(--muted-foreground)]">
                        {formatCurrency(inv.subtotal_cents, inv.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-right mbx-num text-[var(--primary)]">
                        −{formatCurrency(inv.credits_applied_cents, inv.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold mbx-num">
                        {formatCurrency(inv.total_cents, inv.currency)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill
                          tone={inv.status === "paid" ? "ok" : inv.status === "payment_failed" ? "err" : "info"}
                          mono
                        >
                          {inv.status === "paid"
                            ? `PAID · ${inv.stripe_invoice_id || inv.id}`
                            : inv.stripe_invoice_id || inv.status}
                        </Pill>
                      </td>
                      <td className="px-5 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
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
                          <span className="text-[11.5px] text-[var(--muted-foreground)] mbx-num">
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
            <select
              value={genSubject}
              onChange={(e) => setGenSubject(e.target.value)}
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
              value={genPlan}
              onChange={(e) => setGenPlan(e.target.value)}
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
            <Button variant="ghost" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
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
        subtitle="Store a non-PCI provider token (`pm_...`) from a completed Stripe or Paystack SetupIntent."
      >
        <form onSubmit={handleAttachCard} className="space-y-4">
          <Field label="Customer (subject)">
            <select
              value={cardSubject}
              onChange={(e) => setCardSubject(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment provider">
              <select
                value={cardProvider}
                onChange={(e) => setCardProvider(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
              >
                <option value="stripe">Stripe</option>
                <option value="paystack">Paystack</option>
                <option value="paddle">Paddle</option>
              </select>
            </Field>
            <Field label="Card brand">
              <select
                value={cardBrand}
                onChange={(e) => setCardBrand(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
              >
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="amex">American Express</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Last 4 digits">
              <input
                type="text"
                maxLength={4}
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
            <Field label="Exp month">
              <input
                type="number"
                min={1}
                max={12}
                value={cardExpMonth}
                onChange={(e) => setCardExpMonth(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
            <Field label="Exp year">
              <input
                type="number"
                min={2026}
                max={2040}
                value={cardExpYear}
                onChange={(e) => setCardExpYear(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setCardOpen(false)}>
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
      >
        <form onSubmit={handleCreateTopup} className="space-y-4">
          <Field label="Customer (subject)">
            <select
              value={topupSubject}
              onChange={(e) => setTopupSubject(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grant units (tokens)">
              <input
                type="number"
                value={topupUnits}
                onChange={(e) => setTopupUnits(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
            <Field label="Charge amount (cents)">
              <input
                type="number"
                value={topupCents}
                onChange={(e) => setTopupCents(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
            <input
              type="checkbox"
              checked={topupInstant}
              onChange={(e) => setTopupInstant(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            <span>Charge saved default card immediately &amp; mint Priority-1 grant (`payment_intent.succeeded`)</span>
          </label>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setTopupOpen(false)}>
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
            <select
              value={ruleSubject}
              onChange={(e) => setRuleSubject(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Entitlement feature key">
            <input
              type="text"
              value={ruleFeature}
              onChange={(e) => setRuleFeature(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Threshold units">
              <input
                type="number"
                value={ruleThreshold}
                onChange={(e) => setRuleThreshold(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
            <Field label="Recharge units">
              <input
                type="number"
                value={ruleRecharge}
                onChange={(e) => setRuleRecharge(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
            <Field label="Charge (cents)">
              <input
                type="number"
                value={ruleCents}
                onChange={(e) => setRuleCents(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setRuleOpen(false)}>
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
        subtitle="Dispatch a signed Stripe / Paystack webhook event to `/api/v1/webhooks/stripe` to test ledger orchestration."
      >
        <form onSubmit={handleSimulateWebhook} className="space-y-4">
          <Field label="Webhook event type">
            <select
              value={whType}
              onChange={(e) => setWhType(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
            >
              <option value="payment_intent.succeeded">payment_intent.succeeded (Mint credit grant)</option>
              <option value="invoice.paid">invoice.paid (Mark invoice paid)</option>
              <option value="invoice.payment_failed">invoice.payment_failed (Flag invoice failed)</option>
              <option value="setup_intent.succeeded">setup_intent.succeeded (Verify vaulted card)</option>
            </select>
          </Field>
          <Field label="Customer (subject)">
            <select
              value={whSubject}
              onChange={(e) => setWhSubject(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
            >
              {snapshot.subjects.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.display_name} ({s.key})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Provider object ID (optional — e.g. in_stripe_... or pi_...)">
            <input
              type="text"
              placeholder="Auto-generated or matches open invoice"
              value={whObjectId}
              onChange={(e) => setWhObjectId(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (cents)">
              <input
                type="number"
                value={whCents}
                onChange={(e) => setWhCents(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
            <Field label="Grant units (for payment_intent.succeeded)">
              <input
                type="number"
                value={whUnits}
                onChange={(e) => setWhUnits(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px] mbx-mono"
              />
            </Field>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setWebhookOpen(false)}>
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
