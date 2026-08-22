import type { ComparableFeature, PursuitComparableCandidate } from "./types";

function normalized(value: string | null): string | null {
  const text = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return text || null;
}

function tokenSimilarity(left: string | null, right: string | null): number | null {
  const a = normalized(left);
  const b = normalized(right);
  if (!a || !b) return null;
  if (a === b) return 1;
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union ? intersection / union : 0;
}

function exactFeature(
  key: ComparableFeature["key"],
  label: string,
  left: string | null,
  right: string | null,
): ComparableFeature {
  const a = normalized(left);
  const b = normalized(right);
  if (!a || !b) return { key, label, value: null, rationale: `${label}: missing on one or both pursuits.` };
  const value = a === b ? 1 : 0;
  return { key, label, value, rationale: `${label}: ${value ? "same" : "different"} (${left} vs ${right}).` };
}

function scaleFeature(target: number | null, candidate: number | null): ComparableFeature {
  if (target == null || candidate == null || target <= 0 || candidate <= 0) {
    return { key: "scale", label: "Recorded weekly hours", value: null, rationale: "Scale: weekly hours missing on one or both pursuits." };
  }
  const ratio = Math.min(target, candidate) / Math.max(target, candidate);
  return {
    key: "scale",
    label: "Recorded weekly hours",
    value: ratio,
    rationale: `Scale: ${candidate.toFixed(1)} vs ${target.toFixed(1)} weekly hours (${Math.round(ratio * 100)}% proportional match).`,
  };
}

function recencyFeature(referenceDate: string, candidateDate: string): ComparableFeature {
  const reference = Date.parse(referenceDate);
  const candidate = Date.parse(candidateDate);
  if (!Number.isFinite(reference) || !Number.isFinite(candidate)) {
    return { key: "recency", label: "Recency", value: null, rationale: "Recency: a usable date is missing." };
  }
  const years = Math.abs(reference - candidate) / (365.25 * 86_400_000);
  const value = Math.max(0, 1 - years / 8);
  return {
    key: "recency",
    label: "Recency",
    value,
    rationale: `Recency: ${years.toFixed(1)} year(s) apart; decays linearly to zero at 8 years.`,
  };
}

export function extractComparableFeatures(
  target: PursuitComparableCandidate,
  candidate: PursuitComparableCandidate,
  asOf = new Date().toISOString(),
): ComparableFeature[] {
  const service = tokenSimilarity(target.serviceType, candidate.serviceType);
  const geography = tokenSimilarity(target.siteLocation, candidate.siteLocation);
  return [
    exactFeature("buyer", "Buyer", target.clientId, candidate.clientId),
    {
      key: "service",
      label: "Service",
      value: service,
      rationale:
        service == null
          ? "Service: missing on one or both pursuits."
          : `Service: ${Math.round(service * 100)}% structured token overlap (${target.serviceType} vs ${candidate.serviceType}).`,
    },
    {
      key: "geography",
      label: "Geography",
      value: geography,
      rationale:
        geography == null
          ? "Geography: missing on one or both pursuits."
          : `Geography: ${Math.round(geography * 100)}% structured token overlap (${target.siteLocation} vs ${candidate.siteLocation}).`,
    },
    exactFeature("procurementRail", "Procurement rail", target.procurementRail, candidate.procurementRail),
    exactFeature("solicitationKind", "Solicitation kind", target.solicitationKind, candidate.solicitationKind),
    scaleFeature(target.weeklyHours, candidate.weeklyHours),
    recencyFeature(target.responseDueOn ?? asOf, candidate.responseDueOn ?? candidate.createdAt),
    {
      key: "outcome",
      label: "Recorded outcome",
      value: candidate.outcome ? 1 : 0,
      rationale: candidate.outcome ? `Outcome: ${candidate.outcome} is recorded.` : "Outcome: missing.",
    },
    {
      key: "pricing",
      label: "Verified pricing coverage",
      value: candidate.pricingLineCount > 0 ? 1 : 0,
      rationale:
        candidate.pricingLineCount > 0
          ? `Pricing: ${candidate.pricingLineCount} line(s) on file.`
          : "Pricing: no lines on file.",
    },
    {
      key: "proposalContent",
      label: "Reusable proposal content",
      value: candidate.proposalSectionCount > 0 ? 1 : 0,
      rationale:
        candidate.proposalSectionCount > 0
          ? `Proposal content: ${candidate.proposalSectionCount} eligible section(s) on file.`
          : "Proposal content: no eligible sections on file.",
    },
  ];
}
