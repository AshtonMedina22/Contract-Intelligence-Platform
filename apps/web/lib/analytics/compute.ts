/**
 * Pure metric computation over fetched rows.
 * Used by execute.ts and acceptance fixtures — no Supabase import.
 */

import { MIN_WIN_RATE_SAMPLE, summarizeWinLoss } from "@/lib/intelligence/observations";

export type AnalyticsColumn = { key: string; label: string };

export type ComputeResult = {
  status: "ok" | "withheld" | "refused" | "zero_denominator";
  columns: AnalyticsColumn[];
  rows: Record<string, unknown>[];
  interpretation: string;
  limitations: string[];
  scope: string;
};

const HOURLY_UNIT_RE = /\b(hour|hourly|hr|per\s*hour)\b|\/hr\b/i;
const NON_HOURLY_HINT_RE =
  /\b(day|daily|week|weekly|month|monthly|year|annual|lump|fixed|nte|total)\b/i;

export function isHourlyUnit(unit: string | null | undefined): boolean {
  if (!unit || !String(unit).trim()) return false;
  return HOURLY_UNIT_RE.test(unit);
}

export function classifyRateGrain(units: Array<string | null | undefined>): {
  grain: "hourly" | "non_hourly" | "mixed" | "unknown";
  hourly: number;
  nonHourly: number;
  unknown: number;
} {
  let hourly = 0;
  let nonHourly = 0;
  let unknown = 0;
  for (const u of units) {
    const s = (u ?? "").trim();
    if (!s) {
      unknown += 1;
      continue;
    }
    if (isHourlyUnit(s)) hourly += 1;
    else if (NON_HOURLY_HINT_RE.test(s) || !HOURLY_UNIT_RE.test(s)) nonHourly += 1;
    else unknown += 1;
  }
  if (hourly > 0 && nonHourly > 0) return { grain: "mixed", hourly, nonHourly, unknown };
  if (hourly > 0 && nonHourly === 0) return { grain: "hourly", hourly, nonHourly, unknown };
  if (nonHourly > 0 && hourly === 0) return { grain: "non_hourly", hourly, nonHourly, unknown };
  return { grain: "unknown", hourly, nonHourly, unknown };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function buyerName(row: Record<string, unknown>): string | null {
  const opp = row.opportunities as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const o = Array.isArray(opp) ? opp[0] : opp;
  if (!o) {
    const clients = row.clients as { name?: string } | { name?: string }[] | null | undefined;
    const c = Array.isArray(clients) ? clients[0] : clients;
    return c?.name ?? null;
  }
  const clients = o.clients as { name?: string } | { name?: string }[] | null | undefined;
  const c = Array.isArray(clients) ? clients[0] : clients;
  return c?.name ?? null;
}

export function computePursuitCount(rows: Record<string, unknown>[], dimensions: string[]): ComputeResult {
  if (!dimensions.length || dimensions.includes("none")) {
    return {
      status: "ok",
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Count" },
        { key: "n", label: "n" },
      ],
      rows: [{ metric: "pursuit_count", value: rows.length, n: rows.length }],
      interpretation: `pursuit_count = ${rows.length} opportunities under org RLS.`,
      limitations: ["Count of opportunities rows visible under RLS — not market size."],
      scope: "opportunities",
    };
  }
  const key = dimensions[0]!;
  const groups = new Map<string, number>();
  for (const row of rows) {
    let g: string;
    if (key === "buyer_name") g = buyerName(row) ?? "(unknown buyer)";
    else g = String(row[key] ?? "(null)");
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }
  return {
    status: "ok",
    columns: [
      { key: "dimension", label: key },
      { key: "value", label: "Count" },
    ],
    rows: [...groups.entries()].map(([dimension, value]) => ({ dimension, value })),
    interpretation: `pursuit_count by ${key}.`,
    limitations: ["Not market share."],
    scope: "opportunities",
  };
}

export function computeSubmittedCount(
  stageRows: Record<string, unknown>[],
  packetRows: Record<string, unknown>[],
): ComputeResult {
  const ids = new Set<string>();
  for (const r of stageRows) ids.add(String(r.id));
  for (const r of packetRows) {
    if (r.opportunity_id) ids.add(String(r.opportunity_id));
  }
  return {
    status: "ok",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Count" },
      { key: "n", label: "n" },
    ],
    rows: [{ metric: "submitted_count", value: ids.size, n: ids.size }],
    interpretation: `submitted_count = ${ids.size} (stage=SUBMITTED ∪ submission_packets.submitted_at).`,
    limitations: ["Union of stage and packet timestamps; duplicates collapsed by opportunity_id."],
    scope: "opportunities + submission_packets",
  };
}

