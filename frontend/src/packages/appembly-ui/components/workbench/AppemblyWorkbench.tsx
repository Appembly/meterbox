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
    }
  ) => void;
  onFollowUpAction?: (actionId: string, prompt?: string) => void;
  onOpenByokModal?: () => void;
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
        <strong key={idx} className="font-semibold text-onedark-fgBright">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 text-[12px] font-mono rounded bg-onedark-darker text-onedark-accent border border-onedark-borderSubtle/80"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
      return (
        <em key={idx} className="italic text-onedark-fgBright/90">
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
          className="text-onedark-accent underline underline-offset-2 hover:opacity-80"
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
        border: 'border-onedark-accent/40',
        bg: 'bg-onedark-accent/10',
        text: 'text-onedark-accent',
        icon: Info,
      };
  }
}

/**
 * Full Cyclode-grade Markdown, Mermaid Diagram, GFM Table, and GitHub Callout Alert renderer
 */
const RichMarkdownContent: React.FC<{
  content: string;
  onCopyCode?: (code: string) => void;
}> = ({ content, onCopyCode }) => {
  const [copiedBlockIdx, setCopiedBlockIdx] = useState<number | null>(null);
  const { cleanedContent } = useMemo(() => extractQuickActionsFromMarkdown(content), [content]);

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
    <div className="space-y-2.5 text-[13.5px] leading-[1.65] text-onedark-fg">
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          if (block.lang === 'mermaid') {
            return <MermaidDiagram key={bIdx} code={block.code} />;
          }
          return (
            <div
              key={bIdx}
              className="my-2.5 rounded-lg border border-onedark-borderSubtle bg-onedark-darker overflow-hidden shadow-sm"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-onedark-surface/70 border-b border-onedark-borderSubtle text-[11px] font-mono text-onedark-muted">
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-semibold text-onedark-fg/80">
                  <FileCode2 className="w-3.5 h-3.5 text-onedark-accent" />
                  {block.lang}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(block.code, bIdx)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-onedark-fg hover:text-onedark-fgBright hover:bg-onedark-bg transition-colors"
                >
                  {copiedBlockIdx === bIdx ? (
                    <>
                      <Check className="w-3 h-3 text-onedark-green" />
                      <span className="text-onedark-green">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 text-[12.5px] font-mono leading-[1.55] text-onedark-fgBright overflow-x-auto">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        // Render prose lines (headings, tables, GitHub alerts, blockquotes, bullet/numbered lists, paragraphs)
        const elements: React.ReactNode[] = [];
        let listItems: React.ReactNode[] = [];
        let activeTable: {
          headers: string[];
          rows: string[][];
          alignments: Array<'left' | 'center' | 'right'>;
        } | null = null;

        const flushList = (keyPrefix: string) => {
          if (listItems.length > 0) {
            elements.push(
              <ul key={`${keyPrefix}-list`} className="my-1.5 space-y-1.5 pl-1">
                {listItems}
              </ul>
            );
            listItems = [];
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
              className="my-3 overflow-x-auto rounded-xl bg-onedark-darker/40 border border-onedark-borderSubtle/60 shadow-xs"
            >
              <table className="w-full border-collapse text-[13px] table-auto">
                {tbl.headers.length > 0 && (
                  <thead>
                    <tr className="bg-onedark-surface/70 text-onedark-fgBright font-medium border-b border-onedark-borderSubtle/70">
                      {tbl.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          className={`px-3.5 py-2.5 font-mono text-[11.5px] font-semibold whitespace-nowrap ${getAlignClass(
                            hIdx
                          )}`}
                        >
                          {renderInlineMarkdown(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-onedark-borderSubtle/40">
                  {tbl.rows.map((row, rIdx) => {
                    const cells = [...row];
                    while (headerCount > 0 && cells.length < headerCount) {
                      cells.push('');
                    }
                    return (
                      <tr
                        key={rIdx}
                        className="odd:bg-transparent even:bg-onedark-surface/20 hover:bg-onedark-surface/40 transition-colors"
                      >
                        {cells.map((cell, cIdx) => {
                          const isCompact = cell.trim().length <= 36 || cIdx === 0;
                          return (
                            <td
                              key={cIdx}
                              className={`px-3.5 py-2.5 text-onedark-fg text-[13px] leading-relaxed align-top ${
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
                className={`my-2.5 p-3 rounded-xl border ${style.border} ${style.bg} flex items-start gap-2.5 text-[13px] leading-relaxed`}
              >
                <AlertIcon className={`w-4 h-4 ${style.text} shrink-0 mt-0.5`} />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className={`font-bold font-mono text-[10.5px] uppercase tracking-wider ${style.text}`}>
                    {alertType}
                  </div>
                  <div className="text-onedark-fg space-y-1">
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
                className="border-l-2 border-onedark-accent/70 pl-3.5 py-1.5 my-2 bg-onedark-surface/35 rounded-r-lg text-onedark-fg text-[13px] space-y-1"
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
                className="my-4 border-0 h-px bg-onedark-borderSubtle/70"
              />
            );
            continue;
          }

          if (line.startsWith('#### ')) {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <h5 key={`${bIdx}-${lIdx}`} className="text-[13px] font-semibold text-onedark-fgBright pt-1">
                {renderInlineMarkdown(line.slice(5))}
              </h5>
            );
            continue;
          }

          if (line.startsWith('### ')) {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <h4 key={`${bIdx}-${lIdx}`} className="text-[13.5px] font-semibold text-onedark-fgBright pt-1.5">
                {renderInlineMarkdown(line.slice(4))}
              </h4>
            );
            continue;
          }

          if (line.startsWith('## ')) {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <h3 key={`${bIdx}-${lIdx}`} className="text-[15px] font-semibold text-onedark-fgBright pt-2">
                {renderInlineMarkdown(line.slice(3))}
              </h3>
            );
            continue;
          }

          if (line.startsWith('# ')) {
            flushList(`${bIdx}-${lIdx}`);
            elements.push(
              <h2 key={`${bIdx}-${lIdx}`} className="text-[16px] font-bold text-onedark-fgBright pt-2.5">
                {renderInlineMarkdown(line.slice(2))}
              </h2>
            );
            continue;
          }

          if (/^([•\-*]|\d+\.)\s+/.test(line)) {
            const clean = line.replace(/^([•\-*]|\d+\.)\s+/, '');
            listItems.push(
              <li key={`${bIdx}-${lIdx}`} className="flex items-start gap-2 text-[13.25px] leading-[1.6]">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-onedark-accent shrink-0" />
                <span className="flex-1">{renderInlineMarkdown(clean)}</span>
              </li>
            );
            continue;
          }

          flushList(`${bIdx}-${lIdx}`);
          elements.push(
            <p key={`${bIdx}-${lIdx}`} className="text-[13.5px] leading-[1.65]">
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

function getVerbBadgeClasses(verb: string): string {
  const v = verb.toLowerCase();
  if (v.includes('synth') || v.includes('create') || v.includes('assembl')) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }
  if (v.includes('edit') || v.includes('patch') || v.includes('update')) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
  if (v.includes('guard') || v.includes('policy') || v.includes('auth') || v.includes('oidc')) {
    return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
  }
  if (v.includes('run') || v.includes('ran') || v.includes('exec') || v.includes('verif')) {
    return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  }
  return 'bg-onedark-surface text-onedark-fg border-onedark-borderSubtle';
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
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

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
    if (!trimmed) return;
    onSendMessage(trimmed, {
      persona: activePersona,
      model: activeModel,
      executionMode,
      contextRefs: selectedContextRefs,
      attachments,
    });
    setComposerText('');
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
      className={`flex flex-col h-full w-full bg-onedark-bg text-onedark-fg overflow-hidden select-none ${className}`}
    >
      {/* Top Workbench Session & Mode Bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-onedark-borderSubtle bg-onedark-darker/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBackToOverview && !showOverviewLanding && (
            <button
              type="button"
              onClick={onBackToOverview}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-onedark-fg hover:text-onedark-fgBright bg-onedark-surface/70 hover:bg-onedark-surface border border-onedark-borderSubtle transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-onedark-fgBright truncate">
              {sessionTitle}
            </span>
            <span className="text-onedark-muted text-xs">·</span>
            <span className="text-[11.5px] text-onedark-muted truncate hidden sm:inline">
              {sessionStatus}
            </span>
          </div>
        </div>

        {/* Right: 3-Mode Layout Switcher (Chat | Split | Workbench) + Auxiliary Tab Quick Switcher (only in Chat mode) */}
        <div className="flex items-center gap-2 shrink-0">
          {layoutMode === 'chat' && auxiliaryTabs.length > 0 && (
            <div className="hidden md:flex items-center gap-1 p-0.5 rounded-lg bg-onedark-darker border border-onedark-borderSubtle">
              {auxiliaryTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveAuxTab(tab.id);
                    setLayoutMode('split');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium text-onedark-muted hover:text-onedark-fg transition-colors"
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-onedark-bg text-onedark-accent">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center p-0.5 rounded-lg bg-onedark-darker border border-onedark-borderSubtle">
            <button
              type="button"
              onClick={() => setLayoutMode('chat')}
              title="Full Chat Canvas"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                layoutMode === 'chat'
                  ? 'bg-onedark-surface text-onedark-fgBright shadow-sm'
                  : 'text-onedark-muted hover:text-onedark-fg'
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
                  ? 'bg-onedark-surface text-onedark-fgBright shadow-sm'
                  : 'text-onedark-muted hover:text-onedark-fg'
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
                  ? 'bg-onedark-surface text-onedark-fgBright shadow-sm'
                  : 'text-onedark-muted hover:text-onedark-fg'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span>Workbench</span>
            </button>
          </div>
        </div>
      </div>

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
            className="flex flex-col h-full min-w-0 bg-onedark-bg select-text"
          >
            {/* Scrollable Conversation or Overview Viewport */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 chat-scroll-viewport">
              {showOverviewLanding && renderOverviewLanding ? (
                renderOverviewLanding({
                  prefillComposer,
                  focusComposer: () => textareaRef.current?.focus(),
                })
              ) : null}

              {/* Conversation Turns */}
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div
                        key={msg.id}
                        className="group flex flex-col items-end space-y-1.5 animate-stream-fade-in"
                      >
                        <div className="flex items-center gap-2 text-[11px] text-onedark-muted">
                          <span>You</span>
                          <span>·</span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-onedark-surface border border-onedark-borderSubtle text-[13.5px] leading-[1.6] text-onedark-fgBright shadow-sm">
                          {msg.contextRefs && msg.contextRefs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {msg.contextRefs.map((ref) => (
                                <span
                                  key={ref}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-onedark-darker text-onedark-accent border border-onedark-borderSubtle"
                                >
                                  {ref}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                        {/* Hover User Turn Action Bar */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => prefillComposer(msg.content, msg.personaId)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-onedark-muted hover:text-onedark-fg hover:bg-onedark-surface"
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
                                contextRefs: selectedContextRefs,
                                attachments: [],
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-onedark-muted hover:text-onedark-fg hover:bg-onedark-surface"
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
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-onedark-muted hover:text-onedark-fg hover:bg-onedark-surface"
                          >
                            {copiedTurnId === msg.id ? (
                              <Check className="w-3 h-3 text-onedark-green" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Assistant Open-Canvas Turn (Cyclode Architecture)
                  const isTraceOpen = expandedTraces[msg.id] ?? false;
                  const isPlanOpen = expandedPlans[msg.id] ?? true;

                  return (
                    <div
                      key={msg.id}
                      className="group flex flex-col space-y-3 pb-5 border-b border-onedark-borderSubtle/60 last:border-b-0 animate-stream-fade-in"
                    >
                      {/* Turn Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-onedark-surface border border-onedark-borderSubtle flex items-center justify-center shrink-0">
                            <AppemblyLogo
                              variant="mark"
                              size={16}
                              strokeColor={accentColor}
                            />
                          </div>
                          <span className="text-[13px] font-semibold text-onedark-fgBright">
                            {msg.personaLabel || activePersona.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-onedark-surface text-onedark-fg border border-onedark-borderSubtle">
                            {msg.modelLabel || activeModel.label}
                          </span>
                          <span className="text-[11px] text-onedark-muted">
                            {msg.timestamp}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {(msg.tokens || msg.latencySec) && (
                            <span className="text-[11px] font-mono text-onedark-muted hidden sm:inline">
                              {msg.tokens ? `~${msg.tokens} tok` : ''}{' '}
                              {msg.latencySec ? `· ${msg.latencySec}` : ''}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(msg.content);
                              setCopiedTurnId(msg.id);
                              setTimeout(() => setCopiedTurnId(null), 1500);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-onedark-muted hover:text-onedark-fg hover:bg-onedark-surface transition-colors"
                          >
                            {copiedTurnId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-onedark-green" />
                                <span className="text-onedark-green">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Plan / Approach Card */}
                      {msg.plan && msg.plan.length > 0 && (
                        <div className="rounded-lg border border-onedark-borderSubtle bg-onedark-darker/60 overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPlans((p) => ({
                                ...p,
                                [msg.id]: !isPlanOpen,
                              }))
                            }
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-medium text-onedark-fg hover:bg-onedark-surface/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isPlanOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-onedark-muted" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-onedark-muted" />
                              )}
                              <Layers className="w-3.5 h-3.5 text-onedark-accent" />
                              <span>
                                Plan & Execution Approach · {msg.plan.length} stages
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-emerald-400">
                              All stages verified
                            </span>
                          </button>
                          {isPlanOpen && (
                            <div className="px-3.5 py-2 border-t border-onedark-borderSubtle/70 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {msg.plan.map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className="flex items-center gap-2 text-[12px] text-onedark-fg"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">{item.title}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Collapsible Tool Action Step Accordion (Cyclode Style) */}
                      {msg.steps && msg.steps.length > 0 && (
                        <div className="rounded-lg border border-onedark-borderSubtle bg-onedark-darker/75 overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTraces((prev) => ({
                                ...prev,
                                [msg.id]: !isTraceOpen,
                              }))
                            }
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-onedark-fg hover:bg-onedark-surface/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isTraceOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-onedark-muted shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-onedark-muted shrink-0" />
                              )}
                              <Terminal className="w-3.5 h-3.5 text-onedark-accent shrink-0" />
                              <span className="font-medium text-onedark-fgBright shrink-0">
                                {msg.steps.length} {msg.steps.length === 1 ? 'step' : 'steps'} completed
                              </span>
                              <div className="flex items-center gap-1 overflow-hidden">
                                {msg.steps.slice(0, 3).map((s: any, idx) => {
                                  const shortTarget = String(s.target || s.tool_name || '').replace(
                                    /^(appembly_unified|cyclode_coding|sauthen_identity|meterbox_finops|adappty_autonomic)\./i,
                                    ''
                                  );
                                  return (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.2 rounded text-[10.5px] font-mono bg-onedark-surface text-onedark-muted border border-onedark-borderSubtle truncate max-w-[180px]"
                                    >
                                      {s.verb || 'Executed'} {shortTarget}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <span className="text-[11px] font-mono text-onedark-muted shrink-0 ml-2">
                              {isTraceOpen ? 'Hide trace' : 'Inspect trace'}
                            </span>
                          </button>

                          {isTraceOpen && (
                            <div className="p-2.5 border-t border-onedark-borderSubtle space-y-1.5 bg-onedark-bg/50">
                              {msg.steps.map((step: any, sIdx) => (
                                <div
                                  key={step.id || sIdx}
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-onedark-darker border border-onedark-borderSubtle/70 text-[12px]"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10.5px] font-mono font-semibold border ${getVerbBadgeClasses(
                                        step.verb || 'Executed'
                                      )}`}
                                    >
                                      {step.verb || 'Executed'}
                                    </span>
                                    <code className="font-mono text-[12px] text-onedark-fgBright truncate">
                                      {step.target || step.tool_name}
                                    </code>
                                    {(step.detail || step.output) && (
                                      <span className="text-onedark-muted truncate hidden md:inline">
                                        — {step.detail || step.output}
                                      </span>
                                    )}
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                    exit 0
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rich Assistant Markdown Response */}
                      <div className="pl-0.5">
                        <RichMarkdownContent content={msg.content} />
                      </div>

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
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-onedark-surface hover:bg-onedark-darker text-onedark-fgBright border border-onedark-borderSubtle hover:border-onedark-accent/60 transition-all shadow-sm"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-onedark-accent" />
                                <span>{f.label}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* FLOATING 2-ZONE CYCLODE COMPOSER */}
            <div className="px-4 sm:px-6 pb-4 pt-1 bg-gradient-to-t from-onedark-bg via-onedark-bg to-transparent shrink-0">
              <div className="max-w-3xl mx-auto relative rounded-xl border border-onedark-border bg-onedark-surface shadow-lg focus-within:border-onedark-accent/80 transition-colors">
                {/* Active Popovers Above Composer */}
                {openMenu === 'persona' && (
                  <div className="absolute bottom-full left-2 mb-2 w-80 rounded-xl border border-onedark-border bg-onedark-darker shadow-2xl p-2 z-30 animate-popover-enter">
                    <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-onedark-muted border-b border-onedark-borderSubtle">
                      Select Specialist Persona
                    </div>
                    <div className="mt-1 space-y-1 max-h-64 overflow-y-auto">
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
                                ? 'bg-onedark-surface text-onedark-fgBright border border-onedark-borderSubtle'
                                : 'hover:bg-onedark-surface/60 text-onedark-fg'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: p.badgeColor || accentColor }}
                                />
                                <span className="text-[12.5px] font-semibold text-onedark-fgBright">
                                  {p.label}
                                </span>
                              </div>
                              <div className="text-[11px] text-onedark-accent font-mono mt-0.5">
                                {p.role}
                              </div>
                              <p className="text-[11px] text-onedark-muted mt-0.5 line-clamp-2">
                                {p.description}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-onedark-accent shrink-0 mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {openMenu === 'model' && (
                  <div className="absolute bottom-full left-28 mb-2 w-80 rounded-xl border border-onedark-border bg-onedark-darker shadow-2xl p-2 z-30 animate-popover-enter">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-onedark-borderSubtle">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-onedark-muted">
                        AI Gateway Frontier Model
                      </span>
                      <span className="text-[10.5px] font-mono text-emerald-400">
                        Failover Ready
                      </span>
                    </div>
                    <div className="mt-1 space-y-1">
                      {models.map((m) => {
                        const isSelected = m.id === activeModel.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setActiveModelId(m.id);
                              setOpenMenu(null);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-onedark-surface text-onedark-fgBright border border-onedark-borderSubtle'
                                : 'hover:bg-onedark-surface/60 text-onedark-fg'
                            }`}
                          >
                            <div>
                              <div className="text-[12.5px] font-semibold text-onedark-fgBright">
                                {m.label}
                              </div>
                              <div className="text-[11px] text-onedark-muted">
                                {m.provider} · {m.latency}
                              </div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-onedark-bg text-onedark-accent border border-onedark-borderSubtle">
                              {m.tier}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {onOpenByokModal && (
                      <div className="mt-1.5 pt-1.5 border-t border-onedark-borderSubtle">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            onOpenByokModal();
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-onedark-accent hover:bg-onedark-surface transition-colors"
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
                  <div className="absolute bottom-full left-56 mb-2 w-80 rounded-xl border border-onedark-border bg-onedark-darker shadow-2xl p-2 z-30 animate-popover-enter">
                    <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-onedark-muted border-b border-onedark-borderSubtle">
                      Attach Workspace Context (@)
                    </div>
                    <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                      {contextOptions.map((ctx) => {
                        const active = selectedContextRefs.includes(ctx.id);
                        return (
                          <button
                            key={ctx.id}
                            type="button"
                            onClick={() => toggleContextRef(ctx.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-start justify-between gap-2 ${
                              active
                                ? 'bg-onedark-surface text-onedark-fgBright border border-onedark-borderSubtle'
                                : 'hover:bg-onedark-surface/60 text-onedark-fg'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-[12px] font-mono text-onedark-accent truncate">
                                {ctx.label}
                              </div>
                              <div className="text-[11px] text-onedark-muted truncate">
                                {ctx.description}
                              </div>
                            </div>
                            {active && (
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-1" />
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-onedark-darker text-onedark-accent border border-onedark-borderSubtle"
                      >
                        <span>{ref}</span>
                        <button
                          type="button"
                          onClick={() => toggleContextRef(ref)}
                          className="hover:text-onedark-fgBright"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {attachments.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-onedark-darker text-onedark-fgBright border border-onedark-borderSubtle"
                      >
                        <Paperclip className="w-3 h-3 text-onedark-muted" />
                        <span>{file}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="hover:text-onedark-red"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="px-3.5 pt-2.5 pb-1.5">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={composerPlaceholder}
                    className="w-full bg-transparent text-[13.5px] leading-[1.55] text-onedark-fgBright placeholder:text-onedark-muted resize-none focus:outline-none"
                  />
                </div>

                {/* Zone 2: Bottom Action & Selector Strip */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-onedark-borderSubtle/80 bg-onedark-darker/50 rounded-b-xl">
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
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium text-onedark-muted hover:text-onedark-fgBright hover:bg-onedark-surface border border-transparent hover:border-onedark-borderSubtle transition-colors"
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-onedark-surface text-onedark-fgBright border border-onedark-borderSubtle hover:border-onedark-accent/60 transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: activePersona.badgeColor || accentColor,
                        }}
                      />
                      <span>{activePersona.label}</span>
                      <ChevronDown className="w-3 h-3 text-onedark-muted" />
                    </button>

                    {/* Frontier Model Selector Pill */}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu((m) => (m === 'model' ? null : 'model'))
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-mono bg-onedark-surface text-onedark-fg border border-onedark-borderSubtle hover:text-onedark-fgBright transition-colors"
                    >
                      <Cpu className="w-3.5 h-3.5 text-onedark-accent" />
                      <span>{activeModel.label}</span>
                      <ChevronDown className="w-3 h-3 text-onedark-muted" />
                    </button>

                    {/* @Context Selector Pill */}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu((m) => (m === 'context' ? null : 'context'))
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-mono text-onedark-muted hover:text-onedark-fgBright hover:bg-onedark-surface border border-transparent hover:border-onedark-borderSubtle transition-colors"
                    >
                      <AtSign className="w-3.5 h-3.5 text-onedark-accent" />
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
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                          : 'bg-onedark-surface text-onedark-muted border-onedark-borderSubtle'
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!composerText.trim()}
                        style={{
                          backgroundColor: composerText.trim()
                            ? accentColor
                            : undefined,
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                          composerText.trim()
                            ? 'text-white shadow-sm hover:opacity-95 cursor-pointer'
                            : 'bg-onedark-surface text-onedark-muted border border-onedark-borderSubtle cursor-not-allowed'
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
            className="w-1.5 hover:w-2 bg-onedark-borderSubtle/60 hover:bg-onedark-accent/60 cursor-col-resize transition-all shrink-0"
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
            className="flex flex-col h-full min-w-0 bg-onedark-darker/40 border-l border-onedark-borderSubtle select-text"
          >
            {/* Workbench Tab Bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-onedark-borderSubtle bg-onedark-darker shrink-0 overflow-x-auto">
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
                          ? 'bg-onedark-surface text-onedark-fgBright border border-onedark-borderSubtle shadow-sm'
                          : 'text-onedark-muted hover:text-onedark-fg'
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-onedark-bg text-onedark-accent">
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
