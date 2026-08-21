/**
 * F23 coverage report — honest counts by role / status / authority.
 */

import type { AcquisitionCandidateStatus, AcquisitionCorpusRole, SourceAuthority } from "./types";

export type CoverageCandidateRow = {
  id: string;
  url: string;
  title: string | null;
  corpus_role: AcquisitionCorpusRole;
  source_authority: SourceAuthority;
  status: AcquisitionCandidateStatus;
  sha256: string | null;
  document_id: string | null;
  package_key: string | null;
  buyer_name: string | null;
  seed_section: string | null;
  last_error: string | null;
};

export type CoverageReport = {
  generated_at: string;
  totals: {
    candidates: number;
    acquired: number;
    ingested: number;
    duplicate: number;
    link_only: number;
    manual_import: number;
    failed: number;
    discovered: number;
    with_document: number;
    with_checksum: number;
  };
  by_role: Record<string, number>;
  by_status: Record<string, number>;
  by_authority: Record<string, number>;
  by_section: Record<string, number>;
  package_keys: string[];
  acquired_urls: string[];
  failed_urls: Array<{ url: string; error: string | null }>;
  link_only_urls: string[];
  manual_urls: string[];
};

export function buildCoverageReport(rows: CoverageCandidateRow[]): CoverageReport {
  const by_role: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  const by_authority: Record<string, number> = {};
  const by_section: Record<string, number> = {};
  const packageKeys = new Set<string>();
  const acquired_urls: string[] = [];
  const failed_urls: Array<{ url: string; error: string | null }> = [];
  const link_only_urls: string[] = [];
  const manual_urls: string[] = [];

  for (const row of rows) {
    by_role[row.corpus_role] = (by_role[row.corpus_role] ?? 0) + 1;
    by_status[row.status] = (by_status[row.status] ?? 0) + 1;
    const authKey = String(row.source_authority);
    by_authority[authKey] = (by_authority[authKey] ?? 0) + 1;
    const section = row.seed_section ?? "unknown";
    by_section[section] = (by_section[section] ?? 0) + 1;
    if (row.package_key) packageKeys.add(row.package_key);
    if (row.status === "ACQUIRED" || row.status === "INGESTED" || row.status === "DUPLICATE") {
      acquired_urls.push(row.url);
    }
    if (row.status === "FAILED") failed_urls.push({ url: row.url, error: row.last_error });
    if (row.status === "LINK_ONLY") link_only_urls.push(row.url);
    if (row.status === "MANUAL_IMPORT") manual_urls.push(row.url);
  }

  return {
    generated_at: new Date().toISOString(),
    totals: {
      candidates: rows.length,
      acquired: (by_status.ACQUIRED ?? 0) + (by_status.INGESTED ?? 0) + (by_status.DUPLICATE ?? 0),
      ingested: by_status.INGESTED ?? 0,
      duplicate: by_status.DUPLICATE ?? 0,
      link_only: by_status.LINK_ONLY ?? 0,
      manual_import: by_status.MANUAL_IMPORT ?? 0,
      failed: by_status.FAILED ?? 0,
      discovered: by_status.DISCOVERED ?? 0,
      with_document: rows.filter((r) => r.document_id).length,
      with_checksum: rows.filter((r) => r.sha256).length,
    },
    by_role,
    by_status,
    by_authority,
    by_section,
    package_keys: [...packageKeys].sort(),
    acquired_urls,
    failed_urls,
    link_only_urls,
    manual_urls,
  };
}

export function coverageReportMarkdown(report: CoverageReport): string {
  const lines: string[] = [
    "# Corpus Coverage (F23)",
    "",
    `Generated: ${report.generated_at}`,
    "",
    "## Totals",
    "",
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Candidates | ${report.totals.candidates} |`,
    `| Acquired (binary/local) | ${report.totals.acquired} |`,
    `| Ingested (vault) | ${report.totals.ingested} |`,
    `| Duplicate | ${report.totals.duplicate} |`,
    `| Link-only | ${report.totals.link_only} |`,
    `| Manual import | ${report.totals.manual_import} |`,
    `| Failed | ${report.totals.failed} |`,
    `| With checksum | ${report.totals.with_checksum} |`,
    `| With document_id | ${report.totals.with_document} |`,
    "",
    "## By role",
    "",
  ];
  for (const [k, v] of Object.entries(report.by_role).sort()) {
    lines.push(`- **${k}**: ${v}`);
  }
  lines.push("", "## By status", "");
  for (const [k, v] of Object.entries(report.by_status).sort()) {
    lines.push(`- **${k}**: ${v}`);
  }
  lines.push("", "## By authority", "");
  for (const [k, v] of Object.entries(report.by_authority).sort()) {
    lines.push(`- **${k}**: ${v}`);
  }
  lines.push("", "## Acquired URLs", "");
  for (const u of report.acquired_urls) lines.push(`- ${u}`);
  lines.push("", "## Failed / inaccessible", "");
  for (const f of report.failed_urls) lines.push(`- ${f.url} — ${f.error ?? "unknown"}`);
  lines.push("", "## Link-only", "");
  for (const u of report.link_only_urls) lines.push(`- ${u}`);
  lines.push("", "## Manual import", "");
  for (const u of report.manual_urls) lines.push(`- ${u}`);
  lines.push("");
  return lines.join("\n");
}
