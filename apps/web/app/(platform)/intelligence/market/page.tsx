import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/shell";

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
    { label: "Documented wins", value: won.count ?? 0 },
    { label: "Sourced competitor bids", value: bids.count ?? 0 },
    { label: "Verified pricing lines", value: pricingLines.count ?? 0 },
    { label: "Buyers on file", value: clients.count ?? 0 },
    { label: "Competitors", value: competitors.count ?? 0 },
    { label: "Nearing rebid", value: alerts.count ?? 0 },
  ];

  const hasEvidence =
    (awards.count ?? 0) + (reviews.count ?? 0) + (bids.count ?? 0) + (pricingLines.count ?? 0) > 0;

  return (
    <div className="space-y-3">
      <IntelligenceNav />
      <PageHeader
        title="Market"
        description="Verified observations only. Document counts are not market share."
      />
      {!hasEvidence ? (
        <EmptyState
          title="No verified market observations"
          description="Counts stay zero until awards, win/loss, sourced bids, or pricing lines are verified."
        />
      ) : null}
      <dl className="grid grid-cols-2 gap-px border text-sm sm:grid-cols-4">
        {stats.map((row) => (
          <div key={row.label} className="bg-background px-2.5 py-2">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-base font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <li>
          <Link className="underline hover:text-foreground" href="/intelligence/competitors">
            Competitors
          </Link>
        </li>
        <li>
          <Link className="underline hover:text-foreground" href="/intelligence/clients">
            Buyers
          </Link>
        </li>
        <li>
          <Link className="underline hover:text-foreground" href="/intelligence/win-loss">
            Win/Loss
          </Link>
        </li>
        <li>
          <Link className="underline hover:text-foreground" href="/intelligence/pricing">
            Pricing
          </Link>
        </li>
        <li>
          <Link className="underline hover:text-foreground" href="/contracts/renewals">
            Rebids
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
