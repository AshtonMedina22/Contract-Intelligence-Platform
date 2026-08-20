"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createMigrationBatch,
  ingestBulkBatch,
  startBatchProcessing,
  type BulkIngestSummary,
} from "@/lib/intake/batch-migrate";
import { INTAKE_ROLES, requireOrgRole } from "@/lib/org/roles";

export type BulkActionResult = {
  error?: string;
  batchId?: string;
  summary?: BulkIngestSummary;
  processing?: { started: number; failed: number };
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
  if (userError || !user) throw new Error("You must be signed in.");

  await requireOrgRole(supabase, user.id, organizationId, INTAKE_ROLES);
  return supabase;
}

export async function createAndIngestBulkBatch(formData: FormData): Promise<BulkActionResult> {
  try {
    const organizationId = emptyToNull(formData.get("organization_id"));
    const label = emptyToNull(formData.get("batch_label"));
    if (!organizationId) return { error: "Select an organization." };
    if (!label) return { error: "Batch label is required for bulk migration." };

    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    if (files.length === 0) return { error: "Choose at least one file." };

    const supabase = await requireIntakeMembership(organizationId);
    const batchId = await createMigrationBatch(supabase, organizationId, label);

    const payload = [];
    for (const file of files) {
      if (!file.size) continue;
      payload.push({
        filename: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type,
      });
    }

    const summary = await ingestBulkBatch(supabase, {
      organizationId,
      batchId,
      files: payload,
      clientId: emptyToNull(formData.get("client_id")),
      opportunityId: emptyToNull(formData.get("opportunity_id")),
      packageKey: emptyToNull(formData.get("package_key")),
      packageTitle: emptyToNull(formData.get("package_title")),
    });

    revalidatePath("/ingestion/bulk");
    revalidatePath("/ingestion/processing");
    revalidatePath("/procurement/documents");
    return { batchId, summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Bulk ingest failed." };
  }
}

export async function processBulkBatch(formData: FormData): Promise<BulkActionResult> {
  try {
    const organizationId = emptyToNull(formData.get("organization_id"));
    const batchId = emptyToNull(formData.get("batch_id"));
    if (!organizationId || !batchId) return { error: "Missing batch." };

    const supabase = await requireIntakeMembership(organizationId);
    const processing = await startBatchProcessing(supabase, organizationId, batchId);

    revalidatePath("/ingestion/bulk");
    revalidatePath("/ingestion/processing");
    revalidatePath("/ingestion/verification");
    return { batchId, processing };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Batch processing failed." };
  }
}
