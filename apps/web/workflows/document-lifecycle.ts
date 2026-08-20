import { verificationHookToken } from "@lp/shared/verification-hook";
import { createHook } from "workflow";
import type { StartDocumentLifecycleInput } from "@lp/shared/job-port";
import { createAdminClient } from "@/lib/supabase/admin";
import { runProcessorParseExtract } from "@/lib/jobs/run-processor";

async function markQueued(input: StartDocumentLifecycleInput) {
  "use step";

  const admin = createAdminClient();
  const { error } = await admin
    .from("documents")
    .update({
      processing_status: "QUEUED",
      lifecycle_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.documentId)
    .eq("organization_id", input.organizationId);

  if (error) {
    throw error;
  }
}

async function parseAndExtract(input: StartDocumentLifecycleInput) {
  "use step";
  return runProcessorParseExtract(input);
}

async function markHumanVerified(input: StartDocumentLifecycleInput, actorId: string | undefined) {
  "use step";
  const admin = createAdminClient();
  const { error } = await admin
    .from("documents")
    .update({
      processing_status: "VERIFIED",
      lifecycle_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.documentId)
    .eq("organization_id", input.organizationId);
  if (error) throw error;
  return { actorId: actorId ?? null };
}

export async function documentLifecycleWorkflow(input: StartDocumentLifecycleInput) {
  "use workflow";

  await markQueued(input);
  const processed = await parseAndExtract(input);
  if (processed.skipped || processed.error) {
    return {
      status: processed.error && !processed.skipped ? "FAILED" : "QUEUED",
      processed,
    };
  }

  const hook = createHook<{ completed: boolean; actorId?: string }>({
    token: verificationHookToken(input.documentId),
  });
  const verification = await hook;
  await markHumanVerified(input, verification.actorId);
  return { status: "VERIFIED" as const, processed, verification };
}
