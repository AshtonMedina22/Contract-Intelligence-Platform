import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AskAboutThis,
  IntelligenceHonestyStrip,
  ObservationTiles,
} from "@/components/intelligence/honesty-strip";
import { askChip } from "@/lib/intelligence/ask-launch";
import {
  MIN_WIN_RATE_SAMPLE,
  WIN_RATE_DEFINITION,
  observationTile,
  summarizeWinLoss,
} from "@/lib/intelligence/observations";
import { WinLossTable, type WinLossRow } from "./win-loss-table";
import { loadRankedComparablePursuits } from "@/lib/comparables";
import { SimilarPursuits } from "@/components/comparables/similar-pursuits";

const OUTCOME_FILTERS = ["WON", "LOST", "NO_BID", "CANCELLED", "NO_AWARD", "PENDING"] as const;

type WinLossSearchParams = { outcome?: string; pursuit?: string };

function formatScore(points: number, max: number | null): string {
  return max != null ? `${points}/${max}` : String(points);
}

async function WinLossContent({ searchParams }: { searchParams: Promise<WinLossSearchParams> }) {
  const params = await searchParams;
  const outcomeFilter = OUTCOME_FILTERS.find((o) => o === params.outcome?.toUpperCase()) ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view win/loss reviews.</p>;

  const { data, error } = await supabase
    .from("win_loss_reviews")
    .select(
      "id, outcome, documented_reason, internal_analysis, lessons_learned, winner_name, lp_price, winning_price, opportunity_id, opportunities(title)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const all = data ?? [];
  const selectedPursuitId = all.some((row) => row.opportunity_id === params.pursuit)
    ? params.pursuit ?? null
    : null;
  const peerScores = selectedPursuitId
    ? await loadRankedComparablePursuits({
        targetOpportunityId: selectedPursuitId,
        purpose: "WIN_LOSS_ANALYSIS",
        limit: 6,
      })
    : [];
  // The rate is computed over the whole corpus, never over the filtered view — a filter must not be
  // able to manufacture a flattering denominator.
  const summary = summarizeWinLoss(all.map((r) => r.outcome));

  const oppIds = [...new Set(all.map((r) => r.opportunity_id).filter(Boolean))];
  const { data: scores } =
    oppIds.length > 0
      ? await supabase
          .from("evaluation_scores")
          .select("opportunity_id, respondent_name, points, max_points, rank")
          .in("opportunity_id", oppIds)
      : { data: [] as { opportunity_id: string; respondent_name: string; points: number; max_points: number | null; rank: number | null }[] };

  const scoresByOpp = new Map<
    string,
    { respondent_name: string; points: number; max_points: number | null; rank: number | null }[]
  >();
  for (const s of scores ?? []) {
    const list = scoresByOpp.get(s.opportunity_id) ?? [];
    list.push(s);
    scoresByOpp.set(s.opportunity_id, list);
  }

  const rows: WinLossRow[] = all
    .filter((row) => (outcomeFilter ? row.outcome === outcomeFilter : true))
    .map((row) => {
      const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
      const oppScores = scoresByOpp.get(row.opportunity_id) ?? [];
      const lp = oppScores.find((s) => /l\s*&\s*p|l and p|lp global/i.test(s.respondent_name));
      const winner =
        row.winner_name != null
          ? oppScores.find((s) => s.respondent_name.toLowerCase().includes(row.winner_name!.toLowerCase()))
          : oppScores.find((s) => s.rank === 1);
      const bestRank = oppScores.reduce<number | null>((acc, s) => {
        if (s.rank == null) return acc;
        return acc == null ? s.rank : Math.min(acc, s.rank);
      }, null);

      return {
        id: row.id,
        opportunity_id: row.opportunity_id,
        outcome: row.outcome,
        documented_reason: row.documented_reason,
        internal_analysis: row.internal_analysis,
        lessons_learned: row.lessons_learned,
        winner_name: row.winner_name,
        lp_price: row.lp_price,
        winning_price: row.winning_price,
        opportunity_title: opportunity?.title ?? null,
        lp_score: lp ? formatScore(lp.points, lp.max_points) : null,
        winning_score: winner ? formatScore(winner.points, winner.max_points) : null,
        rank: lp?.rank ?? bestRank,
      };
    });

  const tiles = [
    observationTile({ label: "Reviews on file", value: summary.total, source: "win_loss_reviews", unit: "reviews" }),
    observationTile({ label: "Documented wins", value: summary.won, source: "outcome=WON", unit: "reviews" }),
    observationTile({ label: "Documented losses", value: summary.lost, source: "outcome=LOST", unit: "reviews" }),
    observationTile({
      label: "Not decided (excluded from any rate)",
      value: summary.undecided,
      source: "outcome ∈ {NO_BID, CANCELLED, NO_AWARD, PENDING}",
      unit: "reviews",
    }),
  ];

  const chips = [
    askChip({
      label: "Loss analysis",
      mode: "ask",
      from: "win-loss",
      q: "Across the recorded win/loss reviews, what did buyers document as the reason, and what do the recorded scores and prices show?",
      filters: {
        reviews: summary.total,
        won: summary.won,
        lost: summary.lost,
        ...(outcomeFilter ? { outcome: outcomeFilter } : {}),
      },
    }),
    askChip({
      label: "Win/loss report",
      mode: "report",
      report: "win_loss",
      from: "win-loss",
      filters: { reviews: summary.total },
    }),
    askChip({
      label: "Evaluator analysis",
      mode: "report",
      report: "proposal_improvement",
      from: "win-loss",
      filters: { reviews: summary.total },
    }),
  ];

  return (
    <div className="space-y-3">
      <IntelligenceNav />
      <PageHeader
        title="Win/Loss"
        description="L&P submitted price, award price, scores, rank, evaluator-documented reason, internal analysis, and lessons — kept distinct. Scores join from evaluation_scores when present. Never infer causation without evidence."
      />
      <IntelligenceHonestyStrip
        extra={`A documented reason is what the buyer wrote; internal analysis is L&P's own view and is never sent to a buyer. ${WIN_RATE_DEFINITION}`}
      />
      <AskAboutThis chips={chips} />

      <ObservationTiles tiles={tiles} />

      <p className="border px-2.5 py-2 text-sm" data-testid="win-rate">
        {summary.winRatePercent != null && summary.winRateInterval ? (
          <>
            <span className="font-medium">
              Win rate {summary.winRatePercent}% (n={summary.decided} decided)
            </span>{" "}
            <span className="text-muted-foreground">
              95% CI {summary.winRateInterval.low.toFixed(1)}–{summary.winRateInterval.high.toFixed(1)}%.
              Decided pursuits only; NO_BID, CANCELLED, NO_AWARD and PENDING are excluded from both sides.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">Win rate withheld — sample too thin.</span>{" "}
            <span className="text-muted-foreground">{summary.withheldReason}</span>{" "}
            <span className="text-muted-foreground">
              Observed counts stand on their own: {summary.won} won, {summary.lost} lost,{" "}
              {summary.undecided} not decided, out of {summary.total} recorded review(s). A percentage
              appears at {MIN_WIN_RATE_SAMPLE} decided pursuits.
            </span>
          </>
        )}
      </p>

      <form className="flex flex-wrap items-end gap-2 border p-2" method="get">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="pursuit">
            Peer ranking for pursuit
          </Label>
          <select
            id="pursuit"
            name="pursuit"
            defaultValue={selectedPursuitId ?? ""}
            className="flex h-8 min-w-56 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Select a pursuit</option>
            {all.map((row) => {
              const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
              return (
                <option key={row.opportunity_id} value={row.opportunity_id}>
                  {opportunity?.title ?? row.opportunity_id.slice(0, 8)}
                </option>
              );
            })}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="outcome">
            Outcome
          </Label>
          <select
            id="outcome"
            name="outcome"
            defaultValue={outcomeFilter ?? ""}
            className="flex h-8 min-w-40 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All outcomes</option>
            {OUTCOME_FILTERS.map((outcome) => (
              <option key={outcome} value={outcome}>
                {outcome} ({summary.counts[outcome] ?? 0})
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Filter
        </Button>
        {outcomeFilter ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/intelligence/win-loss">Clear</Link>
          </Button>
        ) : null}
        <p className="basis-full text-[11px] text-muted-foreground">
          Filtering changes the table only. The rate above is always computed over every recorded review.
        </p>
      </form>
      {selectedPursuitId ? (
        <SimilarPursuits
          scores={peerScores}
          title="Win/loss peers for selected pursuit"
          linkSuffix="/result"
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        Showing {rows.length} of {summary.total} review(s)
        {outcomeFilter ? ` filtered to ${outcomeFilter}` : ""}.
      </p>
      <WinLossTable rows={rows} />
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<WinLossSearchParams> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <WinLossContent searchParams={searchParams} />
    </Suspense>
  );
}
