import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  User as UserIcon,
  X,
} from 'lucide-react';
import { CyclodeIcon } from '../brand/CyclodeIcon';
import { MeterboxIcon } from '../brand/MeterboxIcon';
import { SauthenIcon } from '../brand/SauthenIcon';
import { AppemblyLogo } from '../brand/AppemblyLogo';

export type SauthenPresetApp =
  | 'cyclode'
  | 'meterbox'
  | 'sauthen'
  | 'valiscale'
  | 'swarmteam'
  | 'wotneed'
  | 'gatharoom';

export type SauthenAuthMode = 'signin' | 'signup' | 'sso' | 'cli';

export interface SauthenBrandConfig {
  appId: string;
  appName: string;
  tagline: string;
  theme: 'dark' | 'light';
  accent: string;
  accentSoft: string;
  surface: string;
  cardBg: string;
  inputBg: string;
  border: string;
  text: string;
  muted: string;
  icon: React.ReactNode;
  methods: Array<'passkey' | 'github' | 'google' | 'saml' | 'password'>;
  features: string[];
  defaultRedirectUrl?: string;
}

export interface SauthenAuthUser {
  id: string;
  email: string;
  display_name: string;
  title?: string;
  role: string;
  org_ids?: string[];
  passkey_registered?: boolean;
  passkey_enabled?: boolean;
  mfa_enabled?: boolean;
  mfa_methods?: string[];
}

export interface SauthenAuthOrg {
  id: string;
  name: string;
  slug: string;
  plan_tier?: string;
  tier?: string;
  meterbox_live_ns?: string;
  meterbox_sandbox_ns?: string;
}

export interface SauthenStepUpItem {
  id: string;
  action: string;
  target_resource: string;
  reason: string;
  persona: string;
  task_id: string;
  status: string;
  requested_at: string;
}

export interface SauthenAuthPayload {
  user: SauthenAuthUser;
  organization: SauthenAuthOrg;
  namespace: string;
  access_token: string;
  session?: {
    id: string;
    token_preview: string;
    auth_method: string;
    app_client: string;
  };
}

const STORAGE_KEY = 'sth.auth.session.v2';
const DEFAULT_SAUTHEN_API =
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
    ? 'https://auth.appembly.com'
    : 'http://localhost:6021';

export const SAUTHEN_BRAND_PRESETS: Record<SauthenPresetApp, SauthenBrandConfig> = {
  cyclode: {
    appId: 'cyclode',
    appName: 'Cyclode',
    tagline: 'Autonomous Coding Worktrees, Sandboxes & Fleet Orchestration',
    theme: 'dark',
    accent: '#E5C07B',
    accentSoft: 'rgba(229, 192, 123, 0.15)',
    surface: '#21252B',
    cardBg: '#282C34',
    inputBg: '#2C313A',
    border: '#3E4451',
    text: '#F1F5F9',
    muted: '#94A3B8',
    icon: <CyclodeIcon size={22} />,
    methods: ['passkey', 'github', 'password', 'saml'],
    features: [
      'Mints 15-minute RFC 8693 st_agt_* tokens per task worktree',
      'Zero-knowledge LLM proxy — pods never touch raw API keys',
      'Human-in-the-loop st_stepup_* approval gate on main & PR merges',
    ],
    defaultRedirectUrl: 'http://localhost:6013',
  },
  meterbox: {
    appId: 'meterbox',
    appName: 'Meterbox',
    tagline: 'Real-Time AI Token Metering, Pre-Flight Quotas & FinOps Ledger',
    theme: 'light',
    accent: '#4E8067',
    accentSoft: 'rgba(78, 128, 103, 0.12)',
    surface: '#F6F7F5',
    cardBg: '#FFFFFF',
    inputBg: '#F2F4F1',
    border: '#DCE0DC',
    text: '#111618',
    muted: '#5A625E',
    icon: <MeterboxIcon size={20} />,
    methods: ['passkey', 'google', 'github', 'saml', 'password'],
    features: [
      '1:1 Organization provisioning for ns_live_* and ns_test_* namespaces',
      'Sub-5ms pre-flight entitlement gate for autonomous agent fleets',
      'Automatic CloudEvents v1.0 ingestion from Sauthen LLM Proxy',
    ],
    defaultRedirectUrl: 'http://localhost:6070',
  },
  sauthen: {
    appId: 'sauthen',
    appName: 'Sauthen',
    tagline: 'Unified OIDC Identity Provider, Vault & Scoped Agent Token Broker',
    theme: 'dark',
    accent: '#8F80FF',
    accentSoft: 'rgba(143, 128, 255, 0.15)',
    surface: '#090A0F',
    cardBg: '#10111A',
    inputBg: '#151722',
    border: '#242636',
    text: '#ECECF6',
    muted: '#9698B2',
    icon: <SauthenIcon size={20} />,
    methods: ['passkey', 'github', 'google', 'saml', 'password'],
    features: [
      'Ed25519 (EdDSA) OIDC sessions verified locally in < 0.5ms',
      'AES-256-GCM envelope vault for Anthropic, Gemini, OpenAI & GitHub',
      'Unified SSO across Cyclode, Meterbox, Valiscale & Swarmteam',
    ],
    defaultRedirectUrl: 'http://localhost:6020',
  },
  valiscale: {
    appId: 'valiscale',
    appName: 'Valiscale',
    tagline: '3-Stage Concept Validation, Autonomous Build & Turnkey Scaling',
    theme: 'dark',
    accent: '#38BDF8',
    accentSoft: 'rgba(56, 189, 248, 0.14)',
    surface: '#0A0E17',
    cardBg: '#111827',
    inputBg: '#0D1320',
    border: '#1F2937',
    text: '#F9FAFB',
    muted: '#9CA3AF',
    icon: <AppemblyLogo size={20} />,
    methods: ['passkey', 'github', 'google', 'password'],
    features: [
      'Turnkey OAuth 2.1 client provisioning for Stage-3 graduated apps',
      'Shared Meterbox billing namespace across validation experiments',
    ],
  },
  swarmteam: {
    appId: 'swarmteam',
    appName: 'Swarmteam',
    tagline: 'Multi-Agent DAG Wave Orchestration & Autonomous Delivery',
    theme: 'dark',
    accent: '#F59E0B',
    accentSoft: 'rgba(245, 158, 11, 0.14)',
    surface: '#0C0D12',
    cardBg: '#14161F',
    inputBg: '#10121A',
    border: '#262938',
    text: '#F5F6FA',
    muted: '#9CA3B5',
    icon: <AppemblyLogo size={20} />,
    methods: ['passkey', 'github', 'password'],
    features: [
      'Per-wave RFC 8693 agent delegation tokens',
      'Deterministic step-up approval gates before production rollout',
    ],
  },
  wotneed: {
    appId: 'wotneed',
    appName: 'Wotneed',
    tagline: 'Intent-Driven Autonomous Commerce & Reverse-Bidding Marketplace',
    theme: 'light',
    accent: '#0EA5E9',
    accentSoft: 'rgba(14, 165, 233, 0.12)',
    surface: '#F8FAFC',
    cardBg: '#FFFFFF',
    inputBg: '#F1F5F9',
    border: '#E2E8F0',
    text: '#0F172A',
    muted: '#64748B',
    icon: <AppemblyLogo size={20} />,
    methods: ['passkey', 'google', 'password'],
    features: ['Scoped ShopperConcierge agent tokens with spend caps'],
  },
  gatharoom: {
    appId: 'gatharoom',
    appName: 'Gatharoom',
    tagline: 'Realtime Collaborative Rooms & AI Facilitator Agents',
    theme: 'dark',
    accent: '#EC4899',
    accentSoft: 'rgba(236, 72, 153, 0.14)',
    surface: '#0D0B14',
    cardBg: '#161224',
    inputBg: '#110E1C',
    border: '#2B2440',
    text: '#FAF5FF',
    muted: '#A79EC0',
    icon: <AppemblyLogo size={20} />,
    methods: ['passkey', 'google', 'github', 'password'],
    features: ['Instant room identity and moderator agent delegation'],
  },
};

export function resolveBrandConfig(
  brand?: SauthenPresetApp | Partial<SauthenBrandConfig> | string,
): SauthenBrandConfig {
  if (!brand) return SAUTHEN_BRAND_PRESETS.sauthen;
  if (typeof brand === 'string') {
    const key = brand.toLowerCase() as SauthenPresetApp;
    if (SAUTHEN_BRAND_PRESETS[key]) return SAUTHEN_BRAND_PRESETS[key];
    return {
      ...SAUTHEN_BRAND_PRESETS.sauthen,
      appId: brand,
      appName: brand.charAt(0).toUpperCase() + brand.slice(1),
    };
  }
  const baseKey = (brand.appId?.toLowerCase() as SauthenPresetApp) || 'sauthen';
  const base = SAUTHEN_BRAND_PRESETS[baseKey] || SAUTHEN_BRAND_PRESETS.sauthen;
  return { ...base, ...brand };
}

/* ============================================================================
   Session Persistence & Hook (`useSauthenSession`)
   ============================================================================ */

