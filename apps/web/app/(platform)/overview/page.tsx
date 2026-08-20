import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { Button } from "@/components/ui/button";

async function HomeContent() {
  if (!hasEnvVars) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">
          Supabase environment variables are not configured on this deployment.
        </p>
      </div>
    );
  }

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
  const corpusEmpty = chunkCount === 0;

  const ingestNext =
    reviewCount > 0
      ? { href: "/ingestion/verification", label: "Continue verification" }
      : docCount > 0
        ? { href: "/ingestion/processing", label: "View processing" }
        : { href: "/ingestion/intake", label: "Start intake" };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">
          Two connected workflows: digitize and verify historical evidence, then use that corpus to pursue and
          price the next solicitation.
        </p>
      </div>

      {corpusEmpty && docCount > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Documents are ingested but none are verified yet — Intelligence and pricing comparables stay empty until
          you complete the verification queue.
        </p>
      ) : null}

      <section className="space-y-3 border p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Data Ops
          </p>
          <h2 className="text-base font-semibold">Digitize historical procurement</h2>
          <p className="text-sm text-muted-foreground">
            Upload → process → human verify → promote to canonical truth. Intelligence and pursuits consume only
            verified facts.
          </p>
        </div>
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          <li>
            <Link className="rounded-md bg-muted px-2 py-1 font-medium hover:underline" href="/ingestion/intake">
              1. Intake
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          <li>
            <Link
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:underline"
              href="/ingestion/processing"
            >
              2. Processing
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          <li>
            <Link
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:underline"
              href="/ingestion/verification"
            >
              3. Verification
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          <li>
            <Link
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:underline"
              href="/ingestion/exceptions"
            >
              4. Exceptions
            </Link>
          </li>
        </ol>
        {empty ? (
          <p className="text-sm text-muted-foreground">
            No packages in the vault yet. Start with intake — pricing intelligence, win/loss, and grounded drafts
            all depend on verified history.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {docCount} document{docCount === 1 ? "" : "s"} ingested · {reviewCount} fact
            {reviewCount === 1 ? "" : "s"} awaiting verification · {chunkCount} searchable chunk
            {chunkCount === 1 ? "" : "s"}
          </p>
        )}
        <Button asChild size="sm">
          <Link href={ingestNext.href}>
            {ingestNext.label}
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </section>

      <section className="space-y-3 border p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pursuits
          </p>
          <h2 className="text-base font-semibold">Analyze and respond to a solicitation</h2>
          <p className="text-sm text-muted-foreground">
            Intake the packet, then work Overview → Requirements → Pricing → Response → Submission → Result.
            Awards open a Contract workspace.
          </p>
        </div>
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          <li>
            <Link className="rounded-md bg-muted px-2 py-1 font-medium hover:underline" href="/ingestion/intake">
              1. Analyze solicitation
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          <li>
            <Link
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:underline"
              href="/procurement/opportunities"
            >
              2. Pursuits
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          <li>
            <Link
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:underline"
              href="/contracts"
            >
              3. Contracts
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          <li>
            <Link
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:underline"
              href="/intelligence/win-loss"
            >
              4. Win/Loss → Contract
            </Link>
          </li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/ingestion/intake">Analyze new solicitation</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/procurement/opportunities">View pursuits</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Use verified intelligence (anytime)</h2>
        <p className="text-sm text-muted-foreground">
          These surfaces search and summarize what you have already verified — they are not separate pipelines.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/intelligence/ask">Find or Ask GPT</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/intelligence/market">Market overview</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/intelligence/reports">Reports catalog</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-3 border p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            How data becomes RFQ output
          </p>
          <h2 className="text-base font-semibold">Table map & lineage</h2>
          <p className="text-sm text-muted-foreground">
            See which Postgres tables store what. Table maps live in Settings, not in the global sidebar.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/system/data-model">Open data model</Link>
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Corpus status</h2>
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
