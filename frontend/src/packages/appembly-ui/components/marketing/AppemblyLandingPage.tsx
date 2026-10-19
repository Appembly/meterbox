import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  Cpu,
  GitBranch,
  Layers,
  Moon,
  Play,
  Radio,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Terminal,
  Workflow,
} from 'lucide-react';
import { useAppemblyTheme } from '../../context/ThemeContext';
import { AppemblyLogo } from '../brand/AppemblyLogo';
import { KpiSummaryCard } from '../metrics/KpiSummaryCard';
import { MultiSeriesChart } from '../metrics/MultiSeriesChart';
import { ProjectTaskTimeline } from '../swarm/ProjectTaskTimeline';
import type { ChartSeries, KpiMetricItem, TimelineTaskItem } from '../../types';

export interface AppemblyLandingPageProps {
  onOpenStudio?: (productId?: string) => void;
}

interface ProductSuiteItem {
  id: string;
  name: string;
  category: 'product' | 'engineering' | 'customer';
  categoryLabel: string;
  tagline: string;
  description: string;
  audience: string;
  accentColor: string;
  port: string;
  liveUrl?: string;
  repoUrl: string;
  status: string;
  highlights: string[];
  metricLabel: string;
  metricValue: string;
  icon: React.ReactNode;
}

const PRODUCT_SUITE: ProductSuiteItem[] = [
  {
    id: 'cyclode',
    name: 'Cyclode',
    category: 'engineering',
    categoryLabel: 'Autonomous Engineering',
    tagline: 'Your autonomous software engineering workstation.',
    description:
      'Turns architectural specs and repositories into verified pull requests, isolated preview sandboxes, and self-healing CI pipelines.',
    audience: 'Developers & Engineering Teams',
    accentColor: '#4E8067',
    port: ':6013',
    liveUrl: 'http://localhost:6013',
    repoUrl: 'https://github.com/Appembly/cyclode',
    status: 'Live Workstation',
    highlights: [
      'Full-repository context & multi-file refactoring',
      'Isolated Docker preview sandboxes & live browser verification',
      'Powered by Runctor cyclode_coding capability pack',
    ],
    metricLabel: 'Autonomous PR Pass Rate',
    metricValue: '96.4%',
    icon: <Terminal className="w-5 h-5" />,
  },
  {
    id: 'valiscale',
    name: 'Valiscale',
    category: 'product',
    categoryLabel: 'Product & Venture Studio',
    tagline: 'From raw concept to validated project and scaled launch.',
    description:
      'Evaluates market viability, generates structured PRDs, orchestrates Swarmteam task timelines, and tracks post-launch growth trajectories.',
    audience: 'Founders, PMs & Venture Studios',
    accentColor: '#3B82F6',
    port: ':6030',
    repoUrl: 'https://github.com/Appembly/valiscale',
    status: 'Interactive Studio',
    highlights: [
      'Structured Concept → Project → Scale lifecycle pipeline',
      'Interactive Gantt & topological DAG wave timelines',
      'Multi-series readiness & validation scorecards',
    ],
    metricLabel: 'Concept Validation Score',
    metricValue: '91 / 100',
    icon: <Rocket className="w-5 h-5" />,
  },
  {
    id: 'wotneed',
    name: 'Wotneed',
    category: 'customer',
    categoryLabel: 'Conversational Commerce',
    tagline: 'Consultative AI commerce concierge & demand intelligence.',
    description:
      'Guides shoppers from high-level intent to the exact right product bundle while capturing unmet buyer demand directly from live conversations.',
    audience: 'Brands, Merchants & Shoppers',
    accentColor: '#F59E0B',
    port: ':6050',
    repoUrl: 'https://github.com/Appembly/wotneed',
    status: 'Commerce Engine',
    highlights: [
      'Diagnostic buyer needs discovery & real-time SKU comparison',
      'Automated cart bundle assembly with margin guardrails',
      'Zero-hallucination catalog grounding via Runctor gates',
    ],
    metricLabel: 'Assisted Checkout Lift',
    metricValue: '+34.8%',
    icon: <ShoppingBag className="w-5 h-5" />,
  },
  {
    id: 'gatharoom',
    name: 'Gatharoom',
    category: 'customer',
    categoryLabel: 'Live Market Research',
    tagline: 'Livestreamed AI-moderated customer focus groups.',
    description:
      'Hosts structured live customer research rooms with adaptive probing, instant sentiment heatmaps, and willingness-to-pay synthesis.',
    audience: 'Researchers, Marketers & Product Leads',
    accentColor: '#8B5CF6',
    port: ':6060',
    repoUrl: 'https://github.com/Appembly/gatharoom',
    status: 'Research Rooms',
    highlights: [
      'AI-facilitated focus groups & live participant micro-polls',
      'Timestamped objection, praise & willingness-to-pay clustering',
      'Direct insight handoff into Valiscale product concepts',
    ],
    metricLabel: 'Synthesis Confidence',
    metricValue: '98.2%',
    icon: <Radio className="w-5 h-5" />,
  },
  {
    id: 'swarmteam',
    name: 'Swarmteam',
    category: 'engineering',
    categoryLabel: 'Multi-Agent Execution',
    tagline: 'Parallel multi-agent DAG scheduler & git-worktree pods.',
    description:
      'Decomposes complex roadmaps into dependency-safe execution waves where specialized architect, builder, and QA agents work in parallel.',
    audience: 'Platform & AI Engineering Teams',
    accentColor: '#06B6D4',
    port: ':6040',
    repoUrl: 'https://github.com/Appembly/swarmteam',
    status: 'DAG Orchestrator',
    highlights: [
      'Topological DAG wave scheduling & critical-path analysis',
      'Isolated git-worktree execution per autonomous agent pod',
      'Automated contract & regression gate verification before merge',
    ],
    metricLabel: 'Parallel Wave Speedup',
    metricValue: '3.8×',
    icon: <Workflow className="w-5 h-5" />,
  },
  {
    id: 'meterbox',
    name: 'Meterbox',
    category: 'engineering',
    categoryLabel: 'AI FinOps & Usage Metering',
    tagline: 'Sub-5ms edge entitlements, CloudEvents metering & hybrid AI billing.',
    description:
      'Ingests real-time LLM token & compute CloudEvents with Redis SETNX deduplication, ClickHouse OLAP rollups, priority credit grant waterfalls, and automated Stripe invoicing.',
    audience: 'AI Platform, FinOps & SaaS Teams',
    accentColor: '#10B981',
    port: ':6070',
    liveUrl: 'http://localhost:6070',
    repoUrl: 'https://github.com/Appembly/meterbox',
    status: 'FinOps Control Plane',
    highlights: [
      'Exact-once CloudEvents v1.0 ingestion & 1-click DLQ replay',
      'Sub-5ms pre-flight quota gates & priority credit burndown',
      'ClickHouse columnar rollups & graduated hybrid Stripe billing',
    ],
    metricLabel: 'Edge Quota Latency',
    metricValue: '0.28ms',
    icon: <Compass className="w-5 h-5" />,
  },
];

