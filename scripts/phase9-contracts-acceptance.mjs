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

function isoPlusDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function addFact(client, orgId, userId, opportunityId, opts) {
  const sha = createHash("sha256").update(`${opts.filename}-${stamp}-${randomUUID()}`).digest("hex");
  const { data: document, error: docError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      opportunity_id: opportunityId,
      original_filename: opts.filename,
      document_type: opts.documentType,
      commercial_truth: opts.truth ?? "awarded",
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

  const { data: fact, error: factError } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: run.id,
      document_id: document.id,
      document_version_id: version.id,
      entity: opts.entity ?? "contract",
      field: opts.field,
      raw_value: opts.value,
      normalized_value: opts.value,
      verified_value: opts.value,
      verification_status: "HUMAN_VERIFIED",
      verified_by: userId,
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (factError) throw new Error(factError.message);
  return fact.id;
}

async function main() {
  const admin = adminClient();
  const password = "Phase9-Contracts!22";
  const emailA = `phase9-a-${stamp}@example.com`;
  const emailB = `phase9-b-${stamp}@example.com`;

  try {
    const createdA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    if (createdA.error || !createdA.data.user) throw new Error(createdA.error?.message ?? "user A");
    if (createdB.error || !createdB.data.user) throw new Error(createdB.error?.message ?? "user B");
    users.push(createdA.data.user, createdB.data.user);

    const asA = await signIn(emailA, password);
    const asB = await signIn(emailB, password);
    const orgA = (await asA.rpc("create_organization_with_admin", { org_name: `P9 A ${stamp}` })).data;
    const orgB = (await asB.rpc("create_organization_with_admin", { org_name: `P9 B ${stamp}` })).data;
    orgIds.push(orgA, orgB);

    const { data: clientRow, error: clientError } = await asA
      .from("clients")
      .insert({ organization_id: orgA, name: "Northside ISD" })
      .select("id")
      .single();
    if (clientError) throw new Error(clientError.message);

    const { data: opportunity, error: oppError } = await asA
      .from("opportunities")
      .insert({ organization_id: orgA, client_id: clientRow.id, title: "Awarded coverage" })
      .select("id")
      .single();
    if (oppError) throw new Error(oppError.message);

    const end32 = isoPlusDays(32);
    const factId = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "executed-contract.pdf",
      documentType: "contract",
      field: "contract_end",
      value: end32,
    });
    const promoted = await asA.rpc("promote_contract_from_fact", { p_fact_id: factId });
    record("promote", "verified end date promotes", promoted.data?.ok === true, JSON.stringify(promoted.data));

    const { data: contract } = await asA
      .from("contracts")
      .select("id, verified_end_on, source_fact_id")
      .eq("opportunity_id", opportunity.id)
      .single();
    record(
      "contract",
      "verified_end_on stored",
      contract?.verified_end_on === end32 && contract?.source_fact_id === factId,
      JSON.stringify(contract),
    );

    await asA.rpc("refresh_contract_alerts");
    const { data: alerts } = await asA
      .from("contract_alerts")
      .select("bucket, days_until, verified_end_on")
      .eq("contract_id", contract.id);
    const bucket = alerts?.[0]?.bucket;
    record(
      "cron",
      "32 days from verified date is 60-day bucket",
      bucket === "60" && alerts?.[0]?.verified_end_on === end32,
      JSON.stringify(alerts),
    );

    const rfpOpp = (
      await asA
        .from("opportunities")
        .insert({ organization_id: orgA, client_id: clientRow.id, title: "RFP only" })
        .select("id")
        .single()
    ).data;
    const rfpFact = await addFact(asA, orgA, createdA.data.user.id, rfpOpp.id, {
      filename: "rfp.pdf",
      documentType: "rfp",
      truth: "requested",
      field: "contract_end",
      value: isoPlusDays(20),
    });
    const rfpPromote = await asA.rpc("promote_contract_from_fact", { p_fact_id: rfpFact });
    record(
      "precedence",
      "RFP cannot write contract end",
      rfpPromote.data?.ok === false && rfpPromote.data?.action === "conflict",
      JSON.stringify(rfpPromote.data),
    );

    const { data: bContracts } = await asB.from("contracts").select("id").eq("id", contract.id);
    record("rls", "org B cannot read org A contracts", !bContracts || bContracts.length === 0);

    const { data: bucketFn } = await asA.rpc("alert_bucket_for_days", { days_until: 20 });
    record("buckets", "20 days is 30-day bucket", bucketFn === "30", String(bucketFn));
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
