/**
 * Promote HUMAN_VERIFIED facts → document_chunks for the lasting operator org.
 * Run: node --env-file=apps/web/.env.local scripts/backfill-knowledge-chunks.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.LP_OPERATOR_EMAIL?.trim();
const password = process.env.LP_OPERATOR_PASSWORD;

if (!url || !secret || !publishable || !email || !password) {
  console.error("Need Supabase + LP_OPERATOR_* in env");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false } });
const anon = createClient(url, publishable, { auth: { persistSession: false } });

const signIn = await anon.auth.signInWithPassword({ email, password });
if (signIn.error || !signIn.data.session) {
  console.error(signIn.error?.message ?? "sign-in failed");
  process.exit(1);
}
const userClient = createClient(url, publishable, {
  global: { headers: { Authorization: `Bearer ${signIn.data.session.access_token}` } },
  auth: { persistSession: false },
});

const { data: memberships, error: memErr } = await admin
  .from("memberships")
  .select("organization_id")
  .eq("user_id", signIn.data.user.id);
if (memErr || !memberships?.length) {
  console.error(memErr?.message ?? "no membership");
  process.exit(1);
}
const orgId = memberships[0].organization_id;

const { data: facts, error } = await admin
  .from("extracted_facts")
  .select("id, field, document_id")
  .eq("organization_id", orgId)
  .eq("verification_status", "HUMAN_VERIFIED");
if (error) {
  console.error(error.message);
  process.exit(1);
}

let ok = 0;
let skip = 0;
let fail = 0;
for (const fact of facts ?? []) {
  const { data, error: rpcErr } = await userClient.rpc("promote_knowledge_chunk_from_fact", {
    p_fact_id: fact.id,
  });
  if (rpcErr) {
    fail += 1;
    console.log("FAIL", fact.field, rpcErr.message);
    continue;
  }
  if (data?.ok === true || data?.action === "chunked" || data?.action === "updated") {
    ok += 1;
  } else if (data?.action === "skipped" || data?.ok === false) {
    skip += 1;
  } else {
    ok += 1;
  }
}

const { count } = await admin
  .from("document_chunks")
  .select("*", { count: "exact", head: true })
  .eq("organization_id", orgId);

console.log(
  JSON.stringify(
    { orgId, verifiedFacts: facts?.length ?? 0, chunked: ok, skipped: skip, failed: fail, chunkCount: count },
    null,
    2,
  ),
);
