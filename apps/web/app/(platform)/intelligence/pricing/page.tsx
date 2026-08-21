import { Suspense } from "react";
import { IntelligenceNav } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { PageHeader } from "@/components/shell";
import { createClient } from "@/lib/supabase/server";
import { registryEntry } from "@/lib/data-model/registry";
import { formatMoney } from "@/lib/opportunity/pricing-math";
import {
  AskAboutThis,
  IntelligenceHonestyStrip,
  ObservationTiles,
} from "@/components/intelligence/honesty-strip";
import { askChip } from "@/lib/intelligence/ask-launch";
import { observationTile, observedSpan } from "@/lib/intelligence/observations";
import { PricingLinesTable, type PricingLineRow } from "./pricing-lines-table";
import { CompetitorRatesTable, type CompetitorRateRow } from "./competitor-lines-table";

async function PricingContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view pricing intelligence.</p>;

  const [{ data, error }, { data: competitorLines }, { count: decisionCount }] = await Promise.all([
    supabase
      .from("pricing_lines")
      .select(
        "id, labor_category, rate_type, site_or_post, requested_rate, internal_cost_rate, proposed_rate, awarded_rate, current_rate, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id, opportunity_id, opportunities(title)",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("competitor_pricing_lines")
      .select("id, vendor_name, labor_category, hourly_rate, rate_type, opportunity_id")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("pricing_decisions").select("id", { count: "exact", head: true }).eq("status", "HUMAN_APPROVED"),
  ]);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: PricingLineRow[] = (data ?? []).map((row) => {
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      labor_category: row.labor_category,
      opportunity_id: row.opportunity_id,
      opportunity_title: opportunity?.title ?? null,
      requested_rate: row.requested_rate,
      internal_cost_rate: row.internal_cost_rate,
      proposed_rate: row.proposed_rate,
      awarded_rate: row.awarded_rate,
      current_rate: row.current_rate,
      requested_source_fact_id: row.requested_source_fact_id,
      proposed_source_fact_id: row.proposed_source_fact_id,
      awarded_source_fact_id: row.awarded_source_fact_id,
      current_source_fact_id: row.current_source_fact_id,
    };
  });

  const competitorRows: CompetitorRateRow[] = (competitorLines ?? []).map((row) => ({
    id: row.id,
    vendor_name: row.vendor_name,
    labor_category: row.labor_category,
    rate_type: row.rate_type,
    hourly_rate: row.hourly_rate,
    opportunity_id: row.opportunity_id,
  }));

  const span = observedSpan(rows.flatMap((r) => [r.awarded_rate, r.proposed_rate, r.current_rate]));
  const observed = span ? `${formatMoney(span.min)} – ${formatMoney(span.max)} (n=${span.count})` : "—";

  const entry = registryEntry("pricing_lines");

  const tiles = [
    observationTile({ label: "Verified L&P lines", value: rows.length, source: "pricing_lines", unit: "lines" }),
    observationTile({
      label: "Lines with an awarded rate",
      value: rows.filter((r) => r.awarded_rate != null).length,
      source: "pricing_lines.awarded_rate",
      unit: "lines",
    }),
    observationTile({
      label: "Sourced competitor rates",
      value: competitorRows.length,
      source: "competitor_pricing_lines",
      href: "/intelligence/competitors",
      unit: "rates",
    }),
    observationTile({
      label: "Human-approved bid decisions",
      value: decisionCount,
      source: "pricing_decisions.status=HUMAN_APPROVED",
      unit: "decisions",
    }),
  ];

  const chips = [
    askChip({
      label: "Pricing analysis",
      mode: "ask",
      from: "pricing",
      q: "What do the verified requested, submitted, awarded and current rates show across the corpus, and where do competitor rates sit against them?",
      filters: { "L&P lines": rows.length, "competitor rates": competitorRows.length, "observed span": observed },
    }),
    askChip({
      label: "Pricing report",
      mode: "report",
      report: "pricing",
      from: "pricing",
      filters: { "L&P lines": rows.length },
    }),
  ];

  return (
    <div className="space-y-3">
      <IntelligenceNav />
      <PageHeader
        title="Pricing intelligence"
        description="Cross-corpus analysis of verified L&P and competitor rates. To price a live solicitation, open that Pursuit → Pricing workbench — do not force operators out of the pursuit to decide a bid."
      />
      <IntelligenceHonestyStrip extra="A rate span is the observed minimum and maximum with n stated. It is not a recommended rate, a market rate, or a benchmark." />
      <AskAboutThis chips={chips} />
      {entry ? <DataRegistryCallout entry={entry} /> : null}

      <ObservationTiles tiles={tiles} />
      <p className="text-xs text-muted-foreground">
        Observed rate span across awarded / submitted / current: <span className="tabular-nums">{observed}</span>
      </p>

      <section className="space-y-1.5">
        <h2 className="text-sm font-medium">L&amp;P five-truth lines</h2>
        <PricingLinesTable rows={rows} />
      </section>

      <section className="space-y-1.5">
        <h2 className="text-sm font-medium">Sourced competitor pricing lines</h2>
        <CompetitorRatesTable rows={competitorRows} />
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <PricingContent />
    </Suspense>
  );
}
