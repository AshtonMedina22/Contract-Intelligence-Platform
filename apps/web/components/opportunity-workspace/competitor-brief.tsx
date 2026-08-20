import Link from "next/link";
import { formatMoney } from "@/lib/opportunity/pricing-math";

export type CompetitorBriefData = {
  opportunityTitle: string;
  clientName: string | null;
  winLoss: {
    outcome: string;
    documented_reason: string | null;
    internal_analysis: string | null;
    lp_price: number | null;
    winning_price: number | null;
    winner_name: string | null;
  } | null;
  competitorBids: {
    name: string;
    quoted_amount: number | null;
    source_url: string | null;
  }[];
  comparableRates: { label: string; count: number } | null;
  gaps: string[];
};

export function CompetitorBriefPanel({ data }: { data: CompetitorBriefData }) {
  return (
    <section className="space-y-4 rounded-md border border-dashed p-4">
      <div>
        <h2 className="text-sm font-medium">Competitor intelligence brief</h2>
        <p className="text-xs text-muted-foreground">
          Assembled from verified records on this pursuit only. Sections omitted when evidence is missing — no
          fabricated analysis.
        </p>
      </div>

      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Pursuit:</span> {data.opportunityTitle}
        </p>
        {data.clientName ? (
          <p>
            <span className="text-muted-foreground">Buyer:</span> {data.clientName}
          </p>
        ) : null}
      </div>

      <article className="space-y-3 text-sm">
        <h3 className="font-medium">1. Outcome</h3>
        {data.winLoss ? (
          <ul className="list-disc space-y-1 pl-5">
            <li>Result: {data.winLoss.outcome}</li>
            {data.winLoss.winner_name ? <li>Winner: {data.winLoss.winner_name}</li> : null}
            {data.winLoss.lp_price != null ? <li>L&P price: {formatMoney(data.winLoss.lp_price)}</li> : null}
            {data.winLoss.winning_price != null ? (
              <li>Winning price: {formatMoney(data.winLoss.winning_price)}</li>
            ) : null}
            {data.winLoss.documented_reason ? (
              <li>Documented reason: {data.winLoss.documented_reason}</li>
            ) : null}
            {data.winLoss.internal_analysis ? (
              <li className="text-muted-foreground">Internal analysis: {data.winLoss.internal_analysis}</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-muted-foreground">No win/loss record promoted for this pursuit.</p>
        )}

        <h3 className="font-medium">2. Sourced competitor bids</h3>
        {data.competitorBids.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {data.competitorBids.map((bid, i) => (
              <li key={`${bid.name}-${i}`}>
                {bid.name}: {formatMoney(bid.quoted_amount)}
                {bid.source_url ? (
                  <>
                    {" "}
                    (
                    <a className="underline" href={bid.source_url} target="_blank" rel="noreferrer">
                      source
                    </a>
                    )
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No bid-tab evidence linked. Ingest and verify bid tab PDF.</p>
        )}

        <h3 className="font-medium">3. Verified rate comparables (this buyer/service)</h3>
        {data.comparableRates ? (
          <p>{data.comparableRates.label}</p>
        ) : (
          <p className="text-muted-foreground">No comparable verified pricing lines for this buyer or service type.</p>
        )}

        {data.gaps.length > 0 ? (
          <>
            <h3 className="font-medium">4. Evidence gaps</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {data.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </>
        ) : null}
      </article>

      <p className="text-xs text-muted-foreground">
        Full report export (PDF) is Phase 7+. Use{" "}
        <Link className="underline" href="/intelligence/reports">
          Reports
        </Link>{" "}
        when generators ship.
      </p>
    </section>
  );
}
