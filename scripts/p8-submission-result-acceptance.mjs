#!/usr/bin/env node
// P8 acceptance: submission readiness, human submission authorization, outcome capture, and the
// contract handoff gate.
//
// The invariants under test:
//   * an incomplete packet can never read as Complete or Ready — Unknown is outstanding, not settled;
//   * nothing submits, signs, or approves autonomously: Mark SUBMITTED needs an explicit human
//     authorization AND a server-side recompute of readiness, and the authorization tick cannot buy
//     past a blocking item;
//   * every output label states what the file actually is (no DOCX claim, no Google Docs integration);
//   * a contract row still requires a HUMAN_VERIFIED award-shaped fact — a WON outcome is not evidence.
//
// Runs with no network and no database. The real TypeScript model is bundled with esbuild so the
// test exercises the shipped code; UI and server-action wiring is asserted by grep.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const outdir = await fs.mkdtemp(path.join(os.tmpdir(), "lp-p8-"));

async function bundle(relEntry, name) {
  const outfile = path.join(outdir, name);
  await esbuild.build({
    entryPoints: [path.join(webRoot, relEntry)],
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

const model = await bundle("lib/opportunity/submission-readiness.ts", "submission-readiness.mjs");
const response = await bundle("lib/opportunity/response.ts", "response.mjs");

const {
  AWARDISH_FACT_RE,
  NO_AUTO_SUBMIT_NOTICE,
  READINESS_STATUS_LABELS,
  READINESS_STATUS_ORDER,
  RESULT_FIELD_SCOPE,
  SUBMISSION_AUTHORIZATION_LABEL,
  SUBMISSION_OVERALL_LABELS,
  checklistItemKind,
  computeSubmissionReadiness,
  describeSubmissionOutputs,
  evaluateContractHandoffGate,
  evaluateMarkSubmittedGate,
  isAwardishFact,
  isSettledStatus,
} = model;
const { DEFAULT_SUBMISSION_CHECKLIST, RESULT_OUTCOME_OPTIONS, computeResponseProgress } = response;

// Read with LF endings so the function-body regexes below behave the same on Windows checkouts.
const readSource = async (...segments) =>
  (await fs.readFile(path.join(...segments), "utf8")).replace(/\r\n/g, "\n");

const sources = {
  workbench: await readSource(
    webRoot,
    "components/opportunity-workspace/submission-workbench.tsx",
  ),
  result: await readSource(webRoot, "components/opportunity-workspace/result-capture-panel.tsx"),
  actions: await readSource(
    webRoot,
    "app/(platform)/procurement/opportunities/[opportunityId]/actions.ts",
  ),
  submissionPage: await readSource(
    webRoot,
    "app/(platform)/procurement/opportunities/[opportunityId]/submission/page.tsx",
  ),
  resultPage: await readSource(
    webRoot,
    "app/(platform)/procurement/opportunities/[opportunityId]/result/page.tsx",
  ),
  authMigration: await readSource(
    root,
    "supabase/migrations/20260821200000_p8_submission_authorization.sql",
  ),
  trustMigration: await readSource(
    root,
    "supabase/migrations/20260821090000_trust_require_verified_canonical_sources.sql",
  ),
  verify8: await readSource(root, "scripts/verify8-proposal-workflow-acceptance.mjs"),
  phase8: await readSource(root, "scripts/phase8-response-submission-acceptance.mjs"),
};

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

// ------------------------------------------------------------------- fixtures

function item(overrides = {}) {
  return {
    item_key: overrides.item_key ?? "required_forms",
    label: overrides.label ?? "Required forms",
    required: overrides.required ?? true,
    completed: overrides.completed ?? false,
    notes: overrides.notes ?? null,
    ...overrides,
  };
}

function seededChecklist(completedKeys = []) {
  return DEFAULT_SUBMISSION_CHECKLIST.map((d) =>
    item({ item_key: d.item_key, label: d.label, required: true, completed: completedKeys.includes(d.item_key) }),
  );
}

const ALL_KEYS = DEFAULT_SUBMISSION_CHECKLIST.map((d) => d.item_key);

function approval(layer_key, status, enabled = true) {
  return { layer_key, enabled, status, decided_at: null, notes: null };
}

function fullyReadyInput(overrides = {}) {
  return {
    checklist: seededChecklist(ALL_KEYS),
    approvals: [approval("content", "approved"), approval("executive", "requested", false)],
    pricingDecision: { status: "HUMAN_APPROVED", final_bid_rate: 31, final_bid_amount: null },
    responseProgress: {
      totalRequirements: 2,
      verified: 2,
      drafted: 0,
      approved: 2,
      lpInputRequired: 0,
      mandatoryOutstanding: 0,
      requiredAttachmentsMissing: 0,
    },
    packet: { due_at: "2026-09-01T17:00:00Z", submission_method: "portal" },
    ...overrides,
  };
}

// ------------------------------------------------- readiness statuses and math

check("the six readiness statuses are modelled and only two of them are settled", () => {
  assert.deepEqual(READINESS_STATUS_ORDER, [
    "COMPLETE",
    "MISSING",
    "NEEDS_SIGNATURE",
    "NEEDS_APPROVAL",
    "NOT_APPLICABLE",
    "UNKNOWN",
  ]);
  for (const status of READINESS_STATUS_ORDER) {
    assert.ok(READINESS_STATUS_LABELS[status], `${status} has no operator label`);
  }
  assert.deepEqual(
    READINESS_STATUS_ORDER.filter(isSettledStatus),
    ["COMPLETE", "NOT_APPLICABLE"],
    "an Unknown or a Needs-signature item must never count as settled",
  );
});

check("a pursuit with no checklist reads Unknown, never Ready", () => {
  const readiness = computeSubmissionReadiness({ checklist: [], approvals: [] });
  assert.equal(readiness.overall, "NO_CHECKLIST");
  assert.notEqual(readiness.overall, "READY");
  const synthetic = readiness.items.find((i) => i.key === "checklist:none");
  assert.equal(synthetic.status, "UNKNOWN");
  assert.equal(synthetic.required, true);
  assert.ok(readiness.blocking.includes(synthetic), "an unseeded checklist must block submission");
  assert.match(SUBMISSION_OVERALL_LABELS.NO_CHECKLIST, /unknown/i);
});

check("an incomplete required item cannot make the packet read Complete overall", () => {
  const readiness = computeSubmissionReadiness(
    fullyReadyInput({ checklist: seededChecklist(ALL_KEYS.filter((k) => k !== "insurance")) }),
  );
  assert.equal(readiness.overall, "NOT_READY");
  assert.equal(readiness.blocking.length, 1);
  assert.equal(readiness.blocking[0].label, "Insurance");
  assert.equal(readiness.blocking[0].status, "MISSING");
  assert.ok(
    readiness.requiredComplete < readiness.requiredTotal,
    "the required counter must not report a full house",
  );
  assert.ok(readiness.requiredCompletionPercent < 100);
});

check("required counts and per-status counts add up to the item list", () => {
  const readiness = computeSubmissionReadiness(fullyReadyInput());
  const summed = READINESS_STATUS_ORDER.reduce((acc, s) => acc + readiness.counts[s], 0);
  assert.equal(summed, readiness.items.length);
  const required = readiness.items.filter((i) => i.required && i.status !== "NOT_APPLICABLE");
  assert.equal(readiness.requiredTotal, required.length);
  assert.equal(readiness.requiredComplete, required.filter((i) => i.status === "COMPLETE").length);
  assert.equal(readiness.requiredCompletionPercent, 100);
});

check("an empty required checklist denominator does not divide by zero", () => {
  const readiness = computeSubmissionReadiness({
    checklist: [item({ item_key: "optional_extra", label: "Optional extra", required: false })],
    approvals: [],
  });
  assert.equal(readiness.requiredTotal, 0);
  assert.equal(readiness.requiredCompletionPercent, 0);
  assert.ok(Number.isFinite(readiness.requiredCompletionPercent));
});

// --------------------------------------------------------- status per item kind

check("signature and notarization items report Needs signature, not Missing", () => {
  const readiness = computeSubmissionReadiness({
    checklist: [
      item({ item_key: "signatures", label: "Signatures" }),
      item({ item_key: "notarization", label: "Notarization" }),
      item({ item_key: "attachments", label: "Attachments" }),
    ],
    approvals: [],
  });
  const byKey = new Map(readiness.items.map((i) => [i.key, i]));
  assert.equal(byKey.get("checklist:signatures").status, "NEEDS_SIGNATURE");
  assert.equal(byKey.get("checklist:notarization").status, "NEEDS_SIGNATURE");
  assert.equal(byKey.get("checklist:attachments").status, "MISSING");
  assert.match(
    byKey.get("checklist:signatures").detail,
    /does not sign/,
    "the platform must say plainly that it does not sign",
  );
  assert.equal(checklistItemKind({ item_key: "signatures", label: "Signatures" }), "SIGNATURE");
  assert.equal(checklistItemKind({ item_key: "approvals", label: "Internal approvals" }), "APPROVAL");
  assert.equal(checklistItemKind({ item_key: "insurance", label: "Insurance" }), "DOCUMENT");
});

check("a manual tick cannot fake an approval that an enabled layer has not given", () => {
  const readiness = computeSubmissionReadiness({
    checklist: [item({ item_key: "approvals", label: "Internal approvals", completed: true })],
    approvals: [approval("content", "changes_requested")],
  });
  const byKey = new Map(readiness.items.map((i) => [i.key, i]));
  assert.equal(byKey.get("checklist:approvals").status, "NEEDS_APPROVAL");
  assert.match(byKey.get("checklist:approvals").detail, /changes_requested/);
  assert.equal(byKey.get("approval:content").status, "NEEDS_APPROVAL");
});

check("with no layer enabled the approval item is an attestation, and says so", () => {
  const ticked = computeSubmissionReadiness({
    checklist: [item({ item_key: "approvals", label: "Internal approvals", completed: true })],
    approvals: [approval("content", "requested", false)],
  });
  const item1 = ticked.items.find((i) => i.key === "checklist:approvals");
  assert.equal(item1.status, "COMPLETE");
  assert.match(item1.detail, /attestation, not a recorded approval/);
  assert.deepEqual(ticked.approvalsDisabled, ["content"]);

  const unticked = computeSubmissionReadiness({
    checklist: [item({ item_key: "approvals", label: "Internal approvals", completed: false })],
    approvals: [],
  });
  assert.equal(unticked.items.find((i) => i.key === "checklist:approvals").status, "NEEDS_APPROVAL");
});

check("only enabled approval layers become required items", () => {
  const readiness = computeSubmissionReadiness(
    fullyReadyInput({
      approvals: [
        approval("content", "approved"),
        approval("compliance", "rejected"),
        approval("executive", "requested", false),
      ],
    }),
  );
  const approvalItems = readiness.items.filter((i) => i.group === "APPROVALS");
  assert.deepEqual(
    approvalItems.map((i) => i.key),
    ["approval:content", "approval:compliance"],
  );
  assert.ok(approvalItems.every((i) => i.required));
  assert.deepEqual(readiness.approvalsOutstanding, ["compliance"]);
  assert.deepEqual(readiness.approvalsDisabled, ["executive"]);
});

// ------------------------------------------------- advisory mirrors stay advisory

check("a missing pricing decision is Unknown and advisory, never a silent Complete", () => {
  for (const pricing of [undefined, null]) {
    const readiness = computeSubmissionReadiness(fullyReadyInput({ pricingDecision: pricing }));
    const row = readiness.items.find((i) => i.key === "pricing:decision");
    assert.equal(row.status, "UNKNOWN");
    assert.equal(row.required, false);
    assert.equal(row.fixOn, "pricing");
    assert.ok(readiness.advisoryOutstanding.includes(row));
    assert.ok(!readiness.blocking.includes(row), "pricing must inform, not hard-gate");
  }
  const draft = computeSubmissionReadiness(
    fullyReadyInput({ pricingDecision: { status: "DRAFT", final_bid_rate: 31, final_bid_amount: null } }),
  );
  assert.equal(draft.items.find((i) => i.key === "pricing:decision").status, "MISSING");
  const amountless = computeSubmissionReadiness(
    fullyReadyInput({
      pricingDecision: { status: "HUMAN_APPROVED", final_bid_rate: null, final_bid_amount: null },
    }),
  );
  assert.equal(amountless.items.find((i) => i.key === "pricing:decision").status, "UNKNOWN");
});

check("response coverage reads from the real progress helper and reports L&P INPUT REQUIRED", () => {
  const requirements = [
    {
      id: "r1",
      statement: "Armed coverage",
      solicitation_id: "s1",
      source_fact_id: "f1",
      mandatory: true,
      scored: false,
      weight_pct: null,
      section_ref: null,
      source_page: null,
      response_required: true,
      attachment_required: false,
      form_name: null,
      owner_name: null,
      verification_note: null,
      matrix_status: "L_AND_P_INPUT_REQUIRED",
    },
  ];
  const progress = computeResponseProgress(requirements, [
    {
      id: "resp1",
      requirement_id: "r1",
      draft_html: "",
      evidence_state: "L_AND_P_INPUT_REQUIRED",
      draft_status: "EMPTY",
      sources_used: [],
      assumptions: null,
      missing_information: "L&P INPUT REQUIRED",
      confidence: "none",
    },
  ]);
  const readiness = computeSubmissionReadiness(fullyReadyInput({ responseProgress: progress }));
  const row = readiness.items.find((i) => i.key === "response:progress");
  assert.equal(row.status, "MISSING");
  assert.match(row.detail, /L&P INPUT REQUIRED/);
  assert.equal(row.required, false);

  const none = computeSubmissionReadiness(fullyReadyInput({ responseProgress: null }));
  assert.equal(none.items.find((i) => i.key === "response:progress").status, "UNKNOWN");

  const partial = computeSubmissionReadiness(
    fullyReadyInput({
      responseProgress: { ...progress, approved: 1, totalRequirements: 3, mandatoryOutstanding: 0, lpInputRequired: 0 },
    }),
  );
  assert.equal(partial.items.find((i) => i.key === "response:progress").status, "NEEDS_APPROVAL");
});

check("unknown logistics are reported as unknown and keep Ready honest", () => {
  const readiness = computeSubmissionReadiness(fullyReadyInput({ packet: null }));
  const byKey = new Map(readiness.items.map((i) => [i.key, i]));
  assert.equal(byKey.get("logistics:method").status, "UNKNOWN");
  assert.equal(byKey.get("logistics:due").status, "UNKNOWN");
  assert.equal(readiness.overall, "READY_WITH_UNKNOWNS", "unknowns must be visible in the verdict");
  assert.equal(computeSubmissionReadiness(fullyReadyInput()).overall, "READY");
});

check("a confirmation gap only appears once something is actually submitted", () => {
  const before = computeSubmissionReadiness(fullyReadyInput());
  assert.equal(before.items.find((i) => i.key === "logistics:confirmation"), undefined);
  const after = computeSubmissionReadiness(
    fullyReadyInput({
      packet: {
        due_at: "2026-09-01T17:00:00Z",
        submission_method: "portal",
        submitted_at: "2026-09-01T16:40:00Z",
        submitted_by: "user-1",
      },
    }),
  );
  const row = after.items.find((i) => i.key === "logistics:confirmation");
  assert.equal(row.status, "MISSING");
  assert.equal(after.overall, "SUBMITTED");
  assert.equal(after.submittedBy, "user-1");
});

// ------------------------------------------------- human submission authorization

check("a blocked packet cannot be marked submitted, tick or no tick", () => {
  const readiness = computeSubmissionReadiness(
    fullyReadyInput({ checklist: seededChecklist(ALL_KEYS.filter((k) => k !== "signatures")) }),
  );
  for (const humanAuthorized of [false, true]) {
    const gate = evaluateMarkSubmittedGate({ readiness, humanAuthorized });
    assert.equal(gate.allowed, false, `authorization=${humanAuthorized} must not pass a blocked packet`);
    assert.equal(gate.code, "REQUIRED_ITEMS_INCOMPLETE");
    assert.match(gate.message, /Signatures/);
  }
});

check("an outstanding enabled approval blocks with its own code and names the layer", () => {
  const readiness = computeSubmissionReadiness(
    fullyReadyInput({
      checklist: seededChecklist(ALL_KEYS),
      approvals: [approval("content", "approved"), approval("compliance", "requested")],
    }),
  );
  const gate = evaluateMarkSubmittedGate({ readiness, humanAuthorized: true });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "APPROVALS_OUTSTANDING");
  assert.match(gate.message, /Compliance approval/);
  assert.match(gate.message, /decided by a human/i);
});

check("an unseeded checklist blocks marking submitted with its own code", () => {
  const gate = evaluateMarkSubmittedGate({
    readiness: computeSubmissionReadiness({ checklist: [], approvals: [] }),
    humanAuthorized: true,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "NO_CHECKLIST");
});

check("a fully ready packet still requires an explicit human authorization", () => {
  const readiness = computeSubmissionReadiness(fullyReadyInput());
  const unauthorized = evaluateMarkSubmittedGate({ readiness, humanAuthorized: false });
  assert.equal(unauthorized.allowed, false);
  assert.equal(unauthorized.code, "AUTHORIZATION_REQUIRED");
  assert.match(unauthorized.message, /Human submission authorization required/);
  const authorized = evaluateMarkSubmittedGate({ readiness, humanAuthorized: true });
  assert.equal(authorized.allowed, true);
  assert.equal(authorized.code, "ALLOWED");
  assert.match(authorized.message, /does not submit anything/);
  assert.match(SUBMISSION_AUTHORIZATION_LABEL, /I submitted this response/);
  assert.match(NO_AUTO_SUBMIT_NOTICE, /Nothing here submits, signs, or approves/);
});

check("re-marking an already submitted packet is refused", () => {
  const readiness = computeSubmissionReadiness(
    fullyReadyInput({
      packet: {
        due_at: "2026-09-01T17:00:00Z",
        submission_method: "portal",
        submitted_at: "2026-09-01T16:40:00Z",
        submitted_by: "user-1",
      },
    }),
  );
  const gate = evaluateMarkSubmittedGate({ readiness, humanAuthorized: true });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "ALREADY_SUBMITTED");
  assert.match(gate.message, /Capture the buyer confirmation/);
});

// ----------------------------------------------------- no autonomous submission

check("the server recomputes readiness and demands the authorization field", () => {
  const fn = sources.actions.match(
    /export async function markSubmissionSubmitted[\s\S]*?\n}\n/,
  );
  assert.ok(fn, "markSubmissionSubmitted is missing");
  const body = fn[0];
  assert.match(body, /computeSubmissionReadiness/);
  assert.match(body, /evaluateMarkSubmittedGate/);
  assert.match(body, /submission_authorized/);
  assert.match(body, /if \(!gate\.allowed\) throw new Error\(gate\.message\)/);
  assert.match(body, /submitted_by: userId/);
  assert.ok(
    !/formData\.get\("submitted_by"\)/.test(body),
    "the actor must come from the session, never from the form",
  );
});

check("the logistics save has no path to submitted_at or to stage SUBMITTED", () => {
  const fn = sources.actions.match(/export async function saveSubmissionPacket[\s\S]*?\n}\n/);
  assert.ok(fn, "saveSubmissionPacket is missing");
  const body = fn[0];
  assert.ok(!/submitted_at/.test(body), "logistics must not write a submission timestamp");
  assert.ok(!/SUBMITTED/.test(body), "logistics must not advance the pursuit stage");
  assert.ok(!/mark_submitted/.test(sources.actions), "the old implicit mark_submitted flag is gone");
});

