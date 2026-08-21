/**
 * F14 draft attribution templates.
 * Distinguish corporate vs personnel vs sub — never rewrite subject to L&P.
 */

import { assertAttributionPreserved, preserveAttributionLanguage } from "./attribution";
import type { ExperienceRecord, ExperienceType } from "./types";

export type DraftAttributionBlock = {
  experience_type: ExperienceType | string;
  attribution_language: string;
  body: string;
  value_display: string | null;
  years_display: string | null;
};

function formatValue(rec: ExperienceRecord): string | null {
  if (rec.contract_value_amount == null) return null;
  if (!rec.contract_value_source?.trim()) return null;
  const cur = rec.contract_value_currency ?? "USD";
  return `${cur} ${rec.contract_value_amount} (sourced: ${rec.contract_value_source})`;
}

function formatYears(rec: ExperienceRecord): string | null {
  if (rec.years_of_experience == null) return null;
  if (!rec.years_source?.trim()) return null;
  return `${rec.years_of_experience} years (sourced: ${rec.years_source})`;
}

/** Build a draft block that preserves attribution_language. */
export function draftAttributionBlock(rec: ExperienceRecord): DraftAttributionBlock {
  const attr = preserveAttributionLanguage(rec);
  const value_display = formatValue(rec);
  const years_display = formatYears(rec);

  let body: string;
  switch (rec.experience_type) {
    case "L_AND_P_CORPORATE":
      body = [
        attr,
        rec.project_or_contract_name
          ? `Project/contract: ${rec.project_or_contract_name}.`
          : null,
        rec.buyer_name ? `Buyer: ${rec.buyer_name}.` : null,
        rec.scope_summary ? `Scope: ${rec.scope_summary}.` : null,
        value_display ? `Contract value: ${value_display}.` : null,
        years_display ? `Duration evidence: ${years_display}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
      break;
    case "MANAGEMENT_PRIOR_EXPERIENCE":
      body = [
        attr,
        `This is management prior experience for ${rec.person_name ?? "the named person"} while employed by ${rec.employer_name ?? "the prior employer"} — not L&P corporate past performance.`,
        rec.project_or_contract_name
          ? `Engagement: ${rec.project_or_contract_name}.`
          : null,
        value_display ? `Recorded value: ${value_display}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
      break;
    case "KEY_PERSONNEL_EXPERIENCE":
      body = [
        attr,
        `This is key personnel experience attributed to ${rec.person_name ?? "the named person"} — not L&P corporate past performance.`,
        rec.role_description ? `Role: ${rec.role_description}.` : null,
        rec.project_or_contract_name
          ? `Engagement: ${rec.project_or_contract_name}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      break;
    case "SUBCONTRACTOR_EXPERIENCE":
      body = [
        attr,
        `This is subcontractor experience performed by ${rec.subcontractor_name ?? "the named subcontractor"} — not L&P corporate past performance.`,
        rec.project_or_contract_name
          ? `Engagement: ${rec.project_or_contract_name}.`
          : null,
        value_display ? `Recorded value: ${value_display}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
      break;
    default:
      body = attr;
  }

  assertAttributionPreserved({
    experienceType: rec.experience_type,
    attributionLanguage: attr,
    draftText: body,
  });

  return {
    experience_type: rec.experience_type,
    attribution_language: attr,
    body,
    value_display,
    years_display,
  };
}

/** Assemble multiple blocks without merging types into one corporate claim. */
export function assembleTypedDraftSections(records: ExperienceRecord[]): {
  corporate: DraftAttributionBlock[];
  management_prior: DraftAttributionBlock[];
  key_personnel: DraftAttributionBlock[];
  subcontractor: DraftAttributionBlock[];
  combined_text: string;
} {
  const corporate: DraftAttributionBlock[] = [];
  const management_prior: DraftAttributionBlock[] = [];
  const key_personnel: DraftAttributionBlock[] = [];
  const subcontractor: DraftAttributionBlock[] = [];

  for (const r of records) {
    const block = draftAttributionBlock(r);
    switch (r.experience_type) {
      case "L_AND_P_CORPORATE":
        corporate.push(block);
        break;
      case "MANAGEMENT_PRIOR_EXPERIENCE":
        management_prior.push(block);
        break;
      case "KEY_PERSONNEL_EXPERIENCE":
        key_personnel.push(block);
        break;
      case "SUBCONTRACTOR_EXPERIENCE":
        subcontractor.push(block);
        break;
      default:
        break;
    }
  }

  const parts: string[] = [];
  if (corporate.length) {
    parts.push("## L&P corporate past performance\n" + corporate.map((b) => b.body).join("\n\n"));
  }
  if (management_prior.length) {
    parts.push(
      "## Management prior experience (not L&P corporate)\n" +
        management_prior.map((b) => b.body).join("\n\n"),
    );
  }
  if (key_personnel.length) {
    parts.push(
      "## Key personnel experience (not L&P corporate)\n" +
        key_personnel.map((b) => b.body).join("\n\n"),
    );
  }
  if (subcontractor.length) {
    parts.push(
      "## Subcontractor experience (not L&P corporate)\n" +
        subcontractor.map((b) => b.body).join("\n\n"),
    );
  }

  return {
    corporate,
    management_prior,
    key_personnel,
    subcontractor,
    combined_text: parts.join("\n\n"),
  };
}

/** Template strings for UI / tests — subject never flips. */
export const ATTRIBUTION_TEMPLATES: Record<
  ExperienceType,
  (opts: {
    project: string;
    person?: string;
    employer?: string;
    subcontractor?: string;
  }) => string
> = {
  L_AND_P_CORPORATE: ({ project }) =>
    `L&P Global Security performed this contract (${project}).`,
  MANAGEMENT_PRIOR_EXPERIENCE: ({ project, person, employer }) =>
    `${person ?? "Named manager"} performed work on ${project} while employed by ${employer ?? "prior employer"} — not L&P corporate past performance.`,
  KEY_PERSONNEL_EXPERIENCE: ({ project, person }) =>
    `${person ?? "Named key person"} holds experience on ${project} — attributed to the individual, not L&P corporate past performance.`,
  SUBCONTRACTOR_EXPERIENCE: ({ project, subcontractor }) =>
    `${subcontractor ?? "Named subcontractor"} performed ${project} as a subcontractor — not L&P corporate past performance.`,
};
