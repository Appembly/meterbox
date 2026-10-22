"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

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

export interface SelectOptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

function extractSelectOptions(children: React.ReactNode): SelectOptionItem[] {
  const out: SelectOptionItem[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      out.push(...extractSelectOptions((child.props as { children?: React.ReactNode }).children));
      return;
    }
    if (child.type === "option" || (typeof child.type === "string" && child.type.toLowerCase() === "option")) {
      const props = child.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode };
      const rawText = React.Children.toArray(props.children)
        .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
        .join("")
        .trim();
      const val = props.value !== undefined ? String(props.value) : rawText;
      out.push({ value: val, label: rawText || val, disabled: Boolean(props.disabled) });
    }
  });
  return out;
}

function splitOptionLabel(text: string): { main: string; meta?: string } {
  const match = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (match && match[1].trim()) {
    return { main: match[1].trim(), meta: match[2].trim() };
  }
  return { main: text };
}

export const Select: React.FC<{
  label?: string;
  value?: string | number;
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  onValueChange?: (val: string) => void;
  options?: SelectOptionItem[];
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  size?: "sm" | "md";
  className?: string;
  children?: React.ReactNode;
}> = ({
  label,
  value,
  onChange,
  onValueChange,
  options: propOptions,
  placeholder = "Select an option…",
  disabled = false,
  mono = false,
  size,
  className = "",
  children,
}) => {
  const options = React.useMemo(
    () => propOptions || extractSelectOptions(children),
    [propOptions, children],
  );
  const strVal = value !== undefined && value !== null ? String(value) : options[0]?.value ?? "";
  const selectedOpt = options.find((o) => o.value === strVal) || options[0];

  const [open, setOpen] = React.useState(false);
  const [highlightIdx, setHighlightIdx] = React.useState<number>(-1);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 220,
    placeAbove: false,
  });

  const isFullWidth = className.includes("w-full") || (!label && !className.includes("w-"));
  const effectiveSize = size || (isFullWidth ? "md" : "sm");

  const updatePosition = React.useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuHeight = Math.min(options.length * 36 + 12, 268);
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < menuHeight + 12 && rect.top > menuHeight;
    setPos({
      top: placeAbove ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 180),
      placeAbove,
    });
  }, [options.length]);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    const curIdx = Math.max(
      0,
      options.findIndex((o) => o.value === strVal),
    );
    setHighlightIdx(curIdx);

    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (options.length ? (i + 1) % options.length : -1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => (options.length ? (i - 1 + options.length) % options.length : -1));
      } else if (e.key === "Enter" && highlightIdx >= 0 && options[highlightIdx]) {
        e.preventDefault();
        const chosen = options[highlightIdx];
        if (!chosen.disabled) {
          const synth = { target: { value: chosen.value }, currentTarget: { value: chosen.value } };
          onChange?.(synth);
          onValueChange?.(chosen.value);
          setOpen(false);
          btnRef.current?.focus();
        }
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, options, strVal, highlightIdx, onChange, onValueChange, updatePosition]);

  const handleSelect = (opt: SelectOptionItem) => {
    if (opt.disabled) return;
    const synth = { target: { value: opt.value }, currentTarget: { value: opt.value } };
    onChange?.(synth);
    onValueChange?.(opt.value);
    setOpen(false);
  };

  const parsedSelected = selectedOpt ? splitOptionLabel(selectedOpt.label) : null;

  return (
    <div className={`relative ${isFullWidth ? "w-full block" : "inline-flex items-center"} ${className}`}>
      {label && <span className="sr-only">{label}</span>}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        style={{
          borderColor: open ? "var(--primary)" : undefined,
          boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent)" : undefined,
        }}
        className={`w-full ${
          effectiveSize === "md" ? "h-[38px] px-3 rounded-[10px] text-[13px]" : "h-8 pl-2.5 pr-2 rounded-lg text-[12.5px]"
        } bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)] inline-flex items-center justify-between gap-2 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          mono ? "mbx-mono text-[12.5px]" : "font-medium"
        }`}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          {parsedSelected ? (
            <>
              <span className="truncate">{parsedSelected.main}</span>
              {parsedSelected.meta && (
                <span className="mbx-mono text-[11.5px] text-[var(--muted-foreground)] font-normal truncate">
                  ({parsedSelected.meta})
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--muted-foreground)]">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0 transition-transform duration-150 ${
            open ? "rotate-180 text-[var(--primary)]" : ""
          }`}
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
              maxWidth: "min(440px, 92vw)",
              transform: pos.placeAbove ? "translateY(-100%)" : undefined,
              zIndex: 9999,
              background: "var(--card, #FFFFFF)",
              borderColor: "var(--border, #DCE0DC)",
              color: "var(--foreground, #111618)",
              boxShadow: "0 14px 34px -10px rgba(16, 24, 20, 0.24), 0 0 0 1px rgba(16, 24, 20, 0.04)",
            }}
            className="mbx-console rounded-xl border p-1 max-h-[264px] overflow-y-auto mbx-scroll"
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === strVal;
              const isHighlighted = idx === highlightIdx;
              const parts = splitOptionLabel(opt.label);
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onClick={() => handleSelect(opt)}
                  style={{
                    background: isSelected
                      ? "color-mix(in srgb, var(--primary, #4E8067) 11%, transparent)"
                      : isHighlighted
                      ? "var(--surface-subtle, #F2F4F1)"
                      : "transparent",
                    color: isSelected ? "var(--primary, #4E8067)" : "var(--foreground, #111618)",
                  }}
                  className={`w-full min-h-[34px] px-2.5 py-1.5 rounded-lg text-[12.5px] flex items-center justify-between gap-2 text-left transition-colors cursor-pointer disabled:opacity-40 ${
                    mono ? "mbx-mono" : ""
                  }`}
                >
                  <span className="truncate flex items-baseline gap-1.5 min-w-0">
                    <span className={`truncate ${isSelected ? "font-semibold" : "font-medium"}`}>{parts.main}</span>
                    {parts.meta && (
                      <span
                        style={{ color: isSelected ? "var(--primary, #4E8067)" : "var(--muted-foreground, #5A625E)" }}
                        className="mbx-mono text-[11px] opacity-80 truncate"
                      >
                        ({parts.meta})
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary, #4E8067)" }} />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
};

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
  variant?: "modal" | "sheet";
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, width = "max-w-[500px]", variant = "modal", children }) => {
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

  const isSheet = variant === "sheet";

  const overlay = (
    <div
      className={`mbx-console fixed inset-0 z-50 !m-0 flex ${
        isSheet ? "justify-end p-2.5 sm:p-3.5" : "items-center justify-center p-4 sm:p-6"
      } bg-black/45 backdrop-blur-[3px]`}
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        className={`mbx-dialog mbx-enter relative w-full ${width} ${
          isSheet ? "h-full" : "max-h-[90vh]"
        } rounded-[18px] bg-[var(--card)] border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3.5 px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-subtle)]/45">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.016em] text-[var(--foreground)]">{title}</h2>
            {subtitle && <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)] leading-relaxed">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-transparent hover:border-[var(--border)] mbx-hover shrink-0 transition-colors"
            aria-label="Close dialog"
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
  <div className="flex flex-col justify-end space-y-1.5 min-w-0">
    <div className="flex items-baseline justify-between gap-2 min-h-[19px] overflow-hidden">
      <span className="text-[12.5px] font-semibold tracking-[-0.008em] text-[var(--foreground)] whitespace-nowrap">
        {label}
      </span>
      {hint && (
        <span className="text-[11px] font-medium text-[var(--muted-foreground)] whitespace-nowrap truncate">
          {hint}
        </span>
      )}
    </div>
    {children}
  </div>
);

export const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    mono?: boolean;
    suffix?: React.ReactNode;
    prefix?: React.ReactNode;
  }
> = ({ mono = false, suffix, prefix, className = "", ...rest }) => {
  const inputEl = (
    <input
      {...rest}
      className={`mbx-control w-full h-[38px] px-3 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none focus:border-[var(--primary)] transition-all ${
        mono ? "mbx-mono text-[12.5px]" : ""
      } ${prefix ? "pl-8" : ""} ${suffix ? "pr-20" : ""} ${className}`}
    />
  );

  if (!suffix && !prefix) return inputEl;

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-3 text-[12px] font-medium text-[var(--muted-foreground)] pointer-events-none select-none">
          {prefix}
        </span>
      )}
      {inputEl}
      {suffix && (
        <span className="absolute right-2 px-1.5 py-0.5 rounded-md bg-[var(--surface-subtle)] border border-[var(--border)] text-[11px] font-medium mbx-mono text-[var(--muted-foreground)] pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  );
};

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
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[11.5px]">Rows:</span>
            <Select
              label="Rows per page"
              size="sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {Array.from(new Set([...pageSizeOptions, pageSize]))
                .sort((a, b) => a - b)
                .map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
            </Select>
          </div>
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


