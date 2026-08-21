#!/usr/bin/env node
/**
 * F23 coverage report from DB → docs/corpus/CORPUS_COVERAGE.md
 * Run: npm run report:corpus-coverage
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import os from "node:os";
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const orgName = process.env.LP_OPERATOR_ORG_NAME?.trim() || "L&P Global Security";

if (!url || !secret) {
  console.error("Missing Supabase env");
  process.exit(1);
}

async function bundle() {
  const webRoot = join(ROOT, "apps/web");
  const outfile = join(await fs.mkdtemp(join(os.tmpdir(), "lp-f23-cov-")), "out.mjs");
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

const { buildCoverageReport, coverageReportMarkdown } = await bundle();
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: orgs } = await db.from("organizations").select("id, name").ilike("name", `%${orgName}%`).limit(1);
const orgId = orgs?.[0]?.id;
if (!orgId) {
  console.error("Org not found:", orgName);
  process.exit(1);
}

const { data: rows, error } = await db
  .from("acquisition_candidates")
  .select(
    "id, url, title, corpus_role, source_authority, status, sha256, document_id, package_key, buyer_name, seed_section, last_error",
  )
  .eq("organization_id", orgId);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const report = buildCoverageReport(rows ?? []);
const out = join(ROOT, "docs/corpus/CORPUS_COVERAGE.md");
writeFileSync(out, coverageReportMarkdown(report));
console.log(`Wrote ${out}`);
console.log(JSON.stringify(report.totals, null, 2));
