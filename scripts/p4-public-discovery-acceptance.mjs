#!/usr/bin/env node
// P4 acceptance: public opportunity discovery normalization + fixture provider honesty.
//
// Runs without network or database access. Node's native TypeScript support loads the provider
// modules directly so the test exercises the same code the app uses.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const webRoot = path.resolve(import.meta.dirname, "../apps/web");
const entry = path.join(webRoot, "lib/procurement/providers/index.ts");
const outfile = path.join(
  await fs.mkdtemp(path.join(os.tmpdir(), "lp-p4-")),
  "providers.mjs",
);

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
  normalizePublicOpportunity,
  toIsoDate,
  toProviderAmount,
  applyLocalFilters,
  createSamGovProvider,
  loadSamFixtures,
  isSamGovLive,
  normalizeManualEntry,
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
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

check("toIsoDate accepts ISO, ISO datetime, and US dates", () => {
  assert.equal(toIsoDate("2026-09-18"), "2026-09-18");
  assert.equal(toIsoDate("2026-09-18T17:00:00-05:00"), "2026-09-18");
  assert.equal(toIsoDate("09/18/2026"), "2026-09-18");
  assert.equal(toIsoDate(""), null);
  assert.equal(toIsoDate("not a date"), null);
  assert.equal(toIsoDate(undefined), null);
});

check("toProviderAmount never invents a value", () => {
  assert.equal(toProviderAmount(125000), 125000);
  assert.equal(toProviderAmount("$1,250,000"), 1250000);
  assert.equal(toProviderAmount(null), null);
  assert.equal(toProviderAmount("TBD"), null);
  assert.equal(toProviderAmount(""), null);
});

check("normalizePublicOpportunity requires id and title, nulls the rest", () => {
  assert.equal(
    normalizePublicOpportunity({ provider: "fixture", external_id: "", title: "x" }),
    null,
  );
  assert.equal(
    normalizePublicOpportunity({ provider: "fixture", external_id: "x", title: "  " }),
    null,
  );
  const row = normalizePublicOpportunity({
    provider: "sam_gov",
    external_id: " ABC123 ",
    title: " Guard services ",
  });
  assert.equal(row.external_id, "ABC123");
  assert.equal(row.title, "Guard services");
  assert.equal(row.buyer_name, null);
  assert.equal(row.due_on, null);
  assert.equal(row.estimated_value, null);
  assert.deepEqual(row.raw_payload, {});
});

check("applyLocalFilters matches keywords, buyer, and NAICS prefix", () => {
  const rows = loadSamFixtures();
  assert.ok(rows.length >= 3, "expected at least 3 fixtures");
  assert.equal(applyLocalFilters(rows, { keywords: "mobile patrol" }).length, 1);
  assert.equal(applyLocalFilters(rows, { keywords: "security" }).length, 4);
  assert.equal(applyLocalFilters(rows, { naics: "5616" }).length, rows.length);
  assert.equal(applyLocalFilters(rows, { naics: "561621" }).length, 1);
  assert.equal(applyLocalFilters(rows, { buyer: "municipal" }).length, 1);
  assert.equal(applyLocalFilters(rows, { keywords: "zzz-no-match" }).length, 0);
});

check("fixtures are unmistakably sample data, not live notices", () => {
  const rows = loadSamFixtures();
  for (const row of rows) {
    assert.equal(row.provider, "fixture", `${row.external_id} must be provider=fixture`);
    assert.ok(
      row.external_id.startsWith("FIXTURE-SAM-"),
      `${row.external_id} must use a FIXTURE-SAM-* id`,
    );
    assert.match(row.title, /SAMPLE FIXTURE/, `${row.external_id} title must say SAMPLE FIXTURE`);
    assert.match(
      row.source_url ?? "",
      /^https:\/\/fixture\.invalid\//,
      `${row.external_id} must use the reserved .invalid TLD`,
    );
    assert.equal(
      row.estimated_value,
      null,
      `${row.external_id} must not carry an invented dollar value`,
    );
  }
});

await checkAsync("provider falls back to fixture mode without an API key", async () => {
  delete process.env.SAM_GOV_API_KEY;
  delete process.env.SAM_API_KEY;
  assert.equal(isSamGovLive(), false);
  const provider = createSamGovProvider();
  assert.equal(provider.id, "fixture");
  assert.equal(provider.mode, "fixture");
  assert.match(provider.notice, /Sample data/);
  assert.match(provider.notice, /not live public notices/);

  const search = await provider.search({ limit: 50 });
  assert.equal(search.mode, "fixture");
  assert.equal(search.error, null);
  assert.ok(search.results.length >= 3);

  const byId = await provider.getById("FIXTURE-SAM-002");
  assert.equal(byId.external_id, "FIXTURE-SAM-002");
  assert.equal(await provider.getById("FIXTURE-SAM-999"), null);
});

await checkAsync("provider switches to live SAM.gov when a key is present", async () => {
  process.env.SAM_GOV_API_KEY = "test-key-not-used-for-network-calls";
  try {
    assert.equal(isSamGovLive(), true);
    const provider = createSamGovProvider();
    assert.equal(provider.id, "sam_gov");
    assert.equal(provider.mode, "live");
    assert.doesNotMatch(provider.notice, /Sample data/);
  } finally {
    delete process.env.SAM_GOV_API_KEY;
  }
});

check("manual entry normalizes operator-pasted notices", () => {
  assert.equal(normalizeManualEntry({ title: "   " }), null);
  const withUrl = normalizeManualEntry({
    title: "Guard services RFP",
    source_url: "https://example.gov/rfp/123",
    buyer_name: "Example City",
    due_on: "10/01/2026",
  });
  assert.equal(withUrl.provider, "manual");
  assert.equal(withUrl.external_id, "https://example.gov/rfp/123");
  assert.equal(withUrl.due_on, "2026-10-01");
  const withoutUrl = normalizeManualEntry({ title: "Guard services RFP" });
  assert.equal(withoutUrl.external_id, "manual:guard-services-rfp");
  assert.equal(withoutUrl.source_url, null);
});

const failures = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : ` — ${r.message}`}`);
}
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
process.exit(failures.length === 0 ? 0 : 1);
