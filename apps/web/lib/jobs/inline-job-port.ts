import type {
  EmbedFanOutInput,
  JobPort,
  StartDocumentLifecycleInput,
  StartDocumentLifecycleResult,
} from "@lp/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { runProcessorParseExtract } from "@/lib/jobs/run-processor";
import { embedVerifiedChunk } from "@/lib/search/embed-chunk";

export class InlineLifecycleJobPort implements JobPort {
  constructor(private readonly reason: string | null = null) {}

  async startDocumentLifecycle(
    input: StartDocumentLifecycleInput,
  ): Promise<StartDocumentLifecycleResult> {
    const runId = `inline:${input.documentVersionId}`;
    const admin = createAdminClient();
    const { error } = await admin
      .from("documents")
      .update({
        processing_status: "QUEUED",
        workflow_run_id: runId,
        lifecycle_error: this.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.documentId)
      .eq("organization_id", input.organizationId);

    if (error) {
      throw new Error(error.message);
    }

    await runProcessorParseExtract(input);

    return { runId, adapter: "inline" };
  }

  async enqueueEmbedFanOut(input: EmbedFanOutInput): Promise<void> {
    await embedVerifiedChunk(input.sourceFactId);
  }
}
