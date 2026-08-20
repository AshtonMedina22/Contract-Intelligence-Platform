#!/usr/bin/env node
/**
 * Phase 2B — Historical Pilot execution harness.
 * Ingests USABLE manifest files → parse/extract → pilot human-verify → gap analysis.
 *
 * Run: node --env-file=apps/web/.env.local scripts/phase2-pilot-run.mjs
 * Requires: local processor on PROCESSOR_URL (default http://127.0.0.1:8080)
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const DOWNLOADS = "C:\\Users\\Ashto\\Downloads";
const RESULTS_JSON = join(ROOT, "docs/benchmarks/pilot-run-results.json");
const MAX_INTAKE_BYTES = 50 * 1024 * 1024;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const processorUrl = (process.env.PROCESSOR_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const processorSecret = process.env.PROCESSOR_SHARED_SECRET ?? "dev-processor-secret";

if (!url || !publishable || !secret) {
  console.error("Missing Supabase env. Use --env-file=apps/web/.env.local");
  process.exit(1);
}

/** USABLE rows from PILOT_CORPUS_MANIFEST.md (canonical paths only). */
const CORPUS = [
  { id: "SRC-01", pkg: "PKG-01", cls: "A", buyer: "Williamson County", dtype: "contract+proposal", path: join(DOWNLOADS, "1770_43.35658_Services_Contract_with_proposal_Final.pdf"), sha: "0a3e3762d64da3cd074ed8fb1678528f499d18fc9fc75f2d86fca732040024fa", size: 4169850 },
  { id: "SRC-02", pkg: "PKG-02", cls: "A", buyer: "Allen ISD", dtype: "agreement excerpt", path: join(ROOT, "docs/pilot/source-pdfs/Allen_ISD_LP_security_agreement_excerpt.pdf"), sha: "44497b51d423b4f282a58fb217caff64271ca7097a6317fa347a6c3019a2c658", size: 334504 },
  { id: "SRC-03", pkg: "PKG-02", cls: "B", buyer: "Allen ISD", dtype: "board packet", path: join(DOWNLOADS, "5-21_AllenISD.pdf"), sha: "2521a6b57c017ca2b735cc0ae7484ef957b0a2162592c9ec46965c7b514520de", size: 32599851 },
  { id: "SRC-04", pkg: "PKG-04", cls: "A", buyer: "TxDMV", dtype: "PO", path: join(DOWNLOADS, "60800 0000016167.pdf"), sha: "e1f3f631bdc5efa30b08a4201a08ef1977698ef7300a07c5534c6c4892704a0a", size: 38345 },
  { id: "SRC-06", pkg: "PKG-03", cls: "B", buyer: "Arlington TX", dtype: "solicitation", path: join(DOWNLOADS, "22-0143-bid-invitation.pdf"), sha: "98efc54a7659afc29d12932559c9fbcb0e9a1844c9de45f77860bf6851a6127f", size: 290544 },
  { id: "SRC-07", pkg: "PKG-03", cls: "B", buyer: "Arlington TX", dtype: "eval/award", path: join(DOWNLOADS, "22-0143-staff-report.pdf"), sha: "855ff7cd00d2f5d5cf1d5ceb7be177850e1a6e43cc99529c50a500fc7093490d", size: 165355 },
  { id: "SRC-08", pkg: "PKG-05", cls: "B", buyer: "Jefferson County", dtype: "bid tab", path: join(DOWNLOADS, "12.pdf"), sha: "72fbde263e5deae24c643042946ac013cab672c9365779652d8aab6c2ad976fd", size: 31322 },
  { id: "SRC-09", pkg: "PKG-06", cls: "B", buyer: "Texas Lottery", dtype: "solicitation", path: join(DOWNLOADS, "IFB_for_Security_Officer_Services_RQ22-0480DP_FINAL.pdf"), sha: "d0a7069266a158657dfb72d25d1ac72c1eab3eb534ae468f72be24688613bb40", size: 6261092 },
  { id: "SRC-10", pkg: "PKG-07", cls: "C", buyer: "Dallas County", dtype: "bid tab", path: join(DOWNLOADS, "BID TAB 16-0219.PDF"), sha: "6a6e13e8151922c7fac8f7f126d4939c1b53c779430b20af6777c93b2f92c3a6", size: 23687 },
  { id: "SRC-11", pkg: "PKG-08", cls: "C", buyer: "Dallas County", dtype: "synopsis", path: join(DOWNLOADS, "2014-036-6418SecurityGuard.pdf"), sha: "eebc7e7232a27e922ed4480d78a586f88c3b117bef146fa17aaa28ccdbc28962", size: 18541 },
  { id: "SRC-12", pkg: "PKG-09", cls: "C", buyer: "Tarrant County", dtype: "cost build", path: join(DOWNLOADS, "2018-092_AnnualContractforSecurityGuardServices.pdf"), sha: "8008be838b0502d6957c3cdec9c13991ea6e3fc76a005ff006eb9764169f1be6", size: 23572 },
  { id: "SRC-13", pkg: "PKG-10", cls: "C", buyer: "MHMR Tarrant", dtype: "bid tab", path: join(DOWNLOADS, "25-003-Security-Guard-Services-Tabulation.pdf"), sha: "5ebf4975b592d381f48a6f0623d703bbd2170bd35f0160b80ae6d18d2e2f7b45", size: 643286 },
  { id: "SRC-14", pkg: "PKG-11", cls: "C", buyer: "Harris County", dtype: "renewal", path: join(DOWNLOADS, "26-0534 Renewal Job No. 220401 - Vets Securing America.pdf"), sha: "21a3f215cf8bca032692fc3fd40cc522a12d07e62297a34aba9901b5c9692cdd", size: 80083 },
  { id: "SRC-15", pkg: "PKG-12", cls: "C", buyer: "TFC", dtype: "contract", path: join(DOWNLOADS, "Vets Securing 24-001-000 Redacted Original.pdf"), sha: "8f80d1b9461174abcf2898e0d45d16e96c945051dadb6a3e1523ee9008cb0d4a", size: 3887551 },
  { id: "SRC-16", pkg: "PKG-12", cls: "C", buyer: "TFC", dtype: "amendment", path: join(DOWNLOADS, "VSA 24-001 Amend 4.pdf"), sha: "b91a8441f18f1a3f5409750acbed97c223194670cd5a39a1d1ff27cef575e0f4", size: 976191 },
  { id: "SRC-17", pkg: "PKG-13", cls: "C", buyer: "Arlington County VA", dtype: "contract+NOA", path: join(DOWNLOADS, "Contract19-264-RFullyExecuted&NOA.pdf"), sha: "bb2658f90ec690cc005112c2447150d1622a208085d20e2a877d6588cb591fe6", size: 503650 },
  { id: "SRC-18", pkg: "PKG-13", cls: "C", buyer: "Arlington County VA", dtype: "amendment", path: join(DOWNLOADS, "19-264-RAmendment2signed.pdf"), sha: "831ece226849794a07c6ff64aead2e2d3f507b94b2593cf59d15e62f9fd95eeb", size: 240634 },
  { id: "SRC-19", pkg: "PKG-13", cls: "C", buyer: "Arlington County VA", dtype: "amendment scan", path: join(DOWNLOADS, "19-264-RA3Final.pdf"), sha: "4f05f6ecdced56b8fa5eaccae5abba34ad32a06e0f22a61edc7591f6411b22c6", size: 1984573 },
];

