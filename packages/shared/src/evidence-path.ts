const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EVIDENCE_BUCKET = "evidence";

export type EvidencePathParts = {
  organizationId: string;
  documentId: string;
  versionId: string;
  sha256: string;
  extension: string;
};

export function evidenceFileExtension(filename: string, mimeType: string): string {
  const fromName = filename.split(".").pop()?.trim().toLowerCase() ?? "";
  if (fromName === "pdf" || fromName === "xlsx" || fromName === "xls" || fromName === "docx") {
    return fromName;
  }
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  if (mimeType === "application/vnd.ms-excel") return "xls";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "bin";
}

export function evidenceStoragePath(parts: EvidencePathParts): string {
  const { organizationId, documentId, versionId, sha256, extension } = parts;
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(documentId) || !UUID_RE.test(versionId)) {
    throw new Error("Evidence path IDs must be UUIDs.");
  }
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error("Evidence path checksum must be 64 lowercase hex characters.");
  }
  const ext = extension.replace(/[^a-z0-9]+/g, "") || "bin";
  return `${organizationId}/${documentId}/${versionId}/${sha256}/original.${ext}`;
}
