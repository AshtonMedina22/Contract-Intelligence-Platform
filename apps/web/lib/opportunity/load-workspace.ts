import { createClient } from "@/lib/supabase/server";
import type { OpportunityStage, GoNoGo, PricingCostModelRow, PricingLineRow } from "./types";
import type { ProcurementRail, SolicitationKind } from "./proposal-packet";

export type OpportunityHeader = {
  id: string;
  title: string;
  stage: OpportunityStage;
  go_no_go: GoNoGo;
  response_due_on: string | null;
  service_type: string | null;
  notes: string | null;
  client_id: string | null;
  client_name: string | null;
  procurement_rail: ProcurementRail | null;
  solicitation_kind: SolicitationKind | null;
  site_location: string | null;
  submission_method: string | null;
  coverage_start_on: string | null;
  vehicle_ref: string | null;
  external_provider: string | null;
  external_source_id: string | null;
  source_url: string | null;
  public_source_id: string | null;
};

export type WorkspaceSummary = {
  documentCount: number;
  requirementCount: number;
  evaluationCount: number;
  staffingCount: number;
  pricingLineCount: number;
  costModelCount: number;
  hasAward: boolean;
  hasContract: boolean;
  hasWinLoss: boolean;
  competitorBidCount: number;
};

export type StaffingRequirementRow = {
  id: string;
  post_label: string;
  armed: boolean | null;
  shift_hours: number | null;
  posts_count: number | null;
  weekly_hours: number | null;
  clearance_note: string | null;
  notes: string | null;
  labor_category: string | null;
};

export async function loadOpportunityHeader(opportunityId: string): Promise<OpportunityHeader | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select(
      "id, title, stage, go_no_go, response_due_on, service_type, notes, client_id, procurement_rail, solicitation_kind, site_location, submission_method, coverage_start_on, vehicle_ref, external_provider, external_source_id, source_url, public_source_id, clients(name)",
    )
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
    client_id: data.client_id ?? null,
    client_name: client?.name ?? null,
    procurement_rail: (data.procurement_rail as ProcurementRail | null) ?? null,
    solicitation_kind: (data.solicitation_kind as SolicitationKind | null) ?? null,
    site_location: data.site_location ?? null,
    submission_method: data.submission_method ?? null,
    coverage_start_on: data.coverage_start_on ?? null,
    vehicle_ref: data.vehicle_ref ?? null,
    external_provider: data.external_provider ?? null,
    external_source_id: data.external_source_id ?? null,
    source_url: data.source_url ?? null,
    public_source_id: data.public_source_id ?? null,
  };
}

export async function loadWorkspaceSummary(opportunityId: string): Promise<WorkspaceSummary> {
  const supabase = await createClient();
  const [
    { count: documentCount },
    { data: solicitations },
    { count: pricingLineCount },
    { count: costModelCount },
    { count: staffingCount },
    { count: evaluationCount },
    { data: awards },
    { data: contracts },
    { data: winLoss },
    { count: competitorBidCount },
  ] = await Promise.all([
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId),
    supabase.from("solicitations").select("id").eq("opportunity_id", opportunityId),
    supabase.from("pricing_lines").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId),
    supabase.from("pricing_cost_models").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId),
    supabase.from("staffing_requirements").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId),
    supabase.from("evaluation_criteria").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId),
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
    evaluationCount: evaluationCount ?? 0,
    staffingCount: staffingCount ?? 0,
    pricingLineCount: pricingLineCount ?? 0,
    costModelCount: costModelCount ?? 0,
    hasAward: (awards ?? []).length > 0,
    hasContract: (contracts ?? []).length > 0,
    hasWinLoss: (winLoss ?? []).length > 0,
    competitorBidCount: competitorBidCount ?? 0,
  };
}

export async function loadStaffingRequirements(opportunityId: string): Promise<StaffingRequirementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staffing_requirements")
    .select("id, post_label, armed, shift_hours, posts_count, weekly_hours, clearance_note, notes, labor_category")
    .eq("opportunity_id", opportunityId)
    .order("post_label");
  return (data ?? []) as StaffingRequirementRow[];
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