export function saveSauthenSession(payload: SauthenAuthPayload) {
  try {
    const prev = loadSauthenSession();
    if (prev?.user?.id && payload?.user?.id && prev.user.id !== payload.user.id) {
      localStorage.removeItem('cyclode_active_task_id');
      localStorage.removeItem('cyclode_active_task_snapshot');
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/session/')) {
        window.history.replaceState({}, '', '/');
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('sauthen-auth-change', { detail: payload }));
  } catch {
    /* ignore */
  }
}

function isSauthenJwtExpired(rawToken?: string): boolean {
  if (!rawToken || typeof rawToken !== 'string') return true;
  const clean = rawToken.trim().replace(/^st_(sess|agt)_/, '');
  const parts = clean.split('.');
  if (parts.length !== 3) return true;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp === 'number' && payload.exp > 0) {
      return Math.floor(Date.now() / 1000) >= payload.exp - 5;
    }
    return false;
  } catch {
    return true;
  }
}

export function loadSauthenSession(): SauthenAuthPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SauthenAuthPayload;
    if (isSauthenJwtExpired(parsed?.access_token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSauthenSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('cyclode_active_task_id');
    localStorage.removeItem('cyclode_active_task_snapshot');
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/session/')) {
      window.history.replaceState({}, '', '/');
    }
    window.dispatchEvent(new CustomEvent('sauthen-auth-change', { detail: null }));
  } catch {
    /* ignore */
  }
}

export function useSauthenSession(apiUrl = DEFAULT_SAUTHEN_API, namespace?: string) {
  const [session, setSession] = useState<SauthenAuthPayload | null>(() =>
    typeof window !== 'undefined' ? loadSauthenSession() : null,
  );
  const [pendingStepUps, setPendingStepUps] = useState<SauthenStepUpItem[]>([]);
  const [orgs, setOrgs] = useState<SauthenAuthOrg[]>([]);
  const [loading, setLoading] = useState(true);

  const syncWithBackend = useCallback(async () => {
    try {
      const stored = loadSauthenSession();
      const ns = namespace || stored?.namespace || 'ns_live_appembly';
      if (stored?.access_token) {
        const headers: Record<string, string> = {
          'X-OpenMeter-Namespace': ns,
          Authorization: `Bearer ${stored.access_token}`,
        };
        const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
          headers,
          credentials: 'include',
        });
        if (res.status === 401) {
          clearSauthenSession();
          setSession(null);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.pending_step_ups)) {
          setPendingStepUps(data.pending_step_ups);
        }
        if (Array.isArray(data.organizations)) {
          setOrgs(data.organizations);
        }
        if (data.user && data.organization) {
          const hydrated: SauthenAuthPayload = {
            ...stored,
            user: data.user,
            organization: data.organization,
            namespace: data.namespace || stored.namespace || ns,
            access_token: stored.access_token || data.access_token || data.session?.token_jwt || '',
            session: data.session || stored.session,
          };
          setSession(hydrated);
        }
      } else {
        // Cross-app SSO auto-hydration when user signed in on another Appembly app port
        const ssoRes = await fetch(`${apiUrl}/api/v1/auth/sso`, {
          credentials: 'include',
        });
        if (ssoRes.ok) {
          const ssoData = await ssoRes.json();
          if (ssoData.user && ssoData.organization && ssoData.access_token) {
            const ssoPayload: SauthenAuthPayload = {
              user: ssoData.user,
              organization: ssoData.organization,
              namespace: ssoData.namespace || ssoData.organization.meterbox_live_ns || ns,
              access_token: ssoData.access_token,
              session: ssoData.session,
            };
            saveSauthenSession(ssoPayload);
            setSession(ssoPayload);
            if (Array.isArray(ssoData.pending_step_ups)) {
              setPendingStepUps(ssoData.pending_step_ups);
            }
            if (Array.isArray(ssoData.organizations)) {
              setOrgs(ssoData.organizations);
            }
          }
        }
      }
    } catch {
      /* network error during background sync */
    } finally {
      setLoading(false);
    }
  }, [apiUrl, namespace]);

  const handleSignOut = useCallback(async () => {
    const stored = loadSauthenSession();
    clearSauthenSession();
    setSession(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (stored?.access_token) {
        headers.Authorization = `Bearer ${stored.access_token}`;
      }
      await fetch(`${apiUrl}/api/v1/auth/signout`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ token: stored?.access_token || '' }),
      });
    } catch {
      /* ignore network error on signout */
    }
  }, [apiUrl]);

  useEffect(() => {
    syncWithBackend();
    const onAuthChange = () => {
      const next = loadSauthenSession();
      setSession(next);
      if (next) {
        syncWithBackend();
      }
    };
    window.addEventListener('sauthen-auth-change', onAuthChange);
    return () => window.removeEventListener('sauthen-auth-change', onAuthChange);
  }, [syncWithBackend]);

  return {
    session,
    authenticated: Boolean(session?.user && session?.access_token),
    user: session?.user || null,
    organization: session?.organization || null,
    namespace: session?.namespace || namespace || 'ns_live_appembly',
    pendingStepUps,
    orgs,
    loading,
    refresh: syncWithBackend,
    signOut: handleSignOut,
  };
}

/* ============================================================================
   1. `<SauthenAuthCard />` — White-Labeled Sign-In / Sign-Up / OIDC Card
   ============================================================================ */

export interface SauthenAuthCardProps {
  brand?: SauthenPresetApp | Partial<SauthenBrandConfig> | string;
  initialMode?: SauthenAuthMode;
  apiUrl?: string;
  namespace?: string;
  clientId?: string;
  redirectUri?: string;
  showAppSwitcher?: boolean;
  allowBrandSwitch?: boolean;
  showDemoAccounts?: boolean;
  onSuccess?: (payload: SauthenAuthPayload) => void;
  onAuthenticated?: (payload: SauthenAuthPayload) => void;
  onCancel?: () => void;
}

export const DEMO_ACCOUNT = {
  id: 'usr_demo_ai',
  name: 'Aria Lin · Demo AI',
  email: 'demo@demo-ai.dev',
  orgName: 'Demo AI',
  namespace: 'ns_live_demo',
  role: 'org:owner',
};

const DEMO_ACCOUNTS = [DEMO_ACCOUNT];

