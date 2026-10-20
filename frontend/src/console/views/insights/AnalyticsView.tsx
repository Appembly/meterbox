"use client";

import React from "react";
import { Activity, ChartPie, Globe, Laptop, Users } from "lucide-react";
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
  Skeleton,
  usePagination,
} from "../../ui/primitives";

export const AnalyticsView: React.FC = () => {
  const { org, env, snapshot, status } = useConsole();
  const report = snapshot.productAnalytics;
  const locPagination = usePagination(report?.locations || [], 8);
  const evPagination = usePagination(report?.event_breakdown || [], 6);

  return (
    <div className="space-y-5">
      <PageHeader
        orgName={org?.name}
        envType={env?.type}
        envName={env?.name}
        title="Product Analytics & PostHog Bridge"
        subtitle="Unified product engagement telemetry correlated with metered AI token consumption across regions, pages, and devices."
      />

      {/* Top Product Analytics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Active users (24h)</span>
            <Users className="w-4 h-4 text-[var(--primary)]" />
          </div>
          {status === "loading" ? (
            <Skeleton className="mt-3 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 text-[26px] font-semibold mbx-num">
                {formatNumber(report?.active_users_24h || 0)}
              </div>
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                of {formatNumber(report?.total_users || 0)} total tracked users
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Product events captured</span>
            <Activity className="w-4 h-4 text-[var(--primary)]" />
          </div>
          {status === "loading" ? (
            <Skeleton className="mt-3 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 text-[26px] font-semibold mbx-num">
                {formatNumber(report?.total_product_events || 0)}
              </div>
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Across {formatNumber(report?.total_sessions || 0)} user sessions
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Pageviews ($pageview)</span>
            <ChartPie className="w-4 h-4 text-[var(--primary)]" />
          </div>
          {status === "loading" ? (
            <Skeleton className="mt-3 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 text-[26px] font-semibold mbx-num">
                {formatNumber(report?.total_pageviews || 0)}
              </div>
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Ingested via `/api/v1/posthog/capture`
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Geographic footprint</span>
            <Globe className="w-4 h-4 text-[var(--primary)]" />
          </div>
          {status === "loading" ? (
            <Skeleton className="mt-3 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 text-[26px] font-semibold mbx-num">
                {formatNumber(report?.unique_countries || 0)} countries
              </div>
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                {report?.locations?.length || 0} active metro hubs
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Main Grid: Geographic Breakdown & Event/Page Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Geographic Telemetry */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader
            title="Geographic Usage & AI Token Telemetry"
            subtitle="Correlating user sessions and pageviews with LLM token consumption by city"
          />
          <div className="overflow-x-auto mbx-scroll">
            {!report || !report.locations || report.locations.length === 0 ? (
              <EmptyState
                icon={<Globe className="w-5 h-5" />}
                title="No geographic data yet"
                description="Capture product events to populate regional analytics."
              />
            ) : (
              <table className="min-w-[560px] w-full text-[12.5px]">
                <thead>
                  <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                    <th className="px-5 py-2.5 text-left">Location</th>
                    <th className="px-3 py-2.5 text-right">Users</th>
                    <th className="px-3 py-2.5 text-right">Events</th>
                    <th className="px-3 py-2.5 text-right">AI Tokens</th>
                    <th className="px-5 py-2.5 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {locPagination.pageItems.map((loc, idx) => (
                    <tr key={`${loc.city}-${idx}`} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-5 py-2.5">
                        <div className="font-medium">
                          {loc.city}, {loc.country_name}
                        </div>
                        <div className="text-[11px] mbx-mono text-[var(--muted-foreground)]">{loc.country_code}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right mbx-num">{formatNumber(loc.users)}</td>
                      <td className="px-3 py-2.5 text-right mbx-num">{formatNumber(loc.events)}</td>
                      <td className="px-3 py-2.5 text-right mbx-num font-medium">{formatCompact(loc.tokens)}</td>
                      <td className="px-5 py-2.5 text-right">
                        <Pill tone="ok" mono>
                          {loc.share_pct.toFixed(1)}%
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {report?.locations && report.locations.length > 0 && (
            <Pagination
              state={locPagination}
              pageSizeOptions={[5, 8, 15]}
              itemLabel="locations"
            />
          )}
        </Card>

        {/* Right: Event Types & Top Pages */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader
              title="Top Product Events"
              subtitle="Distribution of PostHog & CloudEvents activity"
            />
            <div className="px-5 pb-5 space-y-3">
              {(!report?.event_breakdown || report.event_breakdown.length === 0) ? (
                <p className="text-[12.5px] text-[var(--muted-foreground)]">No events recorded.</p>
              ) : (
                evPagination.pageItems.map((ev) => (
                  <div key={ev.event_type} className="space-y-1">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="mbx-mono font-medium">{ev.event_type}</span>
                      <span className="mbx-num text-[var(--muted-foreground)]">
                        <strong className="text-[var(--foreground)]">{formatNumber(ev.count)}</strong> ·{" "}
                        {ev.share_pct.toFixed(1)}%
                      </span>
                    </div>
                    <ProgressBar value={ev.share_pct / 100} tone="ok" />
                  </div>
                ))
              )}
            </div>
            {report?.event_breakdown && report.event_breakdown.length > 0 && (
              <Pagination
                state={evPagination}
                pageSizeOptions={[4, 6, 12]}
                itemLabel="event types"
                compact
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Top Application Routes & Devices"
              subtitle="Most visited paths and client runtime environments"
            />
            <div className="px-5 pb-5 space-y-4">
              <div className="space-y-2">
                {(report?.top_pages || []).slice(0, 4).map((pg) => (
                  <div
                    key={pg.pathname}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface-subtle)] text-[12px]"
                  >
                    <span className="mbx-mono font-medium truncate">{pg.pathname}</span>
                    <span className="mbx-num text-[var(--muted-foreground)]">
                      <strong className="text-[var(--foreground)]">{pg.views}</strong> views ({pg.users} usr)
                    </span>
                  </div>
                ))}
              </div>

              {report?.devices && report.devices.length > 0 && (
                <div className="pt-3 border-t border-[var(--border)] flex flex-wrap gap-2">
                  {report.devices.map((d) => (
                    <Pill key={d.label} mono>
                      <Laptop className="w-3 h-3" />
                      {d.label}: {d.share_pct.toFixed(0)}%
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
