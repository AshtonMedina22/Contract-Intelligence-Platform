"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { HomeKpi } from "@/lib/home/types";

type KpiChipProps = {
  label: string;
  value: number;
  href: string;
  variant?: "default" | "warning" | "muted";
};

function KpiChip({ label, value, href, variant = "default" }: KpiChipProps) {
  const showLink = value > 0;
  const content = (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        variant === "warning"
          ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          : variant === "muted"
            ? "border-muted bg-muted/50"
            : "border-border bg-background"
      }`}
    >
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={value > 0 ? "default" : "secondary"} className="tabular-nums">
        {value}
      </Badge>
    </div>
  );

  if (showLink) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

type KpiStripProps = {
  kpi: HomeKpi;
};

export function KpiStrip({ kpi }: KpiStripProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <KpiChip
        label="Active pursuits"
        value={kpi.activePursuits}
        href="/procurement/opportunities"
      />
      <KpiChip
        label="Due ≤14 days"
        value={kpi.pursuitsDueSoon}
        href="/procurement/opportunities"
        variant={kpi.pursuitsDueSoon > 0 ? "warning" : "default"}
      />
      <KpiChip
        label="Verification"
        value={kpi.verificationBacklog}
        href="/ingestion/verification"
        variant={kpi.verificationBacklog > 0 ? "warning" : "default"}
      />
      <KpiChip
        label="Processing failures"
        value={kpi.processingFailures}
        href="/ingestion/processing"
        variant={kpi.processingFailures > 0 ? "warning" : "default"}
      />
      <KpiChip
        label="Open exceptions"
        value={kpi.openExceptions}
        href="/ingestion/exceptions"
      />
      <KpiChip
        label="Contract alerts"
        value={kpi.contractsInReviewWindow}
        href="/contracts/renewals"
      />
      {kpi.lpInputRequired !== null && kpi.lpInputRequired > 0 && (
        <KpiChip
          label="L&P input required"
          value={kpi.lpInputRequired}
          href="/procurement/opportunities"
          variant="warning"
        />
      )}
      {kpi.pricingDraftDecisions !== null && kpi.pricingDraftDecisions > 0 && (
        <KpiChip
          label="Pricing drafts"
          value={kpi.pricingDraftDecisions}
          href="/procurement/opportunities"
        />
      )}
      {kpi.approvalsRequested !== null && kpi.approvalsRequested > 0 && (
        <KpiChip
          label="Approvals requested"
          value={kpi.approvalsRequested}
          href="/procurement/opportunities"
          variant="warning"
        />
      )}
      {kpi.activeContracts !== null && (
        <KpiChip
          label="Active contracts"
          value={kpi.activeContracts}
          href="/contracts"
          variant="muted"
        />
      )}
    </div>
  );
}
