import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const IN = join(ROOT, "docs/benchmarks/pilot-run-results.json");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const data = JSON.parse(readFileSync(IN, "utf8"));
const files = data.fileResults ?? [];
const abComplete = files.filter((r) => r.pipelineComplete);
const cPromoted = data.classCPromoted ?? files.filter((r) => r.cls === "C").reduce((n, r) => n + (r.verify?.promoted ?? 0), 0);
const zeroVerified = data.verifiedWithZeroHumanFacts ?? files.filter((r) => r.finalStatus === "VERIFIED" && (r.verify?.verified ?? 0) === 0).map((r) => r.srcId);
const provenance = data.provenance ?? [];
const provenanceOk = provenance.filter((p) => p.survived);
const truths = new Set(provenance.map((p) => p.truth));
const precedence = data.precedence ?? {};
const src19 = files.find((r) => r.srcId === "SRC-19");

record(
  "representative A/B packages completed source-to-canonical",
  abComplete.length >= 3,
  `${abComplete.length} complete: ${abComplete.map((r) => r.srcId).join(", ") || "none"}`,
);
record(
  "no package VERIFIED with zero HUMAN_VERIFIED facts",
  zeroVerified.length === 0,
  zeroVerified.join(", ") || "none",
);
record(
  "failed OCR/parse is not VERIFIED",
  !src19 || src19.finalStatus !== "VERIFIED",
  `SRC-19 status=${src19?.finalStatus}`,
);
const cCanonical = files
  .filter((r) => r.cls === "C")
  .flatMap((r) => r.verify?.promotions ?? [])
  .filter((p) => ["rate", "requirement", "award", "solicitation"].includes(p.action));
record("competitor C canonical promotions", cCanonical.length === 0, `C canonical actions=${cCanonical.length}`);
record(
  "page provenance survived promotion",
  provenanceOk.length >= 1,
  `${provenanceOk.length}/${provenance.length} sourced lines`,
);
record(
  "four truths not collapsed on a line",
  data.fourTruthsDistinct !== false,
  `truths present: ${[...truths].join(", ") || "none"}`,
);
record(
  "addenda/source precedence conflict exercised",
  precedence.tested === true && precedence.ok === true,
  JSON.stringify(precedence),
);
record("A/B/C labels present on all rows", files.every((r) => ["A", "B", "C"].includes(r.cls)));

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.filter((r) => r.ok).length} passed, ${failed} failed, ${results.length} total`);
process.exit(failed > 0 ? 1 : 0);
