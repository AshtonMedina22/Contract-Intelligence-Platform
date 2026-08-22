#!/usr/bin/env node
// P6 acceptance: requirement-driven Response workspace — filters, draft gates, DO_NOT_USE
// exclusion, progress math, and the rule that no automatic save may approve a response.
//
// Runs without network or database access. The real TypeScript modules are bundled with esbuild so
// the test exercises the same code the workspace renders.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const outdir = await fs.mkdtemp(path.join(os.tmpdir(), "lp-p6-"));

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

const model = await bundle("lib/opportunity/response-workspace-model.ts", "workspace-model.mjs");
const domain = await bundle("lib/opportunity/response.ts", "response.mjs");

const {
  RESPONSE_FILTERS,
  DRAFT_GATE_MESSAGES,
  LP_INPUT_REQUEST_NOTE,
  buildResponseSavePayload,
  evaluateDraftGate,
  filterRequirements,
  matchesResponseFilter,
  requirementWorkState,
  responseCompletionPercent,
  responseFilterCounts,
  responseProgressWithPercent,
  selectableDraftingSources,
} = model;

const {
  BLOCKED_REUSE_STATUSES,
  NEVER_INVENT_LP_FACTS,
  buildGroundedDraftFromHits,
  classifyEvidenceFromHits,
  computeResponseProgress,
  isDraftingAllowedSource,
  parseSourcesUsed,
} = domain;

const sources = {
  workspace: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/response-workspace.tsx"),
    "utf8",
  ),
  editor: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/response-tiptap-editor.tsx"),
    "utf8",
  ),
  sheet: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/response-source-sheet.tsx"),
    "utf8",
  ),
  matrix: await fs.readFile(
    path.join(webRoot, "components/opportunity-workspace/requirements-matrix.tsx"),
    "utf8",
  ),
  page: await fs.readFile(
    path.join(
      webRoot,
      "app/(platform)/procurement/opportunities/[opportunityId]/response/page.tsx",
    ),
    "utf8",
  ),
  actions: await fs.readFile(
    path.join(webRoot, "app/(platform)/procurement/opportunities/[opportunityId]/actions.ts"),
    "utf8",
  ),
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

function requirement(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    statement: "Provide armed coverage 24/7.",
    solicitation_id: "sol",
    source_fact_id: null,
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
    matrix_status: "OPEN",
    ...overrides,
  };
}

function response(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    requirement_id: overrides.requirement_id ?? "req",
    draft_html: "",
    evidence_state: "REVIEW_REQUIRED",
    draft_status: "EMPTY",
    sources_used: [],
    assumptions: null,
    missing_information: null,
    confidence: null,
    ...overrides,
  };
}

// ------------------------------------------------------------- left nav filters

const NAV_REQS = [
  requirement({ id: "todo", matrix_status: "OPEN" }),
  requirement({ id: "input", matrix_status: "OPEN" }),
  requirement({ id: "review", matrix_status: "DRAFTED" }),
  requirement({ id: "approved", matrix_status: "APPROVED" }),
  requirement({ id: "optional-scored", mandatory: false, scored: true, weight_pct: 20 }),
];
const NAV_RESPONSES = [
  response({ requirement_id: "input", evidence_state: "L_AND_P_INPUT_REQUIRED" }),
  response({
    requirement_id: "review",
    evidence_state: "REVIEW_REQUIRED",
    draft_status: "DRAFT",
    draft_html: "<p>Drafted from reviewed passages.</p>",
  }),
  response({
    requirement_id: "approved",
    evidence_state: "VERIFIED_DRAFT_AVAILABLE",
    draft_status: "APPROVED",
    draft_html: "<p>Approved.</p>",
  }),
];

check("the six required filters plus Scored are offered, in operator order", () => {
  assert.deepEqual(
    RESPONSE_FILTERS.map((f) => f.label),
    ["All", "To Do", "Input Required", "Review", "Approved", "Mandatory", "Scored"],
  );
});

check("each requirement lands in exactly one work-state bucket", () => {
  const byId = new Map(NAV_RESPONSES.map((r) => [r.requirement_id, r]));
  assert.equal(requirementWorkState(NAV_REQS[0], byId.get("todo")), "TODO");
  assert.equal(requirementWorkState(NAV_REQS[1], byId.get("input")), "INPUT_REQUIRED");
  assert.equal(requirementWorkState(NAV_REQS[2], byId.get("review")), "REVIEW");
  assert.equal(requirementWorkState(NAV_REQS[3], byId.get("approved")), "APPROVED");
});

