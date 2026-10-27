import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { LiveDot, LiveDotTone } from './LiveDot';

export type ToastTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'approval';

export interface ToastInput {
  id?: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss timeout in ms (default: 4200; pass 0 for sticky) */
  durationMs?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastRecord extends ToastInput {
  id: string;
  state: 'open' | 'closed';
}

export interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const reduced = useReducedMotion();

  const dismiss = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, state: 'closed' } : item))
      );
      const exitDelay = reduced ? 0 : 150;
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, exitDelay);
    },
    [reduced]
  );

  const toast = useCallback(
    (input: ToastInput): string => {
      const id = input.id ?? `ap-toast-${++toastCounter}`;
      const durationMs = input.durationMs ?? 4200;
      setItems((prev) => [
        ...prev.slice(-4),
        {
          ...input,
          id,
          tone: input.tone ?? 'neutral',
          state: 'open',
        },
      ]);
      if (durationMs > 0) {
        setTimeout(() => {
          dismiss(id);
        }, durationMs);
      }
      return id;
    },
    [dismiss]
  );

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const last = items[items.length - 1];
        if (last) dismiss(last.id);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [items, dismiss]);

  const toneToDot: Record<ToastTone, LiveDotTone> = {
    neutral: 'accent',
    ok: 'ok',
    warn: 'warn',
    danger: 'danger',
    approval: 'approval',
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss, clear }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="ap-toast-viewport"
            role="region"
            aria-label="Notifications"
            aria-live="polite"
          >
            {items.map((item) => {
              const tone = item.tone ?? 'neutral';
              return (
                <div
                  key={item.id}
                  role="status"
                  data-state={item.state}
                  className="ap-toast"
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
                    <span style={{ marginTop: 5, flexShrink: 0 }}>
                      <LiveDot
                        tone={toneToDot[tone]}
                        size={8}
                        active={tone === 'approval' || tone === 'warn'}
                      />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: 'var(--ui-text-primary, #111618)',
                          lineHeight: 1.35,
                        }}
                      >
                        {item.title}
                      </div>
                      {item.description && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: 'var(--ui-text-secondary, #525956)',
                            marginTop: 2,
                            lineHeight: 1.45,
                          }}
                        >
                          {item.description}
                        </div>
                      )}
                      {item.action && (
                        <button
                          type="button"
                          onClick={() => {
                            item.action?.onClick();
                            dismiss(item.id);
                          }}
                          style={{
                            marginTop: 6,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--ui-accent, #4E8067)',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {item.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(item.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--ui-text-muted, #6B726F)',
                      cursor: 'pointer',
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
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
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => '',
      dismiss: () => {},
      clear: () => {},
    };
  }
  return ctx;
}
