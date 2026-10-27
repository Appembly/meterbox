import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../motion/usePresence';

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactElement;
  align?: 'start' | 'center' | 'end';
  side?: 'bottom' | 'top';
  sideOffset?: number;
  children: React.ReactNode;
  className?: string;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const Popover: React.FC<PopoverProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  trigger,
  align = 'start',
  side = 'bottom',
  sideOffset = 6,
  children,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const { mounted, state } = usePresence(isOpen, 120);
  const triggerWrapRef = useRef<HTMLSpanElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useIsomorphicLayoutEffect(() => {
    if (!mounted || !triggerWrapRef.current) return;
    const updatePosition = () => {
      const triggerEl = triggerWrapRef.current;
      const contentEl = contentRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const contentWidth = contentEl?.offsetWidth ?? 220;
      const contentHeight = contentEl?.offsetHeight ?? 140;

      let top =
        side === 'top'
          ? rect.top - contentHeight - sideOffset
          : rect.bottom + sideOffset;

      if (side === 'bottom' && top + contentHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - contentHeight - sideOffset);
      }

      let left = rect.left;
      if (align === 'center') {
        left = rect.left + rect.width / 2 - contentWidth / 2;
      } else if (align === 'end') {
        left = rect.right - contentWidth;
      }
      left = Math.min(Math.max(12, left), window.innerWidth - contentWidth - 12);

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mounted, align, side, sideOffset]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerWrapRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <span
        ref={triggerWrapRef}
        style={{ display: 'inline-flex' }}
        onClick={() => setOpen(!isOpen)}
      >
        {trigger}
      </span>
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={contentRef}
            data-state={state}
            className={`ap-popover-content ${className}`.trim()}
            style={{ top: coords.top, left: coords.left }}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
};
