# Processor

Python FastAPI service for parse/extract into **staging** (`extracted_facts`). It does not write canonical contracts or pricing lines. AI completion is never `VERIFIED`.

## Run locally (Phase 4)

From `services/processor`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
# Reuse apps/web/.env.local (SUPABASE_SECRET_KEY) plus:
# PROCESSOR_SHARED_SECRET=dev-processor-secret
uvicorn lp_processor.app:app --app-dir src --port 8080
```

Health: `GET http://127.0.0.1:8080/health`

Jobs (header `x-processor-secret`):

- `POST /jobs/parse`
- `POST /jobs/extract`
- `POST /jobs/parse-and-extract`

In `apps/web/.env.local`:

```
PROCESSOR_URL=http://127.0.0.1:8080
PROCESSOR_SHARED_SECRET=dev-processor-secret
# Optional. Unset = scanned PDFs fail closed as OCR_REQUIRED instead of being OCR'd.
MISTRAL_API_KEY=
MISTRAL_OCR_MODEL=mistral-ocr-latest
```

`PROCESSOR_URL` is read by the **web app** to reach this service; the processor itself never needs it.

## Parsers

Always wired: `xlsx-openpyxl` (openpyxl), `pdf-native` (pypdf), `docx-native` (python-docx).

`ocr-mistral` is wired **only when `MISTRAL_API_KEY` is set**. Without the key, a scanned PDF (mean extractable chars/page < 40) fails closed: the document goes `FAILED` with `lifecycle_error` prefixed `OCR_REQUIRED:` plus a `validation_exceptions` row with code `ocr_required`. The processor never fabricates text and never stores an empty native parse as success.

Still stubs, deliberately: `ocr-document-ai` (raster images), `pdf-docling`, `pdf-multimodal`.

Check what is live at runtime:

```text
curl http://127.0.0.1:8080/health
# routing_policy.ocr_ready -> true only when MISTRAL_API_KEY is set
# routing_policy.wired / escalate_unwired -> current parser wiring
```

Full route table and the fail-closed contract: [docs/ROUTING_POLICY.md](../../docs/ROUTING_POLICY.md).

## Size limits

This service imposes **no byte limit**. It downloads evidence from the Supabase vault rather than accepting an upload body, so the only gate is the 50 MB intake limit in `apps/web/lib/intake/allowed-files.ts` (`MAX_INTAKE_BYTES`). `ocr-mistral` is additionally subject to the Mistral API's own document cap.

## Tests

```text
pytest
python -m lp_processor.evals.harness
```

From the repo root: `npm run test:processor`.

Do **not** deploy this folder as a Vercel service. `vercel.json` stays web-only.
