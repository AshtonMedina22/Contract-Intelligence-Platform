import { Suspense } from "react";
import { IntelligenceNav } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { createClient } from "@/lib/supabase/server";
import { registryEntry } from "@/lib/data-model/registry";
import { PricingLinesTable, type PricingLineRow } from "./pricing-lines-table";

async function PricingContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view pricing lines.</p>;

  const { data, error } = await supabase
    .from("pricing_lines")
    .select(
      "id, labor_category, requested_rate, proposed_rate, awarded_rate, current_rate, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id, opportunity_id, opportunities(title)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: PricingLineRow[] = (data ?? []).map((row) => {
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      labor_category: row.labor_category,
      opportunity_id: row.opportunity_id,
      opportunity_title: opportunity?.title ?? null,
      requested_rate: row.requested_rate,
      proposed_rate: row.proposed_rate,
      awarded_rate: row.awarded_rate,
      current_rate: row.current_rate,
      requested_source_fact_id: row.requested_source_fact_id,
      proposed_source_fact_id: row.proposed_source_fact_id,
      awarded_source_fact_id: row.awarded_source_fact_id,
      current_source_fact_id: row.current_source_fact_id,
    };
  });

  const entry = registryEntry("pricing_lines");

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Pricing lines</h1>
        <p className="text-sm text-muted-foreground">
          Canonical four-truth rate matrix — only rows promoted from HUMAN_VERIFIED facts. Phase 12 adds Glide
          comparables on top of this table.
        </p>
      </div>
      {entry ? <DataRegistryCallout entry={entry} /> : null}
      <PricingLinesTable rows={rows} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <PricingContent />
    </Suspense>
  );
}
