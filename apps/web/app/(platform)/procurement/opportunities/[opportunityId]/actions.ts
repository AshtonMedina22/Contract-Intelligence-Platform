"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { computePlannedRate, parseNum } from "@/lib/opportunity/pricing-math";
import type { GoNoGo, OpportunityStage } from "@/lib/opportunity/types";

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

  const { error } = await supabase
    .from("opportunities")
    .update({
      stage,
      go_no_go,
      response_due_on,
      service_type,
      notes,
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
  const { plannedRate } = computePlannedRate(inputs);

  const row = {
    organization_id: organizationId,
    opportunity_id: opportunityId,
    labor_category,
    base_wage: inputs.baseWage || null,
    fringe: inputs.fringe || null,
    burden_pct: inputs.burdenPct || null,
    workers_comp: inputs.workersComp || null,
    insurance: inputs.insurance || null,
    supervision: inputs.supervision || null,
    equipment: inputs.equipment || null,
    overhead_pct: inputs.overheadPct || null,
    target_margin_pct: inputs.targetMarginPct || null,
    planned_proposed_rate: plannedRate || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pricing_cost_models").upsert(row, {
    onConflict: "organization_id,opportunity_id,labor_category",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`${workspacePath(opportunityId)}/pricing`);
}
