#!/usr/bin/env node
/**
 * F11 acceptance — Addenda + Q&A + Solicitation Change-Impact Engine.
 * Pure heuristics + greps + F9 deadline rekey. No AI auto-promotion.
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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f11-${name}-`)), "out.mjs");
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

const detectMod = await bundle("lib/solicitation/detect-changes.ts", "detect");
const impactMod = await bundle("lib/solicitation/impact-summary.ts", "impact");
const applyMod = await bundle("lib/solicitation/apply-change.ts", "apply");
const runsMod = await bundle("lib/solicitation/runs.ts", "runs");
const typesMod = await bundle("lib/solicitation/change-types.ts", "types");
const resolveMod = await bundle("lib/automation/resolve-policy.ts", "resolve");

const { detectSolicitationChanges, summarizeDetectedChanges } = detectMod;
const { buildImpactSummary, readinessAddendumAdvisory } = impactMod;
const { evaluateApplyGate, planDeadlineApply, buildStaleReason, assertApplyDoesNotApprove } = applyMod;
const { buildChangeRunDraft } = runsMod;
const { SOLICITATION_CHANGE_TYPES, defaultImpactFlags } = typesMod;
const { shouldRekeyOnDeadlineChange, deadlineDedupeKey } = resolveMod;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

const migration = await readSource(root, "supabase/migrations/20260821290000_f11_solicitation_change_impact.sql");
const applySrc = await readSource(webRoot, "lib/solicitation/apply-change.ts");
const createRunSrc = await readSource(webRoot, "lib/solicitation/create-run.ts");
const verifyActions = await readSource(webRoot, "app/(platform)/ingestion/verification/actions.ts");
const changeActions = await readSource(
  webRoot,
  "app/(platform)/procurement/opportunities/[opportunityId]/change-impact-actions.ts",
);
const detectSrc = await readSource(webRoot, "lib/solicitation/detect-changes.ts");
const opencontractsNote = await readSource(root, "docs/reference-repos/opencontracts.md").catch(() => "");
const f11Ref = await readSource(root, "docs/reference-repos/f11-change-detection.md").catch(() => "");

// --- enums ---
check("all required change types catalogued", () => {
  const required = [
    "DEADLINE_CHANGE",
    "REQUIREMENT_ADDED",
    "REQUIREMENT_MODIFIED",
    "REQUIREMENT_REMOVED",
    "PRICING_CHANGE",
    "FORM_ADDED",
    "FORM_REMOVED",
    "EVALUATION_CHANGE",
    "SCOPE_CHANGE",
    "STAFFING_CHANGE",
    "COMPLIANCE_CHANGE",
    "SUBMISSION_METHOD_CHANGE",
    "Q_A_CLARIFICATION",
    "OTHER",
  ];
  for (const t of required) assert.ok(SOLICITATION_CHANGE_TYPES.includes(t), t);
});

// --- original → addendum ---
check("original→addendum detects deadline + requirement add/mod/remove + form + pricing", () => {
  const baseline = {
    requirements: [
      { id: "r1", statement: "Contractor shall provide armed guards.", section_ref: "3.1" },
      { id: "r2", statement: "Submit HUB form.", section_ref: "4.2" },
    ],
    forms: [{ id: "f1", form_name: "HUB" }],
    pricingHints: [{ labor_category: "Armed Guard", requested_rate: 28 }],
    deadlines: [{ kind: "response", due_on: "2026-09-01" }],
  };
  const addendum = {
    requirements: [
      { statement: "Contractor shall provide armed and unarmed guards.", section_ref: "3.1" },
      { statement: "Provide incident reporting within 24 hours.", section_ref: "3.8" },
    ],
    forms: [
      { form_name: "HUB" },
      { form_name: "Insurance certificate" },
    ],
    pricingHints: [{ labor_category: "Armed Guard", requested_rate: 31 }],
    deadlines: [{ kind: "response", due_on: "2026-09-15" }],
  };
  const { items, summary } = detectSolicitationChanges(baseline, addendum, { triggerKind: "ADDENDUM" });
  const types = new Set(items.map((i) => i.change_type));
  assert.ok(types.has("DEADLINE_CHANGE"));
  assert.ok(types.has("REQUIREMENT_MODIFIED"));
  assert.ok(types.has("REQUIREMENT_ADDED"));
  assert.ok(types.has("REQUIREMENT_REMOVED"));
  assert.ok(types.has("FORM_ADDED"));
  assert.ok(types.has("PRICING_CHANGE"));
  assert.equal(summary.unreviewed, items.length);
  assert.ok(summary.added + summary.changed + summary.removed + summary.ambiguous === items.length || summary.changed >= 1);
  assert.ok(items.every((i) => i.verification_status === "AI_EXTRACTED" || i.verification_status === "CONFLICT"));
});

// --- multiple addenda ---
check("multiple addenda: second addendum vs prior latest still detects deltas", () => {
  const after1 = {
    requirements: [{ id: "r1", statement: "Armed guards only.", section_ref: "3.1" }],
    deadlines: [{ kind: "response", due_on: "2026-09-15" }],
  };
  const after2 = {
    requirements: [{ statement: "Armed guards with radios.", section_ref: "3.1" }],
    deadlines: [{ kind: "response", due_on: "2026-09-30" }],
  };
  const { items } = detectSolicitationChanges(after1, after2, { triggerKind: "ADDENDUM" });
  assert.ok(items.some((i) => i.change_type === "DEADLINE_CHANGE"));
  assert.ok(items.some((i) => i.change_type === "REQUIREMENT_MODIFIED"));
});

// --- Q&A ---
check("Q&A clarification detected", () => {
  const { items } = detectSolicitationChanges(
    { requirements: [{ id: "r1", statement: "Provide radios at each post.", section_ref: "5.1" }] },
    {
      qaPairs: [{ question: "Are body cams required?", answer: "Body cams are optional for this IFB." }],
    },
    { triggerKind: "Q_AND_A" },
  );
  assert.ok(items.some((i) => i.change_type === "Q_A_CLARIFICATION"));
  assert.ok(items.every((i) => i.verification_status !== "HUMAN_VERIFIED"));
});

// --- conflicting clarification → ambiguous ---
check("conflicting clarification → ambiguous/conflict not auto-applicable", () => {
  const { items } = detectSolicitationChanges(
    {
      requirements: [
        { id: "r1", statement: "Contractor shall provide radios at each post.", section_ref: "5.1" },
      ],
    },
    {
      qaPairs: [
        {
          question: "Contractor shall provide radios at each post.",
          answer: "Radios are no longer required; body cams replace radios.",
        },
      ],
    },
    { triggerKind: "Q_AND_A" },
  );
  const conflict = items.find((i) => i.change_type === "Q_A_CLARIFICATION" && i.ambiguity_reason);
  assert.ok(conflict, "expected ambiguous Q&A item");
  assert.equal(conflict.verification_status, "CONFLICT");
  const gate = evaluateApplyGate({
    id: "x",
    change_type: conflict.change_type,
    verification_status: "HUMAN_VERIFIED",
    ambiguity_reason: conflict.ambiguity_reason,
  });
  // Even if somehow verified without clearing ambiguity, apply gate refuses
  assert.equal(gate.ok, false);
});

// --- response approval invalidation = stale flag NOT text wipe ---
check("stale reason documents preservation; apply gate refuses AI_EXTRACTED", () => {
  const reason = buildStaleReason("REQUIREMENT_MODIFIED", "item-1");
  assert.match(reason, /not cleared/i);
  assert.equal(evaluateApplyGate({ id: "1", change_type: "REQUIREMENT_MODIFIED", verification_status: "AI_EXTRACTED" }).ok, false);
  assert.equal(evaluateApplyGate({ id: "1", change_type: "REQUIREMENT_MODIFIED", verification_status: "NEEDS_REVIEW" }).ok, false);
  assert.equal(
    evaluateApplyGate({
      id: "1",
      change_type: "REQUIREMENT_MODIFIED",
      verification_status: "HUMAN_VERIFIED",
      ambiguity_reason: null,
    }).ok,
    true,
  );
});

// --- change run draft starts AI_EXTRACTED ---
check("change run draft status AI_EXTRACTED with honest summary", () => {
  const draft = buildChangeRunDraft({
    organizationId: "org",
    solicitationId: "sol",
    opportunityId: "opp",
    triggerKind: "ADDENDUM",
    baseline: {
      requirements: [{ id: "r1", statement: "A", section_ref: "1" }],
      deadlines: [{ kind: "response", due_on: "2026-01-01" }],
    },
    candidate: {
      requirements: [{ statement: "B", section_ref: "1" }],
      deadlines: [{ kind: "response", due_on: "2026-02-01" }],
    },
  });
  assert.equal(draft.run.status, "AI_EXTRACTED");
  assert.ok(draft.items.every((i) => i.verification_status === "AI_EXTRACTED" || i.verification_status === "CONFLICT"));
  assert.ok(draft.run.summary_json.unreviewed >= 1);
});

// --- impact summary ---
check("impact summary honest counts", () => {
  const summary = buildImpactSummary([
    { change_type: "DEADLINE_CHANGE", verification_status: "AI_EXTRACTED", impact_flags: { deadlines: true, checklist: true } },
    {
      change_type: "REQUIREMENT_MODIFIED",
      verification_status: "HUMAN_VERIFIED",
      impact_flags: { responses: true },
    },
    { change_type: "Q_A_CLARIFICATION", verification_status: "CONFLICT", ambiguity_reason: "conflict" },
  ]);
  assert.equal(summary.unreviewed, 1);
  assert.equal(summary.verified_unapplied, 1);
  assert.equal(summary.ambiguous, 1);
  assert.equal(summary.impacts.deadlines, 1);
  assert.equal(summary.impacts.responses, 1);
});

check("readiness addendum advisory", () => {
  const a = readinessAddendumAdvisory({
    unreviewedChangeItems: 2,
    addendumAcknowledgementCompleted: false,
    staleResponseCount: 1,
    stalePricingCount: 0,
  });
  assert.equal(a.status, "ADVISORY");
  assert.match(a.detail, /unreviewed/);
});

// --- F9 deadline rekey ---
check("automation deadline rekey unit — update in place, never rekey", () => {
  const plan = planDeadlineApply({
    opportunityId: "opp-9",
    previousDueOn: "2026-09-01",
    afterJson: { due_on: "2026-09-15", kind: "response" },
    afterText: null,
  });
  assert.equal(plan.automationNote.rekey, false);
  assert.equal(plan.automationNote.updateDueOn, true);
  assert.equal(plan.automationNote.pursuitDeadlineKey, deadlineDedupeKey("pursuit_deadline", "opp-9"));
  assert.equal(shouldRekeyOnDeadlineChange("2026-09-01", "2026-09-15").rekey, false);
  assert.ok(plan.opportunityPatch?.response_due_on === "2026-09-15");
});

// --- migration greps ---
check("migration: addenda columns + q_and_a + change tables + stale_reason + apply gate", () => {
  assert.match(migration, /supersedes_addendum_id/);
  assert.match(migration, /source_document_version_id/);
  assert.match(migration, /verification_status/);
  assert.match(migration, /is_latest/);
  assert.match(migration, /solicitation_addenda_one_latest_per_sol_uidx/);
  assert.match(migration, /create table if not exists public\.solicitation_q_and_a/);
  assert.match(migration, /solicitation_change_runs/);
  assert.match(migration, /solicitation_change_items/);
  assert.match(migration, /DEADLINE_CHANGE/);
  assert.match(migration, /REQUIREMENT_ADDED/);
  assert.match(migration, /Q_A_CLARIFICATION/);
  assert.match(migration, /stale_reason/);
  assert.match(migration, /superseded_by_id/);
  assert.match(migration, /apply_solicitation_change_item/);
  assert.match(migration, /Only HUMAN_VERIFIED|HUMAN_VERIFIED change item/i);
  assert.match(migration, /never sets HUMAN_APPROVED|Never sets HUMAN_APPROVED/i);
  assert.match(migration, /is_org_member\(organization_id\)/);
  assert.match(migration, /enable row level security/);
});

check("no AI auto-promotion greps", () => {
  assert.doesNotMatch(detectSrc, /HUMAN_VERIFIED\s*=/);
  assert.match(createRunSrc, /AI_EXTRACTED|buildChangeRunDraft/);
  assert.match(verifyActions, /createChangeRunAfterPromote/);
  assert.match(changeActions, /verify\.promote/);
  assert.match(changeActions, /evaluateApplyGate/);
  assert.ok(assertApplyDoesNotApprove(applySrc));
  assert.doesNotMatch(applySrc, /status\s*[:=]\s*['"]HUMAN_APPROVED['"]/);
  assert.doesNotMatch(migration, /draft_status\s*=\s*'APPROVED'/);
  assert.doesNotMatch(migration, /status\s*=\s*'HUMAN_APPROVED'/);
});

check("tenant RLS greps on new tables", () => {
  assert.match(migration, /solicitation_q_and_a_select/);
  assert.match(migration, /solicitation_change_runs_select/);
  assert.match(migration, /solicitation_change_items_select/);
  assert.match(migration, /using \(public\.is_org_member\(organization_id\)\)/);
});

check("default impact flags cover responses/pricing/deadlines", () => {
  assert.equal(defaultImpactFlags("REQUIREMENT_MODIFIED").responses, true);
  assert.equal(defaultImpactFlags("PRICING_CHANGE").pricing, true);
  assert.equal(defaultImpactFlags("DEADLINE_CHANGE").deadlines, true);
});

check("SemanticDiff rejected; OpenContracts pattern-only note present", () => {
  assert.ok(f11Ref.includes("SemanticDiff") && /reject|do not adopt|not adopt/i.test(f11Ref));
  assert.ok(f11Ref.includes("OpenContracts") && /pattern only|provenance/i.test(f11Ref));
  // Code must not import SemanticDiff / diff-match-patch (comment rejection OK)
  assert.doesNotMatch(detectSrc, /from\s+['"].*semanticdiff/i);
  assert.doesNotMatch(detectSrc, /require\(['"].*semanticdiff/i);
  assert.doesNotMatch(detectSrc, /from\s+['"]diff-match-patch['"]/);
  assert.doesNotMatch(detectSrc, /from\s+['"]diff_match_patch['"]/);
});

check("summarizeDetectedChanges returns detector version", () => {
  const s = summarizeDetectedChanges([]);
  assert.equal(s.detector_version, "f11-heuristics-v1");
  assert.match(s.note, /heuristic/i);
});

// report
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : ` — ${r.message}`}`);
}
console.log(`\nF11 solicitation-change: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
