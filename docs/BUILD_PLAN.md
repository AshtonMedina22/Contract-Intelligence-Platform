# Build plan

Operational checklist for the Contract Intelligence Platform.  
Product rules: [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). Stack: [TECH_STACK.md](TECH_STACK.md).

**Current phase: Phase 2 schema.** Real Supabase project is `lhmurblikkcomdxcrymx`. Apply `supabase/migrations/20260819100000_phase2_tenancy_provenance.sql` on that project (CLI login required for `supabase db push`, or run the SQL in the dashboard).

Do not skip phases to get a pretty proposal editor. Verification of historical documents is the first usable product.

---

## How to use this file

1. Finish the current phase’s **acceptance** list before starting the next.
2. Do not implement anything listed under **out of scope** for that phase.
3. If a task is not on the list, it is not this phase.
4. After each phase, update the README “Current phase” line.

---

## Phase 0 — Canonical docs in git (this phase)

### Goal

Anyone who clones [https://github.com/AshtonMedina22/Contract-Intelligence-Platform](https://github.com/AshtonMedina22/Contract-Intelligence-Platform) can read the full product, locked architecture, and build order without needing files from Downloads.

### Prerequisites

GitHub repo cloned. No application runtime required.

### Tasks

- [x] `docs/MASTER_PRODUCT_CONTEXT.md` — full merged spec + locked architecture
- [x] `docs/BUILD_PLAN.md` — this file
- [x] `docs/PRODUCT_SPEC.md`, `TECH_STACK.md`, `DATA_ARCHITECTURE.md`, `DOCUMENT_TAXONOMY.md`, `SOURCE_PRECEDENCE.md`, `IMPLEMENTATION_ROADMAP.md` — consistent with the lock
- [x] `README.md` — pointers to master spec and this plan
- [x] Push to GitHub so any clone has the spec

### Acceptance — you can use it when

- The master spec is in the repo, not only in Downloads.
- Locked rules (Workflow, Storage-by-policy, Cron split, Excel/PDF, repo layout) are written once in TECH_STACK / DATA_ARCHITECTURE and repeated at the top of MASTER.

### Out of scope

Scaffolding `apps/web`, processors, Workflow, Queues, parsers, PDF.js, intake UI.

---

## Phase 1 — Framework foundation

### Goal

A Next.js App Router app that builds, with the empty repo shape for web + Python + schemas + migrations. Login from the Supabase starter may exist. No procurement features.

### Prerequisites

Phase 0 docs accepted. Node 24+ (Vercel default for new projects). Git remote already this repo.

### Tasks

- [x] Create `apps/web` from official Next.js `with-supabase` (in this git repo, not temp)
- [x] Empty `services/processor`, `packages/shared`, `packages/schemas`, `supabase/migrations`
- [x] npm workspaces (`apps/*`, `packages/*`); no `vercel.ts`
- [x] TanStack Table/Query, RHF, Zod, Glide dep, `ai`
- [x] shadcn application shell with placeholder nav
- [x] QueryClientProvider
- [x] `.vscode/extensions.json` recommendations
- [x] Confirm `npm run typecheck`, `lint`, and `build` on this machine

**Web packages (in `apps/web` only)**

- Keep starter: Next.js, React, TypeScript, Tailwind, existing shadcn pieces, `@supabase/ssr`, `lucide-react`
- Add: `@tanstack/react-table`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@glideapps/glide-data-grid` (dependency only — no pricing grid page), `ai` (no chat page)
- shadcn: sidebar/button/table/badge/tabs/sheet/form/dialog as needed for an **application shell** with placeholder nav labels (Overview, Ingestion, Procurement, Contracts, Intelligence, Proposals, System) that go to empty pages or “not built”
- QueryClientProvider in the app layout
- `npm run lint` / `typecheck` / `build` (add a `typecheck` script: `tsc --noEmit` if missing)

**Env**

- Keep `.env.example` from the starter (`NEXT_PUBLIC_SUPABASE_URL`, publishable key). Do not invent a mock database. Real Supabase can wait until Phase 2 if the app still typechecks.

### Acceptance — you can use it when

- `apps/web` production build succeeds.
- Folder layout matches TECH_STACK.
- No Workflow, Queues, intake, storage vault code, business tables, PDF.js, Docling, or Tiptap.

### Out of scope

Everything listed in the user “DO NOT implement yet” list: Workflow, Queues, document intake, Storage evidence logic, business schema, Python parser runtime, Docling, PDF.js, openpyxl, AI extraction, pgvector, Tiptap, Cloud Run, Cron, pricing, proposals.

---

## Phase 2 — Database, tenancy, provenance schema

### Goal

Postgres can store organizations, users, documents metadata, staging facts, and verification events with RLS. No files processed yet.

### Prerequisites

Phase 1 build green. A real Supabase project. `supabase/` CLI linked or dashboard SQL.

### Tasks

**Migrations in `supabase/migrations/`**

- [x] `organizations`, `memberships` (`role`: admin | importer | verifier | bidder | executive)
- [x] `document_batches`, `documents`, `document_versions`
- [x] `extraction_runs`, `extracted_facts`, `source_evidence`, `verification_events`, `validation_exceptions`
- [x] `clients`, `opportunities`
- [x] `organization_id` on every business table; RLS policies; indexes on org, status, checksum
- [x] Storage buckets `intake` and `evidence` **policies only** (path convention documented; upload UI is Phase 3):
  `org_id/document_id/version_id/sha256/original.ext`
- [x] Deny UPDATE/DELETE on evidence objects for `authenticated` (no update/delete policies)
- [x] TypeScript types in `apps/web/lib/supabase/database.types.ts` (regenerate with CLI after `db push`)
- [ ] **You:** apply `supabase/migrations/20260819100000_phase2_tenancy_provenance.sql` on project `lhmurblikkcomdxcrymx` (SQL Editor, or `npx supabase login` then `npx supabase link --project-ref lhmurblikkcomdxcrymx` and `npx supabase db push`)
- [ ] **You:** prove org A cannot read org B (two signed-in users)

**App**

- [x] Auth: org membership required after login (minimal settings: org name) — `/system/settings`
- [x] No document upload yet
- [x] `.env.local` on this machine (gitignored). Do not commit secrets.

### Acceptance — you can use it when

- A signed-in user in org A cannot read org B rows (prove with two test users).
- Tables exist; `extracted_facts` can be inserted only as staging (no “auto verified” default).

### Out of scope

Upload pipeline, parsers, Workflow, Cron jobs, domain tables for contracts/pricing.

---

## Phase 3 — Document intake + Workflow start

### Goal

A user can upload or import files, get a registry row, checksum, duplicate detection, and a Workflow run that **stops before parse if you have not finished Phase 4** — or starts parse once Phase 4 exists. Prefer: intake writes Storage + registry + status `UPLOADED`/`QUEUED`, then starts Workflow with a stub parse step until Phase 4.

### Prerequisites

Phase 2 RLS. JobPort interface in `packages/shared` (methods: `startDocumentLifecycle`, later `fanOut`). Vercel Workflow implementation behind that interface.

### Tasks

**Storage**

- Upload to evidence path; never overwrite; checksum (SHA-256) **before** processing
- Drive import adapter: copy bytes into Storage; save `source_drive_file_id`; do not delete Drive
- Duplicate: same checksum → link as same version, do not reprocess

**UI**

- `apps/web/app/(app)/ingestion/intake/page.tsx` — batch, drag-drop, optional client/opportunity
- Processing queue table (TanStack): status, batch, filename, retry later

**Workflow**

- One run per document (or per batch item): steps stubbed: checksum (done in app) → parse (Phase 4) → extract → validate → `waitForHook` human → promote
- Do not use Queues as the lifecycle. Optional: no Queues at all in this phase.

**Statuses**

`UPLOADED`, `QUEUED`, `PARSING`, `EXTRACTING`, `VALIDATING`, `NEEDS_REVIEW`, `VERIFIED`, `FAILED`  
AI completion ≠ `VERIFIED`

### Acceptance — you can use it when

- Upload a PDF and an XLSX; both appear in the registry with checksum and Storage path.
- Re-upload of identical bytes does not create a second original object.
- Org B cannot see org A files.

### Out of scope

Real Docling/OCR, verification workbench, promotion to contracts, PDF.js (can wait for Phase 5 if intake only lists files).

---

## Phase 4 — Processor + parser/extractor interfaces

### Goal

`services/processor` can parse a document into a normalized representation and write **staging** facts. Routing is abstracted. Default XLSX path is openpyxl, not OCR.

### Prerequisites

Phase 3 registry. JSON Schema in `packages/schemas` for normalized document + extracted fact; Pydantic + Zod generated or hand-kept in sync.

### Tasks

- FastAPI app: `POST /jobs/parse`, `POST /jobs/extract`, health
- `DocumentParser` adapters: `XlsxParser` (openpyxl; sheets, merged cells, number formats, formula text + cached value), `PdfParser`/`DoclingParser` stubs, `MistralOcrParser` stub, `GoogleDocumentAiParser` stub, `NativeMultimodalPdfParser` stub
- `StructuredExtractor` via AI SDK / Gateway **only if** calling a model; still write staging with `AI_EXTRACTED`
- Idempotent writes keyed by `(document_version_id, extraction_run_id)`
- Local run for the pilot (no Cloud Run)

### Acceptance — you can use it when

- An XLSX pricing workbook yields sheet/cell structure without OCR.
- A digital PDF yields text+pages via Docling or native parse (whichever adapter is wired).
- Facts land in `extracted_facts` with page/sheet coordinates and `AI_EXTRACTED`.
- No canonical `contracts` / `pricing_lines` writes.

### Out of scope

Locking Mistral vs Gemini vs Document AI. Cloud Run. Human UI.

---

## Phase 5 — Human verification workbench

### Goal

Operators can verify/edit/reject facts against the source page. Workflow resumes and promotion writes only verified facts to the small canonical set (client/opportunity fields that Phase 2 allows — not full contract schema yet).

### Prerequisites

Phase 4 staging data. PDF.js (`pdfjs-dist` / `react-pdf`) in web.

### Tasks

- Split view: source (PDF page + highlight from `source_evidence`; XLSX: sheet grid or HTML table from normalized cells) ↔ fact list
- Forefront-style filters: status, confidence, document, field
- Actions: VERIFY, EDIT, REJECT, FLAG CONFLICT, VERIFY GROUP; keyboard where practical
- Every action → `verification_events`
- Promote verified identity fields to `clients` / `opportunities` only as designed
- Resume Workflow hook on “verification complete for this document” (or per-fact; document-level is simpler)

### Acceptance — you can use it when

- A reviewer can open page 17, see the highlighted cell, accept `$38.25/hr`, and the fact becomes `HUMAN_VERIFIED` with actor and timestamp.
- Unverified facts cannot appear as canonical rates.

### Out of scope

Proposal editor, pricing intelligence workbench, public research agents.

---

## Phase 6 — Pilot benchmark (locks routing)

### Goal

Evidence-based parser/model routing for L&P documents.

### Prerequisites

~20–30 complete packages and 30–50 documents: wins, losses, RFP/RFQ/IFB, proposals, workbooks, scorecards, contracts, amendments, renewals, clean PDFs, scans, nested tables, forms, DOCX, XLSX.

### Tasks

- `services/processor/evals/` harness: table-cell accuracy, requirement recall, dates/entities, provenance, forms, scan quality, time, API cost, compute cost
- Spreadsheet or `docs/benchmarks/` results table (checked in)
- Written routing policy: clean PDF → X; scan → Y; XLSX → openpyxl always; escalate on low confidence

### Acceptance — you can use it when

- Production routing is a checked-in document, not a vendor slogan.
- Pilot packages are verified in the workbench.

### Out of scope

Full corpus migration. Cloud Run unless the pilot **proved** local/Vercel limits.

---

## Phase 7 — Expand canonical schema

### Goal

Only tables the pilot proved necessary: solicitations, requirements, four-truth rate fields, awards, etc.

### Tasks

- Migrations for proven entities
- Promotion mappings: which verified facts write which columns
- Source precedence enforced in promotion ([SOURCE_PRECEDENCE.md](SOURCE_PRECEDENCE.md))

### Acceptance — you can use it when

- One complete package shows requested ≠ proposed ≠ awarded ≠ current without overwrite.

### Out of scope

Blindly creating every table in MASTER’s long-term list.

---

## Phase 8 — Bulk historical migration

### Goal

Controlled batches of the larger corpus.

### Tasks

- Checksum/dedupe first
- Cloud Run Jobs **only if** Phase 6 showed the need
- Managed OCR only on routes from the benchmark
- Batch model APIs for non-urgent extraction
- Verification queues stay the bottleneck on purpose

### Acceptance — you can use it when

- Batches complete with failure isolation; duplicates skipped; costs logged per batch.

---

## Phase 9 — Contracts, renewals, compliance

### Goal

Operational contract portfolio from verified data.

### Tasks

- Contract / amendment / option / renewal / compliance tables and UIs (TanStack)
- **Supabase Cron** SQL: 180/120/90/60/30/EXPIRED on **verified** dates; write alert/task rows
- In-app renewals center
- Do not use Vercel Cron for this SQL. Optional later: Vercel Cron to send email (Resend) by reading alert rows (idempotent)

### Acceptance — you can use it when

- A contract expiring in 32 days shows in the 30-day bucket from verified dates, with source.

---

## Phase 10 — Win/loss and intelligence

### Goal

Evidence-backed win/loss, client, and competitor records.

### Tasks

- Win/loss fields: documented reason ≠ internal analysis
- Competitor bids only with sources
- Research facts with URL/date/verification (AI Research Agent **pattern**, no paid browser unless justified)
- Dashboard KPIs only from real queries

### Out of scope

Generic chatbot. Invented competitor prices.

---

## Phase 11 — Hybrid RAG

### Goal

Search verified knowledge: SQL + FTS + pgvector.

### Tasks

- Chunks from **verified / approved** content only
- Embeddings via AI Gateway; do not add Pinecone/Qdrant
- Filters: org, verification, reuse status, current version
- `DO_NOT_USE` / `SUPERSEDED` excluded from drafting retrieval

### Acceptance — you can use it when

- A query returns citations to Storage originals and verified facts, never unverified staging as truth.

---

## Phase 12 — Pricing intelligence

### Goal

Spreadsheet-like pricing with evidence; human final price.

### Tasks

- Glide Data Grid workbench on Postgres data
- Include/exclude comparables with reasons
- Wage/cost floor inputs
- Never auto-fill final bid price

---

## Phase 13 — Proposal builder

### Goal

Requirement-by-requirement grounded drafts.

### Tasks

- Tiptap + Novel-style UX (not Novel as a database)
- Evidence panel; `L&P INPUT REQUIRED` when missing
- Retrieval honors reuse statuses

---

## Phase 14 — Commercial multi-tenant

Stripe, tenant admin, usage. Optional realtime co-edit only if required. Odoo integration only if explicitly chosen — this product is not built inside Odoo.

---

## Template policy (all phases)

| Template | Action |
| --- | --- |
| Next.js Supabase starter | Only cloned base (Phase 1) |
| Forefront, Doc Search, Morphic, Novel, Python queue subscribers | Study later; copy patterns, do not merge apps |
| SaaS Microservices | Idea only (web vs processor). Ignore Nitro/Hono/microfrontends |
| WeatherGPT, Chatbot UI, AssistLoop, v0 demo, eve | Never |

---

## Explicit never-list (product-wide)

- AI-extracted values as canonical without verification
- OCR as the default path for XLSX
- Overwriting evidence objects
- Deleting Drive files as part of ingest
- LangGraph or eve for ingestion
- Liveblocks/Handsontable/AG Grid Enterprise/Pinecone/Qdrant as the data store
- `vercel.ts` “because Vercel supports it”
- Reordering phases for demo screens
