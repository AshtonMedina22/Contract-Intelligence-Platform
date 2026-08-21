"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SectionTab = { href: string; label: string };

export function SectionTabs({
  tabs,
  sub = false,
}: {
  tabs: readonly SectionTab[];
  sub?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "mb-4 flex flex-wrap gap-1 border-b pb-2 text-sm",
        sub && "mb-3 border-dashed pb-1.5 text-xs",
      )}
      aria-label={sub ? "Sub-section navigation" : "Section navigation"}
    >
      {tabs.map((tab) => {
        const exactOnly = tab.href === "/contracts" || tab.href === "/system/settings";
        const active = exactOnly
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground",
              sub && "px-2 py-0.5",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const DATA_OPS_TABS: SectionTab[] = [
  { href: "/ingestion/intake", label: "Intake" },
  { href: "/ingestion/processing", label: "Processing" },
  { href: "/ingestion/verification", label: "Verification" },
  { href: "/ingestion/exceptions", label: "Exceptions" },
  { href: "/ingestion/bulk", label: "Historical Migration" },
];

/** @deprecated Use DATA_OPS_TABS */
export const INGESTION_TABS = DATA_OPS_TABS;

export const INTELLIGENCE_TABS: SectionTab[] = [
  { href: "/intelligence/clients", label: "Buyers" },
  { href: "/intelligence/competitors", label: "Competitors" },
  { href: "/intelligence/market", label: "Market" },
  { href: "/intelligence/pricing", label: "Pricing" },
  { href: "/intelligence/win-loss", label: "Win/Loss" },
  { href: "/intelligence/content", label: "Content" },
  { href: "/intelligence/reports", label: "Reports" },
];

export const SETTINGS_TABS: SectionTab[] = [
  { href: "/system/settings", label: "Organization" },
  { href: "/system/data-quality", label: "Data quality" },
  { href: "/system/data-model", label: "Data model" },
];

export const CONTRACTS_TABS: SectionTab[] = [
  { href: "/contracts", label: "Portfolio" },
];

export function IntelligenceNav() {
  return <SectionTabs tabs={INTELLIGENCE_TABS} />;
}

export function DataOpsNav() {
  return <SectionTabs tabs={DATA_OPS_TABS} />;
}

export function ContractsNav() {
  return <SectionTabs tabs={CONTRACTS_TABS} />;
}

export function SettingsNav() {
  return <SectionTabs tabs={SETTINGS_TABS} />;
}
