import { createClient } from "@/lib/supabase/server";
import type { PricingComparableRow } from "./types";

export type { PricingComparableRow };

type Judgment = { source_pricing_line_id: string; included: boolean; reason: string };

/** Verified pricing lines from other pursuits — same org. Include/exclude with reasons. */
export async function loadPricingComparables(
  opportunityId: string,
  options?: { laborCategory?: string; clientId?: string | null; serviceType?: string | null },
): Promise<PricingComparableRow[]> {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("opportunities")
    .select("client_id, service_type")
    .eq("id", opportunityId)
    .maybeSingle();

  const clientId = options?.clientId ?? current?.client_id ?? null;
  const serviceType = options?.serviceType ?? current?.service_type ?? null;

  const [{ data, error }, { data: judgments }] = await Promise.all([
    supabase
      .from("pricing_lines")
      .select(
        "id, opportunity_id, labor_category, rate_type, unit, site_or_post, updated_at, requested_rate, proposed_rate, awarded_rate, current_rate, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id, opportunities(title, service_type, client_id, clients(name))",
      )
      .neq("opportunity_id", opportunityId)
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

    const sameBuyer = Boolean(clientId && opp.client_id === clientId);
    const sameService = Boolean(serviceType && opp.service_type && opp.service_type === serviceType);
    const matchParts: string[] = [];
    if (sameBuyer) matchParts.push("same buyer");
    if (sameService) matchParts.push("similar service");
    if (matchParts.length === 0) matchParts.push("other pursuit (soft match)");

    // Soft filter: prefer same buyer/service when known, but still surface others for judgment.
    if (clientId && !sameBuyer && serviceType && !sameService) continue;
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
    const autoInclude = sameBuyer || sameService || !clientId;
    const included = judgment ? judgment.included : autoInclude;
    const reason =
      judgment?.reason ??
      (autoInclude
        ? `Auto-included: ${matchParts.join(", ")}`
        : `Auto-excluded: weak match (${matchParts.join(", ")})`);

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
      match_basis: matchParts.join(", "),
      updated_at: line.updated_at ?? null,
    });
  }

  return rows.slice(0, 40);
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