export const SauthenAuthCard: React.FC<SauthenAuthCardProps> = ({
  brand = 'sauthen',
  initialMode = 'signin',
  apiUrl = DEFAULT_SAUTHEN_API,
  namespace = 'ns_live_appembly',
  clientId,
  redirectUri,
  showAppSwitcher = false,
  allowBrandSwitch = false,
  showDemoAccounts = true,
  onSuccess,
  onAuthenticated,
  onCancel,
}) => {
  const [activePreset, setActivePreset] = useState<string>(
    typeof brand === 'string' ? brand : brand.appId || 'sauthen',
  );
  useEffect(() => {
    if (typeof brand === 'string') {
      setActivePreset(brand);
    }
  }, [brand]);
  const cfg = resolveBrandConfig(typeof brand === 'string' ? activePreset : brand);

  const [mode, setMode] = useState<SauthenAuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [createOrgOnSignup, setCreateOrgOnSignup] = useState(true);
  const [samlDomain, setSamlDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintedResult, setMintedResult] = useState<SauthenAuthPayload | null>(null);

  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    setOrgSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24),
    );
  };

  const completeAuth = (payload: SauthenAuthPayload) => {
    saveSauthenSession(payload);
    setMintedResult(payload);
    if (onSuccess) {
      onSuccess(payload);
    }
    if (onAuthenticated) {
      onAuthenticated(payload);
    }
  };

  const handleSignIn = async (method: string, overrideEmail?: string, overrideNamespace?: string) => {
    setBusy(true);
    setError(null);
    const targetEmail = (overrideEmail || email).trim();
    const targetNamespace = overrideNamespace || namespace;
    if (!targetEmail) {
      setError('Enter your work email.');
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/signin`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenMeter-Namespace': targetNamespace,
        },
        body: JSON.stringify({
          email: targetEmail,
          password: password.trim(),
          auth_method: method,
          app_client: cfg.appId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Invalid credentials or account not found.');
      }
      completeAuth(data as SauthenAuthPayload);
    } catch (err: any) {
      setError(err?.message || 'Unable to reach Sauthen identity broker.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim()) {
      setError('Enter your name and work email.');
      return;
    }
    if (password.trim().length > 0 && password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (createOrgOnSignup && !orgName.trim()) {
      setError('Name your organization, or turn off organization setup.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenMeter-Namespace': namespace,
        },
        body: JSON.stringify({
          email: email.trim(),
          display_name: displayName.trim(),
          password: password.trim(),
          org_name: createOrgOnSignup ? orgName.trim() : '',
          org_slug: createOrgOnSignup ? orgSlug.trim() : '',
          app_client: cfg.appId,
          auth_method: password.trim() ? 'password_pkce' : 'passkey',
          passkey: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Sign-up failed.');
      }
      completeAuth(data as SauthenAuthPayload);
    } catch (err: any) {
      setError(err?.message || 'Unable to reach Sauthen identity broker.');
    } finally {
      setBusy(false);
    }
  };

  const firstName = (mintedResult?.user.display_name || '').split(' ')[0] || 'there';
  const showGithub = cfg.methods.includes('github');
  const showGoogle = cfg.methods.includes('google');
  const switchMode = (next: SauthenAuthMode) => {
    setMode(next);
    setError(null);
    setMintedResult(null);
  };

  return (
    <div className="sag-card" data-theme={cfg.theme} data-app={cfg.appId} style={brandCssVars(cfg)}>
      <style dangerouslySetInnerHTML={{ __html: SAG_CSS }} />

      {/* Optional white-label preset bar (Sauthen hosted pages only) */}
      {showAppSwitcher && (
        <div className="sag-switcher">
          <span className="sag-switcher-label">Preview as</span>
          {(['cyclode', 'meterbox', 'sauthen', 'valiscale', 'swarmteam'] as SauthenPresetApp[]).map((p) => (
            <button
              key={p}
              type="button"
              data-active={activePreset === p}
              onClick={() => {
                setActivePreset(p);
                setMintedResult(null);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="sag-body">
        <div className="sag-head">
          <span className="sag-logo">{cfg.icon}</span>
          {onCancel && (
            <button type="button" onClick={onCancel} className="sag-icon-btn" aria-label="Close">
              <X size={16} />
            </button>
          )}
        </div>

        {mintedResult ? (
          /* ---------------- Success ---------------- */
          <div className="sag-success sag-fade">
            <div className="sag-success-icon">
              <Check size={20} strokeWidth={2.5} />
            </div>
            <h2 className="sag-h">You&apos;re in, {firstName}</h2>
            <p className="sag-sub">
              {mintedResult.organization?.name} · <span className="sag-mono">{mintedResult.namespace}</span>
            </p>
            <div className="sag-token">
              <span className="sag-token-tag">st_sess</span>
              <code className="sag-mono">{mintedResult.access_token.slice(0, 34)}…</code>
            </div>
            {redirectUri ? (
              <a
                className="sag-btn sag-btn-primary"
                href={`${redirectUri}${redirectUri.includes('?') ? '&' : '?'}token=${encodeURIComponent(
                  mintedResult.access_token,
                )}&ns=${encodeURIComponent(mintedResult.namespace)}`}
              >
                Continue to {cfg.appName}
                <ArrowRight size={15} />
              </a>
            ) : (
              <div className="sag-redirecting" style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
                <AppemblyLogo variant="mark" size={28} strokeColor={cfg.accent} animated speed="loader" />
              </div>
            )}
          </div>
        ) : mode === 'sso' ? (
          /* ---------------- Enterprise SSO ---------------- */
          <div className="sag-fade">
            <button type="button" className="sag-back" onClick={() => switchMode('signin')}>
              <ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} /> Back
            </button>
            <h2 className="sag-h">Single sign-on</h2>
            <p className="sag-sub">Enter your company domain and we&apos;ll hand you off to your identity provider.</p>
            <form
              className="sag-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!samlDomain.trim()) {
                  setError('Enter your company domain.');
                  return;
                }
                handleSignIn('saml_enterprise_sso', `admin@${samlDomain.trim()}`);
              }}
            >
              <label className="sag-field">
                <span className="sag-label">Company domain</span>
                <span className="sag-input-wrap">
                  <Building2 size={15} className="sag-input-icon" />
                  <input
                    className="sag-input sag-input-iconed sag-mono"
                    value={samlDomain}
                    onChange={(e) => setSamlDomain(e.target.value)}
                    placeholder="company.com"
                    autoFocus
                  />
                </span>
              </label>
              <button type="submit" disabled={busy} className="sag-btn sag-btn-primary">
                {busy ? <span className="sag-spinner" /> : <ShieldCheck size={15} />}
                {busy ? 'Redirecting…' : 'Continue with SSO'}
              </button>
            </form>
            <div className="sag-idps">
              <span>Okta</span>
              <span>Entra ID</span>
              <span>Google Workspace</span>
              <span>OneLogin</span>
            </div>
          </div>
        ) : (
          <>
            <h2 className="sag-h">{mode === 'signup' ? `Create your ${cfg.appName} account` : 'Welcome back'}</h2>
            <p className="sag-sub">
              {mode === 'signup'
                ? 'One Appembly account — your workspace is ready in seconds.'
                : `Sign in to continue to ${cfg.appName}.`}
            </p>

            <div className="sag-seg" role="tablist">
              <button type="button" data-active={mode === 'signin'} onClick={() => switchMode('signin')}>
                Sign in
              </button>
              <button type="button" data-active={mode === 'signup'} onClick={() => switchMode('signup')}>
                Create account
              </button>
            </div>

            {mode === 'signin' ? (
              /* ---------------- Sign in ---------------- */
              <div className="sag-fade" key="signin">
                <div className="sag-stack">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSignIn('passkey')}
                    className="sag-btn sag-btn-passkey"
                  >
                    <Fingerprint size={17} />
                    Continue with passkey
                  </button>
                  {(showGithub || showGoogle) && (
                    <div className={showGithub && showGoogle ? 'sag-row2' : ''}>
                      {showGithub && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSignIn('github_oauth')}
                          className="sag-btn"
                        >
                          <GitHubMark />
                          GitHub
                        </button>
                      )}
                      {showGoogle && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSignIn('google_oidc')}
                          className="sag-btn"
                        >
                          <GoogleMark />
                          Google
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="sag-divider">
                  <span>or with email</span>
                </div>

                <form
                  className="sag-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!email.trim()) {
                      setError('Enter your work email.');
                      return;
                    }
                    handleSignIn('password_pkce');
                  }}
                >
                  <label className="sag-field">
                    <span className="sag-label">Work email</span>
                    <span className="sag-input-wrap">
                      <Mail size={15} className="sag-input-icon" />
                      <input
                        className="sag-input sag-input-iconed"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </span>
                  </label>
                  <label className="sag-field">
                    <span className="sag-label">
                      Password
                      <button type="button" className="sag-link" onClick={() => handleSignIn('magic_link')}>
                        Email me a link
                      </button>
                    </span>
                    <span className="sag-input-wrap">
                      <Lock size={15} className="sag-input-icon" />
                      <input
                        className="sag-input sag-input-iconed"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </span>
                  </label>
                  <button type="submit" disabled={busy} className="sag-btn sag-btn-primary">
                    {busy ? <span className="sag-spinner" /> : null}
                    {busy ? 'Signing in…' : 'Sign in'}
                    {!busy && <ArrowRight size={15} />}
                  </button>
                </form>

                {cfg.methods.includes('saml') && (
                  <button type="button" className="sag-sso-link" onClick={() => switchMode('sso')}>
                    <Building2 size={14} /> Sign in with SSO
                  </button>
                )}

                {showDemoAccounts && (
                  <div className="sag-demo">
                    <button
                      type="button"
                      disabled={busy}
                      className="sag-demo-btn"
                      title={`${DEMO_ACCOUNT.email} · Isolated Demo AI workspace (${DEMO_ACCOUNT.namespace})`}
                      onClick={() => {
                        setEmail(DEMO_ACCOUNT.email);
                        handleSignIn('passkey', DEMO_ACCOUNT.email, DEMO_ACCOUNT.namespace);
                      }}
                    >
                      <span className="sag-demo-btn-left">
                        <Sparkles size={15} />
                        <span>Try interactive demo</span>
                      </span>
                      <span className="sag-demo-btn-meta sag-mono">
                        {DEMO_ACCOUNT.orgName} · {DEMO_ACCOUNT.email}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ---------------- Create account ---------------- */
              <form className="sag-form sag-fade" key="signup" onSubmit={handleSignUp}>
                <div className="sag-row2">
                  <label className="sag-field">
                    <span className="sag-label">Full name</span>
                    <input
                      className="sag-input"
                      autoComplete="name"
                      placeholder="Maya Chen"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </label>
                  <label className="sag-field">
                    <span className="sag-label">Work email</span>
                    <input
                      className="sag-input"
                      type="email"
                      autoComplete="email"
                      placeholder="maya@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                </div>

                <label className="sag-field">
                  <span className="sag-label">Password</span>
                  <span className="sag-input-wrap">
                    <Lock size={15} className="sag-input-icon" />
                    <input
                      className="sag-input sag-input-iconed"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 6 characters (or leave blank for passkey-only)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </span>
                </label>

                <div className="sag-org" data-open={createOrgOnSignup}>
                  <label className="sag-toggle-row">
                    <span className="sag-toggle-copy">
                      <span className="sag-toggle-title">
                        <Building2 size={14} /> Create an organization
                      </span>
                      <span className="sag-toggle-sub">Isolated live &amp; test workspaces for your team</span>
                    </span>
                    <input
                      type="checkbox"
                      className="sag-switch"
                      checked={createOrgOnSignup}
                      onChange={(e) => setCreateOrgOnSignup(e.target.checked)}
                    />
                  </label>

                  {createOrgOnSignup && (
                    <div className="sag-org-fields">
                      <label className="sag-field">
                        <span className="sag-label">Organization name</span>
                        <input
                          className="sag-input"
                          placeholder="Nova Labs"
                          value={orgName}
                          onChange={(e) => handleOrgNameChange(e.target.value)}
                        />
                      </label>
                      <div className="sag-slug">
                        <span className="sag-slug-prefix sag-mono">{cfg.appId}.appembly.dev/</span>
                        <input
                          className="sag-slug-input sag-mono"
                          value={orgSlug}
                          placeholder="nova-labs"
                          onChange={(e) =>
                            setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))
                          }
                        />
                      </div>
                      <div className="sag-ns-row">
                        <span className="sag-ns sag-mono" data-kind="live">
                          ns_live_{orgSlug || 'slug'}
                        </span>
                        <span className="sag-ns sag-mono" data-kind="test">
                          ns_test_{orgSlug || 'slug'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={busy} className="sag-btn sag-btn-primary">
                  {busy ? <span className="sag-spinner" /> : <Fingerprint size={16} />}
                  {busy ? 'Setting up your workspace…' : 'Create account with passkey'}
                </button>
                <p className="sag-legal">
                  By continuing you agree to the Appembly <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
                </p>
              </form>
            )}
          </>
        )}

        {error && <div className="sag-error">{error}</div>}
      </div>

      <div className="sag-foot">
        <span className="sag-secured">
          <SauthenIcon size={12} /> Secured by Sauthen
        </span>
        <span className="sag-mono">{clientId || `st_cli_${cfg.appId}`}</span>
      </div>
    </div>
  );
};

/* ============================================================================
   2. `<SauthenUserBadge />` — Drop-In Sidebar / Header Identity & Step-Up Widget
   ============================================================================ */

export interface SauthenUserBadgeProps {
  brand?: SauthenPresetApp | Partial<SauthenBrandConfig> | string;
  apiUrl?: string;
  namespace?: string;
  compact?: boolean;
  showOrgSwitcher?: boolean;
  onSwitchNamespace?: (orgSlug: string, namespace: string) => void;
  onSignInClick?: () => void;
}

export const SauthenUserBadge: React.FC<SauthenUserBadgeProps> = ({
  brand = 'sauthen',
  apiUrl = DEFAULT_SAUTHEN_API,
  namespace,
  compact = false,
  showOrgSwitcher = true,
  onSwitchNamespace,
}) => {
  const cfg = resolveBrandConfig(brand);
  const { session, user, organization, namespace: activeNS, orgs, pendingStepUps, refresh, signOut } =
    useSauthenSession(apiUrl, namespace);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<'account' | 'settings'>('account');
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setTitle(user.title || '');
    }
  }, [user]);

  const resolvedOrg =
    orgs.find(
      (o) =>
        o.meterbox_live_ns === activeNS ||
        o.meterbox_sandbox_ns === activeNS ||
        activeNS.endsWith(`_${o.slug}`),
    ) || organization;

  const initials = (user?.display_name || 'M B')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleCopyToken = () => {
    if (!session?.access_token) return;
    navigator.clipboard?.writeText(session.access_token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1600);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/auth/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          display_name: displayName,
          title,
          new_password: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to update profile');
      }
      if (session && data?.user) {
        saveSauthenSession({
          ...session,
          user: {
            ...session.user,
            display_name: data.user.display_name,
            title: data.user.title,
          },
        });
      }
      setNewPassword('');
      setFeedback({ tone: 'ok', text: 'Profile & security settings updated.' });
      refresh();
    } catch (err) {
      setFeedback({ tone: 'err', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative">
        <div
          style={{
            background: cfg.inputBg,
            borderColor: cfg.border,
            color: cfg.text,
          }}
          className="rounded-xl border p-2 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((prev) => !prev);
                setFeedback(null);
              }}
              className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
            >
              <span
                style={{ background: cfg.accent }}
                className="w-7 h-7 rounded-lg text-white text-[11px] font-bold flex items-center justify-center shrink-0"
              >
                {initials}
              </span>
              {!compact && (
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold truncate">
                    {user?.display_name || 'Authenticated User'}
                  </span>
                  <span
                    style={{ color: cfg.muted }}
                    className="block text-[10.5px] font-mono truncate"
                  >
                    {user?.email || resolvedOrg?.name || 'Appembly'}
                  </span>
                </span>
              )}
            </button>

            {pendingStepUps.length > 0 && (
              <button
                type="button"
                onClick={() => setStepUpOpen(true)}
                title={`${pendingStepUps.length} pending Sauthen Step-Up approval`}
                className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10.5px] font-mono font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ShieldAlert className="w-3 h-3" />
                <span>{pendingStepUps.length}</span>
              </button>
            )}

            <div className="flex items-center gap-0.5">
              {!compact && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((prev) => !prev);
                    setFeedback(null);
                  }}
                  style={{ color: cfg.muted }}
                  className="p-1 rounded-md hover:opacity-80 cursor-pointer"
                  title="Account & security settings"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                style={{ color: cfg.muted }}
                className="p-1 rounded-md hover:text-red-400 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Signed-In Account & Security Popover */}
        {menuOpen && user && (
          <div
            style={{
              background: cfg.cardBg,
              borderColor: cfg.border,
              color: cfg.text,
            }}
            className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border p-3 shadow-2xl space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2 pb-2 border-b" style={{ borderColor: cfg.border }}>
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold truncate">{user.display_name}</div>
                <div style={{ color: cfg.muted }} className="text-[11px] font-mono truncate">
                  {user.email}
                </div>
                {user.title && (
                  <div style={{ color: cfg.muted }} className="text-[10.5px] truncate mt-0.5">
                    {user.title}
                  </div>
                )}
              </div>
              <span
                style={{ background: cfg.accentSoft, color: cfg.accent }}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0"
              >
                {user.role || 'org:owner'}
              </span>
            </div>

            {/* Account vs Settings tab bar */}
            <div
              className="grid grid-cols-2 gap-1 rounded-lg p-1 border"
              style={{ borderColor: cfg.border, background: cfg.inputBg }}
            >
              <button
                type="button"
                onClick={() => {
                  setTab('account');
                  setFeedback(null);
                }}
                style={{
                  background: tab === 'account' ? cfg.cardBg : 'transparent',
                  color: tab === 'account' ? cfg.text : cfg.muted,
                }}
                className="h-6 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
              >
                <UserIcon className="w-3 h-3" />
                <span>Account</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('settings');
                  setFeedback(null);
                }}
                style={{
                  background: tab === 'settings' ? cfg.cardBg : 'transparent',
                  color: tab === 'settings' ? cfg.text : cfg.muted,
                }}
                className="h-6 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>Settings</span>
              </button>
            </div>

            {tab === 'account' ? (
              <>
                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between">
                    <span style={{ color: cfg.muted }}>Workspace</span>
                    <span className="font-semibold truncate max-w-[145px]">
                      {resolvedOrg?.name || 'Appembly'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: cfg.muted }}>Namespace</span>
                    <span style={{ color: cfg.accent }} className="font-semibold">
                      {activeNS}
                    </span>
                  </div>
                  {session?.access_token && (
                    <div className="pt-1 flex items-center justify-between gap-1.5">
                      <span style={{ color: cfg.muted }} className="text-[10px] truncate">
                        {session.access_token.slice(0, 18)}…
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyToken}
                        style={{ borderColor: cfg.border, color: cfg.text }}
                        className="px-1.5 py-0.5 rounded border text-[10px] inline-flex items-center gap-1 hover:opacity-80 cursor-pointer shrink-0"
                      >
                        {copiedToken ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>{copiedToken ? 'Copied' : 'Copy JWT'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {showOrgSwitcher && orgs.length > 1 && (
                  <div className="pt-1.5 border-t space-y-1" style={{ borderColor: cfg.border }}>
                    <div style={{ color: cfg.muted }} className="text-[10px] font-mono uppercase">
                      Switch Organization
                    </div>
                    {orgs.map((o) => {
                      const targetNs = o.meterbox_live_ns || `ns_live_${o.slug}`;
                      const isCurrent = o.slug === resolvedOrg?.slug;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            if (session) {
                              saveSauthenSession({
                                ...session,
                                organization: o,
                                namespace: targetNs,
                              });
                              refresh();
                            }
                            onSwitchNamespace?.(o.slug, targetNs);
                            setMenuOpen(false);
                          }}
                          style={{
                            background: isCurrent ? cfg.accentSoft : 'transparent',
                            color: isCurrent ? cfg.accent : cfg.text,
                          }}
                          className="w-full px-2 py-1 rounded-lg text-left text-[11.5px] flex items-center justify-between hover:opacity-90 cursor-pointer"
                        >
                          <span className="truncate font-medium">{o.name}</span>
                          <span className="font-mono text-[10px] opacity-80">{targetNs}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="pt-1.5 border-t space-y-1" style={{ borderColor: cfg.border }}>
                  <div style={{ color: cfg.muted }} className="text-[10px] font-mono uppercase">
                    Appembly Suite
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {cfg.appId !== 'sauthen' && (
                      <a
                        href="http://localhost:6020"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ borderColor: cfg.border, color: cfg.text }}
                        className="px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center justify-between hover:opacity-85"
                      >
                        <span>Sauthen</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}
                    {cfg.appId !== 'cyclode' && (
                      <a
                        href="http://localhost:6013"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ borderColor: cfg.border, color: cfg.text }}
                        className="px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center justify-between hover:opacity-85"
                      >
                        <span>Cyclode</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}
                    {cfg.appId !== 'meterbox' && (
                      <a
                        href="http://localhost:6070"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ borderColor: cfg.border, color: cfg.text }}
                        className="px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center justify-between hover:opacity-85"
                      >
                        <span>Meterbox</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center gap-1.5" style={{ borderColor: cfg.border }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-2 pt-1">
                <div>
                  <label style={{ color: cfg.muted }} className="block text-[10.5px] font-medium mb-0.5">
                    Display name
                  </label>
                  <input
                    style={{
                      background: cfg.inputBg,
                      borderColor: cfg.border,
                      color: cfg.text,
                    }}
                    className="w-full h-7 px-2 rounded-lg border text-[11.5px] outline-none"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ color: cfg.muted }} className="block text-[10.5px] font-medium mb-0.5">
                    Role / title
                  </label>
                  <input
                    style={{
                      background: cfg.inputBg,
                      borderColor: cfg.border,
                      color: cfg.text,
                    }}
                    className="w-full h-7 px-2 rounded-lg border text-[11.5px] outline-none"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Organization Owner"
                  />
                </div>
                <div>
                  <label style={{ color: cfg.muted }} className="block text-[10.5px] font-medium mb-0.5">
                    New password (optional)
                  </label>
                  <input
                    type="password"
                    style={{
                      background: cfg.inputBg,
                      borderColor: cfg.border,
                      color: cfg.text,
                    }}
                    className="w-full h-7 px-2 rounded-lg border text-[11.5px] outline-none"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                {feedback && (
                  <div
                    className={`rounded-lg px-2 py-1 text-[10.5px] ${
                      feedback.tone === 'ok'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {feedback.text}
                  </div>
                )}
                <div className="pt-1 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTab('account')}
                    style={{ borderColor: cfg.border, color: cfg.muted }}
                    className="h-7 px-2.5 rounded-lg border text-[11px] font-medium cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ background: cfg.accent }}
                    className="h-7 px-2.5 rounded-lg text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Inline Step-Up Approval Modal */}
      {stepUpOpen && (
        <SauthenStepUpModal
          brand={brand}
          apiUrl={apiUrl}
          namespace={activeNS}
          items={pendingStepUps}
          onClose={() => setStepUpOpen(false)}
          onResolved={() => refresh()}
        />
      )}
    </>
  );
};

