#!/usr/bin/env node
/** Render PILOT_GAP_REPORT.md from pilot-run-results.json */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const IN = join(ROOT, "docs/benchmarks/pilot-run-results.json");
const OUT = join(ROOT, "docs/benchmarks/PILOT_GAP_REPORT.md");

const DOMAIN_GROUPS = {
  SOLICITATION: [
    ["metadata", "solicitation_metadata"],
    ["dates", "solicitation_dates"],
    ["deadlines", "solicitation_dates"],
    ["addenda/Q&A", "solicitation_metadata"],
    ["evaluation", "solicitation_evaluation"],
    ["forms/signatures", "solicitation_forms"],
    ["submission method", "solicitation_forms"],
  ],
  SCOPE: [
    ["service", "scope_service"],
    ["sites/posts", "scope_sites"],
    ["staffing", "scope_staffing"],
    ["schedules", "scope_staffing"],
    ["guard classifications", "scope_classifications"],
    ["personnel/training", "scope_service"],
  ],
  PRICING: [
    ["buyer-requested format", "pricing_table"],
    ["L&P proposed pricing", "pricing_hourly"],
    ["competitor pricing", "pricing_hourly"],
    ["awarded pricing", "result_award"],
    ["current pricing", "pricing_hourly"],
    ["component cost build-up", "pricing_cost_build"],
    ["options/escalation", "pricing_escalation"],
    ["OT/holiday", "pricing_ot_holiday"],
    ["equipment/vehicle", "pricing_hourly"],
  ],
  PROPOSAL: [
    ["response sections", "proposal_sections"],
    ["commitments", "proposal_sections"],
    ["references", "solicitation_forms"],
    ["certifications", "solicitation_forms"],
    ["evidence/source pages", "contract_po"],
  ],
  RESULT: [
    ["award", "result_award"],
    ["loss", "result_award"],
    ["rank", "result_scores"],
    ["evaluator scoring", "result_scores"],
    ["competitor result", "result_scores"],
  ],
  CONTRACT: [
    ["service plan", "scope_service"],
    ["commercial terms", "contract_po"],
    ["PO", "contract_po"],
    ["amendments", "contract_amendment"],
    ["options", "contract_renewal"],
    ["renewals", "contract_renewal"],
    ["current terms", "contract_renewal"],
  ],
  PROVENANCE: [
    ["page", "always"],
    ["section", "always"],
    ["sheet", "always"],
    ["cell", "always"],
    ["source excerpt", "always"],
    ["version", "always"],
    ["verification", "always"],
  ],
};

const UX = {
  SOLICITATION: "Requirements",
  SCOPE: "Requirements",
  PRICING: "Pricing",
  PROPOSAL: "Response",
  RESULT: "Result",
  CONTRACT_SERVICE: "Contract Service Plan",
  CONTRACT_COMMERCIAL: "Contract Commercial Terms",
  CONTRACT_CHANGES: "Contract Changes",
  CONTRACT_RENEWAL: "Contract Renewal",
  PROVENANCE: "Data Ops",
  INTAKE: "Data Ops",
};

function coverageCell(presentInPdf, structuredCaptured) {
  if (!presentInPdf) return "n/a";
  if (structuredCaptured) return "captured";
  return "MISSING";
}

function pkgNotes(pkg, rows) {
  const lines = [];
  const ingested = rows.filter((r) => r.intake?.ok);
  const processed = rows.filter((r) => r.process?.ok);
  lines.push(`- **Files:** ${rows.map((r) => r.srcId).join(", ")}`);
  lines.push(`- **Ingested:** ${ingested.length}/${rows.length} | **Processed:** ${processed.length}/${rows.length} | **Document VERIFIED:** ${rows.filter((r) => r.finalStatus === "VERIFIED").length}/${rows.length}`);
  return lines;
}

