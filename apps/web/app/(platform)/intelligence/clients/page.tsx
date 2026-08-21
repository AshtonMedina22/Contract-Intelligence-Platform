import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { loadBuyerPortfolio } from "@/lib/intelligence/load-corpus";
import { BuyerPortfolioTable } from "./buyers-portfolio-table";
import { ResearchFactsTable, type ResearchFactRow } from "./research-facts-table";

async function ClientsContent() {
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

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <PageHeader
        title="Buyers"
        description={
          <>
            Procurement intelligence for issuing agencies — prior solicitations, awards, contracts, L&P outcomes. Not CRM.{" "}
            <Link className="underline" href="/procurement/clients">
              Buyer registry
            </Link>
          </>
        }
      />

      <section className="space-y-1.5">
        <h2 className="text-sm font-medium">Buyer portfolio</h2>
        <BuyerPortfolioTable rows={portfolio} />
      </section>

      <section className="space-y-1.5">
        <h2 className="text-sm font-medium">Sourced public research</h2>
        <ResearchFactsTable rows={rows} />
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ClientsContent />
    </Suspense>
  );
}