const FOUNDATION_PILLARS = [
  {
    id: 'sauthen',
    name: 'Sauthen',
    subtitle: 'One Account Everywhere',
    port: ':6020',
    repoUrl: 'https://github.com/Appembly/sauthen',
    description:
      'Sign in once across every Appembly application. Unified OAuth2/OIDC identity, multi-organization workspaces, and cryptographically scoped token delegation for both humans and autonomous agents.',
    badge: 'Identity & Trust',
    icon: <ShieldCheck className="w-5 h-5 text-[#72B091]" />,
  },
  {
    id: 'runctor',
    name: 'Runctor',
    subtitle: 'One Shared Intelligence',
    port: 'v0.2.0',
    repoUrl: 'https://github.com/Appembly/runctor',
    description:
      'Our universal agentic runtime dynamically injects domain tools, curated skills, personas, and deterministic evaluation gates so context flows seamlessly across every Appembly product.',
    badge: 'Agentic Runtime',
    icon: <Cpu className="w-5 h-5 text-[#72B091]" />,
  },
  {
    id: 'ui',
    name: 'Appembly UI',
    subtitle: 'One Calm Design Language',
    port: ':6005',
    repoUrl: 'https://github.com/Appembly/ui',
    description:
      'Every Appembly product shares the same tactile geometry, collapsible single-rail navigation, high-contrast typography, and zero-clutter ergonomics in Graphite, Off-White, and Sage Green.',
    badge: 'Design System',
    icon: <Layers className="w-5 h-5 text-[#72B091]" />,
  },
];

