# Phase 3 acceptance

Document intake and evidence registry. **No OCR. No parser. AI completion is not VERIFIED.**

## What landed

- Drag-drop intake at `/ingestion/intake` (PDF/XLSX/DOCX)
- SHA-256 before register; Storage path `org_id/document_id/version_id/sha256/original.ext` in the `evidence` bucket
- Duplicate checksum in the same org links the existing version and does not create a second original
- Drive import adapter copies bytes into Storage and stores `source_drive_file_id` when `GOOGLE_DRIVE_ACCESS_TOKEN` is set
- `JobPort.startDocumentLifecycle` in `@lp/shared` with a Vercel Workflow implementation (stub parse until Phase 4) and inline fallback
- Processing queue and documents registry tables (TanStack Table)

## Checks

```bash
npm run typecheck
npm run test:phase2-rls
npm run test:phase3-intake
```

Manual: sign in, create an org in Settings, upload a PDF and an XLSX. Both appear in Documents with checksum and storage path. Re-upload the same PDF: no second original. A second org must not see those files.

## Out of scope (still true)

Real Docling/OCR, verification workbench, promotion to contracts, PDF.js, Python processor.