export function computeOutcomeCount(
  rows: Record<string, unknown>[],
  outcome: "WON" | "LOST",
): ComputeResult {
  const filtered = rows.filter((r) => String(r.outcome).toUpperCase() === outcome);
  return {
    status: "ok",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Count" },
      { key: "n", label: "n" },
    ],
    rows: [
      {
        metric: outcome === "WON" ? "won_count" : "lost_count",
        value: filtered.length,
        n: filtered.length,
      },
    ],
    interpretation: `${outcome === "WON" ? "won_count" : "lost_count"} = ${filtered.length}.`,
    limitations: ["Observed win_loss_reviews only — not a forecast."],
    scope: "win_loss_reviews",
  };
}

export function computeWinRateDecided(rows: Record<string, unknown>[]): ComputeResult {
  const outcomes = rows.map((r) => String(r.outcome ?? ""));
  const summary = summarizeWinLoss(outcomes);
  if (summary.decided === 0) {
    return {
      status: "zero_denominator",
      columns: [
        { key: "won", label: "Won" },
        { key: "lost", label: "Lost" },
        { key: "decided", label: "Decided" },
        { key: "win_rate", label: "Win rate" },
      ],
      rows: [{ won: 0, lost: 0, decided: 0, win_rate: null }],
      interpretation: "win_rate_decided undefined — zero decided pursuits (WON+LOST).",
      limitations: [summary.withheldReason ?? "Zero denominator."],
      scope: "win_loss_reviews (decided)",
    };
  }
  if (summary.winRatePercent == null) {
    return {
      status: "withheld",
      columns: [
        { key: "won", label: "Won" },
        { key: "lost", label: "Lost" },
        { key: "decided", label: "Decided" },
        { key: "win_rate", label: "Win rate" },
        { key: "reason", label: "Withhold reason" },
      ],
      rows: [
        {
          won: summary.won,
          lost: summary.lost,
          decided: summary.decided,
          win_rate: null,
          reason: summary.withheldReason,
        },
      ],
      interpretation: `win_rate_decided withheld — decided n=${summary.decided} < ${MIN_WIN_RATE_SAMPLE}.`,
      limitations: [summary.withheldReason ?? "Sample too thin (P9 gate)."],
      scope: "win_loss_reviews (decided)",
    };
  }
  return {
    status: "ok",
    columns: [
      { key: "won", label: "Won" },
      { key: "lost", label: "Lost" },
      { key: "decided", label: "Decided" },
      { key: "win_rate_percent", label: "Win rate %" },
    ],
    rows: [
      {
        won: summary.won,
        lost: summary.lost,
        decided: summary.decided,
        win_rate_percent: summary.winRatePercent,
      },
    ],
    interpretation: `win_rate_decided = ${summary.winRatePercent}% (WON÷(WON+LOST), n=${summary.decided}).`,
    limitations: ["Not market share. Undecided outcomes excluded."],
    scope: "win_loss_reviews (decided)",
  };
}

export function computeRecompeteWinRate(
  opportunities: Array<{
    id: string;
    rebid_from_contract_id?: string | null;
    rebid_from_opportunity_id?: string | null;
    win_loss_reviews?: { outcome?: string } | { outcome?: string }[] | null;
  }>,
): ComputeResult {
  const rebid = opportunities.filter(
    (o) => o.rebid_from_contract_id || o.rebid_from_opportunity_id,
  );
  const outcomes: string[] = [];
  for (const o of rebid) {
    const w = o.win_loss_reviews;
    const row = Array.isArray(w) ? w[0] : w;
    if (row?.outcome) outcomes.push(String(row.outcome));
  }
  if (outcomes.length === 0) {
    return {
      status: "withheld",
      columns: [
        { key: "rebid_pursuits", label: "Rebid pursuits" },
        { key: "decided", label: "Decided" },
        { key: "win_rate", label: "Win rate" },
      ],
      rows: [{ rebid_pursuits: rebid.length, decided: 0, win_rate: null }],
      interpretation: "recompete_win_rate withheld — no decided rebid outcomes.",
      limitations: ["Requires rebid_from_* + win_loss_reviews WON/LOST."],
      scope: "rebid opportunities × win_loss_reviews",
    };
  }
  return {
    ...computeWinRateDecided(outcomes.map((outcome) => ({ outcome }))),
    interpretation: `recompete_win_rate over ${rebid.length} rebid-linked pursuits.`,
    scope: "rebid opportunities × win_loss_reviews",
  };
}

