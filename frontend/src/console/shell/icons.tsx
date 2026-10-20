"use client";

import React from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChartColumn,
  ChartPie,
  CircleDollarSign,
  FileText,
  House,
  Inbox,
  KeyRound,
  Layers,
  Receipt,
  Terminal,
  Users,
} from "lucide-react";
import type { NavIcon } from "../nav";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  home: House,
  meters: ChartColumn,
  events: Activity,
  dlq: Inbox,
  customers: Users,
  entitlements: Layers,
  plans: FileText,
  invoices: Receipt,
  cost: CircleDollarSign,
  analytics: ChartPie,
  keys: KeyRound,
  playground: Terminal,
  docs: BookOpen,
};

export const NavGlyph: React.FC<{ icon: NavIcon; className?: string }> = ({ icon, className = "w-4 h-4" }) => {
  const Cmp = ICONS[icon];
  return <Cmp className={className} />;
};

export const ExternalGlyph = ArrowUpRight;
