/**
 * Pure reuse policy for proposal content.
 * Outcome never auto-sets reuse. Won ≠ APPROVED. Lost ≠ DO_NOT_USE.
 */

import type { RetrievalPurpose } from "@/lib/retrieval/purpose";
import { purposeAllowsDoNotUse, purposeRequiresDraftingGates } from "@/lib/retrieval/purpose";

export type ContentReuseStatus = "APPROVED" | "REVIEW_REQUIRED" | "DO_NOT_USE" | "SUPERSEDED";
export type ContentVerificationStatus =
  | "AI_EXTRACTED"
  | "NEEDS_REVIEW"
  | "HUMAN_VERIFIED"
  | "REJECTED";

export type OutcomeLabel = "WON" | "LOST" | "NO_BID" | "CANCELLED" | "NO_AWARD" | "PENDING" | string;

/** Outcome is display context only — never maps to reuse_status. */
export function reuseStatusFromOutcome(outcome: OutcomeLabel | null | undefined): null {
  void outcome;
  return null;
}

export function canApproveReuse(verificationStatus: ContentVerificationStatus): boolean {
  return verificationStatus === "HUMAN_VERIFIED";
}

export function defaultReuseAfterHumanVerify(): ContentReuseStatus {
  return "REVIEW_REQUIRED";
}

export function isDraftingEligible(opts: {
  verificationStatus: ContentVerificationStatus;
  reuseStatus: ContentReuseStatus | null | undefined;
  isCurrentVersion?: boolean;
}): boolean {
  if (opts.verificationStatus !== "HUMAN_VERIFIED") return false;
  if (opts.isCurrentVersion === false) return false;
  const reuse = opts.reuseStatus;
  if (!reuse) return false;
  if (reuse === "DO_NOT_USE" || reuse === "SUPERSEDED") return false;
  return reuse === "APPROVED" || reuse === "REVIEW_REQUIRED";
}

export function isEligibleForPurpose(
  purpose: RetrievalPurpose,
  opts: {
    verificationStatus: ContentVerificationStatus;
    reuseStatus: ContentReuseStatus | null | undefined;
    isCurrentVersion?: boolean;
  },
): boolean {
  if (opts.verificationStatus !== "HUMAN_VERIFIED") return false;

  if (purposeRequiresDraftingGates(purpose) || purpose === "PROPOSAL_DRAFTING") {
    return isDraftingEligible(opts);
  }

  if (purposeAllowsDoNotUse(purpose)) {
    // LOSS_ANALYSIS / LOCATE / COMPETITOR_ANALYSIS may include DO_NOT_USE; SUPERSEDED still excluded for prefer-current.
    if (opts.reuseStatus === "SUPERSEDED") return false;
    if (opts.isCurrentVersion === false) return false;
    return true;
  }

  // General / reports: drafting-like gates without inventing APPROVED.
  return isDraftingEligible(opts);
}

export function assertSameTenant(organizationIdA: string, organizationIdB: string): boolean {
  return Boolean(organizationIdA) && organizationIdA === organizationIdB;
}

export type SupersedeCheck = { ok: true } | { ok: false; reason: string };

export function canSupersede(opts: {
  oldOrganizationId: string;
  newOrganizationId: string;
  oldId: string;
  newId: string;
}): SupersedeCheck {
  if (!opts.oldId || !opts.newId || opts.oldId === opts.newId) {
    return { ok: false, reason: "Distinct old and new section ids required." };
  }
  if (!assertSameTenant(opts.oldOrganizationId, opts.newOrganizationId)) {
    return { ok: false, reason: "Sections must share organization_id." };
  }
  return { ok: true };
}

/** Similarity / embedding eligibility: HUMAN_VERIFIED + drafting-eligible reuse (or REVIEW_REQUIRED pending human APPROVED). */
export function isEmbedEligible(opts: {
  verificationStatus: ContentVerificationStatus;
  reuseStatus: ContentReuseStatus | null | undefined;
}): boolean {
  if (opts.verificationStatus !== "HUMAN_VERIFIED") return false;
  if (opts.reuseStatus === "DO_NOT_USE" || opts.reuseStatus === "SUPERSEDED") return false;
  // Embed REVIEW_REQUIRED and APPROVED so hybrid search can find them under purpose gates.
  return opts.reuseStatus === "APPROVED" || opts.reuseStatus === "REVIEW_REQUIRED";
}
