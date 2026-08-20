"use client";

import dynamic from "next/dynamic";
import { useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  PricingCostModelRow,
  PricingLineRow,
  PricingComparableRow,
  PricingDecisionRow,
} from "@/lib/opportunity/types";
import { computePlannedRate, formatMoney, parseNum, buildDecisionSupport } from "@/lib/opportunity/pricing-math";
import { saveCostModel } from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";
import { PricingComparablesPanel } from "./pricing-comparables";
import { FinalBidPanel } from "./final-bid-panel";
import { FulfillmentEconomicsPanel } from "./fulfillment-economics";
import type { FulfillmentEconomics } from "@/lib/opportunity/proposal-packet";

const PricingGlideGrid = dynamic(
  () => import("./pricing-glide-grid").then((m) => m.PricingGlideGrid),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">Loading pricing matrix…</p>,
  },
);

type Props = {
  opportunityId: string;
  pricingLines: PricingLineRow[];
  costModels: PricingCostModelRow[];
  comparables: PricingComparableRow[];
  decisions: PricingDecisionRow[];
  factDocumentMap: Map<string, string>;
  economics: FulfillmentEconomics;
  structureHints: readonly string[];
};

const DEFAULT_INPUTS = {
  base_wage: "",
  fringe: "",
  health_welfare: "",
  burden_pct: "",
  workers_comp: "",
  insurance: "",
  supervision: "",
  equipment: "",
  vehicles: "",
  travel: "",
  overhead_pct: "",
  target_margin_pct: "",
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
      healthWelfare: parseNum(defaults.health_welfare),
      burdenPct: parseNum(defaults.burden_pct),
      workersComp: parseNum(defaults.workers_comp),
      insurance: parseNum(defaults.insurance),
      supervision: parseNum(defaults.supervision),
      equipment: parseNum(defaults.equipment),
      vehicles: parseNum(defaults.vehicles),
      travel: parseNum(defaults.travel),
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
              ["health_welfare", "H&W / fringe"],
              ["burden_pct", "Payroll burden %"],
              ["workers_comp", "Workers comp"],
              ["insurance", "Insurance"],
              ["supervision", "Supervision"],
              ["equipment", "Equipment"],
              ["vehicles", "Vehicles"],
              ["travel", "Travel"],
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
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${laborCategory}-wd`} className="text-xs">
              Wage determination ref
            </Label>
            <Input
              id={`${laborCategory}-wd`}
              name="wage_determination_ref"
              defaultValue={defaults?.wage_determination_ref ?? ""}
              className="h-8 text-sm"
              placeholder="e.g. WD 2024-XXXX"
            />
          </div>
        </div>
        {preview ? (
          <p className="text-sm text-muted-foreground">
            Cost floor {formatMoney(preview.costFloor)} → target-margin threshold{" "}
            <span className="font-medium text-foreground">{formatMoney(preview.plannedRate)}</span> (
            {formatMoney(preview.marginDollars)} margin). Syncs L&P internal cost on matching lines — does not
            write submitted proposed_rate.
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save cost model (planning only)"}
        </Button>
      </form>
    </details>
  );
}

export function PricingWorkbench({
  opportunityId,
  pricingLines,
  costModels,
  comparables,
  decisions,
  factDocumentMap,
  economics,
  structureHints,
}: Props) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const line of pricingLines) set.add(line.labor_category);
    for (const model of costModels) set.add(model.labor_category);
    return [...set].sort();
  }, [pricingLines, costModels]);

  const modelByCategory = new Map(costModels.map((m) => [m.labor_category, m]));
  const primaryModel = costModels[0] ?? null;
  const support = buildDecisionSupport({
    included: comparables.filter((c) => c.included),
    excluded: comparables.filter((c) => !c.included),
    costFloor: primaryModel?.cost_floor ?? null,
    targetMarginPct: primaryModel?.target_margin_pct ?? null,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-md border p-3 text-sm">
        <p className="font-medium">Pursuit pricing workbench</p>
        <p className="text-muted-foreground">
          Five truths stay separate: Buyer requested · L&P internal cost · L&P submitted · Buyer awarded ·
          Current/amended. Final bid is a human decision. Stay on this Pursuit — do not leave to price it.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Structures supported: {structureHints.join(" · ")}
        </p>
      </div>

      <FulfillmentEconomicsPanel economics={economics} />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Pricing matrix (Glide)</h2>
        <p className="text-xs text-muted-foreground">
          Spreadsheet workbench over verified lines. Canonical rates come from HUMAN_VERIFIED promotion; internal
          cost from the planning cost model.
        </p>
        <PricingGlideGrid lines={pricingLines} factDocumentMap={factDocumentMap} />
      </div>

      <PricingComparablesPanel
        opportunityId={opportunityId}
        comparables={comparables}
        factDocumentMap={factDocumentMap}
      />

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Internal cost model & margin (planning)</h2>
        <p className="text-xs text-muted-foreground">
          Wage, H&W, burden, workers comp, insurance, supervision, equipment, vehicles, travel, overhead, wage
          determination, target margin. Blank fields stay blank — never filled with invented market averages.
        </p>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No labor categories yet. Add one below or promote verified pricing lines from a workbook.
          </p>
        ) : (
          categories.map((category) => (
            <CostModelEditor
              key={category}
              opportunityId={opportunityId}
              laborCategory={category}
              existing={modelByCategory.get(category)}
            />
          ))
        )}
        <AddLaborCategoryForm opportunityId={opportunityId} />
      </div>

      <FinalBidPanel opportunityId={opportunityId} support={support} decisions={decisions} />
    </div>
  );
}

function AddLaborCategoryForm({ opportunityId }: { opportunityId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex max-w-xl flex-wrap items-end gap-2 rounded-md border p-3"
      action={(formData) => {
        startTransition(async () => {
          await saveCostModel(opportunityId, formData);
        });
      }}
    >
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor="new_labor_category" className="text-xs">
          Add labor category
        </Label>
        <Input id="new_labor_category" name="labor_category" required placeholder="e.g. Armed Security Officer" />
      </div>
      <input type="hidden" name="base_wage" value="" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Add category"}
      </Button>
    </form>
  );
}
