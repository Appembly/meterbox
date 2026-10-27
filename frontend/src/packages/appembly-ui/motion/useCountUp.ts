import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export interface UseCountUpOptions {
  /** Duration in milliseconds (default: 600ms, matching `--motion-story`) */
  duration?: number;
  /** Number of decimal places to preserve when rounding (default: 0) */
  decimals?: number;
  /** When false, holds at initial/previous value until enabled becomes true (default: true) */
  enabled?: boolean;
}

/**
 * Tweens a numeric value from its previous value to `value` using `easeOutQuart`
 * via `requestAnimationFrame`. Honors `prefers-reduced-motion` by snapping immediately.
 */
export function useCountUp(
  value: number,
  options?: UseCountUpOptions
): number {
  const duration = options?.duration ?? 600;
  const decimals = options?.decimals ?? 0;
  const enabled = options?.enabled ?? true;
  const reduced = useReducedMotion();

  const [display, setDisplay] = useState<number>(() => (reduced ? value : 0));
  const fromRef = useRef<number>(reduced ? value : 0);

  useEffect(() => {
    if (!enabled) return;

    const factor = Math.pow(10, decimals);
    const round = (n: number) => Math.round(n * factor) / factor;

    if (reduced || duration <= 0) {
      fromRef.current = value;
      setDisplay(round(value));
      return;
    }

    const startValue = fromRef.current;
    const delta = value - startValue;
    if (Math.abs(delta) < 1e-6) {
      setDisplay(round(value));
      return;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      const current = round(startValue + delta * eased);
      fromRef.current = current;
      setDisplay(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        setDisplay(round(value));
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, decimals, enabled, reduced]);

  return display;
}
