import React, { useState } from 'react';
import {
  Activity,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  Radio,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  AppemblyAppShell,
  AppemblyLogo,
  CommandItem,
  CommandPalette,
  CostIntelligenceCard,
  KpiSummaryCard,
  MultiSeriesChart,
  NavItem,
  NavSection,
  ProjectTaskTimeline,
  SegmentedTabs,
  TimelineTaskItem,
  useToast,
} from '../index';
import { PrimitivesShowcaseSection } from './PrimitivesShowcase';

const PROJECTS_MAP: Record<
  string,
  {
    name: string;
    subtitle: string;
    kpis: {
      id: string;
      label: string;
      scopeLabel: string;
      value: string;
      delta: string;
      deltaTrend: 'up' | 'down';
      accentColor: 'sage' | 'orange' | 'emerald' | 'indigo';
    }[];
  }
> = {
  'proj-finops': {
    name: 'AI FinOps Copilot',
    subtitle: 'Promoted from Concept #14 · Connected to Swarmteam & Cyclode',
    kpis: [
      {
        id: 'viability',
        label: 'Concept Viability Score',
        scopeLabel: 'Validated via Gatharoom',
        value: '88/100',
        delta: '12.4%',
        deltaTrend: 'up',
        accentColor: 'sage',
      },
      {
        id: 'tasks',
        label: 'Timeline Tasks Merged',
        scopeLabel: 'Wave 1 & Wave 2',
        value: '14 / 18',
        delta: '24%',
        deltaTrend: 'up',
        accentColor: 'emerald',
      },
      {
        id: 'pods',
        label: 'Active Swarmteam Pods',
        scopeLabel: 'Parallel Git Worktrees',
        value: '4 Pods',
        delta: '100%',
        deltaTrend: 'up',
        accentColor: 'indigo',
      },
      {
        id: 'burn',
        label: 'Cycle Time per Task',
        scopeLabel: 'Runctor v0.2.0',
        value: '18.4m',
        delta: '4.5%',
        deltaTrend: 'down',
        accentColor: 'orange',
      },
    ],
  },
  'proj-wotneed': {
    name: 'Wotneed Commerce Concierge',
    subtitle: 'AI Conversational Shopping & Catalog Grounding on Runctor',
    kpis: [
      {
        id: 'viability',
        label: 'Merchant Demand Signal',
        scopeLabel: 'Gatharoom Focus Group',
        value: '92/100',
        delta: '18.2%',
        deltaTrend: 'up',
        accentColor: 'sage',
      },
      {
        id: 'tasks',
        label: 'Timeline Tasks Merged',
        scopeLabel: 'Wave 1 – Wave 3',
        value: '21 / 24',
        delta: '31%',
        deltaTrend: 'up',
        accentColor: 'emerald',
      },
      {
        id: 'pods',
        label: 'Catalog Grounding Accuracy',
        scopeLabel: 'Runctor Eval Gate',
        value: '99.8%',
        delta: '2.1%',
        deltaTrend: 'up',
        accentColor: 'indigo',
      },
      {
        id: 'burn',
        label: 'Unmet Demand Signals',
        scopeLabel: 'Last 7 Days',
        value: '1,36K',
        delta: '14.5%',
        deltaTrend: 'up',
        accentColor: 'orange',
      },
    ],
  },
  'proj-sauthen': {
    name: 'Sauthen OAuth & Agent Broker',
    subtitle: 'Unified OIDC / SSO & Scoped Runctor Agent Token Broker',
    kpis: [
      {
        id: 'viability',
        label: 'Security Gate Score',
        scopeLabel: 'Zero-Trust Audit',
        value: '96/100',
        delta: '8.0%',
        deltaTrend: 'up',
        accentColor: 'sage',
      },
      {
        id: 'tasks',
        label: 'Timeline Tasks Merged',
        scopeLabel: 'Wave 1 & Wave 2',
        value: '11 / 12',
        delta: '19%',
        deltaTrend: 'up',
        accentColor: 'emerald',
      },
      {
        id: 'pods',
        label: 'Scoped Agent Tokens',
        scopeLabel: 'Active Worktrees',
        value: '1,24K',
        delta: '1.2%',
        deltaTrend: 'up',
        accentColor: 'indigo',
      },
      {
        id: 'burn',
        label: 'P99 Token Broker Latency',
        scopeLabel: 'Edge Verification',
        value: '4.2ms',
        delta: '6.1%',
        deltaTrend: 'down',
        accentColor: 'orange',
      },
    ],
  },
};

