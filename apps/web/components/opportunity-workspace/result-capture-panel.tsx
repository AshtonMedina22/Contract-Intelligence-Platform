"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createContractFromWin,
  savePursuitResult,
} from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";
import { RESULT_OUTCOME_OPTIONS, type OpportunityResultOutcome } from "@/lib/opportunity/response";
import {
  evaluateContractHandoffGate,
  RESULT_FIELD_SCOPE,
} from "@/lib/opportunity/submission-readiness";

type WinLoss = {
  outcome: OpportunityResultOutcome | string;
  winner_name: string | null;
  lp_price: number | null;
  winning_price: number | null;
  lp_score: number | null;
  winning_score: number | null;
  rank: number | null;
  documented_reason: string | null;
  internal_analysis: string | null;
  lessons_learned: string | null;
  evaluator_comments: string | null;
} | null;

export type AwardEvidenceRow = {
  factId: string;
  documentId: string | null;
  documentName: string | null;
  field: string | null;
  entity: string | null;
  value: string | null;
  sourcePage: number | null;
  awardish: boolean;
};

const OUTCOME_MEANING: Record<OpportunityResultOutcome, string> = {
  PENDING: "Submitted and no result published yet. This is not a loss.",
  WON: "L&P was selected. A contract still needs a HUMAN_VERIFIED award fact before it enters the portfolio.",
  LOST: "Another respondent was selected. Record what the buyer documented, separately from internal analysis.",
  NO_BID: "L&P chose not to respond. There is no evaluation outcome to record.",
  CANCELLED: "The buyer cancelled the solicitation before award.",
  NO_AWARD: "The buyer rejected all bids / made no award. Not the same as L&P losing.",
};

