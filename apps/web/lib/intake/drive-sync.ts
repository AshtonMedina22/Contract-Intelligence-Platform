import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DocumentSourceError,
  SOURCE_INGEST_DIRECTION,
  type DocumentSourceExportFormat,
  type DocumentSourceItem,
  type DocumentSourceProvider,
} from "@lp/shared";
import type { Database } from "@/lib/supabase/database.types";
import type { IngestResult } from "@/lib/intake/ingest";

type Client = SupabaseClient<Database>;
export type SourceIngestFunction = (
  supabase: Client,
  input: Parameters<typeof import("@/lib/intake/ingest").ingestSourceBytes>[1],
) => Promise<IngestResult>;

export type DriveSyncInput = {
  organizationId: string;
  fileIds: readonly string[];
  folderId?: string | null;
  maxItems: number;
  docExportFormat?: "docx" | "pdf";
  clientId?: string | null;
  opportunityId?: string | null;
  batchLabel?: string | null;
  packageKey?: string | null;
  packageTitle?: string | null;
};

export type DriveSyncItemResult = {
  upstreamFileId: string;
  filename: string;
  status: "INGESTED" | "DUPLICATE" | "VERSIONED" | "UNAVAILABLE" | "FAILED";
  documentId?: string;
  documentVersionId?: string;
  sha256?: string;
  message?: string;
};

export type DriveSyncResult = {
  provider: "google_drive";
  direction: typeof SOURCE_INGEST_DIRECTION;
  selected: number;
  results: DriveSyncItemResult[];
};

type SourceLink = Database["public"]["Tables"]["document_source_links"]["Row"];

function isSourceError(
  error: unknown,
  code?: string,
): error is DocumentSourceError {
  const coded = error as (Error & { code?: string }) | null;
  return (
    coded instanceof Error &&
    typeof coded.code === "string" &&
    (!code || coded.code === code)
  );
}

