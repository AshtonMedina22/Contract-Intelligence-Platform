export const MAX_INTAKE_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXT = new Set(["pdf", "xlsx", "xls", "docx"]);

export function inferMimeType(filename: string, mimeType: string | undefined): string {
  const fromBrowser = mimeType?.trim() ?? "";
  if (ALLOWED_MIME.has(fromBrowser)) return fromBrowser;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return fromBrowser;
}

export function assertAllowedIntakeFile(filename: string, mimeType: string): void {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext) && !ALLOWED_MIME.has(mimeType)) {
    throw new Error("Only PDF, XLSX, and DOCX files can be ingested in Phase 3.");
  }
}
