# F8 — Real Proposal Output + Google Docs Working-Proposal Pipeline

**Date:** 2026-08-21  
**Status:** Shipped in code (acceptance script `test:f8-proposal-output`). Do not treat as Historical Pilot exit.

## Pre-audit (current state hardened — not duplicated)

| Output | Before F8 | F8 action |
| --- | --- | --- |
| HTML download | Real | Kept; now assembly-driven (APPROVED only) |
| Word `.doc` | Partial (HTML disguised as `.doc`) | Kept as **legacy** path with honest label |
| Native DOCX | Missing | **Built** — `docx` npm → real OOXML (PK zip) |
| PDF | Print-only | **Documented blocker** — `lib/export/pdf.ts`; UI print path only; never fake PDF bytes |
| Portal paste | Partial (plain clipboard) | **Built** structured CSV/JSON portal export |
| Google Docs | Link-only (`google_docs_url`) | **Built** provider + create/sync when token available; clear blocker otherwise |
| Pricing | Link-only workbook tab | Unchanged (honest link to Pricing) |

## What shipped

1. **Deterministic assembly** — `apps/web/lib/opportunity/proposal-assembly.ts`  
   APPROVED requirement responses (+ optional cover, attachments, pricing refs). Stable org-template order. Draft-only excluded. HTML/DOCX escaping helpers.

2. **Org template** — `apps/web/lib/opportunity/org-proposal-template.ts`  
   Defaults + override shape (not hard-coded buyer layout).

3. **Google Docs provider** — `apps/web/lib/google/docs-provider.ts` + `google-docs.ts`  
   `createOrUpdateWorkingDoc({ title, content, idempotencyKey, existingDocId? })`. Server-only. Env: `GOOGLE_DRIVE_ACCESS_TOKEN` and/or `GOOGLE_DOCS_ACCESS_TOKEN`. Stub when absent. Idempotent per content hash unless `forceNew`.

4. **DOCX** — `apps/web/lib/export/docx.ts` via `docx` package (real OOXML).

5. **PDF** — `apps/web/lib/export/pdf.ts` documents limitation; print path honest.

6. **Portal answers** — `apps/web/lib/export/portal-answers.ts` (CSV + JSON).

7. **Versioning** — migration `20260821260000_f8_submission_artifacts.sql`  
   `submission_artifacts` with version, content_hash, sources, google_doc_*, portal_json, immutable. Trigger refuses mutate when submitted/immutable. RLS org-scoped.

8. **Submission UI** — generate working proposal, sync Google Doc (or blocker), download DOCX / portal / HTML, mark submitted freezes latest artifact.

## Google live vs stub

| Mode | When |
| --- | --- |
| **Stub / blocker** | Token unset — UI shows sync blocked; provider returns `NOT_CONFIGURED` |
| **Live** | `GOOGLE_DRIVE_ACCESS_TOKEN` or `GOOGLE_DOCS_ACCESS_TOKEN` set — Drive create + Docs batchUpdate |

## Reference-only notes

- **RFPilot** — proposal section / export inspiration only; no AI auto-prose into submitted packets. See [rfpilot.md](../reference-repos/rfpilot.md).
- **Wraft** — document-generation pipeline patterns; we did not adopt their stack. Native DOCX via `docx` instead.
- **Documenso** — e-sign / PDF workflow reference only; not wired. PDF remains print-path until a real converter is approved.

## Drive staging (helper)

Folders (import/source only — vault remains Supabase Storage):

- Test Documents: https://drive.google.com/drive/folders/16OAYM97haJkn2zyBnKnh7L8RouSqtGfc
- Platform: https://drive.google.com/drive/folders/1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF

`scripts/upload-pilot-acquired-to-drive.py` — `GOOGLE_DRIVE_FOLDER=platform|test_documents`, `--both`, or `GOOGLE_DRIVE_FOLDER_ID`. See `docs/pilot/drive-staging/README.md`.

**F8 session Drive attempt:** public folders viewable; IronBee browser unsigned-in; no `GOOGLE_DRIVE_ACCESS_TOKEN` → **could not upload** the 33 local `docs/pilot/acquired` PDFs. Confirmed already on Test Documents: MHMR 25-003 tabulation + Pilot Corpus Source Links Google Doc. Corpus remains local + staged for one-shot upload when token is set.

## Verify

```bash
npm run test:f8-proposal-output   # 24/24
npm run test:p8-submission-result # 44/44
npm run test:phase8-response      # 30/30
npm run lint && npm run typecheck && npm run build
```

Migration `20260821260000_f8_submission_artifacts` **applied** to live DB (2026-08-21).

## Blockers

- Live Google Docs needs a valid OAuth access token with Drive + Docs scopes. **Current env: token absent → stub/blocker.**
- No server PDF converter — operators use HTML → browser Print → Save as PDF.
- Corpus-thin: exports only as good as APPROVED responses on real pursuits.