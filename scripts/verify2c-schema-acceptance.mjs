/**
 * VERIFY 2C — independent post-pilot schema audit.
 * Evidence authority: docs/benchmarks/PILOT_GAP_REPORT.md
 * Run: node --env-file=apps/web/.env.local scripts/verify2c-schema-acceptance.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const adm = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function record(domain, name, ok, detail = "") {
  results.push({ domain, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${domain}] ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Tables introduced in Prompt 2C migrations (must exist + tenant + RLS). */
const NEW_TABLES = [
  "procurement_packages",
  "solicitation_addenda",
  "required_forms",
  "evaluation_scores",
  "competitor_pricing_lines",
  "cost_build_components",
  "purchase_orders",
  "purchase_order_lines",
  "proposal_sections",
  "federal_identifiers",
  "contract_service_plans",
];

/** Pilot evidence citations (gap report / package keys) — audit matrix. */
const EVIDENCE = {
  procurement_packages: "PKG-01..13 package model; corpus_class A/B/C",
  solicitation_addenda: "PKG-03 SRC-06 Addendum 1",
  required_forms: "PKG-06 Lottery forms/HUB/cost sheet",
  evaluation_scores: "PKG-03 SRC-07 L&P 70.48 vs VSA 90.46",
  competitor_pricing_lines: "PKG-05/07/10 multi-vendor tabs",
  cost_build_components: "PKG-09 Tarrant wage/FICA/WC/OH/profit",
  purchase_orders: "PKG-04 TxDMV PO 0000016167",
  purchase_order_lines: "PKG-04 72 HR × $33.25; Extended Hours",
  proposal_sections: "PKG-01 Williamson proposal sections + page",
  federal_identifiers: "PKG-01/04 TXMAS / GSA",
  contract_service_plans: "PKG-02 Allen / PKG-12 TFC Level II vs III",
  "pricing_lines.rate_type": "PKG-01 golf cart; PKG-10 OT/holiday",
  "pricing_lines.site_or_post": "PKG-05 site tabs",
  "awards.amount_nte": "PKG-03 award $960,343",
  "staffing_requirements.site_name": "PKG-03 building/post matrix",
  "renewals.escalation_index": "PKG-11 Harris CPI-W",
  "opportunity_outcome.NO_AWARD": "PKG-05 all bids rejected",
};

/**
 * Blueprint-style names that must NOT exist as tables unless pilot-proven.
 * Phase 8 (Prompt 8) later mandated `requirement_responses` for Pursuit → Response —
 * that table is intentionally allowed and asserted present below.
 */
const THEORETICAL_FORBIDDEN = [
  "solicitation_q_and_a",
  "wage_determinations",
  "past_performance",
  "proposal_versions",
  "schedules",
  "submission_items",
  "pursuit_outcomes",
  "staffing_posts",
  "service_plan_sites",
  "contract_instruments",
  "evaluator_scores",
];

async function tableExists(name) {
  const { error } = await adm.from(name).select("*").limit(0);
  // PGRST205 = table not in schema cache / missing
  if (error && (error.code === "PGRST205" || /could not find|does not exist/i.test(error.message))) {
    return false;
  }
  return true;
}

async function hasOrgColumn(name) {
  const { error } = await adm.from(name).select("organization_id").limit(0);
  return !error;
}

