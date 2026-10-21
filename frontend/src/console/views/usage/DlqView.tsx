"use client";

import React, { useMemo, useState } from "react";
import { CircleCheck, Play, RotateCcw, Sparkles, TriangleAlert, Wrench } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { apiPost } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import {
  Button,
  Card,
  CardHeader,
  Drawer,
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
  const [drawerItem, setDrawerItem] = useState<DLQEvent | null>(null);
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

  const dlqPagination = usePagination(filtered, 8);

  const activeItem: DLQEvent | null = drawerItem
    ? snapshot.dlqEvents.find((d) => d.id === drawerItem.id) || drawerItem
    : null;

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
      setDrawerItem(null);
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
            Failed events are isolated automatically for safe replay
          </div>
        </Card>
      </div>

      {/* Single-Surface Quarantined Events Queue (3-Second Scan + Slide-Over Drawer) */}
      <Card className="flex flex-col">
        <CardHeader
          title="Quarantined events queue"
          subtitle="Click any quarantined event to inspect, repair, and replay its payload in the slide-over workbench"
        />
        <div className="flex-1">
          {status === "loading" ? (
            <div className="p-5 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CircleCheck className="w-5 h-5" style={{ color: "var(--ok)" }} />}
              title={filter === "pending" ? "No pending dead-letter events" : "No DLQ events in this filter"}
              description="All incoming CloudEvents are passing schema and numeric property validation."
            />
          ) : (
            <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
              {dlqPagination.pageItems.map((item) => {
                const isPending = item.status === "pending";
                return (
                  <div
                    key={item.id}
                    onClick={() => setDrawerItem(item)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 mbx-hover cursor-pointer transition-colors"
                  >
                    {/* 1. What & 2. Why */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <StatusDot tone={isPending ? "warn" : "ok"} />
                        <span className="text-[14.5px] font-semibold text-[var(--foreground)] truncate">
                          {item.failure_reason}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--muted-foreground)] pl-4">
                        <span className="mbx-mono text-[var(--foreground)]">{item.id}</span>
                        <span>·</span>
                        <span className="mbx-mono">{item.error_code}</span>
                        <span>·</span>
                        <span>Failed {relativeTime(item.failed_at)}</span>
                      </div>
                    </div>

                    {/* 3. Status & Primary Action */}
                    <div className="flex items-center gap-2.5 shrink-0 pl-4 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                      <Pill tone={isPending ? "warn" : "ok"}>
                        {isPending ? "Pending repair" : "Replayed"}
                      </Pill>
                      <Button
                        size="sm"
                        variant={isPending ? "primary" : "secondary"}
                        onClick={() => setDrawerItem(item)}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        {isPending ? "Inspect & repair" : "View payload"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Pagination state={dlqPagination} pageSizeOptions={[5, 8, 15, 25]} itemLabel="events" />
      </Card>

      {/* Right Slide-Over Drawer: JSON Payload Repair & Replay Workbench */}
      <Drawer
        open={Boolean(activeItem)}
        onClose={() => setDrawerItem(null)}
        title={activeItem ? `Repair & Replay · ${activeItem.id}` : "Payload Repair Workbench"}
        subtitle={
          activeItem
            ? `Failed ${relativeTime(activeItem.failed_at)} in namespace ${activeItem.namespace}`
            : ""
        }
        width="max-w-[540px]"
      >
        {activeItem && (
          <div className="space-y-4">
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

            <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleAutoFix(activeItem)}>
                <Sparkles className="w-3.5 h-3.5" />
                Auto-fix numeric $.tokens
              </Button>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setDrawerItem(null)}>
                  Cancel
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
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
