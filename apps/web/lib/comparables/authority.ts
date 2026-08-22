import type { DataClassification } from "@/lib/classification/types";
import type { CorpusClass } from "@/lib/supabase/database.types";
import type { ComparableAuthority, ComparablePurpose } from "./types";

export function evaluateComparableAuthority(input: {
  targetOrganizationId: string;
  candidateOrganizationId: string;
  corpusClass: CorpusClass | null;
  classifications: readonly DataClassification[];
  purpose: ComparablePurpose;
}): ComparableAuthority {
  const classifications = [...new Set(input.classifications)];
  if (input.candidateOrganizationId !== input.targetOrganizationId) {
    return {
      organizationId: input.candidateOrganizationId,
      corpusClass: input.corpusClass,
      classifications,
      historicalLabel: "Unclassified",
      eligible: false,
      reason: "Excluded: candidate belongs to a different organization.",
    };
  }
  if (classifications.includes("illustrative_demo")) {
    return {
      organizationId: input.candidateOrganizationId,
      corpusClass: input.corpusClass,
      classifications,
      historicalLabel: "Unclassified",
      eligible: false,
      reason: "Excluded: illustrative_demo evidence is never a production comparable.",
    };
  }
  if (!classifications.some((value) => value === "verified_public" || value === "verified_internal")) {
    return {
      organizationId: input.candidateOrganizationId,
      corpusClass: input.corpusClass,
      classifications,
      historicalLabel: "Unclassified",
      eligible: false,
      reason: "Excluded: no verified_public or verified_internal source classification.",
    };
  }
  if (input.corpusClass === "C_COMPETITOR_TEST") {
    return {
      organizationId: input.candidateOrganizationId,
      corpusClass: input.corpusClass,
      classifications,
      historicalLabel: "Non-L&P test corpus",
      eligible: input.purpose !== "PROPOSAL_CONTENT",
      reason:
        input.purpose === "PROPOSAL_CONTENT"
          ? "Excluded from proposal reuse: Class C is non-L&P test corpus."
          : "Eligible only as explicitly labeled non-L&P test evidence; never L&P historical performance.",
    };
  }
  if (input.corpusClass === "A_LP_ORIGINATED") {
    return {
      organizationId: input.candidateOrganizationId,
      corpusClass: input.corpusClass,
      classifications,
      historicalLabel: "L&P historical",
      eligible: true,
      reason: "Eligible: verified, same-tenant A_LP_ORIGINATED package.",
    };
  }
  if (input.corpusClass === "B_LP_TIED") {
    return {
      organizationId: input.candidateOrganizationId,
      corpusClass: input.corpusClass,
      classifications,
      historicalLabel: "L&P-tied buyer evidence",
      eligible: true,
      reason: "Eligible as L&P-tied buyer evidence; not labeled L&P-delivered performance.",
    };
  }
  return {
    organizationId: input.candidateOrganizationId,
    corpusClass: null,
    classifications,
    historicalLabel: "Unclassified",
    eligible: false,
    reason: "Excluded: no A/B/C corpus authority is linked.",
  };
}
