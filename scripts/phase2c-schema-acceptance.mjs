/**
 * Prompt 2C — pilot-proven schema acceptance (RLS + tenant integrity).
 * Run: node --env-file=apps/web/.env.local scripts/phase2c-schema-acceptance.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const results = [];
const orgIds = [];
const users = [];

function record(area, name, ok, detail = "") {
  results.push({ ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function admin() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
function anon() {
  return createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email, password) {
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return c;
}

async function main() {
  const adm = admin();
  const password = `Phase2C-${stamp}!`;
  const emailA = `p2c-a-${stamp}@example.com`;
  const emailB = `p2c-b-${stamp}@example.com`;

  try {
    for (const email of [emailA, emailB]) {
      const created = await adm.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "create user");
      users.push(created.data.user);
    }

    const asA = await signIn(emailA, password);
    const asB = await signIn(emailB, password);
    const orgARes = await asA.rpc("create_organization_with_admin", { org_name: `P2C A ${stamp}` });
    const orgBRes = await asB.rpc("create_organization_with_admin", { org_name: `P2C B ${stamp}` });
    if (orgARes.error || orgBRes.error) throw new Error(orgARes.error?.message ?? orgBRes.error?.message);
    const orgA = orgARes.data;
    const orgB = orgBRes.data;
    orgIds.push(orgA, orgB);

    const clientA = await asA
      .from("clients")
      .insert({ organization_id: orgA, name: "Williamson County" })
      .select("id")
      .single();
    const oppA = await asA
      .from("opportunities")
      .insert({ organization_id: orgA, client_id: clientA.data.id, title: "PKG-01 Lake Creek" })
      .select("id")
      .single();

    const pkg = await asA
      .from("procurement_packages")
      .insert({
        organization_id: orgA,
        client_id: clientA.data.id,
        opportunity_id: oppA.data.id,
        package_key: "PKG-01",
        title: "Williamson #202569",
        corpus_class: "A_LP_ORIGINATED",
        buyer_name: "Williamson County",
      })
      .select("id")
      .single();
    record("package", "create procurement_packages A class", !pkg.error, pkg.error?.message);

    const pkgC = await asA
      .from("procurement_packages")
      .insert({
        organization_id: orgA,
        package_key: "PKG-07",
        title: "Dallas 16-0219 test",
        corpus_class: "C_COMPETITOR_TEST",
      })
      .select("id, corpus_class")
      .single();
    record(
      "package",
      "C competitor test class stored distinctly",
      !pkgC.error && pkgC.data?.corpus_class === "C_COMPETITOR_TEST",
      pkgC.error?.message ?? pkgC.data?.corpus_class,
    );

    const seenByB = await asB.from("procurement_packages").select("id").eq("id", pkg.data.id);
    record("rls", "org B cannot see org A packages", !seenByB.error && (seenByB.data?.length ?? 0) === 0);

    const sol = await asA
      .from("solicitations")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        client_id: clientA.data.id,
        title: "RFP 22-0143",
        solicitation_number: "22-0143",
      })
      .select("id")
      .single();

    const addendum = await asA
      .from("solicitation_addenda")
      .insert({
        organization_id: orgA,
        solicitation_id: sol.data.id,
        addendum_number: "1",
        title: "Addendum 1",
      })
      .select("id")
      .single();
    record("solicitation", "solicitation_addenda insert", !addendum.error, addendum.error?.message);

    const form = await asA
      .from("required_forms")
      .insert({
        organization_id: orgA,
        solicitation_id: sol.data.id,
        form_name: "HUB Subcontracting Plan",
        mandatory: true,
        section_ref: "Section 8",
      })
      .select("id")
      .single();
    record("solicitation", "required_forms insert", !form.error, form.error?.message);

    const score = await asA
      .from("evaluation_scores")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        respondent_name: "L&P Global Security",
        points: 70.48,
        max_points: 100,
        rank: 2,
      })
      .select("id")
      .single();
    record("result", "evaluation_scores insert (PKG-03 grain)", !score.error, score.error?.message);

    const line = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        labor_category: "unarmed",
        rate_type: "standard",
        proposed_rate: 31.45,
        site_or_post: "Lake Creek Annex",
      })
      .select("id, rate_type, proposed_rate")
      .single();
    record(
      "pricing",
      "pricing_lines rate_type + site grain",
      !line.error && line.data?.rate_type === "standard" && Number(line.data?.proposed_rate) === 31.45,
      line.error?.message,
    );

    const equip = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        labor_category: "golf_cart",
        rate_type: "equipment",
        proposed_rate: 500,
        unit: "month",
      })
      .select("id")
      .single();
    record("pricing", "equipment rate_type separate from hourly", !equip.error, equip.error?.message);

    const compLine = await asA
      .from("competitor_pricing_lines")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        vendor_name: "Allied Universal",
        hourly_rate: 19.31,
        rate_type: "standard",
      })
      .select("id")
      .single();
    record("pricing", "competitor_pricing_lines separate from L&P truths", !compLine.error, compLine.error?.message);

    const cost = await asA
      .from("cost_build_components")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        component_label: "Direct Wages",
        amount: 12.5,
        sort_order: 1,
      })
      .select("id")
      .single();
    record("pricing", "cost_build_components insert", !cost.error, cost.error?.message);

    const po = await asA
      .from("purchase_orders")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        client_id: clientA.data.id,
        po_number: "0000016167",
        total_amount: 2839.55,
        payment_terms: "NET30",
      })
      .select("id")
      .single();
    const poLine = await asA
      .from("purchase_order_lines")
      .insert({
        organization_id: orgA,
        purchase_order_id: po.data.id,
        line_label: "Armed Security Guard",
        quantity: 72,
        unit: "HR",
        unit_rate: 33.25,
        extended_amount: 2394,
      })
      .select("id")
      .single();
    record("contract", "purchase_orders + lines (PKG-04)", !po.error && !poLine.error, po.error?.message ?? poLine.error?.message);

    const section = await asA
      .from("proposal_sections")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        section_key: "pricing",
        title: "Pricing",
        source_page: 17,
        excerpt: "UnArmed Security Officer $31.45",
      })
      .select("id")
      .single();
    record("proposal", "proposal_sections with source_page", !section.error, section.error?.message);

    const fed = await asA
      .from("federal_identifiers")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        scheme: "TXMAS",
        identifier: "TXMAS-24-99003",
      })
      .select("id")
      .single();
    record("identifiers", "federal_identifiers TXMAS", !fed.error, fed.error?.message);

    const contract = await asA
      .from("contracts")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        client_id: clientA.data.id,
        title: "Services Contract #202569",
        contract_number: "202569",
      })
      .select("id")
      .single();
    const plan = await asA
      .from("contract_service_plans")
      .insert({
        organization_id: orgA,
        contract_id: contract.data.id,
        site_name: "Lake Creek Annex",
        guard_classification: "unarmed",
        hours_per_week: 40,
      })
      .select("id")
      .single();
    record("contract", "contract_service_plans insert", !plan.error, plan.error?.message);

    const crossOrg = await asB
      .from("purchase_orders")
      .insert({
        organization_id: orgA,
        po_number: "should-fail",
        total_amount: 1,
      })
      .select("id")
      .single();
    record("integrity", "org B cannot insert into org A purchase_orders", Boolean(crossOrg.error), crossOrg.error?.message ?? "inserted");

    const award = await asA
      .from("awards")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        notice: "Awarded to Vets Securing America",
        amount_nte: 960343,
        winner_name: "Vets Securing America",
        rank: 1,
      })
      .select("id, amount_nte")
      .single();
    record("result", "awards amount_nte column", !award.error && Number(award.data?.amount_nte) === 960343, award.error?.message);

    const staffing = await asA
      .from("staffing_requirements")
      .insert({
        organization_id: orgA,
        opportunity_id: oppA.data.id,
        post_label: "Main Lobby",
        site_name: "City Hall",
        building: "Building A",
        guard_classification: "unarmed",
        schedule_note: "0600-1800",
      })
      .select("id, site_name")
      .single();
    record("scope", "staffing site/building/classification columns", !staffing.error && staffing.data?.site_name === "City Hall", staffing.error?.message);
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

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.filter((r) => r.ok).length} passed, ${failed} failed, ${results.length} total`);
  if (failed > 0) process.exit(1);
}

await main();
