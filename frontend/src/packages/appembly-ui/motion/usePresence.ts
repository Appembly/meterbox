import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export type PresenceState = 'open' | 'closed';

/**
 * Keeps an overlay node mounted during its exit animation (`exitMs`),
 * returning `{ mounted, state: 'open' | 'closed' }` for `[data-state]` CSS animations.
 * Honors `prefers-reduced-motion` by unmounting immediately on close.
 */
export function usePresence(
  open: boolean,
  exitMs = 200
): { mounted: boolean; state: PresenceState } {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState<boolean>(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (reduced || exitMs <= 0) {
      setMounted(false);
      return;
    }
    const timer = setTimeout(() => {
      setMounted(false);
    }, exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs, reduced]);

  return {
    mounted: open || mounted,
    state: open ? 'open' : 'closed',
  };
}
