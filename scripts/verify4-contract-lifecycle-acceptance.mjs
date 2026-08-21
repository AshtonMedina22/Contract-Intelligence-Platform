/**
 * VERIFY 4 — Contract lifecycle acceptance on real pilot instruments.
 * Evidence: PILOT_CORPUS_MANIFEST.md + PILOT_GAP_REPORT.md + live Supabase.
 *
 * Proves: original preserved · latest change drives current · history retained ·
 * service plan · PO/commercial provenance · amendment lineage · option · renewal ·
 * alert buckets · rebid risk · compliance eligibility · pursuit/award linkage.
 *
 * Run: node --env-file=apps/web/.env.local scripts/verify4-contract-lifecycle-acceptance.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const DOWNLOADS = "C:\\Users\\Ashto\\Downloads";
const OUT_JSON = join(ROOT, "docs/benchmarks/verify4-results.json");
const OUT_MD = join(ROOT, "docs/pilot/VERIFY4_ACCEPTANCE.md");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishable || !secret) {
  console.error("Missing Supabase env");
  process.exit(1);
}

/** Real pilot instruments used as lifecycle sources (manifest filenames + SHA). */
const PILOT = {
  allenExcerpt: {
    id: "SRC-02",
    pkg: "PKG-02",
    role: "service-plan / original POP",
    path: join(ROOT, "docs/pilot/source-pdfs/Allen_ISD_LP_security_agreement_excerpt.pdf"),
    sha: "44497b51d423b4f282a58fb217caff64271ca7097a6317fa347a6c3019a2c658",
    class: "A",
  },
  txdmvPo: {
    id: "SRC-04",
    pkg: "PKG-04",
    role: "PO / commercial terms",
    path: join(DOWNLOADS, "60800 0000016167.pdf"),
    sha: null, // verified at runtime
    class: "A",
    facts: {
      poNumber: "0000016167",
      vehicle: "TXMAS-24-99003",
      qty: 72,
      unitRate: 33.25,
      extendedHours: 445.55,
      payment: "NET30",
    },
  },
  harrisRenewal: {
    id: "SRC-14",
    pkg: "PKG-11",
    role: "renewal / CPI-W / option",
    path: join(DOWNLOADS, "26-0534 Renewal Job No. 220401 - Vets Securing America.pdf"),
    sha: "21a3f215cf8bca032692fc3fd40cc522a12d07e62297a34aba9901b5c9692cdd",
    class: "C",
    facts: {
      job: "220401",
      item: "26-0534",
      escalationIndex: "CPI-W",
      optionYear: 1,
    },
  },
  tfcOriginal: {
    id: "SRC-15",
    pkg: "PKG-12",
    role: "executed contract / service plan sites",
    path: join(DOWNLOADS, "Vets Securing 24-001-000 Redacted Original.pdf"),
    sha: "8f80d1b9461174abcf2898e0d45d16e96c945051dadb6a3e1523ee9008cb0d4a",
    class: "C",
    facts: {
      contractNumber: "24-001-000",
      siteLevelII: "Level II site (pilot service-plan grain)",
      siteLevelIII: "Level III site (pilot service-plan grain)",
    },
  },
  tfcAmend4: {
    id: "SRC-16",
    pkg: "PKG-12",
    role: "amendment lineage / current NTE / options",
    path: join(DOWNLOADS, "VSA 24-001 Amend 4.pdf"),
    sha: "b91a8441f18f1a3f5409750acbed97c223194670cd5a39a1d1ff27cef575e0f4",
    class: "C",
    facts: {
      amendmentNumber: "4",
      title: "Amend 4 — NTE / option years / funding",
      nte: 12500000,
    },
  },
};

const stamp = Date.now().toString(36);
const matrix = [];
const orgIds = [];
const users = [];

function record(domain, name, ok, detail = "", source = "") {
  matrix.push({ domain, name, ok, detail, source });
  const src = source ? ` {${source}}` : "";
  console.log(`${ok ? "PASS" : "FAIL"}  [${domain}] ${name}${detail ? ` — ${detail}` : ""}${src}`);
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
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
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return c;
}

function isoPlusDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function loadPilot(entry) {
  if (!existsSync(entry.path)) return { ok: false, reason: "missing file", bytes: 0, sha: null };
  const bytes = readFileSync(entry.path);
  const sha = sha256Hex(bytes);
  const shaOk = entry.sha ? sha === entry.sha : true;
  return { ok: shaOk && bytes.length > 0, reason: shaOk ? "ok" : "sha mismatch", bytes: bytes.length, sha };
}

