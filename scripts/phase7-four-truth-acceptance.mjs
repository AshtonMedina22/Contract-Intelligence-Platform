import { createHash } from "node:crypto";
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
  const sha = createHash("sha256").update(`${opts.filename}-${stamp}`).digest("hex");
  const { data: document, error: docError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      opportunity_id: opportunityId,
      original_filename: opts.filename,
      document_type: opts.documentType,
      commercial_truth: opts.truth ?? null,
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
      entity: opts.entity ?? "Armed officer",
      field: opts.field ?? "unit_price",
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
  return { documentId: document.id, factId: fact.id };
}

async function main() {
  const admin = adminClient();
  const password = "Phase7-Four-Truth!22";
  const emailA = `phase7-a-${stamp}@example.com`;
  const emailB = `phase7-b-${stamp}@example.com`;

  try {
    const createdA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    if (createdA.error || !createdA.data.user) throw new Error(createdA.error?.message ?? "user A");
    if (createdB.error || !createdB.data.user) throw new Error(createdB.error?.message ?? "user B");
    users.push(createdA.data.user, createdB.data.user);

    const asA = await signIn(emailA, password);
    const asB = await signIn(emailB, password);
    const orgA = (await asA.rpc("create_organization_with_admin", { org_name: `P7 A ${stamp}` })).data;
    const orgB = (await asB.rpc("create_organization_with_admin", { org_name: `P7 B ${stamp}` })).data;
    orgIds.push(orgA, orgB);

    const { data: clientRow, error: clientError } = await asA
      .from("clients")
      .insert({ organization_id: orgA, name: "Northside ISD" })
      .select("id")
      .single();
    if (clientError) throw new Error(clientError.message);

    const { data: opportunity, error: oppError } = await asA
      .from("opportunities")
      .insert({ organization_id: orgA, client_id: clientRow.id, title: "RFP 26-04" })
      .select("id")
      .single();
    if (oppError) throw new Error(oppError.message);

    const rfp = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "rfp.pdf",
      documentType: "rfp",
      value: "10.00",
    });
    const proposal = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "proposal-pricing.xlsx",
      documentType: "proposal",
      value: "12.50",
    });
    const award = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "award.pdf",
      documentType: "award",
      value: "11.00",
    });
    const amendment = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "amendment-1.pdf",
      documentType: "amendment",
      value: "13.00",
    });

    for (const item of [rfp, proposal, award, amendment]) {
      const { data, error } = await asA.rpc("promote_verified_fact", { p_fact_id: item.factId });
      record("promote", `promote ${item.factId.slice(0, 8)}`, !error && data?.ok === true, error?.message ?? JSON.stringify(data));
    }

    const { data: line } = await asA
      .from("pricing_lines")
      .select("requested_rate, proposed_rate, awarded_rate, current_rate")
      .eq("opportunity_id", opportunity.id)
      .single();

    const requested = Number(line?.requested_rate);
    const proposed = Number(line?.proposed_rate);
    const awardedRate = Number(line?.awarded_rate);
    const current = Number(line?.current_rate);
    record(
      "four-truth",
      "requested != proposed != awarded != current",
      requested === 10 && proposed === 12.5 && awardedRate === 11 && current === 13,
      JSON.stringify(line),
    );

    const spoof = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "award-spoof.pdf",
      documentType: "award",
      field: "requested_rate",
      value: "99.00",
    });
    const spoofResult = await asA.rpc("promote_verified_fact", { p_fact_id: spoof.factId });
    record(
      "precedence",
      "award document cannot write requested_rate",
      spoofResult.data?.ok === false && spoofResult.data?.action === "conflict",
      JSON.stringify(spoofResult.data ?? spoofResult.error),
    );

    const clash = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "rfp-addendum.pdf",
      documentType: "addendum",
      value: "15.00",
    });
    const clashResult = await asA.rpc("promote_verified_fact", { p_fact_id: clash.factId });
    record(
      "precedence",
      "second requested rate does not overwrite",
      clashResult.data?.ok === false && clashResult.data?.action === "conflict",
      JSON.stringify(clashResult.data ?? clashResult.error),
    );

    const { data: lineAfter } = await asA
      .from("pricing_lines")
      .select("requested_rate")
      .eq("opportunity_id", opportunity.id)
      .single();
    record("precedence", "requested_rate still 10", Number(lineAfter?.requested_rate) === 10, String(lineAfter?.requested_rate));

    const reqFact = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "rfp-reqs.pdf",
      documentType: "rfp",
      entity: "requirement",
      field: "requirement",
      value: "Provide 24/7 coverage",
    });
    const reqPromote = await asA.rpc("promote_verified_fact", { p_fact_id: reqFact.factId });
    record("requirements", "solicitation requirement promoted", reqPromote.data?.ok === true, JSON.stringify(reqPromote.data));

    const { data: bLines } = await asB.from("pricing_lines").select("id").eq("opportunity_id", opportunity.id);
    record("rls", "org B cannot read org A pricing_lines", !bLines || bLines.length === 0, `${(bLines ?? []).length} rows`);
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