/* ============================================================================
   3. `<SauthenStepUpModal />` — Inline Human-in-the-Loop Approval Gate
   ============================================================================ */

export interface SauthenStepUpModalProps {
  brand?: SauthenPresetApp | Partial<SauthenBrandConfig> | string;
  apiUrl?: string;
  namespace?: string;
  items: SauthenStepUpItem[];
  onClose: () => void;
  onResolved?: (stepUpToken?: string) => void;
}

export const SauthenStepUpModal: React.FC<SauthenStepUpModalProps> = ({
  brand = 'cyclode',
  apiUrl = DEFAULT_SAUTHEN_API,
  namespace = 'ns_live_appembly',
  items,
  onClose,
  onResolved,
}) => {
  const cfg = resolveBrandConfig(brand);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mintedGrant, setMintedGrant] = useState<string | null>(null);

  const resolveItem = async (id: string, decision: 'approved' | 'rejected') => {
    setBusyId(id);
    try {
      const stored = loadSauthenSession();
      const targetNs = stored?.namespace || namespace;
      const approverId = stored?.user?.id || 'usr_authenticated';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-OpenMeter-Namespace': targetNs,
      };
      if (stored?.access_token) {
        headers.Authorization = `Bearer ${stored.access_token}`;
      }
      const res = await fetch(`${apiUrl}/api/broker/v1/step-up/${id}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          decision,
          approver_user_id: approverId,
        }),
      });
      const data = await res.json();
      if (data?.step_up_token) {
        setMintedGrant(data.step_up_token);
      }
      onResolved?.(data?.step_up_token);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: cfg.cardBg,
          color: cfg.text,
          borderColor: cfg.border,
        }}
        className="w-full max-w-[480px] rounded-2xl border shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[14.5px] font-bold">Sauthen Step-Up Approval Required</div>
              <div style={{ color: cfg.muted }} className="text-[11.5px]">
                Autonomous agent paused on a gated action in {namespace}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ color: cfg.muted }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {mintedGrant && (
          <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[12px] font-mono break-all">
            Minted single-use grant: {mintedGrant}
          </div>
        )}

        <div className="space-y-3 max-h-[340px] overflow-y-auto">
          {items.length === 0 ? (
            <div style={{ color: cfg.muted }} className="py-6 text-center text-[12.5px]">
              All step-up interrupts resolved.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                style={{ background: cfg.inputBg, borderColor: cfg.border }}
                className="p-3.5 rounded-xl border space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[11px] font-semibold">
                    {item.action}
                  </span>
                  <span style={{ color: cfg.muted }} className="font-mono text-[11px]">
                    {item.persona} · {item.task_id}
                  </span>
                </div>
                <div className="text-[13px] font-semibold">{item.target_resource}</div>
                <p style={{ color: cfg.muted }} className="text-[12px]">
                  {item.reason}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => resolveItem(item.id, 'approved')}
                    className="flex-1 h-8 rounded-lg bg-amber-500 text-black text-[12px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Mint st_stepup_*</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => resolveItem(item.id, 'rejected')}
                    style={{ borderColor: cfg.border }}
                    className="px-3 h-8 rounded-lg border text-[12px] font-semibold text-red-400"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   Shared styling for the auth card & gate (scoped `sag-*` classes, no Tailwind
   dependency so it renders identically in Next.js and Vite hosts)
   ============================================================================ */

function readableOn(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#FFFFFF';
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.22 ? '#0A0C10' : '#FFFFFF';
}

function brandCssVars(cfg: SauthenBrandConfig): React.CSSProperties {
  return {
    '--sag-accent': cfg.accent,
    '--sag-accent-soft': cfg.accentSoft,
    '--sag-on-accent': readableOn(cfg.accent),
    '--sag-surface': cfg.surface,
    '--sag-card': cfg.cardBg,
    '--sag-input': cfg.inputBg,
    '--sag-border': cfg.border,
    '--sag-text': cfg.text,
    '--sag-muted': cfg.muted,
    '--sag-shadow':
      cfg.theme === 'dark'
        ? '0 0 0 1px rgba(255,255,255,0.02), 0 30px 80px -30px rgba(0,0,0,0.85)'
        : '0 1px 2px rgba(16,24,20,0.04), 0 24px 56px -28px rgba(16,24,20,0.22)',
  } as React.CSSProperties;
}

const GitHubMark: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const GoogleMark: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const SAG_CSS = `
.sag-card,.sag-gate{--sag-faint:color-mix(in srgb,var(--sag-muted) 72%,transparent);--sag-border-strong:color-mix(in srgb,var(--sag-text) 20%,var(--sag-border));--sag-mono:var(--font-code,ui-monospace,SFMono-Regular,'JetBrains Mono',Menlo,monospace);--sag-display:var(--font-head,var(--font-display,inherit));-webkit-font-smoothing:antialiased}
.sag-card *,.sag-gate *{box-sizing:border-box}
.sag-mono{font-family:var(--sag-mono);letter-spacing:0}
@keyframes sag-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes sag-spin{to{transform:rotate(360deg)}}
@keyframes sag-dash{to{stroke-dashoffset:-24}}
@keyframes sag-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.sag-fade{animation:sag-in .28s ease both}

/* ---------- card ---------- */
.sag-card{width:100%;max-width:420px;background:var(--sag-card);color:var(--sag-text);border:1px solid var(--sag-border);border-radius:20px;box-shadow:var(--sag-shadow);overflow:hidden;font-size:13.5px;line-height:1.45}
.sag-body{padding:28px 28px 22px}
.sag-head{display:flex;align-items:center;justify-content:space-between}
.sag-logo{width:40px;height:40px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:var(--sag-accent);color:var(--sag-on-accent);box-shadow:0 10px 26px -12px var(--sag-accent),inset 0 1px 0 rgba(255,255,255,.18);flex-shrink:0}
.sag-icon-btn{width:30px;height:30px;border-radius:9px;border:0;background:transparent;color:var(--sag-muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.sag-icon-btn:hover{background:var(--sag-input);color:var(--sag-text)}
.sag-h{font-family:var(--sag-display);font-size:22px;font-weight:650;letter-spacing:-.022em;line-height:1.2;margin:18px 0 6px}
.sag-sub{margin:0;color:var(--sag-muted);font-size:13.5px}
.sag-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;margin-top:20px;background:var(--sag-input);border:1px solid var(--sag-border);border-radius:12px}
.sag-seg button{display:flex;align-items:center;justify-content:center;text-align:center;height:32px;border:0;border-radius:9px;background:transparent;color:var(--sag-muted);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s}
.sag-seg button:hover{color:var(--sag-text)}
.sag-seg button[data-active=true]{background:var(--sag-card);color:var(--sag-text);box-shadow:0 1px 2px rgba(0,0,0,.14),0 0 0 1px var(--sag-border)}
.sag-stack{display:flex;flex-direction:column;gap:10px;margin-top:20px}
.sag-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sag-btn{width:100%;height:42px;padding:0 14px;border-radius:11px;border:1px solid var(--sag-border);background:var(--sag-input);color:var(--sag-text);font:inherit;font-size:13px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,filter .15s,transform .06s}
.sag-btn:hover{border-color:var(--sag-border-strong)}
.sag-btn:active{transform:translateY(1px)}
.sag-btn:disabled{opacity:.6;cursor:progress}
.sag-btn:focus-visible,.sag-seg button:focus-visible,.sag-chip:focus-visible{outline:2px solid var(--sag-accent);outline-offset:2px}
.sag-btn-primary{background:var(--sag-accent);border-color:transparent;color:var(--sag-on-accent);box-shadow:0 10px 24px -14px var(--sag-accent),inset 0 1px 0 rgba(255,255,255,.16)}
.sag-btn-primary:hover{filter:brightness(1.07);border-color:transparent}
.sag-btn-passkey{height:44px;background:var(--sag-accent-soft);border-color:color-mix(in srgb,var(--sag-accent) 42%,transparent);color:var(--sag-text)}
.sag-btn-passkey svg{color:var(--sag-accent)}
.sag-btn-passkey:hover{border-color:var(--sag-accent)}
.sag-divider{display:flex;align-items:center;gap:12px;margin:20px 0 16px;color:var(--sag-faint);font-size:11.5px}
.sag-divider:before,.sag-divider:after{content:'';flex:1;height:1px;background:var(--sag-border)}
.sag-form{display:flex;flex-direction:column;gap:14px;margin-top:20px}
.sag-divider + .sag-form{margin-top:0}
.sag-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.sag-label{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:600;color:var(--sag-text)}
.sag-link{border:0;background:none;padding:0;font:inherit;font-size:12px;font-weight:500;color:var(--sag-accent);cursor:pointer}
.sag-link:hover{text-decoration:underline}
.sag-input-wrap{position:relative;display:block}
.sag-input-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--sag-faint);pointer-events:none}
.sag-input{width:100%;height:42px;padding:0 12px;border-radius:10px;border:1px solid var(--sag-border);background:var(--sag-input);color:var(--sag-text);font:inherit;font-size:13.5px;outline:none;transition:border-color .15s,box-shadow .15s,background .15s}
.sag-input-iconed{padding-left:36px}
.sag-input::placeholder{color:var(--sag-faint)}
.sag-input:hover{border-color:var(--sag-border-strong)}
.sag-input:focus{border-color:var(--sag-accent);box-shadow:0 0 0 3px var(--sag-accent-soft);background:var(--sag-card)}
.sag-sso-link{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:14px;border:0;background:none;color:var(--sag-muted);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer}
.sag-sso-link:hover{color:var(--sag-text)}
.sag-demo{margin-top:18px;padding-top:16px;border-top:1px dashed var(--sag-border)}
.sag-demo-btn{width:100%;min-height:42px;padding:8px 12px;border-radius:11px;border:1px solid color-mix(in srgb,var(--sag-accent) 38%,var(--sag-border));background:var(--sag-accent-soft);color:var(--sag-text);font:inherit;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;transition:border-color .15s,filter .15s,transform .06s}
.sag-demo-btn:hover{border-color:var(--sag-accent);filter:brightness(1.05)}
.sag-demo-btn:active{transform:translateY(1px)}
.sag-demo-btn:disabled{opacity:.6;cursor:progress}
.sag-demo-btn-left{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:650}
.sag-demo-btn-left svg{color:var(--sag-accent);flex-shrink:0}
.sag-demo-btn-meta{font-size:10.5px;color:var(--sag-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sag-org{border:1px solid var(--sag-border);border-radius:12px;background:var(--sag-input);overflow:hidden;transition:border-color .15s}
.sag-org[data-open=true]{border-color:color-mix(in srgb,var(--sag-accent) 35%,var(--sag-border))}
.sag-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;cursor:pointer}
.sag-toggle-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.sag-toggle-title{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600}
.sag-toggle-title svg{color:var(--sag-accent)}
.sag-toggle-sub{font-size:11.5px;color:var(--sag-muted)}
.sag-switch{appearance:none;-webkit-appearance:none;width:34px;height:20px;border-radius:999px;background:var(--sag-border-strong);position:relative;cursor:pointer;flex-shrink:0;transition:background .18s;margin:0}
.sag-switch:after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .18s}
.sag-switch:checked{background:var(--sag-accent)}
.sag-switch:checked:after{transform:translateX(14px)}
.sag-org-fields{display:flex;flex-direction:column;gap:10px;padding:0 14px 14px;animation:sag-in .22s ease both}
.sag-org-fields .sag-input{background:var(--sag-card)}
.sag-slug{display:flex;align-items:center;height:36px;border:1px solid var(--sag-border);border-radius:9px;background:var(--sag-card);overflow:hidden;font-size:12px}
.sag-slug-prefix{padding:0 4px 0 10px;color:var(--sag-faint);white-space:nowrap}
.sag-slug-input{flex:1;min-width:0;height:100%;border:0;background:transparent;color:var(--sag-text);font-size:12px;outline:none;padding-right:10px}
.sag-slug:focus-within{border-color:var(--sag-accent);box-shadow:0 0 0 3px var(--sag-accent-soft)}
.sag-ns-row{display:flex;flex-wrap:wrap;gap:6px}
.sag-ns{font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid var(--sag-border);color:var(--sag-muted);background:var(--sag-card)}
.sag-ns[data-kind=live]{color:var(--sag-accent);border-color:color-mix(in srgb,var(--sag-accent) 40%,var(--sag-border))}
.sag-legal{margin:-2px 0 0;text-align:center;font-size:11.5px;color:var(--sag-faint)}
.sag-legal a{color:var(--sag-muted);text-decoration:underline;text-underline-offset:2px}
.sag-error{margin-top:14px;padding:10px 12px;border-radius:10px;border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.08);color:#EF4444;font-size:12.5px}
.sag-back{display:inline-flex;align-items:center;gap:6px;margin-top:16px;border:0;background:none;padding:0;color:var(--sag-muted);font:inherit;font-size:12.5px;cursor:pointer}
.sag-back:hover{color:var(--sag-text)}
.sag-back + .sag-h{margin-top:10px}
.sag-idps{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;margin-top:16px;font-size:11.5px;color:var(--sag-faint)}
.sag-success{text-align:center;padding:6px 0 4px}
.sag-success-icon{width:48px;height:48px;margin:18px auto 0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--sag-accent-soft);color:var(--sag-accent);box-shadow:0 0 0 6px color-mix(in srgb,var(--sag-accent) 8%,transparent)}
.sag-success .sag-h{margin-top:14px}
.sag-token{display:flex;align-items:center;gap:8px;margin:18px 0;padding:8px 10px;border:1px solid var(--sag-border);border-radius:10px;background:var(--sag-input);text-align:left;overflow:hidden}
.sag-token code{font-size:11px;color:var(--sag-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sag-token-tag{font-family:var(--sag-mono);font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:var(--sag-accent-soft);color:var(--sag-accent);flex-shrink:0}
.sag-redirecting{display:flex;align-items:center;justify-content:center;gap:8px;color:var(--sag-muted);font-size:12.5px}
.sag-spinner{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:sag-spin .7s linear infinite;flex-shrink:0;opacity:.85}
.sag-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 28px;border-top:1px solid var(--sag-border);background:var(--sag-input);color:var(--sag-faint);font-size:11px}
.sag-secured{display:inline-flex;align-items:center;gap:6px;font-weight:500}
.sag-switcher{display:flex;align-items:center;justify-content:space-between;gap:2px;padding:8px 12px;border-bottom:1px solid var(--sag-border);background:var(--sag-input);overflow-x:auto;scrollbar-width:none}
.sag-switcher::-webkit-scrollbar{display:none}
.sag-switcher-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--sag-faint);margin-right:2px;white-space:nowrap;flex-shrink:0}
.sag-switcher button{border:1px solid transparent;background:transparent;color:var(--sag-muted);font:inherit;font-size:11px;font-weight:600;text-transform:capitalize;padding:3px 6px;border-radius:7px;cursor:pointer;white-space:nowrap;flex-shrink:0}
.sag-switcher button[data-active=true]{border-color:var(--sag-accent);background:var(--sag-accent-soft);color:var(--sag-accent)}

