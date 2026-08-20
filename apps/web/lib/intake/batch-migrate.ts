import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ingestSourceBytes, type IngestResult } from "@/lib/intake/ingest";
import { getJobPort } from "@/lib/jobs/get-job-port";

type Client = SupabaseClient<Database>;

export type BatchItemResult = {
  filename: string;
  outcome: "INGESTED" | "DUPLICATE" | "FAILED";
  error?: string;
  sha256?: string;
  documentId?: string;
  byteSize?: number;
};

export type BulkIngestSummary = {
  batchId: string;
  status: string;
  items: BatchItemResult[];
};

export async function createMigrationBatch(
  supabase: Client,
  organizationId: string,
  label: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_migration_batch", {
    p_organization_id: organizationId,
    p_label: label,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Batch was not created.");
  return String(data);
}

async function recordItem(
  supabase: Client,
  input: {
    organizationId: string;
    batchId: string;
    filename: string;
    sha256: string | null;
    documentId: string | null;
    byteSize: number | null;
    outcome: BatchItemResult["outcome"];
    error?: string;
  },
) {
  const { error } = await supabase.rpc("record_batch_ingest_item", {
    p_organization_id: input.organizationId,
    p_batch_id: input.batchId,
    p_filename: input.filename,
    p_sha256: input.sha256,
    p_document_id: input.documentId,
    p_byte_size: input.byteSize,
    p_outcome: input.outcome,
    p_error_message: input.error ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function ingestBulkBatch(
  supabase: Client,
  input: {
    organizationId: string;
    batchId: string;
    files: { filename: string; bytes: Uint8Array; mimeType?: string }[];
    clientId?: string | null;
    opportunityId?: string | null;
    packageKey?: string | null;
    packageTitle?: string | null;
  },
): Promise<BulkIngestSummary> {
  const items: BatchItemResult[] = [];

  for (const file of input.files) {
    if (!file.bytes.byteLength) {
      items.push({ filename: file.filename, outcome: "FAILED", error: "Empty file." });
      await recordItem(supabase, {
        organizationId: input.organizationId,
        batchId: input.batchId,
        filename: file.filename,
        sha256: null,
        documentId: null,
        byteSize: 0,
        outcome: "FAILED",
        error: "Empty file.",
      });
      continue;
    }

    try {
      const result: IngestResult = await ingestSourceBytes(supabase, {
        organizationId: input.organizationId,
        bytes: file.bytes,
        filename: file.filename,
        mimeType: file.mimeType,
        clientId: input.clientId,
        opportunityId: input.opportunityId,
        batchId: input.batchId,
        deferLifecycle: true,
        packageKey: input.packageKey,
        packageTitle: input.packageTitle,
      });

      const outcome = result.duplicate ? "DUPLICATE" : "INGESTED";
      items.push({
        filename: file.filename,
        outcome,
        sha256: result.sha256,
        documentId: result.documentId,
        byteSize: file.bytes.byteLength,
      });

      await recordItem(supabase, {
        organizationId: input.organizationId,
        batchId: input.batchId,
        filename: file.filename,
        sha256: result.sha256,
        documentId: result.documentId,
        byteSize: file.bytes.byteLength,
        outcome,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ingest failed.";
      items.push({ filename: file.filename, outcome: "FAILED", error: message });
      await recordItem(supabase, {
        organizationId: input.organizationId,
        batchId: input.batchId,
        filename: file.filename,
        sha256: null,
        documentId: null,
        byteSize: file.bytes.byteLength,
        outcome: "FAILED",
        error: message,
      });
    }
  }

  const { data: status, error: finalizeError } = await supabase.rpc("finalize_batch_ingest", {
    p_organization_id: input.organizationId,
    p_batch_id: input.batchId,
  });
  if (finalizeError) throw new Error(finalizeError.message);

  return {
    batchId: input.batchId,
    status: String(status ?? "READY"),
    items,
  };
}

export async function startBatchProcessing(
  supabase: Client,
  organizationId: string,
  batchId: string,
): Promise<{ started: number; failed: number }> {
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, document_versions!inner(id, sha256)")
    .eq("organization_id", organizationId)
    .eq("batch_id", batchId)
    .eq("processing_status", "UPLOADED");

  if (error) throw new Error(error.message);

  const rows = documents ?? [];
  const toProcess = rows.filter((row) => {
    const versions = Array.isArray(row.document_versions)
      ? row.document_versions
      : [row.document_versions];
    return versions.some((version) => version?.id && version?.sha256);
  });

  const { error: markError } = await supabase.rpc("mark_batch_processing", {
    p_organization_id: organizationId,
    p_batch_id: batchId,
    p_document_count: toProcess.length,
  });
  if (markError) throw new Error(markError.message);

  let started = 0;
  let failed = 0;
  const jobPort = getJobPort();

  for (const row of toProcess) {
    const versions = Array.isArray(row.document_versions)
      ? row.document_versions
      : [row.document_versions];
    const version = versions[0];
    if (!version?.id || !version.sha256) continue;

    try {
      await jobPort.startDocumentLifecycle({
        organizationId,
        documentId: row.id,
        documentVersionId: version.id,
        sha256: version.sha256,
      });
      started += 1;
      await supabase.rpc("record_batch_document_processed", {
        p_organization_id: organizationId,
        p_batch_id: batchId,
        p_success: true,
      });
    } catch (processError) {
      failed += 1;
      const message = processError instanceof Error ? processError.message : "Processing failed.";
      await supabase
        .from("documents")
        .update({
          processing_status: "FAILED",
          lifecycle_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("organization_id", organizationId);
      await supabase.rpc("record_batch_document_processed", {
        p_organization_id: organizationId,
        p_batch_id: batchId,
        p_success: false,
        p_error: message,
      });
    }
  }

  return { started, failed };
}
