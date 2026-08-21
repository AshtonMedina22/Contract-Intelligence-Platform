import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const root = join(process.cwd());

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

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
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
  return { factId: fact.id, documentId: document.id };
}

function assertUiSurface() {
  const routes = [
    "apps/web/app/(platform)/contracts/page.tsx",
    "apps/web/app/(platform)/contracts/renewals/page.tsx",
    "apps/web/app/(platform)/contracts/compliance/page.tsx",
    "apps/web/app/(platform)/contracts/[contractId]/page.tsx",
    "apps/web/app/(platform)/contracts/[contractId]/service-plan/page.tsx",
    "apps/web/app/(platform)/contracts/[contractId]/commercial-terms/page.tsx",
    "apps/web/app/(platform)/contracts/[contractId]/changes/page.tsx",
    "apps/web/app/(platform)/contracts/[contractId]/renewal/page.tsx",
    "apps/web/lib/contracts/load-workspace.ts",
  ];
  for (const rel of routes) {
    record("ui", `route exists ${rel}`, existsSync(join(root, rel)));
  }

  // P1 deliberately demoted Renewals and Compliance out of CONTRACTS_TABS (its own gate A3 asserts
  // "Portfolio only"), so this no longer greps for three sidebar-level tabs. The requirement it was
  // really protecting — that all three portfolio-level routes stay reachable from each other — is
  // now asserted on the pages themselves. See P10_CONTRACT_RENEWAL_REBID_ACCEPTANCE.md.
  const tabs = read("apps/web/components/section-tabs.tsx");
  record(
    "ui",
    "ContractsNav is Portfolio only (P1 demotion), section identity intact",
    tabs.includes('href: "/contracts"') && tabs.includes("ContractsNav"),
  );

  const portfolioPage = read("apps/web/app/(platform)/contracts/page.tsx");
  const renewalsPage = read("apps/web/app/(platform)/contracts/renewals/page.tsx");
  const compliancePage = read("apps/web/app/(platform)/contracts/compliance/page.tsx");
  record(
    "ui",
    "Portfolio <-> Renewals <-> Compliance cross-linked on every contracts page",
    portfolioPage.includes("RENEWALS_ROUTE") &&
      portfolioPage.includes("COMPLIANCE_ROUTE") &&
      renewalsPage.includes("PORTFOLIO_ROUTE") &&
      renewalsPage.includes("COMPLIANCE_ROUTE") &&
      compliancePage.includes("PORTFOLIO_ROUTE") &&
      compliancePage.includes("RENEWALS_ROUTE") &&
      [portfolioPage, renewalsPage, compliancePage].every((src) => src.includes("ContractsNav")),
  );

  const shared = read("apps/web/components/opportunity-workspace/shared.tsx");
  record(
    "ui",
    "Contract workspace tabs Overview|Service Plan|Obligations|Commercial|Changes|Renewal",
    shared.includes('"Overview"') &&
      shared.includes('"Service Plan"') &&
      shared.includes('"Obligations"') &&
      shared.includes('"Commercial Terms"') &&
      shared.includes('"Changes"') &&
      shared.includes('"Renewal"'),
  );

  const loader = read("apps/web/lib/contracts/load-workspace.ts");
  record(
    "ui",
    "loader wires service plans / POs / federal / amendments / alerts",
    loader.includes("contract_service_plans") &&
      loader.includes("purchase_orders") &&
      loader.includes("federal_identifiers") &&
      loader.includes("contract_amendments") &&
      loader.includes("contract_alerts") &&
      loader.includes("never invent"),
  );

  const overview = read("apps/web/app/(platform)/contracts/[contractId]/page.tsx");
  record(
    "ui",
    "Overview shows buyer / value / vehicle / option / next action / risk without fabricating",
    overview.includes("Buyer") &&
      overview.includes("Original value") &&
      overview.includes("Current value") &&
      overview.includes("Vehicle") &&
      overview.includes("Options on file") &&
      overview.includes("Next action") &&
      overview.includes("Risk") &&
      overview.includes('return "—"'),
  );

  const service = read("apps/web/app/(platform)/contracts/[contractId]/service-plan/page.tsx");
  record(
    "ui",
    "Service Plan reads contract_service_plans + absent obligation honesty",
    service.includes("loadContractServicePlans") && service.includes("Supervisors, substitutes"),
  );

  const commercial = read("apps/web/app/(platform)/contracts/[contractId]/commercial-terms/page.tsx");
  record(
    "ui",
    "Commercial Terms includes POs + federal + escalation",
    commercial.includes("Purchase orders") &&
      commercial.includes("federal") &&
      commercial.includes("Escalation"),
  );

  const changes = read("apps/web/app/(platform)/contracts/[contractId]/changes/page.tsx");
  record(
    "ui",
    "Changes shows amendments + option exercises",
    changes.includes("amendment_number") && changes.includes("Option exercises"),
  );
  record(
    "ui",
    "Changes renders an append-only Original -> Amendment -> Mod -> Option -> Renewal timeline",
    changes.includes("buildChangeTimeline") &&
      changes.includes("CHANGE_HISTORY_APPEND_ONLY_NOTE") &&
      changes.includes('data-testid="change-timeline"'),
  );

  const renewal = read("apps/web/app/(platform)/contracts/[contractId]/renewal/page.tsx");
  record(
    "ui",
    "Renewal shows buckets + readiness + rebid + internal review",
    renewal.includes("RenewalBucketStrip") &&
      renewal.includes("Compliance readiness for rebid") &&
      renewal.includes("Internal review") &&
      renewal.includes("Rebid pursuit") &&
      renewal.includes("RebidButton"),
  );
}

