"use client";

import React from "react";
import {
  CostIntelligenceReport,
  EntitlementCheck,
  MeterQueryResult,
  Subject,
  Telemetry,
} from "../../types/meterbox";
import { Sparkline } from "../Sparkline";

interface CostIntelligenceViewProps {
  apiBase: string;
  activeNamespace: string;
  costIntel: CostIntelligenceReport | null;
  telemetry: Telemetry | null;
  meterQueryResult: MeterQueryResult | null;
  entitlementCheck: EntitlementCheck | null;
  subjects: Subject[];
  selectedSubjectKey: string;
  setActiveView: (v: string) => void;
  onRefresh: () => Promise<void>;
  pushToast: (title: string, detail?: string, kind?: "ok" | "warn" | "err") => void;
}

export function CostIntelligenceView({
  apiBase,
  activeNamespace,
  costIntel,
  telemetry,
  meterQueryResult,
  entitlementCheck,
  subjects,
  selectedSubjectKey,
  setActiveView,
  onRefresh,
  pushToast,
}: CostIntelligenceViewProps) {
  const rawEvents = telemetry?.recent_events ?? [];

  const totalTokens = Math.max(
    1,
    costIntel?.total_tokens ?? meterQueryResult?.total_value ?? 74420
  );
  const promptTok = costIntel?.input_tokens ?? Math.round(totalTokens * 0.38);
  const cachedTok = costIntel?.cached_tokens ?? Math.round(totalTokens * 0.34);
  const reasonTok = costIntel?.reasoning_tokens ?? Math.round(totalTokens * 0.14);
  const compTok =
    costIntel?.output_tokens ??
    Math.max(0, totalTokens - promptTok - cachedTok - reasonTok);

  const inCost = (promptTok / 1_000_000) * 3.0;
  const cacheCost = (cachedTok / 1_000_000) * 0.3;
  const reasonCost = (reasonTok / 1_000_000) * 15.0;
  const outCost = (compTok / 1_000_000) * 15.0;
  const totalCost =
    costIntel?.total_cost_usd ?? inCost + cacheCost + reasonCost + outCost;
  const savedCost =
    costIntel?.cache_savings_usd ?? (cachedTok / 1_000_000) * (3.0 - 0.3);
  const baselineCost = totalCost + savedCost;
  const savingsPct =
    baselineCost > 0 ? ((savedCost / baselineCost) * 100).toFixed(1) : "31.4";

  const byTool = costIntel?.by_tool ?? [];
  const byModel = costIntel?.by_model ?? [];
  const byPersona = costIntel?.by_persona ?? [];
  const bySubject = costIntel?.by_subject ?? [];

  const totalToolCalls = Math.max(
    1,
    byTool.reduce((acc, t) => acc + t.event_count, 0) || rawEvents.length
  );
  const avgCostPerStep = totalCost / totalToolCalls;
  const cacheHitPct = (
    (cachedTok / Math.max(1, promptTok + cachedTok)) *
    100
  ).toFixed(1);

  const cachedPctBar = Math.round((cachedTok / totalTokens) * 100);
  const promptPctBar = Math.round((promptTok / totalTokens) * 100);
  const reasonPctBar = Math.round((reasonTok / totalTokens) * 100);
  const outPctBar = Math.max(
    4,
    100 - cachedPctBar - promptPctBar - reasonPctBar
  );

  const activeSubj =
    selectedSubjectKey || subjects[0]?.key || "ws_cyclode_default";

  const seriesValues =
    meterQueryResult?.series && meterQueryResult.series.length > 0
      ? meterQueryResult.series.map((s) => s.value).reverse()
      : [12400, 14200, 18500, 24800, 41200, 62400];

  const handleSimulateAgentStep = async (replaySameId = false) => {
    const stepId = replaySameId
      ? `cyclode:${activeNamespace}:step_checkpoint_demo`
      : `cyclode:task_${Date.now().toString(36)}:step_${rawEvents.length + 1}`;
    const tokenTypes = ["input", "cached", "reasoning", "output"];
    const chosenType = replaySameId
      ? "input"
      : tokenTypes[rawEvents.length % tokenTypes.length];

    const batch = [
      {
        specversion: "1.0",
        id: stepId,
        source: "urn:appembly:cyclode:executor",
        type: "ai.llm.tokens",
        subject: activeSubj,
        time: new Date().toISOString(),
        data: {
          tokens: 4200,
          model: "claude-3-7-sonnet",
          token_type: chosenType,
          persona: "IssueResolver",
          tool: "run_command",
        },
      },
    ];
    const res = await fetch(`${apiBase}/api/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) {
      const d = await res.json();
      await onRefresh();
      if (d.deduplicated > 0) {
        pushToast(
          `SETNX Idempotency Guard Triggered`,
          `Duplicate checkpoint "${stepId}" dropped (0 double-billing)`,
          "warn"
        );
      } else {
        pushToast(
          `+4,200 Agent Step Tokens Metered (${chosenType})`,
          `Subject: ${activeSubj} · Event: ${stepId}`,
          "ok"
        );
      }
    }
  };

  return (
    <>
      <div className="ws-head">
        <div>
          <div className="eyebrow">
            <span className="eb-dot" />
            <span>Appembly Shared FinOps Telemetry</span>
            <span className="sep" />
            <span className="mono">{activeNamespace}</span>
          </div>
          <h1>AI Cost Intelligence &amp; Token Economics</h1>
          <p className="lede">
            Real-time token anatomy aggregated from ClickHouse (
            <code>$.token_type</code>, <code>$.model</code>, <code>$.tool</code>,{" "}
            <code>$.persona</code>), prefix cache savings, and crash-safe step
            checkpoint deduplication across <code>Cyclode (:6013)</code>,{" "}
            <code>Swarmteam (:6040)</code>, and <code>Valiscale (:6030)</code>.
          </p>
        </div>
        <div className="ws-actions">
          <button
            type="button"
            className="btn"
            onClick={() => handleSimulateAgentStep(true)}
            title="Send the exact same checkpoint ID twice to verify Redis SETNX deduplication"
          >
            Test Checkpoint Dedup (SETNX)
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => handleSimulateAgentStep(false)}
          >
            + Simulate Live Agent Step (+4.2k tok)
          </button>
        </div>
      </div>

      {/* 4 Top KPI Summary Cards with Live Data-Driven Sparklines */}
      <div className="cards">
        <div className="card">
          <div className="card-head">
            <div className="eyebrow">Attributed Token Spend</div>
            <span className="chip ok mono">
              Margin {costIntel?.gross_margin_pct ?? 62.4}%
            </span>
          </div>
          <div className="card-stat-row">
            <div className="stat">${totalCost.toFixed(4)}</div>
            <Sparkline values={seriesValues} stroke="var(--primary)" />
          </div>
          <p>
            {totalTokens.toLocaleString()} total tokens across{" "}
            {bySubject.length || subjects.length} active subjects
          </p>
          <div className="meta">
            <span className="mono">In/Cache: ${(inCost + cacheCost).toFixed(4)}</span>
            <span className="mono">
              Out/Reason: ${(reasonCost + outCost).toFixed(4)}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="eyebrow">Avg Cost / Tool Step</div>
            <span className="chip mono">{totalToolCalls} steps</span>
          </div>
          <div className="card-stat-row">
            <div className="stat">${avgCostPerStep.toFixed(4)}</div>
            <Sparkline
              values={byTool.map((t) => t.cost_usd)}
              stroke="var(--ok)"
            />
          </div>
          <p>Checkpointed tool &amp; reasoning turns</p>
          <div className="meta">
            <span>Personas: {byPersona.length || 3}</span>
            <span className="mono">
              {Math.round(totalTokens / totalToolCalls).toLocaleString()} tok/step
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="eyebrow">Prefix Cache Savings</div>
            <span className="chip ok mono">-{savingsPct}%</span>
          </div>
          <div className="card-stat-row">
            <div className="stat" style={{ color: "var(--ok)" }}>
              ${savedCost.toFixed(4)}
            </div>
            <Sparkline
              values={[cacheCost, inCost, savedCost, baselineCost]}
              stroke="var(--ok)"
            />
          </div>
          <p>Saved vs. uncached frontier baseline (${baselineCost.toFixed(4)})</p>
          <div className="meta">
            <span className="mono">Cache Hit: {cacheHitPct}%</span>
            <span className="mono">{cachedTok.toLocaleString()} cached tok</span>
          </div>
        </div>

        <div
          className="card clickable"
          onClick={() => setActiveView("entitlements")}
        >
          <div className="card-head">
            <div className="eyebrow">Remaining Token Quota</div>
            <span className="chip ok mono">
              {entitlementCheck?.cache_source || "HIT"} ·{" "}
              {entitlementCheck?.latency_us ??
                telemetry?.avg_check_latency_us ??
                180}{" "}
              µs
            </span>
          </div>
          <div className="card-stat-row">
            <div className="stat">
              {((entitlementCheck?.remaining ?? 5389780) / 1_000_000).toFixed(2)}M
            </div>
            <Sparkline
              values={[
                entitlementCheck?.limit ?? 5500000,
                entitlementCheck?.remaining ?? 5389780,
              ]}
              stroke="var(--primary)"
            />
          </div>
          <p>Priority credit grant waterfall active</p>
          <div className="meta">
            <span className="mono">Subject: {activeSubj}</span>
            <span>{telemetry?.deduplicated_hits ?? 0} dedup hits</span>
          </div>
        </div>
      </div>

      {/* Token Consumption Anatomy Stacked Bar + Breakdown Panel */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>
          <span className="title-left">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Real-Time Token Consumption Anatomy &amp; Model Economics
          </span>
          <span className="chip mono">
            Billed Revenue ${(costIntel?.total_billed_usd ?? 49).toFixed(2)} · Margin{" "}
            {costIntel?.gross_margin_pct ?? 62.4}%
          </span>
        </h3>

        {/* 4-Segment Stacked Bar */}
        <div
          style={{
            display: "flex",
            height: 12,
            width: "100%",
            borderRadius: 99,
            overflow: "hidden",
            background: "var(--surface-subtle)",
            border: "1px solid var(--border)",
            marginBottom: 14,
          }}
        >
          <div
            style={{ width: `${cachedPctBar}%`, background: "var(--ok)" }}
            title={`Cached Context: ${cachedTok.toLocaleString()} tok`}
          />
          <div
            style={{ width: `${promptPctBar}%`, background: "var(--info)" }}
            title={`Prompt Input: ${promptTok.toLocaleString()} tok`}
          />
          <div
            style={{ width: `${reasonPctBar}%`, background: "#8B5CF6" }}
            title={`Reasoning: ${reasonTok.toLocaleString()} tok`}
          />
          <div
            style={{ width: `${outPctBar}%`, background: "var(--warn)" }}
            title={`Completion Output: ${compTok.toLocaleString()} tok`}
          />
        </div>

        {/* 4 Segment Legend Pills */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--surface-subtle)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                color: "var(--muted-foreground)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--ok)",
                  }}
                />
                Cached Context ({cachedPctBar}%)
              </span>
              <span className="mono">$0.30/1M</span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}
            >
              {cachedTok.toLocaleString()} tok{" "}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                (${cacheCost.toFixed(4)})
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--surface-subtle)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                color: "var(--muted-foreground)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--info)",
                  }}
                />
                Prompt Input ({promptPctBar}%)
              </span>
              <span className="mono">$3.00/1M</span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}
            >
              {promptTok.toLocaleString()} tok{" "}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                (${inCost.toFixed(4)})
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--surface-subtle)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                color: "var(--muted-foreground)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "#8B5CF6",
                  }}
                />
                Reasoning ({reasonPctBar}%)
              </span>
              <span className="mono">$15.00/1M</span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}
            >
              {reasonTok.toLocaleString()} tok{" "}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                (${reasonCost.toFixed(4)})
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--surface-subtle)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                color: "var(--muted-foreground)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--warn)",
                  }}
                />
                Output ({outPctBar}%)
              </span>
              <span className="mono">$15.00/1M</span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}
            >
              {compTok.toLocaleString()} tok{" "}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                (${outCost.toFixed(4)})
              </span>
            </div>
          </div>
        </div>

        {/* Real-Time Model Dimension Attribution Table */}
        <div className="table-wrap">
          <table className="cmp">
            <thead>
              <tr>
                <th>Model Identifier ($.model)</th>
                <th>Event Turns</th>
                <th>Token Share</th>
                <th>Gross Margin</th>
                <th className="num">Metered Tokens</th>
                <th className="num">Provider Cost</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((m) => (
                <tr key={m.dimension}>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {m.dimension}
                  </td>
                  <td className="mono">{m.event_count} turns</td>
                  <td>
                    <span className="chip mono">{m.share_pct}%</span>
                  </td>
                  <td>
                    <span className="chip ok mono">
                      {m.margin_pct ?? 62.3}% margin
                    </span>
                  </td>
                  <td className="num mono">{m.tokens.toLocaleString()}</td>
                  <td className="num mono" style={{ fontWeight: 700 }}>
                    ${m.cost_usd.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Column Tool Token Breakdown & Subject Profitability Matrix */}
      <div className="grid2">
        <div className="panel">
          <h3>
            <span className="title-left">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              Tool &amp; Persona Token Attribution (<code>$.tool</code> /{" "}
              <code>$.persona</code>)
            </span>
            <span className="chip ok mono">{byTool.length} tools</span>
          </h3>
          <div className="table-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th>Tool Name</th>
                  <th className="num">Turns</th>
                  <th className="num">Tokens</th>
                  <th className="num">Share</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byTool.map((t) => (
                  <tr key={t.dimension}>
                    <td>
                      <code>{t.dimension}</code>
                    </td>
                    <td className="num mono">{t.event_count}</td>
                    <td className="num mono">{t.tokens.toLocaleString()}</td>
                    <td className="num mono">
                      <span className="chip mono">{t.share_pct}%</span>
                    </td>
                    <td className="num mono" style={{ fontWeight: 700 }}>
                      ${t.cost_usd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {byPersona.length > 0 && (
            <div className="chips" style={{ marginTop: 12 }}>
              {byPersona.map((p) => (
                <span key={p.dimension} className="chip mono">
                  Persona {p.dimension}: {p.tokens.toLocaleString()} tok (
                  {p.share_pct}%)
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>
            <span className="title-left">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Customer &amp; Workstation Gross Margin
            </span>
            <span className="chip ok mono">SETNX Active</span>
          </h3>
          <div className="table-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th>Subject / Workstation</th>
                  <th className="num">Tokens</th>
                  <th className="num">LLM Cost</th>
                  <th className="num">Billed</th>
                  <th className="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {bySubject.map((sub) => (
                  <tr key={sub.subject_key}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{sub.display_name}</div>
                      <div
                        className="mono"
                        style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                      >
                        {sub.subject_key}
                      </div>
                    </td>
                    <td className="num mono">{sub.tokens.toLocaleString()}</td>
                    <td className="num mono">${sub.cost_usd.toFixed(4)}</td>
                    <td className="num mono">${sub.revenue_usd.toFixed(2)}</td>
                    <td className="num mono">
                      <span
                        className={`chip mono ${
                          sub.margin_pct >= 60 ? "ok" : "warn"
                        }`}
                      >
                        {sub.margin_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
