#!/usr/bin/env node
/**
 * F7 acceptance: Historical Proposal Content Intelligence + Reuse Engine.
 * Pure taxonomy / extract / reuse-policy / promote gates. No invented content.
 * Won ≠ APPROVED. Lost ≠ DO_NOT_USE.
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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f7-${name}-`)), "out.mjs");
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
    external: ["@/lib/supabase/server", "@/lib/retrieval/search", "@/lib/ask/synthesize"],
  });
  return import(pathToFileURL(outfile).href);
}

const taxonomy = await bundle("lib/content/taxonomy.ts", "taxonomy");
const reuse = await bundle("lib/content/reuse-policy.ts", "reuse");
const extract = await bundle("lib/content/extract-sections.ts", "extract");
const promote = await bundle("lib/content/promote.ts", "promote");

const {
  PROPOSAL_SECTION_KEYS,
  normalizeSectionKey,
  matchHeadingToSectionKey,
  isProposalSectionKey,
} = taxonomy;
const {
  reuseStatusFromOutcome,
  canApproveReuse,
  defaultReuseAfterHumanVerify,
  isDraftingEligible,
  isEligibleForPurpose,
  canSupersede,
  assertSameTenant,
  isEmbedEligible,
} = reuse;
const { extractProposalSections } = extract;
const { evaluatePromoteGate, sectionRowFromExtracted } = promote;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

function read(rel) {
  return fs.readFile(path.join(root, rel), "utf8");
}

// --- Taxonomy ---
check("canonical taxonomy keys present", () => {
  const required = [
    "staffing",
    "management",
    "transition",
    "recruiting",
    "training",
    "quality_control",
    "emergency_response",
    "technology",
    "incident_reporting",
    "past_performance",
    "business_continuity",
    "background_screening",
    "customer_service",
  ];
  for (const k of required) assert.ok(PROPOSAL_SECTION_KEYS.includes(k), k);
  assert.equal(PROPOSAL_SECTION_KEYS.length, 13);
});

check("normalize / heading match", () => {
  assert.equal(normalizeSectionKey("Quality Control"), "quality_control");
  assert.equal(matchHeadingToSectionKey("## Staffing Plan"), "staffing");
  assert.equal(matchHeadingToSectionKey("3. Transition Plan"), "transition");
  assert.equal(isProposalSectionKey("staffing"), true);
  assert.equal(isProposalSectionKey("invented"), false);
});

// --- Extraction ---
check("section extraction for taxonomy headings", () => {
  const text = [
    "Cover letter fluff",
    "Staffing",
    "We staff licensed officers at a 1:1 ratio with posts.",
    "Management",
    "Account managers visit weekly.",
    "Transition Plan",
    "Day 1 through Day 30 mobilization schedule.",
    "Past Performance",
    "Similar work for County X.",
  ].join("\n");
  const sections = extractProposalSections({ text, documentId: "doc-1", buyerName: "Williamson" });
  const keys = sections.map((s) => s.section_key);
  assert.ok(keys.includes("staffing"));
  assert.ok(keys.includes("management"));
  assert.ok(keys.includes("transition"));
  assert.ok(keys.includes("past_performance"));
  for (const s of sections) {
    assert.equal(s.verification_status, "AI_EXTRACTED");
    assert.equal(s.reuse_status, null);
  }
});

check("page provenance preserved", () => {
  const text = "Staffing\nOfficers on site.\n\nTraining\nAnnual hours.";
  const markers = [
    { page: 4, offset: 0 },
    { page: 5, offset: text.indexOf("Training") },
  ];
  const sections = extractProposalSections({
    text,
    pageMarkers: markers,
    documentId: "d",
    opportunityId: "o",
    proposalId: "p",
    proposalVersionId: "v",
  });
  const staffing = sections.find((s) => s.section_key === "staffing");
  const training = sections.find((s) => s.section_key === "training");
  assert.ok(staffing);
  assert.ok(training);
  assert.equal(staffing.page_start, 4);
  assert.equal(training.page_start, 5);
  assert.equal(staffing.provenance.document_id, "d");
  assert.equal(staffing.provenance.opportunity_id, "o");
  assert.equal(staffing.provenance.proposal_id, "p");
  assert.equal(staffing.provenance.proposal_version_id, "v");
});

check("extraction never auto HUMAN_VERIFIED or APPROVED", () => {
  const sections = extractProposalSections({
    text: "Emergency Response\nEAP details here.",
  });
  assert.equal(sections.length, 1);
  assert.equal(sections[0].verification_status, "AI_EXTRACTED");
  assert.equal(sections[0].reuse_status, null);
  const row = sectionRowFromExtracted(sections[0], {
    organizationId: "org",
    opportunityId: "opp",
  });
  assert.equal(row.verification_status, "AI_EXTRACTED");
  assert.equal(row.reuse_status, null);
});

// --- Reuse policy / promote gates ---
check("human verification required before APPROVED", () => {
  assert.equal(canApproveReuse("AI_EXTRACTED"), false);
  assert.equal(canApproveReuse("NEEDS_REVIEW"), false);
  assert.equal(canApproveReuse("HUMAN_VERIFIED"), true);
  const refused = evaluatePromoteGate({
    verificationStatus: "AI_EXTRACTED",
    requestedReuse: "APPROVED",
  });
  assert.equal(refused.ok, false);

  const ok = evaluatePromoteGate({
    verificationStatus: "HUMAN_VERIFIED",
    requestedReuse: "APPROVED",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.reuseStatus, "APPROVED");
});

check("won content NOT auto-approved", () => {
  assert.equal(reuseStatusFromOutcome("WON"), null);
  const gate = evaluatePromoteGate({
    verificationStatus: "HUMAN_VERIFIED",
    outcomeSnapshot: "WON",
  });
  assert.equal(gate.ok, true);
  assert.equal(gate.reuseStatus, "REVIEW_REQUIRED");
  assert.equal(defaultReuseAfterHumanVerify(), "REVIEW_REQUIRED");
});

check("lost content NOT auto-rejected", () => {
  assert.equal(reuseStatusFromOutcome("LOST"), null);
  assert.equal(
    isDraftingEligible({
      verificationStatus: "HUMAN_VERIFIED",
      reuseStatus: "REVIEW_REQUIRED",
    }),
    true,
  );
  assert.equal(
    isEligibleForPurpose("PROPOSAL_DRAFTING", {
      verificationStatus: "HUMAN_VERIFIED",
      reuseStatus: "REVIEW_REQUIRED",
    }),
    true,
  );
});

check("DO_NOT_USE excluded from PROPOSAL_DRAFTING", () => {
  assert.equal(
    isEligibleForPurpose("PROPOSAL_DRAFTING", {
      verificationStatus: "HUMAN_VERIFIED",
      reuseStatus: "DO_NOT_USE",
    }),
    false,
  );
  assert.equal(
    isDraftingEligible({
      verificationStatus: "HUMAN_VERIFIED",
      reuseStatus: "DO_NOT_USE",
    }),
    false,
  );
});

check("DO_NOT_USE included for LOSS_ANALYSIS", () => {
  assert.equal(
    isEligibleForPurpose("LOSS_ANALYSIS", {
      verificationStatus: "HUMAN_VERIFIED",
      reuseStatus: "DO_NOT_USE",
      isCurrentVersion: true,
    }),
    true,
  );
});

check("SUPERSEDED excluded / prefer current for drafting", () => {
  assert.equal(
    isEligibleForPurpose("PROPOSAL_DRAFTING", {
      verificationStatus: "HUMAN_VERIFIED",
      reuseStatus: "SUPERSEDED",
    }),
    false,
  );
  assert.equal(
    isEligibleForPurpose("PROPOSAL_DRAFTING", {
      verificationStatus: "HUMAN_VERIFIED",
      reuseStatus: "APPROVED",
      isCurrentVersion: false,
    }),
    false,
  );
  const checkSup = canSupersede({
    oldOrganizationId: "a",
    newOrganizationId: "a",
    oldId: "1",
    newId: "2",
  });
  assert.equal(checkSup.ok, true);
  assert.equal(
    canSupersede({
      oldOrganizationId: "a",
      newOrganizationId: "b",
      oldId: "1",
      newId: "2",
    }).ok,
    false,
  );
});

check("similarity / embed only HUMAN_VERIFIED eligible", () => {
  assert.equal(
    isEmbedEligible({ verificationStatus: "AI_EXTRACTED", reuseStatus: "REVIEW_REQUIRED" }),
    false,
  );
  assert.equal(
    isEmbedEligible({ verificationStatus: "HUMAN_VERIFIED", reuseStatus: "REVIEW_REQUIRED" }),
    true,
  );
  assert.equal(
    isEmbedEligible({ verificationStatus: "HUMAN_VERIFIED", reuseStatus: "DO_NOT_USE" }),
    false,
  );
  assert.equal(
    isEmbedEligible({ verificationStatus: "HUMAN_VERIFIED", reuseStatus: null }),
    false,
  );
});

check("tenant scope org_id checks in policy", () => {
  assert.equal(assertSameTenant("org-a", "org-a"), true);
  assert.equal(assertSameTenant("org-a", "org-b"), false);
  assert.equal(assertSameTenant("", "org-a"), false);
});

// --- Migration / wiring greps ---
await checkAsync("migration defines runs + reuse fix + RPCs", async () => {
  const mig = await read("supabase/migrations/20260821250000_f7_proposal_content.sql");
  assert.match(mig, /proposal_content_runs/);
  assert.match(mig, /REVIEW_REQUIRED/);
  assert.match(mig, /promote_knowledge_chunk_from_fact/);
  assert.match(mig, /supersede_proposal_section/);
  assert.match(mig, /set_proposal_section_reuse/);
  assert.match(mig, /outcome_snapshot/);
  assert.match(mig, /Won ≠ auto-approve|never auto APPROVED|Never sets APPROVED from WON/i);
  assert.doesNotMatch(mig, /content_blocks/);
});

await checkAsync("response draft uses match-requirement", async () => {
  const actions = await read(
    "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/actions.ts",
  );
  assert.match(actions, /matchRequirementToProposalContent/);
  assert.match(actions, /isDraftingAllowedSource/);
});

await checkAsync("Ask stays purpose-aware without second chat surface", async () => {
  const tools = await read("apps/web/lib/ask/tools.ts");
  assert.match(tools, /search_verified_passages/);
  assert.match(tools, /PROPOSAL_DRAFTING/);
  assert.doesNotMatch(tools, /match_proposal_content/);
});

await checkAsync("content UI has taxonomy/verification/reuse filters", async () => {
  const page = await read("apps/web/app/(platform)/intelligence/content/page.tsx");
  assert.match(page, /PROPOSAL_SECTION_KEYS/);
  assert.match(page, /VERIFICATION_FILTERS/);
  assert.match(page, /REUSE_FILTERS/);
  assert.match(page, /outcome_snapshot/);
});

await checkAsync("acceptance doc + reference note exist", async () => {
  const doc = await read("docs/functionality/F7_PROPOSAL_CONTENT_INTELLIGENCE_ACCEPTANCE.md");
  assert.match(doc, /REVIEW_REQUIRED/);
  assert.match(doc, /Won/);
  const ref = await read("docs/reference-repos/rfpilot.md");
  assert.match(ref, /F7|section taxonomy|content/i);
});

// --- Summary ---
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.message ? ` — ${r.message}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
