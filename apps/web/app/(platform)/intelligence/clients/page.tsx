import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AskAboutThis,
  IntelligenceHonestyStrip,
  ObservationTiles,
} from "@/components/intelligence/honesty-strip";
import { askChip } from "@/lib/intelligence/ask-launch";
import { FEDERAL_AWARD_RESEARCH_NOTE, observationTile } from "@/lib/intelligence/observations";
import { loadBuyerPortfolio } from "@/lib/intelligence/load-corpus";
import { BuyerPortfolioTable } from "./buyers-portfolio-table";
import { ResearchFactsTable, type ResearchFactRow } from "./research-facts-table";

type BuyerSearchParams = { q?: string; evidence?: string };

async function ClientsContent({ searchParams }: { searchParams: Promise<BuyerSearchParams> }) {
  const params = await searchParams;
  const nameQuery = params.q?.trim() ?? "";
  const evidenceOnly = params.evidence === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view buyer intelligence.</p>;

  let portfolio;
  try {
    portfolio = await loadBuyerPortfolio();
  } catch (e) {
    return <p className="text-sm text-red-600">{e instanceof Error ? e.message : "Load failed"}</p>;
  }

  const evidenceCount = (row: (typeof portfolio)[number]) =>
    row.opportunity_count + row.award_count + row.contract_count + row.win_loss_count + row.research_count;

  const filtered = portfolio.filter((row) => {
    if (nameQuery && !row.name.toLowerCase().includes(nameQuery.toLowerCase())) return false;
    if (evidenceOnly && evidenceCount(row) === 0) return false;
    return true;
  });

  const { data, error } = await supabase
    .from("research_facts")
    .select(
      "id, source_url, title, excerpt, published_on, retrieved_at, verification_status, source_document_id, clients(name), competitors(name)",
    )
    .order("retrieved_at", { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: ResearchFactRow[] = (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const competitor = Array.isArray(row.competitors) ? row.competitors[0] : row.competitors;
    return {
      id: row.id,
      source_url: row.source_url,
      title: row.title,
      excerpt: row.excerpt,
      published_on: row.published_on,
      retrieved_at: row.retrieved_at,
      verification_status: row.verification_status,
      source_document_id: row.source_document_id,
      client_name: client?.name ?? null,
      competitor_name: competitor?.name ?? null,
    };
  });

  const tiles = [
    observationTile({ label: "Buyers on file", value: portfolio.length, source: "clients", unit: "buyers" }),
    observationTile({
      label: "Buyers with evidence",
      value: portfolio.filter((row) => evidenceCount(row) > 0).length,
      source: "clients ⋈ opportunities/awards/contracts",
      basis: "INFERENCE",
      unit: "buyers",
    }),
    observationTile({
      label: "Buyers with a recorded outcome",
      value: portfolio.filter((row) => row.win_loss_count > 0).length,
      source: "win_loss_reviews",
      href: "/intelligence/win-loss",
      unit: "buyers",
    }),
    observationTile({
      label: "Sourced research facts",
      value: rows.length,
      source: "research_facts",
      unit: "facts",
    }),
  ];

  const chips = [
    askChip({
      label: "Buyer brief (all buyers)",
      mode: "report",
      report: "buyer",
      purpose: "GENERAL_QA",
      from: "clients",
      filters: { buyers: portfolio.length, ...(nameQuery ? { name: nameQuery } : {}) },
    }),
    askChip({
      label: "Locate solicitations by buyer",
      mode: "locate",
      q: nameQuery || "solicitation",
      from: "clients",
    }),
    askChip({
      label: "Federal awards (USAspending)",
      mode: "ask",
      purpose: "COMPETITOR_ANALYSIS",
      q: nameQuery
        ? `Search USAspending federal awards related to buyer or agency ${nameQuery}`
        : "Search USAspending federal awards for relevant agencies and recipients",
      from: "clients",
      filters: { source: "usaspending.gov", ...(nameQuery ? { agency: nameQuery } : {}) },
    }),
  ];

  return (
    <div className="space-y-3">
      <IntelligenceNav />
      <PageHeader
        title="Buyers"
        description={
          <>
            Procurement intelligence for issuing agencies — prior solicitations, awards, contracts, L&P
            outcomes. Not CRM: no contacts, no cadence, no pipeline stage.{" "}
            <Link className="underline" href="/procurement/clients">
              Buyer registry
            </Link>
          </>
        }
      />
      <IntelligenceHonestyStrip extra={`A buyer row counts records joined to that agency. It says nothing about relationship strength or likelihood of award. ${FEDERAL_AWARD_RESEARCH_NOTE}`} />
      <AskAboutThis chips={chips} />

      <ObservationTiles tiles={tiles} />

      <section className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Buyer portfolio</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {portfolio.length} buyers
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2 border p-2" method="get">
          <div className="min-w-56 space-y-1">
            <Label className="text-xs" htmlFor="q">
              Buyer name contains
            </Label>
            <Input id="q" name="q" defaultValue={nameQuery} placeholder="Arlington" className="h-8" />
          </div>
          <label className="flex items-center gap-2 pb-1.5 text-xs">
            <input type="checkbox" name="evidence" value="1" defaultChecked={evidenceOnly} />
            Only buyers with at least one record
          </label>
          <Button type="submit" size="sm">
            Filter
          </Button>
          {nameQuery || evidenceOnly ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/intelligence/clients">Clear</Link>
            </Button>
          ) : null}
        </form>
        <BuyerPortfolioTable rows={filtered} />
      </section>

      <section className="space-y-1.5">
        <h2 className="text-sm font-medium">Sourced public research</h2>
        <ResearchFactsTable rows={rows} />
      </section>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<BuyerSearchParams> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ClientsContent searchParams={searchParams} />
    </Suspense>
  );
}