check("no model or scheduler sits on the submission path", () => {
  for (const [name, src] of Object.entries({
    workbench: sources.workbench,
    result: sources.result,
  })) {
    assert.ok(
      !/generateObject|generateText|streamText|setInterval|setTimeout/.test(src),
      `${name} must not automate a submission or an outcome`,
    );
  }
  const submissionActions = sources.actions.match(
    /export async function markSubmissionSubmitted[\s\S]*?\n}\n/,
  )[0];
  assert.ok(!/generateObject|generateText|streamText/.test(submissionActions));
});

check("the workbench exposes exactly one authorization control and one mark submit", () => {
  assert.equal(
    (sources.workbench.match(/name="submission_authorized"/g) ?? []).length,
    1,
    "exactly one authorization checkbox",
  );
  assert.equal(
    (sources.workbench.match(/data-testid="mark-submitted"/g) ?? []).length,
    1,
    "exactly one Mark SUBMITTED submit",
  );
  assert.match(sources.workbench, /disabled=\{pending \|\| !gate\.allowed\}/);
  assert.match(sources.workbench, /markSubmissionSubmitted/);
  assert.match(sources.workbench, /NO_AUTO_SUBMIT_NOTICE/);
  assert.match(sources.workbench, /No auto-submit/);
});

check("the workbench renders the readiness strip, the blocking list, and status badges", () => {
  assert.match(sources.workbench, /data-testid="readiness-strip"/);
  assert.match(sources.workbench, /data-readiness-overall=\{readiness\.overall\}/);
  assert.match(sources.workbench, /data-testid="readiness-blocking"/);
  assert.match(sources.workbench, /data-testid="readiness-required-count"/);
  assert.match(sources.workbench, /READINESS_STATUS_LABELS\[status\]/);
  assert.match(sources.workbench, /an Unknown is never counted as Complete/);
  assert.match(sources.workbench, /computeSubmissionReadiness/);
  assert.ok(
    !/completed \? "Complete" : "Missing"/.test(sources.workbench),
    "the UI must not re-decide a status locally",
  );
});

