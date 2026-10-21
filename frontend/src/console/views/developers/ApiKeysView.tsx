"use client";

import React, { useEffect, useState } from "react";
import { Copy, Eye, KeyRound, Lock, Plus, ShieldCheck } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { API_BASE, apiGet, apiPost } from "../../lib/api";
import { formatCompact, formatCurrency, relativeTime } from "../../lib/format";
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
  Skeleton,
  Tone,
  usePagination,
} from "../../ui/primitives";
import type { APIKey, PortalSummary } from "../../../types/meterbox";

export const ApiKeysView: React.FC = () => {
  const { org, env, namespace, snapshot, status, refresh } = useConsole();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyScope, setKeyScope] = useState<APIKey["scope"]>("ingest");
  const [keySubject, setKeySubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; title: string; detail?: string } | null>(null);

  // Customer portal preview
  const [portalSubject, setPortalSubject] = useState("");
  const [portalData, setPortalData] = useState<PortalSummary | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!portalSubject && snapshot.subjects.length > 0) {
      const withEnt = snapshot.subjects.find((s) =>
        snapshot.entitlements.some((e) => e.subject_key === s.key),
      );
      const chosen = (withEnt || snapshot.subjects[0]).key;
      setPortalSubject(chosen);
      setKeySubject(chosen);
    }
  }, [snapshot.subjects, snapshot.entitlements, portalSubject]);

  useEffect(() => {
    if (!portalSubject || !namespace) return;
    setPortalLoading(true);
    apiGet<Record<string, unknown>>(`/api/portal/v1/summary?subject_key=${encodeURIComponent(portalSubject)}&subject=${encodeURIComponent(portalSubject)}`, namespace)
      .then((raw) => {
        const rawEnts = Array.isArray(raw.entitlements) ? (raw.entitlements as Record<string, unknown>[]) : [];
        setPortalData({
          namespace: String(raw.namespace || namespace),
          subject: String(raw.subject || raw.subject_key || portalSubject),
          meters: Array.isArray(raw.meters) ? raw.meters : [],
          entitlements: rawEnts.map((e) => ({
            has_access: Boolean(e.has_access ?? true),
            subject_key: String(e.subject_key || portalSubject),
            feature_key: String(e.feature_key || ""),
            limit: Number(e.limit ?? e.total_granted ?? 0),
            usage: Number(e.usage ?? e.usage_in_period ?? 0),
            credit_balance: Number(e.credit_balance ?? 0),
            remaining: Number(e.remaining ?? e.balance ?? 0),
            soft_limit: Boolean(e.soft_limit ?? e.is_soft_limit ?? false),
            cache_source: String(e.cache_source || "HIT"),
            latency_us: Number(e.latency_us ?? 190),
            evaluated_at: String(e.evaluated_at || new Date().toISOString()),
          })),
          invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
        });
      })
      .catch(() => setPortalData(null))
      .finally(() => setPortalLoading(false));
  }, [portalSubject, namespace, snapshot.invoices.length, snapshot.entitlements.length]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setSubmitting(true);
    try {
      const data = await apiPost<Record<string, unknown>>(
        "/api/control/v1/api-keys",
        {
          name: keyName.trim(),
          scope: keyScope,
          subject_filter: keyScope === "portal" ? keySubject : "",
        },
        namespace,
      );
      const rawKey = String(data.raw_key || data.secret || "");
      if (rawKey) setCreatedSecret(rawKey);
      setKeyName("");
      setDrawerOpen(false);
      await refresh();
      setNotice({
        tone: "ok",
        title: `Scoped API key "${keyName.trim()}" generated`,
        detail: "Copy the plaintext secret below—only its SHA-256 digest is stored.",
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Failed to generate API key",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const scopeTone = (scope: string): Tone => {
    if (scope === "admin") return "warn";
    if (scope === "ingest") return "ok";
    if (scope === "portal") return "info";
    return "neutral";
  };

  const keysPagination = usePagination(snapshot.apiKeys, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        orgName={org?.name}
        envType={env?.type}
        envName={env?.name}
        title="API Keys & Customer Portal"
        subtitle="Four-tier SHA-256 scoped API credentials and embeddable customer-locked usage portal preview."
        actions={
          <Button variant="primary" onClick={() => setDrawerOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Issue API key
          </Button>
        }
      />

      {notice && <Notice tone={notice.tone} title={notice.title} detail={notice.detail} onDismiss={() => setNotice(null)} />}

      {/* One-time secret reveal banner */}
      {createdSecret && (
        <Card className="p-4 border-[var(--primary)] bg-[var(--accent)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-[var(--primary)]" />
                One-time API Key Secret (Copy now — never shown again)
              </div>
              <div className="mt-1 mbx-mono text-[13px] px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] select-all">
                {createdSecret}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  navigator.clipboard?.writeText(createdSecret);
                  setCopiedSecret(true);
                  setTimeout(() => setCopiedSecret(false), 1500);
                }}
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedSecret ? "Copied!" : "Copy secret"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreatedSecret(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Grid: Scoped Keys Table + Customer Portal Embed Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Scoped API Keys */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader
            title="Scoped SHA-256 API Keys"
            subtitle={`Bound to OpenMeter namespace ${namespace}`}
          />
          <div className="overflow-x-auto mbx-scroll">
            {status === "loading" ? (
              <div className="p-5 space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : snapshot.apiKeys.length === 0 ? (
              <EmptyState
                icon={<KeyRound className="w-5 h-5" />}
                title="No API keys issued"
                description="Generate a scoped API key to authenticate SDK ingestion or customer portal embeds."
              />
            ) : (
              <table className="min-w-[580px] w-full text-[12.5px]">
                <thead>
                  <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                    <th className="px-5 py-2.5 text-left">Key Name</th>
                    <th className="px-3 py-2.5 text-left">Prefix</th>
                    <th className="px-3 py-2.5 text-left">Scope</th>
                    <th className="px-3 py-2.5 text-left">Subject Lock</th>
                    <th className="px-5 py-2.5 text-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {keysPagination.pageItems.map((k) => (
                    <tr key={k.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-5 py-2.5 font-medium">{k.name}</td>
                      <td className="px-3 py-2.5 mbx-mono text-[12px] text-[var(--muted-foreground)]">{k.prefix}</td>
                      <td className="px-3 py-2.5">
                        <Pill tone={scopeTone(k.scope)} mono>
                          {k.scope}
                        </Pill>
                      </td>
                      <td className="px-3 py-2.5 mbx-mono text-[11.5px] text-[var(--muted-foreground)]">
                        {k.subject_id || "All subjects"}
                      </td>
                      <td className="px-5 py-2.5 text-right text-[var(--muted-foreground)] mbx-num">
                        {k.created_at ? relativeTime(k.created_at) : "active"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {snapshot.apiKeys.length > 0 && (
            <Pagination
              state={keysPagination}
              pageSizeOptions={[5, 8, 15]}
              itemLabel="keys"
            />
          )}

          {/* Quick SDK cURL snippet */}
          <div className="p-5 mt-auto border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-[var(--muted-foreground)]">
                Quickstart: Ingest CloudEvent with Scoped Key
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
            </div>
            <pre className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] mbx-mono text-[11.5px] overflow-x-auto leading-relaxed">
{`curl -X POST ${API_BASE}/api/v1/events \\
  -H "Authorization: Bearer ${snapshot.apiKeys[0]?.prefix || "mb_ing_live_..."}" \\
  -H "Content-Type: application/json" \\
  -d '{"specversion":"1.0","id":"evt_01","type":"ai.llm.tokens","subject":"${snapshot.subjects[0]?.key || "cust_cyclode"}","data":{"tokens":1500,"model":"claude-3-7-sonnet"}}'`}
            </pre>
          </div>
        </Card>

        {/* Right: Embeddable Customer Portal Preview */}
        <Card className="lg:col-span-5 flex flex-col">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--primary)]" />
                Customer Portal Preview (`mb_portal_*`)
              </span>
            }
            subtitle="Read-only tenant-locked payload returned by GET /api/portal/v1/summary"
            actions={
              <select
                value={portalSubject}
                onChange={(e) => setPortalSubject(e.target.value)}
                className="h-7 px-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px]"
              >
                {snapshot.subjects.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            }
          />
          <div className="px-5 pb-5 space-y-4">
            {portalLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : !portalData ? (
              <EmptyState title="No portal preview available" description="Select a customer above." />
            ) : (
              <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                      Embedded Usage Widget
                    </div>
                    <div className="text-[14px] font-semibold mt-0.5">{portalData.subject}</div>
                  </div>
                  <Pill tone="info" mono>
                    PORTAL_READ_ONLY
                  </Pill>
                </div>

                <div className="space-y-3">
                  <div className="text-[12px] font-semibold">Allowances ({portalData.entitlements?.length || 0})</div>
                  {(portalData.entitlements || []).map((ent, i) => {
                    const limit = ent.limit || 1;
                    const usage = ent.usage || 0;
                    const ratio = usage / limit;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-[12px] mbx-num">
                          <span className="font-medium">{ent.feature_key}</span>
                          <span>
                            {formatCompact(usage)} / {formatCompact(limit)}
                          </span>
                        </div>
                        <ProgressBar value={ratio} tone={ratio >= 0.9 ? "warn" : "ok"} />
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-2">
                  <div className="text-[12px] font-semibold">Recent Invoices ({portalData.invoices?.length || 0})</div>
                  {(portalData.invoices || []).slice(0, 3).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-[12px] mbx-num">
                      <span className="mbx-mono">{inv.id}</span>
                      <span className="font-semibold">{formatCurrency(inv.total_cents, inv.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Drawer: Issue API Key */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Issue scoped API key"
        subtitle="Generate a least-privilege SHA-256 credential bound to this environment."
      >
        <form onSubmit={handleCreateKey} className="space-y-4">
          <Field label="Key name / description">
            <Input
              required
              placeholder="e.g. Cyclode Production Ingest Gateway"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </Field>
          <Field label="Permission scope">
            <select
              value={keyScope}
              onChange={(e) => setKeyScope(e.target.value as APIKey["scope"])}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
            >
              <option value="ingest">ingest (mb_ing_*) — Write-only CloudEvents & PostHog</option>
              <option value="entitlement">entitlement (mb_ent_*) — Sub-5ms edge quota checks</option>
              <option value="portal">portal (mb_portal_*) — Customer-locked read-only portal</option>
              <option value="admin">admin (mb_sk_*) — Full control-plane administration</option>
            </select>
          </Field>
          {keyScope === "portal" && (
            <Field label="Locked customer subject" hint="Portal token can only read this customer">
              <select
                value={keySubject}
                onChange={(e) => setKeySubject(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
              >
                {snapshot.subjects.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.display_name} ({s.key})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Generating…" : "Generate key"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
