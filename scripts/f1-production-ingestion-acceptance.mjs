/**
 * F1 — Production document ingestion / OCR / real-corpus acceptance.
 *
 * Run: npm run test:f1-ingestion
 *      node --env-file=apps/web/.env.local scripts/f1-production-ingestion-acceptance.mjs
 *
 * Proves, against the real processor and live Supabase:
 *   routing    — every routing class lands where docs/ROUTING_POLICY.md says (DIGITAL_PDF,
 *                SCANNED_PDF, DOCX, XLSX, UNSUPPORTED)
 *   ocr        — with no MISTRAL_API_KEY a scanned PDF fails closed as OCR_REQUIRED and never
 *                fabricates text; with a key the adapter is wired (no invented success)
 *   lifecycle  — the OCR_REQUIRED prefix survives every layer that records the failure
 *   size       — one honest byte gate; client preflight cannot drift from the server
 *   trust      — automation never self-promotes to VERIFIED / HUMAN_VERIFIED
 *   integrity  — multi-doc package association, SHA dedupe, version retention
 *   funnel     — corpus stages are reported separately, never collapsed
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const PY_SRC = join(ROOT, "services/processor/src");
const ACQUIRED = join(ROOT, "docs/pilot/acquired");
const FUNNEL_SCRIPT = join(ROOT, "scripts/corpus-funnel-report.mjs");
const FUNNEL_JSON = join(ROOT, "docs/benchmarks/corpus-funnel.json");
const OUT_JSON = join(ROOT, "docs/benchmarks/f1-production-ingestion-results.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const processorUrl = (process.env.PROCESSOR_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const ocrKeyPresent = Boolean((process.env.MISTRAL_API_KEY ?? "").trim());

if (!url || !publishable || !secret) {
  console.error(
    "Missing Supabase env. Run with: node --env-file=apps/web/.env.local scripts/f1-production-ingestion-acceptance.mjs",
  );
  process.exit(1);
}

const stamp = Date.now().toString(36);
const matrix = [];
const orgIds = [];
const users = [];

function record(domain, name, ok, detail = "") {
  matrix.push({ domain, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${domain}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function note(domain, name, detail) {
  matrix.push({ domain, name, ok: true, detail, informational: true });
  console.log(`INFO  [${domain}] ${name}${detail ? ` — ${detail}` : ""}`);
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
  const client = anon();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return client;
}

function py(literal) {
  return JSON.stringify(literal);
}

/** One python probe covering routing, OCR posture, lifecycle error, and the status guard. */
function processorProbe() {
  const script = `
import json, os, sys
sys.path.insert(0, r${py(PY_SRC)})
os.environ.pop("MISTRAL_API_KEY", None)

from lp_processor.evals.fixtures import _pdf, pricing_workbook, sample_docx, DIGITAL_RFP_TEXT
from lp_processor.routing_policy import decide_route
from lp_processor.parsers.routing import select_parser, routing_health
from lp_processor.parsers.base import ParserNotWiredError
from lp_processor.jobs import (
    EXCEPTION_CODE_OCR_REQUIRED,
    OCR_REQUIRED_PREFIX,
    parse_lifecycle_error,
    run_parse_and_extract,
)
from lp_processor.models import ProcessorJobRequest
from lp_processor.store import Store

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

out = {"ocr_required_prefix": OCR_REQUIRED_PREFIX}

cases = {
    "DIGITAL_PDF": ("application/pdf", "rfp.pdf", _pdf(DIGITAL_RFP_TEXT)),
    "SCANNED_PDF": ("application/pdf", "scan.pdf", _pdf(None)),
    "DOCX": (DOCX_MIME, "proposal.docx", sample_docx()),
    "XLSX": (XLSX_MIME, "pricing.xlsx", pricing_workbook()),
    "UNSUPPORTED": ("text/plain", "notes.txt", b"not a document"),
}

routes = {}
for key, (mime, name, payload) in cases.items():
    decision = decide_route(mime, name, payload)
    entry = {
        "document_class": decision.document_class,
        "parser_id": decision.parser_id,
        "wired": decision.wired,
        "escalate": decision.escalate,
    }
    try:
        parser = select_parser(mime, name, payload)
        entry["selected"] = parser.parser_id
        doc = parser.parse(payload, mime_type=mime, filename=name)
        entry["parsed"] = True
        entry["page_count"] = doc.page_count
        entry["sheet_count"] = doc.sheet_count
        entry["text_chars"] = sum(len(p.text or "") for p in doc.pages)
        entry["cell_count"] = sum(len(s.cells) for s in doc.sheets)
        entry["cell_provenance"] = all(
            c.sheet and c.coordinate for s in doc.sheets for c in s.cells
        )
    except Exception as exc:
        entry["parsed"] = False
        entry["error_type"] = type(exc).__name__
        entry["error"] = str(exc)[:300]
        entry["lifecycle_error"] = parse_lifecycle_error(exc)
    routes[key] = entry
out["routes"] = routes
out["health_no_key"] = routing_health()

once = parse_lifecycle_error(ParserNotWiredError("scan needs OCR"))
twice = parse_lifecycle_error(ParserNotWiredError(once))
long_msg = parse_lifecycle_error(ParserNotWiredError("ocr-mistral " + "x" * 5000))
out["lifecycle"] = {
    "once": once,
    "idempotent": once == twice,
    "prefix_count": twice.count(OCR_REQUIRED_PREFIX),
    "long_prefixed": long_msg.startswith(OCR_REQUIRED_PREFIX),
    "long_within_budget": len(long_msg) <= 500,
}


class FakeStore:
    _ALLOWED = frozenset(
        {"UPLOADED", "QUEUED", "PARSING", "EXTRACTING", "VALIDATING", "NEEDS_REVIEW", "FAILED"}
    )

    def __init__(self, payload, filename, mime_type):
        self.payload = payload
        self.filename = filename
        self.mime_type = mime_type
        self.statuses = []
        self.exceptions = []
        self.normalized = []
        self.guard_violation = None

    def load_job_context(self, req):
        return {
            "version": {"storage_bucket": "evidence", "storage_path": "p"},
            "document": {
                "original_filename": self.filename,
                "mime_type": self.mime_type,
                "document_type": None,
            },
        }

    def download_evidence(self, bucket, path):
        return self.payload

    def set_status(self, document_id, organization_id, status, error=None):
        if status == "VERIFIED" or status not in self._ALLOWED:
            self.guard_violation = status
        self.statuses.append((status, error))

    def add_exception(self, organization_id, document_id, code, message):
        self.exceptions.append((code, message))

    def ensure_run(self, req, parser_id, extractor_id):
        return "00000000-0000-0000-0000-000000000000"

    def save_normalized(self, run_id, document, parser_id, extractor_id):
        self.normalized.append(parser_id)

    def finish_run(self, run_id, error=None):
        pass


req = ProcessorJobRequest(
    organization_id="11111111-1111-1111-1111-111111111111",
    document_id="22222222-2222-2222-2222-222222222222",
    document_version_id="33333333-3333-3333-3333-333333333333",
)

scan_store = FakeStore(_pdf(None), "scan.pdf", "application/pdf")
try:
    run_parse_and_extract(req, store=scan_store)
except Exception:
    pass
failed = [e or "" for s, e in scan_store.statuses if s == "FAILED"]
out["scanned_job"] = {
    "failed_writes": len(failed),
    "all_prefixed": bool(failed) and all(e.startswith(OCR_REQUIRED_PREFIX) for e in failed),
    "unprefixed": [e[:160] for e in failed if not e.startswith(OCR_REQUIRED_PREFIX)],
    "exception_codes": [c for c, _ in scan_store.exceptions],
    "reasons": [m[:200] for _, m in scan_store.exceptions],
    "normalized_saved": len(scan_store.normalized),
    "reached_needs_review": any(s == "NEEDS_REVIEW" for s, _ in scan_store.statuses),
    "guard_violation": scan_store.guard_violation,
    "ocr_code": EXCEPTION_CODE_OCR_REQUIRED,
}

unsupported_store = FakeStore(b"not a document", "notes.txt", "text/plain")
try:
    run_parse_and_extract(req, store=unsupported_store)
except Exception:
    pass
unsupported_failed = [e or "" for s, e in unsupported_store.statuses if s == "FAILED"]
out["unsupported_job"] = {
    "failed_writes": len(unsupported_failed),
    "any_prefixed": any(e.startswith(OCR_REQUIRED_PREFIX) for e in unsupported_failed),
    "exception_codes": [c for c, _ in unsupported_store.exceptions],
}

guard = {"raised": False, "error_type": None}
try:
    Store.set_status(object.__new__(Store), "doc", "org", "VERIFIED")
except ValueError as exc:
    guard = {"raised": True, "error_type": "ValueError", "message": str(exc)[:200]}
except Exception as exc:
    guard = {"raised": True, "error_type": type(exc).__name__, "message": str(exc)[:200]}
out["verified_guard"] = guard

# Flip the credential on and confirm wiring changes without any network call.
os.environ["MISTRAL_API_KEY"] = "f1-acceptance-probe-key-never-sent"
out["health_with_key"] = routing_health()
try:
    out["scanned_with_key_parser"] = select_parser("application/pdf", "scan.pdf", _pdf(None)).parser_id
except Exception as exc:
    out["scanned_with_key_parser"] = "ESCALATED:" + type(exc).__name__

print("F1_JSON_START" + json.dumps(out) + "F1_JSON_END")
`;
  const result = spawnSync("python", ["-c", script], {
    encoding: "utf8",
    timeout: 180000,
    cwd: ROOT,
  });
  const stdout = result.stdout ?? "";
  const start = stdout.indexOf("F1_JSON_START");
  const end = stdout.indexOf("F1_JSON_END");
  if (start === -1 || end === -1) {
    return { ok: false, error: (result.stderr || stdout || `exit ${result.status}`).slice(0, 900) };
  }
  try {
    return { ok: true, data: JSON.parse(stdout.slice(start + "F1_JSON_START".length, end)) };
  } catch (error) {
    return { ok: false, error: `probe JSON parse failed: ${error.message}` };
  }
}

