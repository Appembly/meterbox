import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { KpiMetricItem } from '../../types';

export interface KpiSummaryCardProps {
  title: string;
  subtitle?: string;
  metrics: KpiMetricItem[];
  rightHeaderSlot?: React.ReactNode;
}

const ACCENT_BAR_COLORS: Record<string, string> = {
  sage: 'bg-[#4E8067]',
  orange: 'bg-orange-400',
  emerald: 'bg-emerald-500',
  indigo: 'bg-indigo-400',
  amber: 'bg-amber-400',
};

/**
 * KPI Summary Strip Card matching "Performance Summary" from the reference screenshot.
 * Renders vertical colored accent bars next to each metric label, scope subtitle,
 * large tabular figure, and directional percentage delta.
 */
export const KpiSummaryCard: React.FC<KpiSummaryCardProps> = ({
  title,
  subtitle,
  metrics,
  rightHeaderSlot,
}) => {
  return (
    <section className="rounded-2xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] p-6 shadow-2xs">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ui-text-primary)] leading-snug">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">{subtitle}</p>
          )}
        </div>
        {rightHeaderSlot}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => {
          const barClass = ACCENT_BAR_COLORS[m.accentColor || 'sage'] || 'bg-[#4E8067]';
          const isUp = m.deltaTrend !== 'down';

          return (
            <div key={m.id} className="flex flex-col justify-between">
              {/* Top: Vertical Colored Accent Bar + Label + Scope Subtitle */}
              <div className="flex items-stretch gap-2.5 mb-2.5">
                <span className={`w-[2.5px] rounded-full ${barClass} flex-shrink-0`} />
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-[var(--ui-text-primary)] leading-tight">
                    {m.label}
                  </span>
                  <span className="text-[12px] text-[var(--ui-text-muted)] leading-tight mt-0.5">
                    {m.scopeLabel || 'All'}
                  </span>
                </div>
              </div>

              {/* Bottom: Large Metric Number + Trend Delta */}
              <div className="flex items-baseline gap-2.5 pl-3">
                <span className="text-[28px] font-semibold tracking-tight text-[var(--ui-text-primary)] tabular-nums leading-none">
                  {m.value}
                </span>
                {m.delta && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[12.5px] font-medium ${
                      isUp ? 'text-[#4E8067]' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <span>{m.delta}</span>
                    {isUp ? (
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.2]" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.2]" />
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
