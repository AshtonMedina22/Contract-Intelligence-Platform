import type { ComparableFeatureKey, ComparablePurpose } from "./types";

export const ALGORITHM_VERSION = "f22-structured-v1.0.0";
export const STRUCTURED_SCORE_MAX = 85;
export const SEMANTIC_SUPPLEMENT_MAX = 15;

export type PurposeWeights = Readonly<Record<ComparableFeatureKey, number>>;

/**
 * Every purpose totals 85 structured points. Semantic similarity may add at most 15 points and is
 * never used when unavailable. Version this table whenever weights or feature semantics change.
 */
export const PURPOSE_WEIGHTS: Readonly<Record<ComparablePurpose, PurposeWeights>> = {
  BID_STRATEGY: {
    buyer: 18,
    service: 20,
    geography: 8,
    procurementRail: 8,
    solicitationKind: 7,
    scale: 8,
    recency: 7,
    outcome: 5,
    pricing: 2,
    proposalContent: 2,
  },
  PRICING_COMPARABLE: {
    buyer: 12,
    service: 20,
    geography: 10,
    procurementRail: 5,
    solicitationKind: 4,
    scale: 16,
    recency: 10,
    outcome: 2,
    pricing: 6,
    proposalContent: 0,
  },
  PROPOSAL_CONTENT: {
    buyer: 8,
    service: 23,
    geography: 5,
    procurementRail: 9,
    solicitationKind: 9,
    scale: 5,
    recency: 7,
    outcome: 3,
    pricing: 0,
    proposalContent: 16,
  },
  WIN_LOSS_ANALYSIS: {
    buyer: 13,
    service: 18,
    geography: 7,
    procurementRail: 8,
    solicitationKind: 7,
    scale: 7,
    recency: 8,
    outcome: 12,
    pricing: 3,
    proposalContent: 2,
  },
};

for (const [purpose, weights] of Object.entries(PURPOSE_WEIGHTS)) {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (total !== STRUCTURED_SCORE_MAX) {
    throw new Error(`${purpose} comparable weights must total ${STRUCTURED_SCORE_MAX}; received ${total}.`);
  }
}
