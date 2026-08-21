#!/usr/bin/env node
// P7 acceptance: pricing workbench polish — the five commercial truths never collapse, the human
// final-bid gate is the only approval path, comparable include/exclude still demands a reason,
// range analytics state their sample count, and the Glide grid stays read-only with pinned
// identifiers and clickable source evidence.
//
// Runs without network or database access. The real TypeScript model is bundled with esbuild so
// the test exercises the same code the workbench renders; component wiring is asserted by grep.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const outdir = await fs.mkdtemp(path.join(os.tmpdir(), "lp-p7-"));

async function bundle(relEntry, name) {
  const outfile = path.join(outdir, name);
  await esbuild.build({
    entryPoints: [path.join(webRoot, relEntry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "warning",
    alias: { "@": webRoot },
  });
  return import(pathToFileURL(outfile).href);
}

const grid = await bundle("lib/opportunity/pricing-grid-model.ts", "pricing-grid-model.mjs");
const math = await bundle("lib/opportunity/pricing-math.ts", "pricing-math.mjs");
const types = await bundle("lib/opportunity/types.ts", "types.mjs");

const {
  EMPTY_CELL,
  MIN_COMPARABLE_SAMPLE_FOR_CHART,
  PRICING_FREEZE_COLUMNS,
  PRICING_IDENTIFIER_COLUMN_IDS,
  PRICING_TRUTH_COLUMNS,
  PRICING_TRUTH_LEGEND_CLASS,
  PRICING_TRUTH_TINTS,
  blendRgb,
  formatCurrency,
  formatQuantity,
  hslTripletToRgb,
  isGridEditableTruth,
  observeLineGrains,
  parseRateInput,
  rangeBarModel,
  recencyLabel,
  rgbToHex,
  sampleCountLabel,
  truthCoverage,
  truthFactId,
  truthRate,
} = grid;

const { buildDecisionSupport, summarizeComparableRates } = math;
const { PRICING_STRUCTURE_HINTS } = types;

const sources = {
  glide: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/pricing-glide-grid.tsx"),
    "utf8",
  ),
  workbench: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/pricing-workbench.tsx"),
    "utf8",
  ),
  comparables: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/pricing-comparables.tsx"),
    "utf8",
  ),
  finalBid: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/final-bid-panel.tsx"),
    "utf8",
  ),
  fourTruths: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/four-truths-table.tsx"),
    "utf8",
  ),
  actions: await fs.readFile(
    path.join(webRoot, "app/(platform)/procurement/opportunities/[opportunityId]/actions.ts"),
    "utf8",
  ),
  migration: await fs.readFile(
    path.join(root, "supabase/migrations/20260820900000_phase7_pricing_intelligence.sql"),
    "utf8",
  ),
};

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

function line(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    labor_category: "Armed officer",
    rate_type: "standard",
    site_or_post: "Main gate",
    unit: "hour",
    quantity: 2080,
    extended_amount: null,
    requested_rate: null,
    internal_cost_rate: null,
    proposed_rate: null,
    awarded_rate: null,
    current_rate: null,
    requested_source_fact_id: null,
    proposed_source_fact_id: null,
    awarded_source_fact_id: null,
    current_source_fact_id: null,
    ...overrides,
  };
}

function comparable(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    opportunity_id: "opp",
    opportunity_title: "Hist pursuit",
    client_name: "City",
    service_type: "Armed guards",
    labor_category: "Armed officer",
    rate_type: "standard",
    unit: "hour",
    site_or_post: "Main gate",
    requested_rate: null,
    proposed_rate: null,
    awarded_rate: null,
    current_rate: null,
    requested_source_fact_id: null,
    proposed_source_fact_id: null,
    awarded_source_fact_id: null,
    current_source_fact_id: null,
    included: true,
    reason: "Auto-included: same buyer",
    match_basis: "same buyer",
    updated_at: null,
    ...overrides,
  };
}

// ------------------------------------------------- the five truths never collapse

