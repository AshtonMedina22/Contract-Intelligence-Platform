#!/usr/bin/env node
// F5 acceptance: Recompete Radar + Contract Expiration Opportunity Engine.
// Hardens P9 radar + P10 renewals. Never invents dates. Never mixes L&P into Market.
// Start Rebid copies no pricing. External Start Pursuit is AI_EXTRACTED only.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const webRoot = path.resolve(import.meta.dirname, "../apps/web");
const root = path.resolve(import.meta.dirname, "..");

async function bundle(entryRel, name) {
  const entry = path.join(webRoot, entryRel);
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f5-${name}-`)), "out.mjs");
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "warning",
    alias: { "@": webRoot },
    loader: { ".json": "json" },
  });
  return import(pathToFileURL(outfile).href);
}

async function readSource(...parts) {
  return fs.readFile(path.join(...parts), "utf8");
}

const radarMod = await bundle("lib/intelligence/recompete-radar.ts", "radar");
const modelMod = await bundle("lib/contracts/portfolio-model.ts", "portfolio");

const {
  buildRecompeteRadar,
  filterRadarRows,
  isLandPName,
  RECOMPETE_WATCH_STATUSES,
  MARKET_START_PURSUIT_NOTE,
  LP_RENEWALS_SCOPE_NOTE,
  MARKET_RADAR_SCOPE_NOTE,
} = radarMod;

const {
  RENEWAL_BUCKETS,
  assessOptionsRemaining,
  assessRebidReadiness,
  ALERT_DEDUPE_UNIQUE_KEY,
  ALERT_DEDUPE_NOTE,
  OPTION_NOT_ASSUMED_EXERCISED_NOTE,
  REBID_NO_PRICING_OR_REQUIREMENTS_COPY,
  buildContractPortfolio,
} = modelMod;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

const sources = {
  actions: await readSource(webRoot, "app/(platform)/contracts/actions.ts"),
  marketActions: await readSource(webRoot, "app/(platform)/intelligence/market/actions.ts"),
  renewalTab: await readSource(webRoot, "app/(platform)/contracts/[contractId]/renewal/page.tsx"),
  renewalsPage: await readSource(webRoot, "app/(platform)/contracts/renewals/page.tsx"),
  marketPage: await readSource(webRoot, "app/(platform)/intelligence/market/page.tsx"),
  radarTable: await readSource(webRoot, "app/(platform)/intelligence/market/recompete-radar-table.tsx"),
  migration: await readSource(root, "supabase/migrations/20260821230000_f5_recompete_watches.sql"),
  phase9Alerts: await readSource(root, "supabase/migrations/20260820220000_phase9_contracts_cron.sql"),
  promote: await readSource(root, "supabase/migrations/20260820600000_verify4_promote_contract_instruments.sql"),
  radarLib: await readSource(webRoot, "lib/intelligence/recompete-radar.ts"),
  modelLib: await readSource(webRoot, "lib/contracts/portfolio-model.ts"),
};

const BUYERS = [
  { id: "b-arlington", name: "Arlington ISD" },
  { id: "b-dallas", name: "Dallas ISD" },
];

const OPPORTUNITIES = [
  {
    id: "o-arlington",
    client_id: "b-arlington",
    title: "Arlington ISD security",
    service_type: "Unarmed guard",
    site_location: "Arlington, TX",
    source_url: "https://example.test/arlington",
  },
  {
    id: "o-dallas",
    client_id: "b-dallas",
    title: "Dallas ISD campus security",
    service_type: "Unarmed guard",
    site_location: "Dallas, TX",
    source_url: null,
  },
];

function radarFixture(overrides = {}) {
  return buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    awards: [
      {
        id: "a-arlington",
        opportunity_id: "o-arlington",
        winner_name: "Securitas Security Services USA",
        awarded_on: "2024-08-01",
        notice: "Minute Order 24-118",
        source_fact_id: "f-arlington",
        source_document_id: "d-arlington-notice",
      },
    ],
    contracts: [
      {
        id: "c-dallas",
        client_id: "b-dallas",
        opportunity_id: "o-dallas",
        title: "Dallas ISD security contract",
        contract_number: "DISD-2025-114",
        start_on: "2025-07-01",
        verified_end_on: "2027-06-30",
        source_fact_id: "f-dallas",
        source_document_id: "d-dallas-contract",
      },
    ],
    contractOptions: [
      { id: "opt-1", contract_id: "c-dallas", label: "Option year 1", exercise_by: "2027-03-31", source_fact_id: "f-opt" },
    ],
    renewalNotices: [],
    winLoss: [{ opportunity_id: "o-arlington", outcome: "LOST", winner_name: "Securitas Security Services USA" }],
    ...overrides,
  });
}

// --- bucket math / missing date -------------------------------------------------

check("renewal buckets remain EXPIRED/30/60/90/120/180 from verified_end_on only", () => {
  assert.deepEqual([...RENEWAL_BUCKETS], ["EXPIRED", "30", "60", "90", "120", "180"]);
});

check("missing verified_end_on yields unknown expected rebid (never invented)", () => {
  const radar = buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    awards: [
      {
        id: "a-arlington",
        opportunity_id: "o-arlington",
        winner_name: "Securitas",
        awarded_on: "2024-08-01",
        notice: null,
        source_fact_id: "f1",
        source_document_id: null,
      },
    ],
    contracts: [],
    contractOptions: [],
    renewalNotices: [],
    winLoss: [],
  });
  assert.equal(radar.market.length, 1);
  assert.equal(radar.market[0].expectedRebid.on, null);
  assert.match(radar.market[0].expectedRebid.basis, /No verified end date/i);
});

check("verified_end_on is restated as expected rebid with named basis", () => {
  const radar = radarFixture();
  const lp = radar.lpHeld.find((r) => r.key === "contract:c-dallas");
  assert.ok(lp);
  assert.equal(lp.expectedRebid.on, "2027-06-30");
  assert.match(lp.expectedRebid.basis, /verified_end_on/);
});

// --- L&P excluded from market / market excluded from renewals KPI --------------

check("L&P-held contracts are excluded from the market list", () => {
  const radar = radarFixture();
  assert.ok(radar.lpHeld.some((r) => r.key === "contract:c-dallas"));
  assert.ok(!radar.market.some((r) => r.key === "contract:c-dallas"));
  assert.ok(radar.market.every((r) => r.holder !== "L_AND_P"));
  assert.ok(isLandPName("L&P Global Security"));
});

check("market rows never feed renewals KPI buckets (portfolio uses L&P contracts only)", () => {
  const radar = radarFixture();
  const portfolio = buildContractPortfolio({
    today: "2026-08-21",
    contracts: [
      {
        id: "c-dallas",
        client_id: "b-dallas",
        opportunity_id: "o-dallas",
        title: "Dallas ISD security contract",
        contract_number: "DISD-2025-114",
        start_on: "2025-07-01",
        verified_end_on: "2027-06-30",
        source_fact_id: "f-dallas",
        source_document_id: "d-dallas-contract",
      },
    ],
    alerts: [],
    options: [],
    renewalNotices: [],
    awards: [],
    purchaseOrders: [],
    amendments: [],
    buyers: BUYERS,
  });
  // Market competitor award is not a portfolio row and cannot inflate renewal buckets.
  assert.equal(portfolio.rows.length, 1);
  assert.ok(!portfolio.rows.some((r) => r.id === "a-arlington"));
  assert.ok(typeof portfolio.buckets.EXPIRED === "number");
  assert.match(LP_RENEWALS_SCOPE_NOTE, /excluded from the market/i);
  assert.match(MARKET_RADAR_SCOPE_NOTE, /does not hold/i);
});

check("pages carry hard distinction copy + cross-links", () => {
  assert.match(sources.renewalsPage, /renewals-vs-market-radar|L&amp;P renewals/);
  assert.match(sources.renewalsPage, /MARKET_RADAR_ROUTE|\/intelligence\/market/);
  assert.match(sources.marketPage, /market-vs-lp-renewals|Not L&amp;P renewals/);
  assert.match(sources.marketPage, /LP_RENEWALS_ROUTE|\/contracts\/renewals/);
  assert.match(sources.renewalTab, /renewal-vs-market-radar/);
});

// --- Start Rebid: no pricing copy ---------------------------------------------

check("cloneRebidFromContract inserts no pricing / requirements tables", () => {
  assert.match(sources.actions, /export async function cloneRebidFromContract/);
  assert.match(sources.actions, /No pricing copied/);
  for (const forbidden of ["pricing_lines", "competitor_bids", "awards", "contract_amendments", "requirements"]) {
    assert.ok(
      !new RegExp(`\\.from\\([\"']${forbidden}[\"']\\)`).test(sources.actions),
      `cloneRebidFromContract must not touch ${forbidden}`,
    );
  }
  assert.ok(!/\.insert\(\s*\{[^}]*rate/i.test(sources.actions));
  assert.ok(!/amount_nte|awarded_rate|unit_rate/.test(sources.actions));
});

