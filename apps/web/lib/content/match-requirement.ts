/**
 * Match a requirement statement to verified proposal content under PROPOSAL_DRAFTING.
 * Empty → L&P INPUT REQUIRED pattern. Never dumps full proposals.
 */

import { searchVerifiedKnowledge, type KnowledgeHit } from "@/lib/retrieval/search";
import {
  buildGroundedDraftFromHits,
  classifyEvidenceFromHits,
  type EvidenceState,
  type GroundedDraftResult,
} from "@/lib/opportunity/response";

export const LP_INPUT_REQUIRED_PREFIX = "L&P INPUT REQUIRED";

export type MatchRequirementResult = {
  hits: KnowledgeHit[];
  evidenceState: EvidenceState;
  citations: {
    chunk_id: string;
    reuse_status: string;
    source_page: number | null;
    document_id: string;
    excerpt: string;
  }[];
  grounded: GroundedDraftResult;
  lpInputRequired: boolean;
  error: string | null;
};

export async function matchRequirementToProposalContent(opts: {
  requirementStatement: string;
  opportunityId?: string | null;
  limit?: number;
  queryEmbedding?: number[] | null;
}): Promise<MatchRequirementResult> {
  const statement = opts.requirementStatement.trim();
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 12);

  if (!statement) {
    const grounded = buildGroundedDraftFromHits({
      requirementStatement: "",
      hits: [],
    });
    return {
      hits: [],
      evidenceState: "L_AND_P_INPUT_REQUIRED",
      citations: [],
      grounded,
      lpInputRequired: true,
      error: null,
    };
  }

  const { hits, error } = await searchVerifiedKnowledge({
    query: statement,
    purpose: "PROPOSAL_DRAFTING",
    opportunityId: opts.opportunityId,
    limit,
    queryEmbedding: opts.queryEmbedding,
  });

  const evidenceState = classifyEvidenceFromHits(hits);
  const citations = hits.slice(0, limit).map((h) => ({
    chunk_id: h.chunk_id,
    reuse_status: h.reuse_status,
    source_page: h.source_page,
    document_id: h.document_id,
    excerpt: h.content.slice(0, 240),
  }));

  const grounded = buildGroundedDraftFromHits({
    requirementStatement: statement,
    hits: hits.map((h) => ({
      chunk_id: h.chunk_id,
      reuse_status: h.reuse_status,
      content: h.content,
    })),
  });

  const lpInputRequired =
    evidenceState === "L_AND_P_INPUT_REQUIRED" ||
    grounded.missing_information.startsWith(LP_INPUT_REQUIRED_PREFIX);

  return {
    hits,
    evidenceState,
    citations,
    grounded,
    lpInputRequired,
    error,
  };
}