check("approval outranks every other state, and L&P input outranks review", () => {
  const req = requirement({ id: "x", matrix_status: "L_AND_P_INPUT_REQUIRED" });
  const approved = response({
    requirement_id: "x",
    evidence_state: "L_AND_P_INPUT_REQUIRED",
    draft_status: "APPROVED",
  });
  assert.equal(requirementWorkState(req, approved), "APPROVED");
  const drafted = response({
    requirement_id: "x",
    evidence_state: "L_AND_P_INPUT_REQUIRED",
    draft_status: "DRAFT",
    draft_html: "<p>text</p>",
  });
  assert.equal(requirementWorkState(req, drafted), "INPUT_REQUIRED");
});

check("filters select the rows they name and nothing else", () => {
  const ids = (filter) => filterRequirements(NAV_REQS, NAV_RESPONSES, filter).map((r) => r.id);
  assert.deepEqual(ids("ALL"), ["todo", "input", "review", "approved", "optional-scored"]);
  assert.deepEqual(ids("TODO"), ["todo", "optional-scored"]);
  assert.deepEqual(ids("INPUT_REQUIRED"), ["input"]);
  assert.deepEqual(ids("REVIEW"), ["review"]);
  assert.deepEqual(ids("APPROVED"), ["approved"]);
  assert.deepEqual(ids("MANDATORY"), ["todo", "input", "review", "approved"]);
  assert.deepEqual(ids("SCORED"), ["optional-scored"]);
});

check("filter counts match the filtered lists", () => {
  const counts = responseFilterCounts(NAV_REQS, NAV_RESPONSES);
  for (const { key } of RESPONSE_FILTERS) {
    assert.equal(
      counts[key],
      filterRequirements(NAV_REQS, NAV_RESPONSES, key).length,
      `count mismatch for ${key}`,
    );
  }
  assert.equal(counts.ALL, 5);
});

check("Mandatory and Scored cut across work state rather than replacing it", () => {
  const req = requirement({ id: "m", mandatory: true, scored: true, matrix_status: "APPROVED" });
  assert.equal(matchesResponseFilter("MANDATORY", req, undefined), true);
  assert.equal(matchesResponseFilter("SCORED", req, undefined), true);
  assert.equal(matchesResponseFilter("APPROVED", req, undefined), true);
  assert.equal(matchesResponseFilter("TODO", req, undefined), false);
});

// ----------------------------------------------------------------- draft gates

const ALLOWED_SOURCES = [
  { chunk_id: "c1", reuse_status: "APPROVED" },
  { chunk_id: "c2", reuse_status: "REVIEW_REQUIRED" },
];
const BLOCKED_SOURCE = { chunk_id: "bad", reuse_status: "DO_NOT_USE" };

function gate(overrides = {}) {
  return evaluateDraftGate({
    requirementId: "req",
    evidenceState: "VERIFIED_DRAFT_AVAILABLE",
    draftStatus: "DRAFT",
    availableSources: ALLOWED_SOURCES,
    selectedSourceIds: [],
    acknowledgeLpInput: false,
    ...overrides,
  });
}

check("generation is disabled while evidence state is L&P INPUT REQUIRED", () => {
  const result = gate({ evidenceState: "L_AND_P_INPUT_REQUIRED" });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "LP_INPUT_REQUIRED");
  assert.match(result.message, /would be invented/);
  assert.match(result.message, /Request L&P input/);
});

check("the L&P override is a hard warning, never a licence to invent", () => {
  const result = gate({ evidenceState: "L_AND_P_INPUT_REQUIRED", acknowledgeLpInput: true });
  assert.equal(result.allowed, true);
  assert.equal(result.code, "LP_INPUT_ACKNOWLEDGED");
  assert.match(result.message, /stays L&P INPUT REQUIRED/);
  assert.match(result.message, /never invent/i);
});

check("REVIEW_REQUIRED demands an explicit source selection before generating", () => {
  const blocked = gate({ evidenceState: "REVIEW_REQUIRED" });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, "SOURCE_SELECTION_REQUIRED");
  const allowed = gate({ evidenceState: "REVIEW_REQUIRED", selectedSourceIds: ["c2"] });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.code, "ALLOWED");
});

check("VERIFIED_DRAFT_AVAILABLE needs no manual selection", () => {
  const result = gate({ evidenceState: "VERIFIED_DRAFT_AVAILABLE" });
  assert.equal(result.allowed, true);
  assert.equal(result.code, "ALLOWED");
});

