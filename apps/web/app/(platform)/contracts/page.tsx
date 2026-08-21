import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContractsNav } from "@/components/section-tabs";
import { ContractsTable } from "./contracts-table";
import { loadContractPortfolio } from "@/lib/contracts/load-workspace";
import {
  automationAudit,
  filterPortfolioRows,
  portfolioFilterFromParam,
  portfolioKpis,
  PORTFOLIO_FILTERS,
  PORTFOLIO_FILTER_DEFINITIONS,
  PORTFOLIO_FILTER_LABELS,
  RENEWALS_ROUTE,
  COMPLIANCE_ROUTE,
} from "@/lib/contracts/portfolio-model";
import { ObservationTiles } from "@/components/intelligence/honesty-strip";
import {
  AutomationAuditStrip,
  ContractHonestyStrip,
  RenewalBucketStrip,
} from "@/components/contract-workspace/portfolio-strips";
import { PageHeader, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";

type ContractsSearchParams = { filter?: string };

async function ContractsContent({ searchParams }: { searchParams: Promise<ContractsSearchParams> }) {
  const { filter: filterParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view contracts.</p>;

  const portfolio = await loadContractPortfolio();
  const filter = portfolioFilterFromParam(filterParam);
  const rows = filterPortfolioRows(portfolio.rows, filter);
  const tiles = portfolioKpis(portfolio);
  const value = portfolio.activeContractValue;

  return (
    <div className="space-y-3">
      <ContractsNav />
      <PageHeader
        title="Contract portfolio"
        description="Contracts L&P holds. Open a contract for Overview, Service Plan, Commercial Terms, Changes and Renewal."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={RENEWALS_ROUTE}>Renewal & rebid center</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={COMPLIANCE_ROUTE}>Compliance</Link>
            </Button>
          </>
        }
      />
      <ContractHonestyStrip />

      <ObservationTiles tiles={tiles} />

      <p
        data-testid="active-contract-value"
        className="border-l-2 border-muted-foreground/40 px-2.5 py-1.5 text-xs text-muted-foreground"
      >
        <span className="font-medium text-foreground">Active Contract Value:</span>{" "}
        {value.amount != null ? (
          <>
            <span className="tabular-nums text-foreground">${value.amount.toLocaleString()}</span> — {value.basis}{" "}
            (n={value.covered} of {value.inScope} active contracts).
          </>
        ) : (
          <span data-testid="active-contract-value-withheld">{value.withheldReason}</span>
        )}
      </p>

      <RenewalBucketStrip buckets={portfolio.buckets} />

      <nav data-testid="portfolio-filters" className="flex flex-wrap gap-1 text-xs" aria-label="Portfolio filters">
        {PORTFOLIO_FILTERS.map((option) => (
          <Link
            key={option}
            href={option === "ALL" ? "/contracts" : `/contracts?filter=${option}`}
            title={PORTFOLIO_FILTER_DEFINITIONS[option]}
            data-filter={option}
            data-active={option === filter}
            className={
              option === filter
                ? "border bg-muted px-2 py-0.5 font-medium text-foreground"
                : "border px-2 py-0.5 text-muted-foreground hover:text-foreground"
            }
          >
            {PORTFOLIO_FILTER_LABELS[option]} ({portfolio.counts[option]})
          </Link>
        ))}
      </nav>
      <p className="text-[11px] text-muted-foreground">
        Lanes are a partition of the same {portfolio.counts.ALL} rows, computed from status and alert bucket:{" "}
        {PORTFOLIO_FILTER_DEFINITIONS.ACTIVE} {PORTFOLIO_FILTER_DEFINITIONS.RENEWAL_REBID}{" "}
        {PORTFOLIO_FILTER_DEFINITIONS.EXPIRING} {PORTFOLIO_FILTER_DEFINITIONS.CLOSED}{" "}
        {PORTFOLIO_FILTER_DEFINITIONS.UNDATED} Filtering changes the table only — the KPI counts above stay
        over the whole portfolio.
      </p>

      {portfolio.counts.ALL > 0 ? (
        <ContractsTable rows={rows} />
      ) : (
        <EmptyState
          title="No contracts yet"
          description="Verify a contract end date on an awarded or current document to populate this portfolio. Nothing here is seeded or inferred."
        />
      )}

      <AutomationAuditStrip
        audit={automationAudit({ alertsComputedOn: portfolio.alertsComputedOn, refreshedOnLoad: false })}
      />
    </div>
  );
}

export default function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<ContractsSearchParams>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ContractsContent searchParams={searchParams} />
    </Suspense>
  );
}
