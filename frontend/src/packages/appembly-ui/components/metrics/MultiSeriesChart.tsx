import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { ChartSeries } from '../../types';

export interface MultiSeriesChartProps {
  title: string;
  subtitle?: string;
  labels: string[];
  series: ChartSeries[];
  exportLabel?: string;
  onExport?: () => void;
}

/**
 * Interactive Multi-Series SVG Line Chart with Solid & Dashed Trajectories
 * and Floating Hover Inspection Card (matches "Audience Growth" in reference screenshot).
 */
export const MultiSeriesChart: React.FC<MultiSeriesChartProps> = ({
  title,
  subtitle,
  labels,
  series,
  exportLabel = 'Export CSV',
  onExport,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number>(Math.min(5, Math.max(0, labels.length - 3)));

  const width = 820;
  const height = 240;
  const padLeft = 38;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues = series.flatMap((s) => s.values);
  const maxVal = Math.max(30, ...allValues);
  const minVal = Math.min(0, ...allValues);
  const range = Math.max(1, maxVal - minVal);

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, labels.length - 1)) * plotW;
  const getY = (val: number) =>
    padTop + plotH - ((val - minVal) / range) * plotH;

  const yTicks = [0, 5, 10, 20, 30];

  return (
    <section className="rounded-2xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] p-6 shadow-2xs relative">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ui-text-primary)] leading-snug">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">{subtitle}</p>
          )}
        </div>

        <button
          onClick={onExport}
          className="px-3 py-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] hover:bg-[var(--ui-bg-hover)] text-[12.5px] font-medium text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#4E8067]" />
          <span>{exportLabel}</span>
        </button>
      </div>

      {/* SVG Plot + Floating Popover */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[240px] overflow-visible select-none"
        >
          {/* Horizontal Dashed Gridlines & Y Labels */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--ui-border)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[var(--ui-text-muted)] text-[11px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Vertical Hover Crosshair Line */}
          {hoverIndex >= 0 && hoverIndex < labels.length && (
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={height - padBottom}
              stroke="var(--ui-border-strong)"
              strokeWidth="1.2"
            />
          )}

          {/* Series Polylines */}
          {series.map((s) => {
            const points = s.values
              .map((v, i) => `${getX(i).toFixed(1)},${getY(v).toFixed(1)}`)
              .join(' ');
            return (
              <g key={s.id}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.2"
                  strokeDasharray={s.dashed ? '6 5' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
                {/* Active Point Ring on Hover */}
                {hoverIndex >= 0 && hoverIndex < s.values.length && (
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(s.values[hoverIndex])}
                    r="4.5"
                    fill="var(--ui-bg-surface)"
                    stroke={s.color}
                    strokeWidth="2.5"
                  />
                )}
              </g>
            );
          })}

          {/* Invisible Hover Columns for Smooth Scrubbing */}
          {labels.map((lbl, idx) => {
            const colW = plotW / Math.max(1, labels.length);
            return (
              <rect
                key={lbl}
                x={getX(idx) - colW / 2}
                y={padTop}
                width={colW}
                height={plotH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(idx)}
              />
            );
          })}
        </svg>

        {/* Floating Hover Inspection Card (matches "Feb 10, 2023" card in screenshot) */}
        {hoverIndex >= 0 && hoverIndex < labels.length && (
          <div
            style={{
              left: `${Math.min(72, Math.max(18, (hoverIndex / Math.max(1, labels.length - 1)) * 75 + 8))}%`,
            }}
            className="absolute top-8 z-20 w-56 rounded-xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] shadow-lg p-3.5 pointer-events-none transition-[left,opacity] duration-150"
          >
            <div className="text-[11.5px] font-medium text-[var(--ui-text-muted)] pb-2 mb-2 border-b border-[var(--ui-border)]">
              {labels[hoverIndex]}
            </div>
            <div className="space-y-2">
              {series.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-[12.5px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full border-[2.5px] flex-shrink-0"
                      style={{ borderColor: s.color }}
                    />
                    <span className="text-[var(--ui-text-primary)] truncate">
                      {s.label}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums text-[var(--ui-text-primary)]">
                    {s.values[hoverIndex]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
