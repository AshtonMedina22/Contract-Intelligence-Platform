import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntelligenceNav } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { registryEntry } from "@/lib/data-model/registry";
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
  searchParams: Promise<{ q?: string; opportunity?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const opportunityId = params.opportunity?.trim() ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to ask verified intelligence.</p>;

  let opportunityTitle: string | null = null;
  if (opportunityId) {
    const { data: opp } = await supabase.from("opportunities").select("title").eq("id", opportunityId).maybeSingle();
    opportunityTitle = opp?.title ?? null;
  }

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
          Reads <code className="text-xs">document_chunks</code> via{" "}
          <code className="text-xs">search_verified_knowledge</code> — only HUMAN_VERIFIED facts promoted from{" "}
          <code className="text-xs">extracted_facts</code>.
        </p>
      </div>
      {registryEntry("document_chunks") ? (
        <DataRegistryCallout entry={registryEntry("document_chunks")!} />
      ) : null}

      {opportunityId && opportunityTitle ? (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          Scoped to pursuit:{" "}
          <Link className="underline" href={`/procurement/opportunities/${opportunityId}`}>
            {opportunityTitle}
          </Link>
          . Results are still org-wide verified chunks — filter mentally to this package&apos;s documents.
        </p>
      ) : null}

      <form className="flex max-w-2xl flex-wrap items-end gap-3" method="get">
        {opportunityId ? <input type="hidden" name="opportunity" value={opportunityId} /> : null}
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
  searchParams: Promise<{ q?: string; opportunity?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AskIntelligence searchParams={searchParams} />
    </Suspense>
  );
}
