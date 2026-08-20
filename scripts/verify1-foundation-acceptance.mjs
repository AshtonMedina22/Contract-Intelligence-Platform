import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishable || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, publishable key, or SUPABASE_SECRET_KEY.");
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

function adminClient() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function anonClient() {
  return createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email, password) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  return client;
}

function empty(data) {
  return !data || (Array.isArray(data) && data.length === 0);
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
  const password = "Verify1-Foundation-Accept!22";
  const emailA = `verify1-a-${stamp}@example.com`;
  const emailB = `verify1-b-${stamp}@example.com`;
  const users = [];

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
    const orgARes = await asA.rpc("create_organization_with_admin", { org_name: `V1 Org A ${stamp}` });
    const orgBRes = await asB.rpc("create_organization_with_admin", { org_name: `V1 Org B ${stamp}` });
    if (orgARes.error || !orgARes.data) throw new Error(orgARes.error?.message ?? "org A");
    if (orgBRes.error || !orgBRes.data) throw new Error(orgBRes.error?.message ?? "org B");
    const orgA = orgARes.data;
    const orgB = orgBRes.data;
    orgIds.push(orgA, orgB);

    const { data: clientA, error: clientAErr } = await asA
      .from("clients")
      .insert({ organization_id: orgA, name: `Client A ${stamp}` })
      .select("id")
      .single();
    if (clientAErr) throw new Error(clientAErr.message);

    const { data: oppA, error: oppAErr } = await asA
      .from("opportunities")
      .insert({ organization_id: orgA, client_id: clientA.id, title: `Opp A ${stamp}` })
      .select("id")
      .single();
    if (oppAErr) throw new Error(oppAErr.message);

    const { data: batchA, error: batchAErr } = await asA
      .from("document_batches")
      .insert({ organization_id: orgA, label: `Batch A ${stamp}`, created_by: createdA.data.user.id })
      .select("id")
      .single();
    if (batchAErr) throw new Error(batchAErr.message);

    const { data: docA, error: docAErr } = await asA
      .from("documents")
      .insert({
        organization_id: orgA,
        batch_id: batchA.id,
        client_id: clientA.id,
        opportunity_id: oppA.id,
        original_filename: `a-${stamp}.pdf`,
        mime_type: "application/pdf",
        created_by: createdA.data.user.id,
      })
      .select("id")
      .single();
    if (docAErr) throw new Error(docAErr.message);

    const sha1 = sha256Hex(Buffer.from(`v1-${stamp}`));
    const pathA = `${orgA}/${docA.id}/${stamp}/v1/original.txt`;
    const uploadA = await asA.storage.from("evidence").upload(pathA, Buffer.from("original-a"), {
      contentType: "text/plain",
      upsert: false,
    });
    if (uploadA.error) throw new Error(uploadA.error.message);
    storageObjects.push({ bucket: "evidence", path: pathA });

    const { data: verA, error: verAErr } = await asA
      .from("document_versions")
      .insert({
        organization_id: orgA,
        document_id: docA.id,
        version_number: 1,
        sha256: sha1,
        storage_bucket: "evidence",
        storage_path: pathA,
        byte_size: 10,
        is_current: true,
      })
      .select("id")
      .single();
    if (verAErr) throw new Error(verAErr.message);

    const { data: runA, error: runAErr } = await asA
      .from("extraction_runs")
      .insert({ organization_id: orgA, document_version_id: verA.id, parser_id: "verify1" })
      .select("id")
      .single();
    if (runAErr) throw new Error(runAErr.message);

    const { data: factA, error: factAErr } = await asA
      .from("extracted_facts")
      .insert({
        organization_id: orgA,
        extraction_run_id: runA.id,
        document_id: docA.id,
        document_version_id: verA.id,
        entity: "workbook",
        field: "Pricing!B12",
        raw_value: "24.50",
        source_page: 3,
        source_section: "Pricing!B12",
        source_excerpt: "Hourly rate 24.50",
      })
      .select("id, verification_status, source_page, source_section")
      .single();
    if (factAErr) throw new Error(factAErr.message);

    const { data: evidenceA, error: evidenceAErr } = await asA
      .from("source_evidence")
      .insert({
        organization_id: orgA,
        extracted_fact_id: factA.id,
        document_version_id: verA.id,
        page: 3,
        section: "Pricing!B12",
        excerpt: "Hourly rate 24.50",
        bbox: { x: 10, y: 20, w: 100, h: 12 },
      })
      .select("id, page, section, bbox")
      .single();
    if (evidenceAErr) throw new Error(evidenceAErr.message);

    const { data: eventA, error: eventAErr } = await asA
      .from("verification_events")
      .insert({
        organization_id: orgA,
        extracted_fact_id: factA.id,
        actor_id: createdA.data.user.id,
        action: "extracted",
        to_status: "AI_EXTRACTED",
      })
      .select("id, actor_id")
      .single();
    if (eventAErr) throw new Error(eventAErr.message);

    const { data: clientB, error: clientBErr } = await asB
      .from("clients")
      .insert({ organization_id: orgB, name: `Client B ${stamp}` })
      .select("id")
      .single();
    if (clientBErr) throw new Error(clientBErr.message);

    const { data: docB, error: docBErr } = await asB
      .from("documents")
      .insert({
        organization_id: orgB,
        original_filename: `b-${stamp}.pdf`,
        created_by: createdB.data.user.id,
      })
      .select("id")
      .single();
    if (docBErr) throw new Error(docBErr.message);

    const pathB = `${orgB}/${docB.id}/${stamp}/original.txt`;
    const uploadB = await asB.storage.from("evidence").upload(pathB, Buffer.from("original-b"), {
      contentType: "text/plain",
      upsert: false,
    });
    if (uploadB.error) throw new Error(uploadB.error.message);
    storageObjects.push({ bucket: "evidence", path: pathB });

    const writeDocB = await asA
      .from("documents")
      .update({ original_filename: "hijacked.pdf" })
      .eq("id", docB.id)
      .select("id");
    record(
      "1",
      "org A cannot update org B documents",
      Boolean(writeDocB.error) || empty(writeDocB.data),
      writeDocB.error?.message ?? `updated ${(writeDocB.data ?? []).length}`,
    );

    const insertFactB = await asA.from("extracted_facts").insert({
      organization_id: orgB,
      extraction_run_id: runA.id,
      document_id: docB.id,
      document_version_id: verA.id,
      field: "spoof",
    }).select("id");
    record(
      "1",
      "org A cannot insert facts into org B",
      Boolean(insertFactB.error) || empty(insertFactB.data),
      insertFactB.error?.message ?? "inserted",
    );

    const deleteClientB = await asA.from("clients").delete().eq("id", clientB.id).select("id");
    record(
      "1",
      "org A cannot delete org B clients",
      Boolean(deleteClientB.error) || empty(deleteClientB.data),
      deleteClientB.error?.message ?? `deleted ${(deleteClientB.data ?? []).length}`,
    );

    const readClientB = await asA.from("clients").select("id").eq("id", clientB.id);
    record(
      "1",
      "org A cannot read org B clients",
      !readClientB.error && empty(readClientB.data),
      readClientB.error?.message ?? `${(readClientB.data ?? []).length} rows`,
    );

    const downloadB = await asA.storage.from("evidence").download(pathB);
    record("2", "org A cannot download org B evidence", Boolean(downloadB.error), downloadB.error?.message ?? "downloaded");

    const listB = await asA.storage.from("evidence").list(orgB);
    record(
      "2",
      "org A cannot list org B evidence",
      Boolean(listB.error) || (listB.data ?? []).length === 0,
      listB.error?.message ?? `${(listB.data ?? []).length} objects`,
    );

    const overwrite = await asA.storage.from("evidence").upload(pathA, Buffer.from("changed"), {
      contentType: "text/plain",
      upsert: true,
    });
    record("3", "org member cannot upsert evidence original", Boolean(overwrite.error), overwrite.error?.message ?? "upserted");

    const updatedObj = await asA.storage.from("evidence").update(pathA, Buffer.from("changed"), {
      contentType: "text/plain",
    });
    record("3", "org member cannot update evidence original", Boolean(updatedObj.error), updatedObj.error?.message ?? "updated");

    const removed = await asA.storage.from("evidence").remove([pathA]);
    const stillThere = await asA.storage.from("evidence").download(pathA);
    record(
      "3",
      "org member cannot delete evidence original",
      Boolean(removed.error) || !stillThere.error,
      removed.error?.message ?? (stillThere.error ? "missing" : "still present"),
    );

    const mutateVersion = await asA
      .from("document_versions")
      .update({ sha256: sha256Hex(Buffer.from("tamper")) })
      .eq("id", verA.id)
      .select("id");
    record(
      "3",
      "version sha256/storage identity cannot be updated",
      Boolean(mutateVersion.error) || empty(mutateVersion.data),
      mutateVersion.error?.message ?? "updated",
    );

    const sha2 = sha256Hex(Buffer.from(`v2-${stamp}`));
    const pathA2 = `${orgA}/${docA.id}/${stamp}/v2/original.txt`;
    const uploadA2 = await asA.storage.from("evidence").upload(pathA2, Buffer.from("original-a-v2"), {
      contentType: "text/plain",
      upsert: false,
    });
    if (uploadA2.error) throw new Error(uploadA2.error.message);
    storageObjects.push({ bucket: "evidence", path: pathA2 });

    const appended = await asA.rpc("append_document_version", {
      p_organization_id: orgA,
      p_document_id: docA.id,
      p_version_id: randomUUID(),
      p_sha256: sha2,
      p_storage_path: pathA2,
      p_byte_size: 12,
      p_source_drive_file_id: null,
    });
    const { data: versions } = await asA
      .from("document_versions")
      .select("id, version_number, sha256, is_current, storage_path")
      .eq("document_id", docA.id)
      .order("version_number");
    const v1 = (versions ?? []).find((row) => row.version_number === 1);
    const v2 = (versions ?? []).find((row) => row.version_number === 2);
    record(
      "4",
      "appending v2 retains historical v1",
      !appended.error &&
        appended.data?.duplicate === false &&
        (versions ?? []).length === 2 &&
        v1?.sha256 === sha1 &&
        v1?.is_current === false &&
        v1?.storage_path === pathA &&
        v2?.sha256 === sha2 &&
        v2?.is_current === true,
      appended.error?.message ?? JSON.stringify(appended.data),
    );

    const dup = await asA.rpc("append_document_version", {
      p_organization_id: orgA,
      p_document_id: docA.id,
      p_version_id: randomUUID(),
      p_sha256: sha1,
      p_storage_path: "should-not-write",
      p_byte_size: 1,
      p_source_drive_file_id: null,
    });
    const { count: versionCount } = await asA
      .from("document_versions")
      .select("id", { count: "exact", head: true })
      .eq("document_id", docA.id);
    record(
      "4",
      "duplicate checksum does not replace historical version",
      dup.data?.duplicate === true && versionCount === 2,
      dup.error?.message ?? `duplicate=${dup.data?.duplicate} count=${versionCount}`,
    );

    record("5", "new fact is AI_EXTRACTED not HUMAN_VERIFIED", factA.verification_status === "AI_EXTRACTED", factA.verification_status);

    const noActor = await asA
      .from("extracted_facts")
      .update({ verification_status: "HUMAN_VERIFIED", verified_value: "x" })
      .eq("id", factA.id)
      .select("id");
    record(
      "5",
      "HUMAN_VERIFIED without actor is rejected",
      Boolean(noActor.error) || empty(noActor.data),
      noActor.error?.message ?? "updated",
    );

    const promoteAi = await asA.rpc("promote_verified_fact", { p_fact_id: factA.id });
    const { data: prices } = await asA.from("pricing_lines").select("id").eq("opportunity_id", oppA.id);
    record(
      "6",
      "AI_EXTRACTED promote is skipped and writes no canonical pricing",
      promoteAi.data?.ok === false &&
        promoteAi.data?.action === "skipped" &&
        empty(prices),
      JSON.stringify(promoteAi.data ?? promoteAi.error),
    );

    const missingActor = await asA.from("verification_events").insert({
      organization_id: orgA,
      extracted_fact_id: factA.id,
      actor_id: null,
      action: "anonymous",
    }).select("id");
    record(
      "7",
      "verification event without actor is rejected",
      Boolean(missingActor.error) || empty(missingActor.data),
      missingActor.error?.message ?? "inserted",
    );
    record("7", "stored verification event has actor_id", Boolean(eventA.actor_id), eventA.actor_id);

    const deleteEvent = await asA.from("verification_events").delete().eq("id", eventA.id).select("id");
    record(
      "7",
      "verification events cannot be deleted by org members",
      Boolean(deleteEvent.error) || empty(deleteEvent.data),
      deleteEvent.error?.message ?? `deleted ${(deleteEvent.data ?? []).length}`,
    );

    const { data: evidenceReread } = await asA
      .from("source_evidence")
      .select("page, section, excerpt, bbox")
      .eq("id", evidenceA.id)
      .single();
    record(
      "8",
      "source coordinates retained (page, section, bbox)",
      evidenceReread?.page === 3 &&
        evidenceReread?.section === "Pricing!B12" &&
        evidenceReread?.excerpt === "Hourly rate 24.50" &&
        evidenceReread?.bbox?.x === 10,
      JSON.stringify(evidenceReread),
    );
    record(
      "8",
      "fact source_page and source_section retained",
      factA.source_page === 3 && factA.source_section === "Pricing!B12",
      `${factA.source_page} ${factA.source_section}`,
    );

    const updateEvidence = await asA
      .from("source_evidence")
      .update({ excerpt: "tampered" })
      .eq("id", evidenceA.id)
      .select("id");
    record(
      "8",
      "source_evidence rows cannot be updated by org members",
      Boolean(updateEvidence.error) || empty(updateEvidence.data),
      updateEvidence.error?.message ?? "updated",
    );
  } catch (error) {
    record("harness", "suite execution", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup(admin, users);
  }

  const failed = results.filter((row) => !row.ok).length;
  const passed = results.filter((row) => !row.ok).length === 0 ? results.filter((r) => r.ok).length : results.filter((r) => r.ok).length;
  console.log(`\n${results.filter((r) => r.ok).length} passed, ${failed} failed, ${results.length} total`);
  if (failed > 0) process.exit(1);
}

await main();
