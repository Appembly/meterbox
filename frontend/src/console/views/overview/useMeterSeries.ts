"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/api";
import type { ChartBucket, ChartSeries } from "../../ui/StackedAreaChart";

export type RangeKey = "24h" | "7d" | "30d";

export const RANGES: Record<RangeKey, { label: string; window: "1h" | "1d"; buckets: number; stepMs: number }> = {
  "24h": { label: "24h", window: "1h", buckets: 24, stepMs: 3_600_000 },
  "7d": { label: "7d", window: "1h", buckets: 168, stepMs: 3_600_000 },
  "30d": { label: "30d", window: "1d", buckets: 30, stepMs: 86_400_000 },
};

const PALETTE = ["#4E8067", "#3B82F6", "#F59E0B", "#8B5CF6", "#06B6D4"];
const OTHER_COLOR = "#A9AFAB";
const MAX_SERIES = 5;

interface QueryRow {
  window_start?: string;
  value?: number;
  event_count?: number;
  groups?: Record<string, string>;
  group_by?: Record<string, string>;
}

export interface MeterSeries {
  buckets: ChartBucket[];
  series: ChartSeries[];
  total: number;
  events: number;
  totalsPerBucket: number[];
  loading: boolean;
  error: boolean;
}

const QUERY_CACHE = new Map<string, QueryRow[]>();

/** Fetches a meter's windowed usage and shapes it into gap-filled, grouped buckets. */
export function useMeterSeries(namespace: string, meterSlug: string, range: RangeKey, groupKey: string): MeterSeries {
  const cacheKey = `${namespace}:${meterSlug}:${RANGES[range].window}`;
  const [rows, setRows] = useState<QueryRow[]>(() => QUERY_CACHE.get(cacheKey) || []);
  const [loading, setLoading] = useState(() => !QUERY_CACHE.has(cacheKey));
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Refresh periodically so the chart stays live alongside the snapshot.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setNonce((n) => n + 1);
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!namespace || !meterSlug) return;
    const cached = QUERY_CACHE.get(cacheKey);
    if (cached) {
      setRows(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const ctrl = new AbortController();
    apiGet<{ data?: QueryRow[]; series?: QueryRow[] }>(
      `/api/v1/meters/${encodeURIComponent(meterSlug)}/query?window=${RANGES[range].window}`,
      namespace,
      ctrl.signal
    )
      .then((raw) => {
        const nextRows = Array.isArray(raw.data) ? raw.data : Array.isArray(raw.series) ? raw.series : [];
        QUERY_CACHE.set(cacheKey, nextRows);
        setRows(nextRows);
        setError(false);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [namespace, meterSlug, range, cacheKey, nonce]);

  return useMemo(() => {
    const cfg = RANGES[range];
    const now = Date.now();
    const end = Math.floor(now / cfg.stepMs) * cfg.stepMs;
    const start = end - (cfg.buckets - 1) * cfg.stepMs;

    // Totals per group (to pick the top N series)
    const groupOf = (r: QueryRow) => {
      if (groupKey === "__total") return "Total";
      const g = r.groups || r.group_by || {};
      return g[groupKey] || "Unspecified";
    };
    const inRange = rows.filter((r) => {
      const t = Date.parse(r.window_start || "");
      return Number.isFinite(t) && t >= start && t <= end + cfg.stepMs;
    });
    const groupTotals = new Map<string, number>();
    for (const r of inRange) groupTotals.set(groupOf(r), (groupTotals.get(groupOf(r)) || 0) + Number(r.value || 0));
    const ranked = Array.from(groupTotals.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const top = ranked.slice(0, MAX_SERIES);
    const hasOther = ranked.length > MAX_SERIES;

    const series: ChartSeries[] = top.map((k, i) => ({ key: k, label: k, color: PALETTE[i % PALETTE.length] }));
    if (hasOther) series.push({ key: "__other", label: "Other", color: OTHER_COLOR });

    const buckets: ChartBucket[] = Array.from({ length: cfg.buckets }, (_, i) => ({ t: start + i * cfg.stepMs, values: {} }));
    let total = 0;
    let events = 0;
    for (const r of inRange) {
      const t = Math.floor(Date.parse(r.window_start || "") / cfg.stepMs) * cfg.stepMs;
      const idx = Math.round((t - start) / cfg.stepMs);
      if (idx < 0 || idx >= buckets.length) continue;
      const g = groupOf(r);
      const key = top.includes(g) ? g : "__other";
      const v = Number(r.value || 0);
      buckets[idx].values[key] = (buckets[idx].values[key] || 0) + v;
      total += v;
      events += Number(r.event_count || 0);
    }
    const totalsPerBucket = buckets.map((b) => Object.values(b.values).reduce((a, v) => a + v, 0));

    return { buckets, series, total, events, totalsPerBucket, loading, error };
  }, [rows, range, groupKey, loading, error]);
}
