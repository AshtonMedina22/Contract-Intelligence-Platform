/**
 * Match a requirement statement to verified proposal content under PROPOSAL_DRAFTING.
 * Empty → L&P INPUT REQUIRED pattern. Never dumps full proposals.
 * F14: past_performance requirements prefer typed experience_records; attribution preserved.
 */

import { searchVerifiedKnowledge, type KnowledgeHit } from "@/lib/retrieval/search";
import {
  buildGroundedDraftFromHits,
  classifyEvidenceFromHits,
  type EvidenceState,
  type GroundedDraftResult,
} from "@/lib/opportunity/response";
import { isPastPerformanceRequirement } from "@/lib/experience/match";
import { draftAttributionBlock, assembleTypedDraftSections } from "@/lib/experience/draft-attribution";
import {
  retrieveCorporatePastPerformance,
  retrieveExperienceByType,
} from "@/lib/experience/retrieve";
import type { ExperienceRecord } from "@/lib/experience/types";
import { createClient } from "@/lib/supabase/server";

export const LP_INPUT_REQUIRED_PREFIX = "L&P INPUT REQUIRED";

export type ExperienceCitation = {
  experience_record_id: string;
  experience_type: string;
  attribution_language: string;
  verification_status: string;
  project_or_contract_name: string;
  document_id: string | null;
  source_page: number | null;
  draft_body: string;
};

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
  /** F14 typed experience matches — attribution_language never rewritten. */
  experienceCitations: ExperienceCitation[];
  experienceDraftSupplement: string | null;
};

async function loadPastPerformanceExperience(statement: string): Promise<{
  records: ExperienceRecord[];
  citations: ExperienceCitation[];
  supplement: string | null;
}> {
  if (!isPastPerformanceRequirement(statement)) {
    return { records: [], citations: [], supplement: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { records: [], citations: [], supplement: null };

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { records: [], citations: [], supplement: null };

  const orgId = membership.organization_id;

  // Prefer corporate PP for "past performance" language; also surface typed others separately.
  const [corporate, management, personnel, sub] = await Promise.all([
    retrieveCorporatePastPerformance(supabase, orgId, { limit: 8 }),
    retrieveExperienceByType(supabase, orgId, "MANAGEMENT_PRIOR_EXPERIENCE", {
      limit: 4,
      requireHumanVerified: true,
    }),
    retrieveExperienceByType(supabase, orgId, "KEY_PERSONNEL_EXPERIENCE", {
      limit: 4,
      requireHumanVerified: true,
    }),
    retrieveExperienceByType(supabase, orgId, "SUBCONTRACTOR_EXPERIENCE", {
      limit: 4,
      requireHumanVerified: true,
    }),
  ]);

  const records = [...corporate, ...management, ...personnel, ...sub];
  const citations: ExperienceCitation[] = records.map((r) => {
    const block = draftAttributionBlock(r);
    return {
      experience_record_id: r.id,
      experience_type: String(r.experience_type),
      attribution_language: block.attribution_language,
      verification_status: String(r.verification_status),
      project_or_contract_name: r.project_or_contract_name,
      document_id: r.source_document_id ?? null,
      source_page: r.source_page ?? null,
      draft_body: block.body,
    };
  });

  const assembled = assembleTypedDraftSections(records);
  return {
    records,
    citations,
    supplement: assembled.combined_text || null,
  };
}

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
      experienceCitations: [],
      experienceDraftSupplement: null,
    };
  }

  const { hits, error } = await searchVerifiedKnowledge({
    query: statement,
    purpose: "PROPOSAL_DRAFTING",
    opportunityId: opts.opportunityId,
    limit,
    queryEmbedding: opts.queryEmbedding,
  });

  const experience = await loadPastPerformanceExperience(statement);

  const evidenceState = classifyEvidenceFromHits(hits);
  const citations = hits.slice(0, limit).map((h) => ({
    chunk_id: h.chunk_id,
    reuse_status: h.reuse_status,
    source_page: h.source_page,
    document_id: h.document_id,
    excerpt: h.content.slice(0, 240),
  }));

  let grounded = buildGroundedDraftFromHits({
    requirementStatement: statement,
    hits: hits.map((h) => ({
      chunk_id: h.chunk_id,
      reuse_status: h.reuse_status,
      content: h.content,
    })),
  });

  // Prefer typed experience for PP requirements — append typed sections; preserve attribution.
  if (experience.supplement) {
    const draft = [grounded.draft_response, experience.supplement].filter(Boolean).join("\n\n");
    grounded = {
      ...grounded,
      draft_response: draft,
      assumptions:
        (grounded.assumptions ? grounded.assumptions + " " : "") +
        "Typed experience_records used for past-performance; attribution_language preserved; types not merged.",
    };
  }

  const lpInputRequired =
    evidenceState === "L_AND_P_INPUT_REQUIRED" ||
    grounded.missing_information.startsWith(LP_INPUT_REQUIRED_PREFIX);

  // If PP requirement and we have corporate citations, soften empty-chunk L&P INPUT when typed PP exists.
  const hasCorporate = experience.citations.some((c) => c.experience_type === "L_AND_P_CORPORATE");
  const effectiveLpInput =
    hasCorporate && isPastPerformanceRequirement(statement) ? false : lpInputRequired;

  return {
    hits,
    evidenceState: hasCorporate ? "VERIFIED_DRAFT_AVAILABLE" : evidenceState,
    citations,
    grounded: hasCorporate
      ? {
          ...grounded,
          evidence_state: "VERIFIED_DRAFT_AVAILABLE",
          missing_information: grounded.missing_information.startsWith(LP_INPUT_REQUIRED_PREFIX)
            ? ""
            : grounded.missing_information,
        }
      : grounded,
    lpInputRequired: effectiveLpInput,
    error,
    experienceCitations: experience.citations,
    experienceDraftSupplement: experience.supplement,
  };
}
