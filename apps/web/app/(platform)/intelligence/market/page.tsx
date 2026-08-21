import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AskAboutThis,
  IntelligenceHonestyStrip,
  ObservationTiles,
} from "@/components/intelligence/honesty-strip";
import { askChip } from "@/lib/intelligence/ask-launch";
import { FEDERAL_AWARD_RESEARCH_NOTE, NO_MARKET_SHARE_NOTE, observationTile } from "@/lib/intelligence/observations";
import {
  LP_RENEWALS_LABEL,
  LP_RENEWALS_ROUTE,
  LP_RENEWALS_SCOPE_NOTE,
  MARKET_RADAR_LABEL,
  MARKET_RADAR_SCOPE_NOTE,
  RADAR_NO_PREDICTION_NOTE,
  buildRecompeteRadar,
  filterRadarRows,
  type RecompeteWatchStatus,
} from "@/lib/intelligence/recompete-radar";
import { RecompeteRadarTable } from "./recompete-radar-table";

type MarketSearchParams = {
  service?: string;
  geography?: string;
  from?: string;
  to?: string;
};

async function MarketOverview({
  searchParams,
}: {
  searchParams: Promise<MarketSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view market intelligence.</p>;

  const [awards, reviews, won, bids, pricingLines, competitors, clients, alerts] = await Promise.all([
    supabase.from("awards").select("*", { count: "exact", head: true }),
    supabase.from("win_loss_reviews").select("*", { count: "exact", head: true }),
    supabase.from("win_loss_reviews").select("*", { count: "exact", head: true }).eq("outcome", "WON"),
    supabase.from("competitor_bids").select("*", { count: "exact", head: true }),
    supabase.from("pricing_lines").select("*", { count: "exact", head: true }),
    supabase.from("competitors").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("contract_alerts").select("*", { count: "exact", head: true }),
  ]);

  // Radar inputs. Every one of these tables is already canonical and already sourced; the radar
  // adds no new field and no new estimate.
  const [
    awardRows,
    contractRows,
    optionRows,
    renewalRows,
    opportunityRows,
    buyerRows,
    reviewRows,
    watchRows,
  ] = await Promise.all([
    supabase
      .from("awards")
      .select("id, opportunity_id, winner_name, awarded_on, notice, source_fact_id, source_document_id")
      .limit(500),
    supabase
      .from("contracts")
      .select(
        "id, client_id, opportunity_id, title, contract_number, start_on, verified_end_on, source_fact_id, source_document_id",
      )
      .limit(500),
    supabase.from("contract_options").select("id, contract_id, label, exercise_by, source_fact_id").limit(500),
    supabase.from("renewals").select("id, contract_id, notice_due_on, option_year, source_fact_id").limit(500),
    supabase
      .from("opportunities")
      .select("id, client_id, title, service_type, site_location, source_url")
      .limit(500),
    supabase.from("clients").select("id, name").limit(500),
    supabase.from("win_loss_reviews").select("opportunity_id, outcome, winner_name").limit(500),
    supabase.from("recompete_watches").select("candidate_key, status").limit(500),
  ]);

  const radar = buildRecompeteRadar({
    awards: awardRows.data ?? [],
    contracts: contractRows.data ?? [],
    contractOptions: optionRows.data ?? [],
    renewalNotices: renewalRows.data ?? [],
    opportunities: opportunityRows.data ?? [],
    buyers: buyerRows.data ?? [],
    winLoss: reviewRows.data ?? [],
  });

  const watchByKey = new Map(
    (watchRows.data ?? []).map((w) => [w.candidate_key, w.status as RecompeteWatchStatus]),
  );

  const filters = {
    service: params.service ?? null,
    geography: params.geography ?? null,
    from: params.from ?? null,
    to: params.to ?? null,
  };
  const filtered = filterRadarRows(radar.market, filters).map((row) => ({
    ...row,
    watchStatus: watchByKey.get(row.key) ?? null,
  }));
  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  const tiles = [
    observationTile({
      label: "Verified awards",
      value: awards.count,
      source: "awards",
      href: "/intelligence/competitors",
      unit: "award records",
    }),
    observationTile({
      label: "Win/loss reviews",
      value: reviews.count,
      source: "win_loss_reviews",
      href: "/intelligence/win-loss",
      unit: "reviews",
    }),
    observationTile({
      label: "Documented wins",
      value: won.count,
      source: "win_loss_reviews.outcome=WON",
      href: "/intelligence/win-loss?outcome=WON",
      unit: "reviews",
    }),
    observationTile({
      label: "Sourced competitor bids",
      value: bids.count,
      source: "competitor_bids",
      href: "/intelligence/competitors",
      unit: "bids",
    }),
    observationTile({
      label: "Verified pricing lines",
      value: pricingLines.count,
      source: "pricing_lines",
      href: "/intelligence/pricing",
      unit: "lines",
    }),
    observationTile({
      label: "Buyers on file",
      value: clients.count,
      source: "clients",
      href: "/intelligence/clients",
      unit: "buyers",
    }),
    observationTile({
      label: "Competitors named",
      value: competitors.count,
      source: "competitors",
      href: "/intelligence/competitors",
      unit: "competitors",
    }),
    observationTile({
      label: "Market recompetes observed",
      value: radar.counts.market,
      source: "awards ⋈ contracts ⋈ options",
      basis: "INFERENCE",
      unit: "radar rows",
    }),
  ];

  const hasEvidence =
    (awards.count ?? 0) + (reviews.count ?? 0) + (bids.count ?? 0) + (pricingLines.count ?? 0) > 0;

  const chips = [
    askChip({
      label: "Market observation brief",
      mode: "report",
      report: "market",
      from: "market",
      filters: {
        awards: awards.count ?? 0,
        "radar rows": radar.counts.market,
        ...(filters.service ? { service: filters.service } : {}),
        ...(filters.geography ? { geography: filters.geography } : {}),
      },
    }),
    askChip({
      label: "What recompetes are coming?",
      mode: "ask",
      q: "Which verified contracts in the corpus are approaching expiration or an option decision, and who holds them?",
      from: "market",
      filters: { section: "recompete radar", "radar rows": radar.counts.market },
    }),
    askChip({
      label: "Locate award notices",
      mode: "locate",
      q: "award notice",
      from: "market",
    }),
    askChip({
      label: "Federal awards (USAspending)",
      mode: "ask",
      purpose: "GENERAL_QA",
      q: "Search USAspending federal awards relevant to this market — cite public observations only, no market share",
      from: "market",
      filters: { source: "usaspending.gov" },
    }),
  ];

  return (
    <div className="space-y-3">
      <IntelligenceNav />
      <PageHeader
        title="Market"
        description="Verified observations of buyers, awards, bids, pricing and recompetes in this tenant's corpus. Document counts are not market share."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={LP_RENEWALS_ROUTE}>{LP_RENEWALS_LABEL}</Link>
          </Button>
        }
      />
      <p
        data-testid="market-vs-lp-renewals"
        className="border-l-2 border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground"
      >
        <span className="font-medium text-foreground">Not L&amp;P renewals:</span> Market radar is
        external recompetes only. L&amp;P-held contracts live on{" "}
        <Link className="underline hover:text-foreground" href={LP_RENEWALS_ROUTE}>
          {LP_RENEWALS_LABEL}
        </Link>{" "}
        and are excluded from every market row and KPI below. Watch / Start Pursuit never clone an
        L&amp;P rebid and never invent a due date.
      </p>
      <IntelligenceHonestyStrip
        extra={`${NO_MARKET_SHARE_NOTE} ${RADAR_NO_PREDICTION_NOTE} ${FEDERAL_AWARD_RESEARCH_NOTE}`}
      />
      <AskAboutThis chips={chips} />

      {!hasEvidence ? (
        <EmptyState
          title="No verified market observations"
          description="Counts stay zero until awards, win/loss, sourced bids, or pricing lines are verified."
        />
      ) : null}

      <ObservationTiles tiles={tiles} />

      <section className="space-y-2" data-testid="recompete-radar">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">{MARKET_RADAR_LABEL}</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {radar.counts.market} rows
            {activeFilters.length > 0 ? " (filtered)" : ""} · verified {radar.counts.verified} · partial{" "}
            {radar.counts.partial} · unknown {radar.counts.unknown}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{MARKET_RADAR_SCOPE_NOTE}</p>

        <form className="flex flex-wrap items-end gap-2 border p-2" method="get">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="service">
              Service (opportunities.service_type)
            </Label>
            <select
              id="service"
              name="service"
              defaultValue={filters.service ?? ""}
              className="flex h-8 min-w-40 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Any observed</option>
              {radar.facets.services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="geography">
              Geography (opportunities.site_location)
            </Label>
            <select
              id="geography"
              name="geography"
              defaultValue={filters.geography ?? ""}
              className="flex h-8 min-w-40 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Any observed</option>
              {radar.facets.geographies.map((geography) => (
                <option key={geography} value={geography}>
                  {geography}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="from">
              Expected rebid from
            </Label>
            <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="to">
              Expected rebid to
            </Label>
            <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} className="h-8" />
          </div>
          <Button type="submit" size="sm">
            Apply
          </Button>
          {activeFilters.length > 0 ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/intelligence/market">Clear</Link>
            </Button>
          ) : null}
          <p className="basis-full text-[11px] text-muted-foreground">
            Only fields the schema already carries are filterable. A date filter drops rows whose rebid
            timing is unknown rather than assuming one.
          </p>
        </form>

        <RecompeteRadarTable rows={filtered} />
      </section>

      <section className="space-y-1.5 border-t pt-3" data-testid="lp-held-renewals">
        <h2 className="text-sm font-medium">{LP_RENEWALS_LABEL}</h2>
        <p className="text-xs text-muted-foreground">{LP_RENEWALS_SCOPE_NOTE}</p>
        <p className="text-sm">
          {radar.counts.lpHeld} contract(s) L&amp;P holds are excluded from the market radar above, and{" "}
          {alerts.count ?? 0} renewal alert(s) are bucketed.{" "}
          <Link className="underline" href={LP_RENEWALS_ROUTE}>
            Open the L&amp;P renewal queue
          </Link>
          .
        </p>
      </section>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-sm text-muted-foreground">
        <li>
          <Link className="underline hover:text-foreground" href="/intelligence/competitors">
            Competitors
          </Link>
        </li>
        <li>
          <Link className="underline hover:text-foreground" href="/intelligence/clients">
            Buyers
          </Link>
        </li>
        <li>
          <Link className="underline hover:text-foreground" href="/intelligence/win-loss">
            Win/Loss
          </Link>
        </li>
        <li>
          <Link className="underline hover:text-foreground" href="/intelligence/pricing">
            Pricing
          </Link>
        </li>
      </ul>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<MarketSearchParams> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <MarketOverview searchParams={searchParams} />
    </Suspense>
  );
}
