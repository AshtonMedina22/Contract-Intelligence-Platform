import { createClient } from "@/lib/supabase/server";
import type { PricingComparableRow } from "./types";

export type { PricingComparableRow };

/** Verified pricing lines from other pursuits — same org, optional filters. No AI inference. */
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

  let query = supabase
    .from("pricing_lines")
    .select(
      "id, opportunity_id, labor_category, requested_rate, proposed_rate, awarded_rate, current_rate, proposed_source_fact_id, opportunities(title, service_type, client_id, clients(name))",
    )
    .neq("opportunity_id", opportunityId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (options?.laborCategory) {
    query = query.ilike("labor_category", `%${options.laborCategory}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const rows: PricingComparableRow[] = [];
  for (const line of data) {
    const opp = Array.isArray(line.opportunities) ? line.opportunities[0] : line.opportunities;
    if (!opp) continue;

    if (clientId && opp.client_id !== clientId) continue;
    if (serviceType && opp.service_type && opp.service_type !== serviceType) continue;

    const client = Array.isArray(opp.clients) ? opp.clients[0] : opp.clients;
    const hasRate =
      line.proposed_rate != null || line.awarded_rate != null || line.current_rate != null || line.requested_rate != null;
    if (!hasRate) continue;

    rows.push({
      id: line.id,
      opportunity_id: line.opportunity_id,
      opportunity_title: opp.title ?? line.opportunity_id,
      client_name: client?.name ?? null,
      service_type: opp.service_type ?? null,
      labor_category: line.labor_category,
      requested_rate: line.requested_rate,
      proposed_rate: line.proposed_rate,
      awarded_rate: line.awarded_rate,
      current_rate: line.current_rate,
      proposed_source_fact_id: line.proposed_source_fact_id,
    });
  }

  return rows.slice(0, 25);
}
