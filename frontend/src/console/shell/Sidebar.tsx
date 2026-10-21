"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Moon, PanelLeftClose, Sun } from "lucide-react";
import { MeterboxIcon } from "../../packages/appembly-ui/components/brand/MeterboxIcon";
import { loadSauthenSession, saveSauthenSession } from "../../packages/appembly-ui/components/auth/SauthenAuthKit";
import { useConsole } from "../ConsoleProvider";
import { NAV, NavItem, classicHref } from "../nav";
import { relativeTime } from "../lib/format";
import { EnvBadge, StatusDot } from "../ui/primitives";
import { ExternalGlyph, NavGlyph } from "./icons";
import { useTheme } from "./useTheme";

export const Sidebar: React.FC<{
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenPalette: () => void;
  onNavigate?: () => void;
}> = ({
  collapsed = false,
  onToggleCollapse,
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

  const isItemActive = (item: NavItem) => {
    if (!item.route) return false;
    const target = href(item.route);
    return section === item.route || pathname === target || pathname.startsWith(`${target}/`);
  };

  if (collapsed) {
    return (
      <aside className="flex flex-col h-full bg-[var(--sidebar)] border-r border-[var(--border)]">
        <div className="mbx-sb-rail">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar (⌘B)"
            className="w-9 h-9 mb-2 rounded-[10px] flex items-center justify-center hover:scale-105 transition-transform"
          >
            <MeterboxIcon size={26} />
          </button>

          <div className="mbx-sb-rail-div" />

          <div className="flex-1 w-full flex flex-col items-center gap-1 overflow-y-auto mbx-scroll py-0.5">
            {NAV.map((group, gIdx) => (
              <React.Fragment key={group.id}>
                {gIdx > 0 && <div className="mbx-sb-rail-div" />}
                {group.items.map((item) => {
                  const active = isItemActive(item);
                  const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                  const target = item.route ? href(item.route) : classicHref(item.classicView || "overview", org?.id, env?.id);
                  return (
                    <a
                      key={item.id}
                      href={target}
                      onClick={(e) => {
                        if (item.route && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                          e.preventDefault();
                          navigate(item.route);
                          onNavigate?.();
                        }
                      }}
                      title={item.label}
                      className={`mbx-sb-rail-btn ${active ? "active" : ""}`}
                    >
                      <NavGlyph icon={item.icon} className="w-[17px] h-[17px]" />
                      {badge > 0 && <span className="mbx-sb-rail-dot" />}
                    </a>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <div className="mbx-sb-rail-div" />

          <button
            type="button"
            onClick={toggle}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="mbx-sb-rail-btn"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col h-full bg-[var(--sidebar)] border-r border-[var(--border)]">
      {/* Expanded Header */}
      <div className="mbx-sb-head">
        <a
          href={href("overview")}
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
              e.preventDefault();
              navigate("overview");
              onNavigate?.();
            }
          }}
          className="mbx-sb-brand"
        >
          <span className="w-8 h-8 flex items-center justify-center shrink-0">
            <MeterboxIcon size={28} />
          </span>
          <div className="leading-tight min-w-0">
            <div className="text-[15.5px] font-semibold tracking-[-0.02em] truncate">Meterbox</div>
            <div className="text-[11px] text-[var(--muted-foreground)] font-medium">Usage &amp; Billing</div>
          </div>
        </a>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse sidebar (⌘B)"
            className="mbx-sb-icon-btn"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Flat Section-Header + Single-Pill Navigation */}
      <nav className="mbx-sb-nav mbx-scroll" aria-label="Console">
        {NAV.map((group) => (
          <React.Fragment key={group.id}>
            {group.label && <div className="mbx-sb-section-label">{group.label}</div>}
            {group.items.map((item) => {
              const badge = item.badgeKey ? badges[item.badgeKey] : 0;
              const active = isItemActive(item);
              const content = (
                <>
                  <NavGlyph
                    icon={item.icon}
                    className={`w-[17px] h-[17px] shrink-0 transition-colors ${
                      active ? "text-[var(--foreground)]" : "text-[var(--placeholder)]"
                    }`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge > 0 && (
                    <span
                      className="min-w-[20px] h-[20px] px-1.5 rounded-full text-[11.5px] font-semibold flex items-center justify-center mbx-num"
                      style={{
                        color: item.badgeKey === "dlq" ? "var(--warn)" : "var(--info)",
                        background:
                          item.badgeKey === "dlq"
                            ? "color-mix(in srgb, var(--warn) 16%, transparent)"
                            : "color-mix(in srgb, var(--info) 16%, transparent)",
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

              if (item.route) {
                const target = href(item.route);
                return (
                  <a
                    key={item.id}
                    href={target}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                        e.preventDefault();
                        navigate(item.route!);
                        onNavigate?.();
                      }
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`mbx-sb-item ${active ? "active" : ""}`}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <a
                  key={item.id}
                  href={classicHref(item.classicView || "overview", org?.id, env?.id)}
                  className="mbx-sb-item"
                >
                  {content}
                </a>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      {/* Footer: connection + theme */}
      <div className="shrink-0 border-t border-[var(--border)] px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-1.5 text-[12px]">
          <StatusDot tone={connected ? "ok" : "err"} live={connected} />
          <span className="truncate text-[var(--muted-foreground)]">
            {connected
              ? lastUpdated
                ? `Live · ${relativeTime(new Date(lastUpdated).toISOString())}`
                : "Connecting…"
              : "Disconnected"}
          </span>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] mbx-hover"
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};

export const ContextSwitcher: React.FC = () => {
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
        className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] transition-colors text-left"
      >
        <span className="w-5 h-5 rounded-md bg-[var(--surface-subtle)] border border-[var(--border)] flex items-center justify-center text-[11px] font-semibold shrink-0">
          {(org?.name || "?").charAt(0)}
        </span>
        <span className="text-[13px] font-semibold truncate max-w-[160px]">{org?.name || "Loading…"}</span>
        {env && <EnvBadge type={env.type} label={env.name} />}
        <ChevronsUpDown className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="mbx-pop absolute left-0 top-full mt-1.5 w-[270px] z-40 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[var(--shadow-xl)] max-h-[360px] overflow-y-auto mbx-scroll"
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
                        const sess = loadSauthenSession();
                        if (sess) {
                          saveSauthenSession({
                            ...sess,
                            organization: {
                              id: o.id,
                              name: o.name,
                              slug: o.slug,
                              meterbox_live_ns: `ns_live_${o.slug}`,
                              meterbox_sandbox_ns: `ns_test_${o.slug}`,
                            },
                            namespace: e.openmeter_namespace,
                          });
                        }
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

