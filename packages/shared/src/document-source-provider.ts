export const SOURCE_INGEST_DIRECTION = "SOURCE_INGEST" as const;

export type DocumentSourceDirection = typeof SOURCE_INGEST_DIRECTION;
export type DocumentSourceProviderId = "local_upload" | "google_drive";
export type DocumentSourceExportFormat = "pdf" | "docx" | "xlsx" | null;

export type DocumentSourceItem = {
  upstreamFileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  folderId: string | null;
  size: number | null;
  metadata: Record<string, unknown>;
};

export type ListScopedSourceInput = {
  fileIds?: readonly string[];
  folderId?: string | null;
  maxItems: number;
};

export type FetchSourceBytesInput = {
  item: DocumentSourceItem;
  exportFormat?: DocumentSourceExportFormat;
};

export type FetchedSourceBytes = {
  item: DocumentSourceItem;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  exportFormat: DocumentSourceExportFormat;
};

export interface DocumentSourceProvider {
  readonly id: DocumentSourceProviderId;
  readonly direction: DocumentSourceDirection;
  isConfigured(): boolean;
  listScoped(input: ListScopedSourceInput): Promise<DocumentSourceItem[]>;
  fetchBytes(input: FetchSourceBytesInput): Promise<FetchedSourceBytes>;
}

export type DocumentSourceErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNSUPPORTED"
  | "PROVIDER_ERROR";

export class DocumentSourceError extends Error {
  constructor(
    public readonly code: DocumentSourceErrorCode,
    message: string,
    public readonly upstreamFileId?: string,
  ) {
    super(message);
    this.name = "DocumentSourceError";
  }
}