function fileFindings(row) {
  const f = [];
  if (row.intake?.skipped) {
    f.push({ type: "intake_blocked", detail: row.intake.reason, severity: "blocking", ux: UX.INTAKE });
  }
  if (row.process && !row.process.ok) {
    f.push({ type: "parser_extraction_failure", detail: row.process.error ?? "process failed", severity: "blocking", ux: UX.INTAKE });
  }
  if (row.process?.ok && row.verify?.promoted === 0 && row.verify?.verified > 0) {
    f.push({
      type: "schema_gap",
      detail: `${row.verify.verified} page_text facts verified but 0 promoted to canonical (no entity mapping for page blobs)`,
      severity: "blocking",
      ux: UX.PROVENANCE,
    });
  }
  if (row.finalStatus === "VERIFIED" && (row.verify?.factCount ?? 0) === 0) {
    f.push({
      type: "verification_problem",
      detail: "Document marked VERIFIED with zero staging facts — should remain NEEDS_REVIEW or FAILED",
      severity: "blocking",
      ux: UX.PROVENANCE,
    });
  }
  if (row.pdfAnalysis && row.process?.ok) {
    const pages = row.pdfAnalysis.pages;
    const facts = row.process.factCount;
    if (facts < pages) {
      f.push({
        type: "provenance_failure",
        detail: `${facts} page_text facts for ${pages} pages — empty pages skipped; no section/cell granularity`,
        severity: "deferrable",
        ux: UX.PROVENANCE,
      });
    }
  }
  for (const g of row.gaps ?? []) {
    if (!f.some((x) => x.detail === g.detail)) {
      f.push({ type: g.kind, detail: g.detail, severity: g.severity, ux: g.ux ?? UX.PROVENANCE });
    }
  }
  return f;
}

const data = JSON.parse(readFileSync(IN, "utf8"));
const byPkg = {};
for (const row of data.fileResults) {
  (byPkg[row.pkg] ??= []).push(row);
}
const abComplete = (data.fileResults ?? []).filter((r) => r.pipelineComplete).length;
const provenanceOk = (data.provenance ?? []).filter((p) => p.survived).length;
const anyStructured = (data.fileResults ?? []).some((r) => (r.verify?.structuredCount ?? 0) > 0);

const lines = [
  "# PILOT_GAP_REPORT — Real-Document Historical Pilot (Phase 2B)",
  "",
  `**Generated:** ${data.generatedAt}`,
  "**Corpus:** [PILOT_CORPUS_MANIFEST.md](../pilot/PILOT_CORPUS_MANIFEST.md) (18 USABLE files, 13 packages)",
  "**Run artifact:** [pilot-run-results.json](pilot-run-results.json)",
  "**Command:** `node --env-file=apps/web/.env.local scripts/phase2-pilot-run.mjs`",
  "",
  "## Executive summary",
  "",
  "| Metric | Result |",
  "| --- | --- |",
  `| Files attempted | ${data.filesAttempted} |`,
  `| Intake succeeded | ${data.filesIngested} |`,
  `| Parse/extract succeeded | ${data.filesProcessed} |`,
  `| A/B pipeline-complete (VERIFY+promote) | **${abComplete}** |`,
  `| Document status VERIFIED | ${data.filesVerified} |`,
  `| Packages touched | ${data.packages} |`,
  `| Canonical pricing lines with page provenance | **${provenanceOk}** |`,
  `| Class C canonical promotions | **${data.classCPromoted ?? 0}** |`,
  `| Precedence conflict exercised | ${data.precedence?.ok ? "YES" : "NO"} |`,
  "",
  "**Verdict:** Representative A/B digital PDFs complete intake → structured extract → evidence-bound VERIFY → canonical promotion with page provenance. SRC-03 (25 MB) and SRC-19 (OCR) remain deferred. Phase 2 exit (~20–30 packages) is **not** met by count alone.",
  "",
  "### Remaining gaps",
  "",
  "| Gap | Severity | UX placement |",
  "| --- | --- | --- |",
  "| Full domain coverage (staffing matrix, cost-build rows, OT/holiday, evaluator scores as entities) | blocking for Phase 2 exit | Pricing; Requirements; Result |",
  "| 25 MB intake gate blocks Allen full board packet (SRC-03) | deferred | Data Ops → Intake |",
  "| OCR unwired — scanned PDFs fail routing (SRC-19) | deferred | Data Ops → Processing |",
  "| Corpus depth ~13 packages vs ~20–30 exit | deferred | Data Ops |",
  "| Standalone XLSX pricing workbook missing | deferred | Pricing |",
  "",
  "---",
  "",
  "## Domain coverage (corpus-wide)",
  "",
  "Legend: **present** = regex signal in PDF text; **captured** = structured staging/promotion for rates/requirements/ids where extractor fires; **MISSING** = broader domain still incomplete.",
  "",
];

