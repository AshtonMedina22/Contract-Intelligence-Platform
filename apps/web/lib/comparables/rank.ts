import { scoreComparable } from "./score";
import type { ComparablePurpose, ComparableScore, PursuitComparableCandidate } from "./types";

export function rankComparablePursuits(input: {
  target: PursuitComparableCandidate;
  candidates: readonly PursuitComparableCandidate[];
  purpose: ComparablePurpose;
  limit?: number;
  asOf?: string;
}): ComparableScore[] {
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 50);
  return input.candidates
    .filter((candidate) => candidate.id !== input.target.id && candidate.authority.eligible)
    .map((candidate) => scoreComparable({ target: input.target, candidate, purpose: input.purpose, asOf: input.asOf }))
    .sort(
      (left, right) =>
        right.totalScore - left.totalScore ||
        right.structuredScore - left.structuredScore ||
        Date.parse(right.candidate.createdAt) - Date.parse(left.candidate.createdAt) ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .slice(0, limit);
}
