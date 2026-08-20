import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishable || !secret) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, publishable key, or SUPABASE_SECRET_KEY.",
  );
  process.exit(1);
}

const stamp = Date.now().toString(36);
const results = [];
const orgIds = [];
const storageObjects = [];

function record(area, name, ok, detail = "") {
  results.push({ area, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function evidencePath(orgId, documentId, versionId, sha256, ext) {
  return `${orgId}/${documentId}/${versionId}/${sha256}/original.${ext}`;
}

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

async function signInUser(email, password) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  }
  return client;
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

const MINIMAL_XLSX = Buffer.from("PK\u0003\u0004phase3-xlsx-fixture", "binary");

async function ingest(client, orgId, bytes, filename, mime, ext) {
  const sha256 = sha256Hex(bytes);
  const documentId = randomUUID();
  const versionId = randomUUID();
  const storagePath = evidencePath(orgId, documentId, versionId, sha256, ext);

  const upload = await client.storage.from("evidence").upload(storagePath, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (upload.error) {
    throw new Error(`upload ${filename}: ${upload.error.message}`);
  }
  storageObjects.push({ bucket: "evidence", path: storagePath });

  const { data, error } = await client.rpc("register_ingested_document", {
    p_organization_id: orgId,
    p_document_id: documentId,
    p_version_id: versionId,
    p_batch_id: null,
    p_batch_label: `Phase 3 ${stamp}`,
    p_client_id: null,
    p_opportunity_id: null,
    p_original_filename: filename,
    p_mime_type: mime,
    p_sha256: sha256,
    p_storage_path: storagePath,
    p_byte_size: bytes.length,
    p_source_drive_file_id: null,
  });
  if (error) {
    throw new Error(`register ${filename}: ${error.message}`);
  }
  return { sha256, storagePath, documentId, versionId, registered: data };
}

async function cleanup(admin, users) {
  for (const object of storageObjects) {
    await admin.storage.from(object.bucket).remove([object.path]);
  }
  for (const orgId of orgIds) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
  for (const user of users) {
    if (user?.id) await admin.auth.admin.deleteUser(user.id);
  }
}

async function main() {
  const admin = adminClient();
  const password = "Phase3-Intake-Accept!22";
  const emailA = `phase3-a-${stamp}@example.com`;
  const emailB = `phase3-b-${stamp}@example.com`;
  const users = [];

  try {
    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (createdA.error || !createdA.data.user) {
      throw new Error(`create user A: ${createdA.error?.message}`);
    }
    users.push(createdA.data.user);

    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createdB.error || !createdB.data.user) {
      throw new Error(`create user B: ${createdB.error?.message}`);
    }
    users.push(createdB.data.user);

    const asA = await signInUser(emailA, password);
    const asB = await signInUser(emailB, password);

    const orgARes = await asA.rpc("create_organization_with_admin", {
      org_name: `Phase3 Org A ${stamp}`,
    });
    if (orgARes.error || !orgARes.data) {
      throw new Error(`org A: ${orgARes.error?.message}`);
    }
    const orgA = orgARes.data;
    orgIds.push(orgA);

    const orgBRes = await asB.rpc("create_organization_with_admin", {
      org_name: `Phase3 Org B ${stamp}`,
    });
    if (orgBRes.error || !orgBRes.data) {
      throw new Error(`org B: ${orgBRes.error?.message}`);
    }
    const orgB = orgBRes.data;
    orgIds.push(orgB);

    const pdf = await ingest(
      asA,
      orgA,
      MINIMAL_PDF,
      "sample.pdf",
      "application/pdf",
      "pdf",
    );
    record(
      "intake",
      "PDF lands in registry with checksum and storage path",
      pdf.registered?.duplicate === false &&
        pdf.registered?.storage_path === pdf.storagePath &&
        pdf.sha256.length === 64,
      pdf.registered?.storage_path ?? "missing",
    );

    const xlsx = await ingest(
      asA,
      orgA,
      MINIMAL_XLSX,
      "sample.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "xlsx",
    );
    record(
      "intake",
      "XLSX lands in registry with checksum and storage path",
      xlsx.registered?.duplicate === false &&
        xlsx.registered?.storage_path === xlsx.storagePath,
      xlsx.registered?.storage_path ?? "missing",
    );

    const { count: beforeDup } = await asA
      .from("document_versions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgA)
      .eq("sha256", pdf.sha256);

    const dup = await asA.rpc("register_ingested_document", {
      p_organization_id: orgA,
      p_document_id: randomUUID(),
      p_version_id: randomUUID(),
      p_batch_id: null,
      p_batch_label: null,
      p_client_id: null,
      p_opportunity_id: null,
      p_original_filename: "sample-again.pdf",
      p_mime_type: "application/pdf",
      p_sha256: pdf.sha256,
      p_storage_path: "should-not-write",
      p_byte_size: MINIMAL_PDF.length,
      p_source_drive_file_id: null,
    });

    const { count: afterDup } = await asA
      .from("document_versions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgA)
      .eq("sha256", pdf.sha256);

    record(
      "intake",
      "identical bytes do not create a second original",
      dup.data?.duplicate === true &&
        dup.data?.document_id === pdf.documentId &&
        beforeDup === 1 &&
        afterDup === 1,
      dup.error?.message ?? `duplicate=${dup.data?.duplicate} count=${afterDup}`,
    );

    const overwrite = await asA.storage.from("evidence").upload(pdf.storagePath, MINIMAL_PDF, {
      contentType: "application/pdf",
      upsert: false,
    });
    record(
      "storage",
      "existing evidence path cannot be overwritten",
      Boolean(overwrite.error),
      overwrite.error?.message ?? "uploaded",
    );

    const seenByB = await asB.from("documents").select("id").eq("id", pdf.documentId);
    record(
      "isolation",
      "org B cannot see org A documents",
      !seenByB.error && (!seenByB.data || seenByB.data.length === 0),
      seenByB.error?.message ?? `${seenByB.data?.length ?? 0} rows`,
    );

    const versionsByB = await asB
      .from("document_versions")
      .select("id")
      .eq("id", pdf.versionId);
    record(
      "isolation",
      "org B cannot see org A versions",
      !versionsByB.error && (!versionsByB.data || versionsByB.data.length === 0),
      versionsByB.error?.message ?? `${versionsByB.data?.length ?? 0} rows`,
    );

    const downloadB = await asB.storage.from("evidence").download(pdf.storagePath);
    record(
      "isolation",
      "org B cannot download org A evidence",
      Boolean(downloadB.error),
      downloadB.error?.message ?? "downloaded",
    );

    const downloadA = await asA.storage.from("evidence").download(pdf.storagePath);
    record(
      "storage",
      "org A can download its evidence object",
      !downloadA.error,
      downloadA.error?.message ?? "ok",
    );

    const status = await asA
      .from("documents")
      .select("processing_status")
      .eq("id", pdf.documentId)
      .single();
    record(
      "lifecycle",
      "new intake is UPLOADED not VERIFIED",
      status.data?.processing_status === "UPLOADED",
      status.data?.processing_status ?? status.error?.message,
    );
  } catch (error) {
    record("harness", "suite execution", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup(admin, users);
  }

  const failedCount = results.filter((row) => !row.ok).length;
  const passedCount = results.filter((row) => row.ok).length;
  console.log(`\n${passedCount} passed, ${failedCount} failed, ${results.length} total`);
  if (failedCount > 0) process.exit(1);
}

await main();
