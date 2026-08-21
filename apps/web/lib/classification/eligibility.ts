import type { ClassificationPurpose, DataClassification } from "./types";

const TRUSTED: readonly DataClassification[] = ["verified_public", "verified_internal"];
const INTERNAL_ONLY: readonly DataClassification[] = ["verified_internal"];
const LOCATABLE: readonly DataClassification[] = [
  "verified_public",
  "verified_internal",
  "internal_unverified",
];
const ALL: readonly DataClassification[] = [
  "verified_public",
  "verified_internal",
  "internal_unverified",
  "illustrative_demo",
];

/**
 * Purpose → allowed classification matrix.
 * illustrative_demo is denied everywhere except the explicit DEMO_TEST purpose.
 */
export const PURPOSE_CLASSIFICATION_ELIGIBILITY: Readonly<
  Record<ClassificationPurpose, readonly DataClassification[]>
> = {
  GENERAL_QA: TRUSTED,
  LOCATE: LOCATABLE,
  LOSS_ANALYSIS: INTERNAL_ONLY,
  COMPETITOR_ANALYSIS: TRUSTED,
  PRICING_ANALYSIS: TRUSTED,
  BID_STRATEGY: TRUSTED,
  PROPOSAL_DRAFTING: INTERNAL_ONLY,
  COMPLIANCE_REVIEW: INTERNAL_ONLY,
  REPORT_GENERATION: TRUSTED,
  DEMO_TEST: ALL,
};

export function allowedClassificationsForPurpose(
  purpose: ClassificationPurpose,
): readonly DataClassification[] {
  return PURPOSE_CLASSIFICATION_ELIGIBILITY[purpose];
}

export function isClassificationEligible(
  classification: DataClassification,
  purpose: ClassificationPurpose,
): boolean {
  return allowedClassificationsForPurpose(purpose).includes(classification);
}

export function eligibilityLimitation(purpose: ClassificationPurpose): string {
  const allowed = allowedClassificationsForPurpose(purpose);
  return `Eligible data classifications for ${purpose}: ${allowed.join(", ")}. illustrative_demo is excluded unless purpose=DEMO_TEST.`;
}

/** Public authority is intelligence evidence, never an assertion of L&P internal history. */
export function canRepresentLpInternalHistory(classification: DataClassification): boolean {
  return classification === "verified_internal";
}
