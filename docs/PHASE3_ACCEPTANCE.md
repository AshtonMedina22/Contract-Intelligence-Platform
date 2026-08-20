# Phase 3 acceptance — Production Historical Ingestion & Migration

**Canonical product Phase 3.**  
**Date:** 2026-08-20  
**Command:** `npm run test:phase3` (aggregates intake + production + bulk + verify gates + processor)

---

## Verdict

**PASS** (with one explicit deferred dependency)

Repeatable source-to-canonical Data Ops path is productionized for digital PDF / XLSX / DOCX: Intake → Storage → registry → JobPort/Workflow → parser → staging → human verification → promote → verified-only chunks. Bulk migration never auto-VERIFIES. Scanned-PDF OCR is wired behind `MISTRAL_API_KEY` (external credential).

---

## What landed (this prompt)

| Area | Implementation |
| --- | --- |
| Lifecycle | Unchanged contract: Workflow owns lifecycle; Queues fan-out only via JobPort |
| DOCX | `python-docx` parser wired (`docx-native`); never OCR |
| XLSX | openpyxl first; policy forbids OCR |
| Scans / OCR | `ocr_mistral` adapter; live only when `MISTRAL_API_KEY` set |
| Intake size | Raised to **50 MB** (covers Allen-class packets) |
| Package grouping | Intake + bulk accept `package_key` → `procurement_packages` + `documents.procurement_package_id` |
| Verification UX | Resizable source-vs-fact; TanStack fact table; VERIFY / EDIT / REJECT / FLAG CONFLICT / VERIFY GROUP / VIEW SOURCE / RESOLVE |
| Audit | `verification_events` for VERIFY + VIEW_SOURCE + RESOLVE |
| Exceptions | Resolve action on Exceptions queue + workbench |
| Embeddings | `JobPort.enqueueEmbedFanOut` after HUMAN_VERIFIED chunk promote (inline until Queues configured) |
| Bulk | Still deferred processing; no auto-VERIFIED |

---

## Deferred dependency

| Item | Why |
| --- | --- |
| Live OCR on scanned PDFs without `MISTRAL_API_KEY` | External API credential; adapter is present and key-gated. Without key, scans escalate clearly (FAILED), never fake text. |
| Managed `@vercel/queue` workers | Fan-out contract is on JobPort; current embed fan-out runs inline after verify |

---

## Test evidence

```text
npm run test:phase3-production   18/18 PASS
npm run test:phase3-intake       9/9 PASS
npm run test:phase8-bulk         5/5 PASS
npm run test:phase7-four-truth   10/10 PASS
npm run test:phase11-hybrid-rag  PASS
npm run test:phase2-rls          48/48 PASS
npm run test:verify2c            65/65 PASS
python -m pytest (processor)     13 passed
npm run typecheck / lint / build PASS
```

---

## Data Ops IA

Intake · Processing · Verification · Exceptions · Historical Migration (`/ingestion/*`)

---

## STOP

No Phase 4 expansion in this prompt.
