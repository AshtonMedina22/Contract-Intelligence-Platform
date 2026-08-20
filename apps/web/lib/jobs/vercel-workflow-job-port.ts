import { start } from "workflow/api";
import type {
  EmbedFanOutInput,
  JobPort,
  StartDocumentLifecycleInput,
  StartDocumentLifecycleResult,
} from "@lp/shared";
import { documentLifecycleWorkflow } from "@/workflows/document-lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";
import { InlineLifecycleJobPort } from "@/lib/jobs/inline-job-port";
import { embedVerifiedChunk } from "@/lib/search/embed-chunk";

export class VercelWorkflowJobPort implements JobPort {
  async startDocumentLifecycle(
    input: StartDocumentLifecycleInput,
  ): Promise<StartDocumentLifecycleResult> {
    try {
      const run = await start(documentLifecycleWorkflow, [input]);
      const admin = createAdminClient();
      const { error } = await admin
        .from("documents")
        .update({
          processing_status: "QUEUED",
          workflow_run_id: run.runId,
          lifecycle_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.documentId)
        .eq("organization_id", input.organizationId);

      if (error) {
        throw new Error(error.message);
      }

      return { runId: run.runId, adapter: "vercel-workflow" };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Vercel Workflow start failed.";
      return new InlineLifecycleJobPort(message.slice(0, 500)).startDocumentLifecycle(input);
    }
  }

  async enqueueEmbedFanOut(input: EmbedFanOutInput): Promise<void> {
    // Queues = fan-out only. Until @vercel/queue is configured, run inline after verify.
    await embedVerifiedChunk(input.sourceFactId);
  }
}
