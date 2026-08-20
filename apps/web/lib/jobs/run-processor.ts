import { createAdminClient } from "@/lib/supabase/admin";
import type { StartDocumentLifecycleInput } from "@lp/shared";

type ProcessorResult = {
  skipped?: boolean;
  factCount?: number;
  documentStatus?: string;
  parserId?: string;
  error?: string;
};

async function setStatus(
  input: StartDocumentLifecycleInput,
  status: "PARSING" | "EXTRACTING" | "VALIDATING" | "NEEDS_REVIEW" | "FAILED" | "QUEUED",
  error: string | null = null,
) {
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("documents")
    .update({
      processing_status: status,
      lifecycle_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.documentId)
    .eq("organization_id", input.organizationId);
  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function runProcessorParseExtract(
  input: StartDocumentLifecycleInput,
): Promise<ProcessorResult> {
  const baseUrl = process.env.PROCESSOR_URL?.replace(/\/$/, "");
  const secret = process.env.PROCESSOR_SHARED_SECRET;
  if (!baseUrl || !secret) {
    await setStatus(
      input,
      "QUEUED",
      "Processor not configured. Run services/processor locally and set PROCESSOR_URL plus PROCESSOR_SHARED_SECRET.",
    );
    return { skipped: true };
  }

  try {
    await setStatus(input, "PARSING");
    const response = await fetch(`${baseUrl}/jobs/parse-and-extract`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-processor-secret": secret,
      },
      body: JSON.stringify({
        organization_id: input.organizationId,
        document_id: input.documentId,
        document_version_id: input.documentVersionId,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      detail?: string;
      fact_count?: number;
      document_status?: string;
      parser_id?: string;
    };
    if (!response.ok) {
      const message = payload.detail ?? `Processor HTTP ${response.status}`;
      await setStatus(input, "FAILED", message.slice(0, 500));
      return { error: message };
    }
    if (payload.document_status === "VERIFIED") {
      await setStatus(input, "FAILED", "Processor attempted VERIFIED; blocked.");
      return { error: "Processor must never mark VERIFIED." };
    }
    await setStatus(input, "NEEDS_REVIEW");
    return {
      factCount: payload.fact_count,
      documentStatus: "NEEDS_REVIEW",
      parserId: payload.parser_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processor call failed.";
    await setStatus(input, "QUEUED", message.slice(0, 500));
    return { skipped: true, error: message };
  }
}
