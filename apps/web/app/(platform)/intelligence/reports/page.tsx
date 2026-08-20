import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { INTELLIGENCE_TABS, SectionTabs } from "@/components/section-tabs";

const REPORT_TYPES = [
  {
    title: "Bid Strategy Report",
    href: "/ingestion/intake",
    body: "Opportunity summary, high-risk requirements, L&P history, competitor landscape, pricing evidence range, reusable content, compliance gaps, sources. Generated against a solicitation after intake — not a generic PDF.",
  },
  {
    title: "Competitor Intelligence Report",
    href: "/intelligence/competitors",
    body: "Observed pursuits, known awards/losses, sourced pricing, evaluator-documented strengths and weaknesses, evidence quality, sources. Win rates are labeled as observed-only.",
  },
  {
    title: "Market Intelligence Report",
    href: "/intelligence/market",
    body: "Observed procurement volume, pricing trends from verified lines, common evaluation criteria, competitors, staffing models, upcoming rebids — only where records exist.",
  },
  {
    title: "Pricing Intelligence Report",
    href: "/intelligence/pricing",
    body: "Comparables included/excluded, L&P submitted vs awarded, competitor quotes, observed range, recency, confidence, sources. Final price stays human.",
  },
  {
    title: "Win/Loss Analysis Report",
    href: "/intelligence/win-loss",
    body: "Documented evaluator reasons stay separate from internal analysis. Outcomes, pricing position, and competitors that beat L&P come from win_loss_reviews.",
  },
  {
    title: "Executive Intelligence Brief",
    href: "/overview",
    body: "Market, competition, L&P performance, upcoming rebids. Every bullet must link to evidence. Empty until the verified corpus exists.",
  },
] as const;

async function ReportsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to open reports.</p>;

  const [chunks, reviews, bids] = await Promise.all([
    supabase.from("document_chunks").select("*", { count: "exact", head: true }),
    supabase.from("win_loss_reviews").select("*", { count: "exact", head: true }),
    supabase.from("competitor_bids").select("*", { count: "exact", head: true }),
  ]);

  const chunkCount = chunks.count ?? 0;
  const reviewCount = reviews.count ?? 0;
  const bidCount = bids.count ?? 0;
  const ready = chunkCount + reviewCount + bidCount > 0;

  return (
    <div className="space-y-4">
      <SectionTabs tabs={INTELLIGENCE_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Source-backed intelligence reports. The product will not emit AI prose without citations, and it will not
          invent market size or competitor win rates.
        </p>
      </div>
      <p className="text-sm">
        Verified chunks: <span className="tabular-nums font-medium">{chunkCount}</span>
        {" · "}
        Win/loss reviews: <span className="tabular-nums font-medium">{reviewCount}</span>
        {" · "}
        Sourced competitor bids: <span className="tabular-nums font-medium">{bidCount}</span>
      </p>
      {!ready ? (
        <p className="border p-3 text-sm text-muted-foreground">
          Report generation is withheld until there is verified evidence to cite. Use intake and verification first.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Structured generators (PDF/export) land after the pricing workbench. Open the live evidence views below.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {REPORT_TYPES.map((report) => (
          <li key={report.title} className="space-y-2 border p-3 text-sm">
            <h2 className="font-medium">{report.title}</h2>
            <p className="text-muted-foreground">{report.body}</p>
            <Link className="inline-block underline" href={report.href}>
              Open evidence
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ReportsContent />
    </Suspense>
  );
}
