import { createHash } from "node:crypto";
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
const userIds = [];
const orgIds = [];
const storageObjects = [];

function record(area, name, ok, detail = "") {
  results.push({ area, name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
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
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  }
  return client;
}

function failed(error) {
  return Boolean(error);
}

function empty(data) {
  return !data || (Array.isArray(data) && data.length === 0);
}

async function seedOrgGraph(client, orgId, userId, tag) {
  const sha = createHash("sha256").update(`phase2-${tag}`).digest("hex");

  const { data: clientRow, error: clientError } = await client
    .from("clients")
    .insert({ organization_id: orgId, name: `Client ${tag}` })
    .select("id")
    .single();
  if (clientError) throw new Error(`clients insert ${tag}: ${clientError.message}`);

  const { data: opportunity, error: opportunityError } = await client
    .from("opportunities")
    .insert({
      organization_id: orgId,
      client_id: clientRow.id,
      title: `Opportunity ${tag}`,
    })
    .select("id")
    .single();
  if (opportunityError) {
    throw new Error(`opportunities insert ${tag}: ${opportunityError.message}`);
  }

  const { data: batch, error: batchError } = await client
    .from("document_batches")
    .insert({ organization_id: orgId, label: `Batch ${tag}`, created_by: userId })
    .select("id")
    .single();
  if (batchError) throw new Error(`document_batches insert ${tag}: ${batchError.message}`);

  const { data: document, error: documentError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      batch_id: batch.id,
      client_id: clientRow.id,
      opportunity_id: opportunity.id,
      original_filename: `${tag}.pdf`,
      mime_type: "application/pdf",
      document_type: "rfp",
      created_by: userId,
    })
    .select("id")
    .single();
  if (documentError) throw new Error(`documents insert ${tag}: ${documentError.message}`);

  const { data: version, error: versionError } = await client
    .from("document_versions")
    .insert({
      organization_id: orgId,
      document_id: document.id,
      version_number: 1,
      sha256: sha,
      storage_bucket: "evidence",
      storage_path: `${orgId}/${document.id}/placeholder/${sha}/original.pdf`,
      byte_size: 12,
    })
    .select("id")
    .single();
  if (versionError) {
    throw new Error(`document_versions insert ${tag}: ${versionError.message}`);
  }

  const { data: run, error: runError } = await client
    .from("extraction_runs")
    .insert({
      organization_id: orgId,
      document_version_id: version.id,
      parser_id: "stub",
      extractor_id: "stub",
    })
    .select("id")
    .single();
  if (runError) throw new Error(`extraction_runs insert ${tag}: ${runError.message}`);

  const { data: fact, error: factError } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: run.id,
      document_id: document.id,
      document_version_id: version.id,
      entity: "solicitation",
      field: "title",
      raw_value: `Raw ${tag}`,
      normalized_value: `Normalized ${tag}`,
    })
    .select("id, verification_status")
    .single();
  if (factError) throw new Error(`extracted_facts insert ${tag}: ${factError.message}`);

  const { error: evidenceError } = await client.from("source_evidence").insert({
    organization_id: orgId,
    extracted_fact_id: fact.id,
    document_version_id: version.id,
    page: 1,
    excerpt: "excerpt",
  });
  if (evidenceError) {
    throw new Error(`source_evidence insert ${tag}: ${evidenceError.message}`);
  }

  const { error: eventError } = await client.from("verification_events").insert({
    organization_id: orgId,
    extracted_fact_id: fact.id,
    actor_id: userId,
    action: "extracted",
    to_status: "AI_EXTRACTED",
  });
  if (eventError) {
    throw new Error(`verification_events insert ${tag}: ${eventError.message}`);
  }

  const { error: exceptionError } = await client.from("validation_exceptions").insert({
    organization_id: orgId,
    document_id: document.id,
    code: "missing_form",
    message: "placeholder",
  });
  if (exceptionError) {
    throw new Error(`validation_exceptions insert ${tag}: ${exceptionError.message}`);
  }

  return {
    clientId: clientRow.id,
    opportunityId: opportunity.id,
    batchId: batch.id,
    documentId: document.id,
    versionId: version.id,
    runId: run.id,
    factId: fact.id,
    factStatus: fact.verification_status,
  };
}