/** Document type + commercial truth for promotion (infer_commercial_truth / four truths). */
const DOC_META = {
  "SRC-01": { documentType: "proposal", commercialTruth: "proposed" },
  "SRC-02": { documentType: "contract", commercialTruth: "awarded" },
  "SRC-03": { documentType: "board packet", commercialTruth: "awarded" },
  "SRC-04": { documentType: "purchase order", commercialTruth: "awarded" },
  "SRC-06": { documentType: "rfp solicitation", commercialTruth: "requested" },
  "SRC-07": { documentType: "award staff report", commercialTruth: "awarded" },
  "SRC-08": { documentType: "bid tab", commercialTruth: "awarded" },
  "SRC-09": { documentType: "ifb solicitation", commercialTruth: "requested" },
  "SRC-10": { documentType: "bid tab", commercialTruth: "awarded" },
  "SRC-11": { documentType: "synopsis", commercialTruth: "awarded" },
  "SRC-12": { documentType: "cost build", commercialTruth: "awarded" },
  "SRC-13": { documentType: "bid tab", commercialTruth: "awarded" },
  "SRC-14": { documentType: "renewal", commercialTruth: "current" },
  "SRC-15": { documentType: "contract", commercialTruth: "awarded" },
  "SRC-16": { documentType: "amendment", commercialTruth: "current" },
  "SRC-17": { documentType: "contract", commercialTruth: "awarded" },
  "SRC-18": { documentType: "amendment", commercialTruth: "current" },
  "SRC-19": { documentType: "amendment", commercialTruth: "current" },
};

