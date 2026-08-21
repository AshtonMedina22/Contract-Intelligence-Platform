"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  evaluateCompleteGate,
  evaluateHumanVerifyGate,
  evaluateWaiveGate,
  hasObligationSource,
} from "@/lib/obligations/promote";

export type ObligationActionResult = { error?: string; ok?: true; message?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be signed in.");
  return { supabase, user };
}

function revalidateObligationPaths(contractId: string) {
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/obligations`);
}

/** Mark HUMAN_VERIFIED — verify.promote only. */
export async function verifyContractObligationAction(
  obligationId: string,
): Promise<ObligationActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: row, error } = await supabase
      .from("contract_obligations")
      .select(
        "id, organization_id, contract_id, verification_status, source_clause_ref, source_document_id, source_fact_id, status",
      )
      .eq("id", obligationId)
      .maybeSingle();
    if (error || !row) return { error: error?.message ?? "Obligation not found." };

    await requirePermission(supabase, user.id, row.organization_id, "verify.promote");

    const gate = evaluateHumanVerifyGate({
      verificationStatus: row.verification_status,
      verifiedBy: user.id,
      hasSource: hasObligationSource(row),
    });
    if (!gate.ok) return { error: gate.reason };

    const { data: rpc, error: rpcErr } = await supabase.rpc("verify_contract_obligation", {
      p_obligation_id: obligationId,
    });
    if (rpcErr) return { error: rpcErr.message };
    const result = rpc as { ok?: boolean; message?: string } | null;
    if (result && result.ok === false) return { error: result.message ?? "Verify failed." };

    revalidateObligationPaths(row.contract_id);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Complete with evidence — result.write (operational recording). */
export async function completeContractObligationAction(
  obligationId: string,
  evidenceDocumentId: string,
): Promise<ObligationActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: row, error } = await supabase
      .from("contract_obligations")
      .select(
        "id, organization_id, contract_id, verification_status, status, recurrence_rule, due_on, next_due_on",
      )
      .eq("id", obligationId)
      .maybeSingle();
    if (error || !row) return { error: error?.message ?? "Obligation not found." };

    await requirePermission(supabase, user.id, row.organization_id, "result.write");

    const today = new Date().toISOString().slice(0, 10);
    const gate = evaluateCompleteGate({
      verificationStatus: row.verification_status,
      status: row.status,
      recurrenceRule: row.recurrence_rule,
      dueOn: row.due_on,
      nextDueOn: row.next_due_on,
      evidenceDocumentId,
      actorId: user.id,
      today,
    });
    if (!gate.ok) return { error: gate.reason };

    const { data: rpc, error: rpcErr } = await supabase.rpc("complete_contract_obligation", {
      p_obligation_id: obligationId,
      p_evidence_document_id: evidenceDocumentId,
    });
    if (rpcErr) return { error: rpcErr.message };
    const result = rpc as { ok?: boolean; message?: string } | null;
    if (result && result.ok === false) return { error: result.message ?? "Complete failed." };

    revalidateObligationPaths(row.contract_id);
    return { ok: true, message: result?.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Waive with reason — result.write. */
export async function waiveContractObligationAction(
  obligationId: string,
  waiveReason: string,
): Promise<ObligationActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: row, error } = await supabase
      .from("contract_obligations")
      .select("id, organization_id, contract_id, status")
      .eq("id", obligationId)
      .maybeSingle();
    if (error || !row) return { error: error?.message ?? "Obligation not found." };

    await requirePermission(supabase, user.id, row.organization_id, "result.write");

    const gate = evaluateWaiveGate({ status: row.status, waiveReason });
    if (!gate.ok) return { error: gate.reason };

    const { data: rpc, error: rpcErr } = await supabase.rpc("waive_contract_obligation", {
      p_obligation_id: obligationId,
      p_waive_reason: gate.waive_reason,
    });
    if (rpcErr) return { error: rpcErr.message };
    const result = rpc as { ok?: boolean; message?: string } | null;
    if (result && result.ok === false) return { error: result.message ?? "Waive failed." };

    revalidateObligationPaths(row.contract_id);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
