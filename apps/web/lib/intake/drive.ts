import {
  DriveNotConfiguredError,
  type DriveImportedFile,
  type DriveImportPort,
} from "@lp/shared";
import { MAX_INTAKE_BYTES } from "@/lib/intake/allowed-files";

class GoogleDriveImportAdapter implements DriveImportPort {
  constructor(private readonly accessToken: string) {}

  async fetchFile(fileId: string): Promise<DriveImportedFile> {
    const id = fileId.trim();
    if (!id) {
      throw new Error("Drive file ID is required.");
    }

    const metaUrl = new URL("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id));
    metaUrl.searchParams.set("fields", "id,name,mimeType,size");

    const metaResponse = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!metaResponse.ok) {
      throw new Error(`Drive metadata failed (${metaResponse.status}).`);
    }

    const meta = (await metaResponse.json()) as {
      id?: string;
      name?: string;
      mimeType?: string;
      size?: string;
    };

    if (meta.mimeType?.startsWith("application/vnd.google-apps.")) {
      throw new Error(
        "Google-native Drive files must be exported to PDF/XLSX before intake. Import copies bytes as-is.",
      );
    }

    const size = meta.size ? Number(meta.size) : 0;
    if (size > MAX_INTAKE_BYTES) {
      throw new Error("Drive file exceeds the 25 MB Phase 3 limit.");
    }

    const mediaUrl = new URL("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id));
    mediaUrl.searchParams.set("alt", "media");

    const mediaResponse = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!mediaResponse.ok) {
      throw new Error(`Drive download failed (${mediaResponse.status}).`);
    }

    const buffer = new Uint8Array(await mediaResponse.arrayBuffer());
    return {
      fileId: id,
      filename: meta.name ?? `${id}.bin`,
      mimeType: meta.mimeType ?? "application/octet-stream",
      bytes: buffer,
    };
  }
}

class UnconfiguredDriveImportAdapter implements DriveImportPort {
  async fetchFile(): Promise<DriveImportedFile> {
    throw new DriveNotConfiguredError();
  }
}

export function getDriveImportPort(): DriveImportPort {
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim();
  if (!token) {
    return new UnconfiguredDriveImportAdapter();
  }
  return new GoogleDriveImportAdapter(token);
}
