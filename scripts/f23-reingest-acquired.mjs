#!/usr/bin/env node
/**
 * Re-ingest locally acquired F23 PDFs that failed vault auth on first pass.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import os from "node:os";
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const DOWNLOAD_DIR = join(ROOT, "docs/corpus/downloads");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.LP_OPERATOR_EMAIL?.trim();
const password = process.env.LP_OPERATOR_PASSWORD;
const orgName = process.env.LP_OPERATOR_ORG_NAME?.trim() || "L&P Global Security";

async function bundle() {
  const webRoot = join(ROOT, "apps/web");
  const outfile = join(await fs.mkdtemp(join(os.tmpdir(), "lp-f23-reingest-")), "out.mjs");
  await esbuild.build({
    entryPoints: [join(webRoot, "lib/corpus/index.ts")],
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

const { ingestCandidateBytes, classifyCorpusRole, sha256Hex } = await bundle();

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const user = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: signErr } = await user.auth.signInWithPassword({ email, password });
if (signErr) throw new Error(signErr.message);

const { data: mems } = await admin.from("memberships").select("organization_id").eq("user_id", (await user.auth.getUser()).data.user.id);
const { data: orgs } = await admin.from("organizations").select("id, name").in("id", mems.map((m) => m.organization_id));
const orgId = orgs.find((o) => o.name === orgName)?.id ?? orgs[0].id;

const files = readdirSync(DOWNLOAD_DIR).filter((f) => /\.pdf$/i.test(f));
console.log(`Re-ingest org=${orgId} files=${files.length}`);

for (const filename of files) {
  const path = join(DOWNLOAD_DIR, filename);
  const bytes = new Uint8Array(readFileSync(path));
  const sha = sha256Hex(bytes);
  const { data: cand } = await admin
    .from("acquisition_candidates")
    .select("id, url, title, buyer_name, corpus_role, status, document_id, package_key")
    .eq("organization_id", orgId)
    .eq("sha256", sha)
    .maybeSingle();

  const title = cand?.title ?? filename;
  const role =
    cand?.corpus_role ??
    classifyCorpusRole({ url: cand?.url ?? filename, title, buyerName: cand?.buyer_name }).corpusRole;

  const result = await ingestCandidateBytes(user, {
    organizationId: orgId,
    bytes,
    filename,
    mimeType: "application/pdf",
    corpusRole: role,
    packageKey: cand?.package_key ?? `F23-REINGEST-${filename.slice(0, 40)}`,
    packageTitle: title,
    batchLabel: "F23 corpus acquisition re-ingest",
    createPackage: role !== "REFERENCE_DATA",
  });

  console.log(
    `${filename}: ${result.status} doc=${result.documentId ?? "—"} dup=${result.duplicate} err=${result.error ?? ""}`,
  );

  if (cand?.id && (result.status === "INGESTED" || result.status === "DUPLICATE")) {
    await admin
      .from("acquisition_candidates")
      .update({
        status: result.status,
        document_id: result.documentId,
        sha256: result.sha256,
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", cand.id);
  }
}