const PREVIEW_METRICS: KpiMetricItem[] = [
  {
    id: 'concepts',
    label: 'Validated Concepts',
    scopeLabel: 'Viability Score across 5 active ventures',
    value: '91.4 / 100',
    accentColor: 'sage',
    delta: '+6.8%',
    deltaTrend: 'up',
  },
  {
    id: 'velocity',
    label: 'Swarmteam Wave Velocity',
    scopeLabel: '4 parallel agent pods · 100% gate pass',
    value: '18 Tasks/d',
    accentColor: 'emerald',
    delta: '+34%',
    deltaTrend: 'up',
  },
  {
    id: 'demand',
    label: 'Wotneed Buyer Conversion',
    scopeLabel: 'Consultative concierge checkouts',
    value: '34.8%',
    accentColor: 'amber',
    delta: '+11.2%',
    deltaTrend: 'up',
  },
  {
    id: 'research',
    label: 'Gatharoom Synthesis',
    scopeLabel: 'Captured across 12 live customer rooms',
    value: '420 Signals',
    accentColor: 'indigo',
    delta: '+19.4%',
    deltaTrend: 'up',
  },
];

const PREVIEW_TIMELINE_TASKS: TimelineTaskItem[] = [
  {
    id: 'TASK-101',
    title: 'Gatharoom Focus Group Synthesis & WTP Clustering',
    wave: 1,
    persona: 'gatharoom_moderator',
    status: 'completed',
    progress: 100,
    startHour: 0,
    durationHours: 3,
    dependsOn: [],
    evalGateStatus: 'passed',
  },
  {
    id: 'TASK-102',
    title: 'Valiscale PRD & Architecture Blueprint Generation',
    wave: 1,
    persona: 'valiscale_concept',
    status: 'completed',
    progress: 100,
    startHour: 3,
    durationHours: 3,
    dependsOn: ['TASK-101'],
    evalGateStatus: 'passed',
  },
  {
    id: 'TASK-201',
    title: 'Cyclode Autonomous Backend & Sauthen RBAC Wiring',
    wave: 2,
    persona: 'cyclode_coding',
    status: 'running',
    progress: 78,
    startHour: 6,
    durationHours: 5,
    dependsOn: ['TASK-102'],
    evalGateStatus: 'passed',
    worktreeBranch: 'swarm/wave2-backend',
  },
  {
    id: 'TASK-202',
    title: 'Wotneed Conversational Concierge & SKU Graph',
    wave: 2,
    persona: 'wotneed_ecommerce',
    status: 'running',
    progress: 65,
    startHour: 6,
    durationHours: 6,
    dependsOn: ['TASK-102'],
    evalGateStatus: 'pending',
    worktreeBranch: 'swarm/wave2-commerce',
  },
  {
    id: 'TASK-301',
    title: 'Production Canary Rollout & Eval Gate Verification',
    wave: 3,
    persona: 'swarmteam_orchestrator',
    status: 'queued',
    progress: 0,
    startHour: 12,
    durationHours: 4,
    dependsOn: ['TASK-201', 'TASK-202'],
    evalGateStatus: 'pending',
  },
];

const PREVIEW_CHART_LABELS = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6'];

const PREVIEW_CHART_SERIES: ChartSeries[] = [
  { id: 'valiscale', label: 'Valiscale Readiness Index', color: '#4E8067', values: [12, 16, 20, 24, 27, 29] },
  { id: 'cyclode', label: 'Cyclode Autonomous PR Velocity', color: '#3B82F6', values: [9, 14, 18, 22, 25, 28] },
  { id: 'wotneed', label: 'Wotneed Concierge Conversion', color: '#F59E0B', dashed: true, values: [8, 11, 15, 19, 23, 26] },
];

