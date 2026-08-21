#!/usr/bin/env node
// P4 RLS acceptance for public_sources + pursuit provenance columns.
// Run with: node --env-file=apps/web/.env.local scripts/p4-public-sources-rls.mjs

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
const password = "P4-Discovery-Accept!22";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function makeMember(tag) {
  const email = `p4-${tag}-${stamp}@example.com`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`create ${tag}: ${created.error?.message}`);
  const client = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign in ${tag}: ${signIn.error.message}`);
  const org = await client.rpc("create_organization_with_admin", { org_name: `P4 ${tag} ${stamp}` });
  if (org.error || !org.data) throw new Error(`org ${tag}: ${org.error?.message}`);
  return { user: created.data.user, client, orgId: org.data };
}

const created = [];

try {
  const a = await makeMember("a");
  const b = await makeMember("b");
  created.push(a, b);

  const notice = {
    organization_id: a.orgId,
    provider: "fixture",
    external_id: `FIXTURE-SAM-RLS-${stamp}`,
    title: "SAMPLE FIXTURE — RLS probe notice",
    source_url: `https://fixture.invalid/sam-gov/RLS-${stamp}`,
    buyer_name: "SAMPLE AGENCY (FIXTURE)",
    watchlisted_at: new Date().toISOString(),
  };

  const inserted = await a.client.from("public_sources").insert(notice).select("id").single();
  record("org member inserts a public_source", !inserted.error, inserted.error?.message);
  const sourceId = inserted.data?.id;

  const ownRead = await a.client.from("public_sources").select("id").eq("id", sourceId);
  record("org member reads its own public_source", (ownRead.data ?? []).length === 1, ownRead.error?.message);

  const crossRead = await b.client.from("public_sources").select("id").eq("id", sourceId);
  record(
    "other org cannot read the public_source",
    !crossRead.error && (crossRead.data ?? []).length === 0,
    crossRead.error?.message,
  );

  const crossUpdate = await b.client
    .from("public_sources")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", sourceId)
    .select("id");
  record(
    "other org cannot update the public_source",
    (crossUpdate.data ?? []).length === 0,
    crossUpdate.error?.message,
  );

  const crossDelete = await b.client.from("public_sources").delete().eq("id", sourceId).select("id");
  record(
    "other org cannot delete the public_source",
    (crossDelete.data ?? []).length === 0,
    crossDelete.error?.message,
  );

  const crossInsert = await b.client
    .from("public_sources")
    .insert({ ...notice, external_id: `${notice.external_id}-x` })
    .select("id");
  record("other org cannot insert into org A", Boolean(crossInsert.error), crossInsert.error?.message ?? "no error");

  const badProvider = await a.client
    .from("public_sources")
    .insert({ ...notice, provider: "made_up", external_id: `${notice.external_id}-bad` })
    .select("id");
  record("provider enum is enforced at the database", Boolean(badProvider.error), badProvider.error?.message ?? "no error");

  const dupe = await a.client.from("public_sources").insert(notice).select("id");
  record(
    "(org, provider, external_id) is unique",
    Boolean(dupe.error),
    dupe.error?.message ?? "no error",
  );

  const pursuit = await a.client
    .from("opportunities")
    .insert({
      organization_id: a.orgId,
      title: notice.title,
      stage: "INTAKE",
      go_no_go: "PENDING",
      external_provider: notice.provider,
      external_source_id: notice.external_id,
      source_url: notice.source_url,
      public_source_id: sourceId,
    })
    .select("id, stage, go_no_go")
    .single();
  record(
    "pursuit records public provenance at INTAKE / PENDING",
    !pursuit.error && pursuit.data?.stage === "INTAKE" && pursuit.data?.go_no_go === "PENDING",
    pursuit.error?.message,
  );

  const dupePursuit = await a.client
    .from("opportunities")
    .insert({
      organization_id: a.orgId,
      title: `${notice.title} (dupe)`,
      external_provider: notice.provider,
      external_source_id: notice.external_id,
    })
    .select("id");
  record(
    "one pursuit per external notice per org",
    Boolean(dupePursuit.error),
    dupePursuit.error?.message ?? "no error",
  );

  const fact = await a.client
    .from("research_facts")
    .insert({
      organization_id: a.orgId,
      opportunity_id: pursuit.data?.id,
      source_url: notice.source_url,
      title: notice.title,
      verification_status: "AI_EXTRACTED",
      provider: notice.provider,
      external_id: notice.external_id,
    })
    .select("id, verification_status")
    .single();
  record(
    "public notice fact lands as AI_EXTRACTED",
    !fact.error && fact.data?.verification_status === "AI_EXTRACTED",
    fact.error?.message,
  );

  const forgedVerify = await a.client
    .from("research_facts")
    .insert({
      organization_id: a.orgId,
      opportunity_id: pursuit.data?.id,
      source_url: `${notice.source_url}-forged`,
      verification_status: "HUMAN_VERIFIED",
      provider: notice.provider,
      external_id: `${notice.external_id}-forged`,
    })
    .select("id");
  record(
    "HUMAN_VERIFIED without an actor is rejected",
    Boolean(forgedVerify.error),
    forgedVerify.error?.message ?? "no error",
  );

  const referencedDelete = await a.client
    .from("public_sources")
    .delete()
    .eq("id", sourceId)
    .select("id");
  record(
    "deleting a notice a pursuit was started from is blocked",
    Boolean(referencedDelete.error),
    referencedDelete.error?.message ?? "no error",
  );

  const spare = await a.client
    .from("public_sources")
    .insert({ ...notice, external_id: `${notice.external_id}-spare` })
    .select("id")
    .single();
  const spareDelete = await a.client
    .from("public_sources")
    .delete()
    .eq("id", spare.data?.id)
    .select("id");
  record(
    "org member can delete an unreferenced public_source",
    !spareDelete.error && (spareDelete.data ?? []).length === 1,
    spareDelete.error?.message,
  );
} finally {
  for (const member of created) {
    if (member?.orgId) await admin.from("organizations").delete().eq("id", member.orgId);
    if (member?.user?.id) await admin.auth.admin.deleteUser(member.user.id);
  }
}

const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failedCount}/${results.length} checks passed.`);
process.exit(failedCount === 0 ? 0 : 1);
