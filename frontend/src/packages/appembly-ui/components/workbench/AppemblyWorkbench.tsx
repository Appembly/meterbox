import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Square,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  RotateCcw,
  Edit2,
  Paperclip,
  AtSign,
  Cpu,
  ShieldCheck,
  Terminal,
  FileCode2,
  Layers,
  Activity,
  Braces,
  ArrowLeft,
  Columns,
  MessageSquare,
  PanelRight,
  KeyRound,
  Play,
  CheckCircle2,
  Sliders,
  Plus,
  X,
  Eye,
  Zap,
  Info,
  AlertTriangle,
  AlertCircle,
  Flame,
} from 'lucide-react';
import { AppemblyLogo } from '../brand/AppemblyLogo';
import { MermaidDiagram } from './MermaidDiagram';

export type WorkbenchPreset = 'appembly_dash' | 'cyclode' | 'valiscale' | 'adappty';
export type WorkbenchLayoutMode = 'chat' | 'split' | 'workbench';

export interface WorkbenchStepItem {
  id?: string;
  verb: 'Synthesized' | 'Edited' | 'Ran' | 'Guardrail' | 'Packaged' | 'Verified' | 'Metered' | string;
  target: string;
  detail?: string;
  status?: 'done' | 'running' | 'error';
  diffPreview?: string;
  commandOutput?: string;
}

export interface WorkbenchPlanItem {
  id: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending';
}

export interface WorkbenchMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  personaId?: string;
  personaLabel?: string;
  modelId?: string;
  modelLabel?: string;
  tokens?: number;
  latencySec?: string;
  reasoning?: string;
  plan?: WorkbenchPlanItem[];
  steps?: WorkbenchStepItem[];
  followUps?: Array<{
    label: string;
    prompt?: string;
    actionId?: string;
  }>;
  attachments?: string[];
  contextRefs?: string[];
}

export interface WorkbenchPersonaOption {
  id: string;
  label: string;
  role: string;
  description: string;
  badgeColor?: string;
}

export interface WorkbenchModelOption {
  id: string;
  label: string;
  provider: string;
  latency: string;
  tier: string;
  group?: string;
  providerId?: string;
  byokReady?: boolean;
}

export interface WorkbenchContextOption {
  id: string;
  label: string;
  category: 'Blueprint' | 'Policy' | 'Workspace' | 'Telemetry' | 'Dataset';
  description: string;
}

export interface WorkbenchAuxTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  render: () => React.ReactNode;
}

export interface AppemblyWorkbenchProps {
  preset?: WorkbenchPreset;
  accentColor?: string;
  sessionTitle?: string;
  sessionStatus?: string;
  messages: WorkbenchMessage[];
  onSendMessage: (
    prompt: string,
    meta: {
      persona: WorkbenchPersonaOption;
      model: WorkbenchModelOption;
      executionMode: 'agentic' | 'readonly';
      contextRefs: string[];
      attachments: string[];
      replaceMessageId?: string;
    }
  ) => void;
  onFollowUpAction?: (actionId: string, prompt?: string) => void;
  onOpenByokModal?: (provider?: string) => void;
  onBackToOverview?: () => void;
  showOverviewLanding?: boolean;
  renderOverviewLanding?: (helpers: {
    prefillComposer: (prompt: string, personaId?: string) => void;
    focusComposer: () => void;
  }) => React.ReactNode;
  personas?: WorkbenchPersonaOption[];
  models?: WorkbenchModelOption[];
  contextOptions?: WorkbenchContextOption[];
  defaultContextRefs?: string[];
  onContextRefsChange?: (refs: string[]) => void;
  executionMode?: 'agentic' | 'readonly';
  onExecutionModeChange?: (mode: 'agentic' | 'readonly') => void;
  selectedPersonaId?: string;
  onSelectPersonaId?: (id: string) => void;
  selectedModelId?: string;
  onSelectModelId?: (id: string) => void;
  composerValue?: string;
  onComposerValueChange?: (val: string) => void;
  composerPlaceholder?: string;
  auxiliaryTabs?: WorkbenchAuxTab[];
  activeAuxTabId?: string;
  onActiveAuxTabChange?: (tabId: string) => void;
  defaultLayoutMode?: WorkbenchLayoutMode;
  layoutMode?: WorkbenchLayoutMode;
  onLayoutModeChange?: (mode: WorkbenchLayoutMode) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  className?: string;
}

const DEFAULT_PERSONAS_BY_PRESET: Record<WorkbenchPreset, WorkbenchPersonaOption[]> = {
  appembly_dash: [
    {
      id: 'General',
      label: 'General Assistant',
      role: 'Cross-Domain Workspace Assistant',
      description: 'Conversational assistant across Sauthen Identity, Meterbox Billing, Harnway AI Routing, and Controps Fleet.',
      badgeColor: '#4E8067',
    },
    {
      id: 'AppBuilder',
      label: 'App Assembler',
      role: 'Full-Stack App & Blueprint Synthesis',
      description: 'Synthesizes full-stack applications, multi-agent topologies, OIDC auth gates, and AWS Graviton deployment manifests.',
      badgeColor: '#E5C07B',
    },
    {
      id: 'AgentAssembler',
      label: 'Agent Assembler',
      role: '8-Part Agent Spec & Guardrails',
      description: 'Guides and synthesizes production agents across Persona, Skills, Tools, Memory, Governance, Integrations, and Triggers.',
      badgeColor: '#4E8067',
    },
    {
      id: 'SoftwareEngineer',
      label: 'Software Engineer',
      role: 'Polyglot Code & Worktree Execution',
      description: 'Scopes repository tasks, generates production code, and prepares 1-click Cyclode IDE worktree handoffs.',
      badgeColor: '#E5C07B',
    },
    {
      id: 'IdentityArchitect',
      label: 'Identity Architect',
      role: 'OIDC, Passkeys & RFC 8693 STS',
      description: 'Designs zero-trust authentication flows, 15m scoped agent tokens, and step-up approval policies.',
      badgeColor: '#8F80FF',
    },
    {
      id: 'FinOpsAnalyst',
      label: 'FinOps & Pricing',
      role: 'OpenMeter Quotas & Gross Margin',
      description: 'Analyzes real-time token spend, customer credit burn, and SaaS pricing tier gross margins.',
      badgeColor: '#4E8067',
    },
    {
      id: 'IncidentResponder',
      label: 'Incident & SRE',
      role: 'Graviton Fleet & Autonomic Reflexes',
      description: 'Triages SLO burn, inspects Graviton arm64 nodes, and governs bounded L1/L2 autonomic reflexes.',
      badgeColor: '#61AFEF',
    },
  ],
  cyclode: [
    {
      id: 'lead_architect',
      label: 'Lead Architect',
      role: 'Full-Stack Polyglot & Worktree Execution',
      description: 'Plans, edits, tests, and verifies multi-file codebases in isolated Git worktrees.',
      badgeColor: '#E5C07B',
    },
    {
      id: 'verification_judge',
      label: 'Verification Judge',
      role: 'Test Suite & Diff Reviewer',
      description: 'Validates diffs, runs unit/integration test suites, and enforces zero-regression invariants.',
      badgeColor: '#98C379',
    },
  ],
  valiscale: [
    {
      id: 'eval_scientist',
      label: 'Eval & Benchmark Lead',
      role: 'Golden Datasets & Regression Suites',
      description: 'Designs rubric judges, adversarial red-team prompts, and latency-vs-accuracy Pareto evaluations.',
      badgeColor: '#4E8067',
    },
    {
      id: 'judge_calibrator',
      label: 'LLM Judge Calibrator',
      role: 'Scoring Rubrics & Drift Detection',
      description: 'Calibrates deterministic + LLM-as-a-Judge assertions across frontier model upgrades.',
      badgeColor: '#8F80FF',
    },
  ],
  adappty: [
    {
      id: 'incident_commander',
      label: 'Incident Commander',
      role: 'Autonomic RCA & Safe Rollback',
      description: 'Correlates telemetry anomalies, traces root causes, and prepares human-gated remediation runbooks.',
      badgeColor: '#4E8067',
    },
    {
      id: 'slo_guardian',
      label: 'SLO & Drift Guardian',
      role: 'Canary Verification & Capacity',
      description: 'Monitors p99 latency budgets, error burn rates, and automated Graviton scaling policies.',
      badgeColor: '#E5C07B',
    },
  ],
};

const DEFAULT_MODELS: WorkbenchModelOption[] = [
  {
    id: 'claude-3-7-sonnet',
    label: 'Claude 3.7 Sonnet',
    provider: 'Anthropic · Gateway Primary',
    latency: '0.8s TTFT',
    tier: 'Frontier Reasoning',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o Production',
    provider: 'OpenAI · Fallback #1',
    latency: '0.6s TTFT',
    tier: 'Multimodal Fast',
  },
  {
    id: 'gemini-2-5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google Vertex · 2M Context',
    latency: '0.9s TTFT',
    tier: 'Deep Context',
  },
  {
    id: 'deepseek-r1-graviton',
    label: 'DeepSeek R1 Distill',
    provider: 'Bedrock arm64 · Low Cost',
    latency: '0.5s TTFT',
    tier: 'High Efficiency',
  },
];

const DEFAULT_CONTEXT_OPTIONS: WorkbenchContextOption[] = [
  {
    id: '@blueprint:agent-spec',
    label: '@blueprint:agent-spec',
    category: 'Blueprint',
    description: 'Active 8-part Agent Assembler specification & guardrail manifest',
  },
  {
    id: '@blueprint:app-topology',
    label: '@blueprint:app-topology',
    category: 'Blueprint',
    description: 'Active 4-part Application stack, database, auth & compute blueprint',
  },
  {
    id: '@policy:production-guardrails',
    label: '@policy:production-guardrails',
    category: 'Policy',
    description: 'PII Redaction, Prompt Injection Shield, and HITL Approval rules',
  },
  {
    id: '@telemetry:gateway-finops',
    label: '@telemetry:gateway-finops',
    category: 'Telemetry',
    description: 'Live AI Gateway token spend, cache hit rate, and model fallback stats',
  },
  {
    id: '@workspace:customer-portal-v2',
    label: '@workspace:customer-portal-v2',
    category: 'Workspace',
    description: 'Customer Onboarding Portal full-stack project workspace',
  },
];

