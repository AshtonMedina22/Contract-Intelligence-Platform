"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FactRef } from "./shared";
import { ResponseTiptapEditor } from "./response-tiptap-editor";
import { ResponseSourceSheet, type WorkspaceSource } from "./response-source-sheet";
import {
  NEVER_INVENT_LP_FACTS,
  parseSourcesUsed,
  type RequirementMatrixRow,
  type RequirementResponseRow,
} from "@/lib/opportunity/response";
import {
  buildResponseSavePayload,
  evaluateDraftGate,
  requirementWorkState,
  REQUIREMENT_WORK_STATE_LABELS,
  RESPONSE_FILTERS,
  responseFilterCounts,
  responseProgressWithPercent,
  matchesResponseFilter,
  type ResponseFilterKey,
  type ResponseSaveIntent,
} from "@/lib/opportunity/response-workspace-model";
import {
  generateRequirementDraft,
  loadRequirementEvidence,
  saveRequirementResponse,
  upsertApprovalLayer,
} from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";
import type { ApprovalLayerKey, ApprovalStatus } from "@/lib/opportunity/response";
import { APPROVAL_LAYER_OPTIONS } from "@/lib/opportunity/response";

type ApprovalRow = {
  id: string;
  layer_key: ApprovalLayerKey;
  enabled: boolean;
  status: ApprovalStatus;
  notes: string | null;
  decided_at: string | null;
};

type Context = {
  buyerName: string | null;
  winLoss: {
    outcome: string;
    documented_reason: string | null;
    lessons_learned: string | null;
    winner_name: string | null;
  } | null;
  competitorBids: { name: string; quoted_amount: number | null; note: string | null }[];
  proposalSections: { section_key: string; title: string | null; excerpt: string | null; source_page: number | null }[];
};

