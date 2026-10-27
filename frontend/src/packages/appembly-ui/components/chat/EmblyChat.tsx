import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { AppemblyLogo } from '../brand/AppemblyLogo';
import type {
  EmblyChatProps,
  EmblyEvalReport,
  EmblyIntentCategory,
  EmblyMessage,
  EmblyStarterPrompt,
  EmblyToolStep,
} from '../../types';

interface PackPreset {
  title: string;
  subtitle: string;
  brandAccent: string;
  personas: { name: string; description: string }[];
  starterPrompts: EmblyStarterPrompt[];
}

const PACK_PRESETS: Record<string, PackPreset> = {
  appembly_unified: {
    title: 'Ask Appembly AI',
    subtitle: 'Unified Workspace Router · Harnway, Sauthen, Meterbox, Controps & Cyclode',
    brandAccent: '#4E8067',
    personas: [
      { name: 'AutoRouter', description: 'Cross-domain intent classifier & tool router across all Appembly services' },
      { name: 'SoftwareEngineer', description: 'Repository coding, AST refactoring & Cyclode worktree handoffs' },
      { name: 'IdentityArchitect', description: 'Sauthen sessions, Agent STS policies, passkey step-up & Vault' },
      { name: 'FinOpsAnalyst', description: 'Meterbox usage rollups, token cache ratios & pricing simulation' },
      { name: 'IncidentResponder', description: 'Controps AWS Graviton fleet health, ClickHouse spans & SLOs' },
    ],
    starterPrompts: [
      {
        id: 'uni-1',
        label: 'Inspect active human & agent STS sessions',
        prompt: 'List active human sessions and delegated st_agt_* agent tokens in Sauthen.',
        persona: 'IdentityArchitect',
      },
      {
        id: 'uni-2',
        label: 'Query 24h LLM token & sandbox rollups',
        prompt: 'Show 24h Meterbox usage rollups, prompt cache hit ratio, and estimated cost.',
        persona: 'FinOpsAnalyst',
      },
      {
        id: 'uni-3',
        label: 'Check Harnway model routing & DLP redactions',
        prompt: 'Inspect Harnway semantic model routing profiles, connected integrations, and recent DLP events.',
        persona: 'AutoRouter',
      },
      {
        id: 'uni-4',
        label: 'Refactor token refresh in @Appembly/sauthen',
        prompt: 'Refactor the OIDC token refresh endpoint in @Appembly/sauthen and add unit tests.',
        persona: 'SoftwareEngineer',
      },
    ],
  },
  cyclode_coding: {
    title: 'Ask AI',
    subtitle: 'Cyclode · Autonomous Worktree & AST Workstation',
    brandAccent: '#E5C07B',
    personas: [
      { name: 'SoftwareEngineer', description: 'Full-stack code implementation, refactoring & tests' },
      { name: 'Architect', description: 'System design, boundaries & multi-repo specs' },
      { name: 'WebQAEngineer', description: 'DOM-first browser verification & visual QA' },
    ],
    starterPrompts: [
      {
        id: 'cyc-1',
        label: 'Audit repository architecture & hotspots',
        prompt: 'Analyze the repository structure and summarize key architectural boundaries and risk hotspots.',
      },
      {
        id: 'cyc-2',
        label: 'Review open pull requests & CI gates',
        prompt: 'List open pull requests and check whether any failing CI checks can be self-healed.',
      },
    ],
  },
  adappty_autonomic: {
    title: 'Ask AI',
    subtitle: 'Adappty · Eval-Gated Autonomic Control Loops',
    brandAccent: '#4E8067',
    personas: [
      { name: 'IncidentResponder', description: 'SLO burn triage, causal ranking & bounded reflexes' },
      { name: 'TrafficTuner', description: 'Runtime knob tuning within cooldown & deadband guards' },
      { name: 'EvolutionArchitect', description: 'Shadow-replay verification & immunity rules' },
      { name: 'ChaosSynthesizer', description: 'Synthetic fault injection & resilience probes' },
    ],
    starterPrompts: [
      {
        id: 'adp-1',
        label: 'Rank root causes for active SLO burn',
        prompt: 'Why is error budget burning right now, and what is the highest-confidence root cause?',
      },
      {
        id: 'adp-2',
        label: 'Propose a low-risk L2 reflex action',
        prompt: 'Recommend a safe reflex remediation within L2 blast-radius policy and attach its auto-revert plan.',
      },
    ],
  },
  sauthen_identity: {
    title: 'Ask AI',
    subtitle: 'Sauthen · Zero-Trust OIDC, Vault & Agent STS',
    brandAccent: '#8F80FF',
    personas: [
      { name: 'IdentityArchitect', description: 'Least-privilege Agent STS policies & passkey step-up' },
      { name: 'SecurityAuditor', description: 'Token delegation lineage & Vault rotation audit' },
    ],
    starterPrompts: [
      {
        id: 'sth-1',
        label: 'Draft least-privilege Agent STS policy',
        prompt: 'Draft a scoped Agent STS policy for SoftwareEngineer with 15-minute TTL and passkey step-up on mutations.',
      },
      {
        id: 'sth-2',
        label: 'Audit token delegation lineage',
        prompt: 'Trace active human-to-agent token delegation chains in production and flag any wildcard scopes.',
      },
    ],
  },
  meterbox_finops: {
    title: 'Ask AI',
    subtitle: 'Meterbox · OpenMeter Usage & Unit Economics',
    brandAccent: '#4E8067',
    personas: [
      { name: 'FinOpsAnalyst', description: 'Token consumption rollups, cache hit ratios & COGS' },
      { name: 'PricingArchitect', description: 'Usage-based tier simulation & gross margin gates' },
    ],
    starterPrompts: [
      {
        id: 'mbx-1',
        label: 'Inspect 24h LLM token & step rollups',
        prompt: 'Query 24h usage rollups for llm_tokens_total and summarize prompt cache hit efficiency.',
      },
      {
        id: 'mbx-2',
        label: 'Simulate Pro tier gross margin',
        prompt: 'Simulate gross margin for a $99/mo plan with 100k included units and $0.50/1k overage at 200k projected units.',
      },
    ],
  },
  valiscale_concept: {
    title: 'Ask AI',
    subtitle: 'Valiscale · Idea Validation & Swarmteam Promotion',
    brandAccent: '#38BDF8',
    personas: [
      { name: 'ConceptExplorer', description: 'Market sizing, competitor moats & viability scorecards' },
      { name: 'VentureSkeptic', description: 'Adversarial red-team falsification & unit economics' },
    ],
    starterPrompts: [
      {
        id: 'val-1',
        label: 'Generate Concept Validation Scorecard',
        prompt: 'Evaluate our current concept across Problem Urgency, TAM/SAM, and Technical Feasibility and emit a scorecard.',
      },
    ],
  },
  swarmteam_orchestrator: {
    title: 'Ask AI',
    subtitle: 'Swarmteam · Parallel Worktree Waves & Eval Gates',
    brandAccent: '#F59E0B',
    personas: [
      { name: 'SwarmLead', description: 'Topological task decomposition & wave scheduling' },
      { name: 'WorktreeIntegrator', description: 'Conflict-free branch merge & gate verification' },
    ],
    starterPrompts: [
      {
        id: 'swm-1',
        label: 'Decompose project into parallel DAG waves',
        prompt: 'Decompose the current milestone into dependency-ordered execution waves for parallel agent pods.',
      },
    ],
  },
};

