# Production routing policy

This is the checked-in production routing document. Parser choice is **not** a vendor slogan. Change it only when `docs/benchmarks/PILOT_RESULTS.md` shows evidence.

Machine copy: `services/processor/src/lp_processor/routing_policy.json` (version **1.0.0**). The processor `select_parser` enforces these rules. Live wiring is reported by `GET /health` → `routing_policy` (fields `wired`, `escalate_unwired`, `ocr_ready`).

## Locked routes

`document_class` and `parser_id` below are the exact values `decide_route` returns.

| Input | `document_class` | Route (`parser_id`) | Wired now? |
| --- | --- | --- | --- |
| XLSX / XLSM / XLS | `xlsx` | `xlsx-openpyxl` (openpyxl). Never OCR or LLM-first. | **Yes** |
| Digital PDF (mean extractable chars/page ≥ 40) | `digital_pdf` | `pdf-native` (pypdf) | **Yes** |
| DOCX | `docx` | `docx-native` (python-docx) | **Yes** |
| Scanned / empty PDF (mean chars/page < 40) | `scanned_pdf` | `ocr-mistral` (Mistral OCR API) | **Only with `MISTRAL_API_KEY`** — otherwise fail closed as `OCR_REQUIRED` |
| Raster image (TIFF/PNG/JPEG/WEBP) | `raster_image` | Escalate `ocr-document-ai` | **No** — stub |
| Anything else | `unknown` | `unknown` | **No** — fail closed |
| Low confidence / conflict | — | Leave `AI_EXTRACTED` / `NEEDS_REVIEW`; human verification | Yes |

A PDF routed with no bytes available falls back to `digital_pdf` / `pdf-native`; the scan check needs the payload.

## Fail-closed contract

The processor must never store an empty native parse as success, and must never fabricate text for a page it could not read.

- `scanned_pdf` with **no** `MISTRAL_API_KEY` → `ParserNotWiredError` → document `FAILED` with `lifecycle_error` prefixed **`OCR_REQUIRED:`**.
- `scanned_pdf` **with** a key but the OCR call fails or returns zero pages → also `OCR_REQUIRED:`, because the document still needs OCR that did not happen.
- `raster_image` and `unknown` → `FAILED` with the router's reason, no OCR prefix.

The `OCR_REQUIRED:` prefix is the contract the Data Ops queue badge reads. `lp_processor.jobs.parse_lifecycle_error` is idempotent, so an outer handler re-recording the same exception cannot strip the prefix (regression fixed 2026-08-21; see `tests/test_jobs_failure_semantics.py`).

Every parse-stage failure also writes a `validation_exceptions` row carrying the error class (`ocr_required`, `parse_failed`) and a human-readable reason.

## Stub parsers (listed, deliberately not wired)

`pdf-docling`, `ocr-document-ai`, `pdf-multimodal`. `PARSER_PDF=docling` is rejected on purpose — keep `PARSER_PDF=native`. Reference notes: [reference-repos/docling.md](reference-repos/docling.md), [reference-repos/unstructured.md](reference-repos/unstructured.md), [reference-repos/opencontracts.md](reference-repos/opencontracts.md).

## Size limits (one gate, stated honestly)

| Layer | Limit | Where |
| --- | --- | --- |
| Intake client preflight | 50 MB | `apps/web/app/(platform)/ingestion/intake/intake-form.tsx` |
| Intake server (upload + Drive import) | 50 MB (`MAX_INTAKE_BYTES`) | `apps/web/lib/intake/allowed-files.ts` |
| Processor parse | **no byte limit** — it downloads from the vault, so no request-body cap applies | `lp_processor.store.download_evidence` |
| Mistral OCR API | vendor-side cap on the uploaded document | `lp_processor.parsers.ocr_mistral` |

There is **no 25 MB gate anywhere in code**. Older docs claiming a 25 MB intake limit blocked the Allen ISD board packet are stale: the packet is ~32 MB, under the 50 MB gate, and is ingested. Client preflight and server limit are the same constant path, so a file that passes the browser check is not rejected server-side for size.

## Cost / compute (this evidence)

Local openpyxl, pypdf, and python-docx: **$0 API**. Only `ocr-mistral` spends money, and only for `scanned_pdf`. Fixture runs do not justify Cloud Run, Document AI, or Docling spend. `cloud_run_required` is **false**.

## What this policy is not

It is **not** a claim that 20–30 L&P packages were scored, and **not** a claim that OCR has been exercised against real scanned L&P evidence. Current corpus stage counts: [functionality/F1_PRODUCTION_INGESTION_ACCEPTANCE.md](functionality/F1_PRODUCTION_INGESTION_ACCEPTANCE.md), regenerate with `npm run report:corpus-funnel` (artifact `docs/benchmarks/corpus-funnel.json`). The gap list lives in [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md). Re-run:

```powershell
cd services/processor
.\.venv\Scripts\Activate.ps1
python -m lp_processor.evals.harness
```

When real packages exist, add gold files and increment the policy version only if a route changes.
