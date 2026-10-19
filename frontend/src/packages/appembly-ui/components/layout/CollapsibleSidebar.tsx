import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Moon,
  Plus,
  Sun,
} from 'lucide-react';
import { NavSection } from '../../types';
import { AppemblyLogo } from '../brand/AppemblyLogo';
import { useAppemblyTheme } from '../../context/ThemeContext';

export interface CollapsibleSidebarProps {
  brandTitle?: string;
  brandSubtitle?: string;
  sections: NavSection[];
  activeItemId: string;
  onSelectItem: (itemId: string, parentSectionId?: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  footerSlot?: React.ReactNode;
}

const STATUS_DOT_CLASSES: Record<string, string> = {
  sage: 'bg-[#4E8067]',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  silver: 'bg-[#A9AFAB]',
};

/**
 * Single Morphing Sidebar combining the clean hierarchical tree from the reference design
 * with Cyclode's single-sidebar collapse behavior (shows ONLY the mini icon rail when collapsed).
 */
export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  brandTitle = 'Dashboard',
  brandSubtitle = 'Appembly · Valiscale',
  sections,
  activeItemId,
  onSelectItem,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  onPrimaryAction,
  primaryActionLabel = 'New Concept',
  footerSlot,
}) => {
  const { theme, toggleTheme } = useAppemblyTheme();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  // Track which parent accordion sections are open in expanded mode
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((sec) => {
      if (sec.defaultOpen || sec.children?.some((c) => c.id === activeItemId)) {
        initial[sec.id] = true;
      }
    });
    return initial;
  });

  // Hover flyout state when in collapsed mini-rail mode (Cyclode pattern)
  const [hoveredSection, setHoveredSection] = useState<{
    sectionId: string;
    top: number;
    left: number;
  } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleCloseFlyout = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setHoveredSection(null);
    }, 150);
  };

  // Global Cmd+B / Ctrl+B keyboard shortcut (just like Cyclode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleCollapse();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const toggleSectionOpen = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const isSectionActive = (sec: NavSection) =>
    sec.id === activeItemId || Boolean(sec.children?.some((c) => c.id === activeItemId));

  // ============================================================================
  // COLLAPSED MODE: Mini Icon Rail ONLY (56px width, Cyclode single-rail pattern)
  // ============================================================================
  if (isCollapsed) {
    const flyoutSection = sections.find((s) => s.id === hoveredSection?.sectionId);

    return (
      <aside className="w-[60px] h-full flex flex-col items-center py-3.5 px-2 bg-[var(--ui-bg-sidebar)] border-r border-[var(--ui-border)] select-none flex-shrink-0 relative z-30 transition-all duration-200">
        {/* Top Appembly Rounded-Square Logo Button (Click to Expand) */}
        <div className="relative group mb-3">
          <button
            onClick={handleToggleCollapse}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            title="Expand Sidebar (⌘B)"
          >
            <AppemblyLogo variant="app-icon" size={34} />
          </button>
        </div>

        {/* Optional Quick Action (+) Button */}
        {onPrimaryAction && (
          <button
            onClick={onPrimaryAction}
            className="w-9 h-9 mb-2 rounded-xl bg-[#4E8067] hover:bg-[#3F6B55] text-[#F6F7F5] flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95"
            title={primaryActionLabel}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}

        <div className="w-6 h-px bg-[var(--ui-border)] my-1.5 flex-shrink-0" />

        {/* Primary Icon Rail (matches the left icon column in the reference screenshot) */}
        <nav className="flex-1 w-full flex flex-col items-center space-y-2 py-1 overflow-y-auto appembly-scrollbar">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const active = isSectionActive(sec);
            return (
              <div
                key={sec.id}
                className="relative flex items-center justify-center w-full"
                onMouseEnter={(e) => {
                  clearCloseTimer();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredSection({
                    sectionId: sec.id,
                    top: Math.min(Math.max(rect.top, 56), window.innerHeight - 220),
                    left: rect.right + 10,
                  });
                }}
                onMouseLeave={scheduleCloseFlyout}
              >
                <button
                  onClick={() => {
                    if (sec.children && sec.children.length > 0) {
                      onSelectItem(sec.children[0].id, sec.id);
                    } else {
                      onSelectItem(sec.id);
                    }
                  }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                    active
                      ? 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] border border-[var(--ui-border-strong)] shadow-xs'
                      : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] border border-transparent'
                  }`}
                >
                  <Icon className={`w-[17px] h-[17px] ${active ? 'text-[#4E8067]' : ''}`} />
                  {active && (
                    <span className="absolute -left-2 w-1 h-4 rounded-r-full bg-[#4E8067]" />
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Bottom Utilities (Expand button + Theme Toggle) */}
        <div className="flex flex-col items-center space-y-2 pt-2 border-t border-[var(--ui-border)] w-full">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] transition-colors cursor-pointer"
            title={`Switch to ${theme === 'light' ? 'Graphite Dark' : 'Off-White Light'} Mode`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={handleToggleCollapse}
            className="w-8 h-8 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] flex items-center justify-center text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] shadow-2xs transition-colors cursor-pointer"
            title="Expand Sidebar (⌘B)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Cyclode-style Hover Flyout Card for Collapsed Mini Rail */}
        {hoveredSection && flyoutSection && (
          <div
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleCloseFlyout}
            style={{ top: hoveredSection.top, left: hoveredSection.left }}
            className="fixed z-50 w-60 rounded-2xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] shadow-xl p-2.5 animate-in fade-in duration-150"
          >
            <div className="px-2 py-1 flex items-center justify-between border-b border-[var(--ui-border)] mb-1.5">
              <span className="text-xs font-semibold text-[var(--ui-text-primary)]">
                {flyoutSection.label}
              </span>
              {flyoutSection.badge !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#4E8067]/15 text-[#4E8067] font-semibold">
                  {flyoutSection.badge}
                </span>
              )}
            </div>
            {flyoutSection.children && flyoutSection.children.length > 0 ? (
              <div className="space-y-0.5">
                {flyoutSection.children.map((child) => {
                  const childActive = child.id === activeItemId;
                  return (
                    <button
                      key={child.id}
                      onClick={() => {
                        onSelectItem(child.id, flyoutSection.id);
                        setHoveredSection(null);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        childActive
                          ? 'bg-[#4E8067]/12 text-[var(--ui-text-primary)] font-semibold'
                          : 'text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)] hover:text-[var(--ui-text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {child.icon ? (
                          <span className="flex-shrink-0">{child.icon}</span>
                        ) : child.statusColor ? (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              STATUS_DOT_CLASSES[child.statusColor] || 'bg-[#4E8067]'
                            }`}
                          />
                        ) : null}
                        <span className="truncate">{child.label}</span>
                      </div>
                      {child.badge !== undefined && (
                        <span className="text-[10px] font-mono text-[var(--ui-text-muted)]">
                          {child.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                onClick={() => {
                  onSelectItem(flyoutSection.id);
                  setHoveredSection(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
              >
                Open {flyoutSection.label}
              </button>
            )}
          </div>
        )}
      </aside>
    );
  }

  // ============================================================================
  // EXPANDED MODE: Clean Reference Hierarchy (Single Sidebar, 256px width)
  // ============================================================================
  return (
    <aside className="w-[256px] h-full flex flex-col bg-[var(--ui-bg-sidebar)] border-r border-[var(--ui-border)] select-none flex-shrink-0 transition-all duration-200">
      {/* Header: Appembly App Icon + Dashboard Title + Rounded-Square [<] Collapse Button */}
      <div className="h-16 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <AppemblyLogo variant="app-icon" size={30} />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-[16px] tracking-tight text-[var(--ui-text-primary)] leading-tight truncate">
              {brandTitle}
            </span>
            <span className="text-[10.5px] font-medium text-[var(--ui-text-muted)] leading-tight truncate">
              {brandSubtitle}
            </span>
          </div>
        </div>

        <button
          onClick={handleToggleCollapse}
          className="w-7 h-7 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] hover:bg-[var(--ui-bg-hover)] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] flex items-center justify-center shadow-2xs transition-colors cursor-pointer flex-shrink-0"
          title="Collapse to Mini Sidebar (⌘B)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable Navigation Tree (Matches Reference Screenshot Hierarchy) */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1 appembly-scrollbar">
        {sections.map((sec) => {
          const hasChildren = Boolean(sec.children && sec.children.length > 0);
          const isOpen = Boolean(openSections[sec.id]);
          const activeParent = isSectionActive(sec);
          const Icon = sec.icon;

          if (!hasChildren) {
            return (
              <button
                key={sec.id}
                onClick={() => onSelectItem(sec.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer ${
                  sec.id === activeItemId
                    ? 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] font-semibold border border-[var(--ui-border)] shadow-2xs'
                    : 'text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] font-normal'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      sec.id === activeItemId ? 'text-[#4E8067]' : 'text-[var(--ui-text-muted)]'
                    }`}
                  />
                  <span className="truncate">{sec.label}</span>
                </div>
                {sec.badge !== undefined && (
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--ui-bg-subtle)] text-[var(--ui-text-secondary)]">
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          }

          return (
            <div key={sec.id} className="space-y-1">
              {/* Parent Group Header (Elevated White Box when Open, matching "Social Media ^" in screenshot) */}
              <button
                onClick={() => toggleSectionOpen(sec.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer ${
                  isOpen
                    ? 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] font-medium border border-[var(--ui-border)] shadow-2xs'
                    : activeParent
                    ? 'text-[var(--ui-text-primary)] font-medium hover:bg-[var(--ui-bg-hover)]'
                    : 'text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      activeParent || isOpen ? 'text-[#4E8067]' : 'text-[var(--ui-text-muted)]'
                    }`}
                  />
                  <span className="truncate">{sec.label}</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[var(--ui-text-muted)] transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[var(--ui-text-primary)]' : ''
                  }`}
                />
              </button>

              {/* Indented Child List with Continuous Left Guide Line + Active Vertical Accent Bar */}
              {isOpen && sec.children && (
                <div className="ml-3.5 pl-3.5 border-l border-[var(--ui-border-strong)] space-y-0.5 py-1 relative">
                  {sec.children.map((child) => {
                    const isChildActive = child.id === activeItemId;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onSelectItem(child.id, sec.id)}
                        className={`w-full relative flex items-center justify-between py-2 px-2.5 rounded-lg text-[13px] transition-all cursor-pointer group ${
                          isChildActive
                            ? 'text-[var(--ui-text-primary)] font-semibold bg-[var(--ui-bg-hover)]/60'
                            : 'text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)]/40 font-normal'
                        }`}
                      >
                        {/* Active 2px Vertical Indicator Bar on the Left Guide Line (Appembly Sage Green) */}
                        {isChildActive && (
                          <span className="absolute -left-[15px] top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-[#4E8067]" />
                        )}

                        <div className="flex items-center gap-2.5 min-w-0">
                          {child.icon ? (
                            <span className="flex-shrink-0">{child.icon}</span>
                          ) : child.statusColor ? (
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                STATUS_DOT_CLASSES[child.statusColor] || 'bg-[#4E8067]'
                              }`}
                            />
                          ) : null}
                          <span className="truncate">{child.label}</span>
                        </div>

                        {child.badge !== undefined && (
                          <span
                            className={`text-[10.5px] font-mono px-1.5 py-0.5 rounded-md ${
                              isChildActive
                                ? 'bg-[#4E8067]/15 text-[#4E8067] font-semibold'
                                : 'text-[var(--ui-text-muted)]'
                            }`}
                          >
                            {child.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer: Theme Switcher & Optional Sauthen Org/User Slot */}
      <div className="px-3.5 py-3 border-t border-[var(--ui-border)] flex items-center justify-between gap-2 flex-shrink-0">
        {footerSlot ? (
          <div className="flex-1 min-w-0">{footerSlot}</div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#4E8067] animate-pulse flex-shrink-0" />
            <span className="text-[11.5px] font-medium text-[var(--ui-text-secondary)] truncate">
              Runctor v0.2.0 · Live
            </span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-surface)] hover:bg-[var(--ui-bg-hover)] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
          title="Toggle Appembly Off-White / Graphite Theme"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-3.5 h-3.5 text-[#4E8067]" />
              <span>Graphite</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-[#5C9679]" />
              <span>Off-White</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
