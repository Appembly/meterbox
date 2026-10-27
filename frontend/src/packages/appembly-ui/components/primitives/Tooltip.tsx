import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../motion/usePresence';

export interface TooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayMs?: number;
  children: React.ReactElement;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  side = 'top',
  delayMs = 150,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const rawId = useId();
  const tooltipId = `ap-tooltip-${rawId}`;
  const { mounted, state } = usePresence(open, 110);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delayMs);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useIsomorphicLayoutEffect(() => {
    if (!mounted || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tipWidth = tooltipRef.current?.offsetWidth ?? 100;
    const tipHeight = tooltipRef.current?.offsetHeight ?? 28;
    const gap = 7;

    let top = rect.top - tipHeight - gap;
    let left = rect.left + rect.width / 2 - tipWidth / 2;

    if (side === 'bottom') {
      top = rect.bottom + gap;
    } else if (side === 'right') {
      top = rect.top + rect.height / 2 - tipHeight / 2;
      left = rect.right + gap;
    } else if (side === 'left') {
      top = rect.top + rect.height / 2 - tipHeight / 2;
      left = rect.left - tipWidth - gap;
    }

    left = Math.min(Math.max(8, left), window.innerWidth - tipWidth - 8);
    top = Math.min(Math.max(8, top), window.innerHeight - tipHeight - 8);
    setCoords({ top, left });
  }, [mounted, side, content]);

  return (
    <>
      <span
        ref={triggerRef}
        style={{ display: 'inline-flex' }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </span>
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            data-state={state}
            className="ap-tooltip"
            style={{ top: coords.top, left: coords.left }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};