/**
 * Formats inline markdown (**bold**, *italic*, `code`, [link](url)) cleanly into React nodes
 * with zero raw markdown characters leaking.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[var(--ui-text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 text-[12.5px] font-mono rounded bg-[var(--ui-bg-subtle)] text-[var(--ui-accent)] border border-[color-mix(in_srgb,var(--ui-border)_80%,transparent)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
      return (
        <em key={idx} className="italic text-[color-mix(in_srgb,var(--ui-text-primary)_90%,transparent)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--ui-accent)] underline underline-offset-2 hover:opacity-80"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export interface QuickActionParsedItem {
  actionId: string;
  label: string;
  prompt: string;
  variant?: string;
  icon?: string;
}

export interface DecisionCardOption {
  id: string;
  label: string;
  description?: string;
  isDefault?: boolean;
}

export interface DecisionCardQuestion {
  id: string;
  label: string;
  multi: boolean;
  options: DecisionCardOption[];
}

export interface DecisionCardData {
  title: string;
  stage?: string;
  questions: DecisionCardQuestion[];
}

export function extractDecisionCardsFromMarkdown(rawContent: string): {
  cleanedContent: string;
  decisionCards: DecisionCardData[];
} {
  if (!rawContent) return { cleanedContent: '', decisionCards: [] };
  const decisionCards: DecisionCardData[] = [];
  // Unwrap fenced ```xml <decision-card>...</decision-card> ``` if the model wrapped it in a code fence
  const unwrapped = rawContent.replace(
    /```(?:xml|html)?\s*(<(?:decision-card|decision_card)\b[\s\S]*?<\/(?:decision-card|decision_card)>)\s*```/gi,
    '$1'
  );
  const cardRegex = /<(?:decision-card|decision_card)\b([^>]*)>([\s\S]*?)<\/(?:decision-card|decision_card)>/gi;
  let cardMatch: RegExpExecArray | null;
  while ((cardMatch = cardRegex.exec(unwrapped)) !== null) {
    const cardAttrs = cardMatch[1] || '';
    const cardInner = cardMatch[2] || '';
    const titleMatch = cardAttrs.match(/\btitle=["']([^"']+)["']/i);
    const stageMatch = cardAttrs.match(/\bstage=["']([^"']+)["']/i);
    const questions: DecisionCardQuestion[] = [];

    const qRegex = /<question\b([^>]*)>([\s\S]*?)<\/question>/gi;
    let qMatch: RegExpExecArray | null;
    while ((qMatch = qRegex.exec(cardInner)) !== null) {
      const qAttrs = qMatch[1] || '';
      const qInner = qMatch[2] || '';
      const qId = (qAttrs.match(/\bid=["']([^"']+)["']/i) || [])[1] || `q_${questions.length + 1}`;
      const qLabel = (qAttrs.match(/\blabel=["']([^"']+)["']/i) || [])[1] || `Question ${questions.length + 1}`;
      const multiStr = ((qAttrs.match(/\bmulti=["']([^"']+)["']/i) || [])[1] || 'false').toLowerCase();
      const options: DecisionCardOption[] = [];

      const optRegex = /<option\b([^>]*?)(?:\/>|>([\s\S]*?)<\/option>)/gi;
      let optMatch: RegExpExecArray | null;
      while ((optMatch = optRegex.exec(qInner)) !== null) {
        const oAttrs = optMatch[1] || '';
        const oInner = (optMatch[2] || '').trim();
        const oId = (oAttrs.match(/\bid=["']([^"']+)["']/i) || [])[1] || `opt_${options.length + 1}`;
        const oLabel = (oAttrs.match(/\blabel=["']([^"']+)["']/i) || [])[1] || oInner || oId;
        const oDesc = (oAttrs.match(/\bdescription=["']([^"']+)["']/i) || [])[1];
        const oDefault = ((oAttrs.match(/\bdefault=["']([^"']+)["']/i) || [])[1] || '').toLowerCase() === 'true';
        options.push({
          id: oId,
          label: oLabel,
          description: oDesc,
          isDefault: oDefault,
        });
      }

      if (options.length > 0) {
        questions.push({
          id: qId,
          label: qLabel,
          multi: multiStr === 'true',
          options,
        });
      }
    }

    if (questions.length > 0) {
      decisionCards.push({
        title: titleMatch ? titleMatch[1] : 'Quick Scope & Stack Defaults',
        stage: stageMatch ? stageMatch[1] : 'Stage 1 · Consultative Defaults',
        questions,
      });
    }
  }

  let cleanedContent = unwrapped.replace(cardRegex, '').trimEnd();
  cleanedContent = cleanedContent.replace(/<(?:decision-card|decision_card)\b[\s\S]*$/gi, '').trimEnd();
  return { cleanedContent, decisionCards };
}

const OTHER_OPTION_ID = '__other__';

interface ParsedConfirmedDecision {
  badgeLabel: string;
  isFastTrack: boolean;
  items: Array<{ label: string; value: string }>;
  additionalContext?: string;
}

function parseConfirmedDecisionMessage(rawContent: string): ParsedConfirmedDecision | null {
  const trimmed = (rawContent || '').trim();
  const prefixMatch = trimmed.match(
    /^\[(Stage 1 Scope Confirmed|Decision Card Confirmed\s*·\s*Fast-Track Recommended Defaults|Decision Card Confirmed)\]\s*([\s\S]*)$/i
  );
  if (!prefixMatch) return null;

  const rawTag = prefixMatch[1];
  const isFastTrack = /fast-track/i.test(rawTag);
  const badgeLabel = /stage 1/i.test(rawTag)
    ? 'Stage 1 Scope Confirmed'
    : isFastTrack
    ? 'Fast-Track Defaults Confirmed'
    : 'Stage 2 Architecture Confirmed';

  let body = (prefixMatch[2] || '').trim();
  let additionalContext: string | undefined;
  const noteSplit = body.split(/\s*\|\s*Additional Context:\s*/i);
  if (noteSplit.length > 1) {
    body = noteSplit[0].trim();
    additionalContext = noteSplit.slice(1).join(' — ').trim();
  }

  const segments = body
    .split(/\s+·\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const items = segments.map((seg) => {
    const colonIdx = seg.indexOf(':');
    if (colonIdx > 0) {
      return {
        label: seg.slice(0, colonIdx).trim(),
        value: seg.slice(colonIdx + 1).trim(),
      };
    }
    return { label: '', value: seg };
  });

  if (items.length === 0 && !additionalContext) return null;
  return { badgeLabel, isFastTrack, items, additionalContext };
}

function getOtherPlaceholder(questionLabel: string): string {
  const lower = questionLabel.toLowerCase();
  if (lower.includes('customer') || lower.includes('user') || lower.includes('who')) {
    return 'Specify target customer or user…';
  }
  if (lower.includes('job') || lower.includes('actually do') || lower.includes('capability')) {
    return 'Describe what the AI or app does…';
  }
  if (lower.includes('ship') || lower.includes('first version') || lower.includes('v1')) {
    return 'Describe what ships in v1…';
  }
  if (lower.includes('interface') || lower.includes('ux') || lower.includes('surface')) {
    return 'Describe preferred UI surface…';
  }
  if (lower.includes('auth') || lower.includes('access') || lower.includes('tenant')) {
    return 'Specify auth & access model…';
  }
  if (lower.includes('monetiz') || lower.includes('billing') || lower.includes('pricing')) {
    return 'Specify pricing or billing model…';
  }
  return 'Type your custom answer…';
}

