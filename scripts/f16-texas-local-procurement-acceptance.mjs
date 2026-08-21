#!/usr/bin/env node
// F16 acceptance: Texas / State / Local Procurement Source Connectors.
// Reuses F2 PublicProcurementProvider — proves capability modes, ESBD manual/link,
// Socrata/RSS/JSON fixtures, addendum refresh flag, soft cross-source dedupe,
// pagination/429 honesty, provenance greps, tenant RLS greps. No GPL openrfps copy.

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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f16-${name}-`)), "out.mjs");
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
  return import(pathToFileURL(outfile).href);
}

const providers = await bundle("lib/procurement/providers/index.ts", "providers");
const sync = await bundle("lib/procurement/sync/run-profile-sync.ts", "sync");

const {
  createTexasEsbdProvider,
  normalizeTexasEsbdEntry,
  TEXAS_ESBD_PORTAL_URL,
  createSocrataProvider,
  loadSocrataFixtures,
  buildSocrataResourceUrl,
  isSocrataLive,
  createRssProvider,
  loadRssFixtures,
  parseRssOrAtom,
  createJsonFeedProvider,
  loadJsonFeedFixtures,
  buildJsonFeedUrl,
  createHtmlListingProvider,
  normalizeManualEntry,
  normalizeLocalManualEntry,
  softCrossSourceKey,
  contentHashForNotice,
  publicSourceDedupeKey,
  getAutomatedSyncProviders,
  getAllPublicProcurementProviders,
  capabilityLabel,
} = providers;

const {
  planSyncUpsert,
  dedupeNotices,
  isLiveSyncProvider,
  runProfileSync,
  planSoftCrossSourceDuplicates,
  criteriaToQuery,
} = sync;

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

check("capability enum + labels on all registered providers", () => {
  const all = getAllPublicProcurementProviders();
  assert.ok(all.length >= 7);
  for (const p of all) {
    assert.ok(["AUTOMATED", "MANUAL_IMPORT", "LINK_ONLY"].includes(p.capability), p.id);
    assert.equal(typeof capabilityLabel(p.capability), "string");
  }
  const automated = getAutomatedSyncProviders();
  assert.ok(automated.every((p) => p.capability === "AUTOMATED"));
  assert.ok(automated.every((p) => p.id !== "texas_esbd" && p.id !== "html_listing" && p.id !== "manual"));
});

await checkAsync("Texas ESBD is LINK_ONLY — portal + honest health; no scrape search", async () => {
  const esbd = createTexasEsbdProvider();
  assert.equal(esbd.capability, "LINK_ONLY");
  assert.equal(esbd.id, "texas_esbd");
  const search = await esbd.search({});
  assert.equal(search.results.length, 0);
  assert.equal(search.capability, "LINK_ONLY");
  assert.match(search.notice, /no public solicitation API/i);
  const health = await esbd.healthCheck();
  assert.equal(health.ok, true);
  assert.match(health.message, /no public solicitation API/i);
  assert.match(TEXAS_ESBD_PORTAL_URL, /txsmartbuy\.com\/esbd/);
});

check("Texas ESBD MANUAL_IMPORT normalize from paste/URL", () => {
  const notice = normalizeTexasEsbdEntry({
    title: "HHSC Security Services",
    source_url: "https://www.txsmartbuy.com/esbd/notice/123",
    buyer_name: "HHSC",
    solicitation_number: "HHSTX-6-0000383549",
    due_on: "2026-09-01",
  });
  assert.ok(notice);
  assert.equal(notice.provider, "texas_esbd");
  assert.equal(notice.solicitation_number, "HHSTX-6-0000383549");
  assert.equal(notice.raw_payload.entry_mode, "manual_import");
  assert.equal(normalizeTexasEsbdEntry({ title: "  " }), null);
});

check("local/ISD MANUAL_IMPORT via extended manual adapter", () => {
  const local = normalizeLocalManualEntry({
    title: "Allen ISD Armed Security",
    source_url: "https://example.isd.tx.us/rfp/9",
    buyer_name: "Allen ISD",
    solicitation_number: "ISD-24-100",
  });
  assert.ok(local);
  assert.equal(local.provider, "local");
  const state = normalizeManualEntry({
    title: "State agency RFP",
    kind: "state",
    solicitation_number: "ST-1",
  });
  assert.ok(state);
  assert.equal(state.provider, "state");
});

check("Socrata structured fixtures + URL pagination + missing fields stay null", () => {
  assert.equal(isSocrataLive(), false);
  const rows = loadSocrataFixtures();
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((r) => r.provider === "socrata"));
  assert.ok(rows.every((r) => r.external_id.startsWith("FIXTURE-SOCRATA-")));
  const url = buildSocrataResourceUrl(
    { domain: "data.example.gov", datasetId: "abcd-1234" },
    { limit: 10, offset: 20, keywords: "security" },
  );
  assert.match(url.href, /data\.example\.gov\/resource\/abcd-1234\.json/);
  assert.equal(url.searchParams.get("$limit"), "10");
  assert.equal(url.searchParams.get("$offset"), "20");
  assert.equal(url.searchParams.get("$q"), "security");
  const sparse = providers.normalizePublicOpportunity({
    provider: "socrata",
    external_id: "x1",
    title: "Sparse",
  });
  assert.ok(sparse);
  assert.equal(sparse.due_on, null);
  assert.equal(sparse.buyer_name, null);
});

await checkAsync("Socrata rate-limit honesty (mocked 429)", async () => {
  const prevDomain = process.env.SOCRATA_DOMAIN;
  const prevDataset = process.env.SOCRATA_DATASET_ID;
  process.env.SOCRATA_DOMAIN = "data.example.gov";
  process.env.SOCRATA_DATASET_ID = "abcd-1234";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("{}", { status: 429, headers: { "Content-Type": "application/json" } });
  try {
    const live = createSocrataProvider();
    assert.equal(live.mode, "live");
    const search = await live.search({ limit: 5 });
    assert.equal(search.results.length, 0);
    assert.match(String(search.error), /429/);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevDomain == null) delete process.env.SOCRATA_DOMAIN;
    else process.env.SOCRATA_DOMAIN = prevDomain;
    if (prevDataset == null) delete process.env.SOCRATA_DATASET_ID;
    else process.env.SOCRATA_DATASET_ID = prevDataset;
  }
});

check("RSS fixtures parse + JSON feed fixtures", () => {
  const rss = loadRssFixtures();
  assert.ok(rss.length >= 2);
  assert.ok(rss.every((r) => r.provider === "rss"));
  assert.ok(rss[0].solicitation_number);
  const atom = parseRssOrAtom(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title>Atom Notice</title><id>atom-1</id><link href="https://example.gov/a"/><updated>2026-08-01T00:00:00Z</updated></entry>
  </feed>`);
  assert.equal(atom.length, 1);
  assert.equal(atom[0].external_id, "atom-1");

  const json = loadJsonFeedFixtures();
  assert.ok(json.length >= 2);
  assert.ok(json.every((r) => r.provider === "json_feed"));
  const built = buildJsonFeedUrl("https://example.gov/opps.json", { limit: 15, offset: 5 });
  assert.equal(built.searchParams.get("limit"), "15");
  assert.equal(built.searchParams.get("offset"), "5");
});

