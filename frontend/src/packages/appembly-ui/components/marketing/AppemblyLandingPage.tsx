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
import { CyclodeIcon } from '../brand/CyclodeIcon';
import { MeterboxIcon } from '../brand/MeterboxIcon';
import { SauthenIcon } from '../brand/SauthenIcon';
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
const SHOT_CYCLODE = '/showcase/cyclode-workstation.png';
const SHOT_METERBOX = '/showcase/meterbox-control-plane.png?v=2';
const SHOT_SAUTHEN = '/showcase/sauthen-trust-graph.png?v=2';
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
    icon: <CyclodeIcon monochrome className="w-[24px] h-[24px]" />,
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
    icon: <MeterboxIcon className="w-[22px] h-[22px]" />,
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
    icon: <SauthenIcon className="w-[22px] h-[22px]" />,
  },
  {
    id: 'valiscale',
    name: 'Valiscale',
    status: 'soon',
    categoryLabel: 'Product & Venture Studio',
    tagline: 'From raw concept to validated project and launch.',
    description:
      'Assess market viability, generate structured PRDs, and track a product from idea to growth.',
    capabilities: [],
    accentColor: '#4E8067',
    icon: <Rocket className="w-[18px] h-[18px]" />,
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
    icon: <CyclodeIcon compact monochrome className="w-[18px] h-[18px]" />,
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
    icon: <MeterboxIcon compact className="w-[18px] h-[18px]" />,
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
    icon: <SauthenIcon className="w-[18px] h-[18px]" />,
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

const NAV_LINKS = [
  { href: '#showcase', label: 'Showcase' },
  { href: '#products', label: 'Products' },
  { href: '#platform', label: 'Platform' },
  { href: '#access', label: 'Access' },
];

/* -------------------------------------------------------------------------- */
/*                                Motion hooks                                */
/* -------------------------------------------------------------------------- */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Fires once when the element first scrolls into view. */
function useInView<T extends Element>(threshold = 0.18, rootMargin = '0px 0px -8% 0px') {
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
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, value]);

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
    className={`rounded-[18px] overflow-hidden border bg-[var(--ui-bg-surface)] border-[var(--ui-border)] shadow-[0_40px_120px_-30px_rgba(17,22,24,0.45),0_12px_32px_-12px_rgba(17,22,24,0.25)] ${className}`}
  >
    <div className="h-9 flex items-center gap-3 px-4 border-b border-[var(--ui-border)] bg-[var(--ui-bg-subtle)]">
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]/80" />
      </div>
      <div className="mx-auto max-w-[260px] w-full h-5 rounded-md text-[10.5px] font-medium flex items-center justify-center gap-1.5 truncate px-2 bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)]">
        <Lock className="w-2.5 h-2.5 shrink-0" />
        {label}
      </div>
      <div className="w-[42px]" />
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
        <span style={{ '--ap-delay': `${startDelay + i * 80}ms` } as React.CSSProperties}>
          {word}
        </span>
        {'\u00A0'}
      </span>
    ))}
  </>
);

type RequestAccess = (productId?: string) => void;

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
            onClick={() => onRequestAccess()}
            className="hidden sm:inline-flex group items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold bg-[var(--ui-text-primary)] text-[var(--ui-bg-canvas)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Request access
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
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onRequestAccess();
            }}
            className="w-full mt-1 px-4 py-3 rounded-xl text-[15px] font-semibold bg-[var(--ui-accent)] text-[#F6F7F5] cursor-pointer"
          >
            Request access
          </button>
        </div>
      )}
    </header>
  );
};

