#!/usr/bin/env node
// P10 acceptance: the Contract portfolio and the renewal / rebid command center — an operator can
// see what L&P holds, what is coming due, and what to do next, without the app inventing a term.
//
// The invariants under test:
//   * every bucket, status, expiration and next action is derived from a date that is actually on
//     file; a contract with no `verified_end_on` produces no bucket and is never assumed active;
//   * a value is a named instrument or a dash — an award NTE ceiling and an obligated purchase
//     order are never added together, an amendment never inherits the original amount, and the
//     Active Contract Value total is withheld unless every active contract carries an amount;
//   * the six buckets are exactly 180 / 120 / 90 / 60 / 30 / EXPIRED, and the lane filters are a
//     partition, so filtering the table can never change the KPI denominators;
//   * the portfolio and the Intelligence Market Recompete Radar are stated to be different lists,
//     on the portfolio, on the queue, and on the per-contract renewal tab;
//   * "Start Rebid Pursuit" is the CTA, it links lineage through `rebid_from_*`, and it copies no
//     pricing forward;
//   * the change timeline is append-only and every entry names its own source;
//   * the only automation is `refresh_contract_alerts`, it is audited on the page, and nothing in
//     the contracts surface renews, extends, exercises, approves or submits.
//
// Runs with no network and no database. The real TypeScript module is bundled with esbuild so the
// test exercises shipped code; UI wiring is asserted by grep.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const outdir = await fs.mkdtemp(path.join(os.tmpdir(), "lp-p10-"));

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

const model = await bundle("lib/contracts/portfolio-model.ts", "portfolio-model.mjs");

const {
  ALERT_CRON_JOB,
  ALERT_CRON_SCHEDULE,
  AUTOMATION_SCOPE_NOTE,
  CHANGE_HISTORY_APPEND_ONLY_NOTE,
  CHANGE_TIMELINE_KINDS,
  COMMERCIAL_PRECEDENCE,
  COMMERCIAL_PRECEDENCE_NOTE,
  COMPLIANCE_ROUTE,
  CONTRACT_VALUE_ABSENT_NOTE,
  CONTRACT_VALUE_KIND_LABELS,
  FOUR_COMMERCIAL_TRUTHS,
  FOUR_TRUTHS_NOTE,
  LP_PORTFOLIO_VS_MARKET_RADAR_NOTE,
  MARKET_RADAR_ROUTE,
  NO_AUTO_ACTION_NOTE,
  PORTFOLIO_FILTERS,
  PORTFOLIO_FILTER_DEFINITIONS,
  PORTFOLIO_FILTER_LABELS,
  PORTFOLIO_HONESTY_TEXT,
  PORTFOLIO_ROUTE,
  READINESS_ADVISORY_NOTE,
  REBID_CTA_LABEL,
  REBID_CTA_NOTE,
  RENEWAL_BUCKETS,
  RENEWAL_BUCKET_DEFINITION,
  RENEWALS_ROUTE,
  assessRebidReadiness,
  automationAudit,
  buildChangeTimeline,
  buildContractPortfolio,
  deriveContractStatus,
  filterPortfolioRows,
  isRenewalBucket,
  portfolioFilterFromParam,
  portfolioKpis,
  summarizeRenewalBuckets,
  totalActiveContractValue,
} = model;

// Read with LF endings so the regexes below behave the same on Windows checkouts.
const readSource = async (...segments) =>
  (await fs.readFile(path.join(...segments), "utf8")).replace(/\r\n/g, "\n");

const contractsRoot = path.join(webRoot, "app/(platform)/contracts");

const sources = {
  portfolio: await readSource(contractsRoot, "page.tsx"),
  portfolioTable: await readSource(contractsRoot, "contracts-table.tsx"),
  renewals: await readSource(contractsRoot, "renewals/page.tsx"),
  compliance: await readSource(contractsRoot, "compliance/page.tsx"),
  overview: await readSource(contractsRoot, "[contractId]/page.tsx"),
  servicePlan: await readSource(contractsRoot, "[contractId]/service-plan/page.tsx"),
  commercial: await readSource(contractsRoot, "[contractId]/commercial-terms/page.tsx"),
  changes: await readSource(contractsRoot, "[contractId]/changes/page.tsx"),
  renewalTab: await readSource(contractsRoot, "[contractId]/renewal/page.tsx"),
  actions: await readSource(contractsRoot, "actions.ts"),
  strips: await readSource(webRoot, "components/contract-workspace/portfolio-strips.tsx"),
  rebidButton: await readSource(webRoot, "components/opportunity-workspace/rebid-button.tsx"),
  loader: await readSource(webRoot, "lib/contracts/load-workspace.ts"),
  modelLib: await readSource(webRoot, "lib/contracts/portfolio-model.ts"),
  sectionTabs: await readSource(webRoot, "components/section-tabs.tsx"),
  workspaceTabs: await readSource(webRoot, "components/opportunity-workspace/shared.tsx"),
};

/** The five per-contract workspace tabs. */
const CONTRACT_TAB_SOURCES = {
  overview: sources.overview,
  "service-plan": sources.servicePlan,
  "commercial-terms": sources.commercial,
  changes: sources.changes,
  renewal: sources.renewalTab,
};