function smallestAcquiredPdfs(count) {
  if (!existsSync(ACQUIRED)) return [];
  return readdirSync(ACQUIRED)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .map((name) => {
      const path = join(ACQUIRED, name);
      return { name, path, size: statSync(path).size };
    })
    .sort((a, b) => a.size - b.size)
    .slice(0, count)
    .map((entry) => ({ ...entry, bytes: readFileSync(entry.path) }));
}

async function registerPdf(asUser, orgId, bytes, filename) {
  const documentId = randomUUID();
  const versionId = randomUUID();
  const sha = sha256Hex(bytes);
  const storagePath = `${orgId}/${documentId}/${versionId}/${sha}/original.pdf`;
  const upload = await asUser.storage
    .from("evidence")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (upload.error) throw new Error(`upload: ${upload.error.message}`);
  const registered = await asUser.rpc("register_ingested_document", {
    p_organization_id: orgId,
    p_document_id: documentId,
    p_version_id: versionId,
    p_batch_id: null,
    p_batch_label: null,
    p_client_id: null,
    p_opportunity_id: null,
    p_original_filename: filename,
    p_mime_type: "application/pdf",
    p_sha256: sha,
    p_storage_path: storagePath,
    p_byte_size: bytes.byteLength,
    p_source_drive_file_id: null,
  });
  if (registered.error) throw new Error(`register: ${registered.error.message}`);
  const row = registered.data ?? {};
  return {
    documentId: typeof row.document_id === "string" ? row.document_id : documentId,
    versionId: typeof row.document_version_id === "string" ? row.document_version_id : versionId,
    duplicate: Boolean(row.duplicate),
    sha,
  };
}

