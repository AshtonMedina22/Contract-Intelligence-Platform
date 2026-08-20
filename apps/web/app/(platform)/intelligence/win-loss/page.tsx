import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { WinLossTable, type WinLossRow } from "./win-loss-table";

function formatScore(points: number, max: number | null): string {
  return max != null ? `${points}/${max}` : String(points);
}

async function WinLossContent() {
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

  const oppIds = [...new Set((data ?? []).map((r) => r.opportunity_id).filter(Boolean))];
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

  const rows: WinLossRow[] = (data ?? []).map((row) => {
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

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Win/Loss</h1>
        <p className="text-sm text-muted-foreground">
          L&amp;P submitted price, award price, scores, rank, evaluator-documented reason, internal analysis, and
          lessons — kept distinct. Scores join from evaluation_scores when present. Never infer causation without
          evidence.
        </p>
      </div>
      <WinLossTable rows={rows} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <WinLossContent />
    </Suspense>
  );
}