export function ResultCapturePanel({
  opportunityId,
  winLoss,
  contractId,
  contractTitle,
  opportunityTitle,
  awardEvidence,
  pursuitDocumentCount,
  canResultWrite = true,
  canContractCreate = true,
}: {
  opportunityId: string;
  winLoss: WinLoss;
  contractId: string | null;
  contractTitle: string | null;
  opportunityTitle: string;
  awardEvidence: AwardEvidenceRow[];
  pursuitDocumentCount: number;
  canResultWrite?: boolean;
  canContractCreate?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<OpportunityResultOutcome>(
    (winLoss?.outcome as OpportunityResultOutcome) ?? "PENDING",
  );
  const [contractError, setContractError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const awardishEvidence = awardEvidence.filter((e) => e.awardish);
  const gate = evaluateContractHandoffGate({
    existingContractId: contractId,
    outcome: winLoss?.outcome ?? null,
    pursuitDocumentCount,
    verifiedAwardishFactCount: awardishEvidence.length,
  });

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ outcome state */}
      <section className="space-y-3 rounded-md border p-4" data-testid="result-capture">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Result capture</h2>
          <Badge variant="outline" className="text-[10px]" data-testid="current-outcome">
            Recorded: {winLoss?.outcome ?? "not recorded"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Six outcome states. Feeds Buyers, Competitors, Win/Loss, pricing history and future
          retrieval — so never invent a score, price, rank, or loss reason the buyer did not publish.
        </p>

        <form
          className="space-y-4"
          action={(fd) => {
            setNote(null);
            startTransition(async () => {
              await savePursuitResult(opportunityId, fd);
              setNote("Result saved.");
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="outcome">Outcome</Label>
              <select
                id="outcome"
                name="outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as OpportunityResultOutcome)}
                className="flex h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {RESULT_OUTCOME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground" data-testid="outcome-meaning">
                {OUTCOME_MEANING[outcome]}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rank">Published rank</Label>
              <Input id="rank" name="rank" type="number" defaultValue={winLoss?.rank ?? ""} />
            </div>
          </div>

          {/* buyer-documented */}
          <fieldset className="space-y-3 rounded-md border p-3" data-testid="documented-fields">
            <legend className="px-1 text-xs font-medium">Buyer-documented</legend>
            <p className="text-[11px] text-muted-foreground">{RESULT_FIELD_SCOPE.DOCUMENTED}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="winner_name">Winner as published</Label>
                <Input
                  id="winner_name"
                  name="winner_name"
                  defaultValue={winLoss?.winner_name ?? ""}
                  placeholder="Leave blank when the buyer did not name a winner"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="winning_price">Winning / awarded price</Label>
                <Input
                  id="winning_price"
                  name="winning_price"
                  type="number"
                  step="0.01"
                  defaultValue={winLoss?.winning_price ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="winning_score">Winning score</Label>
                <Input
                  id="winning_score"
                  name="winning_score"
                  type="number"
                  step="0.01"
                  defaultValue={winLoss?.winning_score ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="evaluator_comments">Evaluator comments (quoted)</Label>
                <Input
                  id="evaluator_comments"
                  name="evaluator_comments"
                  defaultValue={winLoss?.evaluator_comments ?? ""}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="documented_reason">Reason the buyer documented</Label>
              <Textarea
                id="documented_reason"
                name="documented_reason"
                rows={3}
                defaultValue={winLoss?.documented_reason ?? ""}
                placeholder="Quote or summarize the buyer's stated basis (staff report, tabulation, debrief). Blank is honest when the buyer gave none."
              />
            </div>
          </fieldset>

          {/* internal only */}
          <fieldset className="space-y-3 rounded-md border p-3" data-testid="internal-fields">
            <legend className="px-1 text-xs font-medium">Internal only — never sent to a buyer</legend>
            <p className="text-[11px] text-muted-foreground">{RESULT_FIELD_SCOPE.INTERNAL}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="lp_price">L&amp;P submitted price</Label>
                <Input
                  id="lp_price"
                  name="lp_price"
                  type="number"
                  step="0.01"
                  defaultValue={winLoss?.lp_price ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lp_score">L&amp;P score</Label>
                <Input
                  id="lp_score"
                  name="lp_score"
                  type="number"
                  step="0.01"
                  defaultValue={winLoss?.lp_score ?? ""}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="internal_analysis">Internal analysis</Label>
              <Textarea
                id="internal_analysis"
                name="internal_analysis"
                rows={3}
                defaultValue={winLoss?.internal_analysis ?? ""}
                placeholder="L&P's own read of why this landed the way it did. Not a buyer statement."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lessons_learned">Lessons learned</Label>
              <Textarea
                id="lessons_learned"
                name="lessons_learned"
                rows={2}
                defaultValue={winLoss?.lessons_learned ?? ""}
                placeholder="What to do differently next pursuit."
              />
            </div>
          </fieldset>

          <Button type="submit" size="sm" disabled={pending || !canResultWrite}>
            Save result
          </Button>
          {!canResultWrite ? (
            <p className="text-xs text-muted-foreground">
              Result write requires admin, bidder, or executive.
            </p>
          ) : null}
          {note ? (
            <span className="ml-2 text-xs text-muted-foreground" data-testid="result-note">
              {note}
            </span>
          ) : null}
        </form>
      </section>

      {/* ------------------------------------------------------- award evidence */}
      <section className="space-y-2 rounded-md border p-4" data-testid="award-evidence">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            Award evidence for handoff ({awardishEvidence.length} award-shaped /{" "}
            {awardEvidence.length} verified)
          </h2>
          <Link className="text-xs underline" href={`/ingestion/intake?opportunity=${opportunityId}`}>
            Ingest award document →
          </Link>
        </div>
        <p className="text-[11px] text-muted-foreground">
          HUMAN_VERIFIED facts on this pursuit&apos;s {pursuitDocumentCount} document(s). Only an
          award-shaped fact — award, contract, purchase order, NTE, agreement, ordering vehicle — can
          back a contract row.
        </p>
        {awardEvidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No HUMAN_VERIFIED fact on this pursuit yet. Verify one in Data Ops → Verification.
          </p>
        ) : (
          <ul className="divide-y rounded border text-sm">
            {awardEvidence.map((row) => (
              <li key={row.factId} className="flex flex-wrap items-start gap-2 p-2">
                <Badge
                  variant={row.awardish ? "secondary" : "outline"}
                  className="mt-0.5 shrink-0 text-[10px]"
                >
                  {row.awardish ? "Award-shaped" : "Other"}
                </Badge>
                <div className="min-w-[12rem] flex-1">
                  <p className="text-xs font-medium">
                    {row.entity ?? "—"} · {row.field ?? "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(row.value ?? "").slice(0, 160) || "no value recorded"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.documentId ? (
                      <Link className="underline" href={`/ingestion/verification/${row.documentId}`}>
                        {row.documentName ?? row.documentId}
                      </Link>
                    ) : (
                      "no source document"
                    )}
                    {row.sourcePage != null ? ` · p.${row.sourcePage}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ----------------------------------------------------- contract handoff */}
      <section className="space-y-3 rounded-md border p-4" data-testid="contract-handoff">
        <h2 className="text-sm font-medium">Contract handoff</h2>
        {contractId ? (
          <p className="text-sm" data-testid="linked-contract">
            Linked contract:{" "}
            <Link className="underline" href={`/contracts/${contractId}`}>
              {contractTitle ?? contractId}
            </Link>
            . Creating another would duplicate the portfolio row.
          </p>
        ) : (
          <>
            <div
              className={`rounded-md border p-2 text-xs ${
                gate.allowed
                  ? "text-muted-foreground"
                  : "border-amber-600/40 bg-amber-50/60 dark:bg-amber-950/20"
              }`}
              data-testid="contract-gate"
              data-gate-code={gate.code}
              data-gate-allowed={gate.allowed ? "true" : "false"}
            >
              {gate.message}
            </div>
            <form
              className="flex flex-wrap items-end gap-2"
              action={(fd) => {
                setContractError(null);
                startTransition(async () => {
                  try {
                    await createContractFromWin(opportunityId, fd);
                  } catch (err) {
                    setContractError(err instanceof Error ? err.message : String(err));
                  }
                });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="title">Contract title</Label>
                <Input id="title" name="title" defaultValue={opportunityTitle} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contract_number">Contract number</Label>
                <Input id="contract_number" name="contract_number" />
              </div>
              <Button
                type="submit"
                size="sm"
                data-testid="create-contract"
                disabled={pending || !gate.allowed || !canContractCreate}
                title={
                  !canContractCreate
                    ? "Requires admin, bidder, or executive (contract.create)."
                    : gate.allowed
                      ? undefined
                      : gate.message
                }
              >
                Create contract from win
              </Button>
            </form>
            {contractError ? (
              <p
                className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs"
                data-testid="contract-error"
              >
                {contractError}
              </p>
            ) : null}
          </>
        )}
        <p className="text-[11px] text-muted-foreground">
          The contract cites the verified award fact and its document. `contracts_require_verified_fact`
          rejects any contract row that does not.
        </p>
      </section>
    </div>
  );
}
