#!/usr/bin/env node
/**
 * F12 acceptance — Corporate Compliance + Government Registration / Eligibility Engine.
 * Pure match rules + greps. Never fabricates certifications. AI cannot mark verified.
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
  const outfile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `lp-f12-${name}-`)), "out.mjs");
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

const matchMod = await bundle("lib/compliance/match-rules.ts", "match");
const eligMod = await bundle("lib/compliance/eligibility.ts", "elig");
const promoteMod = await bundle("lib/compliance/promote.ts", "promote");
const typesMod = await bundle("lib/compliance/types.ts", "types");
const overviewMod = await bundle("lib/opportunity/overview-model.ts", "overview");

const { evaluateRequirementMatch, compareCoiLimits, assertCanSetVerifiedAvailable } = matchMod;
const { rollupEligibility, ELIGIBILITY_HARD_CAVEAT } = eligMod;
const {
  evaluateHumanVerifyGate,
  buildAiExtractedCredentialPatch,
  assertAiCannotMarkVerified,
  buildMatchRowFromRules,
} = promoteMod;
const { hasComplianceSource, EXPIRING_WINDOW_DAYS } = typesMod;
const { computeComplianceReadiness } = overviewMod;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

const migration = await readSource(root, "supabase/migrations/20260821300000_f12_compliance_eligibility.sql");
const f9Migration = await readSource(root, "supabase/migrations/20260821270000_f9_automation_notifications.sql");
const kindsSrc = await readSource(webRoot, "lib/automation/kinds.ts");
const actionsSrc = await readSource(webRoot, "app/(platform)/contracts/compliance/actions.ts");
const matchSrc = await readSource(webRoot, "lib/compliance/match-rules.ts");
const promoteSrc = await readSource(webRoot, "lib/compliance/promote.ts");
const pageSrc = await readSource(webRoot, "app/(platform)/contracts/compliance/page.tsx");
const refNote = await readSource(root, "docs/reference-repos/f12-compliance-eligibility.md").catch(() => "");

const today = "2026-08-21";

function item(partial) {
  return {
    id: "item-1",
    organization_id: "org-a",
    kind: "license",
    statement: "TX security license",
    expires_on: "2027-01-01",
    verification_status: "HUMAN_VERIFIED",
    source_document_id: "doc-1",
    ...partial,
  };
}

// --- active / expired / missing license ---
check("active HUMAN_VERIFIED license → VERIFIED_AVAILABLE", () => {
  const r = evaluateRequirementMatch({ inventory: item({}), today });
  assert.equal(r.match_status, "VERIFIED_AVAILABLE");
});

check("expired license → MISSING (not available)", () => {
  const r = evaluateRequirementMatch({
    inventory: item({ expires_on: "2026-01-01" }),
    today,
  });
  assert.equal(r.match_status, "MISSING");
  assert.match(r.rationale, /expired/i);
});

check("missing inventory → MISSING", () => {
  const r = evaluateRequirementMatch({ inventory: null, today });
  assert.equal(r.match_status, "MISSING");
});

// --- COI sufficient / insufficient ---
check("COI sufficient limits → VERIFIED_AVAILABLE", () => {
  const r = evaluateRequirementMatch({
    inventory: item({
      kind: "insurance",
      coverage_json: { generalLiability: 2_000_000, automobile: 1_000_000 },
    }),
    requiredCoverage: { generalLiability: 1_000_000, automobile: 500_000 },
    today,
  });
  assert.equal(r.match_status, "VERIFIED_AVAILABLE");
});

check("COI insufficient limits → INSUFFICIENT", () => {
  const { ok, gaps } = compareCoiLimits(
    { generalLiability: 2_000_000 },
    { generalLiability: 500_000 },
  );
  assert.equal(ok, false);
  assert.ok(gaps.length >= 1);
  const r = evaluateRequirementMatch({
    inventory: item({
      kind: "insurance",
      coverage_json: { generalLiability: 500_000 },
    }),
    requiredCoverage: { generalLiability: 2_000_000 },
    today,
  });
  assert.equal(r.match_status, "INSUFFICIENT");
});

check("COI missing recorded limit → INSUFFICIENT (never invent)", () => {
  const r = evaluateRequirementMatch({
    inventory: item({ kind: "insurance", coverage_json: {} }),
    requiredCoverage: { generalLiability: 1_000_000 },
    today,
  });
  assert.equal(r.match_status, "INSUFFICIENT");
});

// --- SAM active / expired ---
check("SAM active HUMAN_VERIFIED → VERIFIED_AVAILABLE", () => {
  const r = evaluateRequirementMatch({
    inventory: null,
    registration: {
      id: "reg-1",
      organization_id: "org-a",
      uei: "ABC123",
      cage: "1XYZ2",
      sam_status: "Active",
      sam_expiration_on: "2027-06-01",
      naics: ["561612"],
      psc: [],
      verification_status: "HUMAN_VERIFIED",
      source_url: "https://sam.gov/entity/ABC123",
    },
    today,
  });
  assert.equal(r.match_status, "VERIFIED_AVAILABLE");
});

check("SAM expired → MISSING", () => {
  const r = evaluateRequirementMatch({
    inventory: null,
    registration: {
      id: "reg-1",
      organization_id: "org-a",
      uei: "ABC123",
      cage: null,
      sam_status: "Expired",
      sam_expiration_on: "2025-01-01",
      naics: [],
      psc: [],
      verification_status: "HUMAN_VERIFIED",
      source_document_id: "doc-sam",
    },
    today,
  });
  assert.equal(r.match_status, "MISSING");
});

// --- multiple NAICS ---
check("multiple NAICS all present → VERIFIED_AVAILABLE", () => {
  const r = evaluateRequirementMatch({
    inventory: null,
    registration: {
      id: "reg-1",
      organization_id: "org-a",
      uei: "U1",
      cage: null,
      sam_status: "Active",
      sam_expiration_on: "2028-01-01",
      naics: ["561612", "561621"],
      psc: ["R430"],
      verification_status: "HUMAN_VERIFIED",
      source_fact_id: "fact-1",
    },
    requiredNaics: ["561612", "561621"],
    today,
  });
  assert.equal(r.match_status, "VERIFIED_AVAILABLE");
});

check("multiple NAICS one missing → INSUFFICIENT", () => {
  const r = evaluateRequirementMatch({
    inventory: null,
    registration: {
      id: "reg-1",
      organization_id: "org-a",
      uei: "U1",
      cage: null,
      sam_status: "Active",
      sam_expiration_on: "2028-01-01",
      naics: ["561612"],
      psc: [],
      verification_status: "HUMAN_VERIFIED",
      source_url: "https://example.com/sam",
    },
    requiredNaics: ["561612", "561621"],
    today,
  });
  assert.equal(r.match_status, "INSUFFICIENT");
});

// --- unknown certification ---
check("unknown / AI_EXTRACTED certification → UNKNOWN", () => {
  const r = evaluateRequirementMatch({
    inventory: item({
      kind: "certification",
      verification_status: "AI_EXTRACTED",
      statement: "Mystery cert",
    }),
    today,
  });
  assert.equal(r.match_status, "UNKNOWN");
});

// --- personnel qualification ---
check("personnel qualification HUMAN_VERIFIED → VERIFIED_AVAILABLE", () => {
  const r = evaluateRequirementMatch({
    inventory: item({
      kind: "personnel_qualification",
      holder_name: "Jane Guard",
      statement: "Level II commission",
      issuer: "TOPS",
    }),
    today,
  });
  assert.equal(r.match_status, "VERIFIED_AVAILABLE");
});

check("expiring within window → EXPIRING", () => {
  const r = evaluateRequirementMatch({
    inventory: item({ expires_on: "2026-09-01" }),
    today,
  });
  assert.equal(r.match_status, "EXPIRING");
  assert.ok(EXPIRING_WINDOW_DAYS === 60);
});

// --- source required for VERIFIED_AVAILABLE ---
check("missing source → UNKNOWN (not VERIFIED_AVAILABLE)", () => {
  const r = evaluateRequirementMatch({
    inventory: item({
      source_document_id: null,
      source_document_version_id: null,
      source_fact_id: null,
      source_url: null,
    }),
    today,
  });
  assert.equal(r.match_status, "UNKNOWN");
  assert.match(r.rationale, /source/i);
});

check("assertCanSetVerifiedAvailable refuses without source", () => {
  const g = assertCanSetVerifiedAvailable({
    verification_status: "HUMAN_VERIFIED",
    hasSource: false,
  });
  assert.equal(g.ok, false);
});

check("assertCanSetVerifiedAvailable refuses without HUMAN_VERIFIED", () => {
  const g = assertCanSetVerifiedAvailable({
    verification_status: "AI_EXTRACTED",
    hasSource: true,
  });
  assert.equal(g.ok, false);
});

// --- AI cannot mark verified ---
check("AI extract patch never HUMAN_VERIFIED", () => {
  const p = buildAiExtractedCredentialPatch();
  assert.equal(p.verification_status, "AI_EXTRACTED");
  assert.equal(p.verified_by, null);
});

check("assertAiCannotMarkVerified throws on HUMAN_VERIFIED", () => {
  assert.throws(() => assertAiCannotMarkVerified("HUMAN_VERIFIED"));
});

check("human verify gate requires actor + source", () => {
  const bad = evaluateHumanVerifyGate({
    verificationStatus: "AI_EXTRACTED",
    verifiedBy: null,
    hasSource: true,
  });
  assert.equal(bad.ok, false);
  const noSrc = evaluateHumanVerifyGate({
    verificationStatus: "AI_EXTRACTED",
    verifiedBy: "user-1",
    hasSource: false,
  });
  assert.equal(noSrc.ok, false);
  const ok = evaluateHumanVerifyGate({
    verificationStatus: "AI_EXTRACTED",
    verifiedBy: "user-1",
    hasSource: true,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.verification_status, "HUMAN_VERIFIED");
});

check("buildMatchRowFromRules demotes unsafe VERIFIED_AVAILABLE", () => {
  const row = buildMatchRowFromRules({
    requirementId: "req-1",
    inventory: item({ verification_status: "PUBLIC_UNVERIFIED" }),
    today,
  });
  assert.notEqual(row.match_status, "VERIFIED_AVAILABLE");
});

// --- eligibility rollup caveat ---
check("eligibility rollup includes hard caveat and never declares legal eligibility", () => {
  const rollup = rollupEligibility([
    { match_status: "VERIFIED_AVAILABLE" },
    { match_status: "MISSING" },
  ]);
  assert.equal(rollup.legalEligibilityDeclared, false);
  assert.equal(rollup.hardCaveat, ELIGIBILITY_HARD_CAVEAT);
  assert.match(rollup.hardCaveat, /not a legal determination/i);
  assert.equal(rollup.blocking, 1);
});

// --- overview uses match rollup when present ---
check("overview computeComplianceReadiness prefers MATCH_ROLLUP", () => {
  const r = computeComplianceReadiness({
    contractId: null,
    items: [],
    today,
    matches: [
      { match_status: "VERIFIED_AVAILABLE", rationale: "ok" },
      { match_status: "INSUFFICIENT", rationale: "limits" },
    ],
  });
  assert.equal(r.mode, "MATCH_ROLLUP");
  assert.equal(r.matchBuckets.VERIFIED_AVAILABLE, 1);
  assert.equal(r.matchBuckets.INSUFFICIENT, 1);
  assert.match(r.message, /HUMAN_VERIFIED/);
});

// --- migration / F9 reuse greps ---
check("migration creates organization_registrations + matches + alters compliance_items", () => {
  assert.match(migration, /create table if not exists public\.organization_registrations/);
  assert.match(migration, /create table if not exists public\.requirement_compliance_matches/);
  assert.match(migration, /add column if not exists verification_status/);
  assert.match(migration, /coverage_json/);
  assert.match(migration, /holder_name/);
  assert.match(migration, /personnel_qualification/);
  assert.match(migration, /HUMAN_VERIFIED requires verified_by/);
  assert.match(migration, /VERIFIED_AVAILABLE requires/);
  assert.match(migration, /mirror_sam_registration_to_compliance_item/);
  assert.match(migration, /kind = 'registration'/);
});

check("F9 compliance_expiration reused — no second scheduler in F12 migration", () => {
  assert.match(migration, /refresh_compliance_expiration_alerts/);
  assert.doesNotMatch(migration, /pg_cron|cron\.schedule|create extension.*pg_cron/i);
  assert.match(f9Migration, /refresh_compliance_expiration_alerts/);
  assert.match(kindsSrc, /compliance_expiration/);
});

check("actions use requirePermission verify.promote", () => {
  assert.match(actionsSrc, /requirePermission/);
  assert.match(actionsSrc, /verify\.promote/);
  assert.match(actionsSrc, /markComplianceItemHumanVerified/);
  assert.match(actionsSrc, /markRegistrationHumanVerified/);
});

check("UI surfaces org profile, View Source, honesty", () => {
  assert.match(pageSrc, /Organization registration profile/);
  assert.match(pageSrc, /View Source/);
  assert.match(pageSrc, /ELIGIBILITY_HARD_CAVEAT|not a legal determination/);
  assert.match(pageSrc, /Superseded|history/i);
});

check("match-rules grep-proof VERIFIED_AVAILABLE requires HUMAN_VERIFIED", () => {
  assert.match(matchSrc, /HUMAN_VERIFIED/);
  assert.match(matchSrc, /VERIFIED_AVAILABLE/);
  assert.match(promoteSrc, /AI\/extraction cannot set HUMAN_VERIFIED/);
});

check("hasComplianceSource helper", () => {
  assert.equal(hasComplianceSource({ source_url: "https://x" }), true);
  assert.equal(hasComplianceSource({}), false);
});

check("cross-tenant: org RLS policies on new tables", () => {
  assert.match(migration, /organization_registrations_select/);
  assert.match(migration, /requirement_compliance_matches_select/);
  assert.match(migration, /is_org_member\(organization_id\)/);
  // No service-role bypass in policies for authenticated
  assert.doesNotMatch(migration, /using \(true\)/);
});

check("reference note documents BidBridge/ExpiryGuard/OpenContracts licenses", () => {
  assert.match(refNote, /BidBridge/);
  assert.match(refNote, /ExpiryGuard/);
  assert.match(refNote, /OpenContracts/);
  assert.match(refNote, /MIT|license|reference/i);
});

const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok);
console.log(`F12 compliance eligibility: ${passed.length}/${results.length} PASS`);
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"} ${r.name}${r.message ? ` — ${r.message}` : ""}`);
}
if (failed.length) process.exit(1);
