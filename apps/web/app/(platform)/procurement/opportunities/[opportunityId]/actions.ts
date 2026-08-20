"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { computePlannedRate, parseNum } from "@/lib/opportunity/pricing-math";
import type { GoNoGo, OpportunityStage } from "@/lib/opportunity/types";
import type { ProcurementRail, SolicitationKind } from "@/lib/opportunity/proposal-packet";

function workspacePath(opportunityId: string) {
  return `/procurement/opportunities/${opportunityId}`;
}

async function requireUserOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.organization_id) throw new Error("No organization.");
  return { supabase, organizationId: membership.organization_id };
}

export async function updateOpportunityMetadata(opportunityId: string, formData: FormData) {
  const { supabase } = await requireUserOrg();
  const stage = String(formData.get("stage") ?? "INTAKE") as OpportunityStage;
  const go_no_go = String(formData.get("go_no_go") ?? "PENDING") as GoNoGo;
  const response_due_on = String(formData.get("response_due_on") ?? "").trim() || null;
  const service_type = String(formData.get("service_type") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const procurement_rail = (String(formData.get("procurement_rail") ?? "").trim() || null) as ProcurementRail | null;
  const solicitation_kind = (String(formData.get("solicitation_kind") ?? "").trim() || null) as SolicitationKind | null;
  const site_location = String(formData.get("site_location") ?? "").trim() || null;
  const submission_method = String(formData.get("submission_method") ?? "").trim() || null;
  const coverage_start_on = String(formData.get("coverage_start_on") ?? "").trim() || null;
  const vehicle_ref = String(formData.get("vehicle_ref") ?? "").trim() || null;

  const { error } = await supabase
    .from("opportunities")
    .update({
      stage,
      go_no_go,
      response_due_on,
      service_type,
      notes,
      procurement_rail,
      solicitation_kind,
      site_location,
      submission_method,
      coverage_start_on,
      vehicle_ref,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opportunityId);

  if (error) throw new Error(error.message);
  revalidatePath(workspacePath(opportunityId));
  revalidatePath("/proposals");
  revalidatePath("/procurement/opportunities");
}

export async function saveCostModel(opportunityId: string, formData: FormData) {
  const { supabase, organizationId } = await requireUserOrg();
  const labor_category = String(formData.get("labor_category") ?? "").trim();
  if (!labor_category) throw new Error("Labor category required.");

  const inputs = {
    baseWage: parseNum(String(formData.get("base_wage") ?? "")),
    fringe: parseNum(String(formData.get("fringe") ?? "")),
    burdenPct: parseNum(String(formData.get("burden_pct") ?? "")),
    workersComp: parseNum(String(formData.get("workers_comp") ?? "")),
    insurance: parseNum(String(formData.get("insurance") ?? "")),
    supervision: parseNum(String(formData.get("supervision") ?? "")),
    equipment: parseNum(String(formData.get("equipment") ?? "")),
    overheadPct: parseNum(String(formData.get("overhead_pct") ?? "")),
    targetMarginPct: parseNum(String(formData.get("target_margin_pct") ?? "")),
  };
  const hasCostInputs = [
    formData.get("base_wage"),
    formData.get("fringe"),
    formData.get("burden_pct"),
    formData.get("workers_comp"),
    formData.get("insurance"),
    formData.get("supervision"),
    formData.get("equipment"),
    formData.get("overhead_pct"),
    formData.get("target_margin_pct"),
  ].some((v) => String(v ?? "").trim() !== "");
  const plannedRate = hasCostInputs ? computePlannedRate(inputs).plannedRate : null;

  const row = {
    organization_id: organizationId,
    opportunity_id: opportunityId,
    labor_category,
    base_wage: hasCostInputs ? inputs.baseWage || null : null,
    fringe: hasCostInputs ? inputs.fringe || null : null,
    burden_pct: hasCostInputs ? inputs.burdenPct || null : null,
    workers_comp: hasCostInputs ? inputs.workersComp || null : null,
    insurance: hasCostInputs ? inputs.insurance || null : null,
    supervision: hasCostInputs ? inputs.supervision || null : null,
    equipment: hasCostInputs ? inputs.equipment || null : null,
    overhead_pct: hasCostInputs ? inputs.overheadPct || null : null,
    target_margin_pct: hasCostInputs ? inputs.targetMarginPct || null : null,
    planned_proposed_rate: plannedRate,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pricing_cost_models").upsert(row, {
    onConflict: "organization_id,opportunity_id,labor_category",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`${workspacePath(opportunityId)}/pricing`);
}

function parseOptionalNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function parseArmed(raw: string): boolean | null {
  if (raw === "yes") return true;
  if (raw === "no") return false;
  return null;
}

export async function saveStaffingRequirement(opportunityId: string, formData: FormData) {
  const { supabase, organizationId } = await requireUserOrg();
  const post_label = String(formData.get("post_label") ?? "").trim();
  if (!post_label) throw new Error("Post label required.");

  const { error } = await supabase.from("staffing_requirements").upsert(
    {
      organization_id: organizationId,
      opportunity_id: opportunityId,
      post_label,
      armed: parseArmed(String(formData.get("armed") ?? "")),
      posts_count: parseOptionalInt(String(formData.get("posts_count") ?? "")),
      shift_hours: parseOptionalNum(String(formData.get("shift_hours") ?? "")),
      weekly_hours: parseOptionalNum(String(formData.get("weekly_hours") ?? "")),
      clearance_note: String(formData.get("clearance_note") ?? "").trim() || null,
      labor_category: String(formData.get("labor_category") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id,post_label" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`${workspacePath(opportunityId)}/staffing`);
}

export async function deleteStaffingRequirement(opportunityId: string, rowId: string) {
  const { supabase } = await requireUserOrg();
  const { error } = await supabase.from("staffing_requirements").delete().eq("id", rowId);
  if (error) throw new Error(error.message);
  revalidatePath(`${workspacePath(opportunityId)}/staffing`);
}

export async function saveEvaluationCriterion(opportunityId: string, formData: FormData) {
  const { supabase, organizationId } = await requireUserOrg();
  const criterion = String(formData.get("criterion") ?? "").trim();
  if (!criterion) throw new Error("Criterion required.");

  const { error } = await supabase.from("evaluation_criteria").insert({
    organization_id: organizationId,
    opportunity_id: opportunityId,
    criterion,
    weight_pct: parseOptionalNum(String(formData.get("weight_pct") ?? "")),
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`${workspacePath(opportunityId)}/requirements`);
}

export async function deleteEvaluationCriterion(opportunityId: string, rowId: string) {
  const { supabase } = await requireUserOrg();
  const { error } = await supabase.from("evaluation_criteria").delete().eq("id", rowId);
  if (error) throw new Error(error.message);
  revalidatePath(`${workspacePath(opportunityId)}/requirements`);
}
