"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SectionTab = { href: string; label: string };

export function SectionTabs({ tabs }: { tabs: readonly SectionTab[] }) {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b pb-2 text-sm">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground",
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

export const INTELLIGENCE_TABS: SectionTab[] = [
  { href: "/intelligence/ask", label: "Ask" },
  { href: "/intelligence/market", label: "Market" },
  { href: "/intelligence/pricing", label: "Pricing" },
  { href: "/intelligence/win-loss", label: "Win/Loss" },
  { href: "/intelligence/content", label: "Content" },
  { href: "/intelligence/reports", label: "Reports" },
];

export const MARKET_TABS: SectionTab[] = [
  { href: "/intelligence/market", label: "Overview" },
  { href: "/intelligence/competitors", label: "Competitors" },
  { href: "/intelligence/clients", label: "Buyers / research" },
  { href: "/intelligence/win-loss", label: "Awards" },
  { href: "/contracts/renewals", label: "Upcoming rebids" },
];

export const LIBRARY_TABS: SectionTab[] = [
  { href: "/procurement/documents", label: "Library" },
  { href: "/ingestion/intake", label: "Intake" },
  { href: "/ingestion/processing", label: "Processing" },
  { href: "/ingestion/verification", label: "Verification" },
  { href: "/ingestion/exceptions", label: "Exceptions" },
  { href: "/ingestion/bulk", label: "Bulk" },
];

export const CONTRACT_TABS: SectionTab[] = [
  { href: "/contracts", label: "Portfolio" },
  { href: "/contracts/renewals", label: "Renewals" },
  { href: "/contracts/compliance", label: "Compliance" },
];
