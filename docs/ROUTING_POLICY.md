# Production routing policy (Phase 6)

This is the checked-in production routing document. Parser choice is **not** a vendor slogan. Change it only when `docs/benchmarks/PILOT_RESULTS.md` shows evidence.

Machine copy: `services/processor/src/lp_processor/routing_policy.json` (version **1.0.0**). The processor `select_parser` enforces these rules.

## Locked routes

| Input | Route | Wired now? |
| --- | --- | --- |
| XLSX / XLSM / XLS | `xlsx-openpyxl` (openpyxl). Never OCR or LLM-first. | Yes |
| Digital PDF (mean extractable chars/page ≥ 40) | `pdf-native` (pypdf) | Yes |
| Scanned / empty PDF (mean chars/page < 40) | Escalate `ocr-mistral`, fallback `ocr-document-ai` | **No** — fail closed, do not store an empty native parse as success |
| DOCX | Escalate `docx-native` / Docling | **No** |
| Raster image (TIFF/PNG/JPEG) | Escalate `ocr-document-ai` | **No** |
| Low confidence / conflict | Leave `AI_EXTRACTED` / `NEEDS_REVIEW`; human verification | Yes (Phase 5) |

## Cost / compute (this evidence)

Local openpyxl and pypdf: **$0 API**. Fixture runs do not justify Cloud Run, Mistral, Document AI, or Docling spend. `cloud_run_required` is **false**.

## What this policy is not

It is **not** a claim that 20–30 L&P packages were scored. Fixture coverage is the baseline; the gap list lives in [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md). Re-run:

```powershell
cd services/processor
.\.venv\Scripts\Activate.ps1
python -m lp_processor.evals.harness
```

When real packages exist, add gold files and increment the policy version only if a route changes.
