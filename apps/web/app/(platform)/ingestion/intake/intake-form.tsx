"use client";

import { useRef, useState, useTransition } from "react";
import { ingestDriveFile, ingestUploadedFiles, type IntakeActionResult } from "./actions";
import type { NamedOption, OpportunityOption, OrgOption } from "@/lib/org/intake-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  organizations: OrgOption[];
  clients: NamedOption[];
  opportunities: OpportunityOption[];
  driveConfigured: boolean;
  defaultOpportunityId?: string;
};

function ResultList({ result }: { result: IntakeActionResult }) {
  if (result.error) {
    return <p className="text-sm text-red-600">{result.error}</p>;
  }
  if (!result.results?.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {result.results.map((item) => (
        <li key={`${item.documentVersionId}-${item.filename}`}>
          <span className="font-medium">{item.filename}</span>
          {item.duplicate
            ? " — identical bytes already in the vault; not reprocessed."
            : " — registered."}
          <div className="break-all text-xs text-muted-foreground">
            sha256 {item.sha256} · {item.storagePath}
            {item.workflow ? ` · run ${item.workflow.runId}` : ""}
          </div>
        </li>
      ))}
    </ul>
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
  const [fileCount, setFileCount] = useState(0);
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
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                appendSharedFields(formData);
                startTransition(async () => {
                  setResult(await ingestUploadedFiles(formData));
                });
              }}
            >
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
                  setFileCount(event.dataTransfer.files.length);
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
                  onChange={(event) => setFileCount(event.currentTarget.files?.length ?? 0)}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {fileCount > 0
                    ? `${fileCount} file(s) selected.`
                    : "Max 50 MB per file. Originals are never overwritten."}
                </p>
              </div>

              <Button type="submit" disabled={pending || organizations.length === 0}>
                {pending ? "Ingesting…" : "Ingest files"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import from Google Drive</CardTitle>
            <CardDescription>
              Copies bytes into Storage and keeps the Drive file ID. Drive files are not deleted.
              {!driveConfigured
                ? " Set GOOGLE_DRIVE_ACCESS_TOKEN to enable this adapter."
                : " Paste a Drive file ID."}
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
                <Label htmlFor="drive_file_id">Drive file ID</Label>
                <Input
                  id="drive_file_id"
                  name="drive_file_id"
                  placeholder="1Abc…"
                  disabled={!driveConfigured}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={pending || !driveConfigured}>
                {pending ? "Importing…" : "Copy into vault"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {result ? <ResultList result={result} /> : null}
    </div>
  );
}
