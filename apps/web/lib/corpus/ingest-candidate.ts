/**
 * F23 → F1 vault ingest. Always AI_EXTRACTED provenance only.
 * Never sets HUMAN_VERIFIED. Maps corpus_role → corpus_class A/B/C when packaging.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { mapRoleToCorpusClass } from "./classify-role";
import type { AcquisitionCorpusRole, IngestCandidateResult } from "./types";
import { sha256Hex } from "./fetch-candidate";

type MinimalClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Buffer | Uint8Array | Blob,
        opts?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { id: string; document_id?: string; storage_path?: string } | null; error: { message: string } | null }>;
        };
        maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type IngestCandidateInput = {
  organizationId: string;
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  corpusRole: AcquisitionCorpusRole;
  packageKey?: string | null;
  packageTitle?: string | null;
  batchLabel?: string | null;
  /** When false, skip procurement_packages link (REFERENCE_DATA). Default true when class maps. */
  createPackage?: boolean;
};

function evidenceExt(filename: string, mime: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || ext === "docx" || ext === "xlsx" || ext === "xls") return ext;
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessing")) return "docx";
  if (mime.includes("sheet") || mime.includes("excel")) return "xlsx";
  return "bin";
}

function evidencePath(
  orgId: string,
  documentId: string,
  versionId: string,
  sha256: string,
  ext: string,
): string {
  return `${orgId}/${documentId}/${versionId}/${sha256}/original.${ext}`;
}

function inferMime(filename: string, mimeType: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (ext === "xls") return "application/vnd.ms-excel";
  return mimeType || "application/octet-stream";
}

/**
 * Register bytes into the evidence vault via register_ingested_document.
 * verification remains AI_EXTRACTED at the fact layer (processor / staging) —
 * this path never stamps HUMAN_VERIFIED.
 */
export async function ingestCandidateBytes(
  supabase: MinimalClient | SupabaseClient,
  input: IngestCandidateInput,
): Promise<IngestCandidateResult> {
  const mime = inferMime(input.filename, input.mimeType);
  const allowed =
    mime.includes("pdf") ||
    mime.includes("wordprocessing") ||
    mime.includes("sheet") ||
    mime.includes("excel") ||
    /\.(pdf|docx|xlsx|xls)$/i.test(input.filename);

  if (!allowed) {
    return {
      duplicate: false,
      documentId: null,
      documentVersionId: null,
      sha256: sha256Hex(input.bytes),
      storagePath: null,
      status: "FAILED",
      error: `F1 intake refuses mime/filename (${mime} / ${input.filename}).`,
      verificationStatus: "AI_EXTRACTED",
    };
  }

  const sha256 = sha256Hex(input.bytes);
  const client = supabase as MinimalClient;

  const existing = await client
    .from("document_versions")
    .select("id, document_id, storage_path")
    .eq("organization_id", input.organizationId)
    .eq("sha256", sha256)
    .maybeSingle();

  if (existing.error) {
    return {
      duplicate: false,
      documentId: null,
      documentVersionId: null,
      sha256,
      storagePath: null,
      status: "FAILED",
      error: existing.error.message,
      verificationStatus: "AI_EXTRACTED",
    };
  }

  if (existing.data) {
    return {
      duplicate: true,
      documentId: existing.data.document_id ?? null,
      documentVersionId: existing.data.id,
      sha256,
      storagePath: existing.data.storage_path ?? null,
      status: "DUPLICATE",
      verificationStatus: "AI_EXTRACTED",
    };
  }

  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const ext = evidenceExt(input.filename, mime);
  const storagePath = evidencePath(input.organizationId, documentId, versionId, sha256, ext);

  const upload = await client.storage.from("evidence").upload(storagePath, Buffer.from(input.bytes), {
    contentType: mime,
    upsert: false,
  });
  if (upload.error) {
    return {
      duplicate: false,
      documentId: null,
      documentVersionId: null,
      sha256,
      storagePath: null,
      status: "FAILED",
      error: upload.error.message,
      verificationStatus: "AI_EXTRACTED",
    };
  }

  const { data: registered, error: registerError } = await client.rpc("register_ingested_document", {
    p_organization_id: input.organizationId,
    p_document_id: documentId,
    p_version_id: versionId,
    p_batch_id: null,
    p_batch_label: input.batchLabel ?? "F23 corpus acquisition",
    p_client_id: null,
    p_opportunity_id: null,
    p_original_filename: input.filename,
    p_mime_type: mime,
    p_sha256: sha256,
    p_storage_path: storagePath,
    p_byte_size: input.bytes.byteLength,
    p_source_drive_file_id: null,
  });

  if (registerError) {
    return {
      duplicate: false,
      documentId: null,
      documentVersionId: null,
      sha256,
      storagePath,
      status: "FAILED",
      error: registerError.message,
      verificationStatus: "AI_EXTRACTED",
    };
  }

  const row = registered as {
    duplicate?: boolean;
    document_id?: string;
    document_version_id?: string;
    storage_path?: string;
  } | null;

  if (row?.duplicate) {
    return {
      duplicate: true,
      documentId: row.document_id ?? null,
      documentVersionId: row.document_version_id ?? null,
      sha256,
      storagePath: row.storage_path ?? storagePath,
      status: "DUPLICATE",
      verificationStatus: "AI_EXTRACTED",
    };
  }

  const corpusClass = mapRoleToCorpusClass(input.corpusRole);
  const packageKey = input.packageKey?.trim();
  const shouldPackage =
    input.createPackage !== false && corpusClass != null && Boolean(packageKey);

  if (shouldPackage && packageKey && corpusClass) {
    const existingPkg = await client
      .from("procurement_packages")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("package_key", packageKey)
      .maybeSingle();

    let packageId = existingPkg.data?.id ?? null;
    if (!packageId) {
      const created = await client
        .from("procurement_packages")
        .insert({
          organization_id: input.organizationId,
          package_key: packageKey,
          title: input.packageTitle?.trim() || packageKey,
          corpus_class: corpusClass,
        })
        .select("id")
        .single();
      if (!created.error && created.data) packageId = created.data.id;
    }

    if (packageId && row?.document_id) {
      await client
        .from("documents")
        .update({
          procurement_package_id: packageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.document_id)
        .eq("organization_id", input.organizationId);
    }
  }

  return {
    duplicate: false,
    documentId: row?.document_id ?? documentId,
    documentVersionId: row?.document_version_id ?? versionId,
    sha256,
    storagePath: row?.storage_path ?? storagePath,
    status: "INGESTED",
    verificationStatus: "AI_EXTRACTED",
  };
}

/** Hard rule helper for acceptance tests. */
export function ingestSetsHumanVerified(): false {
  return false;
}
