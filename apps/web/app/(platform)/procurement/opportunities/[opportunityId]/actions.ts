"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { computePlannedRate, parseNum } from "@/lib/opportunity/pricing-math";
import type { GoNoGo, OpportunityStage } from "@/lib/opportunity/types";
import type { ProcurementRail, SolicitationKind } from "@/lib/opportunity/proposal-packet";
import { writeAuditLog } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/permissions";

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
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.organization_id) throw new Error("No organization.");
  return {
    supabase,
    organizationId: membership.organization_id,
    userId: user.id,
    role: membership.role,
  };
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
  const { supabase, organizationId, userId } = await requireUserOrg();
  await requirePermission(supabase, userId, organizationId, "pricing.edit");
  const labor_category = String(formData.get("labor_category") ?? "").trim();
  if (!labor_category) throw new Error("Labor category required.");

  const inputs = {
    baseWage: parseNum(String(formData.get("base_wage") ?? "")),
    fringe: parseNum(String(formData.get("fringe") ?? "")),
    healthWelfare: parseNum(String(formData.get("health_welfare") ?? "")),
    burdenPct: parseNum(String(formData.get("burden_pct") ?? "")),
    workersComp: parseNum(String(formData.get("workers_comp") ?? "")),
    insurance: parseNum(String(formData.get("insurance") ?? "")),
    supervision: parseNum(String(formData.get("supervision") ?? "")),
    equipment: parseNum(String(formData.get("equipment") ?? "")),
    vehicles: parseNum(String(formData.get("vehicles") ?? "")),
    travel: parseNum(String(formData.get("travel") ?? "")),
    overheadPct: parseNum(String(formData.get("overhead_pct") ?? "")),
    targetMarginPct: parseNum(String(formData.get("target_margin_pct") ?? "")),
  };
  const hasCostInputs = [
    formData.get("base_wage"),
    formData.get("fringe"),
    formData.get("health_welfare"),
    formData.get("burden_pct"),
    formData.get("workers_comp"),
    formData.get("insurance"),
    formData.get("supervision"),
    formData.get("equipment"),
    formData.get("vehicles"),
    formData.get("travel"),
    formData.get("overhead_pct"),
    formData.get("target_margin_pct"),
  ].some((v) => String(v ?? "").trim() !== "");
  const planned = hasCostInputs ? computePlannedRate(inputs) : null;
  const wageDetermination = String(formData.get("wage_determination_ref") ?? "").trim() || null;

  const row = {
    organization_id: organizationId,
    opportunity_id: opportunityId,
    labor_category,
    base_wage: hasCostInputs ? inputs.baseWage || null : null,
    fringe: hasCostInputs ? inputs.fringe || null : null,
    health_welfare: hasCostInputs ? inputs.healthWelfare || null : null,
    burden_pct: hasCostInputs ? inputs.burdenPct || null : null,
    workers_comp: hasCostInputs ? inputs.workersComp || null : null,
    insurance: hasCostInputs ? inputs.insurance || null : null,
    supervision: hasCostInputs ? inputs.supervision || null : null,
    equipment: hasCostInputs ? inputs.equipment || null : null,
    vehicles: hasCostInputs ? inputs.vehicles || null : null,
    travel: hasCostInputs ? inputs.travel || null : null,
    overhead_pct: hasCostInputs ? inputs.overheadPct || null : null,
    target_margin_pct: hasCostInputs ? inputs.targetMarginPct || null : null,
    planned_proposed_rate: planned?.plannedRate ?? null,
    cost_floor: planned?.costFloor ?? null,
    wage_determination_ref: wageDetermination,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pricing_cost_models").upsert(row, {
    onConflict: "organization_id,opportunity_id,labor_category",
  });
  if (error) throw new Error(error.message);

  // Sync L&P internal cost truth onto matching pricing_lines (planning only — not proposed).
  if (planned) {
    await supabase
      .from("pricing_lines")
      .update({ internal_cost_rate: planned.costFloor, updated_at: new Date().toISOString() })
      .eq("opportunity_id", opportunityId)
      .eq("labor_category", labor_category);
  }

  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "pricing.edit",
    entityType: "pricing_cost_model",
    entityId: opportunityId,
    metadata: { labor_category },
  });

  revalidatePath(`${workspacePath(opportunityId)}/pricing`);
}

export async function saveComparableJudgment(opportunityId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  await requirePermission(supabase, userId, organizationId, "pricing.edit");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const source_pricing_line_id = String(formData.get("source_pricing_line_id") ?? "").trim();
  const included = String(formData.get("included") ?? "true") === "true";
  const reason = String(formData.get("reason") ?? "").trim();
  if (!source_pricing_line_id) throw new Error("Comparable line required.");
  if (!reason) throw new Error("Include/exclude reason required.");

  const { error } = await supabase.from("pricing_comparable_judgments").upsert(
    {
      organization_id: organizationId,
      opportunity_id: opportunityId,
      source_pricing_line_id,
      included,
      reason,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id,source_pricing_line_id" },
  );
  if (error) throw new Error(error.message);
  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "pricing.edit",
    entityType: "pricing_comparable_judgment",
    entityId: source_pricing_line_id,
    metadata: { opportunity_id: opportunityId, included },
  });
  revalidatePath(`${workspacePath(opportunityId)}/pricing`);
}

