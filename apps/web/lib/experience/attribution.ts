/**
 * F14 attribution integrity.
 * NEVER rewrite subject to L&P.
 * NEVER turn "person worked Contract Y at prior employer" into "L&P performed Contract Y."
 */

import {
  isLpCorporateType,
  type ExperienceRecord,
  type ExperienceType,
} from "./types";

const LP_SUBJECT_REWRITE_RE =
  /\b(l\s*&\s*p|l\s+and\s+p|l&p\s+global)\s+(performed|held|completed|provided|delivered)\b/i;

/**
 * Detect unsafe rewrite: prior-employer / personnel / sub language rewritten as L&P performance.
 */
export function wouldRewriteSubjectToLp(opts: {
  experienceType: ExperienceType | string;
  attributionLanguage: string;
  proposedDraftText?: string;
}): boolean {
  const type = opts.experienceType;
  if (isLpCorporateType(type)) return false;

  const draft = (opts.proposedDraftText ?? "").trim();
  if (!draft) return false;

  // If draft claims L&P performed the work while type is not corporate — forbidden.
  if (LP_SUBJECT_REWRITE_RE.test(draft)) return true;

  // Also forbid dropping person/employer/sub attribution markers when present in original.
  const original = opts.attributionLanguage.trim();
  if (!original) return false;

  const personMatch = original.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
  if (
    (type === "MANAGEMENT_PRIOR_EXPERIENCE" || type === "KEY_PERSONNEL_EXPERIENCE") &&
    personMatch &&
    !draft.toLowerCase().includes(personMatch[1].toLowerCase()) &&
    /\b(l\s*&\s*p|l&p)\b/i.test(draft)
  ) {
    return true;
  }

  return false;
}

/** Preserve attribution_language verbatim — never mutate subject. */
export function preserveAttributionLanguage(rec: Pick<ExperienceRecord, "attribution_language">): string {
  return rec.attribution_language;
}

/**
 * Assert a draft preserves attribution. Throws if subject would flip to L&P.
 */
export function assertAttributionPreserved(opts: {
  experienceType: ExperienceType | string;
  attributionLanguage: string;
  draftText: string;
}): void {
  if (
    wouldRewriteSubjectToLp({
      experienceType: opts.experienceType,
      attributionLanguage: opts.attributionLanguage,
      proposedDraftText: opts.draftText,
    })
  ) {
    throw new Error(
      "Attribution integrity: cannot rewrite non-corporate experience as L&P past performance.",
    );
  }

  // Draft for non-corporate must still carry the original attribution language (substring).
  if (!isLpCorporateType(opts.experienceType)) {
    const attr = opts.attributionLanguage.trim();
    if (attr && !opts.draftText.includes(attr)) {
      throw new Error(
        "Attribution integrity: draft must preserve attribution_language verbatim.",
      );
    }
  }
}

/** Validate type-specific required fields before insert (mirrors DB CHECKs). */
export function validateTypeAttribution(input: {
  experience_type: ExperienceType | string;
  person_name?: string | null;
  subcontractor_name?: string | null;
  employer_name?: string | null;
  performed_by_org?: string | null;
  contract_id?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const t = input.experience_type;
  if (t === "L_AND_P_CORPORATE" || t === "lp_corporate") {
    if (!input.contract_id) {
      return { ok: false, reason: "L_AND_P_CORPORATE requires contract_id linkage." };
    }
    if (input.person_name) {
      return {
        ok: false,
        reason: "L_AND_P_CORPORATE cannot attribute to a person (use management/personnel type).",
      };
    }
    if (input.subcontractor_name) {
      return {
        ok: false,
        reason: "L_AND_P_CORPORATE cannot attribute to a subcontractor.",
      };
    }
    if (input.employer_name) {
      return {
        ok: false,
        reason: "L_AND_P_CORPORATE cannot carry a prior employer_name.",
      };
    }
    if (!input.performed_by_org?.trim()) {
      return { ok: false, reason: "L_AND_P_CORPORATE requires performed_by_org (L&P)." };
    }
    return { ok: true };
  }
  if (t === "MANAGEMENT_PRIOR_EXPERIENCE") {
    if (!input.person_name?.trim()) {
      return { ok: false, reason: "MANAGEMENT_PRIOR_EXPERIENCE requires person_name." };
    }
    if (!input.employer_name?.trim()) {
      return { ok: false, reason: "MANAGEMENT_PRIOR_EXPERIENCE requires employer_name (prior employer)." };
    }
    if (input.subcontractor_name) {
      return { ok: false, reason: "MANAGEMENT_PRIOR_EXPERIENCE cannot be a subcontractor row." };
    }
    return { ok: true };
  }
  if (t === "KEY_PERSONNEL_EXPERIENCE") {
    if (!input.person_name?.trim()) {
      return { ok: false, reason: "KEY_PERSONNEL_EXPERIENCE requires person_name." };
    }
    if (input.subcontractor_name) {
      return { ok: false, reason: "KEY_PERSONNEL_EXPERIENCE cannot be a subcontractor row." };
    }
    return { ok: true };
  }
  if (t === "SUBCONTRACTOR_EXPERIENCE") {
    if (!input.subcontractor_name?.trim()) {
      return { ok: false, reason: "SUBCONTRACTOR_EXPERIENCE requires subcontractor_name." };
    }
    if (input.person_name) {
      return { ok: false, reason: "SUBCONTRACTOR_EXPERIENCE cannot attribute to a person field." };
    }
    return { ok: true };
  }
  return { ok: false, reason: `Unknown experience_type: ${t}` };
}

/** Value/years must stay blank unless sourced — never invent. */
export function assertNoInventedMetrics(input: {
  contract_value_amount?: number | null;
  contract_value_source?: string | null;
  years_of_experience?: number | null;
  years_source?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  if (
    input.contract_value_amount != null &&
    !(input.contract_value_source && input.contract_value_source.trim())
  ) {
    return { ok: false, reason: "contract_value_amount requires contract_value_source — never invent." };
  }
  if (
    input.years_of_experience != null &&
    !(input.years_source && input.years_source.trim())
  ) {
    return { ok: false, reason: "years_of_experience requires years_source — never invent." };
  }
  return { ok: true };
}
