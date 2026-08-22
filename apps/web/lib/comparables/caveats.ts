import type { ComparableScore } from "./types";

export const COMPARABLE_CAUSATION_CAVEAT =
  "Similarity describes recorded peer characteristics; it does not establish causation, win probability, or a winning price.";

export const HUMAN_PRICING_CAVEAT =
  "Engine ranking is a proposal only. Recorded human include/exclude judgments and the human final pricing decision remain authoritative.";

export function buildComparableCaveats(score: Pick<ComparableScore, "candidate" | "coverageWeight" | "semanticSupplement">): string[] {
  const caveats = [COMPARABLE_CAUSATION_CAVEAT];
  if (score.coverageWeight < 60) caveats.push(`Structured field coverage is limited (${score.coverageWeight}/85 weighted points observed).`);
  if (score.semanticSupplement === 0) caveats.push("No compatible F21 semantic supplement was available; the score is structured-only.");
  if (score.candidate.authority.historicalLabel !== "L&P historical") caveats.push(score.candidate.authority.reason);
  return caveats;
}