export function computeAwardedValue(rows: Array<{ amount_nte?: number | null }>): ComputeResult {
  const total = rows.length;
  const withAmt = rows.filter((r) => r.amount_nte != null && Number.isFinite(Number(r.amount_nte)));
  if (total === 0) {
    return {
      status: "ok",
      columns: [
        { key: "awarded_value", label: "Awarded value" },
        { key: "covered", label: "Covered" },
        { key: "in_scope", label: "In scope" },
      ],
      rows: [{ awarded_value: 0, covered: 0, in_scope: 0 }],
      interpretation: "awarded_value = 0 (no awards in scope).",
      limitations: ["Sum of awards.amount_nte only."],
      scope: "awards",
    };
  }
  if (withAmt.length < total) {
    return {
      status: "withheld",
      columns: [
        { key: "awarded_value", label: "Awarded value" },
        { key: "covered", label: "Covered" },
        { key: "in_scope", label: "In scope" },
        { key: "reason", label: "Reason" },
      ],
      rows: [
        {
          awarded_value: null,
          covered: withAmt.length,
          in_scope: total,
          reason: `Only ${withAmt.length} of ${total} awards have amount_nte — partial sum withheld.`,
        },
      ],
      interpretation: "awarded_value withheld — incomplete amount_nte coverage.",
      limitations: ["Partial award totals are never shown as complete."],
      scope: "awards",
    };
  }
  const sum = withAmt.reduce((a, r) => a + Number(r.amount_nte), 0);
  return {
    status: "ok",
    columns: [
      { key: "awarded_value", label: "Awarded value" },
      { key: "n", label: "n" },
    ],
    rows: [{ awarded_value: sum, n: total }],
    interpretation: `awarded_value = ${sum} over n=${total} awards with amount_nte.`,
    limitations: ["Corpus observations only — not market size."],
    scope: "awards",
  };
}

export function computeMedianAwardedRate(
  rows: Array<{ awarded_rate?: number | null; unit?: string | null }>,
): ComputeResult {
  const withRate = rows.filter((r) => r.awarded_rate != null && Number.isFinite(Number(r.awarded_rate)));
  if (!withRate.length) {
    return {
      status: "ok",
      columns: [
        { key: "median_awarded_rate", label: "Median" },
        { key: "n", label: "n" },
      ],
      rows: [{ median_awarded_rate: null, n: 0 }],
      interpretation: "median_awarded_rate — no awarded_rate rows.",
      limitations: ["Requires non-null awarded_rate."],
      scope: "pricing_lines",
    };
  }
  const grain = classifyRateGrain(withRate.map((r) => r.unit));
  if (grain.grain === "mixed") {
    return {
      status: "refused",
      columns: [
        { key: "median_awarded_rate", label: "Median" },
        { key: "grain", label: "Grain" },
        { key: "reason", label: "Reason" },
      ],
      rows: [
        {
          median_awarded_rate: null,
          grain: "mixed",
          reason: `Mixed unit grain (hourly=${grain.hourly}, non_hourly=${grain.nonHourly}) — median refused.`,
        },
      ],
      interpretation: "median_awarded_rate refused — mixed hourly/non-hourly units.",
      limitations: ["Filter to a single unit grain before requesting a median."],
      scope: "pricing_lines",
    };
  }
  if (grain.grain !== "hourly") {
    return {
      status: "refused",
      columns: [
        { key: "median_awarded_rate", label: "Median" },
        { key: "grain", label: "Grain" },
        { key: "reason", label: "Reason" },
      ],
      rows: [
        {
          median_awarded_rate: null,
          grain: grain.grain,
          reason: "median_awarded_rate requires hourly unit grain; non-hourly/unknown refused.",
        },
      ],
      interpretation: "median_awarded_rate refused — unit grain is not hourly.",
      limitations: ["Pass filters.unit to an hourly value when mixed or unknown."],
      scope: "pricing_lines",
    };
  }
  const hourlyRows = withRate.filter((r) => isHourlyUnit(r.unit));
  const m = median(hourlyRows.map((r) => Number(r.awarded_rate)));
  return {
    status: "ok",
    columns: [
      { key: "median_awarded_rate", label: "Median" },
      { key: "n", label: "n" },
      { key: "unit_grain", label: "Unit grain" },
    ],
    rows: [{ median_awarded_rate: m, n: hourlyRows.length, unit_grain: "hourly" }],
    interpretation: `median_awarded_rate = ${m} (hourly, n=${hourlyRows.length}).`,
    limitations: ["awarded_rate only — never blended with proposed/current."],
    scope: "pricing_lines (hourly)",
  };
}

