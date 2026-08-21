# F19 — Google Drive / Workspace SOURCE ingestion acceptance

**Status:** IMPLEMENTED + FIXTURE-PROVEN; LIVE BLOCKED (2026-08-21)  
**Acceptance:** `npm run test:f19-drive` — **13/13 PASS**  
**Live blocker:** `GOOGLE_DRIVE_ACCESS_TOKEN` is unset. No live Drive API call or staging-folder import was claimed.
**Database:** migration `20260821360000_f19_drive_source_ingest.sql` applied successfully through `DIRECT_URL`.

## Pre-audit / architecture boundary

- Direction is `SOURCE_INGEST`.
- Google Drive is a selective source and human workspace. It is not the canonical database.
- Every fetched/exported byte stream goes through F1 `ingestSourceBytes` into the append-only Supabase Storage evidence vault.
- F8 `apps/web/lib/google/docs-provider.ts` remains the separate Google Docs `WORKING_PROPOSAL_OUTPUT` module. F19 does not import, merge, or alter it.
- OAuth tokens are read only in server code. No token is sent to the client or stored in `document_source_links.metadata`.
- Selection is explicit file IDs and/or one folder's immediate children, bounded by `maxItems` (UI cap 100; provider hard cap 1,000). There is no recursive or domain-wide crawl.

## Shipped

- `packages/shared/src/document-source-provider.ts`
  - `DocumentSourceProvider`
  - fixed `SOURCE_INGEST` direction
  - scoped list/fetch contracts and typed provider errors
- `apps/web/lib/intake/local-upload-provider.ts`
  - local upload implementation of the same source contract
- `apps/web/lib/intake/drive.ts`
  - official Drive v3 REST patterns: `files.get`, parent-scoped `files.list`, blob `alt=media`, Workspace `files.export`
  - PDF/blob download
  - Google Docs → DOCX by default or PDF by operator choice
  - Google Sheets → XLSX
  - pagination, 401/403 expiry/scope errors, 404 availability, 429 and provider failures
- `apps/web/lib/intake/drive-sync.ts`
  - selective list → fetch/export → checksum → F1 vault ingestion
  - same bytes dedupe
  - changed bytes append a `document_version` to the same linked document
  - rename/move refreshes source-link metadata without inventing a version
  - upstream 404 sets `UNAVAILABLE`; it never deletes a version or Storage object
- Data Ops → Intake form
  - multiple file IDs, optional folder ID, max items, Docs export format
  - explicit configured/live-blocked state
- migration `20260821360000_f19_drive_source_ingest.sql`
  - org-scoped `document_source_links`
  - same-org document FK, source direction lock, checksum/export/availability checks
  - member read + intake-role insert/update RLS
  - no authenticated delete
  - audit action `drive.source_sync` uses the existing append-only `audit_log`

## Fixture acceptance

The acceptance harness uses injected `fetch` fixtures and an in-memory Supabase/ingest seam. It proves:

1. single PDF download
2. Google Doc export to DOCX and PDF
3. Google Sheet export to XLSX
4. bounded parent-scoped pagination
5. same file twice dedupes
6. changed bytes create a new version on the same document
7. rename and move update link metadata without a new version
8. upstream deletion marks unavailable while retaining evidence
9. provider 5xx failure
10. expired/unauthorized token
11. unset-token explicit blocker
12. tenant/RLS/delete/direction greps
13. F19 SOURCE and F8 OUTPUT separation plus server-only/non-recursive greps

## Approved staging folders

- Platform: <https://drive.google.com/drive/folders/1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF>
- Test Documents: <https://drive.google.com/drive/folders/16OAYM97haJkn2zyBnKnh7L8RouSqtGfc>

These are operator staging locations, not canonical storage. Listing either folder is non-recursive and always requires an explicit `maxItems`.

## Live acceptance when configured

When `GOOGLE_DRIVE_ACCESS_TOKEN` exists, `test:f19-drive` performs a read-only list of at most three immediate children from the Platform staging folder. A real operator import must then confirm:

1. file is copied into the evidence vault;
2. `document_source_links.direction = SOURCE_INGEST`;
3. a repeat is a checksum duplicate;
4. changed bytes append a version;
5. Processing → Verification remains the trust path.

Until that token-gated run occurs, F19 is fixture-proven and live-unvalidated.

## Regression and browser verification

- F1 production ingestion: **37/37 PASS**
- Phase 2 RLS: **51/51 PASS**
- lint: PASS
- TypeScript: PASS
- Next.js production build: PASS (78/78 static-generation pass)
- IronBee browser: authenticated Intake page rendered the file-ID, scoped-folder, max-item and Docs-export controls. With the token absent, all Drive controls and the sync button were disabled; the explicit live blocker and Supabase-vault boundary were present. No new console errors occurred after page load.
