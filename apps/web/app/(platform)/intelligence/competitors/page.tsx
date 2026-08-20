import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
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

  const [bidsRes, linesRes, scoresRes] = await Promise.all([
    supabase
      .from("competitor_bids")
      .select(
        "id, quoted_amount, rank, note, source_url, source_document_id, source_fact_id, competitors(name), opportunities(title)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("competitor_pricing_lines")
      .select(
        "id, vendor_name, labor_category, hourly_rate, extended_amount, source_fact_id, source_document_id, opportunities(title)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("evaluation_scores")
      .select("id, respondent_name, points, max_points, rank, notes, opportunities(title)")
      .order("created_at", { ascending: false })
      .limit(200),
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
      opportunity_title: opportunity?.title ?? null,
      quoted_amount: row.quoted_amount,
      rank: row.rank,
      note: row.note,
      source:
        row.source_url ??
        (row.source_fact_id ? `fact ${row.source_fact_id.slice(0, 8)}` : null) ??
        (row.source_document_id ? `document ${row.source_document_id.slice(0, 8)}` : null),
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
      opportunity_title: opportunity?.title ?? null,
      source: row.source_fact_id
        ? `fact ${row.source_fact_id.slice(0, 8)}`
        : row.source_document_id
          ? `document ${row.source_document_id.slice(0, 8)}`
          : null,
    };
  });

  const scoreRows: EvaluationScoreRow[] = (scoresRes.data ?? []).map((row) => {
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      respondent_name: row.respondent_name,
      opportunity_title: opportunity?.title ?? null,
      points: row.points,
      max_points: row.max_points,
      rank: row.rank,
      notes: row.notes,
    };
  });

  return (
    <div className="space-y-6">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Competitors</h1>
        <p className="text-sm text-muted-foreground">
          Observed bids, pricing lines, and evaluation scores only — sourced from documents, verified facts, or
          URLs. Not a corporate win rate. Geography/services appear only when those fields exist on evidence.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Observed bids</h2>
        <CompetitorBidsTable rows={bidRows} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Pricing lines</h2>
        <CompetitorPricingLinesTable rows={lineRows} />
      </section>

      <section className="space-y-2">
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