check("approvals are mirrored read-only, with the decision route named", () => {
  assert.match(sources.workbench, /data-testid="approvals-mirror"/);
  assert.match(sources.workbench, /Mirrored read-only/);
  assert.match(sources.workbench, /nothing on this page can approve a layer/);
  assert.match(sources.workbench, /Configure \/ decide on Response/);
  assert.ok(
    !/upsertApprovalLayer/.test(sources.workbench),
    "the submission tab must not be able to write an approval",
  );
});

check("the submission page loads the approvals, pricing and progress the model needs", () => {
  assert.match(sources.submissionPage, /loadApprovalLayers/);
  assert.match(sources.submissionPage, /pricing_decisions/);
  assert.match(sources.submissionPage, /computeResponseProgress/);
  assert.match(sources.submissionPage, /submittedByLabel/);
});

// -------------------------------------------------------------- honest outputs

check("native DOCX is offered; legacy .doc stays honest; PDF stays print-only", () => {
  const outputs = describeSubmissionOutputs({
    hasResponseContent: true,
    hasApprovedContent: true,
    googleDocsUrl: null,
    googleDocsConfigured: false,
  });
  const docx = outputs.find((o) => o.kind === "NATIVE_DOCX");
  assert.ok(docx, "NATIVE_DOCX output missing");
  assert.match(docx.label, /DOCX/i);
  assert.match(docx.honestNote, /OOXML|docx package/i);
  const word = outputs.find((o) => o.kind === "WORD_HTML");
  assert.match(word.label, /Word-compatible HTML|\.doc/i);
  assert.match(word.honestNote, /legacy|Prefer native DOCX/i);
  const html = outputs.find((o) => o.kind === "HTML_PRINT");
  assert.match(html.honestNote, /does not render PDF/i);
  const pdf = outputs.find((o) => o.kind === "PDF_PRINT");
  assert.match(pdf.honestNote, /never ships fake PDF/i);
  assert.match(sources.workbench, /output-docx/);
  assert.ok(
    !/Download DOCX-compatible/.test(sources.workbench),
    "the old DOCX-compatible label must stay gone",
  );
});

