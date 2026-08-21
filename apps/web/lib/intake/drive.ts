import {
  DocumentSourceError,
  SOURCE_INGEST_DIRECTION,
  type DocumentSourceExportFormat,
  type DocumentSourceItem,
  type DocumentSourceProvider,
  type FetchedSourceBytes,
  type FetchSourceBytesInput,
  type ListScopedSourceInput,
} from "@lp/shared";
import { MAX_INTAKE_BYTES } from "@/lib/intake/allowed-files";

const GOOGLE_FOLDER = "application/vnd.google-apps.folder";
const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF = "application/pdf";
const FIELDS =
  "id,name,mimeType,modifiedTime,size,parents,md5Checksum,webViewLink,trashed,shortcutDetails";

type FetchLike = typeof fetch;
type GoogleFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  md5Checksum?: string;
  webViewLink?: string;
  trashed?: boolean;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
};

function sourceError(status: number, operation: string, fileId?: string): DocumentSourceError {
  if (status === 401 || status === 403) {
    return new DocumentSourceError(
      "UNAUTHORIZED",
      `Google Drive ${operation} was unauthorized (${status}). The server access token may be expired or missing the required Drive scope.`,
      fileId,
    );
  }
  if (status === 404) {
    return new DocumentSourceError(
      "NOT_FOUND",
      `Google Drive file ${fileId ?? ""} is unavailable upstream (404). Vault evidence is retained.`,
      fileId,
    );
  }
  if (status === 429) {
    return new DocumentSourceError("RATE_LIMITED", `Google Drive ${operation} was rate limited (429).`, fileId);
  }
  return new DocumentSourceError(
    "PROVIDER_ERROR",
    `Google Drive ${operation} failed (${status}).`,
    fileId,
  );
}

function normalizeItem(file: GoogleFile, scopedFolderId?: string | null): DocumentSourceItem {
  const id = file.id?.trim();
  if (!id) throw new DocumentSourceError("PROVIDER_ERROR", "Google Drive returned a file without an id.");
  return {
    upstreamFileId: id,
    name: file.name?.trim() || id,
    mimeType: file.mimeType?.trim() || "application/octet-stream",
    modifiedTime: file.modifiedTime ?? null,
    folderId: file.parents?.[0] ?? scopedFolderId ?? null,
    size: file.size && Number.isFinite(Number(file.size)) ? Number(file.size) : null,
    metadata: {
      parents: file.parents ?? [],
      md5Checksum: file.md5Checksum ?? null,
      webViewLink: file.webViewLink ?? null,
      shortcutDetails: file.shortcutDetails ?? null,
    },
  };
}

function extensionFor(format: Exclude<DocumentSourceExportFormat, null>): string {
  return format === "docx" ? ".docx" : format === "xlsx" ? ".xlsx" : ".pdf";
}

function withoutGoogleExtension(name: string): string {
  return name.replace(/\.(gdoc|gsheet)$/i, "");
}

