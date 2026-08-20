"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { opportunityWorkspaceTabs, OpportunityBadges } from "./shared";
import type { OpportunityHeader } from "@/lib/opportunity/load-workspace";
import type { WorkspaceSummary } from "@/lib/opportunity/load-workspace";
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

  return (
    <div className="space-y-4">
      <div className="space-y-2 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">{opportunity.title}</h1>
            <p className="text-sm text-muted-foreground">{opportunity.client_name ?? "No buyer linked"}</p>
            {opportunity.service_type ? (
              <p className="text-sm text-muted-foreground">Service: {opportunity.service_type}</p>
            ) : null}
            {opportunity.response_due_on ? (
              <p className="text-sm">
                Response due:{" "}
                <time dateTime={opportunity.response_due_on}>{opportunity.response_due_on}</time>
              </p>
            ) : null}
          </div>
          <OpportunityBadges stage={opportunity.stage} goNoGo={opportunity.go_no_go} />
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{summary.documentCount} docs</span>
          <span>·</span>
          <span>{summary.requirementCount} requirements</span>
          <span>·</span>
          <span>{summary.pricingLineCount} pricing lines</span>
          <span>·</span>
          <span>{summary.competitorBidCount} competitor bids</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/ingestion/intake?opportunity=${opportunity.id}`}>Add documents</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/intelligence/ask?q=${askQuery}&opportunity=${opportunity.id}`}>Ask about this pursuit</Link>
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-2 text-sm" aria-label="Opportunity workspace">
        {tabs.map((tab) => {
          const base = tabs[0].href;
          const active =
            tab.href === base ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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

      {children}
    </div>
  );
}
