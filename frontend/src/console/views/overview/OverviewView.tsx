"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { formatCompact } from "../../lib/format";
import { Card, CardHeader, EmptyState, EnvBadge, Segmented, Select, Skeleton } from "../../ui/primitives";
import { StackedAreaChart } from "../../ui/StackedAreaChart";
import { AllowancePanel, AttentionPanel, KpiRow, LiveEvents, PipelineStrip } from "./panels";
import { RANGES, RangeKey, useMeterSeries } from "./useMeterSeries";

const PREFERRED_METER = "llm_tokens_total";

export const OverviewView: React.FC = () => {
  const { org, env, href, navigate, namespace, snapshot, status } = useConsole();
  const [range, setRange] = useState<RangeKey>("24h");
  const [meterSlug, setMeterSlug] = useState(PREFERRED_METER);
  const [groupKey, setGroupKey] = useState("model");

  // Default meter: preferred slug, else first SUM meter, else first meter.
  useEffect(() => {
    if (snapshot.meters.length === 0) return;
    if (meterSlug && snapshot.meters.some((m) => m.slug === meterSlug)) return;
    const preferred =
      snapshot.meters.find((m) => m.slug === PREFERRED_METER) ||
      snapshot.meters.find((m) => m.aggregation === "SUM") ||
      snapshot.meters[0];
    setMeterSlug(preferred.slug);
    const keys = Object.keys(preferred.group_by || {});
    setGroupKey(keys.includes("model") ? "model" : keys[0] || "__total");
  }, [snapshot.meters, meterSlug]);

  const meter = snapshot.meters.find((m) => m.slug === meterSlug);
  const groupKeys = Object.keys(meter?.group_by || {});
  const usage = useMeterSeries(namespace, meterSlug, range, groupKey);

  const timeFmt = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions =
      range === "24h" ? { hour: "numeric" } : range === "7d" ? { weekday: "short", hour: "numeric" } : { month: "short", day: "numeric" };
    const axis = new Intl.DateTimeFormat("en-US", range === "7d" ? { weekday: "short" } : opts);
    const tip = new Intl.DateTimeFormat("en-US", range === "30d" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" });
    return { axis: (t: number) => axis.format(t), tip: (t: number) => tip.format(t) };
  }, [range]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="mbx-enter flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--muted-foreground)]">
            <span className="truncate">{org?.name || " "}</span>
            {env && <EnvBadge type={env.type} label={env.name} />}
          </div>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.025em]">Overview</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<RangeKey>
            ariaLabel="Time range"
            value={range}
            onChange={setRange}
            options={(Object.keys(RANGES) as RangeKey[]).map((k) => ({ value: k, label: RANGES[k].label }))}
          />
          <a
            href={href("events?ingest=1")}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                e.preventDefault();
                navigate("events?ingest=1");
              }
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-white hover:brightness-110 shadow-sm"
          >
            {env?.type === "sandbox" ? "Send test event" : "Ingest playground"}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      <KpiRow
        meterName={meter?.name || ""}
        meterTotal={usage.total}
        meterSpark={usage.totalsPerBucket}
        meterLoading={usage.loading}
        rangeLabel={RANGES[range].label}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Usage over time */}
        <Card className="xl:col-span-2 flex flex-col" delay={160}>
          <CardHeader
            title="Usage over time"
            subtitle={
              meter ? (
                <>
                  <span className="mbx-num font-medium text-[var(--foreground)]">{formatCompact(usage.total)}</span> {meter.name.toLowerCase()} ·{" "}
                  {formatCompact(usage.events)} events
                </>
              ) : (
                " "
              )
            }
            actions={
              snapshot.meters.length > 0 ? (
                <>
                  <Select label="Meter" value={meterSlug} onChange={(e) => {
                    const next = snapshot.meters.find((m) => m.slug === e.target.value);
                    setMeterSlug(e.target.value);
                    const keys = Object.keys(next?.group_by || {});
                    setGroupKey(keys.includes("model") ? "model" : keys[0] || "__total");
                  }}>
                    {snapshot.meters.map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                  <Select label="Group by" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
                    <option value="__total">No grouping</option>
                    {groupKeys.map((k) => (
                      <option key={k} value={k}>
                        By {k.replace(/_/g, " ")}
                      </option>
                    ))}
                  </Select>
                </>
              ) : null
            }
          />
          <div className="px-3 pb-3">
            {status === "loading" || (usage.loading && usage.total === 0) ? (
              <Skeleton className="h-[240px] w-full" />
            ) : usage.error ? (
              <EmptyState title="Couldn’t load usage" description="The meter query failed. It will retry automatically." className="h-[240px]" />
            ) : usage.total === 0 ? (
              <EmptyState
                title={`No ${meter?.name.toLowerCase() || "usage"} in the last ${RANGES[range].label}`}
                description="Try a longer range, or send events matching this meter."
                className="h-[240px]"
              />
            ) : (
              <StackedAreaChart
                buckets={usage.buckets}
                series={usage.series}
                formatValue={(v) => formatCompact(v)}
                formatTime={timeFmt.axis}
                formatTooltipTime={timeFmt.tip}
              />
            )}
            {usage.series.length > 1 && usage.total > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-2 pt-2 text-[12px] text-[var(--muted-foreground)]">
                {usage.series.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        <AttentionPanel delay={200} />
      </div>

      <PipelineStrip delay={240} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <LiveEvents delay={280} />
        </div>
        <AllowancePanel delay={320} />
      </div>
    </div>
  );
};
