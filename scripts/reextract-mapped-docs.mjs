/**
 * Re-extract mapped A/B (+ competitor bid-tab) docs with expanded extractor,
 * harness-verify new structured facts, run full promote chain.
 *
 * Run: node --env-file=apps/web/.env.local scripts/reextract-mapped-docs.mjs
 * Requires: local processor on PROCESSOR_URL
 */
import { createClient } from "@supabase/supabase-js";

const TARGET_SRC = new Set(
  (process.env.REEXTRACT_SRC_IDS || "SRC-01,SRC-02,SRC-03,SRC-04,SRC-07,SRC-08,SRC-09,SRC-10,SRC-12,SRC-13,SRC-14,SRC-15,SRC-16")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
);

const STRUCTURED = new Set(["rate", "identifier", "requirement", "award", "number", "text"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.LP_OPERATOR_EMAIL?.trim();
const password = process.env.LP_OPERATOR_PASSWORD;
const processorUrl = (process.env.PROCESSOR_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const processorSecret = process.env.PROCESSOR_SHARED_SECRET ?? "dev-processor-secret";

if (!url || !secret || !publishable || !email || !password) {
  console.error("Need Supabase + LP_OPERATOR_*");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false } });
const anon = createClient(url, publishable, { auth: { persistSession: false } });

function matchesTarget(name) {
  const u = (name || "").toUpperCase();
  // Prefer longest SRC id match so SRC-20 does not steal SRC-20b/SRC-20c.
  const ranked = [...TARGET_SRC].sort((a, b) => b.length - a.length);
  for (const src of ranked) {
    const re = new RegExp(`(?:^|[^A-Z0-9])${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^A-Z0-9]|$)`);
    if (re.test(u)) return src;
  }
  if (/0000016167|TXDMV/i.test(name || "")) return "SRC-04";
  if (/JEFFERSON|12\.PDF/i.test(name || "") && /TAB|12/i.test(name || "")) return "SRC-08";
  return null;
}

function isClassC(src) {
  return ["SRC-10", "SRC-11", "SRC-12", "SRC-13", "SRC-14", "SRC-15", "SRC-16", "SRC-17", "SRC-18", "SRC-19"].includes(src);
}

const signIn = await anon.auth.signInWithPassword({ email, password });
if (signIn.error || !signIn.data.session) {
  console.error(signIn.error?.message ?? "sign-in failed");
  process.exit(1);
}
const user = createClient(url, publishable, {
  global: { headers: { Authorization: `Bearer ${signIn.data.session.access_token}` } },
  auth: { persistSession: false },
});
const userId = signIn.data.user.id;
const { data: mem } = await admin.from("memberships").select("organization_id").eq("user_id", userId).limit(1);
const orgId = mem?.[0]?.organization_id;

const health = await fetch(`${processorUrl}/health`);
if (!health.ok) {
  console.error("Processor down at", processorUrl);
  process.exit(1);
}

const { data: docs } = await admin
  .from("documents")
  .select("id, original_filename, opportunity_id, commercial_truth")
  .eq("organization_id", orgId);

const targets = (docs || []).filter((d) => {
  const src = matchesTarget(d.original_filename);
  return src && TARGET_SRC.has(src);
});
console.log(`Re-extracting ${targets.length} mapped docs…`);

const summary = [];

for (const doc of targets) {
  const src = matchesTarget(doc.original_filename);
  const { data: ver } = await admin
    .from("document_versions")
    .select("id")
    .eq("document_id", doc.id)
    .eq("is_current", true)
    .maybeSingle();
  if (!ver?.id) {
    summary.push({ src, file: doc.original_filename, ok: false, err: "no current version" });
    continue;
  }

  const res = await fetch(`${processorUrl}/jobs/parse-and-extract`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-processor-secret": processorSecret,
    },
    body: JSON.stringify({
      organization_id: orgId,
      document_id: doc.id,
      document_version_id: ver.id,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    summary.push({ src, file: doc.original_filename, ok: false, err: body.detail || res.status });
    continue;
  }

  const { data: facts } = await user
    .from("extracted_facts")
    .select(
      "id, field, entity, normalized_type, normalized_value, raw_value, source_page, source_excerpt, verification_status",
    )
    .eq("document_id", doc.id)
    .eq("verification_status", "AI_EXTRACTED");

  const now = new Date().toISOString();
  let verified = 0;
  const promotions = [];
  for (const fact of facts || []) {
    if (!STRUCTURED.has(fact.normalized_type)) continue;
    const value = (fact.normalized_value ?? fact.raw_value ?? "").trim();
    if (!value) continue;
    await user
      .from("extracted_facts")
      .update({
        verification_status: "HUMAN_VERIFIED",
        verified_value: value,
        verified_by: userId,
        verified_at: now,
      })
      .eq("id", fact.id);
    await user.from("verification_events").insert({
      organization_id: orgId,
      extracted_fact_id: fact.id,
      actor_id: userId,
      action: "VERIFY",
      from_status: "AI_EXTRACTED",
      to_status: "HUMAN_VERIFIED",
      note: `Re-extract map fill; page ${fact.source_page}`,
    });
    verified += 1;

    const classC = isClassC(src);
    const rpcs = classC
      ? [
          "promote_contract_from_fact",
          "promote_intelligence_from_fact",
          "promote_cost_component_from_fact",
          "promote_knowledge_chunk_from_fact",
        ]
      : [
          "promote_verified_fact",
          "promote_contract_from_fact",
          "promote_intelligence_from_fact",
          "promote_proposal_section_from_fact",
          "promote_required_form_from_fact",
          "promote_cost_component_from_fact",
          "promote_knowledge_chunk_from_fact",
        ];
    const actions = {};
    for (const rpc of rpcs) {
      const { data, error } = await user.rpc(rpc, { p_fact_id: fact.id });
      actions[rpc] = error ? error.message : data?.action ?? data;
    }
    promotions.push({ field: fact.field, entity: fact.entity, actions });
  }

  await user
    .from("documents")
    .update({ processing_status: "VERIFIED", lifecycle_error: null, updated_at: now })
    .eq("id", doc.id);

  summary.push({
    src,
    file: doc.original_filename,
    ok: true,
    factCount: body.fact_count ?? facts?.length,
    verified,
    sample: promotions.slice(0, 8).map((p) => `${p.entity}.${p.field}`),
  });
  console.log(
    `${src} verified=${verified} facts=${body.fact_count ?? "?"} → ${promotions
      .slice(0, 6)
      .map((p) => p.field)
      .join(",")}`,
  );
}

const counts = {};
for (const t of [
  "contracts",
  "purchase_orders",
  "federal_identifiers",
  "competitor_pricing_lines",
  "competitor_bids",
  "evaluation_scores",
  "proposal_sections",
  "contract_amendments",
  "contract_service_plans",
  "renewals",
  "pricing_lines",
  "document_chunks",
]) {
  const { count } = await admin.from(t).select("*", { count: "exact", head: true }).eq("organization_id", orgId);
  counts[t] = count;
}

console.log(JSON.stringify({ summary, counts }, null, 2));