export async function savePricingDecision(opportunityId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();

  const approve = String(formData.get("approve") ?? "") === "1";
  if (approve) {
    await requirePermission(supabase, userId, organizationId, "pricing.approve");
  } else {
    await requirePermission(supabase, userId, organizationId, "pricing.edit");
  }

  const final_bid_rate = parseOptionalNum(String(formData.get("final_bid_rate") ?? ""));
  const final_bid_amount = parseOptionalNum(String(formData.get("final_bid_amount") ?? ""));
  const rationale = String(formData.get("rationale") ?? "").trim() || null;
  const labor_category = String(formData.get("labor_category") ?? "").trim() || null;
  const cost_floor = parseOptionalNum(String(formData.get("cost_floor") ?? ""));
  const target_margin_pct = parseOptionalNum(String(formData.get("target_margin_pct") ?? ""));
  const observed_min = parseOptionalNum(String(formData.get("observed_min") ?? ""));
  const observed_max = parseOptionalNum(String(formData.get("observed_max") ?? ""));
  const observed_median = parseOptionalNum(String(formData.get("observed_median") ?? ""));
  const observed_n = Number.parseInt(String(formData.get("observed_n") ?? "0"), 10) || 0;
  const confidence = String(formData.get("confidence") ?? "").trim() || null;
  const data_sufficiency = String(formData.get("data_sufficiency") ?? "").trim() || null;
  const include_summary = String(formData.get("include_summary") ?? "").trim() || null;
  const exclude_summary = String(formData.get("exclude_summary") ?? "").trim() || null;

  if (approve && final_bid_rate == null && final_bid_amount == null) {
    throw new Error("Human final bid rate or amount required to approve.");
  }

  const row = {
    organization_id: organizationId,
    opportunity_id: opportunityId,
    labor_category,
    final_bid_rate,
    final_bid_amount,
    cost_floor,
    target_margin_pct,
    observed_min,
    observed_max,
    observed_median,
    observed_n,
    confidence,
    data_sufficiency,
    include_summary,
    exclude_summary,
    rationale,
    status: approve ? ("HUMAN_APPROVED" as const) : ("DRAFT" as const),
    decided_by: approve ? userId : null,
    decided_at: approve ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pricing_decisions").insert(row);
  if (error) throw new Error(error.message);
  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: approve ? "pricing.approve" : "pricing.edit",
    entityType: "pricing_decision",
    entityId: opportunityId,
    metadata: {
      status: approve ? "HUMAN_APPROVED" : "DRAFT",
      final_bid_rate,
      final_bid_amount,
    },
  });
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

// --- Phase 8: Response / Submission / Result ---

