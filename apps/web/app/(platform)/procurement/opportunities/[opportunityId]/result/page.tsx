import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FactRef } from "@/components/opportunity-workspace/shared";
import { CompetitorBriefPanel, type CompetitorBriefData } from "@/components/opportunity-workspace/competitor-brief";
import {
  ResultCapturePanel,
  type AwardEvidenceRow,
} from "@/components/opportunity-workspace/result-capture-panel";
import { loadFactDocumentMap, loadOpportunityHeader } from "@/lib/opportunity/load-workspace";
import { loadPricingComparables } from "@/lib/opportunity/comparables";
import { formatMoney, summarizeComparableRates } from "@/lib/opportunity/pricing-math";
import type { OpportunityResultOutcome } from "@/lib/opportunity/response";
import { isAwardishFact } from "@/lib/opportunity/submission-readiness";
import { loadCurrentOrgCapabilities } from "@/lib/auth/load-capabilities";

export default function OpportunityResultPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OpportunityResultContent params={params} />
    </Suspense>
  );
}

async function OpportunityResultContent({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();
  const caps = await loadCurrentOrgCapabilities();

  const [opportunity, comparables, { data: winLoss }, { data: competitorBids }, { data: contract }, { data: scores }] =
    await Promise.all([
      loadOpportunityHeader(opportunityId),
      loadPricingComparables(opportunityId),
      supabase
        .from("win_loss_reviews")
        .select(
          "id, outcome, documented_reason, internal_analysis, lessons_learned, winner_name, lp_price, winning_price, lp_score, winning_score, rank, evaluator_comments, source_fact_id",
        )
        .eq("opportunity_id", opportunityId)
        .maybeSingle(),
      supabase
        .from("competitor_bids")
        .select("id, quoted_amount, source_url, note, source_fact_id, competitors(name)")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false }),
      supabase.from("contracts").select("id, title").eq("opportunity_id", opportunityId).maybeSingle(),
      supabase
        .from("evaluation_scores")
        .select("id, respondent_name, points, max_points, rank, notes")
        .eq("opportunity_id", opportunityId)
        .order("rank", { ascending: true, nullsFirst: false }),
    ]);

  const factIds: string[] = [];
  if (winLoss?.source_fact_id) factIds.push(winLoss.source_fact_id);
  for (const bid of competitorBids ?? []) {
    if (bid.source_fact_id) factIds.push(bid.source_fact_id);
  }
  const factDocumentMap = await loadFactDocumentMap(factIds);

  // Award evidence for the contract handoff: the HUMAN_VERIFIED facts on this pursuit's own
  // documents. Nothing is inferred from the outcome — the list is what the record actually holds.
  const { data: pursuitDocuments } = await supabase
    .from("documents")
    .select("id, original_filename")
    .eq("opportunity_id", opportunityId);
  const pursuitDocIds = (pursuitDocuments ?? []).map((d) => d.id);
  const documentNames = new Map((pursuitDocuments ?? []).map((d) => [d.id, d.original_filename]));
  const { data: verifiedFacts } = pursuitDocIds.length
    ? await supabase
        .from("extracted_facts")
        .select("id, document_id, field, entity, verified_value, normalized_value, raw_value, source_page")
        .eq("verification_status", "HUMAN_VERIFIED")
        .in("document_id", pursuitDocIds)
        .order("verified_at", { ascending: false })
        .limit(40)
    : { data: [] as never[] };

  const awardEvidence: AwardEvidenceRow[] = (verifiedFacts ?? []).map((f) => ({
    factId: f.id,
    documentId: f.document_id,
    documentName: f.document_id ? (documentNames.get(f.document_id) ?? null) : null,
    field: f.field,
    entity: f.entity,
    value: f.verified_value ?? f.normalized_value ?? f.raw_value ?? null,
    sourcePage: f.source_page ?? null,
    awardish: isAwardishFact(f),
  }));

  const proposedSummary = summarizeComparableRates(comparables, "proposed_rate");
  const gaps: string[] = [];
  if (!winLoss) gaps.push("No win/loss review promoted.");
  if ((competitorBids ?? []).length === 0) gaps.push("No sourced competitor bids on file.");
  if (!proposedSummary) gaps.push("No verified comparable pricing for this buyer/service type.");

  const brief: CompetitorBriefData = {
    opportunityTitle: opportunity?.title ?? opportunityId,
    clientName: opportunity?.client_name ?? null,
    winLoss: winLoss
      ? {
          outcome: winLoss.outcome,
          documented_reason: winLoss.documented_reason,
          internal_analysis: winLoss.internal_analysis,
          lp_price: winLoss.lp_price,
          winning_price: winLoss.winning_price,
          winner_name: winLoss.winner_name,
        }
      : null,
    competitorBids: (competitorBids ?? []).map((bid) => {
      const competitor = Array.isArray(bid.competitors) ? bid.competitors[0] : bid.competitors;
      return {
        name: competitor?.name ?? "Unknown",
        quoted_amount: bid.quoted_amount,
        source_url: bid.source_url,
      };
    }),
    comparableRates: proposedSummary
      ? { label: `Proposed rates ${proposedSummary.label}`, count: proposedSummary.count }
      : null,
    gaps,
  };

  return (
    <div className="space-y-6">
      <ResultCapturePanel
        opportunityId={opportunityId}
        opportunityTitle={opportunity?.title ?? "Awarded contract"}
        winLoss={
          winLoss
            ? {
                outcome: winLoss.outcome as OpportunityResultOutcome,
                winner_name: winLoss.winner_name,
                lp_price: winLoss.lp_price,
                winning_price: winLoss.winning_price,
                lp_score: winLoss.lp_score,
                winning_score: winLoss.winning_score,
                rank: winLoss.rank,
                documented_reason: winLoss.documented_reason,
                internal_analysis: winLoss.internal_analysis,
                lessons_learned: winLoss.lessons_learned,
                evaluator_comments: winLoss.evaluator_comments,
              }
            : null
        }
        contractId={contract?.id ?? null}
        contractTitle={contract?.title ?? null}
        awardEvidence={awardEvidence}
        pursuitDocumentCount={pursuitDocIds.length}
        canResultWrite={caps?.canResultWrite ?? false}
        canContractCreate={caps?.canContractCreate ?? false}
      />

      <CompetitorBriefPanel data={brief} />

      <section className="space-y-2 rounded-md border p-4">
        <h2 className="text-sm font-medium">Category / evaluation scores</h2>
        {(scores ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No evaluation_scores promoted yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(scores ?? []).map((s) => (
              <li key={s.id}>
                {s.respondent_name}: {s.points}
                {s.max_points != null ? ` / ${s.max_points}` : ""}
                {s.rank != null ? ` (rank ${s.rank})` : ""}
                {s.notes ? ` — ${s.notes}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Competitor bids (sourced)</h2>
        {(competitorBids ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No competitor bids linked to this pursuit.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(competitorBids ?? []).map((bid) => {
              const competitor = Array.isArray(bid.competitors) ? bid.competitors[0] : bid.competitors;
              return (
                <li key={bid.id} className="rounded-md border p-3">
                  <p className="font-medium">{competitor?.name ?? "Unknown competitor"}</p>
                  <p>Quoted: {formatMoney(bid.quoted_amount)}</p>
                  {bid.note ? <p className="text-muted-foreground">{bid.note}</p> : null}
                  <FactRef
                    factId={bid.source_fact_id}
                    documentId={factDocumentMap.get(bid.source_fact_id ?? "")}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <Link className="text-sm underline" href="/intelligence/competitors">
          All competitors →
        </Link>
      </section>
    </div>
  );
}
