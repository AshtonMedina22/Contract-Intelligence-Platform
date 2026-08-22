#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const fixture = JSON.parse(
  await fs.readFile(path.join(import.meta.dirname, "fixtures/f22-comparables.json"), "utf8"),
);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "lp-f22-"));

async function bundle(name) {
  const outfile = path.join(temp, `${name}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(webRoot, `lib/comparables/${name}.ts`)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node24",
    logLevel: "warning",
    alias: { "@": webRoot },
  });
  return import(pathToFileURL(outfile).href);
}

const [{ rankComparablePursuits }, { evaluateComparableAuthority }, weights] = await Promise.all([
  bundle("rank"),
  bundle("authority"),
  bundle("weights"),
]);
const results = [];
function check(area, name, fn) {
  try {
    fn();
    results.push({ area, name, ok: true });
    console.log(`PASS  [${area}] ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ area, name, ok: false, message });
    console.log(`FAIL  [${area}] ${name} — ${message}`);
  }
}

function authority(raw, purpose) {
  return evaluateComparableAuthority({
    targetOrganizationId: fixture.target.organizationId,
    candidateOrganizationId: raw.organizationId ?? fixture.target.organizationId,
    corpusClass: raw.corpusClass ?? "A_LP_ORIGINATED",
    classifications: [raw.classification ?? "verified_internal"],
    purpose,
  });
}

function candidate(raw, purpose) {
  return {
    ...fixture.target,
    ...raw,
    organizationId: raw.organizationId ?? fixture.target.organizationId,
    procurementRail: raw.procurementRail ?? fixture.target.procurementRail,
    solicitationKind: raw.solicitationKind ?? fixture.target.solicitationKind,
    authority: authority(raw, purpose),
  };
}

function ranked(purpose) {
  const target = candidate(fixture.target, purpose);
  return rankComparablePursuits({
    target,
    candidates: fixture.candidates.map((raw) => candidate(raw, purpose)),
    purpose,
    limit: 50,
    asOf: fixture.asOf,
  });
}

check("weights", "all four purposes are versioned and total 85 structured points", () => {
  assert.match(weights.ALGORITHM_VERSION, /^f22-/);
  assert.deepEqual(Object.keys(weights.PURPOSE_WEIGHTS).sort(), [
    "BID_STRATEGY",
    "PRICING_COMPARABLE",
    "PROPOSAL_CONTENT",
    "WIN_LOSS_ANALYSIS",
  ]);
  for (const purposeWeights of Object.values(weights.PURPOSE_WEIGHTS)) {
    assert.equal(Object.values(purposeWeights).reduce((sum, value) => sum + value, 0), 85);
  }
});

check("ordering", "same service/geo/scale outranks different service/geo/scale for pricing", () => {
  const rows = ranked("PRICING_COMPARABLE");
  assert.ok(rows.findIndex((row) => row.candidate.id === "same-service") < rows.findIndex((row) => row.candidate.id === "different-geo-service"));
});

check("ordering", "recent peer outranks otherwise-equivalent stale peer", () => {
  const rows = ranked("PRICING_COMPARABLE");
  assert.ok(rows.findIndex((row) => row.candidate.id === "same-service") < rows.findIndex((row) => row.candidate.id === "stale"));
});

check("missing", "missing fields stay null and contribute zero with rationale", () => {
  const row = ranked("BID_STRATEGY").find((entry) => entry.candidate.id === "missing");
  assert.ok(row);
  assert.ok(row.contributions.some((part) => part.value === null && part.points === 0 && /missing/i.test(part.rationale)));
  assert.ok(row.coverageWeight < 85);
});

check("authority", "wrong tenant and illustrative demo are excluded", () => {
  const ids = ranked("BID_STRATEGY").map((row) => row.candidate.id);
  assert.ok(!ids.includes("wrong-tenant"));
  assert.ok(!ids.includes("demo"));
});

check("authority", "non-L&P remains explicitly labeled and cannot enter proposal-content peers", () => {
  const pricing = ranked("PRICING_COMPARABLE").find((row) => row.candidate.id === "non-lp");
  assert.equal(pricing?.candidate.authority.historicalLabel, "Non-L&P test corpus");
  assert.match(pricing?.candidate.authority.reason ?? "", /never L&P historical performance/i);
  assert.ok(!ranked("PROPOSAL_CONTENT").some((row) => row.candidate.id === "non-lp"));
});

check("semantic", "semantic paraphrase is optional and capped at 15 points", () => {
  const row = ranked("PROPOSAL_CONTENT").find((entry) => entry.candidate.id === "semantic-paraphrase");
  assert.ok(row);
  assert.ok(row.semanticSupplement > 0 && row.semanticSupplement <= 15);
  assert.equal(row.totalScore, row.structuredScore + row.semanticSupplement);
});

check("rationale", "every score exposes component math and non-causation caveat", () => {
  for (const purpose of Object.keys(weights.PURPOSE_WEIGHTS)) {
    const row = ranked(purpose)[0];
    assert.ok(row.rationale.some((line) => /\d+\.\d+\/\d+/.test(line)));
    assert.ok(row.caveats.some((line) => /does not establish causation/i.test(line)));
  }
});

check("purpose", "pricing, proposal, and win/loss have purpose-specific priorities", () => {
  assert.ok(weights.PURPOSE_WEIGHTS.PRICING_COMPARABLE.scale > weights.PURPOSE_WEIGHTS.BID_STRATEGY.scale);
  assert.ok(weights.PURPOSE_WEIGHTS.PROPOSAL_CONTENT.proposalContent > 0);
  assert.ok(weights.PURPOSE_WEIGHTS.WIN_LOSS_ANALYSIS.outcome > weights.PURPOSE_WEIGHTS.BID_STRATEGY.outcome);
});

const [pricingUi, responsePage, overviewUi, winLossPage] = await Promise.all([
  fs.readFile(path.join(webRoot, "components/opportunity-workspace/pricing-comparables.tsx"), "utf8"),
  fs.readFile(path.join(webRoot, "app/(platform)/procurement/opportunities/[opportunityId]/response/page.tsx"), "utf8"),
  fs.readFile(path.join(webRoot, "components/opportunity-workspace/overview-sections.tsx"), "utf8"),
  fs.readFile(path.join(webRoot, "app/(platform)/intelligence/win-loss/page.tsx"), "utf8"),
]);
check("wires", "Overview, pricing, Response, and Win/Loss use F22 surfaces", () => {
  assert.match(overviewUi, /SimilarPursuits/);
  assert.match(pricingUi, /Human included|Human excluded/);
  assert.match(responsePage, /Optional historical peer filter/);
  assert.match(winLossPage, /WIN_LOSS_ANALYSIS/);
});

const failed = results.filter((result) => !result.ok);
console.log(`\nF22 comparable acceptance: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exitCode = 1;
