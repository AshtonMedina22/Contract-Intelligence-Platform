import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FactRef } from "@/components/opportunity-workspace/shared";
import { CompetitorBriefPanel, type CompetitorBriefData } from "@/components/opportunity-workspace/competitor-brief";
import { loadFactDocumentMap, loadOpportunityHeader } from "@/lib/opportunity/load-workspace";
import { loadPricingComparables } from "@/lib/opportunity/comparables";
import { formatMoney, summarizeComparableRates } from "@/lib/opportunity/pricing-math";

export default async function OpportunityIntelligencePage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();

  const [opportunity, comparables, { data: winLoss }, { data: competitorBids }] = await Promise.all([
    loadOpportunityHeader(opportunityId),
    loadPricingComparables(opportunityId),
    supabase
      .from("win_loss_reviews")
      .select(
        "id, outcome, documented_reason, internal_analysis, winner_name, lp_price, winning_price, source_fact_id",
      )
      .eq("opportunity_id", opportunityId)
      .maybeSingle(),
    supabase
      .from("competitor_bids")
      .select("id, quoted_amount, source_url, note, source_fact_id, competitors(name)")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false }),
  ]);

  const factIds: string[] = [];
  if (winLoss?.source_fact_id) factIds.push(winLoss.source_fact_id);
  for (const bid of competitorBids ?? []) {
    if (bid.source_fact_id) factIds.push(bid.source_fact_id);
  }
  const factDocumentMap = await loadFactDocumentMap(factIds);

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
      <CompetitorBriefPanel data={brief} />

      <section className="space-y-2 rounded-md border p-4">
        <h2 className="text-sm font-medium">Win / loss review</h2>
        {!winLoss ? (
          <p className="text-sm text-muted-foreground">
            No outcome promoted yet. After award or debrief, verify win/loss facts from source documents.
          </p>
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Outcome</dt>
              <dd className="font-medium">{winLoss.outcome}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Winner</dt>
              <dd>{winLoss.winner_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">L&P price</dt>
              <dd>{formatMoney(winLoss.lp_price)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Winning price</dt>
              <dd>{formatMoney(winLoss.winning_price)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Documented reason (evaluator/customer)</dt>
              <dd>{winLoss.documented_reason ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Internal analysis</dt>
              <dd>{winLoss.internal_analysis ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Source</dt>
              <dd>
                <FactRef
                  factId={winLoss.source_fact_id}
                  documentId={factDocumentMap.get(winLoss.source_fact_id ?? "")}
                />
              </dd>
            </div>
          </dl>
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
                  {bid.source_url ? (
                    <p>
                      <a className="underline" href={bid.source_url} target="_blank" rel="noreferrer">
                        Source URL
                      </a>
                    </p>
                  ) : null}
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