const InteractiveDecisionCard: React.FC<{
  card: DecisionCardData;
  onSubmitDecision: (formattedPrompt: string) => void;
}> = ({ card, onSubmitDecision }) => {
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const q of card.questions) {
      const defaults = q.options.filter((o) => o.isDefault).map((o) => o.id);
      if (defaults.length > 0) {
        init[q.id] = q.multi ? defaults : [defaults[0]];
      } else if (q.options.length > 0) {
        init[q.id] = [q.options[0].id];
      } else {
        init[q.id] = [];
      }
    }
    return init;
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customNote, setCustomNote] = useState('');
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null);
  const otherInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const toggleOption = (q: DecisionCardQuestion, optId: string) => {
    if (submittedSummary) return;
    setSelections((prev) => {
      const current = prev[q.id] || [];
      if (!q.multi) {
        return { ...prev, [q.id]: [optId] };
      }
      if (current.includes(optId)) {
        const next = current.filter((id) => id !== optId);
        return { ...prev, [q.id]: next.length > 0 ? next : [optId] };
      }
      return { ...prev, [q.id]: [...current, optId] };
    });
    if (optId === OTHER_OPTION_ID) {
      requestAnimationFrame(() => {
        otherInputRefs.current[q.id]?.focus();
      });
    }
  };

  const isStage1Card =
    /stage\s*1\b/i.test(card.stage || '') && !/stage\s*[234]\b/i.test(card.stage || '');

  const handleConfirm = (
    actionMode: 'stage1_continue' | 'generate_blueprint' | 'fast_track_blueprint'
  ) => {
    if (submittedSummary) return;
    const useRecommendedDefaults = actionMode === 'fast_track_blueprint';
    const summaryParts: string[] = [];
    for (const q of card.questions) {
      const chosenIds = useRecommendedDefaults
        ? q.options.filter((o) => o.isDefault).map((o) => o.id)
        : selections[q.id] || [];
      const effectiveIds = chosenIds.length > 0 ? chosenIds : q.options[0] ? [q.options[0].id] : [];
      const chosenLabels = q.options.filter((o) => effectiveIds.includes(o.id)).map((o) => o.label);
      if (!useRecommendedDefaults && effectiveIds.includes(OTHER_OPTION_ID)) {
        const customText = (customValues[q.id] || '').trim();
        if (customText) {
          chosenLabels.push(customText);
        } else if (chosenLabels.length === 0) {
          const fallbackOpt = q.options.find((o) => o.isDefault) || q.options[0];
          chosenLabels.push(fallbackOpt ? fallbackOpt.label : 'Custom');
        }
      }
      const cleanQTitle = q.label.replace(/^\d+\.\s*/, '');
      if (chosenLabels.length > 0) {
        summaryParts.push(`${cleanQTitle}: ${chosenLabels.join(', ')}`);
      }
    }
    const noteSuffix = customNote.trim() ? ` | Additional Context: ${customNote.trim()}` : '';
    const prefix =
      actionMode === 'stage1_continue'
        ? '[Stage 1 Scope Confirmed]'
        : actionMode === 'fast_track_blueprint'
        ? '[Decision Card Confirmed · Fast-Track Recommended Defaults]'
        : '[Decision Card Confirmed]';
    const fullPrompt = `${prefix} ${summaryParts.join(' · ')}${noteSuffix}`;
    setSubmittedSummary(summaryParts.join(' · ') + (customNote.trim() ? ` (${customNote.trim()})` : ''));
    onSubmitDecision(fullPrompt);
  };

  return (
    <div className="my-3 rounded-xl border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-bg-subtle)_95%,transparent)] p-4 space-y-3.5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[color-mix(in_srgb,var(--ui-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--ui-accent)_30%,transparent)] flex items-center justify-center text-[var(--ui-accent)] shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-[13.5px] font-semibold text-[var(--ui-text-primary)]">{card.title}</span>
        </div>
        {card.stage && (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-medium bg-[var(--ui-bg-surface)] text-[var(--ui-accent)] border border-[var(--ui-border)]">
            {card.stage}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {card.questions.map((q) => {
          const selectedIds = selections[q.id] || [];
          const isOtherSelected = selectedIds.includes(OTHER_OPTION_ID);
          const customVal = customValues[q.id] || '';
          return (
            <div key={q.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-[var(--ui-text-primary)]">{q.label}</span>
                <span className="text-[10px] font-mono text-[var(--ui-text-muted)]">
                  {q.multi ? 'Select one or more' : 'Select one'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const isSelected = selectedIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={Boolean(submittedSummary)}
                      onClick={() => toggleOption(q, opt.id)}
                      title={opt.description || opt.label}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left text-[12.5px] transition-colors cursor-pointer disabled:cursor-default ${
                        isSelected
                          ? 'bg-[color-mix(in_srgb,var(--ui-accent)_15%,transparent)] border-[var(--ui-accent)] text-[var(--ui-text-primary)] font-medium shadow-2xs'
                          : 'bg-[color-mix(in_srgb,var(--ui-bg-surface)_40%,transparent)] hover:bg-[var(--ui-bg-surface)] border-[var(--ui-border)] text-[var(--ui-text-secondary)]'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 ${
                          q.multi ? 'rounded' : 'rounded-full'
                        } border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[var(--ui-accent)] border-[var(--ui-accent)] text-[var(--ui-bg-subtle)]'
                            : 'border-[color-mix(in_srgb,var(--ui-text-muted)_50%,transparent)] bg-[color-mix(in_srgb,var(--ui-bg-subtle)_60%,transparent)]'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span>{opt.label}</span>
                      {opt.isDefault && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-[color-mix(in_srgb,var(--ui-bg-surface)_90%,transparent)] text-[var(--ui-accent)] border border-[color-mix(in_srgb,var(--ui-border)_80%,transparent)]">
                          Recommended
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Per-question "Other" option pill */}
                <button
                  type="button"
                  disabled={Boolean(submittedSummary)}
                  onClick={() => toggleOption(q, OTHER_OPTION_ID)}
                  title="Specify a custom answer for this question"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left text-[12.5px] transition-colors cursor-pointer disabled:cursor-default ${
                    isOtherSelected
                      ? 'bg-[color-mix(in_srgb,var(--ui-accent)_15%,transparent)] border-[var(--ui-accent)] text-[var(--ui-text-primary)] font-medium shadow-2xs'
                      : 'bg-[color-mix(in_srgb,var(--ui-bg-surface)_40%,transparent)] hover:bg-[var(--ui-bg-surface)] border-[var(--ui-border)] text-[var(--ui-text-secondary)]'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 ${
                      q.multi ? 'rounded' : 'rounded-full'
                    } border flex items-center justify-center shrink-0 ${
                      isOtherSelected
                        ? 'bg-[var(--ui-accent)] border-[var(--ui-accent)] text-[var(--ui-bg-subtle)]'
                        : 'border-[color-mix(in_srgb,var(--ui-text-muted)_50%,transparent)] bg-[color-mix(in_srgb,var(--ui-bg-subtle)_60%,transparent)]'
                    }`}
                  >
                    {isOtherSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </span>
                  <span>
                    {!isOtherSelected && customVal.trim()
                      ? `Other: ${customVal.trim()}`
                      : 'Other'}
                  </span>
                </button>
              </div>

              {/* Clean full-width input row when "Other" is selected */}
              {isOtherSelected && (
                <div className="pt-1">
                  <input
                    ref={(el) => {
                      otherInputRefs.current[q.id] = el;
                    }}
                    type="text"
                    disabled={Boolean(submittedSummary)}
                    value={customVal}
                    onChange={(e) =>
                      setCustomValues((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirm(isStage1Card ? 'stage1_continue' : 'generate_blueprint');
                      }
                    }}
                    placeholder={getOtherPlaceholder(q.label)}
                    className="w-full px-3.5 py-2 rounded-lg bg-[color-mix(in_srgb,var(--ui-bg-surface)_90%,transparent)] border border-[color-mix(in_srgb,var(--ui-accent)_70%,transparent)] text-[13px] text-[var(--ui-text-primary)] placeholder:text-[color-mix(in_srgb,var(--ui-text-muted)_70%,transparent)] shadow-2xs focus:outline-none focus:border-[var(--ui-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ui-accent)_15%,transparent)] transition-colors"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {submittedSummary ? (
        <div className="flex items-center gap-2 pt-2 border-t border-[color-mix(in_srgb,var(--ui-border)_60%,transparent)] text-[12px] text-[var(--ui-ok)] font-mono">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Confirmed: {submittedSummary}</span>
        </div>
      ) : (
        <div className="pt-2 border-t border-[color-mix(in_srgb,var(--ui-border)_60%,transparent)] space-y-2.5">
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm(isStage1Card ? 'stage1_continue' : 'generate_blueprint');
              }
            }}
            placeholder="Optional: Add specific details about your app/agent idea, target users, or workflow..."
            className="w-full px-3 py-1.5 rounded-lg bg-[color-mix(in_srgb,var(--ui-bg-surface)_50%,transparent)] border border-[var(--ui-border)] text-[12.5px] text-[var(--ui-text-primary)] placeholder:text-[color-mix(in_srgb,var(--ui-text-muted)_70%,transparent)] focus:outline-none focus:border-[var(--ui-accent)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                handleConfirm(isStage1Card ? 'stage1_continue' : 'generate_blueprint')
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[var(--ui-accent)] hover:opacity-95 text-white shadow-sm transition-opacity cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isStage1Card
                  ? 'Confirm Scope & Continue →'
                  : 'Confirm & Generate Blueprint →'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleConfirm('fast_track_blueprint')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ui-bg-surface)] hover:bg-[var(--ui-bg-subtle)] text-[var(--ui-text-primary)] border border-[var(--ui-border)] hover:border-[color-mix(in_srgb,var(--ui-accent)_60%,transparent)] transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
              <span>
                {isStage1Card
                  ? 'Fast-Track to Blueprint ⚡'
                  : 'Fast-Track with Defaults ⚡'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export function extractQuickActionsFromMarkdown(rawContent: string): {
  cleanedContent: string;
  quickActions: QuickActionParsedItem[];
} {
  if (!rawContent) return { cleanedContent: '', quickActions: [] };
  const quickActions: QuickActionParsedItem[] = [];
  const quickActionsBlockRegex = /<(?:quick-actions|quick_actions)>([\s\S]*?)<\/(?:quick-actions|quick_actions)>/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = quickActionsBlockRegex.exec(rawContent)) !== null) {
    const blockContent = blockMatch[1];
    const actionTagRegex = /<action\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/action>)/gi;
    let actionMatch: RegExpExecArray | null;
    while ((actionMatch = actionTagRegex.exec(blockContent)) !== null) {
      const attrsStr = actionMatch[1];
      const innerText = (actionMatch[2] || '').trim();
      const idMatch = attrsStr.match(/\bid=["']([^"']+)["']/i);
      const labelMatch = attrsStr.match(/\blabel=["']([^"']+)["']/i);
      const promptMatch = attrsStr.match(/\bprompt=["']([^"']+)["']/i);
      const variantMatch = attrsStr.match(/\bvariant=["']([^"']+)["']/i);
      const iconMatch = attrsStr.match(/\bicon=["']([^"']+)["']/i);

      const label = labelMatch ? labelMatch[1] : innerText || 'Action';
      const prompt = promptMatch ? promptMatch[1] : innerText || label;
      const actionId = idMatch ? idMatch[1] : `qa_${quickActions.length + 1}`;
      quickActions.push({
        actionId,
        label,
        prompt,
        variant: variantMatch ? variantMatch[1].toLowerCase() : 'secondary',
        icon: iconMatch ? iconMatch[1].toLowerCase() : undefined,
      });
    }
  }

  let cleanedContent = rawContent.replace(quickActionsBlockRegex, '').trimEnd();
  // Also strip unclosed <quick-actions> blocks during active streaming
  cleanedContent = cleanedContent.replace(/<(?:quick-actions|quick_actions)>[\s\S]*$/gi, '').trimEnd();
  return { cleanedContent, quickActions };
}

function getAlertStyle(type: string) {
  switch (type.toUpperCase()) {
    case 'TIP':
      return {
        border: 'border-emerald-500/40',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        icon: Sparkles,
      };
    case 'IMPORTANT':
      return {
        border: 'border-violet-500/40',
        bg: 'bg-violet-500/10',
        text: 'text-violet-400',
        icon: Flame,
      };
    case 'WARNING':
      return {
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        icon: AlertTriangle,
      };
    case 'CAUTION':
      return {
        border: 'border-rose-500/40',
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        icon: AlertCircle,
      };
    case 'NOTE':
    default:
      return {
        border: 'border-[color-mix(in_srgb,var(--ui-accent)_40%,transparent)]',
        bg: 'bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)]',
        text: 'text-[var(--ui-accent)]',
        icon: Info,
      };
  }
}

/**
 * Zero-dependency syntax highlighter for One Dark / One Light code blocks
 */
function highlightCodeLine(line: string, lang: string, lineIdx: number): React.ReactNode {
  if (!line) return '\n';
  const trimmed = line.trimStart();

  // Unified diff / patch coloring
  if (lang === 'diff' || lang === 'patch') {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return (
        <span key={lineIdx} className="text-[var(--ui-ok)] bg-emerald-500/10 block">
          {line}
        </span>
      );
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      return (
        <span key={lineIdx} className="text-[var(--ui-danger)] bg-rose-500/10 block">
          {line}
        </span>
      );
    }
    if (line.startsWith('@@')) {
      return (
        <span key={lineIdx} className="text-[var(--ui-approval)] font-semibold block">
          {line}
        </span>
      );
    }
  }

  // Whole-line comment check
  if (
    trimmed.startsWith('//') ||
    (trimmed.startsWith('#') && !trimmed.startsWith('#!')) ||
    trimmed.startsWith('-- ')
  ) {
    return (
      <span key={lineIdx} className="text-[var(--ui-text-muted)] italic">
        {line}
      </span>
    );
  }

  const tokenRegex =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*$|#.*$|\b(?:import|export|from|const|let|var|function|async|await|return|if|else|elif|for|while|switch|case|break|continue|default|interface|type|class|extends|implements|new|try|catch|finally|throw|def|with|as|yield|pass|raise|in|is|not|and|or|pub|fn|struct|enum|impl|use|mod|match|package|go|defer|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|JOIN|LEFT|RIGHT|INNER|ON|GROUP|ORDER|BY|LIMIT|HAVING|AS|AND|OR|NOT|NULL|PRIMARY|KEY)\b|\b(?:true|false|null|undefined|None|True|False|self|this)\b|\b\d+(?:\.\d+)?\b|[A-Za-z_][A-Za-z0-9_]*(?=\s*\())/g;

  const parts = line.split(tokenRegex);
  return parts.map((tok, tIdx) => {
    if (!tok) return null;
    if (
      (tok.startsWith('"') && tok.endsWith('"')) ||
      (tok.startsWith("'") && tok.endsWith("'")) ||
      (tok.startsWith('`') && tok.endsWith('`'))
    ) {
      return (
        <span key={tIdx} className="text-[var(--ui-ok)]">
          {tok}
        </span>
      );
    }
    if (tok.startsWith('//') || tok.startsWith('#')) {
      return (
        <span key={tIdx} className="text-[var(--ui-text-muted)] italic">
          {tok}
        </span>
      );
    }
    if (/^(?:true|false|null|undefined|None|True|False|self|this|\d+(?:\.\d+)?)$/.test(tok)) {
      return (
        <span key={tIdx} className="text-[var(--ui-warn)]">
          {tok}
        </span>
      );
    }
    if (
      /^(?:import|export|from|const|let|var|function|async|await|return|if|else|elif|for|while|switch|case|break|continue|default|interface|type|class|extends|implements|new|try|catch|finally|throw|def|with|as|yield|pass|raise|in|is|not|and|or|pub|fn|struct|enum|impl|use|mod|match|package|go|defer|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|JOIN|LEFT|RIGHT|INNER|ON|GROUP|ORDER|BY|LIMIT|HAVING|AS|AND|OR|NOT|NULL|PRIMARY|KEY)$/.test(
        tok
      )
    ) {
      return (
        <span key={tIdx} className="text-[var(--ui-approval)] font-medium">
          {tok}
        </span>
      );
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) {
      return (
        <span key={tIdx} className="text-[var(--ui-accent)]">
          {tok}
        </span>
      );
    }
    return <React.Fragment key={tIdx}>{tok}</React.Fragment>;
  });
}

/**
 * Full Cyclode-grade Markdown, Mermaid Diagram, GFM Table, and GitHub Callout Alert renderer
 */
const RichMarkdownContent: React.FC<{
  content: string;
  onCopyCode?: (code: string) => void;
}> = ({ content, onCopyCode }) => {
  const [copiedBlockIdx, setCopiedBlockIdx] = useState<number | null>(null);
  const { cleanedContent } = useMemo(() => {
    const afterDecision = extractDecisionCardsFromMarkdown(content).cleanedContent;
    return extractQuickActionsFromMarkdown(afterDecision);
  }, [content]);

  const blocks = useMemo(() => {
    const result: Array<
      | { type: 'code'; lang: string; code: string }
      | { type: 'prose'; lines: string[] }
    > = [];
    const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = fenceRegex.exec(cleanedContent)) !== null) {
      if (match.index > lastIndex) {
        const proseChunk = cleanedContent.slice(lastIndex, match.index);
        result.push({ type: 'prose', lines: proseChunk.split('\n') });
      }
      result.push({
        type: 'code',
        lang: (match[1] || 'text').toLowerCase(),
        code: match[2].replace(/\n$/, ''),
      });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < cleanedContent.length) {
      result.push({ type: 'prose', lines: cleanedContent.slice(lastIndex).split('\n') });
    }
    return result;
  }, [cleanedContent]);

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard?.writeText(code);
    setCopiedBlockIdx(idx);
    onCopyCode?.(code);
    setTimeout(() => setCopiedBlockIdx(null), 1600);
  };

  return (
    <div className="space-y-3 text-[15px] leading-[1.72] text-[var(--ui-text-secondary)]">
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          if (block.lang === 'mermaid') {
            return <MermaidDiagram key={bIdx} code={block.code} />;
          }
          const codeLines = block.code.split('\n');
          return (
            <div
              key={bIdx}
              className="my-3 rounded-xl border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-bg-subtle)_90%,transparent)] overflow-hidden shadow-xs"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-[color-mix(in_srgb,var(--ui-bg-surface)_60%,transparent)] border-b border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)] text-[11px] font-mono text-[var(--ui-text-muted)]">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider font-semibold text-[10.5px] text-[var(--ui-accent)]">
                    <FileCode2 className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                    {block.lang || 'code'}
                  </span>
                  <span className="text-[10px] text-[color-mix(in_srgb,var(--ui-text-muted)_75%,transparent)]">
                    ({codeLines.length} {codeLines.length === 1 ? 'line' : 'lines'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(block.code, bIdx)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] transition-colors"
                >
                  {copiedBlockIdx === bIdx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--ui-ok)]" />
                      <span className="text-[var(--ui-ok)]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex font-mono text-[12.5px] leading-[1.6] overflow-x-auto p-3.5">
                {codeLines.length > 2 && (
                  <pre
                    aria-hidden="true"
                    className="select-none text-[color-mix(in_srgb,var(--ui-text-muted)_45%,transparent)] text-right pr-3 border-r border-[color-mix(in_srgb,var(--ui-border)_50%,transparent)] font-mono leading-[1.6] shrink-0 m-0"
                  >
                    {codeLines.map((_, idx) => idx + 1).join('\n')}
                  </pre>
                )}
                <pre
                  className={`text-[var(--ui-text-primary)] font-mono leading-[1.6] ${
                    codeLines.length > 2 ? 'pl-3.5' : ''
                  } flex-1 overflow-x-auto m-0`}
                >
                  <code>
                    {codeLines.map((ln, lIdx) => (
                      <React.Fragment key={lIdx}>
                        {highlightCodeLine(ln, block.lang, lIdx)}
                        {lIdx < codeLines.length - 1 ? '\n' : ''}
                      </React.Fragment>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          );
        }

        // Render prose lines (headings, tables, GitHub alerts, blockquotes, bullet/numbered lists, paragraphs)
        const elements: React.ReactNode[] = [];
        let listItems: React.ReactNode[] = [];
        let listKind: 'ul' | 'ol' | null = null;
        let activeTable: {
          headers: string[];
          rows: string[][];
          alignments: Array<'left' | 'center' | 'right'>;
        } | null = null;

        const flushList = (keyPrefix: string) => {
          if (listItems.length > 0) {
            if (listKind === 'ol') {
              elements.push(
                <ol key={`${keyPrefix}-ol`} className="my-2 space-y-2 pl-1">
                  {listItems}
                </ol>
              );
            } else {
              elements.push(
                <ul key={`${keyPrefix}-ul`} className="my-2 space-y-1.5 pl-1">
                  {listItems}
                </ul>
              );
            }
            listItems = [];
            listKind = null;
          }
        };

        const flushTable = (keyPrefix: string) => {
          if (!activeTable) return;
          const tbl = activeTable;
          activeTable = null;
          const headerCount = tbl.headers.length;
          const getAlignClass = (idx: number) => {
            const al = tbl.alignments[idx];
            if (al === 'center') return 'text-center';
            if (al === 'right') return 'text-right';
            return 'text-left';
          };
          elements.push(
            <div
              key={`${keyPrefix}-table`}
              className="my-3 overflow-x-auto rounded-xl bg-[color-mix(in_srgb,var(--ui-bg-subtle)_40%,transparent)] border border-[color-mix(in_srgb,var(--ui-border)_60%,transparent)] shadow-xs"
            >
              <table className="w-full border-collapse text-[14px] table-auto">
                {tbl.headers.length > 0 && (
                  <thead>
                    <tr className="bg-[color-mix(in_srgb,var(--ui-bg-surface)_70%,transparent)] text-[var(--ui-text-primary)] font-medium border-b border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)]">
                      {tbl.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          className={`px-3.5 py-2.5 font-mono text-[12.5px] font-semibold whitespace-nowrap ${getAlignClass(
                            hIdx
                          )}`}
                        >
                          {renderInlineMarkdown(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-[color-mix(in_srgb,var(--ui-border)_40%,transparent)]">
                  {tbl.rows.map((row, rIdx) => {
                    const cells = [...row];
                    while (headerCount > 0 && cells.length < headerCount) {
                      cells.push('');
                    }
                    return (
                      <tr
                        key={rIdx}
                        className="odd:bg-transparent even:bg-[color-mix(in_srgb,var(--ui-bg-surface)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--ui-bg-surface)_40%,transparent)] transition-colors"
                      >
                        {cells.map((cell, cIdx) => {
                          const isCompact = cell.trim().length <= 36 || cIdx === 0;
                          return (
                            <td
                              key={cIdx}
                              className={`px-3.5 py-2.5 text-[var(--ui-text-secondary)] text-[14px] leading-relaxed align-top ${
                                isCompact ? 'whitespace-nowrap' : 'min-w-[160px] break-normal'
                              } ${getAlignClass(cIdx)}`}
                            >
                              {renderInlineMarkdown(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        };

        const lines = block.lines;
        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          const rawLine = lines[lIdx];
          const line = rawLine.trim();

          if (!line) {
            flushList(`${bIdx}-${lIdx}`);
            flushTable(`${bIdx}-${lIdx}`);
            continue;
          }

          // Table row detection: starts with '|' or contains pipes while inside a table
          if (line.startsWith('|') || (activeTable && line.includes('|'))) {
            flushList(`${bIdx}-${lIdx}`);
            let rawRow = line;
            if (rawRow.startsWith('|')) rawRow = rawRow.slice(1);
            if (rawRow.endsWith('|')) rawRow = rawRow.slice(0, -1);
            const cells = rawRow.split('|').map((c) => c.trim());
            const isDelimiter = cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
            if (isDelimiter) {
              if (activeTable) {
                activeTable.alignments = cells.map((c) => {
                  if (c.startsWith(':') && c.endsWith(':')) return 'center';
                  if (c.endsWith(':')) return 'right';
                  return 'left';
                });
              }
              continue;
            }
            if (!activeTable) {
              activeTable = { headers: cells, rows: [], alignments: [] };
            } else {
              activeTable.rows.push(cells);
            }
            continue;
          } else if (activeTable) {
            flushTable(`${bIdx}-${lIdx}`);
          }

          // GitHub Callout Alert: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
          const alertMatch = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
          if (alertMatch) {
            flushList(`${bIdx}-${lIdx}`);
            const alertType = alertMatch[1].toUpperCase();
            const alertLines: string[] = [];
            if (alertMatch[2].trim()) alertLines.push(alertMatch[2].trim());
            while (
              lIdx + 1 < lines.length &&
              lines[lIdx + 1].trim().startsWith('>') &&
              !lines[lIdx + 1].trim().match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
            ) {
              lIdx++;
              alertLines.push(lines[lIdx].trim().replace(/^>\s?/, ''));
            }
            const style = getAlertStyle(alertType);
            const AlertIcon = style.icon;
            elements.push(
              <div
                key={`${bIdx}-${lIdx}-alert`}
                className={`my-2.5 p-3 rounded-xl border ${style.border} ${style.bg} flex items-start gap-2.5 text-[13.5px] leading-relaxed`}
              >
                <AlertIcon className={`w-4 h-4 ${style.text} shrink-0 mt-0.5`} />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className={`font-bold font-mono text-[10.5px] uppercase tracking-wider ${style.text}`}>
                    {alertType}
                  </div>
                  <div className="text-[var(--ui-text-secondary)] space-y-1">
                    {alertLines.map((al, aIdx) => (
                      <p key={aIdx}>{renderInlineMarkdown(al)}</p>
                    ))}
                  </div>
                </div>
              </div>
            );
            continue;
          }

          // Standard blockquote: > ...
          if (line.startsWith('>')) {
            flushList(`${bIdx}-${lIdx}`);
            const quoteLines: string[] = [line.replace(/^>\s?/, '')];
            while (
              lIdx + 1 < lines.length &&
              lines[lIdx + 1].trim().startsWith('>') &&
              !lines[lIdx + 1].trim().match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
            ) {
              lIdx++;
              quoteLines.push(lines[lIdx].trim().replace(/^>\s?/, ''));
            }
            elements.push(
              <blockquote
                key={`${bIdx}-${lIdx}-quote`}
                className="border-l-2 border-[color-mix(in_srgb,var(--ui-accent)_70%,transparent)] pl-3.5 py-2 my-2.5 bg-[color-mix(in_srgb,var(--ui-bg-surface)_35%,transparent)] rounded-r-lg text-[var(--ui-text-secondary)] text-[13.5px] leading-[1.7] space-y-1.5"
              >
                {quoteLines.map((ql, qIdx) => (
                  <p key={qIdx}>{renderInlineMarkdown(ql)}</p>
                ))}
              </blockquote>
            );
            continue;
          }

          // Horizontal rule
          if (line === '---' || line === '***' || line === '___') {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <hr
                key={`${bIdx}-${lIdx}-hr`}
                className="my-5 border-0 h-px bg-[color-mix(in_srgb,var(--ui-border)_70%,transparent)]"
              />
            );
            continue;
          }

          if (line.startsWith('#### ')) {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <h4 key={`${bIdx}-${lIdx}`} className="text-[14.5px] font-semibold text-[var(--ui-text-primary)] pt-1.5 pb-0.5">
                {renderInlineMarkdown(line.slice(5))}
              </h4>
            );
            continue;
          }

          if (line.startsWith('### ')) {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <h3 key={`${bIdx}-${lIdx}`} className="text-[15.5px] font-semibold text-[var(--ui-text-primary)] pt-2 pb-0.5">
                {renderInlineMarkdown(line.slice(4))}
              </h3>
            );
            continue;
          }

          if (line.startsWith('## ')) {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <h2 key={`${bIdx}-${lIdx}`} className="text-[17px] font-bold text-[var(--ui-text-primary)] tracking-tight pt-3 pb-0.5">
                {renderInlineMarkdown(line.slice(3))}
              </h2>
            );
            continue;
          }

          if (line.startsWith('# ')) {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <h1
                key={`${bIdx}-${lIdx}`}
                className="text-[18.5px] font-bold text-[var(--ui-text-primary)] tracking-tight pt-3.5 pb-1 border-b border-[var(--ui-border)]"
              >
                {renderInlineMarkdown(line.slice(2))}
              </h1>
            );
            continue;
          }

          // Ordered list item: 1. ...
          const orderedMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
          if (orderedMatch) {
            const indentSpaces = orderedMatch[1].length;
            const numLabel = orderedMatch[2];
            const itemText = orderedMatch[3];
            if (listKind && listKind !== 'ol' && indentSpaces < 2) {
              flushList(`${bIdx}-${lIdx}`);
            }
            if (!listKind) listKind = 'ol';
            listItems.push(
              <li
                key={`${bIdx}-${lIdx}`}
                className={`flex items-start gap-2.5 text-[15px] leading-[1.72] ${
                  indentSpaces >= 2 ? 'ml-5 pl-3 border-l border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)]' : ''
                }`}
              >
                <span className="font-mono text-[13.5px] font-semibold text-[var(--ui-accent)] shrink-0 mt-0.5 select-none">
                  {numLabel}.
                </span>
                <span className="flex-1 text-[var(--ui-text-secondary)]">{renderInlineMarkdown(itemText)}</span>
              </li>
            );
            continue;
          }

          // Unordered list item: - / * / • (with optional [ ] / [x] task checkbox)
          const unorderedMatch = rawLine.match(/^(\s*)([•\-*])\s+(.*)$/);
          if (unorderedMatch) {
            const indentSpaces = unorderedMatch[1].length;
            let itemText = unorderedMatch[3];
            let taskChecked: boolean | null = null;
            if (itemText.startsWith('[ ] ')) {
              taskChecked = false;
              itemText = itemText.slice(4);
            } else if (itemText.startsWith('[x] ') || itemText.startsWith('[X] ')) {
              taskChecked = true;
              itemText = itemText.slice(4);
            }

            if (listKind && listKind !== 'ul' && indentSpaces < 2) {
              flushList(`${bIdx}-${lIdx}`);
            }
            if (!listKind) listKind = 'ul';
            listItems.push(
              <li
                key={`${bIdx}-${lIdx}`}
                className={`flex items-start gap-2.5 text-[15px] leading-[1.72] ${
                  indentSpaces >= 2 ? 'ml-5 pl-3 border-l border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)]' : ''
                }`}
              >
                {taskChecked !== null ? (
                  <span
                    className={`mt-1.5 w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                      taskChecked
                        ? 'bg-[color-mix(in_srgb,var(--ui-accent)_20%,transparent)] border-[var(--ui-accent)] text-[var(--ui-accent)]'
                        : 'bg-[var(--ui-bg-subtle)] border-[var(--ui-border)]'
                    }`}
                  >
                    {taskChecked && <Check className="w-2.5 h-2.5" />}
                  </span>
                ) : (
                  <span
                    className={`mt-2.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      indentSpaces >= 2 ? 'bg-[var(--ui-text-muted)]' : 'bg-[var(--ui-accent)]'
                    }`}
                  />
                )}
                <span className="flex-1 text-[var(--ui-text-secondary)]">{renderInlineMarkdown(itemText)}</span>
              </li>
            );
            continue;
          }

          flushList(`${bIdx}-${lIdx}`);
          elements.push(
            <p key={`${bIdx}-${lIdx}`} className="text-[15px] leading-[1.72] text-[var(--ui-text-secondary)]">
              {renderInlineMarkdown(line)}
            </p>
          );
        }

        flushList(`${bIdx}-end`);
        flushTable(`${bIdx}-end`);
        return <React.Fragment key={bIdx}>{elements}</React.Fragment>;
      })}
    </div>
  );
};

function getVerbBadgeClasses(_verb: string): string {
  return 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-secondary)] border-[var(--ui-border)]';
}

function getVerbDotColor(verb: string): string {
  const v = String(verb || '').toLowerCase();
  if (v.includes('edit') || v.includes('patch') || v.includes('update')) return 'var(--ui-warn)';
  if (v.includes('verif') || v.includes('guard') || v.includes('auth') || v.includes('policy')) return '#8F80FF';
  if (v.includes('meter') || v.includes('synth') || v.includes('create') || v.includes('assembl')) return 'var(--ui-accent)';
  return 'var(--ui-text-muted)';
}

export const AppemblyWorkbench: React.FC<AppemblyWorkbenchProps> = ({
  preset = 'appembly_dash',
  accentColor = '#4E8067',
  sessionTitle = 'Interactive Assembly Session',
  sessionStatus = 'AI Gateway · Zero-Trust Guardrails Active',
  messages,
  onSendMessage,
  onFollowUpAction,
  onOpenByokModal,
  onBackToOverview,
  showOverviewLanding = false,
  renderOverviewLanding,
  personas,
  models = DEFAULT_MODELS,
  contextOptions = DEFAULT_CONTEXT_OPTIONS,
  defaultContextRefs,
  onContextRefsChange,
  executionMode: controlledExecutionMode,
  onExecutionModeChange,
  selectedPersonaId: controlledPersonaId,
  onSelectPersonaId,
  selectedModelId: controlledModelId,
  onSelectModelId,
  composerValue: controlledComposerValue,
  onComposerValueChange,
  composerPlaceholder = 'Describe an application, assemble an 8-part autonomous agent, or configure routing & guardrails… (Enter to send, Shift+Enter for newline)',
  auxiliaryTabs = [],
  activeAuxTabId: controlledAuxTabId,
  onActiveAuxTabChange,
  defaultLayoutMode = 'split',
  layoutMode: controlledLayoutMode,
  onLayoutModeChange,
  isStreaming = false,
  onStopStreaming,
  className = '',
}) => {
  const availablePersonas = personas || DEFAULT_PERSONAS_BY_PRESET[preset] || DEFAULT_PERSONAS_BY_PRESET.appembly_dash;

  const [internalPersonaId, setInternalPersonaId] = useState<string>(availablePersonas[0]?.id || 'agent_assembler');
  const activePersonaId = controlledPersonaId ?? internalPersonaId;
  const setActivePersonaId = (id: string) => {
    setInternalPersonaId(id);
    onSelectPersonaId?.(id);
  };

  const [internalModelId, setInternalModelId] = useState<string>(models[0]?.id || 'claude-3-7-sonnet');
  const activeModelId = controlledModelId ?? internalModelId;
  const setActiveModelId = (id: string) => {
    setInternalModelId(id);
    onSelectModelId?.(id);
  };

  const [internalComposer, setInternalComposer] = useState<string>('');
  const composerText = controlledComposerValue !== undefined ? controlledComposerValue : internalComposer;
  const setComposerText = (val: string) => {
    setInternalComposer(val);
    onComposerValueChange?.(val);
  };

  const [internalLayoutMode, setInternalLayoutMode] = useState<WorkbenchLayoutMode>(defaultLayoutMode);
  const layoutMode = controlledLayoutMode ?? internalLayoutMode;
  const setLayoutMode = (mode: WorkbenchLayoutMode) => {
    setInternalLayoutMode(mode);
    onLayoutModeChange?.(mode);
  };

  const [internalAuxTab, setInternalAuxTab] = useState<string>(auxiliaryTabs[0]?.id || 'blueprint');
  const activeAuxTab = controlledAuxTabId ?? internalAuxTab;
  const setActiveAuxTab = (tabId: string) => {
    setInternalAuxTab(tabId);
    onActiveAuxTabChange?.(tabId);
  };

  const [internalExecutionMode, setInternalExecutionMode] = useState<'agentic' | 'readonly'>('agentic');
  const executionMode = controlledExecutionMode ?? internalExecutionMode;
  const setExecutionMode = (nextMode: 'agentic' | 'readonly') => {
    setInternalExecutionMode(nextMode);
    onExecutionModeChange?.(nextMode);
  };

  const [selectedContextRefs, setSelectedContextRefs] = useState<string[]>(defaultContextRefs ?? []);
  useEffect(() => {
    if (defaultContextRefs !== undefined) {
      setSelectedContextRefs(defaultContextRefs);
    }
  }, [JSON.stringify(defaultContextRefs)]);
  const [attachments, setAttachments] = useState<string[]>([]);

  // Popover states
  const [openMenu, setOpenMenu] = useState<'persona' | 'model' | 'context' | null>(null);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [expandedStepOutputs, setExpandedStepOutputs] = useState<Record<string, boolean>>({});
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>('');
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Split resizer state
  const [leftPanePercent, setLeftPanePercent] = useState<number>(56);
  const isResizingRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activePersona =
    availablePersonas.find((p) => p.id === activePersonaId) || availablePersonas[0];
  const activeModel =
    models.find((m) => m.id === activeModelId) || models[0];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isStreaming]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPanePercent(Math.min(72, Math.max(34, pct)));
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleSend = () => {
    const trimmed = composerText.trim();
    if (!trimmed && attachments.length === 0) return;
    const effectivePrompt =
      trimmed || `Analyze the attached file(s): ${attachments.join(', ')}`;
    onSendMessage(effectivePrompt, {
      persona: activePersona,
      model: activeModel,
      executionMode,
      contextRefs: selectedContextRefs,
      attachments,
    });
    setComposerText('');
    setAttachments([]);
    setOpenMenu(null);
  };

  const prefillComposer = (prompt: string, personaId?: string) => {
    if (personaId) {
      setActivePersonaId(personaId);
    }
    setComposerText(prompt);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 30);
  };

  const toggleContextRef = (id: string) => {
    setSelectedContextRefs((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      onContextRefsChange?.(next);
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const names = Array.from(files).map((f) => f.name);
    setAttachments((prev) => [...prev, ...names]);
    e.target.value = '';
  };

  const activeAuxTabObj =
    auxiliaryTabs.find((t) => t.id === activeAuxTab) || auxiliaryTabs[0];

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full w-full bg-[var(--ui-bg-canvas)] text-[var(--ui-text-secondary)] overflow-hidden select-none ${className}`}
    >
      {/* Top Workbench Session & Mode Bar (hidden in appembly_dash to avoid double header bar) */}
      {preset !== 'appembly_dash' && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-bg-subtle)_60%,transparent)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBackToOverview && !showOverviewLanding && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] bg-[color-mix(in_srgb,var(--ui-bg-surface)_70%,transparent)] hover:bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-semibold text-[var(--ui-text-primary)] truncate">
                {sessionTitle}
              </span>
              {sessionStatus && (
                <>
                  <span className="text-[var(--ui-text-muted)] text-xs">·</span>
                  <span className="text-[11.5px] text-[var(--ui-text-muted)] truncate hidden sm:inline">
                    {sessionStatus}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: 3-Mode Layout Switcher (Chat | Split | Workbench) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center p-0.5 rounded-lg bg-[var(--ui-bg-subtle)] border border-[var(--ui-border)]">
              <button
                type="button"
                onClick={() => setLayoutMode('chat')}
                title="Full Chat Canvas"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                  layoutMode === 'chat'
                    ? 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] shadow-sm'
                    : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('split')}
                title="Split Chat + Auxiliary Workbench"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                  layoutMode === 'split'
                    ? 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] shadow-sm'
                    : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('workbench')}
                title="Full Auxiliary Workbench"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                  layoutMode === 'workbench'
                    ? 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] shadow-sm'
                    : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'
                }`}
              >
                <PanelRight className="w-3.5 h-3.5" />
                <span>Workbench</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Split Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* LEFT PANE: Cyclode Open-Canvas Chat + Floating 2-Zone Composer */}
        {layoutMode !== 'workbench' && (
          <div
            style={{
              width:
                layoutMode === 'split' && auxiliaryTabs.length > 0
                  ? `${leftPanePercent}%`
                  : '100%',
            }}
            className="flex flex-col h-full min-w-0 bg-[var(--ui-bg-canvas)] select-text"
          >
            {/* Scrollable Conversation or Overview Viewport */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 pb-8 space-y-6 chat-scroll-viewport">
              {showOverviewLanding && renderOverviewLanding ? (
                renderOverviewLanding({
                  prefillComposer,
                  focusComposer: () => textareaRef.current?.focus(),
                })
              ) : null}

              {/* Conversation Turns */}
              <div className="max-w-3xl xl:max-w-4xl mx-auto space-y-6">
                {messages.map((msg, msgIdx) => {
                  if (msg.role === 'user') {
                    const isEditingThis = editingMessageId === msg.id;
                    const submitInlineEdit = () => {
                      const trimmedEdit = editingMessageText.trim();
                      if (!trimmedEdit || isStreaming) return;
                      setEditingMessageId(null);
                      onSendMessage(trimmedEdit, {
                        persona: activePersona,
                        model: activeModel,
                        executionMode,
                        contextRefs: msg.contextRefs || selectedContextRefs,
                        attachments: msg.attachments || [],
                        replaceMessageId: msg.id,
                      });
                    };

                    return (
                      <div
                        key={msg.id}
                        className="group flex flex-col items-end space-y-1.5 ap-stream-fade-in"
                      >
                        <div className="flex items-center gap-2 text-[11px] text-[var(--ui-text-muted)]">
                          <span>You</span>
                          <span>·</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        {isEditingThis ? (
                          <div className="w-full max-w-[85%] rounded-2xl rounded-tr-sm p-3.5 bg-[var(--ui-bg-surface)] border border-[var(--ui-accent)] shadow-md space-y-2.5">
                            <textarea
                              ref={editTextareaRef}
                              value={editingMessageText}
                              onChange={(e) => setEditingMessageText(e.target.value)}
                              rows={Math.min(8, Math.max(2, editingMessageText.split('\n').length))}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditingMessageId(null);
                                } else if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  submitInlineEdit();
                                }
                              }}
                              className="w-full bg-transparent text-[15px] leading-[1.68] text-[var(--ui-text-primary)] placeholder:text-[var(--ui-text-muted)] resize-y focus:outline-none"
                            />
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[color-mix(in_srgb,var(--ui-border)_80%,transparent)]">
                              <span className="text-[11px] font-mono text-[var(--ui-text-muted)]">
                                Enter to save &amp; regenerate · Esc to cancel
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingMessageId(null)}
                                  className="px-2.5 py-1 rounded-md text-[12px] font-medium text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-subtle)] border border-[var(--ui-border)] transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={submitInlineEdit}
                                  disabled={!editingMessageText.trim() || isStreaming}
                                  style={{
                                    backgroundColor:
                                      editingMessageText.trim() && !isStreaming
                                        ? accentColor
                                        : undefined,
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-semibold bg-[var(--ui-accent)] text-white shadow-xs hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Save &amp; Submit</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] text-[15px] leading-[1.68] text-[var(--ui-text-primary)] shadow-sm">
                              {((msg.contextRefs && msg.contextRefs.length > 0) ||
                                (msg.attachments && msg.attachments.length > 0)) && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {msg.contextRefs?.map((ref) => (
                                    <span
                                      key={ref}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--ui-bg-subtle)] text-[var(--ui-accent)] border border-[var(--ui-border)]"
                                    >
                                      {ref}
                                    </span>
                                  ))}
                                  {msg.attachments?.map((file, fIdx) => (
                                    <span
                                      key={`${file}-${fIdx}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--ui-bg-subtle)] text-[var(--ui-text-primary)] border border-[var(--ui-border)]"
                                    >
                                      <Paperclip className="w-3 h-3 text-[var(--ui-accent)]" />
                                      <span>{file}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(() => {
                                const parsedDecision = parseConfirmedDecisionMessage(msg.content);
                                if (!parsedDecision) {
                                  return <div className="whitespace-pre-wrap">{msg.content}</div>;
                                }
                                return (
                                  <div className="space-y-2 py-0.5">
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-[color-mix(in_srgb,var(--ui-accent)_15%,transparent)] text-[var(--ui-accent)] border border-[color-mix(in_srgb,var(--ui-accent)_30%,transparent)]">
                                      {parsedDecision.isFastTrack ? (
                                        <Sparkles className="w-3 h-3" />
                                      ) : (
                                        <Check className="w-3 h-3 stroke-[2.5]" />
                                      )}
                                      <span>{parsedDecision.badgeLabel}</span>
                                    </div>
                                    <div className="space-y-1">
                                      {parsedDecision.items.map((item, idx) => (
                                        <div
                                          key={idx}
                                          className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[14px] leading-[1.55]"
                                        >
                                          {item.label && (
                                            <span className="text-[var(--ui-text-muted)] font-normal">
                                              {item.label}:
                                            </span>
                                          )}
                                          <span className="font-semibold text-[var(--ui-text-primary)]">
                                            {item.value}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    {parsedDecision.additionalContext && (
                                      <div className="pt-1.5 border-t border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)] text-[13.5px] leading-[1.5] text-[var(--ui-text-secondary)]">
                                        <span className="text-[var(--ui-text-muted)]">Note: </span>
                                        <span>{parsedDecision.additionalContext}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            {/* Hover User Turn Action Bar (hidden while streaming) */}
                            {!isStreaming && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (msg.personaId) setActivePersonaId(msg.personaId);
                                    setEditingMessageId(msg.id);
                                    setEditingMessageText(msg.content);
                                    setTimeout(() => {
                                      if (editTextareaRef.current) {
                                        editTextareaRef.current.focus();
                                        const len = editTextareaRef.current.value.length;
                                        editTextareaRef.current.setSelectionRange(len, len);
                                      }
                                    }, 20);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-surface)]"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSendMessage(msg.content, {
                                      persona: activePersona,
                                      model: activeModel,
                                      executionMode,
                                      contextRefs: msg.contextRefs || selectedContextRefs,
                                      attachments: msg.attachments || [],
                                      replaceMessageId: msg.id,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-surface)]"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Retry</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(msg.content);
                                    setCopiedTurnId(msg.id);
                                    setTimeout(() => setCopiedTurnId(null), 1500);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-surface)]"
                                >
                                  {copiedTurnId === msg.id ? (
                                    <Check className="w-3 h-3 text-[var(--ui-ok)]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  <span>Copy</span>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }

                  // Assistant Open-Canvas Turn (Cyclode Architecture)
                  const isTraceOpen = expandedTraces[msg.id] ?? false;
                  const isPlanOpen = expandedPlans[msg.id] ?? true;
                  const isReasoningOpen = expandedReasoning[msg.id] ?? false;
                  const isTurnStreaming =
                    msg.timestamp === 'Streaming…' ||
                    (Boolean(isStreaming) && msgIdx === messages.length - 1);
                  const precedingUserMsg = [...messages.slice(0, msgIdx)]
                    .reverse()
                    .find((m) => m.role === 'user');

                  return (
                    <div
                      key={msg.id}
                      className={`group flex flex-col space-y-3 ap-stream-fade-in ${
                        msgIdx < messages.length - 1 && !isTurnStreaming
                          ? 'pb-5 border-b border-[color-mix(in_srgb,var(--ui-border)_60%,transparent)]'
                          : 'pb-2'
                      }`}
                    >
                      {/* Turn Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] flex items-center justify-center shrink-0">
                            <AppemblyLogo
                              variant="mark"
                              size={16}
                              strokeColor={accentColor}
                              animated={isTurnStreaming}
                              speed="loader"
                            />
                          </div>
                          <span className="text-[13.5px] font-semibold text-[var(--ui-text-primary)]">
                            {msg.personaLabel || activePersona.label}
                          </span>
                          {msg.modelLabel && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-[var(--ui-bg-surface)] text-[var(--ui-text-secondary)] border border-[var(--ui-border)]">
                              {msg.modelLabel}
                            </span>
                          )}
                          {!isTurnStreaming && msg.timestamp && (
                            <span className="text-[11px] text-[var(--ui-text-muted)]">
                              {msg.timestamp}
                            </span>
                          )}
                        </div>

                        {!isTurnStreaming && (msg.tokens || msg.latencySec) && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-[var(--ui-text-muted)] hidden sm:inline">
                              {msg.tokens ? `~${msg.tokens} tok` : ''}
                              {msg.tokens && msg.latencySec ? ' · ' : ''}
                              {msg.latencySec ? msg.latencySec : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Collapsible Plan / Approach Card */}
                      {msg.plan && msg.plan.length > 0 && (
                        <div className="rounded-lg border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-bg-subtle)_60%,transparent)] overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPlans((p) => ({
                                ...p,
                                [msg.id]: !isPlanOpen,
                              }))
                            }
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-medium text-[var(--ui-text-secondary)] hover:bg-[color-mix(in_srgb,var(--ui-bg-surface)_50%,transparent)] transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isPlanOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[var(--ui-text-muted)]" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[var(--ui-text-muted)]" />
                              )}
                              <Layers className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                              <span>
                                Plan & Execution Approach · {msg.plan.length} stages
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-emerald-400">
                              All stages verified
                            </span>
                          </button>
                          {isPlanOpen && (
                            <div className="px-3.5 py-2 border-t border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)] grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {msg.plan.map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className="flex items-center gap-2 text-[12px] text-[var(--ui-text-secondary)]"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">{item.title}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Collapsible Reasoning Process Card (when model emits thinking/reasoning) */}
                      {msg.reasoning && msg.reasoning.trim().length > 0 && (
                        <div className="rounded-lg border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-bg-subtle)_55%,transparent)] overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedReasoning((prev) => ({
                                ...prev,
                                [msg.id]: !isReasoningOpen,
                              }))
                            }
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-[var(--ui-text-secondary)] hover:bg-[color-mix(in_srgb,var(--ui-bg-surface)_50%,transparent)] transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isReasoningOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[var(--ui-text-muted)] shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[var(--ui-text-muted)] shrink-0" />
                              )}
                              <Sparkles className="w-3.5 h-3.5 text-[var(--ui-accent)] shrink-0" />
                              <span className="font-mono text-[11.5px] font-medium text-[var(--ui-text-primary)] shrink-0">
                                Reasoning process
                              </span>
                              {!isReasoningOpen && (
                                <span className="text-[12px] text-[var(--ui-text-muted)] truncate">
                                  — {msg.reasoning.split('\n')[0]?.replace(/^[#*>-]+\s*/, '')}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-[var(--ui-text-muted)] shrink-0 ml-2">
                              {isReasoningOpen ? 'Hide' : 'Show'}
                            </span>
                          </button>
                          {isReasoningOpen && (
                            <div className="px-3.5 py-2.5 border-t border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)] bg-[color-mix(in_srgb,var(--ui-bg-canvas)_40%,transparent)] text-[13px] leading-relaxed text-[color-mix(in_srgb,var(--ui-text-secondary)_90%,transparent)] max-h-64 overflow-y-auto">
                              <RichMarkdownContent content={msg.reasoning} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Collapsible Tool Action Step Accordion (Cyclode Style) */}
                      {msg.steps && msg.steps.length > 0 && (
                        <div className="rounded-lg border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-bg-subtle)_75%,transparent)] overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTraces((prev) => ({
                                ...prev,
                                [msg.id]: !isTraceOpen,
                              }))
                            }
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-[var(--ui-text-secondary)] hover:bg-[color-mix(in_srgb,var(--ui-bg-surface)_50%,transparent)] transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isTraceOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[var(--ui-text-muted)] shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[var(--ui-text-muted)] shrink-0" />
                              )}
                              <Terminal className="w-3.5 h-3.5 text-[var(--ui-accent)] shrink-0" />
                              <span className="font-medium text-[var(--ui-text-primary)] shrink-0">
                                {msg.steps.length} {msg.steps.length === 1 ? 'step' : 'steps'} completed
                              </span>
                              {!isTraceOpen && (
                              <div className="flex items-center gap-1 overflow-hidden">
                                {msg.steps.slice(0, 2).map((s: any, idx) => {
                                  const shortTarget = String(s.target || s.tool_name || '').replace(
                                    /^(appembly_unified|cyclode_coding|sauthen_identity|meterbox_finops|adappty_autonomic)\./i,
                                    ''
                                  );
                                  return (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.2 rounded text-[10.5px] font-mono bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] border border-[var(--ui-border)] truncate max-w-[260px]"
                                    >
                                      {shortTarget.replace(/\s*\(.*\)$/, '')}
                                    </span>
                                  );
                                })}
                                {msg.steps.length > 2 && (
                                  <span className="text-[11px] text-[var(--ui-text-muted)] shrink-0">+{msg.steps.length - 2} more</span>
                                )}
                              </div>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-[var(--ui-text-muted)] shrink-0 ml-2">
                              {isTraceOpen ? 'Hide' : 'Details'}
                            </span>
                          </button>

                          {isTraceOpen && (
                            <div className="p-2.5 border-t border-[var(--ui-border)] space-y-1.5 bg-[color-mix(in_srgb,var(--ui-bg-canvas)_50%,transparent)]">
                              {msg.steps.map((step: any, sIdx) => {
                                const stepKey = `${msg.id}-step-${sIdx}`;
                                const fullOutput =
                                  step.commandOutput ||
                                  step.diffPreview ||
                                  step.output ||
                                  step.detail ||
                                  '';
                                const isStepExpanded = expandedStepOutputs[stepKey] ?? false;

                                return (
                                  <div
                                    key={step.id || sIdx}
                                    className="rounded-md bg-[var(--ui-bg-subtle)] border border-[color-mix(in_srgb,var(--ui-border)_70%,transparent)] overflow-hidden text-[12px]"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (fullOutput) {
                                          setExpandedStepOutputs((prev) => ({
                                            ...prev,
                                            [stepKey]: !isStepExpanded,
                                          }));
                                        }
                                      }}
                                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left ${
                                        fullOutput ? 'hover:bg-[color-mix(in_srgb,var(--ui-bg-surface)_40%,transparent)] cursor-pointer' : 'cursor-default'
                                      } transition-colors`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {fullOutput &&
                                          (isStepExpanded ? (
                                            <ChevronDown className="w-3 h-3 text-[var(--ui-text-muted)] shrink-0" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3 text-[var(--ui-text-muted)] shrink-0" />
                                          ))}
                                        <span className="inline-flex items-center gap-1.5 w-[84px] shrink-0 text-[11.5px] font-medium text-[var(--ui-text-secondary)]">
                                          <span
                                            className="w-1.5 h-1.5 rounded-full shrink-0"
                                            style={{ background: getVerbDotColor(step.verb || 'Executed') }}
                                          />
                                          {step.verb || 'Executed'}
                                        </span>
                                        <code className="font-mono text-[12px] text-[var(--ui-text-primary)] truncate">
                                          {String(step.target || step.tool_name || '').replace(
                                            /^(appembly_unified|cyclode_coding|sauthen_identity|meterbox_finops|adappty_autonomic)\./i,
                                            ''
                                          )}
                                        </code>
                                        {(() => {
                                          const d = String(step.detail || step.output || '').trim();
                                          if (!d || isStepExpanded || d.startsWith('{') || d.startsWith('[')) return null;
                                          return (
                                            <span className="text-[var(--ui-text-muted)] truncate hidden md:inline">— {d}</span>
                                          );
                                        })()}
                                      </div>
                                      <Check className="w-3.5 h-3.5 text-[var(--ui-accent)] shrink-0" aria-label="Completed" />
                                    </button>
                                    {isStepExpanded && fullOutput && (
                                      <pre className="px-3 py-2 border-t border-[color-mix(in_srgb,var(--ui-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--ui-bg-canvas)_80%,transparent)] font-mono text-[11.5px] leading-[1.55] text-[var(--ui-text-secondary)] overflow-x-auto whitespace-pre-wrap max-h-56 overflow-y-auto">
                                        {fullOutput}
                                      </pre>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rich Assistant Markdown Response */}
                      <div className="pl-0.5">
                        {isTurnStreaming && !msg.content ? (
                          <div className="inline-flex items-center gap-2.5 text-[13.5px] text-[var(--ui-text-secondary)] py-1">
                            <span className="ap-typing" aria-hidden><i /><i /><i /></span>
                            <span>{msg.steps && msg.steps.length > 0 ? 'Writing the answer…' : 'Thinking…'}</span>
                          </div>
                        ) : (
                          <RichMarkdownContent content={msg.content} />
                        )}
                      </div>

                      {/* Interactive Stage 1/2 Scope & Defaults Decision Cards (<decision-card>) */}
                      {(() => {
                        const { decisionCards } = extractDecisionCardsFromMarkdown(msg.content);
                        if (decisionCards.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            {decisionCards.map((dc, dcIdx) => (
                              <InteractiveDecisionCard
                                key={dcIdx}
                                card={dc}
                                onSubmitDecision={(formattedPrompt) => {
                                  onSendMessage(formattedPrompt, {
                                    persona: activePersona,
                                    model: activeModel,
                                    executionMode,
                                    contextRefs: selectedContextRefs,
                                    attachments: [],
                                  });
                                }}
                              />
                            ))}
                          </div>
                        );
                      })()}

                      {/* Guided Follow-Up Action Chips (explicit followUps + parsed <quick-actions>) */}
                      {(() => {
                        const { quickActions } = extractQuickActionsFromMarkdown(msg.content);
                        const mergedFollowUps = [
                          ...(msg.followUps || []),
                          ...quickActions.filter(
                            (qa) => !(msg.followUps || []).some((f) => f.label === qa.label)
                          ),
                        ];
                        if (mergedFollowUps.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-2 pt-1.5">
                            {mergedFollowUps.map((f, fIdx) => (
                              <button
                                key={fIdx}
                                type="button"
                                onClick={() => {
                                  if (f.actionId && onFollowUpAction) {
                                    onFollowUpAction(f.actionId, f.prompt);
                                  } else if (f.prompt) {
                                    onSendMessage(f.prompt, {
                                      persona: activePersona,
                                      model: activeModel,
                                      executionMode,
                                      contextRefs: selectedContextRefs,
                                      attachments: [],
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ui-bg-surface)] hover:bg-[var(--ui-bg-subtle)] text-[var(--ui-text-primary)] border border-[var(--ui-border)] hover:border-[color-mix(in_srgb,var(--ui-accent)_60%,transparent)] transition-colors shadow-sm"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                                <span>{f.label}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Assistant Turn Footer Actions (Retry & Copy at the bottom of the response) */}
                      {!isTurnStreaming && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {precedingUserMsg && (
                            <button
                              type="button"
                              onClick={() =>
                                onSendMessage(precedingUserMsg.content, {
                                  persona: activePersona,
                                  model: activeModel,
                                  executionMode,
                                  contextRefs:
                                    precedingUserMsg.contextRefs || selectedContextRefs,
                                  attachments: precedingUserMsg.attachments || [],
                                  replaceMessageId: precedingUserMsg.id,
                                })
                              }
                              title="Regenerate this response in-place"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11.5px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-surface)] transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retry</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(msg.content);
                              setCopiedTurnId(msg.id);
                              setTimeout(() => setCopiedTurnId(null), 1500);
                            }}
                            title="Copy assistant response"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11.5px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-surface)] transition-colors"
                          >
                            {copiedTurnId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-[var(--ui-ok)]" />
                                <span className="text-[var(--ui-ok)]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* DOCKED 2-ZONE CYCLODE COMPOSER */}
            <div className="px-4 sm:px-6 pt-2 pb-4 bg-[var(--ui-bg-canvas)] shrink-0">
              <div className="max-w-3xl xl:max-w-4xl mx-auto relative rounded-2xl border border-[var(--ui-border-strong)] bg-[var(--ui-bg-surface)] shadow-[0_1px_2px_rgba(17,22,24,0.04),0_8px_24px_-12px_rgba(17,22,24,0.12)] focus-within:border-[color-mix(in_srgb,var(--ui-accent-deep)_70%,var(--ui-border-strong))] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--ui-accent)_14%,transparent)] transition-[border-color,box-shadow]">
                {openMenu && (
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setOpenMenu(null)}
                  />
                )}
                {/* Active Popovers Above Composer */}
                {openMenu === 'persona' && (
                  <div className="absolute bottom-full left-2 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] shadow-2xl p-2 z-30 ap-popover-enter">
                    <div className="px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] border-b border-[var(--ui-border)]">
                      Select Specialist Persona
                    </div>
                    <div className="mt-1 space-y-1 max-h-72 overflow-y-auto">
                      {availablePersonas.map((p) => {
                        const isSelected = p.id === activePersona.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setActivePersonaId(p.id);
                              setOpenMenu(null);
                            }}
                            className={`w-full text-left p-2 rounded-lg transition-colors flex items-start justify-between gap-2 ${
                              isSelected
                                ? 'bg-[var(--ui-bg-subtle)] text-[var(--ui-text-primary)] border border-[var(--ui-border)]'
                                : 'hover:bg-[color-mix(in_srgb,var(--ui-bg-subtle)_70%,transparent)] text-[var(--ui-text-secondary)]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: p.badgeColor || accentColor }}
                                />
                                <span className="text-[12.5px] font-semibold text-[var(--ui-text-primary)]">
                                  {p.label}
                                </span>
                              </div>
                              <div className="text-[12px] text-[var(--ui-accent)] font-mono mt-0.5">
                                {p.role}
                              </div>
                              <p className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 line-clamp-2">
                                {p.description}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[var(--ui-accent)] shrink-0 mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {openMenu === 'model' && (
                  <div className="absolute bottom-full left-2 sm:left-24 mb-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] shadow-2xl p-2 z-30 ap-popover-enter">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--ui-border)]">
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
                        AI Gateway Frontier Model
                      </span>
                      <span className="text-[12px] font-mono text-[var(--ui-ok)]">
                        Failover Ready
                      </span>
                    </div>
                    <div className="mt-1.5 max-h-[320px] overflow-y-auto pr-0.5 space-y-2">
                      {(() => {
                        const groups: Array<{
                          groupName: string;
                          providerId?: string;
                          byokReady?: boolean;
                          items: WorkbenchModelOption[];
                        }> = [];
                        for (const m of models) {
                          const gName = m.group || m.provider.split('·')[0].trim() || 'Frontier Models';
                          let existing = groups.find((g) => g.groupName === gName);
                          if (!existing) {
                            existing = {
                              groupName: gName,
                              providerId: m.providerId,
                              byokReady:
                                m.byokReady !== undefined
                                  ? m.byokReady
                                  : m.provider.toLowerCase().includes('byok'),
                              items: [],
                            };
                            groups.push(existing);
                          }
                          existing.items.push(m);
                        }
                        return groups.map((g, gIdx) => (
                          <div
                            key={g.groupName}
                            className={gIdx > 0 ? 'pt-1.5 border-t border-[var(--ui-border)]' : ''}
                          >
                            <div className="flex items-center justify-between px-2 py-1">
                              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ui-text-muted)]">
                                {g.groupName}
                              </span>
                              {g.providerId === 'auto' ? (
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[color-mix(in_srgb,var(--ui-ok)_14%,transparent)] text-[var(--ui-ok)]">
                                  Gateway
                                </span>
                              ) : g.byokReady ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onOpenByokModal) {
                                      setOpenMenu(null);
                                      onOpenByokModal(g.providerId);
                                    }
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[color-mix(in_srgb,var(--ui-ok)_14%,transparent)] text-[var(--ui-ok)] hover:opacity-85 transition-opacity cursor-pointer"
                                >
                                  BYOK Active
                                </button>
                              ) : onOpenByokModal && g.providerId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenu(null);
                                    onOpenByokModal(g.providerId);
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[11px] font-mono text-[var(--ui-accent)] border border-[color-mix(in_srgb,var(--ui-accent)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] transition-colors cursor-pointer"
                                >
                                  + Add Key
                                </button>
                              ) : null}
                            </div>
                            <div className="space-y-0.5">
                              {g.items.map((m) => {
                                const isSelected = m.id === activeModel.id;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      setActiveModelId(m.id);
                                      setOpenMenu(null);
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                                      isSelected
                                        ? 'bg-[color-mix(in_srgb,var(--ui-accent)_12%,var(--ui-bg-subtle))] text-[var(--ui-text-primary)] border border-[color-mix(in_srgb,var(--ui-accent)_35%,var(--ui-border))]'
                                        : 'hover:bg-[var(--ui-bg-subtle)] text-[var(--ui-text-secondary)] border border-transparent'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[12.5px] font-semibold font-mono text-[var(--ui-text-primary)] truncate">
                                        {m.label}
                                      </div>
                                      <div className="text-[12px] text-[var(--ui-text-secondary)] truncate">
                                        {m.tier}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums whitespace-nowrap bg-[var(--ui-bg-subtle)] text-[var(--ui-text-muted)] border border-[var(--ui-border)]">
                                        {m.latency}
                                      </span>
                                      {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-[var(--ui-accent)] shrink-0" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    {onOpenByokModal && (
                      <div className="mt-1.5 pt-1.5 border-t border-[var(--ui-border)]">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            onOpenByokModal();
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--ui-accent)] hover:bg-[var(--ui-bg-subtle)] transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Configure BYOK Provider Keys in Vault</span>
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {openMenu === 'context' && (
                  <div className="absolute bottom-full left-4 sm:left-52 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] shadow-2xl p-2 z-30 ap-popover-enter">
                    <div className="px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] border-b border-[var(--ui-border)]">
                      Attach Workspace Context (@)
                    </div>
                    <div className="mt-1 space-y-1 max-h-64 overflow-y-auto">
                      {contextOptions.map((ctx) => {
                        const active = selectedContextRefs.includes(ctx.id);
                        return (
                          <button
                            key={ctx.id}
                            type="button"
                            onClick={() => toggleContextRef(ctx.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-start justify-between gap-2 ${
                              active
                                ? 'bg-[var(--ui-bg-subtle)] text-[var(--ui-text-primary)] border border-[var(--ui-border)]'
                                : 'hover:bg-[color-mix(in_srgb,var(--ui-bg-subtle)_70%,transparent)] text-[var(--ui-text-secondary)]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-[12px] font-mono text-[var(--ui-accent)] truncate">
                                {ctx.label}
                              </div>
                              <div className="text-[12px] text-[var(--ui-text-muted)] truncate">
                                {ctx.description}
                              </div>
                            </div>
                            {active && (
                              <Check className="w-3.5 h-3.5 text-[var(--ui-ok)] shrink-0 mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Zone 1: Context Chips + Auto-Expanding Textarea */}
                {(selectedContextRefs.length > 0 || attachments.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-2.5">
                    {selectedContextRefs.map((ref) => (
                      <span
                        key={ref}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-[var(--ui-bg-subtle)] text-[var(--ui-accent)] border border-[var(--ui-border)]"
                      >
                        <span>{ref}</span>
                        <button
                          type="button"
                          onClick={() => toggleContextRef(ref)}
                          className="hover:text-[var(--ui-text-primary)]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {attachments.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-[var(--ui-bg-subtle)] text-[var(--ui-text-primary)] border border-[var(--ui-border)]"
                      >
                        <Paperclip className="w-3 h-3 text-[var(--ui-text-muted)]" />
                        <span>{file}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="hover:text-[var(--ui-danger)]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="px-4 pt-3 pb-1">
                  <textarea
                    ref={textareaRef}
                    rows={3}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={composerPlaceholder}
                    className="w-full bg-transparent text-[14.5px] leading-[1.6] text-[var(--ui-text-primary)] placeholder:text-[var(--ui-text-muted)] resize-none focus:outline-none"
                  />
                </div>

                {/* Zone 2: Bottom Action & Selector Strip */}
                <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2.5 rounded-b-2xl">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach files, schemas, or specifications"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] border border-transparent hover:border-[var(--ui-border)] transition-colors"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Attach</span>
                    </button>

                    {/* Persona Selector Pill */}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu((m) => (m === 'persona' ? null : 'persona'))
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] border border-[var(--ui-border)] hover:border-[color-mix(in_srgb,var(--ui-accent)_60%,transparent)] transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: activePersona.badgeColor || accentColor,
                        }}
                      />
                      <span>{activePersona.label}</span>
                      <ChevronDown className="w-3 h-3 text-[var(--ui-text-muted)]" />
                    </button>

                    {/* Frontier Model Selector Pill */}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu((m) => (m === 'model' ? null : 'model'))
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-mono bg-[var(--ui-bg-surface)] text-[var(--ui-text-secondary)] border border-[var(--ui-border)] hover:text-[var(--ui-text-primary)] transition-colors"
                    >
                      <Cpu className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                      <span>{activeModel.label}</span>
                      <ChevronDown className="w-3 h-3 text-[var(--ui-text-muted)]" />
                    </button>

                    {/* @Context Selector Pill */}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu((m) => (m === 'context' ? null : 'context'))
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-mono text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] border border-transparent hover:border-[var(--ui-border)] transition-colors"
                    >
                      <AtSign className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                      <span>Context ({selectedContextRefs.length})</span>
                    </button>
                  </div>

                  {/* Right Controls: Execution Mode + Send / Stop */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExecutionMode(
                          executionMode === 'agentic' ? 'readonly' : 'agentic'
                        )
                      }
                      title="Toggle between Agentic Execution and Plan-Only mode"
                      className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                        executionMode === 'agentic'
                          ? 'bg-[color-mix(in_srgb,var(--ui-accent)_10%,var(--ui-bg-surface))] text-[var(--ui-accent-deep)] border-[color-mix(in_srgb,var(--ui-accent)_28%,transparent)]'
                          : 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] border-[var(--ui-border)]'
                      }`}
                    >
                      {executionMode === 'agentic' ? (
                        <>
                          <Zap className="w-3 h-3" />
                          <span>Agentic</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Plan Only</span>
                        </>
                      )}
                    </button>

                    {isStreaming ? (
                      <button
                        type="button"
                        onClick={onStopStreaming}
                        title="Stop generating"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--ui-text-primary)] text-[var(--ui-bg-surface)] hover:opacity-90 transition-opacity"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!composerText.trim() && attachments.length === 0}
                        style={{
                          backgroundColor:
                            composerText.trim() || attachments.length > 0
                              ? accentColor
                              : undefined,
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                          composerText.trim() || attachments.length > 0
                            ? 'text-white shadow-sm hover:opacity-95 cursor-pointer'
                            : 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] border border-[var(--ui-border)] cursor-not-allowed'
                        }`}
                      >
                        <span>Send</span>
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DRAGGABLE SPLIT HANDLE */}
        {layoutMode === 'split' && auxiliaryTabs.length > 0 && (
          <div
            onMouseDown={() => {
              isResizingRef.current = true;
            }}
            title="Drag to resize Chat and Auxiliary Workbench"
            className="w-1.5 hover:w-2 bg-[color-mix(in_srgb,var(--ui-border)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--ui-accent)_60%,transparent)] cursor-col-resize transition-colors shrink-0"
          />
        )}

        {/* RIGHT PANE: Configurable Auxiliary Workbench (Blueprint / Files & Diff / Activity / Spec JSON) */}
        {layoutMode !== 'chat' && auxiliaryTabs.length > 0 && (
          <div
            style={{
              width:
                layoutMode === 'split'
                  ? `${100 - leftPanePercent}%`
                  : '100%',
            }}
            className="flex flex-col h-full min-w-0 bg-[color-mix(in_srgb,var(--ui-bg-subtle)_40%,transparent)] border-l border-[var(--ui-border)] select-text"
          >
            {/* Workbench Tab Bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ui-border)] bg-[var(--ui-bg-subtle)] shrink-0 overflow-x-auto">
              <div className="flex items-center gap-1">
                {auxiliaryTabs.map((tab) => {
                  const active = tab.id === activeAuxTabObj?.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveAuxTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                        active
                          ? 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] border border-[var(--ui-border)] shadow-sm'
                          : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[var(--ui-bg-canvas)] text-[var(--ui-accent)]">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Auxiliary Tab Viewport */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeAuxTabObj?.render()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