async function main() {
  const adm = admin();

  // =====================================================================
  // 1. ROUTING CLASSES
  // =====================================================================
  console.log("\n--- routing ---");
  const probe = processorProbe();
  if (!probe.ok) {
    record("routing", "processor probe runs", false, probe.error);
  } else {
    const routes = probe.data.routes;
    record(
      "routing",
      "DIGITAL_PDF -> pdf-native, parsed natively with text",
      routes.DIGITAL_PDF?.document_class === "digital_pdf" &&
        routes.DIGITAL_PDF?.parser_id === "pdf-native" &&
        routes.DIGITAL_PDF?.parsed === true &&
        (routes.DIGITAL_PDF?.text_chars ?? 0) > 0,
      `class=${routes.DIGITAL_PDF?.document_class} chars=${routes.DIGITAL_PDF?.text_chars}`,
    );
    record(
      "routing",
      "SCANNED_PDF -> ocr-mistral and fails closed without a key",
      routes.SCANNED_PDF?.document_class === "scanned_pdf" &&
        routes.SCANNED_PDF?.parser_id === "ocr-mistral" &&
        routes.SCANNED_PDF?.escalate === true &&
        routes.SCANNED_PDF?.parsed === false,
      `class=${routes.SCANNED_PDF?.document_class} escalate=${routes.SCANNED_PDF?.escalate}`,
    );
    record(
      "routing",
      "DOCX -> docx-native, wired (not OCR, not treated as PDF)",
      routes.DOCX?.document_class === "docx" &&
        routes.DOCX?.parser_id === "docx-native" &&
        routes.DOCX?.wired === true &&
        routes.DOCX?.parsed === true,
      `class=${routes.DOCX?.document_class} pages=${routes.DOCX?.page_count}`,
    );
    record(
      "routing",
      "XLSX -> xlsx-openpyxl, never OCR, sheet/cell provenance on every cell",
      routes.XLSX?.document_class === "xlsx" &&
        routes.XLSX?.parser_id === "xlsx-openpyxl" &&
        routes.XLSX?.parsed === true &&
        (routes.XLSX?.cell_count ?? 0) > 0 &&
        routes.XLSX?.cell_provenance === true,
      `cells=${routes.XLSX?.cell_count} provenance=${routes.XLSX?.cell_provenance}`,
    );
    record(
      "routing",
      "UNSUPPORTED -> unknown, fails closed and is NOT mislabelled as an OCR problem",
      routes.UNSUPPORTED?.document_class === "unknown" &&
        routes.UNSUPPORTED?.escalate === true &&
        routes.UNSUPPORTED?.parsed === false &&
        !(routes.UNSUPPORTED?.lifecycle_error ?? "").startsWith("OCR_REQUIRED:"),
      `class=${routes.UNSUPPORTED?.document_class} err=${(routes.UNSUPPORTED?.error ?? "").slice(0, 70)}`,
    );

    // =====================================================================
    // 2. OCR POSTURE
    // =====================================================================
    console.log("\n--- ocr ---");
    const healthNoKey = probe.data.health_no_key ?? {};
    const healthWithKey = probe.data.health_with_key ?? {};
    record(
      "ocr",
      "health reports ocr_ready=false and escalates ocr-mistral when no key is set",
      healthNoKey.ocr_ready === false &&
        (healthNoKey.escalate_unwired ?? []).includes("ocr-mistral") &&
        !(healthNoKey.wired ?? []).includes("ocr-mistral"),
      `ocr_ready=${healthNoKey.ocr_ready} wired=${(healthNoKey.wired ?? []).join("|")}`,
    );
    record(
      "ocr",
      "setting MISTRAL_API_KEY wires ocr-mistral (no network call, no invented parse)",
      healthWithKey.ocr_ready === true &&
        (healthWithKey.wired ?? []).includes("ocr-mistral") &&
        probe.data.scanned_with_key_parser === "ocr-mistral",
      `ocr_ready=${healthWithKey.ocr_ready} selected=${probe.data.scanned_with_key_parser}`,
    );
    const scanJob = probe.data.scanned_job ?? {};
    record(
      "ocr",
      "scanned PDF without a key never fabricates text or reaches NEEDS_REVIEW",
      scanJob.normalized_saved === 0 && scanJob.reached_needs_review === false,
      `normalized_saved=${scanJob.normalized_saved} needs_review=${scanJob.reached_needs_review}`,
    );
    record(
      "ocr",
      "DOCX and XLSX are wired independently of OCR credentials",
      (healthNoKey.wired ?? []).includes("docx-native") &&
        (healthNoKey.wired ?? []).includes("xlsx-openpyxl") &&
        (healthNoKey.wired ?? []).includes("pdf-native"),
      (healthNoKey.wired ?? []).join("|"),
    );

    // =====================================================================
    // 3. OCR_REQUIRED LIFECYCLE CONTRACT
    // =====================================================================
    console.log("\n--- lifecycle ---");
    record(
      "lifecycle",
      "parse-and-extract keeps OCR_REQUIRED on EVERY FAILED write (badge cannot be blanked)",
      scanJob.all_prefixed === true && (scanJob.unprefixed ?? []).length === 0,
      `failed_writes=${scanJob.failed_writes} unprefixed=${(scanJob.unprefixed ?? []).length}`,
    );
    const lifecycle = probe.data.lifecycle ?? {};
    record(
      "lifecycle",
      "prefix application is idempotent and stays inside the 500-char column budget",
      lifecycle.idempotent === true &&
        lifecycle.prefix_count === 1 &&
        lifecycle.long_prefixed === true &&
        lifecycle.long_within_budget === true,
      `prefix_count=${lifecycle.prefix_count} long_ok=${lifecycle.long_within_budget}`,
    );
    record(
      "lifecycle",
      "failed parse records an error class plus a human reason that says how to unblock",
      (scanJob.exception_codes ?? []).includes(scanJob.ocr_code) &&
        (scanJob.reasons ?? []).some((reason) => reason.includes("MISTRAL_API_KEY")),
      `codes=${(scanJob.exception_codes ?? []).join("|")}`,
    );
    const unsupportedJob = probe.data.unsupported_job ?? {};
    record(
      "lifecycle",
      "non-OCR failures keep their own error class and are not labelled OCR_REQUIRED",
      unsupportedJob.any_prefixed === false &&
        (unsupportedJob.exception_codes ?? []).includes("parse_failed"),
      `codes=${(unsupportedJob.exception_codes ?? []).join("|")}`,
    );

    // =====================================================================
    // 4. TRUST — no self-promotion
    // =====================================================================
    console.log("\n--- trust ---");
    const guard = probe.data.verified_guard ?? {};
    record(
      "trust",
      "processor Store refuses to write VERIFIED",
      guard.raised === true && guard.error_type === "ValueError",
      `${guard.error_type}: ${(guard.message ?? "").slice(0, 90)}`,
    );
    record(
      "trust",
      "no parse/extract path reached a VERIFIED or out-of-band status",
      scanJob.guard_violation === null || scanJob.guard_violation === undefined,
      `violation=${scanJob.guard_violation ?? "none"}`,
    );
  }

  const jobsSrc = readFileSync(join(ROOT, "services/processor/src/lp_processor/jobs.py"), "utf8");
  record(
    "trust",
    "processor jobs never write HUMAN_VERIFIED",
    !/HUMAN_VERIFIED/.test(jobsSrc),
    "jobs.py stages facts as AI_EXTRACTED only",
  );
  const storeSrc = readFileSync(join(ROOT, "services/processor/src/lp_processor/store.py"), "utf8");
  record(
    "trust",
    "processor writes staging facts as AI_EXTRACTED and preserves HUMAN_VERIFIED rows on re-extract",
    /"verification_status": "AI_EXTRACTED"/.test(storeSrc) &&
      /\.eq\("verification_status", "HUMAN_VERIFIED"\)/.test(storeSrc),
    "upsert_facts skips keys already HUMAN_VERIFIED",
  );

  // =====================================================================
  // 5. SIZE LIMIT HONESTY
  // =====================================================================
  console.log("\n--- size ---");
  const allowedFiles = readFileSync(join(ROOT, "apps/web/lib/intake/allowed-files.ts"), "utf8");
  const intakeForm = readFileSync(
    join(ROOT, "apps/web/app/(platform)/ingestion/intake/intake-form.tsx"),
    "utf8",
  );
  const nextConfig = readFileSync(join(ROOT, "apps/web/next.config.ts"), "utf8");
  record(
    "size",
    "server intake gate is a single MAX_INTAKE_BYTES constant (50 MB)",
    /export const MAX_INTAKE_BYTES = 50 \* 1024 \* 1024/.test(allowedFiles),
    "apps/web/lib/intake/allowed-files.ts",
  );
  record(
    "size",
    "client preflight derives from MAX_INTAKE_BYTES so it cannot drift from the server",
    /MAX_FILE_SIZE_BYTES = MAX_INTAKE_BYTES/.test(intakeForm) &&
      /from "@\/lib\/intake\/allowed-files"/.test(intakeForm),
    "intake-form.tsx imports the server constant",
  );
  record(
    "size",
    "Server Action body limit matches the intake gate",
    /bodySizeLimit:\s*"50mb"/.test(nextConfig),
    "next.config.ts bodySizeLimit=50mb",
  );
  const processorFiles = ["jobs.py", "store.py", "config.py", "app.py"].map((name) =>
    readFileSync(join(ROOT, "services/processor/src/lp_processor", name), "utf8"),
  );
  record(
    "size",
    "processor declares no competing byte limit (it downloads from the vault)",
    !processorFiles.some((src) => /MAX_(FILE|INTAKE|UPLOAD|BYTE)/.test(src)),
    "no 25 MB gate exists anywhere in code; 50 MB intake is the only gate",
  );

  // =====================================================================
  // 6. INGESTION INTEGRITY (live DB, ephemeral org)
  // =====================================================================
  console.log("\n--- integrity ---");
  const pdfs = smallestAcquiredPdfs(3);
  record(
    "integrity",
    "real acquired corpus bytes available for the integrity probe",
    pdfs.length >= 2,
    `${pdfs.length} pdf(s) from docs/pilot/acquired`,
  );

  const password = `F1p-${stamp}!`;
  const email = `f1-${stamp}@example.com`;
  try {
    if (pdfs.length >= 2) {
      const created = await adm.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user) {
        throw new Error(created.error?.message ?? "create user failed");
      }
      users.push(created.data.user);
      const asUser = await signIn(email, password);
      const orgRes = await asUser.rpc("create_organization_with_admin", {
        org_name: `F1 Ingestion ${stamp}`,
      });
      if (orgRes.error) throw new Error(orgRes.error.message);
      const orgId = orgRes.data;
      orgIds.push(orgId);

      const first = await registerPdf(asUser, orgId, pdfs[0].bytes, pdfs[0].name);
      const second = await registerPdf(asUser, orgId, pdfs[1].bytes, pdfs[1].name);
      record(
        "integrity",
        "distinct bytes create distinct documents and versions",
        first.documentId !== second.documentId && first.sha !== second.sha,
        `doc1=${first.documentId.slice(0, 8)} doc2=${second.documentId.slice(0, 8)}`,
      );

      // Multi-doc package association
      const pkg = await asUser
        .from("procurement_packages")
        .insert({
          organization_id: orgId,
          package_key: `F1-PKG-${stamp}`,
          title: "F1 multi-document package",
          corpus_class: "B_LP_TIED",
        })
        .select("id")
        .single();
      if (pkg.error) throw new Error(pkg.error.message);
      const linked = await asUser
        .from("documents")
        .update({ procurement_package_id: pkg.data.id })
        .in("id", [first.documentId, second.documentId])
        .select("id");
      const pkgDocs = await asUser
        .from("documents")
        .select("id")
        .eq("procurement_package_id", pkg.data.id);
      record(
        "integrity",
        "one package holds multiple documents (multi-doc association)",
        !linked.error && (pkgDocs.data?.length ?? 0) === 2,
        `package_docs=${pkgDocs.data?.length ?? 0}`,
      );

      // SHA dedupe
      const dupe = await registerPdf(asUser, orgId, pdfs[0].bytes, `copy-${pdfs[0].name}`);
      const versionsWithSha = await asUser
        .from("document_versions")
        .select("id")
        .eq("organization_id", orgId)
        .eq("sha256", first.sha);
      record(
        "integrity",
        "identical SHA-256 is deduped: flagged duplicate and no second version row",
        dupe.duplicate === true && (versionsWithSha.data?.length ?? 0) === 1,
        `duplicate=${dupe.duplicate} versions_with_sha=${versionsWithSha.data?.length ?? 0}`,
      );
      record(
        "integrity",
        "dedupe returns the original document instead of orphaning the upload",
        dupe.documentId === first.documentId,
        `returned=${dupe.documentId.slice(0, 8)} original=${first.documentId.slice(0, 8)}`,
      );

      // Version retention
      const allVersions = await asUser
        .from("document_versions")
        .select("id, document_id, sha256")
        .eq("organization_id", orgId);
      record(
        "integrity",
        "every ingested version is retained (nothing overwritten in the vault)",
        (allVersions.data?.length ?? 0) === 2,
        `versions=${allVersions.data?.length ?? 0} for 2 distinct SHAs`,
      );

      // Trust: HUMAN_VERIFIED requires a real actor
      const run = await asUser
        .from("extraction_runs")
        .insert({
          organization_id: orgId,
          document_version_id: first.versionId,
          parser_id: "pdf-native",
          extractor_id: "f1-acceptance",
        })
        .select("id")
        .single();
      const badFact = await asUser.from("extracted_facts").insert({
        organization_id: orgId,
        extraction_run_id: run.data.id,
        document_id: first.documentId,
        document_version_id: first.versionId,
        field: "unarmed_rate",
        raw_value: "31.45",
        verification_status: "HUMAN_VERIFIED",
      });
      record(
        "trust",
        "HUMAN_VERIFIED without a verifying actor is rejected by the database",
        Boolean(badFact.error),
        badFact.error ? badFact.error.message.slice(0, 110) : "INSERT SUCCEEDED — trust hole",
      );
      const okFact = await asUser
        .from("extracted_facts")
        .insert({
          organization_id: orgId,
          extraction_run_id: run.data.id,
          document_id: first.documentId,
          document_version_id: first.versionId,
          field: "unarmed_rate",
          raw_value: "31.45",
        })
        .select("id, verification_status")
        .single();
      record(
        "trust",
        "a freshly staged fact defaults to AI_EXTRACTED, never to verified",
        !okFact.error && okFact.data?.verification_status === "AI_EXTRACTED",
        `status=${okFact.data?.verification_status ?? okFact.error?.message}`,
      );
    }
  } finally {
    for (const orgId of orgIds) {
      await adm.from("organizations").delete().eq("id", orgId);
    }
    for (const user of users) {
      await adm.auth.admin.deleteUser(user.id);
    }
  }

  // =====================================================================
  // 7. PROCESSOR HEALTH (live service, optional)
  // =====================================================================
  console.log("\n--- health ---");
  let liveHealth = null;
  try {
    const response = await fetch(`${processorUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    liveHealth = await response.json();
  } catch (error) {
    liveHealth = { unreachable: error.message };
  }
  if (liveHealth?.unreachable) {
    note(
      "health",
      "live processor not reachable — routing verified in-process instead",
      `${processorUrl}: ${liveHealth.unreachable}`,
    );
  } else {
    record(
      "health",
      "live processor /health reports wired parsers and never claims canonical writes",
      liveHealth?.ok === true && liveHealth?.writes_canonical_contracts === false,
      `parsers=${(liveHealth?.parsers ?? []).join("|")} ocr_ready=${liveHealth?.routing_policy?.ocr_ready}`,
    );
    record(
      "health",
      "live ocr_ready matches whether MISTRAL_API_KEY is actually set",
      Boolean(liveHealth?.routing_policy?.ocr_ready) === ocrKeyPresent,
      `ocr_ready=${liveHealth?.routing_policy?.ocr_ready} key_present=${ocrKeyPresent}`,
    );
  }
  if (ocrKeyPresent) {
    note(
      "health",
      "MISTRAL_API_KEY present — a real scan may be OCR'd; no synthetic success is claimed here",
      "run one scanned pilot PDF through the processor to record real OCR evidence",
    );
  } else {
    note(
      "health",
      "MISTRAL_API_KEY absent — OCR is unproven against real scanned L&P evidence",
      "scanned PDFs correctly fail closed as OCR_REQUIRED; do not claim OCR coverage",
    );
  }

  // =====================================================================
  // 8. CORPUS FUNNEL
  // =====================================================================
  console.log("\n--- funnel ---");
  const funnelRun = spawnSync(
    process.execPath,
    ["--env-file=apps/web/.env.local", FUNNEL_SCRIPT],
    { encoding: "utf8", cwd: ROOT, timeout: 300000 },
  );
  record(
    "funnel",
    "corpus funnel report runs clean",
    funnelRun.status === 0,
    funnelRun.status === 0 ? "exit 0" : (funnelRun.stderr ?? "").slice(0, 200),
  );
  let funnel = null;
  if (existsSync(FUNNEL_JSON)) {
    funnel = JSON.parse(readFileSync(FUNNEL_JSON, "utf8"));
  }
  const REQUIRED_STAGES = [
    "discovered",
    "acquired",
    "ingested",
    "parsed",
    "extracted",
    "blocked",
    "review_ready",
    "human_verified",
    "canonical_promoted",
    "ab_complete",
  ];
  const missing = REQUIRED_STAGES.filter((stage) => !(stage in (funnel?.stages ?? {})));
  record(
    "funnel",
    "every pipeline stage is reported separately",
    funnel !== null && missing.length === 0,
    missing.length ? `missing=${missing.join(",")}` : REQUIRED_STAGES.join(","),
  );
  record(
    "funnel",
    "PARSED and EXTRACTED are distinct measures, not one number",
    typeof funnel?.stages?.parsed?.distinct_documents === "number" &&
      typeof funnel?.stages?.extracted?.distinct_documents === "number",
    `parsed=${funnel?.stages?.parsed?.distinct_documents} extracted=${funnel?.stages?.extracted?.distinct_documents}`,
  );
  record(
    "funnel",
    "HUMAN_VERIFIED documents and facts are never collapsed into one count",
    typeof funnel?.stages?.human_verified?.verified_documents === "number" &&
      typeof funnel?.stages?.human_verified?.human_verified_facts === "number",
    `docs=${funnel?.stages?.human_verified?.verified_documents} facts=${funnel?.stages?.human_verified?.human_verified_facts}`,
  );
  record(
    "funnel",
    "funnel attributes HUMAN_VERIFIED facts to script stamps vs workbench review",
    typeof funnel?.stages?.human_verified?.script_stamped_facts === "number",
    `script_stamped=${funnel?.stages?.human_verified?.script_stamped_facts} workbench=${funnel?.stages?.human_verified?.workbench_attributed_facts}`,
  );
  record(
    "funnel",
    "blocked documents are broken out by error class including OCR_REQUIRED",
    typeof funnel?.stages?.blocked?.ocr_required === "number" &&
      typeof funnel?.stages?.blocked?.other === "number",
    `failed=${funnel?.stages?.blocked?.failed} ocr_required=${funnel?.stages?.blocked?.ocr_required}`,
  );
  const scriptStamped = funnel?.stages?.human_verified?.script_stamped_facts ?? 0;
  if (scriptStamped > 0) {
    note(
      "funnel",
      "script-stamped HUMAN_VERIFIED facts exist and must not be counted as human verification",
      `${scriptStamped} facts carry a harness marker in verification_events.note`,
    );
  }

  // =====================================================================
  // Summary
  // =====================================================================
  const blocking = matrix.filter((row) => !row.informational);
  const failed = blocking.filter((row) => !row.ok);
  const passed = blocking.filter((row) => row.ok);
  console.log(
    `\n${passed.length} passed, ${failed.length} failed, ${blocking.length} blocking assertions`,
  );
  for (const row of failed) {
    console.log(`  FAIL [${row.domain}] ${row.name} — ${row.detail}`);
  }

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(
    OUT_JSON,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        verdict: failed.length === 0 ? "PASS" : "FAIL",
        passed: passed.length,
        failed: failed.length,
        total: blocking.length,
        ocr_key_present: ocrKeyPresent,
        processor_url: processorUrl,
        matrix,
        probe: probe.ok ? probe.data : { error: probe.error },
        funnel_stages: funnel?.stages ?? null,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`\nArtifact: ${OUT_JSON}`);
  console.log(`Verdict: ${failed.length === 0 ? "PASS" : "FAIL"}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

await main();
