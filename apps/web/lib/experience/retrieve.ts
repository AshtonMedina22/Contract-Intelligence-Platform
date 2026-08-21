/**
 * F14 retrieve — corporate PP query excludes other types.
 * References alone are never returned as corporate past performance.
 */

import type { createClient } from "@/lib/supabase/server";
import {
  filterExperienceRecords,
  type ExperienceMatchCriteria,
} from "./match";
import {
  EXPERIENCE_HARD_CAVEAT,
  isEligibleCorporatePastPerformance,
  type ExperienceRecord,
  type ExperienceReference,
  type ExperienceType,
} from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const RECORD_SELECT =
  "id, organization_id, experience_type, person_name, subcontractor_name, buyer_name, buyer_client_id, project_or_contract_name, contract_number, period_of_performance_start, period_of_performance_end, scope_summary, geography, contract_value_amount, contract_value_currency, contract_value_source, years_of_experience, years_source, role_description, performance_result, source_document_id, source_document_version_id, source_page, source_fact_id, source_url, verification_status, verified_by, verified_at, attribution_language, contract_id, employer_name, performed_by_org, supersedes_id, created_at";

export { EXPERIENCE_HARD_CAVEAT };

export async function loadExperienceLibrary(
  supabase: Supabase,
  organizationId: string,
  opts?: { limit?: number; experienceType?: ExperienceType | string | null },
): Promise<ExperienceRecord[]> {
  let q = supabase
    .from("experience_records")
    .select(RECORD_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.experienceType) {
    const t = (
      opts.experienceType === "lp_corporate" ? "L_AND_P_CORPORATE" : opts.experienceType
    ) as "L_AND_P_CORPORATE" | "MANAGEMENT_PRIOR_EXPERIENCE" | "KEY_PERSONNEL_EXPERIENCE" | "SUBCONTRACTOR_EXPERIENCE";
    q = q.eq("experience_type", t);
  }
  const { data } = await q;
  return (data ?? []) as ExperienceRecord[];
}

/**
 * Corporate past performance only — HUMAN_VERIFIED L_AND_P_CORPORATE.
 * Explicitly excludes management / personnel / subcontractor / references.
 */
export async function retrieveCorporatePastPerformance(
  supabase: Supabase,
  organizationId: string,
  opts?: { limit?: number; buyerNameContains?: string | null },
): Promise<ExperienceRecord[]> {
  const { data } = await supabase
    .from("experience_records")
    .select(RECORD_SELECT)
    .eq("organization_id", organizationId)
    .eq("experience_type", "L_AND_P_CORPORATE")
    .eq("verification_status", "HUMAN_VERIFIED")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);

  let rows = ((data ?? []) as ExperienceRecord[]).filter((r) =>
    isEligibleCorporatePastPerformance(r),
  );

  if (opts?.buyerNameContains?.trim()) {
    const needle = opts.buyerNameContains.trim().toLowerCase();
    rows = rows.filter((r) => (r.buyer_name ?? "").toLowerCase().includes(needle));
  }
  return rows;
}

/** Retrieve by exact type — never widens. */
export async function retrieveExperienceByType(
  supabase: Supabase,
  organizationId: string,
  experienceType: ExperienceType | string,
  opts?: { limit?: number; requireHumanVerified?: boolean },
): Promise<ExperienceRecord[]> {
  const t = (
    experienceType === "lp_corporate" ? "L_AND_P_CORPORATE" : experienceType
  ) as "L_AND_P_CORPORATE" | "MANAGEMENT_PRIOR_EXPERIENCE" | "KEY_PERSONNEL_EXPERIENCE" | "SUBCONTRACTOR_EXPERIENCE";
  let q = supabase
    .from("experience_records")
    .select(RECORD_SELECT)
    .eq("organization_id", organizationId)
    .eq("experience_type", t)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.requireHumanVerified) {
    q = q.eq("verification_status", "HUMAN_VERIFIED");
  }
  const { data } = await q;
  return (data ?? []) as ExperienceRecord[];
}

export function applyExperienceCriteria(
  records: ExperienceRecord[],
  criteria: ExperienceMatchCriteria,
): ExperienceRecord[] {
  return filterExperienceRecords(records, criteria).map((m) => m.record);
}

/**
 * References for a record. Presence of references does NOT upgrade type to corporate.
 */
export async function loadExperienceReferences(
  supabase: Supabase,
  organizationId: string,
  experienceRecordId: string,
): Promise<ExperienceReference[]> {
  const { data } = await supabase
    .from("experience_references")
    .select(
      "id, organization_id, experience_record_id, contact_name, contact_title, contact_phone, contact_email, agency_or_company, notes, source_document_id, source_page, verification_status, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("experience_record_id", experienceRecordId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ExperienceReference[];
}

/** References alone never qualify as corporate PP. */
export function referencesAloneAreNotCorporatePastPerformance(
  references: ExperienceReference[],
  parentRecord: ExperienceRecord | null,
): boolean {
  if (!parentRecord) return true;
  if (references.length === 0) return true;
  return !isEligibleCorporatePastPerformance(parentRecord);
}
