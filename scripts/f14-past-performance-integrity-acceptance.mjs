#!/usr/bin/env node
/**
 * F14 acceptance — Past Performance + Experience Integrity Engine.
 * Adversarial: FBI prior employer ≠ corporate; sub ≠ corporate; L&P-held = eligible;
 * unknown value blank; unsourced years not invented; retrieval by type; drafting never
 * changes attribution; AI cannot HUMAN_VERIFIED; references alone ≠ corporate PP.
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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f14-${name}-`)), "out.mjs");
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

const typesMod = await bundle("lib/experience/types.ts", "types");
const attrMod = await bundle("lib/experience/attribution.ts", "attr");
const promoteMod = await bundle("lib/experience/promote.ts", "promote");
const matchMod = await bundle("lib/experience/match.ts", "match");
const draftMod = await bundle("lib/experience/draft-attribution.ts", "draft");
const retrieveMod = await bundle("lib/experience/retrieve.ts", "retrieve");

const {
  isEligibleCorporatePastPerformance,
  isLpCorporateType,
  normalizeExperienceType,
  EXPERIENCE_TYPES,
} = typesMod;
const {
  wouldRewriteSubjectToLp,
  assertAttributionPreserved,
  validateTypeAttribution,
  assertNoInventedMetrics,
} = attrMod;
const {
  evaluateHumanVerifyGate,
  buildAiExtractedExperiencePatch,
  assertAiCannotMarkVerified,
  assertCanUseAsCorporatePastPerformance,
  evaluateExperienceInsertGate,
  classifyExperienceClaim,
} = promoteMod;
const {
  filterExperienceRecords,
  isPastPerformanceRequirement,
  partitionByExperienceType,
  corporateOnly,
  excludeNonCorporateFromCorporateQuery,
} = matchMod;
const { draftAttributionBlock, assembleTypedDraftSections, ATTRIBUTION_TEMPLATES } = draftMod;
const { referencesAloneAreNotCorporatePastPerformance } = retrieveMod;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

const migration = await readSource(root, "supabase/migrations/20260821310000_f14_experience_integrity.sql");
const matchSrc = await readSource(webRoot, "lib/experience/match.ts");
const promoteSrc = await readSource(webRoot, "lib/experience/promote.ts");
const attrSrc = await readSource(webRoot, "lib/experience/attribution.ts");
const draftSrc = await readSource(webRoot, "lib/experience/draft-attribution.ts");
const retrieveSrc = await readSource(webRoot, "lib/experience/retrieve.ts");
const toolsSrc = await readSource(webRoot, "lib/ask/tools.ts");
const agentSrc = await readSource(webRoot, "lib/ask/agent.ts");
const matchReqSrc = await readSource(webRoot, "lib/content/match-requirement.ts");
const actionsSrc = await readSource(
  webRoot,
  "app/(platform)/intelligence/content/experience-actions.ts",
);
const pageSrc = await readSource(webRoot, "app/(platform)/intelligence/content/page.tsx");
const refNote = await readSource(root, "docs/reference-repos/f14-past-performance-integrity.md").catch(
  () => "",
);
const acceptanceDoc = await readSource(
  root,
  "docs/functionality/F14_PAST_PERFORMANCE_INTEGRITY_ACCEPTANCE.md",
).catch(() => "");

function rec(partial) {
  return {
    id: "exp-1",
    organization_id: "org-a",
    experience_type: "L_AND_P_CORPORATE",
    project_or_contract_name: "Guarding services",
    attribution_language: "L&P Global Security performed this contract (Guarding services).",
    verification_status: "HUMAN_VERIFIED",
    contract_id: "c-1",
    performed_by_org: "L&P Global Security",
    source_document_id: "doc-1",
    contract_value_amount: null,
    years_of_experience: null,
    ...partial,
  };
}

// --- Adversarial classification ---
check("FBI prior employer → NOT L_AND_P_CORPORATE", () => {
  const t = classifyExperienceClaim({
    personWorkedAtPriorEmployer: true,
    lpHeldContract: false,
  });
  assert.equal(t, "MANAGEMENT_PRIOR_EXPERIENCE");
  assert.notEqual(t, "L_AND_P_CORPORATE");
  const gate = validateTypeAttribution({
    experience_type: "L_AND_P_CORPORATE",
    person_name: "Jane Doe",
    employer_name: "FBI",
    performed_by_org: "L&P Global Security",
    contract_id: "c-x",
  });
  assert.equal(gate.ok, false);
});

check("subcontractor county → NOT corporate", () => {
  const t = classifyExperienceClaim({ subcontractorPerformed: true });
  assert.equal(t, "SUBCONTRACTOR_EXPERIENCE");
  const gate = evaluateExperienceInsertGate({
    experience_type: "L_AND_P_CORPORATE",
    subcontractor_name: "County Security LLC",
    performed_by_org: "L&P Global Security",
    contract_id: "c-1",
    attribution_language: "bad rewrite",
  });
  assert.equal(gate.ok, false);
});

check("L&P-held contract → eligible corporate type", () => {
  const t = classifyExperienceClaim({ lpHeldContract: true });
  assert.equal(t, "L_AND_P_CORPORATE");
  const gate = evaluateExperienceInsertGate({
    experience_type: "L_AND_P_CORPORATE",
    contract_id: "c-1",
    performed_by_org: "L&P Global Security",
    attribution_language: "L&P Global Security performed this contract (X).",
  });
  assert.equal(gate.ok, true);
});

check("Class C / competitor rejected as corporate", () => {
  const t = classifyExperienceClaim({ lpHeldContract: true, classCOrCompetitor: true });
  assert.equal(t, "REJECT_CORPORATE");
  const gate = evaluateExperienceInsertGate({
    experience_type: "L_AND_P_CORPORATE",
    contract_id: "c-1",
    performed_by_org: "L&P Global Security",
    attribution_language: "L&P …",
    isClassCOrCompetitor: true,
  });
  assert.equal(gate.ok, false);
});

check("unknown value stays blank", () => {
  const r = rec({ contract_value_amount: null, contract_value_source: null });
  const block = draftAttributionBlock(r);
  assert.equal(block.value_display, null);
  assert.ok(!/USD\s+\d/.test(block.body));
});

check("unsourced years not invented", () => {
  const bad = assertNoInventedMetrics({ years_of_experience: 12, years_source: null });
  assert.equal(bad.ok, false);
  const ok = assertNoInventedMetrics({ years_of_experience: null, years_source: null });
  assert.equal(ok.ok, true);
  const sourced = assertNoInventedMetrics({
    years_of_experience: 5,
    years_source: "resume p.2",
  });
  assert.equal(sourced.ok, true);
});

check("unsourced contract value refused", () => {
  const bad = assertNoInventedMetrics({
    contract_value_amount: 1_000_000,
    contract_value_source: "",
  });
  assert.equal(bad.ok, false);
});

// --- Retrieval by each type ---
check("retrieval by each type — partition never merges", () => {
  const rows = [
    rec({ id: "1", experience_type: "L_AND_P_CORPORATE" }),
    rec({
      id: "2",
      experience_type: "MANAGEMENT_PRIOR_EXPERIENCE",
      person_name: "Alex",
      employer_name: "FBI",
      contract_id: null,
      performed_by_org: null,
      attribution_language:
        "Alex performed work on FBI HQ while employed by FBI — not L&P corporate past performance.",
    }),
    rec({
      id: "3",
      experience_type: "KEY_PERSONNEL_EXPERIENCE",
      person_name: "Sam",
      contract_id: null,
      performed_by_org: null,
      attribution_language: "Sam holds experience on X — attributed to the individual, not L&P corporate past performance.",
    }),
    rec({
      id: "4",
      experience_type: "SUBCONTRACTOR_EXPERIENCE",
      subcontractor_name: "County Sub",
      contract_id: null,
      performed_by_org: null,
      attribution_language:
        "County Sub performed Y as a subcontractor — not L&P corporate past performance.",
    }),
  ];
  const parts = partitionByExperienceType(rows);
  assert.equal(parts.L_AND_P_CORPORATE.length, 1);
  assert.equal(parts.MANAGEMENT_PRIOR_EXPERIENCE.length, 1);
  assert.equal(parts.KEY_PERSONNEL_EXPERIENCE.length, 1);
  assert.equal(parts.SUBCONTRACTOR_EXPERIENCE.length, 1);
  const corp = corporateOnly(rows);
  assert.equal(corp.length, 1);
  assert.equal(corp[0].experience_type, "L_AND_P_CORPORATE");
  const corpQuery = excludeNonCorporateFromCorporateQuery(rows);
  assert.equal(corpQuery.length, 1);
});

check("corporate PP excludes AI_EXTRACTED corporate rows", () => {
  const rows = [
    rec({ verification_status: "AI_EXTRACTED" }),
    rec({ id: "hv", verification_status: "HUMAN_VERIFIED" }),
  ];
  assert.equal(corporateOnly(rows).length, 1);
  assert.equal(isEligibleCorporatePastPerformance(rows[0]), false);
  assert.equal(isEligibleCorporatePastPerformance(rows[1]), true);
});

check("filter by MANAGEMENT_PRIOR does not return corporate", () => {
  const rows = [
    rec({}),
    rec({
      id: "m",
      experience_type: "MANAGEMENT_PRIOR_EXPERIENCE",
      person_name: "Alex",
      employer_name: "FBI",
      contract_id: null,
      attribution_language: "Alex … FBI — not L&P corporate past performance.",
    }),
  ];
  const matched = filterExperienceRecords(rows, {
    experienceType: "MANAGEMENT_PRIOR_EXPERIENCE",
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].record.experience_type, "MANAGEMENT_PRIOR_EXPERIENCE");
});

// --- Drafting never changes attribution ---
check("drafting never changes attribution (prior → L&P rewrite refused)", () => {
  const attr =
    "Jane Doe performed work on Contract Y while employed by FBI — not L&P corporate past performance.";
  assert.equal(
    wouldRewriteSubjectToLp({
      experienceType: "MANAGEMENT_PRIOR_EXPERIENCE",
      attributionLanguage: attr,
      proposedDraftText: "L&P Global Security performed Contract Y.",
    }),
    true,
  );
  assert.throws(() =>
    assertAttributionPreserved({
      experienceType: "MANAGEMENT_PRIOR_EXPERIENCE",
      attributionLanguage: attr,
      draftText: "L&P Global Security performed Contract Y.",
    }),
  );
});

check("draftAttributionBlock preserves attribution_language verbatim", () => {
  const attr =
    "Jane Doe performed work on Contract Y while employed by FBI — not L&P corporate past performance.";
  const r = rec({
    experience_type: "MANAGEMENT_PRIOR_EXPERIENCE",
    person_name: "Jane Doe",
    employer_name: "FBI",
    contract_id: null,
    performed_by_org: null,
    attribution_language: attr,
  });
  const block = draftAttributionBlock(r);
  assert.ok(block.body.includes(attr));
  assert.equal(block.attribution_language, attr);
  assert.ok(/not L&P corporate/i.test(block.body));
});

check("assembleTypedDraftSections keeps type headings separate", () => {
  const assembled = assembleTypedDraftSections([
    rec({}),
    rec({
      id: "s",
      experience_type: "SUBCONTRACTOR_EXPERIENCE",
      subcontractor_name: "SubCo",
      contract_id: null,
      performed_by_org: null,
      attribution_language:
        "SubCo performed Z as a subcontractor — not L&P corporate past performance.",
    }),
  ]);
  assert.equal(assembled.corporate.length, 1);
  assert.equal(assembled.subcontractor.length, 1);
  assert.match(assembled.combined_text, /L&P corporate past performance/);
  assert.match(assembled.combined_text, /Subcontractor experience \(not L&P corporate\)/);
});

// --- AI cannot HUMAN_VERIFIED ---
check("AI cannot HUMAN_VERIFIED", () => {
  const patch = buildAiExtractedExperiencePatch();
  assert.equal(patch.verification_status, "AI_EXTRACTED");
  assert.equal(patch.verified_by, null);
  assert.throws(() => assertAiCannotMarkVerified("HUMAN_VERIFIED"));
  const noActor = evaluateHumanVerifyGate({
    verificationStatus: "AI_EXTRACTED",
    verifiedBy: null,
    hasSource: true,
    experienceType: "L_AND_P_CORPORATE",
  });
  assert.equal(noActor.ok, false);
  const ok = evaluateHumanVerifyGate({
    verificationStatus: "AI_EXTRACTED",
    verifiedBy: "user-1",
    hasSource: true,
    experienceType: "L_AND_P_CORPORATE",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.verification_status, "HUMAN_VERIFIED");
});

check("assertCanUseAsCorporatePastPerformance gates", () => {
  assert.equal(assertCanUseAsCorporatePastPerformance(rec({})).ok, true);
  assert.equal(
    assertCanUseAsCorporatePastPerformance(
      rec({ experience_type: "SUBCONTRACTOR_EXPERIENCE", subcontractor_name: "X" }),
    ).ok,
    false,
  );
  assert.equal(
    assertCanUseAsCorporatePastPerformance(rec({ verification_status: "AI_EXTRACTED" })).ok,
    false,
  );
});

// --- References alone ≠ corporate PP ---
check("references alone ≠ corporate PP", () => {
  const refs = [
    {
      id: "ref-1",
      organization_id: "org-a",
      experience_record_id: "exp-m",
      verification_status: "HUMAN_VERIFIED",
    },
  ];
  const prior = rec({
    id: "exp-m",
    experience_type: "MANAGEMENT_PRIOR_EXPERIENCE",
    person_name: "Jane",
    employer_name: "FBI",
    verification_status: "HUMAN_VERIFIED",
    contract_id: null,
  });
  assert.equal(referencesAloneAreNotCorporatePastPerformance(refs, prior), true);
  assert.equal(isEligibleCorporatePastPerformance(prior), false);
  assert.equal(referencesAloneAreNotCorporatePastPerformance(refs, null), true);
});

check("lp_corporate alias normalizes to L_AND_P_CORPORATE", () => {
  assert.equal(normalizeExperienceType("lp_corporate"), "L_AND_P_CORPORATE");
  assert.equal(isLpCorporateType("lp_corporate"), true);
  assert.deepEqual(EXPERIENCE_TYPES.length, 4);
});

check("isPastPerformanceRequirement detects PP language", () => {
  assert.equal(isPastPerformanceRequirement("Provide past performance examples"), true);
  assert.equal(isPastPerformanceRequirement("Describe staffing plan"), false);
});

check("ATTRIBUTION_TEMPLATES distinguish subjects", () => {
  const corp = ATTRIBUTION_TEMPLATES.L_AND_P_CORPORATE({ project: "P1" });
  const prior = ATTRIBUTION_TEMPLATES.MANAGEMENT_PRIOR_EXPERIENCE({
    project: "P1",
    person: "Jane",
    employer: "FBI",
  });
  assert.match(corp, /L&P Global Security performed/);
  assert.match(prior, /not L&P corporate/);
  assert.match(prior, /FBI/);
});

// --- Migration / wiring greps ---
check("migration defines experience_type enum with four values", () => {
  assert.match(migration, /L_AND_P_CORPORATE/);
  assert.match(migration, /MANAGEMENT_PRIOR_EXPERIENCE/);
  assert.match(migration, /KEY_PERSONNEL_EXPERIENCE/);
  assert.match(migration, /SUBCONTRACTOR_EXPERIENCE/);
  assert.match(migration, /experience_records/);
  assert.match(migration, /experience_references/);
  assert.match(migration, /promote_experience_from_contract/);
  assert.match(migration, /C_COMPETITOR_TEST/);
  assert.match(migration, /HUMAN_VERIFIED requires/);
  assert.match(migration, /experience_records_value_requires_source/);
  assert.match(migration, /experience_records_years_requires_source/);
  assert.match(migration, /experience_records_type_attribution/);
});

check("promote RPC never sets HUMAN_VERIFIED", () => {
  assert.match(migration, /'AI_EXTRACTED'/);
  assert.match(migration, /Never sets HUMAN_VERIFIED|never sets HUMAN_VERIFIED|Never HUMAN_VERIFIED/i);
  assert.ok(!/verification_status,\s*'HUMAN_VERIFIED'/.test(migration));
});

check("lib never rewrites subject to L&P", () => {
  assert.match(attrSrc, /NEVER rewrite subject to L&P|never rewrite subject to L&P/i);
  assert.match(draftSrc, /never rewrite subject to L&P/i);
  assert.match(promoteSrc, /AI\/extraction cannot set HUMAN_VERIFIED/);
  assert.match(retrieveSrc, /excludes other types|Corporate past performance only/i);
});

check("response match path prefers typed experience for PP", () => {
  assert.match(matchReqSrc, /isPastPerformanceRequirement/);
  assert.match(matchReqSrc, /experienceCitations/);
  assert.match(matchReqSrc, /attribution_language/);
  assert.match(matchReqSrc, /retrieveCorporatePastPerformance/);
});

check("Ask tool search_experience_records + agent guidance", () => {
  assert.match(toolsSrc, /search_experience_records/);
  assert.match(toolsSrc, /corporate_only/);
  assert.match(toolsSrc, /Types NEVER merge/);
  assert.match(agentSrc, /search_experience_records/);
});

check("F10 verify.promote wired for experience", () => {
  assert.match(actionsSrc, /verify\.promote/);
  assert.match(actionsSrc, /markExperienceHumanVerified/);
  assert.match(actionsSrc, /promoteExperienceFromContract/);
  assert.match(pageSrc, /ExperienceLibraryTable|Experience library/);
});

check("acceptance doc + reference note exist", () => {
  assert.match(acceptanceDoc, /F14/);
  assert.match(acceptanceDoc, /L_AND_P_CORPORATE/);
  assert.match(refNote, /OpenContracts|RFPilot|AutoRFP/i);
  assert.match(refNote, /pattern only/i);
});

const failed = results.filter((r) => !r.ok);
console.log(`F14 experience integrity: ${results.length - failed.length}/${results.length} PASS`);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.message ? ` — ${r.message}` : ""}`);
}
if (failed.length) {
  process.exitCode = 1;
}
