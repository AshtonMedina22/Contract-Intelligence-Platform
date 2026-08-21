# P2 — Real Corpus Data Ops Productization Acceptance

**Phase:** Productization P2 — Data Ops hardening for real corpus workflow  
**Audit date:** 2026-08-21  
**Command:** Lint, typecheck, build, processor tests, corpus-funnel-report

---

## Before State

- Intake UX: no client-side preflight, no per-file status tracking, no success links
- Processing queue: no lifecycle_error column, raw status badges, no filter chips, no filename links
- OCR handling: ParserNotWiredError thrown but not specifically marked as OCR_REQUIRED
- Re-extract: could overwrite HUMAN_VERIFIED facts silently
- Verification workbench: no keyboard 'e' for edit focus, no optimistic updates, no auto-advance
- Exceptions: no document filename/status join, no filters, no required disposition note
- No corpus funnel report script
- Registry had stale `/data-ops/*` paths instead of `/ingestion/*`

---

## KEEP / FIX / HARDEN / DEFER

### KEEP (unchanged)
- Server-side ingest path (`ingestSourceBytes`)
- Supabase Storage vault with SHA-256 checksums
- Vercel Workflow lifecycle
- FastAPI processor architecture
- Existing keyboard shortcuts (j/k/v/r/c/g/s)
- Resizable source/facts layout in verification workbench

### FIX
- Registry paths: `/data-ops/*` → `/ingestion/*` (5 routes fixed)
- Exceptions page: separate query to join document filename/status (Supabase lacks FK relation)

### HARDEN
1. **Intake UX** (`intake-form.tsx`)
   - Client preflight: validates empty, oversize (50MB), bad extension before upload
   - Per-file status tracking: pending/uploading/ok/duplicate/error badges
   - Success links: direct to Processing queue and Verification workbench

2. **Processing status UX** (`queue-table.tsx`, `processing/page.tsx`)
   - Shows `lifecycle_error` column (no silent failures)
   - Operator badge mapping: QUEUED/PROCESSING/NEEDS_REVIEW/FAILED/OCR_REQUIRED/COMPLETE
   - Filter chips for all states with counts
   - Filename links to verification workbench

3. **OCR_REQUIRED semantics** (`services/processor/src/lp_processor/jobs.py`)
   - When ParserNotWiredError contains "ocr" or "mistral": sets `lifecycle_error = "OCR_REQUIRED: ..."`
   - UI maps this to OCR_REQUIRED badge

4. **Re-extract guard** (`services/processor/src/lp_processor/store.py`)
   - Queries existing HUMAN_VERIFIED facts by idempotency_key
   - Skips those keys during upsert — never overwrites verified work

5. **Verification workbench speed** (`workbench-client.tsx`)
   - Keyboard 'e' for edit focus (selects input text)
   - Optimistic local status after verify/reject
   - Auto-advance to next open fact after v/r decision
   - Escape key blurs input fields

6. **Exceptions accuracy** (`exceptions-table.tsx`, `exceptions/page.tsx`)
   - Joined document filename and processing_status via separate query
   - Default open-only filter with filter chips
   - Required disposition note on resolve (dialog prompt)
   - Visual differentiation: no_facts (yellow) vs precedence_conflict (red)

7. **Corpus funnel report** (`scripts/corpus-funnel-report.mjs`)
   - Queries live org for honest counts
   - Reports each stage SEPARATELY (never collapses to one "complete" number)
   - Explicit note: harness ≠ HUMAN_VERIFIED

### DEFER → VERIFIED
- Browser verification via IronBee DevTools — **PASS** (verified 2026-08-21)
- Full end-to-end intake/processor path test — **PASS** (verify3 26/26 passed)
- OCR live test — OCR_REQUIRED correctly routes (MISTRAL_API_KEY deferred)

---

## Reference Repos Licenses

No external code was imported wholesale. This productization hardened existing local code.

Reference patterns consulted:
- **opencontracts** (Apache-2.0) — extraction/verification workflow concepts
- **docling** (MIT) — document parsing architecture reference
- **unstructured** (Apache-2.0) — parsing pipeline concepts

Nothing copied; patterns only.

---

## Corpus Funnel Counts (2026-08-21)

```
| Stage                        | Count          |
| ---------------------------- | -------------- |
| Discovered (manifest)        | 46             |
| Ingested (docs)              | 34             |
| NEEDS_REVIEW docs            | 0              |
| VERIFIED docs                | 33             |
| HUMAN_VERIFIED facts         | 204            |
| Sourced pricing_lines        | 34             |
| A/B packages                 | 15             |
```