/* ---------- gate ---------- */
.sag-gate{min-height:100vh;width:100%;display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);background:var(--sag-surface);color:var(--sag-text)}
.sag-hero{position:relative;overflow:hidden;display:flex;flex-direction:column;padding:36px clamp(32px,4.5vw,64px) 32px;border-right:1px solid var(--sag-border);background:var(--sag-hero,var(--sag-surface))}
.sag-hero-bg{position:absolute;inset:0;pointer-events:none}
.sag-hero > *:not(.sag-hero-bg){position:relative}
.sag-brand{display:flex;align-items:center;gap:10px}
.sag-brand .sag-logo{width:32px;height:32px;border-radius:9px}
.sag-brand-name{font-family:var(--sag-display);font-size:16px;font-weight:650;letter-spacing:-.01em}
.sag-brand-by{font-size:12px;color:var(--sag-faint)}
.sag-hero-main{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:600px;padding:40px 0}
.sag-eyebrow{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--sag-accent);padding:4px 10px 4px 8px;border-radius:999px;background:var(--sag-accent-soft);border:1px solid color-mix(in srgb,var(--sag-accent) 25%,transparent)}
.sag-eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--sag-accent);animation:sag-pulse 2s ease-in-out infinite}
.sag-hero-h{font-family:var(--sag-display);font-size:clamp(30px,3.3vw,46px);line-height:1.06;letter-spacing:-.035em;font-weight:700;margin:18px 0 14px;text-wrap:balance}
.sag-hero-p{font-size:15px;line-height:1.6;color:var(--sag-muted);margin:0;max-width:520px;text-wrap:pretty}
.sag-visual{margin-top:34px}
.sag-proof{display:flex;flex-wrap:wrap;gap:8px 22px;list-style:none;margin:0;padding:20px 0 0;border-top:1px solid var(--sag-border);font-size:12.5px;color:var(--sag-muted)}
.sag-proof li{display:inline-flex;align-items:center;gap:7px}
.sag-proof svg{color:var(--sag-accent)}
.sag-pane{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:40px 24px}
.sag-pane-top{position:absolute;top:24px;left:24px;right:24px;display:flex;align-items:center;justify-content:space-between}
.sag-mobile-brand{display:none}
.sag-pane-hint{font-size:12px;color:var(--sag-faint);text-align:center;max-width:360px;margin:0}
.sag-blank{min-height:100vh;width:100%;background:var(--sag-surface)}
@media (max-width:1020px){.sag-gate{grid-template-columns:1fr}.sag-hero{display:none}.sag-mobile-brand{display:flex}.sag-gate .sag-head{display:none}.sag-gate .sag-body > .sag-h:first-of-type{margin-top:0}.sag-pane{justify-content:flex-start;padding-top:32px}}
@media (max-width:480px){.sag-body{padding:22px 18px 18px}.sag-foot{padding:10px 18px}.sag-pane{padding:24px 12px}.sag-demo-row{grid-template-columns:1fr}}

