# F1 — Production document ingestion / OCR / real-corpus acceptance

**Date:** 2026-08-21
**Scope:** harden and wire the existing ingestion path. The vault, Vercel Workflow lifecycle, JobPort, and the parser abstraction were **not** rebuilt.
**Verdict:** **PASS on the ingestion mechanics. Corpus and OCR exit criteria remain UNMET.**
**Run:** `npm run test:f1-ingestion` · `npm run report:corpus-funnel`
**Artifacts:** `docs/benchmarks/f1-production-ingestion-results.json`, `docs/benchmarks/corpus-funnel.json`

Companion docs: [ROUTING_POLICY.md](../ROUTING_POLICY.md) · [CURRENT_STATE_AUDIT.md](../CURRENT_STATE_AUDIT.md) · [WORK_TRAIL.md](../WORK_TRAIL.md) · [benchmarks/PILOT_GAP_REPORT.md](../benchmarks/PILOT_GAP_REPORT.md)

---

## 1. What changed

| # | Change | File |
| --- | --- | --- |
| 1 | `OCR_REQUIRED:` prefix now survives every layer that records a parse failure | `services/processor/src/lp_processor/jobs.py` |
| 2 | Parse failures write an **error class** + **human reason** to `validation_exceptions` | `jobs.py` (`ocr_required`, `parse_failed`, `extract_failed`) |
| 3 | Extraction-stage failures now finish the run created by parse (previously leaked open) | `jobs.py` |
| 4 | Funnel `extracted` count fixed (`head:true` + `.length` always returned 0) and stages expanded to 10 | `scripts/corpus-funnel-report.mjs` |
| 5 | Funnel now attributes `HUMAN_VERIFIED` facts to **script stamp vs workbench review** | `scripts/corpus-funnel-report.mjs` |
| 6 | Intake client preflight derives from `MAX_INTAKE_BYTES` so it cannot drift from the server | `apps/web/.../intake-form.tsx` |
| 7 | Routing policy, processor README, and `.env.example` aligned to the wired DOCX/OCR reality | `docs/ROUTING_POLICY.md`, `services/processor/README.md`, `apps/web/.env.example` |
| 8 | New acceptance script + npm scripts (`test:f1-ingestion`, `report:corpus-funnel`) | `scripts/f1-production-ingestion-acceptance.mjs` |

### The OCR_REQUIRED overwrite bug was real and had already corrupted live data

`run_parse` recorded `OCR_REQUIRED: …`, then the `run_parse_and_extract` catch-all re-recorded the *same* exception as `str(exc)`, dropping the prefix. The Data Ops OCR badge reads that prefix, so a scanned PDF looked like a generic parse failure.

Evidence: with the fix reverted, `test_parse_and_extract_never_strips_the_ocr_prefix` fails with a message **byte-identical** to the `lifecycle_error` then stored on the live `SRC-19_ArlingtonVA_19-264-RA3Final.pdf` row:

```
Checked-in policy: mean extractable chars/page=0.0 (threshold 40). Escalate to OCR;
do not accept empty native parse. parser_id=ocr-mistral class=scanned_pdf policy=1.0.0 …
```

The fix makes `parse_lifecycle_error` **idempotent**, so an outer handler re-recording the same exception cannot strip the prefix. Re-running parse on that real document through the live processor now yields:

```
status       : FAILED
lifecycle    : OCR_REQUIRED: Checked-in policy: mean extractable chars/page=0.0 (threshold 40) …
error class  : ocr_required
human reason : This document needs OCR before facts can be extracted. Set MISTRAL_API_KEY
               on the processor and re-run parse. Router said: …
```

The corpus funnel `OCR_REQUIRED` count moved from **0 → 1** as a result. It had been undercounting.

---

## 2. Parser / OCR status

Live `GET /health` on the local processor, 2026-08-21:

