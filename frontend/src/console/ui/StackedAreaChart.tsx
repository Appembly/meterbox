"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartBucket {
  t: number;
  values: Record<string, number>;
}

/** Stacked area chart with hover crosshair. Dependency-free SVG, sized to its container. */
export const StackedAreaChart: React.FC<{
  buckets: ChartBucket[];
  series: ChartSeries[];
  height?: number;
  formatValue: (v: number) => string;
  formatTime: (t: number) => string;
  formatTooltipTime?: (t: number) => string;
}> = ({ buckets, series, height = 240, formatValue, formatTime, formatTooltipTime }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 12, bottom: 24, left: 48 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const { stacks, max, ticks } = useMemo(() => {
    const totals = buckets.map((b) => series.reduce((acc, s) => acc + (b.values[s.key] || 0), 0));
    const rawMax = Math.max(1, ...totals);
    const niceMax = niceCeil(rawMax);
    const layers = series.map((s, si) =>
      buckets.map((b) => {
        const below = series.slice(0, si).reduce((acc, p) => acc + (b.values[p.key] || 0), 0);
        return { y0: below, y1: below + (b.values[s.key] || 0) };
      })
    );
    return { stacks: layers, max: niceMax, ticks: [0, niceMax / 2, niceMax] };
  }, [buckets, series]);

  const x = (i: number) => (buckets.length <= 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
  const y = (v: number) => innerH - (v / max) * innerH;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (buckets.length === 0 || innerW <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(buckets.length - 1, Math.round(rel * (buckets.length - 1)))));
  };

  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(innerW / 90))));
  const hovered = hover != null ? buckets[hover] : null;
  const hoveredTotal = hovered ? series.reduce((a, s) => a + (hovered.values[s.key] || 0), 0) : 0;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Usage over time">
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : "3 4"} />
                <text x={-10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--placeholder)" className="mbx-num">
                  {formatValue(t)}
                </text>
              </g>
            ))}

            {buckets.map((b, i) =>
              i % labelEvery === 0 ? (
                <text key={b.t} x={x(i)} y={innerH + 16} textAnchor="middle" fontSize={10.5} fill="var(--placeholder)">
                  {formatTime(b.t)}
                </text>
              ) : null
            )}

            <g className="mbx-chart-draw" key={`${buckets.length}-${series.map((s) => s.key).join(",")}`}>
              {stacks.map((layer, si) => {
                if (buckets.length === 0) return null;
                const top = layer.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y1).toFixed(1)}`).join(" ");
                const bottom = layer
                  .map((p, i) => [x(i), y(p.y0)] as const)
                  .reverse()
                  .map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`)
                  .join(" ");
                const s = series[si];
                return (
                  <g key={s.key}>
                    <path d={`${top} ${bottom} Z`} fill={s.color} fillOpacity={0.18} className="mbx-chart-area" />
                    <path d={top} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" />
                  </g>
                );
              })}
            </g>

            {hover != null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke="var(--border-strong)" />
                {stacks.map((layer, si) => (
                  <circle
                    key={series[si].key}
                    cx={x(hover)}
                    cy={y(layer[hover].y1)}
                    r={3}
                    fill="var(--card)"
                    stroke={series[si].color}
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            )}

            <rect
              x={0}
              y={0}
              width={innerW}
              height={innerH}
              fill="transparent"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        </svg>
      )}

      {hovered && hover != null && (
        <div
          className="mbx-pop pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 shadow-[var(--shadow-lg)]"
          style={{
            left: Math.min(Math.max(pad.left + x(hover) + 12, 0), Math.max(0, width - 200)),
          }}
        >
          <div className="text-[11.5px] text-[var(--muted-foreground)]">
            {(formatTooltipTime || formatTime)(hovered.t)}
          </div>
          <div className="mt-1 text-[14px] font-semibold mbx-num">{formatValue(hoveredTotal)}</div>
          <div className="mt-1.5 space-y-1">
            {series
              .filter((s) => (hovered.values[s.key] || 0) > 0)
              .map((s) => (
                <div key={s.key} className="flex items-center gap-2 text-[12px]">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 truncate text-[var(--muted-foreground)]">{s.label}</span>
                  <span className="mbx-num font-medium">{formatValue(hovered.values[s.key] || 0)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

function niceCeil(v: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}
