"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, Copy, Inbox, Pause, Play, RefreshCw, Send, ShieldCheck, Terminal, Zap } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { apiPost } from "../../lib/api";
import { formatCompact, formatNumber, humanizeKey, relativeTime, shortId } from "../../lib/format";
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
  Select,
  Skeleton,
  StatusDot,
  Textarea,
  usePagination,
} from "../../ui/primitives";
import type { CloudEventRecord, IngestResult } from "../../../types/meterbox";

const PRESETS: {
  id: string;
  label: string;
  type: string;
  source: string;
  data: Record<string, unknown>;
}[] = [
  {
    id: "llm",
    label: "LLM tokens (ai.llm.tokens)",
    type: "ai.llm.tokens",
    source: "cyclode-agent-gateway",
    data: {
      tokens: 4200,
      prompt_tokens: 3100,
      completion_tokens: 1100,
      cached_tokens: 900,
      model: "claude-3-7-sonnet",
      provider: "anthropic",
      feature: "autonomous_coding",
    },
  },
  {
    id: "step",
    label: "Agent execution step (agent.workflow.step)",
    type: "agent.workflow.step",
    source: "runctor-runtime",
    data: {
      steps: 1,
      tool: "bash_sandbox",
      workflow_id: "wf_pr_review",
      duration_ms: 840,
    },
  },
  {
    id: "malformed",
    label: "Malformed payload → Trigger DLQ",
    type: "ai.llm.tokens",
    source: "edge-sdk",
    data: {
      tokens: "NaN_invalid_number",
      model: "claude-3-7-sonnet",
      note: "Non-numeric $.tokens triggers Dead-Letter Queue isolation",
    },
  },
];

