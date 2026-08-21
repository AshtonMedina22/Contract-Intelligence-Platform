"use server";

import { createClient } from "@/lib/supabase/server";
import { ingestSourceBytes, type IngestResult } from "@/lib/intake/ingest";
import { getGoogleDriveSourceProvider } from "@/lib/intake/drive";
import { runDriveSourceSync, type DriveSyncResult } from "@/lib/intake/drive-sync";
import { LocalUploadProvider } from "@/lib/intake/local-upload-provider";
import { requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/auth/audit";
import { revalidatePath } from "next/cache";

export type IntakeActionResult = {
  error?: string;
  results?: IngestResult[];
  driveSync?: DriveSyncResult;
};

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireIntakeMembership(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  await requirePermission(supabase, user.id, organizationId, "intake.write");
  return { supabase, userId: user.id };
}

export async function ingestUploadedFiles(formData: FormData): Promise<IntakeActionResult> {
  try {
    const organizationId = emptyToNull(formData.get("organization_id"));
    if (!organizationId) {
      return { error: "Select an organization first." };
    }

    const { supabase } = await requireIntakeMembership(organizationId);
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    if (files.length === 0) {
      return { error: "Choose at least one PDF or XLSX file." };
    }

    const clientId = emptyToNull(formData.get("client_id"));
    const opportunityId = emptyToNull(formData.get("opportunity_id"));
    const batchLabel = emptyToNull(formData.get("batch_label"));
    const packageKey = emptyToNull(formData.get("package_key"));
    const packageTitle = emptyToNull(formData.get("package_title"));

    const results: IngestResult[] = [];
    let batchId: string | null = null;

    const provider = new LocalUploadProvider(files);
    const items = await provider.listScoped({ maxItems: files.length });
    for (const item of items) {
      const fetched = await provider.fetchBytes({ item });
      if (!fetched.bytes.byteLength) continue;
      const result = await ingestSourceBytes(supabase, {
        organizationId,
        bytes: fetched.bytes,
        filename: fetched.filename,
        mimeType: fetched.mimeType,
        clientId,
        opportunityId,
        batchId,
        batchLabel,
        packageKey,
        packageTitle,
      });
      results.push(result);
      if (!result.duplicate && result.batchId) {
        batchId = result.batchId;
      }
    }

    if (results.length === 0) {
      return { error: "Choose at least one non-empty file." };
    }

    revalidatePath("/ingestion/intake");
    revalidatePath("/ingestion/processing");
    revalidatePath("/procurement/documents");
    return { results };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Intake failed." };
  }
}

export async function ingestDriveFile(formData: FormData): Promise<IntakeActionResult> {
  try {
    const organizationId = emptyToNull(formData.get("organization_id"));
    if (!organizationId) {
      return { error: "Select an organization first." };
    }

    const rawFileIds =
      emptyToNull(formData.get("drive_file_ids")) ?? emptyToNull(formData.get("drive_file_id")) ?? "";
    const fileIds = rawFileIds
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const folderId = emptyToNull(formData.get("drive_folder_id"));
    if (fileIds.length === 0 && !folderId) {
      return { error: "Enter one or more Google Drive file IDs or a scoped folder ID." };
    }

    const rawMaxItems = Number(emptyToNull(formData.get("drive_max_items")) ?? "25");
    const maxItems = Number.isFinite(rawMaxItems)
      ? Math.max(1, Math.min(Math.trunc(rawMaxItems), 100))
      : 25;
    const docExportFormat =
      emptyToNull(formData.get("drive_doc_export_format")) === "pdf" ? "pdf" : "docx";

    const { supabase, userId } = await requireIntakeMembership(organizationId);
    const driveSync = await runDriveSourceSync(
      supabase,
      getGoogleDriveSourceProvider(),
      {
        organizationId,
        fileIds,
        folderId,
        maxItems,
        docExportFormat,
        clientId: emptyToNull(formData.get("client_id")),
        opportunityId: emptyToNull(formData.get("opportunity_id")),
        batchLabel: emptyToNull(formData.get("batch_label")),
        packageKey: emptyToNull(formData.get("package_key")),
        packageTitle: emptyToNull(formData.get("package_title")),
      },
      ingestSourceBytes,
    );
    await writeAuditLog(supabase, {
      organizationId,
      actorUserId: userId,
      action: "drive.source_sync",
      entityType: "document_source_link",
      metadata: {
        direction: driveSync.direction,
        file_id_count: fileIds.length,
        folder_id: folderId,
        max_items: maxItems,
        selected: driveSync.selected,
        result_counts: Object.fromEntries(
          ["INGESTED", "DUPLICATE", "VERSIONED", "UNAVAILABLE", "FAILED"].map((status) => [
            status,
            driveSync.results.filter((row) => row.status === status).length,
          ]),
        ),
      },
    });

    revalidatePath("/ingestion/intake");
    revalidatePath("/ingestion/processing");
    revalidatePath("/procurement/documents");
    return { driveSync };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Drive import failed." };
  }
}
