/**
 * F12 promote helpers — mark credentials HUMAN_VERIFIED via verify.promote only.
 * AI/extraction cannot set HUMAN_VERIFIED. Missing source blocks VERIFIED_AVAILABLE.
 */

import {
  assertCanSetVerifiedAvailable,
  evaluateRequirementMatch,
} from "./match-rules";
import {
  hasComplianceSource,
  type ComplianceInventoryItem,
  type ComplianceVerificationStatus,
  type CoverageLimits,
  type OrganizationRegistration,
  type RequirementComplianceMatchStatus,
} from "./types";

export type PromoteCredentialInput = {
  verificationStatus: ComplianceVerificationStatus | string;
  verifiedBy: string | null | undefined;
  verifiedAt?: string | null;
  hasSource: boolean;
};

export type PromoteGate =
  | { ok: true; verification_status: "HUMAN_VERIFIED"; verified_by: string; verified_at: string }
  | { ok: false; reason: string };

/** Only human path with actor + source evidence may mark HUMAN_VERIFIED. */
export function evaluateHumanVerifyGate(input: PromoteCredentialInput): PromoteGate {
  if (!input.verifiedBy) {
    return { ok: false, reason: "HUMAN_VERIFIED requires verified_by (verify.promote actor)." };
  }
  if (input.verificationStatus === "REJECTED") {
    return { ok: false, reason: "Rejected credentials cannot be marked HUMAN_VERIFIED." };
  }
  // Source strongly preferred; allow PUBLIC_UNVERIFIED→HUMAN_VERIFIED only with source.
  if (!input.hasSource) {
    return {
      ok: false,
      reason: "HUMAN_VERIFIED requires source evidence (document, version, fact, or URL).",
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
export function buildAiExtractedCredentialPatch(): {
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
    throw new Error("AI/extraction cannot set HUMAN_VERIFIED on compliance credentials.");
  }
}

export type BuildMatchRowInput = {
  requirementId: string;
  opportunityId?: string | null;
  inventory: ComplianceInventoryItem | null;
  registration?: OrganizationRegistration | null;
  requiredCoverage?: CoverageLimits | null;
  requiredNaics?: string[] | null;
  today: string;
  notApplicable?: boolean;
};

export function buildMatchRowFromRules(input: BuildMatchRowInput): {
  requirement_id: string;
  opportunity_id: string | null;
  compliance_item_id: string | null;
  organization_registration_id: string | null;
  match_status: RequirementComplianceMatchStatus;
  rationale: string;
} {
  const result = evaluateRequirementMatch({
    inventory: input.inventory,
    registration: input.registration,
    requiredCoverage: input.requiredCoverage,
    requiredNaics: input.requiredNaics,
    today: input.today,
    notApplicable: input.notApplicable,
  });

  if (result.match_status === "VERIFIED_AVAILABLE") {
    const inv = input.inventory;
    const reg = input.registration;
    const target = inv ?? reg;
    const gate = assertCanSetVerifiedAvailable({
      verification_status: target?.verification_status ?? "",
      hasSource: target ? hasComplianceSource(target) : false,
    });
    if (!gate.ok) {
      return {
        requirement_id: input.requirementId,
        opportunity_id: input.opportunityId ?? null,
        compliance_item_id: inv?.id ?? null,
        organization_registration_id: inv ? null : (reg?.id ?? null),
        match_status: "UNKNOWN",
        rationale: gate.reason,
      };
    }
  }

  return {
    requirement_id: input.requirementId,
    opportunity_id: input.opportunityId ?? null,
    compliance_item_id: input.inventory?.id ?? null,
    organization_registration_id: input.inventory ? null : (input.registration?.id ?? null),
    match_status: result.match_status,
    rationale: result.rationale,
  };
}

export function humanVerifyPatch(actorId: string, atIso?: string) {
  return {
    verification_status: "HUMAN_VERIFIED" as const,
    verified_by: actorId,
    verified_at: atIso ?? new Date().toISOString(),
  };
}
