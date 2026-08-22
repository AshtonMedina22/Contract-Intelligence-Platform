export * from "./authority";
export * from "./caveats";
export * from "./features";
export * from "./load-candidates";
export * from "./rank";
export * from "./score";
export * from "./semantic";
export * from "./types";
export * from "./weights";

import { loadComparableCandidates } from "./load-candidates";
import { rankComparablePursuits } from "./rank";
import type { ComparablePurpose } from "./types";

export async function loadRankedComparablePursuits(input: {
  targetOpportunityId: string;
  purpose: ComparablePurpose;
  limit?: number;
}) {
  const { target, candidates } = await loadComparableCandidates(input);
  if (!target) return [];
  return rankComparablePursuits({ target, candidates, purpose: input.purpose, limit: input.limit });
}