await checkAsync("HTML listing stays LINK_ONLY — no scrape results", async () => {
  const html = createHtmlListingProvider();
  assert.equal(html.capability, "LINK_ONLY");
  const search = await html.search({});
  assert.equal(search.results.length, 0);
});

check("addendum refresh flag on content_hash change for WATCHING", () => {
  const a = loadSocrataFixtures()[0];
  const hash = contentHashForNotice(a);
  const existing = new Map([
    [
      publicSourceDedupeKey(a.provider, a.external_id),
      { status: "WATCHING", content_hash: hash, addendum_refresh_needed: false },
    ],
  ]);
  const unchanged = planSyncUpsert(a, existing, "2026-08-21", "AUTOMATED");
  assert.equal(unchanged.content_changed, false);
  assert.equal(unchanged.addendum_refresh_needed, false);

  const changed = {
    ...a,
    title: `${a.title} — ADDENDUM`,
  };
  const plan = planSyncUpsert(changed, existing, "2026-08-21", "AUTOMATED");
  assert.equal(plan.content_changed, true);
  assert.equal(plan.addendum_refresh_needed, true);
  assert.notEqual(plan.content_hash, hash);

  const newRow = planSyncUpsert(a, new Map(), "2026-08-21", "AUTOMATED");
  assert.equal(newRow.is_new, true);
  assert.equal(newRow.addendum_refresh_needed, false);
});

