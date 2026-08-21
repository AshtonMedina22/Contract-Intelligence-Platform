/**
 * F11 change runs — create AI draft run after addendum/Q&A promote.
 * Items stay AI_EXTRACTED until human verify.promote.
 */

import {
  DETECTOR_VERSION,
  type SolicitationChangeTriggerKind,
} from "./change-types";
import {
  detectSolicitationChanges,
  type DetectedChangeItem,
  type SolicitationSnapshot,
} from "./detect-changes";

export type CreateChangeRunInput = {
  organizationId: string;
  solicitationId: string;
  opportunityId?: string | null;
  triggerKind: SolicitationChangeTriggerKind;
  triggerAddendumId?: string | null;
  triggerQaId?: string | null;
  triggerDocumentId?: string | null;
  triggerDocumentVersionId?: string | null;
  baseDocumentId?: string | null;
  createdBy?: string | null;
  baseline: SolicitationSnapshot;
  candidate: SolicitationSnapshot;
};

export type ChangeRunDraft = {
  run: {
    organization_id: string;
    solicitation_id: string;
    opportunity_id: string | null;
    trigger_kind: SolicitationChangeTriggerKind;
    trigger_addendum_id: string | null;
    trigger_qa_id: string | null;
    trigger_document_id: string | null;
    trigger_document_version_id: string | null;
    base_document_id: string | null;
    status: "AI_EXTRACTED";
    summary_json: Record<string, unknown>;
    detector_version: string;
    created_by: string | null;
  };
  items: Array<{
    organization_id: string;
    change_type: string;
    fingerprint: string;
    target_table: string | null;
    target_id: string | null;
    before_text: string | null;
    after_text: string | null;
    before_json: Record<string, unknown> | null;
    after_json: Record<string, unknown> | null;
    confidence: string;
    ambiguity_reason: string | null;
    verification_status: "AI_EXTRACTED" | "NEEDS_REVIEW" | "CONFLICT";
    impact_flags: Record<string, unknown>;
  }>;
};

export function buildChangeRunDraft(input: CreateChangeRunInput): ChangeRunDraft {
  const triggerForDetect =
    input.triggerKind === "BASELINE"
      ? undefined
      : (input.triggerKind as "ADDENDUM" | "Q_AND_A" | "CLARIFICATION");

  const detected = detectSolicitationChanges(input.baseline, input.candidate, {
    triggerKind: triggerForDetect,
  });

  return {
    run: {
      organization_id: input.organizationId,
      solicitation_id: input.solicitationId,
      opportunity_id: input.opportunityId ?? null,
      trigger_kind: input.triggerKind,
      trigger_addendum_id: input.triggerAddendumId ?? null,
      trigger_qa_id: input.triggerQaId ?? null,
      trigger_document_id: input.triggerDocumentId ?? null,
      trigger_document_version_id: input.triggerDocumentVersionId ?? null,
      base_document_id: input.baseDocumentId ?? null,
      status: "AI_EXTRACTED",
      summary_json: { ...detected.summary },
      detector_version: DETECTOR_VERSION,
      created_by: input.createdBy ?? null,
    },
    items: detected.items.map((item: DetectedChangeItem) => ({
      organization_id: input.organizationId,
      change_type: item.change_type,
      fingerprint: item.fingerprint,
      target_table: item.target_table,
      target_id: item.target_id,
      before_text: item.before_text,
      after_text: item.after_text,
      before_json: item.before_json,
      after_json: item.after_json,
      confidence: item.confidence,
      ambiguity_reason: item.ambiguity_reason,
      verification_status: item.verification_status,
      impact_flags: item.impact_flags,
    })),
  };
}

/**
 * Persist helper shape for server actions — insert run then items.
 * Caller supplies supabase client; this stays pure aside from the I/O callback.
 */
export async function persistChangeRunDraft<TRun extends { id: string }>(
  draft: ChangeRunDraft,
  insert: {
    insertRun: (row: ChangeRunDraft["run"]) => Promise<TRun>;
    insertItems: (
      rows: Array<ChangeRunDraft["items"][number] & { change_run_id: string }>,
    ) => Promise<void>;
  },
): Promise<{ runId: string; itemCount: number }> {
  const run = await insert.insertRun(draft.run);
  if (draft.items.length > 0) {
    await insert.insertItems(
      draft.items.map((item) => ({
        ...item,
        change_run_id: run.id,
      })),
    );
  }
  return { runId: run.id, itemCount: draft.items.length };
}
