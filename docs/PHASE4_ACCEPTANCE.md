# Phase 4 acceptance

Processor parses into a normalized document and writes **staging** facts. No canonical `contracts` / `pricing_lines`. Status after extract is `NEEDS_REVIEW`, never `VERIFIED`.

## What landed

- FastAPI app in `services/processor` (`/health`, `/jobs/parse`, `/jobs/extract`, `/jobs/parse-and-extract`)
- `XlsxParser` via openpyxl (sheets, merged cells, number formats, formula + cached value)
- `PdfParser` native text+pages via pypdf (Docling and OCR adapters are stubs)
- `HeuristicExtractor` (no model). `GatewayStructuredExtractor` is listed but not enabled
- Idempotent fact writes on `(extraction_run_id, idempotency_key)`
- Workflow/JobPort calls the processor when `PROCESSOR_URL` + `PROCESSOR_SHARED_SECRET` are set

## Checks

```bash
cd services/processor
pip install -e ".[dev]"
pytest
```

From repo root after processor is running:

- Upload an XLSX at `/ingestion/intake` with processor env set
- Facts appear on `extracted_facts` with `AI_EXTRACTED` and sheet coordinates
- Document status is `NEEDS_REVIEW`, not `VERIFIED`

## Out of scope (still true)

Verification workbench, PDF.js, model lock, Cloud Run, canonical contract promotion.
