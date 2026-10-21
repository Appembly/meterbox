"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Environment, Organization } from "../types/meterbox";
import { apiGet } from "./lib/api";
import {
  EMPTY_SNAPSHOT,
  EntitlementUsage,
  Snapshot,
  normalizeEntitlementValue,
  normalizeEnvironments,
  normalizeOrganizations,
  normalizeSnapshot,
} from "./lib/normalize";

export type ConsoleEnv = Environment & { name: string; rate_limit_rps: number };
export type LoadStatus = "loading" | "ready" | "error";

const POLL_MS = 8000;
const CTX_STORAGE_KEY = "mbx.console.ctx";

// Module-level caches so navigating or switching contexts never flashes skeletons unnecessarily.
let CACHED_ORGS: Organization[] | null = null;
let CACHED_ENVS: ConsoleEnv[] | null = null;
const SNAPSHOT_CACHE = new Map<string, { snap: Snapshot; usage: EntitlementUsage[]; ts: number }>();

function inferNamespace(orgSlug: string, envSlug: string): string {
  const o = orgSlug.toLowerCase();
  const isSandbox = envSlug.toLowerCase().includes("sandbox") || envSlug.toLowerCase().includes("test");
  if (o.includes("acme")) return isSandbox ? "ns_test_acme" : "ns_live_acme";
  if (o.includes("appembly")) return isSandbox ? "ns_test_appembly" : "ns_live_appembly";
  return isSandbox ? `ns_test_${o}` : `ns_live_${o}`;
}

function parseSectionFromPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  // /[org]/[env]/[section]
  return parts[2] || "overview";
}

