# Phase 5 acceptance

Human verification against source. AI-extracted values are not canonical. There is still no `pricing_lines` table — unverified rates cannot appear as canonical rates.

## What landed

- `/ingestion/verification` queue and `/ingestion/verification/[documentId]` split workbench
- PDF.js (`react-pdf`) for digital PDFs; XLSX grid from `extraction_runs.normalized_document` with the active cell highlighted
- VERIFY / EDIT / REJECT / FLAG CONFLICT / VERIFY GROUP, plus j/k/v/r/c/g keys
- Every decision writes `verification_events` with actor
- `HUMAN_VERIFIED` still requires `verified_by` + `verified_at`
- Identity promotion only for `client_name` / `opportunity_title` (and aliases) onto `clients` / `opportunities`
- Document **Complete verification** sets `VERIFIED` only when no facts remain `AI_EXTRACTED` / `NEEDS_REVIEW` / `CONFLICT`, then resumes Workflow hook `verify:{documentId}`

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm run test:phase2-rls
npm run test:phase5-verification
```

Manual: process an XLSX (processor running), open Verification Queue, accept a cell, confirm `HUMAN_VERIFIED` with your user id. Complete verification only after open facts are decided.

## Out of scope (still true)

Proposal editor, Glide pricing workbench, public research agents, four-truth contract schema (Phase 7).