/* per-app hero atmospheres */
.sag-app-cyclode{--sag-hero:#1D2026}
.sag-app-cyclode .sag-logo,.sag-card[data-app="cyclode"] .sag-logo{background:#2C313A;border:1px solid #3E4451;box-shadow:0 8px 20px -10px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06)}
.sag-app-cyclode .sag-hero-bg{background:radial-gradient(700px 420px at 0% 0%,rgba(229,192,123,.14),transparent 62%),radial-gradient(500px 360px at 100% 100%,rgba(152,195,121,.08),transparent 60%),linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:auto,auto,32px 32px,32px 32px;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent)}
.sag-app-meterbox{--sag-hero:#ECEFEA}
.sag-app-meterbox .sag-hero-bg{background:radial-gradient(640px 420px at 100% 0%,rgba(78,128,103,.16),transparent 60%),radial-gradient(rgba(17,22,24,.09) 1px,transparent 1px);background-size:auto,18px 18px}
.sag-app-sauthen{--sag-hero:#07080D}
.sag-app-sauthen .sag-hero-bg{background:radial-gradient(640px 440px at 12% 8%,rgba(143,128,255,.2),transparent 60%),radial-gradient(420px 320px at 92% 88%,rgba(247,170,46,.1),transparent 60%)}

/* cyclode terminal */
.sag-term{position:relative;margin-bottom:40px;border-radius:14px;border:1px solid #3E4451;background:#21252B;box-shadow:0 40px 80px -40px rgba(0,0,0,.9),0 0 0 1px rgba(229,192,123,.08);font-family:var(--sag-mono);font-size:12px;line-height:1.75;max-width:560px}
.sag-term-bar{display:flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:1px solid #31363F;color:#5C6370;font-size:11px}
.sag-term-bar i{width:10px;height:10px;border-radius:50%;background:#3E4451}
.sag-term-bar span{margin-left:8px;color:#94A3B8}
.sag-term-body{padding:14px 16px 18px;color:#CBD5E1}
.sag-term-line{display:flex;gap:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:sag-in .4s ease both}
.sag-term-line b{font-weight:500;width:12px;flex-shrink:0;text-align:center}
.sag-term-dim{color:#5C6370}
.sag-ok{color:#98C379}.sag-run{color:#61AFEF}.sag-wait{color:#E5C07B}
.sag-stepup{position:absolute;right:-28px;bottom:-48px;width:250px;padding:12px 14px;border-radius:12px;background:#282C34;border:1px solid rgba(229,192,123,.4);box-shadow:0 24px 50px -20px rgba(0,0,0,.9);font-family:inherit;animation:sag-in .5s ease 1.6s both}
.sag-stepup-k{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#E5C07B;display:flex;align-items:center;gap:6px}
.sag-stepup-t{font-size:12.5px;color:#F1F5F9;margin:6px 0 10px;font-weight:600}
.sag-stepup-a{display:grid;grid-template-columns:1fr auto;gap:6px}
.sag-stepup-a span{height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700}

/* meterbox usage */
.sag-mb{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;max-width:580px}
.sag-mb-card{background:#FFFFFF;border:1px solid #DCE0DC;border-radius:14px;padding:16px;box-shadow:0 1px 2px rgba(16,24,20,.04),0 20px 40px -28px rgba(16,24,20,.25)}
.sag-mb-k{font-size:11.5px;color:#5A625E;font-weight:500}
.sag-mb-v{font-family:var(--sag-display);font-size:28px;font-weight:700;letter-spacing:-.03em;margin:4px 0 2px;font-variant-numeric:tabular-nums}
.sag-mb-delta{display:inline-flex;font-size:11px;font-weight:600;color:#3F7A5A;background:rgba(78,128,103,.12);padding:1px 7px;border-radius:999px}
.sag-mb-bars{display:flex;align-items:flex-end;gap:3px;height:76px;margin-top:14px}
.sag-mb-bars span{flex:1;border-radius:3px 3px 1px 1px;background:rgba(78,128,103,.28);animation:sag-in .5s ease both}
.sag-mb-bars span:last-child{background:#4E8067}
.sag-mb-row{display:flex;flex-direction:column;gap:5px;padding:9px 0;border-bottom:1px solid #EEF0ED}
.sag-mb-row:last-child{border-bottom:0;padding-bottom:0}
.sag-mb-row-top{display:flex;justify-content:space-between;font-size:12px;font-weight:600}
.sag-mb-row-top em{font-style:normal;font-weight:500;color:#5A625E;font-variant-numeric:tabular-nums}
.sag-mb-track{height:6px;border-radius:999px;background:#EEF0ED;overflow:hidden}
.sag-mb-track i{display:block;height:100%;border-radius:999px}
.sag-mb-inv{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px}
.sag-mb-inv strong{font-family:var(--sag-display);font-size:16px;font-variant-numeric:tabular-nums}

/* sauthen trust graph */
.sag-tg{max-width:580px}
.sag-tg-canvas{position:relative;height:220px;border-radius:16px;border:1px solid rgba(255,255,255,.07);background:linear-gradient(180deg,rgba(16,17,26,.85),rgba(10,11,17,.85));overflow:hidden}
.sag-tg-canvas > svg{position:absolute;inset:0;width:100%;height:100%}
.sag-tg-ico svg{width:14px;height:14px;flex-shrink:0}
.sag-tg-edge{fill:none;stroke-width:1.5;stroke-dasharray:4 4;animation:sag-dash 1.4s linear infinite}
.sag-tg-node{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:9px;padding:8px 11px 8px 8px;border-radius:12px;background:#12131D;border:1px solid #2A2C40;white-space:nowrap;box-shadow:0 14px 30px -18px rgba(0,0,0,.9);animation:sag-in .5s ease both}
.sag-tg-ico{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sag-tg-name{font-size:12px;font-weight:600;color:#ECECF6;line-height:1.2}
.sag-tg-meta{font-family:var(--sag-mono);font-size:10px;color:#9698B2}
.sag-tg-ticket{margin-top:12px;display:grid;grid-template-columns:auto 1fr;gap:4px 14px;padding:12px 14px;border-radius:12px;border:1px dashed rgba(143,128,255,.35);background:rgba(143,128,255,.05);font-family:var(--sag-mono);font-size:11px}
.sag-tg-ticket dt{color:#6E7090}
.sag-tg-ticket dd{margin:0;color:#D6D6EA;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;

/* ============================================================================
   Per-app hero visuals
   ============================================================================ */

const CyclodeHeroVisual: React.FC = () => {
  const lines: Array<{ icon: string; cls: string; text: React.ReactNode }> = [
    { icon: '$', cls: 'sag-term-dim', text: <span>cyclode run &quot;Fix flaky checkout test&quot; --repo demo-ai/web</span> },
    { icon: '✓', cls: 'sag-ok', text: <span>sandbox <span className="sag-term-dim">sbx_7f2a</span> ready · node 22 · 4 vCPU</span> },
    { icon: '✓', cls: 'sag-ok', text: <span>minted <span className="sag-term-dim">st_agt_…9c1</span> · repo:write llm:invoke · 15m</span> },
    { icon: '●', cls: 'sag-run', text: <span>planner   3 steps · worker editing cart.test.ts <span className="sag-term-dim">+12 −4</span></span> },
    { icon: '✓', cls: 'sag-ok', text: <span>tests     48 passed <span className="sag-term-dim">in 11.2s</span></span> },
    { icon: '◐', cls: 'sag-wait', text: <span>git push origin fix/flaky-checkout · <span className="sag-wait">awaiting approval</span></span> },
  ];
  return (
    <div className="sag-term">
      <div className="sag-term-bar">
        <i />
        <i />
        <i />
        <span>session · fix-flaky-checkout-test</span>
      </div>
      <div className="sag-term-body">
        {lines.map((l, i) => (
          <div key={i} className="sag-term-line" style={{ animationDelay: `${0.15 + i * 0.22}s` }}>
            <b className={l.cls}>{l.icon}</b>
            {l.text}
          </div>
        ))}
      </div>
      <div className="sag-stepup">
        <div className="sag-stepup-k">
          <ShieldAlert size={12} /> Approval required
        </div>
        <div className="sag-stepup-t">git_push → demo-ai/web:main</div>
        <div className="sag-stepup-a">
          <span style={{ background: '#F5B547', color: '#1A1205' }}>Approve</span>
          <span style={{ padding: '0 12px', border: '1px solid #2A323D', color: '#C9D3DF' }}>Deny</span>
        </div>
      </div>
    </div>
  );
};

const MeterboxHeroVisual: React.FC = () => {
  const bars = [18, 22, 20, 26, 31, 28, 34, 30, 38, 42, 36, 44, 49, 46, 52, 58, 54, 61, 66, 63, 70, 76, 72, 84];
  const customers = [
    { name: 'Demo AI', used: '820K / 1M', pct: 82, color: '#D49A2A' },
    { name: 'Northwind', used: '460K / 1M', pct: 46, color: '#4E8067' },
    { name: 'Globex', used: '230K / 1M', pct: 23, color: '#4E8067' },
  ];
  return (
    <div className="sag-mb" style={{ color: '#111618' }}>
      <div className="sag-mb-card">
        <div className="sag-mb-k">LLM tokens metered · October</div>
        <div className="sag-mb-v">7,412,380</div>
        <span className="sag-mb-delta">+12.4% vs last month</span>
        <div className="sag-mb-bars">
          {bars.map((h, i) => (
            <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.025}s` }} />
          ))}
        </div>
      </div>
      <div className="sag-mb-card">
        <div className="sag-mb-k">Entitlements</div>
        {customers.map((c) => (
          <div key={c.name} className="sag-mb-row">
            <div className="sag-mb-row-top">
              <span>{c.name}</span>
              <em>{c.used}</em>
            </div>
            <div className="sag-mb-track">
              <i style={{ width: `${c.pct}%`, background: c.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="sag-mb-card sag-mb-inv">
        <div>
          <div className="sag-mb-k">Draft invoice · Demo AI</div>
          <div style={{ fontSize: 12, color: '#5A625E', marginTop: 2 }} className="sag-mono">
            in_2026_10_demo · closes Oct 31
          </div>
        </div>
        <strong>$650.12</strong>
      </div>
    </div>
  );
};

const SauthenHeroVisual: React.FC = () => {
  const nodes = [
    { x: 17, y: 50, name: 'Ken M.', meta: 'passkey · st_sess', bg: 'rgba(143,128,255,.16)', fg: '#8F80FF', icon: <UserIcon size={14} />, delay: 0.1 },
    { x: 44, y: 50, name: 'cyclode-worker', meta: 'st_agt · 15m', bg: 'rgba(56,189,248,.14)', fg: '#38BDF8', icon: <Terminal size={14} />, delay: 0.3 },
    { x: 74, y: 24, name: 'demo-ai/web', meta: 'repo:write', bg: 'rgba(255,255,255,.06)', fg: '#ECECF6', icon: <GitHubMark />, delay: 0.5 },
    { x: 74, y: 76, name: 'Anthropic key', meta: 'vault · AES-GCM', bg: 'rgba(247,170,46,.14)', fg: '#F7AA2E', icon: <KeyRound size={14} />, delay: 0.7 },
  ];
  return (
    <div className="sag-tg">
      <div className="sag-tg-canvas">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="sag-tg-edge" d="M17 50 L44 50" stroke="#8F80FF" vectorEffect="non-scaling-stroke" />
          <path className="sag-tg-edge" d="M44 50 C 58 50, 60 24, 74 24" stroke="#38BDF8" vectorEffect="non-scaling-stroke" />
          <path className="sag-tg-edge" d="M44 50 C 58 50, 60 76, 74 76" stroke="#F7AA2E" vectorEffect="non-scaling-stroke" />
        </svg>
        {nodes.map((n) => (
          <div key={n.name} className="sag-tg-node" style={{ left: `${n.x}%`, top: `${n.y}%`, animationDelay: `${n.delay}s` }}>
            <span className="sag-tg-ico" style={{ background: n.bg, color: n.fg }}>
              {n.icon}
            </span>
            <span>
              <div className="sag-tg-name">{n.name}</div>
              <div className="sag-tg-meta">{n.meta}</div>
            </span>
          </div>
        ))}
      </div>
      <dl className="sag-tg-ticket">
        <dt>sub</dt>
        <dd>usr_alice_dev</dd>
        <dt>act</dt>
        <dd>{'{ sub: agt_cyclode_worker }'}</dd>
        <dt>scope</dt>
        <dd>repo:write llm:invoke meterbox:ingest</dd>
        <dt>om_ns</dt>
        <dd style={{ color: '#F7AA2E' }}>ns_live_demo</dd>
      </dl>
    </div>
  );
};

/* ============================================================================
   4. `<SauthenAuthGuard />` — Pattern A: Strict Branded Auth Gate
   ============================================================================ */

export interface SauthenAuthGuardProps {
  brand?: SauthenPresetApp | Partial<SauthenBrandConfig> | string;
  apiUrl?: string;
  namespace?: string;
  initialMode?: SauthenAuthMode;
  onAuthenticated?: (payload: SauthenAuthPayload) => void;
  children: React.ReactNode;
}

const GATE_HERO: Record<
  string,
  { eyebrow: string; headline: string; body: string; proof: string[]; Visual: React.FC }
> = {
  cyclode: {
    eyebrow: 'Autonomous engineering workstation',
    headline: 'Hand off the ticket. Review the pull request.',
    body: 'Cyclode runs coding agents in isolated sandboxes with scoped, short-lived credentials — and pauses for your approval before anything reaches main.',
    proof: ['Isolated sandbox per task', '15-minute scoped agent tokens', 'Human approval on push & merge'],
    Visual: CyclodeHeroVisual,
  },
  meterbox: {
    eyebrow: 'Usage metering & billing',
    headline: 'Meter every token. Bill every customer.',
    body: 'Real-time usage ingestion, pre-flight entitlement checks and invoice-ready ledgers for AI products — isolated per organization, live and test.',
    proof: ['Sub-5ms entitlement checks', 'Live & test namespaces per org', 'Invoice-ready usage ledger'],
    Visual: MeterboxHeroVisual,
  },
  sauthen: {
    eyebrow: 'Identity for humans & agents',
    headline: 'Know exactly who — and what — is acting for you.',
    body: 'Passkeys for people, delegated short-lived tokens for agents, an encrypted vault for provider keys, and step-up approval for anything risky.',
    proof: ['Ed25519 OIDC sessions', 'RFC 8693 agent delegation', 'AES-256-GCM secret vault'],
    Visual: SauthenHeroVisual,
  },
};

export const SauthenAuthGuard: React.FC<SauthenAuthGuardProps> = ({
  brand = 'sauthen',
  apiUrl = DEFAULT_SAUTHEN_API,
  namespace = 'ns_live_appembly',
  initialMode = 'signin',
  onAuthenticated,
  children,
}) => {
  const cfg = resolveBrandConfig(brand);
  const { session, authenticated, refresh } = useSauthenSession(apiUrl, namespace);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid SSR/localStorage hydration mismatch: render a neutral surface until mounted.
  if (!mounted) {
    return <div className="sag-blank" style={{ minHeight: '100vh', background: cfg.surface }} />;
  }
  if (authenticated) {
    return <React.Fragment key={session?.user?.id || 'authenticated'}>{children}</React.Fragment>;
  }

  const hero = GATE_HERO[cfg.appId] || GATE_HERO.sauthen;
  const Visual = hero.Visual;

  return (
    <div className={`sag-gate sag-app-${cfg.appId}`} data-theme={cfg.theme} style={brandCssVars(cfg)}>
      <style dangerouslySetInnerHTML={{ __html: SAG_CSS }} />

      <aside className="sag-hero">
        <div className="sag-hero-bg" aria-hidden="true" />
        <div className="sag-brand">
          <span className="sag-logo">{cfg.icon}</span>
          <span className="sag-brand-name">{cfg.appName}</span>
          <span className="sag-brand-by">by Appembly</span>
        </div>

        <div className="sag-hero-main">
          <span className="sag-eyebrow">
            <i />
            {hero.eyebrow}
          </span>
          <h1 className="sag-hero-h">{hero.headline}</h1>
          <p className="sag-hero-p">{hero.body}</p>
          <div className="sag-visual">
            <Visual />
          </div>
        </div>

        <ul className="sag-proof">
          {hero.proof.map((p) => (
            <li key={p}>
              <Check size={14} strokeWidth={2.5} />
              {p}
            </li>
          ))}
        </ul>
      </aside>

      <main className="sag-pane">
        <div className="sag-mobile-brand sag-brand">
          <span className="sag-logo">{cfg.icon}</span>
          <span className="sag-brand-name">{cfg.appName}</span>
        </div>
        <SauthenAuthCard
          brand={brand}
          initialMode={initialMode}
          apiUrl={apiUrl}
          namespace={namespace}
          onSuccess={(payload) => {
            refresh();
            onAuthenticated?.(payload);
          }}
        />
        <p className="sag-pane-hint">One Appembly account works across Cyclode, Meterbox and Sauthen.</p>
      </main>
    </div>
  );
};