async function main() {
  // --- Catalog: new tables exist ---
  for (const t of NEW_TABLES) {
    const exists = await tableExists(t);
    record("catalog", `table exists: ${t}`, exists, EVIDENCE[t] ?? "");
    if (exists) {
      const org = await hasOrgColumn(t);
      record("tenancy", `${t}.organization_id`, org);
    }
  }

  // --- Theoretical tables must stay absent ---
  for (const t of THEORETICAL_FORBIDDEN) {
    const exists = await tableExists(t);
    record(
      "evidence",
      `no theoretical table ${t}`,
      !exists,
      exists ? "PRESENT without discrete pilot table mandate" : "absent (deferred OK)",
    );
  }

  // Phase 8 Response workspace — mandated after VERIFY 2C; must exist with tenancy.
  {
    const exists = await tableExists("requirement_responses");
    record(
      "evidence",
      "phase8 table requirement_responses present",
      exists,
      "Prompt 8 Response drafts (post-2C mandate)",
    );
    if (exists) {
      record("tenancy", "requirement_responses.organization_id", await hasOrgColumn("requirement_responses"));
    }
  }

  // --- Evidence-backed renames / mappings from gap recommendations ---
  record(
    "evidence",
    "gap evaluator_scores → evaluation_scores",
    await tableExists("evaluation_scores"),
    "PKG-03",
  );
  record(
    "evidence",
    "gap staffing_posts → staffing_requirements columns",
    await hasOrgColumn("staffing_requirements"),
    "PKG-03 site_name/building/guard_classification",
  );
  record(
    "evidence",
    "gap contract_instruments PO → purchase_orders",
    await tableExists("purchase_orders"),
    "PKG-04",
  );
  record(
    "evidence",
    "gap service_plan_sites → contract_service_plans",
    await tableExists("contract_service_plans"),
    "PKG-02/12",
  );
  record(
    "evidence",
    "gap amendments → contract_amendments (phase9 + pilot grain)",
    await tableExists("contract_amendments"),
    "PKG-12 SRC-16 Amend 4; PKG-13 SRC-18",
  );
  const { error: amendColsErr } = await adm
    .from("contract_amendments")
    .select("amendment_number, title, source_document_id, source_fact_id, note")
    .limit(0);
  record(
    "contract",
    "contract_amendments amendment_number + title + provenance",
    !amendColsErr,
    amendColsErr?.message ?? "PKG-12/13 grain",
  );

  // --- Four commercial truths remain distinct columns ---
  const { error: pricingErr } = await adm
    .from("pricing_lines")
    .select("requested_rate, proposed_rate, awarded_rate, current_rate, rate_type, site_or_post")
    .limit(0);
  record(
    "four-truth",
    "pricing_lines retains four distinct rate columns + grain",
    !pricingErr,
    pricingErr?.message ?? "requested/proposed/awarded/current + rate_type/site",
  );

  // --- Duplication: line rates only on competitor_pricing_lines ---
  const bidsExist = await tableExists("competitor_bids");
  const linesExist = await tableExists("competitor_pricing_lines");
  record(
    "duplication",
    "outcome summary + line grain tables both present",
    bidsExist && linesExist,
    "bids=quoted_amount/rank; lines=hourly tab rows",
  );
  const { error: bidHourlyErr } = await adm.from("competitor_bids").select("hourly_rate").limit(0);
  const hourlyGone =
    Boolean(bidHourlyErr) &&
    /column|does not exist|could not find/i.test(bidHourlyErr?.message ?? "");
  record(
    "duplication",
    "competitor_bids has no hourly_rate (no overlap)",
    hourlyGone,
    bidHourlyErr?.message ?? "hourly_rate still present",
  );
  const { error: bidRateTypeErr } = await adm.from("competitor_bids").select("rate_type").limit(0);
  const rateTypeGone =
    Boolean(bidRateTypeErr) &&
    /column|does not exist|could not find/i.test(bidRateTypeErr?.message ?? "");
  record(
    "duplication",
    "competitor_bids has no rate_type (no overlap)",
    rateTypeGone,
    bidRateTypeErr?.message ?? "rate_type still present",
  );
  const { error: bidSummaryErr } = await adm
    .from("competitor_bids")
    .select("quoted_amount, rank")
    .limit(0);
  record(
    "duplication",
    "competitor_bids keeps outcome summary columns",
    !bidSummaryErr,
    bidSummaryErr?.message ?? "quoted_amount, rank",
  );

  // --- Altered columns from gap ---
  const alters = [
    ["awards", "amount_nte,winner_name,rank"],
    ["requirements", "mandatory,section_ref"],
    ["renewals", "escalation_index,escalation_pct,option_year"],
    ["documents", "procurement_package_id"],
  ];
  for (const [table, cols] of alters) {
    const { error } = await adm.from(table).select(cols).limit(0);
    record("catalog", `${table} altered columns (${cols})`, !error, error?.message);
  }

  // --- Live RLS smoke (reuse 2C pattern lightly) ---
  const stamp = Date.now().toString(36);
  const password = `V2C-${stamp}!`;
  const emailA = `v2c-a-${stamp}@example.com`;
  const emailB = `v2c-b-${stamp}@example.com`;
  const users = [];
  const orgIds = [];
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  const anon = () =>
    createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    for (const email of [emailA, emailB]) {
      const created = await adm.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "create user");
      users.push(created.data.user);
    }
    const asA = anon();
    const asB = anon();
    const signA = await asA.auth.signInWithPassword({ email: emailA, password });
    const signB = await asB.auth.signInWithPassword({ email: emailB, password });
    if (signA.error || signB.error) throw new Error(signA.error?.message ?? signB.error?.message);

    const orgARes = await asA.rpc("create_organization_with_admin", { org_name: `V2C A ${stamp}` });
    const orgBRes = await asB.rpc("create_organization_with_admin", { org_name: `V2C B ${stamp}` });
    if (orgARes.error || orgBRes.error) throw new Error(orgARes.error?.message ?? orgBRes.error?.message);
    orgIds.push(orgARes.data, orgBRes.data);

    const pkg = await asA
      .from("procurement_packages")
      .insert({
        organization_id: orgARes.data,
        package_key: "V2C-PKG",
        title: "Audit package",
        corpus_class: "A_LP_ORIGINATED",
      })
      .select("id")
      .single();
    record("rls", "member can insert procurement_packages", !pkg.error, pkg.error?.message);

    const leak = await asB.from("procurement_packages").select("id").eq("id", pkg.data?.id ?? "00000000-0000-0000-0000-000000000000");
    record("rls", "cross-tenant package select empty", !leak.error && (leak.data?.length ?? 0) === 0);

    const hijack = await asB
      .from("federal_identifiers")
      .insert({
        organization_id: orgARes.data,
        scheme: "TXMAS",
        identifier: "should-fail",
      })
      .select("id")
      .single();
    record("rls", "cross-tenant federal_identifiers insert rejected", Boolean(hijack.error), hijack.error?.message);

    // Same-org FK: solicitation_addenda cannot point at foreign solicitation via org mismatch
    const client = await asA
      .from("clients")
      .insert({ organization_id: orgARes.data, name: "V2C Client" })
      .select("id")
      .single();
    const opp = await asA
      .from("opportunities")
      .insert({ organization_id: orgARes.data, client_id: client.data.id, title: "V2C Opp" })
      .select("id")
      .single();
    const sol = await asA
      .from("solicitations")
      .insert({
        organization_id: orgARes.data,
        opportunity_id: opp.data.id,
        client_id: client.data.id,
        title: "V2C Sol",
      })
      .select("id")
      .single();
    const addOk = await asA
      .from("solicitation_addenda")
      .insert({
        organization_id: orgARes.data,
        solicitation_id: sol.data.id,
        addendum_number: "1",
        title: "Addendum 1",
      })
      .select("id")
      .single();
    record("integrity", "same-org solicitation_addenda insert", !addOk.error, addOk.error?.message);

    const formProv = await asA
      .from("required_forms")
      .insert({
        organization_id: orgARes.data,
        solicitation_id: sol.data.id,
        form_name: "HUB Plan",
        mandatory: true,
        source_document_id: null,
      })
      .select("id, source_document_id")
      .single();
    record("provenance", "required_forms accepts source_document_id column", !formProv.error, formProv.error?.message);

    const contract = await asA
      .from("contracts")
      .insert({
        organization_id: orgARes.data,
        opportunity_id: opp.data.id,
        client_id: client.data.id,
        title: "TFC 24-001-000",
        contract_number: "24-001-000",
      })
      .select("id")
      .single();
    const amend = await asA
      .from("contract_amendments")
      .insert({
        organization_id: orgARes.data,
        contract_id: contract.data.id,
        note: "Amendment 4 staffing update",
        amendment_number: "4",
        title: "Amendment No. 4",
      })
      .select("id, amendment_number")
      .single();
    record(
      "contract",
      "contract_amendments insert Amend 4 grain (PKG-12)",
      !amend.error && amend.data?.amendment_number === "4",
      amend.error?.message,
    );

    // Provenance columns present on key canonical tables
    for (const [table, cols] of [
      ["evaluation_scores", "source_fact_id,source_document_id"],
      ["competitor_pricing_lines", "source_fact_id,source_document_id"],
      ["purchase_orders", "source_fact_id,source_document_id"],
      ["proposal_sections", "source_fact_id,source_document_id,source_page"],
      ["cost_build_components", "source_fact_id,source_document_id"],
      ["contract_service_plans", "source_fact_id,source_document_id"],
      ["required_forms", "source_fact_id,source_document_id"],
      ["contract_amendments", "source_fact_id,source_document_id,amendment_number,title"],
    ]) {
      const { error } = await asA.from(table).select(cols).limit(0);
      record("provenance", `${table} provenance columns`, !error, error?.message ?? cols);
    }

    // Four-truth collapse check: distinct columns writable independently (structural)
    const line = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgARes.data,
        opportunity_id: opp.data.id,
        labor_category: "Armed",
        rate_type: "standard",
        site_or_post: "",
        requested_rate: 10,
        proposed_rate: 12,
        awarded_rate: 11,
        current_rate: 13,
      })
      .select("requested_rate, proposed_rate, awarded_rate, current_rate")
      .single();
    const distinct =
      !line.error &&
      Number(line.data.requested_rate) === 10 &&
      Number(line.data.proposed_rate) === 12 &&
      Number(line.data.awarded_rate) === 11 &&
      Number(line.data.current_rate) === 13;
    record("four-truth", "no collapse on insert (4 distinct values)", distinct, line.error?.message);

    const equip = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgARes.data,
        opportunity_id: opp.data.id,
        labor_category: "Armed",
        rate_type: "overtime",
        site_or_post: "",
        proposed_rate: 18,
      })
      .select("id")
      .single();
    record("pricing", "rate_type grain allows OT beside standard", !equip.error, equip.error?.message);
  } catch (error) {
    record("harness", "suite execution", false, error instanceof Error ? error.message : String(error));
  } finally {
    for (const orgId of orgIds) {
      await adm.from("organizations").delete().eq("id", orgId);
    }
    for (const user of users) {
      if (user?.id) await adm.auth.admin.deleteUser(user.id);
    }
  }

  // Domain rollups for human report
  const byDomain = {};
  for (const r of results) {
    byDomain[r.domain] ??= { pass: 0, fail: 0 };
    byDomain[r.domain][r.ok ? "pass" : "fail"] += 1;
  }
  console.log("\n--- Domain rollup ---");
  for (const [d, c] of Object.entries(byDomain)) {
    const status = c.fail === 0 ? "PASS" : "FAIL";
    console.log(`${status}  ${d}: ${c.pass} passed, ${c.fail} failed`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.filter((r) => r.ok).length} passed, ${failed} failed, ${results.length} total`);
  if (failed > 0) process.exit(1);
}

await main();