const SAMPLE_TIMELINE_TASKS: TimelineTaskItem[] = [
  {
    id: 'TASK-101',
    title: 'Validate Concept Scorecard & Market TAM/SAM',
    wave: 1,
    persona: 'ConceptExplorer',
    status: 'completed',
    progress: 100,
    startHour: 0,
    durationHours: 3.5,
    worktreeBranch: 'swarm/finops/task-101',
    evalGateStatus: 'passed',
  },
  {
    id: 'TASK-102',
    title: 'Gatharoom Focus Group Poll & WTP Synthesis',
    wave: 1,
    persona: 'FocusGroupModerator',
    status: 'completed',
    progress: 100,
    startHour: 1,
    durationHours: 4.0,
    worktreeBranch: 'swarm/finops/task-102',
    evalGateStatus: 'passed',
  },
  {
    id: 'TASK-201',
    title: 'PostgreSQL Cost Anomaly Schema & Ingestion API',
    wave: 2,
    persona: 'SoftwareEngineer',
    status: 'running',
    progress: 78,
    startHour: 4.5,
    durationHours: 5.5,
    dependsOn: ['TASK-101'],
    worktreeBranch: 'swarm/finops/task-201',
    evalGateStatus: 'passed',
  },
  {
    id: 'TASK-202',
    title: 'Interactive Valiscale Project Timeline & Swarm UI',
    wave: 2,
    persona: 'AppBuilder',
    status: 'running',
    progress: 85,
    startHour: 4.5,
    durationHours: 6.0,
    dependsOn: ['TASK-101', 'TASK-102'],
    worktreeBranch: 'swarm/finops/task-202',
    evalGateStatus: 'passed',
  },
  {
    id: 'TASK-301',
    title: 'Worktree Integration, E2E Eval Gate & Scale Rollout',
    wave: 3,
    persona: 'WorktreeIntegrator',
    status: 'queued',
    progress: 15,
    startHour: 10.5,
    durationHours: 4.5,
    dependsOn: ['TASK-201', 'TASK-202'],
    worktreeBranch: 'swarm/finops/task-301',
    evalGateStatus: 'pending',
  },
];

