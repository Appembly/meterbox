import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavIconType, NavItem, NavSection } from '../../types';
import { AppemblyLogo } from '../brand/AppemblyLogo';
import { useAppemblyTheme } from '../../context/ThemeContext';

export interface CollapsibleSidebarProps {
  brandTitle?: string;
  brandSubtitle?: string;
  /** Optional custom brand mark or logo node */
  brandIcon?: React.ReactNode;
  /** Optional top-level navigation items rendered above the first section header */
  topItems?: NavItem[];
  sections: NavSection[];
  activeItemId: string;
  onSelectItem: (itemId: string, parentSectionId?: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  /** Optional handler for the Settings button in the footer (defaults to `onSelectItem('settings')`) */
  onOpenSettings?: () => void;
  settingsLabel?: string;
  settingsItemId?: string;
  /** Legacy custom footer slot (if provided, replaces the default Settings link on the left) */
  footerSlot?: React.ReactNode;
}

interface FlattenedRow {
  kind: 'item' | 'section';
  key: string;
  sectionId?: string;
  label: string;
  item?: NavItem;
}

function isPositiveBadge(badge: string | number | undefined): boolean {
  if (badge === undefined || badge === null || badge === '') return false;
  if (typeof badge === 'number') return badge > 0;
  const trimmed = String(badge).trim();
  if (!trimmed || trimmed === '0') return false;
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num > 0;
  return true;
}

function renderNavIcon(icon?: NavIconType): React.ReactNode {
  if (!icon) {
    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (React.isValidElement(icon)) {
    return icon;
  }
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    const IconComp = icon as React.ComponentType<{ className?: string }>;
    return <IconComp className="w-[17px] h-[17px]" />;
  }
  return null;
}

/**
 * Appembly Calm UI Flat Collapsible Sidebar (`256px` Expanded <-> `60px` Mini Icon Rail).
 * - Single `<aside>` DOM tree that transitions width and fades/clips labels without swapping DOM nodes.
 * - Flat section headers (`.sb-section-label`) turn into `22×1px` dividers in collapsed mode.
 * - Every destination is 1 click away with a 17px icon, 14px medium label, and optional count badge (> 0).
 * - Only ONE active item receives the soft rounded neutral pill (`border-radius: 9px`, `rgba(fg, 0.08)`).
 */
export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  brandTitle = 'Appembly',
  brandSubtitle = 'Console',
  brandIcon,
  topItems,
  sections,
  activeItemId,
  onSelectItem,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  onPrimaryAction,
  primaryActionLabel = 'New',
  onOpenSettings,
  settingsLabel = 'Settings',
  settingsItemId = 'settings',
  footerSlot,
}) => {
  const { theme, toggleTheme } = useAppemblyTheme();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  const onToggleRef = useRef(onToggleCollapse);
  onToggleRef.current = onToggleCollapse;

  const handleToggleCollapse = useCallback(() => {
    if (onToggleRef.current) {
      onToggleRef.current();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  }, []);

  // Global ⌘B / Ctrl+B keyboard shortcut — registered once, ignores text inputs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName;
          if (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            target.isContentEditable
          ) {
            return;
          }
        }
        e.preventDefault();
        handleToggleCollapse();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleCollapse]);

  // Flatten topItems + sections (including legacy nested `children`) into a 1:1 flat sequence
  const rows = useMemo<FlattenedRow[]>(() => {
    const list: FlattenedRow[] = [];

    if (topItems && topItems.length > 0) {
      for (const item of topItems) {
        list.push({
          kind: 'item',
          key: `top-${item.id}`,
          label: item.label,
          item,
        });
      }
    }

    sections.forEach((sec) => {
      const subItems = sec.items ?? sec.children;
      if (subItems && subItems.length > 0) {
        list.push({
          kind: 'section',
          key: `sec-${sec.id}`,
          sectionId: sec.id,
          label: sec.label,
        });
        for (const child of subItems) {
          list.push({
            kind: 'item',
            key: `item-${sec.id}-${child.id}`,
            sectionId: sec.id,
            label: child.label,
            item: {
              ...child,
              icon: child.icon ?? sec.icon,
            },
          });
        }
      } else {
        list.push({
          kind: 'item',
          key: `item-${sec.id}`,
          sectionId: sec.id,
          label: sec.label,
          item: {
            id: sec.id,
            label: sec.label,
            icon: sec.icon,
            badge: sec.badge,
          },
        });
      }
    });

    return list;
  }, [topItems, sections]);

  const isSettingsActive = activeItemId === settingsItemId;

  return (
    <aside
      data-collapsed={isCollapsed ? 'true' : 'false'}
      aria-label={`${brandTitle} navigation`}
      className="ap-sidebar"
    >
      {/* Top Header: Brand Lockup & Collapse Toggle */}
      <div className="ap-sb-header">
        {isCollapsed ? (
          <button
            type="button"
            onClick={handleToggleCollapse}
            title="Expand sidebar (⌘B)"
            aria-label="Expand sidebar"
            className="ap-sb-item"
            style={{ width: 36, height: 36, padding: 0, justifyContent: 'center' }}
          >
            {brandIcon ?? (
              <AppemblyLogo
                variant="app-icon"
                size={28}
                squircleColor="var(--ui-accent, #4E8067)"
              />
            )}
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                {brandIcon ?? (
                  <AppemblyLogo
                    variant="app-icon"
                    size={28}
                    squircleColor="var(--ui-accent, #4E8067)"
                  />
                )}
              </span>
              <div className="ap-sb-brand-copy">
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                    color: 'var(--ui-text-primary)',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {brandTitle}
                </span>
                {brandSubtitle && (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--ui-text-muted)',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {brandSubtitle}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleCollapse}
              title="Collapse sidebar (⌘B)"
              aria-label="Collapse sidebar"
              className="ap-btn ap-icon-btn ap-btn--ghost ap-btn--sm"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Optional Primary Action Button */}
      {onPrimaryAction && (
        <div style={{ padding: isCollapsed ? '0 12px 6px' : '0 10px 6px' }}>
          <button
            type="button"
            onClick={onPrimaryAction}
            title={primaryActionLabel}
            aria-label={primaryActionLabel}
            className="ap-btn ap-btn--primary ap-btn--md"
            style={{
              width: isCollapsed ? 36 : '100%',
              height: 36,
              padding: isCollapsed ? 0 : '0 12px',
              justifyContent: 'center',
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {!isCollapsed && <span>{primaryActionLabel}</span>}
          </button>
        </div>
      )}

      {/* Flat Navigation List (1-to-1 between 256px Expanded and 60px Rail) */}
      <nav aria-label="Primary" className="ap-sb-nav appembly-scrollbar">
        {rows.map((row) => {
          if (row.kind === 'section') {
            return (
              <div
                key={row.key}
                role="presentation"
                className="sb-section-label ap-sb-section-label"
              >
                <span className="ap-sb-section-text">{row.label}</span>
                <span className="ap-sb-section-divider" aria-hidden="true" />
              </div>
            );
          }

          const item = row.item!;
          const isActive = item.id === activeItemId;
          const showBadge = isPositiveBadge(item.badge);

          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onSelectItem(item.id, row.sectionId)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              title={isCollapsed ? item.label : undefined}
              className={`sb-item ap-sb-item ${isActive ? 'active' : ''}`.trim()}
            >
              <span className="ap-sb-item__main">
                <span className="ap-sb-item__icon" aria-hidden="true">
                  {renderNavIcon(item.icon)}
                </span>
                <span className="ap-sb-item__label">{item.label}</span>
              </span>
              {showBadge && (
                <span className="sb-badge ap-sb-badge ap-tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer: Settings on Left + Light/Dark Theme Toggle on Right */}
      <div className="ap-sb-footer">
        {footerSlot && !isCollapsed ? (
          <div style={{ flex: 1, minWidth: 0 }}>{footerSlot}</div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (onOpenSettings) {
                onOpenSettings();
              } else {
                onSelectItem(settingsItemId);
              }
            }}
            aria-current={isSettingsActive ? 'page' : undefined}
            aria-label={settingsLabel}
            title={isCollapsed ? settingsLabel : undefined}
            className={`sb-item ap-sb-item ${isSettingsActive ? 'active' : ''}`.trim()}
            style={{
              flex: isCollapsed ? '0 0 auto' : 1,
              minWidth: 0,
            }}
          >
            <span className="ap-sb-item__main">
              <span className="ap-sb-item__icon" aria-hidden="true">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <span className="ap-sb-item__label">{settingsLabel}</span>
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
          className="ap-btn ap-icon-btn ap-btn--ghost ap-btn--md"
        >
          {theme === 'light' ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          )}
        </button>
      </div>
    </aside>
  );
};
