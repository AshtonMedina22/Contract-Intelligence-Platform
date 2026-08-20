import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { INTELLIGENCE_TABS, MARKET_TABS, SectionTabs } from "@/components/section-tabs";
import { ResearchFactsTable, type ResearchFactRow } from "./research-facts-table";

async function ClientsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view research facts.</p>;

  const { data, error } = await supabase
    .from("research_facts")
    .select(
      "id, source_url, title, excerpt, published_on, retrieved_at, verification_status, clients(name), competitors(name)",
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
      client_name: client?.name ?? null,
      competitor_name: competitor?.name ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <SectionTabs tabs={INTELLIGENCE_TABS} />
      <SectionTabs tabs={MARKET_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Buyers / Bid intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Public-source research facts with URL and verification. This is a bid intelligence brief for the issuing
          agency — not CRM contact notes. Client remains a filter dimension.
        </p>
      </div>
      <ResearchFactsTable rows={rows} />
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
