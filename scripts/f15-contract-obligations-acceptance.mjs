#!/usr/bin/env node
/**
 * F15 acceptance — Contract Obligations + Deliverables + Performance Compliance.
 * One-time, monthly recurring (next_due advance), amendment supersede, late/overdue,
 * waiver, completion evidence, alert kinds, source clause, cross-tenant greps,
 * AI cannot auto-verify/complete, no second cron.
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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f15-${name}-`)), "out.mjs");
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
    external: ["@/lib/supabase/server"],
  });
  return import(pathToFileURL(outfile).href);
}

async function readSource(...parts) {
  return fs.readFile(path.join(...parts), "utf8");
}

const statusMod = await bundle("lib/obligations/status.ts", "status");
const promoteMod = await bundle("lib/obligations/promote.ts", "promote");
const riskMod = await bundle("lib/obligations/risk-strip.ts", "risk");
const typesMod = await bundle("lib/obligations/types.ts", "types");
const kindsMod = await bundle("lib/automation/kinds.ts", "kinds");

const {
  deriveObligationStatus,
  advanceNextDueOn,
  daysUntilDue,
  activeDueOn,
  normalizeRecurrenceRule,
} = statusMod;
const {
  evaluateHumanVerifyGate,
  buildAiExtractedObligationPatch,
  assertAiCannotMarkVerified,
  assertAiCannotComplete,
  evaluateCompleteGate,
  evaluateWaiveGate,
  evaluatePromoteCandidateGate,
  hasObligationSource,
} = promoteMod;
const { countVerifiedObligationRisk, formatRiskStripLabel, RISK_STRIP_NOTE } = riskMod;
const { OBLIGATION_TYPES, COMPLETION_EVIDENCE_NOTE, OBLIGATIONS_NOT_TASK_MANAGER_NOTE } = typesMod;
const { AUTOMATION_KINDS, isAutomationKind } = kindsMod;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

const migration = await readSource(root, "supabase/migrations/20260821320000_f15_contract_obligations.sql");
const f9Migration = await readSource(root, "supabase/migrations/20260821270000_f9_automation_notifications.sql");
const kindsSrc = await readSource(webRoot, "lib/automation/kinds.ts");
const actionsSrc = await readSource(
  webRoot,
  "app/(platform)/contracts/[contractId]/obligations/actions.ts",
);
const pageSrc = await readSource(
  webRoot,
  "app/(platform)/contracts/[contractId]/obligations/page.tsx",
);
const actionsUiSrc = await readSource(
  webRoot,
  "app/(platform)/contracts/[contractId]/obligations/obligation-actions.tsx",
);
const overviewSrc = await readSource(webRoot, "app/(platform)/contracts/[contractId]/page.tsx");
const sharedSrc = await readSource(webRoot, "components/opportunity-workspace/shared.tsx");
const statusSrc = await readSource(webRoot, "lib/obligations/status.ts");
const promoteSrc = await readSource(webRoot, "lib/obligations/promote.ts");
const riskSrc = await readSource(webRoot, "lib/obligations/risk-strip.ts");

const TODAY = "2026-08-21";

// --- types / one-time status ---
check("obligation_type enum covers required kinds", () => {
  for (const t of [
    "STAFFING",
    "SCHEDULE",
    "TRAINING",
    "REPORTING",
    "INCIDENT_REPORTING",
    "INSURANCE",
    "LICENSE",
    "EQUIPMENT",
    "INVOICE",
    "SERVICE_LEVEL",
    "MEETING",
    "AUDIT",
    "DELIVERABLE",
    "NOTICE",
    "OPTION",
    "RENEWAL",
    "OTHER",
  ]) {
    assert.ok(OBLIGATION_TYPES.includes(t), t);
    assert.match(migration, new RegExp(`'${t}'`));
  }
});

check("one-time: overdue / due / upcoming from dates", () => {
  assert.equal(
    deriveObligationStatus({ status: "NOT_STARTED", dueOn: "2026-08-10", today: TODAY }),
    "OVERDUE",
  );
  assert.equal(
    deriveObligationStatus({ status: "NOT_STARTED", dueOn: "2026-08-21", today: TODAY }),
    "DUE",
  );
  assert.equal(
    deriveObligationStatus({ status: "NOT_STARTED", dueOn: "2026-08-25", today: TODAY }),
    "DUE",
  );
  assert.equal(
    deriveObligationStatus({ status: "NOT_STARTED", dueOn: "2026-09-15", today: TODAY }),
    "UPCOMING",
  );
  assert.equal(daysUntilDue("2026-08-10", TODAY), -11);
});

check("terminal statuses never date-overwritten", () => {
  assert.equal(
    deriveObligationStatus({ status: "COMPLETED", dueOn: "2026-08-01", today: TODAY }),
    "COMPLETED",
  );
  assert.equal(
    deriveObligationStatus({ status: "WAIVED", dueOn: "2026-08-01", today: TODAY }),
    "WAIVED",
  );
  assert.equal(
    deriveObligationStatus({ status: "SUPERSEDED", dueOn: "2026-08-01", today: TODAY }),
    "SUPERSEDED",
  );
});

check("monthly recurring advances next_due_on", () => {
  assert.equal(normalizeRecurrenceRule("MONTHLY"), "MONTHLY");
  assert.equal(advanceNextDueOn("MONTHLY", "2026-08-21"), "2026-09-21");
  assert.equal(advanceNextDueOn("WEEKLY", "2026-08-21"), "2026-08-28");
  assert.equal(advanceNextDueOn("YEARLY", "2026-08-21"), "2027-08-21");
  assert.equal(advanceNextDueOn(null, "2026-08-21"), null);
});

check("complete gate: one-time → COMPLETED with evidence + actor", () => {
  const g = evaluateCompleteGate({
    verificationStatus: "HUMAN_VERIFIED",
    status: "DUE",
    recurrenceRule: null,
    dueOn: "2026-08-21",
    nextDueOn: null,
    evidenceDocumentId: "doc-1",
    actorId: "user-1",
    today: TODAY,
  });
  assert.equal(g.ok, true);
  if (g.ok) {
    assert.equal(g.action, "completed");
    assert.equal(g.status, "COMPLETED");
  }
});

check("complete gate: monthly advances next_due (lazy recurrence)", () => {
  const g = evaluateCompleteGate({
    verificationStatus: "HUMAN_VERIFIED",
    status: "DUE",
    recurrenceRule: "MONTHLY",
    dueOn: "2026-01-21",
    nextDueOn: "2026-08-21",
    evidenceDocumentId: "doc-1",
    actorId: "user-1",
    today: TODAY,
  });
  assert.equal(g.ok, true);
  if (g.ok) {
    assert.equal(g.action, "recurring_advanced");
    assert.equal(g.next_due_on, "2026-09-21");
    assert.notEqual(g.status, "COMPLETED");
  }
});

check("complete refuses without evidence or AI_EXTRACTED", () => {
  assert.equal(
    evaluateCompleteGate({
      verificationStatus: "HUMAN_VERIFIED",
      status: "DUE",
      recurrenceRule: null,
      dueOn: TODAY,
      nextDueOn: null,
      evidenceDocumentId: null,
      actorId: "u",
      today: TODAY,
    }).ok,
    false,
  );
  assert.equal(
    evaluateCompleteGate({
      verificationStatus: "AI_EXTRACTED",
      status: "DUE",
      recurrenceRule: null,
      dueOn: TODAY,
      nextDueOn: null,
      evidenceDocumentId: "doc",
      actorId: "u",
      today: TODAY,
    }).ok,
    false,
  );
});

check("waiver requires reason; refuses superseded", () => {
  assert.equal(evaluateWaiveGate({ status: "DUE", waiveReason: "Buyer waived training" }).ok, true);
  assert.equal(evaluateWaiveGate({ status: "DUE", waiveReason: "  " }).ok, false);
  assert.equal(evaluateWaiveGate({ status: "SUPERSEDED", waiveReason: "x" }).ok, false);
});

check("AI cannot auto-verify or auto-complete", () => {
  const patch = buildAiExtractedObligationPatch();
  assert.equal(patch.verification_status, "AI_EXTRACTED");
  assert.equal(patch.verified_by, null);
  assert.equal(patch.completed_by, null);
  assert.throws(() => assertAiCannotMarkVerified("HUMAN_VERIFIED"));
  assert.throws(() => assertAiCannotComplete("COMPLETED"));
  const gate = evaluateHumanVerifyGate({
    verificationStatus: "AI_EXTRACTED",
    verifiedBy: null,
    hasSource: true,
  });
  assert.equal(gate.ok, false);
  const promote = evaluatePromoteCandidateGate({
    contractId: "c1",
    title: "Monthly report",
  });
  assert.equal(promote.ok, true);
  if (promote.ok) assert.equal(promote.verification_status, "AI_EXTRACTED");
});

check("source clause / document required for HUMAN_VERIFIED", () => {
  assert.equal(hasObligationSource({ source_clause_ref: "§4.2 Reporting" }), true);
  assert.equal(hasObligationSource({ source_document_id: "d1" }), true);
  assert.equal(hasObligationSource({}), false);
  const g = evaluateHumanVerifyGate({
    verificationStatus: "AI_EXTRACTED",
    verifiedBy: "u1",
    hasSource: false,
  });
  assert.equal(g.ok, false);
});

check("risk strip: verified-only factual counts (no opaque score)", () => {
  const counts = countVerifiedObligationRisk(
    [
      {
        verification_status: "HUMAN_VERIFIED",
        status: "OVERDUE",
        effective_on: null,
        due_on: "2026-08-01",
        next_due_on: null,
      },
      {
        verification_status: "HUMAN_VERIFIED",
        status: "DUE",
        effective_on: null,
        due_on: "2026-08-21",
        next_due_on: null,
      },
      {
        verification_status: "HUMAN_VERIFIED",
        status: "UPCOMING",
        effective_on: null,
        due_on: "2026-10-01",
        next_due_on: null,
      },
      {
        verification_status: "AI_EXTRACTED",
        status: "OVERDUE",
        effective_on: null,
        due_on: "2026-08-01",
        next_due_on: null,
      },
      {
        verification_status: "HUMAN_VERIFIED",
        status: "COMPLETED",
        effective_on: null,
        due_on: "2026-08-01",
        next_due_on: null,
      },
    ],
    TODAY,
  );
  assert.equal(counts.overdue, 1);
  assert.equal(counts.due, 1);
  assert.equal(counts.upcoming, 1);
  assert.equal(counts.verifiedOpen, 3);
  assert.equal(counts.unverifiedExcluded, 1);
  assert.match(formatRiskStripLabel(counts), /Overdue 1/);
  assert.match(RISK_STRIP_NOTE, /No opaque AI risk score/i);
  assert.match(COMPLETION_EVIDENCE_NOTE, /not a qualitative past-performance/i);
  assert.match(OBLIGATIONS_NOT_TASK_MANAGER_NOTE, /not a generic task/i);
});

check("activeDueOn prefers next_due_on", () => {
  assert.equal(activeDueOn({ next_due_on: "2026-09-01", due_on: "2026-01-01" }), "2026-09-01");
});

// --- migration / F9 ---
check("migration: table + enums + refuse_ai + RPCs", () => {
  assert.match(migration, /create table if not exists public\.contract_obligations/);
  assert.match(migration, /obligation_type as enum/);
  assert.match(migration, /obligation_status as enum/);
  assert.match(migration, /contract_obligations_refuse_ai/);
  assert.match(migration, /HUMAN_VERIFIED.*verified_by/s);
  assert.match(migration, /promote_obligation_candidate/);
  assert.match(migration, /verify_contract_obligation/);
  assert.match(migration, /complete_contract_obligation/);
  assert.match(migration, /waive_contract_obligation/);
  assert.match(migration, /supersede_obligation_from_amendment/);
  assert.match(migration, /advance_obligation_next_due/);
  assert.match(migration, /derive_obligation_status/);
  assert.match(migration, /is_org_member\(organization_id\)/);
  assert.match(migration, /superseded_by_id/);
  assert.match(migration, /amendment_id/);
  assert.match(migration, /completion_evidence_document_id/);
  assert.match(migration, /source_clause_ref/);
  assert.match(migration, /recurrence_rule/);
  assert.match(migration, /next_due_on/);
});

check("migration: amendment supersede never rewrites prior title in place", () => {
  assert.match(migration, /status = 'SUPERSEDED'/);
  assert.match(migration, /superseded_by_id = v_new_id/);
  assert.match(migration, /History not rewritten/);
  // Prior row update must not set title/description to new values
  const supersedeBlock = migration.slice(
    migration.indexOf("supersede_obligation_from_amendment"),
    migration.indexOf("refresh_obligation_due_alerts"),
  );
  assert.match(supersedeBlock, /insert into public\.contract_obligations/);
  assert.doesNotMatch(
    supersedeBlock.slice(supersedeBlock.lastIndexOf("update public.contract_obligations")),
    /title\s*=/,
  );
});

check("F9: obligation_due + obligation_overdue kinds; HUMAN_VERIFIED only", () => {
  assert.equal(isAutomationKind("obligation_due"), true);
  assert.equal(isAutomationKind("obligation_overdue"), true);
  assert.ok(AUTOMATION_KINDS.includes("obligation_due"));
  assert.ok(AUTOMATION_KINDS.includes("obligation_overdue"));
  assert.match(kindsSrc, /obligation_due/);
  assert.match(migration, /'obligation_due'/);
  assert.match(migration, /'obligation_overdue'/);
  assert.match(migration, /refresh_obligation_due_alerts/);
  assert.match(migration, /refresh_obligation_overdue_alerts/);
  assert.match(migration, /verification_status = 'HUMAN_VERIFIED'/);
  assert.match(migration, /obligation_due_n := private\.refresh_obligation_due_alerts/);
  assert.match(migration, /obligation_overdue_n := private\.refresh_obligation_overdue_alerts/);
});

check("NO second scheduler — same intelligence-automation-daily only", () => {
  assert.match(migration, /intelligence-automation-daily/);
  assert.match(migration, /private\.run_intelligence_automation/);
  assert.match(f9Migration, /intelligence-automation-daily/);
  // F15 must not introduce a differently named cron job
  const cronNames = [...migration.matchAll(/cron\.schedule\(\s*'([^']+)'/g)].map((m) => m[1]);
  for (const name of cronNames) {
    assert.equal(name, "intelligence-automation-daily", `unexpected cron job ${name}`);
  }
  assert.doesNotMatch(migration, /obligation-automation/);
  assert.doesNotMatch(migration, /obligations-daily/);
});

check("actions: verify.promote for verify; result.write for complete/waive", () => {
  assert.match(actionsSrc, /verify\.promote/);
  assert.match(actionsSrc, /result\.write/);
  assert.match(actionsSrc, /verify_contract_obligation/);
  assert.match(actionsSrc, /complete_contract_obligation/);
  assert.match(actionsSrc, /waive_contract_obligation/);
  assert.doesNotMatch(actionsSrc, /service_role/);
});

check("UI: Obligations tab + overview strip + honesty copy", () => {
  assert.match(sharedSrc, /\/obligations/);
  assert.match(sharedSrc, /Obligations/);
  assert.match(pageSrc, /obligations-risk-strip/);
  assert.match(actionsUiSrc, /Mark HUMAN_VERIFIED/);
  assert.match(pageSrc, /ObligationVerifyButton/);
  assert.match(overviewSrc, /overview-obligations-strip/);
  assert.match(overviewSrc, /formatRiskStripLabel/);
  assert.match(pageSrc, /OBLIGATIONS_NOT_TASK_MANAGER_NOTE/);
});

check("cross-tenant / RLS greps on migration", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /contract_obligations_select/);
  assert.match(migration, /contract_obligations_contract_same_org_fkey/);
  assert.match(migration, /completion_doc_same_org_fkey/);
  assert.match(migration, /Evidence document must belong to the same organization/);
});

check("lib pure modules have no React/Supabase imports (status/promote/risk)", () => {
  assert.doesNotMatch(statusSrc, /from ["']react["']/);
  assert.doesNotMatch(promoteSrc, /from ["']@\/lib\/supabase/);
  assert.doesNotMatch(riskSrc, /from ["']@\/lib\/supabase/);
  assert.doesNotMatch(statusSrc, /createClient/);
});

check("completion evidence distinct from past performance", () => {
  assert.match(migration, /Completion evidence/);
  assert.match(migration, /past-performance/i);
  assert.doesNotMatch(migration, /experience_records/);
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : ` — ${r.message}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