check("soft cross-source duplicate by solicitation_number + buyer", () => {
  const key = softCrossSourceKey({
    solicitation_number: "RFP-100",
    buyer_name: "Allen ISD",
  });
  assert.ok(key);
  assert.equal(
    softCrossSourceKey({ solicitation_number: null, buyer_name: "Allen ISD" }),
    null,
  );

  const plans = planSoftCrossSourceDuplicates([
    {
      id: "aaa",
      provider: "socrata",
      external_id: "1",
      solicitation_number: "RFP-100",
      buyer_name: "Allen ISD",
      duplicate_of_id: null,
    },
    {
      id: "bbb",
      provider: "rss",
      external_id: "2",
      solicitation_number: "RFP-100",
      buyer_name: "Allen ISD",
      duplicate_of_id: null,
    },
  ]);
  assert.equal(plans.get("aaa"), null);
  assert.equal(plans.get("bbb"), "aaa");
});

check("isLiveSyncProvider rejects fixture / LINK_ONLY / MANUAL", () => {
  assert.equal(isLiveSyncProvider({ id: "socrata", mode: "fixture", capability: "AUTOMATED" }), false);
  assert.equal(
    isLiveSyncProvider({ id: "texas_esbd", mode: "live", capability: "LINK_ONLY" }),
    false,
  );
  assert.equal(
    isLiveSyncProvider({ id: "manual", mode: "live", capability: "MANUAL_IMPORT" }),
    false,
  );
  assert.equal(
    isLiveSyncProvider({ id: "socrata", mode: "live", capability: "AUTOMATED" }),
    true,
  );
});

