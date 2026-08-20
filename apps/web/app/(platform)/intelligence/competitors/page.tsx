import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { CompetitorBidsTable, type CompetitorBidRow } from "./competitors-table";

async function CompetitorsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view competitor bids.</p>;

  const { data, error } = await supabase
    .from("competitor_bids")
    .select(
      "id, quoted_amount, note, source_url, source_document_id, source_fact_id, competitors(name), opportunities(title)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: CompetitorBidRow[] = (data ?? []).map((row) => {
    const competitor = Array.isArray(row.competitors) ? row.competitors[0] : row.competitors;
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      competitor_name: competitor?.name ?? null,
      opportunity_title: opportunity?.title ?? null,
      quoted_amount: row.quoted_amount,
      note: row.note,
      source:
        row.source_url ??
        (row.source_fact_id ? `fact ${row.source_fact_id.slice(0, 8)}` : null) ??
        (row.source_document_id ? `document ${row.source_document_id.slice(0, 8)}` : null),
    };
  });

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Competitors</h1>
        <p className="text-sm text-muted-foreground">
          Observed bids only, based on procurements for which we have sufficient public or internal evidence.
          This is not a corporate win rate. Bids require a document, verified fact, or URL.
        </p>
      </div>
      <CompetitorBidsTable rows={rows} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <CompetitorsContent />
    </Suspense>
  );
}
