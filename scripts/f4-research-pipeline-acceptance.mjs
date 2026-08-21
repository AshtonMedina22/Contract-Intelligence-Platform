#!/usr/bin/env node
// F4 acceptance: Public Research Acquisition + Verified Research Fact Pipeline.
// Pure plan/persist/brief + mocked execute. Fixtures refused. No auto HUMAN_VERIFIED.
// Ask/report never auto-promote AI_EXTRACTED.

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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f4-${name}-`)), "out.mjs");
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

const planMod = await bundle("lib/ask/research/plan.ts", "plan");
const persistMod = await bundle("lib/ask/research/persist-run.ts", "persist");
const briefMod = await bundle("lib/ask/research/synthesize-brief.ts", "brief");
const executeMod = await bundle("lib/ask/research/execute-run.ts", "execute");
const partyMod = await bundle("lib/ask/research/normalize-party.ts", "party");

const { buildResearchPlan, isResearchType } = planMod;
const {
  buildAiExtractedFactRow,
  refuseFixtureProvider,
  assertUnverifiedResearchFact,
  deriveRunStatusFromFacts,
  hashUrl,
  recordSources,
  insertAiExtractedFacts,
  createResearchRun,
  completeRun,
  beginRefreshRun,
} = persistMod;
const { generateResearchBrief, RESEARCH_BRIEF_DISCLOSURE } = briefMod;
const { executeResearchRun } = executeMod;
const { matchExistingClient } = partyMod;

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

/** In-memory fake Supabase for persist/execute tests. */
function createMemoryDb() {
  const tables = {
    research_runs: [],
    research_sources: [],
    research_facts: [],
  };
  let seq = 0;
  const id = () => {
    seq += 1;
    return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  };

  function from(table) {
    const rows = tables[table];
    if (!rows) throw new Error(`unknown table ${table}`);

    return {
      insert(payload) {
        const list = Array.isArray(payload) ? payload : [payload];
        const inserted = list.map((row) => ({
          created_at: new Date().toISOString(),
          ...row,
          id: row.id ?? id(),
        }));
        // unique (research_run_id, url) for sources
        if (table === "research_sources") {
          for (const row of inserted) {
            const dup = rows.find((r) => r.research_run_id === row.research_run_id && r.url === row.url);
            if (dup) {
              return {
                select() {
                  return {
                    single: async () => ({ data: null, error: { message: "duplicate key", code: "23505" } }),
                  };
                },
              };
            }
          }
        }
        rows.push(...inserted);
        return {
          select() {
            return {
              single: async () => ({ data: inserted[0], error: null }),
            };
          },
        };
      },
      update(patch) {
        const filters = [];
        const chain = {
          eq(col, val) {
            filters.push([col, val]);
            return chain;
          },
          then(resolve) {
            return Promise.resolve(apply()).then(resolve);
          },
        };
        async function apply() {
          for (const row of rows) {
            if (filters.every(([c, v]) => row[c] === v)) Object.assign(row, patch);
          }
          return { error: null };
        }
        // Make awaitable
        chain.then = (onFulfilled, onRejected) => apply().then(onFulfilled, onRejected);
        return chain;
      },
      select(_cols) {
        const filters = [];
        const chain = {
          eq(col, val) {
            filters.push([col, val]);
            return chain;
          },
          maybeSingle: async () => {
            const hit = rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null;
            return { data: hit, error: null };
          },
          order() {
            return chain;
          },
          limit() {
            return Promise.resolve({
              data: rows.filter((r) => filters.every(([c, v]) => r[c] === v)),
              error: null,
            });
          },
          then(onFulfilled, onRejected) {
            return Promise.resolve({
              data: rows.filter((r) => filters.every(([c, v]) => r[c] === v)),
              error: null,
            }).then(onFulfilled, onRejected);
          },
        };
        return chain;
      },
    };
  }

  return {
    from,
    _tables: tables,
  };
}

// --- Plan ---
check("isResearchType recognizes F4 types", () => {
  assert.equal(isResearchType("BUYER"), true);
  assert.equal(isResearchType("PRICING_CONTEXT"), true);
  assert.equal(isResearchType("NOPE"), false);
});

check("buildResearchPlan emits deterministic subquestions for BUYER", () => {
  const a = buildResearchPlan("BUYER", { query: "Allen ISD", entityName: "Allen ISD" });
  const b = buildResearchPlan("BUYER", { query: "Allen ISD", entityName: "Allen ISD" });
  assert.deepEqual(a.subquestions, b.subquestions);
  assert.ok(a.subquestions.length >= 3);
  assert.ok(a.subquestions.some((s) => s.provider_hint === "usa_spending"));
  assert.ok(a.subquestions.some((s) => s.provider_hint === "web" || s.provider_hint === "both"));
});

check("buildResearchPlan requires query", () => {
  assert.throws(() => buildResearchPlan("MARKET", { query: "  " }), /required/i);
});

// --- Persist builders ---
check("buildAiExtractedFactRow forces AI_EXTRACTED and maps claim↔title", () => {
  const row = buildAiExtractedFactRow({
    organizationId: "org-1",
    researchRunId: "run-1",
    fact: {
      source_url: "https://example.gov/a",
      title: "Title claim",
      excerpt: "snippet",
      provider: "tavily",
    },
  });
  assert.equal(row.verification_status, "AI_EXTRACTED");
  assert.equal(row.verified_by, null);
  assert.equal(row.claim, "Title claim");
  assert.equal(row.title, "Title claim");
});

check("assertUnverifiedResearchFact refuses HUMAN_VERIFIED", () => {
  assert.throws(
    () => assertUnverifiedResearchFact({ verification_status: "HUMAN_VERIFIED" }),
    /cannot write verified/i,
  );
});

check("refuseFixtureProvider blocks FIXTURE-* and fixture provider", () => {
  assert.throws(() => refuseFixtureProvider("fixture", "x"), /FIXTURE/i);
  assert.throws(() => refuseFixtureProvider("tavily", "FIXTURE-SAM-001"), /FIXTURE/i);
  refuseFixtureProvider("tavily", "live-1");
});

check("buildAiExtractedFactRow refuses fixture providers", () => {
  assert.throws(
    () =>
      buildAiExtractedFactRow({
        organizationId: "org",
        researchRunId: "run",
        fact: { source_url: "https://x.test", provider: "fixture", external_id: "FIXTURE-1" },
      }),
    /FIXTURE/i,
  );
});

check("deriveRunStatusFromFacts transitions sensibly", () => {
  assert.equal(deriveRunStatusFromFacts([]), "REVIEW_READY");
  assert.equal(deriveRunStatusFromFacts(["AI_EXTRACTED"]), "REVIEW_READY");
  assert.equal(deriveRunStatusFromFacts(["HUMAN_VERIFIED", "REJECTED"]), "VERIFIED");
  assert.equal(deriveRunStatusFromFacts(["REJECTED", "REJECTED"]), "REJECTED");
  assert.equal(deriveRunStatusFromFacts(["HUMAN_VERIFIED", "NEEDS_REVIEW"]), "REVIEW_READY");
  assert.equal(deriveRunStatusFromFacts(["CONFLICT"]), "REVIEW_READY");
});

check("hashUrl is stable", () => {
  assert.equal(hashUrl("https://a.example/x"), hashUrl("https://a.example/x"));
  assert.notEqual(hashUrl("https://a.example/x"), hashUrl("https://a.example/y"));
});

await checkAsync("recordSources dedupes by run+url and retains history on refresh", async () => {
  const db = createMemoryDb();
  const org = "org-1";
  const runId = "run-1";
  // seed run row not required for memory insert of sources
  const map1 = await recordSources(db, {
    organizationId: org,
    researchRunId: runId,
    sources: [
      {
        url: "https://example.gov/one",
        title: "One",
        provider: "tavily",
        excerpt: "a",
      },
    ],
  });
  assert.equal(map1.size, 1);
  const firstId = map1.get("https://example.gov/one");
  const map2 = await recordSources(db, {
    organizationId: org,
    researchRunId: runId,
    sources: [
      {
        url: "https://example.gov/one",
        title: "One again",
        provider: "tavily",
        excerpt: "b",
      },
      {
        url: "https://example.gov/two",
        title: "Two",
        provider: "brave",
      },
    ],
  });
  assert.equal(map2.get("https://example.gov/one"), firstId);
  assert.equal(db._tables.research_sources.length, 2);
  assert.equal(db._tables.research_sources.filter((s) => s.url.includes("one")).length, 1);
});

await checkAsync("insertAiExtractedFacts only AI_EXTRACTED", async () => {
  const db = createMemoryDb();
  const ids = await insertAiExtractedFacts(db, {
    organizationId: "org",
    researchRunId: "run",
    facts: [
      {
        source_url: "https://example.gov/f",
        title: "Fact",
        provider: "web",
      },
    ],
  });
  assert.equal(ids.length, 1);
  assert.equal(db._tables.research_facts[0].verification_status, "AI_EXTRACTED");
  assert.equal(db._tables.research_facts[0].verified_by, null);
});

await checkAsync("createResearchRun QUEUED→RESEARCHING then complete REVIEW_READY", async () => {
  const db = createMemoryDb();
  const plan = buildResearchPlan("MARKET", { query: "TX security" });
  const created = await createResearchRun(db, {
    organizationId: "org",
    createdBy: "user-1",
    researchType: "MARKET",
    query: "TX security",
    plan,
  });
  assert.equal(created.status, "RESEARCHING");
  assert.equal(db._tables.research_runs[0].status, "RESEARCHING");
  await completeRun(db, {
    organizationId: "org",
    researchRunId: created.id,
    status: "REVIEW_READY",
  });
  assert.equal(db._tables.research_runs[0].status, "REVIEW_READY");
  await beginRefreshRun(db, { organizationId: "org", researchRunId: created.id });
  assert.equal(db._tables.research_runs[0].status, "RESEARCHING");
  assert.equal(db._tables.research_runs[0].completed_at, null);
});

// --- Ambiguous entity ---
check("ambiguous entity match leaves null (no invent)", () => {
  const clients = [
    { id: "c1", name: "Acme Security" },
    { id: "c2", name: "Acme Security Inc" },
  ];
  // Both normalize to ACME SECURITY → ambiguity
  const result = matchExistingClient({ name: "Acme Security" }, clients);
  assert.equal(result.ambiguity, true);
  assert.equal(result.match, null);
});

await checkAsync("executeResearchRun soft-links exact only; ambiguous stays null", async () => {
  const db = createMemoryDb();
  const result = await executeResearchRun(db, {
    organizationId: "org",
    createdBy: "user-1",
    researchType: "BUYER",
    query: "Acme",
    entityName: "Acme Security",
    clients: [
      { id: "c1", name: "Acme Security" },
      { id: "c2", name: "Acme Security Inc" },
    ],
    competitors: [],
    webSearch: async () => [
      {
        title: "Acme award notice",
        url: "https://example.gov/award",
        snippet: "Award to Acme",
        published_date: "2024-01-01",
      },
    ],
    usaSearch: async () => [],
    webProviderId: "tavily",
  });
  assert.equal(result.status, "REVIEW_READY");
  assert.ok(result.factCount >= 1);
  for (const fact of db._tables.research_facts) {
    assert.equal(fact.client_id, null);
    assert.equal(fact.verification_status, "AI_EXTRACTED");
  }
});

await checkAsync("executeResearchRun exact entity link when unambiguous", async () => {
  const db = createMemoryDb();
  await executeResearchRun(db, {
    organizationId: "org",
    createdBy: "user-1",
    researchType: "COMPETITOR",
    query: "Lone Star",
    entityName: "Lone Star Guarding",
    clients: [],
    competitors: [{ id: "comp-1", name: "Lone Star Guarding" }],
    webSearch: async () => [
      { title: "Profile", url: "https://example.com/ls", snippet: "about", published_date: null },
    ],
    usaSearch: async () => [],
    webProviderId: "brave",
  });
  assert.ok(db._tables.research_facts.some((f) => f.competitor_id === "comp-1"));
});

// --- Brief ---
check("generateResearchBrief separates verified vs unverified and discloses", () => {
  const brief = generateResearchBrief("run-x", [
    {
      id: "1",
      title: "V",
      claim: "Verified claim",
      excerpt: null,
      source_url: "https://a",
      verification_status: "HUMAN_VERIFIED",
    },
    {
      id: "2",
      title: "U",
      claim: "Unverified claim",
      excerpt: null,
      source_url: "https://b",
      verification_status: "AI_EXTRACTED",
    },
  ]);
  assert.equal(brief.verifiedClaims.length, 1);
  assert.equal(brief.unverifiedClaims.length, 1);
  assert.match(brief.disclosure, /not L&P truth/i);
  assert.equal(brief.disclosure, RESEARCH_BRIEF_DISCLOSURE);
  assert.ok(!brief.insufficient);
});

// --- Architecture / honesty greps ---
await checkAsync("migration preserves research_facts_verified_requires_actor", async () => {
  const sql = await read("supabase/migrations/20260821220000_f4_research_pipeline.sql");
  assert.match(sql, /research_facts_verified_requires_actor/);
  assert.match(sql, /research_runs/);
  assert.match(sql, /research_sources/);
  assert.match(sql, /is_org_member/);
  assert.doesNotMatch(sql, /drop constraint research_facts_verified_requires_actor/);
});

await checkAsync("no LangGraph import / no second chatbot in F4 research lib", async () => {
  const files = [
    "apps/web/lib/ask/research/plan.ts",
    "apps/web/lib/ask/research/persist-run.ts",
    "apps/web/lib/ask/research/execute-run.ts",
    "apps/web/lib/ask/research/synthesize-brief.ts",
    "apps/web/app/(platform)/intelligence/research/page.tsx",
    "apps/web/app/(platform)/intelligence/research/[runId]/page.tsx",
  ];
  for (const f of files) {
    const src = await read(f);
    assert.doesNotMatch(src, /from ["']langgraph|require\(["']langgraph/i);
    assert.doesNotMatch(src, /AskChatClient/);
  }
});

await checkAsync("Ask prefers verified research_facts tool; live public remains cite-only", async () => {
  const tools = await read("apps/web/lib/ask/tools.ts");
  const agent = await read("apps/web/lib/ask/agent.ts");
  assert.match(tools, /search_verified_research_facts/);
  assert.match(tools, /HUMAN_VERIFIED research_facts only/);
  assert.match(tools, /eq\("verification_status", "HUMAN_VERIFIED"\)/);
  assert.match(agent, /search_verified_research_facts/);
  assert.match(agent, /cite-only/);
});

await checkAsync("reports still gate research_facts on HUMAN_VERIFIED", async () => {
  const gen = await read("apps/web/lib/reports/generate.ts");
  assert.match(gen, /research_facts/);
  assert.match(gen, /HUMAN_VERIFIED/);
});

await checkAsync("verify actions require actor fields", async () => {
  const actions = await read("apps/web/app/(platform)/intelligence/research/actions.ts");
  assert.match(actions, /verifyResearchFact/);
  assert.match(actions, /rejectResearchFact/);
  assert.match(actions, /editResearchFact/);
  assert.match(actions, /markConflictResearchFact/);
  assert.match(actions, /verified_by:\s*userId/);
  assert.match(actions, /Actor required/);
  assert.match(actions, /research_fact_id/);
  assert.match(actions, /verification_events/);
});

await checkAsync("Intelligence Research tab wired", async () => {
  const tabs = await read("apps/web/components/section-tabs.tsx");
  assert.match(tabs, /\/intelligence\/research/);
  assert.match(tabs, /Research/);
});

// Summary
const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok);
console.log(`F4 research pipeline: ${passed.length}/${results.length} PASS`);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.message ? ` — ${r.message}` : ""}`);
}

const outDir = path.join(root, "docs/benchmarks");
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(
  path.join(outDir, "f4-research-pipeline-results.json"),
  JSON.stringify(
    {
      verdict: failed.length === 0 ? "PASS" : "FAIL",
      passed: passed.length,
      total: results.length,
      results,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);

process.exit(failed.length === 0 ? 0 : 1);