async function assertCannotRead(asUser, table, otherId, area) {
  const { data, error } = await asUser.from(table).select("id").eq("id", otherId);
  record(
    area,
    `${table} cross-tenant select is empty`,
    !error && empty(data),
    error?.message ?? `${(data ?? []).length} rows`,
  );
}

async function assertCannotInsert(asUser, table, payload, area) {
  const { data, error } = await asUser.from(table).insert(payload).select("id");
  record(
    area,
    `${table} cross-tenant insert rejected`,
    failed(error) || empty(data),
    error?.message ?? `inserted ${(data ?? []).length}`,
  );
}

async function cleanup(admin, users) {
  for (const object of storageObjects) {
    await admin.storage.from(object.bucket).remove([object.path]);
  }

  for (const orgId of orgIds) {
    await admin.from("organizations").delete().eq("id", orgId);
  }

  for (const user of users) {
    if (user?.id) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

async function main() {
  const admin = adminClient();
  const password = "Phase2-Rls-Accept!22";
  const emailA = `phase2-a-${stamp}@example.com`;
  const emailB = `phase2-b-${stamp}@example.com`;
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
    userIds.push(createdA.data.user.id);

    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createdB.error || !createdB.data.user) {
      throw new Error(`create user B: ${createdB.error?.message}`);
    }
    users.push(createdB.data.user);
    userIds.push(createdB.data.user.id);

    const asA = await signInUser(emailA, password);
    const asB = await signInUser(emailB, password);

    const orgARes = await asA.rpc("create_organization_with_admin", {
      org_name: `Org A ${stamp}`,
    });
    if (orgARes.error || !orgARes.data) {
      throw new Error(`org A rpc: ${orgARes.error?.message}`);
    }
    const orgA = orgARes.data;
    orgIds.push(orgA);
    record("bootstrap", "user A creates organization atomically", true, "org A");

    const orgBRes = await asB.rpc("create_organization_with_admin", {
      org_name: `Org B ${stamp}`,
    });
    if (orgBRes.error || !orgBRes.data) {
      throw new Error(`org B rpc: ${orgBRes.error?.message}`);
    }
    const orgB = orgBRes.data;
    orgIds.push(orgB);
    record("bootstrap", "user B creates organization atomically", true, "org B");

    const { data: aOrgs } = await asA.from("organizations").select("id");
    const { data: bOrgs } = await asB.from("organizations").select("id");
    record(
      "tenancy",
      "A reads only org A",
      (aOrgs ?? []).length === 1 && aOrgs[0].id === orgA,
      `${(aOrgs ?? []).length} org rows`,
    );
    record(
      "tenancy",
      "B reads only org B",
      (bOrgs ?? []).length === 1 && bOrgs[0].id === orgB,
      `${(bOrgs ?? []).length} org rows`,
    );

    const graphA = await seedOrgGraph(asA, orgA, createdA.data.user.id, `a${stamp}`);
    const graphB = await seedOrgGraph(asB, orgB, createdB.data.user.id, `b${stamp}`);
    record("seed", "A seeded every Phase 2 table", true);
    record("seed", "B seeded every Phase 2 table", true);

    const orgTables = [
      "clients",
      "opportunities",
      "document_batches",
      "documents",
      "document_versions",
      "extraction_runs",
      "extracted_facts",
      "source_evidence",
      "verification_events",
      "validation_exceptions",
    ];
    for (const table of orgTables) {
      const { data, error } = await asA
        .from(table)
        .select("id")
        .eq("organization_id", orgB);
      record(
        "rls",
        `A cannot read B ${table} by organization_id`,
        !error && empty(data),
        error?.message ?? `${(data ?? []).length} rows`,
      );
    }
    record(
      "staging",
      "extracted fact defaults to AI_EXTRACTED",
      graphA.factStatus === "AI_EXTRACTED",
      graphA.factStatus,
    );

    const tables = [
      ["clients", graphB.clientId],
      ["opportunities", graphB.opportunityId],
      ["document_batches", graphB.batchId],
      ["documents", graphB.documentId],
      ["document_versions", graphB.versionId],
      ["extraction_runs", graphB.runId],
      ["extracted_facts", graphB.factId],
    ];
    for (const [table, id] of tables) {
      await assertCannotRead(asA, table, id, "rls");
    }

    const { data: bMemberships } = await asA
      .from("memberships")
      .select("id")
      .eq("organization_id", orgB);
    record(
      "rls",
      "A cannot read B memberships",
      empty(bMemberships),
      `${(bMemberships ?? []).length} rows`,
    );

    await assertCannotInsert(
      asA,
      "clients",
      { organization_id: orgB, name: "spoofed client" },
      "rls",
    );
    await assertCannotInsert(
      asA,
      "opportunities",
      { organization_id: orgB, title: "spoofed opportunity" },
      "rls",
    );

    const { data: joinSelf, error: joinError } = await asA
      .from("memberships")
      .insert({ organization_id: orgB, user_id: createdA.data.user.id, role: "admin" })
      .select("id");
    record(
      "rls",
      "A cannot add self to org B",
      failed(joinError) || empty(joinSelf),
      joinError?.message ?? "inserted",
    );

    const { data: moved, error: moveError } = await asA
      .from("clients")
      .update({ organization_id: orgB })
      .eq("id", graphA.clientId)
      .select("id");
    record(
      "rls",
      "A cannot reassign a row to org B",
      failed(moveError) || empty(moved),
      moveError?.message ?? `updated ${(moved ?? []).length}`,
    );

    const { data: deleted, error: deleteError } = await asA
      .from("clients")
      .delete()
      .eq("id", graphB.clientId)
      .select("id");
    record(
      "rls",
      "A cannot delete B rows",
      failed(deleteError) || empty(deleted),
      deleteError?.message ?? `deleted ${(deleted ?? []).length}`,
    );

    const { data: crossOpp, error: crossOppError } = await asA
      .from("opportunities")
      .insert({
        organization_id: orgA,
        client_id: graphB.clientId,
        title: "cross-org client",
      })
      .select("id");
    record(
      "integrity",
      "A opportunity cannot reference B client",
      failed(crossOppError) || empty(crossOpp),
      crossOppError?.message ?? "inserted",
    );

    const { data: crossDoc, error: crossDocError } = await asA
      .from("documents")
      .insert({
        organization_id: orgA,
        batch_id: graphB.batchId,
        original_filename: "cross.pdf",
      })
      .select("id");
    record(
      "integrity",
      "A document cannot reference B batch",
      failed(crossDocError) || empty(crossDoc),
      crossDocError?.message ?? "inserted",
    );

    const { data: crossVersion, error: crossVersionError } = await asA
      .from("document_versions")
      .insert({
        organization_id: orgA,
        document_id: graphB.documentId,
        version_number: 99,
        sha256: createHash("sha256").update(`cross-version-${stamp}`).digest("hex"),
        storage_bucket: "evidence",
        storage_path: "x",
      })
      .select("id");
    record(
      "integrity",
      "A version cannot reference B document",
      failed(crossVersionError) || empty(crossVersion),
      crossVersionError?.message ?? "inserted",
    );

    const { data: crossFact, error: crossFactError } = await asA
      .from("extracted_facts")
      .insert({
        organization_id: orgA,
        extraction_run_id: graphB.runId,
        document_id: graphA.documentId,
        document_version_id: graphA.versionId,
        field: "spoof",
      })
      .select("id");
    record(
      "integrity",
      "A fact cannot reference B extraction run",
      failed(crossFactError) || empty(crossFact),
      crossFactError?.message ?? "inserted",
    );

    const { data: crossEvidence, error: crossEvidenceError } = await asA
      .from("source_evidence")
      .insert({
        organization_id: orgA,
        extracted_fact_id: graphB.factId,
        document_version_id: graphA.versionId,
      })
      .select("id");
    record(
      "integrity",
      "A evidence cannot reference B fact",
      failed(crossEvidenceError) || empty(crossEvidence),
      crossEvidenceError?.message ?? "inserted",
    );

    const unverified = await asA
      .from("extracted_facts")
      .update({
        verification_status: "HUMAN_VERIFIED",
        verified_value: "no actor",
      })
      .eq("id", graphA.factId)
      .select("id");
    record(
      "staging",
      "HUMAN_VERIFIED without verifier is rejected",
      failed(unverified.error) || empty(unverified.data),
      unverified.error?.message ?? "updated",
    );

    const missingTime = await asA
      .from("extracted_facts")
      .update({
        verification_status: "HUMAN_VERIFIED",
        verified_by: createdA.data.user.id,
        verified_at: null,
      })
      .eq("id", graphA.factId)
      .select("id");
    record(
      "staging",
      "HUMAN_VERIFIED without verified_at is rejected",
      failed(missingTime.error) || empty(missingTime.data),
      missingTime.error?.message ?? "updated",
    );

    const verified = await asA
      .from("extracted_facts")
      .update({
        verification_status: "HUMAN_VERIFIED",
        verified_by: createdA.data.user.id,
        verified_at: new Date().toISOString(),
        verified_value: "accepted",
      })
      .eq("id", graphA.factId)
      .select("id, verification_status")
      .single();
    record(
      "staging",
      "HUMAN_VERIFIED with actor and timestamp is accepted",
      !verified.error && verified.data?.verification_status === "HUMAN_VERIFIED",
      verified.error?.message ?? verified.data?.verification_status,
    );

    const pathA = `${orgA}/${graphA.documentId}/${graphA.versionId}/${stamp}/original.txt`;
    const pathB = `${orgB}/${graphB.documentId}/${graphB.versionId}/${stamp}/original.txt`;
    const body = new Blob(["phase2"]);

    const intakeA = await asA.storage.from("intake").upload(pathA, body, {
      contentType: "text/plain",
      upsert: false,
    });
    storageObjects.push({ bucket: "intake", path: pathA });
    record("storage", "A can upload under org A intake", !intakeA.error, intakeA.error?.message);

    const evidenceA = await asA.storage.from("evidence").upload(pathA, body, {
      contentType: "text/plain",
      upsert: false,
    });
    storageObjects.push({ bucket: "evidence", path: pathA });
    record(
      "storage",
      "A can upload under org A evidence",
      !evidenceA.error,
      evidenceA.error?.message,
    );

    const intakeBAsA = await asA.storage.from("intake").upload(pathB, body, {
      contentType: "text/plain",
      upsert: false,
    });
    if (!intakeBAsA.error) storageObjects.push({ bucket: "intake", path: pathB });
    record(
      "storage",
      "A cannot upload under org B intake",
      Boolean(intakeBAsA.error),
      intakeBAsA.error?.message ?? "uploaded",
    );

    const evidenceBAsA = await asA.storage.from("evidence").upload(pathB, body, {
      contentType: "text/plain",
      upsert: false,
    });
    if (!evidenceBAsA.error) storageObjects.push({ bucket: "evidence", path: pathB });
    record(
      "storage",
      "A cannot upload under org B evidence",
      Boolean(evidenceBAsA.error),
      evidenceBAsA.error?.message ?? "uploaded",
    );

    const listedB = await asA.storage.from("evidence").list(orgB);
    const listedBCount = (listedB.data ?? []).length;
    record(
      "storage",
      "A cannot list org B evidence",
      Boolean(listedB.error) || listedBCount === 0,
      listedB.error?.message ?? `${listedBCount} objects`,
    );

    const overwrite = await asA.storage.from("evidence").upload(pathA, body, {
      contentType: "text/plain",
      upsert: true,
    });
    record(
      "storage",
      "A cannot overwrite evidence via upsert",
      Boolean(overwrite.error),
      overwrite.error?.message ?? "upserted",
    );

    const updated = await asA.storage.from("evidence").update(pathA, body, {
      contentType: "text/plain",
    });
    record(
      "storage",
      "A cannot update evidence objects",
      Boolean(updated.error),
      updated.error?.message ?? "updated",
    );

    const removed = await asA.storage.from("evidence").remove([pathA]);
    const stillThere = await asA.storage.from("evidence").download(pathA);
    record(
      "storage",
      "A cannot delete evidence objects",
      Boolean(removed.error) || !stillThere.error,
      removed.error?.message ?? (stillThere.error ? "missing after remove" : "still present"),
    );

    const malformed = await asA.storage.from("intake").upload("not-a-uuid/file.txt", body, {
      contentType: "text/plain",
      upsert: false,
    });
    if (!malformed.error) storageObjects.push({ bucket: "intake", path: "not-a-uuid/file.txt" });
    record(
      "storage",
      "malformed path without org UUID is rejected",
      Boolean(malformed.error),
      malformed.error?.message ?? "uploaded",
    );

    const noSegment = await asA.storage.from("intake").upload("file-only.txt", body, {
      contentType: "text/plain",
      upsert: false,
    });
    if (!noSegment.error) storageObjects.push({ bucket: "intake", path: "file-only.txt" });
    record(
      "storage",
      "path without org folder is rejected",
      Boolean(noSegment.error),
      noSegment.error?.message ?? "uploaded",
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
