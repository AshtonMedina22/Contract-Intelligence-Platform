/**
 * F23 search saturation report — honest queries attempted + result counts.
 */

export type SaturationRunRow = {
  id?: string;
  provider: string;
  query: string;
  buyer_or_entity: string | null;
  result_count: number | null;
  mode: string;
  notes: string | null;
  attempted_at: string;
};

export type SaturationReport = {
  generated_at: string;
  runs: SaturationRunRow[];
  by_provider: Record<string, { queries: number; total_results: number; zero_result_queries: number }>;
  by_entity: Record<string, { queries: number; notes: string[] }>;
  honesty: string[];
};

export function buildSaturationReport(runs: SaturationRunRow[]): SaturationReport {
  const by_provider: SaturationReport["by_provider"] = {};
  const by_entity: SaturationReport["by_entity"] = {};
  const honesty: string[] = [
    "Result counts are from live provider responses or explicit SKIP/MANUAL notes — never fabricated.",
    "Authority 3 / news-style hits remain discovery leads until a primary official URL is acquired.",
    "Zero-result queries are recorded; absence of a run means that query was not attempted.",
  ];

  for (const run of runs) {
    const p = by_provider[run.provider] ?? { queries: 0, total_results: 0, zero_result_queries: 0 };
    p.queries += 1;
    if (typeof run.result_count === "number") {
      p.total_results += run.result_count;
      if (run.result_count === 0) p.zero_result_queries += 1;
    }
    by_provider[run.provider] = p;

    const entity = run.buyer_or_entity ?? "(none)";
    const e = by_entity[entity] ?? { queries: 0, notes: [] };
    e.queries += 1;
    if (run.notes) e.notes.push(run.notes);
    by_entity[entity] = e;
  }

  return {
    generated_at: new Date().toISOString(),
    runs,
    by_provider,
    by_entity,
    honesty,
  };
}

export function saturationReportMarkdown(report: SaturationReport): string {
  const lines: string[] = [
    "# Acquisition Saturation (F23)",
    "",
    `Generated: ${report.generated_at}`,
    "",
    "## Honesty",
    "",
  ];
  for (const h of report.honesty) lines.push(`- ${h}`);
  lines.push("", "## By provider", "");
  for (const [provider, stats] of Object.entries(report.by_provider).sort()) {
    lines.push(
      `- **${provider}**: ${stats.queries} queries · ${stats.total_results} totaled results · ${stats.zero_result_queries} zero-hit queries`,
    );
  }
  lines.push("", "## Runs", "");
  lines.push("| When | Provider | Entity | Query | Results | Mode | Notes |");
  lines.push("| --- | --- | --- | --- | ---: | --- | --- |");
  for (const run of report.runs) {
    const q = run.query.replace(/\|/g, "\\|").slice(0, 80);
    const notes = (run.notes ?? "").replace(/\|/g, "\\|").slice(0, 120);
    lines.push(
      `| ${run.attempted_at} | ${run.provider} | ${run.buyer_or_entity ?? ""} | ${q} | ${run.result_count ?? "—"} | ${run.mode} | ${notes} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
