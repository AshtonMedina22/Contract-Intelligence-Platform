/**
 * Corpus Funnel Report — honest counts through the pipeline.
 *
 * Run: node --env-file=apps/web/.env.local scripts/corpus-funnel-report.mjs
 *
 * Reports:
 * - discovered (from manifest if available)
 * - downloaded (optional/skip if no local)
 * - ingested (docs)
 * - extracted (docs with facts or EXTRACTED statuses)
 * - review-ready (NEEDS_REVIEW)
 * - human-verified (docs VERIFIED + facts HUMAN_VERIFIED — SEPARATE)
 * - canonical-promoted (pricing_lines/packages with source_fact evidence)
 * - A/B acceptance-complete (if measurable)
 *
 * Never collapse into one "complete" number.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT, "docs/pilot/PILOT_CORPUS_MANIFEST.md");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error("Missing Supabase env. Run with: node --env-file=apps/web/.env.local scripts/corpus-funnel-report.mjs");
  process.exit(1);
}

function admin() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function parseManifestCounts() {
  if (!existsSync(MANIFEST_PATH)) {
    return { discovered: null, note: "PILOT_CORPUS_MANIFEST.md not found" };
  }
  const content = readFileSync(MANIFEST_PATH, "utf8");
  const usableMatch = content.match(/USABLE:\s*(\d+)/i);
  const totalMatch = content.match(/Total\s+sources?:\s*(\d+)/i) || content.match(/SRC-(\d+)/g);
  let discovered = null;
  if (usableMatch) {
    discovered = parseInt(usableMatch[1], 10);
  } else if (totalMatch && Array.isArray(totalMatch)) {
    discovered = totalMatch.length;
  }
  return { discovered, note: discovered ? `from manifest` : "could not parse manifest" };
}

async function main() {
  const adm = admin();
  const manifest = parseManifestCounts();

  console.log("=".repeat(60));
  console.log("CORPUS FUNNEL REPORT");
  console.log("=".repeat(60));
  console.log(`Generated: ${new Date().toISOString()}\n`);

  console.log("## 1. Discovered (from manifest)");
  if (manifest.discovered !== null) {
    console.log(`   ${manifest.discovered} sources (${manifest.note})`);
  } else {
    console.log(`   UNKNOWN (${manifest.note})`);
  }

  console.log("\n## 2. Downloaded");
  console.log(`   SKIP — local file check not implemented in this report`);

  const { count: totalDocs, error: docsError } = await adm
    .from("documents")
    .select("id", { count: "exact", head: true });
  console.log("\n## 3. Ingested (documents in database)");
  if (docsError) {
    console.log(`   ERROR: ${docsError.message}`);
  } else {
    console.log(`   ${totalDocs ?? 0} documents`);
  }

  const { data: extractedData, error: extractedError } = await adm
    .from("documents")
    .select("id", { count: "exact", head: true })
    .or("processing_status.eq.EXTRACTING,processing_status.eq.VALIDATING,processing_status.eq.NEEDS_REVIEW,processing_status.eq.VERIFIED");

  const { count: docsWithFacts, error: factsJoinError } = await adm
    .from("documents")
    .select("id, extracted_facts!inner(id)", { count: "exact", head: true });

  console.log("\n## 4. Extracted (docs with facts OR extracted statuses)");
  if (extractedError) {
    console.log(`   ERROR: ${extractedError.message}`);
  } else {
    const extractedCount = extractedData?.length ?? 0;
    console.log(`   ${extractedCount} docs with EXTRACTING/VALIDATING/NEEDS_REVIEW/VERIFIED status`);
    console.log(`   ${docsWithFacts ?? "?"} docs with at least one fact`);
  }

  const { count: needsReviewDocs, error: nrError } = await adm
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("processing_status", "NEEDS_REVIEW");
  console.log("\n## 5. Review-ready (NEEDS_REVIEW)");
  if (nrError) {
    console.log(`   ERROR: ${nrError.message}`);
  } else {
    console.log(`   ${needsReviewDocs ?? 0} documents`);
  }

  const { count: verifiedDocs, error: vdError } = await adm
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("processing_status", "VERIFIED");

  const { count: humanVerifiedFacts, error: hvfError } = await adm
    .from("extracted_facts")
    .select("id", { count: "exact", head: true })
    .eq("verification_status", "HUMAN_VERIFIED");

  console.log("\n## 6. Human-verified (REPORT BOTH SEPARATELY)");
  if (vdError || hvfError) {
    console.log(`   ERROR: ${vdError?.message ?? hvfError?.message}`);
  } else {
    console.log(`   ${verifiedDocs ?? 0} documents with status VERIFIED`);
    console.log(`   ${humanVerifiedFacts ?? 0} facts with status HUMAN_VERIFIED`);
  }

  const { count: sourcedPricingLines, error: splError } = await adm
    .from("pricing_lines")
    .select("id", { count: "exact", head: true })
    .or(
      "requested_source_fact_id.not.is.null,proposed_source_fact_id.not.is.null,awarded_source_fact_id.not.is.null,current_source_fact_id.not.is.null"
    );

  const { count: totalPackages, error: pkgError } = await adm
    .from("procurement_packages")
    .select("id", { count: "exact", head: true });

  console.log("\n## 7. Canonical-promoted (source_fact evidence)");
  if (splError || pkgError) {
    console.log(`   ERROR: ${splError?.message ?? pkgError?.message}`);
  } else {
    console.log(`   ${sourcedPricingLines ?? 0} pricing_lines with source_fact_id`);
    console.log(`   ${totalPackages ?? 0} procurement_packages total`);
  }

  const { data: abPackages, error: abError } = await adm
    .from("procurement_packages")
    .select("id, package_key, corpus_class")
    .in("corpus_class", ["A_LP_ORIGINATED", "B_LP_TIED"]);

  console.log("\n## 8. A/B acceptance-complete (if measurable)");
  if (abError) {
    console.log(`   ERROR: ${abError.message}`);
  } else {
    const abCount = abPackages?.length ?? 0;
    console.log(`   ${abCount} A/B packages in database`);

    if (abPackages && abPackages.length > 0) {
      const pkgIds = abPackages.map((p) => p.id);
      const { count: abDocsVerified } = await adm
        .from("documents")
        .select("id", { count: "exact", head: true })
        .in("procurement_package_id", pkgIds)
        .eq("processing_status", "VERIFIED");

      console.log(`   ${abDocsVerified ?? 0} A/B docs VERIFIED`);

      const verifiedAbPackages = [];
      for (const pkg of abPackages) {
        const { data: pkgDocs } = await adm
          .from("documents")
          .select("id, processing_status")
          .eq("procurement_package_id", pkg.id);
        const allVerified = (pkgDocs ?? []).length > 0 && (pkgDocs ?? []).every((d) => d.processing_status === "VERIFIED");
        if (allVerified) {
          verifiedAbPackages.push(pkg.package_key);
        }
      }
      console.log(`   ${verifiedAbPackages.length} A/B packages fully VERIFIED: ${verifiedAbPackages.join(", ") || "none"}`);
    }
  }

  console.log("\n## Summary");
  console.log("-".repeat(60));
  console.log("| Stage                        | Count          |");
  console.log("| ---------------------------- | -------------- |");
  console.log(`| Discovered (manifest)        | ${manifest.discovered ?? "UNKNOWN"}         |`);
  console.log(`| Ingested (docs)              | ${totalDocs ?? "?"}              |`);
  console.log(`| NEEDS_REVIEW docs            | ${needsReviewDocs ?? "?"}              |`);
  console.log(`| VERIFIED docs                | ${verifiedDocs ?? "?"}              |`);
  console.log(`| HUMAN_VERIFIED facts         | ${humanVerifiedFacts ?? "?"}              |`);
  console.log(`| Sourced pricing_lines        | ${sourcedPricingLines ?? "?"}              |`);
  console.log(`| A/B packages                 | ${abPackages?.length ?? "?"}              |`);
  console.log("-".repeat(60));

  console.log("\nNOTE: harness stamps (AI extraction pipeline) ≠ HUMAN_VERIFIED");
  console.log("      Actual human verification requires workbench eyeballs on source PDF.");
  console.log("");
}

await main();