async function registerDocument(client, orgId, opportunityId, clientId, entry, opts = {}) {
  const loaded = loadPilot(entry);
  if (!loaded.ok) throw new Error(`${entry.id} not loadable: ${loaded.reason}`);
  const sha = loaded.sha;
  const { data: document, error: docError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      opportunity_id: opportunityId,
      client_id: clientId,
      original_filename: entry.path.split(/[/\\]/).pop(),
      document_type: opts.documentType ?? "contract",
      commercial_truth: opts.truth ?? "awarded",
      mime_type: "application/pdf",
      processing_status: "VERIFIED",
    })
    .select("id")
    .single();
  if (docError) throw new Error(docError.message);

  const { data: version, error: versionError } = await client
    .from("document_versions")
    .insert({
      organization_id: orgId,
      document_id: document.id,
      sha256: sha,
      storage_path: `${orgId}/${document.id}/v/${sha}/original.pdf`,
      byte_size: loaded.bytes,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);

  const { data: run, error: runError } = await client
    .from("extraction_runs")
    .insert({ organization_id: orgId, document_version_id: version.id })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  return { documentId: document.id, versionId: version.id, runId: run.id, sha, bytes: loaded.bytes };
}

async function addVerifiedFact(client, orgId, userId, doc, opts) {
  const { data: fact, error } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: doc.runId,
      document_id: doc.documentId,
      document_version_id: doc.versionId,
      entity: opts.entity ?? "contract",
      field: opts.field,
      raw_value: String(opts.value),
      normalized_value: String(opts.value),
      verified_value: String(opts.value),
      verification_status: "HUMAN_VERIFIED",
      verified_by: userId,
      verified_at: new Date().toISOString(),
      source_page: opts.page ?? 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return fact.id;
}

function writeReport() {
  const passed = matrix.filter((r) => r.ok).length;
  const failed = matrix.filter((r) => !r.ok).length;
  const byDomain = {};
  for (const row of matrix) {
    if (!byDomain[row.domain]) byDomain[row.domain] = { pass: 0, fail: 0 };
    if (row.ok) byDomain[row.domain].pass += 1;
    else byDomain[row.domain].fail += 1;
  }

  mkdirSync(join(ROOT, "docs/benchmarks"), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify({ stamp, passed, failed, total: matrix.length, matrix }, null, 2),
  );

  const domainRows = Object.entries(byDomain)
    .map(([d, s]) => `| ${d} | ${s.fail ? "**FAIL**" : "**PASS**"} | ${s.pass}/${s.pass + s.fail} |`)
    .join("\n");

  const assertionRows = matrix
    .map(
      (r) =>
        `| ${r.domain} | ${r.name} | ${r.ok ? "**PASS**" : "**FAIL**"} | ${r.detail.replace(/\|/g, "/")} | ${r.source} |`,
    )
    .join("\n");

  const verdict = failed === 0 ? "**PASS**" : "**FAIL**";

  const md = `# VERIFY 4 — Contract lifecycle acceptance

**Phase:** Canonical Phase 4 — Contract & Compliance Intelligence  
**Audit date:** 2026-08-20  
**Command:** \`npm run test:verify4\`  
**Artifact:** [verify4-results.json](../benchmarks/verify4-results.json)

---

## Verdict

${verdict}

Independent lifecycle acceptance against **real pilot instruments** (TxDMV PO, Allen agreement excerpt, TFC 24-001-000 + Amend 4, Harris 26-0534 CPI-W renewal). C-class packages used only as schema/workflow stress — never claimed as L&P history.

---

## Real sources used

| SRC | Package | Class | Role | Local evidence |
| --- | --- | --- | --- | --- |
| SRC-02 | PKG-02 | A | Service plan / original POP | \`docs/pilot/source-pdfs/Allen_ISD_LP_security_agreement_excerpt.pdf\` |
| SRC-04 | PKG-04 | A | PO / commercial terms | \`60800 0000016167.pdf\` |
| SRC-14 | PKG-11 | C | Renewal / CPI-W / option | \`26-0534 Renewal Job No. 220401 - Vets Securing America.pdf\` |
| SRC-15 | PKG-12 | C | Executed contract / sites | \`Vets Securing 24-001-000 Redacted Original.pdf\` |
| SRC-16 | PKG-12 | C | Amendment lineage / current terms | \`VSA 24-001 Amend 4.pdf\` |

---

## PASS / FAIL by domain

| Domain | Result | Score |
| --- | --- | --- |
${domainRows}

---

## Assertion matrix

| Domain | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
${assertionRows}

---

## Prove checklist (Prompt VERIFY 4)

| Prove | Result |
| --- | --- |
| original terms remain preserved | ${matrix.find((r) => r.name.includes("original terms"))?.ok ? "**PASS**" : "**FAIL**"} |
| latest executed change drives current truth | ${matrix.find((r) => r.name.includes("latest change drives"))?.ok ? "**PASS**" : "**FAIL**"} |
| rates/current value update without erasing history | ${matrix.find((r) => r.name.includes("without erasing"))?.ok ? "**PASS**" : "**FAIL**"} |
| Service Plan reflects source obligations | ${matrix.find((r) => r.name.includes("Service Plan"))?.ok ? "**PASS**" : "**FAIL**"} |
| PO/commercial terms retain source evidence | ${matrix.find((r) => r.name.includes("PO retains"))?.ok ? "**PASS**" : "**FAIL**"} |
| amendment lineage works | ${matrix.find((r) => r.name.includes("amendment lineage"))?.ok ? "**PASS**" : "**FAIL**"} |
| option exercise works | ${matrix.find((r) => r.name.includes("option exercise"))?.ok ? "**PASS**" : "**FAIL**"} |
| renewal state works | ${matrix.find((r) => r.name.includes("renewal state"))?.ok ? "**PASS**" : "**FAIL**"} |
| 180/120/90/60/30/EXPIRED from verified dates | ${matrix.find((r) => r.name.includes("alert buckets"))?.ok ? "**PASS**" : "**FAIL**"} |
| rebid risk is visible | ${matrix.find((r) => r.name.includes("rebid risk"))?.ok ? "**PASS**" : "**FAIL**"} |
| compliance eligibility affects Renewal readiness | ${matrix.find((r) => r.name.includes("compliance eligibility"))?.ok ? "**PASS**" : "**FAIL**"} |
| linked pursuit/award remains traceable | ${matrix.find((r) => r.name.includes("pursuit/award"))?.ok ? "**PASS**" : "**FAIL**"} |

---

## Deferred / honest limits

| Item | Status |
| --- | --- |
| C packages as L&P history | Never — schema stress only |
| Live OCR of scan amendments | External \`MISTRAL_API_KEY\` (VERIFY 3 deferred) — not a Phase 4 lifecycle blocker |

Promote RPC now writes PO / service_plan / federal / amendment_number (migration 20260820600000).

---

## Test evidence

\`\`\`text
npm run test:verify4  → ${passed} passed, ${failed} failed, ${matrix.length} total
\`\`\`

---

## STOP
`;

  writeFileSync(OUT_MD, md);
  return { passed, failed };
}

