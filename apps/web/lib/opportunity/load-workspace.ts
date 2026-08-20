import { createClient } from "@/lib/supabase/server";
import type { OpportunityStage, GoNoGo, PricingCostModelRow, PricingLineRow } from "./types";

export type OpportunityHeader = {
  id: string;
  title: string;
  stage: OpportunityStage;
  go_no_go: GoNoGo;
  response_due_on: string | null;
  service_type: string | null;
  notes: string | null;
  client_name: string | null;
};

export type WorkspaceSummary = {
  documentCount: number;
  requirementCount: number;
  pricingLineCount: number;
  hasAward: boolean;
  hasContract: boolean;
  hasWinLoss: boolean;
  competitorBidCount: number;
};

export async function loadOpportunityHeader(opportunityId: string): Promise<OpportunityHeader | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("id, title, stage, go_no_go, response_due_on, service_type, notes, clients(name)")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!data) return null;
  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
  return {
    id: data.id,
    title: data.title,
    stage: (data.stage ?? "INTAKE") as OpportunityStage,
    go_no_go: (data.go_no_go ?? "PENDING") as GoNoGo,
    response_due_on: data.response_due_on,
    service_type: data.service_type,
    notes: data.notes,
    client_name: client?.name ?? null,
  };
}

export async function loadWorkspaceSummary(opportunityId: string): Promise<WorkspaceSummary> {
  const supabase = await createClient();
  const [{ count: documentCount }, { data: solicitations }, { count: pricingLineCount }, { data: awards }, { data: contracts }, { data: winLoss }, { count: competitorBidCount }] =
    await Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId),
      supabase.from("solicitations").select("id").eq("opportunity_id", opportunityId),
      supabase.from("pricing_lines").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId),
      supabase.from("awards").select("id").eq("opportunity_id", opportunityId).limit(1),
      supabase.from("contracts").select("id").eq("opportunity_id", opportunityId).limit(1),
      supabase.from("win_loss_reviews").select("id").eq("opportunity_id", opportunityId).limit(1),
      supabase.from("competitor_bids").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId),
    ]);

  const solicitationIds = (solicitations ?? []).map((s) => s.id);
  let requirementCount = 0;
  if (solicitationIds.length > 0) {
    const { count } = await supabase
      .from("requirements")
      .select("*", { count: "exact", head: true })
      .in("solicitation_id", solicitationIds);
    requirementCount = count ?? 0;
  }

  return {
    documentCount: documentCount ?? 0,
    requirementCount,
    pricingLineCount: pricingLineCount ?? 0,
    hasAward: (awards ?? []).length > 0,
    hasContract: (contracts ?? []).length > 0,
    hasWinLoss: (winLoss ?? []).length > 0,
    competitorBidCount: competitorBidCount ?? 0,
  };
}

export async function loadFactDocumentMap(factIds: string[]): Promise<Map<string, string>> {
  if (factIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("extracted_facts").select("id, document_id").in("id", factIds);
  return new Map((data ?? []).map((f) => [f.id, f.document_id]));
}

export function collectFactIdsFromPricingLines(lines: PricingLineRow[]): string[] {
  const ids = new Set<string>();
  for (const line of lines) {
    for (const key of [
      "requested_source_fact_id",
      "proposed_source_fact_id",
      "awarded_source_fact_id",
      "current_source_fact_id",
    ] as const) {
      const id = line[key];
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export async function loadPricingLines(opportunityId: string): Promise<PricingLineRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pricing_lines").select("*").eq("opportunity_id", opportunityId);
  return (data ?? []) as PricingLineRow[];
}

export async function loadCostModels(opportunityId: string): Promise<PricingCostModelRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pricing_cost_models")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("labor_category");
  return (data ?? []) as PricingCostModelRow[];
}
