/**
 * Server-side helpers to create a change run after addendum/Q&A promote.
 */

import type { createClient } from "@/lib/supabase/server";
import { buildChangeRunDraft } from "./runs";
import type { SolicitationSnapshot } from "./detect-changes";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadBaselineSnapshot(
  supabase: Supabase,
  organizationId: string,
  solicitationId: string,
): Promise<SolicitationSnapshot> {
  const [{ data: reqs }, { data: forms }] = await Promise.all([
    supabase
      .from("requirements")
      .select("id, statement, section_ref, mandatory, superseded_by_id")
      .eq("organization_id", organizationId)
      .eq("solicitation_id", solicitationId)
      .limit(500),
    supabase
      .from("required_forms")
      .select("id, form_name, section_ref")
      .eq("organization_id", organizationId)
      .eq("solicitation_id", solicitationId)
      .limit(200),
  ]);

  const requirements = (reqs ?? [])
    .filter((r) => !(r as { superseded_by_id?: string | null }).superseded_by_id)
    .map((r) => ({
      id: r.id,
      statement: r.statement,
      section_ref: r.section_ref,
      mandatory: r.mandatory,
    }));

  return {
    requirements,
    forms: (forms ?? []).map((f) => ({
      id: f.id,
      form_name: f.form_name,
      section_ref: f.section_ref,
    })),
    deadlines: [],
    pricingHints: [],
    qaPairs: [],
  };
}

export async function createChangeRunAfterPromote(
  supabase: Supabase,
  input: {
    organizationId: string;
    solicitationId: string;
    opportunityId?: string | null;
    triggerKind: "ADDENDUM" | "Q_AND_A" | "CLARIFICATION";
    triggerAddendumId?: string | null;
    triggerQaId?: string | null;
    triggerDocumentId?: string | null;
    triggerDocumentVersionId?: string | null;
    createdBy?: string | null;
    titleOrNumber?: string | null;
    notes?: string | null;
    questionText?: string | null;
    answerText?: string | null;
    sectionRef?: string | null;
    dueOn?: string | null;
    candidateOverride?: SolicitationSnapshot;
  },
): Promise<{ runId: string; itemCount: number } | { error: string }> {
  const baseline = await loadBaselineSnapshot(
    supabase,
    input.organizationId,
    input.solicitationId,
  );

  const candidate: SolicitationSnapshot = input.candidateOverride ?? {
    requirements: [],
    forms: [],
    pricingHints: [],
    deadlines: input.dueOn ? [{ kind: "response", due_on: input.dueOn }] : [],
    qaPairs:
      input.questionText || input.answerText
        ? [
            {
              question: input.questionText ?? input.titleOrNumber ?? "Clarification",
              answer: input.answerText ?? input.notes ?? null,
              section_ref: input.sectionRef ?? null,
            },
          ]
        : [],
    scopeNotes:
      input.triggerKind === "ADDENDUM"
        ? (input.notes ??
          `Addendum promoted: ${input.titleOrNumber ?? input.triggerAddendumId ?? "unknown"}`)
        : null,
  };

  if (
    !(candidate.requirements?.length ||
      candidate.forms?.length ||
      candidate.pricingHints?.length ||
      candidate.deadlines?.length ||
      candidate.qaPairs?.length ||
      candidate.scopeNotes)
  ) {
    candidate.scopeNotes = `Change trigger ${input.triggerKind} promoted without structured extract.`;
  }

  const draft = buildChangeRunDraft({
    organizationId: input.organizationId,
    solicitationId: input.solicitationId,
    opportunityId: input.opportunityId,
    triggerKind: input.triggerKind,
    triggerAddendumId: input.triggerAddendumId,
    triggerQaId: input.triggerQaId,
    triggerDocumentId: input.triggerDocumentId,
    triggerDocumentVersionId: input.triggerDocumentVersionId,
    createdBy: input.createdBy,
    baseline,
    candidate,
  });

  // Tables land in F11 migration; cast until database.types regenerates.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: run, error: runError } = await db
    .from("solicitation_change_runs")
    .insert(draft.run)
    .select("id")
    .single();

  if (runError || !run) {
    return { error: runError?.message ?? "Failed to create change run." };
  }

  if (draft.items.length > 0) {
    const { error: itemError } = await db.from("solicitation_change_items").insert(
      draft.items.map((item) => ({
        ...item,
        change_run_id: run.id,
      })),
    );
    if (itemError) return { error: itemError.message };
  }

  return { runId: run.id as string, itemCount: draft.items.length };
}
