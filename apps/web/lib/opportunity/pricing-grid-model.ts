import type { PricingLineRow } from "./types";
import { PRICING_STRUCTURE_HINTS } from "./types";
import type { RateSummary } from "./pricing-math";

/**
 * Presentation model for the pursuit pricing workbench.
 *
 * Pure: no React, no Supabase, no canvas. The Glide grid, the comparables panel and the
 * acceptance script all read the same definitions from here, so "the five truths never
 * collapse" is one assertion rather than three separate hopes.
 */

export type PricingTruthId = "requested" | "internal_cost" | "proposed" | "awarded" | "current";

export type PricingTruthProvenance = "PROMOTED_VERIFIED" | "PLANNING_COST_MODEL";

export type PricingTruthColumn = {
  /** Stable id — never reused between truths, never merged. */
  readonly id: PricingTruthId;
  /** Operator-facing label. Must stay distinct per truth. */
  readonly label: string;
  readonly rateKey: keyof Pick<
    PricingLineRow,
    "requested_rate" | "internal_cost_rate" | "proposed_rate" | "awarded_rate" | "current_rate"
  >;
  /** Source-fact column, or null for the planning truth which is not promoted evidence. */
  readonly factKey:
    | keyof Pick<
        PricingLineRow,
        | "requested_source_fact_id"
        | "proposed_source_fact_id"
        | "awarded_source_fact_id"
        | "current_source_fact_id"
      >
    | null;
  readonly provenance: PricingTruthProvenance;
  /** The grid never writes a truth. This names the only human path that can change it. */
  readonly editPath: string;
  /** Whether the Glide grid may write this truth. False everywhere — see `editPath`. */
  readonly gridEditable: boolean;
};

/** The five commercial truths, in operator reading order. Never collapsed, never derived. */
export const PRICING_TRUTH_COLUMNS: readonly PricingTruthColumn[] = [
  {
    id: "requested",
    label: "Buyer requested",
    rateKey: "requested_rate",
    factKey: "requested_source_fact_id",
    provenance: "PROMOTED_VERIFIED",
    editPath: "Verify the solicitation fact, then promote it. Never typed here.",
    gridEditable: false,
  },
  {
    id: "internal_cost",
    label: "L&P internal cost",
    rateKey: "internal_cost_rate",
    factKey: null,
    provenance: "PLANNING_COST_MODEL",
    editPath: "Internal cost model below — saveCostModel is the only writer.",
    gridEditable: false,
  },
  {
    id: "proposed",
    label: "L&P submitted",
    rateKey: "proposed_rate",
    factKey: "proposed_source_fact_id",
    provenance: "PROMOTED_VERIFIED",
    editPath: "Verify the submitted bid tab, then promote it. Never typed here.",
    gridEditable: false,
  },
  {
    id: "awarded",
    label: "Buyer awarded",
    rateKey: "awarded_rate",
    factKey: "awarded_source_fact_id",
    provenance: "PROMOTED_VERIFIED",
    editPath: "Verify the award document, then promote it. Never typed here.",
    gridEditable: false,
  },
  {
    id: "current",
    label: "Current/amended",
    rateKey: "current_rate",
    factKey: "current_source_fact_id",
    provenance: "PROMOTED_VERIFIED",
    editPath: "Verify the amendment, then promote it. Never typed here.",
    gridEditable: false,
  },
] as const;

/** Identifier columns pinned while the truth columns scroll. */
export const PRICING_IDENTIFIER_COLUMN_IDS = ["labor_category", "site_or_post", "unit"] as const;

/** Glide freezes the first N columns, so the identifiers must lead the column order. */
export const PRICING_FREEZE_COLUMNS = PRICING_IDENTIFIER_COLUMN_IDS.length;

/**
 * No truth is editable in the grid: each one has a provenance-bearing write path (`editPath`),
 * so the grid must route a human to that path instead of writing the cell.
 */
export function isGridEditableTruth(id: PricingTruthId): boolean {
  return truthColumn(id).gridEditable;
}

