import React from 'react';
import { BreadcrumbSegment } from '../../types';
import { BadgeTone, StatusPill } from '../primitives/Badge';
import { Menu, MenuItem } from '../primitives/Menu';

export interface BreadcrumbEnvStatus {
  label: string;
  tone?: BadgeTone;
  live?: boolean;
}

export interface BreadcrumbAvatarConfig {
  name: string;
  imageUrl?: string;
  menuItems?: MenuItem[];
  onSelectMenuItem?: (id: string) => void;
}

export interface BreadcrumbBarProps {
  segments: BreadcrumbSegment[];
  /** Renders the `Search or run a command… ⌘K` trigger button on the right when provided */
  onOpenCommandPalette?: () => void;
  commandPaletteLabel?: string;
  commandPaletteShortcut?: string;
  /** Primary environment status pill (either a config object or custom ReactNode) */
  envStatus?: React.ReactNode | BreadcrumbEnvStatus;
  /** User avatar slot (either a config object with initials/menu or custom ReactNode) */
  avatar?: React.ReactNode | BreadcrumbAvatarConfig;
  /** Additional right-side action nodes (preserved for backward compatibility) */
  rightActions?: React.ReactNode;
}

function isEnvStatusConfig(
  val: React.ReactNode | BreadcrumbEnvStatus
): val is BreadcrumbEnvStatus {
  return (
    typeof val === 'object' &&
    val !== null &&
    !React.isValidElement(val) &&
    'label' in val
  );
}

function isAvatarConfig(
  val: React.ReactNode | BreadcrumbAvatarConfig
): val is BreadcrumbAvatarConfig {
  return (
    typeof val === 'object' &&
    val !== null &&
    !React.isValidElement(val) &&
    'name' in val
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'AP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

/**
 * Top `60px` Breadcrumb & Command Bar (`@appembly/ui`).
 * - Left: `<nav aria-label="Breadcrumb">` with `›` separators and accessible `Menu` switchers.
 * - Right: `⌘K` Command Palette trigger, primary environment status pill, user avatar, and `rightActions`.
 */
export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({
  segments,
  onOpenCommandPalette,
  commandPaletteLabel = 'Search or run a command…',
  commandPaletteShortcut = '⌘K',
  envStatus,
  avatar,
  rightActions,
}) => {
  const renderAvatar = () => {
    if (!avatar) return null;
    if (!isAvatarConfig(avatar)) return avatar;

    const badgeButton = (
      <button
        type="button"
        aria-label={avatar.name}
        title={avatar.name}
        className="ap-avatar ap-focus-ring"
        style={{ cursor: avatar.menuItems?.length ? 'pointer' : 'default' }}
      >
        {avatar.imageUrl ? (
          <img
            src={avatar.imageUrl}
            alt={avatar.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span>{getInitials(avatar.name)}</span>
        )}
      </button>
    );

    if (avatar.menuItems && avatar.menuItems.length > 0) {
      return (
        <Menu
          align="end"
          items={avatar.menuItems}
          onSelect={avatar.onSelectMenuItem}
          trigger={badgeButton}
        />
      );
    }

    return badgeButton;
  };

  return (
    <header className="ap-breadcrumb-bar">
      <nav aria-label="Breadcrumb" className="ap-breadcrumb-nav">
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          const hasDropdown = Boolean(seg.options && seg.options.length > 0);

          const segmentButton = (
            <button
              type="button"
              aria-current={isLast && !hasDropdown ? 'page' : undefined}
              className={`ap-breadcrumb-seg ap-focus-ring ${
                hasDropdown ? 'ap-breadcrumb-seg--interactive' : ''
              } ${isLast ? 'ap-breadcrumb-seg--current' : ''}`.trim()}
              style={{ cursor: hasDropdown ? 'pointer' : 'default' }}
            >
              {seg.icon && (
                <span style={{ display: 'inline-flex', flexShrink: 0 }} aria-hidden="true">
                  {seg.icon}
                </span>
              )}
              <span>{seg.label}</span>
              {hasDropdown && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ color: 'var(--ui-text-muted)' }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              )}
            </button>
          );

          const menuItems: MenuItem[] =
            seg.options?.map((opt) => ({
              id: opt.id,
              label: opt.label,
              icon: opt.icon,
              selected: opt.label === seg.label || opt.id === seg.id,
            })) ?? [];

          return (
            <React.Fragment key={seg.id}>
              {idx > 0 && (
                <span className="ap-breadcrumb-sep" aria-hidden="true">
                  ›
                </span>
              )}
              {hasDropdown ? (
                <Menu
                  items={menuItems}
                  onSelect={(optId) => seg.onSelectOption?.(optId)}
                  trigger={segmentButton}
                />
              ) : (
                segmentButton
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label={commandPaletteLabel}
            className="ap-cmdk-trigger ap-focus-ring"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>{commandPaletteLabel}</span>
            </span>
            <kbd className="ap-cmdk-kbd">{commandPaletteShortcut}</kbd>
          </button>
        )}

        {envStatus &&
          (isEnvStatusConfig(envStatus) ? (
            <StatusPill
              tone={envStatus.tone ?? 'ok'}
              live={envStatus.live ?? true}
              size="md"
            >
              {envStatus.label}
            </StatusPill>
          ) : (
            envStatus
          ))}

        {rightActions}

        {renderAvatar()}
      </div>
    </header>
  );
};
