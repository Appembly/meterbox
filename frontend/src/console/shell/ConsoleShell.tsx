"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, LogOut, Menu, Search, TriangleAlert, X } from "lucide-react";
import { useConsole } from "../ConsoleProvider";
import { NAV } from "../nav";
import { Kbd, StatusDot } from "../ui/primitives";
import { CommandPalette } from "./CommandPalette";
import { ContextSwitcher, Sidebar } from "./Sidebar";
import { OverviewView } from "../views/overview/OverviewView";
import { MetersView } from "../views/usage/MetersView";
import { EventsView } from "../views/usage/EventsView";
import { DlqView } from "../views/usage/DlqView";
import { CustomersView } from "../views/customers/CustomersView";
import { PlansView } from "../views/revenue/PlansView";
import { InvoicesView } from "../views/revenue/InvoicesView";
import { CostView } from "../views/insights/CostView";
import { AnalyticsView } from "../views/insights/AnalyticsView";
import { ApiKeysView } from "../views/developers/ApiKeysView";
import { DocsView } from "../views/developers/DocsView";
import {
  AppemblyLogo,
  EmblyChat,
  SauthenAuthGuard,
  loadSauthenSession,
  useSauthenSession,
} from "../../packages/appembly-ui";
import type { EmblyToolRendererProps } from "../../packages/appembly-ui";
import "../console.css";

function renderSectionView(section: string, fallback: React.ReactNode): React.ReactNode {
  switch (section) {
    case "overview":
      return <OverviewView />;
    case "meters":
      return <MetersView />;
    case "events":
      return (
        <Suspense fallback={null}>
          <EventsView />
        </Suspense>
      );
    case "dlq":
      return <DlqView />;
    case "customers":
      return (
        <Suspense fallback={null}>
          <CustomersView />
        </Suspense>
      );
    case "plans":
      return <PlansView />;
    case "invoices":
      return <InvoicesView />;
    case "cost":
      return <CostView />;
    case "analytics":
      return <AnalyticsView />;
    case "keys":
      return <ApiKeysView />;
    case "docs":
      return <DocsView />;
    default:
      return fallback;
  }
}

function sectionTitle(section: string): string {
  for (const g of NAV) {
    for (const it of g.items) {
      if (it.route === section || it.id === section) return it.label;
    }
  }
  return "Overview";
}

const MeterboxPricingSimCard: React.FC<EmblyToolRendererProps> = ({ step }) => {
  const res = (step.result || {}) as Record<string, any>;
  const planName = res.plan_name || step.arguments?.plan_name || "Pro Plan";
  const rev = typeof res.total_revenue_usd === "number" ? res.total_revenue_usd : 149;
  const marginPct = typeof res.gross_margin === "number" ? (res.gross_margin * 100).toFixed(1) : "76.5";

  return (
    <div className="py-1 space-y-1">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[12.5px] font-semibold text-[var(--foreground)] truncate">
          Pricing Simulation · {planName}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--primary)]/15 text-[var(--primary)] whitespace-nowrap shrink-0">
          {marginPct}% Gross Margin
        </span>
      </div>
      <div className="text-[12px] text-[var(--muted-foreground)] truncate">
        Projected Revenue: <span className="mbx-mono text-[var(--foreground)]">${rev.toFixed(2)}/mo</span> · Overage:{" "}
        <span className="mbx-mono text-[var(--foreground)]">${Number(res.overage_charge_usd ?? 50).toFixed(2)}</span>
      </div>
    </div>
  );
};

const METERBOX_TOOL_RENDERERS = {
  simulate_pricing_tier: MeterboxPricingSimCard,
};

