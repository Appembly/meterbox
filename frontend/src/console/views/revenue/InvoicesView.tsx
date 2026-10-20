"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Copy, FileText, Plus, Printer, Receipt } from "lucide-react";
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

export const InvoicesView: React.FC = () => {
  const { org, env, namespace, snapshot, status, refresh } = useConsole();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genSubject, setGenSubject] = useState("");
  const [genPlan, setGenPlan] = useState("");
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; title: string; detail?: string } | null>(null);

  useEffect(() => {
    if (!genSubject && snapshot.subjects.length > 0) setGenSubject(snapshot.subjects[0].key);
    if (!genPlan && snapshot.plans.length > 0) setGenPlan(snapshot.plans[0].slug);
  }, [snapshot.subjects, snapshot.plans, genSubject, genPlan]);

  const subjectNameMap = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.key, s.display_name])),
    [snapshot.subjects],
  );
  const invPagination = usePagination(snapshot.invoices, 10);

  const totals = useMemo(() => {
    const subtotal = snapshot.invoices.reduce((a, i) => a + i.subtotal_cents, 0);
    const credits = snapshot.invoices.reduce((a, i) => a + i.credits_applied_cents, 0);
    const net = snapshot.invoices.reduce((a, i) => a + i.total_cents, 0);
    return { subtotal, credits, net };
  }, [snapshot.invoices]);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genSubject || !genPlan) return;
    setGenerating(true);
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
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        orgName={org?.name}
        envType={env?.type}
        envName={env?.name}
        title="Invoices & Stripe Sync"
        subtitle="Usage-rated period invoices with automated credit grant deductions and Stripe Billing synchronization."
        actions={
          <Button variant="primary" onClick={() => setGenOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Generate invoice
          </Button>
        }
      />

      {notice && <Notice tone={notice.tone} title={notice.title} detail={notice.detail} onDismiss={() => setNotice(null)} />}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Gross rated subtotal</span>
            <Receipt className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{formatCurrency(totals.subtotal)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Across {snapshot.invoices.length} issued invoice{snapshot.invoices.length === 1 ? "" : "s"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Prepaid credits applied</span>
            <FileText className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">−{formatCurrency(totals.credits)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Automatically deducted from priority credit grants
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Net invoiced revenue</span>
            <CircleDollarSign className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{formatCurrency(totals.net)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Synced to Stripe Invoicing (`in_stripe_*`)
          </div>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader
          title="Issued invoices ledger"
          subtitle="Click any invoice to open the itemized billing sheet and Stripe payload"
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
            <table className="min-w-[760px] w-full text-[12.5px]">
              <thead>
                <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                  <th className="px-5 py-2.5 text-left">Invoice ID</th>
                  <th className="px-3 py-2.5 text-left">Customer</th>
                  <th className="px-3 py-2.5 text-left">Plan</th>
                  <th className="px-3 py-2.5 text-right">Subtotal</th>
                  <th className="px-3 py-2.5 text-right">Credits</th>
                  <th className="px-3 py-2.5 text-right">Net Total</th>
                  <th className="px-3 py-2.5 text-left">Stripe Sync</th>
                  <th className="px-5 py-2.5 text-right">Issued</th>
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
                      <Pill tone="ok" mono>
                        {inv.stripe_invoice_id || inv.status}
                      </Pill>
                    </td>
                    <td className="px-5 py-2.5 text-right text-[var(--muted-foreground)] mbx-num">
                      {inv.issued_at ? relativeTime(inv.issued_at) : "just now"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {snapshot.invoices.length > 0 && (
          <Pagination
            state={invPagination}
            pageSizeOptions={[5, 10, 20]}
            itemLabel="invoices"
          />
        )}
      </Card>

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
                <Pill tone="ok" mono>
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

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(JSON.stringify(selectedInvoice, null, 2))}
              >
                <Copy className="w-3.5 h-3.5" /> Copy JSON
              </Button>
              <Button variant="primary" size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" /> Print / Save PDF
              </Button>
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
            <Button type="submit" variant="primary" disabled={generating}>
              {generating ? "Rating & syncing…" : "Generate & sync to Stripe"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
