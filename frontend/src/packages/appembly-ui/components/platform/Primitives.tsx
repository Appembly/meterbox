import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEME_PRESETS, BYOK_PROVIDERS, getByokProviderMeta, MODEL_GROUPS, ALL_MODELS, PERSONAS } from './catalog';
import { LiveDot, type LiveDotTone, useOverlayFocusTrap } from '../primitives';
import { usePresence, useCountUp } from '../../motion';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return Math.round(n).toLocaleString('en-US');
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

export function formatCurrency(
  amount: number,
  currencyOrDecimals: string | number = 'USD',
  decimalsOverride?: number
): string {
  const val = Number(amount) || 0;
  const currency =
    typeof currencyOrDecimals === 'string' && /^[A-Za-z]{3}$/.test(currencyOrDecimals)
      ? currencyOrDecimals.toUpperCase()
      : 'USD';
  const decimals =
    typeof currencyOrDecimals === 'number'
      ? currencyOrDecimals
      : typeof decimalsOverride === 'number'
        ? decimalsOverride
        : Number.isInteger(val)
          ? 0
          : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatPercent(val: number): string {
  const num = Number(val) || 0;
  const pct = Math.abs(num) > 0 && Math.abs(num) <= 1 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}

export function relativeTime(iso?: string): string {
  if (!iso) return 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function effectiveStatus(status: string, expiresAt?: string, now = Date.now()): string {
  if (status === 'active' && expiresAt && new Date(expiresAt).getTime() <= now) return 'expired';
  return status;
}

export function slugifyOrg(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'acme-labs';
}

export function getModelOption(modelId: string) {
  for (const g of MODEL_GROUPS) {
    for (const item of g.items) {
      if (item.id === modelId) return { ...item, provider: g.provider, group: g.group };
    }
  }
  return { id: modelId, label: modelId, sub: 'Dynamic Routing', provider: 'auto', group: 'Adaptive Orchestration' };
}

export function getPersonaOption(personaId: string) {
  return PERSONAS.find((p) => p.id === personaId) || PERSONAS[0];
}

export function resolveEffectiveTheme(mode: string): 'light' | 'dark' {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
}

function hexToRgbTriplet(hex: string): string {
  const clean = (hex || '#4E8067').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r} ${g} ${b}`;
}

function hexToRgba(hex: string, alpha: number) {
  const clean = (hex || '#22543B').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface GroundedSource {
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
}

export interface ValidationIncumbent {
  name: string;
  url?: string;
  summary?: string;
  wedgeGap: string;
}

export interface ValidationDimensionScore {
  label: string;
  score: number;
  rationale: string;
}

export interface ValidationScorecard {
  conceptTitle: string;
  overallScore: number;
  recommendation: string;
  readyForPromotion?: boolean;
  dimensions: Record<string, ValidationDimensionScore>;
  incumbents?: ValidationIncumbent[];
  keyRisks: string[];
  citations?: GroundedSource[];
  evaluatedAt?: string;
}

export type ProjectTaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type ProjectTaskPriority = 'high' | 'medium' | 'low';

export interface ProjectPhase {
  id: string;
  title: string;
  order: number;
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  phaseId: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assigneePersona?: string;
  estimate?: string;
  dependsOn?: string[];
  touchpoints?: string[];
  verificationCriteria?: string[];
  updatedAt?: string;
}

export interface ProjectPlan {
  id: string;
  title: string;
  summary?: string;
  repo: string;
  branch?: string;
  phases: ProjectPhase[];
  tasks: ProjectTask[];
  createdAt?: string;
  updatedAt?: string;
}

function hexToRgbComma(hex: string): string {
  const clean = (hex || '#4E8067').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

function shadeHex(hex: string, factor: number): string {
  const clean = (hex || '#4F73FF').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const adjust = (channel: number) => {
    const next = factor < 0 ? channel * (1 + factor) : channel + (255 - channel) * factor;
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
}

export function syncAppemblyFavicon(
  fillHex = '#4F73FF',
  options?: { badgeHex?: string; themeMode?: 'light' | 'dark'; stemHex?: string }
) {
  if (typeof document === 'undefined') return;
  const stemFill = options?.stemHex || (options?.themeMode === 'dark' ? '#F1F5F9' : '#0F1E59');
  const triFill = fillHex || '#4F73FF';
  const ringStroke = options?.themeMode === 'dark' ? '#282C34' : '#FAFAFA';
  const badgeCircle = options?.badgeHex
    ? `<circle cx="80" cy="22" r="11" fill="${options.badgeHex}" stroke="${ringStroke}" stroke-width="3.5" />`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 14 80 72" fill="none"><path d="M 17.4 25.2 L 30.8 25.2 Q 36.2 25.2 39.2 30.6 L 56.4 61.2 Q 59.3 66.5 56.1 71.8 L 50.2 79.8 L 17.4 25.2 Z" fill="${stemFill}"/><path d="M 82.6 25.2 L 54.6 25.2 Q 48.2 25.2 51.3 31.0 L 61.5 49.5 Q 64.8 55.3 68.2 49.5 L 82.6 25.2 Z" fill="${triFill}"/>${badgeCircle}</svg>`;
  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  const iconLinks = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
  if (iconLinks.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = dataUri;
    document.head.appendChild(link);
  } else {
    iconLinks.forEach((link) => {
      link.type = 'image/svg+xml';
      link.href = dataUri;
    });
  }

  let metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = triFill;
}

export function normalizeValiscaleAccentId(accentId?: string): string {
  if (!accentId) return 'valiscale-cobalt';
  if (accentId === 'trust-violet') return 'valiscale-cobalt';
  if (accentId === 'deep-forest' || accentId === 'emerald-sage') return 'calm-sage';
  return accentId;
}

export function applyValiscaleTheme(
  themeMode: string,
  accentId: string,
  customAccentHex: string,
  options?: { badgeHex?: string }
) {
  if (typeof document === 'undefined') return;
  const eff = resolveEffectiveTheme(themeMode);
  document.documentElement.setAttribute('data-theme', eff);
  if (eff === 'dark') {
    document.documentElement.classList.add('dark-theme', 'dark');
    document.documentElement.classList.remove('light-theme');
    document.documentElement.style.colorScheme = 'dark';
    document.documentElement.style.backgroundColor = '#0F1416';
  } else {
    document.documentElement.classList.add('light-theme');
    document.documentElement.classList.remove('dark-theme', 'dark');
    document.documentElement.style.colorScheme = 'light';
    document.documentElement.style.backgroundColor = '#FAFAF9';
  }

  const normalizedId = normalizeValiscaleAccentId(accentId);

  const preset =
    THEME_PRESETS.find((t) => t.id === normalizedId || t.hex.toLowerCase() === (normalizedId || '').toLowerCase()) ||
    THEME_PRESETS[0];
  const isCustom = normalizedId === 'custom' && /^#[0-9A-Fa-f]{6}$/.test(customAccentHex || '');
  const isCobaltPreset = !isCustom && preset?.id === 'valiscale-cobalt';
  const accentColor = isCustom ? customAccentHex : preset?.hex || '#0F1E59';
  const midColor = isCustom ? customAccentHex : preset?.mid || '#4F73FF';
  const effectiveAccent = eff === 'dark' ? midColor : (isCobaltPreset ? '#4F73FF' : accentColor);
  const btnColor = isCobaltPreset ? '#4F73FF' : (eff === 'dark' ? midColor : accentColor);
  const hoverColor = shadeHex(btnColor, eff === 'dark' ? 0.14 : -0.14);
  const stemColor = eff === 'dark' ? '#F1F5F9' : (isCobaltPreset ? '#0F1E59' : shadeHex(accentColor, -0.38));

  const root = document.documentElement;
  root.style.setProperty('--ui-accent-btn', btnColor);
  root.style.setProperty('--appembly-sage-deep', accentColor);
  root.style.setProperty('--appembly-sage-hover', hoverColor);
  root.style.setProperty('--ui-accent-deep', effectiveAccent);
  root.style.setProperty('--ui-accent', midColor);
  root.style.setProperty('--ui-accent-rgb', hexToRgbComma(midColor));
  root.style.setProperty(
    '--ui-accent-soft',
    hexToRgba(midColor, eff === 'dark' ? 0.22 : 0.12)
  );
  root.style.setProperty('--vls-mark-stem', stemColor);
  root.style.setProperty('--vls-mark-accent', midColor);
  root.style.setProperty('--primary', effectiveAccent);
  root.style.setProperty('--accent', hexToRgbTriplet(effectiveAccent));
  root.style.setProperty('--accent-2', hexToRgbTriplet(accentColor));
  root.style.setProperty('--appembly-sage', midColor);
  root.style.setProperty(
    '--appembly-sage-soft',
    hexToRgba(midColor, eff === 'dark' ? 0.24 : 0.12)
  );
  root.style.setProperty('--color-accent', midColor);
  root.style.setProperty('--color-accent-rgb', hexToRgbComma(midColor));

  const faviconFill = midColor;
  syncAppemblyFavicon(faviconFill, {
    badgeHex: options?.badgeHex,
    themeMode: eff,
    stemHex: stemColor,
  });
}

export const applyDashboardTheme = applyValiscaleTheme;

export const TtlRing: React.FC<{
  rem?: number;
  total?: number;
  label?: string;
  createdAt?: string;
  expiresAt?: string;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}> = ({ rem, total = 15, label, createdAt, expiresAt, size = 36, stroke = 3, showLabel = true }) => {
  const now = useNow(1000);
  let pct = 0.75;
  let displayLabel = label || `${rem ?? 12}m`;
  let isDanger = false;
  let isWarn = false;

  if (expiresAt) {
    const start = createdAt ? new Date(createdAt).getTime() : now - 900_000;
    const end = new Date(expiresAt).getTime();
    const span = Math.max(1, end - start);
    const remMs = Math.max(0, end - now);
    pct = Math.min(1, Math.max(0.05, remMs / span));
    const sec = Math.floor(remMs / 1000);
    isDanger = sec <= 120;
    isWarn = sec <= 300;
    displayLabel = sec <= 0 ? 'exp' : sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h`;
  } else {
    const rVal = rem ?? 12;
    pct = Math.max(0.08, Math.min(1, rVal / total));
    isDanger = rVal <= 4;
    isWarn = rVal <= 7;
  }

  const radius = (size - stroke) / 2;
  const c = (2 * Math.PI * radius).toFixed(1);
  const off = (Number(c) * (1 - pct)).toFixed(1);
  const strokeColor = isDanger ? 'var(--ui-stepup)' : isWarn ? 'var(--ui-warn)' : 'var(--ui-accent)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ui-bg-subtle)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      {showLabel && (
        <span className="mono" style={{ position: 'absolute', fontSize: Math.max(12, size * 0.25), fontWeight: 600, color: 'var(--ui-text-primary)' }}>
          {displayLabel}
        </span>
      )}
    </div>
  );
};

export const TokenChip: React.FC<{ token?: string; value?: string; max?: number }> = ({ token, value, max = 26 }) => {
  const s = String(value || token || 'st_agt_901a');
  const m = s.match(/^(st_[a-z]+_|sk-[a-z]+-|ak_|mb_[a-z]+_|ghs_)(.+)$/);
  const pre = m ? m[1].replace(/_$/, '') : s.slice(0, 6);
  const rawRest = m ? '_' + m[2] : s.slice(6);
  const rest = rawRest.length > max ? `${rawRest.slice(0, max)}…` : rawRest;
  return (
    <span className="token-chip">
      <span className="token-chip-prefix">{pre}</span>
      <span className="token-chip-rest">{rest}</span>
    </span>
  );
};


export const SparklineSvg: React.FC<{ points?: number[]; color?: string }> = ({
  points = [18, 22, 19, 26, 24, 30, 28, 35],
  color = 'var(--ui-accent)',
}) => {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const w = 78;
  const h = 22;
  const coords = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', flexShrink: 0 }}>
      <polyline fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={coords} />
    </svg>
  );
};

export const StackedAreaSvg: React.FC<{ height?: number }> = ({ height = 205 }) => {
  const w = 680;
  const h = height;
  const pts1 = [180, 165, 170, 145, 138, 120, 112, 95, 88, 72, 68, 52];
  const pts2 = [195, 188, 190, 175, 170, 160, 155, 145, 142, 134, 130, 122];
  const step = w / (pts1.length - 1);
  const line1 = pts1.map((y, i) => `${(i * step).toFixed(1)},${y}`).join(' ');
  const area1 = `M 0,${h} L ` + pts1.map((y, i) => `${(i * step).toFixed(1)},${y}`).join(' L ') + ` L ${w},${h} Z`;
  const line2 = pts2.map((y, i) => `${(i * step).toFixed(1)},${y}`).join(' ');
  const area2 = `M 0,${h} L ` + pts2.map((y, i) => `${(i * step).toFixed(1)},${y}`).join(' L ') + ` L ${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: `${h}px`, display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="sageGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ui-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--ui-accent)" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0284C7" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <line x1="0" y1="45" x2={w} y2="45" stroke="var(--ui-border)" strokeDasharray="3 3" />
      <line x1="0" y1="105" x2={w} y2="105" stroke="var(--ui-border)" strokeDasharray="3 3" />
      <line x1="0" y1="165" x2={w} y2="165" stroke="var(--ui-border)" strokeDasharray="3 3" />
      <path d={area1} fill="url(#sageGrad)" />
      <polyline fill="none" stroke="var(--ui-accent)" strokeWidth="2.2" points={line1} />
      <path d={area2} fill="url(#blueGrad)" />
      <polyline fill="none" stroke="#0284C7" strokeWidth="1.8" points={line2} />
    </svg>
  );
};

export interface HorizTabItem {
  id: string;
  label: string;
  count?: number | string;
  alert?: boolean;
}

export const HorizTabs: React.FC<{
  tabs: HorizTabItem[];
  activeTab: string;
  onSelect: (id: string) => void;
}> = ({ tabs, activeTab, onSelect }) => {
  const current = activeTab || tabs[0]?.id;
  return (
    <div className="horiz-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          className={`horiz-tab ${current === t.id ? 'active' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          <span>{t.label}</span>
          {t.count !== undefined && (
            <span className={`tab-count ${t.alert ? 'tab-count-alert' : ''}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
};

export const ThemePickerPopover: React.FC<{
  themeMode: string;
  accentId: string;
  customAccentHex: string;
  onChangeMode: (mode: string) => void;
  onChangeAccent: (id: string) => void;
  onChangeCustomHex: (hex: string) => void;
  placement?: 'down' | 'up';
  compact?: boolean;
}> = ({
  themeMode,
  accentId,
  customAccentHex,
  onChangeMode,
  onChangeAccent,
  onChangeCustomHex,
  placement = 'down',
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const { mounted, state } = usePresence(open, 120);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const normalizedAccentId = normalizeValiscaleAccentId(accentId);
  const activePreset = THEME_PRESETS.find((t) => t.id === normalizedAccentId) || THEME_PRESETS[0];
  const isCustom = accentId === 'custom';
  const swatchColor = isCustom ? customAccentHex : activePreset.swatch;
  const effMode = resolveEffectiveTheme(themeMode);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="theme-popover-wrap">
      <button
        type="button"
        className="ui-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        title="Appearance & Official Brand Accent Palette (Light / Dark / 5 Swatches)"
        style={compact ? { width: 34, height: 32, padding: 0 } : { height: 32, padding: '0 10px', gap: 6 }}
      >
        {effMode === 'dark' ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2.5v2M12 19.5v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2.5 12h2M19.5 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: swatchColor,
            border: '1px solid rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}
        />
        {!compact && (
          <>
            <span style={{ fontSize: 12.5 }}>{effMode === 'dark' ? 'Dark' : 'Light'}</span>
            <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>▾</span>
          </>
        )}
      </button>

      {mounted && (
        <div
          className={cx('theme-popover', placement === 'up' && 'sidebar-up')}
          data-state={state}
          role="dialog"
          aria-label="Theme settings"
          style={{ zIndex: 999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="label-caps" style={{ fontSize: 12, marginBottom: 6 }}>
            Appearance Mode
          </div>
          <div className="theme-mode-seg">
            <button
              type="button"
              className={`theme-mode-btn ${themeMode === 'light' ? 'active' : ''}`}
              onClick={() => onChangeMode('light')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2.5v2M12 19.5v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2.5 12h2M19.5 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
              <span>Light</span>
            </button>
            <button
              type="button"
              className={`theme-mode-btn ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => onChangeMode('dark')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark</span>
            </button>
            <button
              type="button"
              className={`theme-mode-btn ${themeMode === 'system' ? 'active' : ''}`}
              onClick={() => onChangeMode('system')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
                <path d="M8 20.5h8M12 16.5v4" />
              </svg>
              <span>Auto</span>
            </button>
          </div>

          <div
            className="label-caps"
            style={{
              fontSize: 12,
              margin: '13px 0 7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Brand Accent</span>
            <span className="mono" style={{ fontSize: 12, textTransform: 'none', color: 'var(--ui-text-secondary)' }}>
              {isCustom ? customAccentHex.toUpperCase() : activePreset.label}
            </span>
          </div>

          <div className="theme-swatch-grid">
            {THEME_PRESETS.map((t) => {
              const active = normalizedAccentId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-swatch-btn ${active ? 'active' : ''}`}
                  onClick={() => onChangeAccent(t.id)}
                  title={`${t.label} (${t.swatch})`}
                >
                  <span
                    className={`theme-swatch-circle ${active ? 'active' : ''}`}
                    style={{ background: t.swatch, color: '#FFF' }}
                  >
                    {active && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: active ? 600 : 450,
                      color: active ? 'var(--ui-text-primary)' : 'var(--ui-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 48,
                    }}
                  >
                    {t.shortLabel || t.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 11,
              paddingTop: 10,
              borderTop: '1px solid var(--ui-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <label
              title="Pick a custom hex accent color"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '3px 7px 3px 4px',
                borderRadius: 999,
                border: isCustom ? '1px solid var(--ui-border-strong)' : '1px solid transparent',
                background: isCustom ? 'var(--ui-bg-subtle)' : 'transparent',
                transition: 'background 0.14s ease, border-color 0.14s ease',
              }}
            >
              <span
                style={{
                  position: 'relative',
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: swatchColor,
                  border: '1px solid rgba(0,0,0,0.22)',
                  boxShadow: isCustom ? '0 0 0 2px var(--ui-bg-surface), 0 0 0 3.5px var(--ui-accent-deep)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={swatchColor}
                  onChange={(e) => onChangeCustomHex(e.target.value)}
                  style={{
                    position: 'absolute',
                    inset: -4,
                    width: 26,
                    height: 26,
                    opacity: 0,
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0,
                  }}
                />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ui-text-secondary)' }}>Custom</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                {swatchColor.toUpperCase()}
              </span>
            </label>
            <button
              type="button"
              className="sb-recents-clear"
              onClick={() => {
                onChangeMode('light');
                onChangeCustomHex('#4E8067');
                onChangeAccent('calm-sage');
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AppBlueprintCard: React.FC<{
  app: any;
  jevDecision?: any;
  onSaveApp?: () => void;
  onRunLifecycleStage?: (prompt: string) => void;
}> = ({ app, jevDecision, onSaveApp, onRunLifecycleStage }) => {
  const [lifecycleTab, setLifecycleTab] = useState<'blueprint' | 'market' | 'ux' | 'handoff'>('blueprint');
  const isScoping = app.assembled === false;
  const completenessPct =
    typeof jevDecision?.completeness_score_pct === 'number'
      ? jevDecision.completeness_score_pct
      : isScoping
      ? 25
      : 85;
  const completenessBand = jevDecision?.completeness_band || (isScoping ? '0-25' : '75-99');
  const modelDisplay =
    app.resolvedModel ||
    (app.model && !ALL_MODELS.some((m) => m.id === app.model) ? app.model : getModelOption(app.model).label);

  const cleanRepo = String(app.repo || 'acme-corp/new-app').replace(/^@/, '');
  const branchSlug = `feat/${cleanRepo.split('/').pop() || 'blueprint-mvp'}`;
  const targetSegment = app.targetUsers || 'B2B Platforms & Teams';
  const copingMethod = app.painPoint || 'Manual spreadsheets & fragmented portals';
  const handoffPrompt = [
    `[Appembly Blueprint Handoff] Scaffold & implement "${app.name}" in @${cleanRepo} (branch: ${branchSlug}).`,
    `• Product Summary & Wedge: ${app.desc} (Target Segment: ${targetSegment}; Replaces: ${copingMethod})`,
    `• Pillar 1 — Sauthen Identity & RBAC: ${app.auth} (15m RFC 8693 scoped session & agent tokens)`,
    `• Pillar 2 — Harnway AI Gateway & DLP: Primary route ${modelDisplay} with Egress DLP active`,
    `• Pillar 3 — Meterbox Plans & Quotas: ${app.mrr} (Target Margin: ${app.margin || '78–82%'})`,
    `• Execution Plan: Scaffold Next.js 15 + FastAPI + PostgreSQL 16 structure, wire Sauthen auth & Meterbox usage events, and run verification tests.`,
  ].join('\n');

  const cyclodeUrl =
    `http://localhost:6013/?handoff=1&autostart=1` +
    `&repo=${encodeURIComponent(cleanRepo)}` +
    `&branch=${encodeURIComponent(branchSlug)}` +
    `&persona=SoftwareEngineer` +
    `&model=${encodeURIComponent(modelDisplay)}` +
    `&title=${encodeURIComponent(`Scaffold ${app.name}`)}` +
    `&prompt=${encodeURIComponent(handoffPrompt)}`;

  const stages = [
    { id: 'market' as const, step: '1', label: 'Market & Gatharoom', sub: 'Valiscale · Demand' },
    { id: 'ux' as const, step: '2', label: 'UX & Feasibility', sub: 'Flows · Stack' },
    { id: 'blueprint' as const, step: '3', label: '4-Pillar Blueprint', sub: 'Auth · AI · Billing' },
    { id: 'handoff' as const, step: '4', label: 'Cyclode & Launch', sub: 'Worktree · Deploy' },
  ];

  return (
    <div className="ui-card ui-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="label-caps" style={{ color: 'var(--ui-accent-deep)' }}>
              {isScoping ? 'Venture & App Blueprint · Scoping' : 'Assembled Venture & App Blueprint'}
            </span>
            <span className={`badge ${isScoping ? 'badge-warn' : 'badge-sage'}`}>
              {isScoping ? 'Stage 1 · Idea & Defaults' : app.env || 'Blueprint Ready'}
            </span>
          </div>
          <div className="h3-title" style={{ fontSize: 15.5, marginTop: 2 }}>
            {app.name}
          </div>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--ui-accent-deep)', marginTop: 1 }}>
            {app.url ? `https://${app.url} · ` : ''}@{cleanRepo}
          </div>
        </div>
        {!isScoping && onSaveApp && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="ui-btn ui-btn-xs ui-btn-primary" onClick={onSaveApp}>
              ✓ Save &amp; Launch App
            </button>
          </div>
        )}
      </div>

      {/* 4-Stage Venture & Product Lifecycle Stepper */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 6,
          padding: 4,
          borderRadius: 10,
          background: 'var(--ui-bg-subtle)',
          border: '1px solid var(--ui-border)',
        }}
      >
        {stages.map((st) => {
          const active = lifecycleTab === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setLifecycleTab(st.id)}
              style={{
                padding: '7px 8px',
                borderRadius: 7,
                border: active ? '1px solid var(--ui-accent)' : '1px solid transparent',
                background: active ? 'var(--ui-bg-surface)' : 'transparent',
                boxShadow: active ? 'var(--ui-shadow-xs)' : 'none',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  className="mono"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    background: active ? 'var(--ui-accent)' : 'var(--ui-border)',
                    color: active ? '#FFF' : 'var(--ui-text-secondary)',
                  }}
                >
                  {st.step}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ui-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {st.label}
                </span>
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 2, paddingLeft: 21 }}>
                {st.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Jev Completeness Progress Bar */}
      <div
        style={{
          padding: '9px 12px',
          borderRadius: 8,
          background: 'var(--ui-bg-subtle)',
          border: '1px solid var(--ui-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
          <span style={{ fontWeight: 600 }}>Blueprint Completeness (System-One Jev)</span>
          <span className="mono" style={{ color: 'var(--ui-accent-deep)', fontWeight: 600 }}>
            {completenessPct}% · Band {completenessBand}
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: 'var(--ui-border)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.max(8, Math.min(100, completenessPct))}%`,
              background: 'var(--ui-accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        {isScoping && (
          <div style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)' }}>
            Confirm the decision card in chat to lock your Wedge &amp; 4-Pillar Blueprint.
          </div>
        )}
      </div>

      {/* TAB 1: MARKET RESEARCH, COMPETITIVE ANALYSIS & GATHAROOM VALIDATION */}
      {lifecycleTab === 'market' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="grid-2" style={{ gap: 10 }}>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
              <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                Target ICP &amp; Wedge (Valiscale)
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{targetSegment}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                Coping today: <strong>{copingMethod}</strong>
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
              <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                Gatharoom Focus Group Signal
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                {app.demandSignal || 'Demand Signal: 8.1 / 10 (Validated)'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                Synthetic + Live ICP poll on willingness-to-pay &amp; switching friction
              </div>
            </div>
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                Valiscale Validation Dimensions &amp; Competitive Landscape
              </span>
              <span className="badge badge-sage mono" style={{ fontSize: 12 }}>PROMOTE_TO_PROJECT</span>
            </div>
            <div className="grid-2" style={{ gap: 8, fontSize: 12.5 }}>
              <div>• <strong>Problem Urgency:</strong> High (manual reconciliation / workflow bottleneck)</div>
              <div>• <strong>Competitive Wedge:</strong> Purpose-built vertical automation vs. horizontal legacy tools</div>
              <div>• <strong>Willingness to Pay:</strong> {app.mrr}</div>
              <div>• <strong>Top Falsifiable Risk:</strong> Onboarding data integration &amp; trust verification</div>
            </div>
          </div>

          {onRunLifecycleStage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ui-btn ui-btn-xs ui-btn-primary"
                onClick={() =>
                  onRunLifecycleStage(
                    `Run deep Valiscale market research and competitive analysis for "${app.name}" targeting ${targetSegment}. Compare incumbent pricing, identify our unfair wedge, and emit a Valiscale validation scorecard.`
                  )
                }
              >
                🔍 Run Deep Market &amp; Competitor Research
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-xs"
                onClick={() =>
                  onRunLifecycleStage(
                    `Launch a Gatharoom focus group validation session for "${app.name}" with target buyers (${targetSegment} currently using ${copingMethod}). Test their top objections, willingness to pay (${app.mrr}), and synthesize a focus group verdict.`
                  )
                }
              >
                🎙️ Simulate Gatharoom Focus Group
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UX DESIGN & TECHNICAL FEASIBILITY */}
      {lifecycleTab === 'ux' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
            <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)', marginBottom: 6 }}>
              Core UX Journey &amp; Screen Architecture (Appembly Calm UI)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
              <div><strong>Screen 1 · Zero-Friction Onboarding:</strong> Passkey / OIDC sign-in + 1-click source connector setup</div>
              <div><strong>Screen 2 · Primary Command Workspace:</strong> High-legibility split view for {targetSegment} core workflow</div>
              <div><strong>Screen 3 · Governed AI Copilot &amp; Review:</strong> Streaming Harnway (`{modelDisplay}`) synthesis with human-in-the-loop approval</div>
              <div><strong>Screen 4 · Usage &amp; Plan Console:</strong> Embedded Meterbox quota gauge &amp; self-serve plan upgrade</div>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 10 }}>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
              <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                Technical Stack &amp; Data Schema
              </div>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>
                Next.js 15 · FastAPI · Postgres 16
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                Multi-tenant row-level isolation + ClickHouse event telemetry
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
              <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                Feasibility &amp; Compliance
              </div>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>
                Feasibility: High (Ready to Scaffold)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                Harnway Egress DLP + Sauthen AES-256 Vault for third-party credentials
              </div>
            </div>
          </div>

          {onRunLifecycleStage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ui-btn ui-btn-xs ui-btn-primary"
                onClick={() =>
                  onRunLifecycleStage(
                    `Design the UX screen flows, PostgreSQL data model entities, and technical feasibility architecture for "${app.name}" (@${cleanRepo}) serving ${targetSegment}.`
                  )
                }
              >
                🎨 Generate Detailed UX Flows &amp; Data Schema
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 4-PILLAR INFRASTRUCTURE BLUEPRINT */}
      {lifecycleTab === 'blueprint' && (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', lineHeight: 1.45, margin: 0 }}>{app.desc}</p>

          <div className="grid-2" style={{ gap: 10 }}>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
              <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                1. Identity &amp; Access (20%)
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{app.auth}</div>
              <div className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                Scoped 15m RFC 8693 session &amp; agent tokens
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
              <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                2. AI Gateway &amp; BYOK Route (30%)
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                {modelDisplay}
              </div>
              <div className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                Egress DLP active · Multi-provider failover
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
              <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                3. Customer Plans &amp; Quotas (20%)
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                {app.mrr}
              </div>
              <div className="mono" style={{ fontSize: 12.5, color: 'var(--ui-accent-deep)', marginTop: 2 }}>
                {app.margin && app.margin !== '—' ? `Target Gross Margin: ${app.margin}` : 'Awaiting pricing selection'}
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
              <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                4. Target Repository &amp; Handoff
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                @{cleanRepo}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>{app.handoff}</div>
            </div>
          </div>
        </>
      )}

      {/* TAB 4: CYCLODE IMPLEMENTATION WAVES & ADAPPTY LAUNCH */}
      {lifecycleTab === 'handoff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
                Cyclode Worktree Execution Waves (`{branchSlug}`)
              </span>
              <span className="badge badge-sage mono" style={{ fontSize: 12 }}>graviton-c7g-2vcpu-4gb</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
              <div><strong>Wave 1 · Repo &amp; Sauthen Identity:</strong> Initialize `@{cleanRepo}`, PostgreSQL migrations, and Passkey/OIDC middleware</div>
              <div><strong>Wave 2 · Core Domain API &amp; Harnway:</strong> Implement core backend routes + `{modelDisplay}` gateway client with DLP</div>
              <div><strong>Wave 3 · Calm UI Frontend &amp; Meterbox:</strong> Build primary workspace views + OpenMeter usage event ingestion</div>
              <div><strong>Wave 4 · Verification &amp; Adappty Launch:</strong> Run unit/E2E test gate, open PR, and deploy to AWS Graviton (`arm64`)</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ paddingTop: 10, borderTop: '1px solid var(--ui-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)' }}>
          Target repo · @{cleanRepo} · `{branchSlug}`
        </span>
        <a href={cyclodeUrl} target="_blank" rel="noreferrer" className="ui-btn ui-btn-xs ui-btn-primary">
          Hand Off Blueprint to Cyclode IDE (:6013) ↗
        </a>
      </div>
    </div>
  );
};

export const AgentBlueprintCard: React.FC<{
  agent: any;
  interactive?: boolean;
  onToggleItem?: (category: string, item: string) => void;
  onOpenStudio?: () => void;
  onSaveAgent?: () => void;
}> = ({ agent, interactive = true, onToggleItem, onOpenStudio, onSaveAgent }) => {
  return (
    <div className="ui-card ui-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="label-caps" style={{ color: 'var(--ui-accent-deep)' }}>
              Assembled AI Agent Blueprint (8 Modular Parts)
            </span>
            <span className="badge badge-sage">{agent.env || 'Staging'}</span>
          </div>
          <div className="h3-title" style={{ fontSize: 15.5, marginTop: 2 }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 1 }}>
            Attached App: <strong style={{ color: 'var(--ui-text-primary)' }}>{agent.attachedApp || 'Standalone Workspace Agent'}</strong> · Repo: <span className="mono">@{agent.repo}</span>
          </div>
        </div>
        {interactive && (
          <div style={{ display: 'flex', gap: 6 }}>
            {onOpenStudio && (
              <button type="button" className="ui-btn ui-btn-xs" onClick={onOpenStudio}>
                Visual Studio
              </button>
            )}
            {onSaveAgent && (
              <button type="button" className="ui-btn ui-btn-xs ui-btn-primary" onClick={onSaveAgent}>
                Save &amp; Deploy Agent
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid-2" style={{ gap: 10 }}>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
          <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
            1. Persona &amp; Role
          </div>
          <div style={{ fontSize: 12, color: 'var(--ui-text-primary)', marginTop: 4, lineHeight: 1.45 }}>{agent.personaRole}</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
          <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)' }}>
            2. Model &amp; BYOK Route
          </div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
            Primary: {getModelOption(agent.model).label}
          </div>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
            Fallback: {agent.fallbackModel || 'gpt-5-2'} · Vault Sealed
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 10 }}>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
          <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)', marginBottom: 6 }}>
            3. Skills ({(agent.skills || []).length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(agent.skills || []).map((sk: string) => (
              <span
                key={sk}
                className="badge badge-sage"
                style={{ fontSize: 12, cursor: interactive ? 'pointer' : 'default' }}
                onClick={() => interactive && onToggleItem && onToggleItem('skills', sk)}
                title={interactive ? 'Click to toggle' : undefined}
              >
                ✓ {sk}
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
          <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)', marginBottom: 6 }}>
            4. Callable Tools ({(agent.tools || []).length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(agent.tools || []).map((tl: string) => (
              <span
                key={tl}
                className="badge badge-neutral mono"
                style={{ fontSize: 12, cursor: interactive ? 'pointer' : 'default' }}
                onClick={() => interactive && onToggleItem && onToggleItem('tools', tl)}
                title={interactive ? 'Click to toggle' : undefined}
              >
                ⚡ {tl}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 10 }}>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
          <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)', marginBottom: 6 }}>
            5. Memory &amp; Context ({(agent.memory || []).length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(agent.memory || []).map((mem: string) => (
              <span
                key={mem}
                className="badge badge-neutral"
                style={{ fontSize: 12, cursor: interactive ? 'pointer' : 'default' }}
                onClick={() => interactive && onToggleItem && onToggleItem('memory', mem)}
                title={interactive ? 'Click to toggle' : undefined}
              >
                🧠 {mem}
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
          <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)', marginBottom: 6 }}>
            6. Integrations ({(agent.integrations || []).length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(agent.integrations || []).map((intg: string) => (
              <span
                key={intg}
                className="badge badge-sage"
                style={{ fontSize: 12, cursor: interactive ? 'pointer' : 'default' }}
                onClick={() => interactive && onToggleItem && onToggleItem('integrations', intg)}
                title={interactive ? 'Click to toggle' : undefined}
              >
                🔌 {intg}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 10 }}>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
          <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)', marginBottom: 4 }}>
            7. Governance &amp; Step-Up
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
            🛡️ {agent.governance?.stepUp || 'Require Passkey on mutations'}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 3 }}>
            {agent.governance?.ttl || '15m RFC 8693'} · {agent.governance?.dlp || 'DLP Active'} · {agent.governance?.maxCost || '$1.00/run'}
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--ui-bg-canvas)', border: '1px solid var(--ui-border)' }}>
          <div className="label-caps" style={{ fontSize: 12, color: 'var(--ui-accent-deep)', marginBottom: 6 }}>
            8. Wake-Up Triggers ({(agent.triggers || []).length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(agent.triggers || []).map((tr: string) => (
              <span
                key={tr}
                className="badge badge-neutral mono"
                style={{ fontSize: 12, cursor: interactive ? 'pointer' : 'default' }}
                onClick={() => interactive && onToggleItem && onToggleItem('triggers', tr)}
                title={interactive ? 'Click to toggle' : undefined}
              >
                ⏰ {tr}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ paddingTop: 10, borderTop: '1px solid var(--ui-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)' }}>
          Runctor Pack · @{agent.repo}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <a
            href={`http://localhost:6013/?handoff=1&autostart=1&repo=${encodeURIComponent(
              String(agent.repo || 'workspace/agent').replace(/^@/, '')
            )}&branch=${encodeURIComponent('feat/agent-pack')}&persona=SoftwareEngineer&title=${encodeURIComponent(
              `Scaffold ${agent.name}`
            )}&prompt=${encodeURIComponent(
              `[Appembly Agent Handoff] Implement "${agent.name}" in @${String(agent.repo || 'workspace/agent').replace(/^@/, '')}: Role=${agent.personaRole}, Skills=${(agent.skills || []).join(', ')}, Tools=${(agent.tools || []).join(', ')}, Governance=${agent.governance?.stepUp || 'Passkey on mutations'}.`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="ui-btn ui-btn-xs ui-btn-primary"
          >
            Hand Off Agent Spec to Cyclode IDE (:6013) ↗
          </a>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   Unified Console Primitives (Sauthen + Meterbox + Controps Calm UI)
   ============================================================================ */

export type Tone =
  | 'accent'
  | 'amber'
  | 'ok'
  | 'warn'
  | 'err'
  | 'cyan'
  | 'info'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'sage'
  | 'jade'
  | 'violet';

export const Tag: React.FC<{
  tone?: Tone;
  mono?: boolean;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ tone = 'neutral', mono, dot, children, className, title }) => {
  const clsMap: Record<Tone, string> = {
    accent: 'badge-sage',
    ok: 'badge-sage',
    success: 'badge-sage',
    sage: 'badge-sage',
    jade: 'badge-sage',
    amber: 'badge-warn',
    warn: 'badge-warn',
    warning: 'badge-warn',
    err: 'badge-danger',
    danger: 'badge-danger',
    cyan: 'badge-sage',
    info: 'badge-sage',
    violet: 'badge-sage',
    neutral: 'badge-neutral',
  };
  return (
    <span title={title} className={cx('badge', clsMap[tone] || 'badge-neutral', mono && 'mono', className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
};

export const Pill = Tag;

export const StatusDot: React.FC<{
  tone?: Tone;
  live?: boolean;
  pulse?: boolean;
  className?: string;
}> = ({ tone = 'ok', live = false, pulse = false, className = '' }) => {
  const isLive = live || pulse;
  if (isLive) {
    const liveTone: LiveDotTone =
      tone === 'err' || tone === 'danger'
        ? 'danger'
        : tone === 'warn' || tone === 'warning' || tone === 'amber'
        ? 'warn'
        : tone === 'accent'
        ? 'accent'
        : 'ok';
    return <LiveDot tone={liveTone} active className={className} />;
  }
  const color =
    tone === 'err' || tone === 'danger'
      ? 'var(--ui-stepup)'
      : tone === 'warn' || tone === 'warning' || tone === 'amber'
      ? 'var(--ui-warn)'
      : tone === 'neutral'
      ? 'var(--ui-text-muted)'
      : 'var(--ui-accent)';
  return (
    <span
      className={cx('inline-block w-2 h-2 rounded-full shrink-0', className)}
      style={{ color, background: color }}
    />
  );
};

export function decisionTone(decision: string): Tone {
  const d = String(decision || '').toLowerCase();
  if (d === 'allowed' || d === 'allow') return 'ok';
  if (d.includes('stepup') || d.includes('step_up')) return 'amber';
  return 'err';
}

export function decisionLabel(decision: string, code?: number): string {
  const d = String(decision || '').toLowerCase();
  if (d === 'allowed' || d === 'allow') return `${code || 200} ALLOW`;
  if (d.includes('stepup') || d.includes('step_up')) return `${code || 403} STEP-UP`;
  if (d.includes('quota')) return `${code || 402} QUOTA`;
  return `${code || 403} DENY`;
}

export const CopyButton: React.FC<{ text: string; label?: string; className?: string }> = ({ text, label, className }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className={cx('ui-btn ui-btn-xs', className)}
    >
      <span>{copied ? '✓ Copied' : label ?? 'Copy'}</span>
    </button>
  );
};

export const PageHeader: React.FC<{
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ kicker, title, description, subtitle, actions }) => (
  <div className="page-header">
    <div style={{ minWidth: 0 }}>
      {kicker && <div className="sth-kicker" style={{ marginBottom: 4 }}>{kicker}</div>}
      <h1 className="h1-title">{title}</h1>
      {(description || subtitle) && <p className="page-subtitle">{description || subtitle}</p>}
    </div>
    {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>{actions}</div>}
  </div>
);

export const Panel: React.FC<{
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: 'default' | 'amber' | 'accent' | 'rose';
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ kicker, title, subtitle, icon, actions, tone = 'default', flush = false, className, bodyClassName, children }) => (
  <section
    className={cx(
      'sth-panel',
      tone === 'amber' && 'sth-panel-amber',
      tone === 'rose' && 'sth-panel-rose',
      tone === 'accent' && 'sth-panel-accent',
      className
    )}
    style={{ overflow: 'hidden' }}
  >
    {(title || kicker || actions) && (
      <header className="ui-card-header" style={{ padding: '13px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {icon && <span style={{ color: 'var(--ui-accent-deep)', display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              {title && <h2 className="h3-title" style={{ margin: 0 }}>{title}</h2>}
              {kicker && <span className="mono" style={{ fontSize: 12.5, color: 'var(--ui-text-muted)' }}>{kicker}</span>}
            </div>
            {subtitle && <p style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 2 }}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>{actions}</div>}
      </header>
    )}
    <div className={bodyClassName} style={{ padding: flush ? 0 : '18px 20px' }}>
      {children}
    </div>
  </section>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children,
  className = '',
  style,
}) => (
  <section className={cx('mbx-card', className)} style={style}>
    {children}
  </section>
);

export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, right, className = '' }) => {
  const slot = right ?? actions;
  return (
    <header
      className={cx('ui-card-header', className)}
      style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}
    >
      <div style={{ minWidth: 180, flex: '1 1 220px' }}>
        <h2 className="h3-title" style={{ margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', marginTop: 3 }}>{subtitle}</p>}
      </div>
      {slot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {slot}
        </div>
      )}
    </header>
  );
};

const NUMERIC_READOUT_RE = /^(-?\$?)(\d+(?:,\d{3})*(?:\.\d+)?)(\s*(?:%|K|M|B|ms|s)?)?$/i;

const AnimatedReadoutNumber: React.FC<{
  target: number;
  decimals: number;
  useCommas: boolean;
  prefix: string;
  suffix: string;
}> = ({ target, decimals, useCommas, prefix, suffix }) => {
  const current = useCountUp(target, { duration: 420, decimals });
  const formatted = useMemo(() => {
    if (decimals > 0) {
      const fixed = current.toFixed(decimals);
      if (!useCommas) return fixed;
      const [intPart, decPart] = fixed.split('.');
      return `${Number(intPart).toLocaleString('en-US')}.${decPart}`;
    }
    const rounded = Math.round(current);
    return useCommas ? rounded.toLocaleString('en-US') : String(rounded);
  }, [current, decimals, useCommas]);

  return (
    <span className="ap-tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export const Readout: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  sub?: React.ReactNode;
  onClick?: () => void;
}> = ({ label, value, tone, sub, onClick }) => {
  let renderedValue: React.ReactNode = value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const decimals = Number.isInteger(value) ? 0 : 1;
    renderedValue = (
      <AnimatedReadoutNumber
        target={value}
        decimals={decimals}
        useCommas={Math.abs(value) >= 1000}
        prefix=""
        suffix=""
      />
    );
  } else if (typeof value === 'string') {
    const match = value.trim().match(NUMERIC_READOUT_RE);
    if (match) {
      const prefix = match[1] || '';
      const rawNum = match[2] || '0';
      const suffix = match[3] || '';
      const cleanNum = Number(rawNum.replace(/,/g, ''));
      if (Number.isFinite(cleanNum)) {
        const dotIdx = rawNum.indexOf('.');
        const decimals = dotIdx >= 0 ? rawNum.length - dotIdx - 1 : 0;
        const useCommas = rawNum.includes(',') || (prefix.includes('$') && cleanNum >= 1000);
        renderedValue = (
          <AnimatedReadoutNumber
            target={cleanNum}
            decimals={decimals}
            useCommas={useCommas}
            prefix={prefix}
            suffix={suffix}
          />
        );
      }
    }
  }

  return (
    <div
      className="readout-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="readout-kicker">{label}</div>
      <div
        className="readout-val tnum ap-tabular-nums"
        style={{
          color:
            tone === 'amber' || tone === 'warn' || tone === 'warning'
              ? 'var(--ui-warn)'
              : tone === 'err' || tone === 'danger'
              ? 'var(--ui-stepup)'
              : tone === 'accent' || tone === 'ok' || tone === 'success' || tone === 'sage' || tone === 'jade'
              ? 'var(--ui-accent-deep)'
              : 'var(--ui-text-primary)',
        }}
      >
        {renderedValue}
      </div>
      {sub && <div className="readout-sub">{sub}</div>}
    </div>
  );
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; count?: number }[];
  onChange: (v: any) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 3,
        padding: 3,
        borderRadius: 9,
        background: 'var(--ui-bg-subtle)',
        border: '1px solid var(--ui-border)',
        maxWidth: '100%',
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              height: 27,
              padding: '0 11px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              border: active ? '1px solid var(--ui-border-strong)' : '1px solid transparent',
              background: active ? 'var(--ui-bg-surface)' : 'transparent',
              color: active ? 'var(--ui-accent-deep)' : 'var(--ui-text-secondary)',
              boxShadow: active ? 'var(--ui-shadow-sm)' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>{o.label}</span>
            {typeof o.count === 'number' && (
              <span
                className="mono tnum"
                style={{
                  fontSize: 12,
                  padding: '0 5px',
                  borderRadius: 99,
                  background: active ? 'var(--appembly-sage-soft)' : 'var(--ui-bg-surface)',
                  color: active ? 'var(--ui-accent-deep)' : 'var(--ui-text-muted)',
                }}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const ProgressBar: React.FC<{ value: number; max?: number; tone?: Tone; color?: string }> = ({
  value,
  max,
  tone = 'ok',
  color,
}) => {
  const rawPct =
    typeof max === 'number' && max > 0
      ? (value / max) * 100
      : value > 0 && value <= 1
      ? value * 100
      : value;
  const pct = Math.max(0, Math.min(100, rawPct));
  const fill =
    color ||
    (tone === 'err' || tone === 'danger'
      ? 'var(--ui-stepup)'
      : tone === 'warn' || tone === 'warning' || tone === 'amber'
      ? 'var(--ui-warn)'
      : 'var(--ui-accent)');
  return (
    <div className="gauge-track" style={{ height: 6 }}>
      <div className="mbx-bar-fill" style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: fill }} />
    </div>
  );
};

export const Notice: React.FC<{
  tone?: Tone;
  title: React.ReactNode;
  detail?: React.ReactNode;
  onDismiss?: () => void;
}> = ({ tone = 'ok', title, detail, onDismiss }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 12,
      marginBottom: 16,
      background:
        tone === 'err' || tone === 'danger'
          ? 'var(--ui-stepup-soft)'
          : tone === 'warn' || tone === 'warning' || tone === 'amber'
          ? 'var(--ui-warn-soft)'
          : 'var(--appembly-sage-soft)',
      border: `1px solid ${
        tone === 'err' || tone === 'danger'
          ? 'var(--ui-stepup)'
          : tone === 'warn' || tone === 'warning' || tone === 'amber'
          ? 'var(--ui-warn)'
          : 'var(--ui-accent)'
      }`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <StatusDot tone={tone} className="mt-1.5" />
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ui-text-primary)' }}>{title}</div>
        {detail && <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
    {onDismiss && (
      <button type="button" className="ui-btn ui-btn-xs" onClick={onDismiss}>
        Dismiss
      </button>
    )}
  </div>
);

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: number | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'modal' | 'sheet';
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, width, size, variant = 'sheet', footer, children }) => {
  const { mounted, state } = usePresence(open, 200);
  const panelRef = useRef<HTMLElement>(null);
  useOverlayFocusTrap(open, panelRef, onClose);

  if (!mounted || typeof document === 'undefined') return null;
  const isSheet = variant === 'sheet';
  // Responsive sizing: legacy numeric widths act as a floor, never a cap.
  const MODAL_W = { sm: 560, md: 720, lg: 920, xl: 1120 } as const;
  const SHEET_W = { sm: 480, md: 600, lg: 720, xl: 880 } as const;
  const tier = size || (isSheet ? 'md' : 'lg');
  const basePx = (isSheet ? SHEET_W : MODAL_W)[tier];
  const resolvedWidth =
    typeof width === 'string'
      ? width
      : `min(${Math.max(basePx, typeof width === 'number' ? width : 0)}px, ${isSheet ? '100vw' : 'calc(100vw - 48px)'})`;

  return createPortal(
    <div
      className="ap-scrim"
      data-state={state}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(17, 22, 24, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: isSheet ? 'flex-end' : 'center',
        alignItems: isSheet ? 'stretch' : 'center',
        padding: isSheet ? 0 : 20,
      }}
      onClick={onClose}
    >
      <aside
        ref={panelRef}
        className={isSheet ? 'ap-sheet-panel' : 'ap-dialog-panel'}
        data-state={state}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: resolvedWidth,
          maxWidth: isSheet ? '100vw' : 'calc(100vw - 24px)',
          height: isSheet ? '100vh' : undefined,
          maxHeight: isSheet ? '100vh' : 'min(88vh, 900px)',
          background: 'var(--ui-bg-surface)',
          borderLeft: isSheet ? '1px solid var(--ui-border-strong)' : undefined,
          border: isSheet ? undefined : '1px solid var(--ui-border-strong)',
          borderRadius: isSheet ? 0 : 16,
          boxShadow: 'var(--ui-shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            padding: '18px 24px 16px',
            borderBottom: '1px solid var(--ui-border)',
            background: 'var(--ui-bg-surface)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 className="h3-title" style={{ fontSize: 16.5, margin: 0, letterSpacing: '-0.015em' }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 13, color: 'var(--ui-text-muted)', marginTop: 4, lineHeight: 1.5 }}>{subtitle}</p>}
          </div>
          <button type="button" className="ap-dialog-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {children}
        </div>
        {footer && (
          <footer
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--ui-border)',
              background: 'color-mix(in srgb, var(--ui-bg-subtle) 40%, var(--ui-bg-surface))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body
  );
};

export const JsonView: React.FC<{ value?: unknown; data?: unknown; maxHeight?: number; label?: string }> = ({
  value,
  data,
  maxHeight = 320,
  label,
}) => {
  const payload = value !== undefined ? value : data;
  const text = JSON.stringify(payload, null, 2) ?? '';
  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--ui-border)', background: 'var(--ui-bg-subtle)', overflow: 'hidden' }}>
      {label !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderBottom: '1px solid var(--ui-border)',
          }}
        >
          <span className="sth-kicker">{label}</span>
          <CopyButton text={text} />
        </div>
      )}
      <pre className="mono" style={{ margin: 0, padding: 14, fontSize: 12.5, lineHeight: 1.6, overflow: 'auto', maxHeight }}>
        {text}
      </pre>
    </div>
  );
};

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values?: number[];
  total?: number;
}

export interface ChartBucket {
  t: number | string;
  values: Record<string, number>;
}

function niceCeil(v: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export const StackedAreaChart: React.FC<{
  buckets?: ChartBucket[];
  timestamps?: Array<number | string>;
  series?: ChartSeries[];
  height?: number;
  formatValue?: (v: number) => string;
  valueFormatter?: (v: number) => string;
  formatTime?: (t: number | string) => string;
}> = ({
  buckets: rawBuckets,
  timestamps,
  series: rawSeries,
  height = 235,
  formatValue,
  valueFormatter,
  formatTime = (t) =>
    typeof t === 'string'
      ? t
      : new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
}) => {
  const series = useMemo(() => (Array.isArray(rawSeries) ? rawSeries : []), [rawSeries]);
  const fmtVal = valueFormatter || formatValue || formatCompact;

  const buckets = useMemo<ChartBucket[]>(() => {
    if (Array.isArray(rawBuckets) && rawBuckets.length > 0) {
      return rawBuckets;
    }
    const tsList = Array.isArray(timestamps) ? timestamps : [];
    return tsList.map((t, idx) => {
      const values: Record<string, number> = {};
      for (const s of series) {
        values[s.key] = Array.isArray(s.values) ? Number(s.values[idx] || 0) : 0;
      }
      return { t, values };
    });
  }, [rawBuckets, timestamps, series]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(680);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 14, bottom: 26, left: 48 };
  const innerW = Math.max(100, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const { stacks, max, ticks } = useMemo(() => {
    const totals = buckets.map((b) => series.reduce((acc, s) => acc + ((b.values && b.values[s.key]) || 0), 0));
    const rawMax = Math.max(1, ...totals);
    const niceMax = niceCeil(rawMax);
    const layers = series.map((s, si) =>
      buckets.map((b) => {
        const below = series.slice(0, si).reduce((acc, p) => acc + ((b.values && b.values[p.key]) || 0), 0);
        return { y0: below, y1: below + ((b.values && b.values[s.key]) || 0) };
      })
    );
    return { stacks: layers, max: niceMax, ticks: [0, niceMax / 2, niceMax] };
  }, [buckets, series]);

  const x = (i: number) => (buckets.length <= 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
  const y = (v: number) => innerH - (v / max) * innerH;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (buckets.length === 0 || innerW <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(buckets.length - 1, Math.round(rel * (buckets.length - 1)))));
  };

  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(innerW / 95))));
  const hovered = hover != null ? buckets[hover] : null;
  const hoveredTotal = hovered ? series.reduce((a, s) => a + ((hovered.values && hovered.values[s.key]) || 0), 0) : 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height, userSelect: 'none' }}>
      <svg width={width} height={height} role="img" aria-label="Metered usage over time">
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="var(--ui-border)" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={-10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--ui-text-muted)" className="mono tnum">
                {fmtVal(t)}
              </text>
            </g>
          ))}

          {buckets.map((b, i) =>
            i % labelEvery === 0 ? (
              <text key={String(b.t) + '-' + i} x={x(i)} y={innerH + 18} textAnchor="middle" fontSize={12} fill="var(--ui-text-muted)" className="mono tnum">
                {formatTime(b.t)}
              </text>
            ) : null
          )}

          {stacks.map((layer, si) => {
            if (buckets.length === 0) return null;
            const top = layer.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y1).toFixed(1)}`).join(' ');
            const bottom = layer
              .map((p, i) => [x(i), y(p.y0)] as const)
              .reverse()
              .map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`)
              .join(' ');
            const s = series[si];
            return (
              <g key={s.key}>
                <path d={`${top} ${bottom} Z`} fill={s.color} fillOpacity={0.2} />
                <path d={top} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" />
              </g>
            );
          })}

          {hover != null && buckets[hover] && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke="var(--ui-border-strong)" strokeDasharray="2 2" />
              {stacks.map((layer, si) => (
                <circle
                  key={series[si].key}
                  cx={x(hover)}
                  cy={y(layer[hover].y1)}
                  r={3.5}
                  fill="var(--ui-bg-surface)"
                  stroke={series[si].color}
                  strokeWidth={2}
                />
              ))}
            </g>
          )}

          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      </svg>

      {hovered && hover != null && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: Math.min(Math.max(pad.left + x(hover) + 12, 8), Math.max(8, width - 210)),
            minWidth: 190,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'var(--ui-bg-surface)',
            border: '1px solid var(--ui-border-strong)',
            boxShadow: 'var(--ui-shadow-lg)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          <div className="mono tnum" style={{ fontSize: 12.5, color: 'var(--ui-text-muted)' }}>
            {formatTime(hovered.t)}
          </div>
          <div className="mono tnum" style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: 'var(--ui-text-primary)' }}>
            {fmtVal(hoveredTotal)}
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {series.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--ui-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
                <span className="mono tnum" style={{ fontWeight: 600 }}>{fmtVal((hovered.values && hovered.values[s.key]) || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export interface ByokVaultModalProps {
  open: boolean;
  initialProvider?: string;
  isProviderByokReady: (provider: string) => boolean;
  onClose: () => void;
  onSealKey: (provider: string, label: string, secret: string) => void | Promise<void>;
}

export const ByokVaultModal: React.FC<ByokVaultModalProps> = ({
  open,
  initialProvider = 'anthropic',
  isProviderByokReady,
  onClose,
  onSealKey,
}) => {
  const presence = usePresence(open, 150);
  const panelRef = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState<string>(initialProvider || 'anthropic');
  const [label, setLabel] = useState<string>(() => getByokProviderMeta(initialProvider || 'anthropic').defaultHandleLabel);
  const [secret, setSecret] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      const p = initialProvider || 'anthropic';
      setProvider(p);
      setLabel(getByokProviderMeta(p).defaultHandleLabel);
      setSecret('');
    }
  }, [open, initialProvider]);

  useOverlayFocusTrap(open, panelRef, onClose);

  if (!presence.mounted) return null;

  return createPortal(
    <div
      className="cmd-modal-backdrop"
      data-state={presence.state}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 10, 12, 0.52)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
    >
      <div
        ref={panelRef}
        className="cmd-modal ui-card"
        data-state={presence.state}
        role="dialog"
        aria-modal="true"
        style={{ width: 'min(680px, calc(100vw - 32px))' }}
      >
        <div className="ui-card-header">
          <div className="h3-title">Bring Your Own Key (BYOK) · AES-256-GCM Vault</div>
          <button type="button" className="ui-btn ui-btn-xs" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="ui-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12.5, color: 'var(--ui-text-secondary)', margin: 0 }}>
            Your API key is sealed with envelope encryption in Sauthen Vault. Models &amp; agents reference an opaque{' '}
            <span className="mono">st_pat_*</span> handle—never raw keys.
          </p>
          <div>
            <div className="label-caps" style={{ marginBottom: 6 }}>
              Model Provider
            </div>
            <div className="grid-2" style={{ gap: 8 }}>
              {BYOK_PROVIDERS.map((p) => {
                const isSelected = provider === p.id;
                const isSealed = isProviderByokReady(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      setLabel(p.defaultHandleLabel);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 9,
                      border: isSelected ? '1.5px solid var(--ui-accent)' : '1px solid var(--ui-border)',
                      background: isSelected
                        ? 'color-mix(in srgb, var(--ui-accent) 10%, var(--ui-bg-surface))'
                        : 'var(--ui-bg-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      transition: 'border-color 0.14s ease, background 0.14s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ui-text-primary)' }}>{p.name}</span>
                      <span
                        className={`badge ${isSealed ? 'badge-sage' : 'badge-neutral'}`}
                        style={{ fontSize: 11, padding: '0 6px' }}
                      >
                        {isSealed ? 'Sealed in Vault' : 'Managed Default'}
                      </span>
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11.5,
                        color: 'var(--ui-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.modelsSummary}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="label-caps" style={{ marginBottom: 4 }}>
              Key Handle Label
            </div>
            <input
              className="ui-input mono"
              style={{ width: '100%' }}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <div className="label-caps" style={{ marginBottom: 4 }}>
              Provider API Secret Key
            </div>
            <input
              type="password"
              className="ui-input mono"
              style={{ width: '100%' }}
              placeholder={getByokProviderMeta(provider).keyPrefixPlaceholder}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button type="button" className="ui-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              disabled={!secret.trim() || submitting}
              onClick={async () => {
                if (!secret.trim()) return;
                setSubmitting(true);
                try {
                  await onSealKey(provider, label.trim() || `${provider}-byok-key`, secret.trim());
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? 'Sealing…' : 'Seal Key in Vault'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

