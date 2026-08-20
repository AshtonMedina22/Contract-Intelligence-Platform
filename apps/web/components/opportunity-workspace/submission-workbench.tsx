"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ensureSubmissionChecklist,
  saveSubmissionPacket,
  toggleChecklistItem,
} from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";

type Packet = {
  due_at?: string | null;
  question_deadline_at?: string | null;
  submission_method?: string | null;
  portal_recipient?: string | null;
  final_output_version?: string | null;
  google_docs_url?: string | null;
  submitted_at?: string | null;
  confirmation_reference?: string | null;
  notes?: string | null;
} | null;

type ChecklistItem = {
  id: string;
  item_key: string;
  label: string;
  required: boolean;
  completed: boolean;
  notes: string | null;
};

export function SubmissionWorkbench({
  opportunityId,
  packet,
  checklist,
  documents,
  exportHtml,
}: {
  opportunityId: string;
  packet: Packet;
  checklist: ChecklistItem[];
  documents: {
    id: string;
    original_filename: string;
    document_type: string | null;
    processing_status: string;
  }[];
  exportHtml: string;
}) {
  const [pending, startTransition] = useTransition();

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-medium">Submission tracking</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) => {
            startTransition(async () => {
              await saveSubmissionPacket(opportunityId, fd);
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="due_at">Due date/time</Label>
            <Input id="due_at" name="due_at" type="datetime-local" defaultValue={toLocal(packet?.due_at)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="question_deadline_at">Question deadline</Label>
            <Input
              id="question_deadline_at"
              name="question_deadline_at"
              type="datetime-local"
              defaultValue={toLocal(packet?.question_deadline_at)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="submission_method">Submission method</Label>
            <Input
              id="submission_method"
              name="submission_method"
              defaultValue={packet?.submission_method ?? ""}
              placeholder="Portal / email / hand delivery"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="portal_recipient">Portal / recipient</Label>
            <Input
              id="portal_recipient"
              name="portal_recipient"
              defaultValue={packet?.portal_recipient ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="final_output_version">Final output version</Label>
            <Input
              id="final_output_version"
              name="final_output_version"
              defaultValue={packet?.final_output_version ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="google_docs_url">Google Docs working proposal</Label>
            <Input
              id="google_docs_url"
              name="google_docs_url"
              defaultValue={packet?.google_docs_url ?? ""}
              placeholder="https://docs.google.com/…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="submitted_at">Submission timestamp</Label>
            <Input
              id="submitted_at"
              name="submitted_at"
              type="datetime-local"
              defaultValue={toLocal(packet?.submitted_at)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmation_reference">Confirmation / reference #</Label>
            <Input
              id="confirmation_reference"
              name="confirmation_reference"
              defaultValue={packet?.confirmation_reference ?? ""}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" defaultValue={packet?.notes ?? ""} />
          </div>
          <Label className="flex items-center gap-2 text-sm font-normal sm:col-span-2">
            <input type="checkbox" name="mark_submitted" value="1" />
            Mark pursuit stage SUBMITTED
          </Label>
          <Button type="submit" disabled={pending}>
            Save submission packet
          </Button>
        </form>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Checklist</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await ensureSubmissionChecklist(opportunityId);
              })
            }
          >
            Seed default checklist
          </Button>
        </div>
        {checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No checklist items yet. Seed defaults (forms, pricing schedules, refs, insurance, certs, affidavits,
            signatures, notarization, addenda, attachments, approvals).
          </p>
        ) : (
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
                <form
                  className="flex flex-wrap items-center gap-2"
                  action={(fd) => {
                    startTransition(async () => {
                      await toggleChecklistItem(opportunityId, fd);
                    });
                  }}
                >
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="completed" value={item.completed ? "0" : "1"} />
                  <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                    {item.label}
                    {item.required ? " *" : ""}
                  </span>
                  <Button type="submit" size="sm" variant="outline" disabled={pending}>
                    {item.completed ? "Mark incomplete" : "Mark complete"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-medium">Outputs</h2>
        <p className="text-xs text-muted-foreground">
          In-app drafting lives on Response. Export working copies here — never invent content.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => download(`pursuit-${opportunityId}-response.html`, exportHtml || "<p></p>", "text/html")}
          >
            Download HTML / PDF-print
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              download(
                `pursuit-${opportunityId}-response.doc`,
                `<html><body>${exportHtml || ""}</body></html>`,
                "application/msword",
              )
            }
          >
            Download DOCX-compatible
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              const text = (exportHtml || "").replace(/<[^>]+>/g, "\n").replace(/\n+/g, "\n").trim();
              await navigator.clipboard.writeText(text);
            }}
          >
            Copy / paste plain text
          </Button>
          <Link className="text-sm underline" href={`/procurement/opportunities/${opportunityId}/pricing`}>
            Pricing workbook →
          </Link>
          <Link className="text-sm underline" href={`/procurement/opportunities/${opportunityId}/response`}>
            Portal response fields (Response) →
          </Link>
          {packet?.google_docs_url ? (
            <a className="text-sm underline" href={packet.google_docs_url} target="_blank" rel="noreferrer">
              Open Google Docs →
            </a>
          ) : null}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Vault attachments</h2>
          <Link className="text-sm underline" href={`/ingestion/intake?opportunity=${opportunityId}`}>
            Upload more
          </Link>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents linked yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {documents.map((d) => (
              <li key={d.id}>
                <Link className="underline" href={`/ingestion/verification/${d.id}`}>
                  {d.original_filename}
                </Link>{" "}
                <span className="text-muted-foreground">
                  ({d.document_type ?? "—"} · {d.processing_status})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