check("exactly five commercial truths are modelled, in operator reading order", () => {
  assert.deepEqual(
    PRICING_TRUTH_COLUMNS.map((t) => t.id),
    ["requested", "internal_cost", "proposed", "awarded", "current"],
  );
  assert.deepEqual(
    PRICING_TRUTH_COLUMNS.map((t) => t.label),
    ["Buyer requested", "L&P internal cost", "L&P submitted", "Buyer awarded", "Current/amended"],
  );
});

check("no two truths share a label, a rate column, a source column, or a legend colour", () => {
  const labels = PRICING_TRUTH_COLUMNS.map((t) => t.label);
  const rateKeys = PRICING_TRUTH_COLUMNS.map((t) => t.rateKey);
  const factKeys = PRICING_TRUTH_COLUMNS.map((t) => t.factKey).filter(Boolean);
  const legend = PRICING_TRUTH_COLUMNS.map((t) => PRICING_TRUTH_LEGEND_CLASS[t.id]);
  const tints = PRICING_TRUTH_COLUMNS.map((t) => PRICING_TRUTH_TINTS[t.id].join(","));
  for (const [name, list] of Object.entries({ labels, rateKeys, factKeys, legend, tints })) {
    assert.equal(new Set(list).size, list.length, `${name} collapse two truths into one`);
  }
  assert.equal(factKeys.length, 4, "only the planning truth may lack a source fact column");
});

check("internal cost is the one planning truth and it is never promoted evidence", () => {
  const internal = PRICING_TRUTH_COLUMNS.find((t) => t.id === "internal_cost");
  assert.equal(internal.provenance, "PLANNING_COST_MODEL");
  assert.equal(internal.factKey, null);
  assert.match(internal.editPath, /saveCostModel/);
  for (const other of PRICING_TRUTH_COLUMNS.filter((t) => t.id !== "internal_cost")) {
    assert.equal(other.provenance, "PROMOTED_VERIFIED", `${other.id} must stay promoted evidence`);
  }
});

check("every truth column renders even when no line carries a value", () => {
  const coverage = truthCoverage([line()]);
  assert.deepEqual(Object.keys(coverage).sort(), [
    "awarded",
    "current",
    "internal_cost",
    "proposed",
    "requested",
  ]);
  for (const truth of PRICING_TRUTH_COLUMNS) {
    assert.equal(coverage[truth.id], 0, `${truth.id} should report 0, not disappear`);
  }
  assert.deepEqual(Object.keys(truthCoverage([])).length, 5, "an empty pursuit still has 5 columns");
});

check("five different rates on one line read back as five different truths", () => {
  const row = line({
    requested_rate: 28,
    internal_cost_rate: 24.1,
    proposed_rate: 31.5,
    awarded_rate: 30.25,
    current_rate: 30.75,
    requested_source_fact_id: "f-req",
    proposed_source_fact_id: "f-prop",
    awarded_source_fact_id: "f-awd",
    current_source_fact_id: "f-cur",
  });
  assert.deepEqual(
    PRICING_TRUTH_COLUMNS.map((t) => truthRate(row, t.id)),
    [28, 24.1, 31.5, 30.25, 30.75],
  );
  assert.deepEqual(
    PRICING_TRUTH_COLUMNS.map((t) => truthFactId(row, t.id)),
    ["f-req", null, "f-prop", "f-awd", "f-cur"],
  );
  const coverage = truthCoverage([row]);
  assert.ok(
    PRICING_TRUTH_COLUMNS.every((t) => coverage[t.id] === 1),
    "each truth must count its own value",
  );
});

// ---------------------------------------------------- read-only grid, safe write paths

check("no truth is editable in the grid, and each names its human write path", () => {
  for (const truth of PRICING_TRUTH_COLUMNS) {
    assert.equal(isGridEditableTruth(truth.id), false, `${truth.id} must not be grid-editable`);
    assert.ok(truth.editPath.length > 20, `${truth.id} has no usable write path copy`);
  }
});

