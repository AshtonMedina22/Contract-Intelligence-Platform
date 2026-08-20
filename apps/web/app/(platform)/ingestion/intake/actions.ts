"use server";

import { DriveNotConfiguredError } from "@lp/shared";
import { createClient } from "@/lib/supabase/server";
import { ingestSourceBytes, type IngestResult } from "@/lib/intake/ingest";
import { getDriveImportPort } from "@/lib/intake/drive";
import { INTAKE_ROLES, requireOrgRole } from "@/lib/org/roles";
import { revalidatePath } from "next/cache";

export type IntakeActionResult = {
  error?: string;
  results?: IngestResult[];
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

  await requireOrgRole(supabase, user.id, organizationId, INTAKE_ROLES);
  return supabase;
}

export async function ingestUploadedFiles(formData: FormData): Promise<IntakeActionResult> {
  try {
    const organizationId = emptyToNull(formData.get("organization_id"));
    if (!organizationId) {
      return { error: "Select an organization first." };
    }

    const supabase = await requireIntakeMembership(organizationId);
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

    for (const file of files) {
      if (!file.size) continue;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await ingestSourceBytes(supabase, {
        organizationId,
        bytes,
        filename: file.name,
        mimeType: file.type,
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

    const fileId = emptyToNull(formData.get("drive_file_id"));
    if (!fileId) {
      return { error: "Enter a Google Drive file ID." };
    }

    const supabase = await requireIntakeMembership(organizationId);
    const imported = await getDriveImportPort().fetchFile(fileId);
    const result = await ingestSourceBytes(supabase, {
      organizationId,
      bytes: imported.bytes,
      filename: imported.filename,
      mimeType: imported.mimeType,
      clientId: emptyToNull(formData.get("client_id")),
      opportunityId: emptyToNull(formData.get("opportunity_id")),
      batchLabel: emptyToNull(formData.get("batch_label")),
      sourceDriveFileId: imported.fileId,
    });

    revalidatePath("/ingestion/intake");
    revalidatePath("/ingestion/processing");
    revalidatePath("/procurement/documents");
    return { results: [result] };
  } catch (error) {
    if (error instanceof DriveNotConfiguredError) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Drive import failed." };
  }
}
