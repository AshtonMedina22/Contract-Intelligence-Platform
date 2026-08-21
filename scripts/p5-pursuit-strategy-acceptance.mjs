#!/usr/bin/env node
// P5 acceptance: pursuit Overview derivation + bid-strategy evidence rules.
//
// Runs without network or database access. The real TypeScript module is bundled with esbuild so the
// test exercises the same code the Overview page renders.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const webRoot = path.resolve(import.meta.dirname, "../apps/web");
const entry = path.join(webRoot, "lib/opportunity/overview-model.ts");
const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "lp-p5-")), "overview-model.mjs");

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  logLevel: "warning",
  alias: { "@": webRoot },
});

const {
  rollupRequirements,
  auditEvaluationWeights,
  readEvaluationScores,
  looksLikeLpRespondent,
  computeComplianceReadiness,
  buildBidStrategy,
  buildNextActions,
  COMPLIANCE_EXPIRING_WINDOW_DAYS,
} = await import(pathToFileURL(outfile).href);

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

function requirement(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    statement: "statement",
    solicitation_id: "sol",
    source_fact_id: null,
    mandatory: true,
    scored: false,
    weight_pct: null,
    section_ref: null,
    source_page: null,
    response_required: true,
    attachment_required: false,
    form_name: null,
    owner_name: null,
    verification_note: null,
    matrix_status: "OPEN",
    ...overrides,
  };
}

const EMPTY_ROLLUP = rollupRequirements([]);

// ---------------------------------------------------------------- requirements

check("rollupRequirements returns zeroed buckets for an empty matrix", () => {
  assert.equal(EMPTY_ROLLUP.total, 0);
  assert.equal(EMPTY_ROLLUP.byStatus.L_AND_P_INPUT_REQUIRED, 0);
  assert.equal(EMPTY_ROLLUP.sourced, 0);
  assert.equal(EMPTY_ROLLUP.unsourced, 0);
  assert.deepEqual(EMPTY_ROLLUP.formNames, []);
});

check("rollupRequirements counts L&P INPUT REQUIRED and unsourced rows without guessing", () => {
  const rollup = rollupRequirements([
    requirement({ id: "a", matrix_status: "L_AND_P_INPUT_REQUIRED" }),
    requirement({ id: "b", matrix_status: "APPROVED", source_fact_id: "fact-1" }),
    requirement({ id: "c", matrix_status: "OPEN", attachment_required: true, form_name: " Form W-9 " }),
    requirement({ id: "d", matrix_status: "OPEN", mandatory: false, scored: true }),
  ]);
  assert.equal(rollup.total, 4);
  assert.equal(rollup.byStatus.L_AND_P_INPUT_REQUIRED, 1);
  assert.equal(rollup.byStatus.APPROVED, 1);
  assert.equal(rollup.byStatus.OPEN, 2);
  assert.equal(rollup.mandatory, 3);
  assert.equal(rollup.scored, 1);
  assert.equal(rollup.sourced, 1);
  assert.equal(rollup.unsourced, 3);
  assert.equal(rollup.attachmentRequired, 1);
  assert.deepEqual(rollup.formNames, ["Form W-9"]);
});

// ------------------------------------------------------------------ evaluation

check("auditEvaluationWeights reports no criteria rather than assuming price-only", () => {
  const audit = auditEvaluationWeights([]);
  assert.equal(audit.status, "NO_CRITERIA");
  assert.equal(audit.weightTotal, null);
  assert.match(audit.message, /No evaluation criteria recorded/);
});

check("auditEvaluationWeights never treats unweighted criteria as equally weighted", () => {
  const audit = auditEvaluationWeights([
    { id: "1", criterion: "Price", weight_pct: null, notes: null, source_fact_id: null },
    { id: "2", criterion: "Experience", weight_pct: null, notes: null, source_fact_id: null },
  ]);
  assert.equal(audit.status, "NO_WEIGHTS");
  assert.equal(audit.weightTotal, null);
  assert.match(audit.message, /unknown, not equal/);
});

check("auditEvaluationWeights flags partial weights and does not redistribute", () => {
  const audit = auditEvaluationWeights([
    { id: "1", criterion: "Price", weight_pct: 40, notes: null, source_fact_id: null },
    { id: "2", criterion: "Experience", weight_pct: null, notes: null, source_fact_id: null },
  ]);
  assert.equal(audit.status, "PARTIAL_WEIGHTS");
  assert.equal(audit.weightTotal, 40);
  assert.equal(audit.weightedCount, 1);
  assert.equal(audit.unweightedCount, 1);
});

