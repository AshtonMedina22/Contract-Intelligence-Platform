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
import { PROPOSAL_SECTION_KEYS, isProposalSectionKey } from "@/lib/content/taxonomy";
import { loadExperienceLibrary } from "@/lib/experience/retrieve";
import { EXPERIENCE_HARD_CAVEAT } from "@/lib/experience/types";
import { memberHasPermission } from "@/lib/auth/permissions";
import { SearchHitsTable, type SearchHitRow } from "./search-hits-table";
import { ExperienceLibraryTable } from "./experience-library-table";

const REUSE_FILTERS = ["APPROVED", "REVIEW_REQUIRED", "DO_NOT_USE", "SUPERSEDED"] as const;
const VERIFICATION_FILTERS = ["AI_EXTRACTED", "NEEDS_REVIEW", "HUMAN_VERIFIED", "REJECTED"] as const;

type ContentSearchParams = {
  q?: string;
  drafting?: string;
  reuse?: string;
  section?: string;
  verification?: string;
};

async function ContentLibrary({ searchParams }: { searchParams: Promise<ContentSearchParams> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const forDrafting = params.drafting !== "0";
  const reuseFilter = REUSE_FILTERS.find((r) => r === params.reuse?.toUpperCase()) ?? null;
  const sectionFilter =
    params.section && isProposalSectionKey(params.section) ? params.section : null;
  const verificationFilter =
    VERIFICATION_FILTERS.find((v) => v === params.verification?.toUpperCase()) ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to search verified knowledge.</p>;

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const canVerifyExperience = membership
    ? memberHasPermission(membership.role, "verify.promote")
    : false;
  const experienceRows = membership
    ? await loadExperienceLibrary(supabase, membership.organization_id, { limit: 40 })
    : [];

  let rows: SearchHitRow[] = [];
  let errorMessage: string | null = null;
  let sectionRows: {
    section_key: string;
    verification_status: string;
    reuse_status: string | null;
    title: string;
    page_start: number | null;
    buyer_name: string | null;
    outcome_snapshot: string | null;
  }[] = [];

  if (query) {
    const { data, error } = await supabase.rpc("search_verified_knowledge", {
      p_query: query,
      p_for_drafting: forDrafting,
      p_limit: 25,
      p_purpose: forDrafting ? "PROPOSAL_DRAFTING" : "LOSS_ANALYSIS",
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

  {
    let sectionQuery = supabase
      .from("proposal_sections")
      .select(
        "section_key, verification_status, reuse_status, title, page_start, buyer_name, outcome_snapshot",
      )
      .order("section_key")
      .limit(40);
    if (sectionFilter) sectionQuery = sectionQuery.eq("section_key", sectionFilter);
    if (verificationFilter) sectionQuery = sectionQuery.eq("verification_status", verificationFilter);
    if (reuseFilter) sectionQuery = sectionQuery.eq("reuse_status", reuseFilter);
    const { data: secs } = await sectionQuery;
    sectionRows = secs ?? [];
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
        description="Historical proposal sections (taxonomy + verification + reuse) plus typed experience library (F14). Outcome is display-only — Won ≠ auto-approve; Lost ≠ auto-reject. Drafting retrieval excludes DO_NOT_USE, SUPERSEDED, and non-current versions. Embeddings only from HUMAN_VERIFIED eligible text."
      />
      <IntelligenceHonestyStrip
        extra={`${EXPERIENCE_HARD_CAVEAT} PROPOSAL_DRAFTING always applies the drafting gates (${
          purposeRequiresDraftingGates("PROPOSAL_DRAFTING") ? "enforced" : "not enforced"
        }), so a DO_NOT_USE or SUPERSEDED passage can be read here for analysis but can never be retrieved for a draft. Promote defaults to REVIEW_REQUIRED.`}
      />

      <section className="space-y-2 border border-border p-3">
        <h2 className="text-sm font-medium">Experience library (typed past performance)</h2>
        <ExperienceLibraryTable rows={experienceRows} canVerify={canVerifyExperience} />
      </section>
      <AskAboutThis chips={chips} />

      <form className="flex flex-wrap items-end gap-2 border p-2" method="get">
        <div className="min-w-64 space-y-1">
          <Label className="text-xs" htmlFor="q">
            Query
          </Label>
          <Input id="q" name="q" defaultValue={query} placeholder="staffing depth" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="section">
            Taxonomy
          </Label>
          <select
            id="section"
            name="section"
            defaultValue={sectionFilter ?? ""}
            className="flex h-8 min-w-44 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All section keys</option>
            {PROPOSAL_SECTION_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="verification">
            Verification
          </Label>
          <select
            id="verification"
            name="verification"
            defaultValue={verificationFilter ?? ""}
            className="flex h-8 min-w-44 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All verification</option>
            {VERIFICATION_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
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
        {query || reuseFilter || sectionFilter || verificationFilter || !forDrafting ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/intelligence/content">Clear</Link>
          </Button>
        ) : null}
        <p className="basis-full text-[11px] text-muted-foreground">
          The drafting gate is applied by <code>search_verified_knowledge</code> in Postgres, not in this
          form. Unticking it widens the search for retrospective analysis; it does not unlock drafting.
          Outcome snapshot on sections is display-only and never drives reuse.
        </p>
      </form>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {sectionRows.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium">
            Proposal sections ({sectionRows.length}
            {sectionFilter ? ` · ${sectionFilter}` : ""}
            {verificationFilter ? ` · ${verificationFilter}` : ""}
            {reuseFilter ? ` · ${reuseFilter}` : ""})
          </p>
          <div className="overflow-x-auto border">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="p-1.5 font-medium">Key</th>
                  <th className="p-1.5 font-medium">Title</th>
                  <th className="p-1.5 font-medium">Verification</th>
                  <th className="p-1.5 font-medium">Reuse</th>
                  <th className="p-1.5 font-medium">Page</th>
                  <th className="p-1.5 font-medium">Buyer</th>
                  <th className="p-1.5 font-medium">Outcome (display)</th>
                </tr>
              </thead>
              <tbody>
                {sectionRows.map((row, i) => (
                  <tr key={`${row.section_key}-${i}`} className="border-b last:border-0">
                    <td className="p-1.5 font-mono">{row.section_key}</td>
                    <td className="p-1.5">{row.title}</td>
                    <td className="p-1.5">{row.verification_status}</td>
                    <td className="p-1.5">{row.reuse_status ?? "—"}</td>
                    <td className="p-1.5">{row.page_start ?? "—"}</td>
                    <td className="p-1.5">{row.buyer_name ?? "—"}</td>
                    <td className="p-1.5 text-muted-foreground">{row.outcome_snapshot ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

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
          Search verified passages above, or filter the proposal_sections catalog by taxonomy /
          verification / reuse. Staging AI extracts are not drafting-eligible until HUMAN_VERIFIED.
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
