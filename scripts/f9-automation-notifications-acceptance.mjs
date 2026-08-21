#!/usr/bin/env node
/**
 * F9 acceptance — Operational Automation + Notification Delivery Engine.
 * Time-travel pure tests + migration/source greps. Extends existing scheduler only.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const webRoot = path.resolve(import.meta.dirname, "../apps/web");
const root = path.resolve(import.meta.dirname, "..");

async function bundle(entryRel, name) {
  const entry = path.join(webRoot, entryRel);
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f9-${name}-`)), "out.mjs");
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "warning",
    alias: { "@": webRoot },
    loader: { ".json": "json" },
  });
  return import(pathToFileURL(outfile).href);
}

async function readSource(...parts) {
  return fs.readFile(path.join(...parts), "utf8");
}

const kindsMod = await bundle("lib/automation/kinds.ts", "kinds");
const digestMod = await bundle("lib/automation/digest.ts", "digest");
const resolveMod = await bundle("lib/automation/resolve-policy.ts", "resolve");
const emailMod = await bundle("lib/automation/email-channel.ts", "email");

const {
  AUTOMATION_KINDS,
  HUMAN_GATE_BANS,
  isAutomationKind,
  LEGACY_APPROVAL_REMINDER_KIND,
} = kindsMod;

const { groupEventsForDigest, buildDailyDigestPayload, digestBucketCounts } = digestMod;
const { decideResolve, deadlineDedupeKey, shouldRekeyOnDeadlineChange } = resolveMod;
const { createEmailChannel } = emailMod;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

const migration = await readSource(root, "supabase/migrations/20260821270000_f9_automation_notifications.sql");
const digestRoute = await readSource(webRoot, "app/api/cron/intelligence-digest/route.ts");
const vercelJson = await readSource(root, "vercel.json");
const phase6Mig = await readSource(root, "supabase/migrations/20260820800000_phase6_ask_reports_automation.sql");
const catalogit = await readSource(root, "docs/reference-repos/catalogit.md");

// --- kinds / bans ---

check("all required automation kinds are catalogued", () => {
  const required = [
    "pursuit_deadline",
    "questions_deadline",
    "mandatory_conference",
    "prebid_deadline",
    "pricing_approval_pending",
    "response_approval_pending",
    "lp_input_required_outstanding",
    "mandatory_requirement_outstanding",
    "submission_checklist_incomplete",
    "submission_deadline",
    "verification_backlog",
    "processing_failure",
    "compliance_expiration",
    "contract_review_window",
    "renewal_notice",
    "rebid_planning",
    "option_decision",
    "research_refresh",
  ];
  for (const k of required) {
    assert.equal(isAutomationKind(k), true, k);
    assert.ok(AUTOMATION_KINDS.includes(k), k);
  }
  assert.equal(LEGACY_APPROVAL_REMINDER_KIND, "approval_reminder");
});

check("human-gate bans listed", () => {
  assert.deepEqual(
    [...HUMAN_GATE_BANS].sort(),
    [
      "approve_proposal",
      "exercise_option",
      "renew_contract",
      "select_final_price",
      "submit_bid",
      "verify_evidence",
    ].sort(),
  );
});

// --- digest time-travel ---

const TODAY = "2026-08-21";
const sampleEvents = [
  { kind: "pursuit_deadline", title: "Overdue", due_on: "2026-08-10", deep_link: "/a" },
  { kind: "pursuit_deadline", title: "Today", due_on: "2026-08-21", deep_link: "/b" },
  { kind: "questions_deadline", title: "In 3", due_on: "2026-08-24", deep_link: "/c" },
  { kind: "renewal_notice", title: "In 20", due_on: "2026-09-10", deep_link: "/d" },
  { kind: "verification_backlog", title: "No date", due_on: null, deep_link: "/e" },
  { kind: "rebid_planning", title: "Far", due_on: "2026-12-01", deep_link: "/f" },
];

check("digest buckets: overdue / today / next_7 / next_30", () => {
  const buckets = groupEventsForDigest(sampleEvents, TODAY);
  assert.equal(buckets.overdue.length, 1);
  assert.equal(buckets.today.length, 1);
  assert.equal(buckets.next_7.length, 1);
  assert.equal(buckets.next_30.length, 1);
  assert.equal(buckets.undated.length, 1);
  // Far (>30) omitted from urgency buckets
  assert.equal(
    buckets.overdue.length + buckets.today.length + buckets.next_7.length + buckets.next_30.length + buckets.undated.length,
    5,
  );
  const counts = digestBucketCounts(buckets);
  assert.equal(counts.overdue, 1);
  assert.equal(counts.today, 1);
});

check("daily digest payload includes note and deep links preserved", () => {
  const payload = buildDailyDigestPayload({
    organizationId: "org-1",
    events: sampleEvents,
    todayIso: TODAY,
  });
  assert.equal(payload.organization_id, "org-1");
  assert.equal(payload.as_of, TODAY);
  assert.ok(payload.note.includes("never auto-approves"));
  assert.ok(payload.buckets.today[0].deep_link === "/b");
});

// --- resolve policy ---

check("resolved clears when condition fixed", () => {
  const d = decideResolve({ kind: "pursuit_deadline", conditionStillActive: false, isOpen: true });
  assert.equal(d.action, "resolve");
});

check("keep open when condition still active", () => {
  const d = decideResolve({ kind: "pricing_approval_pending", conditionStillActive: true, isOpen: true });
  assert.equal(d.action, "keep_open");
});

check("noop when already resolved", () => {
  const d = decideResolve({ kind: "processing_failure", conditionStillActive: false, isOpen: false });
  assert.equal(d.action, "noop");
});

check("changed deadline updates in place — no rekey", () => {
  const key = deadlineDedupeKey("pursuit_deadline", "opp-1");
  assert.equal(key, "pursuit_deadline:opp-1");
  const decision = shouldRekeyOnDeadlineChange("2026-08-21", "2026-09-01");
  assert.equal(decision.rekey, false);
  assert.equal(decision.updateDueOn, true);
});

check("contract amendment expiration change keeps entity dedupe", () => {
  const key = deadlineDedupeKey("contract_review_window", "contract-9");
  assert.equal(key, "contract_review_window:contract-9");
  assert.equal(shouldRekeyOnDeadlineChange("2026-10-01", "2026-11-15").rekey, false);
});

check("failed job retry does not create dupes (stable processing_failure key)", () => {
  const a = deadlineDedupeKey("processing_failure", "org-uuid");
  const b = deadlineDedupeKey("processing_failure", "org-uuid");
  assert.equal(a, b);
});

// --- email stub ---

const emailStubResult = await (async () => {
  const prevR = process.env.RESEND_API_KEY;
  const prevS = process.env.SENDGRID_API_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.SENDGRID_API_KEY;
  const channel = createEmailChannel();
  const result = await channel.send({ to: "a@b.test", subject: "t", text: "body" });
  if (prevR) process.env.RESEND_API_KEY = prevR;
  if (prevS) process.env.SENDGRID_API_KEY = prevS;
  return result;
})();

check("email channel stubs NOT_CONFIGURED without keys", () => {
  assert.equal(emailStubResult.ok, false);
  assert.equal(emailStubResult.status, "NOT_CONFIGURED");
});

// --- migration / scheduler greps ---

check("migration extends automation_events with dedupe_key and resolved_at", () => {
  assert.match(migration, /dedupe_key text/);
  assert.match(migration, /resolved_at timestamptz/);
  assert.match(migration, /deep_link text/);
  assert.match(migration, /first_triggered_at/);
  assert.match(migration, /last_triggered_at/);
  assert.match(migration, /owner_user_id/);
});

check("notifications table + RLS present", () => {
  assert.match(migration, /create table if not exists public\.notifications/);
  assert.match(migration, /notifications_select/);
  assert.match(migration, /notifications_update/);
  assert.match(migration, /channel in \('in_app', 'email', 'digest'\)/);
});

check("ensure_automation_event upserts by dedupe_key and bumps last_triggered_at", () => {
  assert.match(migration, /create or replace function private\.ensure_automation_event/);
  assert.match(migration, /last_triggered_at = now\(\)/);
  assert.match(migration, /dedupe_key = v_key/);
});

check("all refresher kinds wired into run_intelligence_automation", () => {
  const kinds = [
    "refresh_pursuit_deadline_alerts",
    "refresh_questions_deadline_alerts",
    "refresh_conference_prebid_alerts",
    "refresh_pricing_approval_alerts",
    "refresh_approval_reminder_alerts",
    "refresh_lp_input_required_alerts",
    "refresh_mandatory_requirement_alerts",
    "refresh_submission_checklist_alerts",
    "refresh_verification_backlog_alerts",
    "refresh_processing_failure_alerts",
    "refresh_compliance_expiration_alerts",
    "refresh_contract_review_window_alerts",
    "refresh_renewal_notice_alerts",
    "refresh_rebid_planning_alerts",
    "refresh_option_decision_alerts",
    "refresh_research_refresh_alerts",
  ];
  for (const fn of kinds) {
    assert.match(migration, new RegExp(fn), fn);
  }
  assert.match(migration, /'pursuit_deadline'/);
  assert.match(migration, /'questions_deadline'/);
  assert.match(migration, /'mandatory_conference'/);
  assert.match(migration, /'prebid_deadline'/);
  assert.match(migration, /'pricing_approval_pending'/);
  assert.match(migration, /'response_approval_pending'/);
  assert.match(migration, /'lp_input_required_outstanding'/);
  assert.match(migration, /'mandatory_requirement_outstanding'/);
  assert.match(migration, /'submission_checklist_incomplete'/);
  assert.match(migration, /'submission_deadline'/);
  assert.match(migration, /'verification_backlog'/);
  assert.match(migration, /'processing_failure'/);
  assert.match(migration, /'compliance_expiration'/);
  assert.match(migration, /'contract_review_window'/);
  assert.match(migration, /'renewal_notice'/);
  assert.match(migration, /'rebid_planning'/);
  assert.match(migration, /'option_decision'/);
  assert.match(migration, /'research_refresh'/);
});

check("NO second scheduler — same pg_cron job + same Vercel path", () => {
  assert.match(migration, /intelligence-automation-daily/);
  assert.doesNotMatch(migration, /intelligence-automation-hourly/);
  assert.doesNotMatch(migration, /f9-automation/);
  assert.match(phase6Mig, /intelligence-automation-daily/);
  assert.match(vercelJson, /\/api\/cron\/intelligence-digest/);
  const cronPaths = [...vercelJson.matchAll(/"path":\s*"([^"]+)"/g)].map((m) => m[1]);
  const digestPaths = cronPaths.filter((p) => p.includes("intelligence-digest") || p.includes("automation"));
  assert.equal(digestPaths.filter((p) => p === "/api/cron/intelligence-digest").length, 1);
  assert.ok(!cronPaths.some((p) => p.includes("f9") || p.includes("notification-digest")));
});

check("digest route still calls run_intelligence_automation_service + digest.ts", () => {
  assert.match(digestRoute, /run_intelligence_automation_service/);
  assert.match(digestRoute, /buildDailyDigestPayload/);
  assert.match(digestRoute, /sendDigestEmail/);
});

check("automation SQL never mutates approve/submit/renew/verify human gates", () => {
  // Ban phrases that would indicate gate bypass mutations
  const banned = [
    /update\s+public\.pricing_decisions[\s\S]{0,200}HUMAN_APPROVED/i,
    /update\s+public\.extracted_facts[\s\S]{0,200}HUMAN_VERIFIED/i,
    /update\s+public\.opportunities[\s\S]{0,200}go_no_go\s*=/i,
    /submitted_at\s*=\s*now\(\)/i,
    /update\s+public\.renewals[\s\S]{0,120}set/i,
    /insert\s+into\s+public\.contract_options/i,
  ];
  for (const re of banned) {
    assert.doesNotMatch(migration, re, String(re));
  }
  assert.match(migration, /NEVER exercises options/i);
  assert.match(migration, /NEVER renews/i);
  assert.match(migration, /never auto-verifies/i);
  assert.match(migration, /never selects final price/i);
});

check("deep links present on refreshers", () => {
  assert.match(migration, /\/procurement\/opportunities\//);
  assert.match(migration, /\/ingestion\/verification/);
  assert.match(migration, /\/contracts\//);
  assert.match(migration, /p_deep_link/);
});

check("cross-tenant isolation — notifications RLS uses is_org_member", () => {
  assert.match(migration, /is_org_member\(organization_id\)/);
  assert.match(migration, /user_id is null or user_id = \(select auth\.uid\(\)\)/);
});

check("CatalogIT reference remains reminder-only (no Gmail/Slack spam)", () => {
  assert.match(catalogit, /Gmail|Slack/i);
  assert.match(catalogit, /NOT adopting|still no Gmail/i);
  assert.match(migration, /CatalogIT-style reminder only/i);
});

check("opportunity deadline columns added when missing", () => {
  assert.match(migration, /questions_due_on date/);
  assert.match(migration, /conference_due_on date/);
  assert.match(migration, /prebid_due_on date/);
});

// --- duplicate cron simulation (pure) ---

check("duplicate cron no dup events — same dedupe_key identity", () => {
  const keys = new Set();
  for (let i = 0; i < 3; i++) {
    keys.add(deadlineDedupeKey("pursuit_deadline", "opp-dup"));
  }
  assert.equal(keys.size, 1);
});

// Print results
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.message ? ` — ${r.message}` : ""}`);
}
console.log(`\nF9 automation notifications: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
