#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const require = createRequire(import.meta.url);

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  return value ?? fallback;
}

const limit = Math.min(Math.max(Number(arg("limit", "25")) || 25, 1), 500);
const batchSize = Math.min(Math.max(Number(arg("batch", "8")) || 8, 1), 50);
let cursor = arg("after", "");

async function loadEmbeddingModule() {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "lp-f21-embed-"));
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
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const embedding = await loadEmbeddingModule();
const provider = embedding.getEmbeddingProvider();
if (!provider.configured) {
  console.log(
    JSON.stringify({
      status: "FTS_FALLBACK",
      reason: "Embedding provider unavailable. No rows changed.",
      model: provider.compatibilityId,
    }),
  );
  process.exit(0);
}

const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let scanned = 0;
let embedded = 0;
let skipped = 0;
let failed = 0;

while (scanned < limit) {
  const take = Math.min(batchSize, limit - scanned);
  let query = db
    .from("document_chunks")
    .select(
      "id, content, embedding, embedding_model, embedding_dim, embedding_content_hash",
    )
    .eq("verification_status", "HUMAN_VERIFIED")
    .in("reuse_status", ["APPROVED", "REVIEW_REQUIRED"])
    .eq("is_current_version", true)
    .in("data_classification", ["verified_public", "verified_internal"])
    .order("id", { ascending: true })
    .limit(take);
  if (cursor) query = query.gt("id", cursor);

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  if (!rows?.length) break;

  scanned += rows.length;
  cursor = rows.at(-1).id;

  const stale = rows.filter((row) => {
    const hash = embedding.contentHash(row.content);
    const current =
      row.embedding &&
      row.embedding_model === provider.compatibilityId &&
      row.embedding_dim === provider.dim &&
      row.embedding_content_hash === hash;
    if (current) skipped += 1;
    return !current;
  });
  if (!stale.length) continue;

  const vectors = await embedding.embedTexts(stale.map((row) => row.content));
  if (!vectors) {
    failed += stale.length;
    console.log(
      JSON.stringify({
        status: "PROVIDER_FAILURE_FTS_FALLBACK",
        scanned,
        embedded,
        skipped,
        failed,
        nextCursor: cursor,
      }),
    );
    break;
  }

  for (let index = 0; index < stale.length; index += 1) {
    const row = stale[index];
    const vector = vectors[index];
    const hash = embedding.contentHash(row.content);
    const { data: updated, error: updateError } = await db
      .from("document_chunks")
      .update({
        embedding: `[${vector.join(",")}]`,
        embedding_model: provider.compatibilityId,
        embedding_dim: provider.dim,
        embedding_content_hash: hash,
        embedding_generated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("content", row.content)
      .eq("verification_status", "HUMAN_VERIFIED")
      .in("reuse_status", ["APPROVED", "REVIEW_REQUIRED"])
      .eq("is_current_version", true)
      .in("data_classification", ["verified_public", "verified_internal"])
      .select("id");
    if (updateError || !updated?.length) failed += 1;
    else embedded += 1;
  }
}

console.log(
  JSON.stringify({
    status: failed ? "PARTIAL" : "COMPLETE",
    provider: provider.provider,
    model: provider.compatibilityId,
    dim: provider.dim,
    scanned,
    embedded,
    skipped,
    failed,
    nextCursor: cursor || null,
  }),
);
