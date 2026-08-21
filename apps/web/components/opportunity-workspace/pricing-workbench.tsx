"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type {
  PricingCostModelRow,
  PricingLineRow,
  PricingComparableRow,
  PricingDecisionRow,
} from "@/lib/opportunity/types";
import { computePlannedRate, formatMoney, parseNum, buildDecisionSupport } from "@/lib/opportunity/pricing-math";
import {
  PRICING_TRUTH_COLUMNS,
  PRICING_TRUTH_LEGEND_CLASS,
  formatCurrency,
  observeLineGrains,
  parseRateInput,
  truthCoverage,
} from "@/lib/opportunity/pricing-grid-model";
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
  canPricingEdit?: boolean;
  canPricingApprove?: boolean;
};

const COST_FIELDS = [
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
] as const;

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; at: string }
  | { status: "error"; message: string };

function SaveStatus({ state }: { state: SaveState }) {
  const text =
    state.status === "saving"
      ? "Saving…"
      : state.status === "saved"
        ? `Saved ${state.at}`
        : state.status === "error"
          ? state.message
          : "No unsaved changes";
  return (
    <span
      data-testid="cost-model-save-status"
      className={`text-xs ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
    >
      {text}
    </span>
  );
}

function CostModelEditor({
  opportunityId,
  laborCategory,
  existing,
  open,
}: {
  opportunityId: string;
  laborCategory: string;
  existing?: PricingCostModelRow;
  open: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [save, setSave] = useState<SaveState>({ status: "idle" });
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

  const validate = useCallback((name: string, raw: string) => {
    const result = parseRateInput(raw);
    setErrors((prev) => {
      const next = { ...prev };
      if (result.ok) delete next[name];
      else next[name] = result.error;
      return next;
    });
  }, []);

  const invalid = Object.keys(errors).length > 0;

  return (
    <details
      className="rounded-md border p-3"
      open={open || !existing}
      id={`cost-model-${encodeURIComponent(laborCategory)}`}
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        {laborCategory}
        <span className="text-xs font-normal text-muted-foreground">
          {existing?.cost_floor != null ? `cost floor ${formatCurrency(existing.cost_floor)}` : "no cost model yet"}
        </span>
      </summary>
      <form
        className="mt-3 space-y-3"
        action={(formData) => {
          if (invalid) return;
          setSave({ status: "saving" });
          startTransition(async () => {
            try {
              await saveCostModel(opportunityId, formData);
              setSave({ status: "saved", at: new Date().toLocaleTimeString() });
            } catch (err) {
              setSave({
                status: "error",
                message: err instanceof Error ? err.message : "Save failed",
              });
            }
          });
        }}
      >
        <input type="hidden" name="labor_category" value={laborCategory} />
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {COST_FIELDS.map(([name, label]) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={`${laborCategory}-${name}`} className="text-xs">
                {label}
              </Label>
              <Input
                id={`${laborCategory}-${name}`}
                name={name}
                inputMode="decimal"
                aria-invalid={errors[name] ? true : undefined}
                defaultValue={defaults?.[name]?.toString() ?? ""}
                onChange={(event) => validate(name, event.target.value)}
                className="h-8 text-sm"
              />
              {errors[name] ? (
                <p className="text-xs text-destructive">{errors[name]}</p>
              ) : null}
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
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending || invalid}>
            {pending ? "Saving…" : "Save cost model (planning only)"}
          </Button>
          <SaveStatus state={save} />
          {invalid ? (
            <span className="text-xs text-destructive">Fix the highlighted fields to save.</span>
          ) : null}
        </div>
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
  canPricingEdit = true,
  canPricingApprove = true,
}: Props) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const costModelsRef = useRef<HTMLDivElement | null>(null);

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

  const grains = useMemo(() => observeLineGrains(pricingLines), [pricingLines]);
  const coverage = useMemo(() => truthCoverage(pricingLines), [pricingLines]);

  const jumpToCostModel = useCallback((laborCategory: string) => {
    setOpenCategory(laborCategory);
    costModelsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-3 space-y-1.5 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-sm font-medium">Pursuit pricing workbench</p>
          <span className="text-xs text-muted-foreground">
            {pricingLines.length} verified line{pricingLines.length === 1 ? "" : "s"} ·{" "}
            {categories.length} labor categor{categories.length === 1 ? "y" : "ies"} ·{" "}
            {comparables.filter((c) => c.included).length} included comparable(s)
          </span>
          <Badge variant="outline" className="ml-auto font-normal">
            Final bid = human decision
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {PRICING_TRUTH_COLUMNS.map((truth) => (
            <span key={truth.id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block size-2 rounded-sm ${PRICING_TRUTH_LEGEND_CLASS[truth.id]}`}
              />
              <span className="font-medium">{truth.label}</span>
              <span className="text-muted-foreground">{coverage[truth.id]} line(s)</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          The five truths stay separate columns even when empty. Final bid is a human decision. Stay on
          this Pursuit — do not leave to price it.
        </p>
      </div>

      <FulfillmentEconomicsPanel economics={economics} />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Pricing matrix (Glide)</h2>
        <p className="text-xs text-muted-foreground">
          Spreadsheet workbench over verified lines. Canonical rates come from HUMAN_VERIFIED promotion;
          internal cost from the planning cost model.
        </p>
        <PricingGlideGrid
          lines={pricingLines}
          factDocumentMap={factDocumentMap}
          onJumpToCostModel={jumpToCostModel}
        />
      </div>

      <BuyerFormatSection grains={grains} supportedHints={structureHints} lineCount={pricingLines.length} />

      <PricingComparablesPanel
        opportunityId={opportunityId}
        comparables={comparables}
        factDocumentMap={factDocumentMap}
      />

      <div className="space-y-3" ref={costModelsRef}>
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
              open={openCategory === category}
            />
          ))
        )}
        <AddLaborCategoryForm opportunityId={opportunityId} />
      </div>

      <FinalBidPanel
        opportunityId={opportunityId}
        support={support}
        decisions={decisions}
        canPricingEdit={canPricingEdit}
        canPricingApprove={canPricingApprove}
      />
    </div>
  );
}

