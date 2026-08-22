# Tech stack — locked platform architecture

This file owns **technology choices only**. Business/UX: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md), [UX_UI.md](UX_UI.md). Current maturity: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).

Canonical IA is **not** defined here. Navigation = Home | Pursuits | Intelligence | Contracts | Data Ops.

Synced from the approved Canonical Product Pack (Prompt 0A).

## Web / application

- Next.js App Router  
- React  
- TypeScript  
- Vercel hosting  
- Node runtime appropriate to current Vercel-supported production baseline  
- desktop-first information-dense application UX  

## UI / client

- Tailwind CSS  
- shadcn/ui  
- Lucide icons  
- TanStack Table for record collections and requirement matrices  
- TanStack Query for client/server query state where useful  
- React Hook Form + Zod for forms/validation  
- Glide Data Grid for serious spreadsheet-style pricing only  
- Tiptap OSS with proven Novel-style UX patterns for Response editing  
- PDF.js / react-pdf for evidence/source review  

## Database / auth / tenancy

- Supabase-hosted PostgreSQL = **only** canonical relational database  
- Supabase Auth  
- PostgreSQL Row Level Security  
- organizations + memberships + tenant-owned `organization_id`  
- same-organization relationship integrity  
- no Clerk or second auth system unless a future migration is explicitly approved  

## Canonical file evidence

- Supabase Storage = canonical immutable-by-policy ingested evidence vault  
- evidence handled as append-only by design/policy  
- checksum/versioned object paths  
- original evidence never casually overwritten  

## Google Workspace

**Google Drive:** import/source integration; retain source IDs/metadata; familiar human workspace; **never** the authoritative structured database.

**Google Docs:** working proposal collaboration/handoff; final human editing where appropriate; output/export path; **not** canonical structured data.

**Google Sheets:** controlled import/export/QA only; **never** a bidirectionally editable second database competing with Supabase.

## Search / retrieval

- structured SQL  
- PostgreSQL full-text search / tsvector  
- pgvector  
- hybrid retrieval using structured + lexical + semantic evidence  
- no Pinecone/Qdrant/Azure AI Search unless measured future scale proves Postgres insufficient  

## Document orchestration

**Primary lifecycle:** Vercel Workflow  

Canonical lifecycle: intake → parse → extract → validate/reconcile → wait for human verification → resume → promote canonical.

**Independent fan-out:** Vercel Queues behind JobPort abstraction only where useful (embeddings, notifications, dispatch/buffering).

Do **not** use Queues as the business lifecycle coordinator.

## Scheduled automation

**Supabase Cron / pg_cron:** canonical contract/renewal/compliance date checks; SQL over verified canonical dates; 180/120/90/60/30/expired logic.

**Vercel Cron:** optional application-level schedules (external syncs, digests, research/report refresh kickoff); idempotent jobs only; **not** the canonical expiration engine.

## Processor

- Python  
- FastAPI  
- Pydantic  
- local/service execution during pilot  
- Cloud Run Jobs later only when real pilot/bulk workloads justify it  

## Parser adapter model

`DocumentParser` abstraction, with routing chosen from pilot benchmark results.

Potential adapters: digital PDF/native parser; Docling where useful; OCR adapter for scans; provider document extraction APIs where justified; DOCX parser; XLSX parser.

Do not hard-code one OCR/model vendor as the product architecture.

## XLSX

- openpyxl primary  
- preserve workbook, sheet, cell, formula/format/merged/hidden context where useful  
- pandas only for dataframe analysis  
- never OCR a normal clean workbook  

## AI application layer

- Vercel AI SDK  
- Vercel AI Gateway / provider abstraction  
- structured outputs  
- streaming where UX benefits  
- controlled tool access  
- evidence display  
- provider/model IDs not hard-coded into business logic  
- batch APIs may be used for non-urgent historical processing when cheaper  

## AI tooling concepts

Controlled internal tools may include: `structured_query`, `locate_record`, `search_documents`, `semantic_search`, `retrieve_evidence`, `pricing_analysis`, `public_research`, `generate_report`.

AI never receives unrestricted authority to mutate canonical truth.

## Repo shape

```text
apps/web
services/processor
packages/shared
packages/schemas
supabase/migrations
docs
```

## Package management

Use the repository’s current supported workspace approach consistently. Do not churn package managers merely for preference.

## Commercialization / extensions — out of current product scope

Do **not** add Stripe, plans/seats/usage billing, commercial SaaS onboarding, or buyer/customer portals unless a future task explicitly instructs ([PRODUCT_SCOPE_GUARDRAIL.md](PRODUCT_SCOPE_GUARDRAIL.md)).

Optional later interoperability (MCP) or advanced agents only when a proven L&P workflow requires them — still not commercialization.

These do **not** define the Phase 1–8 core build.

## Do not add initially without evidence

- second relational DB  
- second vector DB  
- Google Sheets as a database  
- generic chatbot template as the product shell  
- another UI kit  
- enterprise data grid when Glide/TanStack already satisfy the use case  
- LangGraph/equivalent merely because “agents” are trendy  
- heavy Cloud Run deployment before pilot proves the need  

## Technical non-negotiables

- one canonical database  
- tenant isolation  
- evidence traceability  
- AI/provider abstraction  
- human verification gate  
- human final-price decision  
- source-aware proposal drafting  
- no secret/API key in browser  
- no unsafe destructive SQL/tooling through Ask GPT  
- no architectural choice should undermine the proposal-centered procurement workflow  
