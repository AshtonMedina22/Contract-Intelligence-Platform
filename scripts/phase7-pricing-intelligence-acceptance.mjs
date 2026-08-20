#!/usr/bin/env node
/**
 * Canonical Phase 7 — Pricing Intelligence acceptance.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
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
  results.push({ area, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function admin() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
function anon() {
  return createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function signIn(email, password) {
  const client = anon();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return client;
}
function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

async function main() {
  const adm = admin();
  try {
    const surfaces = [
      "apps/web/components/opportunity-workspace/pricing-glide-grid.tsx",
      "apps/web/components/opportunity-workspace/final-bid-panel.tsx",
      "apps/web/components/opportunity-workspace/pricing-workbench.tsx",
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/pricing/page.tsx",
      "apps/web/app/(platform)/intelligence/pricing/page.tsx",
      "supabase/migrations/20260820900000_phase7_pricing_intelligence.sql",
    ];
    for (const rel of surfaces) {
      record("ui", `exists ${rel}`, existsSync(join(ROOT, rel)));
    }

    const glide = read("apps/web/components/opportunity-workspace/pricing-glide-grid.tsx");
    record(
      "pursuit",
      "Pursuit Pricing uses Glide Data Grid",
      /@glideapps\/glide-data-grid/.test(glide) && /DataEditor/.test(glide),
    );
    record(
      "pursuit",
      "Five truths present in Glide columns",
      /Buyer requested/.test(glide) &&
        /L&P internal cost/.test(glide) &&
        /L&P submitted/.test(glide) &&
        /Buyer awarded/.test(glide) &&
        /Current\/amended/.test(glide),
    );

    const workbench = read("apps/web/components/opportunity-workspace/pricing-workbench.tsx");
    record(
      "pursuit",
      "Workbench keeps human final bid required",
      /FinalBidPanel/.test(workbench) && /human decision/.test(workbench),
    );

    const intel = read("apps/web/app/(platform)/intelligence/pricing/page.tsx");
    record(
      "intelligence",
      "Intelligence Pricing is cross-corpus (not pursuit force-out)",
      /Cross-corpus/.test(intel) && /Pursuit → Pricing/.test(intel),
    );

    const mig = read("supabase/migrations/20260820900000_phase7_pricing_intelligence.sql");
    record(
      "schema",
      "pricing_decisions + comparable judgments + internal_cost_rate",
      /pricing_decisions/.test(mig) &&
        /pricing_comparable_judgments/.test(mig) &&
        /internal_cost_rate/.test(mig) &&
        /HUMAN_APPROVED/.test(mig),
    );

    const created = await adm.auth.admin.createUser({
      email: `phase7-${stamp}@example.com`,
      password: "Phase7-Price!22",
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    users.push(created.data.user);
    const asA = await signIn(`phase7-${stamp}@example.com`, "Phase7-Price!22");
    const orgId = (await asA.rpc("create_organization_with_admin", { org_name: `P7 ${stamp}` })).data;
    orgIds.push(orgId);

    const { data: opp } = await asA
      .from("opportunities")
      .insert({ organization_id: orgId, title: `P7 pricing ${stamp}`, stage: "PRICING" })
      .select("id")
      .single();

    const sha = createHash("sha256").update(`p7-${stamp}-${randomUUID()}`).digest("hex");
    const { data: document } = await asA
      .from("documents")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        original_filename: "rates.pdf",
        document_type: "proposal",
        commercial_truth: "proposed",
        mime_type: "application/pdf",
      })
      .select("id")
      .single();
    const { data: version } = await asA
      .from("document_versions")
      .insert({
        organization_id: orgId,
        document_id: document.id,
        sha256: sha,
        storage_path: `${orgId}/${document.id}/v/${sha}/original.pdf`,
      })
      .select("id")
      .single();
    const { data: run } = await asA
      .from("extraction_runs")
      .insert({ organization_id: orgId, document_version_id: version.id })
      .select("id")
      .single();
    const { data: fact } = await asA
      .from("extracted_facts")
      .insert({
        organization_id: orgId,
        extraction_run_id: run.id,
        document_id: document.id,
        document_version_id: version.id,
        entity: "pricing",
        field: "proposed_rate",
        raw_value: "32.50",
        normalized_value: "32.50",
        verified_value: "32.50",
        verification_status: "HUMAN_VERIFIED",
        verified_by: created.data.user.id,
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const { data: line, error: lineErr } = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        labor_category: "Armed officer",
        rate_type: "standard",
        site_or_post: "Main gate",
        unit: "hour",
        proposed_rate: 32.5,
        proposed_source_fact_id: fact.id,
        internal_cost_rate: 24.0,
      })
      .select("id, internal_cost_rate, proposed_rate")
      .single();
    record(
      "truths",
      "Five truths: internal cost distinct from submitted",
      !lineErr && line?.internal_cost_rate === 24 && line?.proposed_rate === 32.5,
      JSON.stringify(line ?? lineErr),
    );

    const { data: peerOpp } = await asA
      .from("opportunities")
      .insert({ organization_id: orgId, title: `P7 peer ${stamp}`, stage: "CLOSED" })
      .select("id")
      .single();
    const { data: peerLine } = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgId,
        opportunity_id: peerOpp.id,
        labor_category: "Armed officer",
        proposed_rate: 30,
        awarded_rate: 29,
      })
      .select("id")
      .single();

    const { error: judgeErr } = await asA.from("pricing_comparable_judgments").insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      source_pricing_line_id: peerLine.id,
      included: false,
      reason: "Different building class — exclude",
      created_by: created.data.user.id,
    });
    record("comps", "Comparable exclude with reason persists", !judgeErr, judgeErr?.message ?? "ok");

    const { data: draft, error: draftErr } = await asA
      .from("pricing_decisions")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        final_bid_rate: 31,
        status: "DRAFT",
        confidence: "low",
        data_sufficiency: "n=1",
      })
      .select("id, status")
      .single();
    record("decision", "Draft pricing decision allowed without actor", !draftErr && draft?.status === "DRAFT", JSON.stringify(draft ?? draftErr));

    const { error: badApprove } = await asA.from("pricing_decisions").insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      status: "HUMAN_APPROVED",
      final_bid_rate: 31,
    });
    record(
      "decision",
      "HUMAN_APPROVED without decided_by is rejected",
      Boolean(badApprove),
      badApprove?.message ?? "unexpected success",
    );

    const { data: approved, error: okApprove } = await asA
      .from("pricing_decisions")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        final_bid_rate: 31.25,
        status: "HUMAN_APPROVED",
        decided_by: created.data.user.id,
        rationale: "Above cost floor; competitive vs comps",
      })
      .select("id, status, decided_by")
      .single();
    record(
      "decision",
      "Human-approved final bid requires actor",
      !okApprove && approved?.status === "HUMAN_APPROVED" && approved?.decided_by === created.data.user.id,
      JSON.stringify(approved ?? okApprove),
    );

    const costSrc = read("apps/web/components/opportunity-workspace/pricing-workbench.tsx");
    record(
      "cost",
      "Cost model includes H&W / vehicles / travel / wage determination",
      /health_welfare/.test(costSrc) && /vehicles/.test(costSrc) && /travel/.test(costSrc) && /wage_determination/.test(costSrc),
    );
  } catch (e) {
    record("fatal", "suite error", false, e instanceof Error ? e.message : String(e));
  } finally {
    const a = admin();
    for (const orgId of orgIds) await a.from("organizations").delete().eq("id", orgId);
    for (const u of users) await a.auth.admin.deleteUser(u.id);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    for (const f of failed) console.error(`  FAIL [${f.area}] ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();
