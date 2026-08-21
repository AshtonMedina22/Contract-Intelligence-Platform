import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RenewalsTable, type AlertRow } from "../contracts-table";
import { ContractsNav } from "@/components/section-tabs";
import { loadContractPortfolio } from "@/lib/contracts/load-workspace";
import {
  automationAudit,
  COMPLIANCE_ROUTE,
  MARKET_RADAR_ROUTE,
  PORTFOLIO_ROUTE,
  RENEWALS_LABEL,
} from "@/lib/contracts/portfolio-model";
import {
  AutomationAuditStrip,
  ContractHonestyStrip,
  RenewalBucketStrip,
} from "@/components/contract-workspace/portfolio-strips";
import { PageHeader, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";

async function RenewalsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view renewals.</p>;

  // Recompute buckets under the caller's RLS before reading them, exactly as before. This is the
  // only automation on the page and it writes nothing but contract_alerts rows.
  await supabase.rpc("refresh_contract_alerts");

  const portfolio = await loadContractPortfolio();
  const queue = portfolio.rows.filter((row) => row.bucket != null);

  const rows: AlertRow[] = queue.map((row) => ({
    id: row.id,
    bucket: row.bucket as string,
    days_until: row.daysUntil,
    verified_end_on: row.expirationOn,
    contract_title: row.title,
    contract_id: row.id,
    buyer_name: row.buyerName,
    next_action: row.nextAction.label,
    next_action_basis: row.nextAction.basis,
    options_on_file: row.options.length,
    next_option_exercise_by: row.nextOptionExerciseBy,
  }));

  return (
    <div className="space-y-3">
      <ContractsNav />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={PORTFOLIO_ROUTE} className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Portfolio
        </Link>
        <span>/</span>
        <span>Renewals</span>
      </div>
      <PageHeader
        title={RENEWALS_LABEL}
        description="Every L&P-held contract inside the 180-day window, most urgent first, with the next dated obligation on each row."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={PORTFOLIO_ROUTE}>Portfolio</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={COMPLIANCE_ROUTE}>Compliance</Link>
            </Button>
          </>
        }
      />
      <p
        data-testid="renewals-vs-market-radar"
        className="border-l-2 border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground"
      >
        <span className="font-medium text-foreground">L&amp;P renewals ≠ Market radar:</span> This
        queue is only contracts this org holds, bucketed from <code>verified_end_on</code>. External
        recompetes never appear here — they live on{" "}
        <Link className="underline hover:text-foreground" href={MARKET_RADAR_ROUTE}>
          Intelligence → Market
        </Link>
        . Alert upserts never auto-create pursuits.
      </p>
      <ContractHonestyStrip
        extra={
          <>
            A rebid started here is L&P defending its own work. Recompetes on contracts L&P does not hold are a
            different list on{" "}
            <Link className="underline hover:text-foreground" href={MARKET_RADAR_ROUTE}>
              Intelligence → Market
            </Link>
            .
          </>
        }
      />

      <RenewalBucketStrip buckets={portfolio.buckets} linkToQueue={false} />

      {rows.length > 0 ? (
        <RenewalsTable rows={rows} />
      ) : (
        <EmptyState
          title="No renewal alerts"
          description="Buckets use verified_end_on only. Contracts without a verified end date do not appear here and are not assumed safe — they are listed under 'No verified end' on the portfolio."
        />
      )}

      <p className="text-[11px] text-muted-foreground">
        {portfolio.undatedCount > 0 ? (
          <>
            {portfolio.undatedCount} contract{portfolio.undatedCount === 1 ? "" : "s"} could not be bucketed
            because no end date is verified.{" "}
            <Link className="underline hover:text-foreground" href="/contracts?filter=UNDATED">
              Review them on the portfolio
            </Link>
            .
          </>
        ) : (
          "Every contract on file carries a verified end date, so no row is missing from this queue."
        )}
      </p>

      <AutomationAuditStrip
        audit={automationAudit({ alertsComputedOn: portfolio.alertsComputedOn, refreshedOnLoad: true })}
      />
    </div>
  );
}

export default function RenewalsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <RenewalsContent />
    </Suspense>
  );
}
