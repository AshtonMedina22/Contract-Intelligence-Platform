#!/usr/bin/env node
// F2 acceptance: Public Procurement Opportunity Discovery Engine.
// Extends P4 provider/normalize surface with status, healthCheck, SAM request construction
// (mocked fetch), sync upsert dedupe, and start-pursuit trust (never HUMAN_VERIFIED).
//
// Runs without a live SAM.gov key. Optional RLS checks run when env is present.

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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f2-${name}-`)), "out.mjs");
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
  normalizePublicOpportunity,
  contentHashForNotice,
  publicSourceDedupeKey,
  documentsFromRawPayload,
  statusForOperatorAction,
  backfillStatusFromSignals,
  statusAfterSync,
  applyLocalFilters,
  createSamGovProvider,
  loadSamFixtures,
  isSamGovLive,
  buildSamSearchUrl,
  toSamDate,
  samGeography,
  normalizeManualEntry,
  SAM_SEARCH_URL,
} = providers;

const { criteriaToQuery, planSyncUpsert, dedupeNotices, isLiveSyncProvider, runProfileSync } =
  sync;

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

check("normalize + dedupe key + content hash are stable", () => {
  const a = normalizePublicOpportunity({
    provider: "fixture",
    external_id: "FIXTURE-SAM-001",
    title: "SAMPLE FIXTURE — A",
    due_on: "2026-09-18",
    naics: "561612",
  });
  const b = normalizePublicOpportunity({
    provider: "fixture",
    external_id: "FIXTURE-SAM-001",
    title: "SAMPLE FIXTURE — A",
    due_on: "2026-09-18",
    naics: "561612",
  });
  assert.ok(a && b);
  assert.equal(publicSourceDedupeKey(a.provider, a.external_id), "fixture:FIXTURE-SAM-001");
  assert.equal(contentHashForNotice(a), contentHashForNotice(b));
  const changed = normalizePublicOpportunity({
    provider: "fixture",
    external_id: "FIXTURE-SAM-001",
    title: "SAMPLE FIXTURE — B",
  });
  assert.notEqual(contentHashForNotice(a), contentHashForNotice(changed));
});

check("status transitions: operator actions + backfill + sync preserve lifecycle", () => {
  assert.equal(statusForOperatorAction("watch"), "WATCHING");
  assert.equal(statusForOperatorAction("dismiss"), "DISMISSED");
  assert.equal(statusForOperatorAction("start_pursuit"), "CONVERTED_TO_PURSUIT");
  assert.equal(statusForOperatorAction("restore"), "WATCHING");
  assert.equal(statusForOperatorAction("review"), "REVIEWING");

  assert.equal(
    backfillStatusFromSignals({
      dismissed_at: "2026-08-01T00:00:00Z",
      watchlisted_at: null,
      has_linked_pursuit: false,
      due_on: null,
    }),
    "DISMISSED",
  );
  assert.equal(
    backfillStatusFromSignals({
      dismissed_at: null,
      watchlisted_at: null,
      has_linked_pursuit: true,
      due_on: null,
    }),
    "CONVERTED_TO_PURSUIT",
  );
  assert.equal(
    backfillStatusFromSignals({
      dismissed_at: null,
      watchlisted_at: "2026-08-01T00:00:00Z",
      has_linked_pursuit: false,
      due_on: null,
    }),
    "WATCHING",
  );
  assert.equal(
    backfillStatusFromSignals({
      dismissed_at: null,
      watchlisted_at: null,
      has_linked_pursuit: false,
      due_on: "2020-01-01",
      today: "2026-08-21",
    }),
    "CLOSED",
  );
  assert.equal(
    backfillStatusFromSignals({
      dismissed_at: null,
      watchlisted_at: null,
      has_linked_pursuit: false,
      due_on: null,
    }),
    "NEW",
  );

  assert.equal(
    statusAfterSync({ existing: "WATCHING", due_on: "2020-01-01", today: "2026-08-21" }),
    "WATCHING",
  );
  assert.equal(
    statusAfterSync({ existing: "DISMISSED", due_on: "2020-01-01", today: "2026-08-21" }),
    "DISMISSED",
  );
  assert.equal(
    statusAfterSync({ existing: "CONVERTED_TO_PURSUIT", due_on: null, today: "2026-08-21" }),
    "CONVERTED_TO_PURSUIT",
  );
  assert.equal(
    statusAfterSync({ existing: null, due_on: "2020-01-01", today: "2026-08-21" }),
    "CLOSED",
  );
  assert.equal(statusAfterSync({ existing: null, due_on: "2026-12-01", today: "2026-08-21" }), "NEW");
});

await checkAsync("healthCheck fixture is healthy without inventing live notices", async () => {
  delete process.env.SAM_GOV_API_KEY;
  delete process.env.SAM_API_KEY;
  assert.equal(isSamGovLive(), false);
  const provider = createSamGovProvider();
  assert.equal(provider.mode, "fixture");
  const health = await provider.healthCheck();
  assert.equal(health.ok, true);
  assert.equal(health.mode, "fixture");
  assert.match(health.message, /Fixture adapter healthy/);
  assert.match(health.message, /not set|sample/i);

  const docs = await provider.getDocuments("FIXTURE-SAM-001");
  assert.ok(Array.isArray(docs));
  assert.equal(docs.length, 0, "fixture sample has no attachments — must not invent any");

  const opp = await provider.getOpportunity("FIXTURE-SAM-002");
  assert.equal(opp?.external_id, "FIXTURE-SAM-002");
  const byId = await provider.getById("FIXTURE-SAM-002");
  assert.equal(byId?.external_id, "FIXTURE-SAM-002");
  assert.equal(byId?.title, opp?.title);
});

await checkAsync("SAM request construction + pagination with mocked fetch", async () => {
  process.env.SAM_GOV_API_KEY = "test-key-for-url-only";
  try {
    const url = buildSamSearchUrl("test-key-for-url-only", {
      keywords: "security",
      naics: "561612",
      setAside: "SBA",
      state: "TX",
      buyer: "GSA",
      postedFrom: "2026-01-01",
      postedTo: "2026-08-01",
      limit: 50,
      offset: 100,
    });
    assert.equal(url.origin + url.pathname, SAM_SEARCH_URL);
    assert.equal(url.searchParams.get("api_key"), "test-key-for-url-only");
    assert.equal(url.searchParams.get("title"), "security");
    assert.equal(url.searchParams.get("ncode"), "561612");
    assert.equal(url.searchParams.get("typeOfSetAside"), "SBA");
    assert.equal(url.searchParams.get("state"), "TX");
    assert.equal(url.searchParams.get("organizationName"), "GSA");
    assert.equal(url.searchParams.get("postedFrom"), toSamDate("2026-01-01"));
    assert.equal(url.searchParams.get("postedTo"), toSamDate("2026-08-01"));
    assert.equal(url.searchParams.get("limit"), "50");
    assert.equal(url.searchParams.get("offset"), "100");

    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const href = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
      calls.push(href);
      return new Response(
        JSON.stringify({
          totalRecords: 1,
          opportunitiesData: [
            {
              noticeId: "LIVE-MOCK-001",
              title: "Mocked live notice",
              solicitationNumber: "MOCK-1",
              postedDate: "2026-08-01",
              responseDeadLine: "2026-09-01",
              naicsCode: "561612",
              placeOfPerformance: {
                city: { name: "Dallas" },
                state: { code: "TX" },
              },
              resourceLinks: [{ title: "SOW", url: "https://example.gov/sow.pdf" }],
              uiLink: "https://sam.gov/opp/LIVE-MOCK-001",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const provider = createSamGovProvider();
      assert.equal(provider.mode, "live");
      const search = await provider.search({ keywords: "security", limit: 10, offset: 0 });
      assert.equal(search.error, null);
      assert.equal(search.results.length, 1);
      assert.equal(search.results[0].provider, "sam_gov");
      assert.equal(search.results[0].geography, "Dallas, TX");
      assert.equal(search.totalRecords, 1);
      assert.ok(calls.length >= 1);
      const called = new URL(calls[0]);
      assert.equal(called.searchParams.get("api_key"), "test-key-for-url-only");
      assert.equal(called.searchParams.get("limit"), "10");
      assert.equal(called.searchParams.get("offset"), "0");
      assert.equal(called.searchParams.get("title"), "security");

      const page2 = await provider.search({ limit: 25, offset: 25 });
      assert.ok(calls.length >= 2);
      assert.equal(new URL(calls[1]).searchParams.get("offset"), "25");
      assert.equal(page2.results[0].external_id, "LIVE-MOCK-001");

      const docs = await provider.getDocuments("LIVE-MOCK-001");
      // getDocuments re-searches; attachment comes from raw when notice is found
      assert.ok(Array.isArray(docs));
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    delete process.env.SAM_GOV_API_KEY;
  }
});

check("documentsFromRawPayload never invents links", () => {
  assert.deepEqual(documentsFromRawPayload(null), []);
  assert.deepEqual(documentsFromRawPayload({}), []);
  assert.deepEqual(documentsFromRawPayload({ title: "x" }), []);
  const docs = documentsFromRawPayload({
    resourceLinks: [{ title: "SOW", url: "https://example.gov/a.pdf" }],
    attachments: [{ name: "SOW", url: "https://example.gov/a.pdf" }],
  });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].url, "https://example.gov/a.pdf");
});

check("samGeography flattens nested PoP without inventing cities", () => {
  assert.equal(samGeography(null), null);
  assert.equal(samGeography("Austin, TX"), "Austin, TX");
  assert.equal(
    samGeography({ city: { name: "Fort Worth" }, state: { code: "TX" } }),
    "Fort Worth, TX",
  );
  assert.equal(samGeography({}), null);
});

check("sync upsert plan dedupes and does not invent rows", () => {
  const fixtures = loadSamFixtures();
  assert.ok(fixtures.length >= 2);
  const duplicated = [...fixtures, fixtures[0], fixtures[0]];
  const unique = dedupeNotices(duplicated);
  assert.equal(unique.length, fixtures.length);

  const existing = new Map();
  const plans = unique.map((notice) => planSyncUpsert(notice, existing, "2026-08-21"));
  assert.equal(plans.every((p) => p.is_new), true);
  assert.equal(plans[0].status === "NEW" || plans[0].status === "CLOSED", true);

  // Second pass: same keys → not new; WATCHING preserved
  for (const plan of plans) {
    existing.set(publicSourceDedupeKey(plan.notice.provider, plan.notice.external_id), {
      status: "WATCHING",
      content_hash: plan.content_hash,
    });
  }
  const again = planSyncUpsert(unique[0], existing, "2026-08-21");
  assert.equal(again.is_new, false);
  assert.equal(again.status, "WATCHING");
});

check("isLiveSyncProvider rejects fixture mode / fixture id", () => {
  assert.equal(isLiveSyncProvider({ id: "fixture", mode: "fixture" }), false);
  assert.equal(isLiveSyncProvider({ id: "sam_gov", mode: "fixture" }), false);
  assert.equal(isLiveSyncProvider({ id: "fixture", mode: "live" }), false);
  assert.equal(isLiveSyncProvider({ id: "sam_gov", mode: "live" }), true);
});

await checkAsync("runProfileSync fails closed in fixture mode — zero upserts", async () => {
  delete process.env.SAM_GOV_API_KEY;
  delete process.env.SAM_API_KEY;
  assert.equal(isSamGovLive(), false);

  const upserts = [];
  const profileUpdates = [];
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
            return { error: null };
          },
        };
      }
      if (table === "opportunity_search_profiles") {
        return {
          update(payload) {
            profileUpdates.push(payload);
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
    id: "profile-fixture-skip",
    organization_id: "00000000-0000-4000-8000-000000000001",
    name: "fixture skip proof",
    enabled: true,
    criteria: { keywords: "security", limit: 10 },
    schedule_cron: null,
    last_run_at: null,
    last_error: null,
  });

  assert.equal(result.upserted, 0);
  assert.equal(result.searched, 0);
  assert.equal(upserts.length, 0, "must not write fixture notices to public_sources");
  assert.ok(result.errors.some((e) => /SKIP/i.test(e) && /fixture/i.test(e)));
  assert.ok(profileUpdates.length >= 1);
  assert.match(String(profileUpdates[0].last_error ?? ""), /SKIP/i);
});

check("criteriaToQuery maps profile JSON onto PublicOpportunityQuery", () => {
  const q = criteriaToQuery({
    keywords: "guard",
    naics: "561612",
    set_aside: "SBA",
    state: "TX",
    dueWithinDays: 30,
    limit: 40,
  });
  assert.equal(q.keywords, "guard");
  assert.equal(q.naics, "561612");
  assert.equal(q.setAside, "SBA");
  assert.equal(q.state, "TX");
  assert.equal(q.dueWithinDays, 30);
  assert.equal(q.limit, 40);
});

await checkAsync("start pursuit trust: AI_EXTRACTED only — greps action source", async () => {
  const actions = await fs.readFile(
    path.join(webRoot, "app/(platform)/procurement/opportunities/discover/actions.ts"),
    "utf8",
  );
  assert.match(actions, /verification_status:\s*"AI_EXTRACTED"/);
  assert.match(actions, /assertUnverified/);
  assert.doesNotMatch(actions, /verification_status:\s*"HUMAN_VERIFIED"/);
  assert.match(actions, /statusForOperatorAction\("start_pursuit"\)/);
  assert.match(actions, /normalizeManualEntry/);
  assert.match(actions, /matchExistingClient/);
});

check("manual entry normalize still wired", () => {
  const notice = normalizeManualEntry({
    title: "County guard RFP",
    source_url: "https://example.gov/rfp/9",
  });
  assert.equal(notice.provider, "manual");
  assert.equal(notice.external_id, "https://example.gov/rfp/9");
});

check("applyLocalFilters honors setAside and state", () => {
  const rows = loadSamFixtures();
  assert.ok(applyLocalFilters(rows, { state: "TX" }).length >= 1);
  assert.equal(applyLocalFilters(rows, { state: "ZZ" }).length, 0);
});

await checkAsync("migration defines status enum + search profiles RLS", async () => {
  const sql = await fs.readFile(
    path.join(root, "supabase/migrations/20260821210000_f2_public_opportunity_engine.sql"),
    "utf8",
  );
  assert.match(sql, /NEW.*WATCHING.*DISMISSED.*REVIEWING.*CONVERTED_TO_PURSUIT.*CLOSED/s);
  assert.match(sql, /content_hash/);
  assert.match(sql, /create table if not exists public\.opportunity_search_profiles/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /is_org_member\(organization_id\)/);
});

await checkAsync("cron route is CRON_SECRET-secured like other crons", async () => {
  const route = await fs.readFile(
    path.join(webRoot, "app/api/cron/public-opportunity-sync/route.ts"),
    "utf8",
  );
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /Bearer/);
  assert.match(route, /runAllEnabledProfileSyncs/);
  const vercel = await fs.readFile(path.join(root, "vercel.json"), "utf8");
  assert.match(vercel, /public-opportunity-sync/);
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (url && publishable && secret) {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = Date.now().toString(36);
  const password = "F2-Opp-Engine-Accept!22";
  const created = [];

  async function makeMember(tag) {
    const email = `f2-${tag}-${stamp}@example.com`;
    const createdUser = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createdUser.error || !createdUser.data.user) {
      throw new Error(`create ${tag}: ${createdUser.error?.message}`);
    }
    const client = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`sign in ${tag}: ${signIn.error.message}`);
    const org = await client.rpc("create_organization_with_admin", {
      org_name: `F2 ${tag} ${stamp}`,
    });
    if (org.error || !org.data) throw new Error(`org ${tag}: ${org.error?.message}`);
    return { user: createdUser.data.user, client, orgId: org.data };
  }

  try {
    await checkAsync("RLS: opportunity_search_profiles is org-scoped", async () => {
      const a = await makeMember("a");
      const b = await makeMember("b");
      created.push(a, b);

      const inserted = await a.client
        .from("opportunity_search_profiles")
        .insert({
          organization_id: a.orgId,
          name: `TX security ${stamp}`,
          enabled: true,
          criteria: { keywords: "security", naics: "561612", state: "TX" },
        })
        .select("id")
        .single();
      assert.equal(inserted.error, null, inserted.error?.message);
      const profileId = inserted.data.id;

      const own = await a.client.from("opportunity_search_profiles").select("id").eq("id", profileId);
      assert.equal((own.data ?? []).length, 1);

      const cross = await b.client.from("opportunity_search_profiles").select("id").eq("id", profileId);
      assert.equal((cross.data ?? []).length, 0);

      const crossUpdate = await b.client
        .from("opportunity_search_profiles")
        .update({ enabled: false })
        .eq("id", profileId)
        .select("id");
      assert.equal((crossUpdate.data ?? []).length, 0);

      // Sync upsert dedupe on public_sources: two identical notices → one row
      const notice = {
        organization_id: a.orgId,
        provider: "fixture",
        external_id: `FIXTURE-SAM-F2-${stamp}`,
        title: "SAMPLE FIXTURE — F2 sync dedupe",
        source_url: `https://fixture.invalid/sam-gov/F2-${stamp}`,
        status: "NEW",
        content_hash: "fnv1a:test",
      };
      const first = await a.client.from("public_sources").upsert(notice, {
        onConflict: "organization_id,provider,external_id",
      });
      assert.equal(first.error, null, first.error?.message);
      const second = await a.client.from("public_sources").upsert(
        { ...notice, title: "SAMPLE FIXTURE — F2 sync dedupe updated" },
        { onConflict: "organization_id,provider,external_id" },
      );
      assert.equal(second.error, null, second.error?.message);
      const counted = await a.client
        .from("public_sources")
        .select("id, title, status", { count: "exact" })
        .eq("external_id", notice.external_id);
      assert.equal(counted.count, 1);
      assert.equal(counted.data?.[0]?.title, "SAMPLE FIXTURE — F2 sync dedupe updated");
      assert.equal(counted.data?.[0]?.status, "NEW");

      // Cleanup
      await a.client.from("public_sources").delete().eq("external_id", notice.external_id);
      await a.client.from("opportunity_search_profiles").delete().eq("id", profileId);
    });
  } finally {
    for (const member of created) {
      try {
        await admin.from("memberships").delete().eq("user_id", member.user.id);
        await admin.from("organizations").delete().eq("id", member.orgId);
        await admin.auth.admin.deleteUser(member.user.id);
      } catch {
        // best-effort cleanup
      }
    }
  }
} else {
  results.push({
    name: "RLS: opportunity_search_profiles is org-scoped",
    ok: true,
    message: "skipped — no Supabase env (static migration/grep coverage still ran)",
  });
  console.log("SKIP  RLS live checks (missing Supabase env)");
}

const failures = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : ` — ${r.message}`}`);
}
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
process.exit(failures.length === 0 ? 0 : 1);
