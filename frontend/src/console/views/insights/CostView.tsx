"use client";

import React, { useState } from "react";
import { CircleDollarSign, Cpu, Sparkles, TrendingUp, Users } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { formatCompact, formatNumber } from "../../lib/format";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  Pill,
  ProgressBar,
  Segmented,
  Skeleton,
  Tone,
  usePagination,
} from "../../ui/primitives";

type DimTab = "model" | "tool" | "persona";

export const CostView: React.FC = () => {
  const { org, env, snapshot, status } = useConsole();
  const [dimTab, setDimTab] = useState<DimTab>("model");
  const report = snapshot.costIntel;

  const usd = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const dimRows =
    dimTab === "model"
      ? report?.by_model || []
      : dimTab === "tool"
      ? report?.by_tool || []
      : report?.by_persona || [];

  const subjectCostPagination = usePagination(report?.by_subject || [], 8);
  const dimPagination = usePagination(dimRows, 8);

  const totalTokens = Math.max(1, report?.total_tokens || 1);
  const tokenParts = [
    { label: "Input tokens", value: report?.input_tokens || 0, color: "var(--primary)" },
    { label: "Prompt cached", value: report?.cached_tokens || 0, color: "var(--info)" },
    { label: "Reasoning (CoT)", value: report?.reasoning_tokens || 0, color: "var(--warn)" },
    { label: "Completion output", value: report?.output_tokens || 0, color: "#7C6AE6" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        orgName={org?.name}
        envType={env?.type}
        envName={env?.name}
        title="AI Cost & Margin Intelligence"
        subtitle="Real-time unit economics comparing billed subscription revenue against upstream LLM token COGS by model, tool, and customer."
      />

      {/* Top FinOps KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Billed AI revenue</span>
            <CircleDollarSign className="w-4 h-4 text-[var(--primary)]" />
          </div>
          {status === "loading" ? (
            <Skeleton className="mt-3 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 text-[26px] font-semibold mbx-num">{usd(report?.total_billed_usd || 0)}</div>
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Across {report?.by_subject?.length || 0} active customers
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Upstream LLM & Graviton COGS</span>
            <Cpu className="w-4 h-4 text-[var(--warn)]" />
          </div>
          {status === "loading" ? (
            <Skeleton className="mt-3 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 text-[26px] font-semibold mbx-num">{usd(report?.total_cost_usd || 0)}</div>
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                {formatCompact(report?.total_tokens || 0)} tok
                {report?.sandbox_seconds ? ` · ${formatCompact(report.sandbox_seconds)}s Graviton sbx` : ""}
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Net AI gross margin</span>
            <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
          </div>
          {status === "loading" ? (
            <Skeleton className="mt-3 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 text-[26px] font-semibold mbx-num">
                {(report?.gross_margin_pct ?? 0).toFixed(1)}%
              </div>
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Net profit: {usd((report?.total_billed_usd || 0) - (report?.total_cost_usd || 0))}
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Prompt cache savings</span>
            <Sparkles className="w-4 h-4 text-[var(--info)]" />
          </div>
          {status === "loading" ? (
            <Skeleton className="mt-3 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 text-[26px] font-semibold mbx-num">{usd(report?.cache_savings_usd || 0)}</div>
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                {formatCompact(report?.cached_tokens || 0)} cached prompt tokens
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Token Composition Strip */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-[14px] font-semibold">Token Spectrum Breakdown</h2>
            <p className="text-[12.5px] text-[var(--muted-foreground)]">
              Distribution of input, cached, chain-of-thought reasoning, and output completion tokens
            </p>
          </div>
          <span className="text-[13px] font-semibold mbx-num">
            {formatNumber(report?.total_tokens || 0)} total tokens
          </span>
        </div>

        <div className="flex h-3 rounded-full overflow-hidden bg-[var(--surface-subtle)]">
          {tokenParts.map((p) => (
            <div
              key={p.label}
              className="h-full transition-all"
              style={{ width: `${(p.value / totalTokens) * 100}%`, background: p.color }}
              title={`${p.label}: ${formatNumber(p.value)}`}
            />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px]">
          {tokenParts.map((p) => (
            <div key={p.label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
              <div className="min-w-0">
                <div className="text-[var(--muted-foreground)] truncate">{p.label}</div>
                <div className="font-semibold mbx-num">
                  {formatCompact(p.value)}{" "}
                  <span className="text-[11px] font-normal text-[var(--muted-foreground)]">
                    ({((p.value / totalTokens) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Customer Margin Leaderboard + Dimensional Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Customer Margin Leaderboard */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader
            title="Customer Unit Economics & Margin Leaderboard"
            subtitle="Identifies high-margin accounts vs. heavy-compute customers approaching negative margin"
          />
          <div className="overflow-x-auto mbx-scroll">
            {!report || report.by_subject.length === 0 ? (
              <EmptyState
                icon={<Users className="w-5 h-5" />}
                title="No customer cost data yet"
                description="Ingest LLM token events to compute per-customer COGS and margin."
              />
            ) : (
              <table className="min-w-[600px] w-full text-[12.5px]">
                <thead>
                  <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                    <th className="px-5 py-2.5 text-left">Customer</th>
                    <th className="px-3 py-2.5 text-right">Usage</th>
                    <th className="px-3 py-2.5 text-right">Total COGS</th>
                    <th className="px-3 py-2.5 text-right">Billed Rev</th>
                    <th className="px-3 py-2.5 text-right">Margin</th>
                    <th className="px-5 py-2.5 text-right">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectCostPagination.pageItems.map((c) => {
                    const tone: Tone = c.margin_pct < 20 ? "err" : c.margin_pct < 55 ? "warn" : "ok";
                    return (
                      <tr key={c.subject_key} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-5 py-2.5">
                          <div className="font-medium">{c.display_name}</div>
                          <div className="text-[11px] mbx-mono text-[var(--muted-foreground)]">{c.subject_key}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right mbx-num">
                          <div>{formatCompact(c.tokens)} tok</div>
                          {c.sandbox_seconds ? (
                            <div className="text-[11px] text-[var(--muted-foreground)]">
                              {formatCompact(c.sandbox_seconds)}s sbx
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right mbx-num text-[var(--muted-foreground)]">
                          {usd(c.cost_usd)}
                        </td>
                        <td className="px-3 py-2.5 text-right mbx-num font-medium">{usd(c.revenue_usd)}</td>
                        <td className="px-3 py-2.5 text-right mbx-num font-semibold">
                          {c.margin_pct.toFixed(1)}%
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <Pill tone={tone} mono>
                            {c.status || (c.margin_pct >= 55 ? "healthy" : c.margin_pct >= 20 ? "watch" : "at_risk")}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {report && report.by_subject.length > 0 && (
            <Pagination
              state={subjectCostPagination}
              pageSizeOptions={[5, 8, 15]}
              itemLabel="customers"
            />
          )}
        </Card>

        {/* Right: Dimensional Spend Attribution */}
        <Card className="lg:col-span-5 flex flex-col">
          <CardHeader
            title="Spend Attribution"
            subtitle="Cost and token distribution by dimension"
            actions={
              <Segmented<DimTab>
                ariaLabel="Dimension tab"
                value={dimTab}
                onChange={setDimTab}
                options={[
                  { value: "model", label: "Model" },
                  { value: "tool", label: "Tool" },
                  { value: "persona", label: "Persona" },
                ]}
              />
            }
          />
          <div className="px-5 pb-5 space-y-3.5">
            {dimRows.length === 0 ? (
              <EmptyState title="No dimensional data" description="No events recorded for this dimension." />
            ) : (
              dimPagination.pageItems.map((d) => (
                <div key={d.dimension} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium mbx-mono truncate">{d.dimension}</span>
                    <span className="mbx-num">
                      <strong>{usd(d.cost_usd)}</strong>{" "}
                      <span className="text-[var(--muted-foreground)]">
                        · {d.tokens > 0 ? `${formatCompact(d.tokens)} tok ` : "compute "}({d.share_pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <ProgressBar value={d.share_pct / 100} tone="ok" />
                </div>
              ))
            )}
          </div>
          {dimRows.length > 0 && (
            <Pagination
              state={dimPagination}
              pageSizeOptions={[5, 8, 15]}
              itemLabel="dimensions"
              compact
            />
          )}
        </Card>
      </div>
    </div>
  );
};
