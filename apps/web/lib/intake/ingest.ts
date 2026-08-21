import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVIDENCE_BUCKET,
  evidenceFileExtension,
  evidenceStoragePath,
  sha256Hex,
  type StartDocumentLifecycleResult,
} from "@lp/shared";
import type { Database } from "@/lib/supabase/database.types";
import { getJobPort } from "@/lib/jobs/get-job-port";
import { assertAllowedIntakeFile, inferMimeType, MAX_INTAKE_BYTES } from "@/lib/intake/allowed-files";
import type { DataClassification } from "@/lib/classification/types";

type Client = SupabaseClient<Database>;

export type IngestResult = {
  duplicate: boolean;
  documentId: string;
  documentVersionId: string;
  storagePath: string;
  sha256: string;
  batchId: string | null;
  filename: string;
  workflow?: StartDocumentLifecycleResult;
};

type RegisterRow = {
  duplicate: boolean;
  document_id: string;
  document_version_id: string;
  storage_path: string;
  batch_id: string | null;
};

function parseRegisterRow(value: unknown): RegisterRow {
  if (!value || typeof value !== "object") {
    throw new Error("Intake register returned an invalid payload.");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.duplicate !== "boolean" || typeof row.document_id !== "string") {
    throw new Error("Intake register returned an invalid payload.");
  }
  return {
    duplicate: row.duplicate,
    document_id: row.document_id,
    document_version_id: String(row.document_version_id),
    storage_path: String(row.storage_path),
    batch_id: typeof row.batch_id === "string" ? row.batch_id : null,
  };
}

export async function ingestSourceBytes(
  supabase: Client,
  input: {
    organizationId: string;
    bytes: Uint8Array;
    filename: string;
    mimeType?: string;
    clientId?: string | null;
    opportunityId?: string | null;
    batchId?: string | null;
    batchLabel?: string | null;
    sourceDriveFileId?: string | null;
    /** Append changed bytes to this existing logical document. */
    existingDocumentId?: string | null;
    deferLifecycle?: boolean;
    packageKey?: string | null;
    packageTitle?: string | null;
    corpusClass?: "A_LP_ORIGINATED" | "B_LP_TIED" | "C_COMPETITOR_TEST" | null;
    /** Independent from corpusClass. Demo packages must opt in explicitly. */
    dataClassification?: DataClassification;
  },
): Promise<IngestResult> {
  if (input.bytes.byteLength === 0) {
    throw new Error(`File ${input.filename} is empty.`);
  }
  if (input.bytes.byteLength > MAX_INTAKE_BYTES) {
    throw new Error(
      `File ${input.filename} exceeds the ${Math.floor(MAX_INTAKE_BYTES / (1024 * 1024))} MB intake limit.`,
    );
  }

  const mimeType = inferMimeType(input.filename, input.mimeType);
  assertAllowedIntakeFile(input.filename, mimeType);

  const sha256 = sha256Hex(input.bytes);

  const { data: existing, error: existingError } = await supabase
    .from("document_versions")
    .select("id, document_id, storage_path")
    .eq("organization_id", input.organizationId)
    .eq("sha256", sha256)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return {
      duplicate: true,
      documentId: existing.document_id,
      documentVersionId: existing.id,
      storagePath: existing.storage_path,
      sha256,
      batchId: input.batchId ?? null,
      filename: input.filename,
    };
  }

  const documentId = input.existingDocumentId ?? crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const extension = evidenceFileExtension(input.filename, mimeType);
  const storagePath = evidenceStoragePath({
    organizationId: input.organizationId,
    documentId,
    versionId,
    sha256,
    extension,
  });

  const copy = new ArrayBuffer(input.bytes.byteLength);
  new Uint8Array(copy).set(input.bytes);
  const body = new Blob([copy], { type: mimeType });
  const upload = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, body, {
    contentType: mimeType,
    upsert: false,
    cacheControl: "3600",
  });

  if (upload.error) {
    throw new Error(upload.error.message);
  }

  const appendToExisting = Boolean(input.existingDocumentId);
  const rpcResult = appendToExisting
    ? await supabase.rpc("append_document_version", {
        p_organization_id: input.organizationId,
        p_document_id: documentId,
        p_version_id: versionId,
        p_sha256: sha256,
        p_storage_path: storagePath,
        p_byte_size: input.bytes.byteLength,
        p_source_drive_file_id: input.sourceDriveFileId ?? null,
      })
    : await supabase.rpc("register_ingested_document_classified", {
        p_organization_id: input.organizationId,
        p_document_id: documentId,
        p_version_id: versionId,
        p_batch_id: input.batchId ?? null,
        p_batch_label: input.batchLabel ?? null,
        p_client_id: input.clientId ?? null,
        p_opportunity_id: input.opportunityId ?? null,
        p_original_filename: input.filename,
        p_mime_type: mimeType,
        p_sha256: sha256,
        p_storage_path: storagePath,
        p_byte_size: input.bytes.byteLength,
        p_source_drive_file_id: input.sourceDriveFileId ?? null,
        p_data_classification: input.dataClassification ?? "internal_unverified",
      });
  const { data: registered, error: registerError } = rpcResult;

  if (registerError) {
    throw new Error(registerError.message);
  }

  const parsed = parseRegisterRow(registered);
  const row = appendToExisting ? { ...parsed, batch_id: input.batchId ?? null } : parsed;
  if (row.duplicate) {
    return {
      duplicate: true,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      storagePath: row.storage_path,
      sha256,
      batchId: row.batch_id,
      filename: input.filename,
    };
  }

  if (appendToExisting) {
    const { error: documentError } = await supabase
      .from("documents")
      .update({
        original_filename: input.filename,
        mime_type: mimeType,
        processing_status: "UPLOADED",
        lifecycle_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.document_id)
      .eq("organization_id", input.organizationId);
    if (documentError) throw new Error(documentError.message);
  }

  const packageKey = input.packageKey?.trim();
  if (packageKey) {
    const { data: existingPkg } = await supabase
      .from("procurement_packages")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("package_key", packageKey)
      .maybeSingle();

    let packageId = existingPkg?.id ?? null;
    if (!packageId) {
      const { data: createdPkg, error: pkgError } = await supabase
        .from("procurement_packages")
        .insert({
          organization_id: input.organizationId,
          client_id: input.clientId ?? null,
          opportunity_id: input.opportunityId ?? null,
          package_key: packageKey,
          title: input.packageTitle?.trim() || packageKey,
          corpus_class: input.corpusClass ?? "A_LP_ORIGINATED",
        })
        .select("id")
        .single();
      if (pkgError) throw new Error(pkgError.message);
      packageId = createdPkg.id;
    }

    const { error: linkError } = await supabase
      .from("documents")
      .update({
        procurement_package_id: packageId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.document_id)
      .eq("organization_id", input.organizationId);
    if (linkError) throw new Error(linkError.message);
  }

  if (input.deferLifecycle) {
    return {
      duplicate: false,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      storagePath: row.storage_path,
      sha256,
      batchId: row.batch_id,
      filename: input.filename,
    };
  }

  const workflow = await getJobPort().startDocumentLifecycle({
    organizationId: input.organizationId,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    sha256,
  });

  return {
    duplicate: false,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    storagePath: row.storage_path,
    sha256,
    batchId: row.batch_id,
    filename: input.filename,
    workflow,
  };
}