export class GoogleDriveProvider implements DocumentSourceProvider {
  readonly id = "google_drive" as const;
  readonly direction = SOURCE_INGEST_DIRECTION;

  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.accessToken.trim());
  }

  private async request(url: URL, operation: string, fileId?: string): Promise<Response> {
    if (!this.isConfigured()) {
      throw new DocumentSourceError(
        "NOT_CONFIGURED",
        "Google Drive SOURCE ingestion is not configured. Set GOOGLE_DRIVE_ACCESS_TOKEN on the server.",
        fileId,
      );
    }
    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${this.accessToken.trim()}` },
    });
    if (!response.ok) throw sourceError(response.status, operation, fileId);
    return response;
  }

  private async getMetadata(fileId: string): Promise<DocumentSourceItem> {
    const id = fileId.trim();
    if (!id) throw new DocumentSourceError("UNSUPPORTED", "A Google Drive file ID is required.");
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`);
    url.searchParams.set("fields", FIELDS);
    url.searchParams.set("supportsAllDrives", "true");
    const response = await this.request(url, "metadata lookup", id);
    const file = (await response.json()) as GoogleFile;
    if (file.trashed) throw sourceError(404, "metadata lookup", id);
    return normalizeItem(file);
  }

  async listScoped(input: ListScopedSourceInput): Promise<DocumentSourceItem[]> {
    const maxItems = Math.max(1, Math.min(Math.trunc(input.maxItems || 1), 1000));
    const results: DocumentSourceItem[] = [];
    const seen = new Set<string>();

    for (const rawId of input.fileIds ?? []) {
      const id = rawId.trim();
      if (!id || seen.has(id) || results.length >= maxItems) continue;
      const item = await this.getMetadata(id);
      if (item.mimeType === GOOGLE_FOLDER) {
        throw new DocumentSourceError("UNSUPPORTED", `${id} is a folder; use the folder ID field.`, id);
      }
      seen.add(id);
      results.push(item);
    }

    const folderId = input.folderId?.trim();
    if (!folderId || results.length >= maxItems) return results;

    let pageToken: string | null = null;
    do {
      const remaining = maxItems - results.length;
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("q", `'${folderId.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' in parents and trashed = false`);
      url.searchParams.set("spaces", "drive");
      url.searchParams.set("pageSize", String(Math.min(100, remaining)));
      url.searchParams.set("fields", `nextPageToken,files(${FIELDS})`);
      url.searchParams.set("orderBy", "name");
      url.searchParams.set("supportsAllDrives", "true");
      url.searchParams.set("includeItemsFromAllDrives", "true");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await this.request(url, "scoped folder list", folderId);
      const body = (await response.json()) as { files?: GoogleFile[]; nextPageToken?: string };
      for (const file of body.files ?? []) {
        const item = normalizeItem(file, folderId);
        if (item.mimeType === GOOGLE_FOLDER || seen.has(item.upstreamFileId)) continue;
        seen.add(item.upstreamFileId);
        results.push(item);
        if (results.length >= maxItems) break;
      }
      pageToken = body.nextPageToken ?? null;
    } while (pageToken && results.length < maxItems);

    return results;
  }

  async fetchBytes(input: FetchSourceBytesInput): Promise<FetchedSourceBytes> {
    const item = input.item;
    let exportFormat: DocumentSourceExportFormat = null;
    let outputMime = item.mimeType;
    let filename = item.name;
    let url: URL;

    if (item.mimeType === GOOGLE_DOC) {
      exportFormat = input.exportFormat === "pdf" ? "pdf" : "docx";
      outputMime = exportFormat === "pdf" ? PDF : DOCX;
      filename = `${withoutGoogleExtension(item.name)}${extensionFor(exportFormat)}`;
      url = new URL(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.upstreamFileId)}/export`,
      );
      url.searchParams.set("mimeType", outputMime);
    } else if (item.mimeType === GOOGLE_SHEET) {
      exportFormat = "xlsx";
      outputMime = XLSX;
      filename = `${withoutGoogleExtension(item.name)}.xlsx`;
      url = new URL(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.upstreamFileId)}/export`,
      );
      url.searchParams.set("mimeType", outputMime);
    } else if (item.mimeType.startsWith("application/vnd.google-apps.")) {
      throw new DocumentSourceError(
        "UNSUPPORTED",
        `Google-native MIME type ${item.mimeType} is not supported for SOURCE ingestion.`,
        item.upstreamFileId,
      );
    } else {
      url = new URL(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.upstreamFileId)}`,
      );
      url.searchParams.set("alt", "media");
      url.searchParams.set("supportsAllDrives", "true");
    }

    const response = await this.request(url, exportFormat ? "export" : "download", item.upstreamFileId);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_INTAKE_BYTES) {
      throw new DocumentSourceError(
        "UNSUPPORTED",
        `Drive file exceeds the ${Math.floor(MAX_INTAKE_BYTES / (1024 * 1024))} MB intake limit.`,
        item.upstreamFileId,
      );
    }
    return { item, filename, mimeType: outputMime, bytes, exportFormat };
  }
}

export function createGoogleDriveProvider(
  accessToken: string | null | undefined,
  fetchImpl: FetchLike = fetch,
): GoogleDriveProvider {
  return new GoogleDriveProvider(accessToken?.trim() ?? "", fetchImpl);
}

export function getGoogleDriveSourceProvider(
  env: NodeJS.ProcessEnv = process.env,
): GoogleDriveProvider {
  return createGoogleDriveProvider(env.GOOGLE_DRIVE_ACCESS_TOKEN);
}
