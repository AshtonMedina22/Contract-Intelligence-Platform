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

async function addFact(client, orgId, userId, opportunityId, opts) {
  const sha = createHash("sha256").update(`${opts.filename}-${stamp}-${randomUUID()}`).digest("hex");
  const { data: document, error: docError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      opportunity_id: opportunityId,
      original_filename: opts.filename,
      document_type: "award_letter",
      commercial_truth: "awarded",
      mime_type: "application/pdf",
    })
    .select("id")
    .single();
  if (docError) throw new Error(docError.message);

  const { data: version, error: versionError } = await client
    .from("document_versions")
    .insert({
      organization_id: orgId,
      document_id: document.id,
      sha256: sha,
      storage_path: `${orgId}/${document.id}/v/${sha}/original.pdf`,
      is_current: opts.isCurrent ?? true,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);

  const { data: run, error: runError } = await client
    .from("extraction_runs")
    .insert({ organization_id: orgId, document_version_id: version.id })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  const verified = opts.status !== "AI_EXTRACTED";
  const { data: fact, error: factError } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: run.id,
      document_id: document.id,
      document_version_id: version.id,
      entity: "requirement",
      field: opts.field ?? "staffing_note",
      raw_value: opts.value,
      normalized_value: opts.value,
      verified_value: verified ? opts.value : null,
      source_excerpt: opts.excerpt ?? opts.value,
      verification_status: opts.status ?? "HUMAN_VERIFIED",
      verified_by: verified ? userId : null,
      verified_at: verified ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (factError) throw new Error(factError.message);
  return { factId: fact.id, documentId: document.id, storagePath: `${orgId}/${document.id}/v/${sha}/original.pdf` };
}

async function main() {
  const admin = adminClient();
  const password = "Phase11-Search!22";
  const emailA = `phase11-a-${stamp}@example.com`;
  const emailB = `phase11-b-${stamp}@example.com`;

  try {
    const createdA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    if (createdA.error || !createdA.data.user) throw new Error(createdA.error?.message ?? "user A");
    if (createdB.error || !createdB.data.user) throw new Error(createdB.error?.message ?? "user B");
    users.push(createdA.data.user, createdB.data.user);

    const asA = await signIn(emailA, password);
    const asB = await signIn(emailB, password);
    const orgA = (await asA.rpc("create_organization_with_admin", { org_name: `P11 A ${stamp}` })).data;
    const orgB = (await asB.rpc("create_organization_with_admin", { org_name: `P11 B ${stamp}` })).data;
    orgIds.push(orgA, orgB);

    const { data: clientRow, error: clientError } = await asA
      .from("clients")
      .insert({ organization_id: orgA, name: "Eastside ISD" })
      .select("id")
      .single();
    if (clientError) throw new Error(clientError.message);

    const { data: opportunity, error: oppError } = await asA
      .from("opportunities")
      .insert({ organization_id: orgA, client_id: clientRow.id, title: "Coverage RFP" })
      .select("id")
      .single();
    if (oppError) throw new Error(oppError.message);

    const unverified = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "staging.pdf",
      value: "secret unverified staging text about overtime rates",
      status: "AI_EXTRACTED",
    });
    const skipped = await asA.rpc("promote_knowledge_chunk_from_fact", { p_fact_id: unverified.factId });
    record(
      "promote",
      "AI_EXTRACTED does not become a chunk",
      skipped.data?.ok === false && skipped.data?.action === "skipped",
      JSON.stringify(skipped.data),
    );

    const verified = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "verified.pdf",
      value: "Evaluator cited staffing depth on the night shift",
      excerpt: "staffing depth required at all posts",
    });
    const chunked = await asA.rpc("promote_knowledge_chunk_from_fact", { p_fact_id: verified.factId });
    record("promote", "HUMAN_VERIFIED fact becomes a chunk", chunked.data?.ok === true, JSON.stringify(chunked.data));
    const classified = await asA.rpc("set_document_data_classification", {
      p_document_id: verified.documentId,
      p_data_classification: "verified_internal",
      p_reason: "Ephemeral Phase 11 verified retrieval acceptance fixture.",
    });
    if (classified.error || !classified.data?.ok) {
      throw new Error(classified.error?.message ?? JSON.stringify(classified.data));
    }

    const { data: chunk } = await asA
      .from("document_chunks")
      .select("id, storage_path, verification_status, source_fact_id")
      .eq("source_fact_id", verified.factId)
      .single();
    record(
      "chunk",
      "citation stores Storage path and verified fact",
      chunk?.storage_path === verified.storagePath &&
        chunk?.verification_status === "HUMAN_VERIFIED" &&
        chunk?.source_fact_id === verified.factId,
      JSON.stringify(chunk),
    );

    const { data: hits } = await asA.rpc("search_verified_knowledge", {
      p_query: "staffing depth",
      p_for_drafting: true,
      p_limit: 10,
    });
    const hit = hits?.find((row) => row.source_fact_id === verified.factId);
    record(
      "search",
      "FTS returns verified chunk with storage citation",
      Boolean(hit) && hit.storage_path === verified.storagePath,
      JSON.stringify(hits),
    );

    const { data: stagingHits } = await asA.rpc("search_verified_knowledge", {
      p_query: "overtime rates",
      p_for_drafting: true,
      p_limit: 10,
    });
    record(
      "search",
      "unverified staging is not returned as truth",
      !(stagingHits ?? []).some((row) => row.source_fact_id === unverified.factId),
      JSON.stringify(stagingHits),
    );

    const blocked = await asA
      .from("document_chunks")
      .update({ reuse_status: "DO_NOT_USE" })
      .eq("id", chunk.id)
      .select("id")
      .single();
    record("reuse", "operator can mark DO_NOT_USE", Boolean(blocked.data?.id), JSON.stringify(blocked));

    const { data: draftingHits } = await asA.rpc("search_verified_knowledge", {
      p_query: "staffing depth",
      p_for_drafting: true,
      p_limit: 10,
    });
    record(
      "search",
      "DO_NOT_USE excluded from drafting retrieval",
      !(draftingHits ?? []).some((row) => row.chunk_id === chunk.id),
      JSON.stringify(draftingHits),
    );

    const { data: auditHits } = await asA.rpc("search_verified_knowledge", {
      p_query: "staffing depth",
      p_for_drafting: false,
      p_limit: 10,
    });
    record(
      "search",
      "non-drafting search can still see DO_NOT_USE",
      (auditHits ?? []).some((row) => row.chunk_id === chunk.id),
      JSON.stringify(auditHits),
    );

    await asA.from("document_chunks").update({ reuse_status: "APPROVED" }).eq("id", chunk.id);
    await asA.from("document_chunks").update({ is_current_version: false }).eq("id", chunk.id);
    const { data: oldHits } = await asA.rpc("search_verified_knowledge", {
      p_query: "staffing depth",
      p_for_drafting: true,
      p_limit: 10,
    });
    record(
      "search",
      "non-current version excluded from drafting",
      !(oldHits ?? []).some((row) => row.chunk_id === chunk.id),
      JSON.stringify(oldHits),
    );

    const { data: bHits } = await asB.rpc("search_verified_knowledge", {
      p_query: "staffing depth",
      p_for_drafting: false,
      p_limit: 10,
    });
    record("rls", "org B cannot retrieve org A chunks", !(bHits ?? []).some((row) => row.chunk_id === chunk.id));
  } catch (error) {
    record("fatal", error instanceof Error ? error.message : String(error), false);
  } finally {
    const adminInner = adminClient();
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
