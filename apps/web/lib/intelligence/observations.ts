/**
 * Shared honesty primitives for the Intelligence workbench.
 *
 * Two rules live here so that seven views cannot disagree about them:
 *
 *   1. Every number on an Intelligence view is a **count of observations in this tenant's verified
 *      corpus**, carries its own sample count, and is never presented as a share of a market.
 *   2. A rate is only shown when the denominator can carry it. Below the threshold the view reports
 *      the observed counts and says why the rate is withheld, rather than printing a percentage
 *      that a handful of pursuits cannot support.
 *
 * Pure module: no React, no Supabase.
 */

export const HONESTY_STRIP_TEXT =
  "Verified observations only; not market share. Every figure is a count of records in this tenant's verified corpus, with its sample size stated. Nothing here is a forecast, an estimate of market size, or a claim about cause.";

export const NO_MARKET_SHARE_NOTE = "Counts are observations in this corpus, not market share.";

/** Federal award research (USAspending) is public observation — never market share or L&P pricing truth. */
export const FEDERAL_AWARD_RESEARCH_NOTE =
  "Federal award observations may appear from the USAspending.gov public API or research_facts with provider=usa_spending (AI_EXTRACTED until a human verifies). They are not market share and are never mixed into L&P proposed / buyer awarded / current pricing_lines.";

export const OBSERVED_LABEL = "Observed";
export const INFERENCE_LABEL = "Inference";

export type EvidenceBasis = "OBSERVED" | "INFERENCE";

export const EVIDENCE_BASIS_LABELS: Record<EvidenceBasis, string> = {
  OBSERVED: OBSERVED_LABEL,
  INFERENCE: INFERENCE_LABEL,
};

export const EVIDENCE_BASIS_NOTES: Record<EvidenceBasis, string> = {
  OBSERVED: "Read directly from a verified record — the value is in the source.",
  INFERENCE:
    "Derived by joining verified records. The join is stated; the conclusion is not in any single source.",
};

/** A dense tile: one count, one sample statement, one source table. */
export type ObservationTile = {
  label: string;
  value: number;
  /** Always rendered, always includes `n=` so a tile can never read as a rate. */
  sample: string;
  /** The table the count came from, named so the operator can go and check it. */
  source: string;
  href?: string;
  basis: EvidenceBasis;
};

export function observationTile(input: {
  label: string;
  value: number | null | undefined;
  source: string;
  href?: string;
  basis?: EvidenceBasis;
  unit?: string;
}): ObservationTile {
  const value = typeof input.value === "number" && Number.isFinite(input.value) ? input.value : 0;
  const unit = input.unit ?? "records";
  return {
    label: input.label,
    value,
    sample: `n=${value} ${unit}`,
    source: input.source,
    href: input.href,
    basis: input.basis ?? "OBSERVED",
  };
}

/**
 * Minimum decided pursuits before a win rate is printed.
 *
 * At n=20 the widest 95% Wilson interval on a proportion is roughly ±21 points; below that the
 * interval is wider than the range most operators would act on, so the rate is withheld entirely
 * rather than shown with a caveat nobody reads.
 */
export const MIN_WIN_RATE_SAMPLE = 20;

export const WIN_RATE_WITHHELD_REASON = `A win rate needs at least ${MIN_WIN_RATE_SAMPLE} decided pursuits (WON + LOST) before the percentage means anything. Below that this view reports the observed counts only.`;

export const WIN_RATE_DEFINITION =
  "Win rate = WON ÷ (WON + LOST) over win_loss_reviews in this tenant. NO_BID, CANCELLED, NO_AWARD and PENDING are excluded from both sides, so the denominator is decided pursuits, not all pursuits.";

export type OutcomeCounts = Record<string, number>;

export type WinLossSummary = {
  total: number;
  counts: OutcomeCounts;
  won: number;
  lost: number;
  decided: number;
  /** Excluded from the rate: no-bid, cancelled, no-award, pending. */
  undecided: number;
  /** Null whenever the sample is too thin — never a placeholder zero. */
  winRatePercent: number | null;
  /** 95% Wilson interval, only when a rate is shown. */
  winRateInterval: { low: number; high: number } | null;
  withheldReason: string | null;
};

/** The only outcomes that belong in a win-rate denominator. */
export const DECIDED_OUTCOMES = ["WON", "LOST"] as const;

/** Recorded outcomes that are deliberately excluded from both sides of the rate. */
export const UNDECIDED_OUTCOMES = ["NO_BID", "CANCELLED", "NO_AWARD", "PENDING"] as const;

export function isDecidedOutcome(outcome: string | null | undefined): boolean {
  return DECIDED_OUTCOMES.includes((outcome ?? "").toUpperCase() as (typeof DECIDED_OUTCOMES)[number]);
}

/** Wilson score interval — narrower tails than normal approximation at small n. */
function wilsonInterval(successes: number, total: number): { low: number; high: number } {
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return {
    low: Math.max(0, ((centre - spread) / denominator) * 100),
    high: Math.min(100, ((centre + spread) / denominator) * 100),
  };
}

export function summarizeWinLoss(outcomes: (string | null | undefined)[]): WinLossSummary {
  const counts: OutcomeCounts = {};
  for (const raw of outcomes) {
    const outcome = (raw ?? "UNRECORDED").toUpperCase();
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  const won = counts.WON ?? 0;
  const lost = counts.LOST ?? 0;
  const decided = outcomes.filter(isDecidedOutcome).length;
  const total = outcomes.length;
  const undecided = total - decided;

  const showRate = decided >= MIN_WIN_RATE_SAMPLE;
  return {
    total,
    counts,
    won,
    lost,
    decided,
    undecided,
    winRatePercent: showRate ? Math.round((won / decided) * 1000) / 10 : null,
    winRateInterval: showRate ? wilsonInterval(won, decided) : null,
    withheldReason: showRate ? null : `${WIN_RATE_WITHHELD_REASON} Decided so far: ${decided}.`,
  };
}

/** Observed span of a set of rates, with n stated. Never a "typical" or "expected" rate. */
export function observedSpan(
  values: (number | null | undefined)[],
): { count: number; min: number; max: number } | null {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (present.length === 0) return null;
  return { count: present.length, min: Math.min(...present), max: Math.max(...present) };
}
