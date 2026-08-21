/**
 * F15 — Promote / verify / complete / waive gates (pure).
 * AI cannot set HUMAN_VERIFIED or COMPLETED.
 */

import { hasObligationSource, type ObligationVerificationStatus } from "./types";
import { advanceNextDueOn, deriveObligationStatus, normalizeRecurrenceRule } from "./status";

export type PromoteGate =
  | { ok: true; verification_status: "HUMAN_VERIFIED"; verified_by: string; verified_at: string }
  | { ok: false; reason: string };

export function evaluateHumanVerifyGate(input: {
  verificationStatus: ObligationVerificationStatus | string;
  verifiedBy: string | null | undefined;
  hasSource: boolean;
  verifiedAt?: string | null;
}): PromoteGate {
  if (!input.verifiedBy) {
    return { ok: false, reason: "HUMAN_VERIFIED requires verified_by (verify.promote actor)." };
  }
  if (input.verificationStatus === "REJECTED") {
    return { ok: false, reason: "Rejected obligations cannot be marked HUMAN_VERIFIED." };
  }
  if (!input.hasSource) {
    return {
      ok: false,
      reason: "HUMAN_VERIFIED requires source evidence (clause, document, or fact).",
    };
  }
  return {
    ok: true,
    verification_status: "HUMAN_VERIFIED",
    verified_by: input.verifiedBy,
    verified_at: input.verifiedAt ?? new Date().toISOString(),
  };
}

/** AI extract / promote candidate — always AI_EXTRACTED. */
export function buildAiExtractedObligationPatch(): {
  verification_status: "AI_EXTRACTED";
  verified_by: null;
  verified_at: null;
  status: "NOT_STARTED";
  completed_at: null;
  completed_by: null;
} {
  return {
    verification_status: "AI_EXTRACTED",
    verified_by: null,
    verified_at: null,
    status: "NOT_STARTED",
    completed_at: null,
    completed_by: null,
  };
}

export function assertAiCannotMarkVerified(status: string): void {
  if (status === "HUMAN_VERIFIED") {
    throw new Error("AI/extraction cannot set HUMAN_VERIFIED on contract obligations.");
  }
}

export function assertAiCannotComplete(status: string): void {
  if (status === "COMPLETED") {
    throw new Error("AI/extraction cannot auto-complete contract obligations.");
  }
}

export type CompleteGate =
  | {
      ok: true;
      action: "completed" | "recurring_advanced";
      status: string;
      next_due_on: string | null;
      completed_by: string;
      completion_evidence_document_id: string;
    }
  | { ok: false; reason: string };

export function evaluateCompleteGate(input: {
  verificationStatus: string;
  status: string;
  recurrenceRule: string | null | undefined;
  dueOn: string | null | undefined;
  nextDueOn: string | null | undefined;
  evidenceDocumentId: string | null | undefined;
  actorId: string | null | undefined;
  today: string;
}): CompleteGate {
  if (!input.actorId) {
    return { ok: false, reason: "Completion requires a human actor (completed_by)." };
  }
  if (!input.evidenceDocumentId) {
    return { ok: false, reason: "Completion requires completion_evidence_document_id." };
  }
  if (input.verificationStatus !== "HUMAN_VERIFIED") {
    return { ok: false, reason: "Only HUMAN_VERIFIED obligations may be completed." };
  }
  if (input.status === "WAIVED" || input.status === "SUPERSEDED") {
    return { ok: false, reason: "Cannot complete a waived or superseded obligation." };
  }

  const rule = normalizeRecurrenceRule(input.recurrenceRule);
  if (rule) {
    const from = input.nextDueOn ?? input.dueOn ?? input.today;
    const next = advanceNextDueOn(input.recurrenceRule, from);
    if (!next) {
      return { ok: false, reason: "Unknown recurrence_rule; cannot advance next_due_on." };
    }
    const status = deriveObligationStatus({
      status: "NOT_STARTED",
      dueOn: input.dueOn,
      nextDueOn: next,
      today: input.today,
    });
    return {
      ok: true,
      action: "recurring_advanced",
      status,
      next_due_on: next,
      completed_by: input.actorId,
      completion_evidence_document_id: input.evidenceDocumentId,
    };
  }

  return {
    ok: true,
    action: "completed",
    status: "COMPLETED",
    next_due_on: input.nextDueOn ?? null,
    completed_by: input.actorId,
    completion_evidence_document_id: input.evidenceDocumentId,
  };
}

export type WaiveGate =
  | { ok: true; status: "WAIVED"; waive_reason: string }
  | { ok: false; reason: string };

export function evaluateWaiveGate(input: {
  status: string;
  waiveReason: string | null | undefined;
}): WaiveGate {
  if (input.status === "SUPERSEDED") {
    return { ok: false, reason: "Cannot waive a superseded obligation." };
  }
  const reason = input.waiveReason?.trim() ?? "";
  if (!reason) {
    return { ok: false, reason: "Waive reason required." };
  }
  return { ok: true, status: "WAIVED", waive_reason: reason };
}

export type PromoteCandidateInput = {
  contractId: string;
  title: string;
  obligationType?: string;
  sourceClauseRef?: string | null;
  sourceDocumentId?: string | null;
  sourceFactId?: string | null;
  dueOn?: string | null;
  recurrenceRule?: string | null;
};

export function evaluatePromoteCandidateGate(input: PromoteCandidateInput):
  | { ok: true; verification_status: "AI_EXTRACTED" }
  | { ok: false; reason: string } {
  if (!input.contractId) {
    return { ok: false, reason: "contract_id required." };
  }
  if (!input.title?.trim()) {
    return { ok: false, reason: "Title required." };
  }
  // Promote is always AI_EXTRACTED — never HUMAN_VERIFIED.
  return { ok: true, verification_status: "AI_EXTRACTED" };
}

export { hasObligationSource };