for (const [group, items] of Object.entries(DOMAIN_GROUPS)) {
  if (group === "PROVENANCE") continue;
  lines.push(`### ${group}`);
  lines.push("");
  lines.push("| Subdomain | In source (any file) | Structured capture | UX placement |");
  lines.push("| --- | --- | --- | --- |");
  for (const [label, signal] of items) {
    const anyPresent = data.fileResults.some((r) => r.pdfAnalysis?.signals?.[signal]);
    const captured =
      group === "PRICING" && anyStructured
        ? "partial (hourly rates)"
        : group === "SOLICITATION" && anyStructured
          ? "partial (ids/requirements)"
          : "**MISSING**";
    lines.push(`| ${label} | ${anyPresent ? "yes" : "no"} | ${captured} | ${UX[group] ?? "Data Ops"} |`);
  }
  lines.push("");
}

lines.push("### PROVENANCE");
lines.push("");
lines.push("| Subdomain | Intake | Parse | Staging | Human verify | Canonical |");
lines.push("| --- | --- | --- | --- | --- | --- |");
lines.push(`| page | SHA-256 + version YES | page index YES | structured + page_text | evidence-bound VERIFY | **${provenanceOk > 0 ? "YES via source_fact_id" : "NO"}** |`);
lines.push("| section | — | — | partial | — | — |");
lines.push("| sheet/cell | — | XLSX unwired | **MISSING** | — | — |");
lines.push("| source excerpt | — | in fact + source_evidence | YES | YES | YES when promoted |");
lines.push("| version | document_versions YES | — | — | — | — |");
lines.push("| verification | verification_events YES | — | AI_EXTRACTED | HUMAN_VERIFIED (structured only) | promote_verified_fact |");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Per-package records");
lines.push("");

const PKG_META = {
  "PKG-01": { name: "Williamson County #202569", cls: "A", outcome: "Win", ux: "Contract Commercial Terms / Response" },
  "PKG-02": { name: "Allen ISD 2024–25", cls: "A/B", outcome: "Win", ux: "Contract Service Plan" },
  "PKG-03": { name: "Arlington TX RFP 22-0143", cls: "B", outcome: "Loss (VSA awarded)", ux: "Result / Requirements" },
  "PKG-04": { name: "TxDMV PO 0000016167", cls: "A", outcome: "Win (PO)", ux: "Contract Commercial Terms" },
  "PKG-05": { name: "Jefferson IFB 18-009 tab", cls: "B", outcome: "All bids rejected", ux: "Result / Pricing" },
  "PKG-06": { name: "Texas Lottery RQ22-0480DP", cls: "B", outcome: "Unknown", ux: "Requirements / Submission" },
  "PKG-07": { name: "Dallas 16-0219 tab", cls: "C test", outcome: "Competitor", ux: "Pricing / Intelligence" },
  "PKG-08": { name: "Dallas 2014-036 synopsis", cls: "C test", outcome: "Competitor", ux: "Pricing" },
  "PKG-09": { name: "Tarrant 2018-092 cost build", cls: "C test", outcome: "Competitor", ux: "Pricing" },
  "PKG-10": { name: "MHMR 25-003 tab", cls: "C test", outcome: "Competitor", ux: "Pricing / Result" },
  "PKG-11": { name: "Harris 26-0534 renewal", cls: "C test", outcome: "Competitor renewal", ux: "Contract Renewal" },
  "PKG-12": { name: "TFC 24-001-000 + Amend 4", cls: "C test", outcome: "Competitor", ux: "Contract Service Plan / Changes" },
  "PKG-13": { name: "Arlington VA 19-264-R", cls: "C test", outcome: "Competitor", ux: "Contract Changes" },
};

