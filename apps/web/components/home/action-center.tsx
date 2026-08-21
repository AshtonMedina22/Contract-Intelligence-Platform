"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiStrip } from "./kpi-strip";
import { NeedsAttentionQueue } from "./needs-attention-queue";
import { PipelineTable } from "./pipeline-table";
import { WinLossSnapshotCard } from "./win-loss-snapshot";
import { ContractAlertSnapshot } from "./contract-alert-snapshot";
import { MarketSnapshotCard } from "./market-snapshot";
import type { ActionCenterData } from "@/lib/home/types";

type Props = {
  data: ActionCenterData;
};

function Section({
  title,
  children,
  href,
  linkLabel,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        {href && (
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href={href}>
              {linkLabel ?? "View all"}
              <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

export function ActionCenter({ data }: Props) {
  const hasNeedsAttention = data.attentionItems.length > 0;

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <Section title="Status">
        <KpiStrip kpi={data.kpi} />
      </Section>

      {/* Needs Attention Queue */}
      {hasNeedsAttention && (
        <Section title="Needs attention">
          <NeedsAttentionQueue items={data.attentionItems} />
        </Section>
      )}

      {/* Pipeline Table */}
      <Section title="Active pipeline" href="/procurement/opportunities" linkLabel="All pursuits">
        <PipelineTable pursuits={data.pipeline} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Win/Loss Snapshot */}
        <div className="space-y-3">
          <Section title="Win/Loss outcomes" href="/intelligence/win-loss">
            <WinLossSnapshotCard data={data.winLoss} />
          </Section>
        </div>

        {/* Contract Alert Snapshot */}
        <div className="space-y-3">
          <Section title="Contract renewals" href="/contracts/renewals">
            <ContractAlertSnapshot buckets={data.contractAlerts} />
          </Section>
        </div>
      </div>

      {/* Market Snapshot */}
      <Section title="Market intelligence" href="/intelligence/market">
        <MarketSnapshotCard data={data.market} />
      </Section>
    </div>
  );
}
