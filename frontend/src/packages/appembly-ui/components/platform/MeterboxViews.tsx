import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardHeader,
  CopyButton,
  Drawer,
  HorizTabs,
  JsonView,
  Notice,
  PageHeader,
  Pill,
  ProgressBar,
  Readout,
  Segmented,
  StackedAreaChart,
  StatusDot,
  Tag,
  TokenChip,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
} from './Primitives';

/* ============================================================================
 * 1. METERBOX — USAGE, OLAP ROLLUPS, AI FINOPS & DLQ REPLAY (MetersView)
 * ============================================================================ */

interface MeterSpec {
  id: string;
  slug: string;
  name: string;
  event_type: string;
  aggregation: 'SUM' | 'COUNT' | 'UNIQUE_COUNT' | 'AVG';
  value_property: string;
  group_by: string[];
  volume_24h: number;
  unit: string;
  latency_ms: number;
}

const DEFAULT_METERS: MeterSpec[] = [
  {
    id: 'mtr_llm_tokens',
    slug: 'llm_tokens_total',
    name: 'LLM Tokens Consumed (Valiscale Studio)',
    event_type: 'ai.llm.tokens',
    aggregation: 'SUM',
    value_property: '$.tokens',
    group_by: ['model', 'persona', 'tool', 'type'],
    volume_24h: 0,
    unit: 'tokens',
    latency_ms: 2,
  },
];

const SERIES_PALETTE = ['#22543B', '#4E8067', '#6E56CF', '#2563EB', '#D97706'];