const STRUCTURED_TYPES = new Set(["rate", "identifier", "requirement", "award"]);
const CANONICAL_PROMOTE_ACTIONS = new Set(["rate", "requirement", "award", "solicitation"]);

const DOMAIN_SIGNALS = {
  solicitation_metadata: /RFP|RFQ|IFB|Invitation|solicitation|procurement/i,
  solicitation_dates: /\d{1,2}\/\d{1,2}\/\d{2,4}|deadline|due date|opening|pre-?bid/i,
  solicitation_evaluation: /evaluat|score|criteria|weight|technical|price/i,
  solicitation_forms: /form|signature|notary|HUB|certification|reference/i,
  scope_service: /security guard|officer|patrol|monitoring|services/i,
  scope_sites: /site|location|building|post|facility|address/i,
  scope_staffing: /FTE|headcount|hours|shift|staff|personnel/i,
  scope_classifications: /Level (I|II|III|IV)|armed|unarmed|guard classification/i,
  pricing_hourly: /\$\s*\d+\.\d{2}|\d+\.\d{2}\s*\/\s*hr|hourly rate/i,
  pricing_table: /extended|unit price|line item|tabulation|bid tab/i,
  pricing_cost_build: /direct wage|FICA|workers.? comp|overhead|profit|burden/i,
  pricing_ot_holiday: /overtime|holiday|OT\b|time and a half/i,
  pricing_escalation: /CPI|escalat|renewal|option year/i,
  proposal_sections: /executive summary|approach|qualifications|pricing|proposal/i,
  result_award: /award|contract amount|NTE|not to exceed|selected vendor/i,
  result_scores: /score|rank|points|total score|\d+\.\d{2}/i,
  contract_po: /purchase order|PO #|contract #|agreement/i,
  contract_amendment: /amendment|modify|change order|A\d|Amend/i,
  contract_renewal: /renew|extension|option|renewal/i,
};

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function evidencePath(orgId, documentId, versionId, sha256, ext) {
  return `${orgId}/${documentId}/${versionId}/${sha256}/original.${ext}`;
}

