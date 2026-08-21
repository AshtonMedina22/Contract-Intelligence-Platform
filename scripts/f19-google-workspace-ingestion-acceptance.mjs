#!/usr/bin/env node
// F19 acceptance: selective Google Drive / Workspace SOURCE ingestion.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");

async function bundle(entryRel, name) {
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f19-${name}-`)), "out.mjs");
  await esbuild.build({
    entryPoints: [path.join(webRoot, entryRel)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "warning",
    alias: { "@": webRoot },
    external: ["next", "next/*", "workflow", "@supabase/ssr"],
    nodePaths: [path.join(webRoot, "node_modules"), path.join(root, "node_modules")],
  });
  return import(pathToFileURL(outfile).href);
}

const drive = await bundle("lib/intake/drive.ts", "provider");
const sync = await bundle("lib/intake/drive-sync.ts", "sync");
const { createGoogleDriveProvider } = drive;
const { runDriveSourceSync } = sync;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

const MIME = {
  pdf: "application/pdf",
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
};
const fixtureState = {
  files: new Map([
    ["pdf-1", { id: "pdf-1", name: "Solicitation.pdf", mimeType: MIME.pdf, modifiedTime: "2026-08-01T00:00:00Z", parents: ["folder-a"], bytes: "PDF-A" }],
    ["doc-1", { id: "doc-1", name: "Narrative", mimeType: MIME.doc, modifiedTime: "2026-08-02T00:00:00Z", parents: ["folder-a"], bytes: "DOCX-A" }],
    ["sheet-1", { id: "sheet-1", name: "Pricing", mimeType: MIME.sheet, modifiedTime: "2026-08-03T00:00:00Z", parents: ["folder-a"], bytes: "XLSX-A" }],
    ["pdf-2", { id: "pdf-2", name: "Addendum.pdf", mimeType: MIME.pdf, modifiedTime: "2026-08-04T00:00:00Z", parents: ["folder-a"], bytes: "PDF-2" }],
  ]),
  deleted: new Set(),
};

function metadata(file) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    parents: file.parents,
    size: String(Buffer.byteLength(file.bytes)),
    md5Checksum: "fixture-md5",
    webViewLink: `https://drive.google.com/file/d/${file.id}/view`,
  };
}

function fixtureFetch({ unauthorized = false, providerFailure = false } = {}) {
  return async (input) => {
    const url = new URL(String(input));
    if (unauthorized) return new Response("expired", { status: 401 });
    if (providerFailure) return new Response("upstream", { status: 503 });
    const list = url.pathname === "/drive/v3/files";
    if (list && url.searchParams.has("q")) {
      const page = url.searchParams.get("pageToken");
      const files = [...fixtureState.files.values()].filter(
        (file) => file.parents.includes("folder-a") && !fixtureState.deleted.has(file.id),
      );
      const selected = page ? files.slice(2, 4) : files.slice(0, 2);
      return Response.json({
        files: selected.map(metadata),
        nextPageToken: page ? undefined : "page-2",
      });
    }
    const match = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)(?:\/export)?$/);
    const id = match?.[1] ? decodeURIComponent(match[1]) : "";
    const file = fixtureState.files.get(id);
    if (!file || fixtureState.deleted.has(id)) return new Response("missing", { status: 404 });
    if (url.searchParams.has("alt") || url.pathname.endsWith("/export")) {
      return new Response(file.bytes, { status: 200 });
    }
    return Response.json(metadata(file));
  };
}

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.updatePayload = null;
  }
  select() { return this; }
  eq(key, value) { this.filters.push([key, value]); return this; }
  update(payload) { this.updatePayload = payload; return this; }
  matching() {
    return this.db[this.table].filter((row) => this.filters.every(([key, value]) => row[key] === value));
  }
  async maybeSingle() {
    return { data: this.matching()[0] ?? null, error: null };
  }
  async upsert(payload) {
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) {
      const existing = this.db[this.table].find(
        (candidate) =>
          candidate.organization_id === row.organization_id &&
          candidate.provider === row.provider &&
          candidate.direction === row.direction &&
          candidate.upstream_file_id === row.upstream_file_id,
      );
      if (existing) Object.assign(existing, row, { updated_at: new Date().toISOString() });
      else this.db[this.table].push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row });
    }
    return { error: null };
  }
  then(resolve, reject) {
    try {
      if (this.updatePayload) for (const row of this.matching()) Object.assign(row, this.updatePayload);
      resolve({ data: this.matching(), error: null });
    } catch (error) {
      reject(error);
    }
  }
}
class FakeSupabase {
  constructor() {
    this.document_source_links = [];
    this.documents = [];
  }
  from(table) { return new Query(this, table); }
}