interface ConsoleContextValue {
  orgs: Organization[];
  envs: ConsoleEnv[];
  org: Organization | null;
  env: ConsoleEnv | null;
  orgEnvs: ConsoleEnv[];
  namespace: string;
  isSandbox: boolean;
  snapshot: Snapshot;
  entitlementUsage: EntitlementUsage[];
  status: LoadStatus;
  connected: boolean;
  lastUpdated: number | null;
  section: string;
  searchParamsStr: string;
  refresh: () => void;
  /** Build an in-console href for the current org/env, e.g. href("overview"). */
  href: (route: string) => string;
  /** Instant 0ms client-side navigation that also updates the URL bar. */
  navigate: (route: string) => void;
  switchContext: (orgSlug: string, envSlug: string) => void;
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function useConsole(): ConsoleContextValue {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used inside <ConsoleProvider>");
  return ctx;
}

export function rememberContext(orgSlug: string, envSlug: string) {
  try {
    localStorage.setItem(CTX_STORAGE_KEY, JSON.stringify({ orgSlug, envSlug }));
  } catch {
    /* storage unavailable */
  }
}

export function recallContext(): { orgSlug: string; envSlug: string } | null {
  try {
    const raw = localStorage.getItem(CTX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const ConsoleProvider: React.FC<{
  orgSlug: string;
  envSlug: string;
  children: React.ReactNode;
}> = ({ orgSlug, envSlug, children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [orgs, setOrgs] = useState<Organization[]>(() => CACHED_ORGS || []);
  const [envs, setEnvs] = useState<ConsoleEnv[]>(() => CACHED_ENVS || []);
  const [tenantsLoaded, setTenantsLoaded] = useState(() => Boolean(CACHED_ORGS && CACHED_ENVS));

  const org = useMemo(() => orgs.find((o) => o.slug === orgSlug) || null, [orgs, orgSlug]);
  const orgEnvs = useMemo(() => envs.filter((e) => e.org_id === org?.id), [envs, org]);
  const env = useMemo(() => orgEnvs.find((e) => e.slug === envSlug) || null, [orgEnvs, envSlug]);
  const namespace = env?.openmeter_namespace || inferNamespace(orgSlug, envSlug);

  const cachedEntry = namespace ? SNAPSHOT_CACHE.get(namespace) : undefined;
  const [snapshot, setSnapshot] = useState<Snapshot>(() => cachedEntry?.snap || EMPTY_SNAPSHOT);
  const [entitlementUsage, setEntitlementUsage] = useState<EntitlementUsage[]>(() => cachedEntry?.usage || []);
  const [status, setStatus] = useState<LoadStatus>(() => (cachedEntry ? "ready" : "loading"));
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(() => cachedEntry?.ts || null);
  const [tick, setTick] = useState(0);

  // Instant client-side section routing state synced with URL
  const [section, setSection] = useState<string>(() => parseSectionFromPath(pathname));
  const [searchParamsStr, setSearchParamsStr] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "",
  );

  useEffect(() => {
    setSection(parseSectionFromPath(pathname));
    if (typeof window !== "undefined") {
      setSearchParamsStr(window.location.search.replace(/^\?/, ""));
    }
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => {
      setSection(parseSectionFromPath(window.location.pathname));
      setSearchParamsStr(window.location.search.replace(/^\?/, ""));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Tenants (organisations + environments)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawOrgs, rawEnvs] = await Promise.all([
          apiGet("/api/control/v1/organizations"),
          apiGet("/api/control/v1/environments"),
        ]);
        if (cancelled) return;
        const normOrgs = normalizeOrganizations(rawOrgs);
        const normEnvs = normalizeEnvironments(rawEnvs) as ConsoleEnv[];
        CACHED_ORGS = normOrgs;
        CACHED_ENVS = normEnvs;
        setOrgs(normOrgs);
        setEnvs(normEnvs);
        setConnected(true);
      } catch {
        if (!cancelled) {
          setConnected(false);
          setStatus((s) => (s === "loading" ? "error" : s));
        }
      } finally {
        if (!cancelled) setTenantsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Unknown org/env in the URL → fall back to a valid context instead of an empty console.
  useEffect(() => {
    if (!tenantsLoaded || orgs.length === 0) return;
    if (org && env) {
      rememberContext(org.slug, env.slug);
      return;
    }
    const fallbackOrg = org || orgs[0];
    const candidates = envs.filter((e) => e.org_id === fallbackOrg.id);
    const fallbackEnv = candidates.find((e) => e.type === "production") || candidates[0];
    if (fallbackEnv) router.replace(`/${fallbackOrg.slug}/${fallbackEnv.slug}/overview`);
  }, [tenantsLoaded, orgs, envs, org, env, router]);

  // Snapshot polling (paused while the tab is hidden)
  const inFlight = useRef<AbortController | null>(null);
  const loadSnapshot = useCallback(async () => {
    if (!namespace) return;
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    try {
      const raw = await apiGet<Record<string, unknown>>("/api/control/v1/snapshot", namespace, ctrl.signal);
      const snap = normalizeSnapshot(raw, namespace);
      const now = Date.now();
      setSnapshot(snap);
      setStatus("ready");
      setConnected(true);
      setLastUpdated(now);

      // Entitlement usage (bounded fan-out; the snapshot doesn't include consumption)
      const ents = snap.entitlements.filter((e) => e.type === "metered").slice(0, 25);
      const results = await Promise.allSettled(
        ents.map((e) =>
          apiGet<Record<string, unknown>>(
            `/api/v1/subjects/${encodeURIComponent(e.subject_key)}/entitlements/${encodeURIComponent(e.feature_key)}/value`,
            namespace,
            ctrl.signal,
          ).then((v) => normalizeEntitlementValue(v, e)),
        ),
      );
      if (!ctrl.signal.aborted) {
        const usageList = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
        setEntitlementUsage(usageList);
        SNAPSHOT_CACHE.set(namespace, { snap, usage: usageList, ts: now });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setConnected(false);
      setStatus((s) => (s === "loading" ? "error" : s));
    }
  }, [namespace]);

  useEffect(() => {
    const cached = SNAPSHOT_CACHE.get(namespace);
    if (cached) {
      setSnapshot(cached.snap);
      setEntitlementUsage(cached.usage);
      setStatus("ready");
      setLastUpdated(cached.ts);
    } else {
      setSnapshot(EMPTY_SNAPSHOT);
      setEntitlementUsage([]);
      setStatus("loading");
    }
  }, [namespace]);

  useEffect(() => {
    if (!namespace) return;
    loadSnapshot();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") loadSnapshot();
    }, POLL_MS);
    return () => {
      window.clearInterval(id);
      inFlight.current?.abort();
    };
  }, [namespace, loadSnapshot, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const href = useCallback((route: string) => `/${orgSlug}/${envSlug}/${route}`, [orgSlug, envSlug]);

  const navigate = useCallback(
    (route: string) => {
      const [cleanRoute, qs = ""] = route.split("?");
      const nextSection = cleanRoute.replace(/^\/+/, "") || "overview";
      setSection(nextSection);
      setSearchParamsStr(qs);
      if (typeof window !== "undefined") {
        const fullUrl = `/${orgSlug}/${envSlug}/${nextSection}${qs ? `?${qs}` : ""}`;
        window.history.pushState(null, "", fullUrl);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
    },
    [orgSlug, envSlug],
  );

  const switchContext = useCallback(
    (nextOrg: string, nextEnv: string) => {
      rememberContext(nextOrg, nextEnv);
      router.push(`/${nextOrg}/${nextEnv}/${section || "overview"}`);
    },
    [router, section],
  );

  const value = useMemo<ConsoleContextValue>(
    () => ({
      orgs,
      envs,
      org,
      env,
      orgEnvs,
      namespace,
      isSandbox: env?.type === "sandbox" || envSlug.toLowerCase().includes("sandbox"),
      snapshot,
      entitlementUsage,
      status,
      connected,
      lastUpdated,
      section,
      searchParamsStr,
      refresh,
      href,
      navigate,
      switchContext,
    }),
    [
      orgs,
      envs,
      org,
      env,
      orgEnvs,
      namespace,
      envSlug,
      snapshot,
      entitlementUsage,
      status,
      connected,
      lastUpdated,
      section,
      searchParamsStr,
      refresh,
      href,
      navigate,
      switchContext,
    ],
  );

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
};
