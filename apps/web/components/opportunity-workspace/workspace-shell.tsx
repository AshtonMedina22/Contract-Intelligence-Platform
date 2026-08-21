"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { opportunityWorkspaceTabs, OpportunityBadges } from "./shared";
import type { OpportunityHeader } from "@/lib/opportunity/load-workspace";
import type { WorkspaceSummary } from "@/lib/opportunity/load-workspace";
import {
  PROCUREMENT_RAILS,
  SOLICITATION_KINDS,
} from "@/lib/opportunity/proposal-packet";
import { Button } from "@/components/ui/button";

export function OpportunityWorkspaceShell({
  opportunity,
  summary,
  children,
}: {
  opportunity: OpportunityHeader;
  summary: WorkspaceSummary;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = opportunityWorkspaceTabs(opportunity.id);
  const askQuery = encodeURIComponent(
    `${opportunity.client_name ?? ""} ${opportunity.title} security requirements pricing`.trim(),
  );

  const metaParts: string[] = [];
  if (opportunity.service_type) metaParts.push(opportunity.service_type);
  if (opportunity.site_location) metaParts.push(opportunity.site_location);
  if (opportunity.procurement_rail) {
    const rail = PROCUREMENT_RAILS.find((r) => r.value === opportunity.procurement_rail)?.label;
    const kind = opportunity.solicitation_kind
      ? SOLICITATION_KINDS.find((k) => k.value === opportunity.solicitation_kind)?.label
      : null;
    metaParts.push([rail, kind, opportunity.vehicle_ref].filter(Boolean).join(" · "));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 border-b pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">{opportunity.title}</h1>
            <p className="text-sm text-muted-foreground">{opportunity.client_name ?? "No buyer linked"}</p>
            {metaParts.length > 0 ? (
              <p className="text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
            ) : null}
            {opportunity.response_due_on ? (
              <p className="text-xs">
                Due: <time dateTime={opportunity.response_due_on}>{opportunity.response_due_on}</time>
              </p>
            ) : null}
          </div>
          <OpportunityBadges stage={opportunity.stage} goNoGo={opportunity.go_no_go} />
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span>{summary.documentCount} docs</span>
          <span>·</span>
          <span>{summary.requirementCount} reqs</span>
          <span>·</span>
          <span>{summary.staffingCount} staff</span>
          <span>·</span>
          <span>{summary.pricingLineCount} lines</span>
          <span>·</span>
          <span>{summary.competitorBidCount} bids</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link href={`/ingestion/intake?opportunity=${opportunity.id}`}>Add docs</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link href={`/intelligence/ask?q=${askQuery}&opportunity=${opportunity.id}`}>Ask</Link>
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-1.5 text-sm" aria-label="Pursuit workspace">
        {tabs.map((tab) => {
          const base = tabs[0].href;
          const active =
            tab.href === base ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-2 py-0.5 text-muted-foreground hover:text-foreground",
                active && "bg-muted font-medium text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