check("renewal UI states pricing/requirements not copied as new truth + evidence links", () => {
  assert.match(sources.renewalTab, /REBID_NO_PRICING_OR_REQUIREMENTS_COPY|not copied as new truth/i);
  assert.match(sources.renewalTab, /rebid-historical-evidence/);
  assert.match(sources.renewalTab, /Prior contract/);
  assert.match(sources.renewalTab, /Buyer/);
  assert.match(sources.renewalTab, /Evaluation \/ outcome|win-loss/i);
  assert.match(REBID_NO_PRICING_OR_REQUIREMENTS_COPY, /not copied as new truth/i);
});

// --- alert upsert dedupe unique key -------------------------------------------

check("contract_alerts unique (org, contract_id, bucket) + upsert semantics = dedupe", () => {
  assert.match(sources.phase9Alerts, /unique \(organization_id, contract_id, bucket\)/);
  assert.match(sources.phase9Alerts, /on conflict \(organization_id, contract_id, bucket\)/);
  assert.match(sources.phase9Alerts, /do update set/);
  assert.equal(ALERT_DEDUPE_UNIQUE_KEY, "(organization_id, contract_id, bucket)");
  assert.match(ALERT_DEDUPE_NOTE, /upsert/i);
  assert.match(ALERT_DEDUPE_NOTE, /no daily duplicate/i);
  // No alert_events table — acceptance documents upsert = dedupe.
  assert.ok(!/create table public\.alert_events/.test(sources.migration));
  assert.ok(!/last_notified_at/.test(sources.migration));
});