check("a DO_NOT_USE passage can never be selected into drafting", () => {
  const result = gate({
    availableSources: [...ALLOWED_SOURCES, BLOCKED_SOURCE],
    selectedSourceIds: ["c1", "bad"],
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "BLOCKED_SOURCE_SELECTED");
});

check("no acknowledgement or evidence state can unblock a DO_NOT_USE selection", () => {
  for (const evidenceState of [
    "VERIFIED_DRAFT_AVAILABLE",
    "REVIEW_REQUIRED",
    "L_AND_P_INPUT_REQUIRED",
  ]) {
    for (const acknowledgeLpInput of [false, true]) {
      const result = gate({
        evidenceState,
        acknowledgeLpInput,
        availableSources: [...ALLOWED_SOURCES, BLOCKED_SOURCE],
        selectedSourceIds: ["bad"],
      });
      assert.equal(result.allowed, false, `${evidenceState}/${acknowledgeLpInput} was allowed`);
      assert.equal(result.code, "BLOCKED_SOURCE_SELECTED");
    }
  }
});

check("a SUPERSEDED passage is blocked on the same rule as DO_NOT_USE", () => {
  const result = gate({
    availableSources: [{ chunk_id: "old", reuse_status: "SUPERSEDED" }],
    selectedSourceIds: ["old"],
  });
  assert.equal(result.code, "BLOCKED_SOURCE_SELECTED");
  assert.deepEqual([...BLOCKED_REUSE_STATUSES], ["DO_NOT_USE", "SUPERSEDED"]);
});

check("a source id that was never retrieved is rejected rather than trusted", () => {
  const result = gate({ selectedSourceIds: ["not-retrieved"] });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "BLOCKED_SOURCE_SELECTED");
});

check("an approved response is locked against silent regeneration", () => {
  const result = gate({ draftStatus: "APPROVED" });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "APPROVED_LOCKED");
  assert.match(result.message, /Reopen it for editing/);
});

check("no requirement selected means no generation", () => {
  const result = gate({ requirementId: null });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "NO_REQUIREMENT");
});

check("every gate code carries operator-readable copy", () => {
  for (const [code, message] of Object.entries(DRAFT_GATE_MESSAGES)) {
    assert.ok(message.length > 20, `${code} has no usable message`);
  }
});

check("selectable sources drop blocked reuse before the operator ever sees a checkbox", () => {
  const selectable = selectableDraftingSources([...ALLOWED_SOURCES, BLOCKED_SOURCE, {
    chunk_id: "sup",
    reuse_status: "SUPERSEDED",
  }]);
  assert.deepEqual(selectable.map((s) => s.chunk_id), ["c1", "c2"]);
  assert.equal(isDraftingAllowedSource("DO_NOT_USE"), false);
  assert.equal(isDraftingAllowedSource("SUPERSEDED"), false);
  assert.equal(isDraftingAllowedSource("APPROVED"), true);
});

// ------------------------------------------------------- DO_NOT_USE end to end

check("DO_NOT_USE-only evidence classifies as L&P INPUT REQUIRED, not a thin draft", () => {
  assert.equal(
    classifyEvidenceFromHits([{ reuse_status: "DO_NOT_USE", content: "lost bid language" }]),
    "L_AND_P_INPUT_REQUIRED",
  );
});

check("a draft built from blocked evidence returns no text and no sources", () => {
  const draft = buildGroundedDraftFromHits({
    requirementStatement: "State the guard-to-post ratio.",
    hits: [
      { chunk_id: "x", reuse_status: "DO_NOT_USE", content: "ratio 1:1" },
      { chunk_id: "y", reuse_status: "SUPERSEDED", content: "ratio 1:2" },
    ],
  });
  assert.equal(draft.evidence_state, "L_AND_P_INPUT_REQUIRED");
  assert.equal(draft.draft_response, "");
  assert.deepEqual(draft.sources_used, []);
  assert.equal(draft.confidence, "none");
  assert.match(draft.missing_information, /L&P INPUT REQUIRED/);
});

check("blocked passages are stripped from sources_used on a mixed retrieval", () => {
  const draft = buildGroundedDraftFromHits({
    requirementStatement: "Describe supervision coverage.",
    hits: [
      { chunk_id: "ok", reuse_status: "APPROVED", content: "Supervisors patrol each shift." },
      { chunk_id: "bad", reuse_status: "DO_NOT_USE", content: "never reuse this" },
    ],
  });
  assert.equal(draft.evidence_state, "VERIFIED_DRAFT_AVAILABLE");
  assert.deepEqual(draft.sources_used.map((s) => s.chunk_id), ["ok"]);
  assert.ok(!draft.draft_response.includes("never reuse this"));
});