for (const [pkg, rows] of Object.entries(byPkg).sort()) {
  const meta = PKG_META[pkg] ?? { name: pkg, cls: "?", outcome: "?", ux: "?" };
  lines.push(`### ${pkg} — ${meta.name}`);
  lines.push("");
  lines.push(`Classification: **${meta.cls}** | Expected outcome: ${meta.outcome} | Primary UX: **${meta.ux}**`);
  lines.push("");
  for (const l of pkgNotes(pkg, rows)) lines.push(l);
  lines.push("");

  lines.push("#### Captured correctly");
  lines.push("");
  const ok = [];
  if (rows.some((r) => r.intake?.ok)) ok.push("SHA-256 checksum, evidence vault path, document_versions row");
  if (rows.some((r) => r.intake?.ok)) ok.push("document_batches package label association");
  if (rows.some((r) => r.process?.ok)) ok.push("pdf-native parse + page-level staging facts");
  if (rows.some((r) => r.verify?.verified > 0)) ok.push("Human verification events + document VERIFIED status (pilot batch)");
  if (ok.length) ok.forEach((o) => lines.push(`- ${o}`));
  else lines.push("- *(none beyond manifest local verification)*");
  lines.push("");

  lines.push("#### Gaps");
  lines.push("");
  lines.push("| Type | Detail | Severity | UX placement |");
  lines.push("| --- | --- | --- | --- |");
  const allFindings = rows.flatMap(fileFindings);
  const seen = new Set();
  for (const g of allFindings) {
    const key = g.type + g.detail;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`| ${g.type} | ${g.detail.replace(/\|/g, "\\|")} | ${g.severity} | ${g.ux} |`);
  }

  // Package-specific schema gaps from PDF signals
  const pkgSpecific = [];
  for (const row of rows) {
    if (!row.pdfAnalysis) continue;
    const s = row.pdfAnalysis.signals;
    if (row.dtype.includes("proposal") && s.pricing_hourly)
      pkgSpecific.push(["missing field", "L&P hourly rate ($31.45 unarmed, golf cart $500/mo) not structured", "blocking", "Pricing"]);
    if (row.dtype.includes("PO") && s.pricing_table)
      pkgSpecific.push(["missing field", "PO line items (72 HR × $33.25, Extended Hours $445.55) not structured", "blocking", "Contract Commercial Terms"]);
    if (row.dtype.includes("eval") && s.result_scores)
      pkgSpecific.push(["missing field", "L&P 70.48 vs VSA 90.46 scores; award $960,343 not in evaluator_scores", "blocking", "Result"]);
    if (row.dtype.includes("solicitation") && row.srcId === "SRC-06" && s.scope_sites)
      pkgSpecific.push(["missing field", "Building/post staffing matrix not in staffing_posts", "blocking", "Requirements"]);
    if (row.dtype === "bid tab" && s.pricing_hourly)
      pkgSpecific.push(["missing field", "Multi-vendor hourly rows (incl. L&P $18.75 Jefferson) not in pricing_lines", "blocking", "Pricing"]);
    if (row.dtype === "cost build" && s.pricing_cost_build)
      pkgSpecific.push(["missing field", "Wage/FICA/WC/OH/profit stack not in cost_build_components", "blocking", "Pricing"]);
    if (row.dtype === "renewal" && s.pricing_escalation)
      pkgSpecific.push(["missing field", "CPI-W renewal terms not in contract_renewal_options", "blocking", "Contract Renewal"]);
    if (row.dtype.includes("contract") && row.srcId === "SRC-15" && s.scope_classifications)
      pkgSpecific.push(["missing field", "Level II vs III site staffing not in service_plan_sites", "blocking", "Contract Service Plan"]);
    if (row.dtype.includes("amendment scan"))
      pkgSpecific.push(["parser failure", "OCR policy blocks parse; 0 chars extracted", "blocking", "Data Ops"]);
    if (row.srcId === "SRC-03")
      pkgSpecific.push(["intake_blocked", "32 MB board packet exceeds 25 MB gate; board probable-cost page unreachable", "blocking", "Data Ops"]);
    if (row.srcId === "SRC-09" && s.solicitation_forms)
      pkgSpecific.push(["missing field", "149-pp IFB forms/HUB/references/cost sheet not decomposed into requirements or pricing grid", "blocking", "Requirements"]);
  }
  for (const [type, detail, sev, ux] of pkgSpecific) {
    const key = type + detail;
    if (!seen.has(key)) {
      seen.add(key);
      lines.push(`| ${type} | ${detail} | ${sev} | ${ux} |`);
    }
  }

  lines.push("");
  lines.push("#### File detail");
  lines.push("");
  lines.push("| SRC | Type | Pages | Facts | Process | Status |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.srcId} | ${row.dtype} | ${row.pdfAnalysis?.pages ?? "—"} | ${row.process?.factCount ?? "—"} | ${row.process?.ok ? "ok" : row.process?.error ? "fail" : "skip"} | ${row.finalStatus ?? "—"} |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
}

