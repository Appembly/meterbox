"use client";

import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* ----------------------------------------------------------------------------
 * Layout primitives
 * --------------------------------------------------------------------------*/

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = "", delay = 0 }) => (
  <section
    className={`mbx-card mbx-enter min-w-0 ${className}`}
    style={{ "--mbx-delay": `${delay}ms` } as React.CSSProperties}
  >
    {children}
  </section>
);

export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, className = "" }) => (
  <header className={`flex items-start justify-between gap-4 px-5 pt-4 pb-3 ${className}`}>
    <div className="min-w-0">
      <h2 className="text-[15px] font-semibold tracking-[-0.012em] text-[var(--foreground)]">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[12.5px] text-[var(--muted-foreground)]">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </header>
);

/* ----------------------------------------------------------------------------
 * Status
 * --------------------------------------------------------------------------*/

export type Tone = "ok" | "warn" | "err" | "info" | "neutral";

const TONE_VAR: Record<Tone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  err: "var(--err)",
  info: "var(--info)",
  neutral: "var(--placeholder)",
};

export const toneColor = (tone: Tone) => TONE_VAR[tone];

export const StatusDot: React.FC<{ tone: Tone; live?: boolean; className?: string }> = ({
  tone,
  live = false,
  className = "",
}) => (
  <span
    className={`${live ? "mbx-live" : "inline-block w-2 h-2 rounded-full"} shrink-0 ${className}`}
    style={{ color: TONE_VAR[tone], background: live ? undefined : TONE_VAR[tone] }}
    aria-hidden="true"
  />
);

export const Pill: React.FC<{
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  mono?: boolean;
}> = ({ children, tone = "neutral", className = "", mono = false }) => (
  <span
    className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-[11.5px] font-medium whitespace-nowrap ${
      mono ? "mbx-mono" : ""
    } ${className}`}
    style={{
      color: tone === "neutral" ? "var(--muted-foreground)" : TONE_VAR[tone],
      background:
        tone === "neutral"
          ? "var(--surface-subtle)"
          : `color-mix(in srgb, ${TONE_VAR[tone]} 12%, transparent)`,
    }}
  >
    {children}
  </span>
);

export const EnvBadge: React.FC<{ type: "production" | "sandbox"; label?: string; size?: "sm" | "md" }> = ({
  type,
  label,
  size = "sm",
}) => {
  const sandbox = type === "sandbox";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${
        size === "md" ? "h-6 px-2.5 text-[12px]" : "h-5 px-2 text-[11px]"
      }`}
      style={{
        color: sandbox ? "#b45309" : "var(--primary)",
        background: sandbox ? "rgba(245, 158, 11, 0.16)" : "color-mix(in srgb, var(--primary) 14%, transparent)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
      {label || (sandbox ? "Sandbox" : "Production")}
    </span>
  );
};

/* ----------------------------------------------------------------------------
 * Controls
 * --------------------------------------------------------------------------*/

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" }
> = ({ variant = "secondary", size = "md", className = "", children, ...rest }) => {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]";
  const variants = {
    primary: "bg-[var(--primary)] text-white hover:brightness-110 shadow-sm",
    secondary:
      "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--border-strong)] shadow-sm",
    ghost: "text-[var(--muted-foreground)] hover:text-[var(--foreground)] mbx-hover",
  } as const;
  return (
    <button type="button" className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-7 px-2.5 rounded-md text-[12px] whitespace-nowrap transition-all ${
              active
                ? "bg-[var(--card)] text-[var(--primary)] font-semibold border border-[var(--border-strong)] shadow-sm"
                : "font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const Select: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }
> = ({ label, className = "", children, ...rest }) => (
  <label className={`relative inline-flex items-center ${className}`}>
    <span className="sr-only">{label}</span>
    <select
      {...rest}
      className="h-8 pl-2.5 pr-7 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12.5px] font-medium text-[var(--foreground)] hover:border-[var(--border-strong)] cursor-pointer outline-none focus-visible:border-[var(--primary)]"
    >
      {children}
    </select>
  </label>
);

export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center h-5 px-1.5 rounded border border-[var(--border)] bg-[var(--surface-subtle)] text-[10.5px] font-medium text-[var(--muted-foreground)]">
    {children}
  </kbd>
);

/* ----------------------------------------------------------------------------
 * Feedback
 * --------------------------------------------------------------------------*/

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span className={`mbx-skeleton block ${className}`} aria-hidden="true" />
);

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className = "" }) => (
  <div className={`flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}>
    {icon && (
      <div className="w-10 h-10 rounded-xl bg-[var(--surface-subtle)] text-[var(--muted-foreground)] flex items-center justify-center mb-3">
        {icon}
      </div>
    )}
    <div className="text-[13.5px] font-semibold text-[var(--foreground)]">{title}</div>
    {description && <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)] max-w-[320px]">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ProgressBar: React.FC<{ value: number; tone?: Tone; className?: string; label?: string }> = ({
  value,
  tone = "ok",
  className = "",
  label,
}) => {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div
      className={`h-1.5 rounded-full bg-[var(--surface-subtle)] overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="mbx-bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: TONE_VAR[tone] }} />
    </div>
  );
};

/* ----------------------------------------------------------------------------
 * Sparkline
 * --------------------------------------------------------------------------*/

export const Sparkline: React.FC<{ values: number[]; color?: string; height?: number; className?: string }> = ({
  values,
  color = "var(--primary)",
  height = 32,
  className = "",
}) => {
  const id = React.useId().replace(/:/g, "");
  if (values.length < 2) {
    return <div className={className} style={{ height }} aria-hidden="true" />;
  }
  const w = 120;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 2 - ((v - min) / span) * (height - 4)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full ${className}`} style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${id})`} className="mbx-chart-draw" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
};

