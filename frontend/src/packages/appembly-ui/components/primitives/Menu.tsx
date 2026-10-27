import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../motion/usePresence';

export interface MenuItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: string;
  meta?: React.ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export interface MenuProps {
  trigger: React.ReactElement<{
    onClick?: React.MouseEventHandler;
    onKeyDown?: React.KeyboardEventHandler;
    'aria-haspopup'?: 'menu';
    'aria-expanded'?: boolean;
    'aria-controls'?: string;
  }>;
  items: MenuItem[];
  onSelect?: (id: string) => void;
  align?: 'start' | 'end';
  sideOffset?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const Menu: React.FC<MenuProps> = ({
  trigger,
  items,
  onSelect,
  align = 'start',
  sideOffset = 6,
  open: controlledOpen,
  onOpenChange,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const { mounted, state } = usePresence(isOpen, 120);
  const rawId = useId();
  const menuId = `ap-menu-${rawId}`;
  const triggerWrapRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const enabledIndices = items
    .map((it, idx) => (it.disabled ? -1 : idx))
    .filter((idx) => idx !== -1);

  useIsomorphicLayoutEffect(() => {
    if (!mounted || !triggerWrapRef.current) return;
    const updatePosition = () => {
      const triggerEl = triggerWrapRef.current;
      const menuEl = menuRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const menuWidth = menuEl?.offsetWidth ?? 210;
      const menuHeight = menuEl?.offsetHeight ?? 160;

      let top = rect.bottom + sideOffset;
      if (top + menuHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - menuHeight - sideOffset);
      }

      let left = align === 'end' ? rect.right - menuWidth : rect.left;
      left = Math.min(Math.max(12, left), window.innerWidth - menuWidth - 12);

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mounted, align, sideOffset, items.length]);

  useEffect(() => {
    if (!isOpen) return;
    const initialIdx = items.findIndex((it) => it.selected && !it.disabled);
    const firstEnabled = initialIdx >= 0 ? initialIdx : enabledIndices[0] ?? 0;
    setActiveIndex(firstEnabled);
    const focusId = requestAnimationFrame(() => {
      itemRefs.current[firstEnabled]?.focus();
    });
    return () => cancelAnimationFrame(focusId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerWrapRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        const btn = triggerWrapRef.current?.querySelector<HTMLElement>('button, [tabindex]');
        btn?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const moveFocus = (delta: number) => {
    if (enabledIndices.length === 0) return;
    const currentPos = enabledIndices.indexOf(activeIndex);
    const nextPos =
      currentPos === -1
        ? 0
        : (currentPos + delta + enabledIndices.length) % enabledIndices.length;
    const nextIdx = enabledIndices[nextPos];
    setActiveIndex(nextIdx);
    itemRefs.current[nextIdx]?.focus();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (enabledIndices.length > 0) {
        const first = enabledIndices[0];
        setActiveIndex(first);
        itemRefs.current[first]?.focus();
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      if (enabledIndices.length > 0) {
        const last = enabledIndices[enabledIndices.length - 1];
        setActiveIndex(last);
        itemRefs.current[last]?.focus();
      }
    }
  };

  const clonedTrigger = React.isValidElement(trigger)
    ? React.cloneElement(trigger, {
        'aria-haspopup': 'menu',
        'aria-expanded': isOpen,
        'aria-controls': isOpen ? menuId : undefined,
        onClick: (e: React.MouseEvent) => {
          trigger.props.onClick?.(e);
          setOpen(!isOpen);
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          trigger.props.onKeyDown?.(e);
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        },
      })
    : trigger;

  return (
    <>
      <span ref={triggerWrapRef} style={{ display: 'inline-flex' }}>
        {clonedTrigger}
      </span>
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            data-state={state}
            onKeyDown={handleMenuKeyDown}
            className={`ap-menu-content ${className}`.trim()}
            style={{ top: coords.top, left: coords.left }}
          >
            {items.map((item, idx) => {
              const isDanger = item.tone === 'danger';
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  tabIndex={activeIndex === idx ? 0 : -1}
                  data-active={activeIndex === idx ? 'true' : 'false'}
                  data-selected={item.selected ? 'true' : 'false'}
                  onMouseEnter={() => {
                    if (!item.disabled) setActiveIndex(idx);
                  }}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onSelect?.();
                    onSelect?.(item.id);
                    setOpen(false);
                  }}
                  className={`ap-menu-item ${isDanger ? 'ap-menu-item--danger' : ''}`.trim()}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {item.icon && (
                      <span style={{ display: 'inline-flex', flexShrink: 0 }} aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {item.meta}
                    {item.shortcut && <span className="ap-menu-shortcut">{item.shortcut}</span>}
                    {item.selected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--ui-accent, #4E8067)"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
};
