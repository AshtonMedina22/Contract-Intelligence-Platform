"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FactRef } from "./shared";
import { ResponseTiptapEditor } from "./response-tiptap-editor";
import {
  computeResponseProgress,
  NEVER_INVENT_LP_FACTS,
  type RequirementMatrixRow,
  type RequirementResponseRow,
} from "@/lib/opportunity/response";
import {
  generateRequirementDraft,
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
}: {
  opportunityId: string;
  requirements: RequirementMatrixRow[];
  responses: RequirementResponseRow[];
  approvals: ApprovalRow[];
  context: Context;
  factDocumentMap: Map<string, string>;
  knowledgeHits: {
    chunk_id: string;
    reuse_status: string;
    content: string;
    document_id: string;
    source_page: number | null;
  }[];
}) {
  const [selectedId, setSelectedId] = useState(requirements[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const responseByReq = useMemo(
    () => new Map(responses.map((r) => [r.requirement_id, r])),
    [responses],
  );
  const selected = requirements.find((r) => r.id === selectedId) ?? null;
  const selectedResp = selected ? responseByReq.get(selected.id) : undefined;
  const [draftHtml, setDraftHtml] = useState(selectedResp?.draft_html ?? "");
  const progress = computeResponseProgress(requirements, responses);

  const selectReq = (id: string) => {
    setSelectedId(id);
    setDraftHtml(responseByReq.get(id)?.draft_html ?? "");
  };

  return (
    <div className="space-y-4">
      <dl className="grid gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Total" value={progress.totalRequirements} />
        <Stat label="Verified" value={progress.verified} />
        <Stat label="Drafted" value={progress.drafted} />
        <Stat label="Approved" value={progress.approved} />
        <Stat label="L&P input req" value={progress.lpInputRequired} />
        <Stat label="Mandatory out" value={progress.mandatoryOutstanding} />
        <Stat label="Attach missing" value={progress.requiredAttachmentsMissing} />
      </dl>

      <p className="text-xs text-muted-foreground">
        GPT may only use allowed evidence (DO_NOT_USE never enters drafting). Never invent:{" "}
        {NEVER_INVENT_LP_FACTS.join(", ")}. Unsupported facts → L&P INPUT REQUIRED.
      </p>

      {requirements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No verified requirements yet. Promote solicitation requirements first.
        </p>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="min-h-[520px] rounded-md border">
          <ResizablePanel defaultSize={22} minSize={16} className="overflow-auto p-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Requirements</p>
            <ul className="space-y-1">
              {requirements.map((req) => {
                const resp = responseByReq.get(req.id);
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
                        {req.matrix_status}
                        {resp ? ` · ${resp.evidence_state}` : ""}
                        {req.mandatory ? " · mandatory" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={48} minSize={30} className="overflow-auto p-3">
            {selected ? (
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-medium">Response editor</h2>
                  <p className="text-xs text-muted-foreground">{selected.statement}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Evidence: {selectedResp?.evidence_state ?? "—"} · Draft:{" "}
                    {selectedResp?.draft_status ?? "EMPTY"} ·{" "}
                    <FactRef
                      factId={selected.source_fact_id}
                      documentId={factDocumentMap.get(selected.source_fact_id ?? "")}
                    />
                  </p>
                </div>
                <ResponseTiptapEditor html={draftHtml} onChange={setDraftHtml} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const fd = new FormData();
                        fd.set("requirement_id", selected.id);
                        fd.set("draft_html", draftHtml);
                        fd.set(
                          "evidence_state",
                          selectedResp?.evidence_state ?? "L_AND_P_INPUT_REQUIRED",
                        );
                        fd.set("assumptions", selectedResp?.assumptions ?? "");
                        fd.set("missing_information", selectedResp?.missing_information ?? "");
                        fd.set("confidence", selectedResp?.confidence ?? "");
                        await saveRequirementResponse(opportunityId, fd);
                      })
                    }
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await generateRequirementDraft(opportunityId, selected.id);
                        setDraftHtml(result.draft_response);
                      })
                    }
                  >
                    GPT draft (grounded)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const fd = new FormData();
                        fd.set("requirement_id", selected.id);
                        fd.set("draft_html", draftHtml);
                        fd.set(
                          "evidence_state",
                          selectedResp?.evidence_state ?? "REVIEW_REQUIRED",
                        );
                        fd.set("approve", "1");
                        await saveRequirementResponse(opportunityId, fd);
                      })
                    }
                  >
                    Human approve response
                  </Button>
                </div>
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
              </p>
            </section>
            <section className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Approved historical content</p>
              {(context.proposalSections.length === 0
                ? knowledgeHits.filter((h) => h.reuse_status === "APPROVED").slice(0, 4)
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
              knowledgeHits.filter((h) => h.reuse_status === "APPROVED").length === 0 ? (
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
              <p className="text-xs font-medium text-muted-foreground">Sources / evidence (retrieval)</p>
              {knowledgeHits.slice(0, 5).map((h) => (
                <p key={h.chunk_id} className="text-[11px] text-muted-foreground">
                  {h.reuse_status} p.{h.source_page ?? "?"} — {h.content.slice(0, 100)}…
                </p>
              ))}
              {knowledgeHits.length === 0 ? (
                <p className="text-xs text-muted-foreground">Run GPT draft to retrieve evidence.</p>
              ) : null}
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
                      disabled={!row?.enabled && !true}
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-medium">{value}</dd>
    </div>
  );
}
