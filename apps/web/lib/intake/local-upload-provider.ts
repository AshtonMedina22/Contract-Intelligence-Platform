import {
  SOURCE_INGEST_DIRECTION,
  type DocumentSourceItem,
  type DocumentSourceProvider,
  type FetchedSourceBytes,
  type FetchSourceBytesInput,
  type ListScopedSourceInput,
} from "@lp/shared";

export type LocalUploadFile = {
  name: string;
  type?: string;
  size: number;
  lastModified?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export class LocalUploadProvider implements DocumentSourceProvider {
  readonly id = "local_upload" as const;
  readonly direction = SOURCE_INGEST_DIRECTION;

  constructor(private readonly files: readonly LocalUploadFile[]) {}

  isConfigured(): boolean {
    return true;
  }

  async listScoped(input: ListScopedSourceInput): Promise<DocumentSourceItem[]> {
    const limit = Math.max(1, Math.min(input.maxItems, this.files.length));
    return this.files.slice(0, limit).map((file, index) => ({
      upstreamFileId: `local:${index}:${file.name}`,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      modifiedTime:
        typeof file.lastModified === "number" && file.lastModified > 0
          ? new Date(file.lastModified).toISOString()
          : null,
      folderId: null,
      size: file.size,
      metadata: { source: "browser_upload" },
    }));
  }

  async fetchBytes(input: FetchSourceBytesInput): Promise<FetchedSourceBytes> {
    const parts = input.item.upstreamFileId.split(":");
    const index = Number(parts[1]);
    const file = this.files[index];
    if (!file) throw new Error(`Local upload ${input.item.name} is no longer available.`);
    return {
      item: input.item,
      filename: file.name,
      mimeType: file.type || input.item.mimeType,
      bytes: new Uint8Array(await file.arrayBuffer()),
      exportFormat: null,
    };
  }
}