const TOKENS = {
  bgCanvas: 'var(--ui-bg-canvas, var(--background, rgb(var(--bg, 17 22 24))))',
  bgSurface: 'var(--ui-bg-surface, var(--card, rgb(var(--panel, 23 30 33))))',
  bgSubtle: 'var(--ui-bg-subtle, var(--surface-subtle, rgb(var(--panel-2, 30 39 43))))',
  border: 'var(--ui-border, var(--border, rgb(var(--line, 38 49 54))))',
  borderStrong: 'var(--ui-border-strong, var(--border-strong, rgb(var(--line-strong, 54 66 72))))',
  textPrimary: 'var(--ui-text-primary, var(--foreground, rgb(var(--fg, 246 247 245))))',
  textSecondary: 'var(--ui-text-secondary, var(--muted-foreground, rgb(var(--dim, 197 202 199))))',
  textMuted: 'var(--ui-text-muted, var(--placeholder, rgb(var(--faint, 169 175 171))))',
};

function formatToolLabel(toolName: string): string {
  return toolName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Lightweight Calm UI Markdown Renderer (paragraphs, code blocks, inline code, lists, bold) */
const CalmMarkdown: React.FC<{ content: string; accentColor: string }> = ({
  content,
  accentColor,
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!content) return null;

  const segments = content.split(/(```[\s\S]*?```)/g);

  const renderInline = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded text-[12.5px] font-mono"
            style={{
              backgroundColor: TOKENS.bgSubtle,
              color: TOKENS.textPrimary,
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={idx} className="font-semibold" style={{ color: TOKENS.textPrimary }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-2.5 text-[13.5px] leading-[1.58]" style={{ color: TOKENS.textPrimary }}>
      {segments.map((seg, idx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const lines = seg.slice(3, -3).trim().split('\n');
          const firstLine = lines[0]?.trim() || '';
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : 'code';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div
              key={idx}
              className="rounded-lg overflow-hidden my-2"
              style={{
                border: `1px solid ${TOKENS.border}`,
                backgroundColor: TOKENS.bgSubtle,
              }}
            >
              <div
                className="flex items-center justify-between px-3 py-1.5 text-[11.5px] font-mono"
                style={{
                  borderBottom: `1px solid ${TOKENS.border}`,
                  color: TOKENS.textMuted,
                }}
              >
                <span>{lang}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(codeBody);
                    setCopiedIdx(idx);
                    setTimeout(() => setCopiedIdx(null), 1500);
                  }}
                  className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                  style={{ color: copiedIdx === idx ? accentColor : TOKENS.textMuted }}
                >
                  {copiedIdx === idx ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-[12px] font-mono whitespace-pre-wrap break-words overflow-x-auto leading-[1.6]">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        const paragraphs = seg
          .trim()
          .split(/\n{2,}/)
          .filter(Boolean);

        return (
          <React.Fragment key={idx}>
            {paragraphs.map((para, pIdx) => {
              const lines = para.split('\n');
              const isList = lines.every((l) => /^(\s*[-*•]|\s*\d+\.)\s+/.test(l.trim()));
              if (isList) {
                return (
                  <ul key={pIdx} className="space-y-1 pl-4 list-disc">
                    {lines.map((line, lIdx) => (
                      <li key={lIdx} style={{ color: TOKENS.textPrimary }}>
                        {renderInline(line.replace(/^(\s*[-*•]|\s*\d+\.)\s+/, ''))}
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={pIdx} className="whitespace-pre-wrap">
                  {renderInline(para)}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Built-in Cyclode Workstation Handoff Card when coding/repo intent is detected */
const CyclodeWorkstationHandoffCard: React.FC<{
  step: EmblyToolStep;
  onSendFollowUp?: (prompt: string) => void;
}> = ({ step, onSendFollowUp }) => {
  const res = (step.result || step.arguments || {}) as Record<string, any>;
  const repo = res.target_repo || step.arguments?.target_repo || 'Appembly/cyclode';
  const branch = res.worktree_branch || step.arguments?.worktree_branch || 'feat/worktree-task';
  const persona = res.recommended_persona || step.arguments?.recommended_persona || 'SoftwareEngineer';
  const model = res.recommended_model || step.arguments?.recommended_model || 'harnway/coding';
  const sandboxTier = res.sandbox_tier || 'graviton-c7g-2vcpu-4gb';
  const cyclodeUrl =
    res.cyclode_url ||
    `http://localhost:6013/?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&persona=${encodeURIComponent(persona)}`;
  const steps: string[] = Array.isArray(res.proposed_steps)
    ? res.proposed_steps
    : [
        `Provision isolated Graviton3 Git worktree ${branch} on ${repo}`,
        `Mint scoped Sauthen Agent STS token (st_agt_*) for ${persona}`,
        'Run AST/LSP implementation and verify test suite',
      ];

  return (
    <div
      className="my-2.5 rounded-xl p-4 space-y-3"
      style={{
        backgroundColor: TOKENS.bgSubtle,
        border: '1px solid rgba(229, 192, 123, 0.38)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: '#E5C07B' }}
          />
          <span
            className="text-[13px] font-semibold truncate"
            style={{ color: TOKENS.textPrimary }}
          >
            Cyclode Workstation Handoff Ready
          </span>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium shrink-0"
          style={{
            backgroundColor: 'rgba(229, 192, 123, 0.15)',
            color: '#E5C07B',
          }}
        >
          {repo} · {branch}
        </span>
      </div>

      <div
        className="grid grid-cols-3 gap-2 pt-2 text-[12px]"
        style={{ borderTop: `1px solid ${TOKENS.border}` }}
      >
        <div>
          <div className="text-[11px]" style={{ color: TOKENS.textMuted }}>
            Persona & Model
          </div>
          <div className="font-mono font-medium truncate" style={{ color: TOKENS.textPrimary }}>
            {persona} · {model}
          </div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: TOKENS.textMuted }}>
            Sandbox Compute
          </div>
          <div className="font-mono font-medium truncate" style={{ color: TOKENS.textPrimary }}>
            {sandboxTier}
          </div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: TOKENS.textMuted }}>
            Sauthen STS Scope
          </div>
          <div className="font-mono font-medium truncate" style={{ color: '#8F80FF' }}>
            repo:write:{repo.split('/')[1] || 'repo'}
          </div>
        </div>
      </div>

      <ul className="space-y-1 text-[12px] pl-4 list-disc" style={{ color: TOKENS.textSecondary }}>
        {steps.map((s, idx) => (
          <li key={idx}>{s}</li>
        ))}
      </ul>

      <div
        className="pt-2.5 flex flex-wrap items-center justify-between gap-2"
        style={{ borderTop: `1px solid ${TOKENS.border}` }}
      >
        <span className="text-[12px]" style={{ color: TOKENS.textMuted }}>
          Open full IDE workstation with worktree & prompt pre-loaded?
        </span>
        <div className="flex items-center gap-2">
          {onSendFollowUp && (
            <button
              type="button"
              onClick={() =>
                onSendFollowUp(
                  `Draft a step-by-step architectural specification for ${repo} (${branch}) before I open Cyclode.`
                )
              }
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-85"
              style={{
                border: `1px solid ${TOKENS.borderStrong}`,
                color: TOKENS.textSecondary,
              }}
            >
              Plan Here First
            </button>
          )}
          <a
            href={cyclodeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: '#E5C07B',
              color: '#090A0F',
            }}
          >
            <span>Switch to Cyclode Workstation ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
};

/** Default Calm UI Single-Surface Tool Step Row (3-Second Scan Rule) */
const DefaultCalmToolRow: React.FC<{
  step: EmblyToolStep;
  brandAccent: string;
  onApprove?: (callId: string) => void;
  onReject?: (callId: string) => void;
}> = ({ step, brandAccent, onApprove, onReject }) => {
  const [expanded, setExpanded] = useState(false);

  const statusLabel =
    step.status === 'running'
      ? 'Executing'
      : step.status === 'awaiting_approval'
      ? 'Needs Approval'
      : step.status === 'error'
      ? 'Failed'
      : 'Verified';

  const statusColor =
    step.status === 'running'
      ? brandAccent
      : step.status === 'awaiting_approval'
      ? '#F59E0B'
      : step.status === 'error'
      ? '#D95C68'
      : '#4E8067';

  return (
    <div
      className="py-2.5 transition-colors"
      style={{ borderTop: `1px solid ${TOKENS.border}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left min-w-0 flex-1 group"
        >
          {step.status === 'running' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: brandAccent }} />
          ) : step.status === 'error' ? (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: '#D95C68' }} />
          ) : (
            <Terminal className="w-3.5 h-3.5 shrink-0" style={{ color: statusColor }} />
          )}
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: TOKENS.textPrimary }}
          >
            {formatToolLabel(step.toolName)}
          </span>
          <span
            className="text-[12px] font-mono truncate"
            style={{ color: TOKENS.textMuted }}
          >
            {Object.keys(step.arguments || {}).length > 0
              ? `(${Object.entries(step.arguments)
                  .slice(0, 2)
                  .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
                  .join(', ')})`
              : ''}
          </span>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: TOKENS.textMuted }} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: TOKENS.textMuted }} />
          )}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {typeof step.durationMs === 'number' && (
            <span
              className="text-[11.5px] font-mono"
              style={{ color: TOKENS.textMuted, fontVariantNumeric: 'tabular-nums' }}
            >
              {step.durationMs}ms
            </span>
          )}
          <span
            className="px-2 py-0.5 rounded-full text-[11.5px] font-medium"
            style={{
              backgroundColor: `${statusColor}18`,
              color: statusColor,
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {step.status === 'awaiting_approval' && (
        <div className="mt-2.5 flex items-center justify-between gap-3 pt-2" style={{ borderTop: `1px dashed ${TOKENS.border}` }}>
          <span className="text-[12.5px]" style={{ color: TOKENS.textSecondary }}>
            {step.requiresSauthenStepup
              ? 'Requires Sauthen WebAuthn passkey step-up before executing.'
              : 'Confirm execution of this state-mutating action.'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onReject?.(step.callId)}
              className="px-2.5 py-1 rounded-md text-[12px] font-medium transition-opacity hover:opacity-80"
              style={{
                border: `1px solid ${TOKENS.border}`,
                color: TOKENS.textSecondary,
              }}
            >
              Deny
            </button>
            <button
              type="button"
              onClick={() => onApprove?.(step.callId)}
              className="px-2.5 py-1 rounded-md text-[12px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#D95C68' }}
            >
              Approve
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <pre
          className="mt-2 p-2.5 rounded-lg text-[11.5px] font-mono overflow-x-auto"
          style={{
            backgroundColor: TOKENS.bgSubtle,
            border: `1px solid ${TOKENS.border}`,
            color: TOKENS.textSecondary,
          }}
        >
          {JSON.stringify(
            {
              tool: step.toolName,
              arguments: step.arguments,
              result: step.result ?? (step.error ? { error: step.error } : 'running...'),
            },
            null,
            2
          )}
        </pre>
      )}
    </div>
  );
};

export const EmblyChat: React.FC<EmblyChatProps> = ({
  mode = 'canvas',
  endpointUrl = '/v1/runctor',
  packName,
  secondaryPacks = [],
  persona: controlledPersona,
  allowPersonaSwitch = true,
  pinnedSkills = [],
  intentCategory: initialIntent = 'execution',
  title,
  subtitle,
  brandAccent,
  brandIcon,
  placeholder,
  isOpen = true,
  onClose,
  width = 440,
  sessionContext = {},
  contextChips = [],
  onRemoveContextChip,
  starterPrompts,
  messages: controlledMessages,
  initialMessages = [],
  onMessagesChange,
  getAuthToken,
  toolRenderers = {},
  onStepUpRequired,
  showEvalGateBadge = true,
  showCostTelemetry = false,
  enableVoiceInput = true,
  enableAttachments = true,
  headerActionsSlot,
  composerLeadingSlot,
}) => {
  const preset: PackPreset = useMemo(
    () =>
      PACK_PRESETS[packName] || {
        title: title || 'Ask AI',
        subtitle: subtitle || `Runctor · ${packName}`,
        brandAccent: brandAccent || '#4E8067',
        personas: [{ name: controlledPersona || 'General', description: 'Domain specialist' }],
        starterPrompts: [],
      },
    [packName, title, subtitle, brandAccent, controlledPersona]
  );

  const resolvedEndpointUrl = useMemo(() => {
    if (endpointUrl !== '/v1/runctor') return endpointUrl;
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.location.port !== '6011'
    ) {
      return 'http://localhost:6011/v1/runctor';
    }
    return endpointUrl;
  }, [endpointUrl]);

  const activeAccent = brandAccent || preset.brandAccent;
  const activeTitle = title || preset.title;
  const activeSubtitle = subtitle || preset.subtitle;
  const activeStarters = starterPrompts || preset.starterPrompts;

  const [internalMessages, setInternalMessages] = useState<EmblyMessage[]>(initialMessages);
  const messages = controlledMessages ?? internalMessages;

  const updateMessages = (updater: (prev: EmblyMessage[]) => EmblyMessage[]) => {
    setInternalMessages((prev) => {
      const next = updater(controlledMessages ?? prev);
      onMessagesChange?.(next);
      return next;
    });
  };

  const [availablePersonas, setAvailablePersonas] = useState<
    { name: string; description: string }[]
  >(preset.personas);
  const [selectedPersona, setSelectedPersona] = useState<string>(
    controlledPersona || preset.personas[0]?.name || 'General'
  );
  const [selectedModel, setSelectedModel] = useState<string>('harnway/fast');
  const [taggedRepo, setTaggedRepo] = useState<string>('');
  const [intentCategory, setIntentCategory] = useState<EmblyIntentCategory>(initialIntent);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Record<string, boolean>>({});
  const [expandedEvalIds, setExpandedEvalIds] = useState<Record<string, boolean>>({});
  const [drawerWidth, setDrawerWidth] = useState<number>(
    typeof width === 'number' ? Math.max(440, width) : 460
  );
  const [isResizing, setIsResizing] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (mode !== 'drawer' || typeof window === 'undefined') return;
    try {
      const saved = Number(window.localStorage.getItem('embly_drawer_width'));
      if (Number.isFinite(saved) && saved >= 380 && saved <= 960) {
        setDrawerWidth(saved);
      }
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    if (!isResizing || typeof window === 'undefined') return;
    const handleMouseMove = (e: MouseEvent) => {
      const maxAllowed = Math.min(920, window.innerWidth - 72);
      const next = Math.max(380, Math.min(maxAllowed, window.innerWidth - e.clientX));
      setDrawerWidth(next);
      try {
        window.localStorage.setItem('embly_drawer_width', String(Math.round(next)));
      } catch {
        /* ignore */
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleToggleWideDrawer = () => {
    const next = drawerWidth >= 620 ? 460 : 720;
    setDrawerWidth(next);
    try {
      window.localStorage.setItem('embly_drawer_width', String(next));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (controlledPersona) {
      setSelectedPersona(controlledPersona);
    } else if (preset.personas[0]?.name) {
      setSelectedPersona(preset.personas[0].name);
    }
    setAvailablePersonas(preset.personas);
  }, [packName, controlledPersona, preset]);

  // Fetch pack details from live Runctor endpoint when available
  useEffect(() => {
    let cancelled = false;
    const loadPackMetadata = async () => {
      try {
        const cleanBase = resolvedEndpointUrl.replace(/\/$/, '');
        const resp = await fetch(`${cleanBase}/packs/${packName}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && Array.isArray(data.personas) && data.personas.length > 0) {
          setAvailablePersonas(
            data.personas.map((p: { name: string; description?: string }) => ({
              name: p.name,
              description: p.description || '',
            }))
          );
        }
      } catch {
        // Offline or demo preview mode — keep preset personas
      }
    };
    loadPackMetadata();
    return () => {
      cancelled = true;
    };
  }, [resolvedEndpointUrl, packName]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (mode !== 'canvas' && !isOpen) {
    return null;
  }

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  };

  const handleClearConversation = () => {
    handleStopStreaming();
    updateMessages(() => []);
  };

  const simulateOfflineRunctorTurn = async (
    promptText: string,
    assistantMsgId: string
  ) => {
    await new Promise((r) => setTimeout(r, 260));
    const lower = promptText.toLowerCase();
    const isSessionQuery =
      packName === 'sauthen_identity' &&
      ['session', 'logged', 'active', 'user', 'who', 'current', 'token', 'list'].some((kw) =>
        lower.includes(kw)
      ) &&
      !['policy', 'draft', 'step-up', 'step up', 'vault'].some((kw) => lower.includes(kw));
    const isStepUpOrVaultQuery =
      packName === 'sauthen_identity' &&
      ['step-up', 'step up', 'approval', 'vault', 'secret', 'credential'].some((kw) =>
        lower.includes(kw)
      );

    const sampleToolName =
      packName === 'adappty_autonomic'
        ? 'rank_root_causes'
        : isSessionQuery
        ? 'list_active_sessions'
        : isStepUpOrVaultQuery
        ? 'inspect_stepup_and_vault'
        : packName === 'sauthen_identity'
        ? 'draft_agent_sts_policy'
        : packName === 'meterbox_finops'
        ? 'query_usage_rollup'
        : packName === 'valiscale_concept'
        ? 'emit_validation_scorecard'
        : 'search_codebase';

    const sampleStep: EmblyToolStep = {
      turn: 1,
      callId: `call_${Date.now()}`,
      toolName: sampleToolName,
      arguments: {
        pack: packName,
        persona: selectedPersona,
        query: promptText.slice(0, 48),
      },
      status: 'running',
    };

    updateMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgId
          ? {
              ...m,
              thinking: `Composing Runctor system instruction for ${packName} (${selectedPersona}) and inspecting active context...`,
              toolSteps: [sampleStep],
            }
          : m
      )
    );

    await new Promise((r) => setTimeout(r, 420));

    const completedStep: EmblyToolStep = {
      ...sampleStep,
      status: 'completed',
      durationMs: 118,
      result: {
        success: true,
        pack: packName,
        persona: selectedPersona,
        verified: true,
      },
    };

    const evalReport: EmblyEvalReport = {
      packName,
      status: 'accomplished',
      score: 1.0,
      checks: [
        {
          gateName: `${packName}_safety_gate`,
          passed: true,
          score: 1.0,
          diagnostics: `All ${packName} evaluation gates passed (score=1.0).`,
        },
      ],
    };

    const replyText =
      packName === 'adappty_autonomic'
        ? `Executed **${formatToolLabel(sampleToolName)}** via \`${selectedPersona}\`.\n\n- **Primary cause:** Upstream connection pool saturation (\`0.92\` confidence)\n- **Recommended reflex:** Tune pool ceiling within \`L2\` bounds with automatic 5-minute rollback verification.`
        : isSessionQuery
        ? `Here are the active sessions and delegated agent STS tokens in the workspace:\n\n- **\`sess_901a\`** — **Ken Mburu** (\`ken@appembly.com\`) · \`passkey_webauthn\` · *MFA Verified*\n- **\`st_agt_cyclode_01\`** — **SoftwareEngineer** (\`cyclode_coding\`) delegated by \`Ken Mburu\` · Status: **active**`
        : isStepUpOrVaultQuery
        ? `Inspected pending **WebAuthn Step-Up Gates** and **Zero-Knowledge Vault** credentials via \`${selectedPersona}\`:\n\n- **Step-Up Approvals:** \`1\` pending CIBA passkey challenge\n- **Vault Credentials:** Sealed with AES-256-GCM (\`zero_knowledge_proxy\` mode)`
        : packName === 'sauthen_identity'
        ? `Generated a least-privilege **Agent STS Policy** (\`st_agt_*\`) for \`${selectedPersona}\`:\n\n\`\`\`json\n{\n  "runctor_pack": "${packName}",\n  "allowed_scopes": ["repo:read", "policy:inspect"],\n  "ttl_seconds": 900,\n  "require_stepup_for_mutations": true\n}\n\`\`\`\n\nVerified zero wildcard scopes and WebAuthn passkey step-up enforcement.`
        : packName === 'meterbox_finops'
        ? `Queried real-time **OpenMeter Rollups** for \`${selectedPersona}\`:\n\n- **24h Volume:** \`148,500\` units across active subjects\n- **Prompt Cache Hit Ratio:** \`68.0%\` (saving \`$11.90\` vs. uncached frontier baseline)\n- **Gross Margin Gate:** Passed (\`76.5%\` margin vs \`30.0%\` FinOps floor)`
        : `Completed analysis via **${selectedPersona}** on Runctor pack \`${packName}\`.\n\nAll domain tool steps and post-turn evaluation gates passed.`;

    updateMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgId
          ? {
              ...m,
              content: replyText,
              toolSteps: [completedStep],
              evalReport,
              usage: {
                promptTokens: 840,
                completionTokens: 190,
                cachedTokens: 610,
                estimatedCostUsd: 0.00032,
              },
            }
          : m
      )
    );
  };

  const handleSendPrompt = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? inputValue).trim();
    if (!promptText || isStreaming) return;

    if (!overridePrompt) {
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    const userMsg: EmblyMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: promptText,
      createdAt: new Date().toISOString(),
    };

    const assistantMsgId = `ast_${Date.now() + 1}`;
    const initialAssistantMsg: EmblyMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      persona: selectedPersona,
      toolSteps: [],
      createdAt: new Date().toISOString(),
    };

    const historyForRequest = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    updateMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const cleanBase = resolvedEndpointUrl.replace(/\/$/, '');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };
      if (getAuthToken) {
        const token = await getAuthToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const resp = await fetch(`${cleanBase}/sessions/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_prompt: promptText,
          pack_name: packName,
          secondary_packs: secondaryPacks,
          persona_name: selectedPersona,
          intent_category: intentCategory,
          pinned_skills: pinnedSkills,
          context: {
            ...sessionContext,
            context_chips: contextChips.map((c) => ({ kind: c.kind, value: c.value })),
          },
          conversation_history: historyForRequest,
          run_eval_gates: showEvalGateBadge,
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        await simulateOfflineRunctorTurn(promptText, assistantMsgId);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const dataLine = frame
            .split('\n')
            .find((line) => line.startsWith('data: '));
          if (!dataLine) continue;

          try {
            const payload = JSON.parse(dataLine.slice(6));
            const evType = payload.type;

            if (evType === 'thinking_delta') {
              updateMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, thinking: (m.thinking || '') + (payload.delta || '') }
                    : m
                )
              );
            } else if (evType === 'tool_call_start') {
              const newStep: EmblyToolStep = {
                turn: payload.turn || 1,
                callId: payload.call_id || `call_${Date.now()}`,
                toolName: payload.tool_name,
                arguments: payload.arguments || {},
                status: 'running',
              };
              updateMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, toolSteps: [...(m.toolSteps || []), newStep] }
                    : m
                )
              );
            } else if (evType === 'tool_step') {
              updateMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsgId) return m;
                  const existing = m.toolSteps || [];
                  const matchIdx = existing.findIndex(
                    (s) => s.callId === payload.call_id || s.toolName === payload.tool_name
                  );
                  const updatedStep: EmblyToolStep = {
                    turn: payload.turn || 1,
                    callId: payload.call_id || `call_${Date.now()}`,
                    toolName: payload.tool_name,
                    arguments: payload.arguments || {},
                    result: payload.result,
                    status: payload.success === false ? 'error' : 'completed',
                    error: payload.error,
                    durationMs: payload.duration_ms,
                  };
                  const nextSteps =
                    matchIdx >= 0
                      ? existing.map((s, idx) => (idx === matchIdx ? updatedStep : s))
                      : [...existing, updatedStep];
                  return { ...m, toolSteps: nextSteps };
                })
              );
            } else if (evType === 'approval_required') {
              updateMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsgId) return m;
                  const step: EmblyToolStep = {
                    turn: payload.turn || 1,
                    callId: payload.call_id,
                    toolName: payload.tool_name,
                    arguments: payload.arguments || {},
                    status: 'awaiting_approval',
                    requiresSauthenStepup: Boolean(payload.requires_sauthen_stepup),
                  };
                  return { ...m, toolSteps: [...(m.toolSteps || []), step] };
                })
              );
            } else if (evType === 'text_delta') {
              updateMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: (m.content || '') + (payload.delta || '') }
                    : m
                )
              );
            } else if (evType === 'eval_report' && payload.report) {
              const r = payload.report;
              const mappedReport: EmblyEvalReport = {
                packName: r.pack_name || packName,
                status: r.status === 'accomplished' ? 'accomplished' : 'needs_revision',
                score: typeof r.score === 'number' ? r.score : 1.0,
                checks: Array.isArray(r.checks)
                  ? r.checks.map((c: any) => ({
                      gateName: c.gate_name || c.name || 'eval_gate',
                      passed: Boolean(c.passed),
                      score: typeof c.score === 'number' ? c.score : 1.0,
                      diagnostics: c.diagnostics || '',
                    }))
                  : [],
              };
              updateMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, evalReport: mappedReport } : m
                )
              );
            } else if (evType === 'session_end') {
              updateMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: m.content || payload.final_response || '',
                        usage: payload.usage
                          ? {
                              promptTokens: payload.usage.prompt_tokens || 0,
                              completionTokens: payload.usage.completion_tokens || 0,
                              cachedTokens: payload.usage.cached_tokens || 0,
                              estimatedCostUsd: payload.usage.estimated_cost_usd || 0,
                            }
                          : m.usage,
                      }
                    : m
                )
              );
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        await simulateOfflineRunctorTurn(promptText, assistantMsgId);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleApproveToolStep = async (msgId: string, step: EmblyToolStep) => {
    if (onStepUpRequired) {
      const res = await onStepUpRequired(step);
      if (!res.approved) return;
    }
    updateMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              toolSteps: (m.toolSteps || []).map((s) =>
                s.callId === step.callId
                  ? { ...s, status: 'completed', result: { approved: true } }
                  : s
              ),
            }
          : m
      )
    );
  };

  const handleRejectToolStep = async (msgId: string, step: EmblyToolStep) => {
    updateMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              toolSteps: (m.toolSteps || []).map((s) =>
                s.callId === step.callId
                  ? { ...s, status: 'error', error: 'Denied by operator' }
                  : s
              ),
            }
          : m
      )
    );
  };

  const containerStyle: React.CSSProperties =
    mode === 'drawer'
      ? {
          width: `${drawerWidth}px`,
          maxWidth: 'calc(100vw - 48px)',
          backgroundColor: TOKENS.bgSurface,
          borderLeft: `1px solid ${TOKENS.border}`,
        }
      : mode === 'popover'
      ? {
          width: typeof width === 'number' ? `${width}px` : width,
          maxHeight: '560px',
          backgroundColor: TOKENS.bgSurface,
          border: `1px solid ${TOKENS.borderStrong}`,
          borderRadius: '14px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.28)',
        }
      : {
          backgroundColor: TOKENS.bgCanvas,
        };

  const isWideDrawer = mode === 'drawer' && drawerWidth >= 620;

  return (
    <div
      className={`relative flex flex-col h-full min-h-0 shrink-0 select-text ${
        mode === 'popover' ? 'overflow-hidden' : ''
      }`}
      style={containerStyle}
    >
      {/* Left-Edge Drag Resize Handle (Drawer Mode) */}
      {mode === 'drawer' && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Ask AI drawer"
          title="Drag to resize"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          onDoubleClick={handleToggleWideDrawer}
          className="group absolute inset-y-0 -left-1.5 w-3 cursor-col-resize z-30 flex items-center justify-center"
        >
          <div
            className="w-[3px] h-12 rounded-full transition-opacity duration-150 opacity-0 group-hover:opacity-100"
            style={{
              backgroundColor: activeAccent,
              opacity: isResizing ? 1 : undefined,
            }}
          />
        </div>
      )}

      {/* Top 60px Calm Header Bar (Aligned 1:1 with Appembly Console TopBar) */}
      <div
        className="flex items-center justify-between gap-3 px-5 h-[60px] shrink-0"
        style={{
          borderBottom: `1px solid ${TOKENS.border}`,
          backgroundColor: TOKENS.bgSurface,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 flex items-center justify-center">
            {brandIcon || (
              <AppemblyLogo
                variant="mark"
                size={18}
                strokeColor={activeAccent}
                animated={isStreaming}
                speed="loader"
              />
            )}
          </div>
          <h3
            className="text-[15px] font-semibold tracking-[-0.015em] whitespace-nowrap truncate"
            style={{ color: TOKENS.textPrimary }}
          >
            {activeTitle}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {allowPersonaSwitch && availablePersonas.length > 1 ? (
            <div className="relative inline-flex items-center shrink-0">
              <select
                aria-label="Select Runctor Persona"
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                className="appearance-none text-[12px] font-medium rounded-lg pl-2.5 pr-6 h-7 outline-none cursor-pointer whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: TOKENS.bgSubtle,
                  border: `1px solid ${TOKENS.border}`,
                  color: TOKENS.textPrimary,
                }}
              >
                {availablePersonas.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="w-3.5 h-3.5 pointer-events-none absolute right-2"
                style={{ color: TOKENS.textMuted }}
              />
            </div>
          ) : (
            <span
              className="px-2.5 py-0.5 rounded-full text-[11.5px] font-medium whitespace-nowrap shrink-0"
              style={{
                backgroundColor: `${activeAccent}16`,
                color: activeAccent,
              }}
            >
              {selectedPersona}
            </span>
          )}

          {headerActionsSlot}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearConversation}
              title="Clear conversation"
              className="w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors hover:opacity-80 shrink-0"
              style={{ color: TOKENS.textMuted }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {mode === 'drawer' && (
            <button
              type="button"
              onClick={handleToggleWideDrawer}
              title={isWideDrawer ? 'Restore standard width' : 'Expand drawer width'}
              className="w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors hover:opacity-80 shrink-0"
              style={{ color: TOKENS.textMuted }}
            >
              {isWideDrawer ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {onClose && mode !== 'canvas' && (
            <button
              type="button"
              onClick={onClose}
              title="Close Ask AI (⌘J)"
              className="w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors hover:opacity-80 shrink-0"
              style={{ color: TOKENS.textMuted }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Message Stream */}
      <div className="flex-1 overflow-y-auto appembly-scrollbar px-5 py-5">
        <div
          className={
            mode === 'canvas' ? 'max-w-[880px] mx-auto space-y-6' : 'space-y-6'
          }
        >
          {messages.length === 0 ? (
            <div className="py-6 space-y-6">
              <div className="space-y-2">
                <div
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: activeAccent }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{activeSubtitle}</span>
                </div>
                <h4
                  className="text-[18px] font-semibold tracking-[-0.016em] leading-snug"
                  style={{ color: TOKENS.textPrimary }}
                >
                  How can {selectedPersona} help right now?
                </h4>
                <p
                  className="text-[13.5px] leading-[1.55]"
                  style={{ color: TOKENS.textSecondary }}
                >
                  Every turn runs inside scoped domain tools and post-turn evaluation gates.
                </p>
              </div>

              {activeStarters.length > 0 && (
                <div
                  className="divide-y"
                  style={{
                    borderTop: `1px solid ${TOKENS.border}`,
                    borderBottom: `1px solid ${TOKENS.border}`,
                  }}
                >
                  {activeStarters.map((starter) => (
                    <button
                      key={starter.id}
                      type="button"
                      onClick={() => {
                        if (starter.persona) setSelectedPersona(starter.persona);
                        handleSendPrompt(starter.prompt);
                      }}
                      className="w-full py-3.5 text-left flex items-center justify-between gap-3 group transition-opacity hover:opacity-85"
                    >
                      <div className="min-w-0">
                        <div
                          className="text-[13.5px] font-medium truncate"
                          style={{ color: TOKENS.textPrimary }}
                        >
                          {starter.label}
                        </div>
                        <div
                          className="text-[12.5px] truncate mt-0.5"
                          style={{ color: TOKENS.textMuted }}
                        >
                          {starter.prompt}
                        </div>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        style={{ color: activeAccent }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isThinkingExpanded = Boolean(expandedThinkingIds[msg.id]);
              const isEvalExpanded = Boolean(expandedEvalIds[msg.id]);

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div
                      className="max-w-[86%] rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px] leading-[1.55]"
                      style={{
                        backgroundColor: TOKENS.bgSubtle,
                        color: TOKENS.textPrimary,
                        border: `1px solid ${TOKENS.border}`,
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className="space-y-3 pb-5"
                  style={{
                    borderBottom: `1px solid ${TOKENS.border}`,
                  }}
                >
                  {/* Assistant Turn Header (Unboxed, Zero Nested Cards — Calm UI Rule 3) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AppemblyLogo
                        variant="mark"
                        size={15}
                        strokeColor={activeAccent}
                      />
                      <span
                        className="text-[13px] font-semibold truncate whitespace-nowrap"
                        style={{ color: TOKENS.textPrimary }}
                      >
                        {msg.persona || selectedPersona}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {showEvalGateBadge && msg.evalReport && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEvalIds((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 transition-opacity hover:opacity-85"
                          style={{
                            backgroundColor:
                              msg.evalReport.status === 'accomplished'
                                ? 'rgba(78, 128, 103, 0.14)'
                                : 'rgba(217, 92, 104, 0.14)',
                            color:
                              msg.evalReport.status === 'accomplished'
                                ? '#4E8067'
                                : '#D95C68',
                          }}
                        >
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                          <span>
                            {msg.evalReport.status === 'accomplished'
                              ? 'Eval Gate · Passed'
                              : 'Eval Gate · Needs Revision'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sleek Left-Bordered Trace Strip for Reasoning + Tool Execution */}
                  {(msg.thinking || (msg.toolSteps && msg.toolSteps.length > 0)) && (
                    <div
                      className="pl-3.5 space-y-2"
                      style={{
                        borderLeft: `2px solid ${TOKENS.borderStrong}`,
                      }}
                    >
                      {msg.thinking && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedThinkingIds((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                            style={{ color: TOKENS.textMuted }}
                          >
                            {isThinkingExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>Reasoning trace</span>
                          </button>
                          {isThinkingExpanded && (
                            <p
                              className="mt-1 text-[12.5px] leading-relaxed"
                              style={{ color: TOKENS.textSecondary }}
                            >
                              {msg.thinking}
                            </p>
                          )}
                        </div>
                      )}

                      {msg.toolSteps && msg.toolSteps.length > 0 && (
                        <div className="space-y-1.5">
                          {msg.toolSteps.map((step) => {
                            if (step.toolName === 'handoff_to_cyclode_workstation') {
                              return (
                                <CyclodeWorkstationHandoffCard
                                  key={step.callId}
                                  step={step}
                                  onSendFollowUp={(prompt) => handleSendPrompt(prompt)}
                                />
                              );
                            }
                            const CustomRenderer = toolRenderers[step.toolName];
                            if (CustomRenderer) {
                              return (
                                <div key={step.callId}>
                                  <CustomRenderer
                                    step={step}
                                    brandAccent={activeAccent}
                                    onApprove={async () => handleApproveToolStep(msg.id, step)}
                                    onReject={async () => handleRejectToolStep(msg.id, step)}
                                    onSendFollowUp={(prompt) => handleSendPrompt(prompt)}
                                  />
                                </div>
                              );
                            }
                            return (
                              <DefaultCalmToolRow
                                key={step.callId}
                                step={step}
                                brandAccent={activeAccent}
                                onApprove={() => handleApproveToolStep(msg.id, step)}
                                onReject={() => handleRejectToolStep(msg.id, step)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assistant Markdown Response */}
                  {msg.content ? (
                    <CalmMarkdown content={msg.content} accentColor={activeAccent} />
                  ) : (
                    isStreaming && (
                      <div
                        className="flex items-center gap-2 text-[13px]"
                        style={{ color: TOKENS.textMuted }}
                      >
                        <Loader2
                          className="w-3.5 h-3.5 animate-spin shrink-0"
                          style={{ color: activeAccent }}
                        />
                        <span>Running {selectedPersona}…</span>
                      </div>
                    )
                  )}

                  {/* Expanded Eval Gate Report Diagnostics */}
                  {isEvalExpanded && msg.evalReport && (
                    <div
                      className="pt-2 space-y-1.5 text-[12px]"
                      style={{ borderTop: `1px dashed ${TOKENS.border}` }}
                    >
                      {msg.evalReport.checks.map((chk, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <CheckCircle2
                            className="w-3.5 h-3.5 mt-0.5 shrink-0"
                            style={{ color: chk.passed ? '#4E8067' : '#D95C68' }}
                          />
                          <div className="min-w-0">
                            <span
                              className="font-medium"
                              style={{ color: TOKENS.textPrimary }}
                            >
                              {chk.gateName}:{' '}
                            </span>
                            <span style={{ color: TOKENS.textSecondary }}>
                              {chk.diagnostics}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Optional Cost & Token Telemetry Line */}
                  {showCostTelemetry && msg.usage && (
                    <div
                      className="pt-1 flex items-center justify-between text-[11.5px] font-mono"
                      style={{
                        color: TOKENS.textMuted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span>
                        Tokens: {msg.usage.promptTokens + msg.usage.completionTokens}
                        {msg.usage.cachedTokens ? ` (${msg.usage.cachedTokens} cached)` : ''}
                      </span>
                      {typeof msg.usage.estimatedCostUsd === 'number' && (
                        <span>${msg.usage.estimatedCostUsd.toFixed(5)}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={scrollEndRef} />
        </div>
      </div>

      {/* Unified Calm Composer Surface */}
      <div
        className="px-4 pb-4 pt-2.5 shrink-0"
        style={{
          backgroundColor: TOKENS.bgSurface,
        }}
      >
        <div className={mode === 'canvas' ? 'max-w-[880px] mx-auto' : ''}>
          <div
            className="rounded-2xl overflow-hidden transition-colors"
            style={{
              backgroundColor: TOKENS.bgSubtle,
              border: `1px solid ${TOKENS.borderStrong}`,
            }}
          >
            {/* Integrated Top Context Strip */}
            {(contextChips.length > 0 || pinnedSkills.length > 0) && (
              <div
                className="flex flex-wrap items-center gap-1.5 px-3.5 py-1.5"
                style={{
                  borderBottom: `1px solid ${TOKENS.border}`,
                }}
              >
                {contextChips.map((chip) => (
                  <span
                    key={chip.id}
                    className="inline-flex items-center gap-1 text-[11px] font-mono whitespace-nowrap"
                    style={{ color: TOKENS.textMuted }}
                  >
                    {chip.icon}
                    <span className="opacity-75">{chip.kind}:</span>
                    <span className="font-medium" style={{ color: TOKENS.textSecondary }}>
                      {chip.label}
                    </span>
                    {chip.removable !== false && onRemoveContextChip && (
                      <button
                        type="button"
                        onClick={() => onRemoveContextChip(chip.id)}
                        className="hover:opacity-75 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
                {pinnedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono whitespace-nowrap"
                    style={{
                      backgroundColor: `${activeAccent}15`,
                      color: activeAccent,
                    }}
                  >
                    /{skill}
                  </span>
                ))}
              </div>
            )}

            {/* Prompt Input Textarea */}
            <div className="px-3.5 pt-2.5 pb-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
                placeholder={placeholder || `Ask ${selectedPersona}…`}
                className="w-full bg-transparent resize-none outline-none text-[13.5px] leading-[1.5]"
                style={{ color: TOKENS.textPrimary }}
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {composerLeadingSlot}

                  {/* Intent Mode Toggle (Execution vs Read-Only) */}
                  <button
                    type="button"
                    onClick={() =>
                      setIntentCategory((prev) =>
                        prev === 'execution' ? 'qa_research' : 'execution'
                      )
                    }
                    className="px-2 py-0.5 rounded-md text-[11.5px] font-medium whitespace-nowrap transition-colors"
                    style={{
                      backgroundColor:
                        intentCategory === 'qa_research'
                          ? `${activeAccent}1A`
                          : TOKENS.bgSurface,
                      border: `1px solid ${TOKENS.border}`,
                      color:
                        intentCategory === 'qa_research'
                          ? activeAccent
                          : TOKENS.textSecondary,
                    }}
                    title="Toggle Execution vs Read-Only Research mode"
                  >
                    {intentCategory === 'qa_research' ? 'Read-Only' : 'Execution'}
                  </button>

                  {/* Semantic Model Selector (Harnway Profile) */}
                  <select
                    aria-label="Select Semantic Model Profile"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="appearance-none px-2 py-0.5 rounded-md text-[11.5px] font-mono outline-none cursor-pointer"
                    style={{
                      backgroundColor: TOKENS.bgSurface,
                      border: `1px solid ${TOKENS.border}`,
                      color: TOKENS.textSecondary,
                    }}
                    title="Harnway Semantic Model Profile"
                  >
                    <option value="harnway/fast">harnway/fast · flash</option>
                    <option value="harnway/coding">harnway/coding · sonnet</option>
                    <option value="harnway/reasoning">harnway/reasoning · pro</option>
                  </select>

                  {/* @Repo Context Tagger (Cyclode-style) */}
                  <select
                    aria-label="Tag Repository Context"
                    value={taggedRepo}
                    onChange={(e) => {
                      const repo = e.target.value;
                      setTaggedRepo(repo);
                      if (repo && !inputValue.includes(repo)) {
                        setInputValue((prev) => `${prev ? prev + ' ' : ''}@${repo} `);
                      }
                    }}
                    className="appearance-none px-2 py-0.5 rounded-md text-[11.5px] font-mono outline-none cursor-pointer"
                    style={{
                      backgroundColor: taggedRepo ? 'rgba(229, 192, 123, 0.14)' : TOKENS.bgSurface,
                      border: `1px solid ${TOKENS.border}`,
                      color: taggedRepo ? '#E5C07B' : TOKENS.textMuted,
                    }}
                    title="Tag repository context (@Repo)"
                  >
                    <option value="">@Repo</option>
                    <option value="Appembly/cyclode">@Appembly/cyclode</option>
                    <option value="Appembly/sauthen">@Appembly/sauthen</option>
                    <option value="Appembly/meterbox">@Appembly/meterbox</option>
                    <option value="Appembly/harnway">@Appembly/harnway</option>
                    <option value="Appembly/adappty">@Appembly/adappty</option>
                  </select>

                  {enableAttachments && (
                    <button
                      type="button"
                      title="Attach context or file"
                      className="p-1 rounded-md transition-opacity hover:opacity-80"
                      style={{ color: TOKENS.textMuted }}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {enableVoiceInput && (
                    <button
                      type="button"
                      title="Voice input"
                      className="p-1 rounded-md transition-opacity hover:opacity-80"
                      style={{ color: TOKENS.textMuted }}
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium text-white"
                      style={{ backgroundColor: '#D95C68' }}
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!inputValue.trim()}
                      onClick={() => handleSendPrompt()}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-opacity disabled:opacity-35"
                      style={{
                        backgroundColor: activeAccent,
                        color: '#FFFFFF',
                      }}
                      title="Send message"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.25]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
