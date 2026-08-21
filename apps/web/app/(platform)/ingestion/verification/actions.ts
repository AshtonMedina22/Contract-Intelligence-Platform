"use server";

import { revalidatePath } from "next/cache";
import { resumeHook } from "workflow/api";
import { verificationHookToken } from "@lp/shared/verification-hook";
import { createClient } from "@/lib/supabase/server";
import { embedVerifiedChunk } from "@/lib/search/embed-chunk";
import { getJobPort } from "@/lib/jobs/get-job-port";
import { identityTarget } from "@/lib/verification/identity";
import { requirePermission } from "@/lib/auth/permissions";
import { createChangeRunAfterPromote } from "@/lib/solicitation/create-run";
import type { FactVerificationStatus } from "@/lib/supabase/database.types";

export type VerificationActionResult = { error?: string; ok?: true };

const OPEN_STATUSES: FactVerificationStatus[] = ["AI_EXTRACTED", "NEEDS_REVIEW", "CONFLICT"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("You must be signed in.");
  }
  return { supabase, user };
}

async function loadFact(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("extracted_facts")
    .select(
      "id, organization_id, document_id, field, entity, raw_value, normalized_value, verified_value, verification_status",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? "Fact not found.");
  }
  await requirePermission(supabase, user.id, data.organization_id, "verify.promote");
  return { supabase, user, fact: data };
}

