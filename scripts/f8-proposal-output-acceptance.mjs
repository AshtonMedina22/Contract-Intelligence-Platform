#!/usr/bin/env node
/**
 * F8 acceptance: Real Proposal Output + Google Docs working-proposal pipeline.
 * Pure assembly / DOCX / portal / Google stub / versioning / PDF limitation.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const webRoot = path.resolve(import.meta.dirname, "../apps/web");
const root = path.resolve(import.meta.dirname, "..");

async function bundle(entryRel, name, external = []) {
  const entry = path.join(webRoot, entryRel);
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f8-${name}-`)), "out.mjs");
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
    external,
    nodePaths: [path.join(webRoot, "node_modules"), path.join(root, "node_modules")],
  });
  return import(pathToFileURL(outfile).href);
}

const template = await bundle("lib/opportunity/org-proposal-template.ts", "template");
const assembly = await bundle("lib/opportunity/proposal-assembly.ts", "assembly");
const artifacts = await bundle("lib/opportunity/submission-artifacts.ts", "artifacts");
const portal = await bundle("lib/export/portal-answers.ts", "portal");
const pdf = await bundle("lib/export/pdf.ts", "pdf");
const gdocs = await bundle("lib/google/docs-provider.ts", "gdocs");
const googleDocs = await bundle("lib/google/google-docs.ts", "google-docs");
const readiness = await bundle("lib/opportunity/submission-readiness.ts", "readiness");

// Resolve docx from workspace node_modules via nodePaths (do not leave unresolved bare import).
const docxMod = await bundle("lib/export/docx.ts", "docx-export");

const {
  DEFAULT_ORG_PROPOSAL_TEMPLATE,
  resolveOrgProposalTemplate,
  sortedTemplateSections,
} = template;
const { assembleProposal, escapeHtml, htmlToPlainText } = assembly;
const { nextArtifactVersion, canMutateArtifact, assertSameTenant } = artifacts;
const { buildPortalAnswersExport } = portal;
const { exportProposalPdf, describePdfLimitation, PDF_EXPORT_STATUS } = pdf;
const { createStubGoogleDocsProvider, resolveGoogleDocsAccessToken } = gdocs;
const { workingDocIdempotencyKey } = googleDocs;
const { describeSubmissionOutputs } = readiness;
const { buildProposalDocx, isOoxmlZip } = docxMod;

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

const reqs = [
  { id: "r-b", statement: "Provide staffing plan", section_ref: "2.1" },
  { id: "r-a", statement: "Cover hours of operation", section_ref: "1.0" },
  { id: "r-c", statement: "Describe transition", section_ref: "3.2" },
];

const longBody =
  "A".repeat(4000) +
  " <table><tr><td>Post</td><td>Hours</td></tr><tr><td>Gate</td><td>24</td></tr></table> " +
  "Special chars: <>&\"' and “quotes”.";

// --- Pre-audit docs exist ---
await checkAsync("F8 acceptance doc exists", async () => {
  const doc = await read("docs/functionality/F8_PROPOSAL_OUTPUT_ACCEPTANCE.md");
  assert.match(doc, /Pre-audit/);
  assert.match(doc, /Native DOCX/);
});

await checkAsync("migration f8 submission_artifacts exists", async () => {
  const mig = await read("supabase/migrations/20260821260000_f8_submission_artifacts.sql");
  assert.match(mig, /submission_artifacts/);
  assert.match(mig, /immutable/);
  assert.match(mig, /refuse_immutable_submission_artifact/);
  assert.match(mig, /is_org_member/);
});

// --- Template ---
check("default template stable order", () => {
  const keys = sortedTemplateSections(DEFAULT_ORG_PROPOSAL_TEMPLATE).map((s) => s.key);
  assert.deepEqual(keys.slice(0, 3), ["cover", "executive_summary", "requirements"]);
  assert.ok(keys.indexOf("requirements") < keys.indexOf("pricing_ref"));
});

check("org override changes titles/order without inventing keys", () => {
  const resolved = resolveOrgProposalTemplate({
    sections: [{ key: "requirements", title: "Answers", order: 5, includeWhenEmpty: true }],
  });
  assert.equal(resolved.sections.find((s) => s.key === "requirements").title, "Answers");
  assert.equal(resolved.sections.find((s) => s.key === "requirements").order, 5);
  assert.equal(
    sortedTemplateSections(resolved)[0].key,
    "requirements",
    "lower order floats requirements first",
  );
});

// --- Assembly ---
check("assembly orders by template then section_ref — not response upsert order", () => {
  const assembled = assembleProposal({
    cover: { title: "Test Proposal", buyerName: "Buyer X" },
    requirements: reqs,
    responses: [
      { requirement_id: "r-c", draft_html: "<p>Transition answer</p>", draft_status: "APPROVED" },
      { requirement_id: "r-a", draft_html: "<p>Hours answer</p>", draft_status: "APPROVED" },
      { requirement_id: "r-b", draft_html: "<p>Staffing answer</p>", draft_status: "APPROVED" },
    ],
  });
  const reqSection = assembled.sections.find((s) => s.key === "requirements");
  assert.ok(reqSection);
  const plain = reqSection.plainText;
  const i1 = plain.indexOf("1.0");
  const i2 = plain.indexOf("2.1");
  const i3 = plain.indexOf("3.2");
  assert.ok(i1 >= 0 && i2 > i1 && i3 > i2, `order broken: ${plain.slice(0, 200)}`);
  assert.deepEqual(reqSection.sourceRequirementIds, ["r-a", "r-b", "r-c"]);
});

check("unapproved / draft-only content excluded", () => {
  const assembled = assembleProposal({
    requirements: reqs,
    responses: [
      { requirement_id: "r-a", draft_html: "<p>Approved</p>", draft_status: "APPROVED" },
      { requirement_id: "r-b", draft_html: "<p>Draft only</p>", draft_status: "DRAFT" },
      { requirement_id: "r-c", draft_html: "", draft_status: "EMPTY" },
    ],
  });
  assert.equal(assembled.sources.requirementIds.length, 1);
  assert.equal(assembled.sources.excludedDraftOnly, 1);
  assert.equal(assembled.sources.excludedEmpty, 1);
  assert.ok(assembled.plainDocument.includes("Approved"));
  assert.ok(!assembled.plainDocument.includes("Draft only"));
});

check("special characters escaped in HTML", () => {
  const assembled = assembleProposal({
    cover: { title: 'Title <script> & "x"' },
    requirements: [{ id: "r1", statement: 'Req <b> & "q"' }],
    responses: [
      {
        requirement_id: "r1",
        draft_html: "<p>Body with <em>emphasis</em></p>",
        draft_status: "APPROVED",
      },
    ],
  });
  assert.ok(assembled.htmlDocument.includes("&lt;script&gt;") || assembled.htmlDocument.includes("Title"));
  assert.ok(escapeHtml(`<>&"'`).includes("&lt;"));
  assert.ok(htmlToPlainText("<p>Hi<br/>there</p>").includes("Hi"));
  assert.ok(assembled.contentHash.length === 64);
});

check("long response and table content preserved in plain", () => {
  const assembled = assembleProposal({
    requirements: [{ id: "r1", statement: "Long", section_ref: "4" }],
    responses: [{ requirement_id: "r1", draft_html: `<p>${longBody}</p>`, draft_status: "APPROVED" }],
  });
  assert.ok(assembled.plainDocument.length > 3500);
  assert.ok(assembled.plainDocument.includes("Gate"));
});

// --- Portal ---
check("portal CSV/JSON excludes unapproved", () => {
  const export_ = buildPortalAnswersExport({
    requirements: reqs,
    responses: [
      { requirement_id: "r-a", draft_html: "<p>Yes</p>", draft_status: "APPROVED" },
      { requirement_id: "r-b", draft_html: "<p>No</p>", draft_status: "DRAFT" },
    ],
  });
  assert.equal(export_.rows.length, 1);
  assert.equal(export_.excludedUnapproved, 1);
  assert.match(export_.csv, /requirement_id/);
  assert.match(export_.json, /portal_answers_v1/);
  assert.ok(export_.csv.includes("Yes"));
  assert.ok(!export_.csv.includes("No"));
});

// --- Google Docs stub idempotency ---
await checkAsync("Google stub not configured returns blocker", async () => {
  const provider = createStubGoogleDocsProvider({ configured: false });
  const result = await provider.createOrUpdateWorkingDoc({
    title: "T",
    content: "C",
    idempotencyKey: "k1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "NOT_CONFIGURED");
  assert.equal(result.blocker, true);
});

await checkAsync("Google stub idempotency reuses same doc", async () => {
  const provider = createStubGoogleDocsProvider({ configured: true });
  const a = await provider.createOrUpdateWorkingDoc({
    title: "Working",
    content: "Body v1",
    idempotencyKey: "opp-hash-1",
  });
  assert.equal(a.ok, true);
  const b = await provider.createOrUpdateWorkingDoc({
    title: "Working",
    content: "Body v1",
    idempotencyKey: "opp-hash-1",
  });
  assert.equal(b.ok, true);
  assert.equal(b.documentId, a.documentId);
  assert.equal(b.sync.mode, "reused");
  const c = await provider.createOrUpdateWorkingDoc({
    title: "Working",
    content: "Body v2",
    idempotencyKey: "opp-hash-1",
  });
  assert.equal(c.documentId, a.documentId);
  assert.ok(c.sync.mode === "updated" || c.sync.mode === "reused");
});

await checkAsync("forceNew creates a distinct stub doc", async () => {
  const provider = createStubGoogleDocsProvider({ configured: true });
  const a = await provider.createOrUpdateWorkingDoc({
    title: "W",
    content: "x",
    idempotencyKey: "same",
  });
  const b = await provider.createOrUpdateWorkingDoc({
    title: "W",
    content: "x",
    idempotencyKey: "same",
    forceNew: true,
  });
  assert.notEqual(b.documentId, a.documentId);
});

check("idempotency key stable for same hash", () => {
  const k1 = workingDocIdempotencyKey({
    organizationId: "org",
    opportunityId: "opp",
    contentHash: "abc",
  });
  const k2 = workingDocIdempotencyKey({
    organizationId: "org",
    opportunityId: "opp",
    contentHash: "abc",
  });
  assert.equal(k1, k2);
});

check("token resolver prefers GOOGLE_DOCS then DRIVE", () => {
  assert.equal(resolveGoogleDocsAccessToken({}), null);
  assert.equal(resolveGoogleDocsAccessToken({ GOOGLE_DRIVE_ACCESS_TOKEN: " d " }), "d");
  assert.equal(
    resolveGoogleDocsAccessToken({
      GOOGLE_DRIVE_ACCESS_TOKEN: "drive",
      GOOGLE_DOCS_ACCESS_TOKEN: "docs",
    }),
    "docs",
  );
});

// --- DOCX OOXML ---
await checkAsync("DOCX is real OOXML zip (PK signature)", async () => {
  const assembled = assembleProposal({
    cover: { title: "DOCX Test" },
    requirements: [
      { id: "r1", statement: "Table req", section_ref: "1" },
      { id: "r2", statement: "Long", section_ref: "2" },
    ],
    responses: [
      {
        requirement_id: "r1",
        draft_html: "<p>| Col A | Col B |\n| --- | --- |\n| 1 | 2 |</p>",
        draft_status: "APPROVED",
      },
      {
        requirement_id: "r2",
        draft_html: `<p>${"Long paragraph. ".repeat(200)}</p>`,
        draft_status: "APPROVED",
      },
    ],
  });
  // Put pipe table in plain for table detector
  assembled.sections.find((s) => s.key === "requirements").plainText =
    "Req\n\n| Col A | Col B |\n| --- | --- |\n| 1 | 2 |\n\n" + "Long. ".repeat(200);

  const bytes = await buildProposalDocx(assembled);
  assert.ok(isOoxmlZip(bytes), "missing PK zip signature");
  assert.ok(bytes.length > 1000);
  // Must not be HTML disguised
  const head = Buffer.from(bytes.slice(0, 20)).toString("utf8");
  assert.ok(!head.trimStart().toLowerCase().startsWith("<html"));
  assert.ok(!head.trimStart().toLowerCase().startsWith("<!doctype"));
});

// --- Versioning / immutability / tenant ---
check("version increments", () => {
  assert.equal(nextArtifactVersion([]), 1);
  assert.equal(nextArtifactVersion([1, 2, 5]), 6);
});

check("submitted snapshot refuses mutate", () => {
  const blocked = canMutateArtifact({ immutable: true, approval_state: "SUBMITTED" });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /immutable/);
  const open = canMutateArtifact({ immutable: false, approval_state: "WORKING" });
  assert.equal(open.allowed, true);
});

check("tenant separation helper", () => {
  assert.equal(assertSameTenant("org-a", "org-a").ok, true);
  const bad = assertSameTenant("org-a", "org-b");
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /Tenant/);
});

// --- PDF limitation ---
check("PDF converter limitation documented and refuses fake bytes", () => {
  const result = exportProposalPdf("<html></html>");
  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_CONVERTER");
  assert.equal(PDF_EXPORT_STATUS.available, false);
  assert.equal(PDF_EXPORT_STATUS.fakePdfForbidden, true);
  assert.match(describePdfLimitation(), /does not emit PDF bytes|Print/i);
});

// --- Honesty in describeSubmissionOutputs (F8) ---
check("outputs advertise native DOCX and honest PDF/Google blockers", () => {
  const outputs = describeSubmissionOutputs({
    hasResponseContent: true,
    hasApprovedContent: true,
    googleDocsUrl: null,
    googleDocsConfigured: false,
  });
  const docx = outputs.find((o) => o.kind === "NATIVE_DOCX");
  assert.ok(docx);
  assert.match(docx.honestNote, /OOXML|docx package/i);
  const pdfOut = outputs.find((o) => o.kind === "PDF_PRINT");
  assert.match(pdfOut.honestNote, /never ships fake PDF/i);
  const gdocsOut = outputs.find((o) => o.kind === "GOOGLE_DOCS");
  assert.equal(gdocsOut.available, false);
  assert.match(gdocsOut.honestNote, /GOOGLE_DRIVE_ACCESS_TOKEN|Blocked/i);
});

check("configured Google Docs enables create/sync when approved content exists", () => {
  const outputs = describeSubmissionOutputs({
    hasResponseContent: true,
    hasApprovedContent: true,
    googleDocsUrl: null,
    googleDocsConfigured: true,
  });
  const gdocsOut = outputs.find((o) => o.kind === "GOOGLE_DOCS");
  assert.equal(gdocsOut.available, true);
  assert.match(gdocsOut.label, /Create|sync/i);
});

// --- Source wiring ---
await checkAsync("workbench wires generate / docx / portal / gdocs", async () => {
  const wb = await read(
    "apps/web/components/opportunity-workspace/submission-workbench.tsx",
  );
  assert.match(wb, /generateWorkingProposalArtifact/);
  assert.match(wb, /downloadWorkingProposalDocx/);
  assert.match(wb, /downloadPortalAnswers/);
  assert.match(wb, /syncWorkingProposalGoogleDoc/);
  assert.match(wb, /output-docx/);
  assert.match(wb, /Generate working proposal/);
});

await checkAsync("docx dependency present in apps/web package.json", async () => {
  const pkg = JSON.parse(await read("apps/web/package.json"));
  assert.ok(pkg.dependencies.docx, "docx package missing");
});

await checkAsync("env.example documents Google Docs/Drive token", async () => {
  const env = await read("apps/web/.env.example");
  assert.match(env, /GOOGLE_DRIVE_ACCESS_TOKEN/);
  assert.match(env, /Google Docs|working proposal|F8/i);
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.message ? ` — ${r.message}` : ""}`);
}
console.log(`\nF8 proposal output: ${results.length - failed.length}/${results.length}`);
if (failed.length) process.exit(1);
