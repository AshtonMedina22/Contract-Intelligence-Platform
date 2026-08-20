export type CostModelInputs = {
  baseWage: number;
  fringe: number;
  burdenPct: number;
  workersComp: number;
  insurance: number;
  supervision: number;
  equipment: number;
  overheadPct: number;
  targetMarginPct: number;
};

export type CostModelResult = {
  directCost: number;
  loadedCost: number;
  plannedRate: number;
  marginDollars: number;
  marginPct: number;
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
    inputs.workersComp +
    inputs.insurance +
    inputs.supervision +
    inputs.equipment;
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
  };
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
