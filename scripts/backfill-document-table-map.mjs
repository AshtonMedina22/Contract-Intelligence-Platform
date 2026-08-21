/**
 * Backfill procurement_packages + link documents, then re-run the full promote
 * chain on HUMAN_VERIFIED facts (document-table map).
 *
 * Run: node --env-file=apps/web/.env.local scripts/backfill-document-table-map.mjs
 */
import { createClient } from "@supabase/supabase-js";

const PILOT_PACKAGE_MAP = {
  "PKG-01": { title: "Williamson County Lake Creek Annex #202569", buyer: "Williamson County", corpusClass: "A", srcIds: ["SRC-01"] },
  "PKG-02": { title: "Allen ISD security agreement", buyer: "Allen ISD", corpusClass: "A", srcIds: ["SRC-02", "SRC-03"] },
  "PKG-03": { title: "Arlington TX 22-0143", buyer: "Arlington TX", corpusClass: "B", srcIds: ["SRC-06", "SRC-07"] },
  "PKG-04": { title: "TxDMV PO 0000016167", buyer: "TxDMV", corpusClass: "A", srcIds: ["SRC-04"] },
  "PKG-05": { title: "Jefferson County bid tab", buyer: "Jefferson County", corpusClass: "B", srcIds: ["SRC-08"] },
  "PKG-06": { title: "Texas Lottery IFB RQ22-0480DP", buyer: "Texas Lottery", corpusClass: "B", srcIds: ["SRC-09"] },
  "PKG-07": { title: "Dallas County BID TAB 16-0219", buyer: "Dallas County", corpusClass: "C", srcIds: ["SRC-10"] },
  "PKG-08": { title: "Dallas County 2014-036 synopsis", buyer: "Dallas County", corpusClass: "C", srcIds: ["SRC-11"] },
  "PKG-09": { title: "Tarrant County 2018-092", buyer: "Tarrant County", corpusClass: "C", srcIds: ["SRC-12"] },
  "PKG-10": { title: "MHMR Tarrant 25-003 tabulation", buyer: "MHMR Tarrant", corpusClass: "C", srcIds: ["SRC-13"] },
  "PKG-11": { title: "Harris County CPI renewal VSA", buyer: "Harris County", corpusClass: "C", srcIds: ["SRC-14"] },
  "PKG-12": { title: "TFC VSA 24-001 + Amend 4", buyer: "TFC", corpusClass: "C", srcIds: ["SRC-15", "SRC-16"] },
  "PKG-13": { title: "Arlington County VA 19-264-R", buyer: "Arlington County VA", corpusClass: "C", srcIds: ["SRC-17", "SRC-18", "SRC-19"] },
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.LP_OPERATOR_EMAIL?.trim();
const password = process.env.LP_OPERATOR_PASSWORD;

if (!url || !secret || !publishable || !email || !password) {
  console.error("Need Supabase + LP_OPERATOR_*");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false } });
const anon = createClient(url, publishable, { auth: { persistSession: false } });

function pkgForFilename(name) {
  const upper = (name || "").toUpperCase();
  for (const [key, meta] of Object.entries(PILOT_PACKAGE_MAP)) {
    if (meta.srcIds.some((src) => upper.includes(src))) return { key, meta };
    if (upper.includes(key)) return { key, meta };
  }
  // Filename patterns without SRC- prefix
  const hints = [
    ["PKG-01", /WILLIAMSON|1770_43/i],
    ["PKG-02", /ALLEN/i],
    ["PKG-03", /22-0143|ARLINGTON_22/i],
    ["PKG-04", /0000016167|TXDMV/i],
    ["PKG-05", /JEFFERSON|SRC-08|_12\.PDF/i],
    ["PKG-06", /LOTTERY|RQ22-0480/i],
    ["PKG-07", /16-0219/i],
    ["PKG-08", /2014-036/i],
    ["PKG-09", /2018-092|TARRANT/i],
    ["PKG-10", /25-003|MHMR/i],
    ["PKG-11", /26-0534|HARRIS/i],
    ["PKG-12", /24-001|VSA|TFC/i],
    ["PKG-13", /19-264|ARLINGTONVA/i],
  ];
  for (const [key, re] of hints) {
    if (re.test(name || "")) return { key, meta: PILOT_PACKAGE_MAP[key] };
  }
  return null;
}