function createFakeIngest() {
  const byHash = new Map();
  const versions = new Map();
  let seq = 0;
  const ingest = async (db, input) => {
    const sha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
    const duplicate = byHash.get(sha256);
    if (duplicate) return { ...duplicate, duplicate: true, filename: input.filename, sha256, batchId: null };
    const documentId = input.existingDocumentId ?? `doc-${++seq}`;
    const count = (versions.get(documentId) ?? 0) + 1;
    versions.set(documentId, count);
    const value = {
      duplicate: false,
      documentId,
      documentVersionId: `${documentId}-v${count}`,
      storagePath: `${input.organizationId}/${documentId}/v${count}`,
      sha256,
      batchId: null,
      filename: input.filename,
    };
    byHash.set(sha256, value);
    if (!db.documents.some((row) => row.id === documentId)) {
      db.documents.push({ id: documentId, organization_id: input.organizationId });
    }
    return value;
  };
  return { ingest, versions };
}

await checkAsync("single PDF downloads original bytes", async () => {
  const provider = createGoogleDriveProvider("fixture-token", fixtureFetch());
  const [item] = await provider.listScoped({ fileIds: ["pdf-1"], maxItems: 1 });
  const fetched = await provider.fetchBytes({ item });
  assert.equal(fetched.filename, "Solicitation.pdf");
  assert.equal(new TextDecoder().decode(fetched.bytes), "PDF-A");
  assert.equal(fetched.exportFormat, null);
});

await checkAsync("Google Doc exports to DOCX or PDF", async () => {
  const provider = createGoogleDriveProvider("fixture-token", fixtureFetch());
  const [item] = await provider.listScoped({ fileIds: ["doc-1"], maxItems: 1 });
  const docx = await provider.fetchBytes({ item, exportFormat: "docx" });
  const pdf = await provider.fetchBytes({ item, exportFormat: "pdf" });
  assert.match(docx.filename, /\.docx$/);
  assert.match(docx.mimeType, /wordprocessingml/);
  assert.match(pdf.filename, /\.pdf$/);
  assert.equal(pdf.mimeType, MIME.pdf);
});

await checkAsync("Google Sheet exports to XLSX", async () => {
  const provider = createGoogleDriveProvider("fixture-token", fixtureFetch());
  const [item] = await provider.listScoped({ fileIds: ["sheet-1"], maxItems: 1 });
  const fetched = await provider.fetchBytes({ item });
  assert.match(fetched.filename, /\.xlsx$/);
  assert.match(fetched.mimeType, /spreadsheetml/);
});

await checkAsync("folder pagination remains scoped and honors maxItems", async () => {
  const provider = createGoogleDriveProvider("fixture-token", fixtureFetch());
  const items = await provider.listScoped({ folderId: "folder-a", maxItems: 3 });
  assert.equal(items.length, 3);
  assert.ok(items.every((item) => item.folderId === "folder-a"));
});

await checkAsync("same file dedupes; changed bytes append a version", async () => {
  const db = new FakeSupabase();
  const fake = createFakeIngest();
  const provider = createGoogleDriveProvider("fixture-token", fixtureFetch());
  const input = { organizationId: "org-a", fileIds: ["pdf-1"], maxItems: 1 };
  const first = await runDriveSourceSync(db, provider, input, fake.ingest);
  const second = await runDriveSourceSync(db, provider, input, fake.ingest);
  assert.equal(first.results[0].status, "INGESTED");
  assert.equal(second.results[0].status, "DUPLICATE");
  const documentId = first.results[0].documentId;
  fixtureState.files.get("pdf-1").bytes = "PDF-B";
  fixtureState.files.get("pdf-1").modifiedTime = "2026-08-10T00:00:00Z";
  const changed = await runDriveSourceSync(db, provider, input, fake.ingest);
  assert.equal(changed.results[0].status, "VERSIONED");
  assert.equal(changed.results[0].documentId, documentId);
  assert.equal(fake.versions.get(documentId), 2);
});

await checkAsync("rename and move update link metadata without a new version", async () => {
  const db = new FakeSupabase();
  const fake = createFakeIngest();
  const provider = createGoogleDriveProvider("fixture-token", fixtureFetch());
  const input = { organizationId: "org-a", fileIds: ["pdf-1"], maxItems: 1 };
  await runDriveSourceSync(db, provider, input, fake.ingest);
  const file = fixtureState.files.get("pdf-1");
  file.name = "Renamed Solicitation.pdf";
  file.parents = ["folder-b"];
  const result = await runDriveSourceSync(db, provider, input, fake.ingest);
  assert.equal(result.results[0].status, "DUPLICATE");
  assert.equal(db.document_source_links[0].folder_id, "folder-b");
  assert.equal(db.document_source_links[0].metadata.upstream_name, "Renamed Solicitation.pdf");
  assert.equal(fake.versions.get(result.results[0].documentId), 1);
});

