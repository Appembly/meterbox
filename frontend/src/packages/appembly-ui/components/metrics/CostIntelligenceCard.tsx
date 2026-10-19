import React from 'react';
import {
  Activity,
  CheckCircle2,
  Coins,
  Gauge,
  Layers,
  Wrench,
} from 'lucide-react';
import type { CostTelemetryBreakdown } from '../../types';

export interface CostIntelligenceCardProps {
  title?: string;
  subtitle?: string;
  telemetry: CostTelemetryBreakdown;
  checkpointInfo?: {
    step_index?: number;
    last_event?: string;
    last_tool?: string | null;
    checkpointed_at?: string;
  } | null;
  compact?: boolean;
}

const formatUsd = (val: number): string => {
  if (!val || val <= 0) return '$0.0000';
  if (val < 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(3)}`;
};

const formatCompactNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
};

/**
 * Reusable Appembly Cost Intelligence & Model Efficiency Card (`@appembly/ui`).
 * Displays token consumption anatomy (Prompt, Cached Context, Reasoning, Output),
 * per-step/tool cost economics, context cache hit ratio, and tool-level token burn.
 */
export const CostIntelligenceCard: React.FC<CostIntelligenceCardProps> = ({
  title = 'Cost & Token Telemetry',
  subtitle = 'Token consumption anatomy, prefix cache reuse, and tool-level execution burn.',
  telemetry,
  checkpointInfo,
  compact = false,
}) => {
  const { tokens, cost_usd, efficiency, tool_token_breakdown = [] } = telemetry;
  const totalTok = Math.max(1, tokens.total);

  const promptPct = Math.round((tokens.prompt / totalTok) * 100);
  const cachedPct = Math.round((tokens.cached / totalTok) * 100);
  const reasoningPct = Math.round((tokens.reasoning / totalTok) * 100);
  const completionPct = Math.max(0, 100 - promptPct - cachedPct - reasoningPct);

  const totalInputTok = tokens.prompt + tokens.cached;
  const totalOutputTok = tokens.reasoning + tokens.completion;
  const stepCount = Math.max(1, efficiency.tool_calls_total || checkpointInfo?.step_index || 1);
  const avgCostPerStep = cost_usd.total / stepCount;

  return (
    <section
      className={`rounded-xl bg-[var(--ui-bg-surface,var(--color-surface,#2C313A))]/70 border border-[var(--ui-border,var(--color-border-subtle,#31363F))] ${
        compact ? 'p-3.5 space-y-3.5' : 'p-5 space-y-4'
      } shadow-xs`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Coins className="w-3.5 h-3.5 text-[#E5C07B] shrink-0" />
            <h3
              className={`${
                compact ? 'text-xs' : 'text-sm'
              } font-bold text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))] leading-snug`}
            >
              {title}
            </h3>
            <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold bg-[var(--ui-bg-subtle,var(--color-darker,#21252B))] text-[var(--ui-text-secondary,var(--color-fg,#CBD5E1))] border border-[var(--ui-border,var(--color-border-subtle,#31363F))]">
              {telemetry.model_display_name || telemetry.model_id}
            </span>
          </div>
          {!compact && (
            <p className="text-xs text-[var(--ui-text-muted,var(--color-muted,#5C6370))] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Pricing rate summary */}
        <div className="text-[10.5px] font-mono text-[var(--ui-text-muted,var(--color-muted,#5C6370))]">
          In ${telemetry.pricing_per_1m?.input ?? 0.15}/1M · Cache $
          {telemetry.pricing_per_1m?.cached_input ?? 0.0375}/1M · Out $
          {telemetry.pricing_per_1m?.output ?? 0.6}/1M
        </div>
      </div>

      {/* 4 KPI Strip: Session Cost, Avg Cost / Step, Input vs Output Split, Cache Hit Rate */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-lg bg-[var(--ui-bg-subtle,var(--color-darker,#21252B))]/90 border border-[var(--ui-border,var(--color-border-subtle,#31363F))] p-2.5 space-y-0.5">
          <div className="flex items-center justify-between text-[10.5px] font-medium text-[var(--ui-text-muted,var(--color-muted,#5C6370))]">
            <span>Session Cost</span>
            <Coins className="w-3 h-3 text-[#E5C07B]" />
          </div>
          <div
            className={`${
              compact ? 'text-base' : 'text-lg'
            } font-bold font-mono tabular-nums text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))]`}
          >
            {formatUsd(cost_usd.total)}
          </div>
          <div className="text-[10.5px] text-[var(--ui-text-muted,var(--color-muted,#5C6370))] font-mono">
            {tokens.total.toLocaleString()} total tok
          </div>
        </div>

        <div className="rounded-lg bg-[var(--ui-bg-subtle,var(--color-darker,#21252B))]/90 border border-[var(--ui-border,var(--color-border-subtle,#31363F))] p-2.5 space-y-0.5">
          <div className="flex items-center justify-between text-[10.5px] font-medium text-[var(--ui-text-muted,var(--color-muted,#5C6370))]">
            <span>Cost / Tool Step</span>
            <Activity className="w-3 h-3 text-[#98C379]" />
          </div>
          <div
            className={`${
              compact ? 'text-base' : 'text-lg'
            } font-bold font-mono tabular-nums text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))]`}
          >
            {formatUsd(avgCostPerStep)}
          </div>
          <div className="text-[10.5px] text-[var(--ui-text-muted,var(--color-muted,#5C6370))] font-mono">
            {efficiency.tool_calls_total} calls · {efficiency.tool_success_rate_pct}% pass
          </div>
        </div>

        <div className="rounded-lg bg-[var(--ui-bg-subtle,var(--color-darker,#21252B))]/90 border border-[var(--ui-border,var(--color-border-subtle,#31363F))] p-2.5 space-y-0.5">
          <div className="flex items-center justify-between text-[10.5px] font-medium text-[var(--ui-text-muted,var(--color-muted,#5C6370))]">
            <span>In / Out Split</span>
            <Gauge className="w-3 h-3 text-blue-400" />
          </div>
          <div
            className={`${
              compact ? 'text-base' : 'text-lg'
            } font-bold font-mono tabular-nums text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))]`}
          >
            {formatCompactNumber(totalInputTok)} / {formatCompactNumber(totalOutputTok)}
          </div>
          <div className="text-[10.5px] text-[var(--ui-text-muted,var(--color-muted,#5C6370))] font-mono">
            {efficiency.avg_tokens_per_tool.toLocaleString()} avg tok/step
          </div>
        </div>

        <div className="rounded-lg bg-[var(--ui-bg-subtle,var(--color-darker,#21252B))]/90 border border-[var(--ui-border,var(--color-border-subtle,#31363F))] p-2.5 space-y-0.5">
          <div className="flex items-center justify-between text-[10.5px] font-medium text-[var(--ui-text-muted,var(--color-muted,#5C6370))]">
            <span>Context Cache Hit</span>
            <Layers className="w-3 h-3 text-[#C678DD]" />
          </div>
          <div
            className={`${
              compact ? 'text-base' : 'text-lg'
            } font-bold font-mono tabular-nums text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))]`}
          >
            {efficiency.cache_hit_ratio_pct}%
          </div>
          <div className="text-[10.5px] text-[var(--ui-text-muted,var(--color-muted,#5C6370))] font-mono">
            {tokens.cached.toLocaleString()} cached ({formatUsd(cost_usd.cached)})
          </div>
        </div>
      </div>

      {/* Stacked Token Consumption Anatomy Bar */}
      <div className="space-y-2 pt-0.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-[var(--ui-text-secondary,var(--color-fg,#CBD5E1))]">
          <span>Token Consumption Breakdown</span>
          <span className="font-mono text-[10.5px] text-[var(--ui-text-muted,var(--color-muted,#5C6370))]">
            {efficiency.loc_changed
              ? `${efficiency.loc_changed} LOC modified (${efficiency.tokens_per_loc ?? '—'} tok/LOC)`
              : `${cachedPct + promptPct}% input · ${reasoningPct + completionPct}% output`}
          </span>
        </div>

        <div className="h-2.5 w-full rounded-full bg-[var(--ui-bg-subtle,var(--color-darker,#21252B))] overflow-hidden flex gap-0.5 p-0.5 border border-[var(--ui-border,var(--color-border-subtle,#31363F))]">
          <div
            style={{ width: `${Math.max(4, cachedPct)}%` }}
            className="h-full bg-[#98C379] rounded-l-full transition-all"
            title={`Cached Context: ${tokens.cached.toLocaleString()} tokens (${cachedPct}%)`}
          />
          <div
            style={{ width: `${Math.max(4, promptPct)}%` }}
            className="h-full bg-blue-500 transition-all"
            title={`Uncached Prompt Input: ${tokens.prompt.toLocaleString()} tokens (${promptPct}%)`}
          />
          <div
            style={{ width: `${Math.max(3, reasoningPct)}%` }}
            className="h-full bg-[#C678DD] transition-all"
            title={`Reasoning / CoT: ${tokens.reasoning.toLocaleString()} tokens (${reasoningPct}%)`}
          />
          <div
            style={{ width: `${Math.max(4, completionPct)}%` }}
            className="h-full bg-[#E5C07B] rounded-r-full transition-all"
            title={`Completion Output: ${tokens.completion.toLocaleString()} tokens (${completionPct}%)`}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-[#98C379] shrink-0" />
            <span className="text-[var(--ui-text-secondary,var(--color-fg,#CBD5E1))] truncate">
              Cached: <strong className="text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))]">{tokens.cached.toLocaleString()}</strong> ({formatUsd(cost_usd.cached)})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-blue-500 shrink-0" />
            <span className="text-[var(--ui-text-secondary,var(--color-fg,#CBD5E1))] truncate">
              Prompt: <strong className="text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))]">{tokens.prompt.toLocaleString()}</strong> ({formatUsd(cost_usd.input)})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-[#C678DD] shrink-0" />
            <span className="text-[var(--ui-text-secondary,var(--color-fg,#CBD5E1))] truncate">
              Reasoning: <strong className="text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))]">{tokens.reasoning.toLocaleString()}</strong> ({formatUsd(cost_usd.reasoning)})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-[#E5C07B] shrink-0" />
            <span className="text-[var(--ui-text-secondary,var(--color-fg,#CBD5E1))] truncate">
              Output: <strong className="text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))]">{tokens.completion.toLocaleString()}</strong> ({formatUsd(cost_usd.output)})
            </span>
          </div>
        </div>
      </div>

      {/* Tool-Level Token Burn & Latency Breakdown */}
      {tool_token_breakdown.length > 0 && (
        <div className="pt-3 border-t border-[var(--ui-border,var(--color-border-subtle,#31363F))] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-[var(--ui-text-secondary,var(--color-fg,#CBD5E1))]">
            <span className="inline-flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-[#E5C07B]" />
              <span>Tool Token &amp; Latency Breakdown</span>
            </span>
            <span className="font-mono text-[10.5px] text-[var(--ui-text-muted,var(--color-muted,#5C6370))]">
              {efficiency.tool_calls_total} invocations
              {efficiency.total_tool_duration_ms
                ? ` · ${(efficiency.total_tool_duration_ms / 1000).toFixed(1)}s total`
                : ''}
            </span>
          </div>

          <div className="space-y-1.5">
            {tool_token_breakdown.slice(0, compact ? 6 : 8).map((item) => {
              const maxToolTok = Math.max(1, tool_token_breakdown[0]?.tokens || 1);
              const barPct = Math.min(100, Math.max(8, Math.round((item.tokens / maxToolTok) * 100)));
              const estToolUsd = (item.tokens / totalTok) * cost_usd.total;
              return (
                <div
                  key={item.tool_name}
                  className="flex items-center justify-between gap-2.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--ui-bg-subtle,var(--color-darker,#21252B))]/80 border border-[var(--ui-border,var(--color-border-subtle,#31363F))]"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-mono font-semibold text-[var(--ui-text-primary,var(--color-fg-bright,#F1F5F9))] truncate">
                      {item.tool_name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--ui-bg-surface,var(--color-surface,#2C313A))] text-[var(--ui-text-muted,var(--color-muted,#5C6370))] border border-[var(--ui-border,var(--color-border-subtle,#31363F))] shrink-0">
                      {item.calls}×
                    </span>
                    {item.duration_ms ? (
                      <span className="text-[10px] font-mono text-[var(--ui-text-muted,var(--color-muted,#5C6370))] hidden md:inline shrink-0">
                        {item.duration_ms >= 1000
                          ? `${(item.duration_ms / 1000).toFixed(1)}s`
                          : `${item.duration_ms}ms`}
                      </span>
                    ) : null}
                  </div>

                  <div className="w-24 hidden sm:block bg-[var(--ui-bg-surface,var(--color-surface,#2C313A))] h-1.5 rounded-full overflow-hidden shrink-0">
                    <div
                      style={{ width: `${barPct}%` }}
                      className="h-full bg-[#98C379] rounded-full"
                    />
                  </div>

                  <div className="font-mono text-[10.5px] text-[var(--ui-text-secondary,var(--color-fg,#CBD5E1))] tabular-nums shrink-0 text-right min-w-[105px]">
                    <span>{item.tokens.toLocaleString()} tok</span>
                    <span className="text-[var(--ui-text-muted,var(--color-muted,#5C6370))] ml-1">
                      ({formatUsd(estToolUsd)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
