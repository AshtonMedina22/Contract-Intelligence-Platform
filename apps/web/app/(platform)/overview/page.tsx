import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

async function HomeContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">
          Sign in as the L&P operator to load organization data. This is not a CRM or customer portal.
        </p>
      </div>
    );
  }

  const [documents, needsReview, contracts, winLoss, chunks] = await Promise.all([
    supabase.from("documents").select("*", { count: "exact", head: true }),
    supabase
      .from("extracted_facts")
      .select("*", { count: "exact", head: true })
      .in("verification_status", ["AI_EXTRACTED", "NEEDS_REVIEW"]),
    supabase.from("contracts").select("*", { count: "exact", head: true }),
    supabase.from("win_loss_reviews").select("*", { count: "exact", head: true }),
    supabase.from("document_chunks").select("*", { count: "exact", head: true }),
  ]);

  const docCount = documents.count ?? 0;
  const reviewCount = needsReview.count ?? 0;
  const contractCount = contracts.count ?? 0;
  const winLossCount = winLoss.count ?? 0;
  const chunkCount = chunks.count ?? 0;
  const empty = docCount === 0;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">
          Historical procurement intelligence for the next solicitation — not client relationship management.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href="/ingestion/intake">Analyze new solicitation</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/proposals">Proposal workspaces</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/intelligence/ask">Ask Intelligence</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/intelligence/market">Market</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/intelligence/reports">Generate executive brief</Link>
        </Button>
      </div>

      {empty ? (
        <div className="space-y-3 border p-3 text-sm">
          <p className="font-medium">No historical packages in the vault yet.</p>
          <p className="text-muted-foreground">
            Digitize and verify prior RFPs, proposals, pricing, awards, and contracts first. That verified corpus
            is what powers pricing intelligence, win/loss, and grounded proposal drafts for the next bid.
          </p>
          <Button asChild size="sm">
            <Link href="/ingestion/intake">Start historical intake</Link>
          </Button>
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Historical intelligence</h2>
        <dl className="grid grid-cols-2 gap-px border text-sm sm:grid-cols-3">
          <div className="bg-background p-3">
            <dt className="text-muted-foreground">Documents ingested</dt>
            <dd className="text-lg font-semibold tabular-nums">{docCount}</dd>
          </div>
          <div className="bg-background p-3">
            <dt className="text-muted-foreground">Verified knowledge chunks</dt>
            <dd className="text-lg font-semibold tabular-nums">{chunkCount}</dd>
          </div>
          <div className="bg-background p-3">
            <dt className="text-muted-foreground">Win/loss reviews</dt>
            <dd className="text-lg font-semibold tabular-nums">{winLossCount}</dd>
          </div>
          <div className="bg-background p-3">
            <dt className="text-muted-foreground">Contracts (current truth)</dt>
            <dd className="text-lg font-semibold tabular-nums">{contractCount}</dd>
          </div>
          <div className="bg-background p-3">
            <dt className="text-muted-foreground">Facts awaiting verification</dt>
            <dd className="text-lg font-semibold tabular-nums">{reviewCount}</dd>
          </div>
        </dl>
      </section>

      {reviewCount > 0 ? (
        <section className="space-y-2 border p-3 text-sm">
          <h2 className="font-medium">Needs attention</h2>
          <p className="text-muted-foreground">
            {reviewCount} extracted fact{reviewCount === 1 ? "" : "s"} still need human verification before they
            become searchable intelligence.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/ingestion/verification">Open verification</Link>
          </Button>
        </section>
      ) : null}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <HomeContent />
    </Suspense>
  );
}
