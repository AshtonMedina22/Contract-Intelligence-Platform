# Tech stack

Companion to [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). Execute work from [BUILD_PLAN.md](BUILD_PLAN.md).

Locked at the platform/framework layer. Parser, OCR, and model IDs stay abstracted until the L&P document benchmark.

Prices below are a planning snapshot (August 2026). Recheck before bulk migration.

## Locked choices

| Layer | Choice | Rule |
| --- | --- | --- |
| Web app | Next.js App Router, React, TypeScript | Official `with-supabase` starter is the only cloned base |
| Host | Vercel, Fluid Compute, Node 24 | No Edge runtime. Repo declares `engines.node >= 24` plus `.nvmrc` / `.node-version`. `vercel.ts` is optional. Repo-root `vercel.json` deploys **only** the Next.js `web` service. Do not add `services/processor` as a Vercel Service until it has a real HTTP runtime (Phase 4+). Bulk jobs stay Cloud Run later |
| UI | Tailwind CSS, shadcn/ui, Lucide, dashboard sidebar | One design system. Dense, desktop-first, audit-oriented |
| Lists | TanStack Table + TanStack Query | Opportunities, documents, queues, contracts, intelligence |
| Spreadsheets | Glide Data Grid | Dep only in Phase 1. Glide 6 peers React 18; this repo uses React 19 + `legacy-peer-deps` until Glide supports 19. No pricing grid UI until Phase 12 |
| Forms | React Hook Form + Zod | Frontend validation mirrors processor schemas |
| Proposal editor | Tiptap OSS; Novel UX patterns | Phase 13. Novel is not a database |
| PDF viewer | PDF.js / react-pdf + source-page overlay | Required for verification |
| Database | Supabase-hosted PostgreSQL | Only structured system of record |
| Auth / tenancy | Supabase Auth + Postgres RLS + org roles | Do not add Clerk |
| Canonical file vault | Supabase Storage | Canonical **immutable-by-policy** ingested evidence vault. Not WORM by default — append-only via path layout, overwrite bans, RLS, and audit |
| Drive | Import/source integration + human workspace | Copy into Storage. Retain Drive file ID + checksum. Do not delete Drive files |
| Search | SQL filters + tsvector + pgvector | No Pinecone, Qdrant, or Azure AI Search |
| Live status | Supabase Realtime | Queue/processing badges only, not co-editing |
| Document lifecycle | Vercel Workflow | intake → parse → extract → validate → wait for human → promote |
| Fan-out / independent jobs | Vercel Queues behind a JobPort abstraction | Buffering, embeddings, notifications, dispatch. Not the lifecycle coordinator |
| Light compute | Vercel Functions (TS or Python) | Checksum, classify, short API calls |
| Heavy parse | Python FastAPI + Pydantic in `services/processor` | Local for the pilot |
| Bulk / long jobs | Google Cloud Run Jobs | Documented now; deploy only when the pilot proves it |
| DB lifecycle jobs | Supabase Cron / pg_cron | Contract, renewal, compliance expiration checks |
| App/external schedules | Vercel Cron | Nightly syncs, digests, research kickoff. Not canonical expiration logic |
| AI app layer | Vercel AI SDK | Structured output, streaming, tools, evidence UI |
| Model routing | Vercel AI Gateway (`provider/model` strings) | No hard-coded vendor in business logic |
| Excel | openpyxl primary XLSX adapter; pandas only for dataframe work | Do not OCR clean workbooks |
| Billing | Stripe later | Only when commercialized |

## Repo layout

```text
apps/web                 Next.js (npm workspaces)
services/processor       Python FastAPI (own pyproject.toml / venv)
packages/shared          Cross-cutting TS utilities
packages/schemas         Shared JSON Schema / OpenAPI contracts
supabase/migrations      SQL, RLS, Cron jobs
docs/
```

pnpm manages JavaScript when available; npm workspaces are an acceptable substitute if pnpm is not installed. Python manages itself.

## Orchestration

Vercel treats **Workflow** as the higher-level durable multi-step model and **Queues** as the lower-level event primitive. Workflow can suspend on a human-verification hook without burning compute. Queues redeliver whole messages and are better for fan-out.

Keep a `JobPort` so processor code is not hardcoded to Vercel APIs.

Do **not** add LangGraph or eve for ingestion.

## Parser / model policy

```text
DocumentParser
├── PdfParser
├── DocxParser
├── XlsxParser          openpyxl
├── DoclingParser
├── MistralOcrParser
├── GoogleDocumentAiParser
└── NativeMultimodalPdfParser

StructuredExtractor
├── AI Gateway interactive model
└── provider Batch API when cheaper
```

The first representative benchmark (20–30 complete packages, 30–50 documents) selects the production routing policy. Candidates may include Gemini 3.6 Flash, Gemini 3.5 Flash-Lite, current OpenAI/Anthropic frontier models, and Mistral OCR/models. None is “the engine” until measured.

## Cost notes that must stay visible

- Commercial floor is still roughly Vercel Pro + Supabase Pro before variable OCR/model/compute.
- **Workflow is not free.** Hobby currently includes 50,000 workflow events/month. Pro Workflow events are usage-based (currently about $20 per 1M events), plus workflow data written/retained. Pro is $20/month and includes **$20 of general infrastructure usage credit**, which can absorb some usage before additional charges. Recheck [Vercel Workflow pricing](https://vercel.com/docs/workflows/pricing) before bulk runs.
- Vercel documents that Workflow uses Queues internally. **Do not claim separately billed Queue API operations are automatically incurred by every Workflow action** unless Vercel billing docs confirm that. Functions invoked by Workflow still bill as compute.
- **Do not add `vercel.ts` in Phase 1.** Next.js on Vercel needs no explicit config by default. Add `vercel.ts` later only when we have project configuration that benefits from configuration-as-code.
- Supabase Storage is the vault because of RLS and tenancy plus **append-only policy**, not because the product is magically WORM. Pro currently includes 100 GB with cheap overage; recheck [Supabase pricing](https://supabase.com/pricing) before the historical corpus.
- Deduplicate by SHA-256 before OCR, extraction, or embeddings. Do not reprocess an unchanged version.
- Escalate to managed OCR / stronger models only on difficult or low-confidence pages.
- Use provider Batch APIs for non-urgent historical inference.
- Do not pay Document AI Form Parser/Custom Extractor rates across the whole corpus unless the benchmark justifies it.

## Do not add initially

Liveblocks storage, Handsontable, AG Grid Enterprise, Pinecone, Qdrant, Azure AI Search, a second relational database, Google Sheets as a database, Redux/Zustand, another UI kit, Chatbot UI, AssistLoop, WeatherGPT, v0 demos, eve.

## Cron split (verified)

**Keep Supabase Cron** for contract/renewal/compliance checks. Those jobs are SQL over verified dates. Supabase Cron runs SQL/database functions in Postgres, records runs in `cron.job_run_details`, and avoids an extra network hop. Jobs should stay under the documented ~10 minute / modest concurrency guidance.

**Do not use Vercel Cron as the canonical expiration scheduler.** Vercel’s docs state failed cron invocations are **not retried**, delivery is best-effort, and runs can be missed or duplicated. Vercel Cron remains available later for application-level jobs (external sync, email digest, research kickoff), which must be idempotent.
