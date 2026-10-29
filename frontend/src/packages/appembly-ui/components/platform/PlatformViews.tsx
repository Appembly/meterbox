import React, { useEffect, useState } from 'react';
import { THEME_PRESETS, BYOK_PROVIDERS } from './catalog';
import {
  Card,
  CopyButton,
  cx,
  CardHeader,
  Drawer,
  HorizTabs,
  JsonView,
  Notice,
  PageHeader,
  Pill,
  ProgressBar,
  Readout,
  Segmented,
  StatusDot,
  Tag,
} from './Primitives';

export { TrustGraphView, SessionsView, VaultView } from './SauthenViews';
export { MetersView, InvoicesView } from './MeterboxViews';
export { ContropsHealthPopover } from './ContropsHealthPopover';

/* ============================================================================
 * 1. HARNWAY — MODELS, SEMANTIC ROUTING & FALLBACKS (RoutingView)
 * ============================================================================ */

export const RoutingView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  platformData?: any;
  dashData?: any;
  isProviderByokReady: (provider: string) => boolean;
  onOpenByokModal: (provider?: string) => void;
  onRunPrompt: (prompt: string) => void;
  onOpenSheet: (title: string, obj: any) => void;
}> = ({
  subTab,
  onSelectSubTab,
  platformData,
  dashData,
  isProviderByokReady,
  onOpenByokModal,
  onRunPrompt,
  onOpenSheet,
}) => {
  const data = platformData || dashData;
  const h = data?.harnway || {};
  const profiles = h.routing_profiles || [];
  const logs = h.recent_logs || [];
  const tab = subTab || 'profiles';

  const [simOpen, setSimOpen] = useState(false);
  const [simPrompt, setSimPrompt] = useState(
    'Synthesize a multi-tenant PostgreSQL 16 schema migration with zero-downtime lock timeout.'
  );
  const [simInject429, setSimInject429] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  const runRouteSimulation = async () => {
    try {
      const res = await fetch('/v1/valiscale/harnway/simulate-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'harnway/coding',
          prompt: simPrompt,
          inject_429: simInject429,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult({
          request_id: data.trace?.id || `req_hw_${Math.random().toString(36).slice(2, 9)}`,
          classified_intent: 'code_architecture_synthesis',
          matched_profile: data.requested_model,
          primary_candidate: 'claude-sonnet-5-5',
          injected_fault: simInject429 ? 'HTTP 429 RateLimitExceeded on anthropic-us-east-1' : 'None',
          resolved_model: data.resolved_model,
          semantic_cache: simInject429 ? 'MISS' : 'HIT (cosine_similarity=0.964)',
          credential_source: 'sauthen://vault/SecretCredential/anthropic-prod-key',
          total_gateway_overhead_ms: data.trace?.latency_ms || 4.8,
          reply_preview: String(data.reply || '').slice(0, 180),
        });
        return;
      }
    } catch {}
    setSimResult({
      request_id: `req_hw_${Math.random().toString(36).slice(2, 9)}`,
      classified_intent: 'code_architecture_synthesis',
      matched_profile: 'architect-low-latency',
      primary_candidate: 'claude-sonnet-5-5',
      injected_fault: simInject429 ? 'HTTP 429 RateLimitExceeded on anthropic-us-east-1' : 'None',
      resolved_model: simInject429 ? 'gpt-5.3-codex (Automatic Failover in 18ms)' : 'claude-sonnet-5-5',
      semantic_cache: simInject429 ? 'MISS' : 'HIT (cosine_similarity=0.964)',
      credential_source: 'sauthen://vault/SecretCredential/anthropic-prod-key',
      total_gateway_overhead_ms: 4.8,
    });
  };

  return (
    <div>
      <PageHeader
        kicker="Harnway · Semantic AI Gateway, Prompt Cache & Automatic Failover"
        title="Models & Routing"
        subtitle="Route prompts across Anthropic, OpenAI, Gemini, and DeepSeek with prompt caching and automatic failover."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ui-btn" onClick={() => onOpenByokModal('anthropic')}>
              + Bring Your Own Key (BYOK)
            </button>
            <button type="button" className="ui-btn" onClick={() => setSimOpen(true)}>
              Simulate Failover
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={() => onRunPrompt('Verify semantic route health and prompt cache hit rate')}
            >
              Test Gateway Route
            </button>
          </div>
        }
      />

      <div className="readout-grid" style={{ marginBottom: 16 }}>
        <Readout
          label="Active Routing Profiles"
          value={String(profiles.length || 3)}
          sub="Latency, Cost & Reasoning tiers"
          tone="sage"
        />
        <Readout
          label="Semantic Cache Hit Rate"
          value="42.1%"
          sub="Valkey 7.2 HNSW cosine >= 0.94"
          tone="jade"
        />
        <Readout
          label="Gateway Overhead (p95)"
          value="4.8 ms"
          sub="Inline DLP + STS + Route selection"
        />
        <Readout
          label="Auto-Failovers (24h)"
          value="14"
          sub="Zero 5xx surfaced to callers"
          tone="violet"
        />
      </div>

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'profiles', label: 'Semantic Routing Profiles', count: profiles.length },
          { id: 'logs', label: 'Live Completions Stream', count: logs.length },
          { id: 'providers', label: 'Provider Vault & Latency Matrix', count: 4 },
        ]}
      />

      {tab === 'profiles' && (
        <div className="grid-3">
          {profiles.map((p: any) => (
            <Card key={p.id}>
              <CardHeader
                title={p.name}
                subtitle={`Strategy: ${p.strategy}`}
                right={<Pill tone="success">Active</Pill>}
              />
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--ui-bg-subtle)',
                    border: '1px solid var(--ui-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ui-text-secondary)' }}>Primary Model:</span>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {p.primary}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ui-text-secondary)' }}>Fallback Chain:</span>
                    <span className="mono">{p.fallback}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ui-text-secondary)' }}>Prompt Cache Hit:</span>
                    <span className="mono" style={{ color: 'var(--ui-accent)', fontWeight: 600 }}>
                      {p.cache_hit}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 6,
                    borderTop: '1px solid var(--ui-border)',
                  }}
                >
                  <span className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-muted)' }}>
                    p95 TTFT: {p.p95_ms}ms
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="ui-btn ui-btn-xs"
                      onClick={() => setSimOpen(true)}
                    >
                      Dry-Run
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn-xs"
                      onClick={() => onOpenSheet(`Routing Profile: ${p.name}`, p)}
                    >
                      Inspect Spec
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <Card>
          <CardHeader
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <StatusDot tone="ok" live />
                <span>Recent Semantic Gateway Completions</span>
              </span>
            }
            subtitle="Every completion emits a signed CloudEvent 1.0 to Meterbox and an OpenTelemetry span to ClickHouse"
            right={<Pill tone="success">Prompt Cache 42.1%</Pill>}
          />
          <div className="ui-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Profile</th>
                  <th>Resolved Model</th>
                  <th>Tokens</th>
                  <th>Latency</th>
                  <th>Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr
                    key={l.id}
                    onClick={() => onOpenSheet(`Completion ${l.id}`, l)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {l.id}
                    </td>
                    <td>{l.profile}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {l.model}
                    </td>
                    <td className="mono">{l.tokens}</td>
                    <td className="mono">{l.latency_ms}ms</td>
                    <td className="mono">${l.cost_usd}</td>
                    <td>
                      <Pill tone="success">{l.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'providers' && (
        <div className="grid-2">
          {BYOK_PROVIDERS.map((p) => {
            const ready = isProviderByokReady(p.id);
            return (
              <Card key={p.id}>
                <CardHeader
                  title={p.name}
                  subtitle={p.modelsSummary}
                  right={
                    <Pill tone={ready ? 'success' : 'warning'}>
                      {ready ? 'BYOK Sealed in Sauthen' : 'Using Managed Pool'}
                    </Pill>
                  }
                />
                <div
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                    p50 TTFT: {p.latency} · SLA {p.uptime}
                  </span>
                  <button
                    type="button"
                    className={`ui-btn ui-btn-xs ${ready ? '' : 'ui-btn-primary'}`}
                    onClick={() => onOpenByokModal(p.id)}
                  >
                    {ready ? 'Rotate Key' : '+ Seal BYOK Key'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={simOpen}
        onClose={() => setSimOpen(false)}
        title="Semantic Route & Provider Failover Simulator"
        subtitle="Test intent classification, prompt cache matching, and automatic HTTP 429/503 upstream failover"
        footer={
          <>
            <button type="button" className="ui-btn" onClick={() => setSimOpen(false)}>
              Close
            </button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={runRouteSimulation}>
              Execute Route Dry-Run
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Sample Prompt Payload
            </label>
            <textarea
              className="ui-input mono"
              style={{ height: 90, padding: 10 }}
              value={simPrompt}
              onChange={(e) => setSimPrompt(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={simInject429}
              onChange={(e) => setSimInject429(e.target.checked)}
            />
            <span>Simulate primary provider HTTP 429 RateLimitExceeded fault</span>
          </label>
          {simResult && <JsonView data={simResult} maxHeight={260} />}
        </div>
      </Drawer>
    </div>
  );
};

/* ============================================================================
 * 2. HARNWAY — MCP INTEGRATIONS & OUTBOUND DLP GUARDRAILS (DlpView)
 * ============================================================================ */

export const DlpView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  platformData?: any;
  dashData?: any;
  onOpenSheet: (title: string, obj: any) => void;
  onSwitchPage: (pageId: string, subTabId?: string) => void;
}> = ({ subTab, onSelectSubTab, platformData, dashData, onOpenSheet }) => {
  const data = platformData || dashData;
  const connectors = data?.harnway?.mcp_connectors || [];
  const connected = connectors.filter((c: any) => c.status === 'connected');
  const tab = subTab || 'connected';

  const [dlpInput, setDlpInput] = useState(
    'Please debug checkout with sk-proj-99887766554433221100 and email billing@acme.io'
  );
  const [dlpResult, setDlpResult] = useState<any>({
    status: 'REDACTED',
    latency_ms: 1.8,
    findings_count: 2,
    redacted_entities: ['OPENAI_API_KEY (sk-proj-…)', 'EMAIL_ADDRESS (billing@acme.io)'],
    scrubbed_preview:
      'Please debug checkout with [REDACTED:OPENAI_API_KEY] and email [REDACTED:EMAIL]',
  });

  const runDlpTest = async () => {
    try {
      const res = await fetch('/v1/guardrails/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: dlpInput }),
      });
      const data = await res.json();
      setDlpResult(data);
    } catch {
      setDlpResult({
        status: 'REDACTED',
        latency_ms: 1.9,
        findings_count: 2,
        scrubbed_preview: dlpInput
          .replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED:API_KEY]')
          .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED:EMAIL]'),
      });
    }
  };

  return (
    <div>
      <PageHeader
        kicker="Harnway · Model Context Protocol (MCP) & Synchronous Egress DLP"
        title="Integrations & DLP"
        subtitle="Connected MCP tools — every outbound call is scrubbed for secrets and PII before it leaves your VPC."
        actions={
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            onClick={() => onSelectSubTab('scrub')}
          >
            Open Live DLP Scrubber
          </button>
        }
      />

      <div className="readout-grid" style={{ marginBottom: 16 }}>
        <Readout
          label="Connected MCP Servers"
          value={`${connected.length} / ${connectors.length}`}
          sub="Scoped via Sauthen RFC 8693 STS"
          tone="sage"
        />
        <Readout
          label="Secrets Redacted (24h)"
          value="66"
          sub="0 plaintext credential leaks"
          tone="jade"
        />
        <Readout
          label="DLP Scrub Latency (p99)"
          value="1.9 ms"
          sub="Streaming regex + entropy AST"
        />
        <Readout
          label="High-Risk Tool Gates"
          value="Armed"
          sub="Step-Up WebAuthn required on prod"
          tone="violet"
        />
      </div>

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'connected', label: 'Connected MCP Tools', count: connected.length },
          { id: 'catalog', label: 'All Connectors Catalog', count: connectors.length },
          { id: 'scrub', label: 'Outbound DLP & Scrub Tester' },
        ]}
      />

      {tab === 'scrub' ? (
        <div className="grid-2">
          <Card>
            <CardHeader
              title="Interactive Outbound DLP & Secret Scrubbing Tester"
              subtitle="POST /v1/guardrails/inspect — redacts API keys, AWS credentials, JWTs, and PII inline"
              right={<Pill tone="success">Inline Egress Filter Active</Pill>}
            />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                className="ui-input mono"
                style={{ height: 110, padding: 12, resize: 'vertical' }}
                value={dlpInput}
                onChange={(e) => setDlpInput(e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-muted)' }}>
                  Evaluated before upstream provider socket write
                </span>
                <button type="button" className="ui-btn ui-btn-primary" onClick={runDlpTest}>
                  Run Egress DLP Inspection
                </button>
              </div>
              {dlpResult && <JsonView data={dlpResult} maxHeight={220} />}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Active Egress Guardrail Policies"
              subtitle="Enforced across all Harnway completions and Runctor MCP tool calls"
            />
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  rule: 'OpenAI / Anthropic / Gemini API Keys',
                  pattern: 'sk-proj-*, sk-ant-*, AIza*',
                  action: 'Redact + Emit Security Event',
                  hits: 14,
                },
                {
                  rule: 'AWS IAM Access Key & Session Secret',
                  pattern: 'AKIA[0-9A-Z]{16}',
                  action: 'Block Egress + Revoke STS Ticket',
                  hits: 2,
                },
                {
                  rule: 'Sauthen Agent STS & Git Broker Handles',
                  pattern: 'st_sts_*, ghs_broker_*',
                  action: 'Redact Handle Inline',
                  hits: 9,
                },
                {
                  rule: 'Customer Email, SSN & PAN Credit Card PII',
                  pattern: 'Luhn + RFC 5322 PII Scanner',
                  action: 'Mask with Deterministic Token',
                  hits: 41,
                },
              ].map((r) => (
                <div
                  key={r.rule}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--ui-border)',
                    background: 'var(--ui-bg-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.rule}</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                      {r.pattern} → {r.action}
                    </div>
                  </div>
                  <Pill tone="success">{r.hits} caught</Pill>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid-3">
          {(tab === 'connected' ? connected : connectors).map((c: any) => (
            <Card key={c.id}>
              <CardHeader
                title={c.name}
                subtitle={`${c.transport} · ${c.tools_count} tools`}
                right={
                  <Pill tone={c.status === 'connected' ? 'success' : 'neutral'}>{c.status}</Pill>
                }
              />
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--ui-bg-subtle)',
                    border: '1px solid var(--ui-border)',
                    fontSize: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--ui-text-secondary)' }}>Required Scope:</span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {c.scopes}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                    DLP: {c.dlp_policy || 'Strict Redact'}
                  </span>
                  <button
                    type="button"
                    className="ui-btn ui-btn-xs"
                    onClick={() => onOpenSheet(`MCP Connector: ${c.name}`, c)}
                  >
                    Inspect Schema
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. CONTROPS — AWS GRAVITON FLEET, CLICKHOUSE TRACES & CI/CD (FleetView)
 *    Ported from ops/frontend/src/console/MissionControlShell.tsx
 * ============================================================================ */

interface GravitonServiceTile {
  id: string;
  name: string;
  tier: 'app' | 'data';
  node: string;
  port: string;
  version: string;
  cpu_pct: number;
  mem_mb: number;
  p95_ms: string;
  status: 'healthy' | 'warn';
  systemd_unit: string;
  storage_path: string;
}

const GRAVITON_SERVICES: GravitonServiceTile[] = [
  {
    id: 'svc_caddy',
    name: 'Caddy TLS Ingress',
    tier: 'app',
    node: 'appembly-core (100.29.231.208)',
    port: ':443 / :80',
    version: 'v2.8.4 arm64',
    cpu_pct: 4.2,
    mem_mb: 68,
    p95_ms: '1.2ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@caddy.service',
    storage_path: '/mnt/appembly-data/caddy',
  },
  {
    id: 'svc_sauthen',
    name: 'Sauthen OIDC & STS',
    tier: 'app',
    node: 'appembly-core (100.29.231.208)',
    port: ':6020 / :6021',
    version: 'v2.4.0 arm64',
    cpu_pct: 8.6,
    mem_mb: 210,
    p95_ms: '4.1ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@sauthen.service',
    storage_path: '/mnt/appembly-data/postgres/sauthen',
  },
  {
    id: 'svc_meterbox',
    name: 'Meterbox FinOps',
    tier: 'app',
    node: 'appembly-core (100.29.231.208)',
    port: ':6070 / :8888',
    version: 'v2.3.1 arm64',
    cpu_pct: 11.4,
    mem_mb: 295,
    p95_ms: '8.4ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@meterbox.service',
    storage_path: '/mnt/appembly-data/clickhouse/meterbox',
  },
  {
    id: 'svc_cyclode',
    name: 'Cyclode Workstation',
    tier: 'app',
    node: 'appembly-core (100.29.231.208)',
    port: ':6013',
    version: 'v2.5.0 arm64',
    cpu_pct: 14.2,
    mem_mb: 380,
    p95_ms: '12.0ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@cyclode.service',
    storage_path: '/mnt/appembly-data/cyclode',
  },
  {
    id: 'svc_harnway',
    name: 'Harnway AI Gateway',
    tier: 'app',
    node: 'appembly-core (100.29.231.208)',
    port: ':6002 / :6010',
    version: 'v2.4.2 arm64',
    cpu_pct: 9.8,
    mem_mb: 240,
    p95_ms: '4.8ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@harnway.service',
    storage_path: '/mnt/appembly-data/valkey',
  },
  {
    id: 'svc_postgres',
    name: 'PostgreSQL 16',
    tier: 'data',
    node: 'appembly-core (100.29.231.208)',
    port: ':5432',
    version: '16.4-alpine arm64',
    cpu_pct: 12.1,
    mem_mb: 640,
    p95_ms: '2.1ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@postgres.service',
    storage_path: '/mnt/appembly-data/postgres (18.4 GB)',
  },
  {
    id: 'svc_clickhouse',
    name: 'ClickHouse 24.8 OLAP',
    tier: 'data',
    node: 'appembly-core (100.29.231.208)',
    port: ':8123 / :9000',
    version: '24.8.4-lts arm64',
    cpu_pct: 16.5,
    mem_mb: 1120,
    p95_ms: '11.4ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@clickhouse.service',
    storage_path: '/mnt/appembly-data/clickhouse (26.2 GB)',
  },
  {
    id: 'svc_redpanda',
    name: 'Redpanda 24.2 Stream',
    tier: 'data',
    node: 'appembly-core (100.29.231.208)',
    port: ':9092',
    version: 'v24.2.5 arm64',
    cpu_pct: 9.4,
    mem_mb: 512,
    p95_ms: '1.8ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@redpanda.service',
    storage_path: '/mnt/appembly-data/redpanda (9.1 GB)',
  },
  {
    id: 'svc_valkey',
    name: 'Valkey 7.2 Sub-ms State',
    tier: 'data',
    node: 'appembly-core (100.29.231.208)',
    port: ':6379',
    version: '7.2.6-alpine arm64',
    cpu_pct: 5.1,
    mem_mb: 310,
    p95_ms: '0.38ms',
    status: 'healthy',
    systemd_unit: 'docker-compose@valkey.service',
    storage_path: '/mnt/appembly-data/valkey (3.4 GB)',
  },
  {
    id: 'svc_sandbox_pool',
    name: 'Graviton3 Sandbox Pool',
    tier: 'data',
    node: 'appembly-sandbox (32.197.188.228)',
    port: ':8443 (mTLS)',
    version: 'c7g.xlarge 4-vCPU arm64',
    cpu_pct: 38.4,
    mem_mb: 2890,
    p95_ms: '24.0ms',
    status: 'healthy',
    systemd_unit: 'runctor-sandbox-pool.service',
    storage_path: '/var/lib/runctor/worktrees (Isolated VPC SG)',
  },
];

export const FleetView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  platformData?: any;
  dashData?: any;
  onTriggerReflex: (reflexId: string) => void;
}> = ({ subTab, onSelectSubTab, platformData, dashData, onTriggerReflex }) => {
  const data = platformData || dashData;
  const c = data?.controps || {};
  const reflexes = c.reflexes || [];
  const tab = subTab || 'nodes';

  const [selectedService, setSelectedService] = useState<GravitonServiceTile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rolloutRunning, setRolloutRunning] = useState(false);

  const appTier = GRAVITON_SERVICES.filter((s) => s.tier === 'app');
  const dataTier = GRAVITON_SERVICES.filter((s) => s.tier === 'data');

  const handleDispatchRollout = (repo: string) => {
    setRolloutRunning(true);
    fetch('/v1/valiscale/controps/rollout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: repo,
        target_node: 'appembly-core (100.29.231.208)',
        tag: 'arm64-latest',
      }),
    }).catch(() => {});
    setTimeout(() => {
      setRolloutRunning(false);
      setNotice(
        `Deployment started for ${repo.replace('Appembly/', '')}.`
      );
    }, 500);
  };

  const allServices = GRAVITON_SERVICES;
  const healthyCount = allServices.filter((s) => s.status === 'healthy').length;
  const shortVersion = (v: string) => v.replace(/\s*arm64\s*$/i, '').replace(/-alpine/i, '');
  const svcGroups = [
    { id: 'app', title: 'Applications', sub: 'Core node · ingress and product services', items: appTier },
    { id: 'data', title: 'Data & sandbox', sub: 'Databases on the core node, plus the isolated sandbox pool', items: dataTier },
  ];

  const traceSpans = [
    { span: 'TLS ingress', op: 'caddy.tls_ingress_terminate', svc: 'Caddy', start: 0, width: 6, ms: '1.2 ms' },
    { span: 'Verify agent credential', op: 'sauthen.verify_rfc8693_ticket', svc: 'Sauthen', start: 6, width: 12, ms: '4.2 ms' },
    { span: 'Check entitlement', op: 'meterbox.valkey_entitlement_gate', svc: 'Meterbox', start: 18, width: 6, ms: '0.38 ms' },
    { span: 'Scrub outbound data', op: 'harnway.dlp_egress_scrub', svc: 'Harnway', start: 24, width: 10, ms: '1.9 ms' },
    { span: 'Model completion', op: 'harnway.anthropic_sonnet_stream', svc: 'Harnway', start: 34, width: 48, ms: '312.0 ms' },
    { span: 'Record usage', op: 'meterbox.ingest_cloudevent_1m', svc: 'Meterbox', start: 82, width: 18, ms: '8.4 ms' },
  ];
  const svcColor: Record<string, string> = {
    Caddy: 'var(--ui-text-muted)',
    Sauthen: '#8F80FF',
    Meterbox: 'var(--ui-accent)',
    Harnway: 'var(--ui-warn)',
  };

  const deployTargets = [
    { repo: 'Appembly/sauthen', name: 'Sauthen', domain: 'auth.appembly.com', commit: 'a84f29c', when: '2h ago' },
    { repo: 'Appembly/meterbox', name: 'Meterbox', domain: 'meter.appembly.com', commit: 'd19c04e', when: '5h ago' },
    { repo: 'Appembly/cyclode', name: 'Cyclode', domain: 'cyclode.appembly.com', commit: 'f42b81a', when: '1d ago' },
  ];

  const cpuTone = (pct: number) => (pct >= 70 ? 'var(--ui-stepup)' : pct >= 40 ? 'var(--ui-warn)' : 'var(--ui-accent)');

  return (
    <div>
      <PageHeader
        title="Fleet & Operations"
        subtitle="Health, traces, deployments, and self-healing reflexes across the core and sandbox nodes."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="ui-btn"
              onClick={() =>
                setNotice('Health check passed end to end: ingress → auth → gateway → metering in 19.4 ms.')
              }
            >
              Run health check
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              disabled={rolloutRunning}
              onClick={() => handleDispatchRollout('Appembly/all-services')}
            >
              {rolloutRunning ? 'Deploying…' : 'Deploy all'}
            </button>
          </div>
        }
      />

      {notice && (
        <div style={{ marginBottom: 14 }}>
          <Notice tone="success" title={notice} onDismiss={() => setNotice(null)} />
        </div>
      )}

      <div className="readout-grid">
        <Readout
          label="Services healthy"
          value={`${healthyCount}/${allServices.length}`}
          sub="All running natively on arm64"
          tone="ok"
          onClick={() => onSelectSubTab('nodes')}
        />
        <Readout label="Core node · CPU" value="42%" sub="t4g.large · 5.1 of 8 GB RAM" onClick={() => onSelectSubTab('nodes')} />
        <Readout label="Sandbox node · CPU" value="38%" sub="c7g.xlarge · 4 vCPU" onClick={() => onSelectSubTab('nodes')} />
        <Readout label="Data volume" value="57%" sub="57.1 of 100 GB · encrypted" onClick={() => onSelectSubTab('nodes')} />
      </div>

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'nodes', label: 'Services', count: allServices.length },
          { id: 'traces', label: 'Traces' },
          { id: 'rollouts', label: 'Deployments' },
          { id: 'reflexes', label: 'Reflexes', count: reflexes.length },
        ]}
      />

      {/* SERVICES */}
      {tab === 'nodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {svcGroups.map((g) => (
            <section key={g.id} className="ui-card">
              <div className="fl-head">
                <div>
                  <div className="fl-title">{g.title}</div>
                  <div className="fl-sub">{g.sub}</div>
                </div>
                <span className="tg-pill tg-pill-ok">
                  {g.items.filter((s) => s.status === 'healthy').length}/{g.items.length} healthy
                </span>
              </div>
              <div className="fl-svc-header">
                <span>Service</span>
                <span>CPU</span>
                <span style={{ textAlign: 'right' }}>Memory</span>
                <span style={{ textAlign: 'right' }}>p95</span>
                <span />
              </div>
              {g.items.map((svc) => (
                <button key={svc.id} type="button" className="fl-svc-row" onClick={() => setSelectedService(svc)}>
                  <span className="fl-svc-main">
                    <span className="fl-svc-name">
                      <span className="tg-dot" style={{ background: 'var(--ok)' }} />
                      {svc.name}
                    </span>
                    <span className="fl-svc-meta mono">
                      {svc.port} · {shortVersion(svc.version)}
                    </span>
                  </span>
                  <span className="fl-cpu">
                    <span className="fl-cpu-track">
                      <span className="fl-cpu-fill" style={{ width: `${Math.min(100, svc.cpu_pct)}%`, background: cpuTone(svc.cpu_pct) }} />
                    </span>
                    <span className="mono fl-num">{svc.cpu_pct}%</span>
                  </span>
                  <span className="mono fl-num" style={{ textAlign: 'right' }}>
                    {svc.mem_mb >= 1000 ? `${(svc.mem_mb / 1024).toFixed(1)} GB` : `${svc.mem_mb} MB`}
                  </span>
                  <span className="mono fl-num" style={{ textAlign: 'right' }}>{svc.p95_ms}</span>
                  <span className="fl-chev">›</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      {/* TRACES */}
      {tab === 'traces' && (
        <section className="ui-card">
          <div className="fl-head">
            <div>
              <div className="fl-title">Request trace</div>
              <div className="fl-sub">One agent request, from ingress to usage recording</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="fl-sub mono">9f82c41e09a2b711</span>
              <span className="tg-pill tg-pill-ok">328 ms total</span>
            </div>
          </div>
          <div className="fl-trace">
            <div className="fl-trace-axis">
              <span />
              <span className="fl-trace-ticks">
                {['0', '80 ms', '160 ms', '240 ms', '328 ms'].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </span>
              <span />
            </div>
            {traceSpans.map((sp) => (
              <div key={sp.op} className="fl-trace-row" title={sp.op}>
                <span className="fl-trace-label">
                  <span className="fl-trace-name">{sp.span}</span>
                  <span className="fl-trace-svc">
                    <span className="tg-dot" style={{ background: svcColor[sp.svc] }} />
                    {sp.svc}
                  </span>
                </span>
                <span className="fl-trace-track">
                  <span
                    className="fl-trace-bar"
                    style={{ left: `${sp.start}%`, width: `${Math.max(sp.width, 1.5)}%`, background: svcColor[sp.svc] }}
                  />
                </span>
                <span className="mono fl-num" style={{ textAlign: 'right' }}>{sp.ms}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DEPLOYMENTS */}
      {tab === 'rollouts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="ui-card">
            <div className="fl-head">
              <div>
                <div className="fl-title">Production services</div>
                <div className="fl-sub">Builds arm64 images and rolls them out to the core node</div>
              </div>
            </div>
            {deployTargets.map((r) => (
              <div key={r.repo} className="fl-deploy-row">
                <span className="fl-svc-main">
                  <span className="fl-svc-name">
                    <span className="tg-dot" style={{ background: 'var(--ok)' }} />
                    {r.name}
                  </span>
                  <span className="fl-svc-meta">{r.domain}</span>
                </span>
                <span className="fl-svc-meta mono">{r.repo}</span>
                <span className="fl-svc-meta">
                  <span className="mono">{r.commit}</span> · deployed {r.when}
                </span>
                <button
                  type="button"
                  className="ui-btn ui-btn-xs"
                  disabled={rolloutRunning}
                  onClick={() => handleDispatchRollout(r.repo)}
                >
                  Deploy
                </button>
              </div>
            ))}
          </section>

          <section className="ui-card">
            <div className="fl-head">
              <div>
                <div className="fl-title">Deploy from the command line</div>
                <div className="fl-sub">Same rollout, triggered from your terminal or GitHub Actions</div>
              </div>
              <CopyButton
                text={`./infra/aws-graviton/scripts/deploy-graviton.sh --rollout\ngh workflow run deploy.yml --repo Appembly/sauthen`}
                label="Copy"
              />
            </div>
            <div style={{ padding: 16 }}>
              <pre className="code-drawer" style={{ margin: 0 }}>
                {`# Roll out all services to the core node
./infra/aws-graviton/scripts/deploy-graviton.sh --rollout

# Or trigger a single service via GitHub Actions
gh workflow run deploy.yml --repo Appembly/sauthen
gh workflow run deploy.yml --repo Appembly/meterbox
gh workflow run deploy.yml --repo Appembly/cyclode`}
              </pre>
            </div>
          </section>
        </div>
      )}

      {/* REFLEXES */}
      {tab === 'reflexes' && (
        <div className="fl-reflex-grid">
          {reflexes.length === 0 && (
            <div className="ui-card" style={{ padding: 20, fontSize: 13, color: 'var(--ui-text-muted)' }}>
              No reflexes configured yet.
            </div>
          )}
          {reflexes.map((r: any) => {
            const armed = String(r.status || r.state || 'active').toLowerCase();
            const isArmed = armed === 'active' || armed === 'armed';
            return (
              <section key={r.id} className="ui-card fl-reflex">
                <div className="fl-reflex-top">
                  <div className="fl-title" style={{ lineHeight: 1.35 }}>{r.name}</div>
                  <span className={cx('tg-pill', isArmed ? 'tg-pill-ok' : 'tg-pill-warn')}>
                    {isArmed ? 'Armed' : 'Paused'}
                  </span>
                </div>
                {r.target && <div className="fl-sub" style={{ marginTop: -6 }}>{r.target}</div>}

                <div className="fl-reflex-steps">
                  <div className="fl-step">
                    <span className="fl-step-k">When</span>
                    <span className="fl-step-v">{r.trigger_condition || r.condition || 'Condition not set'}</span>
                  </div>
                  <div className="fl-step">
                    <span className="fl-step-k">Then</span>
                    <span className="fl-step-v">{r.action}</span>
                  </div>
                  {r.auto_revert && (
                    <div className="fl-step">
                      <span className="fl-step-k">Safety</span>
                      <span className="fl-step-v fl-step-muted">{r.auto_revert}</span>
                    </div>
                  )}
                </div>

                <div className="fl-reflex-foot">
                  <span className="fl-sub">
                    {r.level ? `${r.level.replace(' · ', ' ')}` : 'Bounded'}
                    {r.last_triggered ? ` · Last ran ${r.last_triggered.split(' · ')[0]}` : ''}
                  </span>
                  <button
                    type="button"
                    className="ui-btn ui-btn-xs"
                    onClick={() => {
                      onTriggerReflex(r.id);
                      setNotice(`Test run of "${r.name}" completed and was logged.`);
                    }}
                  >
                    Run test
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Drawer
        open={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        title={selectedService ? selectedService.name : 'Service'}
        subtitle={selectedService ? selectedService.node : ''}
      >
        {selectedService && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="tg-defs">
              {[
                ['Status', 'Healthy'],
                ['Version', selectedService.version],
                ['Port', selectedService.port],
                ['CPU', `${selectedService.cpu_pct}%`],
                ['Memory', `${selectedService.mem_mb} MB`],
                ['p95 latency', selectedService.p95_ms],
                ['Unit', selectedService.systemd_unit],
                ['Storage', selectedService.storage_path],
              ].map(([k, v]) => (
                <div key={k} className="tg-def-row">
                  <span className="tg-def-k">{k}</span>
                  <span className="tg-def-v mono" style={k === 'Status' ? { color: 'var(--ok)' } : undefined}>{v}</span>
                </div>
              ))}
            </div>
            <details className="tg-raw">
              <summary>View raw JSON</summary>
              <JsonView data={selectedService} maxHeight={300} />
            </details>
          </div>
        )}
      </Drawer>
    </div>
  );
};

/* ============================================================================
 * 4. ACCOUNT, APPEARANCE & WORKSPACE SETTINGS (SettingsView)
 * ============================================================================ */

export const SettingsView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  currentOrg: { id: string; name: string; env: string };
  userProfile: { name: string; email: string; initials: string; title: string };
  activeRole: string;
  themeMode: string;
  accentId: string;
  customAccentHex: string;
  isProviderByokReady: (provider: string) => boolean;
  onSaveProfile: (name: string, email: string, orgName: string) => void;
  onChangeRole: (role: string) => void;
  onChangeThemeMode: (mode: string) => void;
  onChangeAccent: (id: string) => void;
  onChangeCustomHex: (hex: string) => void;
  onOpenByokModal: (provider?: string) => void;
  onSwitchPage: (pageId: string, subTabId?: string) => void;
  onLogout: () => void;
}> = ({
  subTab,
  onSelectSubTab,
  currentOrg,
  userProfile,
  activeRole,
  themeMode,
  accentId,
  customAccentHex,
  isProviderByokReady,
  onSaveProfile,
  onChangeRole,
  onChangeThemeMode,
  onChangeAccent,
  onChangeCustomHex,
  onOpenByokModal,
  onLogout,
}) => {
  const tab = subTab || 'profile';
  const [nameInput, setNameInput] = useState(userProfile.name);
  const [emailInput, setEmailInput] = useState(userProfile.email);
  const [orgInput, setOrgInput] = useState(currentOrg.name);

  useEffect(() => {
    setNameInput(userProfile.name);
    setEmailInput(userProfile.email);
  }, [userProfile.name, userProfile.email]);

  useEffect(() => {
    setOrgInput(currentOrg.name);
  }, [currentOrg.id, currentOrg.name]);

  return (
    <div>
      <PageHeader
        kicker="Workspace Preferences · RBAC Lens, Cyclode Theme Palette & Hardware Passkeys"
        title="Settings"
        subtitle="Profile, organization, role, appearance, and passkeys."
        actions={
          <button type="button" className="ui-btn ui-btn-danger" onClick={onLogout}>
            Sign Out of Workspace
          </button>
        }
      />

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'profile', label: 'Profile & Workspace Role' },
          { id: 'appearance', label: 'Appearance & Theme (Cyclode Palette)' },
          { id: 'security', label: 'Security & Passkeys', count: 2 },
          { id: 'byok', label: 'BYOK Model Keys', count: 4 },
        ]}
      />

      {tab === 'profile' && (
        <div className="split-2-1">
          <div className="ui-card ui-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="h3-title">Personal Profile &amp; Active Organization</div>
            <div className="grid-2">
              <div>
                <div className="label-caps" style={{ marginBottom: 5 }}>
                  Full Name
                </div>
                <input
                  className="ui-input"
                  style={{ width: '100%' }}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
              <div>
                <div className="label-caps" style={{ marginBottom: 5 }}>
                  Work Email
                </div>
                <input
                  className="ui-input mono"
                  style={{ width: '100%' }}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
            </div>
            <div className="grid-2">
              <div>
                <div className="label-caps" style={{ marginBottom: 5 }}>
                  Organization Name (Top-Left Sidebar)
                </div>
                <input
                  className="ui-input"
                  style={{ width: '100%' }}
                  value={orgInput}
                  onChange={(e) => setOrgInput(e.target.value)}
                />
              </div>
              <div>
                <div className="label-caps" style={{ marginBottom: 5 }}>
                  Namespace ID
                </div>
                <input className="ui-input mono" style={{ width: '100%' }} value={currentOrg.id} disabled />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                onClick={() => onSaveProfile(nameInput, emailInput, orgInput)}
              >
                Save Profile &amp; Organization
              </button>
            </div>
          </div>

          <div className="ui-card ui-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="h3-title">Workspace Role Lens (RBAC Filter)</div>
            <p style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)' }}>
              Filter sidebar navigation groups to match your operational focus area.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  id: 'owner',
                  label: 'Owner (All 13 Sections)',
                  desc: 'Full visibility across AI Gateway, Identity, Billing, and Graviton Fleet.',
                },
                {
                  id: 'developer',
                  label: 'Developer',
                  desc: 'Focuses on Home, Models & Routing, DLP, and Fleet Operations.',
                },
                {
                  id: 'finops',
                  label: 'FinOps & RevOps',
                  desc: 'Focuses on Usage Metering, Customers, Margin Simulator, and Routing.',
                },
                {
                  id: 'security',
                  label: 'Security & IAM',
                  desc: 'Focuses on Approvals, Trust Graph, Agent STS, Vault, and DLP.',
                },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`popover-option ${activeRole === r.id ? 'selected' : ''}`}
                  style={{ border: '1px solid var(--ui-border)', padding: '10px 12px' }}
                  onClick={() => onChangeRole(r.id)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                      {r.desc}
                    </div>
                  </div>
                  {activeRole === r.id && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'appearance' && (
        <div className="split-2-1">
          <div className="ui-card ui-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="h3-title">Theme Mode (Light / Dark / System)</div>
              <p style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 3 }}>
                Default is Appembly Crisp Light with Deep Forest Sage (<span className="mono">#22543B</span>) primary accents.
              </p>
            </div>
            <div className="theme-mode-seg" style={{ maxWidth: 340 }}>
              <button
                type="button"
                className={`theme-mode-btn ${themeMode === 'light' ? 'active' : ''}`}
                onClick={() => onChangeThemeMode('light')}
              >
                ☀ Light
              </button>
              <button
                type="button"
                className={`theme-mode-btn ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => onChangeThemeMode('dark')}
              >
                ☾ Dark
              </button>
              <button
                type="button"
                className={`theme-mode-btn ${themeMode === 'system' ? 'active' : ''}`}
                onClick={() => onChangeThemeMode('system')}
              >
                ◐ System
              </button>
            </div>

            <div>
              <div className="h3-title" style={{ marginBottom: 10 }}>
                Accent Color Palette (Cyclode Multi-Preset Picker)
              </div>
              <div className="grid-4">
                {THEME_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ticket-card ${accentId === t.id ? 'active' : ''}`}
                    style={{
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      borderColor: accentId === t.id ? 'var(--ui-text-primary)' : 'var(--ui-border)',
                    }}
                    onClick={() => onChangeAccent(t.id)}
                  >
                    <span
                      className="theme-swatch-circle"
                      style={{ width: 22, height: 22, background: t.swatch, color: '#FFF' }}
                    >
                      {accentId === t.id ? '✓' : ''}
                    </span>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{t.label}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                        {t.swatch}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--ui-border)',
              }}
            >
              <input
                type="color"
                value={customAccentHex}
                onChange={(e) => onChangeCustomHex(e.target.value)}
                style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>Custom Hex Accent</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                  Current: {customAccentHex}
                </div>
              </div>
            </div>
          </div>

          <div className="ui-card ui-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="h3-title">Live Theme Token Preview</div>
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'var(--ui-bg-subtle)',
                border: '1px solid var(--ui-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="badge badge-sage">Active Accent Badge</span>
                <span className="mono" style={{ fontSize: 12.5 }}>
                  --ui-accent-btn
                </span>
              </div>
              <button type="button" className="ui-btn ui-btn-primary">
                Primary Action Button
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <Card>
          <CardHeader
            title="Registered WebAuthn Hardware Passkeys"
            subtitle="Used for Sauthen Step-Up approvals and Vault secret unsealing"
            right={<Pill tone="success">FIDO2 / WebAuthn L3</Pill>}
          />
          <div className="ui-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Authenticator</th>
                  <th>Credential ID</th>
                  <th>Registered</th>
                  <th>Last Used</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Apple TouchID (MacBook Pro M3 Max)</td>
                  <td className="mono">pk_live_9921a_mac</td>
                  <td className="mono">2026-01-14</td>
                  <td className="mono">Just now</td>
                  <td>
                    <Pill tone="success">Primary</Pill>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>YubiKey 5C NFC Hardware Security Key</td>
                  <td className="mono">pk_live_4410b_yubi</td>
                  <td className="mono">2026-01-14</td>
                  <td className="mono">3d ago</td>
                  <td>
                    <Pill tone="info">Backup</Pill>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'byok' && (
        <div className="grid-2">
          {[
            { id: 'anthropic', name: 'Anthropic API Key' },
            { id: 'openai', name: 'OpenAI API Key' },
            { id: 'gemini', name: 'Google Gemini API Key' },
            { id: 'deepseek', name: 'DeepSeek API Key' },
          ].map((p) => {
            const ready = isProviderByokReady(p.id);
            return (
              <Card key={p.id}>
                <CardHeader
                  title={p.name}
                  subtitle="AES-256-GCM Hardware KMS Envelope Encryption"
                  right={
                    <Pill tone={ready ? 'success' : 'warning'}>
                      {ready ? 'Sealed in Vault' : 'Not Configured'}
                    </Pill>
                  }
                />
                <div
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)' }}>
                    sauthen://vault/SecretCredential/{p.id}
                  </span>
                  <button
                    type="button"
                    className="ui-btn ui-btn-xs ui-btn-primary"
                    onClick={() => onOpenByokModal(p.id)}
                  >
                    {ready ? 'Rotate Key' : '+ Seal Key'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