/** The three portfolio-level routes that must stay reachable from one another. */
const PORTFOLIO_LEVEL_SOURCES = {
  portfolio: sources.portfolio,
  renewals: sources.renewals,
  compliance: sources.compliance,
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

// ------------------------------------------------------------------------------ fixtures

const TODAY = "2026-08-21";

const BUYERS = [
  { id: "b-northside", name: "Northside ISD" },
  { id: "b-arlington", name: "City of Arlington TX" },
  { id: "b-plano", name: "City of Plano" },
];

function contract(overrides) {
  return {
    id: "c-x",
    client_id: "b-northside",
    opportunity_id: null,
    title: "Untitled contract",
    contract_number: null,
    start_on: null,
    verified_end_on: null,
    source_fact_id: null,
    source_document_id: null,
    ...overrides,
  };
}

/**
 * Four contracts covering every lane: one active well outside the window, one in the 120 bucket,
 * one in the 30 bucket, one expired, and one with no verified end date at all.
 */
function portfolioFixture(overrides = {}) {
  return buildContractPortfolio({
    today: TODAY,
    buyers: BUYERS,
    contracts: [
      contract({
        id: "c-active",
        opportunity_id: "o-active",
        title: "Northside ISD campus security",
        contract_number: "NISD-2025-11",
        start_on: "2025-01-01",
        verified_end_on: "2028-12-31",
        source_document_id: "d-active",
      }),
      contract({
        id: "c-window",
        client_id: "b-arlington",
        opportunity_id: "o-window",
        title: "Arlington municipal patrol",
        contract_number: "ARL-2024-07",
        start_on: "2024-01-01",
        verified_end_on: "2026-12-01",
        source_fact_id: "f-window",
      }),
      contract({
        id: "c-urgent",
        client_id: "b-plano",
        title: "Plano courthouse posts",
        contract_number: "PLN-9",
        start_on: "2023-09-01",
        verified_end_on: "2026-09-10",
      }),
      contract({
        id: "c-expired",
        client_id: "b-plano",
        title: "Plano legacy coverage",
        start_on: "2020-01-01",
        verified_end_on: "2025-06-30",
      }),
      contract({ id: "c-undated", title: "Scanned contract, end date not verified" }),
    ],
    alerts: [
      { contract_id: "c-window", bucket: "120", days_until: 102, verified_end_on: "2026-12-01", computed_on: "2026-08-21T06:15:00Z" },
      { contract_id: "c-window", bucket: "180", days_until: 102, verified_end_on: "2026-12-01", computed_on: "2026-08-21T06:15:00Z" },
      { contract_id: "c-urgent", bucket: "30", days_until: 20, verified_end_on: "2026-09-10", computed_on: "2026-08-20T06:15:00Z" },
      { contract_id: "c-expired", bucket: "EXPIRED", days_until: -417, verified_end_on: "2025-06-30", computed_on: "2026-08-21T06:15:00Z" },
    ],
    options: [
      { id: "opt-1", contract_id: "c-window", label: "Option year 2", exercise_by: "2026-10-01", source_fact_id: "f-opt" },
      { id: "opt-2", contract_id: "c-window", label: "Option year 1", exercise_by: "2024-10-01", source_fact_id: null },
    ],
    renewalNotices: [
      { id: "n-1", contract_id: "c-urgent", notice: "60-day non-renewal notice", notice_due_on: "2026-08-25", option_year: null, source_fact_id: "f-n1" },
    ],
    awards: [
      {
        id: "a-active",
        opportunity_id: "o-active",
        amount_nte: 1_250_000,
        awarded_on: "2024-12-01",
        notice: "Board minute 24-88",
        winner_name: "L&P Global Security",
        source_fact_id: "f-a1",
        source_document_id: "d-award-active",
      },
    ],
    purchaseOrders: [
      { id: "po-1", contract_id: "c-active", po_number: "PO-1", issued_on: "2025-02-01", total_amount: 300_000, source_document_id: "d-po1" },
      { id: "po-2", contract_id: "c-active", po_number: "PO-2", issued_on: "2025-08-01", total_amount: 120_000, source_document_id: null },
    ],
    ...overrides,
  });
}

const row = (portfolio, id) => portfolio.rows.find((r) => r.id === id);

// ------------------------------------------------------------------- verified dates only

check("status comes from a verified end date, and an absent one is UNKNOWN not ACTIVE", () => {
  assert.equal(deriveContractStatus({ verifiedEndOn: null, alertBucket: null, today: TODAY }), "UNKNOWN");
  assert.equal(
    deriveContractStatus({ verifiedEndOn: null, alertBucket: "30", today: TODAY }),
    "UNKNOWN",
    "an alert bucket must never resurrect a contract with no verified end date",
  );
  assert.equal(deriveContractStatus({ verifiedEndOn: "2025-01-01", alertBucket: null, today: TODAY }), "EXPIRED");
  assert.equal(deriveContractStatus({ verifiedEndOn: "2030-01-01", alertBucket: null, today: TODAY }), "ACTIVE");
  for (const bucket of RENEWAL_BUCKETS) {
    const status = deriveContractStatus({ verifiedEndOn: "2026-10-01", alertBucket: bucket, today: TODAY });
    assert.equal(status, bucket, `bucket ${bucket} must be reflected verbatim in the status`);
  }
  // A bucket value the enum does not contain cannot leak into the UI as a status.
  assert.equal(deriveContractStatus({ verifiedEndOn: "2030-01-01", alertBucket: "45", today: TODAY }), "ACTIVE");
  assert.ok(!isRenewalBucket("45"));
  assert.ok(!isRenewalBucket(null));
});

check("the six buckets are exactly the ones refresh_contract_alerts computes, most urgent first", () => {
  assert.deepEqual([...RENEWAL_BUCKETS], ["EXPIRED", "30", "60", "90", "120", "180"]);
  assert.match(RENEWAL_BUCKET_DEFINITION, /verified_end_on − current_date|verified_end_on/);
  assert.match(RENEWAL_BUCKET_DEFINITION, /under-reports rather than invents/);
  // A contract holding several buckets is counted once, in the most urgent one.
  const portfolio = portfolioFixture();
  assert.equal(row(portfolio, "c-window").bucket, "120", "120 is more urgent than 180");
  const buckets = summarizeRenewalBuckets(portfolio.rows);
  assert.equal(buckets["120"], 1);
  assert.equal(buckets["180"], 0, "the same contract must not be counted in two buckets");
  assert.equal(buckets["30"], 1);
  assert.equal(buckets.EXPIRED, 1);
  assert.equal(
    Object.values(buckets).reduce((a, b) => a + b, 0),
    3,
    "only bucketed contracts are counted; the undated one is not",
  );
});

check("an undated contract is visible, uncounted, and told to go get a date", () => {
  const portfolio = portfolioFixture();
  const undated = row(portfolio, "c-undated");
  assert.equal(undated.status, "UNKNOWN");
  assert.equal(undated.lifecycle, "UNDATED");
  assert.equal(undated.bucket, null);
  assert.equal(undated.risk.level, "UNKNOWN");
  assert.match(undated.risk.note, /not assumed low/);
  assert.match(undated.nextAction.label, /Verify an end date/);
  assert.equal(undated.nextAction.on, null);
  assert.match(undated.nextAction.basis, /verified_end_on is null/);
  assert.ok(undated.missing.includes("verified end date"));
  assert.equal(portfolio.undatedCount, 1);
  // It is excluded from the active count rather than folded into it.
  assert.equal(portfolio.activeCount, 3);
});

// ------------------------------------------------------------------------ never fabricate a value

check("a value is a named instrument or nothing — NTE and obligated are never added together", () => {
  const portfolio = portfolioFixture();
  const active = row(portfolio, "c-active");
  assert.equal(active.originalValue.amount, 1_250_000);
  assert.equal(active.originalValue.kind, "NTE_CEILING");
  assert.match(active.originalValue.basis, /awards\.amount_nte/);
  assert.match(active.originalValue.basis, /ceiling, not a spend/);
  assert.equal(active.currentValue.amount, 420_000, "the two recorded POs sum, and nothing else");
  assert.equal(active.currentValue.kind, "PO_OBLIGATED");
  assert.match(active.currentValue.basis, /purchase_orders\.total_amount across 2/);
  assert.notEqual(
    active.currentValue.amount,
    active.originalValue.amount + 420_000,
    "a ceiling and an obligation must never be summed into one number",
  );

  // No award, no POs: both values are absent and named as absent — not zero, not inherited.
  const bare = row(portfolio, "c-urgent");
  assert.equal(bare.originalValue, null);
  assert.equal(bare.currentValue, null);
  assert.ok(bare.missing.includes("original value"));
  assert.ok(bare.missing.includes("current value"));
  assert.match(CONTRACT_VALUE_ABSENT_NOTE, /no contract-value column/);
  assert.match(CONTRACT_VALUE_ABSENT_NOTE, /Amendments record no amount/);
  assert.deepEqual(Object.keys(CONTRACT_VALUE_KIND_LABELS).sort(), ["NTE_CEILING", "PO_OBLIGATED"]);
});

check("a null or non-numeric amount is absent, never coerced to zero", () => {
  const portfolio = buildContractPortfolio({
    today: TODAY,
    contracts: [contract({ id: "c-1", opportunity_id: "o-1", verified_end_on: "2030-01-01" })],
    awards: [
      { id: "a", opportunity_id: "o-1", amount_nte: null, awarded_on: null, notice: null, source_fact_id: null, source_document_id: null },
    ],
    purchaseOrders: [{ id: "po", contract_id: "c-1", po_number: "PO", issued_on: null, total_amount: null }],
  });
  const only = portfolio.rows[0];
  assert.equal(only.originalValue, null, "a null NTE must not become $0");
  assert.equal(only.currentValue, null, "a PO with no total must not become $0");
});

check("Active Contract Value is withheld unless every active contract carries an amount", () => {
  const partial = portfolioFixture().activeContractValue;
  assert.equal(partial.amount, null, "a partial sum would read as the whole portfolio");
  assert.equal(partial.covered, 1);
  assert.equal(partial.inScope, 3);
  assert.match(partial.withheldReason, /only 1 of 3 active contracts/);
  assert.match(partial.withheldReason, /no contract-value column/);

  const full = totalActiveContractValue([
    { lifecycle: "ACTIVE", originalValue: { amount: 100, kind: "NTE_CEILING", basis: "x" } },
    { lifecycle: "EXPIRING", originalValue: { amount: 250, kind: "NTE_CEILING", basis: "x" } },
    { lifecycle: "CLOSED", originalValue: { amount: 9_999, kind: "NTE_CEILING", basis: "x" } },
    { lifecycle: "UNDATED", originalValue: { amount: 9_999, kind: "NTE_CEILING", basis: "x" } },
  ]);
  assert.equal(full.amount, 350, "closed and undated contracts are out of scope for an active total");
  assert.equal(full.withheldReason, null);
  assert.match(full.basis, /ceiling total, not revenue/);

  const empty = totalActiveContractValue([]);
  assert.equal(empty.amount, null);
  assert.match(empty.withheldReason, /nothing in scope to value/);
});

check("the portfolio page prints the withheld reason rather than a number it cannot support", () => {
  assert.match(sources.portfolio, /data-testid="active-contract-value"/);
  assert.match(sources.portfolio, /data-testid="active-contract-value-withheld"/);
  assert.match(sources.portfolio, /value\.withheldReason/);
  assert.ok(
    !/withheldReason \?\? 0|value\.amount \?\? 0|amount \|\| 0/.test(sources.portfolio),
    "a withheld value must never fall back to zero",
  );
  // Both money columns render an Absent marker rather than a bare zero.
  assert.match(sources.portfolioTable, /function Absent/);
  assert.match(sources.portfolioTable, /what="awards\.amount_nte"/);
  assert.match(sources.portfolioTable, /what="purchase_orders\.total_amount"/);
  assert.ok(!/toLocaleString\(\) : "\$0"/.test(sources.portfolioTable));
});

// ----------------------------------------------------------------- next action, risk, ordering

check("the next action restates the soonest date on file and names the field it came from", () => {
  const portfolio = portfolioFixture();

  // An option exercise-by that is sooner than the end date wins, and past options do not.
  const window = row(portfolio, "c-window");
  assert.equal(window.nextAction.on, "2026-10-01");
  assert.match(window.nextAction.label, /Option decision — Option year 2 by 2026-10-01/);
  assert.match(window.nextAction.basis, /contract_options\.exercise_by/);
  assert.equal(window.nextOptionExerciseBy, "2026-10-01", "a 2024 exercise-by date is history, not an action");

  // A renewal notice due before the end date wins over the bucket sentence.
  const urgent = row(portfolio, "c-urgent");
  assert.equal(urgent.nextAction.on, "2026-08-25");
  assert.match(urgent.nextAction.label, /Renewal \/ termination notice due 2026-08-25/);
  assert.match(urgent.nextAction.basis, /renewals\.notice_due_on/);

  const expired = row(portfolio, "c-expired");
  assert.match(expired.nextAction.label, /Expired 2025-06-30/);
  assert.match(expired.nextAction.basis, /already passed/);

  const active = row(portfolio, "c-active");
  assert.match(active.nextAction.label, /No dated obligation inside the 180-day window/);
});

check("risk is a read of the verified date, never a score", () => {
  const portfolio = portfolioFixture();
  assert.equal(row(portfolio, "c-expired").risk.level, "OVERDUE");
  assert.equal(row(portfolio, "c-urgent").risk.level, "ACT_NOW");
  assert.equal(row(portfolio, "c-window").risk.level, "WATCH");
  assert.equal(row(portfolio, "c-active").risk.level, "NONE");
  assert.equal(row(portfolio, "c-undated").risk.level, "UNKNOWN");
  assert.ok(
    !/probability|likelihood|score|confidence/i.test(sources.modelLib.replace(/confidence interval/gi, "")),
    "risk must not be expressed as a probability or a score",
  );
});

check("rows are ordered by the soonest dated obligation, undated last, deterministically", () => {
  const ids = portfolioFixture().rows.map((r) => r.id);
  assert.deepEqual(ids, ["c-expired", "c-urgent", "c-window", "c-active", "c-undated"]);
  // Same input, same order — the browser and the acceptance test cannot drift.
  assert.deepEqual(portfolioFixture().rows.map((r) => r.id), ids);
});

// ----------------------------------------------------------------------------- lanes and KPIs

check("the lanes partition the portfolio: every row lands in exactly one, and they add up", () => {
  const portfolio = portfolioFixture();
  assert.deepEqual([...PORTFOLIO_FILTERS], ["ALL", "ACTIVE", "RENEWAL_REBID", "EXPIRING", "CLOSED", "UNDATED"]);
  const lanes = PORTFOLIO_FILTERS.filter((f) => f !== "ALL");
  const sum = lanes.reduce((total, lane) => total + portfolio.counts[lane], 0);
  assert.equal(sum, portfolio.counts.ALL, "the lane counts must add up to the portfolio count");
  for (const lane of lanes) {
    const rows = filterPortfolioRows(portfolio.rows, lane);
    assert.equal(rows.length, portfolio.counts[lane], `${lane} count disagrees with its filter`);
    for (const r of rows) assert.equal(r.lifecycle, lane);
  }
  assert.equal(filterPortfolioRows(portfolio.rows, "ALL").length, portfolio.counts.ALL);
  assert.equal(portfolio.counts.ACTIVE, 1);
  assert.equal(portfolio.counts.RENEWAL_REBID, 1);
  assert.equal(portfolio.counts.EXPIRING, 1);
  assert.equal(portfolio.counts.CLOSED, 1);
  assert.equal(portfolio.counts.UNDATED, 1);
  for (const lane of PORTFOLIO_FILTERS) {
    assert.ok(PORTFOLIO_FILTER_LABELS[lane], `${lane} has no operator label`);
    assert.ok(PORTFOLIO_FILTER_DEFINITIONS[lane], `${lane} has no stated definition`);
  }
});

check("an unknown filter param falls back to ALL and never reaches the query", () => {
  assert.equal(portfolioFilterFromParam(undefined), "ALL");
  assert.equal(portfolioFilterFromParam("EXPIRING"), "EXPIRING");
  // A hand-typed URL is normalised onto a known lane; it is never passed through.
  assert.equal(portfolioFilterFromParam("expiring"), "EXPIRING");
  assert.equal(portfolioFilterFromParam(" renewal-rebid "), "RENEWAL_REBID");
  assert.equal(portfolioFilterFromParam("expiring soon"), "ALL", "a near miss is not a lane");
  assert.equal(portfolioFilterFromParam("../../etc"), "ALL");
  for (const inherited of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
    assert.equal(portfolioFilterFromParam(inherited), "ALL", `${inherited} must not be a lane`);
  }
});

check("every KPI tile carries n= and the table it was counted from", () => {
  const portfolio = portfolioFixture();
  const tiles = portfolioKpis(portfolio);
  assert.ok(tiles.length >= 5);
  for (const tile of tiles) {
    assert.match(tile.sample, /^n=\d+ contracts$/, `${tile.label} has no sample statement`);
    assert.ok(tile.source && tile.source.length > 0, `${tile.label} names no source table`);
    assert.equal(tile.basis, "OBSERVED");
  }
  assert.equal(tiles.find((t) => t.label === "Contracts on file").value, 5);
  assert.equal(tiles.find((t) => t.label === "In renewal window").value, 2);
  assert.equal(tiles.find((t) => t.label === "No verified end date").value, 1);
  assert.match(sources.portfolio, /<ObservationTiles tiles=\{tiles\} \/>/);
  assert.match(sources.portfolio, /portfolioKpis\(portfolio\)/);
  // Filtering changes the table only — the tiles are built from the whole portfolio.
  assert.match(sources.portfolio, /const rows = filterPortfolioRows\(portfolio\.rows, filter\)/);
  assert.match(sources.portfolio, /Filtering changes the table only/);
  assert.ok(
    !/portfolioKpis\(\{ *\.\.\.portfolio, rows *\}/.test(sources.portfolio),
    "the KPI denominator must not be recomputed over the filtered rows",
  );
});

// ------------------------------------------------------- portfolio is not the market radar

check("the portfolio states it is not the Market Recompete Radar, and links to it", () => {
  assert.match(LP_PORTFOLIO_VS_MARKET_RADAR_NOTE, /not the Intelligence Market Recompete Radar/);
  assert.match(LP_PORTFOLIO_VS_MARKET_RADAR_NOTE, /contracts L&P does not hold/);
  assert.match(LP_PORTFOLIO_VS_MARKET_RADAR_NOTE, /can never appear/);
  assert.equal(MARKET_RADAR_ROUTE, "/intelligence/market");
  assert.match(sources.strips, /LP_PORTFOLIO_VS_MARKET_RADAR_NOTE/);
  assert.match(sources.strips, /MARKET_RADAR_ROUTE/);
  assert.match(sources.strips, /data-testid="contracts-honesty-strip"/);
  for (const [name, src] of Object.entries(PORTFOLIO_LEVEL_SOURCES)) {
    assert.match(src, /<ContractHonestyStrip/, `${name} does not render the honesty strip`);
  }
  // The per-contract renewal tab makes the same distinction in its own words.
  assert.match(sources.renewalTab, /data-testid="renewal-vs-market-radar"/);
  assert.match(sources.renewalTab, /LP_PORTFOLIO_VS_MARKET_RADAR_NOTE/);
  assert.match(sources.renewalTab, /MARKET_RADAR_ROUTE/);
  assert.match(sources.renewalTab, /defends work L&P already holds/);
});

check("the honesty strip refuses the forecast framing the radar also refuses", () => {
  assert.match(PORTFOLIO_HONESTY_TEXT, /Verified contract instruments only/);
  assert.match(PORTFOLIO_HONESTY_TEXT, /never from a term length, a start date, or a typical cycle/);
  assert.match(PORTFOLIO_HONESTY_TEXT, /undated rather than assumed active/);
  for (const [name, src] of Object.entries({ ...PORTFOLIO_LEVEL_SOURCES, ...CONTRACT_TAB_SOURCES, model: sources.modelLib })) {
    assert.ok(
      !/market share|share of (the )?market|TAM\b/i.test(src),
      `${name} states a share of a market`,
    );
    assert.ok(
      !/(projected|forecast(ed)?|estimated) (value|renewal|expiration|end date)/i.test(src),
      `${name} projects a contract term`,
    );
  }
});

check("Portfolio, Renewals and Compliance are reachable from each other", () => {
  assert.equal(PORTFOLIO_ROUTE, "/contracts");
  assert.equal(RENEWALS_ROUTE, "/contracts/renewals");
  assert.equal(COMPLIANCE_ROUTE, "/contracts/compliance");
  assert.match(sources.portfolio, /RENEWALS_ROUTE/);
  assert.match(sources.portfolio, /COMPLIANCE_ROUTE/);
  assert.match(sources.renewals, /PORTFOLIO_ROUTE/);
  assert.match(sources.renewals, /COMPLIANCE_ROUTE/);
  assert.match(sources.compliance, /PORTFOLIO_ROUTE/);
  assert.match(sources.compliance, /RENEWALS_ROUTE/);
  for (const [name, src] of Object.entries(PORTFOLIO_LEVEL_SOURCES)) {
    assert.match(src, /<ContractsNav \/>/, `${name} does not render the contracts section nav`);
  }
  // P1 demoted Renewals/Compliance out of the tab set on purpose; they must not creep back in as
  // sidebar-level peers, and Contracts stays a single sidebar entry.
  const contractTabs = [...sources.sectionTabs.matchAll(/\{ href: "(\/contracts[a-z/-]*)", label:/g)].map((m) => m[1]);
  assert.deepEqual(contractTabs, ["/contracts"], "CONTRACTS_TABS must stay Portfolio only (P1 gate A3)");
});

// ------------------------------------------------------------------------ contract workspace

check("the five workspace tabs survive and each one renders", () => {
  for (const label of ["Overview", "Service Plan", "Commercial Terms", "Changes", "Renewal"]) {
    assert.ok(sources.workspaceTabs.includes(`"${label}"`), `${label} tab is missing`);
  }
  assert.equal(Object.keys(CONTRACT_TAB_SOURCES).length, 5);
  for (const [slug, src] of Object.entries(CONTRACT_TAB_SOURCES)) {
    assert.ok(src.length > 0, `${slug} page is empty`);
  }
});

check("Overview is dense, links award and pursuit, and shows its source evidence", () => {
  for (const field of [
    "Buyer",
    "Contract #",
    "Status",
    "Performance dates",
    "Original value",
    "Current value",
    "Vehicle / federal ID",
    "Options on file",
    "Risk",
    "Next action",
  ]) {
    assert.ok(sources.overview.includes(field), `Overview is missing ${field}`);
  }
  assert.match(sources.overview, /Award & pursuit lineage/);
  assert.match(sources.overview, /procurement\/opportunities\/\$\{opportunity\.id\}/);
  assert.match(sources.overview, /\/result/);
  assert.match(sources.overview, /Source evidence/);
  assert.match(sources.overview, /row\.sources\.map/);
  assert.match(sources.overview, /No source document or fact is recorded/);
  assert.match(sources.overview, /row\.missing/);
  // The header is built by the same pure model as the portfolio row.
  assert.match(sources.overview, /buildContractPortfolio\(/);
});

check("Service Plan keeps its rows and now links each one to its source", () => {
  assert.match(sources.servicePlan, /loadContractServicePlans/);
  assert.match(sources.servicePlan, /Supervisors, substitutes/);
  assert.match(sources.servicePlan, /source_document_id/);
  assert.match(sources.servicePlan, /ingestion\/verification\/\$\{row\.source_document_id\}/);
  assert.match(sources.servicePlan, /Pursuit staffing \(reference\)/);
  assert.match(sources.servicePlan, /not a substitute for contract service-plan/);
});

check("Commercial Terms labels the four truths and is honest about precedence", () => {
  assert.deepEqual(
    [...FOUR_COMMERCIAL_TRUTHS],
    ["requested (buyer)", "submitted (L&P)", "awarded (buyer)", "current / amended"],
  );
  assert.match(FOUR_TRUTHS_NOTE, /never merged into one price/);
  assert.match(FOUR_TRUTHS_NOTE, /never defaults to the awarded value/);
  assert.match(sources.commercial, /FOUR_COMMERCIAL_TRUTHS/);
  assert.match(sources.commercial, /FOUR_TRUTHS_NOTE/);
  assert.match(sources.commercial, /<FourTruthsTable/);
  // Current / amended is built from purchase orders only, never from the award.
  assert.match(sources.commercial, /Current \/ amended/);
  assert.match(sources.commercial, /purchase_orders\.total_amount/);
  assert.ok(
    !/currentAmended = .*amount_nte/.test(sources.commercial),
    "current / amended must never fall back to the award NTE",
  );
  assert.equal(COMMERCIAL_PRECEDENCE.length, 5);
  assert.match(COMMERCIAL_PRECEDENCE_NOTE, /reading order, not an automatic overwrite/);
  assert.match(COMMERCIAL_PRECEDENCE_NOTE, /absent rather than carried forward/);
  assert.match(sources.commercial, /COMMERCIAL_PRECEDENCE_NOTE/);
  assert.match(sources.commercial, /data-testid="commercial-precedence"/);
});

// ---------------------------------------------------------------------------- change timeline

check("the change timeline runs Original -> Amendment -> Mod -> Option -> Renewal", () => {
  assert.deepEqual([...CHANGE_TIMELINE_KINDS], ["ORIGINAL", "AMENDMENT", "MODIFICATION", "OPTION", "RENEWAL"]);
  const timeline = buildChangeTimeline({
    contract: { start_on: "2024-01-01", source_fact_id: "f-c", source_document_id: "d-c" },
    award: {
      id: "a",
      opportunity_id: "o",
      amount_nte: 500_000,
      awarded_on: "2023-12-01",
      notice: "Board minute 23-4",
      source_fact_id: "f-a",
      source_document_id: "d-a",
    },
    amendments: [
      { id: "am1", contract_id: "c", amendment_number: "A-01", title: "Add site", note: "New post", effective_on: "2024-06-01", source_document_id: "d-am1" },
      { id: "am2", contract_id: "c", amendment_number: "P00002", title: "Mod for wage determination", note: "WD update", effective_on: "2025-02-01", source_fact_id: "f-am2" },
    ],
    options: [{ id: "op1", contract_id: "c", label: "Option year 1", exercise_by: "2025-10-01", source_fact_id: "f-op" }],
    renewalNotices: [
      { id: "r1", contract_id: "c", notice: "Renewal notice", notice_due_on: "2026-01-01", option_year: 2, escalation_index: "CPI-U", escalation_pct: 3.2, source_fact_id: "f-r" },
    ],
  });
  assert.deepEqual(
    timeline.map((e) => e.kind),
    ["ORIGINAL", "AMENDMENT", "MODIFICATION", "OPTION", "RENEWAL"],
  );
  assert.deepEqual(timeline.map((e) => e.on), ["2023-12-01", "2024-06-01", "2025-02-01", "2025-10-01", "2026-01-01"]);
  assert.match(timeline[0].detail, /NTE ceiling \$500,000/);
  assert.match(timeline[4].detail, /option year 2 · index CPI-U · 3\.2%/);
  // Every entry can be traced, and an entry with no source says so rather than borrowing one.
  for (const entry of timeline) {
    assert.ok(entry.sources.length > 0, `${entry.kind} entry has no source`);
  }
  assert.equal(timeline[0].sources[0].href, "/ingestion/verification/d-a");
  assert.equal(timeline[2].sources[0].href, null, "a fact-only source must not pretend to be a link");
});

check("the timeline is append-only and an undated instrument is not silently placed", () => {
  assert.match(CHANGE_HISTORY_APPEND_ONLY_NOTE, /append-only/);
  assert.match(CHANGE_HISTORY_APPEND_ONLY_NOTE, /never overwrites, edits, or hides/);
  assert.match(CHANGE_HISTORY_APPEND_ONLY_NOTE, /stays readable after it is superseded/);
  const timeline = buildChangeTimeline({
    contract: null,
    amendments: [
      { id: "late", contract_id: "c", amendment_number: "A-02", title: null, note: null, effective_on: "2026-01-01" },
      { id: "undated", contract_id: "c", amendment_number: "A-03", title: null, note: null, effective_on: null },
      { id: "early", contract_id: "c", amendment_number: "A-01", title: null, note: null, effective_on: "2024-01-01" },
    ],
  });
  assert.deepEqual(timeline.map((e) => e.key), ["amendment:early", "amendment:late", "amendment:undated"]);
  assert.equal(timeline[2].undated, true);
  assert.equal(timeline[2].sources.length, 0);
  // Nothing in the model mutates or drops an earlier instrument.
  assert.ok(
    !/\.splice\(|delete .*amendment|supersede\(/.test(sources.modelLib),
    "the timeline builder must not remove history",
  );
  assert.match(sources.changes, /buildChangeTimeline/);
  assert.match(sources.changes, /CHANGE_HISTORY_APPEND_ONLY_NOTE/);
  assert.match(sources.changes, /data-testid="change-timeline"/);
  assert.match(sources.changes, /No source recorded for this entry/);
});

check("an option row never implies it was exercised", () => {
  const timeline = buildChangeTimeline({
    contract: null,
    options: [
      { id: "o1", contract_id: "c", label: "OY1", exercise_by: "2025-01-01" },
      { id: "o2", contract_id: "c", label: "OY2", exercise_by: null },
    ],
  });
  assert.match(timeline[0].detail, /exercised vs remaining is not recorded and is not assumed/);
  assert.match(timeline[1].detail, /not assumed/);
  for (const src of [sources.renewalTab, sources.changes, sources.portfolioTable, sources.overview]) {
    if (/option/i.test(src)) {
      assert.match(src, /not assumed|not inferred as exercised/, "options must not imply an exercise");
    }
  }
});

// ------------------------------------------------------------------- renewal / rebid center

check("the renewal queue is built from buckets and lists the next dated obligation", () => {
  assert.match(sources.renewals, /refresh_contract_alerts/);
  assert.match(sources.renewals, /row\.bucket != null/);
  assert.match(sources.renewals, /<RenewalBucketStrip/);
  assert.match(sources.renewals, /next_action: row\.nextAction\.label/);
  assert.match(sources.portfolioTable, /data-testid="renewal-queue-table"/);
  assert.match(sources.portfolioTable, /header: "Next action"/);
  // A contract that could not be bucketed is surfaced rather than quietly dropped.
  assert.match(sources.renewals, /could not be bucketed/);
  assert.match(sources.renewals, /filter=UNDATED/);
  assert.match(sources.renewals, /not assumed safe/);
});

check("compliance readiness is advisory, and an empty list is unknown rather than clear", () => {
  const unknown = assessRebidReadiness({ compliance: [], today: TODAY });
  assert.equal(unknown.level, "UNKNOWN");
  assert.match(unknown.headline, /readiness unknown, not clear/);

  const expired = assessRebidReadiness({
    today: TODAY,
    compliance: [
      { id: "1", kind: "LICENSE", statement: "State licence", expires_on: "2025-01-01" },
      { id: "2", kind: "INSURANCE", statement: "COI", expires_on: "2026-09-15" },
      { id: "3", kind: "CERT", statement: "SAM registration", expires_on: null },
    ],
  });
  assert.equal(expired.level, "REVIEW_REQUIRED");
  assert.equal(expired.expired.length, 1);
  assert.equal(expired.expiringSoon.length, 1);
  assert.equal(expired.undated.length, 1, "an item with no expiry is tracked, not treated as valid forever");
  assert.match(expired.headline, /expired — review before rebid/);

  const clean = assessRebidReadiness({
    today: TODAY,
    compliance: [{ id: "1", kind: "LICENSE", statement: "State licence", expires_on: "2030-01-01" }],
  });
  assert.equal(clean.level, "NO_EXPIRED_ITEMS");
  assert.match(clean.headline, /No expired compliance items among the 1 on file/);
  assert.ok(!/eligible|approved|ready to bid/i.test(clean.headline), "readiness must never read as an approval");

  assert.match(READINESS_ADVISORY_NOTE, /does not certify eligibility/);
  assert.match(READINESS_ADVISORY_NOTE, /does not gate the rebid button/);
  assert.match(READINESS_ADVISORY_NOTE, /an empty list means nothing has been recorded/);
  assert.match(sources.renewalTab, /assessRebidReadiness/);
  assert.match(sources.renewalTab, /data-testid="rebid-readiness"/);
});

// ------------------------------------------------------------------------- Start Rebid Pursuit

check("the CTA is 'Start Rebid Pursuit' and it copies no pricing forward", () => {
  assert.equal(REBID_CTA_LABEL, "Start Rebid Pursuit");
  assert.match(sources.rebidButton, /REBID_CTA_LABEL/);
  assert.match(sources.rebidButton, /data-testid="start-rebid-pursuit"/);
  assert.ok(
    !/Start rebid workspace/.test(sources.rebidButton),
    "the old ambiguous label must be gone",
  );
  assert.match(REBID_CTA_NOTE, /no pricing is copied/);
  assert.match(REBID_CTA_NOTE, /must be re-verified/);
  assert.match(sources.renewalTab, /REBID_CTA_NOTE/);
});

check("cloneRebidFromContract survives, links lineage, and inserts no rate", () => {
  assert.match(sources.actions, /export async function cloneRebidFromContract/);
  assert.match(sources.actions, /rebid_from_contract_id: contract\.id/);
  assert.match(sources.actions, /rebid_from_opportunity_id: contract\.opportunity_id/);
  assert.match(sources.actions, /stage: "INTAKE"/);
  assert.match(sources.actions, /go_no_go: "PENDING"/);
  assert.match(sources.actions, /No pricing copied/);
  // The insert touches `opportunities` only; no pricing, award or contract table is written.
  const insertTargets = [...sources.actions.matchAll(/\.from\("([a-z_]+)"\)\s*\n\s*\.insert/g)].map((m) => m[1]);
  assert.deepEqual(insertTargets, ["opportunities"]);
  // Table access, not the revalidatePath("/contracts/renewals") string, is what matters here.
  const touchedTables = [...sources.actions.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]);
  for (const forbidden of ["pricing_lines", "competitor_bids", "awards", "contract_amendments", "renewals"]) {
    assert.ok(!touchedTables.includes(forbidden), `the rebid action must not touch ${forbidden}`);
  }
  assert.deepEqual([...new Set(touchedTables)].sort(), ["contracts", "memberships", "opportunities"]);
  // The rebid is discoverable from the contract it defends.
  assert.match(sources.loader, /rebid_from_contract_id/);
  assert.match(sources.renewalTab, /linked by rebid_from_contract_id/);
});

// ------------------------------------------------------------------------------- automation

check("the automation strip states the job, the schedule, and when buckets were last computed", () => {
  const audited = automationAudit({ alertsComputedOn: "2026-08-21T06:15:00Z", refreshedOnLoad: true });
  assert.equal(audited.job, ALERT_CRON_JOB);
  assert.equal(audited.job, "refresh-contract-alerts");
  assert.match(ALERT_CRON_SCHEDULE, /15 6 \* \* \*/);
  assert.match(audited.lastRefreshLabel, /Buckets last computed 2026-08-21T06:15:00Z/);
  assert.match(audited.onLoadNote, /called on load/);

  const never = automationAudit({ alertsComputedOn: null, refreshedOnLoad: false });
  assert.match(never.lastRefreshLabel, /No alert row has been computed yet/);
  assert.match(never.onLoadNote, /Not refreshed on this view/);

  // The latest computed_on across alert rows is what the strip reports.
  assert.equal(portfolioFixture().alertsComputedOn, "2026-08-21T06:15:00Z");

  assert.match(sources.strips, /data-testid="contracts-automation-audit"/);
  assert.match(sources.portfolio, /<AutomationAuditStrip/);
  assert.match(sources.renewals, /<AutomationAuditStrip/);
  assert.match(sources.renewalTab, /<AutomationAuditStrip/);
});

check("no automation renews, approves or submits — and the app says so", () => {
  assert.match(AUTOMATION_SCOPE_NOTE, /recomputes bucket rows/);
  assert.match(AUTOMATION_SCOPE_NOTE, /writes no contract term, exercises no option, sends no notice, and approves nothing/);
  assert.match(NO_AUTO_ACTION_NOTE, /renews, extends, exercises an option, approves, or submits/);
  assert.match(NO_AUTO_ACTION_NOTE, /taken by a person/);
  assert.match(sources.strips, /NO_AUTO_ACTION_NOTE/);
  assert.match(sources.renewalTab, /NO_AUTO_ACTION_NOTE/);

  // The only RPC the contracts surface calls is the bucket refresh, and the only write is the
  // human-pressed rebid action.
  const allContractSources = { ...PORTFOLIO_LEVEL_SOURCES, ...CONTRACT_TAB_SOURCES, loader: sources.loader };
  for (const [name, src] of Object.entries(allContractSources)) {
    const rpcs = [...src.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]);
    for (const rpc of rpcs) {
      assert.equal(rpc, "refresh_contract_alerts", `${name} calls an unexpected RPC: ${rpc}`);
    }
    assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(src), `${name} writes from a page render`);
    assert.ok(
      !/auto.?(renew|approve|submit|exercise)/i.test(src),
      `${name} mentions an automatic renewal, approval, submission or exercise`,
    );
  }
});

// ------------------------------------------------------------------------------- reporting

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