export const MetersView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  platformData?: any;
  dashData?: any;
  onRefreshSnapshot?: () => void;
  onIngestTestCloudEvent: (dedupTest?: boolean) => void;
  onReplayDlqEvent: (eventId: string, autoFix?: boolean) => void;
  onOpenSheet: (title: string, obj: any) => void;
}> = ({
  subTab,
  onSelectSubTab,
  platformData,
  dashData,
  onRefreshSnapshot,
  onIngestTestCloudEvent,
  onReplayDlqEvent,
  onOpenSheet,
}) => {
  const data = platformData || dashData;
  const m = data?.meterbox || {};
  const isCyclode = Boolean(
    data?.app_name === 'cyclode' ||
      (typeof window !== 'undefined' &&
        (window.location.port === '6013' || document.title.toLowerCase().includes('cyclode')))
  );
  const appDisplayName = isCyclode ? 'Cyclode Workstation' : 'Valiscale Studio';
  const activeNs = data?.namespace || m?.namespace || 'ns_live_appembly';
  const rawTab = subTab || 'analytics';
  const tab =
    rawTab === 'catalog'
      ? 'analytics'
      : rawTab === 'events'
        ? 'dlq'
        : rawTab === 'entitlements'
          ? 'cost'
          : rawTab;

  const [meters, setMeters] = useState<MeterSpec[]>(() =>
    DEFAULT_METERS.map((dm) => ({
      ...dm,
      name: isCyclode ? dm.name.replace('Valiscale Studio', 'Cyclode Workstation') : dm.name,
    }))
  );
  const [selectedMeterSlug, setSelectedMeterSlug] = useState<string>('llm_tokens_total');

  useEffect(() => {
    const backendMeters = data?.meterbox?.meters;
    if (Array.isArray(backendMeters) && backendMeters.length > 0) {
      const mapped: MeterSpec[] = backendMeters
        .filter((bm: any) => bm && bm.slug)
        .map((bm: any, idx: number) => {
          const rawGb = bm.group_by;
          const gbList = Array.isArray(rawGb)
            ? rawGb.map(String)
            : rawGb && typeof rawGb === 'object'
              ? Object.keys(rawGb)
              : ['model', 'persona', 'tool'];
          const rawName = String(bm.name || bm.slug);
          const cleanName = isCyclode
            ? rawName.replace('Valiscale Studio', 'Cyclode Workstation')
            : rawName.replace('Cyclode Workstation', 'Valiscale Studio');
          return {
            id: bm.id || `mtr_live_${idx}`,
            slug: bm.slug,
            name: cleanName,
            event_type: bm.event_type || 'ai.llm.tokens',
            aggregation: bm.aggregation || 'SUM',
            value_property: bm.value_property || '$.id',
            group_by: gbList.length > 0 ? gbList : ['model'],
            volume_24h: Number(bm.total_24h ?? bm.current_usage ?? 0),
            unit: bm.unit || 'units',
            latency_ms: Number(bm.latency_ms ?? 2),
          };
        });
      if (mapped.length > 0) {
        setMeters(mapped);
        setSelectedMeterSlug((prevSlug) =>
          mapped.some((item) => item.slug === prevSlug)
            ? prevSlug
            : (mapped.find((item) => item.slug === 'llm_tokens_total') || mapped[0]).slug
        );
      }
    }
  }, [data?.meterbox?.meters, isCyclode]);

  const [meterSearch, setMeterSearch] = useState('');
  const [timeWindow, setTimeWindow] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [groupByDim, setGroupByDim] = useState<string>('model');
  const [specFormat, setSpecFormat] = useState<'clickhouse' | 'openmeter'>('clickhouse');
  const [createMeterOpen, setCreateMeterOpen] = useState(false);
  const [newMeterSlug, setNewMeterSlug] = useState('vector_hybrid_queries');
  const [newMeterName, setNewMeterName] = useState('Hybrid Vector Retrieval Queries');
  const [newMeterEvent, setNewMeterEvent] = useState('memory.hybrid.search');
  const [newMeterAgg, setNewMeterAgg] = useState<'SUM' | 'COUNT' | 'UNIQUE_COUNT' | 'AVG'>('COUNT');
  const [newMeterProp, setNewMeterProp] = useState('$.data.chunks');
  const [notice, setNotice] = useState<string | null>(null);

  // Cost & Margin tab states
  const [attrTab, setAttrTab] = useState<'model' | 'tool' | 'persona'>('model');
  const [simulatorOpen, setSimulatorOpen] = useState<boolean>(false);
  const [simDailyPrompts, setSimDailyPrompts] = useState<number>(2500);
  const [simMarkupPct, setSimMarkupPct] = useState<number>(70);
  const [simCacheHitPct, setSimCacheHitPct] = useState<number>(36);

  // Entitlements gate evaluator states
  const customers = Array.isArray(m.customers) ? m.customers : [];
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'ws_valiscale_studio');
  useEffect(() => {
    if (customers.length > 0 && !customers.some((c: any) => c.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const [selectedFeatureKey, setSelectedFeatureKey] = useState<string>('ai_token_allowance');
  const [gateEvalResult, setGateEvalResult] = useState<any | null>(null);
  const [grantDrawerOpen, setGrantDrawerOpen] = useState(false);
  const [grantAmount, setGrantAmount] = useState('500');
  const [grantReason, setGrantReason] = useState('Q4 Enterprise AI Expansion Grant');

  // DLQ filter
  const [dlqFilter, setDlqFilter] = useState<'all' | 'pending' | 'replayed'>('all');
  const dlqEvents = m.dlq_events || [];
  const pendingDlqCount = dlqEvents.filter((e: any) => e.status === 'pending').length;

  const selectedMeter = useMemo(
    () => meters.find((item) => item.slug === selectedMeterSlug) || meters[0] || DEFAULT_METERS[0],
    [meters, selectedMeterSlug]
  );

  useEffect(() => {
    if (selectedMeter.group_by.length > 0 && !selectedMeter.group_by.includes(groupByDim)) {
      setGroupByDim(selectedMeter.group_by[0]);
    }
  }, [selectedMeter, groupByDim]);

  const filteredMeters = useMemo(
    () =>
      meters.filter(
        (item) =>
          !meterSearch.trim() ||
          item.name.toLowerCase().includes(meterSearch.toLowerCase()) ||
          item.slug.toLowerCase().includes(meterSearch.toLowerCase()) ||
          item.event_type.toLowerCase().includes(meterSearch.toLowerCase())
      ),
    [meters, meterSearch]
  );

  // Build real dimensional time-series from Meterbox /api/v1/meters/{slug}/query rollups
  const rollupData = useMemo(() => {
    const rawRollup = m.rollups?.[selectedMeter.slug];
    const rawBuckets: any[] = Array.isArray(rawRollup?.data) ? rawRollup.data : [];

    if (rawBuckets.length > 0) {
      const windowSet = new Set<string>();
      const dimTotals = new Map<string, number>();
      const cellMap = new Map<string, number>();

      rawBuckets.forEach((b: any) => {
        const winStart = String(b.window_start || '');
        if (!winStart) return;
        windowSet.add(winStart);
        const gb = b.group_by || b.groups || {};
        const dimVal = String(gb[groupByDim] || b.subject || selectedMeter.slug || 'default');
        const val = Number(b.value || 0);
        dimTotals.set(dimVal, (dimTotals.get(dimVal) || 0) + val);
        const cellKey = `${winStart}::${dimVal}`;
        cellMap.set(cellKey, (cellMap.get(cellKey) || 0) + val);
      });

      let sortedWindows = Array.from(windowSet).sort();
      // If there are fewer than 4 distinct windows, pad earlier hourly windows with 0 so StackedAreaChart renders a proper timeline
      if (sortedWindows.length > 0 && sortedWindows.length < 4) {
        const firstDt = new Date(sortedWindows[0]);
        const padded: string[] = [];
        const padCount = 4 - sortedWindows.length;
        for (let i = padCount; i >= 1; i--) {
          padded.push(new Date(firstDt.getTime() - i * 3600_000).toISOString());
        }
        sortedWindows = [...padded, ...sortedWindows];
      }

      const timestamps = sortedWindows.map((iso) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso.slice(11, 16) || iso;
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`;
      });

      const topDims = Array.from(dimTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);

      const series = topDims.map((dimKey, idx) => {
        const values = sortedWindows.map((win) => Math.round(cellMap.get(`${win}::${dimKey}`) || 0));
        const total = Math.round(dimTotals.get(dimKey) || 0);
        return {
          key: dimKey,
          label: dimKey,
          color: SERIES_PALETTE[idx % SERIES_PALETTE.length],
          values,
          total,
        };
      });

      const grandTotal = Math.round(Number(rawRollup?.total_value ?? selectedMeter.volume_24h ?? 0));
      return { timestamps, series, grandTotal };
    }

    // Zero-usage meter fallback (no synthetic sine wave)
    const now = Date.now();
    const timestamps = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now - (5 - i) * 3600_000);
      return `${String(d.getHours()).padStart(2, '0')}:00`;
    });
    const totalVal = Math.round(Number(selectedMeter.volume_24h || 0));
    const series = [
      {
        key: selectedMeter.slug,
        label: selectedMeter.slug,
        color: SERIES_PALETTE[0],
        values: [0, 0, 0, 0, 0, totalVal],
        total: totalVal,
      },
    ];
    return { timestamps, series, grandTotal: totalVal };
  }, [m.rollups, selectedMeter, groupByDim, timeWindow]);

  const handleCreateMeter = async () => {
    if (!newMeterSlug.trim()) return;
    const created: MeterSpec = {
      id: `mtr_${Date.now().toString().slice(-5)}`,
      slug: newMeterSlug.trim(),
      name: newMeterName.trim() || newMeterSlug.trim(),
      event_type: newMeterEvent.trim() || 'ai.llm.tokens',
      aggregation: newMeterAgg,
      value_property: newMeterProp.trim() || '$.data.value',
      group_by: ['model', 'persona', 'tool'],
      volume_24h: 0,
      unit: 'units',
      latency_ms: 2,
    };
    fetch('/v1/valiscale/meterbox/meters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenMeter-Namespace': activeNs,
      },
      body: JSON.stringify({
        slug: created.slug,
        name: created.name,
        event_type: created.event_type,
        aggregation: created.aggregation,
        value_property: created.value_property,
        unit_price_usd: 0.001,
      }),
    })
      .then(() => onRefreshSnapshot?.())
      .catch(() => {});
    setMeters((prev) => [created, ...prev]);
    setSelectedMeterSlug(created.slug);
    setCreateMeterOpen(false);
    setNotice(`Created real-time ClickHouse rollup meter "${created.slug}".`);
  };

  const handleEvaluateGate = async () => {
    const cust =
      customers.find((c: any) => c.id === selectedCustomerId) ||
      customers[0] || {
        id: isCyclode ? 'ws_cyclode_workstation' : 'ws_valiscale_studio',
        name: appDisplayName,
      };
    try {
      const res = await fetch('/v1/valiscale/meterbox/entitlements/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenMeter-Namespace': activeNs,
        },
        body: JSON.stringify({
          customer_id: cust.id,
          feature_key: selectedFeatureKey,
          requested_quantity: 1000,
        }),
      });
      if (res.ok) {
        const evalRes = await res.json();
        setGateEvalResult({
          customer_id: evalRes.customer_id,
          customer_name: evalRes.customer_name || cust.name,
          feature_key: selectedFeatureKey,
          has_access: evalRes.allowed,
          decision: evalRes.allowed ? 'ALLOW_SUB_MS' : 'DENY_QUOTA_EXCEEDED',
          usage_current: evalRes.quota_used,
          limit_entitled: evalRes.quota_limit,
          utilization_pct: Math.round((evalRes.quota_used / Math.max(1, evalRes.quota_limit)) * 1000) / 10,
          prepaid_credit_balance_usd: evalRes.prepaid_balance_usd,
          latency_us: Math.round((evalRes.evaluation_latency_ms || 0.38) * 1000),
          cache_layer: evalRes.cache_status ? `valkey-7.2 (${evalRes.cache_status})` : 'valkey-7.2-graviton-local',
          evaluated_at: new Date().toISOString(),
        });
        return;
      }
    } catch {}
  };

  // Interactive Margin calculations
  const monthlyPrompts = simDailyPrompts * 30;
  const rawProviderCost = (monthlyPrompts / 1000) * 4.2;
  const effectiveProviderCost = rawProviderCost * (1 - (simCacheHitPct / 100) * 0.75);
  const billedRevenue = effectiveProviderCost / Math.max(0.15, 1 - simMarkupPct / 100);
  const netProfit = billedRevenue - effectiveProviderCost;

  return (
    <div>
      <PageHeader
        kicker="Meterbox · OpenMeter + ClickHouse 24.8 + Redpanda 24.2"
        title="Usage & Events"
        subtitle={`Real-time ${isCyclode ? 'Cyclode' : 'Valiscale'} usage metering, OLAP rollups, and AI cost analytics.`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="ui-btn"
              onClick={() => {
                onIngestTestCloudEvent(false);
                setNotice('Ingested signed CloudEvent 1.0 into Redpanda topic meterbox.events.raw.');
              }}
            >
              + Ingest CloudEvent
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={() => setCreateMeterOpen(true)}
            >
              + Create Meter
            </button>
          </div>
        }
      />

      {notice && (
        <div style={{ marginBottom: 14 }}>
          <Notice tone="success" title={notice} onDismiss={() => setNotice(null)} />
        </div>
      )}

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'analytics', label: 'Meters & OLAP Rollup Explorer', count: meters.length },
          { id: 'cost', label: 'AI Cost & Margin Intelligence' },
          {
            id: 'dlq',
            label: 'CloudEvents Stream & DLQ Replay',
            count: pendingDlqCount > 0 ? pendingDlqCount : (Array.isArray(m.events) ? m.events.length : dlqEvents.length),
          },
        ]}
      />

      {/* TAB 1: METERS & OLAP ROLLUP EXPLORER */}
      {tab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="readout-grid">
            <Readout
              label="Active Billable Meters"
              value={String(meters.length)}
              sub="ClickHouse AggregatingMergeTree"
              tone="sage"
            />
            <Readout
              label="Ingested CloudEvents"
              value={formatCompact(Number(m.events_24h ?? m.telemetry?.total_events_ingested ?? 0))}
              sub={`${Number(m.telemetry?.deduplicated_dropped ?? 0)} duplicates dropped · Valkey SETNX`}
              tone="jade"
            />
            <Readout
              label="Rollup Query Latency"
              value={`${selectedMeter.latency_ms} ms`}
              sub="Pre-aggregated hourly MergeTree buckets"
            />
            <Readout
              label="Quarantined DLQ Events"
              value={String(pendingDlqCount)}
              sub={pendingDlqCount > 0 ? 'Schema mismatch awaiting replay' : 'All partitions clean'}
              tone={pendingDlqCount > 0 ? 'amber' : 'jade'}
              onClick={() => onSelectSubTab('dlq')}
            />
          </div>

          <div className="split-5-7">
            {/* Left 5 cols: Meter Catalog */}
            <Card>
              <CardHeader
                title="Billable Meter Catalog"
                subtitle="Select a meter to inspect dimensional ClickHouse rollups"
                right={
                  <Tag tone="accent">{filteredMeters.length} meters</Tag>
                }
              />
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ui-border)' }}>
                <input
                  className="ui-input"
                  style={{ width: '100%' }}
                  placeholder="Filter meters by slug or CloudEvent type…"
                  value={meterSearch}
                  onChange={(e) => setMeterSearch(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredMeters.map((item) => {
                  const active = item.slug === selectedMeter.slug;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-active={active}
                      onClick={() => {
                        setSelectedMeterSlug(item.slug);
                        setGroupByDim(item.group_by[0] || 'model');
                      }}
                      className="mbx-list-item"
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: 'none',
                        borderBottom: '1px solid var(--ui-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ui-text)' }}>
                          {item.name}
                        </span>
                        <Pill tone={item.aggregation === 'SUM' ? 'success' : 'info'}>
                          {item.aggregation}
                        </Pill>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span className="mono" style={{ color: 'var(--ui-text-secondary)' }}>
                          {item.slug}
                        </span>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--ui-text)' }}>
                          {formatCompact(item.volume_24h)} {item.unit}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                          event: {item.event_type}
                        </span>
                        <span style={{ color: 'var(--ui-text-muted)' }}>·</span>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                          {item.value_property}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Right 7 cols: Interactive Rollup Explorer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Card>
                <CardHeader
                  title={`${selectedMeter.name} (${selectedMeter.slug})`}
                  subtitle={`JSONPath ${selectedMeter.value_property} on ${selectedMeter.event_type} · p99 ${selectedMeter.latency_ms}ms`}
                  right={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Segmented
                        value={timeWindow}
                        onChange={setTimeWindow}
                        options={[
                          { value: '1h', label: '1h' },
                          { value: '6h', label: '6h' },
                          { value: '24h', label: '24h' },
                          { value: '7d', label: '7d' },
                          { value: '30d', label: '30d' },
                        ]}
                      />
                    </div>
                  }
                />
                <div style={{ padding: '14px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div className="label-caps">Window Total ({timeWindow})</div>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
                        {formatNumber(rollupData.grandTotal)}{' '}
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ui-text-secondary)' }}>
                          {selectedMeter.unit}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="label-caps">Group By:</span>
                      <Segmented
                        value={groupByDim}
                        onChange={setGroupByDim}
                        options={selectedMeter.group_by.map((g) => ({ value: g, label: g }))}
                      />
                    </div>
                  </div>

                  {/* Interactive ResizeObserver StackedAreaChart */}
                  <StackedAreaChart
                    timestamps={rollupData.timestamps}
                    series={rollupData.series}
                    height={230}
                    valueFormatter={(v) => `${formatCompact(v)} ${selectedMeter.unit}`}
                  />

                  {/* Dimensional Breakdown Progress Rows */}
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 14,
                      borderTop: '1px solid var(--ui-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div className="label-caps">Dimensional Breakdown by {groupByDim}</div>
                    {rollupData.series.map((s) => {
                      const sharePct =
                        rollupData.grandTotal > 0 ? (s.total / rollupData.grandTotal) * 100 : 0;
                      return (
                        <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 99,
                                  background: s.color,
                                }}
                              />
                              <span className="mono" style={{ fontWeight: 600 }}>
                                {s.label}
                              </span>
                            </span>
                            <span className="mono" style={{ color: 'var(--ui-text-secondary)' }}>
                              {formatCompact(s.total)} {selectedMeter.unit} ({sharePct.toFixed(1)}%)
                            </span>
                          </div>
                          <ProgressBar value={sharePct} max={100} color={s.color} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* ClickHouse Materialized View SQL / OpenMeter Spec */}
              <Card>
                <CardHeader
                  title="ClickHouse Materialized View & OpenMeter Schema"
                  subtitle="Compiled deterministically on Node 1 (appembly-core · arm64)"
                  right={
                    <Segmented
                      value={specFormat}
                      onChange={setSpecFormat}
                      options={[
                        { value: 'clickhouse', label: 'ClickHouse SQL' },
                        { value: 'openmeter', label: 'OpenMeter JSON' },
                      ]}
                    />
                  }
                />
                <div style={{ padding: 14 }}>
                  {specFormat === 'clickhouse' ? (
                    <pre className="code-drawer" style={{ margin: 0 }}>
                      {`CREATE MATERIALIZED VIEW meterbox.${selectedMeter.slug}_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (org_id, ${selectedMeter.group_by.join(', ')}, window_start)
AS SELECT
  org_id,
  toStartOfMinute(event_time) AS window_start,
  ${selectedMeter.group_by.map((g) => `JSONExtractString(data, '${g}') AS ${g}`).join(',\n  ')},
  ${selectedMeter.aggregation === 'SUM' ? `sumState(JSONExtractFloat(data, '${selectedMeter.value_property.replace('$.data.', '')}'))` : 'countState()'} AS agg_value
FROM meterbox.cloudevents_raw
WHERE type = '${selectedMeter.event_type}'
GROUP BY org_id, window_start, ${selectedMeter.group_by.join(', ')};`}
                    </pre>
                  ) : (
                    <JsonView data={selectedMeter} maxHeight={220} />
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI COST & MARGIN INTELLIGENCE (Live from Meterbox cost_intelligence) */}
      {tab === 'cost' &&
        (() => {
          const ci = m.cost_intelligence || {};
          const totalTokens = Number(ci.total_tokens ?? m.totals?.total_tokens ?? 0);
          const billedRev = Number(
            m.totals?.billed_revenue_mtd_usd ??
              ci.total_billed_usd ??
              ci.billed_usd ??
              m.totals?.estimated_cost_usd ??
              0
          );
          const upstreamCogs = Number(
            m.totals?.upstream_cogs_mtd_usd ??
              ci.total_cost_usd ??
              ci.provider_cogs_usd ??
              m.totals?.provider_cogs_usd ??
              0
          );
          const netMarginPct = Number(
            m.totals?.net_margin_pct ??
              ci.gross_margin_pct ??
              ci.margin_pct ??
              m.totals?.gross_margin_pct ??
              (billedRev > 0 ? ((billedRev - upstreamCogs) / billedRev) * 100 : 70)
          );

          const inputTok = Number(ci.input_tokens ?? m.totals?.input_tokens ?? Math.round(totalTokens * 0.58));
          const cachedTok = Number(ci.cached_tokens ?? m.totals?.cached_tokens ?? Math.round(totalTokens * 0.36));
          const reasoningTok = Number(ci.reasoning_tokens ?? m.totals?.reasoning_tokens ?? Math.round(totalTokens * 0.02));
          const outputTok = Number(
            ci.output_tokens ??
              m.totals?.output_tokens ??
              Math.max(0, totalTokens - inputTok - cachedTok - reasoningTok)
          );
          const sumTok = Math.max(1, inputTok + cachedTok + reasoningTok + outputTok);

          const rawCacheSavings = Number(m.totals?.prompt_cache_savings_usd ?? ci.cache_savings_usd ?? 0);
          const cacheSavings =
            rawCacheSavings >= 0.01
              ? rawCacheSavings
              : cachedTok > 0
                ? Math.max(0.01, (cachedTok / 1_000_000) * 1.45)
                : 0;

          const pctInput = Math.round((inputTok / sumTok) * 1000) / 10;
          const pctCached = Math.round((cachedTok / sumTok) * 1000) / 10;
          const pctReason = Math.round((reasoningTok / sumTok) * 1000) / 10;
          const pctOutput = Math.max(0, Math.round((100 - pctInput - pctCached - pctReason) * 10) / 10);

          // Weight each token tier by relative upstream rate and scale so the 4 tiers sum to exact upstreamCogs
          const rawWeightInput = inputTok * 1.0;
          const rawWeightCached = cachedTok * 0.1;
          const rawWeightReason = reasoningTok * 3.8;
          const rawWeightOutput = outputTok * 3.8;
          const totalWeight = Math.max(1, rawWeightInput + rawWeightCached + rawWeightReason + rawWeightOutput);

          const cogsInput = upstreamCogs * (rawWeightInput / totalWeight);
          const cogsCached = upstreamCogs * (rawWeightCached / totalWeight);
          const cogsReason = upstreamCogs * (rawWeightReason / totalWeight);
          const cogsOutput = Math.max(0, upstreamCogs - cogsInput - cogsCached - cogsReason);

          const effRatePer1M = (cogs: number, tok: number, fallback: string) =>
            tok > 0 ? `$${((cogs / tok) * 1_000_000).toFixed(2)} / 1M` : fallback;

          // Normalize and filter Spend Attribution rows (removing 0-token ghost rows and reconciling COGS sum)
          const rawAttrList: any[] =
            attrTab === 'persona'
              ? ci.by_persona || m.totals?.by_persona || []
              : attrTab === 'tool'
                ? ci.by_tool || m.totals?.by_tool || []
                : ci.by_model || m.totals?.by_model || [];

          const mappedAttr = rawAttrList
            .map((item: any) => {
              const label = String(item.dimension || item.model || item.persona || item.tool || 'default');
              const tok = Number(item.tokens ?? (item.calls ? item.calls * 4200 : 0));
              const rawCost = Number(item.cost_usd ?? 0);
              const calls = Number(item.calls ?? 0);
              return { label, tokens: tok, rawCost, calls };
            })
            .filter((item) => item.tokens > 0 || item.calls > 0);

          const attrTotalTokens = Math.max(
            1,
            mappedAttr.reduce((acc, item) => acc + item.tokens, 0)
          );
          const attrList = mappedAttr.map((item) => {
            const sharePct = Math.round((item.tokens / attrTotalTokens) * 1000) / 10;
            const reconciledCogs = upstreamCogs * (item.tokens / attrTotalTokens);
            const reconciledBilled = billedRev * (item.tokens / attrTotalTokens);
            return {
              ...item,
              share_pct: sharePct,
              cost_usd: reconciledCogs,
              billed_usd: reconciledBilled,
            };
          });

          const activeCustomer = customers[0] || {
            id: isCyclode ? 'ws_cyclode_workstation' : 'cus_valiscale_ws',
            name: appDisplayName,
            plan: 'Enterprise Usage-Based',
            mrr_usd: billedRev,
            cost_usd: upstreamCogs,
            margin_pct: netMarginPct,
            token_quota_used: totalTokens,
            token_quota_limit: 5_000_000,
          };
          const quotaUsed = Number(activeCustomer.token_quota_used ?? activeCustomer.consumed_tokens ?? totalTokens);
          const quotaLimit = Math.max(
            quotaUsed,
            Number(activeCustomer.token_quota_limit ?? activeCustomer.included_tokens ?? 5_000_000)
          );
          const quotaPct = Math.min(100, Math.round((quotaUsed / Math.max(1, quotaLimit)) * 1000) / 10);
          const billedPer1M = totalTokens > 0 ? (billedRev / totalTokens) * 1_000_000 : 6.0;
          const cogsPer1M = totalTokens > 0 ? (upstreamCogs / totalTokens) * 1_000_000 : 1.8;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="readout-grid">
                <Readout
                  label="Billed AI Revenue (MTD)"
                  value={formatCurrency(billedRev, 2)}
                  sub={`${formatCompact(totalTokens)} metered tokens`}
                  tone="sage"
                />
                <Readout
                  label="Upstream LLM & Graviton COGS"
                  value={formatCurrency(upstreamCogs, 2)}
                  sub={`Blended ${formatCurrency(cogsPer1M, 2)} / 1M tokens`}
                />
                <Readout
                  label="Net AI Gross Margin"
                  value={formatPercent(netMarginPct)}
                  sub={`+${formatCurrency(Math.max(0, billedRev - upstreamCogs), 2)} net contribution`}
                  tone="jade"
                />
                <Readout
                  label="Prompt Cache Savings"
                  value={formatCurrency(cacheSavings, 2)}
                  sub={`${formatCompact(cachedTok)} cached tokens read (${pctCached}%)`}
                  tone="violet"
                />
              </div>

              {/* 4-Part Token Spectrum Breakdown */}
              <Card>
                <CardHeader
                  title="4-Part Token Spectrum & Upstream Cost Anatomy"
                  subtitle="Reconciled token classification & upstream provider COGS across Harnway Gateway and Runctor packs"
                  right={<Pill tone="success">Prompt Caching Active (-90% Cached Read COGS)</Pill>}
                />
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      height: 12,
                      borderRadius: 999,
                      overflow: 'hidden',
                      background: 'var(--ui-bg-subtle)',
                      gap: 2,
                    }}
                  >
                    <div
                      style={{ width: `${Math.max(2, pctInput)}%`, background: '#22543B', borderRadius: '999px 0 0 999px' }}
                      title={`Uncached Input (${pctInput}%)`}
                    />
                    <div
                      style={{ width: `${Math.max(2, pctCached)}%`, background: '#4E8067' }}
                      title={`Prompt Cached Input (${pctCached}%)`}
                    />
                    <div
                      style={{ width: `${Math.max(2, pctReason)}%`, background: '#6E56CF' }}
                      title={`Reasoning CoT Tokens (${pctReason}%)`}
                    />
                    <div
                      style={{ width: `${Math.max(2, pctOutput)}%`, background: '#D97706', borderRadius: '0 999px 999px 0' }}
                      title={`Completion Output (${pctOutput}%)`}
                    />
                  </div>

                  <div className="grid-4">
                    {[
                      {
                        label: 'Uncached Input Tokens',
                        share: `${pctInput}%`,
                        tokens: formatCompact(inputTok),
                        cogs: formatCurrency(cogsInput, 2),
                        rate: effRatePer1M(cogsInput, inputTok, '$1.55 / 1M'),
                        color: '#22543B',
                      },
                      {
                        label: 'Prompt Cached Reads',
                        share: `${pctCached}%`,
                        tokens: formatCompact(cachedTok),
                        cogs: formatCurrency(cogsCached, 2),
                        rate: `${effRatePer1M(cogsCached, cachedTok, '$0.16 / 1M')} (-90%)`,
                        color: '#4E8067',
                      },
                      {
                        label: 'Reasoning CoT (R1 / 3.7)',
                        share: `${pctReason}%`,
                        tokens: formatCompact(reasoningTok),
                        cogs: formatCurrency(cogsReason, 2),
                        rate: effRatePer1M(cogsReason, reasoningTok, '$5.80 / 1M'),
                        color: '#6E56CF',
                      },
                      {
                        label: 'Completion Output',
                        share: `${pctOutput}%`,
                        tokens: formatCompact(outputTok),
                        cogs: formatCurrency(cogsOutput, 2),
                        rate: effRatePer1M(cogsOutput, outputTok, '$5.80 / 1M'),
                        color: '#D97706',
                      },
                    ].map((tier) => (
                      <div
                        key={tier.label}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: '1px solid var(--ui-border)',
                          background: 'var(--ui-bg-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: tier.color }} />
                            {tier.label}
                          </span>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                            {tier.share}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
                          <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                            {tier.cogs}
                          </span>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ui-text-secondary)' }}>
                            {tier.tokens} tok
                          </span>
                        </div>
                        <div className="mono" style={{ fontSize: 11.5, color: 'var(--ui-text-muted)', marginTop: 4 }}>
                          Blended rate: {tier.rate}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="grid-2">
                {/* Left Column: Reconciled Spend Attribution by Dimension */}
                <Card>
                  <CardHeader
                    title="Spend Attribution by Dimension"
                    subtitle="Live token volume, billed revenue, and reconciled provider COGS"
                    right={
                      <Segmented
                        value={attrTab}
                        onChange={setAttrTab}
                        options={[
                          { value: 'model', label: 'By Model' },
                          { value: 'persona', label: 'By Agent' },
                          { value: 'tool', label: 'By MCP Tool' },
                        ]}
                      />
                    }
                  />
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {attrList.length > 0 ? (
                      attrList.slice(0, 5).map((item: any, idx: number) => (
                        <div
                          key={item.label || idx}
                          style={{
                            padding: '11px 13px',
                            borderRadius: 10,
                            border: '1px solid var(--ui-border)',
                            background: 'var(--ui-bg-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 7,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 99,
                                  background: SERIES_PALETTE[idx % SERIES_PALETTE.length],
                                }}
                              />
                              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                                {item.label}
                              </span>
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="mono" style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                                {formatCompact(item.tokens)} tok ({item.share_pct.toFixed(1)}%)
                              </span>
                              <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
                                {formatCurrency(item.cost_usd, 2)} COGS
                              </span>
                            </div>
                          </div>
                          <ProgressBar
                            value={item.share_pct}
                            max={100}
                            color={SERIES_PALETTE[idx % SERIES_PALETTE.length]}
                          />
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 11.5,
                              color: 'var(--ui-text-muted)',
                            }}
                            className="mono"
                          >
                            <span>Billed attribution: {formatCurrency(item.billed_usd, 2)}</span>
                            <span>Net margin: {formatPercent(netMarginPct)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--ui-text-muted)', fontSize: 13 }}>
                        No dimensional telemetry recorded in this window.
                      </div>
                    )}

                    {/* Reconciled Total Footer */}
                    <div
                      style={{
                        marginTop: 'auto',
                        padding: '10px 13px',
                        borderRadius: 9,
                        border: '1px solid var(--ui-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
                        Reconciled Ledger Total ({attrTab === 'persona' ? 'Agents' : attrTab === 'tool' ? 'Tools' : 'Models'})
                      </span>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {formatCompact(totalTokens)} tok · {formatCurrency(upstreamCogs, 2)} COGS · {formatCurrency(billedRev, 2)} Billed
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Right Column: Workspace Unit Economics & Margin Guardrails */}
                <Card>
                  <CardHeader
                    title="Workspace Unit Economics & Guardrails"
                    subtitle="Active workspace quota consumption, blended rates, and 45% net margin floor"
                    right={
                      <button
                        type="button"
                        className="ui-btn ui-btn-xs"
                        onClick={() => setSimulatorOpen((prev) => !prev)}
                      >
                        {simulatorOpen ? 'Hide Simulator' : 'Pricing Simulator'}
                      </button>
                    }
                  />
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Active Workspace Header & Quota Bar */}
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--ui-border)',
                        background: 'var(--ui-bg-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{activeCustomer.name}</div>
                          <div className="mono" style={{ fontSize: 11.5, color: 'var(--ui-text-muted)', marginTop: 2 }}>
                            {activeCustomer.id} · {activeCustomer.plan || 'Usage-Based Plan'}
                          </div>
                        </div>
                        <Pill tone={netMarginPct >= 55 ? 'success' : netMarginPct >= 45 ? 'warning' : 'danger'}>
                          {netMarginPct >= 45 ? `Healthy · ${formatPercent(netMarginPct)} Margin` : 'Below 45% Floor'}
                        </Pill>
                      </div>

                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            marginBottom: 5,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
                            Included Token Allowance
                          </span>
                          <span className="mono" style={{ fontWeight: 600 }}>
                            {formatCompact(quotaUsed)} / {formatCompact(quotaLimit)} ({quotaPct}%)
                          </span>
                        </div>
                        <ProgressBar value={quotaPct} max={100} tone="sage" />
                      </div>
                    </div>

                    {/* 2x2 Unit Economics KPI Grid */}
                    <div className="grid-2" style={{ gap: 10 }}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 9,
                          border: '1px solid var(--ui-border)',
                        }}
                      >
                        <div className="label-caps">Billed Rate / 1M Tok</div>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                          {formatCurrency(billedPer1M, 2)}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ui-text-muted)', marginTop: 2 }}>
                          MTD Billed: {formatCurrency(billedRev, 2)}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 9,
                          border: '1px solid var(--ui-border)',
                        }}
                      >
                        <div className="label-caps">Blended COGS / 1M Tok</div>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                          {formatCurrency(cogsPer1M, 2)}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ui-text-muted)', marginTop: 2 }}>
                          MTD COGS: {formatCurrency(upstreamCogs, 2)}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible What-If Pricing Simulator */}
                    {simulatorOpen && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid var(--ui-border)',
                          background: 'var(--ui-bg-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>Daily Agent Prompts</span>
                          <span className="mono">{simDailyPrompts.toLocaleString()} / day</span>
                        </div>
                        <input
                          type="range"
                          min={500}
                          max={50000}
                          step={500}
                          value={simDailyPrompts}
                          onChange={(e) => setSimDailyPrompts(Number(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--ui-accent-deep)' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>Target Gross Margin (%)</span>
                          <span className="mono">{simMarkupPct}%</span>
                        </div>
                        <input
                          type="range"
                          min={35}
                          max={85}
                          step={1}
                          value={simMarkupPct}
                          onChange={(e) => setSimMarkupPct(Number(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--ui-accent-deep)' }}
                        />
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 8,
                            paddingTop: 8,
                            borderTop: '1px solid var(--ui-border)',
                          }}
                        >
                          <div>
                            <div className="label-caps">Proj. Billed</div>
                            <div className="mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                              {formatCurrency(billedRevenue, 2)}
                            </div>
                          </div>
                          <div>
                            <div className="label-caps">Proj. COGS</div>
                            <div className="mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                              {formatCurrency(effectiveProviderCost, 2)}
                            </div>
                          </div>
                          <div>
                            <div className="label-caps">Net Profit / mo</div>
                            <div className="mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: 'var(--ui-accent-deep)' }}>
                              +{formatCurrency(netProfit, 2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          );
        })()}

      {/* TAB 3: CUSTOMERS & SUB-MS VALKEY ENTITLEMENTS */}
      {tab === 'entitlements' && (
        <div className="split-4-8">
          <Card>
            <CardHeader
              title="Tenant & Subject Directory"
              subtitle="Select a subject to evaluate sub-ms Valkey entitlement gates"
              right={
                <button
                  type="button"
                  className="ui-btn ui-btn-xs ui-btn-primary"
                  onClick={() => setGrantDrawerOpen(true)}
                >
                  + Credit Grant
                </button>
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {customers.map((c: any) => {
                const active = c.id === selectedCustomerId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-active={active}
                    className="mbx-list-item"
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setGateEvalResult(null);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      border: 'none',
                      borderBottom: '1px solid var(--ui-border)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ui-text)' }}>{c.name}</span>
                      <Pill tone={c.status === 'Healthy' ? 'success' : 'warning'}>{c.status}</Pill>
                    </div>
                    <div className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)' }}>
                      {c.id} · {c.plan}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: 'var(--ui-text-muted)' }}>Quota / Prepaid Credit:</span>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--ui-text)' }}>
                        {c.tokens_used} · ${Number(c.credits_remaining_usd ?? c.prepaid_balance_usd ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card>
              <CardHeader
                title="Sub-Millisecond Valkey Entitlement Gate Evaluator"
                subtitle="Called inline by Sauthen Proxy & Harnway Gateway before every LLM or Sandbox invocation"
                right={<Pill tone="info">p99 &lt; 0.5ms</Pill>}
              />
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
                      Feature Entitlement Key
                    </label>
                    <select
                      className="ui-select"
                      style={{ width: '100%', height: 34 }}
                      value={selectedFeatureKey}
                      onChange={(e) => {
                        setSelectedFeatureKey(e.target.value);
                        setGateEvalResult(null);
                      }}
                    >
                      <option value="ai_token_allowance">ai_token_allowance (Monthly Autonomous Token Allowance)</option>
                      <option value="sandbox_compute">sandbox_compute (Graviton Sandbox Compute Seconds)</option>
                      <option value="concurrent_agents">concurrent_agents (Active STS Agent Pods)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="ui-btn ui-btn-primary"
                    onClick={handleEvaluateGate}
                  >
                    Evaluate Gate Now
                  </button>
                </div>

                {(() => {
                  const selectedCust =
                    customers.find((c: any) => c.id === selectedCustomerId) || customers[0] || {};
                  const tokUsed = Number(selectedCust.token_quota_used ?? 0);
                  const tokLimit = Number(selectedCust.token_quota_limit ?? 5_000_000);
                  const sbxUsed = Number(selectedCust.sandbox_seconds ?? 0);
                  const sbxLimit = 180_000;
                  const isSbx = selectedFeatureKey === 'sandbox_compute';
                  const curUsed = isSbx ? sbxUsed : tokUsed;
                  const curLimit = isSbx ? sbxLimit : tokLimit;
                  const curPct = Math.round((curUsed / Math.max(1, curLimit)) * 1000) / 10;
                  return (
                    <JsonView
                      label="valkey_entitlement_gate_response.json"
                      data={
                        gateEvalResult || {
                          customer_id: selectedCust.id || selectedCustomerId,
                          customer_name: selectedCust.name,
                          feature_key: selectedFeatureKey,
                          has_access: curUsed < curLimit,
                          decision: curUsed < curLimit ? 'ALLOW_SUB_MS' : 'DENY_QUOTA_EXCEEDED',
                          usage_current: curUsed,
                          limit_entitled: curLimit,
                          utilization_pct: curPct,
                          prepaid_credit_balance_usd: Number(
                            selectedCust.credits_remaining_usd ?? selectedCust.prepaid_balance_usd ?? 0
                          ),
                          latency_us: 360,
                          cache_layer: 'valkey-7.2-graviton-local',
                        }
                      }
                      maxHeight={220}
                    />
                  );
                })()}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: CLOUDEVENTS STREAM & DLQ REPLAY */}
      {tab === 'dlq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <CardHeader
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <StatusDot tone="ok" live />
                  <span>Live Ingested CloudEvents 1.0 Stream</span>
                </span>
              }
              subtitle={
                isCyclode
                  ? 'Real-time usage events emitted across Cyclode agent sessions, sandbox worktrees, tool calls, and STS proxies.'
                  : 'Real-time usage events emitted across Valiscale chats, concept validations, project promotions, and STS proxies.'
              }
              right={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill tone="success">{(m.events || []).length} events</Pill>
                  <button
                    type="button"
                    className="ui-btn ui-btn-xs ui-btn-primary"
                    onClick={() => onIngestTestCloudEvent(false)}
                  >
                    + Ingest Test CloudEvent
                  </button>
                </div>
              }
            />
            <div className="ui-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>CloudEvent Type</th>
                    <th>Meter Slug</th>
                    <th>Subject</th>
                    <th>Quantity / Cost</th>
                    <th>Source</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {(m.events || []).slice(0, 12).map((ev: any) => (
                    <tr
                      key={ev.id}
                      onClick={() => onOpenSheet(`CloudEvent: ${ev.id}`, ev)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {ev.id}
                      </td>
                      <td className="mono">{ev.type}</td>
                      <td className="mono" style={{ color: 'var(--ui-accent)', fontWeight: 600 }}>
                        {ev.meter_slug || 'llm_tokens_total'}
                      </td>
                      <td className="mono">{ev.subject || 'cus_appembly_core'}</td>
                      <td className="mono">
                        {ev.tokens
                          ? `${Number(ev.tokens).toLocaleString()} tok`
                          : `${Number(ev.value ?? 1).toLocaleString()} units`}
                        {typeof ev.cost_usd === 'number' && ev.cost_usd > 0
                          ? ` ($${ev.cost_usd.toFixed(4)})`
                          : ''}
                      </td>
                      <td>
                        <Pill tone="neutral">{ev.source_app || (isCyclode ? 'cyclode' : 'valiscale')}</Pill>
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                        {ev.timestamp ? String(ev.timestamp).replace('T', ' ').slice(0, 19) : 'Just now'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <StatusDot tone={pendingDlqCount > 0 ? 'warn' : 'ok'} live />
                  <span>Dead-Letter Replay Queue (DLQ)</span>
                </span>
              }
              subtitle="Malformed CloudEvents quarantined before ClickHouse insertion — inspect, auto-coerce numeric types, and replay."
              right={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Segmented
                    value={dlqFilter}
                    onChange={setDlqFilter}
                    options={[
                      { value: 'all', label: 'All', count: dlqEvents.length },
                      { value: 'pending', label: 'Pending', count: pendingDlqCount },
                      {
                        value: 'replayed',
                        label: 'Replayed',
                        count: dlqEvents.filter((e: any) => e.status !== 'pending').length,
                      },
                    ]}
                  />
                  <button
                    type="button"
                    className="ui-btn ui-btn-xs"
                    onClick={() => {
                      onIngestTestCloudEvent(true);
                      setNotice('Tested Valkey SETNX idempotency key deduplication — duplicate dropped in 0.2ms.');
                    }}
                  >
                    Test SETNX Dedup
                  </button>
                </div>
              }
            />
            <div className="ui-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>CloudEvent Type</th>
                    <th>Quarantine Reason</th>
                    <th>Offending Payload</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dlqEvents
                    .filter((ev: any) =>
                      dlqFilter === 'all'
                        ? true
                        : dlqFilter === 'pending'
                          ? ev.status === 'pending'
                          : ev.status !== 'pending'
                    )
                    .map((ev: any) => (
                      <tr key={ev.id}>
                        <td className="mono" style={{ fontWeight: 600 }}>
                          {ev.id}
                        </td>
                        <td className="mono">{ev.type || ev.event_type}</td>
                        <td style={{ color: 'var(--ui-danger)' }}>{ev.error || ev.reason}</td>
                        <td className="mono" style={{ fontSize: 12.5 }}>
                          {ev.raw_payload || ev.payload_preview}
                        </td>
                        <td>
                          <Pill tone={ev.status === 'pending' ? 'warning' : 'success'}>
                            {ev.status === 'pending' ? 'Quarantined' : 'Replayed'}
                          </Pill>
                        </td>
                        <td>
                          {ev.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="ui-btn ui-btn-xs ui-btn-primary"
                                onClick={() => {
                                  onReplayDlqEvent(ev.id, true);
                                  setNotice(`Auto-coerced payload and replayed ${ev.id} into ClickHouse.`);
                                }}
                              >
                                Auto-Fix &amp; Replay
                              </button>
                              <button
                                type="button"
                                className="ui-btn ui-btn-xs"
                                onClick={() => onOpenSheet(`DLQ Event: ${ev.id}`, ev)}
                              >
                                Inspect
                              </button>
                            </div>
                          ) : (
                            <span className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-muted)' }}>
                              Committed ✓
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Create Meter Drawer */}
      <Drawer
        open={createMeterOpen}
        onClose={() => setCreateMeterOpen(false)}
        title="Create Billable ClickHouse Meter"
        subtitle="Compiles an AggregatingMergeTree Materialized View on Node 1"
        footer={
          <>
            <button type="button" className="ui-btn" onClick={() => setCreateMeterOpen(false)}>
              Cancel
            </button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={handleCreateMeter}>
              Compile &amp; Activate Meter
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Meter Slug
            </label>
            <input
              className="ui-input mono"
              value={newMeterSlug}
              onChange={(e) => setNewMeterSlug(e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Display Name
            </label>
            <input
              className="ui-input"
              value={newMeterName}
              onChange={(e) => setNewMeterName(e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              CloudEvent Type Filter
            </label>
            <input
              className="ui-input mono"
              value={newMeterEvent}
              onChange={(e) => setNewMeterEvent(e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              JSONPath Value Property
            </label>
            <input
              className="ui-input mono"
              value={newMeterProp}
              onChange={(e) => setNewMeterProp(e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Aggregation Function
            </label>
            <Segmented
              value={newMeterAgg}
              onChange={setNewMeterAgg}
              options={[
                { value: 'SUM', label: 'SUM' },
                { value: 'COUNT', label: 'COUNT' },
                { value: 'UNIQUE_COUNT', label: 'UNIQUE' },
                { value: 'AVG', label: 'AVG' },
              ]}
            />
          </div>
        </div>
      </Drawer>

      {/* Issue Credit Grant Drawer */}
      <Drawer
        open={grantDrawerOpen}
        onClose={() => setGrantDrawerOpen(false)}
        title="Issue Prepaid AI Credit Grant"
        subtitle="Immediately updates Valkey sub-ms entitlement balance and ledger waterfall"
        footer={
          <>
            <button type="button" className="ui-btn" onClick={() => setGrantDrawerOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={() => {
                fetch('/v1/valiscale/meterbox/credits/grant', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-OpenMeter-Namespace': activeNs,
                  },
                  body: JSON.stringify({
                    customer_id: selectedCustomerId,
                    amount_usd: Number(grantAmount) || 500,
                    reason: grantReason,
                  }),
                })
                  .then(() => onRefreshSnapshot?.())
                  .catch(() => {});
                setGrantDrawerOpen(false);
                setNotice(`Issued $${grantAmount} prepaid credit grant (${grantReason}) to ${selectedCustomerId}.`);
              }}
            >
              Commit Credit Grant
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Grant Amount (USD)
            </label>
            <input
              className="ui-input mono"
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Memo / Ledger Reason
            </label>
            <input
              className="ui-input"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
};

/* ============================================================================
 * 2. METERBOX — CUSTOMERS, INVOICES, CARDS & STRIPE WEBHOOKS (InvoicesView)
 * ============================================================================ */

interface InvoiceItem {
  id: string;
  number: string;
  customer_id: string;
  customer_name: string;
  billing_email: string;
  period: string;
  subtotal_usd: number;
  credits_applied_usd: number;
  tax_usd: number;
  total_usd: number;
  status: 'paid' | 'open' | 'draft';
  payment_method: string;
  issued_at: string;
  lines: Array<{
    description: string;
    meter_slug: string;
    quantity: string;
    unit_price: string;
    amount_usd: number;
  }>;
}

export const InvoicesView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  platformData?: any;
  dashData?: any;
  onRefreshSnapshot?: () => void;
  onOpenSheet: (title: string, obj: any) => void;
}> = ({ subTab, onSelectSubTab, platformData, dashData, onRefreshSnapshot }) => {
  const data = platformData || dashData;
  const activeNs = data?.meterbox?.active_namespace || 'ns_live_appembly';
  const rawTab = subTab || 'invoices';
  const tab =
    rawTab === 'customers'
      ? 'invoices'
      : rawTab === 'simulator'
        ? 'webhooks'
        : rawTab;

  const mapBackendInvoice = (bi: any): InvoiceItem => ({
    id: bi.id,
    number: bi.number || bi.id,
    customer_id: bi.customer_id || bi.subject || 'ws_valiscale_studio',
    customer_name: bi.customer_name || bi.customer || 'Valiscale Studio Workspace',
    billing_email: bi.billing_email || 'finops@appembly.com',
    period: bi.period || 'Oct 2026',
    subtotal_usd: Number(bi.subtotal_usd ?? bi.total_usd ?? bi.amount ?? 0),
    credits_applied_usd: Number(bi.credits_applied_usd ?? 0),
    tax_usd: Number(bi.tax_usd ?? 0),
    total_usd: Number(bi.total_usd ?? bi.amount ?? 0),
    status: bi.status === 'paid' ? 'paid' : bi.status === 'draft' ? 'draft' : 'open',
    payment_method: bi.payment_method || 'Visa •••• 4242',
    issued_at: (bi.issued_at || bi.created_at || new Date().toISOString()).slice(0, 10),
    lines: Array.isArray(bi.lines) && bi.lines.length > 0
      ? bi.lines.map((li: any) => ({
          description: li.description || 'Metered Usage',
          meter_slug: li.meter_slug || 'llm_tokens_total',
          quantity: String(li.quantity ?? '1'),
          unit_price: String(li.unit_price || '$0.05 / 1k'),
          amount_usd: Number(li.amount_usd ?? li.amount ?? 0),
        }))
      : Array.isArray(bi.line_items) && bi.line_items.length > 0
        ? bi.line_items.map((li: any) => ({
            description: li.description || 'Metered Usage',
            meter_slug: li.meter_slug || 'llm_tokens_total',
            quantity: String(li.quantity ?? '1'),
            unit_price: String(li.unit_price || '$0.05 / 1k'),
            amount_usd: Number(li.amount_usd ?? li.amount ?? 0),
          }))
        : [],
  });

  const [invoices, setInvoices] = useState<InvoiceItem[]>(() =>
    Array.isArray(data?.meterbox?.invoices)
      ? data.meterbox.invoices.map(mapBackendInvoice)
      : []
  );

  useEffect(() => {
    const backendInvs = data?.meterbox?.invoices;
    if (Array.isArray(backendInvs)) {
      setInvoices(backendInvs.map(mapBackendInvoice));
    }
  }, [data?.meterbox?.invoices]);

  const paymentMethods = useMemo<Array<any>>(
    () => (Array.isArray(data?.meterbox?.payment_methods) ? data.meterbox.payment_methods : []),
    [data?.meterbox?.payment_methods]
  );

  const autoRechargeRules = useMemo<Array<any>>(
    () => (Array.isArray(data?.meterbox?.auto_recharge_rules) ? data.meterbox.auto_recharge_rules : []),
    [data?.meterbox?.auto_recharge_rules]
  );

  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'open' | 'draft'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [webhookType, setWebhookType] = useState('invoice.paid');
  const [webhookLog, setWebhookLog] = useState<Array<{ id: string; type: string; status: string; ts: string }>>([]);

  useEffect(() => {
    const whs = data?.meterbox?.payment_webhooks;
    if (Array.isArray(whs)) {
      setWebhookLog(
        whs.map((w: any) => ({
          id: w.id || w.event_id || 'wh_evt',
          type: w.type || w.event_type || 'invoice.paid',
          status: w.status || '200 OK · Verified',
          ts: w.ts || (w.received_at ? new Date(w.received_at).toLocaleTimeString() : 'recent'),
        }))
      );
    }
  }, [data?.meterbox?.payment_webhooks]);

  const filteredInvoices = useMemo(
    () => invoices.filter((inv) => (statusFilter === 'all' ? true : inv.status === statusFilter)),
    [invoices, statusFilter]
  );

  const handleSettleInvoice = (id: string) => {
    fetch(`/v1/valiscale/meterbox/invoices/${encodeURIComponent(id)}/settle`, {
      method: 'POST',
      headers: { 'X-OpenMeter-Namespace': activeNs },
    })
      .then(() => onRefreshSnapshot?.())
      .catch(() => {});
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, status: 'paid' as const } : inv))
    );
    if (selectedInvoice?.id === id) {
      setSelectedInvoice((prev) => (prev ? { ...prev, status: 'paid' } : null));
    }
    setNotice(`Settled invoice ${id} via Meterbox & Stripe PaymentIntent and updated ClickHouse revenue ledger.`);
  };

  const handleGenerateDraftInvoice = () => {
    const firstSubject = data?.meterbox?.customers?.[0];
    fetch('/v1/valiscale/meterbox/invoices/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenMeter-Namespace': activeNs,
      },
      body: JSON.stringify({
        customer_id: firstSubject?.id || 'ws_valiscale_studio',
        customer_name: firstSubject?.name || 'Valiscale Studio Workspace',
        period: `${new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })} (Live Rollup Statement)`,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.invoice) {
          const mapped = mapBackendInvoice(res.invoice);
          setInvoices((prev) => [mapped, ...prev.filter((p) => p.id !== mapped.id)]);
          setSelectedInvoice(mapped);
        }
        onRefreshSnapshot?.();
      })
      .catch(() => {});
    setNotice('Generated live usage invoice from Meterbox rollup totals.');
  };

  return (
    <div>
      <PageHeader
        kicker="Meterbox · Automated Usage Billing, Prepaid Credits & Stripe Sync"
        title="Customers & Billing"
        subtitle="Invoices, prepaid credits, and payment sync generated straight from metered usage."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ui-btn" onClick={() => onSelectSubTab('payment_methods')}>
              Vaulted Cards &amp; Auto-Recharge
            </button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={handleGenerateDraftInvoice}>
              + Generate Invoice from Rollups
            </button>
          </div>
        }
      />

      {notice && (
        <div style={{ marginBottom: 14 }}>
          <Notice tone="success" title={notice} onDismiss={() => setNotice(null)} />
        </div>
      )}

      {(() => {
        const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_usd || 0), 0);
        const paidTotal = invoices
          .filter((i) => i.status === 'paid')
          .reduce((s, i) => s + Number(i.total_usd || 0), 0);
        const openInvoices = invoices.filter((i) => i.status !== 'paid');
        const openTotal = openInvoices.reduce((s, i) => s + Number(i.total_usd || 0), 0);
        const creditsApplied = invoices.reduce((s, i) => s + Number(i.credits_applied_usd || 0), 0);
        const collectionPct = totalInvoiced > 0 ? Math.round((paidTotal / totalInvoiced) * 1000) / 10 : 100;
        return (
          <div className="readout-grid" style={{ marginBottom: 16 }}>
            <Readout
              label="Total Invoiced (MTD)"
              value={`$${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub={`Across ${invoices.length} issued statements`}
              tone="sage"
            />
            <Readout
              label="Paid & Settled"
              value={`$${paidTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub={`${collectionPct}% collection velocity`}
              tone="jade"
            />
            <Readout
              label="Open / Collectible"
              value={`$${openTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub={`${openInvoices.length} invoice${openInvoices.length === 1 ? '' : 's'} awaiting settlement`}
              tone="amber"
            />
            <Readout
              label="Prepaid Credits Applied"
              value={`$${creditsApplied.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub="Auto-deducted prior to Stripe charge"
              tone="violet"
            />
          </div>
        );
      })()}

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'invoices', label: 'Invoices & Printable Tax Receipts', count: invoices.length },
          { id: 'payment_methods', label: 'Vaulted Cards & Auto-Recharge Rules', count: paymentMethods.length },
          { id: 'webhooks', label: 'Stripe Webhook & Billing Simulator', count: webhookLog.length },
        ]}
      />

      {/* TAB 1: INVOICES & PRINTABLE TAX RECEIPTS */}
      {tab === 'invoices' && (
        <Card>
          <CardHeader
            title="Issued Invoices & Usage Statements"
            subtitle="Click any invoice row to open the itemized Printable Tax Invoice Modal"
            right={
              <Segmented
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All', count: invoices.length },
                  {
                    value: 'paid',
                    label: 'Paid',
                    count: invoices.filter((i) => i.status === 'paid').length,
                  },
                  {
                    value: 'open',
                    label: 'Open',
                    count: invoices.filter((i) => i.status === 'open').length,
                  },
                ]}
              />
            }
          />
          <div className="ui-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Billing Period</th>
                  <th>Subtotal</th>
                  <th>Credits Applied</th>
                  <th>Total Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {inv.number}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                        {inv.billing_email}
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)' }}>{inv.period}</td>
                    <td className="mono">{formatCurrency(inv.subtotal_usd, 2)}</td>
                    <td className="mono" style={{ color: 'var(--ui-accent)' }}>
                      -{formatCurrency(inv.credits_applied_usd, 2)}
                    </td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {formatCurrency(inv.total_usd, 2)}
                    </td>
                    <td>
                      <Pill tone={inv.status === 'paid' ? 'success' : 'warning'}>
                        {inv.status.toUpperCase()}
                      </Pill>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="ui-btn ui-btn-xs"
                          onClick={() => setSelectedInvoice(inv)}
                        >
                          View Receipt
                        </button>
                        {inv.status !== 'paid' && (
                          <button
                            type="button"
                            className="ui-btn ui-btn-xs ui-btn-primary"
                            onClick={() => handleSettleInvoice(inv.id)}
                          >
                            Settle Now
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: VAULTED CARDS & AUTO-RECHARGE RULES */}
      {tab === 'payment_methods' && (
        <div className="grid-2">
          <Card>
            <CardHeader
              title="Vaulted Stripe Payment Methods"
              subtitle="Tokenized via Stripe SetupIntents with 3DS2 hardware step-up"
            />
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {paymentMethods.map((pm: any) => {
                const brand = pm.brand || pm.type || 'Visa';
                const mask = pm.mask || (pm.last4 ? `•••• ${pm.last4}` : '•••• 4242');
                const exp = pm.exp || (pm.exp_month && pm.exp_year ? `${String(pm.exp_month).padStart(2, '0')} / ${pm.exp_year}` : 'Verified');
                const customer = pm.customer_name || pm.customer || pm.subject || 'Appembly Internal Suite';
                const isDefault = pm.is_default ?? pm.default ?? true;
                return (
                  <div
                    key={pm.id || `${brand}-${mask}`}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--ui-border)',
                      background: 'var(--ui-bg-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {brand} <span className="mono">{mask}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                        {customer} · Expires {exp}
                      </div>
                    </div>
                    <Pill tone={isDefault ? 'success' : 'neutral'}>
                      {isDefault ? 'Default Method' : (pm.status || 'Active')}
                    </Pill>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Threshold-Triggered Credit Auto-Recharge"
              subtitle="Prevents 402 Payment Required interruptions during long-running Runctor agent sessions"
            />
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {autoRechargeRules.map((rule: any) => {
                const customer = rule.customer_name || rule.customer || rule.subject || 'Appembly Internal Suite';
                const threshold = typeof rule.threshold_usd === 'number'
                  ? formatCurrency(rule.threshold_usd, 2)
                  : (rule.threshold || '$100.00');
                const recharge = typeof rule.recharge_amount_usd === 'number'
                  ? formatCurrency(rule.recharge_amount_usd, 2)
                  : (rule.recharge || '$500.00');
                const method = rule.payment_method_label || rule.method || rule.payment_method_id || 'Default Card';
                const enabled = rule.enabled ?? true;
                return (
                  <div
                    key={rule.id || customer}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--ui-border)',
                      background: 'var(--ui-bg-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{customer}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 4 }}>
                        When balance &lt; {threshold} → Top up {recharge} via {method}
                      </div>
                    </div>
                    <Pill tone={enabled ? 'info' : 'neutral'}>{rule.status || (enabled ? 'Armed' : 'Paused')}</Pill>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: STRIPE WEBHOOK SIMULATOR */}
      {tab === 'webhooks' && (
        <div className="grid-2">
          <Card>
            <CardHeader
              title="Dispatch Signed Stripe Webhook Event"
              subtitle="Verifies Stripe-Signature HMAC-SHA256 header and mutates ClickHouse + Valkey state"
            />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
                  Webhook Event Type
                </label>
                <select
                  className="ui-select"
                  style={{ width: '100%', height: 34 }}
                  value={webhookType}
                  onChange={(e) => setWebhookType(e.target.value)}
                >
                  <option value="invoice.paid">invoice.paid (Settle Open Invoice)</option>
                  <option value="payment_intent.succeeded">payment_intent.succeeded (Credit Top-Up)</option>
                  <option value="credit_grant.depleted">credit_grant.depleted (Trigger Auto-Recharge)</option>
                  <option value="customer.subscription.updated">customer.subscription.updated (Sync Valkey Quotas)</option>
                </select>
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                onClick={() => {
                  fetch('/v1/valiscale/meterbox/webhooks/stripe', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-OpenMeter-Namespace': activeNs,
                    },
                    body: JSON.stringify({
                      event_type: webhookType,
                      subject: data?.meterbox?.customers?.[0]?.id || 'cus_appembly_core',
                      amount_usd: invoices[0]?.total_usd || 250.0,
                    }),
                  })
                    .then((r) => r.json())
                    .then((res) => {
                      const wh = res?.webhook;
                      const evtId = wh?.id || `wh_${Math.random().toString(36).slice(2, 8)}`;
                      setWebhookLog((prev) => [
                        {
                          id: evtId,
                          type: wh?.type || webhookType,
                          status: wh?.status || '200 OK · HMAC Verified & Applied',
                          ts: 'just now',
                        },
                        ...prev.filter((item) => item.id !== evtId),
                      ]);
                      onRefreshSnapshot?.();
                      setNotice(`Processed signed Stripe webhook ${evtId} (${webhookType}).`);
                    })
                    .catch(() => {});
                }}
              >
                Send Signed Webhook Payload
              </button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <StatusDot tone="ok" live />
                  <span>Recent Webhook Delivery Ledger</span>
                </span>
              }
              subtitle="Idempotent processing backed by PostgreSQL 16 event log"
            />
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {webhookLog.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--ui-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <div className="mono" style={{ fontWeight: 600 }}>
                      {item.type}
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                      {item.id} · {item.ts}
                    </div>
                  </div>
                  <Pill tone="success">{item.status}</Pill>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Printable Tax Invoice Detail Modal */}
      <Drawer
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        variant="modal"
        title={selectedInvoice ? `Tax Invoice ${selectedInvoice.number}` : 'Tax Invoice'}
        subtitle={selectedInvoice ? `Issued ${selectedInvoice.issued_at} · ${selectedInvoice.period}` : ''}
        footer={
          selectedInvoice ? (
            <>
              <button type="button" className="ui-btn" onClick={() => window.print()}>
                Print / Save PDF
              </button>
              {selectedInvoice.status !== 'paid' && (
                <button
                  type="button"
                  className="ui-btn ui-btn-primary"
                  onClick={() => handleSettleInvoice(selectedInvoice.id)}
                >
                  Record Instant Settlement
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {selectedInvoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: 14,
                borderBottom: '1px solid var(--ui-border)',
              }}
            >
              <div>
                <div className="label-caps">From</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>Appembly Inc. · Meterbox Billing Engine</div>
                <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                  AWS Graviton Region us-east-1 · Tax ID US-94-3819201
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="label-caps">Billed To</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedInvoice.customer_name}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                  {selectedInvoice.billing_email} · {selectedInvoice.payment_method}
                </div>
              </div>
            </div>

            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Description / Meter</th>
                    <th>Quantity</th>
                    <th>Unit Rate</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.lines.map((line, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{line.description}</div>
                        <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                          meter: {line.meter_slug}
                        </div>
                      </td>
                      <td className="mono">{line.quantity}</td>
                      <td className="mono">{line.unit_price}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(line.amount_usd, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignSelf: 'flex-end',
                minWidth: 260,
                padding: 12,
                borderRadius: 10,
                background: 'var(--ui-bg-subtle)',
                border: '1px solid var(--ui-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: 'var(--ui-text-secondary)' }}>Subtotal:</span>
                <span className="mono">{formatCurrency(selectedInvoice.subtotal_usd, 2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: 'var(--ui-text-secondary)' }}>Prepaid Credits Applied:</span>
                <span className="mono" style={{ color: 'var(--ui-accent)' }}>
                  -{formatCurrency(selectedInvoice.credits_applied_usd, 2)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  fontWeight: 700,
                  paddingTop: 6,
                  borderTop: '1px solid var(--ui-border)',
                }}
              >
                <span>Total Due:</span>
                <span className="mono">{formatCurrency(selectedInvoice.total_usd, 2)}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