check("sources_used read back from the database drops any blocked row", () => {
  const parsed = parseSourcesUsed([
    { chunk_id: "ok", reuse_status: "APPROVED", excerpt: "usable" },
    { chunk_id: "bad", reuse_status: "DO_NOT_USE", excerpt: "blocked" },
    { chunk_id: "", reuse_status: "APPROVED", excerpt: "no id" },
    "garbage",
    null,
  ]);
  assert.deepEqual(parsed.map((s) => s.chunk_id), ["ok"]);
  assert.deepEqual(parseSourcesUsed(null), []);
  assert.deepEqual(parseSourcesUsed({ chunk_id: "x" }), []);
});

check("the never-invent list still names every L&P fact class", () => {
  for (const fact of ["pricing", "staffing capacity", "performance metrics", "references", "certifications"]) {
    assert.ok(NEVER_INVENT_LP_FACTS.includes(fact), `missing ${fact}`);
  }
});

// --------------------------------------------------------------- progress math

check("progress counts drafted, approved, L&P input, mandatory and attachment gaps", () => {
  const progress = computeResponseProgress(NAV_REQS, NAV_RESPONSES);
  assert.equal(progress.totalRequirements, 5);
  assert.equal(progress.approved, 1);
  assert.equal(progress.drafted, 1);
  assert.equal(progress.lpInputRequired, 1);
  assert.equal(progress.mandatoryOutstanding, 2, "todo + input have no draft and are mandatory");
  assert.equal(progress.verified, 0);
});

check("completion is the approved share, so unapproved drafts are not progress", () => {
  const withPercent = responseProgressWithPercent(NAV_REQS, NAV_RESPONSES);
  assert.equal(withPercent.completionPercent, 20);
  assert.equal(
    responseCompletionPercent({ totalRequirements: 0, approved: 0 }),
    0,
    "an empty matrix is 0%, never 100%",
  );
  assert.equal(responseCompletionPercent({ totalRequirements: 4, approved: 4 }), 100);
  assert.equal(
    responseCompletionPercent({ totalRequirements: 4, approved: 0, drafted: 4 }),
    0,
    "four drafts nobody approved is still 0%",
  );
});

check("attachment-required rows stay counted until the requirement is approved", () => {
  const reqs = [
    requirement({ id: "a", attachment_required: true, matrix_status: "DRAFTED" }),
    requirement({ id: "b", attachment_required: true, matrix_status: "APPROVED" }),
  ];
  assert.equal(computeResponseProgress(reqs, []).requiredAttachmentsMissing, 1);
});

// ------------------------------------------------------- no auto-approve rule

const EXISTING = {
  evidence_state: "REVIEW_REQUIRED",
  assumptions: "human review pending",
  missing_information: "",
  confidence: "low",
};

check("autosave never carries an approve flag", () => {
  const payload = buildResponseSavePayload({
    intent: "AUTOSAVE",
    requirementId: "req",
    draftHtml: "<p>typing…</p>",
    existing: EXISTING,
  });
  assert.equal("approve" in payload, false);
  assert.equal(payload.draft_html, "<p>typing…</p>");
  assert.equal(payload.evidence_state, "REVIEW_REQUIRED");
});

check("only the explicit approve intent sets approve=1", () => {
  const intents = ["AUTOSAVE", "SAVE_DRAFT", "REOPEN", "REQUEST_LP_INPUT", "APPROVE"];
  for (const intent of intents) {
    const payload = buildResponseSavePayload({
      intent,
      requirementId: "req",
      draftHtml: "<p>body</p>",
      existing: EXISTING,
    });
    assert.equal(
      payload.approve,
      intent === "APPROVE" ? "1" : undefined,
      `${intent} produced approve=${payload.approve}`,
    );
  }
});

check("reopening an approved response saves a draft rather than re-approving it", () => {
  const payload = buildResponseSavePayload({
    intent: "REOPEN",
    requirementId: "req",
    draftHtml: "<p>edited</p>",
    existing: { ...EXISTING, evidence_state: "VERIFIED_DRAFT_AVAILABLE" },
  });
  assert.equal("approve" in payload, false);
  assert.equal(payload.evidence_state, "VERIFIED_DRAFT_AVAILABLE");
});