export const ConsoleShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSandbox, connected, status, section, namespace, refresh } = useConsole();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mbx_sidebar_collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("mbx_sidebar_collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setChatOpen((v) => !v);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeLabel = sectionTitle(section);

  return (
    <div className="mbx-console mbx-app-shell">
      {isSandbox && <div className="mbx-env-stripe" aria-hidden="true" />}

      {/* Desktop collapsible sidebar (256px ↔ 60px mini rail) */}
      <div className={`hidden lg:block mbx-sidebar-wrap ${collapsed ? "collapsed" : ""}`}>
        <div className={`mbx-sidebar-fixed ${collapsed ? "collapsed" : ""}`}>
          <Sidebar
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        </div>
      </div>

      {/* Mobile sidebar */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNav(false)} />
          <div className="mbx-pop absolute inset-y-0 left-0 w-[264px] shadow-[var(--shadow-xl)]">
            <Sidebar
              onOpenPalette={() => {
                setMobileNav(false);
                setPaletteOpen(true);
              }}
              onNavigate={() => setMobileNav(false)}
            />
            <button
              type="button"
              onClick={() => setMobileNav(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center mbx-hover"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 min-h-screen flex flex-col">
        {/* Unified 60px Top Breadcrumb & Command Bar */}
        <header className="mbx-topbar">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center mbx-hover shrink-0"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <ContextSwitcher />
            <ChevronRight className="w-3.5 h-3.5 text-[var(--placeholder)] shrink-0 hidden sm:block" />
            <span className="text-[13.5px] font-semibold text-[var(--foreground)] truncate hidden sm:block">
              {activeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center gap-2.5 h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] hover:bg-[var(--card)] hover:border-[var(--border-strong)] text-[12.5px] text-[var(--muted-foreground)] transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-[var(--placeholder)] shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Search or jump to…</span>
              <Kbd>⌘K</Kbd>
            </button>

            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className={`inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                chatOpen
                  ? "border-[var(--primary)] bg-[var(--surface-subtle)] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--surface-subtle)] hover:bg-[var(--card)] hover:border-[var(--border-strong)] text-[var(--muted-foreground)]"
              }`}
              title="Ask AI (⌘J)"
            >
              <AppemblyLogo variant="mark" size={15} strokeColor="#4E8067" />
              <span className="hidden sm:inline whitespace-nowrap">Ask AI</span>
              <Kbd>⌘J</Kbd>
            </button>

            <TopbarUserMenu namespace={namespace} />
          </div>
        </header>

        {!connected && status !== "loading" && (
          <div
            className="mx-4 sm:mx-8 mt-4 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-[13px]"
            style={{
              borderColor: "color-mix(in srgb, var(--err) 35%, transparent)",
              background: "color-mix(in srgb, var(--err) 8%, transparent)",
            }}
            role="alert"
          >
            <TriangleAlert className="w-4 h-4 shrink-0" style={{ color: "var(--err)" }} />
            <span className="flex-1">Can’t reach the Meterbox API. Figures below may be stale.</span>
            <button type="button" onClick={refresh} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-8 py-6 pb-16 max-w-[1440px] w-full mx-auto">
          {renderSectionView(section, children)}
        </main>
      </div>

      {chatOpen && (
        <div className="fixed inset-y-0 right-0 z-40 flex shadow-2xl shadow-black/50">
          <EmblyChat
            mode="drawer"
            packName="meterbox_finops"
            brandAccent="#4E8067"
            showCostTelemetry
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            width={460}
            sessionContext={{ namespace, section: activeLabel }}
            contextChips={[
              { id: "ns", kind: "namespace", label: namespace, value: namespace, removable: false },
              { id: "sec", kind: "view", label: activeLabel, value: section, removable: false },
            ]}
            getAuthToken={() => loadSauthenSession()?.access_token || null}
            toolRenderers={METERBOX_TOOL_RENDERERS}
          />
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

const TopbarUserMenu: React.FC<{ namespace: string }> = ({ namespace }) => {
  const { session, user, signOut } = useSauthenSession(undefined, namespace);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cleanName = (user?.display_name || "Operator").split("·")[0].trim();
  const initials = cleanName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] transition-colors"
      >
        <span className="w-5 h-5 rounded-md bg-[var(--primary)] text-white text-[10.5px] font-semibold flex items-center justify-center shrink-0">
          {initials}
        </span>
        <span className="text-[12.5px] font-medium text-[var(--foreground)] hidden sm:inline max-w-[120px] truncate">
          {cleanName}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
      </button>

      {open && (
        <div className="mbx-pop absolute right-0 top-full mt-1.5 w-[250px] z-40 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-xl)] space-y-2.5">
          <div className="pb-2.5 border-b border-[var(--border)]">
            <div className="text-[13px] font-semibold text-[var(--foreground)] truncate">{cleanName}</div>
            <div className="text-[11.5px] mbx-mono text-[var(--muted-foreground)] truncate">
              {user?.email || "operator@appembly.dev"}
            </div>
          </div>

          <div className="space-y-1 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Namespace</span>
              <span className="mbx-mono text-[11.5px] font-medium text-[var(--primary)]">{namespace}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Role</span>
              <span className="mbx-mono text-[11.5px]">{user?.role || "org:owner"}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
            {session?.access_token && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(session.access_token);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-[11.5px] font-medium hover:border-[var(--border-strong)]"
              >
                {copied ? <Check className="w-3 h-3 text-[var(--primary)]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy JWT"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium text-[var(--err)] hover:bg-[var(--surface-subtle)] ml-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

