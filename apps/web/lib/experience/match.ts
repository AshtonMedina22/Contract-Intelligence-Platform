/**
 * F14 match — filter experience by type + eligibility criteria.
 * Never merge types. Corporate PP excludes all other types.
 */

import {
  isEligibleCorporatePastPerformance,
  isLpCorporateType,
  type ExperienceRecord,
  type ExperienceType,
} from "./types";
import { assertCanUseAsCorporatePastPerformance } from "./promote";

export type ExperienceMatchCriteria = {
  /** Required type — never broaden to other types. */
  experienceType?: ExperienceType | string | null;
  /** When true, only HUMAN_VERIFIED L_AND_P_CORPORATE. */
  corporatePastPerformanceOnly?: boolean;
  buyerNameContains?: string | null;
  geographyContains?: string | null;
  requireHumanVerified?: boolean;
  /** Exclude reference-only rows (handled at retrieve layer). */
  excludeWithoutAttribution?: boolean;
};

export type ExperienceMatchResult = {
  record: ExperienceRecord;
  eligible: boolean;
  reason: string;
};

export function matchesCriteria(
  rec: ExperienceRecord,
  criteria: ExperienceMatchCriteria,
): ExperienceMatchResult {
  if (criteria.corporatePastPerformanceOnly) {
    const gate = assertCanUseAsCorporatePastPerformance(rec);
    if (!gate.ok) {
      return { record: rec, eligible: false, reason: gate.reason };
    }
    return { record: rec, eligible: true, reason: "HUMAN_VERIFIED L_AND_P_CORPORATE." };
  }

  if (criteria.experienceType) {
    const want = criteria.experienceType === "lp_corporate" ? "L_AND_P_CORPORATE" : criteria.experienceType;
    if (rec.experience_type !== want) {
      return {
        record: rec,
        eligible: false,
        reason: `Type mismatch: want ${want}, got ${rec.experience_type}. Types never merge.`,
      };
    }
  }

  if (criteria.requireHumanVerified && rec.verification_status !== "HUMAN_VERIFIED") {
    return {
      record: rec,
      eligible: false,
      reason: `Requires HUMAN_VERIFIED (got ${rec.verification_status}).`,
    };
  }

  if (criteria.buyerNameContains?.trim()) {
    const needle = criteria.buyerNameContains.trim().toLowerCase();
    const hay = (rec.buyer_name ?? "").toLowerCase();
    if (!hay.includes(needle)) {
      return { record: rec, eligible: false, reason: "Buyer name does not match." };
    }
  }

  if (criteria.geographyContains?.trim()) {
    const needle = criteria.geographyContains.trim().toLowerCase();
    const hay = (rec.geography ?? "").toLowerCase();
    if (!hay.includes(needle)) {
      return { record: rec, eligible: false, reason: "Geography does not match." };
    }
  }

  if (criteria.excludeWithoutAttribution && !rec.attribution_language?.trim()) {
    return { record: rec, eligible: false, reason: "Missing attribution_language." };
  }

  return { record: rec, eligible: true, reason: "Matched criteria." };
}

export function filterExperienceRecords(
  records: ExperienceRecord[],
  criteria: ExperienceMatchCriteria,
): ExperienceMatchResult[] {
  return records.map((r) => matchesCriteria(r, criteria)).filter((m) => m.eligible);
}

/** Past-performance requirement → prefer typed corporate rows only for "L&P PP" asks. */
export function isPastPerformanceRequirement(statement: string): boolean {
  const s = statement.toLowerCase();
  return (
    /\bpast\s+performance\b/.test(s) ||
    /\brelevant\s+experience\b/.test(s) ||
    /\bprior\s+contracts?\b/.test(s) ||
    /\bperformance\s+history\b/.test(s) ||
    (/\breferences?\b/.test(s) && /\bcontract\b/.test(s))
  );
}

/**
 * Split a mixed list so corporate PP never absorbs other types.
 */
export function partitionByExperienceType(records: ExperienceRecord[]): Record<
  ExperienceType,
  ExperienceRecord[]
> {
  const out: Record<ExperienceType, ExperienceRecord[]> = {
    L_AND_P_CORPORATE: [],
    MANAGEMENT_PRIOR_EXPERIENCE: [],
    KEY_PERSONNEL_EXPERIENCE: [],
    SUBCONTRACTOR_EXPERIENCE: [],
  };
  for (const r of records) {
    const t = r.experience_type as ExperienceType;
    if (t in out) out[t].push(r);
  }
  return out;
}

export function corporateOnly(records: ExperienceRecord[]): ExperienceRecord[] {
  return records.filter((r) => isEligibleCorporatePastPerformance(r));
}

export function excludeNonCorporateFromCorporateQuery(
  records: ExperienceRecord[],
): ExperienceRecord[] {
  return records.filter((r) => isLpCorporateType(r.experience_type));
}
