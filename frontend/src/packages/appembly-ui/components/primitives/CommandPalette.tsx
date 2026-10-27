import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../motion/usePresence';
import { useOverlayFocusTrap } from './focusTrap';

export interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  group?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  badge?: string;
  keywords?: string[];
  onSelect?: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  onSelectItem?: (item: CommandItem) => void;
  placeholder?: string;
  emptyText?: string;
  /** When true, binds ⌘K / Ctrl+K globally to toggle the palette */
  enableGlobalShortcut?: boolean;
  onOpen?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  items,
  onSelectItem,
  placeholder = 'Search or run a command…',
  emptyText = 'No matching commands found.',
  enableGlobalShortcut = false,
  onOpen,
}) => {
  const { mounted, state } = usePresence(open, 150);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rawId = useId();
  const listboxId = `ap-cmdk-listbox-${rawId}`;

  useOverlayFocusTrap(open, panelRef, onClose, inputRef);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!enableGlobalShortcut) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) {
          onClose();
        } else {
          onOpen?.();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableGlobalShortcut, open, onClose, onOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = [
        item.label,
        item.subtitle ?? '',
        item.group ?? '',
        ...(item.keywords ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const grp = item.group ?? 'Commands';
      const arr = map.get(grp) ?? [];
      arr.push(item);
      map.set(grp, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!mounted || typeof document === 'undefined') return null;

  const activeItem = filtered[activeIndex];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      }
    } else if (e.key === 'Enter' && activeItem) {
      e.preventDefault();
      activeItem.onSelect?.();
      onSelectItem?.(activeItem);
      onClose();
    }
  };

  let flatCursor = -1;

  return createPortal(
    <div className="ap-cmdk-root" data-state={state}>
      <div
        className="ap-scrim"
        data-state={state}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        data-state={state}
        className="ap-cmdk-panel"
        onKeyDown={handleKeyDown}
      >
        <div className="ap-cmdk-input-wrap">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ui-text-muted, #6B726F)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={
              activeItem ? `${listboxId}-opt-${activeItem.id}` : undefined
            }
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="ap-cmdk-input"
          />
          <span className="ap-cmdk-kbd" aria-hidden="true">
            ESC
          </span>
        </div>

        <div
          id={listboxId}
          role="listbox"
          aria-label="Suggestions"
          className="ap-cmdk-list appembly-scrollbar"
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                fontSize: 13.5,
                color: 'var(--ui-text-muted, #6B726F)',
              }}
            >
              {emptyText}
            </div>
          ) : (
            grouped.map(([groupName, groupItems]) => (
              <div key={groupName} role="group" aria-label={groupName}>
                <div className="ap-cmdk-group-label">{groupName}</div>
                {groupItems.map((item) => {
                  flatCursor += 1;
                  const idx = flatCursor;
                  const isSelected = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      id={`${listboxId}-opt-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        item.onSelect?.();
                        onSelectItem?.(item);
                        onClose();
                      }}
                      className="ap-cmdk-option"
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 10,
                          minWidth: 0,
                        }}
                      >
                        {item.icon && (
                          <span
                            style={{
                              display: 'inline-flex',
                              color: isSelected
                                ? 'var(--ui-accent, #4E8067)'
                                : 'var(--ui-text-muted, #6B726F)',
                              flexShrink: 0,
                            }}
                            aria-hidden="true"
                          >
                            {item.icon}
                          </span>
                        )}
                        <span
                          style={{
                            fontWeight: isSelected ? 600 : 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.label}
                        </span>
                        {item.subtitle && (
                          <span
                            style={{
                              fontSize: 12.5,
                              color: 'var(--ui-text-muted, #6B726F)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        {item.badge && (
                          <span className="ap-cmdk-kbd ap-tabular-nums">
                            {item.badge}
                          </span>
                        )}
                        {item.shortcut && (
                          <span className="ap-cmdk-kbd">{item.shortcut}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
