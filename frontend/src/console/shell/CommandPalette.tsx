"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Moon, RefreshCw, Search } from "lucide-react";
import { useConsole } from "../ConsoleProvider";
import { NAV, classicHref } from "../nav";
import { EnvBadge, Kbd } from "../ui/primitives";
import { NavGlyph } from "./icons";
import { useTheme } from "./useTheme";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { org, env, orgs, envs, navigate, switchContext, refresh } = useConsole();
  const { toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NAV.flatMap((g) =>
      g.items.map((item) => ({
        id: `nav-${item.id}`,
        group: "Go to",
        label: g.label ? `${g.label} › ${item.label}` : item.label,
        hint: item.route ? undefined : "Classic",
        icon: <NavGlyph icon={item.icon} className="w-4 h-4" />,
        run: () => {
          if (item.route) navigate(item.route);
          else window.location.href = classicHref(item.classicView || "overview", org?.id, env?.id);
        },
      }))
    );
    const contexts: Command[] = orgs.flatMap((o) =>
      envs
        .filter((e) => e.org_id === o.id && !(o.id === org?.id && e.id === env?.id))
        .map((e) => ({
          id: `ctx-${e.id}`,
          group: "Switch environment",
          label: `${o.name} › ${e.name}`,
          icon: <EnvBadge type={e.type} label={e.type === "sandbox" ? "SBX" : "PRD"} />,
          run: () => switchContext(o.slug, e.slug),
        }))
    );
    const actions: Command[] = [
      { id: "act-refresh", group: "Actions", label: "Refresh data", icon: <RefreshCw className="w-4 h-4" />, run: refresh },
      { id: "act-theme", group: "Actions", label: "Toggle light / dark theme", icon: <Moon className="w-4 h-4" />, run: toggle },
    ];
    return [...nav, ...contexts, ...actions];
  }, [navigate, org, env, orgs, envs, switchContext, refresh, toggle]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.group} ${c.label}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(index);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="mbx-pop relative w-full max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xl)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, environments and actions…"
            className="flex-1 bg-transparent border-0 outline-none text-[14px] text-[var(--foreground)] placeholder:text-[var(--placeholder)]"
            aria-label="Search commands"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="max-h-[360px] overflow-y-auto mbx-scroll p-1.5" role="listbox">
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-[13px] text-[var(--muted-foreground)]">No matches for “{query}”</li>
          )}
          {filtered.map((cmd, i) => {
            const header = cmd.group !== lastGroup ? cmd.group : null;
            lastGroup = cmd.group;
            const active = i === index;
            return (
              <React.Fragment key={cmd.id}>
                {header && (
                  <li className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--placeholder)]">
                    {header}
                  </li>
                )}
                <li role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => runAt(i)}
                    className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] ${
                      active ? "mbx-active" : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    <span className="shrink-0 flex items-center">{cmd.icon}</span>
                    <span className="flex-1 truncate text-left text-[var(--foreground)]">{cmd.label}</span>
                    {cmd.hint && <span className="text-[11px] text-[var(--placeholder)]">{cmd.hint}</span>}
                    {active && <CornerDownLeft className="w-3.5 h-3.5 text-[var(--placeholder)]" />}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
