import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import {
  AskAboutThis,
  IntelligenceHonestyStrip,
  ObservationTiles,
} from "@/components/intelligence/honesty-strip";
import { askChip } from "@/lib/intelligence/ask-launch";
import {
  FEDERAL_AWARD_RESEARCH_NOTE,
  INFERENCE_LABEL,
  OBSERVED_LABEL,
  observationTile,
} from "@/lib/intelligence/observations";
import {
  CompetitorBidsTable,
  CompetitorPricingLinesTable,
  EvaluationScoresTable,
  type CompetitorBidRow,
  type CompetitorPricingLineRow,
  type EvaluationScoreRow,
} from "./competitors-table";

async function CompetitorsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view competitor intelligence.</p>;

  const [bidsRes, linesRes, scoresRes, competitorsRes] = await Promise.all([
    supabase
      .from("competitor_bids")
      .select(
        "id, quoted_amount, rank, note, source_url, source_document_id, source_fact_id, opportunity_id, competitors(name), opportunities(title)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("competitor_pricing_lines")
      .select(
        "id, vendor_name, labor_category, hourly_rate, extended_amount, source_fact_id, source_document_id, opportunity_id, opportunities(title)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("evaluation_scores")
      .select("id, respondent_name, points, max_points, rank, notes, opportunity_id, opportunities(title)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("competitors").select("id", { count: "exact", head: true }),
  ]);

  if (bidsRes.error) return <p className="text-sm text-red-600">{bidsRes.error.message}</p>;
  if (linesRes.error) return <p className="text-sm text-red-600">{linesRes.error.message}</p>;
  if (scoresRes.error) return <p className="text-sm text-red-600">{scoresRes.error.message}</p>;

  const bidRows: CompetitorBidRow[] = (bidsRes.data ?? []).map((row) => {
    const competitor = Array.isArray(row.competitors) ? row.competitors[0] : row.competitors;
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      competitor_name: competitor?.name ?? null,
      opportunity_id: row.opportunity_id,
      opportunity_title: opportunity?.title ?? null,
      quoted_amount: row.quoted_amount,
      rank: row.rank,
      note: row.note,
      source: {
        url: row.source_url,
        documentId: row.source_document_id,
        factId: row.source_fact_id,
      },
    };
  });

  const lineRows: CompetitorPricingLineRow[] = (linesRes.data ?? []).map((row) => {
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      vendor_name: row.vendor_name,
      labor_category: row.labor_category,
      hourly_rate: row.hourly_rate,
      extended_amount: row.extended_amount,
      opportunity_id: row.opportunity_id,
      opportunity_title: opportunity?.title ?? null,
      source: { url: null, documentId: row.source_document_id, factId: row.source_fact_id },
    };
  });

  const scoreRows: EvaluationScoreRow[] = (scoresRes.data ?? []).map((row) => {
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      respondent_name: row.respondent_name,
      opportunity_id: row.opportunity_id,
      opportunity_title: opportunity?.title ?? null,
      points: row.points,
      max_points: row.max_points,
      rank: row.rank,
      notes: row.notes,
    };
  });

  const namedInBids = new Set(bidRows.map((r) => r.competitor_name).filter(Boolean)).size;
  const tiles = [
    observationTile({
      label: "Competitors named",
      value: competitorsRes.count,
      source: "competitors",
      unit: "competitors",
    }),
    observationTile({ label: "Observed bids", value: bidRows.length, source: "competitor_bids", unit: "bids" }),
    observationTile({
      label: "Competitor pricing lines",
      value: lineRows.length,
      source: "competitor_pricing_lines",
      unit: "lines",
    }),
    observationTile({
      label: "Competitors with a priced bid",
      value: namedInBids,
      source: "competitor_bids ⋈ competitors",
      basis: "INFERENCE",
      unit: "competitors",
    }),
  ];

  const chips = [
    askChip({
      label: "Competitor analysis",
      mode: "ask",
      from: "competitors",
      q: "What do the verified competitor bids, pricing lines and evaluation scores show about how rivals priced and scored?",
      filters: { bids: bidRows.length, "pricing lines": lineRows.length, scores: scoreRows.length },
    }),
    askChip({
      label: "Competitor report",
      mode: "report",
      report: "competitor",
      from: "competitors",
      filters: { bids: bidRows.length },
    }),
    askChip({ label: "Locate a competitor by name", mode: "locate", q: "competitor", from: "competitors" }),
    askChip({
      label: "Federal awards by recipient",
      mode: "ask",
      purpose: "COMPETITOR_ANALYSIS",
      q: "Look up USAspending federal awards for named competitors as recipients — cite only, no market share",
      from: "competitors",
      filters: { source: "usaspending.gov", competitors: competitorsRes.count ?? 0 },
    }),
  ];

  return (
    <div className="space-y-3">
      <IntelligenceNav />
      <PageHeader
        title="Competitors"
        description="Observed bids, pricing lines, and evaluation scores only — sourced from documents, verified facts, or URLs. Not a corporate win rate. Geography/services appear only when those fields exist on evidence."
      />
      <IntelligenceHonestyStrip
        extra={`${OBSERVED_LABEL} means the value is in the cited source. ${INFERENCE_LABEL} means we joined records to get it — the join is named and the conclusion is not in any single source. ${FEDERAL_AWARD_RESEARCH_NOTE}`}
      />
      <AskAboutThis chips={chips} />

      <ObservationTiles tiles={tiles} />

      <section className="space-y-1.5">
        <h2 className="text-sm font-medium">Observed bids</h2>
        <CompetitorBidsTable rows={bidRows} />
      </section>

      <section className="space-y-1.5">
        <h2 className="text-sm font-medium">Pricing lines</h2>
        <CompetitorPricingLinesTable rows={lineRows} />
      </section>

      <section className="space-y-1.5">
        <h2 className="text-sm font-medium">Evaluation scores</h2>
        <EvaluationScoresTable rows={scoreRows} />
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <CompetitorsContent />
    </Suspense>
  );
}
