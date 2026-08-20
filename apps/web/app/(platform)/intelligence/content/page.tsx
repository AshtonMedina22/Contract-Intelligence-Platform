import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INTELLIGENCE_TABS, SectionTabs } from "@/components/section-tabs";
import { SearchHitsTable, type SearchHitRow } from "./search-hits-table";

async function ContentLibrary({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; drafting?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const forDrafting = params.drafting !== "0";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to search verified knowledge.</p>;

  let rows: SearchHitRow[] = [];
  let errorMessage: string | null = null;
  if (query) {
    const { data, error } = await supabase.rpc("search_verified_knowledge", {
      p_query: query,
      p_for_drafting: forDrafting,
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

  return (
    <div className="space-y-4">
      <SectionTabs tabs={INTELLIGENCE_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Content intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Search HUMAN_VERIFIED chunks only. Citations point at Storage originals. Drafting retrieval excludes
          DO_NOT_USE, SUPERSEDED, and non-current versions.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-64 space-y-1">
          <Label htmlFor="q">Query</Label>
          <Input id="q" name="q" defaultValue={query} placeholder="staffing depth" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="drafting" value="0" defaultChecked={!forDrafting} />
          Include superseded / do-not-use
        </label>
        <Button type="submit">Search</Button>
      </form>
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {query ? <SearchHitsTable rows={rows} /> : (
        <p className="text-sm text-muted-foreground">
          Verify a fact first. Staging AI extracts do not appear here.
        </p>
      )}
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; drafting?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ContentLibrary searchParams={searchParams} />
    </Suspense>
  );
}
