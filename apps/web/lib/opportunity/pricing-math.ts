export type CostModelInputs = {
  baseWage: number;
  fringe: number;
  healthWelfare: number;
  burdenPct: number;
  workersComp: number;
  insurance: number;
  supervision: number;
  equipment: number;
  vehicles: number;
  travel: number;
  overheadPct: number;
  targetMarginPct: number;
};

export type CostModelResult = {
  directCost: number;
  loadedCost: number;
  plannedRate: number;
  marginDollars: number;
  marginPct: number;
  costFloor: number;
};

export function parseNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/** Planning math only — not canonical pricing truth. */
export function computePlannedRate(inputs: CostModelInputs): CostModelResult {
  const directCost =
    inputs.baseWage +
    inputs.fringe +
    inputs.healthWelfare +
    inputs.workersComp +
    inputs.insurance +
    inputs.supervision +
    inputs.equipment +
    inputs.vehicles +
    inputs.travel;
  const afterBurden = directCost * (1 + inputs.burdenPct / 100);
  const loadedCost = afterBurden * (1 + inputs.overheadPct / 100);
  const marginDivisor = 1 - inputs.targetMarginPct / 100;
  const plannedRate = marginDivisor > 0 ? loadedCost / marginDivisor : loadedCost;
  const marginDollars = plannedRate - loadedCost;
  const marginPct = plannedRate > 0 ? (marginDollars / plannedRate) * 100 : 0;
  return {
    directCost,
    loadedCost,
    plannedRate,
    marginDollars,
    marginPct,
    costFloor: loadedCost,
  };
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

import type { PricingComparableRow } from "./types";

export type RateSummary = {
  count: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  label: string;
};

function medianOf(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function summarizeComparableRates(
  rows: PricingComparableRow[],
  field: keyof Pick<PricingComparableRow, "proposed_rate" | "awarded_rate" | "current_rate">,
  onlyIncluded = true,
): RateSummary | null {
  const scoped = onlyIncluded ? rows.filter((r) => r.included) : rows;
  const values = scoped
    .map((r) => r[field])
    .filter((v): v is number => v != null && Number.isFinite(Number(v)));
  if (values.length === 0) return null;
  const nums = values.map(Number);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const median = medianOf(nums);
  return {
    count: nums.length,
    min,
    max,
    avg,
    median,
    label: `${formatMoney(min)} – ${formatMoney(max)} (med ${formatMoney(median)}, avg ${formatMoney(avg)}, n=${nums.length})`,
  };
}

export type PricingDecisionSupport = {
  observed: RateSummary | null;
  costFloor: number | null;
  targetMarginPct: number | null;
  targetThreshold: number | null;
  confidence: "high" | "medium" | "low" | "insufficient";
  dataSufficiency: string;
  includedCount: number;
  excludedCount: number;
};

export function buildDecisionSupport(opts: {
  included: PricingComparableRow[];
  excluded: PricingComparableRow[];
  costFloor: number | null;
  targetMarginPct: number | null;
}): PricingDecisionSupport {
  const observed = summarizeComparableRates(opts.included, "awarded_rate")
    ?? summarizeComparableRates(opts.included, "proposed_rate")
    ?? summarizeComparableRates(opts.included, "current_rate");
  const includedCount = opts.included.length;
  const excludedCount = opts.excluded.length;
  let confidence: PricingDecisionSupport["confidence"] = "insufficient";
  if (includedCount >= 5 && observed && observed.count >= 3) confidence = "high";
  else if (includedCount >= 2 && observed) confidence = "medium";
  else if (includedCount >= 1 && observed) confidence = "low";

  const targetThreshold =
    opts.costFloor != null && opts.targetMarginPct != null
      ? opts.costFloor / (1 - opts.targetMarginPct / 100)
      : null;

  return {
    observed,
    costFloor: opts.costFloor,
    targetMarginPct: opts.targetMarginPct,
    targetThreshold,
    confidence,
    dataSufficiency:
      confidence === "insufficient"
        ? "Insufficient verified comparable rates for a confident range."
        : `${includedCount} included / ${excludedCount} excluded verified comparable line(s).`,
    includedCount,
    excludedCount,
  };
}
