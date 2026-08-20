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
```

Wired parsers: `xlsx-openpyxl`, `pdf-native`. Scanned PDFs / DOCX / images **escalate** per [docs/ROUTING_POLICY.md](../../docs/ROUTING_POLICY.md) (OCR adapters stay stubs). Re-run scores:

```text
python -m lp_processor.evals.harness
pytest
```

Do **not** deploy this folder as a Vercel service. `vercel.json` stays web-only.

```text
pytest
```
