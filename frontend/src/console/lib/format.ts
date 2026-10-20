/** Small, dependency-free formatting helpers for the console. */

export function formatCompact(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trim((n / 1e9).toFixed(digits))}B`;
  if (abs >= 1e6) return `${trim((n / 1e6).toFixed(digits))}M`;
  if (abs >= 1e4) return `${trim((n / 1e3).toFixed(digits))}K`;
  return Math.round(n).toLocaleString("en-US");
}

const trim = (s: string) => s.replace(/\.0+$/, "");

export function formatNumber(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "—";
}

export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatLatencyUs(us: number): string {
  if (!us) return "—";
  return us >= 1000 ? `${(us / 1000).toFixed(2)} ms` : `${Math.round(us)} µs`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const s = Math.round((now - t) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function shortId(id: string, head = 10, tail = 6): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function humanizeKey(key: string): string {
  return key
    .replace(/^(usr|ws|org)_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
