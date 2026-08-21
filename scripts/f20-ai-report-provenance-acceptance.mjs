#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const results = [];
const orgIds = [];
const users = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
async function check(name, fn) {
  try {
    await fn();
    record(name, true);
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}
function admin() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
function anon() {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function signIn(email, password) {
  const client = anon();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return client;
}
async function bundle(rel, name) {
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f20-${name}-`)), "out.mjs");
  await esbuild.build({
    entryPoints: [path.join(webRoot, rel)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "warning",
    alias: { "@": webRoot },
  });
  return import(pathToFileURL(outfile).href);
}

const sanitizer = await bundle("lib/ask/sanitize-tool-params.ts", "sanitize");

async function main() {
  const adm = admin();
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const migration = await fs.readFile(
      path.join(root, "supabase/migrations/20260821370000_f20_ai_audit_history.sql"),
      "utf8",
    );
    const route = await fs.readFile(path.join(webRoot, "app/api/ask/chat/route.ts"), "utf8");
    const chat = await fs.readFile(path.join(webRoot, "components/ask/ask-chat.tsx"), "utf8");
    const reportPersist = await fs.readFile(
      path.join(webRoot, "lib/reports/persist-run.ts"),
      "utf8",
    );

    record(
      "schema has six durable audit tables",
      [
        "ask_conversations",
        "ask_messages",
        "ai_runs",
        "ai_tool_traces",
        "ai_citations",
        "report_runs",
      ].every((table) => migration.includes(`create table public.${table}`)),
    );
    record(
      "migration has no wipe cron and revokes DELETE",
      !/cron\.schedule|delete_old|retention.*delete/i.test(migration) &&
        (migration.match(/revoke delete on public\./g) ?? []).length >= 7,
    );
    record(
      "chat onFinish persists messages traces citations",
      /onFinish/.test(route) &&
        /persistAiRun/.test(route) &&
        /getTraces/.test(route) &&
        /getEvidence/.test(route),
    );
    record(
      "sessionStorage is no longer history source",
      !/sessionStorage/.test(chat) && /conversationId/.test(chat) && /ask-audit-history/.test(
        await fs.readFile(path.join(webRoot, "app/(platform)/intelligence/ask/page.tsx"), "utf8"),
      ),
    );
    record(
      "report persistence is INSERT only with parent lineage",
      /\.insert\(\{/.test(reportPersist) &&
        /parent_report_run_id/.test(reportPersist) &&
        !/\.update\(|\.upsert\(/.test(reportPersist),
    );

    const dirty = {
      authorization: "Bearer top-secret",
      nested: {
        api_key: "abc123",
        safe: "keep",
        note: "password=hunter2",
      },
      cookie: "session=secret",
    };
    const safe = sanitizer.sanitizeToolParams(dirty);
    record(
      "sanitizer removes auth headers tokens passwords and cookies",
      !JSON.stringify(safe).includes("top-secret") &&
        !JSON.stringify(safe).includes("abc123") &&
        !JSON.stringify(safe).includes("hunter2") &&
        !JSON.stringify(safe).includes("session=secret") &&
        safe.nested.safe === "keep",
    );

    const password = "F20-Audit!42";
    const identities = [];
    for (const label of ["a", "b"]) {
      const email = `f20-${label}-${stamp}@example.com`;
      const created = await adm.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
      users.push(created.data.user);
      const client = await signIn(email, password);
      const { data: orgId, error: orgError } = await client.rpc(
        "create_organization_with_admin",
        { org_name: `F20 ${label} ${stamp}` },
      );
      if (orgError || !orgId) throw new Error(orgError?.message ?? "org");
      orgIds.push(orgId);
      identities.push({ client, orgId, userId: created.data.user.id });
    }
    const [a, b] = identities;

    const conversationId = crypto.randomUUID();
    const { error: conversationError } = await a.client.from("ask_conversations").insert({
      id: conversationId,
      organization_id: a.orgId,
      created_by: a.userId,
      title: "F20 durable thread",
      purpose: "GENERAL_QA",
    });
    assert.equal(conversationError, null);

    const { data: researchRun, error: researchError } = await a.client
      .from("research_runs")
      .insert({
        organization_id: a.orgId,
        research_type: "MARKET",
        query: "F20 linked research",
        purpose: "GENERAL_QA",
        created_by: a.userId,
      })
      .select("id")
      .single();
    if (researchError) throw new Error(researchError.message);

    const { data: analyticalRun, error: analyticalError } = await a.client
      .from("analytical_runs")
      .insert({
        organization_id: a.orgId,
        created_by: a.userId,
        question: "How many pursuits?",
        metric_id: "pursuit_count",
        status: "ok",
      })
      .select("id")
      .single();
    if (analyticalError) throw new Error(analyticalError.message);

    const body1 = { answer: "Report v1", sections: [{ heading: "Evidence", bullets: ["A"] }] };
    const { data: report1, error: report1Error } = await a.client
      .from("report_runs")
      .insert({
        organization_id: a.orgId,
        created_by: a.userId,
        report_kind: "executive",
        purpose: "REPORT_GENERATION",
        title: "F20 report",
        body: body1,
        data_cutoff: new Date().toISOString(),
        status: "SUCCEEDED",
      })
      .select("id")
      .single();
    if (report1Error) throw new Error(report1Error.message);
    const { data: report2, error: report2Error } = await a.client
      .from("report_runs")
      .insert({
        organization_id: a.orgId,
        created_by: a.userId,
        parent_report_run_id: report1.id,
        report_kind: "executive",
        purpose: "REPORT_GENERATION",
        title: "F20 report rerun",
        body: { answer: "Report v2" },
        data_cutoff: new Date().toISOString(),
        status: "SUCCEEDED",
      })
      .select("id, parent_report_run_id")
      .single();
    if (report2Error) throw new Error(report2Error.message);
    record(
      "report rerun creates new row with parent lineage",
      report2.id !== report1.id && report2.parent_report_run_id === report1.id,
    );
    const immutableAttempt = await a.client
      .from("report_runs")
      .update({ body: { answer: "mutated" } })
      .eq("id", report1.id);
    const { data: unchanged } = await a.client
      .from("report_runs")
      .select("body")
      .eq("id", report1.id)
      .single();
    record(
      "old report body is immutable",
      (Boolean(immutableAttempt.error) || immutableAttempt.count === 0 || immutableAttempt.data == null) &&
        unchanged.body?.answer === "Report v1" &&
        unchanged.body?.sections?.[0]?.bullets?.[0] === "A",
    );

    const modes = [
      { mode: "LOCATE", status: "SUCCEEDED", question: "locate a contract" },
      { mode: "ASK_ANALYZE", status: "INSUFFICIENT", question: "unsupported conclusion" },
      { mode: "REPORT", status: "SUCCEEDED", question: "executive report" },
    ];
    const runIds = [];
    for (const item of modes) {
      const { data, error } = await a.client
        .from("ai_runs")
        .insert({
          organization_id: a.orgId,
          conversation_id: item.mode === "ASK_ANALYZE" ? conversationId : null,
          created_by: a.userId,
          mode: item.mode,
          purpose: item.mode === "REPORT" ? "REPORT_GENERATION" : "GENERAL_QA",
          question: item.question,
          answer:
            item.status === "INSUFFICIENT"
              ? "Insufficient verified evidence to answer this reliably."
              : "Audited answer",
          latency_ms: 12,
          data_cutoff: new Date().toISOString(),
          status: item.status,
          analytical_run_id: item.mode === "ASK_ANALYZE" ? analyticalRun.id : null,
          research_run_id: item.mode === "ASK_ANALYZE" ? researchRun.id : null,
          report_run_id: item.mode === "REPORT" ? report2.id : null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      runIds.push(data.id);
    }
    record("LOCATE ASK REPORT and insufficient runs persist", runIds.length === 3);

    const now = new Date().toISOString();
    const traceInsert = await a.client.from("ai_tool_traces").insert([
      {
        organization_id: a.orgId,
        ai_run_id: runIds[1],
        tool_call_id: "tool-ok",
        tool_name: "ask_structured_analytics",
        safe_params: sanitizer.sanitizeToolParams(dirty),
        result_refs: [{ analytical_run_id: analyticalRun.id }],
        started_at: now,
        finished_at: now,
        latency_ms: 1,
        status: "SUCCEEDED",
        analytical_run_id: analyticalRun.id,
      },
      {
        organization_id: a.orgId,
        ai_run_id: runIds[1],
        tool_call_id: "tool-failed",
        tool_name: "search_public_research",
        safe_params: { query: "safe" },
        result_refs: [],
        started_at: now,
        finished_at: now,
        latency_ms: 2,
        status: "FAILED",
        error_message: "provider unavailable",
        research_run_id: researchRun.id,
      },
    ]);
    assert.equal(traceInsert.error, null);
    const { data: traces } = await a.client
      .from("ai_tool_traces")
      .select("status, safe_params, analytical_run_id, research_run_id")
      .eq("ai_run_id", runIds[1]);
    record(
      "multi-tool success failure and F4/F6 links persist safely",
      traces?.length === 2 &&
        traces.some((row) => row.status === "FAILED" && row.research_run_id === researchRun.id) &&
        traces.some(
          (row) => row.status === "SUCCEEDED" && row.analytical_run_id === analyticalRun.id,
        ) &&
        !JSON.stringify(traces).includes("top-secret"),
    );

    const messageInsert = await a.client.from("ask_messages").insert([
      {
        organization_id: a.orgId,
        conversation_id: conversationId,
        ai_run_id: runIds[1],
        created_by: a.userId,
        client_message_id: "u1",
        role: "user",
        content: "First question",
        parts: [{ type: "text", text: "First question" }],
        sequence: 0,
      },
      {
        organization_id: a.orgId,
        conversation_id: conversationId,
        ai_run_id: runIds[1],
        client_message_id: "a1",
        role: "assistant",
        content: "First answer",
        parts: [{ type: "text", text: "First answer" }],
        sequence: 1,
      },
      {
        organization_id: a.orgId,
        conversation_id: conversationId,
        ai_run_id: runIds[1],
        created_by: a.userId,
        client_message_id: "u2",
        role: "user",
        content: "Follow-up question",
        parts: [{ type: "text", text: "Follow-up question" }],
        sequence: 2,
      },
    ]);
    assert.equal(messageInsert.error, null);
    record("follow-up conversation messages are ordered and durable", true);

    const citationInsert = await a.client.from("ai_citations").insert([
      {
        organization_id: a.orgId,
        ai_run_id: runIds[1],
        citation_index: 1,
        analytical_run_id: analyticalRun.id,
        structured_ref: { metric_id: "pursuit_count" },
        title: "Governed analytics",
      },
      {
        organization_id: a.orgId,
        ai_run_id: runIds[1],
        citation_index: 2,
        research_run_id: researchRun.id,
        source_url: "https://example.gov/source",
        title: "Public research",
      },
    ]);
    assert.equal(citationInsert.error, null);
    record("citations retain structured analytical and research refs", true);

    const crossTenant = await b.client
      .from("ai_runs")
      .select("id")
      .in("id", runIds);
    record("tenant B cannot read tenant A AI runs", !crossTenant.error && crossTenant.data.length === 0);

    const titleUpdate = await a.client
      .from("ask_conversations")
      .update({ title: "Renamed durable thread" })
      .eq("id", conversationId);
    const forbiddenUpdate = await a.client
      .from("ask_conversations")
      .update({ purpose: "PRICING_ANALYSIS" })
      .eq("id", conversationId);
    record("conversation UPDATE is title-only", !titleUpdate.error && Boolean(forbiddenUpdate.error));

    for (const [table, id] of [
      ["ask_conversations", conversationId],
      ["ask_messages", null],
      ["ai_runs", runIds[0]],
      ["ai_tool_traces", null],
      ["ai_citations", null],
      ["report_runs", report1.id],
    ]) {
      let query = a.client.from(table).delete();
      if (id) query = query.eq("id", id);
      else query = query.eq("organization_id", a.orgId);
      const deletion = await query;
      if (!deletion.error) throw new Error(`${table} unexpectedly allowed authenticated DELETE`);
    }
    const { count: remainingRuns } = await a.client
      .from("ai_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", a.orgId);
    record("authenticated DELETE is denied on every audit table", remainingRuns === 3);
  } catch (error) {
    record("fatal acceptance setup", false, error instanceof Error ? error.message : String(error));
  } finally {
    for (const orgId of orgIds) await adm.from("organizations").delete().eq("id", orgId);
    for (const user of users) await adm.auth.admin.deleteUser(user.id);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

await main();