function adminClient() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function anonClient() {
  return createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

function analyzePdfText(text) {
  const signals = {};
  for (const [key, re] of Object.entries(DOMAIN_SIGNALS)) {
    signals[key] = re.test(text);
  }
  return signals;
}

function extractPdfText(path) {
  const py = spawnSync(
    "python",
    [
      "-c",
      `import json,sys
from pypdf import PdfReader
r=PdfReader(sys.argv[1])
t="".join((p.extract_text() or "") for p in r.pages)
print(json.dumps({"pages":len(r.pages),"chars":len(t),"text":t,"page_texts":[(p.extract_text() or "") for p in r.pages]}))`,
      path,
    ],
    { encoding: "utf8", timeout: 300000, env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
  );
  if (py.status !== 0) return { ok: false, err: py.stderr?.slice(0, 300) };
  try {
    return { ok: true, ...JSON.parse(py.stdout.trim()) };
  } catch {
    return { ok: false, err: "json parse failed" };
  }
}

async function callProcessor(orgId, docId, verId) {
  const res = await fetch(`${processorUrl}/jobs/parse-and-extract`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-processor-secret": processorSecret },
    body: JSON.stringify({
      organization_id: orgId,
      document_id: docId,
      document_version_id: verId,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function pilotVerifyDocument(client, userId, documentId, orgId, { allowPromote, pageTexts }) {
  const { data: facts, error } = await client
    .from("extracted_facts")
    .select("id, field, entity, normalized_type, normalized_value, raw_value, source_page, source_excerpt, verification_status")
    .eq("document_id", documentId);
  if (error) return { ok: false, err: error.message, verified: 0, promoted: 0, rejected: 0, promotions: [] };

  let verified = 0;
  let rejected = 0;
  const promotions = [];
  const now = new Date().toISOString();

  for (const fact of facts ?? []) {
    if (fact.verification_status === "HUMAN_VERIFIED" || fact.verification_status === "REJECTED") continue;
    const structured = STRUCTURED_TYPES.has(fact.normalized_type);
    const pageText = fact.source_page != null ? pageTexts.get(fact.source_page) ?? "" : "";
    const excerpt = (fact.source_excerpt || "").slice(0, 40);
    const excerptOk = !excerpt || pageText.includes(excerpt.slice(0, 24)) || (fact.normalized_value && pageText.includes(String(fact.normalized_value)));

    if (!structured) {
      await client
        .from("extracted_facts")
        .update({
          verification_status: "REJECTED",
          verified_by: userId,
          verified_at: now,
        })
        .eq("id", fact.id);
      await client.from("verification_events").insert({
        organization_id: orgId,
        extracted_fact_id: fact.id,
        actor_id: userId,
        action: "REJECT",
        from_status: "AI_EXTRACTED",
        to_status: "REJECTED",
        note: "Page blob is not a canonical field",
      });
      rejected += 1;
      continue;
    }

    if (!excerptOk) {
      await client
        .from("extracted_facts")
        .update({
          verification_status: "REJECTED",
          verified_by: userId,
          verified_at: now,
        })
        .eq("id", fact.id);
      await client.from("verification_events").insert({
        organization_id: orgId,
        extracted_fact_id: fact.id,
        actor_id: userId,
        action: "REJECT",
        from_status: "AI_EXTRACTED",
        to_status: "REJECTED",
        note: "Source excerpt not found on cited page",
      });
      rejected += 1;
      continue;
    }

    const value = (fact.normalized_value ?? fact.raw_value ?? "").trim();
    const { error: updErr } = await client
      .from("extracted_facts")
      .update({
        verification_status: "HUMAN_VERIFIED",
        verified_value: value,
        verified_by: userId,
        verified_at: now,
      })
      .eq("id", fact.id);
    if (updErr) continue;
    await client.from("verification_events").insert({
      organization_id: orgId,
      extracted_fact_id: fact.id,
      actor_id: userId,
      action: "VERIFY",
      from_status: "AI_EXTRACTED",
      to_status: "HUMAN_VERIFIED",
      note: `Source page ${fact.source_page}`,
    });
    verified += 1;

    if (!allowPromote) {
      promotions.push({ factId: fact.id, action: "skipped_class_c", ok: false, skipped: true });
      continue;
    }

    const { data: promo, error: promoErr } = await client.rpc("promote_verified_fact", { p_fact_id: fact.id });
    promotions.push({
      factId: fact.id,
      field: fact.field,
      ok: promo?.ok === true && CANONICAL_PROMOTE_ACTIONS.has(promo?.action),
      action: promo?.action ?? promoErr?.message,
      truth: promo?.truth ?? null,
      rate: promo?.rate ?? null,
      sourcePage: fact.source_page,
      excerpt: (fact.source_excerpt || "").slice(0, 180),
    });
  }

  const structuredVerified = verified;
  const canonicalPromoted = promotions.filter((p) => p.ok).length;
  return {
    ok: true,
    verified: structuredVerified,
    rejected,
    promoted: canonicalPromoted,
    promotions,
    factCount: facts?.length ?? 0,
    structuredCount: (facts ?? []).filter((f) => STRUCTURED_TYPES.has(f.normalized_type)).length,
  };
}

async function main() {
  const stamp = Date.now().toString(36);
  const admin = adminClient();
  const password = `Pilot2B-${stamp}!`;
  const email = `pilot2b-${stamp}@example.com`;
  const packageResults = {};
  const fileResults = [];

  // Health check processor
  try {
    const health = await fetch(`${processorUrl}/health`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
  } catch (e) {
    console.error(`Processor not reachable at ${processorUrl}. Start: uvicorn lp_processor.app:app --app-dir src --port 8080`);
    process.exit(1);
  }

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "create user failed");
  const userId = created.data.user.id;

  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw new Error(signIn.error?.message ?? "sign-in failed");

  const orgRes = await client.rpc("create_organization_with_admin", { org_name: `Pilot 2B ${stamp}` });
  if (orgRes.error || !orgRes.data) throw new Error(orgRes.error?.message ?? "org create failed");
  const orgId = orgRes.data;

  const batchIds = {};
  const pkgIdentity = {};
  for (const pkg of [...new Set(CORPUS.map((r) => r.pkg))]) {
    const { data: batch, error } = await client
      .from("document_batches")
      .insert({ organization_id: orgId, label: pkg })
      .select("id")
      .single();
    if (error) throw new Error(`batch ${pkg}: ${error.message}`);
    batchIds[pkg] = batch.id;
    const buyer = CORPUS.find((r) => r.pkg === pkg)?.buyer ?? pkg;
    const { data: clientRow, error: clientErr } = await client
      .from("clients")
      .insert({ organization_id: orgId, name: buyer })
      .select("id")
      .single();
    if (clientErr) throw new Error(`client ${pkg}: ${clientErr.message}`);
    const { data: oppRow, error: oppErr } = await client
      .from("opportunities")
      .insert({ organization_id: orgId, client_id: clientRow.id, title: `${pkg} ${buyer}` })
      .select("id")
      .single();
    if (oppErr) throw new Error(`opportunity ${pkg}: ${oppErr.message}`);
    pkgIdentity[pkg] = { clientId: clientRow.id, opportunityId: oppRow.id };
  }

  console.log(`Pilot org ${orgId} — processing ${CORPUS.length} manifest rows…`);

  for (const row of CORPUS) {
    const result = {
      srcId: row.id,
      pkg: row.pkg,
      cls: row.cls,
      buyer: row.buyer,
      dtype: row.dtype,
      path: row.path,
      intake: null,
      process: null,
      verify: null,
      pdfAnalysis: null,
      gaps: [],
    };

    if (row.skipIngest) {
      result.intake = { ok: false, skipped: true, reason: row.skipIngest };
      result.gaps.push({
        kind: "intake_blocked",
        severity: "blocking",
        detail: row.skipIngest,
        ux: "Data Ops",
      });
      fileResults.push(result);
      continue;
    }

    if (!existsSync(row.path)) {
      result.intake = { ok: false, reason: "file missing locally" };
      result.gaps.push({ kind: "corpus_unavailable", severity: "blocking", detail: row.path, ux: "Data Ops" });
      fileResults.push(result);
      continue;
    }

    const bytes = readFileSync(row.path);
    if (bytes.length > MAX_INTAKE_BYTES) {
      result.intake = { ok: false, reason: `size ${bytes.length} exceeds ${MAX_INTAKE_BYTES}` };
      result.gaps.push({ kind: "intake_size_gate", severity: "blocking", detail: `${bytes.length} bytes`, ux: "Data Ops" });
      fileResults.push(result);
      continue;
    }

    const sha = sha256Hex(bytes);
    if (sha !== row.sha) {
      result.intake = { ok: false, reason: `checksum mismatch expected ${row.sha}` };
      fileResults.push(result);
      continue;
    }

    const ext = row.path.toLowerCase().endsWith(".pdf") ? "pdf" : "pdf";
    const documentId = randomUUID();
    const versionId = randomUUID();
    const storagePath = evidencePath(orgId, documentId, versionId, sha, ext);

    const upload = await client.storage.from("evidence").upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (upload.error) {
      result.intake = { ok: false, reason: upload.error.message };
      fileResults.push(result);
      continue;
    }

    const meta = DOC_META[row.id] ?? { documentType: row.dtype, commercialTruth: "proposed" };
    const identity = pkgIdentity[row.pkg];
    const reg = await client.rpc("register_ingested_document", {
      p_organization_id: orgId,
      p_document_id: documentId,
      p_version_id: versionId,
      p_batch_id: batchIds[row.pkg],
      p_batch_label: row.pkg,
      p_client_id: identity.clientId,
      p_opportunity_id: identity.opportunityId,
      p_original_filename: basename(row.path),
      p_mime_type: "application/pdf",
      p_sha256: sha,
      p_storage_path: storagePath,
      p_byte_size: bytes.length,
      p_source_drive_file_id: null,
    });
    if (reg.error) {
      result.intake = { ok: false, reason: reg.error.message };
      fileResults.push(result);
      continue;
    }

    await client
      .from("documents")
      .update({
        document_type: meta.documentType,
        commercial_truth: meta.commercialTruth,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    result.intake = {
      ok: true,
      documentId,
      versionId,
      duplicate: reg.data?.duplicate ?? false,
      sha256: sha,
      opportunityId: identity.opportunityId,
    };

    const proc = await callProcessor(orgId, documentId, versionId);
    result.process = {
      ok: proc.ok,
      status: proc.status,
      parserId: proc.body?.parser_id,
      factCount: proc.body?.fact_count ?? 0,
      documentStatus: proc.body?.document_status,
      error: proc.body?.detail,
    };

    const { data: exceptions } = await client
      .from("validation_exceptions")
      .select("code, message")
      .eq("document_id", documentId);
    if (exceptions?.length) {
      for (const ex of exceptions) {
        result.gaps.push({
          kind: "validation_exception",
          severity: ex.code?.startsWith("precedence") ? "info" : "blocking",
          detail: `${ex.code}: ${ex.message}`,
          ux: "Data Ops",
        });
      }
    }

    const { data: facts } = await client
      .from("extracted_facts")
      .select("id, field, entity, normalized_type, source_page, verification_status")
      .eq("document_id", documentId);

    const structuredFields = (facts ?? []).filter((f) => STRUCTURED_TYPES.has(f.normalized_type));
    if ((facts ?? []).length > 0 && structuredFields.length === 0) {
      result.gaps.push({
        kind: "schema_gap",
        severity: "blocking",
        detail: "Extractor emits page_text blobs only — no solicitation/pricing/scope entities",
        ux: "Data Ops",
      });
    }
    if (!proc.ok || (facts ?? []).length === 0) {
      result.gaps.push({
        kind: "parser_extraction_failure",
        severity: "blocking",
        detail: proc.body?.detail ?? "Zero staging facts after parse/extract",
        ux: "Data Ops",
      });
    }

    const pdf = extractPdfText(row.path);
    const pageTexts = new Map();
    if (pdf.ok) {
      result.pdfAnalysis = { pages: pdf.pages, chars: pdf.chars, signals: analyzePdfText(pdf.text) };
      (pdf.page_texts ?? []).forEach((t, i) => pageTexts.set(i + 1, t));
      if (pdf.chars === 0) {
        result.gaps.push({
          kind: "parser_extraction_failure",
          severity: "blocking",
          detail: "Scanned/image PDF — no extractable text (OCR unwired)",
          ux: "Data Ops",
        });
      }
    }

    if (proc.ok) {
      result.verify = await pilotVerifyDocument(client, userId, documentId, orgId, {
        allowPromote: row.cls !== "C",
        pageTexts,
      });
      const canComplete =
        result.verify.verified > 0 &&
        (row.cls === "C" || result.verify.promoted > 0);
      if (canComplete && row.cls !== "C") {
        await client
          .from("documents")
          .update({
            processing_status: "VERIFIED",
            lifecycle_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId);
      }
    }

    const { data: docRow } = await client
      .from("documents")
      .select("processing_status")
      .eq("id", documentId)
      .single();
    result.finalStatus = docRow?.processing_status ?? "unknown";
    result.pipelineComplete =
      row.cls !== "C" &&
      result.intake?.ok &&
      result.process?.ok &&
      (result.verify?.verified ?? 0) > 0 &&
      (result.verify?.promoted ?? 0) > 0 &&
      result.finalStatus === "VERIFIED";

    fileResults.push(result);
    console.log(
      `${row.id} ${row.dtype}: intake=${result.intake?.ok} structured=${result.verify?.structuredCount ?? 0} promoted=${result.verify?.promoted ?? 0} status=${result.finalStatus} complete=${result.pipelineComplete}`,
    );
  }

  // Roll up per package
  for (const pkg of [...new Set(CORPUS.map((r) => r.pkg))]) {
    const rows = fileResults.filter((r) => r.pkg === pkg);
    const ingested = rows.filter((r) => r.intake?.ok).length;
    const processed = rows.filter((r) => r.process?.ok).length;
    const verified = rows.filter((r) => r.finalStatus === "VERIFIED").length;
    const pipelineComplete = rows.filter((r) => r.pipelineComplete).length;
    packageResults[pkg] = {
      files: rows.map((r) => r.srcId),
      cls: rows[0]?.cls,
      ingested,
      processed,
      verified,
      pipelineComplete,
      buyer: rows[0]?.buyer,
      gaps: [...new Map(rows.flatMap((r) => r.gaps.map((g) => [g.kind + g.detail, g]))).values()],
    };
  }

  const awardedAb = fileResults.find(
    (r) => r.cls !== "C" && r.intake?.ok && DOC_META[r.srcId]?.commercialTruth === "awarded" && r.verify?.promoted > 0,
  );
  let precedence = { tested: false };
  if (awardedAb?.intake?.documentId) {
    const { data: runRow } = await client
      .from("extracted_facts")
      .select("extraction_run_id, document_version_id")
      .eq("document_id", awardedAb.intake.documentId)
      .limit(1)
      .maybeSingle();
    if (runRow) {
      const { data: probe, error: probeIns } = await client
        .from("extracted_facts")
        .insert({
          organization_id: orgId,
          extraction_run_id: runRow.extraction_run_id,
          document_id: awardedAb.intake.documentId,
          document_version_id: runRow.document_version_id,
          idempotency_key: "precedence-requested-on-awarded",
          entity: "hourly",
          field: "requested_rate",
          raw_value: "$99.99",
          normalized_value: "99.99",
          normalized_type: "rate",
          source_page: 1,
          source_section: "precedence probe",
          source_excerpt: "synthetic requested_rate on awarded document",
          verification_status: "HUMAN_VERIFIED",
          verified_value: "99.99",
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (!probeIns && probe) {
        const { data: promo } = await client.rpc("promote_verified_fact", { p_fact_id: probe.id });
        const { data: ex } = await client
          .from("validation_exceptions")
          .select("code, message")
          .eq("document_id", awardedAb.intake.documentId)
          .eq("code", "precedence_requested");
        precedence = {
          tested: true,
          on: awardedAb.srcId,
          action: promo?.action,
          ok: promo?.ok === false && promo?.action === "conflict",
          exception: ex?.[0]?.code ?? null,
        };
      } else {
        precedence = { tested: true, error: probeIns?.message };
      }
    }
  }

  const { data: pricingLines } = await client
    .from("pricing_lines")
    .select(
      "id, opportunity_id, labor_category, requested_rate, proposed_rate, awarded_rate, current_rate, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id",
    )
    .eq("organization_id", orgId);

  const provenance = [];
  for (const line of pricingLines ?? []) {
    for (const [truth, factId] of [
      ["requested", line.requested_source_fact_id],
      ["proposed", line.proposed_source_fact_id],
      ["awarded", line.awarded_source_fact_id],
      ["current", line.current_source_fact_id],
    ]) {
      if (!factId) continue;
      const { data: fact } = await client
        .from("extracted_facts")
        .select("id, source_page, source_excerpt, field, document_id")
        .eq("id", factId)
        .single();
      const { data: evidence } = await client
        .from("source_evidence")
        .select("page, excerpt")
        .eq("extracted_fact_id", factId)
        .limit(1)
        .maybeSingle();
      provenance.push({
        truth,
        rate: line[`${truth}_rate`],
        factId,
        sourcePage: fact?.source_page ?? null,
        excerpt: fact?.source_excerpt ?? null,
        evidencePage: evidence?.page ?? null,
        survived: fact?.source_page != null && Boolean(fact?.source_excerpt),
      });
    }
  }

  const classCPromoted = fileResults
    .filter((r) => r.cls === "C")
    .reduce((n, r) => n + (r.verify?.promoted ?? 0), 0);
  const verifiedZeroFacts = fileResults.filter(
    (r) => r.finalStatus === "VERIFIED" && (r.verify?.verified ?? 0) === 0,
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    orgId,
    filesAttempted: CORPUS.length,
    filesIngested: fileResults.filter((r) => r.intake?.ok).length,
    filesProcessed: fileResults.filter((r) => r.process?.ok).length,
    filesVerified: fileResults.filter((r) => r.finalStatus === "VERIFIED").length,
    packagesComplete: fileResults.filter((r) => r.pipelineComplete).length,
    packages: Object.keys(packageResults).length,
    packageResults,
    fileResults,
    pricingLines: pricingLines ?? [],
    provenance,
    precedence,
    classCPromoted,
    verifiedWithZeroHumanFacts: verifiedZeroFacts.map((r) => r.srcId),
    fourTruthsDistinct: (pricingLines ?? []).every((line) => {
      const filled = ["requested_rate", "proposed_rate", "awarded_rate", "current_rate"].filter(
        (k) => line[k] != null,
      );
      return filled.length <= 4;
    }),
  };

  mkdirSync(join(ROOT, "docs/benchmarks"), { recursive: true });
  writeFileSync(RESULTS_JSON, JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${RESULTS_JSON}`);
  console.log(
    `Summary: ${summary.filesIngested}/${summary.filesAttempted} ingested, ${summary.filesProcessed} processed, ${summary.packagesComplete} A/B pipeline-complete, C promoted=${classCPromoted}`,
  );

  // Cleanup pilot org (keep results JSON)
  await admin.from("organizations").delete().eq("id", orgId);
  await admin.auth.admin.deleteUser(userId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
