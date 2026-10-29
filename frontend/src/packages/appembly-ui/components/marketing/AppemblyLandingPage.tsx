import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Cpu,
  Loader2,
  Lock,
  Mail,
  Menu,
  Moon,
  Radio,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Workflow,
  X,
} from 'lucide-react';
import { useAppemblyTheme } from '../../context/ThemeContext';
import {
  APPEMBLY_MONOGRAM_PATH,
  AnimatedModularMarkGraphic,
  AppemblyLogo,
  orthoLoopsToSvgPath,
} from '../brand/AppemblyLogo';
import { AdapptyIcon } from '../brand/AdapptyIcon';
import { CyclodeIcon } from '../brand/CyclodeIcon';
import { MeterboxIcon } from '../brand/MeterboxIcon';
import { SauthenIcon } from '../brand/SauthenIcon';
import { ValiscaleIcon } from '../brand/ValiscaleIcon';
import { useCountUp, useReducedMotion } from '../../motion';
import './landing.css';

export interface AppemblyLandingPageProps {
  /**
   * @deprecated The mock studio demo is no longer surfaced on the public landing page
   * (it presents unreleased products with sample data). Kept for API compatibility.
   */
  onOpenStudio?: (productId?: string) => void;
  /**
   * Endpoint that accepts a JSON `POST` for access / waitlist requests
   * (e.g. Formspree, Basin, or your own API). When omitted, the form falls back to `mailto:`.
   */
  accessRequestEndpoint?: string;
  /** Contact address shown in the footer and used for the `mailto:` fallback. */
  contactEmail?: string;
}

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_CONTACT_EMAIL = 'hello@appembly.com';
const SHOT_CYCLODE = '/showcase/cyclode-workstation.png?v=3';
const SHOT_METERBOX = '/showcase/meterbox-control-plane.png?v=3';
const SHOT_SAUTHEN = '/showcase/sauthen-trust-graph.png?v=3';
const SHOT_VALISCALE = '/showcase/valiscale-workspace.png?v=1';
const SHOT_WIDTH = 1024;
const SHOT_HEIGHT = 585;

/**
 * Single source of truth for product availability.
 * - `beta`: built and onboarding teams by invitation (request access)
 * - `soon`: in development (join the waitlist)
 * Never add public URLs or repository links here until they are actually public.
 */
type ProductStatus = 'beta' | 'soon';

interface ProductSuiteItem {
  id: string;
  name: string;
  status: ProductStatus;
  categoryLabel: string;
  tagline: string;
  description: string;
  capabilities: string[];
  accentColor: string;
  icon: React.ReactNode;
}

const PRODUCT_SUITE: ProductSuiteItem[] = [
  {
    id: 'cyclode',
    name: 'Cyclode',
    status: 'beta',
    categoryLabel: 'Autonomous Engineering',
    tagline: 'An autonomous software engineering workstation.',
    description:
      'Plan, implement and verify changes across whole repositories with an agent whose every step is visible and reviewable.',
    capabilities: [
      'Full-repository context and multi-file changes',
      'Web & Docs reader that can operate live pages',
      'Sandboxed previews, terminal and diffs side by side',
    ],
    accentColor: '#4E8067',
    icon: <CyclodeIcon className="w-[26px] h-[26px]" />,
  },
  {
    id: 'meterbox',
    name: 'Meterbox',
    status: 'beta',
    categoryLabel: 'AI FinOps & Usage Metering',
    tagline: 'Usage metering, quotas and billing for AI products.',
    description:
      'Ingest token and compute events exactly once, enforce entitlements at the edge, and turn usage into invoices.',
    capabilities: [
      'CloudEvents ingestion with idempotent deduplication',
      'Edge quota checks and prepaid credit burndown',
      'Rollups, dead-letter replay and Stripe invoicing',
    ],
    accentColor: '#4E8067',
    icon: <MeterboxIcon className="w-[24px] h-[24px]" />,
  },
  {
    id: 'sauthen',
    name: 'Sauthen',
    status: 'beta',
    categoryLabel: 'Identity & Agent Token Broker',
    tagline: 'Unified OIDC, Passkey SSO, secret vault and scoped agent tokens.',
    description:
      'Authenticate humans once across the suite, mint 15-minute RFC 8693 tokens for agents, and proxy LLM calls without exposing raw keys.',
    capabilities: [
      'Ed25519 OIDC sessions & 1:1 Meterbox namespace provisioning',
      'RFC 8693 scoped agent tokens with 15-minute TTLs',
      'Zero-knowledge LLM vault proxy & human step-up approval gates',
    ],
    accentColor: '#4E8067',
    icon: <SauthenIcon className="w-[24px] h-[24px]" />,
  },
  {
    id: 'adappty',
    name: 'Adappty',
    status: 'soon',
    categoryLabel: 'Autonomic Operations',
    tagline: 'Adaptive, self-healing and evolving production systems.',
    description:
      'Tune runtime knobs within hard bounds, execute verified remediation reflexes, and ship shadow-replayed cures.',
    capabilities: [],
    accentColor: '#4E8067',
    icon: <AdapptyIcon className="w-[22px] h-[22px]" />,
  },
  {
    id: 'valiscale',
    name: 'Valiscale',
    status: 'soon',
    categoryLabel: 'Validation, Scoping & AI Assembly',
    tagline: 'Validate, scope, and assemble governed AI apps and agents.',
    description:
      'Ground raw ideas in live market sources beside your chat, scope workflows and approval boundaries interactively, and wire AI routing, zero-trust identity, and cost controls from day one.',
    capabilities: [],
    accentColor: '#4E8067',
    icon: <ValiscaleIcon size={20} />,
  },
  {
    id: 'swarmteam',
    name: 'Swarmteam',
    status: 'soon',
    categoryLabel: 'Multi-Agent Execution',
    tagline: 'Parallel agent teams for large roadmaps.',
    description:
      'Break work into dependency-safe waves where specialised agents build and verify in parallel.',
    capabilities: [],
    accentColor: '#4E8067',
    icon: <Workflow className="w-[18px] h-[18px]" />,
  },
  {
    id: 'wotneed',
    name: 'Wotneed',
    status: 'soon',
    categoryLabel: 'Conversational Commerce',
    tagline: 'A consultative AI shopping concierge.',
    description:
      'Guide shoppers from intent to the right product, and capture unmet demand from real conversations.',
    capabilities: [],
    accentColor: '#4E8067',
    icon: <ShoppingBag className="w-[18px] h-[18px]" />,
  },
  {
    id: 'gatharoom',
    name: 'Gatharoom',
    status: 'soon',
    categoryLabel: 'Live Market Research',
    tagline: 'AI-moderated live customer focus groups.',
    description:
      'Run structured research sessions with adaptive follow-ups and synthesised insights.',
    capabilities: [],
    accentColor: '#4E8067',
    icon: <Radio className="w-[18px] h-[18px]" />,
  },
];

const BETA_PRODUCTS = PRODUCT_SUITE.filter((p) => p.status === 'beta');
const SOON_PRODUCTS = PRODUCT_SUITE.filter((p) => p.status === 'soon');

interface ShowcaseItem {
  id: string;
  name: string;
  kicker: string;
  headline: string;
  description: string;
  image: string;
  accent: string;
  icon: React.ReactNode;
  bullets: string[];
  highlights: { title: string; detail: string }[];
  frameLabel?: string;
  ctaLabel?: string;
}

const SHOWCASE: ShowcaseItem[] = [
  {
    id: 'cyclode',
    name: 'Cyclode',
    kicker: 'Autonomous engineering workstation',
    headline: 'Plan, code, read and verify — in one calm workspace.',
    description:
      'Chat with an agent that understands your whole repository, while docs, terminal, previews and diffs sit right beside the conversation.',
    image: SHOT_CYCLODE,
    accent: '#4E8067',
    icon: <CyclodeIcon compact className="w-[20px] h-[20px]" />,
    bullets: [
      'Step-by-step reasoning and auditable actions',
      'Web & Docs reader that can operate live pages',
      'Sandboxed previews, terminal and diffs side by side',
    ],
    highlights: [
      { title: 'Auditable', detail: 'Every action logged' },
      { title: 'Cost-aware', detail: 'Live token telemetry' },
    ],
  },
  {
    id: 'meterbox',
    name: 'Meterbox',
    kicker: 'AI FinOps control plane',
    headline: 'Every token metered. Every quota enforced at the edge.',
    description:
      'A live metering pipeline — from scoped keys to deduplication, rollups and invoicing — designed so usage is never dropped or billed twice.',
    image: SHOT_METERBOX,
    accent: '#4E8067',
    icon: <MeterboxIcon compact className="w-[20px] h-[20px]" />,
    bullets: [
      'CloudEvents ingestion with idempotent deduplication',
      'Edge quota checks and prepaid credit burndown',
      'Dead-letter queue with inspect, repair and replay',
    ],
    highlights: [
      { title: 'Exactly-once', detail: 'Idempotent ingestion' },
      { title: 'Edge-first', detail: 'Quota checks before usage' },
    ],
  },
  {
    id: 'sauthen',
    name: 'Sauthen',
    kicker: 'Identity & agent token broker',
    headline: 'Know exactly who — and what — is acting for you.',
    description:
      'Unified OIDC & Passkey sign-in for humans, 15-minute RFC 8693 scoped tokens for agents, an AES-256-GCM secret vault, and human step-up gates.',
    image: SHOT_SAUTHEN,
    accent: '#4E8067',
    icon: <SauthenIcon className="w-[20px] h-[20px]" />,
    bullets: [
      'Ed25519 OIDC sessions & 1:1 Meterbox namespace provisioning',
      'RFC 8693 scoped agent tokens with 15-minute TTLs',
      'Zero-knowledge LLM vault proxy & human step-up approval gates',
    ],
    highlights: [
      { title: 'Zero-knowledge', detail: 'Keys stay in vault' },
      { title: 'Sub-millisecond', detail: 'Ed25519 JWKS verify' },
    ],
  },
  {
    id: 'valiscale',
    name: 'Valiscale',
    kicker: 'Validation, scoping & AI assembly',
    headline: 'Validate the wedge. Scope the guardrails. Assemble the stack.',
    description:
      'Turn raw ideas into governed AI apps and agents — combining live source verification beside your chat, interactive scoping for workflows and approval boundaries, and built-in AI routing, identity, and cost controls.',
    image: SHOT_VALISCALE,
    accent: '#4E8067',
    icon: <ValiscaleIcon size={20} />,
    bullets: [
      'Live web & source verification right beside your session',
      'Interactive scoping for workflows, data boundaries & autonomy ceilings',
      'Built-in AI gateway routing, zero-trust identity & cost controls from day one',
    ],
    highlights: [
      { title: 'Source-grounded', detail: 'Live Web & Docs reader' },
      { title: 'Governed by design', detail: 'Autonomy & step-up bounds' },
    ],
    frameLabel: 'Valiscale · In development preview',
    ctaLabel: 'Join the Valiscale waitlist',
  },
];

