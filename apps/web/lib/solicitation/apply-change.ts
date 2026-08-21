/**
 * F11 apply layer — verified apply + stale flags + deadline writes.
 * Never sets HUMAN_APPROVED or draft APPROVED. F9-compatible deadline rekey notes.
 */

import { shouldRekeyOnDeadlineChange, deadlineDedupeKey } from "@/lib/automation/resolve-policy";
import type { SolicitationChangeType } from "./change-types";

export type ApplyChangeItemInput = {
  id: string;
  change_type: SolicitationChangeType | string;
  verification_status: string;
  ambiguity_reason?: string | null;
  applied_at?: string | null;
  after_text?: string | null;
  after_json?: Record<string, unknown> | null;
  target_id?: string | null;
  impact_flags?: Record<string, unknown> | null;
};

export type ApplyGateResult =
  | { ok: true; action: "apply" }
  | { ok: false; action: "refused" | "noop"; reason: string };

/**
 * Pure gate — mirrors SQL apply_solicitation_change_item refuse rules.
 */
export function evaluateApplyGate(item: ApplyChangeItemInput): ApplyGateResult {
  if (item.applied_at) {
    return { ok: false, action: "noop", reason: "Already applied." };
  }
  if (item.verification_status !== "HUMAN_VERIFIED") {
    return {
      ok: false,
      action: "refused",
      reason:
        "Apply requires HUMAN_VERIFIED. AI_EXTRACTED / NEEDS_REVIEW / CONFLICT never apply.",
    };
  }
  if (item.ambiguity_reason && item.ambiguity_reason.trim()) {
    return {
      ok: false,
      action: "refused",
      reason: "Ambiguous/conflict items are never auto-applied.",
    };
  }
  return { ok: true, action: "apply" };
}

/**
 * Stale flag payload for responses/pricing — never clears APPROVED text or HUMAN_APPROVED status.
 */
export function buildStaleReason(changeType: string, itemId: string): string {
  return `Stale after solicitation change ${changeType} (${itemId}). Re-review required — text/price not cleared.`;
}

export type DeadlineApplyPlan = {
  dueOn: string | null;
  opportunityPatch: { response_due_on: string } | null;
  packetPatch: { due_at: string } | null;
  automationNote: {
    pursuitDeadlineKey: string;
    submissionDeadlineKey: string;
    rekey: false;
    updateDueOn: boolean;
    previousDueOn: string | null;
    nextDueOn: string | null;
  };
};

/**
 * Plan deadline writes + F9 rekey policy: same dedupe_key, update due_on in place.
 */
export function planDeadlineApply(input: {
  opportunityId: string;
  previousDueOn: string | null;
  afterJson: Record<string, unknown> | null | undefined;
  afterText: string | null | undefined;
}): DeadlineApplyPlan {
  const dueOn =
    (typeof input.afterJson?.due_on === "string" ? input.afterJson.due_on : null) ??
    (input.afterText?.trim() || null);

  const rekeyDecision = shouldRekeyOnDeadlineChange(input.previousDueOn, dueOn);

  return {
    dueOn,
    opportunityPatch: dueOn ? { response_due_on: dueOn } : null,
    packetPatch: dueOn ? { due_at: `${dueOn}T17:00:00.000Z` } : null,
    automationNote: {
      pursuitDeadlineKey: deadlineDedupeKey("pursuit_deadline", input.opportunityId),
      submissionDeadlineKey: deadlineDedupeKey("submission_deadline", input.opportunityId),
      rekey: false,
      updateDueOn: rekeyDecision.updateDueOn,
      previousDueOn: input.previousDueOn,
      nextDueOn: dueOn,
    },
  };
}

/** Grep-friendly constants: apply paths must never set these. */
export const APPLY_FORBIDDEN_WRITES = [
  "HUMAN_APPROVED pricing status",
  "draft APPROVED status",
] as const;

export function assertApplyDoesNotApprove(source: string): boolean {
  // Soft check for unit tests — production enforcement is SQL + actions.
  return (
    !/status\s*[:=]\s*['"]HUMAN_APPROVED['"]/.test(source) &&
    !/draft_status\s*[:=]\s*['"]APPROVED['"]/.test(source)
  );
}
