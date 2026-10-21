"use client";

import React, { Suspense, useEffect, useState } from "react";
import { Menu, TriangleAlert, X } from "lucide-react";
import { useConsole } from "../ConsoleProvider";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
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
import { SauthenAuthGuard } from "../../packages/appembly-ui";
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

export const ConsoleShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSandbox, connected, status, section, refresh } = useConsole();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
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

  return (
    <SauthenAuthGuard brand="meterbox">
    <div className="mbx-console min-h-screen bg-[var(--background)]">
      {isSandbox && <div className="mbx-env-stripe" aria-hidden="true" />}

      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed inset-y-0 left-0 w-[var(--mbx-sidebar-w)] z-30">
        <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
      </div>

      {/* Mobile sidebar */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNav(false)} />
          <div className="mbx-pop absolute inset-y-0 left-0 w-[280px] shadow-[var(--shadow-xl)]">
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

      <div className="lg:pl-[var(--mbx-sidebar-w)] min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 h-12 px-3 border-b border-[var(--border)] bg-[var(--sidebar)]">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center mbx-hover"
            aria-label="Open navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="text-[14px] font-semibold">Meterbox</span>
        </div>

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

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
    </SauthenAuthGuard>
  );
};