check("requesting L&P input sets the evidence state and never approves", () => {
  const payload = buildResponseSavePayload({
    intent: "REQUEST_LP_INPUT",
    requirementId: "req",
    draftHtml: "<p>partial</p>",
    existing: EXISTING,
  });
  assert.equal(payload.evidence_state, "L_AND_P_INPUT_REQUIRED");
  assert.equal(payload.confidence, "none");
  assert.equal(payload.missing_information, LP_INPUT_REQUEST_NOTE);
  assert.equal("approve" in payload, false);
});

check("an operator note replaces the default L&P input reason", () => {
  const payload = buildResponseSavePayload({
    intent: "REQUEST_LP_INPUT",
    requirementId: "req",
    draftHtml: "",
    existing: null,
    lpInputNote: "  Need the current TX DPS licence number.  ",
  });
  assert.equal(payload.missing_information, "Need the current TX DPS licence number.");
});

check("a requirement with no saved response defaults to L&P INPUT REQUIRED, not confident", () => {
  const payload = buildResponseSavePayload({
    intent: "SAVE_DRAFT",
    requirementId: "req",
    draftHtml: "<p>hand written</p>",
    existing: null,
  });
  assert.equal(payload.evidence_state, "L_AND_P_INPUT_REQUIRED");
});

// ------------------------------------------------------------------ UI wiring

check("the workspace renders filters, gate, and source sheet from the shared model", () => {
  assert.match(sources.workspace, /RESPONSE_FILTERS/);
  assert.match(sources.workspace, /evaluateDraftGate/);
  assert.match(sources.workspace, /buildResponseSavePayload/);
  assert.match(sources.workspace, /ResponseSourceSheet/);
  assert.match(sources.workspace, /responseProgressWithPercent/);
});

check("the workspace disables Generate on the gate result rather than on a local guess", () => {
  assert.match(sources.workspace, /data-testid="generate-draft"[\s\S]{0,240}!gate\.allowed/);
  assert.match(sources.workspace, /if \(!selected \|\| !gate\.allowed\) return;/);
});

check("autosave goes through the AUTOSAVE intent and approval stays a separate action", () => {
  assert.match(sources.workspace, /onAutosave=\{\(html\) => persist\("AUTOSAVE", html\)\}/);
  assert.match(sources.workspace, /persist\("APPROVE", draftHtml\)/);
  assert.ok(
    !/fd\.set\("approve"/.test(sources.workspace),
    "the workspace must not set approve outside buildResponseSavePayload",
  );
});

check("retrieval is re-run for the selected requirement, not only the first one", () => {
  assert.match(
    sources.workspace,
    /loadRequirementEvidence\(opportunityId, selectedId(?:, peerOpportunityId)?\)/,
  );
  assert.match(sources.actions, /export async function loadRequirementEvidence/);
  assert.match(sources.actions, /purpose: "PROPOSAL_DRAFTING"/);
});

check("the editor ships a bubble menu, debounced autosave, and Ctrl/Cmd+S", () => {
  assert.match(sources.editor, /@tiptap\/react\/menus/);
  assert.match(sources.editor, /<BubbleMenu/);
  assert.match(sources.editor, /autosaveDelayMs/);
  assert.match(sources.editor, /metaKey \|\| event\.ctrlKey/);
  assert.match(sources.editor, /SLASH_ITEMS/);
  assert.match(sources.editor, /data-testid="response-editor-status"/);
});

check("the source sheet uses the shared Sheet primitive and links to verification", () => {
  assert.match(sources.sheet, /@\/components\/ui\/sheet/);
  assert.match(sources.sheet, /\/ingestion\/verification\//);
  assert.match(sources.sheet, /DO_NOT_USE and SUPERSEDED passages are excluded/);
});

check("the requirements matrix deep-links a row into the Response workspace", () => {
  assert.match(sources.matrix, /\/response\?req=\$\{detail\.id\}/);
  assert.match(sources.page, /searchParams/);
  assert.match(sources.page, /initialRequirementId/);
});

check("the server action still strips DO_NOT_USE before assembling any draft", () => {
  // F7: defense-in-depth via isDraftingAllowedSource (DO_NOT_USE + SUPERSEDED).
  assert.match(sources.actions, /isDraftingAllowedSource/);
  assert.match(sources.actions, /matchRequirementToProposalContent|buildGroundedDraftFromHits/);
  assert.match(sources.actions, /buildGroundedDraftFromHits/);
});

check("an operator instruction cannot override the never-invent rules", () => {
  assert.match(sources.actions, /style only — it cannot override the rules above/);
  assert.match(sources.actions, /Never invent L&P pricing/);
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