const FOUNDATION = [
  {
    id: 'runctor',
    name: 'Runctor',
    subtitle: 'One shared intelligence',
    status: 'In use',
    description:
      'Our agentic runtime injects domain tools, skills, personas and evaluation gates into every product. It powers Cyclode today.',
    icon: <Cpu className="w-5 h-5" />,
  },
  {
    id: 'sauthen',
    name: 'Sauthen',
    subtitle: 'One account everywhere',
    status: 'In use',
    description:
      'Unified OIDC & Passkey SSO, 1:1 Meterbox namespace provisioning, RFC 8693 scoped agent tokens, zero-knowledge LLM vault proxy, and human step-up gates.',
    icon: <SauthenIcon className="w-5 h-5" />,
  },
];

const AVAILABILITY = [
  { value: BETA_PRODUCTS.length, label: 'Products in private beta', detail: BETA_PRODUCTS.map((p) => p.name).join(' · ') },
  { value: SOON_PRODUCTS.length, label: 'Products in development', detail: SOON_PRODUCTS.map((p) => p.name).join(' · ') },
  { value: FOUNDATION.length, label: 'Shared foundation layers', detail: FOUNDATION.map((f) => f.name).join(' · ') },
];

const ACCESS_STEPS = [
  { title: 'Tell us what you’re building', desc: 'Pick the products you’re interested in and share a little context.' },
  { title: 'We onboard in small cohorts', desc: 'Private beta seats open in waves so every team gets real support.' },
  { title: 'Get a private invite', desc: 'Beta products arrive first; waitlisted products as soon as they’re ready.' },
];

const ASSEMBLE_STEPS = [
  { title: 'Share your project brief & starting stage', desc: 'Start from a raw concept, an active roadmap, or a production AI system that needs security and scale.' },
  { title: 'Architecture & scope session', desc: 'Our engineers map your app and agent workflows onto the Appembly stack with clear milestones.' },
  { title: 'Assemble, launch & scale together', desc: 'We validate, build, deploy, and operate your system — or hand your team the keys on our connected platform.' },
];

interface LifecycleStageItem {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  description: string;
  deliverable: string;
  productIds: string[];
  foundationIds?: string[];
}

const LIFECYCLE_STAGES: LifecycleStageItem[] = [
  {
    id: 'validate',
    step: '01 · Validate',
    title: 'Idea, Research & Demand',
    subtitle: 'Prove what to build before writing code',
    description:
      'Test market viability, run AI-moderated customer focus groups, capture real buyer intent, and generate structured PRDs.',
    deliverable: 'Validated PRD & demand signals',
    productIds: ['valiscale', 'gatharoom', 'wotneed'],
  },
  {
    id: 'engineer',
    step: '02 · Assemble',
    title: 'Autonomous Engineering',
    subtitle: 'Multi-agent build in isolated worktrees',
    description:
      'Decompose roadmaps into parallel agent waves and build in sandboxed git worktrees with auditable diffs and calm UI surfaces.',
    deliverable: 'Verified full-stack apps & agents',
    productIds: ['cyclode', 'swarmteam'],
  },
  {
    id: 'secure',
    step: '03 · Secure & Deploy',
    title: 'Identity, Vault & Runtime',
    subtitle: 'Zero-trust auth for humans and agents',
    description:
      'Ship with Passkey & OIDC SSO, 15-minute RFC 8693 scoped agent tokens, zero-knowledge LLM key proxying, and human step-up gates.',
    deliverable: 'Scoped agent STS & production runtime',
    productIds: ['sauthen'],
    foundationIds: ['runctor'],
  },
  {
    id: 'operate',
    step: '04 · Operate',
    title: 'Autonomic Day-2 Ops',
    subtitle: 'Self-healing production systems',
    description:
      'Keep client systems resilient with bounded runtime tuning, shadow-replayed remediations, and blast-radius approval queues.',
    deliverable: '24/7 autonomous SLO & incident reflexes',
    productIds: ['adappty'],
  },
  {
    id: 'scale',
    step: '05 · Scale & Bill',
    title: 'AI FinOps & Metering',
    subtitle: 'Every token metered, every quota enforced',
    description:
      'Ingest token and compute events exactly once, enforce edge entitlements, track per-agent margins, and automate Stripe invoicing.',
    deliverable: 'Live usage telemetry & billing',
    productIds: ['meterbox'],
  },
];

const ENGAGEMENT_MODELS = [
  {
    id: 'turnkey',
    label: 'Managed Assembly',
    detail: 'We validate, build, deploy & run it for you',
  },
  {
    id: 'cobuild',
    label: 'Co-Build Studio',
    detail: 'Assemble alongside your engineering team',
  },
  {
    id: 'pilot',
    label: 'Enterprise Pilot',
    detail: 'Custom agent & platform architecture rollout',
  },
];

const NAV_LINKS = [
  { href: '#lifecycle', label: 'Lifecycle' },
  { href: '#showcase', label: 'Showcase' },
  { href: '#products', label: 'Products' },
  { href: '#platform', label: 'Platform' },
  { href: '#access', label: 'Get Started' },
];

/* -------------------------------------------------------------------------- */
/*                                Motion hooks                                */
/* -------------------------------------------------------------------------- */

const usePrefersReducedMotion = useReducedMotion;

/** Fires once when the element first enters (or is about to enter) the viewport. */
function useInView<T extends Element>(threshold = 0.02, rootMargin = '0px 0px 80px 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold, rootMargin]);
  return [ref, inView] as const;
}

const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}> = ({ children, delay = 0, className = '', id }) => {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      id={id}
      className={`ap-reveal ${inView ? 'is-visible' : ''} ${className}`}
      style={{ '--ap-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

const CountUp: React.FC<{ value: number }> = ({ value }) => {
  const [ref, inView] = useInView<HTMLSpanElement>(0.4);
  const display = useCountUp(value, { duration: 1200, enabled: inView });

  return (
    <span ref={ref} className="tabular-nums">
      {display}
    </span>
  );
};

/** Sets CSS custom properties for the cursor-following spotlight effect. */
const handleSpotlightMove = (e: React.MouseEvent<HTMLElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--ap-mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--ap-my', `${e.clientY - rect.top}px`);
};

/* -------------------------------------------------------------------------- */
/*                               Visual helpers                               */
/* -------------------------------------------------------------------------- */

/**
 * Full-bleed 640×640 (8×8 grid of 80×80 cells) tangent-bridged modular block tapestries.
 * Every quadrant is packed with 1×1 rounded squares, 2×1 beams, 1×2 pillars, and
 * Monogram "a" Loop counters fused at diagonal vertices via 45° concave circular bridges.
 */
const MODULAR_TAPESTRY_PRIMARY_PATH = orthoLoopsToSvgPath(
  [
    // Quadrant 1 (Top-Left & Center): Reference Stepped Cascade + 2×1 Bridge
    [
      [240, 0],
      [320, 0],
      [320, 80],
      [240, 80],
      [240, 160],
      [80, 160],
      [80, 240],
      [160, 240],
      [160, 320],
      [320, 320],
      [320, 400],
      [160, 400],
      [160, 320],
      [80, 320],
      [80, 240],
      [0, 240],
      [0, 160],
      [80, 160],
      [80, 80],
      [240, 80],
    ],
    // Quadrant 2 (Top-Right & Mid-Right): 2×1 Beam + 1×2 Pillar + Stepped Nodes
    [
      [400, 0],
      [560, 0],
      [560, 80],
      [640, 80],
      [640, 160],
      [560, 160],
      [560, 80],
      [400, 80],
      [400, 160],
      [480, 160],
      [480, 320],
      [640, 320],
      [640, 400],
      [480, 400],
      [480, 320],
      [400, 320],
      [400, 160],
      [320, 160],
      [320, 80],
      [400, 80],
    ],
    // Quadrant 3 (Bottom-Left): Twin 2×1 Beams + Diagonal Bridge Nodes
    [
      [0, 400],
      [160, 400],
      [160, 480],
      [240, 480],
      [240, 560],
      [160, 560],
      [160, 640],
      [0, 640],
      [0, 560],
      [160, 560],
      [160, 480],
      [0, 480],
    ],
    // Quadrant 4 (Bottom-Right): Monogram "a" Loop + Stepped Right Wing
    [
      [320, 400],
      [400, 400],
      [400, 480],
      [480, 480],
      [480, 400],
      [560, 400],
      [560, 480],
      [640, 480],
      [640, 560],
      [560, 560],
      [560, 480],
      [480, 480],
      [480, 640],
      [320, 640],
      [320, 560],
      [240, 560],
      [240, 480],
      [320, 480],
    ],
    // Inner CCW counter hole of Quadrant 4's Monogram "a" Loop
    [
      [320, 480],
      [320, 560],
      [400, 560],
      [400, 480],
    ],
  ],
  20,
  24
);

const ModularPatternBackdrop: React.FC<{ tone?: 'light' | 'dark' }> = ({ tone = 'light' }) => {
  const uid = React.useId().replace(/:/g, '');
  const isDark = tone === 'dark';
  const primaryStroke = isDark
    ? 'text-[#F6F7F5]/[0.026]'
    : 'text-[#111618]/[0.026] dark:text-[#F6F7F5]/[0.026]';
  const secondaryStroke = isDark
    ? 'text-[#72B091]/[0.018]'
    : 'text-[#4E8067]/[0.016] dark:text-[#72B091]/[0.018]';
  const traceStroke = isDark
    ? 'text-[#72B091]/[0.055]'
    : 'text-[#4E8067]/[0.05] dark:text-[#72B091]/[0.055]';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      style={{
        maskImage:
          'radial-gradient(ellipse 68% 60% at 50% 42%, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.88) 65%, rgba(0,0,0,0.45) 100%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 68% 60% at 50% 42%, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.88) 65%, rgba(0,0,0,0.45) 100%)',
      }}
    >
      {/* Layer 1: Full-bleed faint contour lines of the tangent-bridged modular block pattern */}
      <svg className="ap-mod-drift-a absolute -inset-12 w-[calc(100%+6rem)] h-[calc(100%+6rem)]">
        <defs>
          <pattern
            id={`ap-mod-pat-a-${uid}`}
            width="640"
            height="640"
            patternUnits="userSpaceOnUse"
          >
            <path
              d={MODULAR_TAPESTRY_PRIMARY_PATH}
              className={primaryStroke}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.9"
            />
            <path
              d={MODULAR_TAPESTRY_PRIMARY_PATH}
              pathLength={1}
              className={`ap-mod-trace ${traceStroke}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#ap-mod-pat-a-${uid})`} />
      </svg>

      {/* Layer 2: Phase-shifted counter-drifting modular contour line layer */}
      <svg className="ap-mod-drift-b absolute -inset-12 w-[calc(100%+6rem)] h-[calc(100%+6rem)]">
        <defs>
          <pattern
            id={`ap-mod-pat-b-${uid}`}
            width="640"
            height="640"
            patternUnits="userSpaceOnUse"
            patternTransform="translate(320 240) scale(0.75)"
          >
            <path
              d={MODULAR_TAPESTRY_PRIMARY_PATH}
              className={secondaryStroke}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.85"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#ap-mod-pat-b-${uid})`} />
      </svg>
    </div>
  );
};

/** Product window chrome. Shows the product name — never a fake public URL. */
const ProductFrame: React.FC<{
  children: React.ReactNode;
  label: string;
  className?: string;
}> = ({ children, label, className = '' }) => (
  <div
    className={`rounded-[14px] sm:rounded-[18px] overflow-hidden border bg-[var(--ui-bg-surface)] border-[var(--ui-border)] shadow-[0_24px_72px_-24px_rgba(17,22,24,0.4),0_8px_24px_-8px_rgba(17,22,24,0.2)] ${className}`}
  >
    <div className="h-8 sm:h-9 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 border-b border-[var(--ui-border)] bg-[var(--ui-bg-subtle)]">
      <div className="flex gap-1.5 shrink-0">
        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#FF5F57]/80" />
        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#FEBC2E]/80" />
        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#28C840]/80" />
      </div>
      <div className="mx-auto max-w-[220px] sm:max-w-[260px] w-full h-5 rounded-md text-[10px] sm:text-[10.5px] font-medium flex items-center justify-center gap-1.5 truncate px-2 bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)]">
        <Lock className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="w-[26px] sm:w-[42px] shrink-0" />
    </div>
    {children}
  </div>
);

const ProductShot: React.FC<{ src: string; alt: string; eager?: boolean; className?: string }> = ({
  src,
  alt,
  eager = false,
  className = 'block w-full h-auto',
}) => (
  <img
    src={src}
    alt={alt}
    width={SHOT_WIDTH}
    height={SHOT_HEIGHT}
    loading={eager ? 'eager' : 'lazy'}
    fetchPriority={eager ? 'high' : 'auto'}
    decoding="async"
    className={className}
  />
);

const StatusBadge: React.FC<{ status: ProductStatus; tone?: 'light' | 'dark' }> = ({
  status,
  tone = 'light',
}) =>
  status === 'beta' ? (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
        tone === 'dark' ? 'bg-[#4E8067]/20 text-[#72B091]' : 'bg-[var(--ui-accent)]/12 text-[var(--ui-accent)]'
      }`}
    >
      <span className="ap-pulse w-1.5 h-1.5 rounded-full bg-current" />
      Private beta
    </span>
  ) : (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border border-dashed ${
        tone === 'dark' ? 'border-[#344248] text-[#A9AFAB]' : 'border-[var(--ui-border-strong)] text-[var(--ui-text-muted)]'
      }`}
    >
      Coming soon
    </span>
  );

