import React from 'react';

export type AppemblyThemeMode = 'light' | 'dark';

export interface NavSubItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  statusColor?: 'sage' | 'emerald' | 'amber' | 'rose' | 'silver';
  meta?: string;
}

export interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  defaultOpen?: boolean;
  children?: NavSubItem[];
}

export interface BreadcrumbOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbSegment {
  id: string;
  label: string;
  icon?: React.ReactNode;
  options?: BreadcrumbOption[];
  onSelectOption?: (id: string) => void;
}

export interface SegmentedTabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export interface KpiMetricItem {
  id: string;
  label: string;
  scopeLabel?: string;
  value: string;
  delta?: string;
  deltaTrend?: 'up' | 'down' | 'neutral';
  accentColor?: 'sage' | 'orange' | 'emerald' | 'indigo' | 'amber';
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  values: number[];
}

export interface TimelineTaskItem {
  id: string;
  title: string;
  wave: number;
  persona: string;
  model?: string;
  status: 'completed' | 'running' | 'queued' | 'review';
  progress: number;
  startHour: number;
  durationHours: number;
  dependsOn?: string[];
  worktreeBranch?: string;
  evalGateStatus?: 'passed' | 'pending' | 'failed';
}

export interface CostToolBreakdownItem {
  tool_name: string;
  calls: number;
  tokens: number;
  errors?: number;
  duration_ms?: number;
}

export interface CostTelemetryBreakdown {
  model_id: string;
  model_display_name: string;
  provider?: string;
  tier?: 'minor' | 'major' | 'frontier' | string;
  pricing_per_1m?: {
    input: number;
    cached_input: number;
    output: number;
    reasoning: number;
  };
  tokens: {
    total: number;
    prompt: number;
    cached: number;
    reasoning: number;
    completion: number;
  };
  cost_usd: {
    total: number;
    input: number;
    cached: number;
    reasoning: number;
    output: number;
    baseline_frontier?: number;
    saved?: number;
    savings_pct?: number;
  };
  efficiency: {
    score: number;
    cache_hit_ratio_pct: number;
    tool_calls_total: number;
    tool_success_rate_pct: number;
    avg_tokens_per_tool: number;
    loc_changed?: number;
    tokens_per_loc?: number | null;
    total_tool_duration_ms?: number;
  };
  tool_token_breakdown?: CostToolBreakdownItem[];
}

export type EmblyChatMode = 'canvas' | 'drawer' | 'popover';

export type EmblyIntentCategory = 'execution' | 'qa_research' | 'planning';

export interface EmblyContextChip {
  id: string;
  label: string;
  kind: string;
  value: string;
  icon?: React.ReactNode;
  removable?: boolean;
}

export interface EmblyStarterPrompt {
  id: string;
  label: string;
  prompt: string;
  persona?: string;
  icon?: React.ReactNode;
}

export interface EmblyToolStep {
  turn: number;
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'running' | 'completed' | 'error' | 'awaiting_approval';
  error?: string;
  durationMs?: number;
  requiresSauthenStepup?: boolean;
}

export interface EmblyEvalGateCheck {
  gateName: string;
  passed: boolean;
  score: number;
  diagnostics: string;
}

export interface EmblyEvalReport {
  packName: string;
  status: 'accomplished' | 'needs_revision';
  score: number;
  checks: EmblyEvalGateCheck[];
}

export interface EmblyMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  persona?: string;
  thinking?: string;
  toolSteps?: EmblyToolStep[];
  evalReport?: EmblyEvalReport;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens?: number;
    estimatedCostUsd?: number;
  };
  createdAt: string;
}

export interface EmblyToolRendererProps<
  TArgs = Record<string, unknown>,
  TResult = unknown,
> {
  step: EmblyToolStep & { arguments: TArgs; result?: TResult };
  brandAccent: string;
  onApprove?: (callId: string, payload?: Record<string, unknown>) => Promise<void>;
  onReject?: (callId: string, reason?: string) => Promise<void>;
  onSendFollowUp?: (prompt: string) => void;
}

export interface EmblyChatProps {
  mode?: EmblyChatMode;
  endpointUrl?: string;
  packName:
    | 'cyclode_coding'
    | 'computer_use_qa'
    | 'adappty_autonomic'
    | 'sauthen_identity'
    | 'meterbox_finops'
    | 'valiscale_concept'
    | 'swarmteam_orchestrator'
    | (string & {});
  secondaryPacks?: string[];
  persona?: string;
  allowPersonaSwitch?: boolean;
  pinnedSkills?: string[];
  intentCategory?: EmblyIntentCategory;
  title?: string;
  subtitle?: string;
  brandAccent?: string;
  brandIcon?: React.ReactNode;
  placeholder?: string;
  isOpen?: boolean;
  onClose?: () => void;
  width?: number | string;
  sessionContext?: Record<string, unknown>;
  contextChips?: EmblyContextChip[];
  onRemoveContextChip?: (chipId: string) => void;
  starterPrompts?: EmblyStarterPrompt[];
  messages?: EmblyMessage[];
  initialMessages?: EmblyMessage[];
  onMessagesChange?: (messages: EmblyMessage[]) => void;
  getAuthToken?: () => Promise<string | null> | string | null;
  toolRenderers?: Record<string, React.ComponentType<EmblyToolRendererProps<any, any>>>;
  onStepUpRequired?: (
    step: EmblyToolStep
  ) => Promise<{ approved: boolean; stepUpToken?: string }>;
  showEvalGateBadge?: boolean;
  showCostTelemetry?: boolean;
  enableVoiceInput?: boolean;
  enableAttachments?: boolean;
  headerActionsSlot?: React.ReactNode;
  composerLeadingSlot?: React.ReactNode;
}


