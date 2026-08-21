/**
 * Map a natural-language question to a registered metric, or refuse when ambiguous.
 * Safe default: refuse with a clarification message — never invent a metric or SQL.
 */

import { getMetric, isForbiddenMetricId, listMetricIds, type MetricDefinition } from "@/lib/analytics/semantic-model";

export type ResolveQuestionResult =
  | { ok: true; metric: MetricDefinition; confidence: "high" | "medium" }
  | { ok: false; refuse: true; message: string; candidates?: string[] };

const CLARIFY =
  "Ambiguous analytics question. Specify one registered metric (e.g. pursuit_count, win_rate_decided, median_awarded_rate, contract_expiration_count, competitor_frequency) and optional filters. Free-form SQL is not allowed.";

const RULES: { metricId: string; patterns: RegExp[]; exclusive?: boolean }[] = [
  {
    metricId: "win_rate_decided",
    patterns: [/\bwin\s*rate\b/i, /\bwin[\s-]?loss\s*rate\b/i, /\bpercent(age)?\s+won\b/i],
  },
  {
    metricId: "recompete_win_rate",
    patterns: [/\brecompete\s+win\s*rate\b/i, /\brebid\s+win\s*rate\b/i],
  },
  {
    metricId: "median_awarded_rate",
    patterns: [/\bmedian\b.*\bawarded\b.*\brate\b/i, /\bawarded\b.*\bmedian\b/i, /\bmedian\s+awarded\b/i],
  },
  {
    metricId: "contract_expiration_count",
    patterns: [
      /\bexpir(e|ing|ation)\b/i,
      /\bcontracts?\s+expir/i,
      /\brenewal\s+bucket\b/i,
      /\bexpir(e|ing)\s+in\s+\d+\s*days?\b/i,
    ],
  },
  {
    metricId: "competitor_frequency",
    patterns: [/\bcompetitor\s+(frequency|appearances?|count)\b/i, /\bhow\s+often\b.*\bcompetitor/i],
  },
  {
    metricId: "submitted_count",
    patterns: [/\bsubmitted\s+count\b/i, /\bhow\s+many\b.*\bsubmitted\b/i, /\bnumber\s+of\s+submissions?\b/i],
  },
  {
    metricId: "won_count",
    patterns: [/\bwon\s+count\b/i, /\bhow\s+many\b.*\bwon\b/i, /\bnumber\s+of\s+wins?\b/i],
  },
  {
    metricId: "lost_count",
    patterns: [/\blost\s+count\b/i, /\bhow\s+many\b.*\blost\b/i, /\bnumber\s+of\s+losses?\b/i],
  },
  {
    metricId: "pursuit_count",
    patterns: [/\bpursuit\s+count\b/i, /\bhow\s+many\b.*\bpursuits?\b/i, /\bnumber\s+of\s+(pursuits?|opportunities)\b/i],
  },
  {
    metricId: "awarded_value",
    patterns: [/\bawarded\s+value\b/i, /\btotal\s+awarded\b/i, /\bsum\s+of\s+awards?\b/i],
  },
  {
    metricId: "submitted_value",
    patterns: [/\bsubmitted\s+value\b/i, /\btotal\s+submitted\b.*\b(value|dollars?|\$)/i],
  },
  {
    metricId: "active_contract_value",
    patterns: [/\bactive\s+contract\s+value\b/i, /\bportfolio\s+value\b/i],
  },
];

/**
 * Resolve a question string to exactly one metric, or refuse.
 * If metricId is already provided and valid, prefer it.
 */
export function resolveAnalyticsQuestion(opts: {
  question?: string | null;
  metricId?: string | null;
}): ResolveQuestionResult {
  const explicit = opts.metricId?.trim();
  if (explicit) {
    if (isForbiddenMetricId(explicit)) {
      return {
        ok: false,
        refuse: true,
        message: `Metric "${explicit}" is forbidden. market_share is never registered or computed.`,
      };
    }
    const metric = getMetric(explicit);
    if (!metric) {
      return {
        ok: false,
        refuse: true,
        message: `Unknown metric "${explicit}". Known: ${listMetricIds().join(", ")}.`,
      };
    }
    return { ok: true, metric, confidence: "high" };
  }

  const q = (opts.question ?? "").trim();
  if (!q) {
    return { ok: false, refuse: true, message: CLARIFY };
  }

  if (/\bmarket\s*share\b/i.test(q) || isForbiddenMetricId(q)) {
    return {
      ok: false,
      refuse: true,
      message:
        "market_share is not a registered metric and will never be invented. Ask for observed counts (pursuit_count, competitor_frequency, win_rate_decided) instead.",
    };
  }

  // Explicit free-SQL asks → refuse.
  if (/\b(select|drop|insert|update|delete)\b[\s\S]*\bfrom\b/i.test(q)) {
    return {
      ok: false,
      refuse: true,
      message:
        "Free-form SQL is not allowed. Use a registered metricId via ask_structured_analytics.",
    };
  }

  const hits: string[] = [];
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(q))) {
      if (!hits.includes(rule.metricId)) hits.push(rule.metricId);
    }
  }

  // Count + rate in same question without clear winner → ambiguous.
  const wantsCount = /\b(how\s+many|count|number\s+of)\b/i.test(q);
  const wantsRate = /\b(rate|percent|median|value)\b/i.test(q);
  if (wantsCount && wantsRate && hits.length !== 1) {
    return { ok: false, refuse: true, message: CLARIFY, candidates: hits };
  }

  if (hits.length === 0) {
    return { ok: false, refuse: true, message: CLARIFY };
  }
  if (hits.length > 1) {
    return {
      ok: false,
      refuse: true,
      message: `${CLARIFY} Matched candidates: ${hits.join(", ")}.`,
      candidates: hits,
    };
  }

  const metric = getMetric(hits[0]!);
  if (!metric) {
    return { ok: false, refuse: true, message: CLARIFY };
  }
  return { ok: true, metric, confidence: "medium" };
}
