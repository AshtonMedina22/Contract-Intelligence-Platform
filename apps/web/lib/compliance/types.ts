/**
 * F12 compliance / eligibility types.
 * Never fabricate certifications. Eligibility is advisory only.
 */

export type ComplianceVerificationStatus =
  | "AI_EXTRACTED"
  | "PUBLIC_UNVERIFIED"
  | "HUMAN_VERIFIED"
  | "REJECTED"
  | "NEEDS_REVIEW";

export type ComplianceKind =
  | "insurance"
  | "license"
  | "certification"
  | "registration"
  | "personnel_qualification"
  | "membership"
  | "other";

export type RequirementComplianceMatchStatus =
  | "VERIFIED_AVAILABLE"
  | "EXPIRING"
  | "MISSING"
  | "INSUFFICIENT"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

/** Opaque recorded COI limits — never invent values. */
export type CoverageLimits = {
  generalLiability?: number | null;
  automobile?: number | null;
  umbrella?: number | null;
  workersComp?: number | null;
  professionalLiability?: number | null;
  /** Extra named limits as recorded on the certificate. */
  other?: Record<string, number | null>;
};

export type ComplianceInventoryItem = {
  id: string;
  organization_id: string;
  kind: ComplianceKind | string;
  statement: string;
  expires_on: string | null;
  effective_on?: string | null;
  verification_status: ComplianceVerificationStatus | string;
  issuer?: string | null;
  credential_number?: string | null;
  holder_name?: string | null;
  coverage_json?: CoverageLimits | Record<string, unknown> | null;
  source_document_id?: string | null;
  source_document_version_id?: string | null;
  source_fact_id?: string | null;
  source_url?: string | null;
  supersedes_id?: string | null;
  organization_registration_id?: string | null;
  contract_id?: string | null;
  created_at?: string;
};

export type OrganizationRegistration = {
  id: string;
  organization_id: string;
  uei: string | null;
  cage: string | null;
  sam_status: string | null;
  sam_expiration_on: string | null;
  naics: string[];
  psc: string[];
  vehicles_notes?: string | null;
  source_document_id?: string | null;
  source_document_version_id?: string | null;
  source_url?: string | null;
  source_fact_id?: string | null;
  verification_status: ComplianceVerificationStatus | string;
  supersedes_id?: string | null;
  as_of?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type RequirementComplianceMatch = {
  id?: string;
  requirement_id: string;
  opportunity_id?: string | null;
  compliance_item_id?: string | null;
  organization_registration_id?: string | null;
  match_status: RequirementComplianceMatchStatus;
  rationale: string;
  evidence_links?: unknown[];
};

export const EXPIRING_WINDOW_DAYS = 60;

export const ELIGIBILITY_HARD_CAVEAT =
  "Recorded evidence status only — not a legal determination of SAM eligibility, bid authority, or insurance adequacy. Do not treat this rollup as counsel or as permission to bid.";

export function hasComplianceSource(item: {
  source_document_id?: string | null;
  source_document_version_id?: string | null;
  source_fact_id?: string | null;
  source_url?: string | null;
}): boolean {
  if (item.source_document_id) return true;
  if (item.source_document_version_id) return true;
  if (item.source_fact_id) return true;
  if (item.source_url && item.source_url.trim().length > 0) return true;
  return false;
}

export function isHumanVerifiedInventory(status: string | null | undefined): boolean {
  return status === "HUMAN_VERIFIED";
}