async function recordEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    organizationId: string;
    factId: string | null;
    actorId: string;
    action: string;
    fromStatus: FactVerificationStatus | null;
    toStatus: FactVerificationStatus | null;
    note?: string | null;
  },
) {
  const { error } = await supabase.from("verification_events").insert({
    organization_id: input.organizationId,
    extracted_fact_id: input.factId,
    actor_id: input.actorId,
    action: input.action,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

type PromoteJson = { ok?: boolean; action?: string; addendum_id?: string; qa_id?: string; solicitation_id?: string } | null;

async function maybeCreateSolicitationChangeRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  fact: { organization_id: string; document_id: string; verified_value: string | null; normalized_value: string | null; raw_value: string | null },
  addendumResult: unknown,
  qaResult: unknown,
) {
  const addendum = addendumResult as PromoteJson;
  const qa = qaResult as PromoteJson;

  if (addendum?.ok && addendum.action === "addendum" && addendum.solicitation_id && addendum.addendum_id) {
    const { data: sol } = await supabase
      .from("solicitations")
      .select("opportunity_id")
      .eq("id", addendum.solicitation_id)
      .maybeSingle();
    await createChangeRunAfterPromote(supabase, {
      organizationId: fact.organization_id,
      solicitationId: addendum.solicitation_id,
      opportunityId: sol?.opportunity_id ?? null,
      triggerKind: "ADDENDUM",
      triggerAddendumId: addendum.addendum_id,
      triggerDocumentId: fact.document_id,
      createdBy: actorId,
      titleOrNumber: fact.verified_value ?? fact.normalized_value ?? fact.raw_value,
    });
    return;
  }

  if (qa?.ok && qa.action === "q_and_a" && qa.solicitation_id && qa.qa_id) {
    const { data: sol } = await supabase
      .from("solicitations")
      .select("opportunity_id")
      .eq("id", qa.solicitation_id)
      .maybeSingle();
    await createChangeRunAfterPromote(supabase, {
      organizationId: fact.organization_id,
      solicitationId: qa.solicitation_id,
      opportunityId: sol?.opportunity_id ?? null,
      triggerKind: "Q_AND_A",
      triggerQaId: qa.qa_id,
      triggerDocumentId: fact.document_id,
      createdBy: actorId,
      questionText: fact.verified_value ?? fact.normalized_value ?? fact.raw_value,
    });
  }
}

async function promoteIdentity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fact: {
    document_id: string;
    organization_id: string;
    field: string;
    entity: string | null;
    verified_value: string | null;
    normalized_value: string | null;
    raw_value: string | null;
  },
) {
  const target = identityTarget(fact.field, fact.entity);
  const value = (fact.verified_value ?? fact.normalized_value ?? fact.raw_value ?? "").trim();
  if (!target || !value) return;

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, client_id, opportunity_id")
    .eq("id", fact.document_id)
    .single();
  if (error || !document) throw new Error(error?.message ?? "Document not found.");

  if (target === "client") {
    if (document.client_id) {
      const { error: updateError } = await supabase
        .from("clients")
        .update({ name: value, updated_at: new Date().toISOString() })
        .eq("id", document.client_id)
        .eq("organization_id", fact.organization_id);
      if (updateError) throw new Error(updateError.message);
      return;
    }
    const { data: created, error: createError } = await supabase
      .from("clients")
      .insert({ organization_id: fact.organization_id, name: value })
      .select("id")
      .single();
    if (createError || !created) throw new Error(createError?.message ?? "Could not create client.");
    const { error: linkError } = await supabase
      .from("documents")
      .update({ client_id: created.id, updated_at: new Date().toISOString() })
      .eq("id", document.id);
    if (linkError) throw new Error(linkError.message);
    return;
  }

  if (document.opportunity_id) {
    const { error: updateError } = await supabase
      .from("opportunities")
      .update({ title: value, updated_at: new Date().toISOString() })
      .eq("id", document.opportunity_id)
      .eq("organization_id", fact.organization_id);
    if (updateError) throw new Error(updateError.message);
    return;
  }
  const { data: created, error: createError } = await supabase
    .from("opportunities")
    .insert({
      organization_id: fact.organization_id,
      client_id: document.client_id,
      title: value,
    })
    .select("id")
    .single();
  if (createError || !created) throw new Error(createError?.message ?? "Could not create opportunity.");
  const { error: linkError } = await supabase
    .from("documents")
    .update({ opportunity_id: created.id, updated_at: new Date().toISOString() })
    .eq("id", document.id);
  if (linkError) throw new Error(linkError.message);
}

function revalidateDoc(documentId: string) {
  revalidatePath("/ingestion/verification");
  revalidatePath(`/ingestion/verification/${documentId}`);
}

export async function applyFactDecision(input: {
  factId: string;
  action: "VERIFY" | "EDIT" | "REJECT" | "FLAG_CONFLICT";
  value?: string;
  note?: string;
}): Promise<VerificationActionResult> {
  try {
    const { supabase, user, fact } = await loadFact(input.factId);
    const now = new Date().toISOString();
    let toStatus: FactVerificationStatus = fact.verification_status;
    const patch: {
      verification_status: FactVerificationStatus;
      verified_value?: string | null;
      verified_by?: string | null;
      verified_at?: string | null;
    } = { verification_status: fact.verification_status };

    if (input.action === "VERIFY" || input.action === "EDIT") {
      const value = (input.value ?? fact.verified_value ?? fact.normalized_value ?? fact.raw_value ?? "").trim();
      if (!value) return { error: "A verified value is required." };
      toStatus = "HUMAN_VERIFIED";
      patch.verification_status = "HUMAN_VERIFIED";
      patch.verified_value = value;
      patch.verified_by = user.id;
      patch.verified_at = now;
    } else if (input.action === "REJECT") {
      toStatus = "REJECTED";
      patch.verification_status = "REJECTED";
      patch.verified_by = user.id;
      patch.verified_at = now;
    } else {
      toStatus = "CONFLICT";
      patch.verification_status = "CONFLICT";
    }

    const { error } = await supabase.from("extracted_facts").update(patch).eq("id", fact.id);
    if (error) return { error: error.message };

    await recordEvent(supabase, {
      organizationId: fact.organization_id,
      factId: fact.id,
      actorId: user.id,
      action: input.action,
      fromStatus: fact.verification_status,
      toStatus,
      note: input.note ?? null,
    });

    if (toStatus === "HUMAN_VERIFIED") {
      await promoteIdentity(supabase, {
        ...fact,
        verified_value: patch.verified_value ?? fact.verified_value,
      });
      const promoted = await supabase.rpc("promote_verified_fact", { p_fact_id: fact.id });
      if (promoted.error) throw new Error(promoted.error.message);
      const contractPromoted = await supabase.rpc("promote_contract_from_fact", { p_fact_id: fact.id });
      if (contractPromoted.error) throw new Error(contractPromoted.error.message);
      const intelPromoted = await supabase.rpc("promote_intelligence_from_fact", { p_fact_id: fact.id });
      if (intelPromoted.error) throw new Error(intelPromoted.error.message);
      const sectionPromoted = await supabase.rpc("promote_proposal_section_from_fact", { p_fact_id: fact.id });
      if (sectionPromoted.error) throw new Error(sectionPromoted.error.message);
      const formPromoted = await supabase.rpc("promote_required_form_from_fact", { p_fact_id: fact.id });
      if (formPromoted.error) throw new Error(formPromoted.error.message);
      const costPromoted = await supabase.rpc("promote_cost_component_from_fact", { p_fact_id: fact.id });
      if (costPromoted.error) throw new Error(costPromoted.error.message);
      const addendumPromoted = await supabase.rpc(
        "promote_addendum_from_fact" as never,
        { p_fact_id: fact.id } as never,
      );
      if (addendumPromoted.error) throw new Error(addendumPromoted.error.message);
      const qaPromoted = await supabase.rpc(
        "promote_qa_from_fact" as never,
        { p_fact_id: fact.id } as never,
      );
      if (qaPromoted.error) throw new Error(qaPromoted.error.message);
      const chunkPromoted = await supabase.rpc("promote_knowledge_chunk_from_fact", { p_fact_id: fact.id });
      if (chunkPromoted.error) throw new Error(chunkPromoted.error.message);

      // F11: after addendum/Q&A promote → AI draft change run (never auto-applied)
      await maybeCreateSolicitationChangeRun(supabase, user.id, fact, addendumPromoted.data, qaPromoted.data);

      // Fan-out embeddings behind JobPort (never lifecycle). Falls back to inline if unset.
      try {
        const port = getJobPort();
        if (typeof port.enqueueEmbedFanOut === "function") {
          await port.enqueueEmbedFanOut({ sourceFactId: fact.id, organizationId: fact.organization_id });
        } else {
          await embedVerifiedChunk(fact.id);
        }
      } catch {
        // Gateway may be unset locally. FTS still works.
      }
    }

    revalidateDoc(fact.document_id);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Verification failed." };
  }
}

export async function verifyFactGroup(factIds: string[]): Promise<VerificationActionResult> {
  try {
    for (const factId of factIds) {
      const result = await applyFactDecision({ factId, action: "VERIFY" });
      if (result.error) return result;
    }
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Group verify failed." };
  }
}

export async function completeDocumentVerification(documentId: string): Promise<VerificationActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, organization_id, processing_status")
      .eq("id", documentId)
      .maybeSingle();
    if (docError || !document) return { error: docError?.message ?? "Document not found." };
    await requirePermission(supabase, user.id, document.organization_id, "verify.promote");

    const { data: openFacts, error: factError } = await supabase
      .from("extracted_facts")
      .select("id")
      .eq("document_id", documentId)
      .in("verification_status", OPEN_STATUSES);
    if (factError) return { error: factError.message };
    if ((openFacts ?? []).length > 0) {
      return {
        error: `${openFacts?.length} fact(s) still need a decision. Unverified values cannot become canonical.`,
      };
    }

    if (document.processing_status === "FAILED") {
      return { error: "Failed documents cannot be marked VERIFIED." };
    }

    const { count: verifiedCount, error: verifiedError } = await supabase
      .from("extracted_facts")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId)
      .eq("verification_status", "HUMAN_VERIFIED");
    if (verifiedError) return { error: verifiedError.message };
    if (!verifiedCount) {
      return { error: "Cannot complete verification with zero HUMAN_VERIFIED facts." };
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        processing_status: "VERIFIED",
        updated_at: new Date().toISOString(),
        lifecycle_error: null,
      })
      .eq("id", documentId);
    if (updateError) return { error: updateError.message };

    await recordEvent(supabase, {
      organizationId: document.organization_id,
      factId: null,
      actorId: user.id,
      action: "COMPLETE_DOCUMENT",
      fromStatus: null,
      toStatus: "HUMAN_VERIFIED",
      note: "Document-level verification complete",
    });

    try {
      await resumeHook(verificationHookToken(documentId), {
        completed: true,
        actorId: user.id,
      });
    } catch {
      // Inline/local runs may not have a waiting Workflow hook.
    }

    revalidateDoc(documentId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not complete verification." };
  }
}