export function daysUntil(isoDate: string, today = new Date()): number | null {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((end - start) / 86_400_000);
}

export function computeContractExpirationCount(
  contracts: Array<{ id: string; verified_end_on?: string | null; client_id?: string | null }>,
  opts: { windowDays?: number | null; bucket?: string | null; alertRows?: Array<{ bucket?: string }> },
): ComputeResult {
  if (opts.bucket && opts.alertRows) {
    return {
      status: "ok",
      columns: [
        { key: "bucket", label: "Bucket" },
        { key: "count", label: "Count" },
      ],
      rows: [{ bucket: opts.bucket, count: opts.alertRows.length }],
      interpretation: `contract_expiration_count bucket=${opts.bucket} → ${opts.alertRows.length}.`,
      limitations: ["Buckets from contract_alerts (verified_end_on only)."],
      scope: "contract_alerts",
    };
  }

  const windowDays = opts.windowDays ?? null;
  const dated = contracts.filter((c) => c.verified_end_on);
  let matched = dated;
  if (windowDays != null) {
    matched = dated.filter((c) => {
      const days = daysUntil(String(c.verified_end_on));
      return days != null && days >= 0 && days <= windowDays;
    });
  }

  // Bucket breakdown when no window.
  if (windowDays == null) {
    const buckets: Record<string, number> = {
      EXPIRED: 0,
      "30": 0,
      "60": 0,
      "90": 0,
      "120": 0,
      "180": 0,
      BEYOND_180: 0,
    };
    for (const c of dated) {
      const days = daysUntil(String(c.verified_end_on));
      if (days == null) continue;
      if (days < 0) buckets.EXPIRED! += 1;
      else if (days <= 30) buckets["30"]! += 1;
      else if (days <= 60) buckets["60"]! += 1;
      else if (days <= 90) buckets["90"]! += 1;
      else if (days <= 120) buckets["120"]! += 1;
      else if (days <= 180) buckets["180"]! += 1;
      else buckets.BEYOND_180! += 1;
    }
    return {
      status: "ok",
      columns: [
        { key: "bucket", label: "Bucket" },
        { key: "count", label: "Count" },
      ],
      rows: Object.entries(buckets).map(([bucket, count]) => ({ bucket, count })),
      interpretation: `contract_expiration_count by verified_end_on buckets (dated=${dated.length}, undated excluded=${contracts.length - dated.length}).`,
      limitations: ["Undated contracts never assumed active or expiring."],
      scope: "contracts.verified_end_on",
    };
  }

  return {
    status: "ok",
    columns: [
      { key: "window_days", label: "Window (days)" },
      { key: "count", label: "Count" },
      { key: "dated", label: "Dated in scope" },
    ],
    rows: [{ window_days: windowDays, count: matched.length, dated: dated.length }],
    interpretation: `contract_expiration_count within ${windowDays} days = ${matched.length}.`,
    limitations: ["Undated contracts excluded."],
    scope: "contracts.verified_end_on",
  };
}

export function computeCompetitorFrequency(
  bids: Array<{
    competitor_id?: string | null;
    competitors?: { name?: string } | { name?: string }[] | null;
  }>,
): ComputeResult {
  const groups = new Map<string, { competitor_id: string; competitor_name: string; count: number }>();
  for (const b of bids) {
    const id = String(b.competitor_id ?? "unknown");
    const comp = Array.isArray(b.competitors) ? b.competitors[0] : b.competitors;
    const name = comp?.name ?? id;
    const cur = groups.get(id) ?? { competitor_id: id, competitor_name: name, count: 0 };
    cur.count += 1;
    groups.set(id, cur);
  }
  const rows = [...groups.values()].sort((a, b) => b.count - a.count);
  return {
    status: "ok",
    columns: [
      { key: "competitor_id", label: "Competitor id" },
      { key: "competitor_name", label: "Competitor" },
      { key: "count", label: "Appearances" },
    ],
    rows,
    interpretation: `competitor_frequency over ${bids.length} bid appearances (${rows.length} competitors).`,
    limitations: ["Observed competitor_bids counts — never market share."],
    scope: "competitor_bids",
  };
}

export function withheldMetricResult(metricId: string, reason: string): ComputeResult {
  return {
    status: "withheld",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
      { key: "reason", label: "Reason" },
    ],
    rows: [{ metric: metricId, value: null, reason }],
    interpretation: `${metricId} withheld.`,
    limitations: [reason],
    scope: "n/a",
  };
}