check("auditEvaluationWeights recognizes a complete 100% model", () => {
  const audit = auditEvaluationWeights([
    { id: "1", criterion: "Price", weight_pct: 40, notes: null, source_fact_id: null },
    { id: "2", criterion: "Experience", weight_pct: 35, notes: null, source_fact_id: null },
    { id: "3", criterion: "Approach", weight_pct: 25, notes: null, source_fact_id: null },
  ]);
  assert.equal(audit.status, "SUMS_TO_100");
  assert.equal(audit.weightTotal, 100);
});

check("auditEvaluationWeights flags weights that do not sum to 100", () => {
  const audit = auditEvaluationWeights([
    { id: "1", criterion: "Price", weight_pct: 40, notes: null, source_fact_id: null },
    { id: "2", criterion: "Experience", weight_pct: 30, notes: null, source_fact_id: null },
  ]);
  assert.equal(audit.status, "DOES_NOT_SUM_TO_100");
  assert.equal(audit.weightTotal, 70);
  assert.match(audit.message, /not 100%/);
});

check("looksLikeLpRespondent matches only L&P spellings", () => {
  assert.equal(looksLikeLpRespondent("L&P Global Security, LLC,"), true);
  assert.equal(looksLikeLpRespondent("L & P Global Security"), true);
  assert.equal(looksLikeLpRespondent("LP Global Security"), true);
  assert.equal(looksLikeLpRespondent("Securitas Security USA"), false);
  assert.equal(looksLikeLpRespondent("Metropolitan Security"), false);
});

check("readEvaluationScores states that max points and rank are not recorded", () => {
  const reading = readEvaluationScores([
    { respondent_name: "Securitas Security USA", points: 90.46, max_points: null, rank: null, notes: null, source_document_id: "doc-1" },
    { respondent_name: "Metropolitan Security", points: 86.01, max_points: null, rank: null, notes: null, source_document_id: "doc-1" },
    { respondent_name: "L&P Global Security, LLC,", points: 82.39, max_points: null, rank: null, notes: null, source_document_id: "doc-1" },
  ]);
  assert.equal(reading.anyMaxPoints, false);
  assert.equal(reading.anyRank, false);
  assert.equal(reading.lpMatchCount, 1);
  assert.equal(reading.lpPoints, 82.39);
  assert.equal(reading.higherThanLp, 2);
  assert.match(reading.caveat, /maximum points not recorded/);
  assert.match(reading.caveat, /official rank not recorded/);
  assert.match(reading.caveat, /not a scoring outcome/);
});

check("readEvaluationScores refuses an L&P position when the name match is ambiguous", () => {
  const reading = readEvaluationScores([
    { respondent_name: "L&P Global Security", points: 80, max_points: 100, rank: 2, notes: null, source_document_id: null },
    { respondent_name: "LP Global Security Services", points: 70, max_points: 100, rank: 3, notes: null, source_document_id: null },
  ]);
  assert.equal(reading.lpMatchCount, 2);
  assert.equal(reading.lpPoints, null);
  assert.equal(reading.higherThanLp, null);
  assert.match(reading.caveat, /more than one respondent name matches/);
});

check("readEvaluationScores on an empty list asserts nothing", () => {
  const reading = readEvaluationScores([]);
  assert.deepEqual(reading.scores, []);
  assert.equal(reading.lpPoints, null);
  assert.equal(reading.higherThanLp, null);
});

// ------------------------------------------------------------------ compliance

check("computeComplianceReadiness is honestly unavailable with no contract linked", () => {
  const readiness = computeComplianceReadiness({ contractId: null, items: [], today: "2026-08-21" });
  assert.equal(readiness.mode, "NO_CONTRACT_LINKED");
  assert.deepEqual(readiness.buckets, { verified: 0, expiring: 0, missing: 0, unknown: 0 });
  assert.deepEqual(readiness.items, []);
  assert.match(readiness.message, /Pursuit-level compliance matrix not available/);
  assert.match(readiness.message, /Contracts after award/);
});

check("computeComplianceReadiness never reads an empty contract as compliant", () => {
  const readiness = computeComplianceReadiness({ contractId: "contract-1", items: [], today: "2026-08-21" });
  assert.equal(readiness.mode, "CONTRACT_LINKED");
  assert.match(readiness.message, /Unknown, not compliant/);
});

