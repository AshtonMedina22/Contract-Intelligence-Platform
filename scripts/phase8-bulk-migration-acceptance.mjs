import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishable || !secret) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const results = [];
const orgIds = [];
const users = [];
const storageObjects = [];

function record(area, name, ok, detail = "") {
  results.push({ area, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function adminClient() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function anonClient() {
  return createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email, password) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return client;
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function evidencePath(orgId, documentId, versionId, sha256, ext) {
  return `${orgId}/${documentId}/${versionId}/${sha256}/original.${ext}`;
}

const MINIMAL_PDF = Buffer.from(
  `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj
trailer<</Size 4/Root 1 0 R>>
%%EOF
`,
  "utf8",
);

async function registerFile(client, orgId, batchId, bytes, filename, mime, ext) {
  const sha256 = sha256Hex(bytes);
  const documentId = randomUUID();
  const versionId = randomUUID();
  const storagePath = evidencePath(orgId, documentId, versionId, sha256, ext);
  const upload = await client.storage.from("evidence").upload(storagePath, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);
  storageObjects.push({ bucket: "evidence", path: storagePath });

  const { data, error } = await client.rpc("register_ingested_document", {
    p_organization_id: orgId,
    p_document_id: documentId,
    p_version_id: versionId,
    p_batch_id: batchId,
    p_batch_label: null,
    p_client_id: null,
    p_opportunity_id: null,
    p_original_filename: filename,
    p_mime_type: mime,
    p_sha256: sha256,
    p_storage_path: storagePath,
    p_byte_size: bytes.length,
    p_source_drive_file_id: null,
  });
  if (error) throw new Error(error.message);
  return { sha256, documentId, duplicate: data?.duplicate === true };
}

async function main() {
  const admin = adminClient();
  const password = "Phase8-Bulk-Migrate!22";
  const email = `phase8-${stamp}@example.com`;

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    users.push(created.data.user);

    const asUser = await signIn(email, password);
    const orgId = (await asUser.rpc("create_organization_with_admin", { org_name: `P8 ${stamp}` })).data;
    orgIds.push(orgId);

    const batchId = (await asUser.rpc("create_migration_batch", {
      p_organization_id: orgId,
      p_label: `bulk-${stamp}`,
    })).data;
    record("batch", "create_migration_batch", Boolean(batchId), String(batchId));

    const good = await registerFile(asUser, orgId, batchId, MINIMAL_PDF, "a.pdf", "application/pdf", "pdf");
    await asUser.rpc("record_batch_ingest_item", {
      p_organization_id: orgId,
      p_batch_id: batchId,
      p_filename: "a.pdf",
      p_sha256: good.sha256,
      p_document_id: good.documentId,
      p_byte_size: MINIMAL_PDF.length,
      p_outcome: "INGESTED",
      p_error_message: null,
    });

    await asUser.rpc("record_batch_ingest_item", {
      p_organization_id: orgId,
      p_batch_id: batchId,
      p_filename: "a-copy.pdf",
      p_sha256: good.sha256,
      p_document_id: good.documentId,
      p_byte_size: MINIMAL_PDF.length,
      p_outcome: "DUPLICATE",
      p_error_message: null,
    });

    await asUser.rpc("record_batch_ingest_item", {
      p_organization_id: orgId,
      p_batch_id: batchId,
      p_filename: "bad.pdf",
      p_sha256: null,
      p_document_id: null,
      p_byte_size: 0,
      p_outcome: "FAILED",
      p_error_message: "simulated corrupt file",
    });

    const status = (await asUser.rpc("finalize_batch_ingest", {
      p_organization_id: orgId,
      p_batch_id: batchId,
    })).data;
    record("batch", "finalize PARTIAL with isolated failure", status === "PARTIAL", String(status));

    const { data: batch } = await asUser
      .from("document_batches")
      .select("file_count, ingested_count, duplicate_count, failed_count, bytes_ingested")
      .eq("id", batchId)
      .single();
    record(
      "batch",
      "counters",
      batch?.file_count === 3 &&
        batch?.ingested_count === 1 &&
        batch?.duplicate_count === 1 &&
        batch?.failed_count === 1,
      JSON.stringify(batch),
    );

    await asUser.rpc("mark_batch_processing", {
      p_organization_id: orgId,
      p_batch_id: batchId,
      p_document_count: 1,
    });
    const { data: afterMark } = await asUser
      .from("document_batches")
      .select("status, compute_cost_usd")
      .eq("id", batchId)
      .single();
    record(
      "cost",
      "compute cost logged per batch start",
      afterMark?.status === "PROCESSING" && Number(afterMark?.compute_cost_usd) > 0,
      JSON.stringify(afterMark),
    );

    const emailB = `phase8-b-${stamp}@example.com`;
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    users.push(createdB.data.user);
    const asB = await signIn(emailB, password);
    const orgB = (await asB.rpc("create_organization_with_admin", { org_name: `P8 B ${stamp}` })).data;
    orgIds.push(orgB);

    const { data: crossItems } = await asB
      .from("batch_ingest_items")
      .select("id")
      .eq("batch_id", batchId);
    record("rls", "org B cannot read org A batch items", !crossItems || crossItems.length === 0);
  } catch (error) {
    record("fatal", error instanceof Error ? error.message : String(error), false);
  } finally {
    const adminInner = adminClient();
    for (const object of storageObjects) {
      await adminInner.storage.from(object.bucket).remove([object.path]);
    }
    for (const orgId of orgIds) {
      await adminInner.from("organizations").delete().eq("id", orgId);
    }
    for (const user of users) {
      if (user?.id) await adminInner.auth.admin.deleteUser(user.id);
    }
    const failed = results.filter((row) => !row.ok).length;
    console.log(`${results.filter((r) => r.ok).length} passed, ${failed} failed, ${results.length} total`);
    process.exit(failed ? 1 : 0);
  }
}

await main();
