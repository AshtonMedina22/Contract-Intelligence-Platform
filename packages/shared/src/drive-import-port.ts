export type DriveImportedFile = {
  fileId: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type DriveImportPort = {
  fetchFile(fileId: string): Promise<DriveImportedFile>;
};

export class DriveNotConfiguredError extends Error {
  constructor() {
    super(
      "Google Drive import is not configured. Set GOOGLE_DRIVE_ACCESS_TOKEN to copy a Drive file into the evidence vault.",
    );
    this.name = "DriveNotConfiguredError";
  }
}