export function truthColumn(id: PricingTruthId): PricingTruthColumn {
  const found = PRICING_TRUTH_COLUMNS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown pricing truth: ${id}`);
  return found;
}

export function truthRate(line: PricingLineRow, id: PricingTruthId): number | null {
  const value = line[truthColumn(id).rateKey];
  return value == null ? null : Number(value);
}

export function truthFactId(line: PricingLineRow, id: PricingTruthId): string | null {
  const key = truthColumn(id).factKey;
  return key ? (line[key] ?? null) : null;
}

/** How many lines carry a value for each truth. A zero still renders its column. */
export function truthCoverage(lines: PricingLineRow[]): Record<PricingTruthId, number> {
  const counts = {} as Record<PricingTruthId, number>;
  for (const column of PRICING_TRUTH_COLUMNS) {
    counts[column.id] = lines.filter((line) => truthRate(line, column.id) != null).length;
  }
  return counts;
}

// ------------------------------------------------------------------ formatting

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const QUANTITY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const EMPTY_CELL = "—";

/** Rate columns read as currency. An absent rate is a dash, never a zero. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return EMPTY_CELL;
  return CURRENCY.format(Number(value));
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return EMPTY_CELL;
  return QUANTITY.format(Number(value));
}

export type RateInputResult =
  | { readonly ok: true; readonly value: number | null; readonly error: null }
  | { readonly ok: false; readonly value: null; readonly error: string };

/**
 * Shared validation for every hand-typed rate in the workbench (cost model inputs, final bid).
 * Blank stays blank — it is never coerced to 0, because 0 is a claim.
 */
export function parseRateInput(raw: string | number | null | undefined): RateInputResult {
  if (raw === null || raw === undefined) return { ok: true, value: null, error: null };
  const text = String(raw).trim();
  if (text === "") return { ok: true, value: null, error: null };
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^-?\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === "-" || cleaned === ".") {
    return { ok: false, value: null, error: "Enter a number, e.g. 31.50" };
  }
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return { ok: false, value: null, error: "Enter a number, e.g. 31.50" };
  if (parsed < 0) return { ok: false, value: null, error: "Rates cannot be negative" };
  if (/\.\d{3,}$/.test(cleaned)) {
    return { ok: false, value: null, error: "Use at most two decimal places" };
  }
  return { ok: true, value: parsed, error: null };
}

// ------------------------------------------------------- buyer format / grains

export type LineGrainObservation = {
  readonly laborCategories: readonly string[];
  readonly rateTypes: readonly string[];
  readonly units: readonly string[];
  readonly sites: readonly string[];
  readonly linesWithQuantity: number;
  readonly linesWithExtended: number;
  /** Canonical structures actually evidenced by the promoted lines. */
  readonly observedHints: readonly string[];
  /** Structures the schema supports but this pursuit has no line for. */
  readonly unobservedHints: readonly string[];
};

const HINT_MATCHERS: readonly { readonly hint: string; readonly test: RegExp }[] = [
  { hint: "hourly", test: /\b(hour|hourly|hr)\b/i },
  { hint: "site/post/shift", test: /\b(site|post|shift|gate|patrol|location)\b/i },
  { hint: "daily/weekly/monthly/annual", test: /\b(day|daily|week|weekly|month|monthly|year|annual)\b/i },
  { hint: "fixed fee", test: /\b(fixed|lump|firm)\b/i },
  { hint: "NTE", test: /\bnte\b|not[ -]to[ -]exceed/i },
  { hint: "base/options", test: /\b(base|option|oy\d|option year)\b/i },
  { hint: "escalation", test: /\b(escalat|cpi)\w*/i },
  { hint: "OT", test: /\b(ot|overtime)\b/i },
  { hint: "holiday", test: /\bholiday\b/i },
  { hint: "vehicles/equipment", test: /\b(vehicle|equipment|patrol car|golf cart)\b/i },
  { hint: "travel/reimbursables", test: /\b(travel|mileage|reimburs\w*)\b/i },
  { hint: "component build-up", test: /\b(wage|fringe|burden|h&w|health|welfare|build[- ]?up)\b/i },
];

function distinct(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = (value ?? "").trim();
    if (trimmed) set.add(trimmed);
  }
  return [...set].sort();
}

/**
 * Structure hints read off the real promoted lines. This never asserts a buyer requested a
 * grain we have no line for — unmatched canonical structures are reported as unobserved.
 */
export function observeLineGrains(lines: PricingLineRow[]): LineGrainObservation {
  const laborCategories = distinct(lines.map((l) => l.labor_category));
  const rateTypes = distinct(lines.map((l) => l.rate_type));
  const units = distinct(lines.map((l) => l.unit));
  const sites = distinct(lines.map((l) => l.site_or_post));

  const haystack = [...laborCategories, ...rateTypes, ...units, ...sites].join(" | ");
  const observed = new Set<string>();
  if (laborCategories.length > 0) observed.add("labor category");
  if (sites.length > 0) observed.add("site/post/shift");
  for (const matcher of HINT_MATCHERS) {
    if (matcher.test.test(haystack)) observed.add(matcher.hint);
  }

  const observedHints = PRICING_STRUCTURE_HINTS.filter((hint) => observed.has(hint));
  const unobservedHints = PRICING_STRUCTURE_HINTS.filter((hint) => !observed.has(hint));

  return {
    laborCategories,
    rateTypes,
    units,
    sites,
    linesWithQuantity: lines.filter((l) => l.quantity != null).length,
    linesWithExtended: lines.filter((l) => l.extended_amount != null).length,
    observedHints,
    unobservedHints,
  };
}

// --------------------------------------------------------------- range display

/**
 * Below this many included comparable rates a range bar would draw confidence that the
 * corpus does not support, so the panel states the sample count instead.
 */
export const MIN_COMPARABLE_SAMPLE_FOR_CHART = 3;

export type RangeBarModel = {
  readonly min: number;
  readonly max: number;
  readonly median: number;
  readonly avg: number;
  readonly count: number;
  /** 0–100 position of the median inside [min, max]. */
  readonly medianPercent: number;
  readonly avgPercent: number;
};

function positionPercent(value: number, min: number, max: number): number {
  if (!(max > min)) return 50;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/** Returns null when the sample is too small to draw — the caller then states n honestly. */
export function rangeBarModel(summary: RateSummary | null | undefined): RangeBarModel | null {
  if (!summary || summary.count < MIN_COMPARABLE_SAMPLE_FOR_CHART) return null;
  return {
    min: summary.min,
    max: summary.max,
    median: summary.median,
    avg: summary.avg,
    count: summary.count,
    medianPercent: positionPercent(summary.median, summary.min, summary.max),
    avgPercent: positionPercent(summary.avg, summary.min, summary.max),
  };
}

export function sampleCountLabel(summary: RateSummary | null | undefined): string {
  if (!summary || summary.count === 0) return "n=0 — no included verified rate";
  return `n=${summary.count} included verified rate${summary.count === 1 ? "" : "s"}`;
}

/** Relative age of a comparable so an operator can weigh recency without guessing. */
export function recencyLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "unknown";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "unknown";
  const days = Math.floor((now - then) / 86_400_000);
  if (days < 0) return "just now";
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

// ------------------------------------------------------------ canvas colouring

export type Rgb = readonly [number, number, number];

/** `0 0% 96.1%` (a shadcn HSL triplet) → rgb. Canvas cannot resolve `hsl(var(--x))`. */
export function hslTripletToRgb(triplet: string): Rgb | null {
  const match = triplet
    .trim()
    .match(/^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/);
  if (!match) return null;
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  if (![h, s, l].every(Number.isFinite)) return null;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const hex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Pre-blend to an opaque colour: Glide paints cell backgrounds, so alpha is unreliable. */
export function blendRgb(base: Rgb, tint: Rgb, alpha: number): Rgb {
  const a = Math.min(1, Math.max(0, alpha));
  return [
    base[0] + (tint[0] - base[0]) * a,
    base[1] + (tint[1] - base[1]) * a,
    base[2] + (tint[2] - base[2]) * a,
  ];
}

/** Banding hue per truth — the visual guarantee that two truths never read as one column. */
export const PRICING_TRUTH_TINTS: Record<PricingTruthId, Rgb> = {
  requested: [37, 99, 235],
  internal_cost: [217, 119, 6],
  proposed: [79, 70, 229],
  awarded: [5, 150, 105],
  current: [124, 58, 237],
};

/** Tailwind classes used by the legend so the HTML chrome matches the canvas banding. */
export const PRICING_TRUTH_LEGEND_CLASS: Record<PricingTruthId, string> = {
  requested: "bg-blue-600",
  internal_cost: "bg-amber-600",
  proposed: "bg-indigo-600",
  awarded: "bg-emerald-600",
  current: "bg-violet-600",
};
