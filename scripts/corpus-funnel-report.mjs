/**
 * Corpus Funnel Report — honest counts through the pipeline.
 *
 * Run: node --env-file=apps/web/.env.local scripts/corpus-funnel-report.mjs
 *      npm run report:corpus-funnel
 *
 * Stages are reported SEPARATELY and never collapsed into one "complete" number:
 *   1. DISCOVERED          — manifest source records
 *   2. ACQUIRED            — real bytes on disk under docs/pilot/acquired
 *   3. INGESTED            — documents + document_versions rows (vault-backed)
 *   4. PARSED              — extraction_runs holding a normalized_document
 *   5. EXTRACTED           — documents with >= 1 staging fact (separate from PARSED)
 *   6. BLOCKED             — FAILED docs, split by OCR_REQUIRED vs other error classes
 *   7. REVIEW_READY        — NEEDS_REVIEW docs
 *   8. HUMAN_VERIFIED      — VERIFIED docs vs HUMAN_VERIFIED facts (never merged)
 *   9. CANONICAL_PROMOTED  — canonical rows carrying source_fact evidence
 *  10. AB_COMPLETE         — A/B packages whose docs all cleared the trust path
 *
 * A harness stamp is not human verification. Automation must never write HUMAN_VERIFIED.
 * Writes a machine-readable artifact to docs/benchmarks/corpus-funnel.json.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT, "docs/pilot/PILOT_CORPUS_MANIFEST.md");
const ACQUIRED_DIR = join(ROOT, "docs/pilot/acquired");
const OUT_JSON = join(ROOT, "docs/benchmarks/corpus-funnel.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    "Missing Supabase env. Run with: node --env-file=apps/web/.env.local scripts/corpus-funnel-report.mjs",
  );
  process.exit(1);
}

function admin() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Exact row count. Uses the count property — never `data.length` with head:true. */
async function countRows(query) {
  const { count, error } = await query;
  if (error) return { count: null, error: error.message };
  return { count: count ?? 0, error: null };
}

function parseManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { discovered: null, usable: null, note: "PILOT_CORPUS_MANIFEST.md not found" };
  }
  const content = readFileSync(MANIFEST_PATH, "utf8");
  const srcIds = new Set((content.match(/SRC-\d+[a-z]?/gi) ?? []).map((id) => id.toUpperCase()));
  // Manifest states the counted total as a table row: "USABLE source files (counted) | **18**"
  const usableRow = content.match(/USABLE source files[^|]*\|\s*\*{0,2}(\d+)/i);
  const usableInline = content.match(/USABLE:\s*(\d+)/i);
  const usable = usableRow
    ? parseInt(usableRow[1], 10)
    : usableInline
      ? parseInt(usableInline[1], 10)
      : null;
  return {
    discovered: srcIds.size || null,
    usable,
    note: srcIds.size ? "distinct SRC ids in manifest" : "could not parse manifest",
  };
}

function countAcquired() {
  if (!existsSync(ACQUIRED_DIR)) {
    return { files: null, bytes: null, note: "docs/pilot/acquired not present" };
  }
  const entries = readdirSync(ACQUIRED_DIR, { withFileTypes: true }).filter(
    (entry) => entry.isFile() && entry.name.toLowerCase() !== "readme.md",
  );
  let bytes = 0;
  for (const entry of entries) {
    try {
      bytes += readFileSync(join(ACQUIRED_DIR, entry.name)).byteLength;
    } catch {
      // Unreadable file still counts as acquired-by-name; size stays unknown.
    }
  }
  return { files: entries.length, bytes, note: "real bytes under docs/pilot/acquired" };
}

function pct(part, whole) {
  if (!whole || part === null || part === undefined) return "";
  return ` (${Math.round((part / whole) * 100)}% of ingested)`;
}

