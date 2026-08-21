#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const fixtures = JSON.parse(
  await fs.readFile(path.join(import.meta.dirname, "fixtures/hybrid-retrieval-eval.json"), "utf8"),
);
const results = [];
const scores = [];
const orgIds = [];
const users = [];
const require = createRequire(import.meta.url);

function record(area, name, ok, detail = "") {
  results.push({ area, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(area, name, fn) {
  try {
    const detail = await fn();
    record(area, name, true, detail ?? "");
  } catch (error) {
    record(area, name, false, error instanceof Error ? error.message : String(error));
  }
}

async function bundleEmbedding() {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "lp-f21-accept-"));
  const outfile = path.join(outDir, "embed.cjs");
  await esbuild.build({
    entryPoints: [path.join(webRoot, "lib/retrieval/embed.ts")],
    outfile,
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node24",
    logLevel: "warning",
  });
  return require(outfile);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

function adminClient() {
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient() {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email, password) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return client;
}

async function seedCase(client, orgId, userId, fixture) {
  const sha = createHash("sha256")
    .update(`${fixtures.version}:${fixture.id}:${orgId}`)
    .digest("hex");
  const { data: document, error: docError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      original_filename: `f21-${fixture.id}.pdf`,
      document_type: "proposal",
      commercial_truth: "proposed",
      mime_type: "application/pdf",
    })
    .select("id")
    .single();
  if (docError) throw new Error(docError.message);

  const { data: version, error: versionError } = await client
    .from("document_versions")
    .insert({
      organization_id: orgId,
      document_id: document.id,
      sha256: sha,
      storage_path: `${orgId}/${document.id}/v/${sha}/original.pdf`,
      is_current: fixture.current,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);

  const { data: run, error: runError } = await client
    .from("extraction_runs")
    .insert({ organization_id: orgId, document_version_id: version.id })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  const { data: fact, error: factError } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: run.id,
      document_id: document.id,
      document_version_id: version.id,
      entity: "f21_eval",
      field: fixture.id,
      raw_value: fixture.content,
      normalized_value: fixture.content,
      verified_value: fixture.content,
      source_excerpt: fixture.content,
      verification_status: "HUMAN_VERIFIED",
      verified_by: userId,
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (factError) throw new Error(factError.message);

  const promoted = await client.rpc("promote_knowledge_chunk_from_fact", {
    p_fact_id: fact.id,
  });
  if (promoted.error || !promoted.data?.ok) {
    throw new Error(promoted.error?.message ?? JSON.stringify(promoted.data));
  }

  const classified = await client.rpc("set_document_data_classification", {
    p_document_id: document.id,
    p_data_classification: "verified_internal",
    p_reason: "Ephemeral F21 retrieval acceptance fixture.",
  });
  if (classified.error || !classified.data?.ok) {
    throw new Error(classified.error?.message ?? JSON.stringify(classified.data));
  }

  const { data: chunk, error: chunkError } = await client
    .from("document_chunks")
    .update({
      reuse_status: fixture.reuseStatus,
      is_current_version: fixture.current,
    })
    .eq("source_fact_id", fact.id)
    .select("id, content")
    .single();
  if (chunkError) throw new Error(chunkError.message);
  return { ...fixture, chunkId: chunk.id, documentId: document.id };
}

const embedding = await bundleEmbedding();
const provider = embedding.getEmbeddingProvider();

await check("provider", "content hash is deterministic SHA-256", () => {
  const hash = embedding.contentHash("verified content");
  assert.equal(hash, createHash("sha256").update("verified content").digest("hex"));
});
await check("provider", "model and dimension mismatch fail closed", () => {
  assert.throws(
    () => embedding.assertCompatible({ model: "other/model@1", dim: 1536 }),
    /Incompatible embedding metadata/,
  );
  assert.throws(
    () => embedding.assertCompatible({ model: provider.compatibilityId, dim: 3072 }),
    /Incompatible embedding metadata/,
  );
});

for (const [rel, patterns] of Object.entries({
  "apps/web/lib/retrieval/search.ts": ["embedQuery", "p_embedding_model", "p_embedding_dim"],
  "apps/web/lib/ask/tools.ts": ["embedQuery(query)", "searchVerifiedKnowledge"],
  "apps/web/lib/content/match-requirement.ts": ["searchVerifiedKnowledge"],
  "apps/web/lib/reports/generate.ts": ["searchVerifiedKnowledge"],
  "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/response/page.tsx": [
    "searchVerifiedKnowledge",
  ],
})) {
  await check("wiring", `${rel} uses governed retrieval`, async () => {
    const source = await fs.readFile(path.join(root, rel), "utf8");
    for (const pattern of patterns) assert.ok(source.includes(pattern), `missing ${pattern}`);
  });
}

if (!url || !publishable || !secret) {
  record(
    "database",
    "live hybrid evaluation",
    false,
    "Missing Supabase environment; migration/RLS evaluation cannot run.",
  );
} else {
  const admin = adminClient();
  const stamp = Date.now().toString(36);
  const password = "F21-Hybrid-Temporary!42";
  const emailA = `f21-a-${stamp}@example.com`;
  const emailB = `f21-b-${stamp}@example.com`;

  try {
    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createdA.error || !createdA.data.user) throw new Error(createdA.error?.message ?? "user A");
    if (createdB.error || !createdB.data.user) throw new Error(createdB.error?.message ?? "user B");
    users.push(createdA.data.user, createdB.data.user);

    const asA = await signIn(emailA, password);
    const asB = await signIn(emailB, password);
    const orgAResult = await asA.rpc("create_organization_with_admin", {
      org_name: `F21 A ${stamp}`,
    });
    const orgBResult = await asB.rpc("create_organization_with_admin", {
      org_name: `F21 B ${stamp}`,
    });
    if (orgAResult.error || orgBResult.error) {
      throw new Error(orgAResult.error?.message ?? orgBResult.error?.message);
    }
    const orgA = orgAResult.data;
    const orgB = orgBResult.data;
    orgIds.push(orgA, orgB);

    const seeded = [];
    for (const fixture of fixtures.cases) {
      const client = fixture.tenant === "B" ? asB : asA;
      const orgId = fixture.tenant === "B" ? orgB : orgA;
      const userId =
        fixture.tenant === "B" ? createdB.data.user.id : createdA.data.user.id;
      seeded.push(await seedCase(client, orgId, userId, fixture));
    }

    const smokeQuery = await embedding.embedQuery(
      "personnel who protect a courthouse overnight",
    );
    const semanticLive = Array.isArray(smokeQuery) && smokeQuery.length === provider.dim;
    record(
      "activation",
      semanticLive ? "real query embeddings active" : "FTS fallback active",
      true,
      semanticLive
        ? `${provider.compatibilityId}/${provider.dim}`
        : "Provider unavailable or failed; semantic-only assertions skipped.",
    );

    if (semanticLive) {
      const embeddable = seeded.filter((row) => row.embedding);
      const vectors = await embedding.embedTexts(embeddable.map((row) => row.content));
      assert.ok(vectors, "configured provider failed corpus embedding");
      for (let index = 0; index < embeddable.length; index += 1) {
        const row = embeddable[index];
        const model = row.wrongModel ? "incompatible/test-model@9" : provider.compatibilityId;
        const { error } = await (row.tenant === "B" ? asB : asA)
          .from("document_chunks")
          .update({
            embedding: `[${vectors[index].join(",")}]`,
            embedding_model: model,
            embedding_dim: provider.dim,
            embedding_content_hash: embedding.contentHash(row.content),
            embedding_generated_at: new Date().toISOString(),
          })
          .eq("id", row.chunkId);
        if (error) throw new Error(error.message);
      }
    }

    for (const row of seeded.filter((entry) => entry.tenant !== "B")) {
      const queryVector = semanticLive ? await embedding.embedQuery(row.query) : null;
      if (semanticLive && row.semantic) {
        assert.ok(queryVector, `${row.id}: provider available but query embedding was null`);
      }
      const { data, error } = await asA.rpc("search_verified_knowledge", {
        p_query: row.query,
        p_query_embedding: queryVector ? `[${queryVector.join(",")}]` : null,
        p_for_drafting: row.purpose === "PROPOSAL_DRAFTING",
        p_limit: 50,
        p_purpose: row.purpose,
        p_embedding_model: queryVector ? provider.compatibilityId : null,
        p_embedding_dim: queryVector ? provider.dim : null,
      });
      if (error) throw new Error(`${row.id}: ${error.message}`);
      const hit = (data ?? []).find((entry) => entry.chunk_id === row.chunkId);
      if (row.expectExcluded) {
        assert.equal(hit, undefined, `${row.id} crossed a trust/reuse/version gate`);
        scores.push({ id: row.id, score: null, matchKind: "excluded" });
      } else if (row.semantic && !semanticLive) {
        scores.push({ id: row.id, score: null, matchKind: "semantic_skipped_fts_fallback" });
      } else {
        assert.ok(hit, `${row.id} expected a retrieval hit`);
        if (row.expectMatchKind) assert.equal(hit.match_kind, row.expectMatchKind);
        scores.push({
          id: row.id,
          score: Number(Number(hit.rank).toFixed(6)),
          matchKind: hit.match_kind,
        });
      }
    }

    const tenantFixture = seeded.find((row) => row.id === "wrong_tenant");
    const { data: tenantHits, error: tenantError } = await asA.rpc(
      "search_verified_knowledge",
      {
        p_query: tenantFixture.query,
        p_query_embedding: null,
        p_for_drafting: false,
        p_limit: 50,
        p_purpose: tenantFixture.purpose,
        p_embedding_model: null,
        p_embedding_dim: null,
      },
    );
    if (tenantError) throw new Error(tenantError.message);
    assert.ok(
      !(tenantHits ?? []).some((row) => row.chunk_id === tenantFixture.chunkId),
      "wrong-tenant chunk leaked",
    );
    scores.push({ id: "wrong_tenant", score: null, matchKind: "excluded" });

    const exact = seeded.find((row) => row.id === "exact_lexical");
    if (!semanticLive) {
      const zeroVector = Array(provider.dim).fill(0);
      const { error: seedEmbeddingError } = await asA
        .from("document_chunks")
        .update({
          embedding: `[${zeroVector.join(",")}]`,
          embedding_model: provider.compatibilityId,
          embedding_dim: provider.dim,
          embedding_content_hash: embedding.contentHash(exact.content),
          embedding_generated_at: new Date().toISOString(),
        })
        .eq("id", exact.chunkId);
      if (seedEmbeddingError) throw new Error(seedEmbeddingError.message);
    }
    const { data: before } = await asA
      .from("document_chunks")
      .select("embedding")
      .eq("id", exact.chunkId)
      .single();
    assert.ok(before?.embedding);
    const { data: changed, error: changedError } = await asA
      .from("document_chunks")
      .update({ content: `${exact.content} Updated source text.` })
      .eq("id", exact.chunkId)
      .select(
        "embedding, embedding_model, embedding_dim, embedding_content_hash, embedding_generated_at",
      )
      .single();
    if (changedError) throw new Error(changedError.message);
    assert.deepEqual(changed, {
      embedding: null,
      embedding_model: null,
      embedding_dim: null,
      embedding_content_hash: null,
      embedding_generated_at: null,
    });
    record("lifecycle", "content change invalidates stale embedding", true);

    const saved = {
      AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
      VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
      VERCEL: process.env.VERCEL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
    };
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.VERCEL;
    delete process.env.OPENAI_API_KEY;
    process.env.EMBEDDING_MODEL = "unconfigured/provider-model";
    const failedEmbedding = await embedding.embedQuery("provider failure fallback");
    assert.equal(failedEmbedding, null);
    Object.entries(saved).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    record("fallback", "provider unavailable returns null for FTS fallback", true);

    record("evaluation", "fixture retrieval cases", true, JSON.stringify(scores));
  } catch (error) {
    record("fatal", "live hybrid evaluation", false, error instanceof Error ? error.message : String(error));
  } finally {
    for (const orgId of orgIds) {
      await admin.from("organizations").delete().eq("id", orgId);
    }
    for (const user of users) {
      if (user?.id) await admin.auth.admin.deleteUser(user.id);
    }
  }
}

const failed = results.filter((row) => !row.ok).length;
console.log(
  JSON.stringify({
    verdict: failed ? "FAIL" : "PASS",
    providerConfigured: provider.configured,
    provider: provider.provider,
    model: provider.compatibilityId,
    dim: provider.dim,
    scores,
    passed: results.length - failed,
    failed,
    total: results.length,
  }),
);
process.exit(failed ? 1 : 0);
