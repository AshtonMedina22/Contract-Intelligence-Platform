#!/usr/bin/env node
/**
 * F6 acceptance: Governed Structured Analytics + Natural-Language SQL.
 * Pure compute + validate + resolve + semantic registry. No free LLM SQL.
 * market_share must be absent. Win rate withheld below P9 sample.
 */

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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f6-${name}-`)), "out.mjs");
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

const semantic = await bundle("lib/analytics/semantic-model.ts", "semantic");
const validate = await bundle("lib/analytics/validate-sql.ts", "validate");
const resolve = await bundle("lib/analytics/resolve-question.ts", "resolve");
const compute = await bundle("lib/analytics/compute.ts", "compute");
const planMod = await bundle("lib/analytics/query-plan.ts", "plan");
const buildMod = await bundle("lib/analytics/build-query.ts", "build");
const executeMod = await bundle("lib/analytics/execute.ts", "execute");

const {
  METRICS,
  FORBIDDEN_METRIC_IDS,
  listMetricIds,
  getMetric,
  isForbiddenMetricId,
  assertJoinAllowed,
  APPROVED_JOINS,
} = semantic;
const { validateSql, shouldRejectRawSql } = validate;
const { resolveAnalyticsQuestion } = resolve;
const {
  computeWinRateDecided,
  computeMedianAwardedRate,
  computeContractExpirationCount,
  computeCompetitorFrequency,
  computeAwardedValue,
  computePursuitCount,
  median,
} = compute;
const { parseAnalyticsQueryPlan } = planMod;
const { buildAnalyticsQuery } = buildMod;
const { runStructuredAnalytics } = executeMod;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

function read(rel) {
  return fs.readFile(path.join(root, rel), "utf8");
}

// --- Registry ---
check("market_share absent from registry", () => {
  assert.ok(!listMetricIds().includes("market_share"));
  assert.ok(FORBIDDEN_METRIC_IDS.some((id) => /market_share/i.test(id)));
  assert.ok(isForbiddenMetricId("market_share"));
  assert.equal(getMetric("market_share"), undefined);
});

check("every required metric registered with definition", () => {
  const required = [
    "pursuit_count",
    "submitted_count",
    "won_count",
    "lost_count",
    "win_rate_decided",
    "submitted_value",
    "awarded_value",
    "active_contract_value",
    "recompete_win_rate",
    "median_awarded_rate",
    "contract_expiration_count",
    "competitor_frequency",
  ];
  for (const id of required) {
    const m = getMetric(id);
    assert.ok(m, `missing ${id}`);
    assert.ok(m.definition && m.definition.length > 10, `${id} needs definition`);
    assert.ok(m.grain, `${id} needs grain`);
    assert.ok(m.nullPolicy, `${id} needs nullPolicy`);
  }
  assert.equal(getMetric("submitted_value").support, "withhold");
  assert.equal(getMetric("active_contract_value").support, "withhold");
  assert.ok(METRICS.length >= 12);
});

check("approved joins documented", () => {
  assert.ok(APPROVED_JOINS.length >= 8);
  assert.equal(assertJoinAllowed("pursuit", "buyer").ok, true);
  assert.equal(assertJoinAllowed("competitor", "pursuit").ok, true);
  assert.equal(assertJoinAllowed("pricing_line", "compliance").ok, false);
});

// --- Win rate fixtures ---
check("win_rate withheld below P9 sample (n=5)", () => {
  const rows = [
    ...Array.from({ length: 3 }, () => ({ outcome: "WON" })),
    ...Array.from({ length: 2 }, () => ({ outcome: "LOST" })),
  ];
  const r = computeWinRateDecided(rows);
  assert.equal(r.status, "withheld");
  assert.equal(r.rows[0].win_rate, null);
  assert.equal(r.rows[0].decided, 5);
  assert.match(String(r.rows[0].reason), /20|thin|sample/i);
});

check("win_rate zero denominator", () => {
  const r = computeWinRateDecided([{ outcome: "PENDING" }, { outcome: "NO_BID" }]);
  assert.equal(r.status, "zero_denominator");
  assert.equal(r.rows[0].win_rate, null);
  assert.equal(r.rows[0].decided, 0);
});

check("win_rate shown at n>=20", () => {
  const rows = [
    ...Array.from({ length: 12 }, () => ({ outcome: "WON" })),
    ...Array.from({ length: 8 }, () => ({ outcome: "LOST" })),
  ];
  const r = computeWinRateDecided(rows);
  assert.equal(r.status, "ok");
  assert.equal(r.rows[0].win_rate_percent, 60);
  assert.equal(r.rows[0].decided, 20);
});

// --- Median / grain ---
check("median hourly ok", () => {
  const r = computeMedianAwardedRate([
    { awarded_rate: 20, unit: "hourly" },
    { awarded_rate: 30, unit: "per hour" },
    { awarded_rate: 40, unit: "hr" },
  ]);
  assert.equal(r.status, "ok");
  assert.equal(r.rows[0].median_awarded_rate, 30);
});

check("median mixed grain refused", () => {
  const r = computeMedianAwardedRate([
    { awarded_rate: 20, unit: "hourly" },
    { awarded_rate: 200000, unit: "annual" },
  ]);
  assert.equal(r.status, "refused");
  assert.equal(r.rows[0].median_awarded_rate, null);
  assert.match(String(r.rows[0].reason), /mixed/i);
});

check("median helper", () => {
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

// --- Expiration / competitor / buyer dim ---
check("contract expiration by window", () => {
  const today = new Date();
  const in30 = new Date(today);
  in30.setUTCDate(in30.getUTCDate() + 20);
  const in200 = new Date(today);
  in200.setUTCDate(in200.getUTCDate() + 200);
  const r = computeContractExpirationCount(
    [
      { id: "1", verified_end_on: in30.toISOString().slice(0, 10) },
      { id: "2", verified_end_on: in200.toISOString().slice(0, 10) },
      { id: "3", verified_end_on: null },
    ],
    { windowDays: 90 },
  );
  assert.equal(r.status, "ok");
  assert.equal(r.rows[0].count, 1);
});

check("competitor frequency", () => {
  const r = computeCompetitorFrequency([
    { competitor_id: "a", competitors: { name: "Alpha" } },
    { competitor_id: "a", competitors: { name: "Alpha" } },
    { competitor_id: "b", competitors: { name: "Beta" } },
  ]);
  assert.equal(r.rows[0].competitor_name, "Alpha");
  assert.equal(r.rows[0].count, 2);
});

check("pursuit_count by buyer_name dimension", () => {
  const r = computePursuitCount(
    [
      { id: "1", clients: { name: "ISD A" } },
      { id: "2", clients: { name: "ISD A" } },
      { id: "3", clients: { name: "City B" } },
    ],
    ["buyer_name"],
  );
  assert.equal(r.rows.length, 2);
});

check("awarded_value withhold incomplete coverage", () => {
  const r = computeAwardedValue([{ amount_nte: 100 }, { amount_nte: null }]);
  assert.equal(r.status, "withheld");
  assert.equal(r.rows[0].awarded_value, null);
});

// --- SQL validator adversarial ---
check("reject DROP", () => {
  const v = validateSql("DROP TABLE opportunities");
  assert.equal(v.ok, false);
});

check("reject UPDATE", () => {
  assert.equal(validateSql("UPDATE opportunities SET title='x'").ok, false);
});

check("reject multi-statement", () => {
  assert.equal(validateSql("SELECT 1; SELECT 2").ok, false);
});

check("reject unknown table", () => {
  assert.equal(validateSql("SELECT * FROM auth.users").ok, false);
  assert.equal(validateSql("SELECT * FROM secrets").ok, false);
});

check("reject dangerous function", () => {
  assert.equal(validateSql("SELECT pg_sleep(10)").ok, false);
});

check("reject injection-ish DDL", () => {
  assert.ok(shouldRejectRawSql("SELECT 1; DROP TABLE contracts;--"));
});

check("empty sql ok (no raw)", () => {
  assert.equal(validateSql("").ok, true);
  assert.equal(validateSql(null).ok, true);
});

// --- Plan / resolve ---
check("unknown metric refused", () => {
  const p = parseAnalyticsQueryPlan({ metricId: "not_a_metric", dimensions: [], filters: {} });
  assert.equal(p.ok, false);
});

check("market_share plan refused", () => {
  const p = parseAnalyticsQueryPlan({ metricId: "market_share", dimensions: [], filters: {} });
  assert.equal(p.ok, false);
});

check("fabricated join refused", () => {
  const j = assertJoinAllowed("award", "compliance");
  assert.equal(j.ok, false);
});

check("ambiguous question refuses", () => {
  const r = resolveAnalyticsQuestion({ question: "tell me about the market" });
  assert.equal(r.ok, false);
  assert.ok(r.refuse);
});

check("market share question refused", () => {
  const r = resolveAnalyticsQuestion({ question: "What is our market share?" });
  assert.equal(r.ok, false);
  assert.match(r.message, /market_share/i);
});

check("win rate question resolves", () => {
  const r = resolveAnalyticsQuestion({ question: "What is our win rate?" });
  assert.equal(r.ok, true);
  assert.equal(r.metric.id, "win_rate_decided");
});

check("build-query fingerprint stable", () => {
  const a = buildAnalyticsQuery({
    metricId: "pursuit_count",
    dimensions: [],
    filters: {},
    limit: 100,
  });
  const b = buildAnalyticsQuery({
    metricId: "pursuit_count",
    dimensions: [],
    filters: {},
    limit: 100,
  });
  assert.ok(!("error" in a));
  assert.equal(a.fingerprint, b.fingerprint);
});

// --- execute refuses raw SQL even if SELECT-shaped ---
await checkAsync("execute refuses rawSql SELECT", async () => {
  const result = await runStructuredAnalytics({
    supabase: { from: () => ({ select: () => ({ limit: async () => ({ data: [], error: null }) }) }) },
    question: "How many pursuits?",
    metricId: "pursuit_count",
    rawSql: "SELECT count(*) FROM opportunities",
    persist: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "refused_sql");
});

await checkAsync("execute withhold submitted_value", async () => {
  const result = await runStructuredAnalytics({
    supabase: { from: () => ({}) },
    metricId: "submitted_value",
    question: "submitted value",
    persist: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "withheld");
  assert.equal(result.metricId, "submitted_value");
});

await checkAsync("execute withhold active_contract_value", async () => {
  const result = await runStructuredAnalytics({
    supabase: { from: () => ({}) },
    metricId: "active_contract_value",
    persist: false,
  });
  assert.equal(result.status, "withheld");
});

await checkAsync("execute cross-org not applicable — RLS client only (no service role path)", async () => {
  // Guard: execute module must not import service-role / secret key clients.
  const src = await read("apps/web/lib/analytics/execute.ts");
  assert.ok(!/SUPABASE_SECRET|service_role|createService/.test(src));
  assert.ok(/createClient|AnalyticsSupabase|persist/.test(src));
});

// --- Ask integration greps ---
await checkAsync("Ask tool ask_structured_analytics present", async () => {
  const tools = await read("apps/web/lib/ask/tools.ts");
  const agent = await read("apps/web/lib/ask/agent.ts");
  assert.ok(/ask_structured_analytics/.test(tools));
  assert.ok(/ask_structured_analytics/.test(agent));
  assert.ok(/never invent market share/i.test(agent) || /Never invent market share/.test(agent));
  assert.ok(!/create second chat|AskChatClient/.test(await read("apps/web/lib/analytics/execute.ts")));
});

await checkAsync("migration analytical_runs exists", async () => {
  const mig = await read("supabase/migrations/20260821240000_f6_analytical_runs.sql");
  assert.ok(/create table public\.analytical_runs/.test(mig));
  assert.ok(/enable row level security/.test(mig));
  assert.ok(/is_org_member/.test(mig));
});

await checkAsync("acceptance + wrenai docs exist", async () => {
  await fs.access(path.join(root, "docs/functionality/F6_STRUCTURED_ANALYTICS_ACCEPTANCE.md"));
  await fs.access(path.join(root, "docs/reference-repos/wrenai.md"));
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.message ? ` — ${r.message}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