check("computeComplianceReadiness buckets only from recorded expiry dates", () => {
  const readiness = computeComplianceReadiness({
    contractId: "contract-1",
    today: "2026-08-21",
    items: [
      { id: "1", kind: "insurance", statement: "GL $1M", expires_on: "2027-06-30", source_fact_id: "f1" },
      { id: "2", kind: "license", statement: "TX DPS B license", expires_on: "2026-09-15", source_fact_id: "f2" },
      { id: "3", kind: "certification", statement: "HUB certificate", expires_on: "2026-01-01", source_fact_id: null },
      { id: "4", kind: "other", statement: "W-9 on file", expires_on: null, source_fact_id: null },
    ],
  });
  assert.deepEqual(readiness.buckets, { verified: 1, expiring: 1, missing: 1, unknown: 1 });
  assert.equal(readiness.items.find((i) => i.id === "1").bucket, "verified");
  assert.equal(readiness.items.find((i) => i.id === "2").bucket, "expiring");
  assert.equal(readiness.items.find((i) => i.id === "3").bucket, "missing");
  assert.equal(readiness.items.find((i) => i.id === "4").bucket, "unknown");
  assert.equal(COMPLIANCE_EXPIRING_WINDOW_DAYS, 60);
});

// ---------------------------------------------------------------- bid strategy

const EMPTY_STRATEGY_INPUT = {
  opportunityId: "opp-1",
  buyerName: null,
  solicitationNumbers: [],
  solicitationDocumentIds: [],
  requirements: EMPTY_ROLLUP,
  evaluationAudit: auditEvaluationWeights([]),
  evaluationReading: readEvaluationScores([]),
  competitorBids: [],
  buyerHistory: { pursuitCount: 0, awardCount: 0, contractCount: 0, winLossCount: 0 },
  narrativeHits: [],
  packetBlockingGapCount: 0,
};

check("buildBidStrategy returns INSUFFICIENT with a reason on an empty pursuit", () => {
  const strategy = buildBidStrategy(EMPTY_STRATEGY_INPUT);
  assert.equal(strategy.status, "INSUFFICIENT");
  assert.deepEqual(strategy.bullets, []);
  assert.match(strategy.reason, /Insufficient verified, pursuit-scoped evidence/);
  assert.ok(strategy.withheld.length >= 5, "every absent evidence class is named");
});

check("buildBidStrategy produces no competitor-price bullet without a sourced amount", () => {
  const strategy = buildBidStrategy({
    ...EMPTY_STRATEGY_INPUT,
    competitorBids: [{ name: "Securitas", quoted_amount: null, source_url: null, source_document_id: null }],
  });
  assert.equal(strategy.status, "INSUFFICIENT");
  assert.ok(strategy.withheld.some((w) => /no observed price position/.test(w)));
});

const RICH_STRATEGY = buildBidStrategy({
  ...EMPTY_STRATEGY_INPUT,
  buyerName: "Arlington TX",
  requirements: rollupRequirements([
    requirement({ id: "a", source_fact_id: "f1" }),
    requirement({ id: "b", attachment_required: true }),
  ]),
  evaluationAudit: auditEvaluationWeights([
    { id: "1", criterion: "Price", weight_pct: 60, notes: null, source_fact_id: "f9" },
    { id: "2", criterion: "Experience", weight_pct: 40, notes: null, source_fact_id: "f9" },
  ]),
  evaluationReading: readEvaluationScores([
    { respondent_name: "Securitas", points: 90.46, max_points: null, rank: null, notes: null, source_document_id: "doc-9" },
    { respondent_name: "L&P Global Security, LLC,", points: 82.39, max_points: null, rank: null, notes: null, source_document_id: "doc-9" },
  ]),
  competitorBids: [
    { name: "Securitas", quoted_amount: 19.31, source_url: "https://example.gov/bid-tab", source_document_id: null },
    { name: "Metropolitan", quoted_amount: 18.5, source_url: null, source_document_id: "doc-3" },
    { name: "Texas Industrial", quoted_amount: 13.5, source_url: null, source_document_id: null },
  ],
  buyerHistory: { pursuitCount: 2, awardCount: 1, contractCount: 1, winLossCount: 0 },
  narrativeHits: [
    { document_id: "doc-4", source_page: 12, reuse_status: "APPROVED", content: "  Officers shall be licensed by\nthe Texas DPS.  " },
  ],
  packetBlockingGapCount: 3,
});

check("buildBidStrategy gives every bullet at least one citation", () => {
  assert.equal(RICH_STRATEGY.status, "AVAILABLE");
  assert.ok(RICH_STRATEGY.bullets.length >= 5);
  for (const bullet of RICH_STRATEGY.bullets) {
    assert.ok(bullet.citations.length > 0, `bullet ${bullet.id} has no citation`);
    for (const citation of bullet.citations) {
      assert.ok(citation.label && citation.label.length > 0, `bullet ${bullet.id} has an unlabeled citation`);
    }
  }
});

check("buildBidStrategy cites real hrefs for documents, sources, and pursuit tabs", () => {
  const hrefs = RICH_STRATEGY.bullets.flatMap((b) => b.citations.map((c) => c.href)).filter(Boolean);
  assert.ok(hrefs.includes("/procurement/opportunities/opp-1/requirements"));
  assert.ok(hrefs.includes("https://example.gov/bid-tab"));
  assert.ok(hrefs.includes("/ingestion/verification/doc-3"));
  assert.ok(hrefs.includes("/ingestion/verification/doc-9"));
  assert.ok(hrefs.includes("/ingestion/verification/doc-4"));
});