async function main() {
  assertUiSurface();

  const admin = adminClient();
  const password = "Phase4-Contracts!22";
  const emailA = `phase4-a-${stamp}@example.com`;
  const emailB = `phase4-b-${stamp}@example.com`;

  try {
    const createdA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    if (createdA.error || !createdA.data.user) throw new Error(createdA.error?.message ?? "user A");
    if (createdB.error || !createdB.data.user) throw new Error(createdB.error?.message ?? "user B");
    users.push(createdA.data.user, createdB.data.user);

    const asA = await signIn(emailA, password);
    const asB = await signIn(emailB, password);
    const orgA = (await asA.rpc("create_organization_with_admin", { org_name: `P4 A ${stamp}` })).data;
    const orgB = (await asB.rpc("create_organization_with_admin", { org_name: `P4 B ${stamp}` })).data;
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
    const { factId } = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "executed-contract.pdf",
      documentType: "contract",
      field: "contract_end",
      value: end32,
    });
    const promoted = await asA.rpc("promote_contract_from_fact", { p_fact_id: factId });
    record("promote", "verified end date promotes", promoted.data?.ok === true, JSON.stringify(promoted.data));

    const { data: contract } = await asA
      .from("contracts")
      .select("id, verified_end_on, source_fact_id, opportunity_id")
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

    for (const [days, expected] of [
      [20, "30"],
      [45, "60"],
      [75, "90"],
      [110, "120"],
      [150, "180"],
      [-1, "EXPIRED"],
    ]) {
      const { data: bucketFn } = await asA.rpc("alert_bucket_for_days", { days_until: days });
      record("buckets", `${days} days → ${expected}`, bucketFn === expected, String(bucketFn));
    }

    const rfpOpp = (
      await asA
        .from("opportunities")
        .insert({ organization_id: orgA, client_id: clientRow.id, title: "RFP only" })
        .select("id")
        .single()
    ).data;
    const { factId: rfpFact } = await addFact(asA, orgA, createdA.data.user.id, rfpOpp.id, {
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

    const { data: award, error: awardError } = await asA
      .from("awards")
      .insert({
        organization_id: orgA,
        opportunity_id: opportunity.id,
        amount_nte: 1250000,
        winner_name: "L&P",
        notice: "Board award",
      })
      .select("id, amount_nte")
      .single();
    record("commercial", "award NTE stored for linked pursuit", !awardError && award?.amount_nte === 1250000, awardError?.message);

    const { data: plan, error: planError } = await asA
      .from("contract_service_plans")
      .insert({
        organization_id: orgA,
        contract_id: contract.id,
        site_name: "Admin Building",
        post_label: "Lobby",
        guard_classification: "Unarmed",
        hours_per_week: 40,
        schedule_note: "Mon–Fri 0800–1600",
      })
      .select("id, site_name")
      .single();
    record("service-plan", "contract_service_plans insert", !planError && plan?.site_name === "Admin Building", planError?.message);

    const { data: plans } = await asA
      .from("contract_service_plans")
      .select("id")
      .eq("contract_id", contract.id);
    record("service-plan", "service plan readable on contract", (plans ?? []).length === 1);

    const { data: po, error: poError } = await asA
      .from("purchase_orders")
      .insert({
        organization_id: orgA,
        contract_id: contract.id,
        opportunity_id: opportunity.id,
        po_number: `PO-${stamp}`,
        total_amount: 50000,
        payment_terms: "Net 30",
        vehicle_ref: "TXMAS",
      })
      .select("id")
      .single();
    record("commercial", "purchase_orders insert", !poError && Boolean(po?.id), poError?.message);

    if (po?.id) {
      const { error: lineError } = await asA.from("purchase_order_lines").insert({
        organization_id: orgA,
        purchase_order_id: po.id,
        line_label: "Unarmed guard",
        quantity: 1,
        unit: "hour",
        unit_rate: 28.5,
        rate_type: "standard",
      });
      record("commercial", "purchase_order_lines insert", !lineError, lineError?.message);
    }

    const { error: fedError } = await asA.from("federal_identifiers").insert({
      organization_id: orgA,
      contract_id: contract.id,
      opportunity_id: opportunity.id,
      scheme: "contract_vehicle",
      identifier: "TXMAS-18-51V01",
    });
    record("commercial", "federal_identifiers insert", !fedError, fedError?.message);

    const { error: optError } = await asA.from("contract_options").insert({
      organization_id: orgA,
      contract_id: contract.id,
      label: "Option Year 1",
      exercise_by: isoPlusDays(90),
    });
    record("renewal", "contract_options insert", !optError, optError?.message);

    const { error: renError } = await asA.from("renewals").insert({
      organization_id: orgA,
      contract_id: contract.id,
      notice: "90-day renewal notice",
      notice_due_on: isoPlusDays(60),
      escalation_index: "CPI-U",
      escalation_pct: 3.2,
      option_year: 1,
    });
    record("renewal", "renewals notice + escalation insert", !renError, renError?.message);

    const { data: amd1, error: amd1Error } = await asA
      .from("contract_amendments")
      .insert({
        organization_id: orgA,
        contract_id: contract.id,
        amendment_number: "M001",
        title: "Add site",
        note: "Added Admin Building post",
        effective_on: isoPlusDays(-30),
      })
      .select("id")
      .single();
    const { data: amd2, error: amd2Error } = await asA
      .from("contract_amendments")
      .insert({
        organization_id: orgA,
        contract_id: contract.id,
        amendment_number: "M002",
        title: "Rate change",
        note: "Bill rate +$1.00",
        effective_on: isoPlusDays(-10),
      })
      .select("id")
      .single();
    record("changes", "amendment M001 insert", !amd1Error && Boolean(amd1?.id), amd1Error?.message);
    record("changes", "amendment M002 insert (append)", !amd2Error && Boolean(amd2?.id), amd2Error?.message);

    const { data: amds } = await asA
      .from("contract_amendments")
      .select("id, amendment_number")
      .eq("contract_id", contract.id)
      .order("amendment_number");
    record(
      "changes",
      "historical amendments retained (never overwrite)",
      (amds ?? []).length === 2 &&
        amds.some((a) => a.amendment_number === "M001") &&
        amds.some((a) => a.amendment_number === "M002"),
      JSON.stringify(amds),
    );

    const { error: compContractError } = await asA.from("compliance_items").insert({
      organization_id: orgA,
      contract_id: contract.id,
      kind: "insurance",
      statement: "General liability COI on file",
      expires_on: isoPlusDays(120),
    });
    const { error: compOrgError } = await asA.from("compliance_items").insert({
      organization_id: orgA,
      contract_id: null,
      kind: "license",
      statement: "TX security company license",
      expires_on: isoPlusDays(200),
    });
    record("compliance", "contract-scoped compliance item", !compContractError, compContractError?.message);
    record("compliance", "company-level compliance item", !compOrgError, compOrgError?.message);

    const { data: companyCompliance } = await asA
      .from("compliance_items")
      .select("id, kind")
      .eq("organization_id", orgA)
      .is("contract_id", null);
    record("compliance", "company compliance readable", (companyCompliance ?? []).length >= 1);

    const priorEnd = contract.verified_end_on;
    const { factId: laterFact } = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "draft-amendment.pdf",
      documentType: "rfp",
      truth: "requested",
      field: "contract_end",
      value: isoPlusDays(400),
    });
    await asA.rpc("promote_contract_from_fact", { p_fact_id: laterFact });
    const { data: afterConflict } = await asA
      .from("contracts")
      .select("verified_end_on, source_fact_id")
      .eq("id", contract.id)
      .single();
    record(
      "truth",
      "requested truth cannot overwrite verified_end_on",
      afterConflict?.verified_end_on === priorEnd && afterConflict?.source_fact_id === factId,
      JSON.stringify(afterConflict),
    );

    const { data: rebidOpp, error: rebidError } = await asA
      .from("opportunities")
      .insert({
        organization_id: orgA,
        client_id: clientRow.id,
        title: `Rebid from ${stamp}`,
        stage: "INTAKE",
        rebid_from_contract_id: contract.id,
        rebid_from_opportunity_id: opportunity.id,
        response_due_on: isoPlusDays(45),
      })
      .select("id, rebid_from_contract_id")
      .single();
    record(
      "renewal",
      "rebid opportunity links to contract",
      !rebidError && rebidOpp?.rebid_from_contract_id === contract.id,
      rebidError?.message,
    );

    const { data: linkedRebids } = await asA
      .from("opportunities")
      .select("id")
      .eq("rebid_from_contract_id", contract.id);
    record("renewal", "rebid status readable from contract", (linkedRebids ?? []).length >= 1);

    const { data: bContracts } = await asB.from("contracts").select("id").eq("id", contract.id);
    record("rls", "org B cannot read org A contracts", !bContracts || bContracts.length === 0);

    const { data: bPlans } = await asB.from("contract_service_plans").select("id").eq("contract_id", contract.id);
    record("rls", "org B cannot read org A service plans", !bPlans || bPlans.length === 0);
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
