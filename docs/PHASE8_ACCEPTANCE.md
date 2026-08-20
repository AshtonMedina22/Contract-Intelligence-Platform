# Phase 8 acceptance

> **Legacy engineering Phase 8 → Canonical product Phase 4 (partial).** Bulk RPC/UI exist; **no L&P corpus migrated.**

Controlled bulk historical migration. Verification remains the bottleneck. No Cloud Run (Phase 6 did not justify it).

## What landed

- `/ingestion/bulk` — create a labeled batch, ingest many files with **deferred** processing
- Per-file failure isolation (`batch_ingest_items`); duplicates skip re-ingest
- Batch counters + `api_cost_usd` / `compute_cost_usd` on `document_batches`
- **Start batch processing** fans out parse/extract; documents still end at `NEEDS_REVIEW`, never auto-`VERIFIED`

## Checks

```bash
npm run test:phase8-bulk
npm run typecheck
```

## Out of scope (still true)

Cloud Run Jobs, managed OCR wiring, auto-verification, proposal editor, contract Cron (**legacy Phase 9 / canonical Phase 4**).
