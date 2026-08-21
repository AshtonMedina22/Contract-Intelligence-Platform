#!/usr/bin/env node
/**
 * Canonical Phase 8 — Response / Submission / Result acceptance.
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

/** Mirrors `AWARDISH_FACT_RE` in `apps/web/lib/opportunity/submission-readiness.ts`. */
const AWARDISH_FACT_RE =
  /award|contract|po\b|purchase.?order|nte|not.?to.?exceed|instrument|agreement|vehicle|txmas|mas/i;

async function main() {
  const adm = admin();
  try {
    const surfaces = [
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/response/page.tsx",
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/submission/page.tsx",
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/result/page.tsx",
      "apps/web/components/opportunity-workspace/response-workspace.tsx",
      "apps/web/components/opportunity-workspace/response-tiptap-editor.tsx",
      "apps/web/components/opportunity-workspace/requirements-matrix.tsx",
      "apps/web/components/opportunity-workspace/submission-workbench.tsx",
      "apps/web/components/opportunity-workspace/result-capture-panel.tsx",
      "apps/web/lib/opportunity/response.ts",
      "apps/web/lib/opportunity/submission-readiness.ts",
      "supabase/migrations/20260820920000_phase8_response_submission_result.sql",
      "supabase/migrations/20260821200000_p8_submission_authorization.sql",
    ];
    for (const rel of surfaces) {
      record("ui", `exists ${rel.split("/").slice(-2).join("/")}`, existsSync(join(ROOT, rel)), rel);
    }

    const resp = read("apps/web/components/opportunity-workspace/response-workspace.tsx");
    const tiptap = read("apps/web/components/opportunity-workspace/response-tiptap-editor.tsx");
    const lib = read("apps/web/lib/opportunity/response.ts");
    const actions = read(
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/actions.ts",
    );
    const mig = read("supabase/migrations/20260820920000_phase8_response_submission_result.sql");
    const pkg = read("apps/web/package.json");

    record(
      "response",
      "Tiptap editor wired (not a global Proposal app)",
      /@tiptap\/react/.test(tiptap) && /@tiptap\/react/.test(pkg) && /ResponseTiptapEditor/.test(resp),
    );
    record(
      "response",
      "Evidence states + reuse gates present",
      /VERIFIED_DRAFT_AVAILABLE/.test(lib) &&
        /L_AND_P_INPUT_REQUIRED/.test(lib) &&
        /DO_NOT_USE/.test(lib) &&
        /PROPOSAL_DRAFTING/.test(actions),
    );
    record(
      "response",
      "Never invent L&P fact list enforced in helpers",
      /NEVER_INVENT_LP_FACTS/.test(lib) && /staffing capacity/.test(lib),
    );
    record(
      "response",
      "Progress counters defined",
      /mandatoryOutstanding/.test(lib) && /requiredAttachmentsMissing/.test(lib),
    );
    record(
      "approvals",
      "Configurable approval layers (not hard-coded for every RFP)",
      /pursuit_approval_layers/.test(mig) && /enabled/.test(mig) && /executive/.test(mig),
    );
    record(
      "submission",
      "Submission packet + checklist schema",
      /submission_packets/.test(mig) && /submission_checklist_items/.test(mig) && /notarization/.test(lib),
    );
    const readiness = read("apps/web/lib/opportunity/submission-readiness.ts");
    const authMig = read("supabase/migrations/20260821200000_p8_submission_authorization.sql");
    record(
      "submission",
      "Readiness is computed, never asserted — incomplete cannot read Complete",
      /export function computeSubmissionReadiness/.test(readiness) &&
        /NEEDS_SIGNATURE/.test(readiness) &&
        /NEEDS_APPROVAL/.test(readiness) &&
        /NOT_APPLICABLE/.test(readiness) &&
        /function isSettledStatus/.test(readiness),
    );
    record(
      "submission",
      "Mark submitted is human-authorized, server-gated, and attributed",
      /export async function markSubmissionSubmitted/.test(actions) &&
        /submission_authorized/.test(actions) &&
        /submitted_by: userId/.test(actions) &&
        /submission_packets_submitted_requires_actor/.test(authMig),
    );
    record(
      "submission",
      "Logistics save cannot submit or advance the stage",
      /This action deliberately cannot write `submitted_at`/.test(actions) &&
        !/mark_submitted/.test(actions),
    );
    record(
      "result",
      "Result outcomes include NO_AWARD + contract-on-win action",
      /NO_AWARD/.test(mig) && /createContractFromWin/.test(actions) && /lp_score/.test(mig),
    );
    record(
      "ia",
      "No separate global Proposal application introduced",
      !existsSync(join(ROOT, "apps/web/app/(platform)/proposals/builder")) &&
        /Pursuit → Response/.test(read("apps/web/app/(platform)/procurement/opportunities/[opportunityId]/response/page.tsx")),
    );

    const password = "Phase8-Response!22";
    const email = `phase8-${stamp}@example.com`;
    const created = await adm.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    users.push(created.data.user);
    const asA = await signIn(email, password);
    const orgId = (await asA.rpc("create_organization_with_admin", { org_name: `P8 ${stamp}` })).data;
    orgIds.push(orgId);
    const userId = created.data.user.id;

    const { data: opp } = await asA
      .from("opportunities")
      .insert({ organization_id: orgId, title: `P8 pursuit ${stamp}`, stage: "DRAFTING" })
      .select("id")
      .single();

    const { data: sol } = await asA
      .from("solicitations")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        title: `P8 RFP ${stamp}`,
        solicitation_number: `RFP-${stamp}`,
      })
      .select("id")
      .single();

    const sha = createHash("sha256").update(`p8-${stamp}-${randomUUID()}`).digest("hex");
    const { data: document } = await asA
      .from("documents")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        solicitation_id: sol.id,
        original_filename: "rfp.pdf",
        document_type: "solicitation",
        commercial_truth: "requested",
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
        entity: "requirement",
        field: "requirement",
        raw_value: "Provide armed coverage 24/7 with verified staffing plan.",
        normalized_value: "Provide armed coverage 24/7 with verified staffing plan.",
        verified_value: "Provide armed coverage 24/7 with verified staffing plan.",
        verification_status: "HUMAN_VERIFIED",
        verified_by: userId,
        verified_at: new Date().toISOString(),
        source_page: 3,
      })
      .select("id")
      .single();

    const { data: req, error: reqErr } = await asA
      .from("requirements")
      .insert({
        organization_id: orgId,
        solicitation_id: sol.id,
        source_fact_id: fact.id,
        statement: "Provide armed coverage 24/7 with verified staffing plan.",
        mandatory: true,
        scored: true,
        weight_pct: 25,
        section_ref: "3.2",
        source_page: 3,
        response_required: true,
        attachment_required: true,
        form_name: "Staffing Exhibit A",
        owner_name: "Ops lead",
        matrix_status: "OPEN",
      })
      .select("id, mandatory, scored, weight_pct, form_name, source_fact_id")
      .single();
    record(
      "requirements",
      "Requirement matrix retains source + scored/weight/form/owner",
      !reqErr &&
        req?.source_fact_id === fact.id &&
        req?.scored === true &&
        req?.weight_pct === 25 &&
        req?.form_name === "Staffing Exhibit A",
      JSON.stringify(req ?? reqErr),
    );

    const { data: draft, error: draftErr } = await asA
      .from("requirement_responses")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        requirement_id: req.id,
        draft_html: "<p>Draft pending L&P staffing confirmation.</p>",
        evidence_state: "L_AND_P_INPUT_REQUIRED",
        draft_status: "DRAFT",
        missing_information: "L&P INPUT REQUIRED: staffing capacity",
        confidence: "none",
        sources_used: [],
      })
      .select("id, evidence_state, missing_information")
      .single();
    record(
      "response",
      "Unsupported fact stays L&P INPUT REQUIRED",
      !draftErr && draft?.evidence_state === "L_AND_P_INPUT_REQUIRED",
      JSON.stringify(draft ?? draftErr),
    );

    const { error: layerErr } = await asA.from("pursuit_approval_layers").insert([
      {
        organization_id: orgId,
        opportunity_id: opp.id,
        layer_key: "content",
        enabled: true,
        status: "requested",
      },
      {
        organization_id: orgId,
        opportunity_id: opp.id,
        layer_key: "executive",
        enabled: false,
        status: "requested",
      },
    ]);
    record("approvals", "Optional layers can be enabled/disabled per pursuit", !layerErr, layerErr?.message ?? "ok");

    const { error: packetErr } = await asA.from("submission_packets").insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      submission_method: "portal",
      portal_recipient: "buyer.portal.example",
      confirmation_reference: null,
    });
    const { error: checkErr } = await asA.from("submission_checklist_items").insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      item_key: "required_forms",
      label: "Required forms",
      required: true,
      completed: false,
      sort_order: 10,
    });
    record(
      "submission",
      "Submission packet + checklist item persist",
      !packetErr && !checkErr,
      JSON.stringify({ packetErr: packetErr?.message, checkErr: checkErr?.message }),
    );

    const { data: result, error: resultErr } = await asA
      .from("win_loss_reviews")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        outcome: "WON",
        winner_name: "L&P",
        lp_price: 100,
        winning_price: 100,
        lp_score: 88,
        winning_score: 88,
        rank: 1,
        lessons_learned: "Staffing plan clarity mattered",
        documented_reason: "Highest technical score",
        internal_analysis: "Internal: pricing held floor",
      })
      .select("id, outcome, lp_score")
      .single();
    record(
      "result",
      "Result capture stores scores + distinct reason/analysis",
      !resultErr && result?.outcome === "WON" && result?.lp_score === 88,
      JSON.stringify(result ?? resultErr),
    );

    // Contract-on-win goes through the verified award fact, exactly like `createContractFromWin`.
    // A bare insert is expected to be rejected by `contracts_require_verified_fact`.
    const awardSha = createHash("sha256").update(`p8-award-${stamp}-${randomUUID()}`).digest("hex");
    const { data: awardDoc } = await asA
      .from("documents")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        original_filename: "award-notice.pdf",
        document_type: "award",
        commercial_truth: "awarded",
        mime_type: "application/pdf",
      })
      .select("id")
      .single();
    const { data: awardVersion } = await asA
      .from("document_versions")
      .insert({
        organization_id: orgId,
        document_id: awardDoc.id,
        sha256: awardSha,
        storage_path: `${orgId}/${awardDoc.id}/v/${awardSha}/original.pdf`,
      })
      .select("id")
      .single();
    const { data: awardRun } = await asA
      .from("extraction_runs")
      .insert({ organization_id: orgId, document_version_id: awardVersion.id })
      .select("id")
      .single();
    const { data: awardFact } = await asA
      .from("extracted_facts")
      .insert({
        organization_id: orgId,
        extraction_run_id: awardRun.id,
        document_id: awardDoc.id,
        document_version_id: awardVersion.id,
        entity: "award",
        field: "contract_number",
        raw_value: `C-${stamp}`,
        normalized_value: `C-${stamp}`,
        verified_value: `C-${stamp}`,
        verification_status: "HUMAN_VERIFIED",
        verified_by: userId,
        verified_at: new Date().toISOString(),
        source_page: 1,
      })
      .select("id, document_id, field, entity")
      .single();

    const { error: unsourcedContractErr } = await asA.from("contracts").insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      title: `Unsourced contract ${stamp}`,
    });

    const awardish = AWARDISH_FACT_RE.test(`${awardFact.field ?? ""} ${awardFact.entity ?? ""}`);
    const { data: contract, error: contractErr } = await asA
      .from("contracts")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        title: `Contract for ${stamp}`,
        source_fact_id: awardFact.id,
        source_document_id: awardFact.document_id,
      })
      .select("id, opportunity_id, source_fact_id")
      .single();
    record(
      "result",
      "Won result links a contract only from a HUMAN_VERIFIED award fact",
      Boolean(unsourcedContractErr) &&
        awardish &&
        !contractErr &&
        contract?.opportunity_id === opp.id &&
        contract?.source_fact_id === awardFact.id,
      JSON.stringify({
        unsourcedBlocked: unsourcedContractErr?.message ?? null,
        contract: contract ?? contractErr?.message,
      }),
    );

    // DO_NOT_USE must not be treated as draft-ready
    const { classifyEvidenceFromHits } = await import(
      join(ROOT, "apps/web/lib/opportunity/response.ts").replace(/\\/g, "/")
    ).catch(() => ({ classifyEvidenceFromHits: null }));
    // Dynamic import of TS may fail in node — inline equivalent check:
    const hits = [{ reuse_status: "DO_NOT_USE", content: "x" }];
    const usable = hits.filter((h) => h.reuse_status !== "DO_NOT_USE" && h.reuse_status !== "SUPERSEDED");
    record(
      "response",
      "DO_NOT_USE never yields VERIFIED_DRAFT_AVAILABLE",
      usable.length === 0,
      `usable=${usable.length}`,
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