const SectionEyebrow: React.FC<{ children: React.ReactNode; tone?: 'light' | 'dark' }> = ({
  children,
  tone = 'light',
}) => (
  <div
    className={`inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] ${
      tone === 'dark' ? 'text-[#72B091]' : 'text-[var(--ui-accent)]'
    }`}
  >
    <span className="w-5 h-px bg-current opacity-60" />
    {children}
  </div>
);

const HeadlineWords: React.FC<{ text: string; startDelay?: number; className?: string }> = ({
  text,
  startDelay = 0,
  className = '',
}) => (
  <>
    {text.split(' ').map((word, i) => (
      <span key={`${word}-${i}`} className={`ap-word ${className}`}>
        <span style={{ '--ap-delay': `${startDelay + i * 45}ms` } as React.CSSProperties}>
          {word}
        </span>
        {'\u00A0'}
      </span>
    ))}
  </>
);

type RequestAccess = (productId?: string, stageId?: string, intent?: FormIntent) => void;

/* -------------------------------------------------------------------------- */
/*                                   Sections                                 */
/* -------------------------------------------------------------------------- */

const Header: React.FC<{ onRequestAccess: RequestAccess }> = ({ onRequestAccess }) => {
  const { theme, toggleTheme } = useAppemblyTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6">
      <div
        className={`ap-header-inner mx-auto flex items-center justify-between gap-6 h-16 px-4 sm:px-5 border ${
          scrolled
            ? 'max-w-[1080px] mt-3 rounded-2xl bg-[var(--ui-bg-surface)] backdrop-blur-xl border-[var(--ui-border)] shadow-[0_8px_32px_-12px_rgba(17,22,24,0.18)]'
            : 'max-w-[1320px] mt-0 rounded-none bg-transparent border-transparent'
        }`}
      >
        <a href="#top" className="flex items-center shrink-0" aria-label="Appembly home">
          <AppemblyLogo variant="lockup" size={30} productName="Appembly" animated />
        </a>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3.5 py-2 rounded-lg text-[13.5px] font-medium text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => onRequestAccess(undefined, undefined, 'access')}
            className="hidden lg:inline-flex items-center h-9 px-3.5 rounded-lg text-[13px] font-medium text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] transition-colors cursor-pointer"
          >
            Product beta
          </button>
          <button
            type="button"
            onClick={() => onRequestAccess(undefined, undefined, 'assemble')}
            className="hidden sm:inline-flex group items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold bg-[var(--ui-text-primary)] text-[var(--ui-bg-canvas)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Assemble with us
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden ap-enter mx-auto mt-2 max-w-[1080px] rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)]/95 backdrop-blur-xl p-2 shadow-lg">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 rounded-xl text-[15px] font-medium text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)]"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestAccess(undefined, undefined, 'assemble');
              }}
              className="px-4 py-3 rounded-xl text-[14px] font-semibold bg-[var(--ui-accent)] text-[#F6F7F5] cursor-pointer"
            >
              Assemble with us
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestAccess(undefined, undefined, 'access');
              }}
              className="px-4 py-3 rounded-xl text-[14px] font-semibold border border-[var(--ui-border-strong)] text-[var(--ui-text-primary)] cursor-pointer"
            >
              Product beta
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

const Hero: React.FC<{ onRequestAccess: RequestAccess }> = ({ onRequestAccess }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Scroll-linked tilt on desktop viewports only; mobile stays flat for crisp legibility and 60fps scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof window === 'undefined') return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (window.innerWidth < 768) {
        el.style.setProperty('--ap-tilt', '0');
        return;
      }
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const tilt = Math.max(0, Math.min(1, (rect.top - vh * 0.12) / (vh * 0.6)));
      el.style.setProperty('--ap-tilt', tilt.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-40 lg:pt-44 pb-6 sm:pb-8">
      <ModularPatternBackdrop tone="light" />
      <div
        className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] rounded-full opacity-60 blur-3xl ap-glow"
        style={{
          background:
            'radial-gradient(closest-side, rgba(78,128,103,0.28), rgba(78,128,103,0.08) 60%, transparent)',
        }}
      />

      <div className="relative max-w-[1320px] mx-auto px-4 sm:px-10">
        <div className="max-w-[920px] mx-auto text-center">
          <a
            href="#lifecycle"
            className="ap-enter group inline-flex items-center gap-2 pl-2 pr-3 py-1.5 max-w-full rounded-full border border-[var(--ui-border)] bg-[var(--ui-bg-surface)]/70 backdrop-blur text-[12px] sm:text-[12.5px] font-medium text-[var(--ui-text-secondary)] hover:border-[var(--ui-accent)]/50 transition-colors"
            style={{ '--ap-delay': '0ms' } as React.CSSProperties}
          >
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--ui-accent)]/12 text-[var(--ui-accent)] font-semibold shrink-0">
              <span className="ap-pulse w-1.5 h-1.5 rounded-full bg-current" />
              Platform &amp; Studio
            </span>
            <span className="truncate">
              Idea to scale · Cyclode, Meterbox &amp; Sauthen<span className="hidden sm:inline"> now in private beta</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </a>

          <h1 className="mt-6 sm:mt-8 text-[38px] sm:text-[64px] lg:text-[84px] font-semibold tracking-[-0.045em] leading-[1.01] sm:leading-[0.98] text-[var(--ui-text-primary)]">
            <HeadlineWords text="Assembling AI-native" startDelay={60} />
            <br />
            <HeadlineWords text="apps and agents." startDelay={180} className="text-[var(--ui-accent)]" />
          </h1>

          <p
            className="ap-enter mt-5 sm:mt-7 text-[15.5px] sm:text-[19px] leading-[1.6] text-[var(--ui-text-secondary)] max-w-[680px] mx-auto"
            style={{ '--ap-delay': '260ms' } as React.CSSProperties}
          >
            One connected platform from idea validation and autonomous engineering to identity,
            self-healing ops, and usage billing. Adopt our modular tools directly — or partner
            with our team to assemble, deploy, and scale your system end to end.
          </p>

          <div
            className="ap-enter mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-[420px] sm:max-w-none mx-auto"
            style={{ '--ap-delay': '340ms' } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={() => onRequestAccess(undefined, undefined, 'assemble')}
              className="group inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-[14.5px] font-semibold bg-[var(--ui-accent)] text-[#F6F7F5] hover:bg-[var(--appembly-sage-hover)] shadow-[0_8px_24px_-8px_rgba(78,128,103,0.6)] transition-colors cursor-pointer"
            >
              Assemble with us
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={() => onRequestAccess(undefined, undefined, 'access')}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-[14.5px] font-semibold border border-[var(--ui-border-strong)] bg-[var(--ui-bg-surface)]/70 backdrop-blur text-[var(--ui-text-primary)] hover:border-[var(--ui-text-primary)] transition-colors cursor-pointer"
            >
              Request product access
            </button>
          </div>
        </div>

        {/* Product stage */}
        <div
          className="ap-enter-stage relative mt-12 sm:mt-24 mx-auto max-w-[1160px]"
          style={{ '--ap-delay': '400ms', perspective: '2200px' } as React.CSSProperties}
        >
          <div ref={stageRef} className="relative" style={{ '--ap-tilt': 0 } as React.CSSProperties}>
            <div className="ap-stage-back hidden md:block absolute -right-6 lg:-right-16 -top-14 w-[58%] opacity-90">
              <ProductFrame label="Meterbox · Private beta" className="rotate-[2deg]">
                <ProductShot src={SHOT_METERBOX} alt="Meterbox FinOps control plane" />
              </ProductFrame>
            </div>

            <div className="ap-stage relative">
              <ProductFrame label="Cyclode · Private beta" className="relative">
                <ProductShot src={SHOT_CYCLODE} alt="Cyclode autonomous engineering workstation" eager />
              </ProductFrame>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 -bottom-2 h-8 sm:h-40 bg-gradient-to-t from-[var(--ui-bg-canvas)] to-transparent" />
        </div>
      </div>
    </section>
  );
};

