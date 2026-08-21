/**
 * F12 eligibility rollup — deterministic advisory with hard caveat.
 * Never GPT legal opinion. Never gates submit/rebid.
 */

import {
  ELIGIBILITY_HARD_CAVEAT,
  type RequirementComplianceMatchStatus,
} from "./types";

export type EligibilityMatchInput = {
  match_status: RequirementComplianceMatchStatus | string;
  requirement_id?: string;
  rationale?: string | null;
};

export type EligibilityRollup = {
  counts: Record<RequirementComplianceMatchStatus, number>;
  total: number;
  blocking: number;
  advisoryHeadline: string;
  caveats: string[];
  /** Always present — operators must see this. */
  hardCaveat: typeof ELIGIBILITY_HARD_CAVEAT;
  /** Never true — reserved so callers cannot invent a legal green light. */
  legalEligibilityDeclared: false;
};

const BLOCKING_STATUSES: ReadonlySet<string> = new Set(["MISSING", "INSUFFICIENT"]);

export function rollupEligibility(matches: EligibilityMatchInput[]): EligibilityRollup {
  const counts: Record<RequirementComplianceMatchStatus, number> = {
    VERIFIED_AVAILABLE: 0,
    EXPIRING: 0,
    MISSING: 0,
    INSUFFICIENT: 0,
    UNKNOWN: 0,
    NOT_APPLICABLE: 0,
  };

  for (const m of matches) {
    const s = m.match_status as RequirementComplianceMatchStatus;
    if (s in counts) counts[s] += 1;
    else counts.UNKNOWN += 1;
  }

  const total = matches.length;
  const blocking = matches.filter((m) => BLOCKING_STATUSES.has(m.match_status)).length;
  const unknown = counts.UNKNOWN;
  const expiring = counts.EXPIRING;
  const available = counts.VERIFIED_AVAILABLE;

  let advisoryHeadline: string;
  if (total === 0) {
    advisoryHeadline =
      "No requirement↔compliance matches recorded — eligibility unknown, not clear.";
  } else if (blocking > 0) {
    advisoryHeadline = `${blocking} match(es) MISSING or INSUFFICIENT among ${total} recorded — review before bid.`;
  } else if (unknown > 0) {
    advisoryHeadline = `${unknown} UNKNOWN match(es) among ${total} — evidence incomplete; not verified available.`;
  } else if (expiring > 0) {
    advisoryHeadline = `${expiring} EXPIRING and ${available} VERIFIED_AVAILABLE among ${total} — renew before relying.`;
  } else {
    advisoryHeadline = `${available} VERIFIED_AVAILABLE among ${total} recorded matches — still advisory only.`;
  }

  const caveats = [
    ELIGIBILITY_HARD_CAVEAT,
    "VERIFIED_AVAILABLE requires HUMAN_VERIFIED inventory with source evidence.",
    "Absence of a match is not evidence of compliance.",
  ];

  return {
    counts,
    total,
    blocking,
    advisoryHeadline,
    caveats,
    hardCaveat: ELIGIBILITY_HARD_CAVEAT,
    legalEligibilityDeclared: false,
  };
}

export { ELIGIBILITY_HARD_CAVEAT };
