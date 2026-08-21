/**
 * F14 promote helpers — HUMAN_VERIFIED via verify.promote only.
 * AI/extraction cannot set HUMAN_VERIFIED.
 * promote_experience_from_contract → L_AND_P_CORPORATE only (DB RPC).
 */

import { validateTypeAttribution, assertNoInventedMetrics } from "./attribution";
import {
  hasExperienceSource,
  isLpCorporateType,
  type ExperienceType,
  type ExperienceVerificationStatus,
} from "./types";

export type PromoteExperienceInput = {
  verificationStatus: ExperienceVerificationStatus | string;
  verifiedBy: string | null | undefined;
  verifiedAt?: string | null;
  hasSource: boolean;
  experienceType: ExperienceType | string;
};

export type PromoteGate =
  | { ok: true; verification_status: "HUMAN_VERIFIED"; verified_by: string; verified_at: string }
  | { ok: false; reason: string };

/** Only human path with actor + source evidence may mark HUMAN_VERIFIED. */
export function evaluateHumanVerifyGate(input: PromoteExperienceInput): PromoteGate {
  if (!input.verifiedBy) {
    return { ok: false, reason: "HUMAN_VERIFIED requires verified_by (verify.promote actor)." };
  }
  if (input.verificationStatus === "REJECTED") {
    return { ok: false, reason: "Rejected experience cannot be marked HUMAN_VERIFIED." };
  }
  if (!input.hasSource) {
    return {
      ok: false,
      reason: "HUMAN_VERIFIED requires source evidence (document, version, fact, URL, or contract).",
    };
  }
  return {
    ok: true,
    verification_status: "HUMAN_VERIFIED",
    verified_by: input.verifiedBy,
    verified_at: input.verifiedAt ?? new Date().toISOString(),
  };
}

/** AI extract path — always AI_EXTRACTED, never HUMAN_VERIFIED. */
export function buildAiExtractedExperiencePatch(): {
  verification_status: "AI_EXTRACTED";
  verified_by: null;
  verified_at: null;
} {
  return {
    verification_status: "AI_EXTRACTED",
    verified_by: null,
    verified_at: null,
  };
}

export function assertAiCannotMarkVerified(status: string): void {
  if (status === "HUMAN_VERIFIED") {
    throw new Error("AI/extraction cannot set HUMAN_VERIFIED on experience records.");
  }
}

export function humanVerifyPatch(actorId: string, atIso?: string) {
  return {
    verification_status: "HUMAN_VERIFIED" as const,
    verified_by: actorId,
    verified_at: atIso ?? new Date().toISOString(),
  };
}

/**
 * Gate for treating a record as usable L&P corporate past performance.
 * Requires HUMAN_VERIFIED + L_AND_P_CORPORATE (+ source).
 */
export function assertCanUseAsCorporatePastPerformance(rec: {
  experience_type: string;
  verification_status: string;
  source_document_id?: string | null;
  source_document_version_id?: string | null;
  source_fact_id?: string | null;
  source_url?: string | null;
  contract_id?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!isLpCorporateType(rec.experience_type)) {
    return {
      ok: false,
      reason: `Only L_AND_P_CORPORATE may be used as L&P past performance (got ${rec.experience_type}).`,
    };
  }
  if (rec.verification_status !== "HUMAN_VERIFIED") {
    return {
      ok: false,
      reason: "Corporate past performance requires HUMAN_VERIFIED (verify.promote).",
    };
  }
  if (!hasExperienceSource(rec)) {
    return { ok: false, reason: "Corporate past performance requires source evidence." };
  }
  return { ok: true };
}

/** Pre-insert validation for extracted experience rows. */
export function evaluateExperienceInsertGate(input: {
  experience_type: ExperienceType | string;
  person_name?: string | null;
  subcontractor_name?: string | null;
  employer_name?: string | null;
  performed_by_org?: string | null;
  contract_id?: string | null;
  attribution_language?: string | null;
  contract_value_amount?: number | null;
  contract_value_source?: string | null;
  years_of_experience?: number | null;
  years_source?: string | null;
  /** When true, reject corporate promote (Class C / competitor). */
  isClassCOrCompetitor?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (input.isClassCOrCompetitor && isLpCorporateType(input.experience_type)) {
    return {
      ok: false,
      reason: "Class C / competitor corpus cannot promote as L_AND_P_CORPORATE.",
    };
  }
  if (!input.attribution_language?.trim()) {
    return { ok: false, reason: "attribution_language is required and must be non-blank." };
  }
  const typeGate = validateTypeAttribution(input);
  if (!typeGate.ok) return typeGate;
  const metricsGate = assertNoInventedMetrics(input);
  if (!metricsGate.ok) return metricsGate;
  return { ok: true };
}

/**
 * Classify whether a proposed corporate claim is actually prior-employer / personnel / sub.
 * Used for adversarial refusal (FBI prior employer → NOT corporate).
 */
export function classifyExperienceClaim(input: {
  personWorkedAtPriorEmployer?: boolean;
  subcontractorPerformed?: boolean;
  lpHeldContract?: boolean;
  classCOrCompetitor?: boolean;
}): ExperienceType | "REJECT_CORPORATE" {
  if (input.classCOrCompetitor) return "REJECT_CORPORATE";
  if (input.personWorkedAtPriorEmployer) return "MANAGEMENT_PRIOR_EXPERIENCE";
  if (input.subcontractorPerformed) return "SUBCONTRACTOR_EXPERIENCE";
  if (input.lpHeldContract) return "L_AND_P_CORPORATE";
  return "REJECT_CORPORATE";
}