await checkAsync("runProfileSync fails closed without live AUTOMATED — zero upserts", async () => {
  delete process.env.SAM_GOV_API_KEY;
  delete process.env.SAM_API_KEY;
  delete process.env.SOCRATA_DOMAIN;
  delete process.env.SOCRATA_DATASET_ID;
  delete process.env.PROCUREMENT_RSS_URL;
  delete process.env.PROCUREMENT_JSON_FEED_URL;

  const upserts = [];
  const admin = {
    from(table) {
      if (table === "public_sources") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          async then(resolve) {
            return resolve({ data: [], error: null });
          },
          upsert(row) {
            upserts.push(row);
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            };
          },
          update() {
            return {
              eq() {
                return {
                  eq() {
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "opportunity_search_profiles") {
        return {
          update() {
            return {
              eq() {
                return { error: null };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await runProfileSync(admin, {
    id: "profile-f16-skip",
    organization_id: "00000000-0000-4000-8000-000000000001",
    name: "f16 skip proof",
    enabled: true,
    criteria: { keywords: "security", limit: 10 },
    schedule_cron: null,
    last_run_at: null,
    last_error: null,
  });

  assert.equal(result.upserted, 0);
  assert.equal(upserts.length, 0);
  assert.ok(result.errors.some((e) => /SKIP/i.test(e)));
});

check("criteriaToQuery still maps F2 fields; agency criteria documented as pass-through", () => {
  const q = criteriaToQuery({
    keywords: "guard",
    state: "TX",
    provider: "socrata",
    agencyType: "ISD",
    limit: 12,
  });
  assert.equal(q.keywords, "guard");
  assert.equal(q.state, "TX");
  assert.equal(q.limit, 12);
});

check("dedupeNotices still hard-dedupes provider+external_id", () => {
  const rows = loadJsonFeedFixtures();
  const duped = dedupeNotices([...rows, rows[0]]);
  assert.equal(duped.length, rows.length);
});

await checkAsync("provenance + trust greps — no HUMAN_VERIFIED / no openrfps copy", async () => {
  const actions = await fs.readFile(
    path.join(webRoot, "app/(platform)/procurement/opportunities/discover/actions.ts"),
    "utf8",
  );
  assert.match(actions, /verification_status:\s*"AI_EXTRACTED"/);
  assert.doesNotMatch(actions, /verification_status:\s*"HUMAN_VERIFIED"/);
  assert.match(actions, /normalizeTexasEsbdEntry/);
  assert.match(actions, /submitTexasEsbdEntry/);

  const syncSrc = await fs.readFile(
    path.join(webRoot, "lib/procurement/sync/run-profile-sync.ts"),
    "utf8",
  );
  assert.match(syncSrc, /addendum_refresh_needed/);
  assert.match(syncSrc, /does not auto-create F11|Cue only/i);
  assert.match(syncSrc, /getAutomatedSyncProviders|capability/);

  const esbd = await fs.readFile(
    path.join(webRoot, "lib/procurement/providers/texas-esbd.ts"),
    "utf8",
  );
  assert.match(esbd, /LINK_ONLY/);
  assert.doesNotMatch(esbd, /cheerio|puppeteer|playwright|openrfps/i);

  const html = await fs.readFile(
    path.join(webRoot, "lib/procurement/providers/html-listing.ts"),
    "utf8",
  );
  assert.match(html, /does not scrape/i);

  const openrfpsNote = await fs.readFile(
    path.join(root, "docs/reference-repos/openrfps.md"),
    "utf8",
  );
  assert.match(openrfpsNote, /GPL/);
  assert.match(openrfpsNote, /Do not copy/i);
});

await checkAsync("migration widens provider + addendum/dedupe/health columns", async () => {
  const sql = await fs.readFile(
    path.join(root, "supabase/migrations/20260821330000_f16_state_local_sources.sql"),
    "utf8",
  );
  assert.match(sql, /texas_esbd/);
  assert.match(sql, /socrata/);
  assert.match(sql, /json_feed/);
  assert.match(sql, /addendum_refresh_needed/);
  assert.match(sql, /duplicate_of_id/);
  assert.match(sql, /source_health/);
  assert.match(sql, /capability/);
  assert.match(sql, /is_org_member|opportunity_search_profiles/i);
});

await checkAsync("tenant RLS greps still on public_sources + profiles", async () => {
  const p4 = await fs.readFile(
    path.join(root, "supabase/migrations/20260821180000_p4_public_opportunity_discovery.sql"),
    "utf8",
  );
  assert.match(p4, /is_org_member\(organization_id\)/);
  const f2 = await fs.readFile(
    path.join(root, "supabase/migrations/20260821210000_f2_public_opportunity_engine.sql"),
    "utf8",
  );
  assert.match(f2, /opportunity_search_profiles_select/);
  assert.match(f2, /is_org_member\(organization_id\)/);
});

await checkAsync("UI wires ESBD form + capability badges + watchlist addendum cue", async () => {
  const discover = await fs.readFile(
    path.join(webRoot, "app/(platform)/procurement/opportunities/discover/page.tsx"),
    "utf8",
  );
  assert.match(discover, /TexasEsbdEntryForm/);
  const watch = await fs.readFile(
    path.join(webRoot, "app/(platform)/procurement/opportunities/watchlist/page.tsx"),
    "utf8",
  );
  assert.match(watch, /addendum_refresh_needed/);
  assert.match(watch, /Listing changed/);
  const banner = await fs.readFile(
    path.join(webRoot, "components/procurement/provider-mode-banner.tsx"),
    "utf8",
  );
  assert.match(banner, /ProviderCapabilityBadge/);
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : ` — ${r.message}`}`);
}
console.log(`\nF16 texas/local procurement: ${results.length - failed.length}/${results.length}`);
process.exit(failed.length > 0 ? 1 : 0);