export async function getEvidenceSignedUrl(documentId: string): Promise<{ url?: string; error?: string }> {
  try {
    const { supabase } = await requireUser();
    const { data: version, error } = await supabase
      .from("document_versions")
      .select("storage_bucket, storage_path, is_current")
      .eq("document_id", documentId)
      .eq("is_current", true)
      .maybeSingle();
    if (error || !version) return { error: error?.message ?? "No current version." };
    const signed = await supabase.storage
      .from(version.storage_bucket)
      .createSignedUrl(version.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl) {
      return { error: signed.error?.message ?? "Could not sign evidence URL." };
    }
    return { url: signed.data.signedUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Signed URL failed." };
  }
}

export async function recordViewSource(input: {
  documentId: string;
  factId: string;
  page?: number | null;
  section?: string | null;
}): Promise<VerificationActionResult> {
  try {
    const { supabase, user, fact } = await loadFact(input.factId);
    await recordEvent(supabase, {
      organizationId: fact.organization_id,
      factId: fact.id,
      actorId: user.id,
      action: "VIEW_SOURCE",
      fromStatus: fact.verification_status,
      toStatus: fact.verification_status,
      note: `page=${input.page ?? "?"} section=${input.section ?? "?"}`,
    });
    revalidateDoc(input.documentId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "VIEW SOURCE audit failed." };
  }
}

export async function resolveValidationException(input: {
  exceptionId: string;
  note?: string;
}): Promise<VerificationActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: row, error } = await supabase
      .from("validation_exceptions")
      .select("id, organization_id, document_id, resolved, code")
      .eq("id", input.exceptionId)
      .maybeSingle();
    if (error || !row) return { error: error?.message ?? "Exception not found." };
    await requirePermission(supabase, user.id, row.organization_id, "verify.promote");
    if (row.resolved) return { ok: true };

    const { error: updateError } = await supabase
      .from("validation_exceptions")
      .update({ resolved: true })
      .eq("id", row.id);
    if (updateError) return { error: updateError.message };

    await recordEvent(supabase, {
      organizationId: row.organization_id,
      factId: null,
      actorId: user.id,
      action: "RESOLVE",
      fromStatus: "CONFLICT",
      toStatus: "HUMAN_VERIFIED",
      note: input.note ?? `Resolved exception ${row.code}`,
    });

    if (row.document_id) {
      revalidateDoc(row.document_id);
      revalidatePath("/ingestion/exceptions");
    }
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Resolve failed." };
  }
}