lines.push("## Recommended schema additions (evidence-backed — do not migrate until reviewed)");
lines.push("");
lines.push("From this pilot only — all are **blocking** for Phase 2 exit:");
lines.push("");
lines.push("1. **`pricing_lines`** — row grain: vendor × site/post × rate type (std/OT/holiday) × unit × extended; source page + cell/table provenance.");
lines.push("2. **`requirements`** — solicitation requirement text, mandatory flag, section ref; links to response status.");
lines.push("3. **`evaluator_scores`** — respondent × criterion × points; ties to pursuit result.");
lines.push("4. **`pursuit_outcomes`** — award/loss/no-award/rejected bids; amount; rank; **no invented loss reason**.");
lines.push("5. **`staffing_posts`** — site/building × hours × classification × schedule.");
lines.push("6. **`cost_build_components`** — wage, burden, OH, profit rows (Tarrant-style).");
lines.push("7. **`contract_instruments`** — PO, amendment, renewal, option; NTE; POP dates.");
lines.push("8. **`federal_identifiers`** — TXMAS, GSA MAS (Williamson/TxDMV cite these).");
lines.push("9. **`proposal_sections`** — exec summary, pricing, attachments with source page.");
lines.push("10. **Structured extractor** — replace page_text-only heuristic with table/form/section-aware extraction + optional gateway.");
lines.push("");
lines.push("## Test evidence");
lines.push("");
lines.push("```text");
lines.push(`Pilot run: ${data.filesIngested}/${data.filesAttempted} ingested, ${data.filesProcessed} processed, ${data.filesVerified} VERIFIED`);
lines.push("npm run test:verify2a  — corpus local verification");
lines.push("npm run test:phase3-intake — intake infrastructure");
lines.push("npm run test:phase6-benchmark — processor pytest");
lines.push("```");
lines.push("");
lines.push("## Out of scope (this prompt)");
lines.push("");
lines.push("- New global navigation or Ask GPT / Reports / Pricing AI / Response AI expansion");
lines.push("- Migrations (findings only)");
lines.push("- Frisco L&P tab (UNAVAILABLE per manifest)");
lines.push("- Labeling competitor **C** corpus as L&P history");
lines.push("");

writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`Wrote ${OUT}`);