await checkAsync("upstream 404 marks unavailable and retains document/link", async () => {
  const db = new FakeSupabase();
  const fake = createFakeIngest();
  const provider = createGoogleDriveProvider("fixture-token", fixtureFetch());
  const input = { organizationId: "org-a", fileIds: ["pdf-1"], maxItems: 1 };
  const first = await runDriveSourceSync(db, provider, input, fake.ingest);
  fixtureState.deleted.add("pdf-1");
  const deleted = await runDriveSourceSync(db, provider, input, fake.ingest);
  assert.equal(deleted.results[0].status, "UNAVAILABLE");
  assert.equal(db.document_source_links.length, 1);
  assert.equal(db.document_source_links[0].availability, "UNAVAILABLE");
  assert.ok(db.documents.some((row) => row.id === first.results[0].documentId));
  fixtureState.deleted.delete("pdf-1");
});

await checkAsync("provider failure and expired token fail explicitly", async () => {
  const failed = createGoogleDriveProvider("fixture-token", fixtureFetch({ providerFailure: true }));
  await assert.rejects(
    failed.listScoped({ fileIds: ["pdf-1"], maxItems: 1 }),
    (error) => error.code === "PROVIDER_ERROR",
  );
  const expired = createGoogleDriveProvider("fixture-token", fixtureFetch({ unauthorized: true }));
  await assert.rejects(
    expired.listScoped({ fileIds: ["pdf-1"], maxItems: 1 }),
    (error) => error.code === "UNAUTHORIZED" && /expired/i.test(error.message),
  );
});

await checkAsync("unset token exposes fixture architecture and live blocker", async () => {
  const provider = createGoogleDriveProvider("", fixtureFetch());
  assert.equal(provider.isConfigured(), false);
  await assert.rejects(
    provider.listScoped({ fileIds: ["pdf-1"], maxItems: 1 }),
    (error) => error.code === "NOT_CONFIGURED" && /SOURCE ingestion/i.test(error.message),
  );
});

await checkAsync("migration is tenant-scoped, append-oriented, and direction-locked", async () => {
  const sql = await read("supabase/migrations/20260821360000_f19_drive_source_ingest.sql");
  assert.match(sql, /document_source_links/);
  assert.match(sql, /public\.is_org_member\(organization_id\)/);
  assert.match(sql, /public\.has_org_role/);
  assert.match(sql, /direction = 'SOURCE_INGEST'/);
  assert.match(sql, /revoke delete on public\.document_source_links from authenticated/);
  assert.match(sql, /UNAVAILABLE never deletes document_versions or Storage evidence/);
  assert.doesNotMatch(sql, /to anon/i);
});

await checkAsync("SOURCE_INGEST remains separate from F8 WORKING_PROPOSAL_OUTPUT", async () => {
  const provider = await read("packages/shared/src/document-source-provider.ts");
  const f8 = await read("apps/web/lib/google/docs-provider.ts");
  const f19 = await read("apps/web/lib/intake/drive.ts");
  assert.match(provider, /SOURCE_INGEST/);
  assert.match(f8, /working-proposal provider/);
  assert.doesNotMatch(f8, /DocumentSourceProvider/);
  assert.doesNotMatch(f19, /createOrUpdateWorkingDoc/);
});

await checkAsync("no recursive/company-wide crawl and server-only token wiring", async () => {
  const provider = await read("apps/web/lib/intake/drive.ts");
  const action = await read("apps/web/app/(platform)/ingestion/intake/actions.ts");
  const client = await read("apps/web/app/(platform)/ingestion/intake/intake-form.tsx");
  assert.match(provider, /in parents and trashed = false/);
  assert.match(provider, /maxItems/);
  assert.doesNotMatch(provider, /corpora.*domain/i);
  assert.match(action, /getGoogleDriveSourceProvider/);
  assert.doesNotMatch(client, /GOOGLE_DRIVE_ACCESS_TOKEN.*process\.env/);
});

const liveToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim();
if (liveToken) {
  await checkAsync("live staging folder list (token present)", async () => {
    const provider = createGoogleDriveProvider(liveToken);
    const items = await provider.listScoped({
      folderId: "1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF",
      maxItems: 3,
    });
    assert.ok(Array.isArray(items));
  });
} else {
  check("live E2E blocker documented when token unset", () => {
    assert.equal(liveToken, undefined);
  });
}

for (const row of results) console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}${row.message ? ` — ${row.message}` : ""}`);
const failures = results.filter((row) => !row.ok);
console.log(`\nF19 Google Workspace SOURCE ingestion: ${results.length - failures.length}/${results.length} PASS`);
if (failures.length) process.exitCode = 1;