const Hero: React.FC<{ onRequestAccess: RequestAccess }> = ({ onRequestAccess }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Scroll-linked tilt: the product stage starts slightly reclined and settles flat as you scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
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
    <section id="top" className="relative overflow-hidden pt-36 sm:pt-44 pb-8">
      <ModularPatternBackdrop tone="light" />
      <div
        className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] rounded-full opacity-60 blur-3xl ap-glow"
        style={{
          background:
            'radial-gradient(closest-side, rgba(78,128,103,0.28), rgba(78,128,103,0.08) 60%, transparent)',
        }}
      />

      <div className="relative max-w-[1320px] mx-auto px-6 sm:px-10">
        <div className="max-w-[920px] mx-auto text-center">
          <a
            href="#access"
            className="ap-enter group inline-flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 rounded-full border border-[var(--ui-border)] bg-[var(--ui-bg-surface)]/70 backdrop-blur text-[12.5px] font-medium text-[var(--ui-text-secondary)] hover:border-[var(--ui-accent)]/50 transition-colors"
            style={{ '--ap-delay': '0ms' } as React.CSSProperties}
          >
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--ui-accent)]/12 text-[var(--ui-accent)] font-semibold">
              <span className="ap-pulse w-1.5 h-1.5 rounded-full bg-current" />
              Private beta
            </span>
            <span>
              Cyclode, Meterbox &amp; Sauthen<span className="hidden sm:inline"> are onboarding early teams</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>

          <h1 className="mt-8 text-[44px] sm:text-[64px] lg:text-[84px] font-semibold tracking-[-0.045em] leading-[0.98] text-[var(--ui-text-primary)]">
            <HeadlineWords text="Assembling AI-native" startDelay={120} />
            <br />
            <HeadlineWords text="apps and agents." startDelay={360} className="text-[var(--ui-accent)]" />
          </h1>

          <p
            className="ap-enter mt-7 text-[17px] sm:text-[19px] leading-[1.6] text-[var(--ui-text-secondary)] max-w-[640px] mx-auto"
            style={{ '--ap-delay': '700ms' } as React.CSSProperties}
          >
            Appembly builds modular applications and autonomous agents designed to work powerfully
            on their own — and effortlessly together across engineering, FinOps, research and
            commerce.
          </p>

          <div
            className="ap-enter mt-10 flex flex-wrap items-center justify-center gap-3"
            style={{ '--ap-delay': '850ms' } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={() => onRequestAccess()}
              className="group inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[14.5px] font-semibold bg-[var(--ui-accent)] text-[#F6F7F5] hover:bg-[var(--appembly-sage-hover)] shadow-[0_8px_24px_-8px_rgba(78,128,103,0.6)] transition-all cursor-pointer"
            >
              Request early access
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href="#products"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[14.5px] font-semibold border border-[var(--ui-border-strong)] bg-[var(--ui-bg-surface)]/70 backdrop-blur text-[var(--ui-text-primary)] hover:border-[var(--ui-text-primary)] transition-colors"
            >
              Explore the suite
            </a>
          </div>
        </div>

        {/* Product stage */}
        <div
          className="ap-enter-stage relative mt-20 sm:mt-24 mx-auto max-w-[1160px]"
          style={{ '--ap-delay': '1000ms', perspective: '2200px' } as React.CSSProperties}
        >
          <div ref={stageRef} className="relative" style={{ '--ap-tilt': 1 } as React.CSSProperties}>
            <div className="ap-stage-back hidden md:block absolute -right-6 lg:-right-16 -top-14 w-[58%] opacity-90">
              <ProductFrame label="Meterbox · Private beta" className="rotate-[2deg]">
                <ProductShot src={SHOT_METERBOX} alt="Meterbox FinOps control plane" eager />
              </ProductFrame>
            </div>

            <div className="ap-stage relative">
              <ProductFrame label="Cyclode · Private beta" className="relative">
                <ProductShot src={SHOT_CYCLODE} alt="Cyclode autonomous engineering workstation" eager />
              </ProductFrame>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 -bottom-2 h-12 sm:h-40 bg-gradient-to-t from-[var(--ui-bg-canvas)] to-transparent" />
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
            One ecosystem. Seven products.
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
    <section id="showcase" className="relative overflow-hidden py-28 lg:py-36 scroll-mt-20">
      <ModularPatternBackdrop tone="light" />
      <div className="relative max-w-[1320px] mx-auto px-6 sm:px-10">
        <Reveal className="max-w-[760px]">
          <SectionEyebrow>Now in private beta</SectionEyebrow>
          <h2 className="mt-5 text-[36px] sm:text-[52px] font-semibold tracking-[-0.035em] leading-[1.04] text-[var(--ui-text-primary)]">
            Real products, built for real work.
          </h2>
          <p className="mt-5 text-[17px] leading-[1.65] text-[var(--ui-text-secondary)] max-w-[620px]">
            Cyclode, Meterbox and Sauthen are running today with early teams. All three share the
            same calm interface, unified identity and live telemetry — so moving between them feels
            like one product.
          </p>
        </Reveal>

        <div className="ap-showcase mt-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <Reveal className="lg:col-span-4 space-y-3" delay={80}>
            <div role="tablist" aria-label="Products in private beta" className="space-y-3">
              {SHOWCASE.map((item, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-5 transition-all duration-500 relative overflow-hidden ${
                      isActive
                        ? 'bg-[var(--ui-bg-surface)] border-[var(--ui-border-strong)] shadow-[0_12px_40px_-20px_rgba(17,22,24,0.35)]'
                        : 'bg-transparent border-transparent hover:bg-[var(--ui-bg-surface)]/60'
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
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: item.accent }}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-[var(--ui-text-primary)]">{item.name}</div>
                        <div className="text-[12.5px] text-[var(--ui-text-muted)]">{item.kicker}</div>
                      </div>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-700 ${
                        isActive ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                      aria-hidden={!isActive}
                    >
                      <div className="overflow-hidden">
                        <div className="pt-5 space-y-4">
                          <div className="text-[19px] font-semibold tracking-[-0.02em] leading-snug text-[var(--ui-text-primary)]">
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
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            {item.highlights.map((h) => (
                              <div key={h.title} className="rounded-xl bg-[var(--ui-bg-subtle)] px-3.5 py-3">
                                <div className="text-[15px] font-semibold tracking-tight text-[var(--ui-text-primary)]">
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
                            Request access to {item.name}
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

          <Reveal className="lg:col-span-8" delay={160}>
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-10 rounded-[40px] blur-3xl opacity-40 transition-colors duration-1000"
                style={{ background: `radial-gradient(closest-side, ${active.accent}55, transparent)` }}
              />
              <ProductFrame label={`${active.name} · Private beta`} className="relative">
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
  <section id="products" className="relative overflow-hidden py-28 lg:py-36 bg-[var(--ui-bg-subtle)]/50 border-y border-[var(--ui-border)] scroll-mt-20">
    <ModularPatternBackdrop tone="light" />
    <div className="relative max-w-[1320px] mx-auto px-6 sm:px-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <Reveal className="max-w-[720px]">
          <SectionEyebrow>The product suite</SectionEyebrow>
          <h2 className="mt-5 text-[36px] sm:text-[52px] font-semibold tracking-[-0.035em] leading-[1.04] text-[var(--ui-text-primary)]">
            Powerful alone.
            <br />
            <span className="text-[var(--ui-text-muted)]">Effortless together.</span>
          </h2>
        </Reveal>
        <Reveal delay={100} className="max-w-[420px]">
          <p className="text-[16px] leading-[1.65] text-[var(--ui-text-secondary)]">
            Start with one app to solve an immediate workflow. As the suite grows, research,
            validation, engineering and commerce will share context automatically.
          </p>
        </Reveal>
      </div>

      {/* Private beta */}
      <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {BETA_PRODUCTS.map((product, idx) => (
          <Reveal key={product.id} delay={idx * 90}>
            <article
              onMouseMove={handleSpotlightMove}
              className="ap-spotlight ap-lift group h-full rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] p-8 flex flex-col hover:border-[var(--ui-border-strong)] hover:shadow-[0_24px_60px_-28px_rgba(17,22,24,0.35)]"
              style={{ '--ap-spot': `${product.accentColor}22` } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                  style={{ backgroundColor: product.accentColor }}
                >
                  {product.icon}
                </span>
                <StatusBadge status={product.status} />
              </div>
              <div className="mt-7">
                <div className="text-[12px] font-medium" style={{ color: product.accentColor }}>
                  {product.categoryLabel}
                </div>
                <h3 className="mt-1.5 text-[26px] font-semibold tracking-[-0.02em] text-[var(--ui-text-primary)]">
                  {product.name}
                </h3>
                <p className="mt-2 text-[16px] font-medium leading-snug text-[var(--ui-text-primary)]/85">{product.tagline}</p>
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
              <div className="mt-auto pt-8">
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
      <Reveal className="mt-20 flex items-center gap-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-muted)] whitespace-nowrap">
          Coming soon
        </h3>
        <span className="h-px flex-1 bg-[var(--ui-border)]" />
      </Reveal>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {SOON_PRODUCTS.map((product, idx) => (
          <Reveal key={product.id} delay={idx * 80}>
            <article className="ap-lift group h-full rounded-3xl border border-dashed border-[var(--ui-border-strong)] bg-[var(--ui-bg-surface)]/60 p-6 flex flex-col hover:bg-[var(--ui-bg-surface)]">
              <div className="flex items-center justify-between">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${product.accentColor}1F`, color: product.accentColor }}
                >
                  {product.icon}
                </span>
                <StatusBadge status={product.status} />
              </div>
              <div className="mt-6 text-[12px] font-medium" style={{ color: product.accentColor }}>
                {product.categoryLabel}
              </div>
              <h4 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-[var(--ui-text-primary)]">{product.name}</h4>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ui-text-secondary)]">{product.tagline}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ui-text-muted)]">{product.description}</p>
              <button
                type="button"
                onClick={() => onRequestAccess(product.id)}
                className="mt-auto pt-6 self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ui-text-primary)] hover:text-[var(--ui-accent)] transition-colors cursor-pointer"
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

/** Animated hub diagram: Appembly core → shared foundation → six products (beta products animate). */
const PlatformDiagram: React.FC = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  const cx = 320;
  const cy = 240;
  const outerProducts = PRODUCT_SUITE.filter((p) => !FOUNDATION.some((f) => f.id === p.id));
  const products = outerProducts.map((p, i) => {
    const angle = (-90 + i * (360 / outerProducts.length)) * (Math.PI / 180);
    return { ...p, x: cx + Math.cos(angle) * 236, y: cy + Math.sin(angle) * 178 };
  });
  // Foundation nodes sit at 0°/180° — symmetrically between the product flow lines (every 60° from -90°).
  const foundation = FOUNDATION.map((f, i) => {
    const angle = (i * (360 / FOUNDATION.length)) * (Math.PI / 180);
    return { ...f, x: cx + Math.cos(angle) * 108, y: cy + Math.sin(angle) * 92 };
  });

  return (
    <div ref={ref} className={inView ? 'is-visible' : ''}>
      <svg viewBox="0 0 640 480" className="w-full h-auto" role="img" aria-label="Appembly platform architecture: a shared core and foundation connecting six products">
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
  <section id="platform" className="relative py-28 lg:py-36 bg-[#111618] text-[#F6F7F5] overflow-hidden scroll-mt-20">
    <ModularPatternBackdrop tone="dark" />
    <div
      className="pointer-events-none absolute -bottom-40 -left-40 w-[700px] h-[700px] rounded-full blur-3xl opacity-40 ap-glow"
      style={{ background: 'radial-gradient(closest-side, rgba(78,128,103,0.45), transparent)' }}
    />

    <div className="relative max-w-[1320px] mx-auto px-6 sm:px-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
        <div className="lg:col-span-5">
          <Reveal>
            <SectionEyebrow tone="dark">The connected platform</SectionEyebrow>
            <h2 className="mt-5 text-[36px] sm:text-[52px] font-semibold tracking-[-0.035em] leading-[1.04]">
              One foundation.
              <br />
              <span className="text-[#72B091]">Every product.</span>
            </h2>
            <p className="mt-6 text-[17px] leading-[1.65] text-[#A9AFAB] max-w-[480px]">
              Most suites are stitched together after the fact. Every Appembly app is built from
              day one on shared layers — so identity, intelligence and experience never fragment.
            </p>
          </Reveal>

          <div className="mt-10 space-y-3">
            {FOUNDATION.map((f, i) => (
              <Reveal key={f.id} delay={120 + i * 100}>
                <div
                  onMouseMove={handleSpotlightMove}
                  className="ap-spotlight flex items-start gap-4 rounded-2xl border border-[#263136] bg-[#171E21]/70 p-5 hover:border-[#4E8067]/60 transition-colors"
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
          <Reveal delay={150}>
            <PlatformDiagram />
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

const Availability: React.FC = () => (
  <section className="py-24 lg:py-28">
    <div className="max-w-[1320px] mx-auto px-6 sm:px-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-12">
        {AVAILABILITY.map((s, i) => (
          <Reveal key={s.label} delay={i * 90} className={`px-6 ${i > 0 ? 'sm:border-l border-[var(--ui-border)]' : ''}`}>
            <div className="text-[56px] sm:text-[64px] font-semibold tracking-[-0.04em] leading-none text-[var(--ui-text-primary)]">
              <CountUp value={s.value} />
            </div>
            <div className="mt-3 text-[15px] font-medium text-[var(--ui-text-secondary)]">{s.label}</div>
            <div className="mt-1 text-[12.5px] text-[var(--ui-text-muted)]">{s.detail}</div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';
type FormIntent = 'access' | 'contact';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONTACT_TOPICS = [
  'General inquiry',
  'Product & architecture question',
  'Partnership or enterprise pilot',
  'Press & media',
];

const AccessSection: React.FC<{
  interest: string[];
  setInterest: React.Dispatch<React.SetStateAction<string[]>>;
  endpoint?: string;
  contactEmail: string;
  defaultIntent?: FormIntent;
  standalone?: boolean;
}> = ({
  interest,
  setInterest,
  endpoint = '/api/waitlist',
  contactEmail,
  defaultIntent = 'access',
  standalone = false,
}) => {
  const [intent, setIntent] = useState<FormIntent>(defaultIntent);
  const [topic, setTopic] = useState<string>(CONTACT_TOPICS[0]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [deliveryMode, setDeliveryMode] = useState<'api' | 'mailto'>('api');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIntent(defaultIntent);
  }, [defaultIntent]);

  const toggle = (id: string) =>
    setInterest((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const triggerMailtoFallback = (
    payload: { name: string; company: string; email: string; message: string; topic?: string; intent: FormIntent },
    productNames: string[]
  ) => {
    const subject =
      payload.intent === 'contact'
        ? `[Appembly Contact] ${payload.topic || 'General inquiry'} — ${payload.company || payload.name || payload.email}`
        : `Access request — ${productNames.length ? productNames.map((n) => n.split(' (')[0]).join(', ') : 'Appembly'}`;
    const body = [
      `Name: ${payload.name || '-'}`,
      `Company: ${payload.company || '-'}`,
      `Email: ${payload.email}`,
      payload.intent === 'contact'
        ? `Topic: ${payload.topic || 'General inquiry'}`
        : `Interested in: ${productNames.join(', ') || '-'}`,
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
    const products = intent === 'access' && interest.length ? interest : [];
    const productNames = PRODUCT_SUITE.filter((p) => products.includes(p.id)).map(
      (p) => `${p.name} (${p.status === 'beta' ? 'private beta' : 'waitlist'})`
    );
    const payload = {
      intent,
      topic: intent === 'contact' ? topic : undefined,
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
          triggerMailtoFallback(payload, productNames);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch {
        // Network error or static preview without Functions runtime: fall back to mailto:
        triggerMailtoFallback(payload, productNames);
      }
      return;
    }

    triggerMailtoFallback(payload, productNames);
  };

  const inputCls =
    'w-full h-11 px-3.5 rounded-xl bg-[#111618] border border-[#263136] text-[14px] text-[#F6F7F5] placeholder:text-[#7C8380] focus:outline-none focus:border-[#4E8067] focus:ring-2 focus:ring-[#4E8067]/30 transition-colors';

  const isContact = intent === 'contact';

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
                        Private beta cohorts
                      </div>
                      <div className="mt-1 font-medium text-[#F6F7F5]">Cyclode, Meterbox &amp; Sauthen</div>
                      <div className="mt-0.5 text-[12.5px] text-[#A9AFAB]">
                        Need early product access? Switch to the Request Access tab on the right.
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-8 text-[36px] sm:text-[48px] font-semibold tracking-[-0.04em] leading-[1.04]">
                    Start with one.
                    <br />
                    <span className="text-[#72B091]">Connect them all.</span>
                  </h2>
                  <p className="mt-5 text-[16px] leading-[1.65] text-[#A9AFAB] max-w-[440px]">
                    Appembly products are invitation-only while we onboard early teams. Request access
                    to the private beta, or join the waitlist for what’s coming next.
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
              <div className="rounded-3xl border border-[#263136] bg-[#171E21]/80 backdrop-blur p-6 sm:p-8">
                {/* Mode switcher: Request access vs Contact us */}
                <div className="inline-flex p-1 rounded-xl bg-[#111618] border border-[#263136] mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIntent('access');
                      setState('idle');
                      setError(null);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
                      !isContact ? 'bg-[#4E8067] text-[#F6F7F5]' : 'text-[#A9AFAB] hover:text-[#F6F7F5]'
                    }`}
                  >
                    Request access
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIntent('contact');
                      setState('idle');
                      setError(null);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                      isContact ? 'bg-[#4E8067] text-[#F6F7F5]' : 'text-[#A9AFAB] hover:text-[#F6F7F5]'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Contact us
                  </button>
                </div>

                {state === 'success' ? (
                  <div className="ap-enter py-10 text-center" role="status">
                    <div className="mx-auto w-14 h-14 rounded-full bg-[#4E8067]/20 text-[#72B091] flex items-center justify-center">
                      <Check className="w-7 h-7" />
                    </div>
                    <div className="mt-6 text-[22px] font-semibold tracking-tight">
                      {isContact ? 'Message received.' : 'You’re on the list.'}
                    </div>
                    <p className="mt-2 text-[14.5px] text-[#A9AFAB] max-w-[380px] mx-auto">
                      {deliveryMode === 'api'
                        ? isContact
                          ? 'Thanks for reaching out — our team will reply to your email shortly.'
                          : 'Thanks — we’ll be in touch as soon as a seat opens for you.'
                        : 'Your email app should have opened with your message. Send it and we’ll be in touch.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setState('idle')}
                      className="mt-6 text-[13px] font-semibold text-[#72B091] hover:text-[#F6F7F5] cursor-pointer"
                    >
                      {isContact ? 'Send another message' : 'Submit another request'}
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
                                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(p.id)} />
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
                            {isContact ? 'Send message' : 'Request access'}
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
  const query = mode === 'access' ? '?mode=access' : '?mode=contact';
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
        <p className="text-[14px] text-[var(--ui-text-secondary)] max-w-[320px] leading-relaxed">
          Assembling AI-native apps and agents. Modular software and autonomous systems, built into
          one calm ecosystem.
        </p>
      </div>
      <div className="md:col-span-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Products</div>
        <ul className="mt-4 space-y-2.5">
          {PRODUCT_SUITE.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onRequestAccess(p.id)}
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
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Company</div>
        <ul className="mt-4 space-y-2.5">
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
              Request access
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
      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
        <a
          href={mainUrl}
          onClick={(e) => {
            if (onBackToMain && mainUrl === '/') {
              e.preventDefault();
              onBackToMain();
            }
          }}
          className="inline-flex items-center gap-2.5"
        >
          <AppemblyLogo variant="lockup" size={28} productName="Appembly" tagline="Contact & Access" />
        </a>
        <div className="flex items-center gap-2.5">
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
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-[var(--ui-border-strong)] text-[13px] font-semibold text-[var(--ui-text-primary)] hover:border-[var(--ui-text-primary)] transition-colors"
          >
            ← Back to appembly.com
          </a>
        </div>
      </div>
    </header>
  );
};

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export const AppemblyLandingPage: React.FC<AppemblyLandingPageProps> = ({
  accessRequestEndpoint,
  contactEmail = DEFAULT_CONTACT_EMAIL,
}) => {
  const [interest, setInterest] = useState<string[]>([]);
  const [portalView, setPortalView] = useState<{ active: boolean; intent: FormIntent }>(() => {
    if (typeof window === 'undefined') return { active: false, intent: 'contact' };
    const host = window.location.hostname;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') === 'access' ? 'access' : 'contact';
    if (host.startsWith('contact.') || path === '/contact' || path === '/contact/') {
      return { active: true, intent: modeParam };
    }
    return { active: false, intent: 'access' };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const host = window.location.hostname;
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const modeParam: FormIntent = params.get('mode') === 'access' ? 'access' : 'contact';
      setPortalView({
        active: host.startsWith('contact.') || path === '/contact' || path === '/contact/',
        intent: modeParam,
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openContactPortal = useCallback((mode: FormIntent) => {
    if (typeof window !== 'undefined') {
      const nextPath = mode === 'access' ? '/contact?mode=access' : '/contact';
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setPortalView({ active: true, intent: mode });
  }, []);

  const closeContactPortal = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setPortalView({ active: false, intent: 'access' });
  }, []);

  /** Pre-selects a product (if given) and scrolls to the access form. */
  const requestAccess = useCallback<RequestAccess>((productId) => {
    if (productId) {
      setInterest((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
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
            endpoint={accessRequestEndpoint}
            contactEmail={contactEmail}
            defaultIntent={portalView.intent}
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
        <Showcase onRequestAccess={requestAccess} />
        <ProductGrid onRequestAccess={requestAccess} />
        <Platform />
        <Availability />
        <AccessSection
          interest={interest}
          setInterest={setInterest}
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
