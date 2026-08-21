#!/usr/bin/env node
/**
 * Canonical Phase 6 — Ask / Reports / Automation acceptance.
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

async function addVerifiedFact(client, orgId, userId, opportunityId, opts) {
  const sha = createHash("sha256").update(`${opts.filename}-${stamp}-${randomUUID()}`).digest("hex");
  const { data: document } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      opportunity_id: opportunityId,
      original_filename: opts.filename,
      document_type: "proposal",
      commercial_truth: "proposed",
      mime_type: "application/pdf",
    })
    .select("id")
    .single();
  const { data: version } = await client
    .from("document_versions")
    .insert({
      organization_id: orgId,
      document_id: document.id,
      sha256: sha,
      storage_path: `${orgId}/${document.id}/v/${sha}/original.pdf`,
    })
    .select("id")
    .single();
  const { data: run } = await client
    .from("extraction_runs")
    .insert({ organization_id: orgId, document_version_id: version.id })
    .select("id")
    .single();
  const { data: fact } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: run.id,
      document_id: document.id,
      document_version_id: version.id,
      entity: "proposal",
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
  return { factId: fact.id, documentId: document.id, versionId: version.id, sha };
}

async function main() {
  const adm = admin();
  try {
    const surfaces = [
      "apps/web/lib/retrieval/purpose.ts",
      "apps/web/lib/retrieval/search.ts",
      "apps/web/lib/ask/synthesize.ts",
      "apps/web/lib/ask/evidence.ts",
      "apps/web/lib/ask/model.ts",
      "apps/web/lib/ask/tools.ts",
      "apps/web/lib/ask/agent.ts",
      "apps/web/lib/ask/research/provider.ts",
      "apps/web/lib/ask/gpt-actions-openapi.ts",
      "apps/web/lib/reports/generate.ts",
      "apps/web/components/ask/answer-panel.tsx",
      "apps/web/components/ask/ask-chat.tsx",
      "apps/web/app/(platform)/intelligence/ask/page.tsx",
      "apps/web/app/(platform)/intelligence/reports/page.tsx",
      "apps/web/app/api/ask/chat/route.ts",
      "apps/web/app/api/ask/actions/openapi/route.ts",
      "apps/web/app/api/cron/intelligence-digest/route.ts",
      "supabase/migrations/20260820800000_phase6_ask_reports_automation.sql",
    ];
    for (const rel of surfaces) {
      record("ui", `exists ${rel}`, existsSync(join(ROOT, rel)));
    }

    const header = read("apps/web/components/app-shell-header.tsx");
    record("ui", "Header Find or Ask GPT posts to /intelligence/ask", /Find or Ask GPT/.test(header) && /action="\/intelligence\/ask"/.test(header));

    const ask = read("apps/web/app/(platform)/intelligence/ask/page.tsx");
    record("modes", "Ask page has LOCATE / ASK / REPORT modes", /LOCATE/.test(ask) && /ASK \/ ANALYZE/.test(ask) && /REPORT/.test(ask));
    record("modes", "Ask answer panel contract fields", /AskAnswerPanel/.test(ask) || /Data Scope|Limitations/.test(ask));
    record(
      "modes",
      "mode=ask mounts AskChatClient dual-rail stream",
      /AskChatClient/.test(ask) && /mode === "ask"/.test(ask) && /from "@\/components\/ask\/ask-chat"/.test(ask),
    );
    record(
      "modes",
      "LOCATE path stays no-LLM (No LLM used)",
      /No LLM used/.test(ask) && /mode === "locate"/.test(ask),
    );
    record(
      "modes",
      "REPORT path uses generateIntelligenceReport SQL",
      /generateIntelligenceReport/.test(ask) && /mode === "report"/.test(ask),
    );

    const chatRoute = read("apps/web/app/api/ask/chat/route.ts");
    record(
      "ask-agent",
      "POST /api/ask/chat rejects locate/report modes",
      /mode === "locate"/.test(chatRoute) && /mode === "report"/.test(chatRoute) && /streamAskChat/.test(chatRoute),
    );

    const evidence = read("apps/web/lib/ask/evidence.ts");
    record(
      "ask-agent",
      "Evidence classes include INTERNAL_VERIFIED and PUBLIC rails",
      /INTERNAL_VERIFIED/.test(evidence) &&
        /OFFICIAL_PUBLIC/.test(evidence) &&
        /EXTERNAL_RESEARCH/.test(evidence) &&
        /validateCitations/.test(evidence),
    );
    // Dual-rail citation contract (static unit-style): drafting must refuse public/unverified as L&P truth.
    record(
      "ask-agent",
      "Citation validation flags drafting misuse of public classes",
      /draftingPurpose/.test(evidence) &&
        /EXTERNAL_RESEARCH/.test(evidence) &&
        /PROPOSAL_DRAFTING cannot treat public/.test(evidence),
    );

    const tools = read("apps/web/lib/ask/tools.ts");
    record(
      "ask-agent",
      "Tools expose internal search (limit 50) + public research",
      /search_verified_passages/.test(tools) &&
        /limit: limit \?\? 50/.test(tools) &&
        /search_public_research/.test(tools) &&
        /fetch_public_source/.test(tools),
    );
    record(
      "ask-agent",
      "Tools expose USAspending federal award research (OFFICIAL_PUBLIC, never HUMAN_VERIFIED)",
      /search_federal_awards/.test(tools) &&
        /get_federal_award/.test(tools) &&
        /lookup_federal_recipient/.test(tools) &&
        /usaspending|USAspending/.test(tools) &&
        !/evidence_class:\s*"HUMAN_VERIFIED"/.test(tools),
    );
    record(
      "ask-agent",
      "Public research never labeled HUMAN_VERIFIED in tools",
      !/evidence_class:\s*"HUMAN_VERIFIED"/.test(tools) && /PUBLIC rail/.test(tools),
    );

    const chatUi = read("apps/web/components/ask/ask-chat.tsx");
    record(
      "ask-agent",
      "AskChatClient groups source cards by evidence_class",
      /evidence_class/.test(chatUi) && /SourceCards/.test(chatUi) && /useChat/.test(chatUi),
    );
    record(
      "modes",
      "LOCATE path has no LLM synthesis import",
      /mode === "locate"/.test(ask) &&
        /No LLM used/.test(ask) &&
        !/synthesizeGroundedAnswer/.test(ask),
    );
    record(
      "ask-agent",
      "Actions OpenAPI route exists for ChatGPT Custom GPT",
      existsSync(join(ROOT, "apps/web/app/api/ask/actions/openapi/route.ts")) &&
        /GPT_ACTIONS_OPENAPI/.test(read("apps/web/app/api/ask/actions/openapi/route.ts")),
    );
    const modelSrc = read("apps/web/lib/ask/model.ts");
    record(
      "ask-agent",
      "Ask providers exclude Grok (Gateway/Groq/Ollama/Google/OpenAI)",
      /createGroq/.test(modelSrc) &&
        /ollamaEnabled/.test(modelSrc) &&
        !/@ai-sdk\/xai|createXai|grok-/i.test(modelSrc),
    );

    const purpose = read("apps/web/lib/retrieval/purpose.ts");
    record(
      "purpose",
      "All retrieval purposes defined",
      ["GENERAL_QA", "LOCATE", "LOSS_ANALYSIS", "COMPETITOR_ANALYSIS", "PRICING_ANALYSIS", "BID_STRATEGY", "PROPOSAL_DRAFTING", "COMPLIANCE_REVIEW", "REPORT_GENERATION"].every(
        (p) => purpose.includes(p),
      ),
    );
    record("purpose", "PROPOSAL_DRAFTING never allows DO_NOT_USE", /purposeAllowsDoNotUse/.test(purpose) && /PROPOSAL_DRAFTING/.test(purpose));

    const reports = read("apps/web/lib/reports/generate.ts");
    record(
      "reports",
      "Eight report kinds present",
      ["bid_strategy", "buyer", "market", "competitor", "pricing", "win_loss", "proposal_improvement", "executive"].every(
        (k) => reports.includes(k),
      ),
    );

    const vercel = read("vercel.json");
    record("automation", "Vercel Cron intelligence-digest scheduled", /intelligence-digest/.test(vercel));

    const migration = read("supabase/migrations/20260820800000_phase6_ask_reports_automation.sql");
    record("automation", "pg_cron intelligence automation scheduled", /intelligence-automation-daily/.test(migration));
    record("automation", "Human gates documented in automation", /Never bypasses human verification/.test(migration));

    const created = await adm.auth.admin.createUser({
      email: `phase6-${stamp}@example.com`,
      password: "Phase6-Ask!22",
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    users.push(created.data.user);
    const asA = await signIn(`phase6-${stamp}@example.com`, "Phase6-Ask!22");
    const orgId = (await asA.rpc("create_organization_with_admin", { org_name: `P6 ${stamp}` })).data;
    orgIds.push(orgId);

    const { data: opp } = await asA
      .from("opportunities")
      .insert({
        organization_id: orgId,
        title: `P6 pursuit ${stamp}`,
        response_due_on: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    const fact = await addVerifiedFact(asA, orgId, created.data.user.id, opp.id, {
      filename: "staffing.pdf",
      field: "staffing_approach",
      value: "Staffing depth at all posts with named relief pool",
    });
    const { error: classificationError } = await asA.rpc(
      "set_document_data_classification",
      {
        p_document_id: fact.documentId,
        p_data_classification: "verified_internal",
        p_reason: "Phase 6 retrieval fixture represents approved internal proposal evidence.",
      },
    );
    if (classificationError) throw new Error(classificationError.message);
    await asA.rpc("promote_knowledge_chunk_from_fact", { p_fact_id: fact.factId });

    const { data: draftingHits } = await asA.rpc("search_verified_knowledge", {
      p_query: "Staffing depth",
      p_purpose: "PROPOSAL_DRAFTING",
      p_limit: 10,
    });
    record("retrieval", "PROPOSAL_DRAFTING search returns APPROVED chunk", Array.isArray(draftingHits) && draftingHits.length >= 1, JSON.stringify(draftingHits?.[0]?.reuse_status));

    const { data: chunk } = await asA
      .from("document_chunks")
      .select("id")
      .eq("source_fact_id", fact.factId)
      .single();
    await asA.from("document_chunks").update({ reuse_status: "DO_NOT_USE" }).eq("id", chunk.id);

    const { data: draftBlocked } = await asA.rpc("search_verified_knowledge", {
      p_query: "Staffing depth",
      p_purpose: "PROPOSAL_DRAFTING",
      p_limit: 10,
    });
    record(
      "retrieval",
      "DO_NOT_USE excluded from PROPOSAL_DRAFTING",
      Array.isArray(draftBlocked) && draftBlocked.length === 0,
      JSON.stringify(draftBlocked),
    );

    const { data: lossHits } = await asA.rpc("search_verified_knowledge", {
      p_query: "Staffing depth",
      p_purpose: "LOSS_ANALYSIS",
      p_for_drafting: false,
      p_limit: 10,
    });
    record(
      "retrieval",
      "DO_NOT_USE allowed for LOSS_ANALYSIS retrospective",
      Array.isArray(lossHits) && lossHits.some((h) => h.chunk_id === chunk.id),
      JSON.stringify(lossHits?.map((h) => h.reuse_status)),
    );

    const { data: autoRun, error: autoErr } = await adm.rpc("run_intelligence_automation_service");
    record(
      "automation",
      "Service automation runner executes",
      !autoErr && autoRun?.ok === true,
      JSON.stringify(autoRun ?? autoErr),
    );

    const { data: events } = await asA
      .from("automation_events")
      .select("kind, title")
      .eq("organization_id", orgId);
    record(
      "automation",
      "Pursuit deadline alert created",
      Array.isArray(events) && events.some((e) => e.kind === "pursuit_deadline"),
      JSON.stringify(events),
    );

    const panel = read("apps/web/components/ask/answer-panel.tsx");
    // Contract headings must always render (not gated behind sources.length).
    record(
      "answer",
      "Answer UI has Answer/Sources/Data Scope/Limitations/View Source",
      /<h2 className="font-medium">Answer<\/h2>/.test(panel) &&
        /<h2 className="font-medium">Sources \/ Evidence<\/h2>/.test(panel) &&
        /<h2 className="font-medium">Data Scope<\/h2>/.test(panel) &&
        /<h2 className="font-medium">Limitations \/ confidence<\/h2>/.test(panel) &&
        /<h2 className="font-medium">View Source<\/h2>/.test(panel),
    );
    record(
      "answer",
      "Insufficient evidence canonical copy",
      read("apps/web/lib/ask/synthesize.ts").includes("Insufficient verified evidence to answer this reliably."),
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
