/**
 * Promote gates for proposal sections → chunks.
 * HUMAN_VERIFIED only; chunk reuse defaults REVIEW_REQUIRED; never APPROVED from WON.
 */

import {
  canApproveReuse,
  defaultReuseAfterHumanVerify,
  isEmbedEligible,
  reuseStatusFromOutcome,
  type ContentReuseStatus,
  type ContentVerificationStatus,
  type OutcomeLabel,
} from "@/lib/content/reuse-policy";
import type { ExtractedSectionDto } from "@/lib/content/extract-sections";
import type { ProposalSectionKey } from "@/lib/content/taxonomy";

export type PromoteSectionInput = {
  organizationId: string;
  opportunityId: string;
  documentId: string | null;
  sourceFactId: string | null;
  contentRunId?: string | null;
  sectionKey: ProposalSectionKey | string;
  title: string;
  bodyText: string;
  verificationStatus: ContentVerificationStatus;
  reuseStatus?: ContentReuseStatus | null;
  buyerName?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  outcomeSnapshot?: OutcomeLabel | null;
  /** When true, attempt chunk promote via RPC after upsert. */
  promoteChunk?: boolean;
};

export type PromoteGateResult =
  | { ok: true; reuseStatus: ContentReuseStatus; embedEligible: boolean }
  | { ok: false; reason: string };

export function evaluatePromoteGate(input: {
  verificationStatus: ContentVerificationStatus;
  requestedReuse?: ContentReuseStatus | null;
  outcomeSnapshot?: OutcomeLabel | null;
}): PromoteGateResult {
  if (input.verificationStatus !== "HUMAN_VERIFIED") {
    return { ok: false, reason: "Only HUMAN_VERIFIED sections may promote to searchable knowledge." };
  }

  // Outcome never drives reuse.
  void reuseStatusFromOutcome(input.outcomeSnapshot);

  let reuse = input.requestedReuse ?? defaultReuseAfterHumanVerify();
  if (reuse === "APPROVED" && !canApproveReuse(input.verificationStatus)) {
    return { ok: false, reason: "APPROVED requires HUMAN_VERIFIED; Won ≠ auto-approve." };
  }
  // Fresh promote never auto-APPROVED — force REVIEW_REQUIRED unless human already set APPROVED/DO_NOT_USE.
  if (reuse !== "APPROVED" && reuse !== "DO_NOT_USE" && reuse !== "SUPERSEDED") {
    reuse = "REVIEW_REQUIRED";
  }

  return {
    ok: true,
    reuseStatus: reuse,
    embedEligible: isEmbedEligible({
      verificationStatus: input.verificationStatus,
      reuseStatus: reuse,
    }),
  };
}

export function sectionRowFromExtracted(
  dto: ExtractedSectionDto,
  opts: { organizationId: string; opportunityId: string; contentRunId?: string | null },
): Record<string, unknown> {
  return {
    organization_id: opts.organizationId,
    opportunity_id: opts.opportunityId,
    source_document_id: dto.provenance.document_id ?? null,
    content_run_id: opts.contentRunId ?? null,
    section_key: dto.section_key,
    title: dto.title,
    body_text: dto.body_text,
    excerpt: dto.provenance.source_text_excerpt.slice(0, 2000),
    verification_status: "AI_EXTRACTED",
    reuse_status: null,
    buyer_name: dto.provenance.buyer_name ?? null,
    page_start: dto.page_start,
    page_end: dto.page_end,
    source_page: dto.source_page,
    outcome_snapshot: null,
  };
}

/** Loose Supabase-compatible client for testability. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContentDb = { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

export async function promoteVerifiedSection(
  db: ContentDb,
  input: PromoteSectionInput,
): Promise<{ ok: boolean; sectionId?: string; chunked?: boolean; embedEligible?: boolean; message?: string }> {
  const gate = evaluatePromoteGate({
    verificationStatus: input.verificationStatus,
    requestedReuse: input.reuseStatus,
    outcomeSnapshot: input.outcomeSnapshot,
  });
  if (!gate.ok) return { ok: false, message: gate.reason };

  const row = {
    organization_id: input.organizationId,
    opportunity_id: input.opportunityId,
    source_document_id: input.documentId,
    source_fact_id: input.sourceFactId,
    content_run_id: input.contentRunId ?? null,
    section_key: input.sectionKey,
    title: input.title.slice(0, 200),
    body_text: input.bodyText,
    excerpt: input.bodyText.slice(0, 2000),
    verification_status: "HUMAN_VERIFIED" as const,
    reuse_status: gate.reuseStatus,
    buyer_name: input.buyerName ?? null,
    page_start: input.pageStart ?? null,
    page_end: input.pageEnd ?? null,
    source_page: input.pageStart ?? null,
    outcome_snapshot: input.outcomeSnapshot ? String(input.outcomeSnapshot).slice(0, 64) : null,
  };

  const { data, error } = await db
    .from("proposal_sections")
    .upsert(row, { onConflict: "organization_id,opportunity_id,section_key" })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  const sectionId = data?.id as string | undefined;

  let chunked = false;
  if (input.promoteChunk && input.sourceFactId) {
    const { data: chunkResult, error: chunkErr } = await db.rpc("promote_knowledge_chunk_from_fact", {
      p_fact_id: input.sourceFactId,
    });
    if (chunkErr) return { ok: false, sectionId, message: chunkErr.message };
    chunked = Boolean(chunkResult && (chunkResult as { ok?: boolean }).ok);
  }

  return {
    ok: true,
    sectionId,
    chunked,
    embedEligible: gate.embedEligible,
  };
}

/** Call only when embedEligible — embeddings from HUMAN_VERIFIED eligible text only. */
export async function enqueueEmbedIfEligible(
  embedFn: (sourceFactId: string) => Promise<void>,
  opts: {
    sourceFactId: string | null | undefined;
    verificationStatus: ContentVerificationStatus;
    reuseStatus: ContentReuseStatus | null | undefined;
  },
): Promise<boolean> {
  if (!opts.sourceFactId) return false;
  if (
    !isEmbedEligible({
      verificationStatus: opts.verificationStatus,
      reuseStatus: opts.reuseStatus,
    })
  ) {
    return false;
  }
  await embedFn(opts.sourceFactId);
  return true;
}
