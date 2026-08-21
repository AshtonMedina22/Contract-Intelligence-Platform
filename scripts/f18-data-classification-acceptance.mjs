#!/usr/bin/env node
/**
 * F18 acceptance — classification is independent from verification and corpus class.
 * Adversarial fixtures prove default demo exclusion and authority boundaries.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");

async function bundle(entryRel, name) {
  const outfile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), `lp-f18-${name}-`)),
    "out.mjs",
  );
  await esbuild.build({
    entryPoints: [path.join(webRoot, entryRel)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "warning",
    alias: { "@": webRoot },
    external: ["@supabase/supabase-js"],
  });
  return import(pathToFileURL(outfile).href);
}

const eligibility = await bundle("lib/classification/eligibility.ts", "eligibility");
const guard = await bundle(
  "lib/classification/assert-ai-cannot-elevate.ts",
  "ai-guard",
);
const sourceFilter = await bundle("lib/classification/source-filter.ts", "source-filter");
const compute = await bundle("lib/analytics/compute.ts", "compute");

const migration = await fs.readFile(
  path.join(root, "supabase/migrations/20260821350000_f18_data_classification.sql"),
  "utf8",
);
const analyticsExecute = await fs.readFile(
  path.join(webRoot, "lib/analytics/execute.ts"),
  "utf8",
);
const reports = await fs.readFile(path.join(webRoot, "lib/reports/generate.ts"), "utf8");
const retrieval = await fs.readFile(path.join(webRoot, "lib/retrieval/search.ts"), "utf8");
const ingest = await fs.readFile(path.join(webRoot, "lib/intake/ingest.ts"), "utf8");
const corpusTypes = await fs.readFile(path.join(webRoot, "lib/corpus/types.ts"), "utf8");
const classificationTypes = await fs.readFile(
  path.join(webRoot, "lib/classification/types.ts"),
  "utf8",
);
const eligibilitySource = await fs.readFile(
  path.join(webRoot, "lib/classification/eligibility.ts"),
  "utf8",
);

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

const {
  PURPOSE_CLASSIFICATION_ELIGIBILITY,
  isClassificationEligible,
  canRepresentLpInternalHistory,
} = eligibility;
const { assertAiCannotElevate } = guard;
const { filterRowsBySourceClassification } = sourceFilter;
const { computeWinRateDecided, computeMedianAwardedRate } = compute;

check("canonical enum values only", () => {
  for (const value of [
    "verified_public",
    "verified_internal",
    "internal_unverified",
    "illustrative_demo",
  ]) {
    assert.match(migration, new RegExp(`'${value}'`));
    assert.match(classificationTypes, new RegExp(`"${value}"`));
  }
});

check("classification is independent from verification and corpus_class", () => {
  assert.match(migration, /independent from verification_status/i);
  assert.match(migration, /procurement_packages\.corpus_class/i);
  assert.match(corpusTypes, /A_LP_ORIGINATED.*B_LP_TIED.*C_COMPETITOR_TEST/s);
  assert.doesNotMatch(classificationTypes, /A_LP_ORIGINATED|B_LP_TIED|C_COMPETITOR_TEST/);
});

check("demo cannot change win rate", () => {
  const facts = new Map([
    ["internal-win", "verified_internal"],
    ["internal-loss", "verified_internal"],
    ["demo-win", "illustrative_demo"],
  ]);
  const rows = [
    ...Array.from({ length: 12 }, (_, i) => ({
      outcome: "WON",
      source_fact_id: `internal-win`,
      id: `w${i}`,
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      outcome: "LOST",
      source_fact_id: `internal-loss`,
      id: `l${i}`,
    })),
    ...Array.from({ length: 50 }, (_, i) => ({
      outcome: "WON",
      source_fact_id: "demo-win",
      id: `d${i}`,
    })),
  ];
  const eligible = filterRowsBySourceClassification(rows, {
    fields: ["source_fact_id"],
    classifications: facts,
    purpose: "REPORT_GENERATION",
  });
  const result = computeWinRateDecided(eligible);
  assert.equal(result.rows[0].win_rate_percent, 60);
  assert.equal(result.rows[0].decided, 20);
  assert.match(analyticsExecute, /illustrative_demo/);
});

check("demo pricing is not comparable", () => {
  const rows = [
    { awarded_rate: 30, unit: "hourly", awarded_source_fact_id: "trusted-a" },
    { awarded_rate: 40, unit: "hourly", awarded_source_fact_id: "trusted-b" },
    { awarded_rate: 1, unit: "hourly", awarded_source_fact_id: "demo" },
    {
      awarded_rate: 2,
      unit: "hourly",
      awarded_source_fact_id: "demo",
      proposed_source_fact_id: "trusted-a",
    },
  ];
  const eligible = filterRowsBySourceClassification(rows, {
    fields: ["awarded_source_fact_id", "proposed_source_fact_id"],
    classifications: new Map([
      ["trusted-a", "verified_public"],
      ["trusted-b", "verified_internal"],
      ["demo", "illustrative_demo"],
    ]),
    purpose: "PRICING_ANALYSIS",
  });
  const result = computeMedianAwardedRate(eligible);
  assert.equal(result.rows[0].median_awarded_rate, 35);
});

check("verified public competitor is not L&P internal history", () => {
  assert.equal(isClassificationEligible("verified_public", "COMPETITOR_ANALYSIS"), true);
  assert.equal(canRepresentLpInternalHistory("verified_public"), false);
  assert.equal(canRepresentLpInternalHistory("verified_internal"), true);
});

check("internal_unverified is excluded from trusted reports", () => {
  assert.equal(isClassificationEligible("internal_unverified", "REPORT_GENERATION"), false);
  assert.match(reports, /eligibilityLimitation/);
  assert.match(reports, /loadSourceFactClassifications/);
});

check("verified_public is eligible for public intelligence", () => {
  for (const purpose of ["GENERAL_QA", "COMPETITOR_ANALYSIS", "PRICING_ANALYSIS"]) {
    assert.equal(isClassificationEligible("verified_public", purpose), true);
  }
});

check("verified_internal is eligible for drafting", () => {
  assert.deepEqual(PURPOSE_CLASSIFICATION_ELIGIBILITY.PROPOSAL_DRAFTING, [
    "verified_internal",
  ]);
  assert.equal(isClassificationEligible("verified_public", "PROPOSAL_DRAFTING"), false);
});

check("illustrative_demo requires explicit DEMO_TEST purpose", () => {
  for (const [purpose, allowed] of Object.entries(PURPOSE_CLASSIFICATION_ELIGIBILITY)) {
    assert.equal(
      allowed.includes("illustrative_demo"),
      purpose === "DEMO_TEST",
      purpose,
    );
  }
});

check("classification change requires authorized RPC", () => {
  assert.match(migration, /set_document_data_classification/);
  assert.match(migration, /verify\.promote or admin required/);
  assert.match(migration, /Data classification changes require an authorized action/);
  assert.match(migration, /SET_DATA_CLASSIFICATION/);
});

check("AI cannot elevate or reclassify", () => {
  assert.throws(
    () => assertAiCannotElevate("internal_unverified", "verified_internal", "AI"),
    /AI cannot change data classification/,
  );
  assert.throws(
    () => assertAiCannotElevate("illustrative_demo", "verified_public", "AI"),
    /AI cannot change data classification/,
  );
  assert.doesNotThrow(() =>
    assertAiCannotElevate("verified_public", "verified_public", "AI"),
  );
  assert.match(migration, /Verified data classification requires set_document_data_classification/);
});

check("facts and chunks inherit; chunk promotion never upgrades", () => {
  assert.match(migration, /extracted_facts_inherit_classification/);
  assert.match(migration, /document_chunks_inherit_classification/);
  assert.match(migration, /data_classification = excluded\.data_classification/);
  assert.match(migration, /copies.*without upgrading/i);
});

check("retrieval filters by purpose classification", () => {
  assert.match(migration, /classification_allowed_for_purpose/);
  assert.match(migration, /public\.classification_allowed_for_purpose\(c\.data_classification/);
  assert.match(retrieval, /data_classification/);
});

check("ingest defaults unverified and supports explicit demo", () => {
  assert.match(ingest, /dataClassification \?\? "internal_unverified"/);
  assert.match(ingest, /register_ingested_document_classified/);
  assert.match(migration, /Ingest may only assign internal_unverified or illustrative_demo/);
});

check("reports disclose eligible classifications", () => {
  assert.match(reports, /eligibilityLimitation/);
  assert.match(eligibilitySource, /Eligible data classifications/);
  assert.match(eligibilitySource, /illustrative_demo is excluded/);
});

await checkAsync("live DB enforces authorized classification transition", async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.LP_OPERATOR_EMAIL;
  const password = process.env.LP_OPERATOR_PASSWORD;
  assert.ok(url && publishable && secret && email && password, "operator DB env unavailable");

  const userClient = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await userClient.auth.signInWithPassword({ email, password });
  assert.ifError(signIn.error);
  const membership = await userClient
    .from("memberships")
    .select("organization_id")
    .limit(1)
    .single();
  assert.ifError(membership.error);

  const marker = `F18 acceptance ${Date.now()}`;
  let documentId = null;
  try {
    const created = await userClient
      .from("documents")
      .insert({
        organization_id: membership.data.organization_id,
        original_filename: `${marker}.pdf`,
        mime_type: "application/pdf",
        document_type: "test",
      })
      .select("id, data_classification")
      .single();
    assert.ifError(created.error);
    documentId = created.data.id;
    assert.equal(created.data.data_classification, "internal_unverified");

    const direct = await userClient
      .from("documents")
      .update({ data_classification: "verified_internal" })
      .eq("id", documentId);
    assert.ok(direct.error, "direct classification update unexpectedly succeeded");
    assert.match(direct.error.message, /authorized action/i);

    const missingReason = await userClient.rpc("set_document_data_classification", {
      p_document_id: documentId,
      p_data_classification: "verified_internal",
      p_reason: " ",
    });
    assert.ok(missingReason.error, "blank reason unexpectedly accepted");

    const authorized = await userClient.rpc("set_document_data_classification", {
      p_document_id: documentId,
      p_data_classification: "verified_internal",
      p_reason: marker,
    });
    assert.ifError(authorized.error);
    assert.equal(authorized.data?.ok, true);

    const stored = await userClient
      .from("documents")
      .select("data_classification")
      .eq("id", documentId)
      .single();
    assert.ifError(stored.error);
    assert.equal(stored.data.data_classification, "verified_internal");
  } finally {
    if (documentId) await admin.from("documents").delete().eq("id", documentId);
    await admin
      .from("verification_events")
      .delete()
      .eq("organization_id", membership.data.organization_id)
      .ilike("note", `%${marker}%`);
    await userClient.auth.signOut();
  }
});

const failed = results.filter((row) => !row.ok);
for (const row of results) {
  console.log(`${row.ok ? "PASS" : "FAIL"}  ${row.name}${row.message ? ` — ${row.message}` : ""}`);
}
console.log(`\nF18 classification acceptance: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
