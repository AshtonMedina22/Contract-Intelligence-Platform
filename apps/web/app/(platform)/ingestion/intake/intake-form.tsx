"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ingestDriveFile, ingestUploadedFiles, type IntakeActionResult } from "./actions";
import type { NamedOption, OpportunityOption, OrgOption } from "@/lib/org/intake-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_INTAKE_BYTES } from "@/lib/intake/allowed-files";

// Preflight must reject exactly what the server rejects, so both read one constant.
// The processor imposes no byte limit of its own — it downloads from the vault.
const MAX_FILE_SIZE_BYTES = MAX_INTAKE_BYTES;
const MAX_FILE_SIZE_MB = Math.floor(MAX_INTAKE_BYTES / (1024 * 1024));
const ALLOWED_EXTENSIONS = [".pdf", ".xlsx", ".xls", ".docx"];

type FileStatus = "pending" | "uploading" | "ok" | "duplicate" | "error";
type FileEntry = {
  file: File;
  status: FileStatus;
  error?: string;
  documentId?: string;
};

type Props = {
  organizations: OrgOption[];
  clients: NamedOption[];
  opportunities: OpportunityOption[];
  driveConfigured: boolean;
  defaultOpportunityId?: string;
};

function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file.size) {
    return { valid: false, error: "Empty file" };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `Exceeds ${MAX_FILE_SIZE_MB} MB limit` };
  }
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Unsupported extension: ${ext}` };
  }
  return { valid: true };
}

function StatusBadge({ status }: { status: FileStatus }) {
  const variants: Record<FileStatus, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
    uploading: { label: "Uploading", className: "bg-blue-100 text-blue-700" },
    ok: { label: "OK", className: "bg-green-100 text-green-700" },
    duplicate: { label: "Duplicate", className: "bg-yellow-100 text-yellow-700" },
    error: { label: "Error", className: "bg-red-100 text-red-700" },
  };
  const v = variants[status];
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function ResultList({ result, fileEntries }: { result: IntakeActionResult; fileEntries: FileEntry[] }) {
  if (result.error) {
    return <p className="text-sm text-red-600">{result.error}</p>;
  }
  if (!result.results?.length && !result.driveSync?.results.length && fileEntries.length === 0) return null;
  
  const successResults = result.results?.filter(r => !r.duplicate) ?? [];
  const hasSuccess = successResults.length > 0;

  return (
    <div className="space-y-3">
      {fileEntries.length > 0 && (
        <div className="rounded-md border text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-2 text-left font-medium">Filename</th>
                <th className="p-2 text-left font-medium">Status</th>
                <th className="p-2 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {fileEntries.map((entry, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="p-2 font-mono text-xs">{entry.file.name}</td>
                  <td className="p-2"><StatusBadge status={entry.status} /></td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {entry.error ?? (entry.status === "duplicate" ? "Identical bytes in vault" : "")}
                    {entry.documentId && entry.status === "ok" && (
                      <Link href={`/ingestion/verification/${entry.documentId}`} className="ml-2 underline">
                        Verify →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.driveSync?.results.length ? (
        <div className="rounded-md border text-sm">
          <div className="border-b bg-muted/40 px-3 py-2 font-medium">
            Google Drive SOURCE sync · {result.driveSync.selected} selected
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium">File</th>
                <th className="p-2 text-left font-medium">Status</th>
                <th className="p-2 text-left font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {result.driveSync.results.map((row) => (
                <tr key={`${row.upstreamFileId}:${row.status}`} className="border-b last:border-0">
                  <td className="p-2 text-xs">{row.filename}</td>
                  <td className="p-2"><Badge variant="outline">{row.status}</Badge></td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {row.message ?? "Copied to the Supabase evidence vault."}
                    {row.documentId ? (
                      <Link className="ml-2 underline" href={`/ingestion/verification/${row.documentId}`}>
                        Verify →
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {hasSuccess && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">Quick links:</span>
          <Link href="/ingestion/processing" className="underline">Processing queue</Link>
          {successResults.length === 1 && successResults[0].documentId && (
            <>
              <span className="text-muted-foreground">·</span>
              <Link href={`/ingestion/verification/${successResults[0].documentId}`} className="underline">
                Verification workbench
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function IntakeForm({
  organizations,
  clients,
  opportunities,
  driveConfigured,
  defaultOpportunityId = "",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<IntakeActionResult | null>(null);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [batchLabel, setBatchLabel] = useState("");
  const [packageKey, setPackageKey] = useState("");
  const [packageTitle, setPackageTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [opportunityId, setOpportunityId] = useState(defaultOpportunityId);

  function appendSharedFields(formData: FormData) {
    formData.set("organization_id", organizationId);
    formData.set("batch_label", batchLabel);
    formData.set("package_key", packageKey);
    formData.set("package_title", packageTitle);
    formData.set("client_id", clientId);
    formData.set("opportunity_id", opportunityId);
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) {
      setFileEntries([]);
      setPreflightErrors([]);
      return;
    }
    const entries: FileEntry[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const validation = validateFile(file);
      if (validation.valid) {
        entries.push({ file, status: "pending" });
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }
    setFileEntries(entries);
    setPreflightErrors(errors);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fileEntries.length === 0) {
      setResult({ error: "Choose at least one valid file." });
      return;
    }

    setFileEntries((prev) => prev.map((e) => ({ ...e, status: "uploading" as FileStatus })));

    const formData = new FormData();
    for (const entry of fileEntries) {
      formData.append("files", entry.file);
    }
    appendSharedFields(formData);

    startTransition(async () => {
      const res = await ingestUploadedFiles(formData);
      setResult(res);

      if (res.results) {
        setFileEntries((prev) =>
          prev.map((entry) => {
            const match = res.results?.find((r) => r.filename === entry.file.name);
            if (match) {
              return {
                ...entry,
                status: match.duplicate ? "duplicate" : "ok",
                documentId: match.documentId,
              };
            }
            return { ...entry, status: "error", error: "Not processed" };
          })
        );
      } else if (res.error) {
        setFileEntries((prev) =>
          prev.map((e) => ({ ...e, status: "error", error: res.error }))
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="organization_id">Organization</Label>
          <select
            id="organization_id"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.currentTarget.value)}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="batch_label">Batch label (optional)</Label>
          <Input
            id="batch_label"
            value={batchLabel}
            onChange={(event) => setBatchLabel(event.currentTarget.value)}
            placeholder="FY26 RFP package"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="package_key">Package key (optional)</Label>
          <Input
            id="package_key"
            value={packageKey}
            onChange={(event) => setPackageKey(event.currentTarget.value)}
            placeholder="PKG-01"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="package_title">Package title (optional)</Label>
          <Input
            id="package_title"
            value={packageTitle}
            onChange={(event) => setPackageTitle(event.currentTarget.value)}
            placeholder="Williamson #202569"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="client_id">Client (optional)</Label>
          <select
            id="client_id"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={clientId}
            onChange={(event) => setClientId(event.currentTarget.value)}
          >
            <option value="">None</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="opportunity_id">Opportunity (optional)</Label>
          <select
            id="opportunity_id"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={opportunityId}
            onChange={(event) => setOpportunityId(event.currentTarget.value)}
          >
            <option value="">None</option>
            {opportunities.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload files</CardTitle>
            <CardDescription>
              PDF and XLSX land in the evidence vault with a SHA-256 checksum. Identical bytes reuse
              the existing version.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div
                className={`rounded-md border border-dashed p-6 text-sm ${
                  dragActive ? "border-primary bg-muted/40" : "border-input"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const input = fileInputRef.current;
                  if (!input) return;
                  input.files = event.dataTransfer.files;
                  handleFilesSelected(event.dataTransfer.files);
                }}
              >
                <Label htmlFor="files">Drop PDF/XLSX files here or browse</Label>
                <Input
                  ref={fileInputRef}
                  id="files"
                  name="files"
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.docx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="mt-2"
                  onChange={(event) => handleFilesSelected(event.currentTarget.files)}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {fileEntries.length > 0
                    ? `${fileEntries.length} valid file(s) selected.`
                    : `Max ${MAX_FILE_SIZE_MB} MB per file. PDF, XLSX, XLS, DOCX only.`}
                </p>
              </div>

              {preflightErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-medium">Preflight errors (files skipped):</p>
                  <ul className="mt-1 list-inside list-disc">
                    {preflightErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button type="submit" disabled={pending || organizations.length === 0 || fileEntries.length === 0}>
                {pending ? "Ingesting…" : `Ingest ${fileEntries.length || ""} file${fileEntries.length !== 1 ? "s" : ""}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import from Google Drive</CardTitle>
            <CardDescription>
              Selective SOURCE ingestion only: copy chosen files into the Supabase Storage evidence
              vault. Drive remains a human workspace, never the canonical database. Folder imports
              are one level only and bounded by max items.
              {!driveConfigured
                ? " Live sync blocked: GOOGLE_DRIVE_ACCESS_TOKEN is unset on the server."
                : " Google Docs export to DOCX/PDF; Sheets export to XLSX."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                appendSharedFields(formData);
                startTransition(async () => {
                  setResult(await ingestDriveFile(formData));
                });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="drive_file_ids">Drive file IDs (optional)</Label>
                <textarea
                  id="drive_file_ids"
                  name="drive_file_ids"
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  placeholder="One ID per line, or comma-separated"
                  disabled={!driveConfigured}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="drive_folder_id">Scoped folder ID (optional, non-recursive)</Label>
                <Input
                  id="drive_folder_id"
                  name="drive_folder_id"
                  placeholder="1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF"
                  disabled={!driveConfigured}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="drive_max_items">Max items</Label>
                  <Input
                    id="drive_max_items"
                    name="drive_max_items"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={25}
                    disabled={!driveConfigured}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="drive_doc_export_format">Google Docs export</Label>
                  <select
                    id="drive_doc_export_format"
                    name="drive_doc_export_format"
                    defaultValue="docx"
                    disabled={!driveConfigured}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="docx">DOCX</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Staging folders: Platform <span className="font-mono">1_I4…yxYvF</span> · Test
                Documents <span className="font-mono">16OA…qtGfc</span>. Upstream deletion marks the
                link unavailable; vault evidence is never deleted.
              </p>
              <Button type="submit" variant="secondary" disabled={pending || !driveConfigured}>
                {pending ? "Syncing…" : "Sync selected sources"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {result ? <ResultList result={result} fileEntries={fileEntries} /> : null}
    </div>
  );
}
