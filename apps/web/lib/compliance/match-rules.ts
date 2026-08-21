/**
 * F12 pure match rules — deterministic advisory statuses.
 * VERIFIED_AVAILABLE requires HUMAN_VERIFIED inventory + source.
 * Missing source ≠ VERIFIED_AVAILABLE. Expired ≠ available. Never invent COI limits.
 */

import {
  EXPIRING_WINDOW_DAYS,
  hasComplianceSource,
  isHumanVerifiedInventory,
  type ComplianceInventoryItem,
  type CoverageLimits,
  type OrganizationRegistration,
  type RequirementComplianceMatchStatus,
} from "./types";

export type MatchRuleInput = {
  inventory: ComplianceInventoryItem | null;
  registration?: OrganizationRegistration | null;
  requiredCoverage?: CoverageLimits | null;
  requiredNaics?: string[] | null;
  /** ISO date YYYY-MM-DD */
  today: string;
  /** Human explicitly marked N/A */
  notApplicable?: boolean;
};

export type MatchRuleResult = {
  match_status: RequirementComplianceMatchStatus;
  rationale: string;
};

function daysUntil(expiresOn: string | null | undefined, today: string): number | null {
  if (!expiresOn) return null;
  const exp = Date.parse(expiresOn);
  const now = Date.parse(today);
  if (!Number.isFinite(exp) || !Number.isFinite(now)) return null;
  return Math.floor((exp - now) / 86_400_000);
}

