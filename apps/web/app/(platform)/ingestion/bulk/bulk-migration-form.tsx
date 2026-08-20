"use client";

import { useRef, useState, useTransition } from "react";
import { createAndIngestBulkBatch, processBulkBatch, type BulkActionResult } from "./actions";
import type { NamedOption, OpportunityOption, OrgOption } from "@/lib/org/intake-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = {
  organizations: OrgOption[];
  clients: NamedOption[];
  opportunities: OpportunityOption[];
};

export function BulkMigrationForm({ organizations, clients, opportunities }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkActionResult | null>(null);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [batchLabel, setBatchLabel] = useState("");
  const [clientId, setClientId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ingest many files into one batch with checksum dedupe. Processing is deferred until you start
        the batch — verification stays the human bottleneck. No Cloud Run; local/Vercel processor only.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Label htmlFor="batch_label">Batch label</Label>
          <Input
            id="batch_label"
            value={batchLabel}
            onChange={(event) => setBatchLabel(event.currentTarget.value)}
            placeholder="FY24 historical corpus"
            required
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

      <form
        className="space-y-3 rounded-md border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("organization_id", organizationId);
          formData.set("batch_label", batchLabel);
          formData.set("client_id", clientId);
          formData.set("opportunity_id", opportunityId);
          startTransition(async () => {
            setResult(await createAndIngestBulkBatch(formData));
          });
        }}
      >
        <Label htmlFor="files">Files (PDF / XLSX)</Label>
        <Input ref={fileInputRef} id="files" name="files" type="file" multiple accept=".pdf,.xlsx,.xls" />
        <Button type="submit" disabled={pending || !batchLabel.trim()}>
          {pending ? "Ingesting batch…" : "Ingest batch (defer processing)"}
        </Button>
      </form>

      {result?.error ? <p className="text-sm text-red-600">{result.error}</p> : null}

      {result?.summary ? (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p>
            Batch <span className="font-mono text-xs">{result.summary.batchId}</span>{" "}
            <Badge variant="outline">{result.summary.status}</Badge>
          </p>
          <ul className="space-y-1">
            {result.summary.items.map((item) => (
              <li key={`${item.filename}-${item.outcome}`}>
                {item.filename} — {item.outcome}
                {item.error ? `: ${item.error}` : ""}
              </li>
            ))}
          </ul>
          {result.summary.status === "READY" || result.summary.status === "PARTIAL" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData();
                formData.set("organization_id", organizationId);
                formData.set("batch_id", result.summary!.batchId);
                startTransition(async () => {
                  setResult(await processBulkBatch(formData));
                });
              }}
            >
              <Button type="submit" variant="secondary" disabled={pending}>
                {pending ? "Starting…" : "Start batch processing"}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {result?.processing ? (
        <p className="text-sm text-muted-foreground">
          Started {result.processing.started} document(s); {result.processing.failed} failed to start.
          Open Verification Queue when status is NEEDS_REVIEW.
        </p>
      ) : null}
    </div>
  );
}