| Parser | State | Notes |
| --- | --- | --- |
| `xlsx-openpyxl` | **wired** | openpyxl. Never OCR. Sheet + cell provenance on every cell. |
| `pdf-native` | **wired** | pypdf. Digital PDFs (mean chars/page ≥ 40). |
| `docx-native` | **wired** | python-docx. Previously documented as unwired — docs were stale, code was wired. |
| `ocr-mistral` | **key-gated, currently OFF** | `MISTRAL_API_KEY` absent → `ocr_ready: false`. Scanned PDFs fail closed as `OCR_REQUIRED`. |
| `ocr-document-ai` | stub | Raster images (TIFF/PNG/JPEG/WEBP) still escalate unwired. |
| `pdf-docling`, `pdf-multimodal` | stub | Deliberate. `PARSER_PDF=docling` is rejected. |

Routing classes asserted end to end: `DIGITAL_PDF`, `SCANNED_PDF`, `DOCX`, `XLSX`, `UNSUPPORTED`.

**OCR is proven only as a fail-closed contract, not as OCR coverage.** With no key the adapter escalates without opening an HTTP client, never fabricates text, never stores an empty parse as success, and never reaches `NEEDS_REVIEW`. Setting a key flips `ocr_ready` and wires `ocr-mistral` (verified without any network call). **No real scanned L&P document has been OCR'd.**

---

## 3. Corpus funnel — honest stage counts (2026-08-21)

Stages are separate measures. They are deliberately **not** collapsed into one "complete" number.

| Stage | Count | Note |
| --- | --- | --- |
| 1 DISCOVERED | **20** SRC ids (manifest declares **18** USABLE) | two different manifest measures, reported separately |
| 2 ACQUIRED | **33** files / 51.7 MB | real bytes under `docs/pilot/acquired` |
| 3 INGESTED | **34** documents / **34** versions | every version retained |
| 4 PARSED | **32** documents (71 runs) | parser mix: `pdf-native` = 71 |
| 5 EXTRACTED | **33** documents / **1374** facts | 0 parsed-with-zero-facts |
| 6 BLOCKED | **1** FAILED — **1** `OCR_REQUIRED`, 0 other | SRC-19 scanned amendment |
| 7 REVIEW_READY | **0** `NEEDS_REVIEW` | status mix: VERIFIED 33, FAILED 1 |
| 8 HUMAN_VERIFIED | **33** docs / **204** facts | **195 script-stamped**, 0 workbench, 9 unattributed |
| 9 CANONICAL_PROMOTED | **34 of 34** pricing_lines carry `source_fact_id` | 22 procurement_packages |
| 10 A/B COMPLETE | **15** A/B packages fully VERIFIED | of 15 A/B packages, 23 A/B docs VERIFIED |

### Stage 8 is not human verification

195 of the 204 `HUMAN_VERIFIED` facts carry a harness marker in `verification_events.note` (`Re-extract map fill`, `Structured value accepted`, `Source page N`) written by `scripts/phase2-pilot-run.mjs` and `scripts/reextract-mapped-docs.mjs`. The DB `extracted_facts_verified_requires_actor` constraint is satisfied because those scripts sign in as the operator, so the actor column cannot distinguish them — the note can.

**Zero facts are attributable to workbench review.** Stage 8 and stage 10 are therefore automation output. Canonical Phase 2 exit (~20–30 A/B packages through *human* verification) is **UNMET**, and `0 NEEDS_REVIEW` means no queue is currently waiting for a reviewer.

---

## 4. Size limits — one honest gate

There is **no 25 MB limit anywhere in code**. Docs claiming a 25 MB intake gate blocked the Allen ISD board packet were stale.

| Layer | Limit |
| --- | --- |
| Intake client preflight | 50 MB, now derived from `MAX_INTAKE_BYTES` |
| Server Action body | 50 MB (`next.config.ts`) |
| Intake server (upload + Drive) | 50 MB (`MAX_INTAKE_BYTES`) |
| Processor parse | **no byte limit** — downloads from the vault, so no request-body cap applies |
| Mistral OCR | vendor-side document cap (untested; no key) |

