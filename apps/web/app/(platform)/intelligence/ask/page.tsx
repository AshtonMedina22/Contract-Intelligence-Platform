import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntelligenceNav } from "@/components/section-tabs";
import { SearchHitsTable, type SearchHitRow } from "../content/search-hits-table";

const EXAMPLE_QUERIES = [
  "Dallas ISD security contract",
  "armed guards Texas school districts",
  "evaluator weaknesses staffing",
  "Garland ISD",
  "transition plan",
] as const;

async function AskIntelligence({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to ask verified intelligence.</p>;

  let rows: SearchHitRow[] = [];
  let errorMessage: string | null = null;
  if (query) {
    const { data, error } = await supabase.rpc("search_verified_knowledge", {
      p_query: query,
      p_for_drafting: true,
      p_limit: 25,
    });
    if (error) errorMessage = error.message;
    rows = (data ?? []).map((hit) => ({
      chunk_id: hit.chunk_id,
      document_id: hit.document_id,
      source_fact_id: hit.source_fact_id,
      storage_path: hit.storage_path,
      source_page: hit.source_page,
      field: hit.field,
      content: hit.content,
      reuse_status: hit.reuse_status,
      rank: hit.rank,
      match_kind: hit.match_kind,
    }));
  }

  const cited = rows.length;
  const pages = new Set(rows.map((row) => `${row.storage_path}:${row.source_page ?? "?"}`)).size;

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Ask Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Query verified historical records only. Answers are retrieved passages with citations — not a generic
          chatbot and not invented rates, win rates, or summaries.
        </p>
      </div>

      <form className="flex max-w-2xl flex-wrap items-end gap-3" method="get">
        <div className="min-w-72 flex-1 space-y-1">
          <Label htmlFor="q">Search or ask</Label>
          <Input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="What hourly rates have we proposed for armed guards in Texas ISDs?"
          />
        </div>
        <Button type="submit">Ask</Button>
      </form>

      {!query ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Example questions this corpus is meant to answer:</p>
          <ul className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <li key={example}>
                <Link
                  className="inline-block border px-2 py-1 text-xs hover:bg-muted"
                  href={`/intelligence/ask?q=${encodeURIComponent(example)}`}
                >
                  {example}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {query ? (
        <section className="max-w-3xl space-y-3 border p-3 text-sm">
          <h2 className="font-medium">Answer</h2>
          {cited === 0 ? (
            <p className="text-muted-foreground">
              No HUMAN_VERIFIED passages matched this question. Unverified staging extracts are never returned as
              truth. Ingest and verify source documents first.
            </p>
          ) : (
            <>
              <p>
                Retrieved {cited} verified passage{cited === 1 ? "" : "s"} from {pages} source location
                {pages === 1 ? "" : "s"}. The system does not synthesize medians, win rates, or competitor
                comparisons unless those figures already exist as verified records.
              </p>
              <p className="text-muted-foreground">
                Use Pricing, Win/Loss, and Market workspaces for structured facts. Use Reports when you need a
                sourced brief assembled from those records.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/intelligence/content">View records</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/intelligence/reports">Create report</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {query ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Sources</h2>
          <SearchHitsTable rows={rows} />
        </section>
      ) : null}
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AskIntelligence searchParams={searchParams} />
    </Suspense>
  );
}
