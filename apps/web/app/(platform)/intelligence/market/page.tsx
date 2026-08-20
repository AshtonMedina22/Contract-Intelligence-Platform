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

  const [awards, reviews, won, bids, pricingLines, competitors, clients, alerts] = await Promise.all([
    supabase.from("awards").select("*", { count: "exact", head: true }),
    supabase.from("win_loss_reviews").select("*", { count: "exact", head: true }),
    supabase.from("win_loss_reviews").select("*", { count: "exact", head: true }).eq("outcome", "WON"),
    supabase.from("competitor_bids").select("*", { count: "exact", head: true }),
    supabase.from("pricing_lines").select("*", { count: "exact", head: true }),
    supabase.from("competitors").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("contract_alerts").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Verified awards", value: awards.count ?? 0 },
    { label: "Win/loss reviews", value: reviews.count ?? 0 },
    { label: "Documented wins (outcome=WON)", value: won.count ?? 0 },
    { label: "Sourced competitor bids", value: bids.count ?? 0 },
    { label: "Verified pricing lines", value: pricingLines.count ?? 0 },
    { label: "Buyers / agencies on file", value: clients.count ?? 0 },
    { label: "Observed competitors", value: competitors.count ?? 0 },
    { label: "Contracts nearing rebid (alerts)", value: alerts.count ?? 0 },
  ];

  const hasEvidence =
    (awards.count ?? 0) + (reviews.count ?? 0) + (bids.count ?? 0) + (pricingLines.count ?? 0) > 0;

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Market</h1>
        <p className="text-sm text-muted-foreground">
          Verified observations only. Document counts are not market share. Empty until historical packages are
          verified — do not invent TAM or share from corpus size.
        </p>
      </div>
      {!hasEvidence ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          No verified market observations yet. Counts stay zero until awards, win/loss, sourced bids, or pricing
          lines exist.
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
      <ul className="list-inside list-disc text-sm text-muted-foreground">
        <li>
          <Link className="underline" href="/intelligence/competitors">
            Competitor bids and scores
          </Link>
        </li>
        <li>
          <Link className="underline" href="/intelligence/clients">
            Buyer portfolio and research
          </Link>
        </li>
        <li>
          <Link className="underline" href="/intelligence/win-loss">
            Win/loss with documented reasons
          </Link>
        </li>
        <li>
          <Link className="underline" href="/intelligence/pricing">
            Pricing lines
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