export const ValiscalePreview: React.FC<{ initialTabId?: string }> = ({
  initialTabId = 'overview',
}) => {
  const [activeNavId, setActiveNavId] = useState<string>('proj-finops');
  const [activeTabId, setActiveTabId] = useState<string>(initialTabId);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCmdkOpen, setIsCmdkOpen] = useState<boolean>(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setActiveTabId(initialTabId);
  }, [initialTabId]);

  const activeProject =
    PROJECTS_MAP[activeNavId] || PROJECTS_MAP['proj-finops'];

  const topItems: NavItem[] = [
    {
      id: 'exec-overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'approvals-queue',
      label: 'Approvals',
      icon: ShieldCheck,
      badge: 2,
    },
  ];

  const navSections: NavSection[] = [
    {
      id: 'active-projects',
      label: 'Active Projects',
      icon: FolderKanban,
      items: [
        {
          id: 'proj-finops',
          label: 'AI FinOps Copilot',
          icon: FolderKanban,
          badge: 4,
        },
        {
          id: 'proj-wotneed',
          label: 'Wotneed Concierge',
          icon: ShoppingBag,
          badge: 3,
        },
        {
          id: 'proj-sauthen',
          label: 'Sauthen SSO Broker',
          icon: ShieldCheck,
        },
      ],
    },
    {
      id: 'concept-lab',
      label: 'Concept Lab',
      icon: Lightbulb,
      items: [
        { id: 'concept-1', label: 'Cloud Cost Optimizer', icon: Lightbulb },
        { id: 'concept-2', label: 'Autonomous QA Replay', icon: Activity },
      ],
    },
    {
      id: 'swarm-orchestration',
      label: 'Operate & Swarm',
      icon: GitBranch,
      items: [
        { id: 'pod-1', label: 'Swarmteam Pods', icon: GitBranch, badge: 4 },
        { id: 'room-1', label: 'Gatharoom Live', icon: Radio },
        { id: 'scale-prod', label: 'Production Fleet', icon: Rocket },
        { id: 'brand-system', label: 'Primitives & Brand', icon: Sparkles },
      ],
    },
  ];

  const commandItems: CommandItem[] = [
    {
      id: 'cmd-primitives',
      label: 'Open Primitives & Motion Showcase',
      group: 'Navigation',
      shortcut: '⌘P',
      onSelect: () => setActiveTabId('primitives'),
    },
    {
      id: 'cmd-overview',
      label: 'Go to Project Overview',
      group: 'Navigation',
      onSelect: () => setActiveTabId('overview'),
    },
    {
      id: 'cmd-finops',
      label: 'Switch Project: AI FinOps Copilot',
      group: 'Projects',
      onSelect: () => setActiveNavId('proj-finops'),
    },
    {
      id: 'cmd-sauthen',
      label: 'Switch Project: Sauthen OAuth & Agent Broker',
      group: 'Projects',
      onSelect: () => setActiveNavId('proj-sauthen'),
    },
  ];

  return (
    <>
      <AppemblyAppShell
        sidebarProps={{
          brandTitle: 'Valiscale',
          brandSubtitle: 'Appembly · Idea-to-Scale',
          topItems,
          sections: navSections,
          activeItemId: activeNavId,
          onSelectItem: (id) => {
            setActiveNavId(id);
            if (id === 'brand-system') setActiveTabId('primitives');
          },
          isCollapsed: isSidebarCollapsed,
          onToggleCollapse: () => setIsSidebarCollapsed((prev) => !prev),
          onOpenSettings: () =>
            toast({
              title: 'Workspace Settings',
              description: 'Opened Valiscale organization & policy settings.',
            }),
        }}
        breadcrumbProps={{
          segments: [
            {
              id: 'org',
              label: 'Appembly Core',
              options: [
                { id: 'appembly-core', label: 'Appembly Core' },
                { id: 'appembly-labs', label: 'Appembly Labs' },
              ],
            },
            {
              id: 'env',
              label: 'Production',
              options: [
                { id: 'prod', label: 'Production' },
                { id: 'staging', label: 'Staging' },
              ],
            },
            {
              id: 'project',
              label: activeProject.name,
              icon: <AppemblyLogo variant="app-icon" size={18} />,
              options: [
                { id: 'proj-finops', label: 'AI FinOps Copilot' },
                { id: 'proj-wotneed', label: 'Wotneed Commerce Concierge' },
                { id: 'proj-sauthen', label: 'Sauthen OAuth & Agent Broker' },
              ],
              onSelectOption: (id) => setActiveNavId(id),
            },
          ],
          onOpenCommandPalette: () => setIsCmdkOpen(true),
          envStatus: {
            label: 'Swarm Wave 2 Active',
            tone: 'ok',
            live: true,
          },
          avatar: {
            name: 'Ken M',
            menuItems: [
              { id: 'profile', label: 'Operator Profile', shortcut: '⌘U' },
              { id: 'tokens', label: 'Sauthen STS Leases' },
              { id: 'signout', label: 'Sign Out', tone: 'danger' },
            ],
          },
        }}
        pageTitle={activeTabId === 'primitives' ? 'Calm UI Primitives & Tokens' : activeProject.name}
        pageSubtitle={
          activeTabId === 'primitives'
            ? 'Shared @appembly/ui design system foundations, overlays, and motion primitives.'
            : activeProject.subtitle
        }
        tabsToolbar={
          <SegmentedTabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'primitives', label: 'Primitives & Motion', badge: 'New' },
              { id: 'timeline', label: 'Task Timeline & Swarm', badge: 5 },
              { id: 'brand', label: 'Appembly Brand Kit' },
            ]}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            dateRangeLabel="Oct 10, 2026 – Oct 18, 2026"
            filterLabel="Filter"
          />
        }
      >
      {/* Top KPI Summary Card (matches "Performance Summary" in reference design) */}
      {activeTabId !== 'primitives' && (
        <KpiSummaryCard
          title="Performance &amp; Validation Summary"
          subtitle="Real-time concept viability, Swarmteam task velocity, and Runctor evaluation gate metrics."
          metrics={activeProject.kpis}
        />
      )}

      {/* Tab-Specific Primary Content + Always-Accessible Timeline & Trajectory Chart */}
      {activeTabId === 'primitives' ? (
        <PrimitivesShowcaseSection />
      ) : activeTabId === 'brand' ? (
        <section className="rounded-2xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] p-6 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ui-text-primary)]">
                Appembly Official Brand Identity &amp; Palette (`@appembly/ui`)
              </h2>
              <p className="text-[13px] text-[var(--ui-text-muted)]">
                Connected software. Greater possibilities. · Built on simple geometry (Connected · Modular · Scalable · Timeless)
              </p>
            </div>
            <AppemblyLogo
              variant="lockup"
              size={38}
              productName="Appembly"
              tagline="Connected software. Greater possibilities."
            />
          </div>

          {/* Official Brand Swatches */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Graphite', hex: '#111618', fg: '#F6F7F5', desc: 'Primary Ink & Dark Base' },
              { name: 'Off White', hex: '#F6F7F5', fg: '#111618', desc: 'Light Canvas Background' },
              { name: 'Sage Green', hex: '#4E8067', fg: '#F6F7F5', desc: 'Primary Brand Accent' },
              { name: 'Silver', hex: '#A9AFAB', fg: '#111618', desc: 'Muted UI & Borders' },
            ].map((swatch) => (
              <div
                key={swatch.name}
                className="rounded-xl border border-[var(--ui-border)] p-4 flex flex-col justify-between gap-4"
                style={{ backgroundColor: swatch.hex, color: swatch.fg }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                    {swatch.name}
                  </span>
                  <span className="font-mono text-xs">{swatch.hex}</span>
                </div>
                <div className="text-xs opacity-90">{swatch.desc}</div>
              </div>
            ))}
          </div>

          {/* Official Brand Sheet Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            <div className="rounded-xl border border-[var(--ui-border)] p-5 flex flex-col items-center justify-center bg-[#F6F7F5]">
              <img
                src="/appembly-icon.jpg"
                alt="Appembly Rounded Square App Icon"
                className="w-36 h-36 object-contain rounded-3xl shadow-sm"
              />
              <span className="text-xs font-medium text-[#111618] mt-3">
                Official App Icon (`/appembly-icon.jpg`)
              </span>
            </div>
            <div className="lg:col-span-2 rounded-xl border border-[var(--ui-border)] overflow-hidden bg-[#F6F7F5]">
              <img
                src="/appembly-brand-sheet.png"
                alt="Appembly Brand Identity Sheet"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Interactive Project Task Timeline + Swarmteam Wave Schedule */}
          <ProjectTaskTimeline
            projectName={activeProject.name}
            tasks={SAMPLE_TIMELINE_TASKS}
          />

          {/* Multi-Series Trajectory Chart (matches "Audience Growth" card with floating hover popover) */}
          <MultiSeriesChart
            title="Swarm Velocity &amp; Validation Signal Growth"
            subtitle="See how your project tasks, test gates, and Gatharoom validation signals progressed across execution waves."
            labels={[
              'Oct 10, 2026',
              'Oct 11, 2026',
              'Oct 12, 2026',
              'Oct 13, 2026',
              'Oct 14, 2026',
              'Oct 15, 2026',
              'Oct 16, 2026',
              'Oct 17, 2026',
              'Oct 18, 2026',
            ]}
            series={[
              {
                id: 'merged-tasks',
                label: 'Merged Swarm Tasks',
                color: '#4E8067',
                dashed: false,
                values: [5, 10, 8, 17, 17, 11, 14, 22, 26],
              },
              {
                id: 'validation-signals',
                label: 'Gatharoom Demand Signals',
                color: '#8B5CF6',
                dashed: true,
                values: [15, 15, 11, 9, 14, 18, 16, 20, 24],
              },
              {
                id: 'open-blockers',
                label: 'Pending Eval Gates',
                color: '#64748B',
                dashed: true,
                values: [4, 4, 6, 6, 3, 2, 3, 1, 1],
              },
            ]}
          />

          {/* Reusable Appembly Cost Intelligence & Model Efficiency Card */}
          <CostIntelligenceCard
            title="Swarmteam & Runctor Cost Intelligence"
            subtitle="Cross-pod token consumption anatomy, prefix cache reuse, and adaptive routing savings."
            telemetry={{
              model_id: 'gemini-3.7-flash',
              model_display_name: 'Gemini 3.7 Flash + DeepSeek V4.1 Adaptive',
              provider: 'google',
              tier: 'minor',
              pricing_per_1m: {
                input: 0.15,
                cached_input: 0.0375,
                output: 0.6,
                reasoning: 0.6,
              },
              tokens: {
                total: 142800,
                prompt: 38400,
                cached: 74200,
                reasoning: 12600,
                completion: 17600,
              },
              cost_usd: {
                total: 0.0267,
                input: 0.0058,
                cached: 0.0028,
                reasoning: 0.0076,
                output: 0.0105,
                baseline_frontier: 0.7902,
                saved: 0.7635,
                savings_pct: 96.6,
              },
              efficiency: {
                score: 94.8,
                cache_hit_ratio_pct: 65.9,
                tool_calls_total: 38,
                tool_success_rate_pct: 97.4,
                avg_tokens_per_tool: 2150,
                loc_changed: 840,
                tokens_per_loc: 170.0,
              },
              tool_token_breakdown: [
                { tool_name: 'valiscale_score_concept', calls: 6, tokens: 18400 },
                { tool_name: 'swarmteam_plan_dag', calls: 8, tokens: 24200 },
                { tool_name: 'cyclode_edit_file', calls: 15, tokens: 29100 },
                { tool_name: 'gatharoom_synthesize_room', calls: 9, tokens: 14900 },
              ],
            }}
            checkpointInfo={{
              step_index: 38,
              last_event: 'tool_end',
              last_tool: 'cyclode_edit_file',
            }}
          />
        </>
      )}
      </AppemblyAppShell>
      <CommandPalette
        open={isCmdkOpen}
        onClose={() => setIsCmdkOpen(false)}
        items={commandItems}
      />
    </>
  );
};