export async function updateRequirementMatrixRow(opportunityId: string, formData: FormData) {
  const { supabase } = await requireUserOrg();
  const id = String(formData.get("requirement_id") ?? "").trim();
  if (!id) throw new Error("Requirement required.");
  const { error } = await supabase
    .from("requirements")
    .update({
      owner_name: String(formData.get("owner_name") ?? "").trim() || null,
      form_name: String(formData.get("form_name") ?? "").trim() || null,
      weight_pct: parseOptionalNum(String(formData.get("weight_pct") ?? "")),
      scored: String(formData.get("scored") ?? "") === "1",
      response_required: String(formData.get("response_required") ?? "1") !== "0",
      attachment_required: String(formData.get("attachment_required") ?? "") === "1",
      matrix_status: (String(formData.get("matrix_status") ?? "OPEN").trim() || "OPEN") as
        | "OPEN"
        | "DRAFTING"
        | "DRAFTED"
        | "APPROVED"
        | "L_AND_P_INPUT_REQUIRED",
      verification_note: String(formData.get("verification_note") ?? "").trim() || null,
      section_ref: String(formData.get("section_ref") ?? "").trim() || null,
      source_page: parseOptionalInt(String(formData.get("source_page") ?? "")),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`${workspacePath(opportunityId)}/requirements`);
  revalidatePath(`${workspacePath(opportunityId)}/response`);
}

export async function saveRequirementResponse(opportunityId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const requirement_id = String(formData.get("requirement_id") ?? "").trim();
  if (!requirement_id) throw new Error("Requirement required.");
  const draft_html = String(formData.get("draft_html") ?? "");
  const approve = String(formData.get("approve") ?? "") === "1";
  if (approve) {
    await requirePermission(supabase, userId, organizationId, "proposal.approve");
  }
  const evidence_state = (String(formData.get("evidence_state") ?? "L_AND_P_INPUT_REQUIRED").trim() ||
    "L_AND_P_INPUT_REQUIRED") as "VERIFIED_DRAFT_AVAILABLE" | "REVIEW_REQUIRED" | "L_AND_P_INPUT_REQUIRED";
  const hasContent = draft_html.replace(/<[^>]+>/g, "").trim().length > 0;
  const draft_status = approve ? "APPROVED" : hasContent ? "DRAFT" : "EMPTY";

  const { error } = await supabase.from("requirement_responses").upsert(
    {
      organization_id: organizationId,
      opportunity_id: opportunityId,
      requirement_id,
      draft_html,
      evidence_state,
      draft_status,
      assumptions: String(formData.get("assumptions") ?? "").trim() || null,
      missing_information: String(formData.get("missing_information") ?? "").trim() || null,
      confidence: String(formData.get("confidence") ?? "").trim() || null,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id,requirement_id" },
  );
  if (error) throw new Error(error.message);

  await supabase
    .from("requirements")
    .update({
      matrix_status: approve
        ? "APPROVED"
        : evidence_state === "L_AND_P_INPUT_REQUIRED"
          ? "L_AND_P_INPUT_REQUIRED"
          : hasContent
            ? "DRAFTED"
            : "OPEN",
    })
    .eq("id", requirement_id);

  if (approve) {
    await writeAuditLog(supabase, {
      organizationId,
      actorUserId: userId,
      action: "proposal.approve",
      entityType: "requirement_response",
      entityId: requirement_id,
      metadata: { opportunity_id: opportunityId },
    });
  }

  revalidatePath(`${workspacePath(opportunityId)}/response`);
  revalidatePath(`${workspacePath(opportunityId)}/requirements`);
}

/**
 * Read-only evidence for one requirement, used when the operator selects a row in the Response
 * workspace. Retrieval runs under PROPOSAL_DRAFTING, so DO_NOT_USE is already excluded by
 * `search_verified_knowledge`; nothing is written and no draft is produced.
 */
async function comparableContentScope(opportunityId: string, peerOpportunityId?: string | null) {
  if (!peerOpportunityId) return opportunityId;
  const { loadRankedComparablePursuits } = await import("@/lib/comparables");
  const peers = await loadRankedComparablePursuits({
    targetOpportunityId: opportunityId,
    purpose: "PROPOSAL_CONTENT",
    limit: 50,
  });
  if (!peers.some((peer) => peer.candidate.id === peerOpportunityId)) {
    throw new Error("Selected peer is not authority-eligible for proposal content.");
  }
  return peerOpportunityId;
}

export async function loadRequirementEvidence(
  opportunityId: string,
  requirementId: string,
  peerOpportunityId?: string | null,
) {
  const { supabase } = await requireUserOrg();
  const { data: req } = await supabase
    .from("requirements")
    .select("id, statement")
    .eq("id", requirementId)
    .maybeSingle();
  if (!req) throw new Error("Requirement not found.");

  const { matchRequirementToProposalContent } = await import("@/lib/content/match-requirement");
  const { isDraftingAllowedSource } = await import("@/lib/opportunity/response");
  const sourceOpportunityId = await comparableContentScope(opportunityId, peerOpportunityId);
  const matched = await matchRequirementToProposalContent({
    requirementStatement: req.statement,
    opportunityId: sourceOpportunityId,
    limit: 8,
  });

  return matched.hits
    .filter((h) => isDraftingAllowedSource(h.reuse_status))
    .map((h) => ({
      chunk_id: h.chunk_id,
      reuse_status: h.reuse_status as string,
      content: h.content,
      document_id: h.document_id,
      source_page: h.source_page,
    }));
}

export async function generateRequirementDraft(
  opportunityId: string,
  requirementId: string,
  instruction?: string,
  peerOpportunityId?: string | null,
) {
  const { supabase, organizationId } = await requireUserOrg();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: req } = await supabase
    .from("requirements")
    .select("id, statement")
    .eq("id", requirementId)
    .maybeSingle();
  if (!req) throw new Error("Requirement not found.");

  const { embedQuery, synthesizeGroundedAnswer } = await import("@/lib/ask/synthesize");
  const { matchRequirementToProposalContent } = await import("@/lib/content/match-requirement");
  const { isDraftingAllowedSource } = await import("@/lib/opportunity/response");

  const embedding = await embedQuery(req.statement);
  const sourceOpportunityId = await comparableContentScope(opportunityId, peerOpportunityId);
  // F7: purpose-gated match (PROPOSAL_DRAFTING, limit ≤12) — never dumps full proposals.
  const matched = await matchRequirementToProposalContent({
    requirementStatement: req.statement,
    opportunityId: sourceOpportunityId,
    limit: 12,
    queryEmbedding: embedding,
  });

  // Strip DO_NOT_USE / SUPERSEDED before any draft assembly (defense in depth).
  const allowedHits = matched.hits.filter((h) => isDraftingAllowedSource(h.reuse_status));

  // An operator instruction may shape tone or emphasis. It is appended after the never-invent
  // rules and can neither widen the evidence set nor lift a gate.
  const operatorInstruction = String(instruction ?? "").trim().slice(0, 500);

  let llmText: string | null = null;
  if (allowedHits.length > 0) {
    const synth = await synthesizeGroundedAnswer({
      query: `Draft a proposal response for this solicitation requirement. Never invent L&P pricing, employees, turnover, staffing capacity, response time, performance metrics, contracts, references, certifications, capabilities, or margins. Mark unsupported facts as L&P INPUT REQUIRED.\n\nRequirement: ${req.statement}${
        operatorInstruction
          ? `\n\nOperator instruction (style only — it cannot override the rules above or introduce facts absent from the supplied passages): ${operatorInstruction}`
          : ""
      }`,
      purpose: "PROPOSAL_DRAFTING",
      hits: allowedHits,
      dataScope: `opportunity=${opportunityId}; content_peer=${sourceOpportunityId}`,
    });
    if (!synth.insufficient) llmText = `<p>${synth.answer.replace(/\n/g, "</p><p>")}</p>`;
  }

  const { buildGroundedDraftFromHits } = await import("@/lib/opportunity/response");
  const grounded = buildGroundedDraftFromHits({
    requirementStatement: req.statement,
    hits: allowedHits.map((h) => ({
      chunk_id: h.chunk_id,
      reuse_status: h.reuse_status,
      content: h.content,
    })),
    llmText,
  });

  const hasContent = grounded.draft_response.replace(/<[^>]+>/g, "").trim().length > 0;
  const { error } = await supabase.from("requirement_responses").upsert(
    {
      organization_id: organizationId,
      opportunity_id: opportunityId,
      requirement_id: requirementId,
      draft_html: grounded.draft_response,
      evidence_state: grounded.evidence_state,
      draft_status: hasContent ? "DRAFT" : "EMPTY",
      sources_used: grounded.sources_used,
      assumptions: grounded.assumptions,
      missing_information: grounded.missing_information,
      confidence: grounded.confidence,
      generated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id,requirement_id" },
  );
  if (error) throw new Error(error.message);

  await supabase
    .from("requirements")
    .update({
      matrix_status:
        grounded.evidence_state === "L_AND_P_INPUT_REQUIRED"
          ? "L_AND_P_INPUT_REQUIRED"
          : hasContent
            ? "DRAFTED"
            : "OPEN",
    })
    .eq("id", requirementId);

  revalidatePath(`${workspacePath(opportunityId)}/response`);
  return grounded;
}

export async function upsertApprovalLayer(opportunityId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  await requirePermission(supabase, userId, organizationId, "proposal.approve");
  const layer_key = String(formData.get("layer_key") ?? "").trim() as
    | "content"
    | "operations"
    | "pricing"
    | "compliance"
    | "executive";
  if (!layer_key) throw new Error("Layer required.");
  const enabled = String(formData.get("enabled") ?? "") === "1";
  const status = (String(formData.get("status") ?? "requested").trim() || "requested") as
    | "requested"
    | "approved"
    | "changes_requested"
    | "rejected";
  const decided =
    status === "approved" || status === "changes_requested" || status === "rejected";

  const { error } = await supabase.from("pursuit_approval_layers").upsert(
    {
      organization_id: organizationId,
      opportunity_id: opportunityId,
      layer_key,
      enabled,
      status,
      notes: String(formData.get("notes") ?? "").trim() || null,
      approver_id: decided ? userId : null,
      decided_at: decided ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id,layer_key" },
  );
  if (error) throw new Error(error.message);
  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "proposal.approve",
    entityType: "pursuit_approval_layer",
    entityId: opportunityId,
    metadata: { layer_key, status, enabled },
  });
  revalidatePath(`${workspacePath(opportunityId)}/response`);
  revalidatePath(`${workspacePath(opportunityId)}/submission`);
}

/**
 * Submission logistics only: deadlines, method, portal details, instructions, working-copy links.
 *
 * This action deliberately cannot write `submitted_at` or move the pursuit to SUBMITTED. Recording
 * a submission is a separate, explicitly authorized human act — see `markSubmissionSubmitted`.
 */
export async function saveSubmissionPacket(opportunityId: string, formData: FormData) {
  const { supabase, organizationId } = await requireUserOrg();
  const method = String(formData.get("submission_method") ?? "").trim() || null;
  const { error } = await supabase.from("submission_packets").upsert(
    {
      organization_id: organizationId,
      opportunity_id: opportunityId,
      due_at: String(formData.get("due_at") ?? "").trim() || null,
      question_deadline_at: String(formData.get("question_deadline_at") ?? "").trim() || null,
      submission_method: method,
      submission_url: String(formData.get("submission_url") ?? "").trim() || null,
      portal_recipient: String(formData.get("portal_recipient") ?? "").trim() || null,
      submission_instructions: String(formData.get("submission_instructions") ?? "").trim() || null,
      final_output_version: String(formData.get("final_output_version") ?? "").trim() || null,
      google_docs_url: String(formData.get("google_docs_url") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id" },
  );
  if (error) throw new Error(error.message);

  await supabase.from("opportunities").update({ submission_method: method }).eq("id", opportunityId);

  revalidatePath(`${workspacePath(opportunityId)}/submission`);
}

/**
 * Records that a human submitted this response. It does not submit anything.
 *
 * Three gates, all server-side, in this order:
 *  1. readiness is recomputed from the stored checklist and approval layers — the client cannot
 *     assert it;
 *  2. required checklist items and enabled approval layers must be settled;
 *  3. the operator must have explicitly authorized the record.
 *
 * `submitted_by` is always the calling user, never a form value, and the DB constraint
 * `submission_packets_submitted_requires_actor` rejects a timestamp with no actor.
 */
export async function markSubmissionSubmitted(opportunityId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  await requirePermission(supabase, userId, organizationId, "pursuit.submit");
  const { computeSubmissionReadiness, evaluateMarkSubmittedGate } = await import(
    "@/lib/opportunity/submission-readiness"
  );

  const [{ data: packet }, { data: checklist }, { data: approvals }] = await Promise.all([
    supabase
      .from("submission_packets")
      .select("submitted_at, submitted_by, confirmation_reference, submission_method, due_at")
      .eq("opportunity_id", opportunityId)
      .maybeSingle(),
    supabase
      .from("submission_checklist_items")
      .select("item_key, label, required, completed, notes")
      .eq("opportunity_id", opportunityId),
    supabase
      .from("pursuit_approval_layers")
      .select("layer_key, enabled, status, decided_at, notes")
      .eq("opportunity_id", opportunityId),
  ]);

  const readiness = computeSubmissionReadiness({
    checklist: checklist ?? [],
    approvals: (approvals ?? []) as Parameters<typeof computeSubmissionReadiness>[0]["approvals"],
    packet,
  });
  const gate = evaluateMarkSubmittedGate({
    readiness,
    humanAuthorized: String(formData.get("submission_authorized") ?? "") === "1",
  });
  if (!gate.allowed) throw new Error(gate.message);

  const submittedAt = String(formData.get("submitted_at") ?? "").trim() || new Date().toISOString();
  const { error } = await supabase.from("submission_packets").upsert(
    {
      organization_id: organizationId,
      opportunity_id: opportunityId,
      submitted_at: submittedAt,
      submitted_by: userId,
      confirmation_reference: String(formData.get("confirmation_reference") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id" },
  );
  if (error) throw new Error(error.message);

  await supabase.from("opportunities").update({ stage: "SUBMITTED" }).eq("id", opportunityId);

  // Freeze the latest non-submitted artifact as an immutable submitted snapshot (F8).
  const { data: latestArtifact } = await supabase
    .from("submission_artifacts")
    .select("id, immutable, approval_state")
    .eq("opportunity_id", opportunityId)
    .eq("organization_id", organizationId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestArtifact && !latestArtifact.immutable && latestArtifact.approval_state !== "SUBMITTED") {
    await supabase
      .from("submission_artifacts")
      .update({ approval_state: "SUBMITTED", immutable: true, updated_at: new Date().toISOString() })
      .eq("id", latestArtifact.id)
      .eq("organization_id", organizationId);
  }

  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "pursuit.submit",
    entityType: "submission_packet",
    entityId: opportunityId,
    metadata: { submitted_at: submittedAt },
  });

  revalidatePath(`${workspacePath(opportunityId)}/submission`);
  revalidatePath(workspacePath(opportunityId));
  revalidatePath("/procurement/opportunities/submitted");
}

/** Post-submission confirmation / reference capture. Does not change the submission record. */
export async function saveSubmissionConfirmation(opportunityId: string, formData: FormData) {
  const { supabase } = await requireUserOrg();
  const { data: packet } = await supabase
    .from("submission_packets")
    .select("id, submitted_at")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (!packet?.submitted_at) {
    throw new Error("Nothing is marked submitted on this pursuit yet.");
  }
  const { error } = await supabase
    .from("submission_packets")
    .update({
      confirmation_reference: String(formData.get("confirmation_reference") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", packet.id);
  if (error) throw new Error(error.message);
  revalidatePath(`${workspacePath(opportunityId)}/submission`);
}

export async function ensureSubmissionChecklist(opportunityId: string) {
  const { supabase, organizationId } = await requireUserOrg();
  const { DEFAULT_SUBMISSION_CHECKLIST } = await import("@/lib/opportunity/response");
  const rows = DEFAULT_SUBMISSION_CHECKLIST.map((item) => ({
    organization_id: organizationId,
    opportunity_id: opportunityId,
    item_key: item.item_key,
    label: item.label,
    sort_order: item.sort_order,
    required: true,
    completed: false,
  }));
  const { error } = await supabase.from("submission_checklist_items").upsert(rows, {
    onConflict: "organization_id,opportunity_id,item_key",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`${workspacePath(opportunityId)}/submission`);
}

export async function toggleChecklistItem(opportunityId: string, formData: FormData) {
  const { supabase } = await requireUserOrg();
  const id = String(formData.get("item_id") ?? "").trim();
  const completed = String(formData.get("completed") ?? "") === "1";
  if (!id) throw new Error("Item required.");
  const { error } = await supabase
    .from("submission_checklist_items")
    .update({ completed, notes: String(formData.get("notes") ?? "").trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`${workspacePath(opportunityId)}/submission`);
}

export async function savePursuitResult(opportunityId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  await requirePermission(supabase, userId, organizationId, "result.write");
  const outcome = String(formData.get("outcome") ?? "PENDING").trim() as
    | "PENDING"
    | "WON"
    | "LOST"
    | "NO_BID"
    | "CANCELLED"
    | "NO_AWARD";

  const { error } = await supabase.from("win_loss_reviews").upsert(
    {
      organization_id: organizationId,
      opportunity_id: opportunityId,
      outcome,
      winner_name: String(formData.get("winner_name") ?? "").trim() || null,
      lp_price: parseOptionalNum(String(formData.get("lp_price") ?? "")),
      winning_price: parseOptionalNum(String(formData.get("winning_price") ?? "")),
      lp_score: parseOptionalNum(String(formData.get("lp_score") ?? "")),
      winning_score: parseOptionalNum(String(formData.get("winning_score") ?? "")),
      rank: parseOptionalInt(String(formData.get("rank") ?? "")),
      documented_reason: String(formData.get("documented_reason") ?? "").trim() || null,
      internal_analysis: String(formData.get("internal_analysis") ?? "").trim() || null,
      lessons_learned: String(formData.get("lessons_learned") ?? "").trim() || null,
      evaluator_comments: String(formData.get("evaluator_comments") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id" },
  );
  if (error) throw new Error(error.message);

  if (outcome === "WON" || outcome === "LOST" || outcome === "NO_BID" || outcome === "CANCELLED" || outcome === "NO_AWARD") {
    await supabase
      .from("opportunities")
      .update({ stage: outcome === "WON" ? "AWARDED" : "CLOSED" })
      .eq("id", opportunityId);
  }

  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "result.write",
    entityType: "win_loss_review",
    entityId: opportunityId,
    metadata: { outcome },
  });

  revalidatePath(`${workspacePath(opportunityId)}/result`);
  revalidatePath("/intelligence/win-loss");
  revalidatePath("/intelligence/clients");
  revalidatePath("/intelligence/competitors");
  revalidatePath("/intelligence/pricing");
}

/**
 * Contract handoff from a won pursuit. Idempotent: an existing contract is opened, never duplicated.
 *
 * A contract row is a canonical portfolio claim, so it must cite a HUMAN_VERIFIED award-shaped fact
 * on this pursuit. A WON outcome is not evidence. The DB trigger `contracts_require_verified_fact`
 * is the final enforcement; `evaluateContractHandoffGate` supplies the operator-facing reason so the
 * Result panel and this action explain the block in the same words.
 */
export async function createContractFromWin(opportunityId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  await requirePermission(supabase, userId, organizationId, "contract.create");
  const { evaluateContractHandoffGate, isAwardishFact } = await import(
    "@/lib/opportunity/submission-readiness"
  );
  const title = String(formData.get("title") ?? "").trim();

  const { data: existing } = await supabase
    .from("contracts")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (existing) {
    // Idempotent open. Not an error: two operators clicking the same CTA get the same contract.
    revalidatePath(`${workspacePath(opportunityId)}/result`);
    revalidatePath(`/contracts/${existing.id}`);
    return existing.id;
  }

  const { data: opp } = await supabase
    .from("opportunities")
    .select("client_id, title")
    .eq("id", opportunityId)
    .maybeSingle();

  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("opportunity_id", opportunityId);
  const docIds = (docs ?? []).map((d) => d.id);

  const { data: verifiedFacts } = docIds.length
    ? await supabase
        .from("extracted_facts")
        .select("id, document_id, field, entity, verified_value, normalized_value, raw_value")
        .eq("organization_id", organizationId)
        .eq("verification_status", "HUMAN_VERIFIED")
        .in("document_id", docIds)
        .order("verified_at", { ascending: false })
        .limit(40)
    : { data: [] as never[] };

  const { data: review } = await supabase
    .from("win_loss_reviews")
    .select("outcome")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  const awardish = (verifiedFacts ?? []).filter(isAwardishFact);
  const gate = evaluateContractHandoffGate({
    title,
    pursuitDocumentCount: docIds.length,
    verifiedAwardishFactCount: awardish.length,
    outcome: review?.outcome ?? null,
  });
  if (!gate.allowed) throw new Error(gate.message);

  const verifiedFact = awardish[0];
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      organization_id: organizationId,
      opportunity_id: opportunityId,
      client_id: opp?.client_id ?? null,
      title,
      contract_number: String(formData.get("contract_number") ?? "").trim() || null,
      source_fact_id: verifiedFact.id,
      source_document_id: verifiedFact.document_id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // The outcome is already WON — the gate above required it. This action never records an outcome.
  await supabase.from("opportunities").update({ stage: "AWARDED" }).eq("id", opportunityId);

  // Link the award instrument itself when the same verified fact can back it. Amounts, winner and
  // rank stay null: `awards.amount_nte` is only ever promoted from a fact that states an amount.
  const { data: existingAward } = await supabase
    .from("awards")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (!existingAward) {
    const noticeSource =
      verifiedFact.verified_value ?? verifiedFact.normalized_value ?? verifiedFact.raw_value ?? null;
    await supabase.from("awards").insert({
      organization_id: organizationId,
      opportunity_id: opportunityId,
      source_fact_id: verifiedFact.id,
      source_document_id: verifiedFact.document_id,
      notice: noticeSource ? String(noticeSource).slice(0, 300) : null,
    });
  }

  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "contract.create",
    entityType: "contract",
    entityId: data.id,
    metadata: { opportunity_id: opportunityId, source_fact_id: verifiedFact.id },
  });

  revalidatePath(`${workspacePath(opportunityId)}/result`);
  revalidatePath(`/contracts/${data.id}`);
  revalidatePath("/contracts");
  return data.id;
}

// ---------------------------------------------------------------------------
// F8 — working proposal assembly / DOCX / portal / Google Docs
// ---------------------------------------------------------------------------

async function loadAssemblySource(opportunityId: string, organizationId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: sols } = await supabase.from("solicitations").select("id").eq("opportunity_id", opportunityId);
  const solIds = (sols ?? []).map((s) => s.id);

  const [
    { data: requirements },
    { data: responses },
    { data: documents },
    { data: opportunity },
    { data: packet },
  ] = await Promise.all([
    solIds.length
      ? supabase.from("requirements").select("id, statement, section_ref").in("solicitation_id", solIds)
      : Promise.resolve({ data: [] as { id: string; statement: string; section_ref: string | null }[] }),
    supabase
      .from("requirement_responses")
      .select("requirement_id, draft_html, draft_status")
      .eq("opportunity_id", opportunityId),
    supabase
      .from("documents")
      .select("id, original_filename, document_type")
      .eq("opportunity_id", opportunityId),
    supabase
      .from("opportunities")
      .select("id, title, response_due_on, service_type, clients(name)")
      .eq("id", opportunityId)
      .maybeSingle(),
    supabase
      .from("submission_packets")
      .select("id, google_docs_url")
      .eq("opportunity_id", opportunityId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const client = opportunity
    ? Array.isArray(opportunity.clients)
      ? opportunity.clients[0]
      : opportunity.clients
    : null;

  const buyerName =
    client && typeof client === "object" && client && "name" in client
      ? String((client as { name?: string | null }).name ?? "")
      : null;

  return {
    requirements: (requirements ?? []).map((r) => ({
      id: r.id,
      statement: r.statement,
      section_ref: r.section_ref ?? null,
    })),
    responses: (responses ?? []).map((r) => ({
      requirement_id: r.requirement_id,
      draft_html: r.draft_html ?? "",
      draft_status: r.draft_status,
    })),
    attachments: (documents ?? []).map((d) => ({
      id: d.id,
      filename: d.original_filename,
      document_type: d.document_type,
    })),
    cover: {
      title: opportunity?.title?.trim() || (buyerName ? `${buyerName} — Working proposal` : "Working proposal"),
      buyerName,
      solicitationRef: opportunity?.service_type ?? null,
      dueOn: opportunity?.response_due_on ?? null,
    },
    pricingHref: `${workspacePath(opportunityId)}/pricing`,
    packetId: packet?.id ?? null,
    googleDocsUrl: packet?.google_docs_url ?? null,
  };
}

export type GenerateWorkingProposalResult = {
  artifactId: string;
  version: number;
  contentHash: string;
  approvedCount: number;
  excludedDraftOnly: number;
  googleDocsConfigured: boolean;
  googleDocUrl: string | null;
  googleBlocker: string | null;
};

/** Assemble APPROVED responses into a versioned submission_artifacts row. */
export async function generateWorkingProposalArtifact(
  opportunityId: string,
  opts?: { syncGoogleDoc?: boolean; forceNewGoogleDoc?: boolean },
): Promise<GenerateWorkingProposalResult> {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const { buildWorkingProposal, computeNextVersion } = await import(
    "@/lib/opportunity/generate-working-proposal"
  );
  const { getGoogleDocsProvider, workingDocIdempotencyKey } = await import("@/lib/google/google-docs");

  const source = await loadAssemblySource(opportunityId, organizationId, supabase);
  const { assembled, portal } = buildWorkingProposal(source);

  if (assembled.sources.requirementIds.length === 0) {
    throw new Error(
      "No APPROVED requirement responses to assemble. Approve responses on the Response tab first.",
    );
  }

  const { data: existingVersions } = await supabase
    .from("submission_artifacts")
    .select("version")
    .eq("opportunity_id", opportunityId)
    .eq("organization_id", organizationId);
  const version = computeNextVersion(existingVersions ?? []);

  let googleDocId: string | null = null;
  let googleDocUrl: string | null = source.googleDocsUrl;
  let googleSync: Record<string, unknown> = {};
  let googleBlocker: string | null = null;
  const provider = getGoogleDocsProvider();
  const googleDocsConfigured = provider.isConfigured();

  if (opts?.syncGoogleDoc) {
    if (!googleDocsConfigured) {
      googleBlocker =
        "Google Docs create/sync blocked: set GOOGLE_DRIVE_ACCESS_TOKEN or GOOGLE_DOCS_ACCESS_TOKEN on the server.";
    } else {
      // Prefer existing doc id from latest artifact when not forcing new.
      let existingDocId: string | null = null;
      if (!opts.forceNewGoogleDoc) {
        const { data: prior } = await supabase
          .from("submission_artifacts")
          .select("google_doc_id")
          .eq("opportunity_id", opportunityId)
          .eq("organization_id", organizationId)
          .not("google_doc_id", "is", null)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        existingDocId = prior?.google_doc_id ?? null;
      }
      const result = await provider.createOrUpdateWorkingDoc({
        title: assembled.title,
        content: assembled.plainDocument,
        idempotencyKey: workingDocIdempotencyKey({
          organizationId,
          opportunityId,
          contentHash: assembled.contentHash,
          forceNew: opts.forceNewGoogleDoc,
        }),
        existingDocId,
        forceNew: opts.forceNewGoogleDoc,
      });
      if (result.ok) {
        googleDocId = result.documentId;
        googleDocUrl = result.documentUrl;
        googleSync = result.sync as unknown as Record<string, unknown>;
        await supabase
          .from("submission_packets")
          .upsert(
            {
              organization_id: organizationId,
              opportunity_id: opportunityId,
              google_docs_url: result.documentUrl,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,opportunity_id" },
          );
      } else {
        googleBlocker = result.message;
      }
    }
  }

  const { data: inserted, error } = await supabase
    .from("submission_artifacts")
    .insert({
      organization_id: organizationId,
      opportunity_id: opportunityId,
      packet_id: source.packetId,
      version,
      generator: "proposal-assembly",
      approval_state: "WORKING",
      content_hash: assembled.contentHash,
      sources: assembled.sources,
      google_doc_id: googleDocId,
      google_doc_url: googleDocUrl,
      google_sync: googleSync,
      portal_json: JSON.parse(portal.json) as Record<string, unknown>,
      html_snapshot: assembled.htmlDocument,
      immutable: false,
      created_by: userId,
    })
    .select("id, version")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`${workspacePath(opportunityId)}/submission`);
  return {
    artifactId: inserted.id,
    version: inserted.version,
    contentHash: assembled.contentHash,
    approvedCount: assembled.sources.requirementIds.length,
    excludedDraftOnly: assembled.sources.excludedDraftOnly,
    googleDocsConfigured,
    googleDocUrl,
    googleBlocker,
  };
}

/** Sync / create Google Doc for the latest (or newly generated) working proposal. */
export async function syncWorkingProposalGoogleDoc(
  opportunityId: string,
  formData?: FormData,
): Promise<GenerateWorkingProposalResult> {
  const forceNew = String(formData?.get("force_new") ?? "") === "1";
  return generateWorkingProposalArtifact(opportunityId, {
    syncGoogleDoc: true,
    forceNewGoogleDoc: forceNew,
  });
}

/** Return native DOCX bytes (base64) for the current APPROVED assembly. */
export async function downloadWorkingProposalDocx(opportunityId: string): Promise<{
  filename: string;
  base64: string;
  contentHash: string;
  isOoxml: boolean;
}> {
  const { supabase, organizationId } = await requireUserOrg();
  const { buildWorkingProposal } = await import("@/lib/opportunity/generate-working-proposal");
  const { buildProposalDocx, isOoxmlZip } = await import("@/lib/export/docx");

  const source = await loadAssemblySource(opportunityId, organizationId, supabase);
  const { assembled } = buildWorkingProposal(source);
  if (assembled.sources.requirementIds.length === 0) {
    throw new Error("No APPROVED requirement responses to export as DOCX.");
  }
  const bytes = await buildProposalDocx(assembled);
  const base64 = Buffer.from(bytes).toString("base64");
  return {
    filename: `pursuit-${opportunityId}-proposal-v.docx`,
    base64,
    contentHash: assembled.contentHash,
    isOoxml: isOoxmlZip(bytes),
  };
}

/** Portal answers CSV + JSON for APPROVED responses. */
export async function downloadPortalAnswers(opportunityId: string): Promise<{
  csv: string;
  json: string;
  count: number;
}> {
  const { supabase, organizationId } = await requireUserOrg();
  const { buildWorkingProposal } = await import("@/lib/opportunity/generate-working-proposal");
  const source = await loadAssemblySource(opportunityId, organizationId, supabase);
  const { portal } = buildWorkingProposal(source);
  if (portal.rows.length === 0) {
    throw new Error("No APPROVED answers for portal export.");
  }
  return { csv: portal.csv, json: portal.json, count: portal.rows.length };
}

/** Assembled HTML for print / HTML download (APPROVED only). */
export async function downloadWorkingProposalHtml(opportunityId: string): Promise<{
  html: string;
  contentHash: string;
}> {
  const { supabase, organizationId } = await requireUserOrg();
  const { buildWorkingProposal } = await import("@/lib/opportunity/generate-working-proposal");
  const source = await loadAssemblySource(opportunityId, organizationId, supabase);
  const { assembled } = buildWorkingProposal(source);
  if (assembled.sources.requirementIds.length === 0) {
    throw new Error("No APPROVED requirement responses to export as HTML.");
  }
  return { html: assembled.htmlDocument, contentHash: assembled.contentHash };
}

export async function getGoogleDocsConfigStatus(): Promise<{ configured: boolean }> {
  const { resolveGoogleDocsAccessToken } = await import("@/lib/google/google-docs");
  return { configured: Boolean(resolveGoogleDocsAccessToken()) };
}
