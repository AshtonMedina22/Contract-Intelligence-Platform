"use client";

import { useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PricingCostModelRow, PricingLineRow } from "@/lib/opportunity/types";
import { computePlannedRate, formatMoney, parseNum } from "@/lib/opportunity/pricing-math";
import { saveCostModel } from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";
import { FourTruthsTable } from "./four-truths-table";

type Props = {
  opportunityId: string;
  pricingLines: PricingLineRow[];
  costModels: PricingCostModelRow[];
  factDocumentMap: Map<string, string>;
};

const DEFAULT_INPUTS = {
  base_wage: "",
  fringe: "",
  burden_pct: "15",
  workers_comp: "",
  insurance: "",
  supervision: "",
  equipment: "",
  overhead_pct: "12",
  target_margin_pct: "18",
};

function CostModelEditor({
  opportunityId,
  laborCategory,
  existing,
}: {
  opportunityId: string;
  laborCategory: string;
  existing?: PricingCostModelRow;
}) {
  const [pending, startTransition] = useTransition();

  const defaults = existing ?? null;
  const preview = useMemo(() => {
    if (!defaults) return null;
    return computePlannedRate({
      baseWage: parseNum(defaults.base_wage),
      fringe: parseNum(defaults.fringe),
      burdenPct: parseNum(defaults.burden_pct),
      workersComp: parseNum(defaults.workers_comp),
      insurance: parseNum(defaults.insurance),
      supervision: parseNum(defaults.supervision),
      equipment: parseNum(defaults.equipment),
      overheadPct: parseNum(defaults.overhead_pct),
      targetMarginPct: parseNum(defaults.target_margin_pct),
    });
  }, [defaults]);

  return (
    <details className="rounded-md border p-3" open={!existing}>
      <summary className="cursor-pointer text-sm font-medium">{laborCategory}</summary>
      <form
        className="mt-3 space-y-3"
        action={(formData) => {
          startTransition(async () => {
            await saveCostModel(opportunityId, formData);
          });
        }}
      >
        <input type="hidden" name="labor_category" value={laborCategory} />
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["base_wage", "Base wage"],
              ["fringe", "Fringe"],
              ["burden_pct", "Burden %"],
              ["workers_comp", "Workers comp"],
              ["insurance", "Insurance"],
              ["supervision", "Supervision"],
              ["equipment", "Equipment"],
              ["overhead_pct", "Overhead %"],
              ["target_margin_pct", "Target margin %"],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={`${laborCategory}-${name}`} className="text-xs">
                {label}
              </Label>
              <Input
                id={`${laborCategory}-${name}`}
                name={name}
                type="number"
                step="0.01"
                defaultValue={
                  defaults?.[name]?.toString() ?? DEFAULT_INPUTS[name as keyof typeof DEFAULT_INPUTS] ?? ""
                }
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
        {preview ? (
          <p className="text-sm text-muted-foreground">
            Saved plan: loaded cost {formatMoney(preview.loadedCost)} → planned rate{" "}
            <span className="font-medium text-foreground">{formatMoney(preview.plannedRate)}</span> (
            {formatMoney(preview.marginDollars)} margin)
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save cost model (planning only)"}
        </Button>
      </form>
    </details>
  );
}

export function PricingWorkbench({ opportunityId, pricingLines, costModels, factDocumentMap }: Props) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const line of pricingLines) set.add(line.labor_category);
    for (const model of costModels) set.add(model.labor_category);
    if (set.size === 0) {
      set.add("Armed Security Officer");
      set.add("Unarmed Security Officer");
    }
    return [...set].sort();
  }, [pricingLines, costModels]);

  const modelByCategory = new Map(costModels.map((m) => [m.labor_category, m]));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Verified four-truth rates</h2>
        <p className="text-xs text-muted-foreground">
          Canonical truth from HUMAN_VERIFIED promotion only. Customer requested ≠ L&P proposed ≠ awarded ≠
          current.
        </p>
        <FourTruthsTable lines={pricingLines} factDocumentMap={factDocumentMap} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Internal cost model & margin (planning)</h2>
        <p className="text-xs text-muted-foreground">
          Planning workspace for ops — does not write to canonical <code className="text-xs">proposed_rate</code>.
          Final submitted price must still be verified and promoted from source documents.
        </p>
        {categories.map((category) => (
          <CostModelEditor
            key={category}
            opportunityId={opportunityId}
            laborCategory={category}
            existing={modelByCategory.get(category)}
          />
        ))}
      </div>
    </div>
  );
}
