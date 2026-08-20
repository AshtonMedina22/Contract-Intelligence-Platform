import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { INTELLIGENCE_TABS, SectionTabs } from "@/components/section-tabs";
import { WinLossTable, type WinLossRow } from "./win-loss-table";

async function WinLossContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view win/loss reviews.</p>;

  const { data, error } = await supabase
    .from("win_loss_reviews")
    .select(
      "id, outcome, documented_reason, internal_analysis, winner_name, lp_price, winning_price, opportunities(title)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: WinLossRow[] = (data ?? []).map((row) => {
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      outcome: row.outcome,
      documented_reason: row.documented_reason,
      internal_analysis: row.internal_analysis,
      winner_name: row.winner_name,
      lp_price: row.lp_price,
      winning_price: row.winning_price,
      opportunity_title: opportunity?.title ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <SectionTabs tabs={INTELLIGENCE_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Win/Loss</h1>
        <p className="text-sm text-muted-foreground">
          Documented evaluator reasons stay separate from internal analysis. Promote only from HUMAN_VERIFIED facts.
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
