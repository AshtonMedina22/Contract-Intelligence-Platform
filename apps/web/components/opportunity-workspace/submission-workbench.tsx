"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureSubmissionChecklist,
  generateWorkingProposalArtifact,
  markSubmissionSubmitted,
  saveSubmissionConfirmation,
  saveSubmissionPacket,
  syncWorkingProposalGoogleDoc,
  downloadWorkingProposalDocx,
  downloadPortalAnswers,
  downloadWorkingProposalHtml,
  toggleChecklistItem,
} from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";
import { APPROVAL_LAYER_OPTIONS, type ResponseProgress } from "@/lib/opportunity/response";
import {
  computeSubmissionReadiness,
  describeSubmissionOutputs,
  evaluateMarkSubmittedGate,
  NO_AUTO_SUBMIT_NOTICE,
  READINESS_GROUP_LABELS,
  READINESS_STATUS_LABELS,
  READINESS_STATUS_ORDER,
  SUBMISSION_AUTHORIZATION_LABEL,
  SUBMISSION_OVERALL_LABELS,
  type ReadinessApprovalInput,
  type ReadinessGroup,
  type ReadinessItem,
  type ReadinessPricingInput,
  type ReadinessStatus,
} from "@/lib/opportunity/submission-readiness";

type Packet = {
  due_at?: string | null;
  question_deadline_at?: string | null;
  submission_method?: string | null;
  submission_url?: string | null;
  portal_recipient?: string | null;
  submission_instructions?: string | null;
  final_output_version?: string | null;
  google_docs_url?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
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

const METHOD_OPTIONS = [
  { value: "portal", label: "Buyer portal upload" },
  { value: "email", label: "Email to buyer contact" },
  { value: "physical", label: "Physical / hand delivery" },
  { value: "other", label: "Other (describe in instructions)" },
];

const STATUS_BADGE: Record<ReadinessStatus, "default" | "secondary" | "outline" | "destructive"> = {
  COMPLETE: "secondary",
  MISSING: "destructive",
  NEEDS_SIGNATURE: "destructive",
  NEEDS_APPROVAL: "destructive",
  NOT_APPLICABLE: "outline",
  UNKNOWN: "outline",
};

export function SubmissionWorkbench({
  opportunityId,
  packet,
  checklist,
  approvals,
  documents,
  exportHtml,
  responseProgress,
  pricingDecision,
  submittedByLabel,
  googleDocsConfigured,
  hasApprovedContent,
  latestArtifact,
  canPursuitSubmit = true,
}: {
  opportunityId: string;
  packet: Packet;
  checklist: ChecklistItem[];
  approvals: ReadinessApprovalInput[];
  documents: {
    id: string;
    original_filename: string;
    document_type: string | null;
    processing_status: string;
  }[];
  exportHtml: string;
  responseProgress: ResponseProgress | null;
  pricingDecision: ReadinessPricingInput | null;
  submittedByLabel: string | null;
  googleDocsConfigured: boolean;
  hasApprovedContent: boolean;
  canPursuitSubmit?: boolean;
  latestArtifact: {
    id: string;
    version: number;
    content_hash: string;
    approval_state: string;
    immutable: boolean;
    google_doc_url: string | null;
  } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [authorized, setAuthorized] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const readiness = useMemo(
    () =>
      computeSubmissionReadiness({
        checklist,
        approvals,
        pricingDecision,
        responseProgress,
        packet,
      }),
    [checklist, approvals, pricingDecision, responseProgress, packet],
  );

  const gate = evaluateMarkSubmittedGate({ readiness, humanAuthorized: authorized });
  const blockedGate = evaluateMarkSubmittedGate({ readiness, humanAuthorized: true });

  const hasResponseContent = exportHtml.replace(/<[^>]+>/g, "").trim().length > 0;
  const docsUrl = latestArtifact?.google_doc_url || packet?.google_docs_url || null;
  const outputs = describeSubmissionOutputs({
    hasResponseContent,
    hasApprovedContent,
    googleDocsUrl: docsUrl,
    googleDocsConfigured,
  });
  const outputByKind = useMemo(
    () => new Map(outputs.map((o) => [o.kind, o])),
    [outputs],
  );

  const readinessByKey = useMemo(
    () => new Map(readiness.items.map((i) => [i.key, i])),
    [readiness],
  );
  const grouped = useMemo(() => {
    const map = new Map<ReadinessGroup, ReadinessItem[]>();
    for (const item of readiness.items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [readiness]);

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBase64 = (filename: string, base64: string, mime: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = (fn: () => Promise<unknown>, successNote?: string) => {
    setActionError(null);
    setActionNote(null);
    startTransition(async () => {
      try {
        await fn();
        if (successNote) setActionNote(successNote);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ readiness strip */}
      <section
        className="sticky top-0 z-10 -mx-1 space-y-1.5 rounded-md border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        data-testid="readiness-strip"
        data-readiness-overall={readiness.overall}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Badge
            variant={
              readiness.overall === "SUBMITTED"
                ? "default"
                : readiness.overall === "READY"
                  ? "secondary"
                  : "destructive"
            }
            className="text-[10px]"
          >
            {SUBMISSION_OVERALL_LABELS[readiness.overall]}
          </Badge>
          <span className="font-medium" data-testid="readiness-required-count">
            {readiness.requiredComplete}/{readiness.requiredTotal} required items complete
            {readiness.requiredTotal > 0 ? ` (${readiness.requiredCompletionPercent}%)` : ""}
          </span>
          {READINESS_STATUS_ORDER.map((status) => (
            <span key={status} className="whitespace-nowrap">
              <span className="text-muted-foreground">{READINESS_STATUS_LABELS[status]} </span>
              <span
                className={
                  readiness.counts[status] > 0 && status !== "COMPLETE" && status !== "NOT_APPLICABLE"
                    ? "font-semibold text-amber-600 dark:text-amber-400"
                    : "font-semibold"
                }
                data-testid={`readiness-count-${status}`}
              >
                {readiness.counts[status]}
              </span>
            </span>
          ))}
        </div>
        {readiness.blocking.length > 0 ? (
          <div
            className="rounded border border-amber-600/40 bg-amber-50/60 p-2 text-[11px] dark:bg-amber-950/20"
            data-testid="readiness-blocking"
          >
            <p className="font-medium">Blocking submission ({readiness.blocking.length}):</p>
            <ul className="mt-0.5 list-disc pl-4">
              {readiness.blocking.map((item) => (
                <li key={item.key}>
                  <span className="font-medium">{item.label}</span> —{" "}
                  {READINESS_STATUS_LABELS[item.status]}. {item.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No required item is outstanding. {readiness.unknown.length} item(s) are still Unknown —
            an Unknown is never counted as Complete.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">{NO_AUTO_SUBMIT_NOTICE}</p>
      </section>

      {actionError ? (
        <p
          className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs"
          data-testid="submission-error"
        >
          {actionError}
        </p>
      ) : null}
      {actionNote ? (
        <p className="text-xs text-muted-foreground" data-testid="submission-note">
          {actionNote}
        </p>
      ) : null}

      {/* --------------------------------------------------------- mark submitted */}
      <section className="space-y-3 rounded-md border p-4" data-testid="mark-submitted-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Submission record — human action only</h2>
          <Badge variant="outline" className="text-[10px]">
            No auto-submit
          </Badge>
        </div>

        {readiness.submittedAt ? (
          <div className="space-y-3">
            <p className="text-sm" data-testid="submitted-state">
              Marked <span className="font-medium">SUBMITTED</span> at {readiness.submittedAt} by{" "}
              {submittedByLabel ?? readiness.submittedBy ?? "an unrecorded user"}.
            </p>
            <form
              className="grid gap-3 sm:grid-cols-2"
              action={(fd) =>
                run(
                  () => saveSubmissionConfirmation(opportunityId, fd),
                  "Confirmation record updated.",
                )
              }
            >
              <div className="space-y-1">
                <Label htmlFor="confirmation_reference">Buyer confirmation / reference #</Label>
                <Input
                  id="confirmation_reference"
                  name="confirmation_reference"
                  defaultValue={packet?.confirmation_reference ?? ""}
                  placeholder="Portal confirmation, email receipt, delivery receipt"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmation_notes">Submission notes</Label>
                <Input id="confirmation_notes" name="notes" defaultValue={packet?.notes ?? ""} />
              </div>
              <Button type="submit" size="sm" disabled={pending} className="sm:col-span-2 sm:w-fit">
                Save confirmation
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground">
              The submission timestamp and the human who recorded it are kept as an audit fact and are
              not editable here.
            </p>
          </div>
        ) : (
          <form
            className="space-y-3"
            action={(fd) =>
              run(
                () => markSubmissionSubmitted(opportunityId, fd),
                "Submission recorded. Pursuit stage is now SUBMITTED.",
              )
            }
          >
            <div
              className={`rounded-md border p-2 text-xs ${
                blockedGate.allowed
                  ? "text-muted-foreground"
                  : "border-amber-600/40 bg-amber-50/60 dark:bg-amber-950/20"
              }`}
              data-testid="mark-submitted-gate"
              data-gate-code={gate.code}
              data-gate-allowed={gate.allowed ? "true" : "false"}
            >
              {blockedGate.allowed
                ? "Required items are settled. A human still has to authorize the record below."
                : blockedGate.message}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="submitted_at">Submitted at (leave blank for now)</Label>
                <Input id="submitted_at" name="submitted_at" type="datetime-local" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mark_confirmation">Buyer confirmation / reference #</Label>
                <Input
                  id="mark_confirmation"
                  name="confirmation_reference"
                  defaultValue={packet?.confirmation_reference ?? ""}
                  placeholder="Optional at mark time — capture as soon as the buyer returns it"
                />
              </div>
            </div>

            <Label className="flex items-start gap-2 text-xs font-normal">
              <input
                type="checkbox"
                name="submission_authorized"
                value="1"
                data-testid="submission-authorization"
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
                disabled={!blockedGate.allowed}
              />
              <span>{SUBMISSION_AUTHORIZATION_LABEL}</span>
            </Label>

            <Button
              type="submit"
              size="sm"
              data-testid="mark-submitted"
              disabled={pending || !gate.allowed || !canPursuitSubmit}
              title={
                !canPursuitSubmit
                  ? "Requires admin, bidder, or executive (pursuit.submit)."
                  : gate.allowed
                    ? undefined
                    : gate.message
              }
            >
              Mark SUBMITTED
            </Button>
            {!canPursuitSubmit ? (
              <p className="text-xs text-muted-foreground">
                Your role cannot record submission.
              </p>
            ) : null}
          </form>
        )}
      </section>

      {/* -------------------------------------------------------------- checklist */}
      <section className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            {READINESS_GROUP_LABELS.CHECKLIST}
            {checklist.length > 0 ? ` (${checklist.length})` : ""}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => ensureSubmissionChecklist(opportunityId), "Default checklist seeded.")
            }
          >
            Seed default checklist
          </Button>
        </div>
        {checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No checklist items yet, so readiness is <span className="font-medium">Unknown</span> — not
            complete. Seed defaults (forms, pricing schedules, refs, insurance, certs, affidavits,
            signatures, notarization, addenda, attachments, approvals).
          </p>
        ) : (
          <ul className="divide-y rounded border" data-testid="checklist">
            {checklist.map((item) => {
              const readinessItem = readinessByKey.get(`checklist:${item.item_key}`);
              const status = readinessItem?.status ?? "UNKNOWN";
              return (
                <li key={item.id} className="flex flex-wrap items-start gap-2 p-2 text-sm">
                  <Badge
                    variant={STATUS_BADGE[status]}
                    className="mt-0.5 shrink-0 text-[10px]"
                    data-testid={`checklist-status-${item.item_key}`}
                  >
                    {READINESS_STATUS_LABELS[status]}
                  </Badge>
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-xs font-medium">
                      {item.label}
                      {item.required ? (
                        <span className="ml-1 text-muted-foreground">· required</span>
                      ) : (
                        <span className="ml-1 text-muted-foreground">· optional</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{readinessItem?.detail}</p>
                  </div>
                  <form
                    className="flex shrink-0 items-center gap-1"
                    action={(fd) => run(() => toggleChecklistItem(opportunityId, fd))}
                  >
                    <input type="hidden" name="item_id" value={item.id} />
                    <input type="hidden" name="completed" value={item.completed ? "0" : "1"} />
                    <Button type="submit" size="sm" variant="outline" disabled={pending}>
                      {item.completed ? "Mark incomplete" : "Mark complete"}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------------- approvals */}
      <section className="space-y-2 rounded-md border p-4" data-testid="approvals-mirror">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{READINESS_GROUP_LABELS.APPROVALS}</h2>
          <Link
            className="text-xs underline"
            href={`/procurement/opportunities/${opportunityId}/response`}
          >
            Configure / decide on Response →
          </Link>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Mirrored read-only from the approval layers enabled on this pursuit. Approvals are decided
          by a human on the Response tab; nothing on this page can approve a layer.
        </p>
        {(grouped.get("APPROVALS") ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approval layer is enabled on this pursuit, so no internal approval is required by
            configuration.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(grouped.get("APPROVALS") ?? []).map((item) => (
              <li key={item.key} className="flex flex-wrap items-start gap-2">
                <Badge variant={STATUS_BADGE[item.status]} className="mt-0.5 text-[10px]">
                  {READINESS_STATUS_LABELS[item.status]}
                </Badge>
                <span className="text-xs font-medium">{item.label}</span>
                <span className="text-[11px] text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
        )}
        {readiness.approvalsDisabled.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Disabled layers (not required here):{" "}
            {readiness.approvalsDisabled
              .map((k) => APPROVAL_LAYER_OPTIONS.find((o) => o.value === k)?.label ?? k)
              .join(", ")}
            .
          </p>
        ) : null}
      </section>

      {/* ---------------------------------------------- pricing + response mirrors */}
      <section className="grid gap-3 sm:grid-cols-2">
        {(["PRICING", "RESPONSE"] as const).map((group) => (
          <div key={group} className="space-y-1 rounded-md border p-4">
            <h2 className="text-sm font-medium">{READINESS_GROUP_LABELS[group]}</h2>
            {(grouped.get(group) ?? []).map((item) => (
              <div key={item.key} className="space-y-1">
                <Badge variant={STATUS_BADGE[item.status]} className="text-[10px]">
                  {READINESS_STATUS_LABELS[item.status]}
                </Badge>
                <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                {item.fixOn ? (
                  <Link
                    className="text-xs underline"
                    href={`/procurement/opportunities/${opportunityId}/${item.fixOn}`}
                  >
                    Open {item.fixOn} →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* ---------------------------------------------------------------- outputs */}
      <section className="space-y-3 rounded-md border p-4" data-testid="outputs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Outputs</h2>
          <Button
            type="button"
            size="sm"
            data-testid="generate-working-proposal"
            disabled={pending || !hasApprovedContent}
            onClick={() =>
              run(async () => {
                const result = await generateWorkingProposalArtifact(opportunityId);
                setActionNote(
                  `Working proposal v${result.version} generated (${result.approvedCount} approved; ${result.excludedDraftOnly} draft-only excluded).`,
                );
              })
            }
          >
            Generate working proposal
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Assembly uses APPROVED responses only, in org template order — never GPT-ordered. Native
          DOCX is real OOXML. PDF is print-only (no server converter). Google Docs create/sync runs
          only when a server token is configured.
        </p>
        {latestArtifact ? (
          <p className="text-[11px]" data-testid="latest-artifact">
            Latest artifact v{latestArtifact.version} · {latestArtifact.approval_state}
            {latestArtifact.immutable ? " · immutable" : ""} · hash{" "}
            {latestArtifact.content_hash.slice(0, 12)}…
          </p>
        ) : null}
        <ul className="space-y-2">
          <OutputRow
            output={outputByKind.get("HTML_PRINT")!}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="output-html"
                disabled={!hasApprovedContent || pending}
                onClick={() =>
                  run(async () => {
                    const { html } = await downloadWorkingProposalHtml(opportunityId);
                    download(`pursuit-${opportunityId}-proposal.html`, html, "text/html");
                  }, "HTML downloaded.")
                }
              >
                Download .html
              </Button>
            }
          />
          <OutputRow
            output={outputByKind.get("NATIVE_DOCX")!}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="output-docx"
                disabled={!hasApprovedContent || pending}
                onClick={() =>
                  run(async () => {
                    const file = await downloadWorkingProposalDocx(opportunityId);
                    if (!file.isOoxml) throw new Error("DOCX export did not produce OOXML zip bytes.");
                    downloadBase64(
                      file.filename,
                      file.base64,
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    );
                  }, "Native DOCX downloaded.")
                }
              >
                Download .docx
              </Button>
            }
          />
          <OutputRow
            output={outputByKind.get("WORD_HTML")!}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="output-word"
                disabled={!hasResponseContent}
                onClick={() =>
                  download(
                    `pursuit-${opportunityId}-response.doc`,
                    `<html><body>${exportHtml}</body></html>`,
                    "application/msword",
                  )
                }
              >
                Download .doc (legacy)
              </Button>
            }
          />
          <OutputRow
            output={outputByKind.get("PORTAL_ANSWERS")!}
            action={
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="output-portal-csv"
                  disabled={!hasApprovedContent || pending}
                  onClick={() =>
                    run(async () => {
                      const portal = await downloadPortalAnswers(opportunityId);
                      download(
                        `pursuit-${opportunityId}-portal-answers.csv`,
                        portal.csv,
                        "text/csv",
                      );
                    }, "Portal CSV downloaded.")
                  }
                >
                  CSV
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="output-portal-json"
                  disabled={!hasApprovedContent || pending}
                  onClick={() =>
                    run(async () => {
                      const portal = await downloadPortalAnswers(opportunityId);
                      download(
                        `pursuit-${opportunityId}-portal-answers.json`,
                        portal.json,
                        "application/json",
                      );
                    }, "Portal JSON downloaded.")
                  }
                >
                  JSON
                </Button>
              </div>
            }
          />
          <OutputRow
            output={outputByKind.get("PLAIN_TEXT")!}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="output-copy"
                disabled={!hasResponseContent}
                onClick={async () => {
                  const text = exportHtml
                    .replace(/<[^>]+>/g, "\n")
                    .replace(/\n+/g, "\n")
                    .trim();
                  await navigator.clipboard.writeText(text);
                  setActionNote("Plain text copied to the clipboard.");
                }}
              >
                Copy text
              </Button>
            }
          />
          <OutputRow
            output={outputByKind.get("GOOGLE_DOCS")!}
            action={
              <div className="flex flex-wrap gap-1">
                {googleDocsConfigured ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="output-gdocs-sync"
                    disabled={!hasApprovedContent || pending}
                    onClick={() =>
                      run(async () => {
                        const result = await syncWorkingProposalGoogleDoc(opportunityId);
                        if (result.googleBlocker) throw new Error(result.googleBlocker);
                        setActionNote(
                          result.googleDocUrl
                            ? `Google Doc synced (v${result.version}).`
                            : `Generated v${result.version}; Google Doc URL missing.`,
                        );
                      })
                    }
                  >
                    Create / sync Doc
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled data-testid="output-gdocs">
                    Sync blocked (no token)
                  </Button>
                )}
                {docsUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={docsUrl} target="_blank" rel="noreferrer">
                      Open Doc
                    </a>
                  </Button>
                ) : null}
              </div>
            }
          />
          <OutputRow
            output={outputByKind.get("PDF_PRINT")!}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="output-pdf-print"
                disabled={!hasApprovedContent || pending}
                onClick={() =>
                  run(async () => {
                    const { html } = await downloadWorkingProposalHtml(opportunityId);
                    download(`pursuit-${opportunityId}-proposal-print.html`, html, "text/html");
                  }, "HTML ready for browser Print → Save as PDF.")
                }
              >
                Download HTML to print
              </Button>
            }
          />
          <OutputRow
            output={outputByKind.get("PRICING_WORKBOOK")!}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={`/procurement/opportunities/${opportunityId}/pricing`}>
                  Open Pricing
                </Link>
              </Button>
            }
          />
          <OutputRow
            output={outputByKind.get("RESPONSE_TAB")!}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={`/procurement/opportunities/${opportunityId}/response`}>
                  Open Response
                </Link>
              </Button>
            }
          />
        </ul>
      </section>

      {/* ----------------------------------------------------- submission details */}
      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-medium">Submission details (as published by the buyer)</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            run(() => saveSubmissionPacket(opportunityId, fd), "Submission details saved.")
          }
        >
          <div className="space-y-1">
            <Label htmlFor="submission_method">Submission method</Label>
            <select
              id="submission_method"
              name="submission_method"
              defaultValue={packet?.submission_method ?? ""}
              className="flex h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Not recorded</option>
              {METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              {packet?.submission_method &&
              !METHOD_OPTIONS.some((o) => o.value === packet.submission_method) ? (
                <option value={packet.submission_method}>
                  {packet.submission_method} (recorded earlier)
                </option>
              ) : null}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="submission_url">Portal / upload URL</Label>
            <Input
              id="submission_url"
              name="submission_url"
              defaultValue={packet?.submission_url ?? ""}
              placeholder="https://…  (opened by a human — the app never uploads)"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="portal_recipient">Portal name / recipient</Label>
            <Input
              id="portal_recipient"
              name="portal_recipient"
              defaultValue={packet?.portal_recipient ?? ""}
              placeholder="Bonfire / email address / delivery desk"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="due_at">Submission deadline</Label>
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
            <Label htmlFor="final_output_version">Final output version</Label>
            <Input
              id="final_output_version"
              name="final_output_version"
              defaultValue={packet?.final_output_version ?? ""}
              placeholder="v1.0"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="submission_instructions">Buyer submission instructions</Label>
            <Textarea
              id="submission_instructions"
              name="submission_instructions"
              rows={3}
              defaultValue={packet?.submission_instructions ?? ""}
              placeholder="Copies, labelling, envelope markings, portal steps — as published. Do not paraphrase into a requirement."
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="google_docs_url">Google Docs working copy URL</Label>
            <Input
              id="google_docs_url"
              name="google_docs_url"
              defaultValue={packet?.google_docs_url ?? ""}
              placeholder="https://docs.google.com/…  (paste existing, or create/sync when token is set)"
            />
            {!googleDocsConfigured ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Server token absent — create/sync is blocked. Paste a URL to link an existing Doc.
              </p>
            ) : null}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" defaultValue={packet?.notes ?? ""} />
          </div>
          <Button type="submit" size="sm" disabled={pending} className="sm:w-fit">
            Save submission details
          </Button>
        </form>
      </section>

      {/* ------------------------------------------------------ vault attachments */}
      <section className="space-y-2 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Vault attachments ({documents.length})</h2>
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

function OutputRow({
  output,
  action,
}: {
  output: { label: string; honestNote: string; available: boolean; unavailableReason: string | null };
  action: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded border p-2">
      <div className="min-w-[14rem] flex-1">
        <p className="text-xs font-medium">{output.label}</p>
        <p className="text-[11px] text-muted-foreground">{output.honestNote}</p>
        {!output.available && output.unavailableReason ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            {output.unavailableReason}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