check("Google Docs create/sync is gated on server token; paste URL still works", () => {
  const withoutToken = describeSubmissionOutputs({
    hasResponseContent: true,
    hasApprovedContent: true,
    googleDocsUrl: null,
    googleDocsConfigured: false,
  }).find((o) => o.kind === "GOOGLE_DOCS");
  assert.equal(withoutToken.available, false);
  assert.match(withoutToken.honestNote, /GOOGLE_DRIVE_ACCESS_TOKEN|Blocked/i);
  const withUrl = describeSubmissionOutputs({
    hasResponseContent: true,
    hasApprovedContent: true,
    googleDocsUrl: "https://docs.google.com/document/d/abc",
    googleDocsConfigured: false,
  }).find((o) => o.kind === "GOOGLE_DOCS");
  assert.equal(withUrl.available, true);
  const withToken = describeSubmissionOutputs({
    hasResponseContent: true,
    hasApprovedContent: true,
    googleDocsUrl: null,
    googleDocsConfigured: true,
  }).find((o) => o.kind === "GOOGLE_DOCS");
  assert.equal(withToken.available, true);
  assert.match(sources.workbench, /data-testid="output-gdocs"/);
});

check("an empty approved set disables assembly exports instead of shipping an empty file", () => {
  const outputs = describeSubmissionOutputs({
    hasResponseContent: false,
    hasApprovedContent: false,
    googleDocsUrl: null,
  });
  for (const kind of ["HTML_PRINT", "NATIVE_DOCX", "PORTAL_ANSWERS", "PDF_PRINT"]) {
    const output = outputs.find((o) => o.kind === kind);
    assert.equal(output.available, false, `${kind} must not be offered with no approved content`);
  }
  for (const kind of ["PRICING_WORKBOOK", "RESPONSE_TAB"]) {
    assert.equal(outputs.find((o) => o.kind === kind).available, true);
  }
  assert.match(sources.workbench, /disabled=\{!hasApprovedContent/);
});

// ----------------------------------------------------------- outcome capture

check("all six outcome states are offered and each states what it means", () => {
  assert.deepEqual(
    RESULT_OUTCOME_OPTIONS.map((o) => o.value),
    ["PENDING", "WON", "LOST", "NO_BID", "CANCELLED", "NO_AWARD"],
  );
  const meanings = sources.result.match(/const OUTCOME_MEANING[\s\S]*?\n\};/);
  assert.ok(meanings, "OUTCOME_MEANING is missing");
  for (const option of RESULT_OUTCOME_OPTIONS) {
    assert.match(meanings[0], new RegExp(`${option.value}:`), `${option.value} has no meaning copy`);
  }
  assert.match(meanings[0], /PENDING: "Submitted and no result published yet\. This is not a loss/);
  assert.match(meanings[0], /Not the same as L&P losing/);
  assert.match(sources.result, /data-testid="outcome-meaning"/);
});

check("documented buyer facts and internal analysis are separate, labelled field groups", () => {
  assert.match(RESULT_FIELD_SCOPE.DOCUMENTED, /Buyer-documented/);
  assert.match(RESULT_FIELD_SCOPE.DOCUMENTED, /Leave blank when the buyer never published it/);
  assert.match(RESULT_FIELD_SCOPE.INTERNAL, /Never sent to a buyer/);
  assert.match(sources.result, /data-testid="documented-fields"/);
  assert.match(sources.result, /data-testid="internal-fields"/);
  assert.match(sources.result, /RESULT_FIELD_SCOPE\.DOCUMENTED/);
  assert.match(sources.result, /RESULT_FIELD_SCOPE\.INTERNAL/);
  const documented = sources.result.match(/data-testid="documented-fields"[\s\S]*?<\/fieldset>/)[0];
  const internal = sources.result.match(/data-testid="internal-fields"[\s\S]*?<\/fieldset>/)[0];
  for (const name of ["documented_reason", "winner_name", "winning_price", "winning_score"]) {
    assert.match(documented, new RegExp(`name="${name}"`), `${name} belongs to the buyer record`);
    assert.ok(!new RegExp(`name="${name}"`).test(internal), `${name} must not sit in the internal group`);
  }
  for (const name of ["internal_analysis", "lessons_learned", "lp_price", "lp_score"]) {
    assert.match(internal, new RegExp(`name="${name}"`), `${name} is internal only`);
    assert.ok(!new RegExp(`name="${name}"`).test(documented), `${name} must not read as buyer-documented`);
  }
});

check("nothing in the result panel invents a price, score, rank or reason", () => {
  assert.match(sources.result, /never invent a score, price, rank, or loss reason/);
  assert.ok(
    !/defaultValue=\{0\}|defaultValue="0"/.test(sources.result),
    "an absent number must stay absent, not default to 0",
  );
  assert.match(sources.result, /Leave blank when the buyer did not name a winner/);
});

// ------------------------------------------------------- contract handoff gate

check("an award-shaped fact is recognised and an ordinary fact is not", () => {
  assert.ok(isAwardishFact({ field: "contract_number", entity: "award" }));
  assert.ok(isAwardishFact({ field: "amount_nte", entity: "not to exceed" }));
  assert.ok(isAwardishFact({ field: "purchase_order", entity: null }));
  assert.ok(isAwardishFact({ field: null, entity: "TXMAS vehicle" }));
  assert.ok(!isAwardishFact({ field: "requirement", entity: "requirement" }));
  assert.ok(!isAwardishFact({ field: "unit_price", entity: "Armed officer" }));
  assert.ok(!isAwardishFact({ field: null, entity: null }));
  assert.ok(AWARDISH_FACT_RE instanceof RegExp);
});

check("no verified award fact means no contract, and the reason says why", () => {
  const gate = evaluateContractHandoffGate({
    pursuitDocumentCount: 3,
    verifiedAwardishFactCount: 0,
    title: "Awarded contract",
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "NO_VERIFIED_AWARD_FACT");
  assert.match(gate.message, /HUMAN_VERIFIED award-shaped fact/);
  assert.match(gate.message, /a WON outcome is not evidence of a contract/);
  assert.match(gate.message, /Data Ops → Verification/);
});

check("no pursuit document is reported differently from no verified fact", () => {
  const gate = evaluateContractHandoffGate({
    pursuitDocumentCount: 0,
    verifiedAwardishFactCount: 0,
    title: "Awarded contract",
  });
  assert.equal(gate.code, "NO_PURSUIT_DOCUMENTS");
  assert.match(gate.message, /Data Ops → Intake/);
});

check("an existing contract is opened rather than duplicated", () => {
  const gate = evaluateContractHandoffGate({
    existingContractId: "c-1",
    pursuitDocumentCount: 0,
    verifiedAwardishFactCount: 0,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "EXISTING_CONTRACT");
  assert.match(gate.message, /already linked/);
  const fn = sources.actions.match(/export async function createContractFromWin[\s\S]*?\n}\n/)[0];
  assert.match(fn, /if \(existing\) \{/);
  assert.match(fn, /return existing\.id/);
  assert.match(fn, /Idempotent open/);
});

check("a blank title and a non-WON outcome are each refused with their own code", () => {
  assert.equal(
    evaluateContractHandoffGate({ title: "   ", pursuitDocumentCount: 1, verifiedAwardishFactCount: 1 }).code,
    "TITLE_REQUIRED",
  );
  const lost = evaluateContractHandoffGate({
    outcome: "LOST",
    title: "x",
    pursuitDocumentCount: 1,
    verifiedAwardishFactCount: 1,
  });
  assert.equal(lost.allowed, false);
  assert.equal(lost.code, "OUTCOME_NOT_WON");
  assert.match(lost.message, /Record the outcome as WON/);
});

check("an award fact alone is not a win — an unrecorded outcome still blocks the handoff", () => {
  const gate = evaluateContractHandoffGate({
    outcome: null,
    title: "Awarded — Arlington",
    pursuitDocumentCount: 2,
    verifiedAwardishFactCount: 3,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "OUTCOME_NOT_RECORDED");
  assert.match(gate.message, /can name any bidder, including a competitor/);
  assert.equal(
    evaluateContractHandoffGate({
      outcome: "PENDING",
      title: "x",
      pursuitDocumentCount: 1,
      verifiedAwardishFactCount: 1,
    }).code,
    "OUTCOME_NOT_WON",
  );
});

check("the contract action reads the recorded outcome and never records one itself", () => {
  const fn = sources.actions.match(/export async function createContractFromWin[\s\S]*?\n}\n/)[0];
  assert.match(fn, /from\("win_loss_reviews"\)\s*\n?\s*\.select\("outcome"\)/);
  assert.match(fn, /outcome: review\?\.outcome \?\? null/);
  assert.ok(
    !/outcome:\s*"WON"/.test(fn),
    "creating a contract must not write a WON outcome on the operator's behalf",
  );
  assert.ok(
    !/from\("win_loss_reviews"\)\s*\n?\s*\.(upsert|insert|update)\(/.test(fn),
    "creating a contract must not write the win/loss record",
  );
  assert.match(sources.result, /outcome: winLoss\?\.outcome \?\? null/);
});

check("a verified award fact on a won pursuit is the only path that opens the gate", () => {
  const gate = evaluateContractHandoffGate({
    outcome: "WON",
    title: "Awarded — Arlington",
    pursuitDocumentCount: 2,
    verifiedAwardishFactCount: 1,
  });
  assert.equal(gate.allowed, true);
  assert.equal(gate.code, "ALLOWED");
  assert.match(gate.message, /cite that fact and its document/);
});

check("the action and the panel share one gate, and the DB trigger is still the backstop", () => {
  const fn = sources.actions.match(/export async function createContractFromWin[\s\S]*?\n}\n/)[0];
  assert.match(fn, /evaluateContractHandoffGate/);
  assert.match(fn, /isAwardishFact/);
  assert.match(fn, /if \(!gate\.allowed\) throw new Error\(gate\.message\)/);
  assert.match(fn, /source_fact_id: verifiedFact\.id/);
  assert.match(sources.result, /evaluateContractHandoffGate/);
  assert.match(sources.result, /data-testid="contract-gate"/);
  assert.match(sources.result, /data-testid="contract-error"/);
  assert.match(sources.trustMigration, /contracts\.source_fact_id must reference a HUMAN_VERIFIED fact/);
  assert.match(sources.trustMigration, /create trigger contracts_require_verified_fact/);
});

check("an award row may be linked but never carries an invented amount", () => {
  const fn = sources.actions.match(/export async function createContractFromWin[\s\S]*?\n}\n/)[0];
  const awardBlock = fn.match(/from\("awards"\)\s*\n?\s*\.insert\(\{[\s\S]*?\}\);/);
  assert.ok(awardBlock, "the awards link is missing");
  for (const invented of ["amount_nte", "winner_name", "rank", "awarded_on"]) {
    assert.ok(
      !new RegExp(invented).test(awardBlock[0]),
      `${invented} must not be written from a win click`,
    );
  }
  assert.match(awardBlock[0], /source_fact_id: verifiedFact\.id/);
  assert.match(fn, /Amounts, winner and\n\s*\/\/ rank stay null/);
});

check("the result page hands the panel real verified evidence, not the outcome", () => {
  assert.match(sources.resultPage, /verification_status", "HUMAN_VERIFIED"/);
  assert.match(sources.resultPage, /isAwardishFact/);
  assert.match(sources.resultPage, /awardEvidence/);
  assert.match(sources.resultPage, /pursuitDocumentCount=\{pursuitDocIds\.length\}/);
  assert.match(sources.result, /data-testid="award-evidence"/);
  assert.match(sources.result, /ingestion\/verification\//);
});

// ---------------------------------------------------- acceptance scripts (P0)

check("the P8 acceptance scripts no longer insert an unsourced contract", () => {
  for (const [name, src] of Object.entries({ verify8: sources.verify8, phase8: sources.phase8 })) {
    const inserts = src.match(/from\("contracts"\)\s*\n?\s*\.insert\(\{[\s\S]*?\}\)/g) ?? [];
    assert.ok(inserts.length >= 2, `${name} should try both an unsourced and a sourced insert`);
    const sourced = inserts.filter((block) => /source_fact_id/.test(block));
    assert.equal(sourced.length, 1, `${name} must have exactly one sourced contract insert`);
    assert.match(src, /unsourcedContractErr/, `${name} must assert the unsourced insert is rejected`);
    assert.match(src, /AWARDISH_FACT_RE/, `${name} must mirror the award-fact filter`);
  }
  assert.match(sources.verify8, /pickVerifiedAwardFact/);
  assert.match(sources.verify8, /submitted_by: userId/);
  assert.match(sources.verify8, /anonymousSubmitBlocked/);
});

check("the submission-actor constraint exists and is documented in the migration", () => {
  assert.match(sources.authMigration, /add column if not exists submitted_by uuid references auth\.users \(id\)/);
  assert.match(sources.authMigration, /submission_packets_submitted_requires_actor/);
  assert.match(sources.authMigration, /check \(submitted_at is null or submitted_by is not null\)/);
  assert.match(sources.authMigration, /never set by automation/);
  assert.match(sources.authMigration, /add column if not exists submission_url text/);
  assert.match(sources.authMigration, /add column if not exists submission_instructions text/);
});

// ------------------------------------------------------------------- reporting

let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`PASS  ${result.name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${result.name}\n      ${result.message}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
