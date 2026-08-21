"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { evaluateHumanVerifyGate } from "@/lib/compliance/promote";
import { hasComplianceSource } from "@/lib/compliance/types";
import { buildMatchRowFromRules } from "@/lib/compliance/promote";
import type { CoverageLimits } from "@/lib/compliance/types";

export type ComplianceActionResult = { error?: string; ok?: true };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be signed in.");
  return { supabase, user };
}

/** Mark a compliance_items row HUMAN_VERIFIED — verify.promote only. */
export async function markComplianceItemHumanVerified(
  itemId: string,
): Promise<ComplianceActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: row, error } = await supabase
      .from("compliance_items")
      .select(
        "id, organization_id, verification_status, source_document_id, source_document_version_id, source_fact_id, source_url",
      )
      .eq("id", itemId)
      .maybeSingle();
    if (error || !row) return { error: error?.message ?? "Compliance item not found." };

    await requirePermission(supabase, user.id, row.organization_id, "verify.promote");

    const gate = evaluateHumanVerifyGate({
      verificationStatus: row.verification_status,
      verifiedBy: user.id,
      hasSource: hasComplianceSource(row),
    });
    if (!gate.ok) return { error: gate.reason };

    const { error: updErr } = await supabase
      .from("compliance_items")
      .update({
        verification_status: gate.verification_status,
        verified_by: gate.verified_by,
        verified_at: gate.verified_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("organization_id", row.organization_id);
    if (updErr) return { error: updErr.message };

    revalidatePath("/contracts/compliance");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Mark organization_registrations HUMAN_VERIFIED — verify.promote only. */
export async function markRegistrationHumanVerified(
  registrationId: string,
): Promise<ComplianceActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: row, error } = await supabase
      .from("organization_registrations")
      .select(
        "id, organization_id, verification_status, source_document_id, source_document_version_id, source_fact_id, source_url",
      )
      .eq("id", registrationId)
      .maybeSingle();
    if (error || !row) return { error: error?.message ?? "Registration not found." };

    await requirePermission(supabase, user.id, row.organization_id, "verify.promote");

    const gate = evaluateHumanVerifyGate({
      verificationStatus: row.verification_status,
      verifiedBy: user.id,
      hasSource: hasComplianceSource(row),
    });
    if (!gate.ok) return { error: gate.reason };

    const { error: updErr } = await supabase
      .from("organization_registrations")
      .update({
        verification_status: gate.verification_status,
        verified_by: gate.verified_by,
        verified_at: gate.verified_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", registrationId)
      .eq("organization_id", row.organization_id);
    if (updErr) return { error: updErr.message };

    revalidatePath("/contracts/compliance");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Persist a deterministic match row (never invents VERIFIED_AVAILABLE without gates). */
export async function upsertRequirementComplianceMatch(input: {
  organizationId: string;
  requirementId: string;
  opportunityId?: string | null;
  complianceItemId?: string | null;
  organizationRegistrationId?: string | null;
  requiredCoverage?: CoverageLimits | null;
  requiredNaics?: string[] | null;
  notApplicable?: boolean;
}): Promise<ComplianceActionResult> {
  try {
    const { supabase, user } = await requireUser();
    await requirePermission(supabase, user.id, input.organizationId, "verify.promote");

    let inventory = null;
    if (input.complianceItemId) {
      const { data } = await supabase
        .from("compliance_items")
        .select(
          "id, organization_id, kind, statement, expires_on, verification_status, coverage_json, source_document_id, source_document_version_id, source_fact_id, source_url",
        )
        .eq("id", input.complianceItemId)
        .eq("organization_id", input.organizationId)
        .maybeSingle();
      inventory = data;
    }

    let registration = null;
    if (input.organizationRegistrationId) {
      const { data } = await supabase
        .from("organization_registrations")
        .select(
          "id, organization_id, uei, cage, sam_status, sam_expiration_on, naics, psc, verification_status, source_document_id, source_document_version_id, source_fact_id, source_url",
        )
        .eq("id", input.organizationRegistrationId)
        .eq("organization_id", input.organizationId)
        .maybeSingle();
      registration = data
        ? {
            ...data,
            naics: Array.isArray(data.naics) ? data.naics : [],
            psc: Array.isArray(data.psc) ? data.psc : [],
          }
        : null;
    }

    const row = buildMatchRowFromRules({
      requirementId: input.requirementId,
      opportunityId: input.opportunityId,
      inventory,
      registration,
      requiredCoverage: input.requiredCoverage,
      requiredNaics: input.requiredNaics,
      today: new Date().toISOString().slice(0, 10),
      notApplicable: input.notApplicable,
    });

    const { error } = await supabase.from("requirement_compliance_matches").insert({
      organization_id: input.organizationId,
      requirement_id: row.requirement_id,
      opportunity_id: row.opportunity_id,
      compliance_item_id: row.compliance_item_id,
      organization_registration_id: row.organization_registration_id,
      match_status: row.match_status,
      rationale: row.rationale,
      evidence_links: [],
      required_coverage_json: input.requiredCoverage ?? null,
      created_by: user.id,
    });
    if (error) return { error: error.message };

    if (input.opportunityId) {
      revalidatePath(`/procurement/opportunities/${input.opportunityId}`);
    }
    revalidatePath("/contracts/compliance");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