async function main() {
  const adm = admin();
  const manifest = parseManifest();
  const acquired = countAcquired();
  const stages = {};

  console.log("=".repeat(68));
  console.log("CORPUS FUNNEL REPORT");
  console.log("=".repeat(68));
  console.log(`Generated: ${new Date().toISOString()}\n`);

  // ---- 1. DISCOVERED -------------------------------------------------------
  console.log("## 1. DISCOVERED (manifest source records)");
  console.log(`   ${manifest.discovered ?? "UNKNOWN"} distinct SRC ids (${manifest.note})`);
  console.log(`   ${manifest.usable ?? "UNKNOWN"} declared USABLE source files in manifest totals`);
  stages.discovered = { src_ids: manifest.discovered, manifest_usable: manifest.usable };

  // ---- 2. ACQUIRED ---------------------------------------------------------
  console.log("\n## 2. ACQUIRED (bytes on disk)");
  if (acquired.files === null) {
    console.log(`   NOT MEASURABLE — ${acquired.note}`);
  } else {
    const mb = (acquired.bytes / (1024 * 1024)).toFixed(1);
    console.log(`   ${acquired.files} files, ${mb} MB (${acquired.note})`);
  }
  stages.acquired = { files: acquired.files, bytes: acquired.bytes };

  // ---- 3. INGESTED ---------------------------------------------------------
  const docs = await countRows(adm.from("documents").select("id", { count: "exact", head: true }));
  const versions = await countRows(
    adm.from("document_versions").select("id", { count: "exact", head: true }),
  );
  console.log("\n## 3. INGESTED (vault-backed rows)");
  if (docs.error) {
    console.log(`   ERROR: ${docs.error}`);
  } else {
    console.log(`   ${docs.count} documents`);
    console.log(`   ${versions.count ?? "?"} document_versions (retained versions, not deduped away)`);
  }
  stages.ingested = { documents: docs.count, document_versions: versions.count };

  // ---- 4. PARSED -----------------------------------------------------------
  // extraction_runs carry the normalized_document. Filter server-side so the blob
  // is never downloaded, and map runs back to documents through document_versions.
  const parsedRuns = await countRows(
    adm
      .from("extraction_runs")
      .select("id", { count: "exact", head: true })
      .not("normalized_document", "is", null),
  );
  const { data: runRows, error: runError } = await adm
    .from("extraction_runs")
    .select("id, document_version_id, parser_id, error, finished_at")
    .not("normalized_document", "is", null);
  const { data: versionRows, error: versionMapError } = await adm
    .from("document_versions")
    .select("id, document_id");

  let parsedDocIds = new Set();
  const parserMix = {};
  if (!runError && !versionMapError) {
    const versionToDoc = new Map((versionRows ?? []).map((row) => [row.id, row.document_id]));
    for (const run of runRows ?? []) {
      const docId = versionToDoc.get(run.document_version_id);
      if (docId) parsedDocIds.add(docId);
      parserMix[run.parser_id ?? "unknown"] = (parserMix[run.parser_id ?? "unknown"] ?? 0) + 1;
    }
  }
  console.log("\n## 4. PARSED (normalized_document present)");
  if (runError || versionMapError) {
    console.log(`   ERROR: ${runError?.message ?? versionMapError?.message}`);
  } else {
    console.log(`   ${parsedRuns.count ?? 0} extraction_runs with a normalized document`);
    console.log(`   ${parsedDocIds.size} distinct documents parsed${pct(parsedDocIds.size, docs.count)}`);
    const mix = Object.entries(parserMix)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `${id}=${n}`)
      .join(", ");
    console.log(`   parser mix: ${mix || "none"}`);
  }
  stages.parsed = {
    runs_with_normalized_document: parsedRuns.count,
    distinct_documents: parsedDocIds.size,
    parser_mix: parserMix,
  };

  // ---- 5. EXTRACTED (separate from PARSED) --------------------------------
  const totalFacts = await countRows(
    adm.from("extracted_facts").select("id", { count: "exact", head: true }),
  );
  const { data: docRows, error: docRowsError } = await adm
    .from("documents")
    .select("id, processing_status, lifecycle_error, procurement_package_id");

  const extractedDocIds = new Set();
  if (!docRowsError && (docRows ?? []).length <= 500) {
    // documents is a small table in this corpus; an exact per-document probe beats
    // guessing at embedded-join count semantics.
    for (const doc of docRows ?? []) {
      const { count } = await adm
        .from("extracted_facts")
        .select("id", { count: "exact", head: true })
        .eq("document_id", doc.id);
      if ((count ?? 0) > 0) extractedDocIds.add(doc.id);
    }
  }
  const statusCounts = {};
  for (const doc of docRows ?? []) {
    statusCounts[doc.processing_status] = (statusCounts[doc.processing_status] ?? 0) + 1;
  }
  console.log("\n## 5. EXTRACTED (staging facts written — distinct from PARSED)");
  if (docRowsError) {
    console.log(`   ERROR: ${docRowsError.message}`);
  } else {
    console.log(
      `   ${extractedDocIds.size} documents with >= 1 extracted_fact${pct(extractedDocIds.size, docs.count)}`,
    );
    console.log(`   ${totalFacts.count ?? "?"} staging facts total (all AI_EXTRACTED unless a human moved them)`);
    const parsedNotExtracted = [...parsedDocIds].filter((id) => !extractedDocIds.has(id)).length;
    console.log(`   ${parsedNotExtracted} documents parsed but with zero facts (extractor gap)`);
  }
  stages.extracted = {
    distinct_documents: extractedDocIds.size,
    total_facts: totalFacts.count,
    parsed_but_zero_facts: [...parsedDocIds].filter((id) => !extractedDocIds.has(id)).length,
  };

  // ---- 6. BLOCKED ----------------------------------------------------------
  const failedDocs = (docRows ?? []).filter((doc) => doc.processing_status === "FAILED");
  const ocrRequired = failedDocs.filter((doc) =>
    (doc.lifecycle_error ?? "").startsWith("OCR_REQUIRED:"),
  );
  const otherFailed = failedDocs.filter(
    (doc) => !(doc.lifecycle_error ?? "").startsWith("OCR_REQUIRED:"),
  );
  console.log("\n## 6. BLOCKED (FAILED, by error class)");
  console.log(`   ${failedDocs.length} documents FAILED`);
  console.log(`   ${ocrRequired.length} OCR_REQUIRED (scanned/image PDF needs MISTRAL_API_KEY)`);
  console.log(`   ${otherFailed.length} other failure classes`);
  for (const doc of otherFailed.slice(0, 5)) {
    console.log(`     - ${(doc.lifecycle_error ?? "no lifecycle_error recorded").slice(0, 110)}`);
  }
  stages.blocked = {
    failed: failedDocs.length,
    ocr_required: ocrRequired.length,
    other: otherFailed.length,
  };

  // ---- 7. REVIEW_READY -----------------------------------------------------
  const needsReview = statusCounts.NEEDS_REVIEW ?? 0;
  console.log("\n## 7. REVIEW_READY (NEEDS_REVIEW — awaiting human eyeballs)");
  console.log(`   ${needsReview} documents${pct(needsReview, docs.count)}`);
  console.log(`   status mix: ${Object.entries(statusCounts).map(([s, n]) => `${s}=${n}`).join(", ") || "none"}`);
  stages.review_ready = { needs_review: needsReview, status_mix: statusCounts };

  // ---- 8. HUMAN_VERIFIED (docs vs facts — NEVER collapsed) ----------------
  const verifiedDocs = statusCounts.VERIFIED ?? 0;
  const humanVerifiedFacts = await countRows(
    adm
      .from("extracted_facts")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "HUMAN_VERIFIED"),
  );
  const aiExtractedFacts = await countRows(
    adm
      .from("extracted_facts")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "AI_EXTRACTED"),
  );
  // A HUMAN_VERIFIED fact satisfies the DB actor constraint by carrying the signed-in
  // operator's user id, so the actor column cannot distinguish a script from a reviewer.
  // The verification_events note can: these markers are written by our own harnesses.
  const SCRIPT_NOTE_MARKERS = [
    /re-extract map fill/i, // scripts/reextract-mapped-docs.mjs
    /structured value accepted/i, // scripts/phase2-pilot-run.mjs
    /^source page \d+$/i, // scripts/phase2-pilot-run.mjs
  ];
  const { data: hvEvents, error: hvEventsError } = await adm
    .from("verification_events")
    .select("extracted_fact_id, note")
    .eq("to_status", "HUMAN_VERIFIED");
  const { data: hvFactRows, error: hvFactRowsError } = await adm
    .from("extracted_facts")
    .select("id")
    .eq("verification_status", "HUMAN_VERIFIED");
  let scriptStamped = null;
  let workbenchAttributed = null;
  let unattributed = null;
  if (!hvEventsError && !hvFactRowsError) {
    // Only classify facts that are HUMAN_VERIFIED right now. Events can outlive a fact
    // that was later re-extracted, so counting raw event rows overstates the total.
    const currentlyVerified = new Set((hvFactRows ?? []).map((row) => row.id));
    const scriptFacts = new Set();
    const humanFacts = new Set();
    for (const event of hvEvents ?? []) {
      if (!event.extracted_fact_id || !currentlyVerified.has(event.extracted_fact_id)) continue;
      const note = event.note ?? "";
      if (SCRIPT_NOTE_MARKERS.some((marker) => marker.test(note))) {
        scriptFacts.add(event.extracted_fact_id);
      } else {
        humanFacts.add(event.extracted_fact_id);
      }
    }
    for (const id of humanFacts) scriptFacts.delete(id);
    scriptStamped = scriptFacts.size;
    workbenchAttributed = humanFacts.size;
    unattributed = currentlyVerified.size - scriptFacts.size - humanFacts.size;
  }

  console.log("\n## 8. HUMAN_VERIFIED (documents and facts are DIFFERENT measures)");
  console.log(`   ${verifiedDocs} documents with processing_status VERIFIED`);
  console.log(`   ${humanVerifiedFacts.count ?? "?"} facts with verification_status HUMAN_VERIFIED`);
  console.log(`   ${aiExtractedFacts.count ?? "?"} facts still AI_EXTRACTED (not verified, not canonical)`);
  console.log("   attribution of HUMAN_VERIFIED facts (script marker in verification_events.note):");
  if (hvEventsError) {
    console.log(`     ERROR: ${hvEventsError.message}`);
  } else {
    console.log(`     ${scriptStamped} script-stamped by our own harnesses — NOT human eyeballs on the source`);
    console.log(`     ${workbenchAttributed} attributable to workbench review`);
    console.log(`     ${unattributed} with no verification_event to attribute`);
    if (scriptStamped > 0) {
      console.log("     WARNING: script-stamped facts must not be counted as human verification.");
    }
  }
  stages.human_verified = {
    verified_documents: verifiedDocs,
    human_verified_facts: humanVerifiedFacts.count,
    ai_extracted_facts: aiExtractedFacts.count,
    script_stamped_facts: scriptStamped,
    workbench_attributed_facts: workbenchAttributed,
    unattributed_facts: unattributed,
  };

  // ---- 9. CANONICAL_PROMOTED ----------------------------------------------
  const sourcedPricingLines = await countRows(
    adm
      .from("pricing_lines")
      .select("id", { count: "exact", head: true })
      .or(
        "requested_source_fact_id.not.is.null,proposed_source_fact_id.not.is.null,awarded_source_fact_id.not.is.null,current_source_fact_id.not.is.null",
      ),
  );
  const allPricingLines = await countRows(
    adm.from("pricing_lines").select("id", { count: "exact", head: true }),
  );
  const totalPackages = await countRows(
    adm.from("procurement_packages").select("id", { count: "exact", head: true }),
  );
  console.log("\n## 9. CANONICAL_PROMOTED (evidence-bound canonical rows)");
  console.log(
    `   ${sourcedPricingLines.count ?? "?"} of ${allPricingLines.count ?? "?"} pricing_lines carry a source_fact_id`,
  );
  console.log(`   ${totalPackages.count ?? "?"} procurement_packages total`);
  stages.canonical_promoted = {
    pricing_lines_with_source_fact: sourcedPricingLines.count,
    pricing_lines_total: allPricingLines.count,
    procurement_packages: totalPackages.count,
  };

  // ---- 10. AB_COMPLETE ----------------------------------------------------
  const { data: abPackages, error: abError } = await adm
    .from("procurement_packages")
    .select("id, package_key, corpus_class")
    .in("corpus_class", ["A_LP_ORIGINATED", "B_LP_TIED"]);

  console.log("\n## 10. A/B COMPLETE (L&P-originated + L&P-tied only)");
  let abFullyVerified = [];
  let abDocsVerified = 0;
  if (abError) {
    console.log(`   ERROR: ${abError.message}`);
  } else {
    const abIds = new Set((abPackages ?? []).map((pkg) => pkg.id));
    const docsByPackage = new Map();
    for (const doc of docRows ?? []) {
      if (doc.procurement_package_id && abIds.has(doc.procurement_package_id)) {
        const list = docsByPackage.get(doc.procurement_package_id) ?? [];
        list.push(doc);
        docsByPackage.set(doc.procurement_package_id, list);
      }
    }
    for (const pkg of abPackages ?? []) {
      const pkgDocs = docsByPackage.get(pkg.id) ?? [];
      abDocsVerified += pkgDocs.filter((doc) => doc.processing_status === "VERIFIED").length;
      if (pkgDocs.length > 0 && pkgDocs.every((doc) => doc.processing_status === "VERIFIED")) {
        abFullyVerified.push(pkg.package_key);
      }
    }
    console.log(`   ${abPackages?.length ?? 0} A/B packages in database`);
    console.log(`   ${abDocsVerified} A/B documents VERIFIED`);
    console.log(
      `   ${abFullyVerified.length} A/B packages with every document VERIFIED: ${abFullyVerified.join(", ") || "none"}`,
    );
  }
  stages.ab_complete = {
    ab_packages: abPackages?.length ?? null,
    ab_documents_verified: abDocsVerified,
    ab_packages_fully_verified: abFullyVerified.length,
    ab_package_keys_fully_verified: abFullyVerified,
  };

  // ---- Summary ------------------------------------------------------------
  const rows = [
    ["1  DISCOVERED (manifest SRC ids)", manifest.discovered],
    ["2  ACQUIRED (files on disk)", acquired.files],
    ["3  INGESTED (documents)", docs.count],
    ["3b INGESTED (versions)", versions.count],
    ["4  PARSED (distinct docs)", parsedDocIds.size],
    ["5  EXTRACTED (docs with facts)", extractedDocIds.size],
    ["5b EXTRACTED (facts total)", totalFacts.count],
    ["6  BLOCKED (FAILED)", failedDocs.length],
    ["6b BLOCKED (OCR_REQUIRED)", ocrRequired.length],
    ["7  REVIEW_READY (NEEDS_REVIEW)", needsReview],
    ["8  HUMAN_VERIFIED (documents)", verifiedDocs],
    ["8b HUMAN_VERIFIED (facts)", humanVerifiedFacts.count],
    ["8c  of which script-stamped", scriptStamped],
    ["8d  of which workbench-reviewed", workbenchAttributed],
    ["9  CANONICAL (sourced pricing_lines)", sourcedPricingLines.count],
    ["10 A/B packages fully VERIFIED", abFullyVerified.length],
  ];
  console.log("\n## Summary — stages are separate measures, not one funnel number");
  console.log("-".repeat(68));
  console.log(`| ${"Stage".padEnd(40)} | ${"Count".padStart(8)} |`);
  console.log(`| ${"-".repeat(40)} | ${"-".repeat(8)} |`);
  for (const [label, value] of rows) {
    console.log(`| ${label.padEnd(40)} | ${String(value ?? "?").padStart(8)} |`);
  }
  console.log("-".repeat(68));

  console.log("\nHONESTY NOTES");
  console.log("  - PARSED != EXTRACTED != REVIEW_READY != HUMAN_VERIFIED != CANONICAL_PROMOTED.");
  console.log("  - Harness/pipeline stamps are AI_EXTRACTED. Automation never writes HUMAN_VERIFIED.");
  console.log("  - VERIFIED documents and HUMAN_VERIFIED facts are reported separately on purpose.");
  console.log("  - Stage 8 attribution: script-stamped facts are automation output, not human verification.");
  console.log("  - Phase 2 exit (~20-30 A/B packages fully through the trust path) is judged on stage 10,");
  console.log("    and only counts where stage 8 attribution is workbench review rather than a script stamp.");

  const artifact = {
    generated_at: new Date().toISOString(),
    stage_order: [
      "discovered",
      "acquired",
      "ingested",
      "parsed",
      "extracted",
      "blocked",
      "review_ready",
      "human_verified",
      "canonical_promoted",
      "ab_complete",
    ],
    stages,
  };
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`\nArtifact: ${OUT_JSON}`);
}

await main();
