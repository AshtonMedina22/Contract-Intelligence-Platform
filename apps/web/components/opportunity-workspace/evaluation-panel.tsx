"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveEvaluationCriterion,
  deleteEvaluationCriterion,
} from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";

export type EvaluationCriterionRow = {
  id: string;
  criterion: string;
  weight_pct: number | null;
  notes: string | null;
};

export function EvaluationCriteriaPanel({
  opportunityId,
  rows,
}: {
  opportunityId: string;
  rows: EvaluationCriterionRow[];
}) {
  const [pending, startTransition] = useTransition();
  const totalWeight = rows.reduce((sum, r) => sum + (r.weight_pct ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Evaluation criteria</h2>
        <p className="text-xs text-muted-foreground">
          From verified solicitation facts or ops entry. Weights are informational until sourced from the RFP.
        </p>
        {rows.length > 0 && totalWeight > 0 ? (
          <p className="text-xs text-muted-foreground">Listed weights sum to {totalWeight}%</p>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-2">
              <div>
                <span className="font-medium">{row.criterion}</span>
                {row.weight_pct != null ? (
                  <span className="text-muted-foreground"> — {row.weight_pct}%</span>
                ) : null}
                {row.notes ? <p className="text-xs text-muted-foreground">{row.notes}</p> : null}
              </div>
              <form
                action={() => {
                  startTransition(async () => {
                    await deleteEvaluationCriterion(opportunityId, row.id);
                  });
                }}
              >
                <Button type="submit" size="sm" variant="ghost" disabled={pending}>
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No criteria recorded. Extract from RFP Section M or equivalent.</p>
      )}

      <form
        className="max-w-xl space-y-3 rounded-md border p-4"
        action={(formData) => {
          startTransition(async () => {
            await saveEvaluationCriterion(opportunityId, formData);
          });
        }}
      >
        <h3 className="text-sm font-medium">Add criterion</h3>
        <div className="space-y-1">
          <Label htmlFor="criterion">Criterion</Label>
          <Input id="criterion" name="criterion" required placeholder="Price — lowest responsive bid" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="weight_pct">Weight % (optional)</Label>
          <Input id="weight_pct" name="weight_pct" type="number" min="0" max="100" step="0.1" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="criterion_notes">Notes</Label>
          <Input id="criterion_notes" name="notes" placeholder="Pass/fail minimum qualifications" />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add criterion"}
        </Button>
      </form>
    </div>
  );
}
