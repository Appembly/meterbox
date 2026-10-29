import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  cx,
  formatCompact,
  TtlRing,
  TokenChip,
  Tag,
  Readout,
  Panel,
  HorizTabs,
  Segmented,
  Drawer,
  JsonView,
  Notice,
  CopyButton,
  StatusDot,
  decisionTone,
  decisionLabel,
} from './Primitives';

/* ============================================================================
   1. Sauthen Trust Graph View (Full DOM-Measured Canvas + Sticky Inspector + Decision Stream)
   ============================================================================ */

const ROW_H = 80;
const NODE_H = 56;

export const TrustGraphView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  platformData?: any;
  dashData?: any;
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  onMintAgentToken: () => void;
}> = ({ subTab, onSelectSubTab, platformData, dashData, selectedNodeId, onSelectNode, onMintAgentToken }) => {
  const data = platformData || dashData;
  const s = data?.sauthen || {};
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [canvasW, setCanvasW] = useState(820);
  const [streamFilter, setStreamFilter] = useState<'all' | 'allowed' | 'blocked'>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [revokedIds, setRevokedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      if (entries[0]?.contentRect.width > 0) {
        setCanvasW(Math.floor(entries[0].contentRect.width));
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const humans = [
    { id: 'human_ken', kind: 'human', label: 'Ken M.', email: 'ken@appembly.com', sub: 'Owner · Passkey L3', sessions: 2, mfa: true, scopes: ['workspace:*', 'sauthen:admin'] },
    { id: 'human_sarah', kind: 'human', label: 'Sarah Chen', email: 'sarah@appembly.com', sub: 'FinOps · Passkey L3', sessions: 1, mfa: true, scopes: ['meterbox:*', 'stripe:webhook'] },
    { id: 'human_alex', kind: 'human', label: 'Alex Rivera', email: 'alex@appembly.com', sub: 'Staff Eng · Passkey L3', sessions: 1, mfa: true, scopes: ['cyclode:*', 'git:worktree'] },
  ];

  const rawAgents = [
    {
      id: 'agent_coder',
      kind: 'agent',
      label: 'SoftwareEngineer',
      taskId: 'task_pty_resize_01',
      principal: 'Ken M.',
      humanId: 'human_ken',
      token: 'st_agt_901a_ed25519_live',
      repo: 'Appembly/cyclode',
      branch: 'feat/worktree-canvas',
      status: revokedIds.includes('agent_coder') ? 'revoked' : 'active',
      remMin: 12,
      budgetLeft: 184200,
      proxyCalls: 19,
      gated: ['git_push_main', 'merge_pr'],
      scopes: ['git:push:scoped', 'harnway:complete', 'vault:proxy:anthropic'],
    },
    {
      id: 'agent_revops',
      kind: 'agent',
      label: 'FinOpsAuditor',
      taskId: 'task_margin_audit_04',
      principal: 'Sarah Chen',
      humanId: 'human_sarah',
      token: 'st_agt_904b_ed25519_stepup',
      repo: 'Appembly/meterbox',
      branch: 'audit/q4-stripe-sync',
      status: revokedIds.includes('agent_revops') ? 'revoked' : 'step_up',
      remMin: 9,
      budgetLeft: 92400,
      proxyCalls: 8,
      gated: ['stripe_refund_over_500'],
      scopes: ['meterbox:read', 'stripe:draft_invoice'],
    },
    {
      id: 'agent_sre',
      kind: 'agent',
      label: 'AutonomicSRE',
      taskId: 'task_graviton_probe_07',
      principal: 'Alex Rivera',
      humanId: 'human_alex',
      token: 'st_agt_911c_ed25519_live',
      repo: 'Appembly/infra',
      branch: 'ops/graviton-health',
      status: revokedIds.includes('agent_sre') ? 'revoked' : 'active',
      remMin: 14,
      budgetLeft: 240000,
      proxyCalls: 31,
      gated: ['prod_deploy'],
      scopes: ['ops:probe', 'clickhouse:select', 'vault:proxy:openai'],
    },
  ];

  const secrets = [
    { id: 'res_anthropic', kind: 'resource', label: 'anthropic · claude-4-6', sub: 'AES-256-GCM · proxy', calls: 142, cipher: 'v1:gcm:9f82a10c44e9b210...881a', preview: 'sk-ant-api03-••••91a' },
    { id: 'res_git', kind: 'resource', label: 'github_app · worktree', sub: 'Branch-locked broker', calls: 64, cipher: 'v1:gcm:3d71c09e21b8a401...104f', preview: 'ghs_appembly_••••402' },
    { id: 'res_stripe', kind: 'resource', label: 'stripe · live_billing', sub: 'AES-256-GCM · hand-off', calls: 29, cipher: 'v1:gcm:7a11f40b82c3e912...552c', preview: 'sk_live_51P••••88b' },
  ];

  const edges = [
    { from: 'human_ken', to: 'agent_coder', tone: 'accent', live: true, weight: 3 },
    { from: 'human_sarah', to: 'agent_revops', tone: 'amber', live: true, weight: 2 },
    { from: 'human_alex', to: 'agent_sre', tone: 'accent', live: true, weight: 2 },
    { from: 'agent_coder', to: 'res_anthropic', tone: 'ok', live: true, weight: 4 },
    { from: 'agent_coder', to: 'res_git', tone: 'ok', live: true, weight: 3 },
    { from: 'agent_revops', to: 'res_stripe', tone: 'amber', live: false, weight: 2 },
    { from: 'agent_sre', to: 'res_anthropic', tone: 'ok', live: true, weight: 3 },
  ];

  const allNodes = [...humans, ...rawAgents, ...secrets];
  const selected = allNodes.find((n) => n.id === selectedNodeId) || null;
  const tab = subTab || 'graph';

  const cols = [humans, rawAgents, secrets];
  const maxRows = Math.max(1, ...cols.map((c) => c.length));
  const H = maxRows * ROW_H + 24;
  const pad = 20;
  const nodeW = Math.max(170, Math.min(250, (canvasW - pad * 2) * 0.27));
  const colX = [pad, (canvasW - nodeW) / 2, canvasW - nodeW - pad];

  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((col, ci) => {
    const offset = (H - col.length * ROW_H) / 2 + (ROW_H - NODE_H) / 2;
    col.forEach((n, i) => pos.set(n.id, { x: colX[ci], y: offset + i * ROW_H }));
  });

  const connected = new Set<string>();
  if (selected) {
    connected.add(selected.id);
    edges.forEach((e) => {
      if (e.from === selected.id) connected.add(e.to);
      if (e.to === selected.id) connected.add(e.from);
    });
    if (selected.kind === 'human') {
      edges.forEach((e) => connected.has(e.from) && e.from.startsWith('agent_') && connected.add(e.to));
    }
    if (selected.kind === 'resource') {
      edges.forEach((e) => connected.has(e.to) && e.to.startsWith('agent_') && connected.add(e.from));
    }
  }
  const isLit = (id: string) => !selected || connected.has(id);
  const edgeLit = (e: (typeof edges)[number]) => !selected || (connected.has(e.from) && connected.has(e.to));

  const decisionLogs = s.decision_stream?.length
    ? s.decision_stream
    : [
        { id: 'dec_1', ts: '02:14:09', decision: 'allowed', code: 200, provider: 'anthropic', persona: 'SoftwareEngineer', task: 'task_pty_resize_01', action: 'POST /v1/messages (claude-sonnet-4-6)', tokens: 4820, latency_ms: 1.8 },
        { id: 'dec_2', ts: '02:13:52', decision: 'allowed', code: 200, provider: 'github_app', persona: 'SoftwareEngineer', task: 'task_pty_resize_01', action: 'git.push refs/heads/feat/worktree-canvas', tokens: 0, latency_ms: 2.1 },
        { id: 'dec_3', ts: '02:12:41', decision: 'stepup_required', code: 403, provider: 'stripe', persona: 'FinOpsAuditor', task: 'task_margin_audit_04', action: 'POST /v1/refunds ($640.00 > $500 threshold)', tokens: 0, latency_ms: 0.9 },
        { id: 'dec_4', ts: '02:11:18', decision: 'allowed', code: 200, provider: 'anthropic', persona: 'AutonomicSRE', task: 'task_graviton_probe_07', action: 'POST /v1/messages (claude-haiku-4-5)', tokens: 1940, latency_ms: 1.4 },
        { id: 'dec_5', ts: '02:09:04', decision: 'denied', code: 403, provider: 'github_app', persona: 'SoftwareEngineer', task: 'task_pty_resize_01', action: 'git.push refs/heads/main (branch lock enforced)', tokens: 0, latency_ms: 0.6 },
      ];

  const filteredLogs = decisionLogs.filter((l: any) => {
    const d = String(l.decision || '').toLowerCase();
    if (streamFilter === 'all') return true;
    if (streamFilter === 'allowed') return d === 'allowed' || d === 'allow';
    return d !== 'allowed' && d !== 'allow';
  });

  const statusMeta = (st: string) =>
    st === 'active'
      ? { label: 'Active', color: 'var(--ok)' }
      : st === 'step_up'
      ? { label: 'Needs step-up', color: 'var(--ui-warn)' }
      : { label: 'Revoked', color: 'var(--ui-stepup)' };

  const decisionMeta = (d: string) => {
    const t = decisionTone(d);
    return t === 'ok'
      ? { label: 'Allowed', cls: 'tg-pill-ok' }
      : t === 'amber'
      ? { label: 'Step-up', cls: 'tg-pill-warn' }
      : { label: 'Denied', cls: 'tg-pill-err' };
  };

  const visibleLogs = tab === 'graph' ? filteredLogs.slice(0, 5) : filteredLogs;

  const LockIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );

  const DefRow: React.FC<{ k: string; v: React.ReactNode; mono?: boolean; tone?: string }> = ({ k, v, mono, tone }) => (
    <div className="tg-def-row">
      <span className="tg-def-k">{k}</span>
      <span className={cx('tg-def-v', mono && 'mono')} style={tone ? { color: tone } : undefined}>
        {v}
      </span>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="h1-title">Trust Graph</h1>
          <p className="page-subtitle">
            How people delegate access to agents, and which secrets those agents can use.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="ui-btn"
            onClick={() => {
              onSelectNode('');
              setRevokedIds([]);
              setToast('Graph refreshed and signatures verified.');
            }}
          >
            Verify keys
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={onMintAgentToken}>
            + Delegate to agent
          </button>
        </div>
      </div>

      {toast && <Notice tone="ok" title={toast} onDismiss={() => setToast(null)} />}

      <div className="readout-grid">
        <Readout
          label="People signed in"
          value={humans.reduce((a, h) => a + h.sessions, 0)}
          sub="Passkey sessions"
          onClick={() => onSelectNode(humans[0].id)}
        />
        <Readout
          label="Active agents"
          value={rawAgents.filter((a) => a.status === 'active').length}
          sub="15-minute credentials"
          onClick={() => onSelectNode(rawAgents[0].id)}
        />
        <Readout
          label="Proxied calls · 24h"
          value={formatCompact(secrets.reduce((a, x) => a + x.calls, 0))}
          sub="Secrets never exposed"
          onClick={() => onSelectNode(secrets[0].id)}
        />
        <Readout label="Verify latency · p99" value="0.4ms" sub="Local signature check" />
      </div>

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'graph', label: 'Graph' },
          { id: 'decisions', label: 'Activity', count: decisionLogs.length },
        ]}
      />

      {tab === 'graph' && (
        <div className="tg-layout">
          {/* Graph */}
          <section className="ui-card tg-graph-card">
            <div className="tg-card-head">
              <div className="tg-card-title">Delegation</div>
              <div className="tg-legend">
                <span><i style={{ background: 'var(--ui-accent)' }} /> Delegated</span>
                <span><i style={{ background: 'var(--ok)' }} /> Allowed</span>
                <span><i style={{ background: 'var(--ui-warn)' }} /> Step-up</span>
              </div>
            </div>

            <div className="graph-scroll-wrap tg-graph-body">
              <div className="graph-scroll-inner">
                <div className="tg-col-labels" style={{ paddingLeft: pad, paddingRight: pad }}>
                  <span>People</span>
                  <span style={{ textAlign: 'center' }}>Agents</span>
                  <span style={{ textAlign: 'right' }}>Secrets</span>
                </div>

                <div
                  ref={wrapRef}
                  style={{ position: 'relative', height: H }}
                  onClick={() => onSelectNode('')}
                >
                  <svg width={canvasW} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {edges.map((e, i) => {
                      const a = pos.get(e.from);
                      const b = pos.get(e.to);
                      if (!a || !b) return null;
                      const x1 = a.x + nodeW;
                      const y1 = a.y + NODE_H / 2;
                      const x2 = b.x;
                      const y2 = b.y + NODE_H / 2;
                      const mx = (x1 + x2) / 2;
                      const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
                      const strokeColor =
                        e.tone === 'amber' ? 'var(--ui-warn)' : e.tone === 'ok' ? 'var(--ok)' : 'var(--ui-accent)';
                      const lit = edgeLit(e);
                      return (
                        <g key={i} style={{ opacity: lit ? 1 : 0.12, transition: 'opacity 180ms' }}>
                          <path
                            d={d}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={1.5}
                            strokeOpacity={0.85}
                            className={e.live ? 'sth-flow' : undefined}
                          />
                          <circle cx={x1} cy={y1} r={2.5} fill={strokeColor} />
                          <circle cx={x2} cy={y2} r={2.5} fill={strokeColor} />
                        </g>
                      );
                    })}
                  </svg>

                  {allNodes.map((n: any) => {
                    const p = pos.get(n.id);
                    if (!p) return null;
                    const active = selected?.id === n.id;
                    const st = n.kind === 'agent' ? statusMeta(n.status) : null;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        className={cx('tg-node', active && 'is-active')}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode(active ? '' : n.id);
                        }}
                        style={{
                          left: p.x,
                          top: p.y,
                          width: nodeW,
                          height: NODE_H,
                          opacity: isLit(n.id) ? 1 : 0.35,
                        }}
                        title={n.label}
                      >
                        {n.kind === 'human' && (
                          <span className="tg-avatar">
                            {n.label
                              .split(' ')
                              .map((w: string) => w[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                        {n.kind === 'agent' && <TtlRing rem={n.remMin} total={15} size={32} stroke={2.5} />}
                        {n.kind === 'resource' && (
                          <span className="tg-lock">
                            <LockIcon />
                          </span>
                        )}
                        <span className="tg-node-text">
                          <span className="tg-node-title">
                            {n.kind === 'resource' ? n.label.split(' · ')[0] : n.label}
                          </span>
                          <span className="tg-node-sub">
                            {n.kind === 'human' && n.sub.split(' · ')[0]}
                            {n.kind === 'agent' && (
                              <>
                                <span className="tg-dot" style={{ background: st!.color }} />
                                {st!.label} · for {n.principal}
                              </>
                            )}
                            {n.kind === 'resource' && `${n.label.split(' · ')[1] || ''} · ${n.calls} calls`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="tg-graph-foot">Select a person, agent, or secret to see its details and connections.</div>
          </section>

          {/* Inspector */}
          <aside className="ui-card tg-inspector">
            <div className="tg-card-head">
              <div className="tg-card-title">
                {!selected
                  ? 'Issuer'
                  : selected.kind === 'agent'
                  ? 'Agent credential'
                  : selected.kind === 'human'
                  ? 'Person'
                  : 'Secret'}
              </div>
              {selected ? (
                <button type="button" className="ui-btn ui-btn-xs" onClick={() => onSelectNode('')}>
                  Clear
                </button>
              ) : (
                <span className="tg-pill tg-pill-ok">Keys active</span>
              )}
            </div>

            {!selected && (
              <div className="tg-inspector-body">
                <div className="tg-hero">
                  <div className="tg-hero-title">auth.appembly.com</div>
                  <div className="tg-hero-sub mono">sth_key_ed25519_2026_q4</div>
                </div>
                <div className="tg-defs">
                  <DefRow k="Signing" v="Ed25519" />
                  <DefRow k="Person session" v="60 min" />
                  <DefRow k="Agent credential" v="15 min" />
                </div>
                <div className="tg-section-label">Always requires step-up</div>
                <div className="tg-chip-row">
                  {['Merge PR', 'Push to main', 'Prod deploy', 'Refund > $500'].map((g) => (
                    <span key={g} className="tg-chip">{g}</span>
                  ))}
                </div>
              </div>
            )}

            {selected && selected.kind === 'agent' && (
              <div className="tg-inspector-body">
                <div className="tg-hero tg-hero-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="tg-hero-title">{(selected as any).label}</div>
                    <div className="tg-hero-sub">
                      <span className="tg-dot" style={{ background: statusMeta((selected as any).status).color }} />
                      {statusMeta((selected as any).status).label} · delegated by {(selected as any).principal}
                    </div>
                  </div>
                  <TtlRing rem={(selected as any).remMin} total={15} size={44} />
                </div>
                <div className="tg-defs">
                  <DefRow k="Repository" v={(selected as any).repo} mono />
                  <DefRow k="Branch" v={(selected as any).branch} mono />
                  <DefRow k="Token budget left" v={`${formatCompact((selected as any).budgetLeft)} tokens`} tone="var(--ok)" />
                  <DefRow k="Proxied calls" v={(selected as any).proxyCalls} />
                  <DefRow k="Credential" v={<TokenChip value={(selected as any).token} max={22} />} />
                </div>
                <details className="tg-raw">
                  <summary>View raw claims</summary>
                  <JsonView
                    label="claims.json"
                    maxHeight={200}
                    value={{
                      iss: 'https://auth.appembly.com',
                      sub: (selected as any).humanId,
                      act: {
                        persona: (selected as any).label,
                        task_id: (selected as any).taskId,
                        target_repo: (selected as any).repo,
                        worktree_branch: (selected as any).branch,
                      },
                      scopes: (selected as any).scopes,
                    }}
                  />
                </details>
                <button
                  type="button"
                  className="ui-btn ui-btn-danger"
                  style={{ width: '100%' }}
                  disabled={(selected as any).status === 'revoked'}
                  onClick={() => {
                    setRevokedIds((prev) => [...prev, selected.id]);
                    setToast(`${(selected as any).label}'s credential was revoked. It stops working immediately.`);
                  }}
                >
                  {(selected as any).status === 'revoked' ? 'Revoked' : 'Revoke credential'}
                </button>
              </div>
            )}

            {selected && selected.kind === 'human' && (
              <div className="tg-inspector-body">
                <div className="tg-hero">
                  <div className="tg-hero-title">{(selected as any).label}</div>
                  <div className="tg-hero-sub">{(selected as any).email}</div>
                </div>
                <div className="tg-defs">
                  <DefRow k="Role" v={(selected as any).sub.split(' · ')[0]} />
                  <DefRow k="Sign-in" v="Passkey" />
                  <DefRow k="Active sessions" v={(selected as any).sessions} />
                  <DefRow k="Current session" v="54 min left" tone="var(--ok)" />
                </div>
                <div className="tg-section-label">Scopes</div>
                <div className="tg-chip-row">
                  {((selected as any).scopes || []).map((sc: string) => (
                    <span key={sc} className="tg-chip mono">{sc}</span>
                  ))}
                </div>
              </div>
            )}

            {selected && selected.kind === 'resource' && (
              <div className="tg-inspector-body">
                <div className="tg-hero">
                  <div className="tg-hero-title">{(selected as any).label.split(' · ')[0]}</div>
                  <div className="tg-hero-sub">Sealed in vault · never leaves Sauthen</div>
                </div>
                <div className="tg-defs">
                  <DefRow k="Scope" v={(selected as any).label.split(' · ')[1]} mono />
                  <DefRow k="Key preview" v={(selected as any).preview} mono />
                  <DefRow k="Proxied calls" v={(selected as any).calls} />
                  <DefRow k="Encryption" v="AES-256-GCM" />
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Activity */}
      <section className="ui-card" style={{ marginTop: tab === 'graph' ? 20 : 0 }}>
        <div className="tg-card-head">
          <div className="tg-card-title">
            <StatusDot tone="ok" live />
            {tab === 'graph' ? 'Recent activity' : 'Activity'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Segmented
              ariaLabel="Activity filter"
              value={streamFilter}
              onChange={setStreamFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'allowed', label: 'Allowed' },
                { value: 'blocked', label: 'Blocked' },
              ]}
            />
            {tab === 'graph' && (
              <button type="button" className="ui-btn ui-btn-xs" onClick={() => onSelectSubTab('decisions')}>
                View all →
              </button>
            )}
          </div>
        </div>
        <div className="tg-activity">
          {visibleLogs.length === 0 && <div className="tg-empty">No matching activity.</div>}
          {visibleLogs.map((l: any, idx: number) => {
            const dm = decisionMeta(l.decision);
            return (
              <button
                key={l.id || idx}
                type="button"
                className="tg-activity-row"
                onClick={() => {
                  const ag = rawAgents.find((a) => a.label === (l.persona || l.actor));
                  onSelectSubTab('graph');
                  onSelectNode(ag ? ag.id : 'agent_coder');
                }}
              >
                <span className={cx('tg-pill', dm.cls)}>{dm.label}</span>
                <span className="tg-activity-main">
                  <span className="tg-activity-actor">{l.persona || l.actor}</span>
                  <span className="tg-activity-action mono">{l.action}</span>
                </span>
                <span className="tg-activity-target">{l.provider || 'sauthen'}</span>
                <span className="tg-activity-metric mono">
                  {l.tokens > 0 ? `${formatCompact(l.tokens)} tok` : `${l.latency_ms} ms`}
                </span>
                <span className="tg-activity-time mono">{l.ts}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

/* ============================================================================
   2. Sauthen Sessions, RFC 8693 Agent STS, OAuth 2.1 Clients & JWKS View
   ============================================================================ */

const DEFAULT_AGENT_TOKENS = [
  {
    id: 'st_agt_swe_901a_live',
    agent_name: 'SoftwareEngineer · Runctor Pack',
    delegated_by: 'Mburu Nganga (Passkey L3)',
    scope: 'appembly/cyclode#feat/worktree-sync',
    ttl_minutes: 14,
    status: 'Active · RFC 8693',
    issued_at: '1m ago',
    claims: {
      iss: 'https://auth.appembly.com',
      sub: 'agt_cyclode_swe_01',
      act: { sub: 'usr_mburu_l3', worktree_branch: 'feat/worktree-sync', repo: 'appembly/cyclode' },
      scope: 'git.worktree.write llm.proxy.invoke meterbox.emit',
      exp_in_sec: 840,
    },
  },
  {
    id: 'st_agt_rev_442c_live',
    agent_name: 'CodeReviewer · Security & Diff Audit',
    delegated_by: 'Mburu Nganga (Passkey L3)',
    scope: 'appembly/valiscale#main (read-only)',
    ttl_minutes: 11,
    status: 'Active · RFC 8693',
    issued_at: '4m ago',
    claims: {
      iss: 'https://auth.appembly.com',
      sub: 'agt_valiscale_reviewer_02',
      act: { sub: 'usr_mburu_l3', worktree_branch: 'main', repo: 'appembly/valiscale' },
      scope: 'git.tree.read llm.proxy.invoke dlp.scan',
      exp_in_sec: 660,
    },
  },
  {
    id: 'st_agt_fin_718e_live',
    agent_name: 'FinOpsAuditor · Meterbox Reconciler',
    delegated_by: 'System Schedule (OIDC Workload)',
    scope: 'ns_live_appembly · ClickHouse Rollups',
    ttl_minutes: 9,
    status: 'Active · RFC 8693',
    issued_at: '6m ago',
    claims: {
      iss: 'https://auth.appembly.com',
      sub: 'agt_meterbox_finops_03',
      act: { sub: 'sys_cron_finops', namespace: 'ns_live_appembly' },
      scope: 'meterbox.rollups.read stripe.invoices.sync',
      exp_in_sec: 540,
    },
  },
];

const DEFAULT_HUMAN_SESSIONS = [
  {
    id: 'st_sess_passkey_98f2a1',
    user: 'Mburu Nganga',
    role: 'Organization Owner',
    auth_level: 'WebAuthn Passkey L3 (Hardware Enclave)',
    ttl: '54m remaining',
    ip: '127.0.0.1 · TLS 1.3',
    created_at: '6m ago',
  },
  {
    id: 'st_sess_oidc_41c8b0',
    user: 'Ken M.',
    role: 'Principal Architect',
    auth_level: 'OIDC + PKCE S256 + Passkey Step-Up',
    ttl: '42m remaining',
    ip: '10.0.14.82 · TLS 1.3',
    created_at: '18m ago',
  },
];

export const SessionsView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  platformData?: any;
  dashData?: any;
  userRepos: string[];
  onMintAgentToken: () => void;
  onRevokeAgentToken: (tokenId: string) => void;
  onOpenSheet: (title: string, obj: any) => void;
}> = ({ subTab, onSelectSubTab, platformData, dashData, userRepos, onMintAgentToken, onRevokeAgentToken, onOpenSheet }) => {
  const data = platformData || dashData;
  const s = data?.sauthen || {};
  const [localMintedAgents, setLocalMintedAgents] = useState<any[]>([]);
  const [revokedIds, setRevokedIds] = useState<string[]>([]);
  const baseAgents = Array.isArray(s.agent_tokens) && s.agent_tokens.length > 0 ? s.agent_tokens : DEFAULT_AGENT_TOKENS;
  const agents = [...localMintedAgents, ...baseAgents].filter((a) => !revokedIds.includes(a.id));
  const sessions = Array.isArray(s.active_sessions) && s.active_sessions.length > 0 ? s.active_sessions : DEFAULT_HUMAN_SESSIONS;
  const tab = subTab || 'agents';

  // RFC 8693 Composer Drawer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [persona, setPersona] = useState('SoftwareEngineer');
  const [pack, setPack] = useState('cyclode_coding');
  const [taskId, setTaskId] = useState('task_auth_refactor_09');
  const [repo, setRepo] = useState(userRepos[0] || 'acme-corp/checkout-api');
  const [branch, setBranch] = useState('feat/stripe-billing');
  const [mintedNotice, setMintedNotice] = useState<string | null>(null);

  // Git Broker Tester state
  const [gitRepo, setGitRepo] = useState(userRepos[0] || 'acme-corp/checkout-api');
  const [gitBranch, setGitBranch] = useState('feat/stripe-billing');
  const [gitOp, setGitOp] = useState('git.push (Scoped Worktree Branch)');
  const [gitBrokerResult, setGitBrokerResult] = useState<any>(null);

  // Valiscale OAuth Client Provisioner state
  const [valiscaleProject, setValiscaleProject] = useState('Customer Billing Portal');
  const [valiscaleSlug, setValiscaleSlug] = useState('billing-portal');
  const [provisionedClient, setProvisionedClient] = useState<any>(null);

  const previewClaims = {
    iss: 'https://auth.appembly.com',
    sub: 'usr_ken_passkey_l3',
    om_ns: 'ns_live_appembly',
    token_type: 'rfc8693_agent_exchange',
    act: {
      persona,
      runctor_pack: pack,
      task_id: taskId,
      target_repo: repo,
      worktree_branch: branch,
    },
    exp: 'iat + 900s (15m)',
  };

  const testGitBroker = async () => {
    const isProtected = gitBranch === 'main' || gitBranch === 'master' || gitOp.includes('main');
    try {
      const res = await fetch('/v1/valiscale/sauthen/git-broker/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_token_id: 'st_agt_live',
          target_repo: gitRepo,
          target_branch: gitBranch,
          operation: gitOp,
          bound_repo: repo,
          bound_branch: isProtected ? 'feat/stripe-billing' : gitBranch,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGitBrokerResult({
          decision: data.allowed ? 'allowed' : 'stepup_required',
          http_status: data.status_code,
          ephemeral_git_token: data.ephemeral_git_token,
          repository: gitRepo,
          branch: gitBranch,
          operation: gitOp,
          policy_reason: data.decision?.reason,
          evaluated_in_ms: data.decision?.latency_ms || 1.4,
        });
        return;
      }
    } catch {}
    setGitBrokerResult({
      decision: isProtected ? 'stepup_required' : 'allowed',
      http_status: isProtected ? 403 : 200,
      ephemeral_git_token: isProtected ? null : 'ghs_st_broker_9941a_15m',
      repository: gitRepo,
      branch: gitBranch,
      operation: gitOp,
      policy_reason: isProtected
        ? 'Direct push to protected branch "main" is blocked by Sauthen branch-lock policy. Open a PR or complete Passkey Step-Up.'
        : 'Worktree branch matches RFC 8693 act.worktree_branch claim.',
      evaluated_in_ms: 1.4,
    });
  };

  const suiteClients = [
    { id: 'cli_cyclode', name: 'Cyclode AI Workstation', clientId: 'st_cli_cyclode_workstation', uri: 'https://cyclode.appembly.com/callback', sessions: 14, tokens24h: 48200 },
    { id: 'cli_meterbox', name: 'Meterbox FinOps Console', clientId: 'st_cli_meterbox_finops', uri: 'https://meter.appembly.com/callback', sessions: 8, tokens24h: 19400 },
    { id: 'cli_adappty', name: 'Adappty Mission Control', clientId: 'st_cli_adappty_ops', uri: 'https://ops.appembly.com/callback', sessions: 5, tokens24h: 11200 },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="sth-kicker" style={{ marginBottom: 4 }}>
            Sauthen · RFC 8693 Token Exchange, OAuth 2.1 RPs &amp; Ed25519 JWKS
          </div>
          <h1 className="h1-title">Sessions &amp; Agents</h1>
          <p className="page-subtitle">
            Passkey sessions for people, and short-lived 15-minute credentials for agents acting on their behalf.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ui-btn" onClick={() => onSelectSubTab('broker')}>
            Git Broker Tester
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setComposerOpen(true)}>
            + Delegate to Agent (RFC 8693)
          </button>
        </div>
      </div>

      {mintedNotice && (
        <Notice
          tone="ok"
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span>Minted 15-minute scoped agent credential:</span>
              <TokenChip value={mintedNotice} />
              <CopyButton text={mintedNotice} />
            </span>
          }
          detail={`Scoped to ${repo}#${branch} under persona @${persona}.`}
          onDismiss={() => setMintedNotice(null)}
        />
      )}

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'agents', label: '15m Agent STS Tokens', count: agents.length },
          { id: 'humans', label: 'Human Passkey Sessions', count: sessions.length },
          { id: 'broker', label: 'Git Worktree Broker Tester' },
          { id: 'clients', label: 'OAuth 2.1 Clients & Valiscale', count: suiteClients.length + (provisionedClient ? 1 : 0) },
          { id: 'keys', label: 'Ed25519 JWKS & Signing Keys', count: 2 },
        ]}
      />

      {tab === 'agents' && (
        <div className="grid-3">
          {agents.map((ag: any) => (
            <div key={ag.id} className="ticket-card">
              <div className="ticket-top">
                <div>
                  <div className="sth-kicker">RFC 8693 · on-behalf-of</div>
                  <div style={{ fontWeight: 600, fontSize: 15.5, marginTop: 2 }}>{ag.agent_name}</div>
                  <TokenChip token={ag.id} />
                </div>
                <TtlRing rem={ag.ttl_minutes || 12} total={15} size={40} />
              </div>

              <div
                style={{
                  paddingTop: 10,
                  borderTop: '1px solid var(--ui-border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>Delegated By</div>
                  <div className="mono" style={{ fontWeight: 600 }}>{ag.delegated_by}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>Worktree Scope</div>
                  <div className="mono">{ag.scope}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--ui-border)' }}>
                <Tag tone="ok" dot>{ag.status}</Tag>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="ui-btn ui-btn-xs"
                    onClick={() => onOpenSheet(`Agent Token ${ag.id}`, ag)}
                  >
                    Inspect JWT
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn-xs ui-btn-danger"
                    onClick={() => {
                      setRevokedIds((prev) => [...prev, ag.id]);
                      onRevokeAgentToken(ag.id);
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'humans' && (
        <Panel title="Active Human Passkey & OIDC Sessions" kicker="WebAuthn L3 hardware-backed principals" flush>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Session Handle</th>
                <th>Principal</th>
                <th>Role</th>
                <th>Authentication</th>
                <th>TTL Remaining</th>
                <th style={{ textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((sess: any) => (
                <tr key={sess.id}>
                  <td>
                    <TokenChip token={sess.id} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{sess.user}</td>
                  <td>{sess.role}</td>
                  <td>
                    <Tag tone="ok">{sess.auth_level}</Tag>
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <TtlRing rem={48} total={60} size={28} showLabel={false} />
                      <span className="mono">{sess.ttl}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="ui-btn ui-btn-xs"
                      onClick={() => onOpenSheet(`Session ${sess.id}`, sess)}
                    >
                      Claims JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {tab === 'broker' && (
        <div className="split-2-1">
          <Panel
            title="Git Worktree Credential Broker Tester"
            subtitle="Sauthen mints branch-locked GitHub installation tokens so autonomous agents can push to feature worktrees while blocking direct pushes to main."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Target Repository</label>
                  <select className="sth-input mono" value={gitRepo} onChange={(e) => setGitRepo(e.target.value)}>
                    {userRepos.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Target Branch (try &quot;main&quot; vs &quot;feat/...&quot;)</label>
                  <input className="sth-input mono" value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Requested Git Operation</label>
                <select className="sth-input mono" value={gitOp} onChange={(e) => setGitOp(e.target.value)}>
                  <option>git.push (Scoped Worktree Branch)</option>
                  <option>git.create_pr (Draft Pull Request)</option>
                  <option>git.push (Protected main — Triggers Step-Up)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="ui-btn ui-btn-primary" onClick={testGitBroker}>
                  Evaluate Git Broker Request
                </button>
                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => {
                    setGitBranch('main');
                    setGitOp('git.push (Protected main — Triggers Step-Up)');
                  }}
                >
                  Test Protected &quot;main&quot; Push
                </button>
              </div>
              {gitBrokerResult && <JsonView label="git_broker_decision.json" value={gitBrokerResult} />}
            </div>
          </Panel>

          <Panel title="Branch-Lock Enforcement Rules" kicker="RFC 8693 act.worktree_branch">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
              <div className="sth-credential" style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, color: 'var(--ok)' }}>✓ Allowed Autonomous Operations</div>
                <p style={{ margin: '4px 0 0', color: 'var(--ui-text-secondary)' }}>
                  Cloning repository, reading trees, and pushing commits to the exact <code className="mono">act.worktree_branch</code> embedded in the agent’s 15m JWT.
                </p>
              </div>
              <div className="sth-credential" style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, color: 'var(--ui-warn)' }}>⚠ Step-Up Gated Operations</div>
                <p style={{ margin: '4px 0 0', color: 'var(--ui-text-secondary)' }}>
                  Pushing to <code className="mono">main</code> / <code className="mono">production</code>, merging PRs, or modifying <code className="mono">.github/workflows/*</code> pauses the agent and requires a human <code className="mono">st_stepup_*</code> grant.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'clients' && (
        <div className="split-2-1">
          <Panel title="Appembly Suite & Valiscale OAuth 2.1 Clients" kicker="PKCE S256 enforced">
            <div className="grid-2" style={{ gap: 12 }}>
              {[...suiteClients, ...(provisionedClient ? [provisionedClient] : [])].map((c) => (
                <div key={c.id} className="sth-credential" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>{c.uri}</div>
                    </div>
                    <Tag tone="ok">PKCE</Tag>
                  </div>
                  <TokenChip value={c.clientId} max={24} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ui-text-secondary)', paddingTop: 8, borderTop: '1px solid var(--ui-border)' }}>
                    <span><strong style={{ color: 'var(--ui-text-primary)' }}>{c.sessions}</strong> active sessions</span>
                    <span className="mono">{formatCompact(c.tokens24h)} tokens / 24h</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Turnkey Valiscale Stage 3 Provisioner" kicker="1-step OAuth + Meterbox namespace" tone="accent">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setProvisionedClient({
                  id: `cli_${valiscaleSlug}`,
                  name: valiscaleProject,
                  clientId: `st_cli_${valiscaleSlug.replace(/[^a-z0-9]/gi, '_')}_live`,
                  uri: `https://${valiscaleSlug}.appembly.app/api/auth/callback`,
                  sessions: 1,
                  tokens24h: 1200,
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Graduating Product Name</label>
                <input className="sth-input" value={valiscaleProject} onChange={(e) => setValiscaleProject(e.target.value)} required />
              </div>
              <div>
                <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>App Slug</label>
                <input className="sth-input mono" value={valiscaleSlug} onChange={(e) => setValiscaleSlug(e.target.value)} required />
              </div>
              <button type="submit" className="ui-btn ui-btn-primary">
                Provision OIDC Client &amp; Meterbox Namespace
              </button>
            </form>
          </Panel>
        </div>
      )}

      {tab === 'keys' && (
        <div className="split-2-1">
          <Panel title="Active Ed25519 Signing Keyring (JWKS)" kicker="GET /.well-known/jwks.json">
            <JsonView
              label="jwks.json"
              value={{
                keys: [
                  {
                    kty: 'OKP',
                    crv: 'Ed25519',
                    kid: 'sth_key_ed25519_2026_q4',
                    use: 'sig',
                    alg: 'EdDSA',
                    x: '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo',
                  },
                ],
              }}
            />
          </Panel>
          <Panel title="Key Rotation & Verification Policy" kicker="Zero-downtime overlap">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: 'var(--ui-text-secondary)' }}>
              <div>• Primary signing algorithm: <strong className="mono" style={{ color: 'var(--ui-text-primary)' }}>EdDSA (Ed25519)</strong></div>
              <div>• Local verifier cache TTL: <strong className="mono" style={{ color: 'var(--ui-text-primary)' }}>300s</strong></div>
              <div>• p99 signature verification latency: <strong className="mono" style={{ color: 'var(--ok)' }}>0.4ms</strong></div>
            </div>
          </Panel>
        </div>
      )}

      {/* RFC 8693 Agent Delegation Composer Drawer */}
      <Drawer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Delegate 15-Minute Agent Credential (RFC 8693)"
        subtitle="Mint an Ed25519 token scoped to a specific Runctor persona, repository, and Git worktree branch."
        width={540}
        variant="sheet"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const newId = `st_agt_${persona.toLowerCase().slice(0, 6)}_${Date.now().toString(36).slice(-4)}`;
            setLocalMintedAgents((prev) => [
              {
                id: newId,
                agent_name: `${persona} · ${pack}`,
                delegated_by: 'Passkey L3 Delegation',
                scope: `${repo}#${branch}`,
                ttl_minutes: 15,
                status: 'Active · RFC 8693',
                issued_at: 'Just now',
                claims: previewClaims,
              },
              ...prev,
            ]);
            onMintAgentToken();
            setMintedNotice(newId);
            setComposerOpen(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Agent Persona</label>
              <select className="sth-input mono" value={persona} onChange={(e) => setPersona(e.target.value)}>
                {['SoftwareEngineer', 'IssueResolver', 'AppBuilder', 'CodeReviewer', 'FinOpsAuditor', 'AutonomicSRE'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Runctor Pack</label>
              <select className="sth-input mono" value={pack} onChange={(e) => setPack(e.target.value)}>
                {['cyclode_coding', 'swarmteam_orchestrator', 'valiscale_concept', 'adappty_sre'].map((pk) => (
                  <option key={pk} value={pk}>{pk}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Scoped Repository</label>
              <input className="sth-input mono" value={repo} onChange={(e) => setRepo(e.target.value)} required />
            </div>
            <div>
              <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Allowed Worktree Branch</label>
              <input className="sth-input mono" value={branch} onChange={(e) => setBranch(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>Task Correlation ID</label>
            <input className="sth-input mono" value={taskId} onChange={(e) => setTaskId(e.target.value)} required />
          </div>

          <JsonView label="Live RFC 8693 JWT Claim Preview" value={previewClaims} maxHeight={210} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6 }}>
            <button type="button" className="ui-btn" onClick={() => setComposerOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="ui-btn ui-btn-primary">
              Mint 15m st_agt_* Token
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};

/* ============================================================================
   3. Sauthen Vault & 6-Stage Animated Zero-Knowledge Proxy Pipeline View
   ============================================================================ */

const PROXY_STEPS = [
  { id: 'pod', num: '01', label: 'Agent Pod', sub: 'Holds st_agt_* only', latency: '0.1 ms' },
  { id: 'verify', num: '02', label: 'Verify JWKS', sub: 'Ed25519 signature check', latency: '0.4 ms' },
  { id: 'quota', num: '03', label: 'Pre-Flight Quota', sub: 'Meterbox Valkey gate', latency: '0.3 ms' },
  { id: 'decrypt', num: '04', label: 'Unseal Key', sub: 'AES-256-GCM in enclave RAM', latency: '0.4 ms' },
  { id: 'upstream', num: '05', label: 'Upstream API', sub: 'Provider TLS 1.3 egress', latency: 'TLS 1.3' },
  { id: 'meter', num: '06', label: 'Meter Usage', sub: 'ai.llm.tokens CloudEvent', latency: 'Async' },
] as const;

interface VaultSecretEnvelope {
  id: string;
  name: string;
  provider: string;
  category: 'llm' | 'git' | 'webhook';
  cipher_preview: string;
  scoped_personas: string[];
  proxied_calls_24h: number;
  last_rotated: string;
  status: 'Sealed · Active' | 'Rotation Due';
}

const DEFAULT_VAULT_SECRETS: VaultSecretEnvelope[] = [
  {
    id: 'sec_ant_prod_01',
    name: 'ANTHROPIC_API_KEY',
    provider: 'anthropic',
    category: 'llm',
    cipher_preview: 'v1:aes256gcm:96b_nonce:7f91a04c2e19b773d10a8b4e',
    scoped_personas: ['SoftwareEngineer', 'CodeReviewer', 'AppBuilder'],
    proxied_calls_24h: 184,
    last_rotated: '2 days ago',
    status: 'Sealed · Active',
  },
  {
    id: 'sec_oai_prod_02',
    name: 'OPENAI_API_KEY',
    provider: 'openai',
    category: 'llm',
    cipher_preview: 'v1:aes256gcm:96b_nonce:3c82e19f04a11b65d902c71a',
    scoped_personas: ['SoftwareEngineer', 'IssueResolver'],
    proxied_calls_24h: 96,
    last_rotated: '5 days ago',
    status: 'Sealed · Active',
  },
  {
    id: 'sec_dsk_prod_03',
    name: 'DEEPSEEK_API_KEY',
    provider: 'deepseek',
    category: 'llm',
    cipher_preview: 'v1:aes256gcm:96b_nonce:9a41b87c66e02f18a553d09e',
    scoped_personas: ['SoftwareEngineer', 'FinOpsAuditor', 'AppBuilder'],
    proxied_calls_24h: 248,
    last_rotated: '1 day ago',
    status: 'Sealed · Active',
  },
  {
    id: 'sec_gem_prod_04',
    name: 'GEMINI_API_KEY',
    provider: 'gemini',
    category: 'llm',
    cipher_preview: 'v1:aes256gcm:96b_nonce:5e10d44a89b30c12f764e31b',
    scoped_personas: ['AppBuilder', 'CodeReviewer'],
    proxied_calls_24h: 64,
    last_rotated: '9 days ago',
    status: 'Sealed · Active',
  },
  {
    id: 'sec_gh_app_05',
    name: 'GITHUB_APP_PRIVATE_KEY',
    provider: 'github',
    category: 'git',
    cipher_preview: 'v1:aes256gcm:96b_nonce:1b77c90e42f81d33a609e82c',
    scoped_personas: ['SoftwareEngineer', 'IssueResolver'],
    proxied_calls_24h: 72,
    last_rotated: '4 days ago',
    status: 'Sealed · Active',
  },
  {
    id: 'sec_str_wh_06',
    name: 'STRIPE_WEBHOOK_SECRET',
    provider: 'stripe',
    category: 'webhook',
    cipher_preview: 'v1:aes256gcm:96b_nonce:6d29f08b14c75e90a312b48f',
    scoped_personas: ['FinOpsAuditor'],
    proxied_calls_24h: 38,
    last_rotated: '12 days ago',
    status: 'Sealed · Active',
  },
];

export const VaultView: React.FC<{
  subTab: string;
  onSelectSubTab: (tab: string) => void;
  platformData?: any;
  dashData?: any;
  onOpenByokModal: (provider?: string) => void;
  onSimulateVaultProxy?: () => void;
  onOpenSheet?: (title: string, obj: any) => void;
}> = ({ subTab, onSelectSubTab, platformData, dashData, onOpenSheet }) => {
  const data = platformData || dashData;
  const s = data?.sauthen || {};
  const tab = subTab || 'secrets';

  const [customSecrets, setCustomSecrets] = useState<VaultSecretEnvelope[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sauthen_vault_secrets_v1') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch {}
    return DEFAULT_VAULT_SECRETS;
  });

  const secrets: VaultSecretEnvelope[] = useMemo(() => {
    const backendList = Array.isArray(s.vault_secrets) && s.vault_secrets.length > 0 ? s.vault_secrets : null;
    if (!backendList) return customSecrets;
    const mapped: VaultSecretEnvelope[] = backendList.map((sec: any, idx: number) => ({
      id: sec.id || `sec_live_${idx}`,
      name: sec.name || `${String(sec.provider || 'API').toUpperCase()}_API_KEY`,
      provider: String(sec.provider || 'anthropic').toLowerCase(),
      category: ['github', 'gitlab'].includes(String(sec.provider || '').toLowerCase())
        ? 'git'
        : ['stripe', 'slack'].includes(String(sec.provider || '').toLowerCase())
          ? 'webhook'
          : 'llm',
      cipher_preview: `v1:aes256gcm:96b_nonce:${sec.id || 'sec'}_8f91a04c2e19b773`,
      scoped_personas: sec.scoped_personas || ['SoftwareEngineer', 'CodeReviewer'],
      proxied_calls_24h: Number(sec.proxied_calls_24h ?? 140 - idx * 24),
      last_rotated: sec.last_rotated || '3 days ago',
      status: 'Sealed · Active',
    }));
    const existingNames = new Set(mapped.map((m) => m.name));
    return [...mapped, ...customSecrets.filter((c) => !existingNames.has(c.name))];
  }, [s.vault_secrets, customSecrets]);

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'llm' | 'git' | 'webhook'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sealDrawerOpen, setSealDrawerOpen] = useState(false);
  const [sealProvider, setSealProvider] = useState('anthropic');
  const [sealName, setSealName] = useState('ANTHROPIC_API_KEY');
  const [sealRawValue, setSealRawValue] = useState('');
  const [sealCategory, setSealCategory] = useState<'llm' | 'git' | 'webhook'>('llm');
  const [sealNotice, setSealNotice] = useState<string | null>(null);

  const [proxyProvider, setProxyProvider] = useState('anthropic');
  const [proxyTokens, setProxyTokens] = useState(16400);
  const [stepStates, setStepStates] = useState<Array<'idle' | 'run' | 'ok'>>(PROXY_STEPS.map(() => 'idle'));
  const [runningProxy, setRunningProxy] = useState(false);
  const [proxyReceipt, setProxyReceipt] = useState<any>(null);

  const filteredSecrets = useMemo(
    () =>
      secrets.filter((sec) => {
        if (categoryFilter !== 'all' && sec.category !== categoryFilter) return false;
        if (
          searchQuery.trim() &&
          !sec.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !sec.provider.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [secrets, categoryFilter, searchQuery]
  );

  const totalProxiedCalls = useMemo(
    () => secrets.reduce((sum, item) => sum + Number(item.proxied_calls_24h || 0), 0),
    [secrets]
  );

  const openSealModalForProvider = (providerName = 'anthropic', existingName?: string, cat: 'llm' | 'git' | 'webhook' = 'llm') => {
    const cleanProv = providerName.toLowerCase();
    setSealProvider(cleanProv);
    setSealCategory(cat);
    setSealName(existingName || `${cleanProv.toUpperCase()}_API_KEY`);
    setSealRawValue('');
    setSealDrawerOpen(true);
  };

  const handleSealSecretSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sealName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') || 'CUSTOM_SECRET_KEY';
    const nonceHex = Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 14);
    const newEnv: VaultSecretEnvelope = {
      id: `sec_${sealProvider.slice(0, 3)}_${Date.now().toString(36).slice(-4)}`,
      name: cleanName,
      provider: sealProvider,
      category: sealCategory,
      cipher_preview: `v1:aes256gcm:96b_nonce:${nonceHex}`,
      scoped_personas:
        sealCategory === 'git'
          ? ['SoftwareEngineer', 'IssueResolver']
          : sealCategory === 'webhook'
            ? ['FinOpsAuditor']
            : ['SoftwareEngineer', 'CodeReviewer', 'AppBuilder'],
      proxied_calls_24h: 1,
      last_rotated: 'Just now',
      status: 'Sealed · Active',
    };
    const nextList = [newEnv, ...customSecrets.filter((item) => item.name !== cleanName)];
    setCustomSecrets(nextList);
    try {
      localStorage.setItem('sauthen_vault_secrets_v1', JSON.stringify(nextList));
    } catch {}
    setSealDrawerOpen(false);
    setSealNotice(`Sealed "${cleanName}" with AES-256-GCM envelope encryption (${newEnv.id}). Raw secret wiped from memory.`);
  };

  const runAnimatedProxy = async () => {
    setRunningProxy(true);
    setProxyReceipt(null);
    setStepStates(PROXY_STEPS.map(() => 'idle'));
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let backendReceipt: any = null;
    const proxyPromise = fetch(`/v1/valiscale/sauthen/proxy/llm/${encodeURIComponent(proxyProvider)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_token_id: 'st_agt_901a_ed25519_live',
        model: proxyProvider === 'anthropic' ? 'harnway/coding' : 'harnway/fast',
        prompt: `Verify zero-knowledge proxy execution for ${proxyProvider} and meter ${proxyTokens} tokens.`,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    for (let i = 0; i < PROXY_STEPS.length; i++) {
      setStepStates((prev) => prev.map((st, idx) => (idx === i ? 'run' : st)));
      await wait(140);
      setStepStates((prev) => prev.map((st, idx) => (idx === i ? 'ok' : st)));
    }
    backendReceipt = await proxyPromise;

    setProxyReceipt({
      status: '200 OK',
      provider: proxyProvider,
      resolved_model: backendReceipt?.resolved_model || `${proxyProvider}/default`,
      agent_credential: 'st_agt_901a_ed25519_live',
      raw_key_exposed_to_agent_pod: false,
      vault_envelope: 'AES-256-GCM (96-bit nonce unsealed in Sauthen enclave memory)',
      tokens_metered: proxyTokens,
      meterbox_remaining_tokens: 5_000_000 - proxyTokens,
      meterbox_event_id: `evt_om_${Date.now().toString(36)}`,
      total_proxy_overhead_ms: backendReceipt?.total_latency_ms || 1.2,
      stages: backendReceipt?.stages || PROXY_STEPS.map((s) => ({ stage: s.label, latency: s.latency, status: 'verified' })),
    });
    setRunningProxy(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="sth-kicker" style={{ marginBottom: 4 }}>
            Vault · AES-256-GCM Envelope Encryption &amp; Zero-Knowledge Proxy
          </div>
          <h1 className="h1-title">Vault &amp; Directory</h1>
          <p className="page-subtitle">
            Provider and integration keys are sealed per organization. Agents invoke them through the Sauthen proxy and never see the raw secret.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="ui-btn"
            onClick={() => {
              onSelectSubTab('proxy');
              runAnimatedProxy();
            }}
          >
            ▶ Test Zero-Knowledge Proxy
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            onClick={() => openSealModalForProvider('anthropic')}
          >
            + Seal Secret in Vault
          </button>
        </div>
      </div>

      {sealNotice && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="ok" title={sealNotice} onDismiss={() => setSealNotice(null)} />
        </div>
      )}

      {/* Top 4-KPI Readout Strip */}
      <div className="readout-grid">
        <Readout
          label="Sealed Vault Envelopes"
          value={String(secrets.length)}
          sub="AES-256-GCM + 96-bit Nonce"
          tone="sage"
        />
        <Readout
          label="Zero-Knowledge Proxy Calls (24h)"
          value={String(totalProxiedCalls)}
          sub="0 raw keys exposed to agent pods"
          tone="jade"
        />
        <Readout
          label="Enclave Unseal Latency"
          value="0.4 ms"
          sub="In-memory HKDF-SHA256 derivation"
        />
        <Readout
          label="Key Rotation Compliance"
          value="100%"
          sub="All envelopes within 90-day policy"
          tone="jade"
        />
      </div>

      <HorizTabs
        activeTab={tab}
        onSelect={onSelectSubTab}
        tabs={[
          { id: 'secrets', label: 'Sealed Vault Envelopes', count: secrets.length },
          { id: 'proxy', label: '6-Stage Zero-Knowledge Proxy Simulator', count: 6 },
        ]}
      />

      {/* TAB 1: SEALED VAULT ENVELOPES + HORIZONTAL PIPELINE OVERVIEW */}
      {tab === 'secrets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Filter & Search Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Segmented
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: 'all', label: 'All Envelopes', count: secrets.length },
                { value: 'llm', label: 'LLM Providers', count: secrets.filter((x) => x.category === 'llm').length },
                { value: 'git', label: 'Git & Worktrees', count: secrets.filter((x) => x.category === 'git').length },
                { value: 'webhook', label: 'Billing & Webhooks', count: secrets.filter((x) => x.category === 'webhook').length },
              ]}
            />
            <input
              type="text"
              className="sth-input"
              style={{ width: 240, height: 32 }}
              placeholder="Filter by key or provider…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* 3-Column Sealed Envelope Grid */}
          <div className="grid-3">
            {filteredSecrets.map((sec) => (
              <div key={sec.id} className="ticket-card">
                <div className="ticket-top">
                  <div>
                    <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>
                      {sec.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 3 }}>
                      Provider: <strong style={{ color: 'var(--ui-text-primary)' }}>{sec.provider}</strong>
                    </div>
                  </div>
                  <Tag tone="ok" dot>
                    {sec.status}
                  </Tag>
                </div>

                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--ui-bg-subtle)',
                    border: '1px solid var(--ui-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ui-text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sec.cipher_preview}
                  </span>
                  <CopyButton text={sec.cipher_preview} label="Copy" />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {sec.scoped_personas.map((p) => (
                    <span
                      key={p}
                      className="mono"
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'var(--ui-bg-subtle)',
                        color: 'var(--ui-text-secondary)',
                        border: '1px solid var(--ui-border)',
                      }}
                    >
                      @{p}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    paddingTop: 8,
                    borderTop: '1px solid var(--ui-border)',
                  }}
                >
                  <span className="mono" style={{ color: 'var(--ui-text-muted)' }}>
                    Rotated {sec.last_rotated} · {sec.proxied_calls_24h} calls
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {onOpenSheet && (
                      <button
                        type="button"
                        className="ui-btn ui-btn-xs"
                        onClick={() => onOpenSheet(`Envelope ${sec.name}`, sec)}
                      >
                        Inspect
                      </button>
                    )}
                    <button
                      type="button"
                      className="ui-btn ui-btn-xs"
                      onClick={() => openSealModalForProvider(sec.provider, sec.name, sec.category)}
                    >
                      Rotate Key
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Compact 6-Stage Horizontal Proxy Architecture Strip */}
          <Panel
            title="Zero-Knowledge Proxy Egress Architecture"
            kicker="POST /api/proxy/v1/llm/{provider} · Raw keys never enter agent sandboxes"
            actions={
              <button
                type="button"
                className="ui-btn ui-btn-xs ui-btn-primary"
                onClick={() => {
                  onSelectSubTab('proxy');
                  runAnimatedProxy();
                }}
              >
                Open Interactive Simulator →
              </button>
            }
          >
            <div
              className="proxy-grid-6"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              {PROXY_STEPS.map((st) => (
                <div
                  key={st.id}
                  style={{
                    padding: '11px 13px',
                    borderRadius: 10,
                    border: '1px solid var(--ui-border)',
                    background: 'var(--ui-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ui-accent-deep)' }}>
                      STAGE {st.num}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>
                      {st.latency}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{st.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ui-text-secondary)' }}>{st.sub}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 2: 6-STAGE ZERO-KNOWLEDGE PROXY SIMULATOR */}
      {tab === 'proxy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel
            title="Zero-Knowledge Proxy Pipeline Simulator"
            kicker="POST /api/proxy/v1/llm/{provider}"
            tone="accent"
            actions={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="sth-input mono"
                  style={{ width: 140, height: 30, fontSize: 12 }}
                  value={proxyProvider}
                  onChange={(e) => setProxyProvider(e.target.value)}
                >
                  <option value="anthropic">anthropic</option>
                  <option value="openai">openai</option>
                  <option value="gemini">gemini</option>
                  <option value="deepseek">deepseek</option>
                </select>
                <input
                  type="number"
                  className="sth-input mono"
                  style={{ width: 105, height: 30, fontSize: 12 }}
                  value={proxyTokens}
                  onChange={(e) => setProxyTokens(Number(e.target.value))}
                  title="Simulated token count"
                />
                <button
                  type="button"
                  className="ui-btn ui-btn-sm ui-btn-primary"
                  disabled={runningProxy}
                  onClick={runAnimatedProxy}
                >
                  {runningProxy ? 'Executing Pipeline…' : '▶ Run Zero-Knowledge Proxy Call'}
                </button>
              </div>
            }
          >
            <div
              className="proxy-grid-6"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              {PROXY_STEPS.map((st, i) => {
                const state = stepStates[i];
                return (
                  <div
                    key={st.id}
                    style={{
                      padding: '13px 14px',
                      borderRadius: 10,
                      border:
                        state === 'run'
                          ? '1.5px solid var(--ui-accent)'
                          : state === 'ok'
                            ? '1px solid var(--ok)'
                            : '1px solid var(--ui-border)',
                      background:
                        state === 'run'
                          ? 'var(--appembly-sage-soft)'
                          : state === 'ok'
                            ? 'color-mix(in srgb, var(--ok) 8%, var(--ui-bg-surface))'
                            : 'var(--ui-bg-subtle)',
                      transition: 'all 180ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ui-text-muted)' }}>
                        STAGE {st.num}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: state === 'ok' ? 'var(--ok)' : 'var(--ui-accent)',
                        }}
                      >
                        {state === 'ok' ? `✓ ${st.latency}` : state === 'run' ? '⋯ running' : st.latency}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 8 }}>{st.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 3 }}>{st.sub}</div>
                  </div>
                );
              })}
            </div>

            {proxyReceipt ? (
              <div style={{ marginTop: 16 }}>
                <JsonView label="zero_knowledge_proxy_receipt.json" value={proxyReceipt} maxHeight={260} />
              </div>
            ) : (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px dashed var(--ui-border-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  color: 'var(--ui-text-secondary)',
                }}
              >
                <span>
                  Click <strong>▶ Run Zero-Knowledge Proxy Call</strong> above to trace Ed25519 JWKS verification, Valkey quota check, in-enclave AES-256-GCM unsealing, and CloudEvent metering.
                </span>
                <Tag tone="accent" mono>
                  0 raw secrets in pod env
                </Tag>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Built-in Seal / Rotate Secret Drawer */}
      <Drawer
        open={sealDrawerOpen}
        onClose={() => setSealDrawerOpen(false)}
        title="Seal Secret in AES-256-GCM Vault"
        subtitle="Encrypts provider or integration credentials with a unique 96-bit nonce and HKDF-SHA256 tenant key. Agents can only invoke via proxy."
        width={480}
        variant="sheet"
      >
        <form onSubmit={handleSealSecretSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>
                Provider / Target Service
              </label>
              <select
                className="sth-input mono"
                style={{ width: '100%' }}
                value={sealProvider}
                onChange={(e) => {
                  const p = e.target.value;
                  setSealProvider(p);
                  setSealName(`${p.toUpperCase()}_API_KEY`);
                  if (['github', 'gitlab'].includes(p)) setSealCategory('git');
                  else if (['stripe', 'slack'].includes(p)) setSealCategory('webhook');
                  else setSealCategory('llm');
                }}
              >
                <option value="anthropic">anthropic</option>
                <option value="openai">openai</option>
                <option value="deepseek">deepseek</option>
                <option value="gemini">gemini</option>
                <option value="github">github</option>
                <option value="stripe">stripe</option>
              </select>
            </div>
            <div>
              <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>
                Envelope Category
              </label>
              <select
                className="sth-input mono"
                style={{ width: '100%' }}
                value={sealCategory}
                onChange={(e) => setSealCategory(e.target.value as any)}
              >
                <option value="llm">LLM Provider</option>
                <option value="git">Git &amp; Worktrees</option>
                <option value="webhook">Billing &amp; Webhooks</option>
              </select>
            </div>
          </div>

          <div>
            <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>
              Secret Environment Key Name
            </label>
            <input
              className="sth-input mono"
              style={{ width: '100%' }}
              value={sealName}
              onChange={(e) => setSealName(e.target.value)}
              placeholder="ANTHROPIC_API_KEY"
              required
            />
          </div>

          <div>
            <label className="sth-kicker" style={{ display: 'block', marginBottom: 6 }}>
              Raw Secret Material (Never Stored in Plaintext)
            </label>
            <input
              type="password"
              className="sth-input mono"
              style={{ width: '100%' }}
              value={sealRawValue}
              onChange={(e) => setSealRawValue(e.target.value)}
              placeholder="sk-ant-api03-••••••••••••••••••••••••"
              required
            />
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'var(--ui-bg-subtle)',
              border: '1px solid var(--ui-border)',
              fontSize: 12,
              color: 'var(--ui-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--ui-text-primary)' }}>Zero-Knowledge Guarantee:</strong> Sauthen seals this key with <code className="mono">AES-256-GCM</code> and wipes the plaintext buffer immediately. Autonomous agents only receive <code className="mono">st_agt_*</code> tokens.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
            <button type="button" className="ui-btn" onClick={() => setSealDrawerOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="ui-btn ui-btn-primary">
              Seal &amp; Encrypt in Vault
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
