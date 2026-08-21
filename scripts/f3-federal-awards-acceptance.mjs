#!/usr/bin/env node
// F3 acceptance: Federal Award / Buyer / Competitor Data Engine (USAspending research plane).
// Separate from PublicProcurementProvider. Mocked fetch proves request construction,
// pagination, normalization, party match, backoff, and AI_EXTRACTED-only persist helper.
// Fixtures are FIXTURE-USA-* for unit tests only — never sync into DB as live awards.

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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f3-${name}-`)), "out.mjs");
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

const usa = await bundle("lib/ask/research/usaspending.ts", "usa");
const party = await bundle("lib/ask/research/normalize-party.ts", "party");

const {
  createUsaSpendingProvider,
  buildSpendingByAwardRequest,
  normalizeFederalAward,
  buildResearchFactFromFederalAward,
  federalAwardToEvidence,
  reconcileFederalRecipient,
  hashQuery,
  clearUsaSpendingCache,
  resetUsaSpendingProvider,
  USA_SPENDING_API_BASE,
  USA_SPENDING_SEARCH_PATH,
  DEFAULT_AWARD_TYPE_CODES,
} = usa;

const {
  normalizePartyName,
  namesNormalizeEqual,
  matchExistingCompetitor,
  matchExistingClient,
} = party;

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

// --- Request construction ---
check("buildSpendingByAwardRequest maps filter dimensions", () => {
  const { url, body } = buildSpendingByAwardRequest({
    keywords: "guard services",
    agency: "Department of Homeland Security",
    recipient: "Acme Security",
    recipientUei: "ABC123UEI",
    naics: "561612",
    psc: "R430",
    awardId: "ABC-001",
    amountLower: 100000,
    amountUpper: 5000000,
    dateFrom: "2024-01-01",
    dateTo: "2024-12-31",
    placeOfPerformanceState: "TX",
    placeOfPerformanceCity: "Austin",
    limit: 10,
    page: 2,
  });
  assert.equal(url, `${USA_SPENDING_API_BASE}${USA_SPENDING_SEARCH_PATH}`);
  assert.deepEqual(body.filters.award_type_codes, [...DEFAULT_AWARD_TYPE_CODES]);
  assert.deepEqual(body.filters.keywords, ["guard services"]);
  assert.equal(body.filters.agencies[0].name, "Department of Homeland Security");
  assert.deepEqual(body.filters.recipient_search_text, ["Acme Security", "ABC123UEI"]);
  assert.deepEqual(body.filters.naics_codes, ["561612"]);
  assert.deepEqual(body.filters.psc_codes, ["R430"]);
  assert.deepEqual(body.filters.award_ids, ["ABC-001"]);
  assert.deepEqual(body.filters.award_amounts, [{ lower_bound: 100000, upper_bound: 5000000 }]);
  assert.deepEqual(body.filters.time_period, [{ start_date: "2024-01-01", end_date: "2024-12-31" }]);
  assert.equal(body.filters.place_of_performance_locations[0].state, "TX");
  assert.equal(body.page, 2);
  assert.equal(body.limit, 10);
  assert.equal(body.subawards, false);
});

check("hashQuery is stable for identical payloads", () => {
  const a = hashQuery({ filters: { naics_codes: ["561612"] }, page: 1 });
  const b = hashQuery({ filters: { naics_codes: ["561612"] }, page: 1 });
  const c = hashQuery({ filters: { naics_codes: ["561612"] }, page: 2 });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

// --- Normalization ---
check("normalizeFederalAward preserves source URL + retrieved_at + dimensions", () => {
  const retrieved_at = "2026-08-21T15:00:00.000Z";
  const award = normalizeFederalAward(
    {
      "Award ID": "CONT123",
      generated_unique_award_id: "CONT_AWD_CONT123_9700_-NONE-_-NONE-",
      piid: "CONT123",
      "Recipient Name": "Acme Security Inc.",
      recipient_uei: "UEIACME001",
      "Awarding Agency": "Department of Homeland Security",
      "Award Amount": 1_250_000,
      "Start Date": "2024-10-01",
      "End Date": "2025-09-30",
      "Award Date": "2024-09-15",
      "NAICS Code": "561612",
      "PSC Code": "R430",
      Description: "Guard services",
      "Place of Performance City Name": "Austin",
      "Place of Performance State Code": "TX",
      "Contract Award Type": "Definitive Contract",
    },
    { retrieved_at, provider: "usa_spending" },
  );
  assert.ok(award);
  assert.equal(award.award_id, "CONT123");
  assert.equal(award.piid, "CONT123");
  assert.equal(award.recipient_name, "Acme Security Inc.");
  assert.equal(award.recipient_uei, "UEIACME001");
  assert.equal(award.agency, "Department of Homeland Security");
  assert.equal(award.amount, 1_250_000);
  assert.equal(award.naics, "561612");
  assert.equal(award.psc, "R430");
  assert.equal(award.place_of_performance, "Austin, TX");
  assert.equal(award.retrieved_at, retrieved_at);
  assert.match(award.source_url, /usaspending\.gov\/award\//);
  assert.equal(award.provider, "usa_spending");
});

// --- Party normalization ---
check("duplicate recipient name soft-match via normalize (no auto-link invent)", () => {
  assert.equal(namesNormalizeEqual("Acme Security Inc.", "ACME SECURITY CORPORATION"), true);
  assert.equal(normalizePartyName("Acme Security, LLC"), normalizePartyName("ACME SECURITY"));
  const existing = [
    { id: "c1", name: "Acme Security Inc." },
    { id: "c2", name: "Other Vendor LLC" },
  ];
  const hit = matchExistingCompetitor({ name: "ACME SECURITY CORPORATION" }, existing);
  assert.equal(hit.match?.id, "c1");
  assert.equal(hit.ambiguity, false);
});

check("ambiguous recipient returns candidates without auto-link", () => {
  const existing = [
    { id: "a", name: "Guardian Services Inc." },
    { id: "b", name: "Guardian Services LLC" },
  ];
  // Both normalize to GUARDIAN SERVICES → ambiguity
  const result = matchExistingClient({ name: "Guardian Services Corp." }, existing);
  assert.equal(result.match, null);
  assert.equal(result.ambiguity, true);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].status, "queued_identity");
  assert.ok(result.candidates.every((c) => c.suggested_name));
});

check("UEI exact match links; no invent when absent", () => {
  const withUei = [{ id: "u1", name: "Different Display", uei: "UEI999" }];
  const byUei = matchExistingCompetitor({ name: "Unrelated", uei: "uei999" }, withUei);
  assert.equal(byUei.match?.id, "u1");
  const miss = matchExistingCompetitor({ name: "Brand New Vendor" }, withUei);
  assert.equal(miss.match, null);
  assert.equal(miss.ambiguity, false);
  assert.deepEqual(miss.candidates, []);
});

// --- Fixture mode + pagination ---
await checkAsync("fixture search + pagination labeled FIXTURE-USA-*", async () => {
  clearUsaSpendingCache();
  resetUsaSpendingProvider();
  const provider = createUsaSpendingProvider({ forceFixture: true });
  assert.equal(provider.mode, "fixture");
  const page1 = await provider.searchAwards({ limit: 1, page: 1 });
  assert.equal(page1.ok, true);
  assert.equal(page1.fixture, true);
  assert.equal(page1.results.length, 1);
  assert.match(page1.results[0].award_id, /^FIXTURE-USA-/);
  assert.equal(page1.hasNext, true);
  const page2 = await provider.searchAwards({ limit: 1, page: 2 });
  assert.equal(page2.results[0].award_id, "FIXTURE-USA-002");
  assert.equal(page2.hasNext, false);
  const byRecipient = await provider.searchByRecipient("Facilities");
  assert.ok(byRecipient.results.some((r) => /Facilities/i.test(r.recipient_name ?? "")));
  const one = await provider.getAward("FIXTURE-USA-001");
  assert.equal(one?.award_id, "FIXTURE-USA-001");
  const health = await provider.healthCheck();
  assert.equal(health.ok, true);
  assert.equal(health.mode, "fixture");
  assert.match(health.message, /unit tests only|never sync/i);
});

// --- Mocked live request construction + pagination ---
await checkAsync("mocked fetch: request body + page pagination", async () => {
  clearUsaSpendingCache();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(
      JSON.stringify({
        results: [
          {
            "Award ID": `LIVE-${calls.length}`,
            generated_unique_award_id: `CONT_AWD_LIVE${calls.length}_9700_-NONE-_-NONE-`,
            "Recipient Name": "Live Recipient",
            "Awarding Agency": "Department of Defense",
            "Award Amount": 1000 * calls.length,
            "NAICS Code": "561612",
          },
        ],
        page_metadata: { hasNext: calls.length < 2, page: calls.length },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const provider = createUsaSpendingProvider({ fetchImpl, forceFixture: false });
  const r1 = await provider.searchAwards({ naics: "561612", page: 1, limit: 5 });
  assert.equal(r1.ok, true);
  assert.equal(r1.fixture, false);
  assert.equal(calls[0].body.filters.naics_codes[0], "561612");
  assert.equal(calls[0].body.page, 1);
  assert.match(calls[0].url, /spending_by_award/);
  const r2 = await provider.searchAwards({ naics: "561612", page: 2, limit: 5 });
  assert.equal(calls[1].body.page, 2);
  assert.equal(r2.results[0].award_id, "LIVE-2");
  assert.equal(r1.hasNext, true);
});

// --- Rate-limit backoff ---
await checkAsync("rate-limit 429 triggers bounded backoff then succeeds", async () => {
  clearUsaSpendingCache();
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts < 3) {
      return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
    }
    return new Response(
      JSON.stringify({
        results: [
          {
            "Award ID": "AFTER-BACKOFF",
            generated_unique_award_id: "CONT_AWD_AFTER_9700_-NONE-_-NONE-",
            "Recipient Name": "Backoff Co",
            "Award Amount": 42,
          },
        ],
        page_metadata: { hasNext: false },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const provider = createUsaSpendingProvider({
    fetchImpl,
    forceFixture: false,
    maxRetries: 3,
    baseBackoffMs: 1,
  });
  const result = await provider.searchAwards({ keywords: "backoff", limit: 5 });
  assert.equal(result.ok, true);
  assert.equal(result.results[0].award_id, "AFTER-BACKOFF");
  assert.ok(attempts >= 3, `expected retries, got attempts=${attempts}`);
});

await checkAsync("live API failure returns honest error (no silent fixture)", async () => {
  clearUsaSpendingCache();
  const fetchImpl = async () => new Response("nope", { status: 503 });
  const provider = createUsaSpendingProvider({
    fetchImpl,
    forceFixture: false,
    maxRetries: 0,
    baseBackoffMs: 1,
  });
  const result = await provider.searchAwards({ keywords: "x" });
  assert.equal(result.ok, false);
  assert.equal(result.fixture, false);
  assert.equal(result.results.length, 0);
  assert.match(result.error ?? "", /HTTP 503|failed/i);
});

// --- Source preservation / AI_EXTRACTED only ---
check("evidence class OFFICIAL_PUBLIC; persist helper AI_EXTRACTED only", () => {
  const award = normalizeFederalAward(
    {
      "Award ID": "SRC-1",
      generated_unique_award_id: "CONT_AWD_SRC1_9700_-NONE-_-NONE-",
      "Recipient Name": "Source Co",
      "Award Amount": 9,
      "Award Date": "2024-01-02",
    },
    { retrieved_at: "2026-08-21T12:00:00.000Z", provider: "usa_spending" },
  );
  assert.ok(award);
  const evidence = federalAwardToEvidence(award);
  assert.equal(evidence.evidence_class, "OFFICIAL_PUBLIC");
  assert.equal(evidence.verification_status, "OFFICIAL_PUBLIC");
  assert.notEqual(evidence.verification_status, "HUMAN_VERIFIED");
  assert.equal(evidence.url, award.source_url);
  assert.equal(evidence.retrieved_at, award.retrieved_at);

  const fact = buildResearchFactFromFederalAward({
    organizationId: "org-1",
    award,
  });
  assert.equal(fact.verification_status, "AI_EXTRACTED");
  assert.equal(fact.provider, "usa_spending");
  assert.equal(fact.external_id, award.external_id);
  assert.equal(fact.source_url, award.source_url);
  assert.match(fact.excerpt, /not L&P pricing truth/i);
});

check("fixture awards refused by persist helper", () => {
  const fixture = normalizeFederalAward(
    {
      "Award ID": "FIXTURE-USA-001",
      generated_unique_award_id: "FIXTURE-USA-001",
      "Recipient Name": "Sample",
    },
    { provider: "fixture", retrieved_at: new Date().toISOString() },
  );
  assert.ok(fixture);
  assert.throws(
    () => buildResearchFactFromFederalAward({ organizationId: "org", award: fixture }),
    /FIXTURE-USA/,
  );
});

check("reconcileFederalRecipient does not invent clients/competitors", () => {
  const award = {
    recipient_name: "Unknown Federal Vendor LLC",
    recipient_uei: "NOMATCHUEI",
  };
  const reconciled = reconcileFederalRecipient(award, {
    clients: [{ id: "1", name: "Someone Else" }],
    competitors: [{ id: "2", name: "Another" }],
  });
  assert.equal(reconciled.client.match, null);
  assert.equal(reconciled.competitor.match, null);
  assert.equal(reconciled.client.ambiguity, false);
});

// --- Architecture / tooling greps ---
await checkAsync("Ask tools wire federal award tools; not PublicProcurementProvider", async () => {
  const tools = await read("apps/web/lib/ask/tools.ts");
  const provider = await read("apps/web/lib/ask/research/provider.ts");
  const usaSrc = await read("apps/web/lib/ask/research/usaspending.ts");
  const procIndex = await read("apps/web/lib/procurement/providers/index.ts");

  assert.match(tools, /search_federal_awards/);
  assert.match(tools, /get_federal_award/);
  assert.match(tools, /lookup_federal_recipient/);
  assert.match(tools, /OFFICIAL_PUBLIC/);
  assert.match(tools, /never HUMAN_VERIFIED|never.*HUMAN_VERIFIED/i);
  assert.match(tools, /pricing_lines|proposed\/awarded\/current/i);
  assert.match(provider, /usaspending\.gov/);
  assert.match(usaSrc, /NOT a PublicProcurementProvider|Ask research plane/i);
  assert.doesNotMatch(procIndex, /createUsaSpendingProvider|usaspending\.ts/);
});

await checkAsync("no market share claims in Intelligence UI greps", async () => {
  const observations = await read("apps/web/lib/intelligence/observations.ts");
  assert.match(observations, /not market share/i);
  assert.match(observations, /FEDERAL_AWARD_RESEARCH_NOTE/);
  assert.match(observations, /USAspending|usa_spending/);
  assert.doesNotMatch(observations, /market share of|our market share|%\s*market share/i);

  const pages = [
    "apps/web/app/(platform)/intelligence/market/page.tsx",
    "apps/web/app/(platform)/intelligence/clients/page.tsx",
    "apps/web/app/(platform)/intelligence/competitors/page.tsx",
  ];
  for (const rel of pages) {
    const text = await read(rel);
    assert.match(text, /FEDERAL_AWARD_RESEARCH_NOTE|not market share|no market share/i);
    assert.doesNotMatch(text, /market share of|our market share|%\s*market share/i);
    assert.match(text, /USAspending|usaspending|usa_spending|FEDERAL_AWARD/i);
  }
});

await checkAsync("four truths: USAspending never writes pricing_lines or canonical awards", async () => {
  const usaSrc = await read("apps/web/lib/ask/research/usaspending.ts");
  const tools = await read("apps/web/lib/ask/tools.ts");
  assert.doesNotMatch(usaSrc, /\.from\(["']awards["']\)/);
  assert.doesNotMatch(usaSrc, /\.from\(["']pricing_lines["']\)/);
  assert.doesNotMatch(tools, /pricing_lines.*usa_spending|usa_spending.*pricing_lines/);
  assert.match(usaSrc, /Never write canonical/);
  assert.match(usaSrc, /AI_EXTRACTED/);
});

// --- Optional live ping ---
let liveBlocker = null;
await checkAsync("live USAspending health ping (optional)", async () => {
  clearUsaSpendingCache();
  resetUsaSpendingProvider();
  delete process.env.USA_SPENDING_USE_FIXTURES;
  const provider = createUsaSpendingProvider({ forceFixture: false, maxRetries: 1, baseBackoffMs: 50 });
  try {
    const health = await provider.healthCheck();
    if (!health.ok) {
      liveBlocker = health.message;
      // Non-fatal for acceptance — fixtures cover contracts.
      console.warn(`[f3] live USAspending blocked: ${health.message}`);
      return;
    }
    const sample = await provider.searchAwards({
      naics: "561612",
      dateFrom: "2023-01-01",
      dateTo: "2024-12-31",
      limit: 1,
      page: 1,
    });
    if (!sample.ok) {
      liveBlocker = sample.error;
      console.warn(`[f3] live search failed: ${sample.error}`);
      return;
    }
    assert.equal(sample.fixture, false);
    if (sample.results.length > 0) {
      assert.ok(sample.results[0].source_url.includes("usaspending.gov"));
      assert.ok(sample.results[0].retrieved_at);
    }
  } catch (err) {
    liveBlocker = err instanceof Error ? err.message : String(err);
    console.warn(`[f3] live USAspending network error: ${liveBlocker}`);
  }
});

const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok);
console.log(`\nF3 federal awards: ${passed.length}/${results.length} PASS`);
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.message ? ` — ${r.message}` : ""}`);
}
if (liveBlocker) {
  console.log(`\nLive API blocker (non-fatal): ${liveBlocker}`);
}
if (failed.length) {
  process.exitCode = 1;
} else {
  console.log("\nVerdict: PASS");
}
