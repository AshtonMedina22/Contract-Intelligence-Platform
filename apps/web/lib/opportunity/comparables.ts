import { createClient } from "@/lib/supabase/server";
import type { PricingComparableRow } from "./types";
import { loadRankedComparablePursuits } from "@/lib/comparables";

export type { PricingComparableRow };

type Judgment = { source_pricing_line_id: string; included: boolean; reason: string };

/** Verified pricing lines from other pursuits — same org. Include/exclude with reasons. */
export async function loadPricingComparables(
  opportunityId: string,
  options?: { laborCategory?: string; clientId?: string | null; serviceType?: string | null },
): Promise<PricingComparableRow[]> {
  const supabase = await createClient();

  const ranked = await loadRankedComparablePursuits({
    targetOpportunityId: opportunityId,
    purpose: "PRICING_COMPARABLE",
    limit: 40,
  });
  const scoreByOpportunity = new Map(ranked.map((score) => [score.candidate.id, score]));
  if (scoreByOpportunity.size === 0) return [];

  const [{ data, error }, { data: judgments }] = await Promise.all([
    supabase
      .from("pricing_lines")
      .select(
        "id, opportunity_id, labor_category, rate_type, unit, site_or_post, updated_at, requested_rate, proposed_rate, awarded_rate, current_rate, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id, opportunities(title, service_type, client_id, clients(name))",
      )
      .in("opportunity_id", [...scoreByOpportunity.keys()])
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("pricing_comparable_judgments")
      .select("source_pricing_line_id, included, reason")
      .eq("opportunity_id", opportunityId),
  ]);

  if (error || !data) return [];

  const judgmentByLine = new Map<string, Judgment>(
    (judgments ?? []).map((j) => [j.source_pricing_line_id, j as Judgment]),
  );

  const rows: PricingComparableRow[] = [];
  for (const line of data) {
    const opp = Array.isArray(line.opportunities) ? line.opportunities[0] : line.opportunities;
    if (!opp) continue;

    const engine = scoreByOpportunity.get(line.opportunity_id);
    if (!engine) continue;
    if (options?.laborCategory && !line.labor_category.toLowerCase().includes(options.laborCategory.toLowerCase())) {
      continue;
    }

    const client = Array.isArray(opp.clients) ? opp.clients[0] : opp.clients;
    const hasRate =
      line.proposed_rate != null ||
      line.awarded_rate != null ||
      line.current_rate != null ||
      line.requested_rate != null;
    if (!hasRate) continue;

    const judgment = judgmentByLine.get(line.id);
    const proposedInclude = engine.totalScore >= 30;
    const included = judgment ? judgment.included : proposedInclude;
    const reason =
      judgment?.reason ??
      `Engine proposal (${engine.algorithmVersion}): ${proposedInclude ? "include" : "exclude"} at ${engine.totalScore.toFixed(1)}/100. Human judgment may override.`;

    rows.push({
      id: line.id,
      opportunity_id: line.opportunity_id,
      opportunity_title: opp.title ?? line.opportunity_id,
      client_name: client?.name ?? null,
      service_type: opp.service_type ?? null,
      labor_category: line.labor_category,
      rate_type: line.rate_type ?? null,
      unit: line.unit ?? null,
      site_or_post: line.site_or_post ?? null,
      requested_rate: line.requested_rate,
      proposed_rate: line.proposed_rate,
      awarded_rate: line.awarded_rate,
      current_rate: line.current_rate,
      requested_source_fact_id: line.requested_source_fact_id ?? null,
      proposed_source_fact_id: line.proposed_source_fact_id,
      awarded_source_fact_id: line.awarded_source_fact_id ?? null,
      current_source_fact_id: line.current_source_fact_id ?? null,
      included,
      reason,
      match_basis: engine.rationale.slice(0, 2).join(" "),
      updated_at: line.updated_at ?? null,
      engine_score: engine.totalScore,
      structured_score: engine.structuredScore,
      semantic_supplement: engine.semanticSupplement,
      algorithm_version: engine.algorithmVersion,
      judgment_source: judgment ? "HUMAN" : "ENGINE_PROPOSAL",
    });
  }

  return rows.sort((a, b) => b.engine_score - a.engine_score).slice(0, 40);
}

export async function loadPricingDecisions(opportunityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pricing_decisions")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}