check("the grid declares no cell-edit or paste handler at all", () => {
  assert.ok(!/onCellEdited/.test(sources.glide), "grid must not write cells");
  assert.ok(!/onCellsEdited/.test(sources.glide), "grid must not bulk-write cells");
  assert.match(sources.glide, /onPaste=\{false\}/);
  assert.ok(
    !/from "@\/app\/\(platform\)\/procurement/.test(sources.glide),
    "the grid must not import a server action",
  );
});

check("identifier columns are pinned and lead the column order", () => {
  assert.deepEqual([...PRICING_IDENTIFIER_COLUMN_IDS], ["labor_category", "site_or_post", "unit"]);
  assert.equal(PRICING_FREEZE_COLUMNS, PRICING_IDENTIFIER_COLUMN_IDS.length);
  assert.match(sources.glide, /freezeColumns=\{PRICING_FREEZE_COLUMNS\}/);
  assert.match(sources.glide, /Frozen identifier columns must lead the column order/);
});

check("source cells navigate to verification and rate cells open a provenance sheet", () => {
  assert.match(sources.glide, /onClickUri/);
  assert.match(sources.glide, /\/ingestion\/verification\//);
  assert.match(sources.glide, /onCellClicked=\{onCellClicked\}/);
  assert.match(sources.glide, /@\/components\/ui\/sheet/);
});

check("multi-row selection, keyboard copy, and dense chrome are configured", () => {
  assert.match(sources.glide, /rowSelect="multi"/);
  assert.match(sources.glide, /rangeSelect="multi-rect"/);
  assert.match(sources.glide, /rowMarkers="both"/);
  assert.match(sources.glide, /copyHeaders/);
  assert.match(sources.glide, /getCellsForSelection/);
  assert.match(sources.glide, /groupHeaderHeight=\{\d+\}/);
  assert.match(sources.glide, /rowHeight=\{\d+\}/);
  assert.match(sources.glide, /sticky top-0/);
});

check("column banding comes from the shared tint map, not hand-picked colours", () => {
  assert.match(sources.glide, /PRICING_TRUTH_TINTS\[column\.truth\]|PRICING_TRUTH_TINTS\[truth\.id\]/);
  assert.match(sources.glide, /themeOverride/);
});

check("canvas colours are resolved from CSS tokens, never left as hsl(var(--x))", () => {
  assert.ok(
    !/(bgCell|bgCellMedium|bgHeader|bgHeaderHovered|hoverBg|accentColor|textDark|borderColor)\s*:\s*[`"'][^`"']*var\(/.test(
      sources.glide,
    ),
    "a canvas cannot resolve a CSS variable — the old hover highlight silently did nothing",
  );
  assert.match(sources.glide, /getComputedStyle\(document\.documentElement\)/);
  assert.match(sources.glide, /new MutationObserver/);
  assert.equal(rgbToHex(hslTripletToRgb("0 0% 100%")), "#ffffff");
  assert.equal(rgbToHex(hslTripletToRgb("0 0% 0%")), "#000000");
  assert.equal(hslTripletToRgb("not-a-triplet"), null);
  assert.deepEqual(blendRgb([0, 0, 0], [255, 255, 255], 0.5), [127.5, 127.5, 127.5]);
  assert.equal(rgbToHex(blendRgb([255, 255, 255], [0, 0, 0], 0)), "#ffffff");
});

// ------------------------------------------------------------- currency + validation

check("rate columns format as currency and an absent rate stays a dash", () => {
  assert.equal(formatCurrency(31.5), "$31.50");
  assert.equal(formatCurrency(1234.5), "$1,234.50");
  assert.equal(formatCurrency(null), EMPTY_CELL);
  assert.equal(formatCurrency(undefined), EMPTY_CELL);
  assert.equal(formatCurrency(Number.NaN), EMPTY_CELL);
  assert.equal(formatQuantity(2080), "2,080");
  assert.equal(formatQuantity(null), EMPTY_CELL);
});

check("a blank rate input stays blank rather than becoming a zero claim", () => {
  for (const blank of ["", "   ", null, undefined]) {
    const result = parseRateInput(blank);
    assert.equal(result.ok, true);
    assert.equal(result.value, null, `${JSON.stringify(blank)} must not become 0`);
  }
});

check("invalid currency input is rejected with operator-readable feedback", () => {
  for (const bad of ["abc", "31.5.5", "--3", "12,34a", "-4", "31.555", "."]) {
    const result = parseRateInput(bad);
    assert.equal(result.ok, false, `${bad} was accepted`);
    assert.equal(result.value, null);
    assert.ok(result.error.length > 5, `${bad} has no usable error message`);
  }
  assert.match(parseRateInput("-4").error, /negative/i);
  assert.match(parseRateInput("31.555").error, /two decimal/i);
});

check("valid currency input accepts $ and thousands separators", () => {
  assert.equal(parseRateInput("31.50").value, 31.5);
  assert.equal(parseRateInput(" $1,234.56 ").value, 1234.56);
  assert.equal(parseRateInput(28).value, 28);
});

check("the editable panels validate through the shared parser and show save state", () => {
  assert.match(sources.workbench, /parseRateInput/);
  assert.match(sources.workbench, /data-testid="cost-model-save-status"/);
  assert.match(sources.workbench, /status: "saving"/);
  assert.match(sources.workbench, /disabled=\{pending \|\| invalid\}/);
  assert.match(sources.finalBid, /parseRateInput/);
  assert.match(sources.finalBid, /disabled=\{pending \|\| invalid\}/);
});

// ------------------------------------------------------------ comparables discipline

check("include/exclude still requires a reason in the UI and in the action", () => {
  assert.match(sources.comparables, /Why exclude\?/);
  assert.match(sources.comparables, /Why include\?/);
  assert.match(sources.comparables, /A reason is required/);
  assert.match(sources.comparables, /if \(!reason\) \{[\s\S]{0,120}setBlankReason/);
  assert.match(sources.actions, /if \(!reason\) throw new Error\("Include\/exclude reason required\."\)/);
});

check("a comparable row carries source, why-comparable, verification and recency", () => {
  assert.match(sources.comparables, /Why comparable/);
  assert.match(sources.comparables, /Verification/);
  assert.match(sources.comparables, /Recency/);
  assert.match(sources.comparables, /recencyLabel/);
  assert.match(sources.comparables, /FactRef/);
  assert.match(sources.comparables, /no source fact/);
});

check("recency is reported honestly, including when the timestamp is missing", () => {
  const now = Date.parse("2026-08-21T00:00:00Z");
  assert.equal(recencyLabel(null, now), "unknown");
  assert.equal(recencyLabel("garbage", now), "unknown");
  assert.equal(recencyLabel("2026-08-21T00:00:00Z", now), "today");
  assert.equal(recencyLabel("2026-08-20T00:00:00Z", now), "1 day ago");
  assert.equal(recencyLabel("2026-08-01T00:00:00Z", now), "20 days ago");
  assert.equal(recencyLabel("2025-08-21T00:00:00Z", now), "12 mo ago");
  assert.equal(recencyLabel("2023-08-21T00:00:00Z", now), "3 yr ago");
});

// -------------------------------------------------------------------- range analytics

check("ranges still come from included comparables only", () => {
  const rows = [
    comparable({ id: "in-1", proposed_rate: 30, included: true }),
    comparable({ id: "in-2", proposed_rate: 32, included: true }),
    comparable({ id: "out", proposed_rate: 90, included: false }),
  ];
  const summary = summarizeComparableRates(rows, "proposed_rate");
  assert.equal(summary.count, 2);
  assert.equal(summary.max, 32, "an excluded outlier must not widen the range");
  assert.equal(summarizeComparableRates(rows, "proposed_rate", false).max, 90);
});

check("every range readout states its sample count", () => {
  const rows = [comparable({ proposed_rate: 30 })];
  const summary = summarizeComparableRates(rows, "proposed_rate");
  assert.match(summary.label, /n=1/);
  assert.equal(sampleCountLabel(summary), "n=1 included verified rate");
  assert.equal(sampleCountLabel(null), "n=0 — no included verified rate");
  assert.match(sources.comparables, /sampleCountLabel/);
  assert.match(sources.finalBid, /sampleCountLabel/);
});

check("no range bar is drawn below the honest minimum sample", () => {
  assert.equal(MIN_COMPARABLE_SAMPLE_FOR_CHART, 3);
  const build = (rates) =>
    summarizeComparableRates(
      rates.map((r) => comparable({ awarded_rate: r })),
      "awarded_rate",
    );
  assert.equal(rangeBarModel(build([30])), null);
  assert.equal(rangeBarModel(build([30, 32])), null);
  assert.equal(rangeBarModel(null), null);
  const bar = rangeBarModel(build([30, 32, 34]));
  assert.equal(bar.count, 3);
  assert.equal(bar.medianPercent, 50);
  assert.match(sources.comparables, /No range bar below n =/);
});

check("a degenerate range does not divide by zero", () => {
  const summary = summarizeComparableRates(
    [30, 30, 30].map((r) => comparable({ awarded_rate: r })),
    "awarded_rate",
  );
  const bar = rangeBarModel(summary);
  assert.equal(bar.min, bar.max);
  assert.equal(bar.medianPercent, 50);
  assert.equal(bar.avgPercent, 50);
});

// ------------------------------------------------------------------ human final gate

check("the final bid panel is labelled a human decision and denies AI approval", () => {
  assert.match(sources.finalBid, /FINAL PRICE — HUMAN DECISION REQUIRED/);
  assert.match(sources.finalBid, /AI and automation never approve/);
  assert.match(sources.finalBid, /No AI approval path/);
  assert.match(sources.finalBid, /name="approve" value="1"/);
});

check("approval is a separate explicit submit, never a side effect of saving", () => {
  const drafts = sources.finalBid.match(/name="approve" value=""/g) ?? [];
  const approvals = sources.finalBid.match(/name="approve" value="1"/g) ?? [];
  assert.equal(drafts.length, 1, "exactly one draft submit");
  assert.equal(approvals.length, 1, "exactly one approve submit");
  assert.ok(
    !/generateObject|generateText|streamText/.test(sources.finalBid),
    "no model call may sit on the approval path",
  );
});

check("the server action and the database both demand a named human plus an amount", () => {
  assert.match(sources.actions, /await requireOrgRole\(supabase, userId, organizationId, PRICING_APPROVE_ROLES\)/);
  assert.match(
    sources.actions,
    /Human final bid rate or amount required to approve/,
  );
  assert.match(sources.actions, /decided_by: approve \? userId : null/);
  assert.match(sources.migration, /HUMAN_APPROVED pricing_decisions require decided_by/);
  assert.match(
    sources.migration,
    /HUMAN_APPROVED pricing_decisions require final_bid_rate or final_bid_amount/,
  );
});

check("decision support never resolves to a recommendation, only a range plus sufficiency", () => {
  const support = buildDecisionSupport({ included: [], excluded: [], costFloor: null, targetMarginPct: null });
  assert.equal(support.observed, null);
  assert.equal(support.confidence, "insufficient");
  assert.match(support.dataSufficiency, /Insufficient/);
  assert.ok(!("recommendedRate" in support), "support must not propose a price");
  assert.ok(!("finalBidRate" in support), "support must not propose a price");
});

// ----------------------------------------------------- cost model is the only cost writer

check("saveCostModel writes internal_cost_rate and never touches proposed_rate", () => {
  const sync = sources.actions.match(
    /\/\/ Sync L&P internal cost truth[\s\S]{0,600}?revalidatePath/,
  );
  assert.ok(sync, "the internal-cost sync block moved or vanished");
  assert.match(sync[0], /update\(\{ internal_cost_rate: planned\.costFloor/);
  assert.ok(!/proposed_rate/.test(sync[0]), "cost model must not write the submitted truth");
  assert.match(sources.workbench, /does not\s+write submitted proposed_rate/);
});

// ------------------------------------------------------- buyer format from real grains

check("observed structure hints come from real line grains only", () => {
  const observation = observeLineGrains([
    line({ labor_category: "Armed officer", unit: "hour", rate_type: "standard", site_or_post: "Main gate" }),
  ]);
  assert.deepEqual(observation.units, ["hour"]);
  assert.deepEqual(observation.sites, ["Main gate"]);
  assert.ok(observation.observedHints.includes("hourly"));
  assert.ok(observation.observedHints.includes("labor category"));
  assert.ok(observation.observedHints.includes("site/post/shift"));
  assert.ok(
    observation.observedHints.every((hint) => PRICING_STRUCTURE_HINTS.includes(hint)),
    "an observed hint must be a canonical structure",
  );
});

check("a structure with no line is reported as unobserved, never as requested", () => {
  const observation = observeLineGrains([line({ unit: "hour", rate_type: "standard" })]);
  assert.ok(observation.unobservedHints.includes("NTE"));
  assert.ok(observation.unobservedHints.includes("escalation"));
  assert.equal(
    observation.observedHints.length + observation.unobservedHints.length,
    PRICING_STRUCTURE_HINTS.length,
  );
  assert.equal(
    observation.observedHints.filter((h) => observation.unobservedHints.includes(h)).length,
    0,
  );
  assert.match(sources.workbench, /Supported but not observed here/);
  assert.match(sources.workbench, /No\s+requested cell is invented/);
});

check("an empty pursuit claims no buyer format at all", () => {
  const observation = observeLineGrains([]);
  assert.deepEqual([...observation.observedHints], []);
  assert.equal(observation.unobservedHints.length, PRICING_STRUCTURE_HINTS.length);
  assert.equal(observation.linesWithQuantity, 0);
  assert.equal(observation.linesWithExtended, 0);
  assert.match(sources.workbench, /pricing format is unknown/);
});

check("OT, holiday and escalation grains are only claimed when a line says so", () => {
  const ot = observeLineGrains([line({ rate_type: "overtime" })]);
  assert.ok(ot.observedHints.includes("OT"));
  const holiday = observeLineGrains([line({ rate_type: "holiday" })]);
  assert.ok(holiday.observedHints.includes("holiday"));
  const plain = observeLineGrains([line({ rate_type: "standard", unit: "hour" })]);
  assert.ok(!plain.observedHints.includes("OT"));
  assert.ok(!plain.observedHints.includes("holiday"));
});

// ------------------------------------------------------------------- overview parity

check("the overview snapshot shows the same five truths as the workbench", () => {
  assert.match(sources.fourTruths, /PRICING_TRUTH_COLUMNS/);
  assert.match(sources.fourTruths, /PRICING_TRUTH_LEGEND_CLASS/);
  assert.ok(
    !/requested_rate", "requested_source_fact_id/.test(sources.fourTruths),
    "the snapshot must not keep its own hand-written four-column list",
  );
  assert.match(sources.fourTruths, /planning/);
  // Same money formatter as the grid, so a rate does not read $67.34 on one screen and 67.34 on the other.
  assert.match(sources.fourTruths, /formatCurrency\(truthRate\(/);
  assert.ok(
    !/formatMoney/.test(sources.fourTruths),
    "the snapshot must format rates the way the grid does",
  );
});

check("the workbench header and the grid legend both come from the model", () => {
  assert.match(sources.workbench, /PRICING_TRUTH_COLUMNS\.map/);
  assert.match(sources.glide, /PRICING_TRUTH_COLUMNS\.map/);
  assert.match(sources.workbench, /Pursuit pricing workbench/);
  assert.match(sources.workbench, /FinalBidPanel/);
  assert.match(sources.workbench, /truths stay separate columns even when empty/);
});

// ------------------------------------------------------------------------- reporting

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