**NOTE:** 204 HUMAN_VERIFIED facts came from harness stamps (AI extraction pipeline), not workbench eyeballs. Actual human verification requires operator review in the Verification workbench with source PDF visible.

---

## Verification Results (Independent P2 Verification 2026-08-21)

### Code Audit Spot-Checks
| Check | Result | Evidence |
| --- | --- | --- |
| store.py: HUMAN_VERIFIED skip on re-extract | **PASS** | Lines 121-149: queries verified_keys, filters drafts |
| jobs.py: OCR_REQUIRED prefix | **PASS** | Lines 17-24: "OCR_REQUIRED: {error}" on ParserNotWiredError |
| queue-table: lifecycle_error + operator badges | **PASS** | Lines 23, 30-53: error column + badge mapping |
| intake-form: preflight + per-file status | **PASS** | Lines 33-56, 147-165: validateFile + StatusBadge |
| workbench: e key, optimistic, auto-advance | **PASS** | Lines 262-264, 136-153, 110-121 |
| exceptions: disposition required | **PASS** | Lines 71, 200: check dispositionNote.trim() |
| corpus-funnel-report.mjs exists | **PASS** | Distinguishes stages explicitly |
| No auto-promote AI to HUMAN_VERIFIED | **PASS** | store.py line 146: always AI_EXTRACTED |

### Test Suite Results
| Test | Result | Notes |
| --- | --- | --- |
| `npm run lint` (apps/web) | **PASS** | No lint errors |
| `npx tsc --noEmit` (apps/web) | **PASS** | No type errors |
| `python -m pytest tests/ -v` (processor) | **PASS** | 18/18 tests passed |
| `test:phase5-verification` | **PASS** | 3/3 rule assertions |
| `test:verify3` | **PASS** | 26/26 assertions (real pilot PDFs) |
| `corpus-funnel-report.mjs` | **PASS** | See counts above |

### Browser Verification (IronBee DevTools)
| Page | Result | Evidence |
| --- | --- | --- |
| `/ingestion/intake` | **PASS** | Preflight shown (50MB, PDF/XLSX), disabled submit |
| `/ingestion/processing` | **PASS** | Filter chips (34 total, 1 OCR_REQUIRED, 33 Complete), lifecycle_error visible |
| `/ingestion/verification` | **N/A** | Queue visible; workbench requires doc selection |
| `/ingestion/exceptions` | **PASS** | 62 open exceptions, Resolve buttons, Precedence Conflict badges |

---

## External Blockers

1. **OCR key** — `MISTRAL_API_KEY` not set; scanned PDFs correctly route to OCR_REQUIRED
2. **Hosted processor** — Local processor at :8080 verified healthy; remote deferred

**Note:** Browser verification completed via IronBee DevTools with dev server running.

---

## Explicit: harness ≠ HUMAN_VERIFIED

The 204 facts marked HUMAN_VERIFIED were stamped by the pilot harness script (`phase2-pilot-run.mjs`), not by a human reviewing source PDFs in the Verification workbench. The trust boundary remains:

- **AI_EXTRACTED** — processor extracted, not trusted
- **HUMAN_VERIFIED** — only set when a human reviews the source evidence
- **Processor cannot set VERIFIED** — blocked at store.py level

This productization does not claim 20-30 HUMAN_VERIFIED packages in the genuine sense. The harness stamps enable pipeline testing, but real L&P operator verification requires workbench interaction.

---

## Files Changed

### apps/web/app/(platform)/ingestion/
- `intake/intake-form.tsx` — preflight validation, per-file status, success links
- `processing/queue-table.tsx` — lifecycle_error, operator badges, filter chips, filename links
- `processing/page.tsx` — includes lifecycle_error in query
- `verification/workbench-client.tsx` — keyboard e, optimistic updates, auto-advance
- `exceptions/exceptions-table.tsx` — filters, disposition dialog, type badges
- `exceptions/page.tsx` — separate doc query for join

### services/processor/src/lp_processor/
- `jobs.py` — OCR_REQUIRED error prefix for ParserNotWiredError
- `store.py` — skip HUMAN_VERIFIED facts on re-extract

### apps/web/lib/data-model/
- `registry.ts` — fixed /data-ops/* → /ingestion/* paths

### scripts/
- `corpus-funnel-report.mjs` — new funnel report script

---

## STOP

**Independent P2 verification complete: PASS**

Verified 2026-08-21 by independent agent. All code audit spot-checks pass. All test suites green. Browser UI verified via IronBee DevTools. Commit follows.
