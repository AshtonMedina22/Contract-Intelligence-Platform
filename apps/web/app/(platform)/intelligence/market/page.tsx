import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";

async function MarketOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view market intelligence.</p>;

  const [
    documents,
    competitors,
    bids,
    clients,
    awards,
    reviews,
    alerts,
  ] = await Promise.all([
    supabase.from("documents").select("*", { count: "exact", head: true }),
    supabase.from("competitors").select("*", { count: "exact", head: true }),
    supabase.from("competitor_bids").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("win_loss_reviews").select("*", { count: "exact", head: true }).eq("outcome", "WON"),
    supabase.from("win_loss_reviews").select("*", { count: "exact", head: true }),
    supabase.from("contract_alerts").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Observed procurements (documents)", value: documents.count ?? 0 },
    { label: "Known awards (win/loss WON)", value: awards.count ?? 0 },
    { label: "Win/loss reviews", value: reviews.count ?? 0 },
    { label: "Buyers / agencies", value: clients.count ?? 0 },
    { label: "Observed competitors", value: competitors.count ?? 0 },
    { label: "Sourced competitor bids", value: bids.count ?? 0 },
    { label: "Contracts nearing rebid (alerts)", value: alerts.count ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Market overview</h1>
        <p className="text-sm text-muted-foreground">
          Evidence we actually possess. Counts are empty until historical packages are verified. This is not a
          corporate win-rate or TAM model.
        </p>
      </div>
      {(documents.count ?? 0) === 0 && (bids.count ?? 0) === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          Historical Pilot not started — all counts are zero until L&P packages are ingested and verified. Do not
          treat these tiles as market intelligence.
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-px border text-sm sm:grid-cols-3">
        {stats.map((row) => (
          <div key={row.label} className="bg-background p-3">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Competitor profiles and comparisons only use sourced bids and documented outcomes. Pricing medians appear
        when verified price lines exist (Phase 12 workbench).
      </p>
      <ul className="list-inside list-disc text-sm text-muted-foreground">
        <li>
          <Link className="underline" href="/intelligence/competitors">
            Competitor bids
          </Link>
        </li>
        <li>
          <Link className="underline" href="/intelligence/clients">
            Buyer / agency research facts
          </Link>
        </li>
        <li>
          <Link className="underline" href="/intelligence/win-loss">
            Awards and documented reasons
          </Link>
        </li>
        <li>
          <Link className="underline" href="/contracts/renewals">
            Upcoming rebids
          </Link>
        </li>
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <MarketOverview />
    </Suspense>
  );
}