export const EventsView: React.FC = () => {
  const { org, env, namespace, snapshot, status, searchParamsStr, refresh } = useConsole();
  const searchParams = useSearchParams();
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<CloudEventRecord | null>(null);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ingest playground state
  const [presetId, setPresetId] = useState("llm");
  const [evId, setEvId] = useState(() => `evt_${Date.now().toString(36)}`);
  const [evType, setEvType] = useState(PRESETS[0].type);
  const [evSource, setEvSource] = useState(PRESETS[0].source);
  const [evSubject, setEvSubject] = useState("");
  const [evData, setEvData] = useState(() => JSON.stringify(PRESETS[0].data, null, 2));
  const [ingesting, setIngesting] = useState(false);
  const [lastResult, setLastResult] = useState<IngestResult | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; title: string; detail?: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsStr);
    if (searchParams?.get("ingest") === "1" || params.get("ingest") === "1") {
      setPlaygroundOpen(true);
    }
  }, [searchParams, searchParamsStr]);

  useEffect(() => {
    if (!evSubject && snapshot.subjects.length > 0) {
      setEvSubject(snapshot.subjects[0].key);
    }
  }, [snapshot.subjects, evSubject]);

  const events = useMemo(() => {
    const raw = snapshot.telemetry?.recentEvents || [];
    return [...raw].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  }, [snapshot.telemetry?.recentEvents]);

  const [frozenEvents, setFrozenEvents] = useState<CloudEventRecord[]>(events);
  useEffect(() => {
    if (!paused) setFrozenEvents(events);
  }, [events, paused]);

  const subjectMap = useMemo(() => {
    return new Map(snapshot.subjects.map((s) => [s.key, s.display_name.replace(/\s*\(.*\)\s*$/, "")]));
  }, [snapshot.subjects]);

  const eventTypes = useMemo(() => {
    return Array.from(new Set(frozenEvents.map((e) => e.type)));
  }, [frozenEvents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return frozenEvents.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (subjectFilter !== "all" && e.subject !== subjectFilter) return false;
      if (!q) return true;
      return (
        e.id.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        JSON.stringify(e.data || {}).toLowerCase().includes(q)
      );
    });
  }, [frozenEvents, typeFilter, subjectFilter, search]);

  const pagination = usePagination(filtered, 10);

  const applyPreset = (id: string) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setEvType(p.type);
    setEvSource(p.source);
    setEvData(JSON.stringify(p.data, null, 2));
    setEvId(`evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`);
  };

  const sendCloudEvent = async (reuseId: boolean) => {
    setIngesting(true);
    const idToUse = reuseId
      ? evId.trim()
      : `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    if (!reuseId) setEvId(idToUse);

    let parsedData: unknown = {};
    try {
      parsedData = JSON.parse(evData);
    } catch {
      parsedData = { raw: evData };
    }

    try {
      const raw = await apiPost<Record<string, unknown>>(
        "/api/v1/events",
        {
          specversion: "1.0",
          id: idToUse,
          source: evSource.trim() || "edge-gateway",
          type: evType.trim(),
          subject: evSubject.trim() || snapshot.subjects[0]?.key || "cust_default",
          time: new Date().toISOString(),
          data: parsedData,
        },
        namespace,
      );

      const isDlq = Boolean(raw.dlq_routed || Number(raw.dlq_count) > 0);
      const isDedup = Boolean(raw.deduplicated === true || Number(raw.deduplicated) > 0);
      const lane = String(raw.lane || raw.routed_lane || "realtime");
      const topic = String(raw.topic || (lane === "bulk" ? "om_events_bulk" : "om_events_realtime"));

      const result: IngestResult = {
        event_id: String(raw.event_id || idToUse),
        namespace: String(raw.namespace || namespace),
        topic,
        lane,
        deduplicated: isDedup,
        dlq_routed: isDlq,
        dlq_reason: String(raw.dlq_reason || "Schema / numeric property mismatch"),
        processed_at: new Date().toISOString(),
      };
      setLastResult(result);
      await refresh();

      if (isDlq) {
        setNotice({
          tone: "warn",
          title: `Event ${idToUse} routed to Dead-Letter Queue`,
          detail: result.dlq_reason,
        });
      } else if (isDedup) {
        setNotice({
          tone: "info" as "warn",
          title: `Duplicate event absorbed by 48h SETNX idempotency guard`,
          detail: `id=${idToUse} was dropped at the edge without double-counting.`,
        });
      } else {
        setNotice({
          tone: "ok",
          title: `CloudEvent ingested → ${topic}`,
          detail: `id=${idToUse} routed via ${lane} lane in ${namespace}.`,
        });
      }
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Event ingestion failed",
        detail: err instanceof Error ? err.message : "Request rejected",
      });
    } finally {
      setIngesting(false);
    }
  };

  const t = snapshot.telemetry;

  return (
    <div className="space-y-5">
      <PageHeader
        orgName={org?.name}
        envType={env?.type}
        envName={env?.name}
        title="Events Stream"
        subtitle="Real-time CloudEvents ingestion stream, idempotency protection, and interactive test playground."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {paused ? "Resume stream" : "Pause stream"}
            </Button>
            <Button variant="primary" onClick={() => setPlaygroundOpen(true)}>
              <Terminal className="w-3.5 h-3.5" />
              Ingest playground
            </Button>
          </>
        }
      />

      {notice && <Notice tone={notice.tone} title={notice.title} detail={notice.detail} onDismiss={() => setNotice(null)} />}

      {/* Ingestion telemetry cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Total events ingested</span>
            <Zap className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{formatNumber(t?.ingestedEvents || 0)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Realtime: <strong className="text-[var(--foreground)]">{formatCompact(t?.realtimeEvents || 0)}</strong> · Bulk:{" "}
            <strong className="text-[var(--foreground)]">{formatCompact(t?.bulkEvents || 0)}</strong>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Duplicates prevented</span>
            <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{formatNumber(t?.dedupHits || 0)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Idempotent retries absorbed without double-counting
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Active stream status</span>
            <Activity className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[18px] font-semibold">
            <StatusDot tone={paused ? "warn" : "ok"} live={!paused} />
            {paused ? "Stream Paused" : "Listening Live"}
          </div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Showing {filtered.length} of {frozenEvents.length} recent events
          </div>
        </Card>
      </div>

      {/* Filter bar + Live Events Table */}
      <Card className="flex flex-col">
        <CardHeader
          title="CloudEvents log"
          subtitle="Click any event row to inspect its full CloudEvents v1.0 JSON envelope"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Filter by ID, type, model, subject…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 h-7 text-[12.5px]"
              />
              <Select label="Event type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All event types</option>
                {eventTypes.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </Select>
              <Select label="Customer" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                <option value="all">All customers</option>
                {snapshot.subjects.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.display_name}
                  </option>
                ))}
              </Select>
            </div>
          }
        />

        <div className="overflow-x-auto mbx-scroll">
          {status === "loading" ? (
            <div className="p-5 space-y-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Inbox className="w-5 h-5" />}
              title="No matching CloudEvents"
              description="Adjust your filters or send a test event using the Ingest Playground."
              action={
                <Button variant="primary" size="sm" onClick={() => setPlaygroundOpen(true)}>
                  Open Ingest Playground
                </Button>
              }
            />
          ) : (
            <table className="min-w-[820px] w-full text-[12.5px]">
              <thead>
                <tr className="border-y border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                  <th className="px-5 py-2.5 text-left w-[110px]">Timestamp</th>
                  <th className="px-3 py-2.5 text-left">Event Type</th>
                  <th className="px-3 py-2.5 text-left">Customer (Subject)</th>
                  <th className="px-3 py-2.5 text-left">Source</th>
                  <th className="px-3 py-2.5 text-left">Payload Summary</th>
                  <th className="px-5 py-2.5 text-right">Event ID</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((ev) => {
                  const data = (ev.data || {}) as Record<string, unknown>;
                  const summary = Object.entries(data)
                    .slice(0, 4)
                    .map(([k, v]) => `${k}=${typeof v === "number" ? formatCompact(v) : String(v)}`)
                    .join(" · ");
                  return (
                    <tr
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-2.5 whitespace-nowrap text-[var(--muted-foreground)] mbx-num">
                        {relativeTime(ev.time)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Pill tone="ok" mono>
                          {ev.type}
                        </Pill>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                        {subjectMap.get(ev.subject) || humanizeKey(ev.subject)}
                        <span className="ml-1.5 text-[11px] mbx-mono text-[var(--muted-foreground)]">({ev.subject})</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap mbx-mono text-[11.5px] text-[var(--muted-foreground)]">
                        {ev.source || "edge-gateway"}
                      </td>
                      <td className="px-3 py-2.5 max-w-[300px] truncate mbx-mono text-[11.5px] text-[var(--muted-foreground)]">
                        {summary || "{}"}
                      </td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard?.writeText(ev.id);
                            setCopiedId(ev.id);
                            setTimeout(() => setCopiedId((c) => (c === ev.id ? null : c)), 1400);
                          }}
                          className="inline-flex items-center gap-1 mbx-mono text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        >
                          {copiedId === ev.id ? "Copied" : shortId(ev.id, 10, 6)}
                          <Copy className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination state={pagination} pageSizeOptions={[5, 10, 25, 50]} itemLabel="events" />
      </Card>

      {/* Event Inspector Drawer */}
      <Drawer
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title="CloudEvent Inspector"
        subtitle={selectedEvent ? `ID: ${selectedEvent.id}` : ""}
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[12.5px]">
              <div>
                <div className="text-[11px] text-[var(--muted-foreground)]">Type</div>
                <div className="mt-0.5 font-medium mbx-mono">{selectedEvent.type}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted-foreground)]">Subject</div>
                <div className="mt-0.5 font-medium mbx-mono">{selectedEvent.subject}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted-foreground)]">Source</div>
                <div className="mt-0.5 mbx-mono">{selectedEvent.source || "edge-gateway"}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted-foreground)]">Time</div>
                <div className="mt-0.5 mbx-mono">{new Date(selectedEvent.time).toISOString()}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-semibold">Full CloudEvents v1.0 JSON Envelope</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard?.writeText(JSON.stringify(selectedEvent, null, 2))}
                >
                  <Copy className="w-3 h-3" /> Copy JSON
                </Button>
              </div>
              <pre className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] mbx-mono text-[12px] overflow-x-auto leading-relaxed">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>

      {/* Ingest Playground Drawer */}
      <Drawer
        open={playgroundOpen}
        onClose={() => setPlaygroundOpen(false)}
        title="CloudEvents Ingest Playground"
        subtitle={`Send test events to ${namespace} and verify idempotency & DLQ routing`}
        width="max-w-[560px]"
      >
        <div className="space-y-4">
          <Field label="Template preset">
            <div className="grid grid-cols-1 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-[12.5px] font-medium transition-colors ${
                    presetId === p.id
                      ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer (subject)">
              <select
                value={evSubject}
                onChange={(e) => setEvSubject(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12.5px]"
              >
                {snapshot.subjects.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.display_name} ({s.key})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Event type">
              <Input mono value={evType} onChange={(e) => setEvType(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Idempotency key (id)" hint="48h Redis SETNX key">
              <Input mono value={evId} onChange={(e) => setEvId(e.target.value)} />
            </Field>
            <Field label="CloudEvent source">
              <Input mono value={evSource} onChange={(e) => setEvSource(e.target.value)} />
            </Field>
          </div>

          <Field label="JSON payload (data)">
            <Textarea mono rows={6} value={evData} onChange={(e) => setEvData(e.target.value)} />
          </Field>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button variant="primary" disabled={ingesting} onClick={() => sendCloudEvent(false)}>
              <Send className="w-3.5 h-3.5" />
              {ingesting ? "Sending…" : "Send with fresh ID"}
            </Button>
            <Button variant="secondary" disabled={ingesting} onClick={() => sendCloudEvent(true)}>
              <RefreshCw className="w-3.5 h-3.5" />
              Resend exact ID (Test SETNX Dedup)
            </Button>
          </div>

          {lastResult && (
            <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Last ingestion result</span>
                <Pill tone={lastResult.dlq_routed ? "warn" : lastResult.deduplicated ? "info" : "ok"} mono>
                  {lastResult.dlq_routed ? "DLQ_ROUTED" : lastResult.deduplicated ? "DEDUPLICATED" : "INGESTED"}
                </Pill>
              </div>
              <div className="grid grid-cols-2 gap-2 mbx-mono text-[11.5px] text-[var(--muted-foreground)]">
                <div>id: {lastResult.event_id}</div>
                <div>topic: {lastResult.topic}</div>
                <div>lane: {lastResult.lane}</div>
                <div>ns: {lastResult.namespace}</div>
              </div>
              {lastResult.dlq_routed && (
                <div className="text-[12px] text-[var(--warn)]">Reason: {lastResult.dlq_reason}</div>
              )}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
};