check("verified_end_on change refreshes alerts (promote + F5 trigger)", () => {
  assert.match(sources.promote, /verified_end_on/);
  assert.match(sources.promote, /refresh_contract_alerts/);
  assert.match(sources.migration, /contracts_verified_end_refresh_alerts/);
  assert.match(sources.migration, /update of verified_end_on/);
  assert.match(sources.migration, /refresh_contract_alerts/);
});

check("automation never auto-creates pursuits from alerts or watches", () => {
  assert.match(sources.migration, /never auto-creates pursuits/i);
  assert.ok(!/insert into public\.opportunities/.test(sources.migration));
  assert.ok(!/insert into public\.opportunities/.test(sources.phase9Alerts));
  assert.match(sources.modelLib, /never creates pursuits/i);
});

// --- external Start Pursuit never HUMAN_VERIFIED --------------------------------

check("startPursuitFromRecompeteCandidate never HUMAN_VERIFIED and never cloneRebid", () => {
  assert.match(sources.marketActions, /export async function startPursuitFromRecompeteCandidate/);
  assert.match(sources.marketActions, /verification_status:\s*[\"']AI_EXTRACTED[\"']/);
  assert.ok(!/HUMAN_VERIFIED/.test(sources.marketActions));
  assert.ok(
    !/import\s*\{[^}]*cloneRebidFromContract|await\s+cloneRebidFromContract|cloneRebidFromContract\s*\(/.test(
      sources.marketActions,
    ),
    "must not import or call cloneRebidFromContract",
  );
  assert.match(sources.marketActions, /response_due_on:\s*null/);
  assert.match(sources.marketActions, /rebid_from_contract_id:\s*null/);
  assert.match(MARKET_START_PURSUIT_NOTE, /never invents a due date/i);
  assert.match(sources.radarTable, /startPursuitFromRecompeteAndOpen|Watch/);
});

check("recompete_watches statuses cover WATCHING|READY_FOR_CAPTURE|PURSUIT_STARTED|DISMISSED|STALE", () => {
  assert.deepEqual([...RECOMPETE_WATCH_STATUSES], [
    "WATCHING",
    "READY_FOR_CAPTURE",
    "PURSUIT_STARTED",
    "DISMISSED",
    "STALE",
  ]);
  assert.match(sources.migration, /create table if not exists public\.recompete_watches/);
  assert.match(sources.migration, /unique \(organization_id, candidate_key\)/);
  assert.match(sources.marketActions, /onConflict:\s*[\"']organization_id,candidate_key[\"']/);
});

// --- option not assumed exercised ---------------------------------------------

check("options remaining is UNKNOWN — not assumed exercised", () => {
  const assessment = assessOptionsRemaining([
    { id: "1", label: "OY1", exercise_by: "2027-01-01" },
    { id: "2", label: "OY2", exercise_by: null },
  ]);
  assert.equal(assessment.remaining, "UNKNOWN");
  assert.equal(assessment.onFile, 2);
  assert.match(OPTION_NOT_ASSUMED_EXERCISED_NOTE, /not assumed/i);
  assert.match(sources.renewalTab, /not assumed exercised/i);
  assert.match(sources.renewalTab, /options-remaining-value/);
  assert.match(sources.renewalTab, /UNKNOWN/);
});

check("rebid readiness strip still advisory (empty = unknown, not clear)", () => {
  const unknown = assessRebidReadiness({ compliance: [], today: "2026-08-21" });
  assert.equal(unknown.level, "UNKNOWN");
  assert.match(unknown.headline, /unknown, not clear/i);
  assert.match(sources.renewalTab, /assessRebidReadiness/);
});

check("filterRadarRows drops undated rows when a date window is set (never invents)", () => {
  const radar = radarFixture({
    contracts: [
      {
        id: "c-undated",
        client_id: "b-dallas",
        opportunity_id: null,
        title: "Undated competitor-held",
        contract_number: null,
        start_on: null,
        verified_end_on: null,
        source_fact_id: null,
        source_document_id: null,
      },
    ],
    awards: [
      {
        id: "a-arlington",
        opportunity_id: "o-arlington",
        winner_name: "Securitas",
        awarded_on: "2024-08-01",
        notice: null,
        source_fact_id: "f1",
        source_document_id: "d1",
      },
    ],
    winLoss: [],
  });
  // Undated L&P-looking? No award naming L&P and no win — holder UNKNOWN → market.
  const filtered = filterRadarRows(radar.market, { from: "2020-01-01", to: "2030-01-01" });
  assert.ok(filtered.every((r) => r.expectedRebid.on != null));
});

// --- report --------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `\n       ${r.message}`}`);
}
console.log(`\nF5 recompete radar: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
