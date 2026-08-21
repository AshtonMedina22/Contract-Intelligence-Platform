/**
 * F14 experience / past-performance types.
 * Never merge types. Only HUMAN_VERIFIED L_AND_P_CORPORATE is L&P corporate PP.
 */

export type ExperienceType =
  | "L_AND_P_CORPORATE"
  | "MANAGEMENT_PRIOR_EXPERIENCE"
  | "KEY_PERSONNEL_EXPERIENCE"
  | "SUBCONTRACTOR_EXPERIENCE";

/** Product alias — same as L_AND_P_CORPORATE. */
export type LpCorporateAlias = "lp_corporate" | "L_AND_P_CORPORATE";

export type ExperienceVerificationStatus =
  | "AI_EXTRACTED"
  | "PUBLIC_UNVERIFIED"
  | "HUMAN_VERIFIED"
  | "REJECTED"
  | "NEEDS_REVIEW";

export const EXPERIENCE_TYPES: ExperienceType[] = [
  "L_AND_P_CORPORATE",
  "MANAGEMENT_PRIOR_EXPERIENCE",
  "KEY_PERSONNEL_EXPERIENCE",
  "SUBCONTRACTOR_EXPERIENCE",
];

export const EXPERIENCE_TYPE_LABELS: Record<ExperienceType, string> = {
  L_AND_P_CORPORATE: "L&P corporate",
  MANAGEMENT_PRIOR_EXPERIENCE: "Management prior",
  KEY_PERSONNEL_EXPERIENCE: "Key personnel",
  SUBCONTRACTOR_EXPERIENCE: "Subcontractor",
};

export type ExperienceRecord = {
  id: string;
  organization_id: string;
  experience_type: ExperienceType | string;
  person_name?: string | null;
  subcontractor_name?: string | null;
  buyer_name?: string | null;
  buyer_client_id?: string | null;
  project_or_contract_name: string;
  contract_number?: string | null;
  period_of_performance_start?: string | null;
  period_of_performance_end?: string | null;
  scope_summary?: string | null;
  geography?: string | null;
  contract_value_amount?: number | null;
  contract_value_currency?: string | null;
  contract_value_source?: string | null;
  years_of_experience?: number | null;
  years_source?: string | null;
  role_description?: string | null;
  performance_result?: string | null;
  source_document_id?: string | null;
  source_document_version_id?: string | null;
  source_page?: number | null;
  source_fact_id?: string | null;
  source_url?: string | null;
  verification_status: ExperienceVerificationStatus | string;
  verified_by?: string | null;
  verified_at?: string | null;
  attribution_language: string;
  contract_id?: string | null;
  employer_name?: string | null;
  performed_by_org?: string | null;
  supersedes_id?: string | null;
  created_at?: string;
};

export type ExperienceReference = {
  id: string;
  organization_id: string;
  experience_record_id: string;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  agency_or_company?: string | null;
  notes?: string | null;
  source_document_id?: string | null;
  source_page?: number | null;
  verification_status: ExperienceVerificationStatus | string;
  created_at?: string;
};

export const EXPERIENCE_HARD_CAVEAT =
  "Experience types never merge. Only HUMAN_VERIFIED L&P corporate records count as L&P past performance. Prior-employer, personnel, subcontractor, and reference-only rows are not corporate PP.";

export function normalizeExperienceType(
  raw: string | null | undefined,
): ExperienceType | null {
  if (!raw) return null;
  const t = raw.trim();
  if (t === "lp_corporate" || t === "L_AND_P_CORPORATE") return "L_AND_P_CORPORATE";
  if (EXPERIENCE_TYPES.includes(t as ExperienceType)) return t as ExperienceType;
  return null;
}

export function isLpCorporateType(type: string | null | undefined): boolean {
  return normalizeExperienceType(type) === "L_AND_P_CORPORATE";
}

export function isHumanVerifiedExperience(status: string | null | undefined): boolean {
  return status === "HUMAN_VERIFIED";
}

/** Corporate past performance eligibility — type + human verify only. */
export function isEligibleCorporatePastPerformance(rec: {
  experience_type: string;
  verification_status: string;
}): boolean {
  return (
    isLpCorporateType(rec.experience_type) &&
    isHumanVerifiedExperience(rec.verification_status)
  );
}

export function hasExperienceSource(item: {
  source_document_id?: string | null;
  source_document_version_id?: string | null;
  source_fact_id?: string | null;
  source_url?: string | null;
  contract_id?: string | null;
}): boolean {
  if (item.source_document_id) return true;
  if (item.source_document_version_id) return true;
  if (item.source_fact_id) return true;
  if (item.source_url && item.source_url.trim().length > 0) return true;
  if (item.contract_id) return true;
  return false;
}
