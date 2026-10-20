"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Moon, Search, Sun } from "lucide-react";
import { AppemblyLogo } from "../../packages/appembly-ui/components/brand/AppemblyLogo";
import { useConsole } from "../ConsoleProvider";
import { NAV, NavItem, classicHref } from "../nav";
import { relativeTime } from "../lib/format";
import { EnvBadge, Kbd, StatusDot } from "../ui/primitives";
import { ExternalGlyph, NavGlyph } from "./icons";
import { useTheme } from "./useTheme";

export const Sidebar: React.FC<{ onOpenPalette: () => void; onNavigate?: () => void }> = ({
  onOpenPalette,
  onNavigate,
}) => {
  const { org, env, href, navigate, section, snapshot, entitlementUsage, connected, lastUpdated } = useConsole();
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const [, forceTick] = useState(0);

  // Keep "updated Xs ago" fresh
  useEffect(() => {
    const id = window.setInterval(() => forceTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const badges: Record<NonNullable<NavItem["badgeKey"]>, number> = {
    dlq: snapshot.telemetry?.dlqPending ?? snapshot.dlqEvents.filter((d) => d.status === "pending").length,
    nearLimit: entitlementUsage.filter((u) => u.ratio >= 0.8).length,
  };

  return (
    <aside className="flex flex-col h-full bg-[var(--sidebar)] border-r border-[var(--border)]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
        <span className="w-8 h-8 rounded-[9px] bg-[var(--primary)] flex items-center justify-center shadow-sm">
          <AppemblyLogo variant="mark" size={20} strokeColor="#F6F7F5" />
        </span>
        <div className="leading-tight">
          <div className="text-[14.5px] font-semibold tracking-[-0.015em]">Meterbox</div>
          <div className="text-[11px] text-[var(--muted-foreground)]">by Appembly</div>
        </div>
      </div>

      {/* Org / environment switcher */}
      <div className="px-3">
        <ContextSwitcher />
      </div>

      {/* Search */}
      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={onOpenPalette}
          className="w-full flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[12.5px] text-[var(--placeholder)] hover:border-[var(--border-strong)] transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto mbx-scroll px-3 py-3" aria-label="Console">
        {NAV.map((group) => (
          <div key={group.id} className="mb-3">
            {group.label && (
              <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--placeholder)]">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                const content = (
                  <>
                    <NavGlyph icon={item.icon} className="w-4 h-4 shrink-0 opacity-80" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge > 0 && (
                      <span
                        className="min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-semibold flex items-center justify-center mbx-num"
                        style={{
                          color: item.badgeKey === "dlq" ? "var(--warn)" : "var(--info)",
                          background:
                            item.badgeKey === "dlq"
                              ? "color-mix(in srgb, var(--warn) 14%, transparent)"
                              : "color-mix(in srgb, var(--info) 14%, transparent)",
                        }}
                      >
                        {badge}
                      </span>
                    )}
                    {!item.route && (
                      <ExternalGlyph
                        className="w-3 h-3 shrink-0 text-[var(--placeholder)] opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-hidden="true"
                      />
                    )}
                  </>
                );
                const cls =
                  "group flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] font-medium transition-colors";
                if (item.route) {
                  const target = href(item.route);
                  const active = section === item.route || pathname === target || pathname.startsWith(`${target}/`);
                  return (
                    <li key={item.id}>
                      <a
                        href={target}
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                            e.preventDefault();
                            navigate(item.route!);
                            onNavigate?.();
                          }
                        }}
                        aria-current={active ? "page" : undefined}
                        className={`${cls} ${active ? "mbx-active" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] mbx-hover"}`}
                      >
                        {content}
                      </a>
                    </li>
                  );
                }
                return (
                  <li key={item.id}>
                    <a
                      href={classicHref(item.classicView || "overview", org?.id, env?.id)}
                      title={`${item.label} — opens in the classic console while this section is being redesigned`}
                      className={`${cls} text-[var(--muted-foreground)] hover:text-[var(--foreground)] mbx-hover`}
                    >
                      {content}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: connection + theme */}
      <div className="shrink-0 border-t border-[var(--border)] px-3 py-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-1.5 text-[12px]">
          <StatusDot tone={connected ? "ok" : "err"} live={connected} />
          <span className="truncate text-[var(--muted-foreground)]">
            {connected ? (lastUpdated ? `Live · updated ${relativeTime(new Date(lastUpdated).toISOString())}` : "Connecting…") : "Disconnected"}
          </span>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] mbx-hover"
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};

const ContextSwitcher: React.FC = () => {
  const { orgs, envs, org, env, switchContext } = useConsole();
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] transition-colors text-left"
      >
        <span className="w-7 h-7 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] flex items-center justify-center text-[12px] font-semibold shrink-0">
          {(org?.name || "?").charAt(0)}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[12.5px] font-semibold truncate">{org?.name || "Loading…"}</span>
          {env && (
            <span className="block mt-0.5">
              <EnvBadge type={env.type} label={env.name} />
            </span>
          )}
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="mbx-pop absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[var(--shadow-xl)] max-h-[360px] overflow-y-auto mbx-scroll"
        >
          {orgs.map((o) => {
            const list = envs.filter((e) => e.org_id === o.id);
            return (
              <div key={o.id} className="mb-1 last:mb-0">
                <div className="px-2 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--placeholder)] truncate">
                  {o.name}
                </div>
                {list.map((e) => {
                  const selected = o.id === org?.id && e.id === env?.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setOpen(false);
                        if (!selected) switchContext(o.slug, e.slug);
                      }}
                      className="w-full flex items-center gap-2 h-8 px-2 rounded-lg text-[12.5px] mbx-hover"
                    >
                      <EnvBadge type={e.type} label={e.name} />
                      <span className="flex-1 truncate text-[var(--muted-foreground)] mbx-mono text-[11px]">
                        {e.openmeter_namespace}
                      </span>
                      {selected && <Check className="w-3.5 h-3.5 text-[var(--primary)]" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
