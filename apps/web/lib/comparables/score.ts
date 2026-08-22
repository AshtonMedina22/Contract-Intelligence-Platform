import { buildComparableCaveats } from "./caveats";
import { extractComparableFeatures } from "./features";
import { semanticSupplement } from "./semantic";
import type { ComparablePurpose, ComparableScore, PursuitComparableCandidate } from "./types";
import { ALGORITHM_VERSION, PURPOSE_WEIGHTS } from "./weights";

export function scoreComparable(input: {
  target: PursuitComparableCandidate;
  candidate: PursuitComparableCandidate;
  purpose: ComparablePurpose;
  asOf?: string;
}): ComparableScore {
  const weights = PURPOSE_WEIGHTS[input.purpose];
  const contributions = extractComparableFeatures(input.target, input.candidate, input.asOf).map((feature) => {
    const weight = weights[feature.key];
    const points = feature.value == null ? 0 : feature.value * weight;
    return { ...feature, weight, points: Math.round(points * 100) / 100 };
  });
  const structuredScore = Math.round(contributions.reduce((sum, item) => sum + item.points, 0) * 100) / 100;
  const coverageWeight = contributions
    .filter((item) => item.value != null)
    .reduce((sum, item) => sum + item.weight, 0);
  const semantic = semanticSupplement(input.candidate.semanticSimilarity);
  const result: ComparableScore = {
    algorithmVersion: ALGORITHM_VERSION,
    purpose: input.purpose,
    candidate: input.candidate,
    structuredScore,
    semanticSupplement: semantic,
    totalScore: Math.round((structuredScore + semantic) * 100) / 100,
    coverageWeight,
    contributions,
    rationale: contributions
      .filter((item) => item.weight > 0)
      .sort((a, b) => b.points - a.points || b.weight - a.weight)
      .map((item) => `${item.label}: ${item.points.toFixed(2)}/${item.weight}. ${item.rationale}`),
    caveats: [],
  };
  result.caveats = buildComparableCaveats(result);
  return result;
}