function readLimit(coverage: CoverageLimits | Record<string, unknown> | null | undefined, key: keyof CoverageLimits): number | null {
  if (!coverage || typeof coverage !== "object") return null;
  const raw = (coverage as CoverageLimits)[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

/**
 * Compare required COI limits against recorded coverage_json.
 * Missing recorded limit when required → INSUFFICIENT (not invent).
 * Insufficient recorded amount → INSUFFICIENT.
 * All required present and ≥ → ok (caller still gates VERIFIED_AVAILABLE).
 */
export function compareCoiLimits(
  required: CoverageLimits | null | undefined,
  available: CoverageLimits | Record<string, unknown> | null | undefined,
): { ok: boolean; gaps: string[] } {
  if (!required) return { ok: true, gaps: [] };
  const gaps: string[] = [];
  const keys: (keyof CoverageLimits)[] = [
    "generalLiability",
    "automobile",
    "umbrella",
    "workersComp",
    "professionalLiability",
  ];
  for (const key of keys) {
    const need = required[key];
    if (need == null || typeof need !== "number") continue;
    const have = readLimit(available ?? null, key);
    if (have == null) {
      gaps.push(`${key}: required ${need}, recorded limit missing`);
    } else if (have < need) {
      gaps.push(`${key}: required ${need}, recorded ${have}`);
    }
  }
  if (required.other) {
    for (const [name, need] of Object.entries(required.other)) {
      if (need == null || typeof need !== "number") continue;
      const other = (available as CoverageLimits | null)?.other?.[name];
      const have = typeof other === "number" ? other : null;
      if (have == null) gaps.push(`other.${name}: required ${need}, recorded limit missing`);
      else if (have < need) gaps.push(`other.${name}: required ${need}, recorded ${have}`);
    }
  }
  return { ok: gaps.length === 0, gaps };
}

function naicsSatisfied(required: string[] | null | undefined, registration: OrganizationRegistration | null | undefined): boolean {
  if (!required || required.length === 0) return true;
  const have = new Set((registration?.naics ?? []).map((n) => n.trim()));
  return required.every((n) => have.has(n.trim()));
}

/**
 * Core match evaluator. Never returns VERIFIED_AVAILABLE unless inventory/registration
 * is HUMAN_VERIFIED and has source evidence.
 */
export function evaluateRequirementMatch(input: MatchRuleInput): MatchRuleResult {
  if (input.notApplicable) {
    return {
      match_status: "NOT_APPLICABLE",
      rationale: "Marked not applicable by a human operator.",
    };
  }

  const item = input.inventory;
  const reg = input.registration ?? null;

  if (!item && !reg) {
    return {
      match_status: "MISSING",
      rationale: "No compliance inventory item or organization registration on file for this requirement.",
    };
  }

  // Prefer compliance item when present; registration-only for SAM/NAICS-style reqs.
  if (item) {
    if (item.verification_status === "REJECTED") {
      return { match_status: "MISSING", rationale: "Linked inventory item is REJECTED." };
    }

    const days = daysUntil(item.expires_on, input.today);
    if (days != null && days < 0) {
      return {
        match_status: "MISSING",
        rationale: `Credential expired on ${item.expires_on} — not available.`,
      };
    }

    if (!hasComplianceSource(item)) {
      return {
        match_status: "UNKNOWN",
        rationale: "Missing source evidence — cannot treat as VERIFIED_AVAILABLE.",
      };
    }

    if (!isHumanVerifiedInventory(item.verification_status)) {
      return {
        match_status: "UNKNOWN",
        rationale: `Inventory is ${item.verification_status}, not HUMAN_VERIFIED — VERIFIED_AVAILABLE forbidden.`,
      };
    }

    if (input.requiredCoverage) {
      const { ok, gaps } = compareCoiLimits(input.requiredCoverage, item.coverage_json);
      if (!ok) {
        return {
          match_status: "INSUFFICIENT",
          rationale: `Recorded coverage below or missing required limits: ${gaps.join("; ")}.`,
        };
      }
    }

    if (days != null && days <= EXPIRING_WINDOW_DAYS) {
      return {
        match_status: "EXPIRING",
        rationale: `HUMAN_VERIFIED with source; expires in ${days} day(s) (≤${EXPIRING_WINDOW_DAYS}).`,
      };
    }

    return {
      match_status: "VERIFIED_AVAILABLE",
      rationale: "HUMAN_VERIFIED inventory with source evidence; in force and limits sufficient when checked.",
    };
  }

  // Registration-only path (SAM / NAICS)
  if (!reg) {
    return { match_status: "MISSING", rationale: "No organization registration on file." };
  }

  if (reg.verification_status === "REJECTED") {
    return { match_status: "MISSING", rationale: "Organization registration is REJECTED." };
  }

  const samDays = daysUntil(reg.sam_expiration_on, input.today);
  if (samDays != null && samDays < 0) {
    return {
      match_status: "MISSING",
      rationale: `SAM registration expired on ${reg.sam_expiration_on}.`,
    };
  }

  if (!hasComplianceSource(reg)) {
    return {
      match_status: "UNKNOWN",
      rationale: "Registration missing source — cannot treat as VERIFIED_AVAILABLE.",
    };
  }

  if (!isHumanVerifiedInventory(reg.verification_status)) {
    return {
      match_status: "UNKNOWN",
      rationale: `Registration is ${reg.verification_status}, not HUMAN_VERIFIED.`,
    };
  }

  if (!naicsSatisfied(input.requiredNaics, reg)) {
    return {
      match_status: "INSUFFICIENT",
      rationale: `Required NAICS not all recorded on HUMAN_VERIFIED registration (have: ${(reg.naics ?? []).join(", ") || "none"}).`,
    };
  }

  if (samDays != null && samDays <= EXPIRING_WINDOW_DAYS) {
    return {
      match_status: "EXPIRING",
      rationale: `HUMAN_VERIFIED SAM registration expires in ${samDays} day(s).`,
    };
  }

  return {
    match_status: "VERIFIED_AVAILABLE",
    rationale: "HUMAN_VERIFIED organization registration with source; SAM in force; NAICS satisfied when required.",
  };
}

/** Grep-proof guard used by promote/match writers. */
export function assertCanSetVerifiedAvailable(input: {
  verification_status: string;
  hasSource: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!isHumanVerifiedInventory(input.verification_status)) {
    return { ok: false, reason: "VERIFIED_AVAILABLE requires HUMAN_VERIFIED inventory" };
  }
  if (!input.hasSource) {
    return { ok: false, reason: "VERIFIED_AVAILABLE requires source evidence (missing source ≠ VERIFIED_AVAILABLE)" };
  }
  return { ok: true };
}