check("buildBidStrategy computes observed range and median from sourced amounts only", () => {
  const bullet = RICH_STRATEGY.bullets.find((b) => b.id === "competitor-amounts");
  assert.ok(bullet, "competitor amount bullet present");
  assert.match(bullet.text, /observed range 13\.5 to 19\.31/);
  assert.match(bullet.text, /median 18\.5/);
  assert.match(bullet.text, /not a market rate/);
});

check("buildBidStrategy states buyer history as record counts, not a win rate", () => {
  const bullet = RICH_STRATEGY.bullets.find((b) => b.id === "buyer-history");
  assert.match(bullet.text, /Counts of records held, not a win rate/);
});

check("buildBidStrategy names blocking packet gaps as withheld context", () => {
  assert.ok(RICH_STRATEGY.withheld.some((w) => /3 blocking packet gap\(s\)/.test(w)));
});

check("buildBidStrategy never generates causation, market share, or a win claim", () => {
  // Sensitive terms are allowed only inside an explicit disclaimer ("not a win rate"), never as a claim.
  const banned = [
    /(?<!not a )market share/i,
    /(?<!not a )win rate/i,
    /(?<!not a )market rate/i,
    /probability/i,
    /likely to win/i,
    /we will win/i,
    /recommend(ed)? bid/i,
    /\bbecause we\b/i,
    /competitive advantage/i,
    /industry average/i,
  ];
  const prose = RICH_STRATEGY.bullets.map((b) => b.text).join("\n");
  for (const pattern of banned) {
    assert.ok(!pattern.test(prose), `bid strategy prose matched banned pattern ${pattern}`);
  }
});

check("buildBidStrategy quotes verified passages verbatim with page provenance", () => {
  const bullet = RICH_STRATEGY.bullets.find((b) => b.id === "narrative-0");
  assert.match(bullet.text, /Officers shall be licensed by the Texas DPS\./);
  assert.match(bullet.text, /APPROVED/);
  assert.equal(bullet.citations[0].label, "Source document p.12");
});

// --------------------------------------------------------------- next actions

check("buildNextActions puts Intake first on a pursuit with no documents", () => {
  const actions = buildNextActions({
    opportunityId: "opp-1",
    documentCount: 0,
    requirements: EMPTY_ROLLUP,
    evaluationCriteriaCount: 0,
    pricingLineCount: 0,
    costModelCount: 0,
    responseProgress: null,
    submissionSubmitted: false,
    hasResult: false,
    unverifiedFactCount: 0,
  });
  assert.equal(actions[0].id, "intake");
  assert.equal(actions[0].href, "/ingestion/intake?opportunity=opp-1");
  assert.ok(actions.every((a) => a.reason && a.reason.length > 0));
});

check("buildNextActions surfaces verification, L&P input, and mandatory drafts", () => {
  const actions = buildNextActions({
    opportunityId: "opp-1",
    documentCount: 2,
    requirements: rollupRequirements([requirement({ id: "a", matrix_status: "L_AND_P_INPUT_REQUIRED" })]),
    evaluationCriteriaCount: 1,
    pricingLineCount: 4,
    costModelCount: 0,
    responseProgress: { mandatoryOutstanding: 1, lpInputRequired: 1 },
    submissionSubmitted: false,
    hasResult: false,
    unverifiedFactCount: 17,
  });
  const ids = actions.map((a) => a.id);
  assert.ok(ids.includes("verification"));
  assert.ok(ids.includes("requirements-lp"));
  assert.ok(ids.includes("response"));
  assert.ok(!ids.includes("intake"));
  assert.ok(!ids.includes("pricing"), "pricing is satisfied by existing pricing lines");
  assert.ok(!ids.includes("evaluation"), "evaluation is satisfied by a recorded criterion");
});

check("buildNextActions returns nothing when every tracked step has a record", () => {
  const actions = buildNextActions({
    opportunityId: "opp-1",
    documentCount: 3,
    requirements: rollupRequirements([requirement({ id: "a", matrix_status: "APPROVED", source_fact_id: "f" })]),
    evaluationCriteriaCount: 2,
    pricingLineCount: 6,
    costModelCount: 1,
    responseProgress: { mandatoryOutstanding: 0, lpInputRequired: 0 },
    submissionSubmitted: true,
    hasResult: true,
    unverifiedFactCount: 0,
  });
  assert.deepEqual(actions, []);
});

// ------------------------------------------------------------------- reporting

let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`PASS  ${result.name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${result.name}\n      ${result.message}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
