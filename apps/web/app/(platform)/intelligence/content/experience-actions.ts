"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { evaluateHumanVerifyGate } from "@/lib/experience/promote";
import { hasExperienceSource } from "@/lib/experience/types";

export type ExperienceActionResult = { error?: string; ok?: true; experience_record_id?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be signed in.");
  return { supabase, user };
}

/** Mark experience_records HUMAN_VERIFIED — verify.promote only. AI cannot. */
export async function markExperienceHumanVerified(
  experienceId: string,
): Promise<ExperienceActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: row, error } = await supabase
      .from("experience_records")
      .select(
        "id, organization_id, experience_type, verification_status, source_document_id, source_document_version_id, source_fact_id, source_url, contract_id",
      )
      .eq("id", experienceId)
      .maybeSingle();
    if (error || !row) return { error: error?.message ?? "Experience record not found." };

    await requirePermission(supabase, user.id, row.organization_id, "verify.promote");

    const gate = evaluateHumanVerifyGate({
      verificationStatus: row.verification_status,
      verifiedBy: user.id,
      hasSource: hasExperienceSource(row),
      experienceType: row.experience_type,
    });
    if (!gate.ok) return { error: gate.reason };

    const { error: updErr } = await supabase
      .from("experience_records")
      .update({
        verification_status: gate.verification_status,
        verified_by: gate.verified_by,
        verified_at: gate.verified_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", experienceId)
      .eq("organization_id", row.organization_id);
    if (updErr) return { error: updErr.message };

    revalidatePath("/intelligence/content");
    return { ok: true, experience_record_id: experienceId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Promote L&P-held contract → L_AND_P_CORPORATE (AI_EXTRACTED). Rejects Class C. */
export async function promoteExperienceFromContract(
  contractId: string,
): Promise<ExperienceActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: contract, error } = await supabase
      .from("contracts")
      .select("id, organization_id")
      .eq("id", contractId)
      .maybeSingle();
    if (error || !contract) return { error: error?.message ?? "Contract not found." };

    await requirePermission(supabase, user.id, contract.organization_id, "verify.promote");

    const { data, error: rpcErr } = await supabase.rpc("promote_experience_from_contract", {
      p_contract_id: contractId,
    });
    if (rpcErr) return { error: rpcErr.message };

    const payload = data as { ok?: boolean; message?: string; experience_record_id?: string } | null;
    if (!payload?.ok) {
      return { error: payload?.message ?? "Promote refused." };
    }

    revalidatePath("/intelligence/content");
    revalidatePath("/contracts");
    return { ok: true, experience_record_id: payload.experience_record_id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
