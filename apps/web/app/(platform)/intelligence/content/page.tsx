import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import {
  AskAboutThis,
  IntelligenceHonestyStrip,
  ObservationTiles,
} from "@/components/intelligence/honesty-strip";
import { askChip } from "@/lib/intelligence/ask-launch";
import { observationTile } from "@/lib/intelligence/observations";
import { purposeRequiresDraftingGates } from "@/lib/retrieval/purpose";
import { SearchHitsTable, type SearchHitRow } from "./search-hits-table";

const REUSE_FILTERS = ["APPROVED", "REVIEW_REQUIRED", "DO_NOT_USE", "SUPERSEDED"] as const;

type ContentSearchParams = { q?: string; drafting?: string; reuse?: string };

async function ContentLibrary({ searchParams }: { searchParams: Promise<ContentSearchParams> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const forDrafting = params.drafting !== "0";
  const reuseFilter = REUSE_FILTERS.find((r) => r === params.reuse?.toUpperCase()) ?? null;

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

  const visible = reuseFilter ? rows.filter((r) => r.reuse_status === reuseFilter) : rows;
  const countByReuse = (status: string) => rows.filter((r) => r.reuse_status === status).length;

  const tiles = [
    observationTile({ label: "Hits returned", value: rows.length, source: "document_chunks", unit: "passages" }),
    observationTile({ label: "APPROVED", value: countByReuse("APPROVED"), source: "reuse_status", unit: "passages" }),
    observationTile({
      label: "REVIEW_REQUIRED",
      value: countByReuse("REVIEW_REQUIRED"),
      source: "reuse_status",
      unit: "passages",
    }),
    observationTile({
      label: "DO_NOT_USE + SUPERSEDED",
      value: countByReuse("DO_NOT_USE") + countByReuse("SUPERSEDED"),
      source: "reuse_status",
      unit: "passages",
    }),
  ];

  const chips = [
    askChip({
      label: "Locate this passage set",
      mode: "locate",
      from: "content",
      q: query || "staffing depth",
      filters: { drafting: forDrafting ? "gates on" : "gates off", ...(reuseFilter ? { reuse: reuseFilter } : {}) },
    }),
    askChip({
      label: "Draft from verified content",
      mode: "ask",
      purpose: "PROPOSAL_DRAFTING",
      from: "content",
      q: query || "transition plan",
      filters: { "drafting gates": "enforced" },
    }),
  ];

  return (
    <div className="space-y-3">
      <IntelligenceNav />
      <PageHeader
        title="Content intelligence"
        description="Verified historical proposal sections with source path/page, outcome context via linked facts, and reuse state: APPROVED | REVIEW_REQUIRED | DO_NOT_USE | SUPERSEDED. Drafting retrieval excludes DO_NOT_USE, SUPERSEDED, and non-current versions."
      />
      <IntelligenceHonestyStrip
        extra={`PROPOSAL_DRAFTING always applies the drafting gates (${
          purposeRequiresDraftingGates("PROPOSAL_DRAFTING") ? "enforced" : "not enforced"
        }), so a DO_NOT_USE or SUPERSEDED passage can be read here for analysis but can never be retrieved for a draft.`}
      />
      <AskAboutThis chips={chips} />

      <form className="flex flex-wrap items-end gap-2 border p-2" method="get">
        <div className="min-w-64 space-y-1">
          <Label className="text-xs" htmlFor="q">
            Query
          </Label>
          <Input id="q" name="q" defaultValue={query} placeholder="staffing depth" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="reuse">
            Reuse state
          </Label>
          <select
            id="reuse"
            name="reuse"
            defaultValue={reuseFilter ?? ""}
            className="flex h-8 min-w-44 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All returned states</option>
            {REUSE_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status} ({countByReuse(status)})
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-xs">
          <input type="checkbox" name="drafting" value="0" defaultChecked={!forDrafting} />
          Include superseded / do-not-use (analysis only)
        </label>
        <Button type="submit" size="sm">
          Search
        </Button>
        {query || reuseFilter || !forDrafting ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/intelligence/content">Clear</Link>
          </Button>
        ) : null}
        <p className="basis-full text-[11px] text-muted-foreground">
          The drafting gate is applied by <code>search_verified_knowledge</code> in Postgres, not in this
          form. Unticking it widens the search for retrospective analysis; it does not unlock drafting.
        </p>
      </form>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {query ? (
        <>
          <ObservationTiles tiles={tiles} />
          <p className="text-xs text-muted-foreground">
            Showing {visible.length} of {rows.length} returned passage(s)
            {reuseFilter ? ` filtered to ${reuseFilter}` : ""}. Drafting gates{" "}
            {forDrafting ? "enforced" : "relaxed for analysis"}.
          </p>
          <SearchHitsTable rows={visible} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Verify a fact first. Staging AI extracts do not appear here.
        </p>
      )}
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<ContentSearchParams> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ContentLibrary searchParams={searchParams} />
    </Suspense>
  );
}