const ProductMarquee: React.FC = () => {
  const items = [
    ...PRODUCT_SUITE.map((p) => ({ name: p.name, color: p.accentColor, soon: p.status === 'soon' })),
    ...FOUNDATION.filter((f) => !PRODUCT_SUITE.some((p) => p.id === f.id)).map((f) => ({
      name: f.name,
      color: '#72B091',
      soon: false,
    })),
  ];
  const loop = [...items, ...items];
  return (
    <section aria-label="Appembly ecosystem" className="py-10 border-y border-[var(--ui-border)]">
      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 flex flex-col md:flex-row md:items-center gap-6">
        <div className="inline-flex items-center gap-3 text-[12.5px] font-medium text-[var(--ui-text-muted)] shrink-0 md:w-64">
          <AppemblyLogo variant="app-icon" size={28} animated />
          <span>
            One ecosystem. Eight products.
            <br className="hidden md:block" /> One shared foundation.
          </span>
        </div>
        <div className="ap-marquee overflow-hidden flex-1" aria-hidden="true">
          <div className="ap-marquee-track">
            {loop.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                className={`flex items-center gap-2.5 px-8 text-[20px] font-semibold tracking-[-0.02em] whitespace-nowrap ${
                  item.soon ? 'text-[var(--ui-text-muted)]' : 'text-[var(--ui-text-secondary)]'
                }`}
              >
                <span className="w-2 h-2 rotate-45 rounded-[2px]" style={{ backgroundColor: item.color }} />
                {item.name}
                {item.soon && (
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
                    Soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const LifecyclePipeline: React.FC<{ onRequestAccess: RequestAccess }> = ({ onRequestAccess }) => (
  <section
    id="lifecycle"
    className="relative overflow-hidden py-16 sm:py-24 lg:py-32 border-b border-[var(--ui-border)] bg-[var(--ui-bg-subtle)]/35 scroll-mt-20"
  >
    <ModularPatternBackdrop tone="light" />
    <div className="relative max-w-[1320px] mx-auto px-4 sm:px-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-10">
        <Reveal className="max-w-[740px]">
          <SectionEyebrow>End-to-end AI lifecycle</SectionEyebrow>
          <h2 className="mt-4 sm:mt-5 text-[30px] sm:text-[52px] font-semibold tracking-[-0.035em] leading-[1.06] sm:leading-[1.04] text-[var(--ui-text-primary)]">
            From initial idea to
            <br />
            <span className="text-[var(--ui-accent)]">autonomic production.</span>
          </h2>
        </Reveal>
        <Reveal delay={50} className="max-w-[460px]">
          <p className="text-[15.5px] sm:text-[16px] leading-[1.65] text-[var(--ui-text-secondary)]">
            Every stage of building an AI-native application or agent system is backed by purpose-built
            Appembly software — whether your team runs the tools directly or partners with us to assemble
            and operate the full lifecycle.
          </p>
        </Reveal>
      </div>

      {/* 5-Stage Full-Width Pipeline Matrix */}
      <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const stageProducts = stage.productIds
            .map((id) => PRODUCT_SUITE.find((p) => p.id === id))
            .filter((p): p is ProductSuiteItem => Boolean(p));
          const stageFoundations = (stage.foundationIds || [])
            .map((id) => FOUNDATION.find((f) => f.id === id))
            .filter((f): f is (typeof FOUNDATION)[number] => Boolean(f));

          return (
            <Reveal key={stage.id} delay={idx * 45}>
              <article
                onMouseMove={handleSpotlightMove}
                className="ap-spotlight ap-lift h-full rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] p-5 sm:p-6 flex flex-col justify-between hover:border-[var(--ui-border-strong)] transition-colors"
                style={{ '--ap-spot': 'rgba(78,128,103,0.16)' } as React.CSSProperties}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ui-accent)]">
                      {stage.step}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--ui-text-muted)]">
                      Stage {idx + 1}/5
                    </span>
                  </div>

                  <h3 className="mt-2.5 text-[17px] font-semibold tracking-[-0.015em] text-[var(--ui-text-primary)]">
                    {stage.title}
                  </h3>
                  <div className="mt-1 text-[13px] font-medium text-[var(--ui-text-primary)]/85">
                    {stage.subtitle}
                  </div>
                  <p className="mt-2.5 text-[13.5px] leading-[1.55] text-[var(--ui-text-secondary)]">
                    {stage.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-[var(--ui-border)] space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {stageProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onRequestAccess(p.id, stage.id, 'access')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--ui-border)] text-[12px] font-semibold text-[var(--ui-text-primary)] hover:border-[var(--ui-accent)] transition-colors cursor-pointer"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: p.accentColor,
                            opacity: p.status === 'beta' ? 1 : 0.45,
                          }}
                        />
                        {p.name}
                      </button>
                    ))}
                    {stageFoundations.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--ui-border)] text-[12px] font-semibold text-[var(--ui-text-secondary)]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ui-accent)] shrink-0" />
                        {f.name}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[12px] text-[var(--ui-text-muted)] truncate">
                      {stage.deliverable}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRequestAccess(undefined, stage.id, 'assemble')}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ui-accent)] hover:opacity-80 shrink-0 cursor-pointer"
                    >
                      Scope <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>

      {/* Two Ways to Assemble: Studio vs Self-Serve Platform */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Reveal delay={120}>
          <div className="h-full rounded-2xl border border-[var(--ui-border-strong)] bg-[var(--ui-bg-surface)] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-[460px]">
              <div className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ui-accent)]">
                <span className="w-2 h-2 rounded-full bg-[var(--ui-accent)]" />
                Client Assembly &amp; Venture Studio
              </div>
              <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-[-0.015em] text-[var(--ui-text-primary)]">
                We assemble and run it for you — powered by our suite.
              </h3>
              <p className="text-[13.5px] sm:text-[14px] leading-[1.55] text-[var(--ui-text-secondary)]">
                Bring an initial concept, roadmap, or enterprise workflow. Our team validates, builds,
                deploys, and operates your AI-native apps and agents on the connected Appembly stack.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRequestAccess(undefined, 'full-lifecycle', 'assemble')}
              className="group inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-[13.5px] font-semibold bg-[var(--ui-accent)] text-[#F6F7F5] hover:bg-[var(--appembly-sage-hover)] transition-colors shrink-0 cursor-pointer"
            >
              Scope a project
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="h-full rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-[460px]">
              <div className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ui-text-muted)]">
                <span className="w-2 h-2 rounded-full bg-[var(--ui-text-secondary)]" />
                Self-Serve &amp; Co-Build Platform
              </div>
              <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-[-0.015em] text-[var(--ui-text-primary)]">
                Your engineering team builds directly on our modules.
              </h3>
              <p className="text-[13.5px] sm:text-[14px] leading-[1.55] text-[var(--ui-text-secondary)]">
                Adopt Cyclode, Meterbox, and Sauthen individually in your own stack today — or connect
                the full suite on one shared identity, runtime, and Calm UI foundation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRequestAccess(undefined, undefined, 'access')}
              className="group inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-[13.5px] font-semibold border border-[var(--ui-border-strong)] text-[var(--ui-text-primary)] hover:border-[var(--ui-text-primary)] transition-colors shrink-0 cursor-pointer"
            >
              Request beta access
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