/**
 * Buyer pricing format, read off the promoted lines. Structures we can support but have no line
 * for are listed as unobserved — never presented as something the buyer asked for.
 */
function BuyerFormatSection({
  grains,
  supportedHints,
  lineCount,
}: {
  grains: ReturnType<typeof observeLineGrains>;
  supportedHints: readonly string[];
  lineCount: number;
}) {
  return (
    <div className="space-y-2 rounded-md border p-4">
      <div>
        <h2 className="text-sm font-medium">Buyer pricing format (observed)</h2>
        <p className="text-xs text-muted-foreground">
          Read from the {lineCount} promoted line grain{lineCount === 1 ? "" : "s"} on this pursuit. No
          requested cell is invented for a structure with no verified line.
        </p>
      </div>
      {lineCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          No promoted lines yet, so the buyer&apos;s pricing format is unknown. Supported structures:{" "}
          {supportedHints.join(" · ")}.
        </p>
      ) : (
        <>
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Labor categories</dt>
              <dd>{grains.laborCategories.join(" · ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Units</dt>
              <dd>{grains.units.join(" · ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rate types</dt>
              <dd>{grains.rateTypes.join(" · ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sites / posts</dt>
              <dd>{grains.sites.join(" · ") || "—"}</dd>
            </div>
          </dl>
          <p className="text-xs">
            <span className="font-medium">Observed structures:</span>{" "}
            {grains.observedHints.join(" · ") || "none matched a canonical structure"}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Supported but not observed here:</span>{" "}
            {grains.unobservedHints.join(" · ") || "none"}
          </p>
          <p className="text-xs text-muted-foreground">
            Quantity on {grains.linesWithQuantity}/{lineCount} lines · extended amount on{" "}
            {grains.linesWithExtended}/{lineCount}.
          </p>
        </>
      )}
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