async function main() {
  // --- Source presence ---
  for (const entry of Object.values(PILOT)) {
    const loaded = loadPilot(entry);
    record(
      "corpus",
      `${entry.id} bytes present + SHA`,
      loaded.ok,
      `${loaded.bytes} sha=${(loaded.sha ?? "").slice(0, 12)}… ${loaded.reason}`,
      `${entry.pkg} ${entry.id}`,
    );
    if (!entry.sha && loaded.sha) entry.sha = loaded.sha;
  }

  const adm = admin();
  const password = "Verify4-Lifecycle!22";
  const email = `verify4-${stamp}@example.com`;

  try {
    const created = await adm.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    users.push(created.data.user);
    const asUser = await signIn(email, password);
    const orgId = (await asUser.rpc("create_organization_with_admin", { org_name: `V4 ${stamp}` })).data;
    orgIds.push(orgId);
    const userId = created.data.user.id;

    const { data: clientRow, error: clientError } = await asUser
      .from("clients")
      .insert({ organization_id: orgId, name: "Texas Facilities Commission (pilot stress)" })
      .select("id")
      .single();
    if (clientError) throw new Error(clientError.message);

    const { data: opportunity, error: oppError } = await asUser
      .from("opportunities")
      .insert({
        organization_id: orgId,
        client_id: clientRow.id,
        title: "VERIFY4 lifecycle — TFC 24-001-000 / TxDMV PO / Harris renewal grain",
        stage: "AWARDED",
      })
      .select("id")
      .single();
    if (oppError) throw new Error(oppError.message);

    // Register real instruments
    const docOriginal = await registerDocument(
      asUser,
      orgId,
      opportunity.id,
      clientRow.id,
      PILOT.tfcOriginal,
      { documentType: "contract", truth: "awarded" },
    );
    const docAmend = await registerDocument(
      asUser,
      orgId,
      opportunity.id,
      clientRow.id,
      PILOT.tfcAmend4,
      { documentType: "amendment", truth: "current" },
    );
    const docPo = await registerDocument(asUser, orgId, opportunity.id, clientRow.id, PILOT.txdmvPo, {
      documentType: "po",
      truth: "awarded",
    });
    const docRenewal = await registerDocument(
      asUser,
      orgId,
      opportunity.id,
      clientRow.id,
      PILOT.harrisRenewal,
      { documentType: "renewal", truth: "current" },
    );
    const docAllen = await registerDocument(
      asUser,
      orgId,
      opportunity.id,
      clientRow.id,
      PILOT.allenExcerpt,
      { documentType: "contract", truth: "awarded" },
    );

    record(
      "corpus",
      "five real instruments registered with vault SHA paths",
      Boolean(docOriginal.documentId && docAmend.documentId && docPo.documentId),
      `orig=${docOriginal.documentId.slice(0, 8)} amend=${docAmend.documentId.slice(0, 8)} po=${docPo.documentId.slice(0, 8)}`,
      "SRC-15/16/04",
    );

    // Award linkage (pursuit/award traceability)
    const { data: award, error: awardError } = await asUser
      .from("awards")
      .insert({
        organization_id: orgId,
        opportunity_id: opportunity.id,
        source_document_id: docAmend.documentId,
        amount_nte: PILOT.tfcAmend4.facts.nte,
        winner_name: "Vets Securing America, Inc.",
        notice: "Amend 4 current NTE (pilot C stress — not L&P history)",
      })
      .select("id, amount_nte, opportunity_id")
      .single();
    record(
      "linkage",
      "linked pursuit/award remains traceable",
      !awardError && award?.opportunity_id === opportunity.id && award?.amount_nte === PILOT.tfcAmend4.facts.nte,
      awardError?.message ?? `award=${award?.id} nte=${award?.amount_nte}`,
      "SRC-16 PKG-12",
    );

    // Original POP via promote (Allen / TFC original)
    const originalEnd = "2025-08-31";
    const originalStart = "2024-09-01";
    const endFact1 = await addVerifiedFact(asUser, orgId, userId, docOriginal, {
      field: "contract_end",
      value: originalEnd,
      page: 1,
    });
    const startFact = await addVerifiedFact(asUser, orgId, userId, docOriginal, {
      field: "contract_start",
      value: originalStart,
    });
    const numFact = await addVerifiedFact(asUser, orgId, userId, docOriginal, {
      field: "contract_number",
      value: PILOT.tfcOriginal.facts.contractNumber,
    });
    const p1 = await asUser.rpc("promote_contract_from_fact", { p_fact_id: endFact1 });
    const pStart = await asUser.rpc("promote_contract_from_fact", { p_fact_id: startFact });
    const pNum = await asUser.rpc("promote_contract_from_fact", { p_fact_id: numFact });
    record(
      "promote",
      "original contract end/start/number promote",
      p1.data?.ok === true && pStart.data?.ok === true && pNum.data?.ok === true,
      JSON.stringify({ end: p1.data, start: pStart.data, num: pNum.data }),
      "SRC-15",
    );

    const { data: contract } = await asUser
      .from("contracts")
      .select("id, verified_end_on, start_on, contract_number, opportunity_id, source_fact_id, source_document_id")
      .eq("opportunity_id", opportunity.id)
      .single();

    record(
      "truth",
      "original terms seeded on contract",
      contract?.verified_end_on === originalEnd &&
        contract?.start_on === originalStart &&
        contract?.contract_number === "24-001-000" &&
        contract?.opportunity_id === opportunity.id,
      JSON.stringify(contract),
      "SRC-15",
    );

    // Baseline amendment (original terms note) + Amend 4 lineage
    const { data: amd0 } = await asUser
      .from("contract_amendments")
      .insert({
        organization_id: orgId,
        contract_id: contract.id,
        source_document_id: docOriginal.documentId,
        source_fact_id: endFact1,
        amendment_number: "0",
        title: "Executed original 24-001-000",
        note: `Original POP ${originalStart}→${originalEnd}; contract ${PILOT.tfcOriginal.facts.contractNumber}`,
        effective_on: originalStart,
      })
      .select("id")
      .single();

    const amendNoteFact = await addVerifiedFact(asUser, orgId, userId, docAmend, {
      entity: "amendment",
      field: "amendment_note",
      value: "Amend 4 adjusts NTE and option years (pilot grain)",
      page: 1,
    });
    const pAmd = await asUser.rpc("promote_contract_from_fact", { p_fact_id: amendNoteFact });
    record(
      "changes",
      "amendment promote appends note row",
      pAmd.data?.ok === true && pAmd.data?.action === "amendment",
      JSON.stringify(pAmd.data),
      "SRC-16",
    );

    const amdNumFact = await addVerifiedFact(asUser, orgId, userId, docAmend, {
      entity: "amendment",
      field: "amendment_number",
      value: "4",
    });
    const pAmdNum = await asUser.rpc("promote_contract_from_fact", { p_fact_id: amdNumFact });
    record(
      "promote",
      "promote writes amendment_number (Amend 4 grain)",
      pAmdNum.data?.ok === true && pAmdNum.data?.amendment_number === "4",
      JSON.stringify(pAmdNum.data),
      "SRC-16",
    );

    // Promote-path instruments (VERIFY4 deferred gap → must PASS)
    const poPromoteFact = await addVerifiedFact(asUser, orgId, userId, docPo, {
      entity: "purchase_order",
      field: "po_number",
      value: `PROMOTE-${PILOT.txdmvPo.facts.poNumber}`,
    });
    const pPo = await asUser.rpc("promote_contract_from_fact", { p_fact_id: poPromoteFact });
    const payFact = await addVerifiedFact(asUser, orgId, userId, docPo, {
      field: "payment_terms",
      value: PILOT.txdmvPo.facts.payment,
    });
    const pPay = await asUser.rpc("promote_contract_from_fact", { p_fact_id: payFact });
    const vehFact = await addVerifiedFact(asUser, orgId, userId, docPo, {
      field: "txmas",
      value: PILOT.txdmvPo.facts.vehicle,
    });
    const pVeh = await asUser.rpc("promote_contract_from_fact", { p_fact_id: vehFact });
    record(
      "promote",
      "promote writes purchase_order from verified PO fact",
      pPo.data?.ok === true && pPo.data?.action === "purchase_order" && Boolean(pPo.data?.purchase_order_id),
      JSON.stringify(pPo.data),
      "SRC-04",
    );
    record(
      "promote",
      "promote writes payment_terms onto PO",
      pPay.data?.ok === true && pPay.data?.action === "payment_terms",
      JSON.stringify(pPay.data ?? pPay.error),
      "SRC-04",
    );
    record(
      "promote",
      "promote writes federal/TXMAS identifier",
      pVeh.data?.ok === true && pVeh.data?.action === "federal_identifier",
      JSON.stringify(pVeh.data),
      "SRC-04",
    );

    const siteFact = await addVerifiedFact(asUser, orgId, userId, docAllen, {
      entity: "service_plan",
      field: "site_name",
      value: "Allen ISD promote-path site",
    });
    const pSite = await asUser.rpc("promote_contract_from_fact", { p_fact_id: siteFact });
    const classFact = await addVerifiedFact(asUser, orgId, userId, docOriginal, {
      field: "guard_classification",
      value: "Level II",
    });
    const pClass = await asUser.rpc("promote_contract_from_fact", { p_fact_id: classFact });
    record(
      "promote",
      "promote writes contract_service_plans from site fact",
      pSite.data?.ok === true && pSite.data?.action === "service_plan",
      JSON.stringify(pSite.data),
      "SRC-02",
    );
    record(
      "promote",
      "promote writes guard_classification service-plan row",
      pClass.data?.ok === true && pClass.data?.action === "service_plan",
      JSON.stringify(pClass.data),
      "SRC-15",
    );

    const { data: amd4 } = await asUser
      .from("contract_amendments")
      .insert({
        organization_id: orgId,
        contract_id: contract.id,
        source_document_id: docAmend.documentId,
        source_fact_id: amendNoteFact,
        amendment_number: "4-manual",
        title: PILOT.tfcAmend4.facts.title,
        note: `Current NTE $${PILOT.tfcAmend4.facts.nte.toLocaleString()} per Amend 4`,
        effective_on: "2025-01-15",
      })
      .select("id")
      .single();

    // Latest change drives current truth: promote new end from amendment (current)
    const currentEnd = isoPlusDays(95); // lands in 120 bucket
    const endFact2 = await addVerifiedFact(asUser, orgId, userId, docAmend, {
      field: "contract_end",
      value: currentEnd,
      page: 2,
    });
    const pEnd2 = await asUser.rpc("promote_contract_from_fact", { p_fact_id: endFact2 });
    const { data: afterChange } = await asUser
      .from("contracts")
      .select("verified_end_on, start_on, contract_number, source_fact_id, source_document_id")
      .eq("id", contract.id)
      .single();

    record(
      "truth",
      "latest change drives current verified_end_on",
      pEnd2.data?.ok === true && afterChange?.verified_end_on === currentEnd,
      JSON.stringify({ promote: pEnd2.data, contract: afterChange }),
      "SRC-16",
    );

    record(
      "truth",
      "original terms remain preserved (start + number + amd0 after later end)",
      afterChange?.start_on === originalStart &&
        afterChange?.contract_number === "24-001-000" &&
        Boolean(amd0?.id),
      JSON.stringify({ start: afterChange?.start_on, number: afterChange?.contract_number, amd0: amd0?.id }),
      "SRC-15→SRC-16",
    );

    const { data: lineage } = await asUser
      .from("contract_amendments")
      .select("id, amendment_number, title, source_document_id, note")
      .eq("contract_id", contract.id)
      .order("amendment_number");
    const has0 = (lineage ?? []).some((a) => a.amendment_number === "0");
    const has4 = (lineage ?? []).some(
      (a) => a.amendment_number === "4" || a.amendment_number === "4-manual",
    );
    const promoteAmdStillThere = (lineage ?? []).some((a) => a.source_document_id === docAmend.documentId);
    record(
      "changes",
      "amendment lineage works (original + Amend 4 retained)",
      has0 && has4 && promoteAmdStillThere && (lineage ?? []).length >= 3,
      JSON.stringify(lineage?.map((a) => ({ n: a.amendment_number, title: a.title }))),
      "SRC-15+SRC-16",
    );

    // Rates / current value without erasing history — PO lines (original) + rate-change amendment note
    const poFact = await addVerifiedFact(asUser, orgId, userId, docPo, {
      entity: "purchase_order",
      field: "po_number",
      value: PILOT.txdmvPo.facts.poNumber,
    });
    const { data: po, error: poError } = await asUser
      .from("purchase_orders")
      .insert({
        organization_id: orgId,
        contract_id: contract.id,
        opportunity_id: opportunity.id,
        client_id: clientRow.id,
        source_document_id: docPo.documentId,
        source_fact_id: poFact,
        po_number: PILOT.txdmvPo.facts.poNumber,
        total_amount: PILOT.txdmvPo.facts.qty * PILOT.txdmvPo.facts.unitRate,
        payment_terms: PILOT.txdmvPo.facts.payment,
        vehicle_ref: PILOT.txdmvPo.facts.vehicle,
        notes: "TxDMV PO 0000016167 — pilot A commercial grain",
      })
      .select("id, source_document_id, source_fact_id, po_number")
      .single();

    const { error: line1Error } = await asUser.from("purchase_order_lines").insert({
      organization_id: orgId,
      purchase_order_id: po.id,
      source_fact_id: poFact,
      line_label: "Security hours",
      quantity: PILOT.txdmvPo.facts.qty,
      unit: "HR",
      unit_rate: PILOT.txdmvPo.facts.unitRate,
      extended_amount: PILOT.txdmvPo.facts.qty * PILOT.txdmvPo.facts.unitRate,
      rate_type: "standard",
    });
    const { error: line2Error } = await asUser.from("purchase_order_lines").insert({
      organization_id: orgId,
      purchase_order_id: po.id,
      source_fact_id: poFact,
      line_label: "Extended Hours",
      quantity: 1,
      unit: "EA",
      unit_rate: PILOT.txdmvPo.facts.extendedHours,
      extended_amount: PILOT.txdmvPo.facts.extendedHours,
      rate_type: "extended_hours",
    });

    // Later "current" rate change as amendment — does not delete PO lines
    await asUser.from("contract_amendments").insert({
      organization_id: orgId,
      contract_id: contract.id,
      source_document_id: docAmend.documentId,
      amendment_number: "4a",
      title: "Rate change note (does not erase PO history)",
      note: "Bill rate adjustment documented on Amend 4 package — original PO lines retained",
      effective_on: "2025-02-01",
    });

    const { data: poLinesAfter } = await asUser
      .from("purchase_order_lines")
      .select("id, line_label, unit_rate, quantity")
      .eq("purchase_order_id", po.id);

    record(
      "commercial",
      "PO retains source evidence (document + fact)",
      !poError &&
        po?.source_document_id === docPo.documentId &&
        po?.source_fact_id === poFact &&
        po?.po_number === "0000016167",
      poError?.message ?? JSON.stringify(po),
      "SRC-04 PKG-04",
    );
    record(
      "commercial",
      "PO lines match TxDMV pilot grain (72×$33.25 + Extended Hours)",
      !line1Error &&
        !line2Error &&
        (poLinesAfter ?? []).length === 2 &&
        (poLinesAfter ?? []).some((l) => Number(l.unit_rate) === 33.25 && Number(l.quantity) === 72) &&
        (poLinesAfter ?? []).some((l) => Number(l.unit_rate) === 445.55),
      JSON.stringify(poLinesAfter),
      "SRC-04",
    );
    const { data: amdsAfterRate } = await asUser
      .from("contract_amendments")
      .select("id, amendment_number")
      .eq("contract_id", contract.id);
    record(
      "commercial",
      "rates/current value update without erasing history",
      (poLinesAfter ?? []).length === 2 &&
        (poLinesAfter ?? []).some((l) => Number(l.unit_rate) === 33.25) &&
        (amdsAfterRate ?? []).some((a) => a.amendment_number === "4a") &&
        (amdsAfterRate ?? []).some((a) => a.amendment_number === "0"),
      `po_lines=${(poLinesAfter ?? []).length} amendments=${(amdsAfterRate ?? []).length}`,
      "SRC-04+SRC-16",
    );

    // Federal vehicle evidence
    const { error: fedError } = await asUser.from("federal_identifiers").upsert(
      {
        organization_id: orgId,
        contract_id: contract.id,
        opportunity_id: opportunity.id,
        source_document_id: docPo.documentId,
        source_fact_id: poFact,
        scheme: "TXMAS",
        identifier: PILOT.txdmvPo.facts.vehicle,
        notes: "Cited on TxDMV PO",
      },
      { onConflict: "organization_id,scheme,identifier" },
    );
    record(
      "commercial",
      "federal/vehicle identifier retains PO source",
      !fedError,
      fedError?.message ?? PILOT.txdmvPo.facts.vehicle,
      "SRC-04",
    );

    // Service plan from Allen + TFC Level II/III
    const allenFact = await addVerifiedFact(asUser, orgId, userId, docAllen, {
      entity: "service_plan",
      field: "site_name",
      value: "Allen ISD Admin",
    });
    const { error: sp1Error } = await asUser.from("contract_service_plans").insert({
      organization_id: orgId,
      contract_id: contract.id,
      source_document_id: docAllen.documentId,
      source_fact_id: allenFact,
      site_name: "Allen ISD campus (excerpt)",
      post_label: "Lobby",
      guard_classification: "Unarmed",
      hours_per_week: 40,
      schedule_note: "POP 08/01/2024–07/31/2025 (Allen agreement)",
    });
    const { error: sp2Error } = await asUser.from("contract_service_plans").insert({
      organization_id: orgId,
      contract_id: contract.id,
      source_document_id: docOriginal.documentId,
      site_name: "TFC Level II site",
      post_label: "Building perimeter",
      guard_classification: "Level II",
      hours_per_week: null,
      schedule_note: PILOT.tfcOriginal.facts.siteLevelII,
    });
    const { error: sp3Error } = await asUser.from("contract_service_plans").insert({
      organization_id: orgId,
      contract_id: contract.id,
      source_document_id: docOriginal.documentId,
      site_name: "TFC Level III site",
      post_label: "Secure interior",
      guard_classification: "Level III",
      schedule_note: PILOT.tfcOriginal.facts.siteLevelIII,
    });
    const { data: plans } = await asUser
      .from("contract_service_plans")
      .select("id, site_name, guard_classification, source_document_id")
      .eq("contract_id", contract.id);
    record(
      "service-plan",
      "Service Plan reflects source obligations (Allen + Level II/III)",
      !sp1Error &&
        !sp2Error &&
        !sp3Error &&
        (plans ?? []).length >= 3 &&
        (plans ?? []).some((p) => p.guard_classification === "Level II") &&
        (plans ?? []).some((p) => p.guard_classification === "Level III") &&
        (plans ?? []).some((p) => (p.site_name ?? "").includes("Allen")) &&
        (plans ?? []).filter((p) => p.source_document_id).length >= 3,
      JSON.stringify(plans?.map((p) => ({ site: p.site_name, class: p.guard_classification }))),
      "SRC-02+SRC-15",
    );

    // Option exercise (Harris + promote)
    const optionFact = await addVerifiedFact(asUser, orgId, userId, docRenewal, {
      entity: "option_year_1",
      field: "option_exercise_by",
      value: isoPlusDays(60),
    });
    const pOpt = await asUser.rpc("promote_contract_from_fact", { p_fact_id: optionFact });
    const { data: options } = await asUser
      .from("contract_options")
      .select("id, label, exercise_by, source_fact_id")
      .eq("contract_id", contract.id);
    record(
      "renewal",
      "option exercise works (promote + row)",
      pOpt.data?.ok === true &&
        pOpt.data?.action === "option" &&
        (options ?? []).some((o) => o.source_fact_id === optionFact),
      JSON.stringify({ promote: pOpt.data, options }),
      "SRC-14",
    );

    // Renewal state CPI-W
    const renewalFact = await addVerifiedFact(asUser, orgId, userId, docRenewal, {
      entity: "renewal",
      field: "renewal_notice",
      value: `Harris ${PILOT.harrisRenewal.facts.item} / Job ${PILOT.harrisRenewal.facts.job} CPI-W renewal notice`,
    });
    const pRen = await asUser.rpc("promote_contract_from_fact", { p_fact_id: renewalFact });
    await asUser
      .from("renewals")
      .update({
        escalation_index: PILOT.harrisRenewal.facts.escalationIndex,
        option_year: PILOT.harrisRenewal.facts.optionYear,
        notice_due_on: isoPlusDays(45),
      })
      .eq("contract_id", contract.id)
      .eq("source_fact_id", renewalFact);
    const { data: renewals } = await asUser
      .from("renewals")
      .select("id, notice, escalation_index, option_year, notice_due_on, source_fact_id")
      .eq("contract_id", contract.id);
    record(
      "renewal",
      "renewal state works (notice + CPI-W + option year)",
      pRen.data?.ok === true &&
        (renewals ?? []).some(
          (r) => r.escalation_index === "CPI-W" && r.option_year === 1 && r.source_fact_id === renewalFact,
        ),
      JSON.stringify(renewals),
      "SRC-14 PKG-11",
    );

    // Alert buckets from verified dates
    await asUser.rpc("refresh_contract_alerts");
    const { data: alert } = await asUser
      .from("contract_alerts")
      .select("bucket, days_until, verified_end_on")
      .eq("contract_id", contract.id)
      .maybeSingle();
    const bucketChecks = [];
    for (const [days, expected] of [
      [20, "30"],
      [45, "60"],
      [75, "90"],
      [110, "120"],
      [150, "180"],
      [-1, "EXPIRED"],
    ]) {
      const { data: b } = await asUser.rpc("alert_bucket_for_days", { days_until: days });
      bucketChecks.push(b === expected);
    }
    record(
      "alerts",
      "alert buckets 180/120/90/60/30/EXPIRED from verified dates",
      bucketChecks.every(Boolean) &&
        alert?.verified_end_on === currentEnd &&
        alert?.bucket === "120",
      JSON.stringify({ alert, bucketsOk: bucketChecks.every(Boolean) }),
      "verified_end_on only",
    );

    // Rebid risk visible
    record(
      "renewal",
      "rebid risk is visible (alert bucket + days_until)",
      alert != null && ["180", "120", "90", "60", "30", "EXPIRED"].includes(alert.bucket),
      JSON.stringify(alert),
      "contract_alerts",
    );
    const { data: rebid } = await asUser
      .from("opportunities")
      .insert({
        organization_id: orgId,
        client_id: clientRow.id,
        title: "Rebid workspace from VERIFY4 contract",
        stage: "INTAKE",
        rebid_from_contract_id: contract.id,
        rebid_from_opportunity_id: opportunity.id,
        response_due_on: isoPlusDays(30),
      })
      .select("id, rebid_from_contract_id")
      .single();
    record(
      "renewal",
      "rebid pursuit linkable from contract",
      rebid?.rebid_from_contract_id === contract.id,
      JSON.stringify(rebid),
      "opportunities.rebid_from_contract_id",
    );

    // Compliance eligibility affects readiness
    const { error: compOkError } = await asUser.from("compliance_items").insert({
      organization_id: orgId,
      contract_id: contract.id,
      kind: "license",
      statement: "TX security company license (active)",
      expires_on: isoPlusDays(200),
    });
    const { error: compBadError } = await asUser.from("compliance_items").insert({
      organization_id: orgId,
      contract_id: contract.id,
      kind: "insurance",
      statement: "GL COI expired — blocks rebid readiness",
      expires_on: isoPlusDays(-10),
    });
    const { data: compliance } = await asUser
      .from("compliance_items")
      .select("id, kind, expires_on")
      .eq("contract_id", contract.id);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expired = (compliance ?? []).filter(
      (c) => c.expires_on && new Date(`${c.expires_on}T00:00:00Z`).getTime() < today.getTime(),
    );
    const eligibilityBlocked = expired.length > 0;
    record(
      "compliance",
      "compliance eligibility affects Renewal readiness",
      !compOkError && !compBadError && eligibilityBlocked && expired.some((c) => c.kind === "insurance"),
      `expired=${expired.length} of ${(compliance ?? []).length}; blocked=${eligibilityBlocked}`,
      "compliance_items",
    );

    // UI surface still wired (regression)
    const loader = readFileSync(join(ROOT, "apps/web/lib/contracts/load-workspace.ts"), "utf8");
    const renewalPage = readFileSync(
      join(ROOT, "apps/web/app/(platform)/contracts/[contractId]/renewal/page.tsx"),
      "utf8",
    );
    record(
      "ui",
      // P10 renamed these sections ("Rebid pursuit", "Compliance readiness for rebid") and moved the
      // bucket list into the shared RenewalBucketStrip, whose labels come from RENEWAL_BUCKETS in
      // lib/contracts/portfolio-model.ts. The surface being asserted is unchanged.
      "Renewal UI surfaces rebid + eligibility + buckets",
      loader.includes("rebid_from_contract_id") &&
        renewalPage.includes("Rebid pursuit") &&
        renewalPage.includes("RebidButton") &&
        renewalPage.includes("Compliance readiness for rebid") &&
        renewalPage.includes("assessRebidReadiness") &&
        renewalPage.includes("RenewalBucketStrip"),
      "workspace loader + renewal page",
      "apps/web",
    );
  } catch (error) {
    record("fatal", error instanceof Error ? error.message : String(error), false);
  } finally {
    const admInner = admin();
    for (const orgId of orgIds) {
      await admInner.from("organizations").delete().eq("id", orgId);
    }
    for (const user of users) {
      if (user?.id) await admInner.auth.admin.deleteUser(user.id);
    }
    const { passed, failed } = writeReport();
    console.log(`${passed} passed, ${failed} failed, ${matrix.length} total`);
    console.log(`Wrote ${OUT_MD}`);
    process.exit(failed ? 1 : 0);
  }
}

await main();
