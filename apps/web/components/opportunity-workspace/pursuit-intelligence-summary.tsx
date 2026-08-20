import Link from "next/link";
import { formatMoney } from "@/lib/opportunity/pricing-math";
import type { PursuitIntelSummary } from "@/lib/intelligence/load-corpus";

export function PursuitIntelligenceSummary({ data }: { data: PursuitIntelSummary }) {
  const empty =
    !data.winLoss &&
    data.competitorBids.length === 0 &&
    data.evaluationScores.length === 0 &&
    data.researchCount === 0 &&
    data.awardNte == null;

  return (
    <section className="space-y-3 rounded-md border border-dashed p-4">
      <div>
        <h2 className="text-sm font-medium">Pursuit intelligence</h2>
        <p className="text-xs text-muted-foreground">
          Cross-corpus facts for this pursuit only. Blank when evidence is missing — no fabricated market share or
          causation.
        </p>
      </div>

      {data.buyerName ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Buyer:</span> {data.buyerName}
        </p>
      ) : null}

      {empty ? (
        <p className="text-sm text-muted-foreground">
          No promoted intelligence yet. Verify win/loss, bids, scores, or public research, then return here.
        </p>
      ) : (
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <h3 className="font-medium">Win / loss</h3>
            {data.winLoss ? (
              <ul className="list-disc space-y-1 pl-5">
                <li>Outcome: {data.winLoss.outcome}</li>
                {data.winLoss.winner_name ? <li>Winner: {data.winLoss.winner_name}</li> : null}
                {data.winLoss.lp_price != null ? <li>L&P price: {formatMoney(data.winLoss.lp_price)}</li> : null}
                {data.winLoss.winning_price != null ? (
                  <li>Award price: {formatMoney(data.winLoss.winning_price)}</li>
                ) : null}
                {data.winLoss.documented_reason ? (
                  <li>Documented reason: {data.winLoss.documented_reason}</li>
                ) : null}
                {data.winLoss.internal_analysis ? (
                  <li className="text-muted-foreground">Internal: {data.winLoss.internal_analysis}</li>
                ) : null}
                {data.winLoss.lessons_learned ? (
                  <li className="text-muted-foreground">Lessons: {data.winLoss.lessons_learned}</li>
                ) : null}
              </ul>
            ) : (
              <p className="text-muted-foreground">No win/loss review.</p>
            )}
            {data.awardNte != null ? <p>Award NTE: {formatMoney(data.awardNte)}</p> : null}
          </div>

          <div className="space-y-1">
            <h3 className="font-medium">Competitors &amp; scores</h3>
            {data.competitorBids.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {data.competitorBids.slice(0, 5).map((b, i) => (
                  <li key={`${b.name}-${i}`}>
                    {b.name}: {formatMoney(b.quoted_amount)}
                    {b.rank != null ? ` (rank ${b.rank})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No sourced bids.</p>
            )}
            {data.evaluationScores.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.evaluationScores.slice(0, 5).map((s, i) => (
                  <li key={`${s.respondent_name}-${i}`}>
                    {s.respondent_name}: {s.points}
                    {s.max_points != null ? `/${s.max_points}` : ""}
                    {s.rank != null ? ` · rank ${s.rank}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {data.researchCount > 0 ? (
              <p className="mt-2 text-muted-foreground">{data.researchCount} public research fact(s) for buyer.</p>
            ) : null}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <Link className="underline" href={`/procurement/opportunities/${data.opportunityId}/result`}>
          Full result brief
        </Link>
        {" · "}
        <Link className="underline" href="/intelligence/win-loss">
          Global Win/Loss
        </Link>
        {" · "}
        <Link className="underline" href="/intelligence/competitors">
          Competitors
        </Link>
      </p>
    </section>
  );
}