function toDbClass(c) {
  if (c === "A") return "A_LP_ORIGINATED";
  if (c === "C") return "C_COMPETITOR_TEST";
  return "B_LP_TIED";
}

const signIn = await anon.auth.signInWithPassword({ email, password });
if (signIn.error || !signIn.data.session) {
  console.error(signIn.error?.message ?? "sign-in failed");
  process.exit(1);
}
const userClient = createClient(url, publishable, {
  global: { headers: { Authorization: `Bearer ${signIn.data.session.access_token}` } },
  auth: { persistSession: false },
});

const { data: memberships } = await admin
  .from("memberships")
  .select("organization_id")
  .eq("user_id", signIn.data.user.id)
  .limit(1);
const orgId = memberships?.[0]?.organization_id;
if (!orgId) {
  console.error("No org");
  process.exit(1);
}

const { data: docs } = await admin
  .from("documents")
  .select("id, original_filename, client_id, opportunity_id, procurement_package_id")
  .eq("organization_id", orgId);

const packageIds = new Map();
let linked = 0;
for (const doc of docs ?? []) {
  const hit = pkgForFilename(doc.original_filename);
  if (!hit) continue;
  let pkgId = packageIds.get(hit.key);
  if (!pkgId) {
    const { data: existing } = await admin
      .from("procurement_packages")
      .select("id")
      .eq("organization_id", orgId)
      .eq("package_key", hit.key)
      .maybeSingle();
    if (existing?.id) {
      pkgId = existing.id;
    } else {
      const { data: created, error } = await admin
        .from("procurement_packages")
        .insert({
          organization_id: orgId,
          package_key: hit.key,
          title: hit.meta.title,
          corpus_class:
            hit.meta.corpusClass === "A"
              ? "A_LP_ORIGINATED"
              : hit.meta.corpusClass === "C"
                ? "C_COMPETITOR_TEST"
                : "B_LP_TIED",
          buyer_name: hit.meta.buyer,
          client_id: doc.client_id,
          opportunity_id: doc.opportunity_id,
        })
        .select("id")
        .single();
      if (error) {
        console.error("package", hit.key, error.message, "class=", hit.meta.corpusClass);
        continue;
      }
      pkgId = created.id;
    }
    packageIds.set(hit.key, pkgId);
  }
  if (doc.procurement_package_id !== pkgId) {
    await admin.from("documents").update({ procurement_package_id: pkgId }).eq("id", doc.id);
    linked += 1;
  }
}

const { data: facts } = await admin
  .from("extracted_facts")
  .select("id, field")
  .eq("organization_id", orgId)
  .eq("verification_status", "HUMAN_VERIFIED");

const actions = { verified: 0, contract: 0, intel: 0, chunk: 0, fail: 0 };
for (const fact of facts ?? []) {
  for (const rpc of [
    "promote_verified_fact",
    "promote_contract_from_fact",
    "promote_intelligence_from_fact",
    "promote_knowledge_chunk_from_fact",
  ]) {
    const { data, error } = await userClient.rpc(rpc, { p_fact_id: fact.id });
    if (error) {
      actions.fail += 1;
      continue;
    }
    if (data?.ok === false && data?.action === "conflict") continue;
    if (rpc === "promote_verified_fact" && data?.ok) actions.verified += 1;
    if (rpc === "promote_contract_from_fact" && data?.ok && data?.action !== "skipped") actions.contract += 1;
    if (rpc === "promote_intelligence_from_fact" && data?.ok && data?.action !== "skipped") actions.intel += 1;
    if (rpc === "promote_knowledge_chunk_from_fact" && data?.ok) actions.chunk += 1;
  }
}

const counts = {};
for (const t of [
  "procurement_packages",
  "documents",
  "pricing_lines",
  "contracts",
  "purchase_orders",
  "competitor_pricing_lines",
  "competitor_bids",
  "evaluation_scores",
  "document_chunks",
]) {
  const { count } = await admin.from(t).select("*", { count: "exact", head: true }).eq("organization_id", orgId);
  counts[t] = count;
}

console.log(
  JSON.stringify(
    {
      orgId,
      packagesCreated: packageIds.size,
      documentsLinked: linked,
      hvFacts: facts?.length ?? 0,
      promote: actions,
      counts,
    },
    null,
    2,
  ),
);