export const AppemblyLandingPage: React.FC<AppemblyLandingPageProps> = ({ onOpenStudio }) => {
  const { theme, toggleTheme } = useAppemblyTheme();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'product' | 'engineering' | 'customer'>('all');
  const [showConstructionGrid, setShowConstructionGrid] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TimelineTaskItem | null>(PREVIEW_TIMELINE_TASKS[2]);

  const filteredProducts =
    selectedCategory === 'all'
      ? PRODUCT_SUITE
      : PRODUCT_SUITE.filter((item) => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[var(--ui-bg-canvas)] text-[var(--ui-text-primary)] transition-colors duration-200 selection:bg-[#4E8067] selection:text-[#F6F7F5]">
      {/* Sticky Floating Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--ui-bg-canvas)]/85 border-b border-[var(--ui-border)]">
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 h-20 flex items-center justify-between gap-6">
          {/* Left Brand Lockup */}
          <div className="flex items-center gap-4 shrink-0">
            <a href="#top" className="flex items-center gap-3">
              <AppemblyLogo variant="lockup" size={34} productName="Appembly" />
            </a>
            <span className="hidden xl:inline-block h-4 w-px bg-[var(--ui-border-strong)]" />
            <span className="hidden xl:inline-block text-[13px] font-medium text-[#4E8067] whitespace-nowrap">
              Connected software. Greater possibilities.
            </span>
          </div>

          {/* Center Single-Line Navigation Pill */}
          <nav className="hidden lg:flex items-center gap-1 px-2 py-1.5 rounded-full bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] shadow-2xs">
            {[
              { href: '#products', label: 'Products' },
              { href: '#interactive-studio', label: 'Interactive Studio' },
              { href: '#connected-suite', label: 'Connected Foundation' },
              { href: '#geometry', label: 'Geometry & Brand' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-4 py-1.5 rounded-full text-[13px] font-medium text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-subtle)]/70 transition-colors whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] hover:bg-[var(--ui-bg-hover)] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="Toggle Graphite / Off-White Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {onOpenStudio && (
              <button
                type="button"
                onClick={() => onOpenStudio('valiscale')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold border border-[var(--ui-border-strong)] bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] hover:border-[#4E8067] hover:text-[#4E8067] transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              >
                <Compass className="w-4 h-4 text-[#4E8067]" />
                <span>Valiscale Studio</span>
              </button>
            )}

            <a
              href="http://localhost:6013"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-[#111618] dark:bg-[#4E8067] text-[#F6F7F5] hover:opacity-90 transition-opacity whitespace-nowrap shadow-xs"
            >
              <span>Launch Cyclode</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* 1. Architectural Hero Section */}
      <section id="top" className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32">
        {/* Subtle Ambient Geometric Background Glow */}
        <div
          className="pointer-events-none absolute -top-40 right-1/4 w-[640px] h-[640px] rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(78,128,103,0.45) 0%, rgba(78,128,103,0) 70%)',
          }}
        />

        <div className="max-w-[1320px] mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-12 items-center">
            {/* Left Column: Company Narrative & Value Proposition */}
            <div className="lg:col-span-6 space-y-8">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#4E8067]/10 border border-[#4E8067]/25 text-[#4E8067] text-[12px] font-semibold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Appembly · Assembling Apps &amp; Agents</span>
              </div>

              <div className="space-y-5">
                <h1 className="text-4xl sm:text-5xl lg:text-[60px] font-bold tracking-[-0.03em] leading-[1.05] text-[var(--ui-text-primary)]">
                  Connected software.{' '}
                  <span className="text-[#4E8067] block sm:inline">Greater possibilities.</span>
                </h1>

                <p className="text-[17px] sm:text-[18px] text-[var(--ui-text-secondary)] leading-[1.65] max-w-xl font-normal">
                  Appembly is a software company building modular applications and autonomous
                  agents — crafted to work powerfully on their own, and effortlessly together across
                  product discovery, software engineering, customer research, and commerce.
                </p>
              </div>

              {/* Primary Hero CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <a
                  href="#products"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-[14px] font-semibold bg-[#4E8067] text-[#F6F7F5] hover:bg-[#3F6B55] transition-all shadow-sm"
                >
                  <span>Explore the Product Suite</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                {onOpenStudio && (
                  <button
                    type="button"
                    onClick={() => onOpenStudio('valiscale')}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-[14px] font-semibold bg-[var(--ui-bg-surface)] border border-[var(--ui-border-strong)] text-[var(--ui-text-primary)] hover:border-[#4E8067] transition-all cursor-pointer shadow-2xs"
                  >
                    <Play className="w-4 h-4 text-[#4E8067] fill-[#4E8067]" />
                    <span>Interactive Studio Demo</span>
                  </button>
                )}
              </div>

              {/* Brand Domain Pills Strip */}
              <div className="pt-4 border-t border-[var(--ui-border)] flex flex-wrap items-center gap-2.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mr-2">
                  Ecosystem Domains
                </span>
                {['Web', 'Mobile', 'Products', 'Docs', 'Infra'].map((pill) => (
                  <span
                    key={pill}
                    className="px-3.5 py-1 rounded-lg text-[12.5px] font-medium bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] text-[var(--ui-text-secondary)]"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Right Column: Spacious Architectural Suite Board */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl bg-[#111618] text-[#F6F7F5] p-7 sm:p-9 border border-[#263136] shadow-2xl space-y-7 relative overflow-hidden">
                {/* Subtle Top Right Geometric Watermark */}
                <div className="flex items-start justify-between gap-4 border-b border-[#222C30] pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-13 h-13 rounded-2xl bg-[#4E8067] flex items-center justify-center shadow-md shrink-0">
                      <AppemblyLogo variant="mark" size={30} strokeColor="#F6F7F5" />
                    </div>
                    <div>
                      <div className="text-[17px] font-semibold tracking-tight text-[#F6F7F5]">
                        Appembly Connected Suite
                      </div>
                      <div className="text-[13px] text-[#A9AFAB] mt-0.5">
                        5 Standalone Applications · 1 Shared Foundation
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#4E8067]/20 text-[#72B091] border border-[#4E8067]/35 shrink-0">
                    Active Suite
                  </span>
                </div>

                {/* Spacious 2-Column Product Matrix + Full-Width Featured Workstation */}
                <div className="space-y-3">
                  {PRODUCT_SUITE.map((prod) => (
                    <div
                      key={prod.id}
                      className="group rounded-2xl bg-[#171E21] hover:bg-[#1D262A] border border-[#263136] p-4 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className="w-1.5 h-9 rounded-full shrink-0"
                          style={{ backgroundColor: prod.accentColor }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[14px] font-semibold text-[#F6F7F5]">
                              {prod.name}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#111618] text-[#A9AFAB] border border-[#263136]">
                              {prod.port}
                            </span>
                          </div>
                          <p className="text-[12.5px] text-[#A9AFAB] mt-0.5 line-clamp-1">
                            {prod.tagline}
                          </p>
                        </div>
                      </div>

                      <span className="hidden sm:inline-flex shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#111618] text-[#C5CAC7] border border-[#263136]">
                        {prod.categoryLabel}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bottom Shared Foundation Bar */}
                <div className="pt-4 border-t border-[#222C30] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#A9AFAB]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#4E8067]" />
                    <span>Shared Core: Sauthen SSO · Runctor v0.2 · @appembly/ui</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#72B091]">appembly.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. The Appembly Product Suite ("Powerful Alone. Effortless Together.") */}
      <section
        id="products"
        className="py-24 lg:py-28 bg-[var(--ui-bg-subtle)]/45 border-y border-[var(--ui-border)]"
      >
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 space-y-12">
          {/* Section Header + Filter Tabs */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-widest text-[#4E8067]">
                The Appembly Product Suite
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[var(--ui-text-primary)]">
                Powerful alone. Effortless together.
              </h2>
              <p className="text-[15.5px] text-[var(--ui-text-secondary)] leading-relaxed">
                Start with any single Appembly application to solve an immediate workflow, or
                connect the full suite so customer research, product validation, engineering, and
                commerce share context automatically.
              </p>
            </div>

            {/* Clean Segmented Filter Pills */}
            <div className="inline-flex flex-wrap p-1.5 rounded-2xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] shadow-2xs self-start">
              {[
                { id: 'all', label: 'All Products (5)' },
                { id: 'product', label: 'Product & Venture' },
                { id: 'engineering', label: 'Engineering' },
                { id: 'customer', label: 'Commerce & Research' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id as typeof selectedCategory)}
                  className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === tab.id
                      ? 'bg-[#4E8067] text-[#F6F7F5] shadow-xs'
                      : 'text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spacious Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group rounded-3xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] hover:border-[#4E8067]/50 p-7 sm:p-8 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-lg"
              >
                <div className="space-y-6">
                  {/* Card Top Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0"
                        style={{ backgroundColor: product.accentColor }}
                      >
                        {product.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[19px] font-bold tracking-tight text-[var(--ui-text-primary)]">
                            {product.name}
                          </h3>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--ui-bg-subtle)] text-[var(--ui-text-secondary)]">
                            {product.port}
                          </span>
                        </div>
                        <div className="text-[12.5px] font-medium text-[var(--ui-text-muted)] mt-0.5">
                          {product.audience}
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#4E8067]/12 text-[#4E8067] whitespace-nowrap shrink-0">
                      {product.status}
                    </span>
                  </div>

                  {/* Tagline & Description */}
                  <div className="space-y-2">
                    <div className="text-[15px] font-semibold text-[var(--ui-text-primary)] leading-snug">
                      {product.tagline}
                    </div>
                    <p className="text-[13.5px] text-[var(--ui-text-secondary)] leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* Capability Checkmarks */}
                  <ul className="space-y-2.5 pt-4 border-t border-[var(--ui-border)]">
                    {product.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-[13px] text-[var(--ui-text-secondary)] leading-snug"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#4E8067] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Bottom Metric + Action Bar */}
                <div className="pt-6 mt-7 border-t border-[var(--ui-border)] flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-medium text-[var(--ui-text-muted)]">
                      {product.metricLabel}
                    </div>
                    <div className="text-[16px] font-bold text-[var(--ui-text-primary)] tabular-nums">
                      {product.metricValue}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={product.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl text-[12.5px] font-medium text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-subtle)] transition-colors"
                    >
                      GitHub
                    </a>

                    {product.id === 'cyclode' ? (
                      <a
                        href="http://localhost:6013"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-semibold bg-[#4E8067] text-[#F6F7F5] hover:bg-[#3F6B55] transition-colors shadow-2xs"
                      >
                        <span>Open App</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    ) : onOpenStudio ? (
                      <button
                        type="button"
                        onClick={() => onOpenStudio(product.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-semibold bg-[var(--ui-bg-subtle)] hover:bg-[#4E8067] text-[var(--ui-text-primary)] hover:text-[#F6F7F5] transition-colors cursor-pointer"
                      >
                        <span>Live Preview</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Live Connected Workspace Previewer */}
      <section id="interactive-studio" className="py-24 lg:py-28">
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 space-y-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-widest text-[#4E8067]">
                Interactive Product Preview
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[var(--ui-text-primary)]">
                See how Appembly apps &amp; agents assemble a launch.
              </h2>
              <p className="text-[15.5px] text-[var(--ui-text-secondary)] leading-relaxed">
                Explore a live interactive workspace powered by{' '}
                <code className="px-2 py-0.5 rounded-md bg-[var(--ui-bg-subtle)] text-[13px] font-mono text-[#4E8067]">
                  @appembly/ui
                </code>{' '}
                — showing how a <strong>Gatharoom</strong> focus group insight flows into a{' '}
                <strong>Valiscale</strong> project timeline and dispatches parallel{' '}
                <strong>Cyclode</strong> &amp; <strong>Wotneed</strong> agent waves.
              </p>
            </div>

            {onOpenStudio && (
              <button
                type="button"
                onClick={() => onOpenStudio('valiscale')}
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-[13.5px] font-semibold bg-[#4E8067] text-[#F6F7F5] hover:bg-[#3F6B55] transition-colors cursor-pointer shrink-0 self-start lg:self-auto shadow-xs"
              >
                <Compass className="w-4 h-4" />
                <span>Open Fullscreen Valiscale Studio</span>
              </button>
            )}
          </div>

          {/* KPI Summary Strip */}
          <KpiSummaryCard
            title="Connected Suite Performance Summary"
            subtitle="Live telemetry across Valiscale, Swarmteam, Wotneed, and Gatharoom"
            metrics={PREVIEW_METRICS}
          />

          {/* Interactive Timeline + Multi-Series Trajectory Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <ProjectTaskTimeline
                projectName="Autonomous Commerce Launch"
                tasks={PREVIEW_TIMELINE_TASKS}
                totalHorizonHours={16}
                onSelectTask={(task) => setSelectedTask(task)}
              />
            </div>

            <div className="lg:col-span-5 space-y-6">
              <MultiSeriesChart
                title="Cross-Suite Velocity & Readiness"
                subtitle="Real-time telemetry across Valiscale, Cyclode, and Wotneed"
                labels={PREVIEW_CHART_LABELS}
                series={PREVIEW_CHART_SERIES}
              />

              {selectedTask && (
                <div className="rounded-2xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] p-5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-mono font-semibold text-[#4E8067]">
                      {selectedTask.id} · Wave {selectedTask.wave}
                    </span>
                    <span className="text-[11.5px] font-medium px-2.5 py-0.5 rounded-full bg-[#4E8067]/12 text-[#4E8067]">
                      Runctor Pack: {selectedTask.persona}
                    </span>
                  </div>
                  <div className="text-[15px] font-semibold text-[var(--ui-text-primary)]">
                    {selectedTask.title}
                  </div>
                  <div className="text-[12.5px] text-[var(--ui-text-muted)] flex items-center justify-between pt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-[#4E8067]" />
                      <span>{selectedTask.worktreeBranch || 'main'}</span>
                    </span>
                    <span>
                      Eval Gate: <strong className="text-[#4E8067]">{selectedTask.evalGateStatus || 'passed'}</strong> · {selectedTask.progress}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. What Makes Appembly "Connected Software" (Shared Foundation) */}
      <section id="connected-suite" className="py-24 lg:py-28 bg-[#111618] text-[#F6F7F5]">
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 space-y-14">
          <div className="max-w-3xl space-y-4">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-[#72B091]">
              The Appembly Advantage
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[#F6F7F5]">
              Why connected software beats disconnected tools.
            </h2>
            <p className="text-[16px] text-[#A9AFAB] leading-relaxed">
              Most software suites are stitched together after the fact. Every Appembly application
              is built from day one on three shared architectural layers — so identity, agentic
              intelligence, and user experience never fragment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FOUNDATION_PILLARS.map((pillar) => (
              <div
                key={pillar.id}
                className="rounded-3xl bg-[#171E21] border border-[#263136] p-8 flex flex-col justify-between space-y-8 hover:border-[#4E8067]/60 transition-colors"
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#4E8067]/20 text-[#72B091] border border-[#4E8067]/30">
                      {pillar.badge}
                    </span>
                    <span className="text-[12px] font-mono text-[#A9AFAB]">{pillar.port}</span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#111618] border border-[#263136] flex items-center justify-center shrink-0">
                      {pillar.icon}
                    </div>
                    <div>
                      <h3 className="text-[20px] font-bold text-[#F6F7F5]">{pillar.name}</h3>
                      <div className="text-[13px] font-medium text-[#72B091]">
                        {pillar.subtitle}
                      </div>
                    </div>
                  </div>

                  <p className="text-[14px] text-[#A9AFAB] leading-relaxed">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-5 border-t border-[#263136] flex items-center justify-between">
                  <a
                    href={pillar.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-semibold text-[#F6F7F5] hover:text-[#72B091] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Explore {pillar.name}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <span className="text-[11px] font-mono text-[#A9AFAB]">Appembly Core</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Built on Simple Geometry (Brand System & 4 Pillars) */}
      <section id="geometry" className="py-24 lg:py-28 border-b border-[var(--ui-border)]">
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
            {/* Left: Built on Simple Geometry + 4 Pillars */}
            <div className="lg:col-span-5 space-y-7">
              <div className="space-y-3">
                <div className="text-[12px] font-semibold uppercase tracking-widest text-[#4E8067]">
                  Design Philosophy &amp; Identity
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[var(--ui-text-primary)]">
                  Built on simple geometry.
                </h2>
                <p className="text-[15.5px] text-[var(--ui-text-secondary)] leading-relaxed">
                  The Appembly mark is constructed from two interlocking equilateral triangles
                  meeting at a shared horizontal bridge — representing modular applications and
                  autonomous agents assembling into a unified whole.
                </p>
              </div>

              {/* 4 Pillars from Brand Sheet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {[
                  {
                    title: 'Connected',
                    desc: 'Shared identity, context, and telemetry across every product.',
                  },
                  {
                    title: 'Modular',
                    desc: 'Adopt any application standalone or compose the full ecosystem.',
                  },
                  {
                    title: 'Scalable',
                    desc: 'From first concept validation to multi-agent production workloads.',
                  },
                  {
                    title: 'Timeless',
                    desc: 'Calm geometry and high-contrast clarity built to endure.',
                  },
                ].map((pillar) => (
                  <div
                    key={pillar.title}
                    className="p-5 rounded-2xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] space-y-1.5 shadow-2xs"
                  >
                    <div className="text-[15px] font-bold text-[var(--ui-text-primary)] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#4E8067]" />
                      <span>{pillar.title}</span>
                    </div>
                    <p className="text-[13px] text-[var(--ui-text-secondary)] leading-relaxed">
                      {pillar.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Interactive Geometric Construction Grid & Color Palette */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] p-7 sm:p-9 space-y-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[16px] font-bold text-[var(--ui-text-primary)]">
                      Monogram Construction &amp; Brand Surfaces
                    </div>
                    <div className="text-[13px] text-[var(--ui-text-muted)]">
                      Equilateral 60° triangular grid &amp; official color system
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConstructionGrid((prev) => !prev)}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold border border-[var(--ui-border)] bg-[var(--ui-bg-subtle)] hover:border-[#4E8067] text-[var(--ui-text-primary)] transition-colors cursor-pointer"
                  >
                    {showConstructionGrid ? 'Hide Construction Grid' : 'Show Construction Grid'}
                  </button>
                </div>

                {/* Construction Grid Canvas + Surface Lockups */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Construction SVG */}
                  <div className="rounded-2xl bg-[#F6F7F5] text-[#111618] border border-[#E2E5E2] p-7 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-40 h-40">
                      {showConstructionGrid && (
                        <g stroke="#4E8067" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6">
                          <line x1="50" y1="8" x2="50" y2="92" />
                          <line x1="8" y1="51.1" x2="92" y2="51.1" />
                          <line x1="15" y1="27.7" x2="85" y2="27.7" />
                          <line x1="15" y1="74.5" x2="85" y2="74.5" />
                          <circle cx="50" cy="51.1" r="34" fill="none" />
                        </g>
                      )}
                      <g
                        fill="none"
                        stroke="#111618"
                        strokeWidth="6.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="23,74.5 50,27.7 63.5,51.1" />
                        <polyline points="77,27.7 50,74.5 36.5,51.1" />
                        <line x1="36.5" y1="51.1" x2="63.5" y2="51.1" />
                      </g>
                    </svg>
                    <span className="text-[11.5px] font-mono text-[#525956] mt-3">
                      60° Interlocking Construction
                    </span>
                  </div>

                  {/* Official Dark & Sage Lockup Cards */}
                  <div className="space-y-5 flex flex-col justify-between">
                    <div className="flex-1 rounded-2xl bg-[#111618] text-[#F6F7F5] p-6 flex items-center justify-between border border-[#263136]">
                      <AppemblyLogo
                        variant="lockup"
                        size={32}
                        productName="Appembly"
                        strokeColor="#F6F7F5"
                      />
                      <span className="text-[11px] font-mono text-[#A9AFAB]">#111618</span>
                    </div>

                    <div className="flex-1 rounded-2xl bg-[#4E8067] text-[#F6F7F5] p-6 flex items-center justify-between">
                      <AppemblyLogo
                        variant="lockup"
                        size={32}
                        productName="Appembly"
                        strokeColor="#F6F7F5"
                      />
                      <span className="text-[11px] font-mono text-[#F6F7F5]/85">#4E8067</span>
                    </div>
                  </div>
                </div>

                {/* Official 4-Color Swatch Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                  {[
                    { name: 'Graphite', hex: '#111618', text: '#F6F7F5' },
                    { name: 'Off White', hex: '#F6F7F5', text: '#111618', border: true },
                    { name: 'Sage Green', hex: '#4E8067', text: '#F6F7F5' },
                    { name: 'Silver', hex: '#A9AFAB', text: '#111618' },
                  ].map((swatch) => (
                    <div
                      key={swatch.name}
                      className={`rounded-2xl p-4 flex flex-col justify-between h-24 ${
                        swatch.border ? 'border border-[#E2E5E2]' : ''
                      }`}
                      style={{ backgroundColor: swatch.hex, color: swatch.text }}
                    >
                      <span className="text-[13px] font-bold">{swatch.name}</span>
                      <span className="text-[11.5px] font-mono opacity-85">{swatch.hex}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Company Footer */}
      <footer className="py-14 bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] text-[13px]">
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <AppemblyLogo variant="lockup" size={28} productName="Appembly" />
            <span className="text-[var(--ui-border-strong)]">|</span>
            <span>Connected software. Greater possibilities.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-medium">
            <a href="https://github.com/Appembly/web" target="_blank" rel="noreferrer" className="hover:text-[var(--ui-text-primary)] transition-colors">
              Web (:6001)
            </a>
            <a href="https://github.com/Appembly/ui" target="_blank" rel="noreferrer" className="hover:text-[var(--ui-text-primary)] transition-colors">
              UI (:6005)
            </a>
            <a href="https://github.com/Appembly/cyclode" target="_blank" rel="noreferrer" className="hover:text-[var(--ui-text-primary)] transition-colors">
              Cyclode (:6013)
            </a>
            <a href="https://github.com/Appembly/valiscale" target="_blank" rel="noreferrer" className="hover:text-[var(--ui-text-primary)] transition-colors">
              Valiscale (:6030)
            </a>
            <a href="https://github.com/Appembly/swarmteam" target="_blank" rel="noreferrer" className="hover:text-[var(--ui-text-primary)] transition-colors">
              Swarmteam (:6040)
            </a>
            <a href="https://github.com/Appembly/wotneed" target="_blank" rel="noreferrer" className="hover:text-[var(--ui-text-primary)] transition-colors">
              Wotneed (:6050)
            </a>
            <a href="https://github.com/Appembly/gatharoom" target="_blank" rel="noreferrer" className="hover:text-[var(--ui-text-primary)] transition-colors">
              Gatharoom (:6060)
            </a>
            <a href="https://github.com/Appembly/meterbox" target="_blank" rel="noreferrer" className="hover:text-[var(--ui-text-primary)] transition-colors">
              Meterbox (:6070)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
