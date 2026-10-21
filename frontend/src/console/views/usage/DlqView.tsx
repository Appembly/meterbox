"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CircleCheck, Play, RotateCcw, Sparkles, TriangleAlert, Wrench } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { apiPost } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PageHeader,
  Pagination,
  Pill,
  Segmented,
  Skeleton,
  StatusDot,
  Textarea,
  usePagination,
} from "../../ui/primitives";
import type { DLQEvent } from "../../../types/meterbox";

type StatusFilter = "pending" | "replayed" | "all";

export const DlqView: React.FC = () => {
  const { org, env, namespace, snapshot, status, refresh } = useConsole();
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [selectedId, setSelectedId] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; title: string; detail?: string } | null>(null);

  const pendingCount = useMemo(
    () => snapshot.dlqEvents.filter((d) => d.status === "pending").length,
    [snapshot.dlqEvents],
  );
  const replayedCount = useMemo(
    () => snapshot.dlqEvents.filter((d) => d.status === "replayed").length,
    [snapshot.dlqEvents],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return snapshot.dlqEvents;
    return snapshot.dlqEvents.filter((d) => d.status === filter);
  }, [snapshot.dlqEvents, filter]);

  const dlqPagination = usePagination(filtered, 5);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (selectedId && filtered.some((d) => d.id === selectedId)) return;
    setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const activeItem: DLQEvent | undefined =
    filtered.find((d) => d.id === selectedId) || snapshot.dlqEvents.find((d) => d.id === selectedId) || filtered[0];

  const currentDraft = activeItem ? (drafts[activeItem.id] ?? activeItem.raw_payload) : "";

  const handleAutoFix = (item: DLQEvent) => {
    try {
      const parsed = JSON.parse(drafts[item.id] ?? item.raw_payload) as Record<string, unknown>;
      const data = (parsed.data && typeof parsed.data === "object" ? { ...(parsed.data as Record<string, unknown>) } : {}) as Record<
        string,
        unknown
      >;
      if (typeof data.tokens !== "number" || Number.isNaN(data.tokens)) {
        data.tokens = 2400;
      }
      parsed.data = data;
      if (!parsed.type) parsed.type = "ai.llm.tokens";
      if (!parsed.subject) parsed.subject = snapshot.subjects[0]?.key || "cust_cyclode";
      setDrafts((prev) => ({ ...prev, [item.id]: JSON.stringify(parsed, null, 2) }));
      setNotice({
        tone: "ok",
        title: "Payload auto-repaired",
        detail: "Replaced non-numeric $.data.tokens with numeric value 2400. Ready to replay.",
      });
    } catch {
      const fallback = {
        specversion: "1.0",
        id: `evt_repaired_${Date.now().toString(36)}`,
        type: "ai.llm.tokens",
        source: "dlq-repair-workbench",
        subject: snapshot.subjects[0]?.key || "cust_cyclode",
        time: new Date().toISOString(),
        data: { tokens: 2400, model: "claude-3-7-sonnet", repaired_from_dlq: item.id },
      };
      setDrafts((prev) => ({ ...prev, [item.id]: JSON.stringify(fallback, null, 2) }));
    }
  };

  const handleReplay = async (item: DLQEvent) => {
    const rawText = drafts[item.id] ?? item.raw_payload;
    let parsedObj: Record<string, unknown>;
    try {
      parsedObj = JSON.parse(rawText);
    } catch {
      setNotice({
        tone: "err",
        title: "Invalid JSON syntax",
        detail: "Please fix the JSON payload syntax or click 'Auto-fix numeric $.tokens' before replaying.",
      });
      return;
    }

    setReplayingId(item.id);
    try {
      await apiPost(
        `/api/control/v1/dlq/${encodeURIComponent(item.id)}/replay`,
        { payload: parsedObj, fixed_payload: rawText },
        namespace,
      );
      await refresh();
      setNotice({
        tone: "ok",
        title: `Replayed DLQ event ${item.id}`,
        detail: "Repaired CloudEvent ingested into ClickHouse rollups and removed from pending queue.",
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: `Replay rejected for ${item.id}`,
        detail: err instanceof Error ? err.message : "Ensure $.data.tokens is a valid number.",
      });
    } finally {
      setReplayingId(null);
    }
  };

  const handleInjectMalformed = async () => {
    setInjecting(true);
    try {
      const id = `evt_bad_${Date.now().toString(36)}`;
      await apiPost(
        "/api/v1/events",
        {
          specversion: "1.0",
          id,
          source: "sdk-v1-legacy",
          type: "ai.llm.tokens",
          subject: snapshot.subjects[0]?.key || "cust_cyclode",
          time: new Date().toISOString(),
          data: {
            tokens: "invalid_string_value",
            model: "deepseek-r1",
          },
        },
        namespace,
      );
      await refresh();
      setFilter("pending");
      setNotice({
        tone: "warn",
        title: `Malformed event ${id} quarantined in DLQ`,
        detail: "Select it below to inspect, repair, and replay without losing customer usage.",
      });
    } catch (err) {
      setNotice({
        tone: "err",
        title: "Could not inject test event",
        detail: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setInjecting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        orgName={org?.name}
        envType={env?.type}
        envName={env?.name}
        title="Dead-Letter Queue"
        subtitle="Quarantined CloudEvents that failed schema or numeric property validation, ready for in-place repair and replay."
        actions={
          <>
            <Segmented<StatusFilter>
              ariaLabel="DLQ status filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "pending", label: `Pending (${pendingCount})` },
                { value: "replayed", label: `Replayed (${replayedCount})` },
                { value: "all", label: `All (${snapshot.dlqEvents.length})` },
              ]}
            />
            <Button variant="secondary" onClick={handleInjectMalformed} disabled={injecting}>
              <TriangleAlert className="w-3.5 h-3.5" />
              {injecting ? "Dispatching…" : "Send test malformed event"}
            </Button>
          </>
        }
      />

      {notice && <Notice tone={notice.tone} title={notice.title} detail={notice.detail} onDismiss={() => setNotice(null)} />}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Pending repair</span>
            <TriangleAlert className="w-4 h-4" style={{ color: pendingCount > 0 ? "var(--warn)" : "var(--ok)" }} />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{pendingCount}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            {pendingCount === 0 ? "Zero data loss — queue is clean" : "Isolated from main Kafka / ClickHouse lane"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Replayed & recovered</span>
            <RotateCcw className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 text-[24px] font-semibold mbx-num">{replayedCount}</div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Re-ingested into billing rollups after repair
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted-foreground)]">
            <span>Quarantine guarantee</span>
            <Wrench className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[18px] font-semibold">
            <StatusDot tone="ok" live />
            Zero Head-of-Line Blocking
          </div>
          <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Schema errors route to `om_events_dlq` in &lt;1ms
          </div>
        </Card>
      </div>

      {/* Main DLQ Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Quarantined Event List */}
        <Card className="lg:col-span-5 flex flex-col">
          <CardHeader
            title="Quarantined events"
            subtitle={`${filtered.length} event${filtered.length === 1 ? "" : "s"} in "${filter}" view`}
          />
          <div className="px-3 pb-3 space-y-2">
            {status === "loading" ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<CircleCheck className="w-5 h-5" style={{ color: "var(--ok)" }} />}
                title={filter === "pending" ? "No pending dead-letter events" : "No DLQ events in this filter"}
                description="All incoming CloudEvents are passing schema and numeric property validation."
              />
            ) : (
              dlqPagination.pageItems.map((item) => {
                const selected = activeItem?.id === item.id;
                const isPending = item.status === "pending";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="mbx-mono text-[12.5px] font-semibold">{item.id}</span>
                      <Pill tone={isPending ? "warn" : "ok"} mono>
                        {item.status.toUpperCase()}
                      </Pill>
                    </div>
                    <div className="mt-1.5 text-[12px] text-[var(--foreground)] line-clamp-2">{item.failure_reason}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                      <span className="mbx-mono">{item.error_code}</span>
                      <span>{relativeTime(item.failed_at)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <Pagination state={dlqPagination} pageSizeOptions={[5, 10, 25]} itemLabel="events" compact />
        </Card>

        {/* Right: JSON Payload Repair & Replay Editor */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader
            title={activeItem ? `Repair & Replay · ${activeItem.id}` : "Payload Repair Workbench"}
            subtitle={
              activeItem
                ? `Failed ${relativeTime(activeItem.failed_at)} in namespace ${activeItem.namespace}`
                : "Select a quarantined event on the left to edit and replay its JSON payload"
            }
            actions={
              activeItem ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => handleAutoFix(activeItem)}>
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-fix numeric $.tokens
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={replayingId === activeItem.id}
                    onClick={() => handleReplay(activeItem)}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {replayingId === activeItem.id ? "Replaying…" : "Repair & replay"}
                  </Button>
                </>
              ) : null
            }
          />

          <div className="px-5 pb-5 space-y-4">
            {!activeItem ? (
              <EmptyState
                title="No event selected"
                description="Choose a dead-letter event from the list or simulate a malformed event to test the repair workflow."
              />
            ) : (
              <>
                <div
                  className="p-3.5 rounded-xl border text-[12.5px]"
                  style={{
                    borderColor: "color-mix(in srgb, var(--warn) 35%, var(--border))",
                    background: "color-mix(in srgb, var(--warn) 8%, var(--card))",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--foreground)]">Validation Failure Reason</span>
                    <span className="mbx-mono text-[11.5px] text-[var(--warn)]">{activeItem.error_code}</span>
                  </div>
                  <p className="mt-1 text-[var(--muted-foreground)]">{activeItem.failure_reason}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12.5px] font-medium text-[var(--foreground)]">
                      Raw CloudEvent JSON Payload (editable)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((prev) => {
                          const next = { ...prev };
                          delete next[activeItem.id];
                          return next;
                        })
                      }
                      className="text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      Reset to original
                    </button>
                  </div>
                  <Textarea
                    mono
                    rows={12}
                    value={currentDraft}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [activeItem.id]: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
