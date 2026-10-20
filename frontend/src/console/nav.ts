/**
 * Console information architecture.
 * `route` = migrated to the new console (relative to /[org]/[env]).
 * `classicView` = still served by the classic console at /classic (migrated phase by phase).
 */
export type NavIcon =
  | "home"
  | "meters"
  | "events"
  | "dlq"
  | "customers"
  | "entitlements"
  | "plans"
  | "invoices"
  | "cost"
  | "analytics"
  | "keys"
  | "playground"
  | "docs";

export interface NavItem {
  id: string;
  label: string;
  icon: NavIcon;
  route?: string;
  classicView?: string;
  badgeKey?: "dlq" | "nearLimit";
}

export interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { id: "home", items: [{ id: "overview", label: "Overview", icon: "home", route: "overview" }] },
  {
    id: "usage",
    label: "Usage",
    items: [
      { id: "meters", label: "Meters", icon: "meters", route: "meters" },
      { id: "events", label: "Events", icon: "events", route: "events" },
      { id: "dlq", label: "Dead letters", icon: "dlq", route: "dlq", badgeKey: "dlq" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { id: "customers", label: "Customers", icon: "customers", route: "customers", badgeKey: "nearLimit" },
    ],
  },
  {
    id: "revenue",
    label: "Revenue",
    items: [
      { id: "plans", label: "Plans", icon: "plans", route: "plans" },
      { id: "invoices", label: "Invoices", icon: "invoices", route: "invoices" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { id: "cost", label: "AI cost", icon: "cost", route: "cost" },
      { id: "analytics", label: "Product analytics", icon: "analytics", route: "analytics" },
    ],
  },
  {
    id: "developers",
    label: "Developers",
    items: [
      { id: "keys", label: "API keys", icon: "keys", route: "keys" },
      { id: "docs", label: "Docs", icon: "docs", route: "docs" },
    ],
  },
];

export function classicHref(view: string, orgId?: string, envId?: string): string {
  const params = new URLSearchParams({ view });
  if (orgId) params.set("org", orgId);
  if (envId) params.set("env", envId);
  return `/classic?${params.toString()}`;
}
