#!/usr/bin/env node
/**
 * F23 — Corpus acquisition acceptance.
 *
 * Run: npm run test:f23-corpus
 *      node --env-file=apps/web/.env.local scripts/f23-corpus-acceptance.mjs
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");

async function bundle() {
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "lp-f23-acc-")), "out.mjs");
  await esbuild.build({
    entryPoints: [path.join(webRoot, "lib/corpus/index.ts")],
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

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push({
      name,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
    console.log(`FAIL  ${name} — ${err instanceof Error ? err.message : err}`);
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push({
      name,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
    console.log(`FAIL  ${name} — ${err instanceof Error ? err.message : err}`);
  }
}

const corpus = await bundle();
const {
  parseRegistryText,
  classifyCorpusRole,
  isDiscoveryLeadOnly,
  mapRoleToCorpusClass,
  sha256Hex,
  detectMagic,
  acquirePathAllowsHumanVerified,
  ingestSetsHumanVerified,
  seedCandidatesFromParties,
  buildCoverageReport,
  fetchCandidate,
} = corpus;

const registryPath = path.join(root, "docs/corpus/F23A_Exact_Public_Source_URL_Registry.txt");
const migrationPath = path.join(
  root,
  "supabase/migrations/20260821340000_f23_corpus_acquisition.sql",
);

check("migration file exists", () => {
  assert.ok(existsSync(migrationPath));
});

check("migration defines acquisition_candidates + RLS + authority check", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /create table if not exists public\.acquisition_candidates/);
  assert.match(sql, /acquisition_saturation_runs/);
  assert.match(sql, /source_authority in \(1, 2, 3\)/);
  assert.match(sql, /L_AND_P_DIRECT/);
  assert.match(sql, /is_org_member\(organization_id\)/);
  assert.match(sql, /Never auto HUMAN_VERIFIED|Never implies HUMAN_VERIFIED/);
  assert.doesNotMatch(sql, /verification_status\s*=\s*'HUMAN_VERIFIED'|set\s+HUMAN_VERIFIED/i);
});

check("registry parse extracts F23A section C URLs", () => {
  const text = readFileSync(registryPath, "utf8");
  const seeds = parseRegistryText(text);
  assert.ok(seeds.length >= 20, `expected >=20 seeds, got ${seeds.length}`);
  const sectionC = seeds.filter((s) => s.section.startsWith("C."));
  assert.ok(sectionC.length >= 8, `expected >=8 section C URLs, got ${sectionC.length}`);
  assert.ok(
    sectionC.some((s) => /ftp\.txdmv\.gov/i.test(s.url)),
    "TxDMV PO URL missing",
  );
  assert.ok(
    sectionC.some((s) => /AllenISD|allen/i.test(s.url + s.title)),
    "Allen ISD seed missing",
  );
});

check("role classification: clear L&P PO → L_AND_P_DIRECT", () => {
  const r = classifyCorpusRole({
    url: "https://ftp.txdmv.gov/pub/txdmv-info/fas/contract_reporting/60800%200000016167.pdf",
    title: "TxDMV — L&P Purchase Order #0000016167",
    buyerName: "Texas Department of Motor Vehicles",
  });
  assert.equal(r.corpusRole, "L_AND_P_DIRECT");
  assert.ok(r.sourceAuthority === 1 || r.sourceAuthority === 2);
});

check("role classification: bid tab without L&P → COMPETITOR_EVIDENCE", () => {
  const r = classifyCorpusRole({
    url: "https://jeffersoncountytx.gov/Purchasing/NoticesForBid/View/TAB/12",
    title: "Jefferson County — Preliminary Bid Tab",
    buyerName: "Jefferson County",
  });
  assert.equal(r.corpusRole, "COMPETITOR_EVIDENCE");
});

check("role classification: ambiguous never forced to L_AND_P_DIRECT", () => {
  const r = classifyCorpusRole({
    url: "https://example.com/security-rfp.pdf",
    title: "Armed Security Services RFP",
    buyerName: "Some City",
  });
  assert.notEqual(r.corpusRole, "L_AND_P_DIRECT");
});

check("authority 3 is discovery-lead only", () => {
  assert.equal(isDiscoveryLeadOnly(3), true);
  assert.equal(isDiscoveryLeadOnly(1), false);
});

check("role → corpus_class mapping", () => {
  assert.equal(mapRoleToCorpusClass("L_AND_P_DIRECT"), "A_LP_ORIGINATED");
  assert.equal(mapRoleToCorpusClass("BUYER_HISTORY"), "B_LP_TIED");
  assert.equal(mapRoleToCorpusClass("COMPETITOR_EVIDENCE"), "C_COMPETITOR_TEST");
  assert.equal(mapRoleToCorpusClass("REFERENCE_DATA"), null);
});

check("checksum sha256 length 64", () => {
  const hex = sha256Hex(Buffer.from("%PDF-1.1 test"));
  assert.equal(hex.length, 64);
  assert.match(hex, /^[a-f0-9]{64}$/);
});

check("magic detect PDF / HTML", () => {
  assert.equal(detectMagic(Buffer.from("%PDF-1.4\n")), "pdf");
  assert.equal(detectMagic(Buffer.from("<!DOCTYPE html><html></html>")), "html");
});

check("acquire path cannot HUMAN_VERIFIED", () => {
  assert.equal(acquirePathAllowsHumanVerified(), false);
  assert.equal(ingestSetsHumanVerified(), false);
});

check("ingest-candidate source never mentions HUMAN_VERIFIED assignment", () => {
  const src = readFileSync(path.join(webRoot, "lib/corpus/ingest-candidate.ts"), "utf8");
  assert.doesNotMatch(src, /verification_status\s*:\s*["']HUMAN_VERIFIED["']/);
  assert.match(src, /AI_EXTRACTED/);
});

check("party seeds are hunt stubs (authority 3) and competitors never L_AND_P", () => {
  const seeds = seedCandidatesFromParties("00000000-0000-4000-8000-000000000001", [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Allen ISD", kind: "buyer" },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Rival Guards LLC", kind: "competitor" },
  ]);
  assert.equal(seeds.length, 2);
  assert.equal(seeds[0].corpusRole, "BUYER_HISTORY");
  assert.equal(seeds[1].corpusRole, "COMPETITOR_EVIDENCE");
  assert.notEqual(seeds[1].corpusRole, "L_AND_P_DIRECT");
  assert.equal(seeds[0].sourceAuthority, 3);
});

check("coverage report separates statuses", () => {
  const report = buildCoverageReport([
    {
      id: "1",
      url: "https://a.example/a.pdf",
      title: "a",
      corpus_role: "L_AND_P_DIRECT",
      source_authority: 1,
      status: "INGESTED",
      sha256: "a".repeat(64),
      document_id: "d1",
      package_key: "PKG",
      buyer_name: "X",
      seed_section: "C.",
      last_error: null,
    },
    {
      id: "2",
      url: "https://b.example/",
      title: "b",
      corpus_role: "REFERENCE_DATA",
      source_authority: 2,
      status: "LINK_ONLY",
      sha256: null,
      document_id: null,
      package_key: null,
      buyer_name: null,
      seed_section: "A.",
      last_error: null,
    },
  ]);
  assert.equal(report.totals.ingested, 1);
  assert.equal(report.totals.link_only, 1);
  assert.equal(report.totals.candidates, 2);
});

check("duplicate sha256 identity", () => {
  const a = sha256Hex(Buffer.from("same-bytes"));
  const b = sha256Hex(Buffer.from("same-bytes"));
  const c = sha256Hex(Buffer.from("other"));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

await checkAsync("fetch LINK_ONLY for preferLinkOnly portals", async () => {
  const r = await fetchCandidate({
    url: "https://sam.gov/opportunities",
    downloadDir: path.join(os.tmpdir(), "f23-fetch-test"),
    preferLinkOnly: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.status, "LINK_ONLY");
});

check("no PDF/DOCX/XLSX binaries tracked by git under docs/corpus or docs/pilot/acquired", () => {
  let out = "";
  try {
    out = execSync("git ls-files docs/corpus docs/pilot/acquired", {
      cwd: root,
      encoding: "utf8",
    });
  } catch {
    out = "";
  }
  const bad = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((f) => /\.(pdf|docx|xlsx|xls)$/i.test(f));
  assert.equal(bad.length, 0, `binaries tracked: ${bad.join(", ")}`);
});

check("package.json scripts include corpus:acquire and test:f23-corpus", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts["corpus:acquire"]);
  assert.ok(pkg.scripts["test:f23-corpus"]);
  assert.ok(pkg.scripts["report:corpus-coverage"]);
});

check("acceptance + acquire scripts exist", () => {
  assert.ok(existsSync(path.join(root, "scripts/f23-acquire-run.mjs")));
  assert.ok(existsSync(path.join(root, "scripts/f23-corpus-acceptance.mjs")));
  assert.ok(existsSync(path.join(root, "scripts/f23-corpus-coverage-report.mjs")));
});

check("F23 docs exist or will be written by acquire", () => {
  // Acceptance doc must exist; run docs may appear after acquire.
  assert.ok(existsSync(path.join(root, "docs/functionality/F23_CORPUS_ACQUISITION_ACCEPTANCE.md")));
});

const failed = results.filter((r) => !r.ok);
console.log(`\nF23 corpus acceptance: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  for (const f of failed) console.error(` - ${f.name}: ${f.message}`);
  process.exit(1);
}