VERIFY 3 measures the Allen packet (SRC-03) at **31.1 MB / 50 MB** and it ingests successfully. The client preflight now imports the server constant, so a file that passes the browser check cannot be rejected server-side for size.

---

## 5. Tests

| Suite | Result |
| --- | --- |
| `npm run test:processor` (pytest) | **45 passed** — 20 new across 3 files |
| `npm run test:f1-ingestion` | **37 / 37 PASS** (routing, ocr, lifecycle, trust, size, integrity, health, funnel) |
| `npm run test:verify3` | **26 / 26 PASS** |
| `npm run test:phase3` | intake 9, production 21, bulk 5, verification 3, four-truth 10, hybrid-rag 10, processor 45 — **all PASS** |
| `npm run test:foundation` | env:check, RLS 51, intake 9, verification 3, processor 45, verify1 5 + 21 — **all PASS** |
| `npm run test:verify2a` | **132 / 132 PASS** (SRC-19 confirmed 9 pages / 0 chars extracted) |
| `npm run lint` · `npm run typecheck` · `npm run build` | clean |

New pytest coverage: `test_jobs_failure_semantics.py` (prefix survival, idempotence, 500-char budget, error classes, no fabricated text), `test_ocr_adapter_contract.py` (no network without credentials, empty/failed OCR escalates, page provenance), and an expanded `test_routing.py` covering every routing class plus `ocr_ready` health in both credential postures.

Integrity assertions run against real acquired corpus bytes in an ephemeral org: multi-doc package association, SHA-256 dedupe returning the original document with no second version row, version retention, `HUMAN_VERIFIED`-without-actor rejected by the DB, and fresh facts defaulting to `AI_EXTRACTED`.

---

## 6. Blockers and honest gaps

| # | Gap | Severity |
| --- | --- | --- |
| 1 | **OCR unproven on real evidence.** No `MISTRAL_API_KEY`; SRC-19 is correctly `OCR_REQUIRED` but has never been OCR'd. | blocking for scanned coverage |
| 2 | **195/204 `HUMAN_VERIFIED` facts are script stamps.** Zero workbench-attributed verification. Stage 8/10 are not human truth. | blocking for Phase 2 exit |
| 3 | **0 `NEEDS_REVIEW`.** The harness verified everything, so no human queue exists. | blocking for Phase 2 exit |
| 4 | Manifest DISCOVERED (20 SRC ids / 18 USABLE) is behind ACQUIRED (33) and INGESTED (34). SRC-20…SRC-30 were acquired without a manifest update, so DISCOVERED understates the corpus. | non-blocking, misleading |
| 5 | Raster images (TIFF/PNG/JPEG) still escalate to the unwired `ocr-document-ai` stub. | non-blocking |
| 6 | **XLSX corpus hole persists.** 0 real `.xlsx` acquired; sheet/cell provenance proven by fixture only. | non-blocking |
| 7 | PARSED (32) < EXTRACTED (33): one document has facts but no run holding a `normalized_document`. | non-blocking provenance gap |
| 8 | The local processor had been running **stale code since 2026-08-20**, silently leaving documents in `PARSING`. Restart it after processor changes; it has no `--reload`. | ops |

### What must not be claimed

Ingestion mechanics, routing, dedupe, provenance, and the OCR fail-closed contract are proven. **Do not** claim OCR coverage, human-verified corpus depth, or Phase 2 exit. 15 A/B packages are harness-complete, not human-verified.

---

## 7. Next work

1. Set `MISTRAL_API_KEY` and OCR SRC-19 to produce the first real scanned-document evidence.
2. Route a real reviewer through the verification workbench so stage 8 gains workbench-attributed facts; stop treating harness stamps as verification.
3. Refresh `PILOT_CORPUS_MANIFEST.md` to the 33 acquired files so DISCOVERED stops understating the corpus.
4. Acquire at least one real pricing workbook (`.xlsx`) to close the coverage hole.
