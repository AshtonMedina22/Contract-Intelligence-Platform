"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createContractFromWin,
  savePursuitResult,
} from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";
import { RESULT_OUTCOME_OPTIONS, type OpportunityResultOutcome } from "@/lib/opportunity/response";

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

export function ResultCapturePanel({
  opportunityId,
  winLoss,
  contractId,
  contractTitle,
  opportunityTitle,
}: {
  opportunityId: string;
  winLoss: WinLoss;
  contractId: string | null;
  contractTitle: string | null;
  opportunityTitle: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-medium">Result capture</h2>
        <p className="text-xs text-muted-foreground">
          Record Pending / Won / Lost / No Bid / Cancelled / No Award. Feeds buyer, competitor, win/loss, pricing
          history, and future retrieval — never invent scores or prices.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) => {
            startTransition(async () => {
              await savePursuitResult(opportunityId, fd);
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="outcome">Outcome</Label>
            <select
              id="outcome"
              name="outcome"
              defaultValue={winLoss?.outcome ?? "PENDING"}
              className="flex h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {RESULT_OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="winner_name">Winner</Label>
            <Input id="winner_name" name="winner_name" defaultValue={winLoss?.winner_name ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lp_price">L&P submitted pricing</Label>
            <Input
              id="lp_price"
              name="lp_price"
              type="number"
              step="0.01"
              defaultValue={winLoss?.lp_price ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="winning_price">Winning / awarded pricing</Label>
            <Input
              id="winning_price"
              name="winning_price"
              type="number"
              step="0.01"
              defaultValue={winLoss?.winning_price ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lp_score">L&P score</Label>
            <Input id="lp_score" name="lp_score" type="number" step="0.01" defaultValue={winLoss?.lp_score ?? ""} />
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
            <Label htmlFor="rank">Rank</Label>
            <Input id="rank" name="rank" type="number" defaultValue={winLoss?.rank ?? ""} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="evaluator_comments">Evaluator comments</Label>
            <Input
              id="evaluator_comments"
              name="evaluator_comments"
              defaultValue={winLoss?.evaluator_comments ?? ""}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="documented_reason">Documented reason</Label>
            <Input
              id="documented_reason"
              name="documented_reason"
              defaultValue={winLoss?.documented_reason ?? ""}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="internal_analysis">Internal analysis</Label>
            <Input
              id="internal_analysis"
              name="internal_analysis"
              defaultValue={winLoss?.internal_analysis ?? ""}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="lessons_learned">Internal lessons</Label>
            <Input
              id="lessons_learned"
              name="lessons_learned"
              defaultValue={winLoss?.lessons_learned ?? ""}
            />
          </div>
          <Button type="submit" disabled={pending}>
            Save result
          </Button>
        </form>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-medium">Contract on win</h2>
        {contractId ? (
          <p className="text-sm">
            Linked:{" "}
            <Link className="underline" href={`/contracts/${contractId}`}>
              {contractTitle ?? contractId}
            </Link>
          </p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            action={(fd) => {
              startTransition(async () => {
                await createContractFromWin(opportunityId, fd);
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
            <Button type="submit" disabled={pending}>
              Create / link contract
            </Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">
          After save, outcome feeds Intelligence → Buyers / Competitors / Win-Loss / Pricing and future retrieval.
        </p>
      </section>
    </div>
  );
}
