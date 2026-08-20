# Build plan

Operational checklist for the Contract Intelligence Platform.  
**Authoritative blueprint:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). **Phase naming:** [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md). **Phase 1 audit:** [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md).  
Product rules: [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). Stack: [TECH_STACK.md](TECH_STACK.md). Current state: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).

## Original blueprint phase map (product truth)

| Original | Name | Repo status |
| --- | --- | --- |
| 1 | Foundation | Mostly complete — [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md) |
| 2 | **Historical pilot** | **NOT STARTED** — [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md) |
| 3 | Historical ingestion | NOT STARTED |
| 4 | Contract/compliance | Early code; unvalidated |
| 5 | Analytics dashboards | Early UX; FREEZE |
| 6 | Search/AI | Early UX; FREEZE |
| 7 | Pricing intelligence | Not started (Glide). Early cost model UI exists — unvalidated |
| 8 | Proposal builder | Not started (Tiptap/sections). Early pursuit workspace exists — unvalidated |

**RLS 48/48 = Original Phase 1, NOT Phase 2.** See [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md).

## Current product position (canonical)

**Canonical Phase 1 — Foundation:** mostly implemented. Local lint/typecheck/build pass. **Vercel production build green** after login Partial Prerender fix. See [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).

**Canonical Phase 2 — Historical Pilot:** **NOT STARTED.** Pilot kickoff: [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md).

**Next product work:** apply opportunity SQL on Supabase + confirm Vercel env; then run 20–30 complete L&P packages through intake → parse → stage → verify. Do **not** expand Intelligence UX (Ask/Market/Reports). An early **opportunity workspace** (tabs, planning cost model, Pass 3 staffing/eval/comparables/rebid) exists as ops UI — it is **unvalidated** until the pilot. Session log: [WORK_TRAIL.md](WORK_TRAIL.md).

Later **legacy engineering** work (schema phases 7–11, Intelligence shell) exists in the repo but is **early / unvalidated**. Passing a `PHASE*_ACCEPTANCE.md` script does **not** mean the corresponding canonical product phase is complete.

Do not skip phases to get a pretty proposal editor. Verification of historical documents is the first usable product.

---

## Canonical product phases vs legacy engineering IDs

Use **canonical product phases** for product maturity. Keep **legacy engineering IDs** on migrations, scripts, and `PHASE*_ACCEPTANCE.md` filenames — do not rename them.

| Canonical product phase | Meaning | Legacy engineering IDs | Honest status |
| --- | --- | --- | --- |
| **1 — Foundation** | App shell, Auth/RLS, document registry/versions, staging/verification structure, Storage, Workflow skeleton, processor interfaces, verification workbench | 0–5 | Mostly built; build green locally — verify Vercel |
| **2 — Historical Pilot** | 20–30 complete L&P packages; routing lock from real evidence | 6 | **Not started** (0 packages) |
| **3 — Historical ingestion / processing** | Production ingest loop validated on real files | 3–5 + 7 promotion | Code exists; unproven on L&P corpus |
| **4 — Broader historical migration** | Controlled corpus batches | 8 | UI/RPC exists; no corpus |
| **5 — Contracts / compliance / renewals** | Operational contract portfolio from verified data | 9 | Schema/UI early; unvalidated |
| **6 — Market / buyer / competitor intelligence** | Evidence-backed win/loss, competitor, research | 10 | Thin UX + tables; not operational intelligence |
| **7 — Search / RAG / Ask Intelligence** | LOCATE vs ASK; purpose-aware retrieval | 11 | FTS RPC + Ask surface; partial |
| **8 — Pricing intelligence** | Glide workbench; human final price | 12 | Four-truth + planning cost model + comparables panel; **not Glide** |
| **9 — Proposal builder** | Grounded drafting; Google Docs collab; procurement outputs | 13 | Pursuit workspace tabs + brief template; **not section drafting** |
| **Later — Commercial PaaS** | Stripe, tenant admin | 14 | Future |

**Legacy engineering Phase 2 (tenancy/RLS) is Foundation work, not the Historical Pilot.** The 48/48 `test:phase2-rls` result proves tenant isolation only.

---

## How to use this file

1. Use **canonical product phases** above to decide what the product has actually proven.
2. Legacy sections below (Phase 0–14) are the **engineering checklist** — keep them for tasks and acceptance scripts.
3. Do not implement anything listed under **out of scope** for that legacy phase.
4. After meaningful progress, update README and [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).

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

> **Legacy engineering Phase 2 → Canonical product Phase 1 (Foundation).** RLS/tenancy is not the Historical Pilot. Passing [PHASE2_ACCEPTANCE.md](PHASE2_ACCEPTANCE.md) (48/48) does not mean product Phase 2 is complete.

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
- [x] **Applied** `supabase/migrations/20260819100000_phase2_tenancy_provenance.sql` on project `lhmurblikkcomdxcrymx` (`supabase db push` via session pooler)
- [x] Atomic `create_organization_with_admin(org_name)` RPC (single transaction; Settings uses this RPC)
- [x] Same-organization composite foreign keys on Phase 2 relationships
- [x] Repeatable two-user RLS/storage/integrity test: `npm run test:phase2-rls`
- [x] Acceptance evidence: [PHASE2_ACCEPTANCE.md](PHASE2_ACCEPTANCE.md) (48/48 on 2026-08-19). **Still rotate** chat-exposed privileged credentials before treating this project as the long-term baseline.

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

### Status

Implemented in app. Prove with [PHASE3_ACCEPTANCE.md](PHASE3_ACCEPTANCE.md) (`npm run test:phase3-intake` plus a real PDF/XLSX upload). Do not start Phase 4 until that is green.

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

### Status