async function getSourceLink(
  supabase: Client,
  organizationId: string,
  upstreamFileId: string,
): Promise<SourceLink | null> {
  const { data, error } = await supabase
    .from("document_source_links")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "google_drive")
    .eq("direction", SOURCE_INGEST_DIRECTION)
    .eq("upstream_file_id", upstreamFileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function markUnavailable(
  supabase: Client,
  organizationId: string,
  upstreamFileId: string,
  reason: string,
): Promise<void> {
  const existing = await getSourceLink(supabase, organizationId, upstreamFileId);
  if (!existing) return;
  const { error } = await supabase
    .from("document_source_links")
    .update({
      availability: "UNAVAILABLE",
      last_synced_at: new Date().toISOString(),
      metadata: { ...existing.metadata, unavailable_reason: reason },
    })
    .eq("id", existing.id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}

async function listSelectedItems(
  provider: DocumentSourceProvider,
  supabase: Client,
  input: DriveSyncInput,
  results: DriveSyncItemResult[],
): Promise<DocumentSourceItem[]> {
  const items: DocumentSourceItem[] = [];
  const seen = new Set<string>();
  const maxItems = Math.max(1, Math.min(Math.trunc(input.maxItems || 1), 1000));

  for (const rawId of input.fileIds) {
    const id = rawId.trim();
    if (!id || seen.has(id) || items.length >= maxItems) continue;
    try {
      const [item] = await provider.listScoped({ fileIds: [id], maxItems: 1 });
      if (item) {
        seen.add(item.upstreamFileId);
        items.push(item);
      }
    } catch (error) {
      if (isSourceError(error, "NOT_FOUND")) {
        await markUnavailable(supabase, input.organizationId, id, error.message);
        results.push({
          upstreamFileId: id,
          filename: id,
          status: "UNAVAILABLE",
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  const folderId = input.folderId?.trim();
  if (folderId && items.length < maxItems) {
    const folderItems = await provider.listScoped({
      folderId,
      maxItems: maxItems - items.length,
    });
    for (const item of folderItems) {
      if (seen.has(item.upstreamFileId)) continue;
      seen.add(item.upstreamFileId);
      items.push(item);
    }
  }
  return items;
}

function exportFormatFor(
  item: DocumentSourceItem,
  docExportFormat: "docx" | "pdf",
): DocumentSourceExportFormat {
  return item.mimeType === "application/vnd.google-apps.document" ? docExportFormat : null;
}

export async function runDriveSourceSync(
  supabase: Client,
  provider: DocumentSourceProvider,
  input: DriveSyncInput,
  ingest: SourceIngestFunction,
): Promise<DriveSyncResult> {
  if (provider.id !== "google_drive" || provider.direction !== SOURCE_INGEST_DIRECTION) {
    throw new Error("Drive sync requires the google_drive SOURCE_INGEST provider.");
  }
  if (!provider.isConfigured()) {
    throw new DocumentSourceError(
      "NOT_CONFIGURED",
      "Google Drive SOURCE ingestion is blocked: GOOGLE_DRIVE_ACCESS_TOKEN is unset on the server.",
    );
  }
  if (input.fileIds.length === 0 && !input.folderId?.trim()) {
    throw new Error("Enter one or more Drive file IDs or one scoped folder ID.");
  }

  const results: DriveSyncItemResult[] = [];
  const items = await listSelectedItems(provider, supabase, input, results);
  let batchId: string | null = null;

  for (const item of items) {
    const existing = await getSourceLink(supabase, input.organizationId, item.upstreamFileId);
    try {
      const fetched = await provider.fetchBytes({
        item,
        exportFormat: exportFormatFor(item, input.docExportFormat ?? "docx"),
      });
      const ingestResult: IngestResult = await ingest(supabase, {
        organizationId: input.organizationId,
        bytes: fetched.bytes,
        filename: fetched.filename,
        mimeType: fetched.mimeType,
        clientId: input.clientId ?? null,
        opportunityId: input.opportunityId ?? null,
        batchId,
        batchLabel: input.batchLabel ?? null,
        packageKey: input.packageKey ?? null,
        packageTitle: input.packageTitle ?? null,
        sourceDriveFileId: item.upstreamFileId,
        existingDocumentId: existing?.document_id ?? null,
      });
      if (!ingestResult.duplicate && ingestResult.batchId) batchId = ingestResult.batchId;

      const { error: documentError } = await supabase
        .from("documents")
        .update({
          original_filename: fetched.filename,
          mime_type: fetched.mimeType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ingestResult.documentId)
        .eq("organization_id", input.organizationId);
      if (documentError) throw new Error(documentError.message);

      const metadata = {
        ...item.metadata,
        upstream_name: item.name,
        vault_filename: fetched.filename,
      };
      const { error: linkError } = await supabase.from("document_source_links").upsert(
        {
          organization_id: input.organizationId,
          document_id: ingestResult.documentId,
          provider: "google_drive",
          direction: SOURCE_INGEST_DIRECTION,
          upstream_file_id: item.upstreamFileId,
          mime: item.mimeType,
          modified: item.modifiedTime,
          availability: "AVAILABLE",
          last_synced_at: new Date().toISOString(),
          last_sha256: ingestResult.sha256,
          folder_id: item.folderId,
          export_format: fetched.exportFormat,
          metadata,
        },
        { onConflict: "organization_id,provider,direction,upstream_file_id" },
      );
      if (linkError) throw new Error(linkError.message);

      const changed = Boolean(existing && !ingestResult.duplicate);
      results.push({
        upstreamFileId: item.upstreamFileId,
        filename: fetched.filename,
        status: changed ? "VERSIONED" : ingestResult.duplicate ? "DUPLICATE" : "INGESTED",
        documentId: ingestResult.documentId,
        documentVersionId: ingestResult.documentVersionId,
        sha256: ingestResult.sha256,
      });
    } catch (error) {
      if (isSourceError(error, "NOT_FOUND")) {
        await markUnavailable(supabase, input.organizationId, item.upstreamFileId, error.message);
        results.push({
          upstreamFileId: item.upstreamFileId,
          filename: item.name,
          status: "UNAVAILABLE",
          message: error.message,
        });
        continue;
      }
      results.push({
        upstreamFileId: item.upstreamFileId,
        filename: item.name,
        status: "FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    provider: "google_drive",
    direction: SOURCE_INGEST_DIRECTION,
    selected: items.length,
    results,
  };
}