const Showcase: React.FC<{ onRequestAccess: RequestAccess }> = ({ onRequestAccess }) => {
  const reduced = usePrefersReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const active = SHOWCASE[activeIdx];

  const select = useCallback((idx: number) => {
    setActiveIdx(idx);
    setAutoplay(false);
  }, []);

  const advance = useCallback(() => {
    setActiveIdx((i) => (i + 1) % SHOWCASE.length);
  }, []);

  return (
    <section id="showcase" className="relative overflow-hidden py-16 sm:py-24 lg:py-36 scroll-mt-20">
      <ModularPatternBackdrop tone="light" />
      <div className="relative max-w-[1320px] mx-auto px-4 sm:px-10">
        <Reveal className="max-w-[760px]">
          <SectionEyebrow>Product showcase</SectionEyebrow>
          <h2 className="mt-4 sm:mt-5 text-[30px] sm:text-[52px] font-semibold tracking-[-0.035em] leading-[1.06] sm:leading-[1.04] text-[var(--ui-text-primary)]">
            Real products, built for real work.
          </h2>
          <p className="mt-4 sm:mt-5 text-[15.5px] sm:text-[17px] leading-[1.65] text-[var(--ui-text-secondary)] max-w-[620px]">
            Cyclode, Meterbox and Sauthen are running today in private beta alongside Valiscale in
            active development. Every product shares the same calm interface, unified identity and
            live telemetry — so moving between them feels like one system.
          </p>
        </Reveal>

        <div className="ap-showcase mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          <Reveal className="lg:col-span-4 space-y-3" delay={40}>
            <div role="tablist" aria-label="Products in private beta" className="space-y-3">
              {SHOWCASE.map((item, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-colors duration-300 relative overflow-hidden ${
                      isActive
                        ? 'bg-[var(--ui-bg-surface)] border-[var(--ui-border-strong)] shadow-[0_12px_40px_-20px_rgba(17,22,24,0.35)]'
                        : 'bg-[var(--ui-bg-surface)]/40 lg:bg-transparent border-[var(--ui-border)] lg:border-transparent hover:bg-[var(--ui-bg-surface)]/60'
                    }`}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => select(idx)}
                      className="w-full flex items-center gap-3 text-left cursor-pointer"
                    >
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--ui-bg-subtle)] border border-[var(--ui-border)] shrink-0"
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-[var(--ui-text-primary)]">{item.name}</div>
                        <div className="text-[12.5px] text-[var(--ui-text-muted)] truncate">{item.kicker}</div>
                      </div>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-400 ${
                        isActive ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                      aria-hidden={!isActive}
                    >
                      <div className="overflow-hidden">
                        <div className="pt-4 sm:pt-5 space-y-4">
                          {/* Inline screenshot preview on mobile/tablet so tapping a tab immediately displays its UI */}
                          <div className="lg:hidden">
                            <ProductFrame label={item.frameLabel || `${item.name} · Private beta`}>
                              <ProductShot
                                src={item.image}
                                alt={`${item.name} — ${item.kicker}`}
                                className="w-full h-auto object-cover object-top"
                              />
                            </ProductFrame>
                          </div>

                          <div className="text-[17px] sm:text-[19px] font-semibold tracking-[-0.02em] leading-snug text-[var(--ui-text-primary)]">
                            {item.headline}
                          </div>
                          <p className="text-[14px] leading-relaxed text-[var(--ui-text-secondary)]">{item.description}</p>
                          <ul className="space-y-2.5">
                            {item.bullets.map((b) => (
                              <li key={b} className="flex items-start gap-2.5 text-[13.5px] text-[var(--ui-text-secondary)]">
                                <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: item.accent }} />
                                {b}
                              </li>
                            ))}
                          </ul>
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            {item.highlights.map((h) => (
                              <div key={h.title} className="rounded-xl bg-[var(--ui-bg-subtle)] px-3.5 py-3">
                                <div className="text-[14px] sm:text-[15px] font-semibold tracking-tight text-[var(--ui-text-primary)]">
                                  {h.title}
                                </div>
                                <div className="text-[11.5px] text-[var(--ui-text-muted)]">{h.detail}</div>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => onRequestAccess(item.id)}
                            className="group inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--ui-text-primary)] hover:text-[var(--ui-accent)] transition-colors cursor-pointer"
                          >
                            {item.ctaLabel || `Request access to ${item.name}`}
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isActive && autoplay && !reduced && (
                      <span className="absolute left-5 right-5 bottom-0 h-[2px] rounded-full bg-[var(--ui-border)] overflow-hidden">
                        <span
                          key={`${item.id}-${activeIdx}`}
                          className="ap-progress-bar block h-full w-full"
                          style={{ backgroundColor: item.accent, '--ap-duration': '8s' } as React.CSSProperties}
                          onAnimationEnd={advance}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal className="hidden lg:block lg:col-span-8" delay={80}>
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-10 rounded-[40px] blur-3xl opacity-40 transition-colors duration-1000"
                style={{ background: `radial-gradient(closest-side, ${active.accent}55, transparent)` }}
              />
              <ProductFrame label={active.frameLabel || `${active.name} · Private beta`} className="relative">
                <div className="relative aspect-[1024/585] bg-[var(--ui-bg-subtle)]">
                  {SHOWCASE.map((item, idx) => (
                    <div key={item.id} data-active={idx === activeIdx ? 'true' : 'false'} className="ap-shot absolute inset-0">
                      <ProductShot
                        src={item.image}
                        alt={`${item.name} — ${item.kicker}`}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ))}
                </div>
              </ProductFrame>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

const ProductGrid: React.FC<{ onRequestAccess: RequestAccess }> = ({ onRequestAccess }) => (
  <section id="products" className="relative overflow-hidden py-16 sm:py-24 lg:py-36 bg-[var(--ui-bg-subtle)]/50 border-y border-[var(--ui-border)] scroll-mt-20">
    <ModularPatternBackdrop tone="light" />
    <div className="relative max-w-[1320px] mx-auto px-4 sm:px-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8">
        <Reveal className="max-w-[720px]">
          <SectionEyebrow>The product suite</SectionEyebrow>
          <h2 className="mt-4 sm:mt-5 text-[30px] sm:text-[52px] font-semibold tracking-[-0.035em] leading-[1.06] sm:leading-[1.04] text-[var(--ui-text-primary)]">
            Powerful alone.
            <br />
            <span className="text-[var(--ui-text-muted)]">Effortless together.</span>
          </h2>
        </Reveal>
        <Reveal delay={50} className="max-w-[420px]">
          <p className="text-[15.5px] sm:text-[16px] leading-[1.65] text-[var(--ui-text-secondary)]">
            Start with one app to solve an immediate workflow. As the suite grows, research,
            validation, engineering and commerce will share context automatically.
          </p>
        </Reveal>
      </div>

      {/* Private beta */}
      <div className="mt-10 sm:mt-16 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {BETA_PRODUCTS.map((product, idx) => (
          <Reveal key={product.id} delay={idx * 45}>
            <article
              onMouseMove={handleSpotlightMove}
              className="ap-spotlight ap-lift group h-full rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] p-6 sm:p-8 flex flex-col hover:border-[var(--ui-border-strong)] hover:shadow-[0_24px_60px_-28px_rgba(17,22,24,0.35)]"
              style={{ '--ap-spot': `${product.accentColor}22` } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--ui-bg-subtle)] border border-[var(--ui-border)] shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                >
                  {product.icon}
                </span>
                <StatusBadge status={product.status} />
              </div>
              <div className="mt-6 sm:mt-7">
                <div className="text-[12px] font-medium" style={{ color: product.accentColor }}>
                  {product.categoryLabel}
                </div>
                <h3 className="mt-1.5 text-[24px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[var(--ui-text-primary)]">
                  {product.name}
                </h3>
                <p className="mt-2 text-[15.5px] sm:text-[16px] font-medium leading-snug text-[var(--ui-text-primary)]/85">{product.tagline}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--ui-text-secondary)]">{product.description}</p>
              </div>
              <ul className="mt-6 space-y-2.5">
                {product.capabilities.map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-[13.5px] text-[var(--ui-text-secondary)]">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: product.accentColor }} />
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-7 sm:pt-8">
                <div className="pt-5 border-t border-[var(--ui-border)] flex items-center justify-between gap-4">
                  <span className="text-[12.5px] text-[var(--ui-text-muted)]">Invitation-only</span>
                  <button
                    type="button"
                    onClick={() => onRequestAccess(product.id)}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold bg-[var(--ui-text-primary)] text-[var(--ui-bg-canvas)] hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Request access <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      {/* Coming soon */}
      <Reveal className="mt-14 sm:mt-20 flex items-center gap-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-muted)] whitespace-nowrap">
          Coming soon
        </h3>
        <span className="h-px flex-1 bg-[var(--ui-border)]" />
      </Reveal>
      <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-5">
        {SOON_PRODUCTS.map((product, idx) => (
          <Reveal
            key={product.id}
            delay={idx * 40}
            className={idx < 2 ? 'lg:col-span-3' : 'lg:col-span-2'}
          >
            <article className="ap-lift group h-full rounded-3xl border border-dashed border-[var(--ui-border-strong)] bg-[var(--ui-bg-surface)]/60 p-5 sm:p-6 flex flex-col hover:bg-[var(--ui-bg-surface)]">
              <div className="flex items-center justify-between">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[var(--ui-bg-subtle)] border border-[var(--ui-border)]"
                  style={{ color: product.accentColor }}
                >
                  {product.icon}
                </span>
                <StatusBadge status={product.status} />
              </div>
              <div className="mt-5 sm:mt-6 text-[12px] font-medium" style={{ color: product.accentColor }}>
                {product.categoryLabel}
              </div>
              <h4 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-[var(--ui-text-primary)]">{product.name}</h4>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ui-text-secondary)]">{product.tagline}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ui-text-muted)]">{product.description}</p>
              <button
                type="button"
                onClick={() => onRequestAccess(product.id)}
                className="mt-auto pt-5 sm:pt-6 self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ui-text-primary)] hover:text-[var(--ui-accent)] transition-colors cursor-pointer"
              >
                Join the waitlist <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/** Animated hub diagram: Appembly core → shared foundation → seven products (beta products animate). */
const PlatformDiagram: React.FC = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  const cx = 320;
  const cy = 240;
  const outerProducts = PRODUCT_SUITE.filter((p) => !FOUNDATION.some((f) => f.id === p.id));
  const products = outerProducts.map((p, i) => {
    const angle = (-90 + i * (360 / outerProducts.length)) * (Math.PI / 180);
    return { ...p, x: cx + Math.cos(angle) * 236, y: cy + Math.sin(angle) * 178 };
  });
  // Foundation nodes sit at 0°/180° — symmetrically between the product flow lines.
  const foundation = FOUNDATION.map((f, i) => {
    const angle = (i * (360 / FOUNDATION.length)) * (Math.PI / 180);
    return { ...f, x: cx + Math.cos(angle) * 108, y: cy + Math.sin(angle) * 92 };
  });

  return (
    <div ref={ref} className={inView ? 'is-visible' : ''}>
      {/* Mobile-friendly high-legibility stack (< 640px) */}
      <div className="sm:hidden rounded-2xl border border-[#263136] bg-[#171E21]/75 p-4 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[#263136]">
          <div className="w-10 h-10 rounded-xl bg-[#4E8067] flex items-center justify-center shrink-0">
            <AppemblyLogo variant="mark" size={22} strokeColor="#F6F7F5" animated />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold text-[#F6F7F5]">Appembly Core</div>
            <div className="text-[11.5px] text-[#72B091]">Shared identity, runtime &amp; metering bus</div>
          </div>
        </div>

        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#A9AFAB] mb-2">
            Foundation Layers
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FOUNDATION.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-xl border border-[#4E8067]/50 bg-[#111618] px-3 py-2 text-[12.5px] font-semibold text-[#F6F7F5]"
              >
                <span className="w-2 h-2 rounded-full bg-[#72B091] shrink-0" />
                <span className="truncate">{f.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#A9AFAB] mb-2">
            Connected Product Suite
          </div>
          <div className="grid grid-cols-2 gap-2">
            {outerProducts.map((p) => {
              const live = p.status === 'beta';
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold ${
                    live
                      ? 'border border-[#4E8067]/50 bg-[#111618] text-[#F6F7F5]'
                      : 'border border-dashed border-[#344248] bg-[#111618]/50 text-[#A9AFAB]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.accentColor, opacity: live ? 1 : 0.45 }}
                    />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider shrink-0 ${live ? 'text-[#72B091]' : 'text-[#7C8380]'}`}>
                    {live ? 'Beta' : 'Soon'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tablet & Desktop orbital SVG architecture diagram (sm+) */}
      <svg viewBox="0 0 640 480" className="hidden sm:block w-full h-auto" role="img" aria-label="Appembly platform architecture: a shared core and foundation connecting seven products">
        <defs>
          <radialGradient id="ap-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4E8067" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#4E8067" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="ap-spin-slow">
          <ellipse cx={cx} cy={cy} rx={236} ry={178} fill="none" stroke="#263136" strokeDasharray="2 6" />
        </g>
        <ellipse cx={cx} cy={cy} rx={108} ry={92} fill="none" stroke="#263136" />
        <circle cx={cx} cy={cy} r={110} fill="url(#ap-core-glow)" />

        {products.map((p, i) => {
          const live = p.status === 'beta';
          return (
            <g key={`line-${p.id}`}>
              <line
                x1={cx}
                y1={cy}
                x2={p.x}
                y2={p.y}
                stroke={live ? '#263136' : '#2A3539'}
                strokeWidth={1}
                strokeDasharray={live ? undefined : '2 5'}
              />
              {live && (
                <>
                  <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={p.accentColor} strokeOpacity={0.75} strokeWidth={1.4} className="ap-flow" />
                  <circle r={3} fill={p.accentColor}>
                    <animateMotion dur="3.2s" begin={`${i * 0.6}s`} repeatCount="indefinite" path={`M${cx},${cy} L${p.x},${p.y}`} />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur="3.2s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
                  </circle>
                </>
              )}
            </g>
          );
        })}

        {foundation.map((f, i) => {
          const live = f.status === 'In use';
          return (
            <g key={f.id} className="ap-node" style={{ '--ap-delay': `${200 + i * 120}ms` } as React.CSSProperties}>
              <rect
                x={f.x - 48}
                y={f.y - 14}
                width={96}
                height={28}
                rx={14}
                fill="#171E21"
                stroke={live ? '#4E8067' : '#344248'}
                strokeOpacity={live ? 0.75 : 1}
                strokeDasharray={live ? undefined : '3 3'}
              />
              <text x={f.x} y={f.y + 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={live ? '#C5CAC7' : '#7C8380'}>
                {f.name}
              </text>
            </g>
          );
        })}

        <g className="ap-node" style={{ '--ap-delay': '0ms' } as React.CSSProperties}>
          <rect x={cx - 38} y={cy - 38} width={76} height={76} rx={18} fill="#4E8067" />
          <g transform={`translate(${cx - 26}, ${cy - 26}) scale(0.52)`}>
            <AnimatedModularMarkGraphic fill="#F6F7F5" maskId="ap-platform-core-mask" />
          </g>
        </g>

        {products.map((p, i) => {
          const w = 112;
          const h = 36;
          const live = p.status === 'beta';
          return (
            <g key={p.id} className="ap-node" style={{ '--ap-delay': `${500 + i * 90}ms` } as React.CSSProperties}>
              <rect
                x={p.x - w / 2}
                y={p.y - h / 2}
                width={w}
                height={h}
                rx={18}
                fill="#171E21"
                stroke={live ? p.accentColor : '#344248'}
                strokeOpacity={live ? 0.6 : 1}
                strokeDasharray={live ? undefined : '3 3'}
              />
              <circle cx={p.x - w / 2 + 18} cy={p.y} r={5} fill={p.accentColor} opacity={live ? 1 : 0.45} />
              <text x={p.x - w / 2 + 31} y={p.y + 4.5} fontSize={13} fontWeight={600} fill={live ? '#F6F7F5' : '#7C8380'}>
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-[12px] text-[#A9AFAB]">
        <span className="inline-flex items-center gap-2">
          <span className="w-5 h-[2px] rounded bg-[#72B091]" /> In private beta / in use
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-5 h-0 border-t-2 border-dashed border-[#344248]" /> In development
        </span>
      </div>
    </div>
  );
};

const Platform: React.FC = () => (
  <section id="platform" className="relative py-16 sm:py-24 lg:py-36 bg-[#111618] text-[#F6F7F5] overflow-hidden scroll-mt-20">
    <ModularPatternBackdrop tone="dark" />
    <div
      className="pointer-events-none absolute -bottom-40 -left-40 w-[700px] h-[700px] rounded-full blur-3xl opacity-40 ap-glow"
      style={{ background: 'radial-gradient(closest-side, rgba(78,128,103,0.45), transparent)' }}
    />

    <div className="relative max-w-[1320px] mx-auto px-4 sm:px-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-5">
          <Reveal>
            <SectionEyebrow tone="dark">The connected platform</SectionEyebrow>
            <h2 className="mt-4 sm:mt-5 text-[30px] sm:text-[52px] font-semibold tracking-[-0.035em] leading-[1.06] sm:leading-[1.04]">
              One foundation.
              <br />
              <span className="text-[#72B091]">Every product.</span>
            </h2>
            <p className="mt-4 sm:mt-6 text-[15.5px] sm:text-[17px] leading-[1.65] text-[#A9AFAB] max-w-[480px]">
              Most suites are stitched together after the fact. Every Appembly app is built from
              day one on shared layers — so identity, intelligence and experience never fragment.
            </p>
          </Reveal>

          <div className="mt-8 sm:mt-10 space-y-3">
            {FOUNDATION.map((f, i) => (
              <Reveal key={f.id} delay={60 + i * 50}>
                <div
                  onMouseMove={handleSpotlightMove}
                  className="ap-spotlight flex items-start gap-4 rounded-2xl border border-[#263136] bg-[#171E21]/70 p-4 sm:p-5 hover:border-[#4E8067]/60 transition-colors"
                  style={{ '--ap-spot': 'rgba(114,176,145,0.14)' } as React.CSSProperties}
                >
                  <span className="w-10 h-10 rounded-xl bg-[#111618] border border-[#263136] text-[#72B091] flex items-center justify-center shrink-0">
                    {f.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="text-[16px] font-semibold">
                        {f.name}
                        <span className="ml-2 text-[13px] font-medium text-[#72B091]">{f.subtitle}</span>
                      </div>
                      <span
                        className={`text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          f.status === 'In use' ? 'bg-[#4E8067]/20 text-[#72B091]' : 'border border-dashed border-[#344248] text-[#A9AFAB]'
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#A9AFAB]">{f.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <Reveal delay={80}>
            <PlatformDiagram />
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

const Availability: React.FC = () => (
  <section className="py-16 sm:py-24 lg:py-28">
    <div className="max-w-[1320px] mx-auto px-4 sm:px-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--ui-border)]">
        {AVAILABILITY.map((s, i) => (
          <Reveal
            key={s.label}
            delay={i * 45}
            className="py-6 first:pt-0 last:pb-0 sm:py-0 sm:px-6 sm:first:pl-0 sm:last:pr-0"
          >
            <div className="text-[48px] sm:text-[64px] font-semibold tracking-[-0.04em] leading-none text-[var(--ui-text-primary)]">
              <CountUp value={s.value} />
            </div>
            <div className="mt-2.5 sm:mt-3 text-[15px] font-medium text-[var(--ui-text-secondary)]">{s.label}</div>
            <div className="mt-1 text-[12.5px] text-[var(--ui-text-muted)]">{s.detail}</div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';
type FormIntent = 'assemble' | 'access' | 'contact';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONTACT_TOPICS = [
  'General inquiry',
  'Product & architecture question',
  'Partnership or enterprise pilot',
  'Press & media',
];

const STAGE_OPTIONS = [
  ...LIFECYCLE_STAGES.map((s) => ({
    id: s.id,
    step: s.step,
    label: s.title,
  })),
  {
    id: 'full-lifecycle',
    step: '01–05 · End-to-End',
    label: 'Full Lifecycle Assembly',
  },
];

const AccessSection: React.FC<{
  interest: string[];
  setInterest: React.Dispatch<React.SetStateAction<string[]>>;
  stages: string[];
  setStages: React.Dispatch<React.SetStateAction<string[]>>;
  intent: FormIntent;
  setIntent: React.Dispatch<React.SetStateAction<FormIntent>>;
  endpoint?: string;
  contactEmail: string;
  standalone?: boolean;
}> = ({
  interest,
  setInterest,
  stages,
  setStages,
  intent,
  setIntent,
  endpoint = '/api/waitlist',
  contactEmail,
  standalone = false,
}) => {
  const [topic, setTopic] = useState<string>(CONTACT_TOPICS[0]);
  const [engagement, setEngagement] = useState<string>(ENGAGEMENT_MODELS[0].id);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [deliveryMode, setDeliveryMode] = useState<'api' | 'mailto'>('api');
  const [error, setError] = useState<string | null>(null);

  const toggleProduct = (id: string) =>
    setInterest((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const toggleStage = (id: string) =>
    setStages((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const triggerMailtoFallback = (
    payload: {
      name: string;
      company: string;
      email: string;
      message: string;
      topic?: string;
      engagement?: string;
      stages?: string[];
      intent: FormIntent;
    },
    summaryItems: string[]
  ) => {
    const subject =
      payload.intent === 'contact'
        ? `[Appembly Contact] ${payload.topic || 'General inquiry'} — ${payload.company || payload.name || payload.email}`
        : payload.intent === 'assemble'
          ? `[Appembly Assembly Brief] ${payload.company || payload.name || payload.email} — ${payload.engagement || 'Project'}`
          : `Access request — ${summaryItems.length ? summaryItems.map((n) => n.split(' (')[0]).join(', ') : 'Appembly'}`;
    const body = [
      `Name: ${payload.name || '-'}`,
      `Company: ${payload.company || '-'}`,
      `Email: ${payload.email}`,
      payload.intent === 'contact'
        ? `Topic: ${payload.topic || 'General inquiry'}`
        : payload.intent === 'assemble'
          ? `Engagement: ${payload.engagement || '-'}\nLifecycle stages: ${summaryItems.join(', ') || 'End-to-End Lifecycle'}`
          : `Interested in: ${summaryItems.join(', ') || '-'}`,
      '',
      payload.message,
    ].join('\n');
    setDeliveryMode('mailto');
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setState('success');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (honeypot) {
      setDeliveryMode('api');
      setState('success');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid work email.');
      return;
    }
    if (intent === 'contact' && !message.trim()) {
      setError('Please include a short message so we know how to help.');
      return;
    }
    const selectedEngagement = ENGAGEMENT_MODELS.find((m) => m.id === engagement)?.label || 'Managed Assembly';
    const selectedStages = stages.length ? stages : ['full-lifecycle'];
    const stageLabels = STAGE_OPTIONS.filter((s) => selectedStages.includes(s.id)).map(
      (s) => `${s.step} (${s.label})`
    );
    const products =
      intent === 'access'
        ? interest
        : intent === 'assemble'
          ? selectedStages.map((s) => `stage:${s}`)
          : [];
    const summaryItems =
      intent === 'assemble'
        ? stageLabels
        : PRODUCT_SUITE.filter((p) => products.includes(p.id)).map(
            (p) => `${p.name} (${p.status === 'beta' ? 'private beta' : 'waitlist'})`
          );

    const payload = {
      intent,
      topic:
        intent === 'contact'
          ? topic
          : intent === 'assemble'
            ? `Assembly · ${selectedEngagement}`
            : undefined,
      engagement: intent === 'assemble' ? selectedEngagement : undefined,
      stages: intent === 'assemble' ? selectedStages : undefined,
      email: email.trim(),
      name: name.trim(),
      company: company.trim(),
      products,
      message: message.trim(),
      website: honeypot,
      source: typeof window !== 'undefined' ? window.location.hostname || 'appembly.com' : 'appembly.com',
      submittedAt: new Date().toISOString(),
    };

    if (endpoint) {
      setState('submitting');
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setDeliveryMode('api');
          setState('success');
          return;
        }
        // If running on local static dev server (404/405) or unconfigured binding (503),
        // seamlessly hand off to mailto: so no request is ever lost.
        if (res.status === 404 || res.status === 405 || res.status === 503) {
          triggerMailtoFallback(payload, summaryItems);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch {
        // Network error or static preview without Functions runtime: fall back to mailto:
        triggerMailtoFallback(payload, summaryItems);
      }
      return;
    }

    triggerMailtoFallback(payload, summaryItems);
  };

  const inputCls =
    'w-full h-11 px-3.5 rounded-xl bg-[#111618] border border-[#263136] text-[14px] text-[#F6F7F5] placeholder:text-[#7C8380] focus:outline-none focus:border-[#4E8067] focus:ring-2 focus:ring-[#4E8067]/30 transition-colors';

  const isContact = intent === 'contact';
  const isAssemble = intent === 'assemble';

  return (
    <section id="access" className={`px-4 sm:px-6 ${standalone ? 'py-10 sm:py-16' : 'pb-24'} scroll-mt-24`}>
      <Reveal>
        <div className="relative max-w-[1320px] mx-auto rounded-[32px] bg-[#111618] text-[#F6F7F5] overflow-hidden px-6 sm:px-12 lg:px-16 py-14 sm:py-20">
          <ModularPatternBackdrop tone="dark" />
          <div
            className="pointer-events-none absolute -top-40 left-1/4 w-[800px] h-[500px] rounded-full blur-3xl opacity-50 ap-glow"
            style={{ background: 'radial-gradient(closest-side, rgba(78,128,103,0.55), transparent)' }}
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Copy + steps */}
            <div className="lg:col-span-5">
              <div className="w-12 h-12 rounded-2xl bg-[#4E8067] flex items-center justify-center shadow-[0_12px_40px_-8px_rgba(78,128,103,0.7)]">
                <AppemblyLogo variant="mark" size={28} strokeColor="#F6F7F5" animated />
              </div>
              {isContact ? (
                <>
                  <h2 className="mt-8 text-[36px] sm:text-[48px] font-semibold tracking-[-0.04em] leading-[1.04]">
                    Talk with the
                    <br />
                    <span className="text-[#72B091]">Appembly team.</span>
                  </h2>
                  <p className="mt-5 text-[16px] leading-[1.65] text-[#A9AFAB] max-w-[440px]">
                    Questions about our AI-native applications, autonomous agents, enterprise
                    pilots, or partnerships? Send us a note and we’ll reply directly.
                  </p>
                  <div className="mt-10 space-y-5 text-[14px]">
                    <div className="rounded-2xl border border-[#263136] bg-[#171E21]/60 p-4">
                      <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#72B091]">
                        Direct inquiries
                      </div>
                      <div className="mt-1 font-medium text-[#F6F7F5]">{contactEmail}</div>
                      <div className="mt-0.5 text-[12.5px] text-[#A9AFAB]">
                        Typical response within 1–2 business days
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#263136] bg-[#171E21]/60 p-4">
                      <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#72B091]">
                        Assemble or self-serve
                      </div>
                      <div className="mt-1 font-medium text-[#F6F7F5]">Studio builds &amp; private beta</div>
                      <div className="mt-0.5 text-[12.5px] text-[#A9AFAB]">
                        Use the tabs on the right to scope a client build or request product beta invites.
                      </div>
                    </div>
                  </div>
                </>
              ) : isAssemble ? (
                <>
                  <h2 className="mt-8 text-[36px] sm:text-[48px] font-semibold tracking-[-0.04em] leading-[1.04]">
                    Assemble your AI
                    <br />
                    <span className="text-[#72B091]">apps &amp; agents.</span>
                  </h2>
                  <p className="mt-5 text-[16px] leading-[1.65] text-[#A9AFAB] max-w-[440px]">
                    Partner with the Appembly studio and engineering team to take your AI-native
                    product or autonomous agent system from initial idea and validation to deployed,
                    self-healing, metered production.
                  </p>
                  <ol className="mt-10 space-y-6">
                    {ASSEMBLE_STEPS.map((s, i) => (
                      <li key={s.title} className="flex gap-4">
                        <span className="w-7 h-7 rounded-full border border-[#344248] text-[12px] font-semibold text-[#72B091] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div>
                          <div className="text-[15px] font-semibold">{s.title}</div>
                          <p className="mt-1 text-[13.5px] leading-relaxed text-[#A9AFAB]">{s.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <>
                  <h2 className="mt-8 text-[36px] sm:text-[48px] font-semibold tracking-[-0.04em] leading-[1.04]">
                    Start with one.
                    <br />
                    <span className="text-[#72B091]">Connect them all.</span>
                  </h2>
                  <p className="mt-5 text-[16px] leading-[1.65] text-[#A9AFAB] max-w-[440px]">
                    Appembly products are invitation-only while we onboard early engineering teams.
                    Request access to the private beta, or join the waitlist for what’s coming next.
                  </p>
                  <ol className="mt-10 space-y-6">
                    {ACCESS_STEPS.map((s, i) => (
                      <li key={s.title} className="flex gap-4">
                        <span className="w-7 h-7 rounded-full border border-[#344248] text-[12px] font-semibold text-[#72B091] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div>
                          <div className="text-[15px] font-semibold">{s.title}</div>
                          <p className="mt-1 text-[13.5px] leading-relaxed text-[#A9AFAB]">{s.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>

            {/* Form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-[#263136] bg-[#171E21]/80 backdrop-blur p-5 sm:p-8">
                {/* 3-Mode switcher: Assemble with us vs Product access vs Contact us */}
                <div className="grid grid-cols-3 sm:inline-flex p-1 rounded-xl bg-[#111618] border border-[#263136] mb-6 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIntent('assemble');
                      setState('idle');
                      setError(null);
                    }}
                    className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-[12.5px] sm:text-[13px] font-semibold transition-colors cursor-pointer text-center justify-center inline-flex items-center ${
                      isAssemble ? 'bg-[#4E8067] text-[#F6F7F5]' : 'text-[#A9AFAB] hover:text-[#F6F7F5]'
                    }`}
                  >
                    Assemble with us
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIntent('access');
                      setState('idle');
                      setError(null);
                    }}
                    className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-[12.5px] sm:text-[13px] font-semibold transition-colors cursor-pointer text-center justify-center inline-flex items-center ${
                      intent === 'access' ? 'bg-[#4E8067] text-[#F6F7F5]' : 'text-[#A9AFAB] hover:text-[#F6F7F5]'
                    }`}
                  >
                    Product access
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIntent('contact');
                      setState('idle');
                      setError(null);
                    }}
                    className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-[12.5px] sm:text-[13px] font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                      isContact ? 'bg-[#4E8067] text-[#F6F7F5]' : 'text-[#A9AFAB] hover:text-[#F6F7F5]'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 hidden sm:inline" />
                    Contact
                  </button>
                </div>

                {state === 'success' ? (
                  <div className="ap-enter py-10 text-center" role="status">
                    <div className="mx-auto w-14 h-14 rounded-full bg-[#4E8067]/20 text-[#72B091] flex items-center justify-center">
                      <Check className="w-7 h-7" />
                    </div>
                    <div className="mt-6 text-[22px] font-semibold tracking-tight">
                      {isContact
                        ? 'Message received.'
                        : isAssemble
                          ? 'Assembly brief received.'
                          : 'You’re on the list.'}
                    </div>
                    <p className="mt-2 text-[14.5px] text-[#A9AFAB] max-w-[380px] mx-auto">
                      {deliveryMode === 'api'
                        ? isContact
                          ? 'Thanks for reaching out — our team will reply to your email shortly.'
                          : isAssemble
                            ? 'Thanks — our engineering and studio team will review your project scope and reach out directly.'
                            : 'Thanks — we’ll be in touch as soon as a seat opens for you.'
                        : 'Your email app should have opened with your details. Send it and we’ll be in touch.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setState('idle')}
                      className="mt-6 text-[13px] font-semibold text-[#72B091] hover:text-[#F6F7F5] cursor-pointer"
                    >
                      {isContact
                        ? 'Send another message'
                        : isAssemble
                          ? 'Submit another brief'
                          : 'Submit another request'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={onSubmit} noValidate className="space-y-6">
                    {isContact ? (
                      <fieldset>
                        <legend className="text-[13px] font-semibold text-[#C5CAC7]">Topic</legend>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {CONTACT_TOPICS.map((t) => {
                            const active = topic === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setTopic(t)}
                                className={`text-left flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
                                  active ? 'border-[#4E8067] bg-[#4E8067]/12 text-[#F6F7F5]' : 'border-[#263136] text-[#A9AFAB] hover:border-[#344248]'
                                }`}
                              >
                                <span
                                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                    active ? 'border-[#4E8067] bg-[#4E8067]' : 'border-[#344248]'
                                  }`}
                                >
                                  {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </span>
                                <span className="text-[13.5px] font-medium">{t}</span>
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    ) : isAssemble ? (
                      <div className="space-y-5">
                        <fieldset>
                          <legend className="text-[13px] font-semibold text-[#C5CAC7]">
                            Which lifecycle stages do you want to assemble?
                          </legend>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {STAGE_OPTIONS.map((s) => {
                              const checked = stages.includes(s.id);
                              return (
                                <label
                                  key={s.id}
                                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
                                    checked ? 'border-[#4E8067] bg-[#4E8067]/12' : 'border-[#263136] hover:border-[#344248]'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={checked}
                                    onChange={() => toggleStage(s.id)}
                                  />
                                  <span
                                    className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${
                                      checked ? 'bg-[#4E8067] border-[#4E8067]' : 'border-[#344248]'
                                    }`}
                                  >
                                    {checked && <Check className="w-3 h-3 text-white" />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[13.5px] font-medium text-[#F6F7F5] truncate">{s.label}</div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#72B091]">
                                      {s.step}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>

                        <fieldset>
                          <legend className="text-[13px] font-semibold text-[#C5CAC7]">
                            How would you like to work together?
                          </legend>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {ENGAGEMENT_MODELS.map((m) => {
                              const active = engagement === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setEngagement(m.id)}
                                  className={`text-left rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
                                    active
                                      ? 'border-[#4E8067] bg-[#4E8067]/12 text-[#F6F7F5]'
                                      : 'border-[#263136] text-[#A9AFAB] hover:border-[#344248]'
                                  }`}
                                >
                                  <div className="text-[13px] font-semibold text-[#F6F7F5]">{m.label}</div>
                                  <div className="mt-0.5 text-[11.5px] leading-snug text-[#A9AFAB]">{m.detail}</div>
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      </div>
                    ) : (
                      <fieldset>
                        <legend className="text-[13px] font-semibold text-[#C5CAC7]">What are you interested in?</legend>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {PRODUCT_SUITE.map((p) => {
                            const checked = interest.includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
                                  checked ? 'border-[#4E8067] bg-[#4E8067]/12' : 'border-[#263136] hover:border-[#344248]'
                                }`}
                              >
                                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleProduct(p.id)} />
                                <span
                                  className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${
                                    checked ? 'bg-[#4E8067] border-[#4E8067]' : 'border-[#344248]'
                                  }`}
                                >
                                  {checked && <Check className="w-3 h-3 text-white" />}
                                </span>
                                <span className="text-[14px] font-medium flex-1">{p.name}</span>
                                <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${p.status === 'beta' ? 'text-[#72B091]' : 'text-[#7C8380]'}`}>
                                  {p.status === 'beta' ? 'Beta' : 'Waitlist'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block sm:col-span-2">
                        <span className="text-[13px] font-semibold text-[#C5CAC7]">
                          Work email <span className="text-[#72B091]">*</span>
                        </span>
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          className={`${inputCls} mt-2`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[13px] font-semibold text-[#C5CAC7]">Name</span>
                        <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" className={`${inputCls} mt-2`} />
                      </label>
                      <label className="block">
                        <span className="text-[13px] font-semibold text-[#C5CAC7]">Company</span>
                        <input type="text" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company" className={`${inputCls} mt-2`} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-[13px] font-semibold text-[#C5CAC7]">
                          {isContact ? (
                            <>
                              Message <span className="text-[#72B091]">*</span>
                            </>
                          ) : isAssemble ? (
                            'What AI-native app or agent system are you looking to assemble?'
                          ) : (
                            'What would you use it for?'
                          )}
                        </span>
                        <textarea
                          rows={3}
                          required={isContact}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={
                            isContact
                              ? 'How can we help your team?'
                              : isAssemble
                                ? 'Share a few lines about your idea, workflow, target users, or timeline…'
                                : 'A sentence or two about your team and use case (optional)'
                          }
                          className={`${inputCls} mt-2 h-auto py-3 resize-none`}
                        />
                      </label>
                      {/* Honeypot: hidden from people, tempting for bots */}
                      <label className="hidden" aria-hidden="true">
                        Website
                        <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                      </label>
                    </div>

                    {error && (
                      <p className="text-[13px] text-[#F59E8B]" role="alert">
                        {error}
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                      <p className="text-[12px] leading-relaxed text-[#7C8380] max-w-[340px]">
                        We’ll only use your details to reply to your inquiry. No newsletters, no sharing.
                      </p>
                      <button
                        type="submit"
                        disabled={state === 'submitting'}
                        className="group inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-[14.5px] font-semibold bg-[#F6F7F5] text-[#111618] hover:bg-white disabled:opacity-60 transition-colors cursor-pointer shrink-0"
                      >
                        {state === 'submitting' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                          </>
                        ) : (
                          <>
                            {isContact
                              ? 'Send message'
                              : isAssemble
                                ? 'Start assembly conversation'
                                : 'Request access'}
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
};

function getContactPortalUrl(mode: FormIntent = 'contact'): string {
  const query =
    mode === 'assemble' ? '?mode=assemble' : mode === 'access' ? '?mode=access' : '?mode=contact';
  if (typeof window === 'undefined') {
    return `https://contact.appembly.com/${query}`;
  }
  const host = window.location.hostname;
  if (host === 'appembly.com' || host === 'www.appembly.com') {
    return `https://contact.appembly.com/${query}`;
  }
  return `/contact${query}`;
}

function getMainSiteUrl(): string {
  if (typeof window === 'undefined') return 'https://www.appembly.com';
  const host = window.location.hostname;
  if (host.endsWith('.appembly.com') || host === 'appembly.com') return 'https://www.appembly.com';
  return '/';
}

const Footer: React.FC<{
  contactEmail: string;
  onRequestAccess: RequestAccess;
  onOpenContactPortal: (mode: FormIntent) => void;
}> = ({ onRequestAccess, onOpenContactPortal }) => (
  <footer className="border-t border-[var(--ui-border)]">
    <div className="max-w-[1320px] mx-auto px-6 sm:px-10 py-16 grid grid-cols-2 md:grid-cols-12 gap-10">
      <div className="col-span-2 md:col-span-5 space-y-4">
        <AppemblyLogo variant="lockup" size={30} productName="Appembly" animated />
        <p className="text-[14px] text-[var(--ui-text-secondary)] max-w-[340px] leading-relaxed">
          Assembling AI-native apps and agents. Adopt our modular software directly — or partner with
          our studio to validate, build, deploy, and scale your system end to end.
        </p>
      </div>
      <div className="md:col-span-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Products</div>
        <ul className="mt-4 space-y-2.5">
          {PRODUCT_SUITE.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onRequestAccess(p.id, undefined, 'access')}
                className="inline-flex items-center gap-2 text-[14px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] transition-colors cursor-pointer"
              >
                {p.name}
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${p.status === 'beta' ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)]'}`}>
                  {p.status === 'beta' ? 'Beta' : 'Soon'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="md:col-span-2">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Platform</div>
        <ul className="mt-4 space-y-2.5">
          <li>
            <a href="#lifecycle" className="text-[14px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] transition-colors">
              5-Stage Lifecycle
            </a>
          </li>
          {FOUNDATION.map((f) => (
            <li key={f.id}>
              <a href="#platform" className="text-[14px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] transition-colors">
                {f.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="md:col-span-2">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Get Started</div>
        <ul className="mt-4 space-y-2.5">
          <li>
            <a
              href={getContactPortalUrl('assemble')}
              onClick={(e) => {
                if (typeof window !== 'undefined' && !window.location.hostname.endsWith('appembly.com')) {
                  e.preventDefault();
                  onOpenContactPortal('assemble');
                }
              }}
              className="text-[14px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] transition-colors"
            >
              Assemble with us
            </a>
          </li>
          <li>
            <a
              href={getContactPortalUrl('access')}
              onClick={(e) => {
                if (typeof window !== 'undefined' && !window.location.hostname.endsWith('appembly.com')) {
                  e.preventDefault();
                  onOpenContactPortal('access');
                }
              }}
              className="text-[14px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] transition-colors"
            >
              Product beta access
            </a>
          </li>
          <li>
            <a
              href={getContactPortalUrl('contact')}
              onClick={(e) => {
                if (typeof window !== 'undefined' && !window.location.hostname.endsWith('appembly.com')) {
                  e.preventDefault();
                  onOpenContactPortal('contact');
                }
              }}
              className="inline-flex items-center gap-1.5 text-[14px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> Contact
            </a>
          </li>
        </ul>
      </div>
    </div>
    <div className="border-t border-[var(--ui-border)]">
      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12.5px] text-[var(--ui-text-muted)]">
        <span>© {new Date().getFullYear()} Appembly. All rights reserved.</span>
        <span>Products shown are in private beta or in development.</span>
      </div>
    </div>
  </footer>
);

const ContactPortalHeader: React.FC<{ onBackToMain?: () => void }> = ({ onBackToMain }) => {
  const { theme, toggleTheme } = useAppemblyTheme();
  const mainUrl = getMainSiteUrl();
  return (
    <header className="border-b border-[var(--ui-border)] bg-[var(--ui-bg-surface)]/80 backdrop-blur">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-10 h-16 flex items-center justify-between gap-2">
        <a
          href={mainUrl}
          onClick={(e) => {
            if (onBackToMain && mainUrl === '/') {
              e.preventDefault();
              onBackToMain();
            }
          }}
          className="inline-flex items-center gap-2.5 min-w-0"
        >
          <span className="sm:hidden">
            <AppemblyLogo variant="lockup" size={26} productName="Appembly" />
          </span>
          <span className="hidden sm:inline-flex">
            <AppemblyLogo variant="lockup" size={28} productName="Appembly" tagline="Contact & Access" />
          </span>
        </a>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="w-9 h-9 rounded-xl border border-[var(--ui-border)] flex items-center justify-center text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <a
            href={mainUrl}
            onClick={(e) => {
              if (onBackToMain && mainUrl === '/') {
                e.preventDefault();
                onBackToMain();
              }
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-3.5 rounded-xl border border-[var(--ui-border-strong)] text-[12.5px] sm:text-[13px] font-semibold text-[var(--ui-text-primary)] hover:border-[var(--ui-text-primary)] transition-colors"
          >
            ← Back<span className="hidden sm:inline"> to appembly.com</span>
          </a>
        </div>
      </div>
    </header>
  );
};

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

function parseModeParam(raw: string | null): FormIntent {
  if (raw === 'assemble') return 'assemble';
  if (raw === 'access') return 'access';
  return 'contact';
}

export const AppemblyLandingPage: React.FC<AppemblyLandingPageProps> = ({
  accessRequestEndpoint,
  contactEmail = DEFAULT_CONTACT_EMAIL,
}) => {
  const [interest, setInterest] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>(['full-lifecycle']);
  const [formIntent, setFormIntent] = useState<FormIntent>('assemble');
  const [portalView, setPortalView] = useState<{ active: boolean; intent: FormIntent }>(() => {
    if (typeof window === 'undefined') return { active: false, intent: 'contact' };
    const host = window.location.hostname;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const modeParam = parseModeParam(params.get('mode'));
    if (host.startsWith('contact.') || path === '/contact' || path === '/contact/') {
      return { active: true, intent: modeParam };
    }
    return { active: false, intent: 'assemble' };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const host = window.location.hostname;
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const modeParam = parseModeParam(params.get('mode'));
      setPortalView({
        active: host.startsWith('contact.') || path === '/contact' || path === '/contact/',
        intent: modeParam,
      });
      setFormIntent(modeParam);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openContactPortal = useCallback((mode: FormIntent) => {
    if (typeof window !== 'undefined') {
      const nextPath =
        mode === 'assemble' ? '/contact?mode=assemble' : mode === 'access' ? '/contact?mode=access' : '/contact';
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setFormIntent(mode);
    setPortalView({ active: true, intent: mode });
  }, []);

  const closeContactPortal = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setPortalView({ active: false, intent: 'assemble' });
  }, []);

  /** Pre-selects a product or lifecycle stage (if given), sets the form intent, and scrolls to `#access`. */
  const requestAccess = useCallback<RequestAccess>((productId, stageId, nextIntent) => {
    if (productId) {
      setInterest((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
    }
    if (stageId) {
      setStages((prev) => (prev.includes(stageId) ? prev : [...prev, stageId]));
    }
    if (nextIntent) {
      setFormIntent(nextIntent);
    } else if (productId && !stageId) {
      setFormIntent('access');
    } else if (stageId) {
      setFormIntent('assemble');
    }
    const target = document.getElementById('access');
    if (target) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }, []);

  // Dedicated `contact.appembly.com` (or `/contact`) portal — renders ONLY the Contact & Access view
  if (portalView.active) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--ui-bg-canvas)] text-[var(--ui-text-primary)] antialiased transition-colors duration-300 selection:bg-[#4E8067] selection:text-[#F6F7F5] overflow-x-clip">
        <ContactPortalHeader onBackToMain={closeContactPortal} />
        <main className="flex-1 flex flex-col justify-center">
          <AccessSection
            interest={interest}
            setInterest={setInterest}
            stages={stages}
            setStages={setStages}
            intent={formIntent}
            setIntent={setFormIntent}
            endpoint={accessRequestEndpoint}
            contactEmail={contactEmail}
            standalone
          />
        </main>
        <footer className="border-t border-[var(--ui-border)]">
          <div className="max-w-[1320px] mx-auto px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12.5px] text-[var(--ui-text-muted)]">
            <span>© {new Date().getFullYear()} Appembly · Contact &amp; Early Access Portal</span>
            <span>Direct email: {contactEmail}</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ui-bg-canvas)] text-[var(--ui-text-primary)] antialiased transition-colors duration-300 selection:bg-[#4E8067] selection:text-[#F6F7F5] overflow-x-clip">
      <Header onRequestAccess={requestAccess} />
      <main>
        <Hero onRequestAccess={requestAccess} />
        <ProductMarquee />
        <LifecyclePipeline onRequestAccess={requestAccess} />
        <Showcase onRequestAccess={requestAccess} />
        <ProductGrid onRequestAccess={requestAccess} />
        <Platform />
        <Availability />
        <AccessSection
          interest={interest}
          setInterest={setInterest}
          stages={stages}
          setStages={setStages}
          intent={formIntent}
          setIntent={setFormIntent}
          endpoint={accessRequestEndpoint}
          contactEmail={contactEmail}
        />
      </main>
      <Footer
        contactEmail={contactEmail}
        onRequestAccess={requestAccess}
        onOpenContactPortal={openContactPortal}
      />
    </div>
  );
};
