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
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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

/** Sequential ingest pipeline — upload through verification. */
export const INGESTION_TABS: SectionTab[] = [
  { href: "/ingestion/intake", label: "1. Intake" },
  { href: "/ingestion/processing", label: "2. Processing" },
  { href: "/ingestion/verification", label: "3. Verification" },
  { href: "/ingestion/exceptions", label: "Exceptions" },
  { href: "/ingestion/bulk", label: "Bulk" },
];

/** Package registry — browse grouped evidence after ingestion. */
export const PROCUREMENT_TABS: SectionTab[] = [
  { href: "/procurement/documents", label: "Documents" },
  { href: "/procurement/opportunities", label: "Opportunities" },
  { href: "/procurement/clients", label: "Clients" },
  { href: "/procurement/requirements", label: "Requirements" },
];

export const INTELLIGENCE_TABS: SectionTab[] = [
  { href: "/intelligence/ask", label: "Ask" },
  { href: "/intelligence/market", label: "Market" },
  { href: "/intelligence/pricing", label: "Pricing" },
  { href: "/intelligence/win-loss", label: "Win/Loss" },
  { href: "/intelligence/content", label: "Content" },
  { href: "/intelligence/reports", label: "Reports" },
];

/** Market drill-down — stays inside Intelligence, no cross-domain jumps. */
export const MARKET_TABS: SectionTab[] = [
  { href: "/intelligence/market", label: "Overview" },
  { href: "/intelligence/competitors", label: "Competitors" },
  { href: "/intelligence/clients", label: "Buyers & research" },
];

export const CONTRACT_TABS: SectionTab[] = [
  { href: "/contracts", label: "Portfolio" },
  { href: "/contracts/renewals", label: "Renewals" },
  { href: "/contracts/compliance", label: "Compliance" },
];

/** @deprecated Use INGESTION_TABS or PROCUREMENT_TABS */
export const LIBRARY_TABS = INGESTION_TABS;

export function isMarketSubPath(pathname: string) {
  return (
    pathname.startsWith("/intelligence/market") ||
    pathname.startsWith("/intelligence/competitors") ||
    pathname.startsWith("/intelligence/clients")
  );
}

export function IntelligenceNav() {
  const pathname = usePathname();
  return (
    <>
      <SectionTabs tabs={INTELLIGENCE_TABS} />
      {isMarketSubPath(pathname) ? <SectionTabs tabs={MARKET_TABS} sub /> : null}
    </>
  );
}
