"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChartColumn, Database, Plus, Sparkles } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { apiPost } from "../../lib/api";
import { formatCompact, formatNumber, formatPercent } from "../../lib/format";
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
  Segmented,
  Select,
  Skeleton,
  StatusDot,
  usePagination,
} from "../../ui/primitives";
import { StackedAreaChart } from "../../ui/StackedAreaChart";
import { RANGES, RangeKey, useMeterSeries } from "../overview/useMeterSeries";
import type { Meter } from "../../../types/meterbox";

export const MetersView: React.FC = () => {
  const { org, env, namespace, snapshot, status, refresh } = useConsole();
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [range, setRange] = useState<RangeKey>("24h");
  const [groupKey, setGroupKey] = useState<string>("__total");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; title: string; detail?: string } | null>(null);

  // Create meter form state
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [agg, setAgg] = useState<Meter["aggregation"]>("SUM");
  const [eventType, setEventType] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [groupDimKey, setGroupDimKey] = useState("");
  const [groupDimPath, setGroupDimPath] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (snapshot.meters.length === 0) return;
    if (selectedSlug && snapshot.meters.some((m) => m.slug === selectedSlug)) return;
    const initial = snapshot.meters[0];
    setSelectedSlug(initial.slug);
    const keys = Object.keys(initial.group_by || {});
    setGroupKey(keys[0] || "__total");
  }, [snapshot.meters, selectedSlug]);

  const activeMeter = snapshot.meters.find((m) => m.slug === selectedSlug) || snapshot.meters[0];
  const groupKeys = Object.keys(activeMeter?.group_by || {});
  const seriesData = useMeterSeries(namespace, activeMeter?.slug || "", range, groupKey);

  const timeFmt = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions =
      range === "24h" ? { hour: "numeric" } : range === "7d" ? { weekday: "short", hour: "numeric" } : { month: "short", day: "numeric" };
    const axis = new Intl.DateTimeFormat("en-US", range === "7d" ? { weekday: "short" } : opts);
    const tip = new Intl.DateTimeFormat("en-US", range === "30d" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" });
    return { axis: (t: number) => axis.format(t), tip: (t: number) => tip.format(t) };
  }, [range]);

  const breakdownRows = useMemo(() => {
    return seriesData.series.map((s) => {
      const sum = seriesData.buckets.reduce((acc, b) => acc + (b.values[s.key] || 0), 0);
      const share = seriesData.total > 0 ? sum / seriesData.total : 0;
      return { key: s.key, label: s.label, color: s.color, sum, share };
    });
  }, [seriesData]);

  const meterPagination = usePagination(snapshot.meters, 5);
  const breakdownPagination = usePagination(breakdownRows, 5);

  const handleSelectMeter = (m: Meter) => {
    setSelectedSlug(m.slug);
    const keys = Object.keys(m.group_by || {});
    setGroupKey(keys[0] || "__total");
  };

  const handleCreateMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !eventType.trim()) return;
    setSubmitting(true);
    try {
      const groupBy: Record<string, string> = {};
      if (groupDimKey.trim() && groupDimPath.trim()) {
        groupBy[groupDimKey.trim()] = groupDimPath.trim();
      }
      await apiPost(
        "/api/v1/meters",
        {
          slug: slug.trim(),
          name: name.trim() || slug.trim(),
          aggregation: agg,
          event_type: eventType.trim(),
          value_property: agg === "COUNT" ? "" : valueProp.trim(),
          group_by: groupBy,
          window_size: "HOUR",
        },
        namespace,
      );
      const createdSlug = slug.trim();
      setSlug("");
      setName("");
      setDrawerOpen(false);
      await refresh();
      setSelectedSlug(createdSlug);
      setNotice({
        tone: "ok",
        title: `Meter "${createdSlug}" provisioned`,
        detail: `Materialized 1-minute rollup registered in namespace ${namespace}.`,
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Could not create meter",
        detail: err instanceof Error ? err.message : "Verify the meter slug is unique.",
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
        title="Meters & OLAP Rollups"
        subtitle="Declarative CloudEvents aggregation definitions and real-time dimensional rollup queries."
        actions={
          <>
            <Segmented<RangeKey>
              ariaLabel="Time range"
              value={range}
              onChange={setRange}
              options={(Object.keys(RANGES) as RangeKey[]).map((k) => ({ value: k, label: RANGES[k].label }))}
            />
            <Button variant="primary" onClick={() => setDrawerOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Create meter
            </Button>
          </>
        }
      />

      {notice && <Notice tone={notice.tone} title={notice.title} detail={notice.detail} onDismiss={() => setNotice(null)} />}

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Registered meters</span>
            <ChartColumn className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{snapshot.meters.length}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Scoped to <span className="mbx-mono text-[var(--foreground)]">{namespace}</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Selected meter rollup ({RANGES[range].label})</span>
            <Sparkles className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{formatCompact(seriesData.total)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)] truncate">
            {activeMeter ? `${activeMeter.name} · ${formatNumber(seriesData.events)} events` : "Select a meter"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Rollup storage engine</span>
            <Database className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[18px] font-semibold">
            <StatusDot tone={snapshot.telemetry?.clickhouseConnected === false ? "warn" : "ok"} live />
            {snapshot.telemetry?.clickhouseConnected === false ? "In-Memory Fallback Store" : "ClickHouse Materialized Views"}
          </div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            1-minute granularity (`MINUTE` / `HOUR` / `DAY` windows)
          </div>
        </Card>
      </div>

      {/* Main Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Meter Catalog */}
        <Card className="lg:col-span-5 flex flex-col">
          <CardHeader
            title="Meter catalog"
            subtitle={`${snapshot.meters.length} active definition${snapshot.meters.length === 1 ? "" : "s"}`}
          />
          <div className="px-3 pb-3 space-y-2">
            {status === "loading" ? (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : snapshot.meters.length === 0 ? (
              <EmptyState
                title="No meters defined"
                description="Create your first meter to aggregate CloudEvents by customer and dimension."
                action={
                  <Button variant="primary" size="sm" onClick={() => setDrawerOpen(true)}>
                    <Plus className="w-3.5 h-3.5" /> Create meter
                  </Button>
                }
              />
            ) : (
              meterPagination.pageItems.map((m) => {
                const selected = m.slug === activeMeter?.slug;
                const dims = Object.entries(m.group_by || {});
                return (
                  <button
                    key={m.slug}
                    type="button"
                    onClick={() => handleSelectMeter(m)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--accent)] shadow-xs"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-[var(--foreground)] truncate">{m.name}</div>
                        <div className="mt-0.5 text-[11.5px] mbx-mono text-[var(--muted-foreground)]">{m.slug}</div>
                      </div>
                      <Pill tone={selected ? "ok" : "neutral"} mono>
                        {m.aggregation}
                      </Pill>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--muted-foreground)]">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] mbx-mono text-[var(--foreground)]">
                        type: {m.event_type}
                      </span>
                      {m.value_property && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] mbx-mono">
                          val: {m.value_property}
                        </span>
                      )}
                      {dims.map(([k, v]) => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] mbx-mono">
                          {k}={v}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <Pagination state={meterPagination} pageSizeOptions={[3, 5, 10]} itemLabel="meters" compact />
        </Card>

        {/* Right: Interactive OLAP Rollup Explorer */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader
            title={activeMeter ? activeMeter.name : "OLAP Rollup Explorer"}
            subtitle={
              activeMeter ? (
                <>
                  <span className="mbx-mono">{activeMeter.slug}</span> · Event type{" "}
                  <span className="mbx-mono text-[var(--foreground)]">{activeMeter.event_type}</span> · Value{" "}
                  <span className="mbx-mono text-[var(--foreground)]">{activeMeter.value_property || "1 (COUNT)"}</span>
                </>
              ) : (
                "Select a meter to inspect its time-series rollups"
              )
            }
            actions={
              activeMeter ? (
                <Select label="Group by dimension" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
                  <option value="__total">No grouping (total)</option>
                  {groupKeys.map((k) => (
                    <option key={k} value={k}>
                      Group by {k}
                    </option>
                  ))}
                </Select>
              ) : null
            }
          />

          <div className="px-4 pb-4 space-y-5">
            {seriesData.loading && seriesData.total === 0 ? (
              <Skeleton className="h-[240px] w-full" />
            ) : seriesData.total === 0 ? (
              <EmptyState
                title="No rollup data in this window"
                description="Ingest CloudEvents matching this meter's event_type or switch to a wider time range."
                className="h-[220px]"
              />
            ) : (
              <StackedAreaChart
                buckets={seriesData.buckets}
                series={seriesData.series}
                formatValue={(v) => formatCompact(v)}
                formatTime={timeFmt.axis}
                formatTooltipTime={timeFmt.tip}
              />
            )}

            {/* Dimensional breakdown table */}
            <div className="border-t border-[var(--border)] pt-4">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[12.5px] font-semibold text-[var(--foreground)]">
                  Dimensional breakdown {groupKey !== "__total" ? `(by ${groupKey})` : ""}
                </h3>
                <span className="text-[12px] text-[var(--muted-foreground)] mbx-num">
                  Total: <strong className="text-[var(--foreground)]">{formatNumber(seriesData.total)}</strong>
                </span>
              </div>

              {breakdownRows.length === 0 ? (
                <p className="text-[12.5px] text-[var(--muted-foreground)]">No grouped series available.</p>
              ) : (
                <div className="space-y-2.5">
                  {breakdownRows.map((row) => (
                    <div key={row.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: row.color }} />
                          <span className="mbx-mono">{row.label}</span>
                        </span>
                        <span className="mbx-num text-[var(--muted-foreground)]">
                          <strong className="text-[var(--foreground)]">{formatCompact(row.sum)}</strong> ·{" "}
                          {formatPercent(row.share)}
                        </span>
                      </div>
                      <ProgressBar value={row.share} tone="ok" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Create Meter Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create meter"
        subtitle="Define a declarative CloudEvents aggregation materialized in real time."
      >
        <form onSubmit={handleCreateMeter} className="space-y-4">
          <Field label="Meter slug" hint="Unique identifier (snake_case)">
            <Input
              mono
              required
              placeholder="e.g. vector_queries_total"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </Field>

          <Field label="Display name" hint="Human-readable label on invoices & charts">
            <Input
              required
              placeholder="e.g. Vector Index Queries"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Aggregation">
              <select
                value={agg}
                onChange={(e) => setAgg(e.target.value as Meter["aggregation"])}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[13px]"
              >
                <option value="SUM">SUM</option>
                <option value="COUNT">COUNT</option>
                <option value="AVG">AVG</option>
                <option value="UNIQUE_COUNT">UNIQUE_COUNT</option>
                <option value="MAX">MAX</option>
              </select>
            </Field>

            <Field label="CloudEvents type" hint="Matches event.type">
              <Input
                mono
                required
                placeholder="ai.llm.tokens"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              />
            </Field>
          </div>

          {agg !== "COUNT" && (
            <Field label="Value JSONPath property" hint="Numeric field inside event.data">
              <Input
                mono
                required
                placeholder="$.tokens"
                value={valueProp}
                onChange={(e) => setValueProp(e.target.value)}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Group-by dimension key" hint="Optional tag name">
              <Input
                mono
                placeholder="model"
                value={groupDimKey}
                onChange={(e) => setGroupDimKey(e.target.value)}
              />
            </Field>
            <Field label="Group-by JSONPath" hint="Path in event.data">
              <Input
                mono
                placeholder="$.model"
                value={groupDimPath}
                onChange={(e) => setGroupDimPath(e.target.value)}
              />
            </Field>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Provisioning…" : "Provision meter"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