/* ----------------------------------------------------------------------------
 * Page header, Slide-over Drawer & Form controls
 * --------------------------------------------------------------------------*/

export const PageHeader: React.FC<{
  orgName?: string;
  envType?: "production" | "sandbox";
  envName?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <header className="mbx-enter flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-[24px] font-semibold tracking-[-0.022em] text-[var(--foreground)]">{title}</h1>
      {subtitle && <p className="mt-1 text-[13.5px] text-[var(--muted-foreground)] leading-[1.55]">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </header>
);

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, width = "max-w-[500px]", children }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const overlay = (
    <div
      className="mbx-console fixed inset-0 z-50 !m-0 flex justify-end bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <aside
        className={`relative w-full ${width} h-full bg-[var(--card)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-[var(--foreground)]">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-[var(--muted-foreground)] leading-snug">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] mbx-hover shrink-0"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 mbx-scroll">{children}</div>
      </aside>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
};

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <label className="block space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[13px] font-medium text-[var(--foreground)]">{label}</span>
      {hint && <span className="text-[11.5px] text-[var(--muted-foreground)]">{hint}</span>}
    </div>
    {children}
  </label>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }> = ({
  mono = false,
  className = "",
  ...rest
}) => (
  <input
    {...rest}
    className={`w-full h-9 px-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none focus:border-[var(--primary)] transition-colors ${
      mono ? "mbx-mono text-[12.5px]" : ""
    } ${className}`}
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }> = ({
  mono = false,
  className = "",
  ...rest
}) => (
  <textarea
    {...rest}
    className={`w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none focus:border-[var(--primary)] transition-colors ${
      mono ? "mbx-mono text-[12px] leading-relaxed" : ""
    } ${className}`}
  />
);

export const Notice: React.FC<{
  tone?: Tone;
  title: React.ReactNode;
  detail?: React.ReactNode;
  onDismiss?: () => void;
}> = ({ tone = "ok", title, detail, onDismiss }) => (
  <div
    className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl border text-[13px]"
    style={{
      borderColor: `color-mix(in srgb, ${TONE_VAR[tone]} 35%, var(--border))`,
      background: `color-mix(in srgb, ${TONE_VAR[tone]} 8%, var(--card))`,
    }}
  >
    <div className="flex items-start gap-2.5 min-w-0">
      <StatusDot tone={tone} className="mt-1.5" />
      <div className="min-w-0">
        <div className="font-medium text-[var(--foreground)]">{title}</div>
        {detail && <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">{detail}</div>}
      </div>
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0"
      >
        Dismiss
      </button>
    )}
  </div>
);

/* ----------------------------------------------------------------------------
 * Pagination hook & footer bar
 * --------------------------------------------------------------------------*/

export interface PaginationState<T> {
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
  totalItems: number;
  totalPages: number;
  startIdx: number;
  endIdx: number;
  pageItems: T[];
}

export function usePagination<T>(items: T[], defaultPageSize = 8): PaginationState<T> {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize;
  const endIdx = Math.min(totalItems, startIdx + pageSize);
  const pageItems = React.useMemo(() => items.slice(startIdx, endIdx), [items, startIdx, endIdx]);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (nextSize: number) => {
      setPageSize(nextSize);
      setPage(1);
    },
    totalItems,
    totalPages,
    startIdx,
    endIdx,
    pageItems,
  };
}

export const Pagination: React.FC<{
  state: PaginationState<unknown>;
  pageSizeOptions?: number[];
  itemLabel?: string;
  compact?: boolean;
  className?: string;
}> = ({
  state,
  pageSizeOptions = [5, 8, 15, 25, 50],
  itemLabel = "items",
  compact = false,
  className = "",
}) => {
  const { page, setPage, pageSize, setPageSize, totalItems, totalPages, startIdx, endIdx } = state;
  if (totalItems === 0 || (totalPages <= 1 && totalItems <= 5)) return null;

  const pages: number[] = [];
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);
  for (let p = Math.max(1, windowEnd - 4); p <= windowEnd; p++) {
    pages.push(p);
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-[var(--border)] bg-[var(--surface-subtle)] rounded-b-[13px] text-[12px] text-[var(--muted-foreground)] ${className}`}
    >
      <div className="flex items-center gap-3 mbx-num">
        <span>
          Showing <strong className="text-[var(--foreground)]">{startIdx + 1}</strong>–
          <strong className="text-[var(--foreground)]">{endIdx}</strong> of{" "}
          <strong className="text-[var(--foreground)]">{totalItems}</strong> {itemLabel}
        </span>
        {!compact && (
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[11.5px]">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-6 px-1.5 rounded-md bg-[var(--card)] border border-[var(--border)] text-[11.5px] font-medium text-[var(--foreground)] cursor-pointer"
            >
              {Array.from(new Set([...pageSizeOptions, pageSize]))
                .sort((a, b) => a - b)
                .map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1 mbx-num">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="h-6 px-2 rounded-md border border-[var(--border)] bg-[var(--card)] text-[11.5px] font-medium text-[var(--foreground)] hover:border-[var(--border-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-[24px] h-6 px-1.5 rounded-md text-[11.5px] font-semibold transition-colors ${
              p === page
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--border-strong)]"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          className="h-6 px-2 rounded-md border border-[var(--border)] bg-[var(--card)] text-[11.5px] font-medium text-[var(--foreground)] hover:border-[var(--border-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};