export function ResponseWorkspace({
  opportunityId,
  requirements,
  responses,
  approvals,
  context,
  factDocumentMap,
  knowledgeHits,
  initialRequirementId,
  canProposalApprove = true,
}: {
  opportunityId: string;
  requirements: RequirementMatrixRow[];
  responses: RequirementResponseRow[];
  approvals: ApprovalRow[];
  context: Context;
  factDocumentMap: Map<string, string>;
  knowledgeHits: WorkspaceSource[];
  initialRequirementId?: string | null;
  canProposalApprove?: boolean;
}) {
  const firstId = initialRequirementId ?? requirements[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(firstId);
  const [filter, setFilter] = useState<ResponseFilterKey>("ALL");
  const [pending, startTransition] = useTransition();

  const responseByReq = useMemo(
    () => new Map(responses.map((r) => [r.requirement_id, r])),
    [responses],
  );
  const selected = requirements.find((r) => r.id === selectedId) ?? null;
  const selectedResp = selected ? responseByReq.get(selected.id) : undefined;

  const [draftHtml, setDraftHtml] = useState(selectedResp?.draft_html ?? "");
  const [priorHtml, setPriorHtml] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [acknowledgeLpInput, setAcknowledgeLpInput] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const [evidenceByReq, setEvidenceByReq] = useState<Record<string, WorkspaceSource[]>>(() =>
    firstId ? { [firstId]: knowledgeHits } : {},
  );
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const evidenceRequest = useRef(0);

  const progress = responseProgressWithPercent(requirements, responses);
  const counts = useMemo(() => responseFilterCounts(requirements, responses), [requirements, responses]);
  const visibleRequirements = useMemo(
    () => requirements.filter((req) => matchesResponseFilter(filter, req, responseByReq.get(req.id))),
    [requirements, filter, responseByReq],
  );

  const evidence = evidenceByReq[selectedId] ?? [];
  const sourcesUsed = useMemo(() => parseSourcesUsed(selectedResp?.sources_used), [selectedResp]);

  const gate = evaluateDraftGate({
    requirementId: selected?.id ?? null,
    evidenceState: selectedResp?.evidence_state ?? null,
    draftStatus: selectedResp?.draft_status ?? null,
    availableSources: evidence,
    selectedSourceIds,
    acknowledgeLpInput,
  });

  // Retrieval follows the selection, so the right rail and the source sheet always describe the
  // requirement on screen rather than the first row on the page.
  useEffect(() => {
    if (!selectedId || evidenceByReq[selectedId]) return;
    const requestId = ++evidenceRequest.current;
    setEvidenceLoading(true);
    loadRequirementEvidence(opportunityId, selectedId)
      .then((hits) => {
        if (requestId !== evidenceRequest.current) return;
        setEvidenceByReq((prev) => ({ ...prev, [selectedId]: hits }));
      })
      .catch(() => {
        if (requestId !== evidenceRequest.current) return;
        setEvidenceByReq((prev) => ({ ...prev, [selectedId]: [] }));
      })
      .finally(() => {
        if (requestId === evidenceRequest.current) setEvidenceLoading(false);
      });
  }, [opportunityId, selectedId, evidenceByReq]);

  const selectReq = (id: string) => {
    setSelectedId(id);
    setDraftHtml(responseByReq.get(id)?.draft_html ?? "");
    setPriorHtml(null);
    setCompareOpen(false);
    setSelectedSourceIds([]);
    setAcknowledgeLpInput(false);
    setDirty(false);
    setActionNote(null);
  };

  const persist = useCallback(
    (intent: ResponseSaveIntent, html: string, note?: string) => {
      if (!selected) return;
      const payload = buildResponseSavePayload({
        intent,
        requirementId: selected.id,
        draftHtml: html,
        existing: selectedResp ?? null,
        lpInputNote: note,
      });
      setSaving(true);
      startTransition(async () => {
        try {
          const fd = new FormData();
          for (const [key, value] of Object.entries(payload)) fd.set(key, value);
          await saveRequirementResponse(opportunityId, fd);
          setDirty(false);
          setLastSavedAt(Date.now());
        } finally {
          setSaving(false);
        }
      });
    },
    [opportunityId, selected, selectedResp],
  );

  const runGenerate = (instruction?: string) => {
    if (!selected || !gate.allowed) return;
    const before = draftHtml;
    startTransition(async () => {
      const result = await generateRequirementDraft(opportunityId, selected.id, instruction);
      setPriorHtml(before);
      setDraftHtml(result.draft_response);
      setDirty(false);
      setLastSavedAt(Date.now());
      setCompareOpen(Boolean(before.trim()));
      setActionNote(
        result.evidence_state === "L_AND_P_INPUT_REQUIRED"
          ? "Generation returned no supported text. The requirement stays L&P INPUT REQUIRED."
          : "Generated as a DRAFT. A human must still approve it.",
      );
    });
  };

  const toggleSource = (chunkId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(chunkId) ? prev.filter((id) => id !== chunkId) : [...prev, chunkId],
    );
  };

  const draftHasText = draftHtml.replace(/<[^>]+>/g, "").trim().length > 0;
  const isApproved = selectedResp?.draft_status === "APPROVED";

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 rounded-md border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-medium">
            Response progress {progress.completionPercent}% approved
          </span>
          <Counter label="Total" value={progress.totalRequirements} />
          <Counter label="Verified" value={progress.verified} />
          <Counter label="Drafted" value={progress.drafted} />
          <Counter label="Approved" value={progress.approved} />
          <Counter label="L&P input req" value={progress.lpInputRequired} tone={progress.lpInputRequired > 0} />
          <Counter label="Mandatory out" value={progress.mandatoryOutstanding} tone={progress.mandatoryOutstanding > 0} />
          <Counter label="Attach missing" value={progress.requiredAttachmentsMissing} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          GPT may only use allowed evidence (DO_NOT_USE never enters drafting). Never invent:{" "}
          {NEVER_INVENT_LP_FACTS.join(", ")}. Unsupported facts → L&P INPUT REQUIRED. Approval is
          always human.
        </p>
      </div>

      {requirements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No verified requirements yet. Promote solicitation requirements first.
        </p>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="min-h-[560px] rounded-md border">
          <ResizablePanel defaultSize={24} minSize={16} className="overflow-auto p-2">
            <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Requirement filters">
              {RESPONSE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  data-testid={`req-filter-${f.key}`}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded border px-1.5 py-0.5 text-[11px] ${
                    filter === f.key ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {f.label} {counts[f.key]}
                </button>
              ))}
            </div>
            <ul className="space-y-1" data-testid="requirement-nav">
              {visibleRequirements.map((req) => {
                const resp = responseByReq.get(req.id);
                const state = requirementWorkState(req, resp);
                const active = req.id === selectedId;
                return (
                  <li key={req.id}>
                    <button
                      type="button"
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                        active ? "bg-muted font-medium" : "hover:bg-muted/60"
                      }`}
                      onClick={() => selectReq(req.id)}
                    >
                      <span className="line-clamp-2">{req.statement}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {REQUIREMENT_WORK_STATE_LABELS[state]}
                        {req.mandatory ? " · mandatory" : ""}
                        {req.scored ? ` · scored ${req.weight_pct ?? "—"}%` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
              {visibleRequirements.length === 0 ? (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">
                  No requirement matches this filter.
                </li>
              ) : null}
            </ul>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={46} minSize={30} className="overflow-auto p-3">
            {selected ? (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-xs" data-testid="selected-requirement-statement">
                    {selected.statement}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      § {selected.section_ref ?? "—"} · p.{selected.source_page ?? "—"}
                    </Badge>
                    <Badge variant={selected.mandatory ? "default" : "secondary"} className="text-[10px]">
                      {selected.mandatory ? "Mandatory" : "Optional"}
                    </Badge>
                    {selected.scored ? (
                      <Badge variant="outline" className="text-[10px]">
                        Scored {selected.weight_pct ?? "—"}%
                      </Badge>
                    ) : null}
                    {selected.attachment_required ? (
                      <Badge variant="outline" className="text-[10px]">
                        Attachment required{selected.form_name ? ` · ${selected.form_name}` : ""}
                      </Badge>
                    ) : null}
                    <Badge
                      variant={
                        selectedResp?.evidence_state === "L_AND_P_INPUT_REQUIRED"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[10px]"
                      data-testid="evidence-state-badge"
                    >
                      Evidence: {selectedResp?.evidence_state ?? "NOT CLASSIFIED"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Matrix: {selected.matrix_status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Draft: {selectedResp?.draft_status ?? "EMPTY"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Source fact{" "}
                      <FactRef
                        factId={selected.source_fact_id}
                        documentId={factDocumentMap.get(selected.source_fact_id ?? "")}
                      />
                    </span>
                  </div>
                </div>

                <div
                  className={`rounded-md border p-2 text-xs ${
                    gate.allowed
                      ? "text-muted-foreground"
                      : "border-amber-600/40 bg-amber-50/50 dark:bg-amber-950/20"
                  }`}
                  data-testid="draft-gate"
                  data-gate-code={gate.code}
                  data-gate-allowed={gate.allowed ? "true" : "false"}
                >
                  {gate.message}
                  {gate.code === "SOURCE_SELECTION_REQUIRED" ? (
                    <span> Selected: {selectedSourceIds.length} passage(s).</span>
                  ) : null}
                  {selectedResp?.evidence_state === "L_AND_P_INPUT_REQUIRED" ? (
                    <Label className="mt-1.5 flex items-center gap-2 text-[11px] font-normal">
                      <input
                        type="checkbox"
                        data-testid="lp-input-override"
                        checked={acknowledgeLpInput}
                        onChange={(e) => setAcknowledgeLpInput(e.target.checked)}
                      />
                      Override: re-run retrieval anyway (unsupported facts stay L&P INPUT REQUIRED)
                    </Label>
                  ) : null}
                </div>

                <ResponseTiptapEditor
                  html={draftHtml}
                  onChange={(html) => {
                    setDraftHtml(html);
                    setDirty(true);
                  }}
                  onAutosave={(html) => persist("AUTOSAVE", html)}
                  onSave={(html) => persist("SAVE_DRAFT", html)}
                  onImprove={(selectedText) =>
                    runGenerate(
                      selectedText.trim()
                        ? `Rewrite this passage more clearly, using only the supplied evidence: ${selectedText.trim().slice(0, 300)}`
                        : "Rewrite the response more clearly using only the supplied evidence.",
                    )
                  }
                  improveDisabledReason={gate.allowed ? null : gate.message}
                  status={{ dirty, saving, lastSavedAt }}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    data-testid="generate-draft"
                    disabled={pending || !gate.allowed}
                    title={gate.allowed ? undefined : gate.message}
                    onClick={() => runGenerate()}
                  >
                    Generate grounded draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || !dirty}
                    onClick={() => persist("SAVE_DRAFT", draftHtml)}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending || !priorHtml}
                    onClick={() => setCompareOpen((v) => !v)}
                  >
                    {compareOpen ? "Hide compare" : "Compare"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="view-sources"
                    onClick={() => setSheetOpen(true)}
                  >
                    View sources ({sourcesUsed.length || evidence.length})
                  </Button>
                  {isApproved ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => persist("REOPEN", draftHtml)}
                    >
                      Reopen for editing
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="approve-response"
                      disabled={pending || !draftHasText || !canProposalApprove}
                      title={
                        !canProposalApprove
                          ? "Requires admin, bidder, or executive (proposal.approve)."
                          : draftHasText
                            ? undefined
                            : "Nothing to approve yet."
                      }
                      onClick={() => persist("APPROVE", draftHtml)}
                    >
                      Human approve response
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="request-lp-input"
                    disabled={pending}
                    onClick={() => persist("REQUEST_LP_INPUT", draftHtml)}
                  >
                    Request L&P input
                  </Button>
                </div>

                {actionNote ? (
                  <p className="text-xs text-muted-foreground" data-testid="action-note">
                    {actionNote}
                  </p>
                ) : null}

                {compareOpen && priorHtml !== null ? (
                  <div className="grid gap-2 md:grid-cols-2" data-testid="compare-view">
                    <div className="rounded-md border p-2">
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                        Before generation
                      </p>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none text-xs"
                        dangerouslySetInnerHTML={{ __html: priorHtml }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={pending}
                        onClick={() => {
                          setDraftHtml(priorHtml);
                          setDirty(true);
                        }}
                      >
                        Restore this version
                      </Button>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                        Current draft
                      </p>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none text-xs"
                        dangerouslySetInnerHTML={{ __html: draftHtml }}
                      />
                    </div>
                  </div>
                ) : null}

                {selectedResp?.missing_information ? (
                  <p className="rounded-md border border-amber-600/40 bg-amber-50/50 p-2 text-xs dark:bg-amber-950/20">
                    Missing: {selectedResp.missing_information}
                  </p>
                ) : null}
                {selectedResp?.assumptions ? (
                  <p className="text-xs text-muted-foreground">Assumptions: {selectedResp.assumptions}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a requirement.</p>
            )}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={30} minSize={18} className="overflow-auto p-3 text-sm">
            <h2 className="mb-2 text-sm font-medium">Context</h2>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Source requirement</p>
              <p className="text-xs">{selected?.statement ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">
                § {selected?.section_ref ?? "—"} · p.{selected?.source_page ?? "—"} ·{" "}
                {selected?.mandatory ? "mandatory" : "optional"}
                {selected?.scored ? ` · scored ${selected.weight_pct ?? "—"}%` : ""}
                {selected?.attachment_required ? " · attachment required" : ""}
              </p>
            </section>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Sources used by the saved response
              </p>
              {sourcesUsed.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  None recorded — no grounded draft has been generated for this requirement.
                </p>
              ) : (
                sourcesUsed.map((s) => (
                  <p key={s.chunk_id} className="text-[11px] text-muted-foreground">
                    [{s.reuse_status}] {s.excerpt.slice(0, 140)}…
                  </p>
                ))
              )}
            </section>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Approved historical content</p>
              {(context.proposalSections.length === 0
                ? evidence.filter((h) => h.reuse_status === "APPROVED").slice(0, 4)
                : []
              ).map((h) => (
                <p key={h.chunk_id} className="text-xs text-muted-foreground">
                  [{h.reuse_status}] {h.content.slice(0, 140)}…
                </p>
              ))}
              {context.proposalSections.map((s) => (
                <p key={s.section_key} className="text-xs">
                  {s.title ?? s.section_key}: {(s.excerpt ?? "").slice(0, 120)}
                </p>
              ))}
              {context.proposalSections.length === 0 &&
              evidence.filter((h) => h.reuse_status === "APPROVED").length === 0 ? (
                <p className="text-xs text-muted-foreground">No APPROVED passages yet.</p>
              ) : null}
            </section>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Buyer history</p>
              <p className="text-xs">{context.buyerName ?? "—"}</p>
            </section>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Competitor intelligence</p>
              {context.competitorBids.length === 0 ? (
                <p className="text-xs text-muted-foreground">None sourced on this pursuit.</p>
              ) : (
                context.competitorBids.map((b, i) => (
                  <p key={i} className="text-xs">
                    {b.name}: {b.quoted_amount ?? "—"}
                  </p>
                ))
              )}
            </section>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Prior win/loss</p>
              {context.winLoss ? (
                <p className="text-xs">
                  {context.winLoss.outcome} — {context.winLoss.lessons_learned ?? context.winLoss.documented_reason ?? "—"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No outcome on this pursuit yet.</p>
              )}
              <Link className="text-xs underline" href="/intelligence/win-loss">
                Win/Loss intelligence →
              </Link>
            </section>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Sources / evidence for this requirement
              </p>
              {evidenceLoading ? <p className="text-xs text-muted-foreground">Retrieving…</p> : null}
              {evidence.slice(0, 5).map((h) => (
                <p key={h.chunk_id} className="text-[11px] text-muted-foreground">
                  {h.reuse_status} p.{h.source_page ?? "?"} — {h.content.slice(0, 100)}…
                </p>
              ))}
              {!evidenceLoading && evidence.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No allowed passage matched this requirement.
                </p>
              ) : null}
              <button
                type="button"
                className="text-xs underline"
                onClick={() => setSheetOpen(true)}
              >
                View sources →
              </button>
            </section>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Missing L&P facts</p>
              <p className="text-xs text-muted-foreground">
                {selectedResp?.missing_information ||
                  (selectedResp?.evidence_state === "L_AND_P_INPUT_REQUIRED"
                    ? "L&P INPUT REQUIRED — do not invent."
                    : "—")}
              </p>
            </section>
            <section className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Approvals (configurable)</p>
              {APPROVAL_LAYER_OPTIONS.map((layer) => {
                const row = approvals.find((a) => a.layer_key === layer.value);
                return (
                  <form
                    key={layer.value}
                    className="rounded border p-2 text-xs"
                    action={(fd) => {
                      startTransition(async () => {
                        await upsertApprovalLayer(opportunityId, fd);
                      });
                    }}
                  >
                    <input type="hidden" name="layer_key" value={layer.value} />
                    <Label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="enabled"
                        value="1"
                        defaultChecked={row?.enabled ?? false}
                      />
                      Enable {layer.label}
                    </Label>
                    <select
                      name="status"
                      defaultValue={row?.status ?? "requested"}
                      className="mt-1 w-full rounded border bg-background px-1 py-0.5"
                    >
                      <option value="requested">Requested</option>
                      <option value="approved">Approved</option>
                      <option value="changes_requested">Changes requested</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <input
                      name="notes"
                      placeholder="Notes"
                      defaultValue={row?.notes ?? ""}
                      className="mt-1 w-full rounded border bg-background px-1 py-0.5"
                    />
                    <Button type="submit" size="sm" variant="outline" className="mt-1" disabled={pending}>
                      Save layer
                    </Button>
                  </form>
                );
              })}
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      <ResponseSourceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        requirementStatement={selected?.statement ?? null}
        retrieved={evidence}
        sourcesUsed={sourcesUsed}
        selectedSourceIds={selectedSourceIds}
        onToggleSource={toggleSource}
      />
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label} </span>
      <span className={tone ? "font-semibold text-amber-600 dark:text-amber-400" : "font-semibold"}>
        {value}
      </span>
    </span>
  );
}
