"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/auth/audit";
import { evaluateApplyGate } from "@/lib/solicitation/apply-change";

export type ChangeItemActionResult = { error?: string; ok?: true; message?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be signed in.");
  return { supabase, user };
}

async function loadChangeItem(itemId: string) {
  const { supabase, user } = await requireUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("solicitation_change_items")
    .select(
      "id, organization_id, change_run_id, change_type, verification_status, ambiguity_reason, applied_at, after_text, after_json, target_id, impact_flags",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Change item not found.");
  await requirePermission(supabase, user.id, data.organization_id, "verify.promote");
  return { supabase, user, item: data, db };
}

export async function verifySolicitationChangeItem(
  itemId: string,
  note?: string | null,
): Promise<ChangeItemActionResult> {
  try {
    const { supabase, user, item, db } = await loadChangeItem(itemId);
    if (item.verification_status === "REJECTED") {
      return { error: "Rejected items cannot be verified." };
    }
    if (item.ambiguity_reason) {
      // Allow human to clear conflict by verifying explicitly — still not auto-apply
    }
    const { error } = await db
      .from("solicitation_change_items")
      .update({
        verification_status: "HUMAN_VERIFIED",
        ambiguity_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) return { error: error.message };

    await writeAuditLog(supabase, {
      organizationId: item.organization_id,
      actorUserId: user.id,
      action: "solicitation_change_item.verify",
      entityType: "solicitation_change_items",
      entityId: item.id,
      metadata: { note: note ?? null, change_type: item.change_type },
    });

    revalidatePath("/procurement/opportunities");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Verify failed." };
  }
}

export async function rejectSolicitationChangeItem(
  itemId: string,
  reason?: string | null,
): Promise<ChangeItemActionResult> {
  try {
    const { supabase, user, item, db } = await loadChangeItem(itemId);
    const { error } = await db
      .from("solicitation_change_items")
      .update({
        verification_status: "REJECTED",
        rejection_reason: reason ?? "Rejected by verifier",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) return { error: error.message };

    await writeAuditLog(supabase, {
      organizationId: item.organization_id,
      actorUserId: user.id,
      action: "solicitation_change_item.reject",
      entityType: "solicitation_change_items",
      entityId: item.id,
      metadata: { reason: reason ?? null },
    });

    revalidatePath("/procurement/opportunities");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Reject failed." };
  }
}

export async function applySolicitationChangeItem(
  itemId: string,
): Promise<ChangeItemActionResult> {
  try {
    const { supabase, user, item } = await loadChangeItem(itemId);
    const gate = evaluateApplyGate(item);
    if (!gate.ok) return { error: gate.reason };

    const { data, error } = await supabase.rpc(
      "apply_solicitation_change_item" as never,
      {
        p_item_id: itemId,
        p_actor_id: user.id,
      } as never,
    );

    if (error) return { error: error.message };
    const result = data as { ok?: boolean; message?: string; action?: string } | null;
    if (result && result.ok === false) {
      return { error: result.message ?? "Apply refused." };
    }

    await writeAuditLog(supabase, {
      organizationId: item.organization_id,
      actorUserId: user.id,
      action: "solicitation_change_item.apply",
      entityType: "solicitation_change_items",
      entityId: item.id,
      metadata: {
        change_type: item.change_type,
        note: "Stale flags only — never HUMAN_APPROVED / draft APPROVED",
      },
    });

    revalidatePath("/procurement/opportunities");
    return { ok: true, message: result?.action ?? "applied" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Apply failed." };
  }
}

/** Form-action wrappers — ignore FormData so bind never passes it as note/reason. */
export async function verifyChangeItemForm(itemId: string) {
  await verifySolicitationChangeItem(itemId);
}

export async function rejectChangeItemForm(itemId: string) {
  await rejectSolicitationChangeItem(itemId, "Rejected from impact strip");
}

export async function applyChangeItemForm(itemId: string) {
  await applySolicitationChangeItem(itemId);
}