Implemented. Prove with [PHASE4_ACCEPTANCE.md](PHASE4_ACCEPTANCE.md) (`pytest` in `services/processor`). Do not start Phase 5 until staging facts exist from a real XLSX.

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

### Status

Implemented. Prove with [PHASE5_ACCEPTANCE.md](PHASE5_ACCEPTANCE.md). Do not start Phase 6 until a real L&P package has been reviewed in the workbench.

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

> **Legacy engineering Phase 6 → Canonical product Phase 2 (Historical Pilot).** This is the first incomplete **product** phase that blocks trust in everything after it.

### Status

**Fixture baseline only** — checked-in routing policy and harness exist. See [PHASE6_ACCEPTANCE.md](PHASE6_ACCEPTANCE.md). **Real L&P package scores: 0.** Canonical Phase 2 is **NOT STARTED.** Do not treat legacy phases 7–11 as product-complete until 20–30 complete packages are ingested and verified here.

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

> **Legacy engineering Phase 7 → Canonical product Phase 3 (partial).** Acceptance scripts pass; **not validated** without a real L&P pilot corpus.

### Status

Engineering implemented ([PHASE7_ACCEPTANCE.md](PHASE7_ACCEPTANCE.md)). Product maturity: **unvalidated** until Historical Pilot completes. Do not add contract Cron or the rest of MASTER’s table list beyond what the pilot proves.

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

> **Legacy engineering Phase 8 → Canonical product Phase 4 (partial).** RPC/UI exist; no corpus to migrate.

### Status

Engineering implemented ([PHASE8_ACCEPTANCE.md](PHASE8_ACCEPTANCE.md)). **No L&P corpus migrated.** Cloud Run remains off per Phase 6 fixture evidence.

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

> **Legacy engineering Phase 9 → Canonical product Phase 5 (partial).** Schema/UI early; not validated on verified L&P contracts.

### Status

Engineering implemented ([PHASE9_ACCEPTANCE.md](PHASE9_ACCEPTANCE.md)). Product maturity: **unvalidated** without verified contract corpus.

### Goal

Operational contract portfolio from verified data.

### Tasks

- Contract / amendment / option / renewal / compliance tables and UIs (TanStack)
- **Supabase Cron** SQL: 180/120/90/60/30/EXPIRED on **verified** dates; write alert/task rows
- In-app renewals center
- Do not use Vercel Cron for this SQL. Optional later: Vercel Cron to send email (Resend) by reading alert rows (idempotent)

### Acceptance — you can use it when

- A contract expiring in **32 days** shows in the **60-day** bucket; **20 days** in the **30-day** bucket — per [PHASE9_ACCEPTANCE.md](PHASE9_ACCEPTANCE.md) and `scripts/phase9-contracts-acceptance.mjs` (not the 30-day bucket for 32 days).

---

## Phase 10 — Win/loss and intelligence

> **Legacy engineering Phase 10 → Canonical product Phase 6 (partial).** Tables + thin UX exist; **KEEP + FREEZE** until verified corpus. Not operational market intelligence.

### Status

Engineering implemented ([PHASE10_ACCEPTANCE.md](PHASE10_ACCEPTANCE.md)). Market counts are document/entity tallies, not canonical verified market facts.

### Goal

Evidence-backed win/loss, client, and competitor records.

### Tasks

- Win/loss fields: documented reason ≠ internal analysis
- Competitor bids only with sources
- Research facts with URL/date/verification (AI Research Agent **pattern**, no paid browser unless justified)
- Dashboard KPIs only from real queries

### Out of scope

Generic chatbot. Invented competitor prices.

### Acceptance — you can use it when

Prove with [PHASE10_ACCEPTANCE.md](PHASE10_ACCEPTANCE.md). Documented reason stays distinct from internal analysis. Unsourced competitor bids are rejected.

---

## Phase 11 — Hybrid RAG

> **Legacy engineering Phase 11 → Canonical product Phase 7 (partial).** FTS RPC + Ask/Content UI exist; **KEEP + FREEZE.** Not purpose-aware; header search is Ask-only (no LOCATE).

### Status

Engineering implemented ([PHASE11_ACCEPTANCE.md](PHASE11_ACCEPTANCE.md)). UI uses FTS only (no query embeddings). Missing: LOCATE vs ASK, retrieval purpose (`LOSS_ANALYSIS` vs `PROPOSAL_DRAFTING`), grounded report synthesis.

### Goal

Search verified knowledge: SQL + FTS + pgvector.

### Tasks

- Chunks from **verified / approved** content only
- Embeddings via AI Gateway; do not add Pinecone/Qdrant
- Filters: org, verification, reuse status, current version
- `DO_NOT_USE` / `SUPERSEDED` excluded from drafting retrieval

### Acceptance — you can use it when

- A query returns citations to Storage originals and verified facts, never unverified staging as truth.

Prove with [PHASE11_ACCEPTANCE.md](PHASE11_ACCEPTANCE.md).

---

## Phase 12 — Pricing intelligence

> **Legacy engineering Phase 12 → Canonical product Phase 8.** Glide grid **not started**. Four-truth table + planning cost model + comparables **panel** exist early (unvalidated). Do not treat that as Phase 8 complete. Do not expand until Historical Pilot.

### Goal

Spreadsheet-like pricing with evidence; human final price.

### Tasks

- Glide Data Grid workbench on Postgres data
- Include/exclude comparables with reasons
- Wage/cost floor inputs
- Never auto-fill final bid price

---

## Phase 13 — Proposal builder

> **Legacy engineering Phase 13 → Canonical product Phase 9.** **Not started** (placeholder). Includes in-app drafting → Google Docs working proposal → final procurement output (PDF/DOCX/portal/workbook).

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
