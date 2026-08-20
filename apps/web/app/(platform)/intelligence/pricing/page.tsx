import { Suspense } from "react";
import Link from "next/link";
import { IntelligenceNav } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { createClient } from "@/lib/supabase/server";
import { registryEntry } from "@/lib/data-model/registry";
import { formatMoney } from "@/lib/opportunity/pricing-math";
import { PricingLinesTable, type PricingLineRow } from "./pricing-lines-table";

async function PricingContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view pricing intelligence.</p>;

  const [{ data, error }, { data: competitorLines }, { count: decisionCount }] = await Promise.all([
    supabase
      .from("pricing_lines")
      .select(
        "id, labor_category, rate_type, site_or_post, requested_rate, internal_cost_rate, proposed_rate, awarded_rate, current_rate, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id, opportunity_id, opportunities(title)",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("competitor_pricing_lines")
      .select("id, vendor_name, labor_category, hourly_rate, rate_type, opportunity_id")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("pricing_decisions").select("id", { count: "exact", head: true }).eq("status", "HUMAN_APPROVED"),
  ]);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: PricingLineRow[] = (data ?? []).map((row) => {
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      labor_category: row.labor_category,
      opportunity_id: row.opportunity_id,
      opportunity_title: opportunity?.title ?? null,
      requested_rate: row.requested_rate,
      internal_cost_rate: row.internal_cost_rate,
      proposed_rate: row.proposed_rate,
      awarded_rate: row.awarded_rate,
      current_rate: row.current_rate,
      requested_source_fact_id: row.requested_source_fact_id,
      proposed_source_fact_id: row.proposed_source_fact_id,
      awarded_source_fact_id: row.awarded_source_fact_id,
      current_source_fact_id: row.current_source_fact_id,
    };
  });

  const rates = rows
    .flatMap((r) => [r.awarded_rate, r.proposed_rate, r.current_rate])
    .filter((v): v is number => v != null && Number.isFinite(v));
  const observed =
    rates.length > 0
      ? `${formatMoney(Math.min(...rates))} – ${formatMoney(Math.max(...rates))} (n=${rates.length})`
      : "—";

  const entry = registryEntry("pricing_lines");

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Pricing intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Cross-corpus analysis of verified L&P and competitor rates. To price a live solicitation, open that
          Pursuit → Pricing workbench — do not force operators out of the pursuit to decide a bid.
        </p>
      </div>
      {entry ? <DataRegistryCallout entry={entry} /> : null}

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <dt className="text-muted-foreground">Verified L&P lines</dt>
          <dd className="text-lg font-medium">{rows.length}</dd>
        </div>
        <div className="rounded-md border p-3">
          <dt className="text-muted-foreground">Observed rate span</dt>
          <dd className="text-lg font-medium">{observed}</dd>
        </div>
        <div className="rounded-md border p-3">
          <dt className="text-muted-foreground">Human-approved bid decisions</dt>
          <dd className="text-lg font-medium">{decisionCount ?? 0}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">L&P five-truth lines</h2>
        <PricingLinesTable rows={rows} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Sourced competitor pricing lines</h2>
        {(competitorLines ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No sourced competitor_pricing_lines yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(competitorLines ?? []).slice(0, 25).map((c) => (
              <li key={c.id} className="border-b py-1">
                {c.vendor_name} · {c.labor_category} · {c.rate_type} · {formatMoney(c.hourly_rate)}
                {c.opportunity_id ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link className="underline" href={`/procurement/opportunities/${c.opportunity_id}/pricing`}>
                      Open pursuit pricing
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
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
