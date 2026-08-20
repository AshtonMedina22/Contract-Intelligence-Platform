# Agent handoff (pick up here)

**Repo:** https://github.com/AshtonMedina22/Contract-Intelligence-Platform  
**Branch:** `main` (as of `4505b12` plus later commits on this file)  
**Do not redesign the architecture. Do not re-run Phase 0–10. Do not start Phase 12 until Phase 11 is proven.**

Secrets are **not** in git. Read `docs/DEVICE_SETUP.md`. Ask the human for `apps/web/.env.local` values. Never commit `.env.local`.

Canonical product: `docs/MASTER_PRODUCT_CONTEXT.md`. Phases: `docs/BUILD_PLAN.md`. Stack: `docs/TECH_STACK.md`.

---

## What this product is

Proposal, Contract & Procurement Intelligence for **L&P Global Security** (later possible multi-tenant). Not a CRM, chatbot, or generic RFP tracker.

Historical paper/digital files → extract to **staging** → automated validation → **human verification** → **canonical Postgres**. AI never auto-promotes facts. Four commercial truths stay separate: requested / proposed / awarded / current.

---

## What Phase 2 is

**Phase 2 = tenancy + provenance in Postgres.** The product cannot exist without this.

It is **not** intake, OCR, Workflow, Docling, or a proposal editor.

**End state of Phase 2:**

1. Real Supabase project has tables for orgs, memberships, document registry/versions, extraction staging, verification events, clients/opportunities.
2. Every business row is org-scoped. RLS: org A cannot read org B.
3. `extracted_facts.verification_status` defaults to `AI_EXTRACTED`. `HUMAN_VERIFIED` requires `verified_by` + `verified_at` (CHECK constraint).
4. Storage buckets `intake` and `evidence` exist and are private. Evidence is insert+select only for `authenticated` (no update/delete policies). Path convention: `org_id/document_id/version_id/sha256/original.ext`. **No upload UI.**
5. A signed-in user can create an organization and become admin (`/system/settings`).

**Phase 2 is complete.** Isolation is proven (`npm run test:phase2-rls`, 48/48). Org bootstrap is `create_organization_with_admin`. Evidence storage is tenant-scoped and append-only by policy. Same-organization composite FKs are in place. See [PHASE2_ACCEPTANCE.md](PHASE2_ACCEPTANCE.md).

---

## Status by phase

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Canonical docs in git | **Done** |
| 1 | Next.js foundation in `apps/web` | **Done** |
| 2 | Postgres tenancy + provenance + RLS | **Complete.** 48/48 isolation tests. Rotate secrets before importing real L&P data |
| 3 | Intake + Workflow start | **Implemented.** [PHASE3_ACCEPTANCE.md](PHASE3_ACCEPTANCE.md) |
| 4 | Python processor + parsers | **Implemented.** [PHASE4_ACCEPTANCE.md](PHASE4_ACCEPTANCE.md) |
| 5 | Human verification workbench | **Implemented.** [PHASE5_ACCEPTANCE.md](PHASE5_ACCEPTANCE.md) |
| 6 | Pilot benchmark / routing lock | **Implemented (fixture baseline).** [PHASE6_ACCEPTANCE.md](PHASE6_ACCEPTANCE.md) |
| 7 | Expand canonical schema | **Implemented.** [PHASE7_ACCEPTANCE.md](PHASE7_ACCEPTANCE.md) |
| 8 | Bulk historical migration | **Implemented.** [PHASE8_ACCEPTANCE.md](PHASE8_ACCEPTANCE.md) |
| 9 | Contracts, renewals, Supabase Cron | **Implemented.** [PHASE9_ACCEPTANCE.md](PHASE9_ACCEPTANCE.md) |
| 10 | Win/loss and intelligence | **Implemented.** [PHASE10_ACCEPTANCE.md](PHASE10_ACCEPTANCE.md) |
| 11 | Hybrid RAG (SQL + FTS + pgvector later) | **Implemented.** [PHASE11_ACCEPTANCE.md](PHASE11_ACCEPTANCE.md) |
| 12 | Pricing intelligence (Glide UI) | Not started |
| 13 | Proposal builder (Tiptap) | Not started |
| 14 | Commercial multi-tenant / Stripe | Not started |

Phase 3–14 details and acceptance lists: `docs/BUILD_PLAN.md`.

---

## Locked architecture (do not change)

- **Web:** Next.js App Router, React 19, TypeScript, Tailwind, shadcn, Lucide. Host **Vercel**, Fluid Compute, **Node 24**. No Edge. npm workspaces (`package.json` workspaces). **Not pnpm** (this machine had no pnpm; do not convert).
- **Data:** Supabase Postgres + Auth + RLS. Client: `apps/web/lib/supabase/{server,client,proxy}.ts`. **Do not** add `utils/supabase` or a Connect-wizard `todos` page.
- **No Prisma. No Drizzle.** SQL migrations + supabase-js only.
- **Storage:** canonical evidence vault **by policy**, not magically WORM.
- **Google Drive:** import adapter copies into Storage; do not delete Drive files. Requires `GOOGLE_DRIVE_ACCESS_TOKEN`.
- **Orchestration:** Vercel **Workflow** = document lifecycle (Phase 3+). Queues = optional fan-out only. No LangGraph/eve for ingest. `JobPort.startDocumentLifecycle` is in `packages/shared`.
- **Cron:** Supabase Cron for contract/renewal SQL (Phase 9). Vercel Cron only later for app jobs.
- **Heavy compute:** Cloud Run Jobs documented, not deployed until Phase 8 if the pilot proves need.
- **Processor:** `services/processor` FastAPI. XLSX via openpyxl. Native PDF via pypdf. OCR/Docling stubs. Do not deploy on Vercel.
- **AI:** AI SDK + AI Gateway later. Do not lock Gemini/OpenAI.
- **Search:** Postgres FTS + pgvector in `document_chunks`. No Pinecone/Qdrant. Do not start Phase 12 (Glide) until `npm run test:phase11-hybrid-rag` passes.
- **UI:** TanStack Table for lists; PDF.js in the verification workbench; Glide dep only until Phase 12; Tiptap Phase 13.
- **`vercel.json`:** repo root, **web service only** (`apps/web`). Do **not** add `services/processor` as a Vercel Service. Do not create `vercel.ts` unless actually needed.
- Glide needed `legacy-peer-deps` (React 19 vs Glide’s React 18 peer). `.npmrc` has that.

---

## What landed in git (facts)

Commits of note:

- `e9f973d` — Phase 0 docs
- `00cf2d8` — Phase 1 `apps/web` from official `with-supabase`
- `5b3a3d5` — Phase 2 migration file, settings UI, skills
- `ecf03e3` / `1ed1b1f` — web-only `vercel.json`
- `f6aeb14` — schema applied note, `.mcp.json`
- `4505b12` — `docs/DEVICE_SETUP.md`

**Layout:** `apps/web`, `services/processor`, `packages/shared`, `packages/schemas`, `supabase/migrations`.

**Production web:** https://contract-intelligence-platform-web.vercel.app (source `main`).

**Clients:** keep `@/` → `lib/supabase`. Env names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY`. Pooler URLs: `DATABASE_URL` (6543, pgbouncer), `DIRECT_URL` (5432, migrations). Password: encode `$` as `%24`; **do not** encode `!`. Use session pooler, not IPv6 `db.*.supabase.co`.

**Supabase project:** `lhmurblikkcomdxcrymx`, region `us-west-2`, dashboard https://supabase.com/dashboard/project/lhmurblikkcomdxcrymx

**Migration applied:** `supabase/migrations/20260819100000_phase2_tenancy_provenance.sql`

Tables/enums (summary): `organizations`, `memberships` (roles: admin, importer, verifier, bidder, executive), `clients`, `opportunities`, `document_batches`, `documents`, `document_versions`, `extraction_runs`, `extracted_facts`, `source_evidence`, `verification_events`, `validation_exceptions`. Helpers: `is_org_member`, `is_org_admin`, `has_org_role`, `org_member_count` (SECURITY DEFINER; used so first-member insert cannot be spoofed via RLS-hidden rows). Membership insert: org admin **or** (`user_id = auth.uid()` AND `org_member_count = 0`). Org insert: any authenticated user (bootstrap). Org select: members only.

**App:** `/` redirects to `/overview`. Sidebar: Intake, Processing queue, and Documents are real Phase 3 screens. Settings still creates orgs. Starter leftovers still exist: `hero.tsx`, `components/tutorial/`, `/protected`. Auth at `/auth/login` and `/auth/sign-up`.

**Skills in repo:** `.cursor/skills/supabase`, `.cursor/skills/supabase-postgres-best-practices`, `.agents/skills/...`. `.mcp.json` points at this Supabase project (OAuth; no password).

**Verified locally:** processor `pytest` 9/9 including Phase 6 evals. `npm run test:phase2-rls` 48/48. Production: https://contract-intelligence-platform-web.vercel.app.

---

## What you should do next (in order)

1. Use Node 24+ (`nvm use` / `.nvmrc`). Create `apps/web/.env.local` from `.env.example` if missing.
2. `npm install`, `npm run env:check`, `npm run typecheck`, `npm run test:phase2-rls`, `npm run test:phase3-intake`.
3. Processor: `cd services/processor`, venv, `pip install -e ".[dev]"`, `pytest`. Set `PROCESSOR_URL` + `PROCESSOR_SHARED_SECRET` to wire intake to parse.
4. Verification: `/ingestion/verification` after facts exist. `npm run test:phase5-verification`.
5. Benchmark / routing: `npm run test:phase6-benchmark` then `python -m lp_processor.evals.harness` from the processor venv. Policy: [ROUTING_POLICY.md](ROUTING_POLICY.md).
6. **Stop.** Do not implement Phase 12 (Glide pricing) until Phase 11 is proven (`npm run test:phase11-hybrid-rag`).
7. Rotate Supabase secret and database password only before importing real L&P data or calling the environment production-ready.

---

## Explicit do-nots for the next agent

- Do not scaffold another Next.js template or move clients to `utils/supabase`.
- Do not add Tiptap, Queues, Cloud Run, or lock an OCR vendor.
- Do not deploy the Python processor on Vercel (`/api/processor`).
- Do not add Prisma/Drizzle or clone those GitHub repos.
- Do not commit secrets, `.env.local`, or database passwords.
- Do not treat ChatGPT “Phase 1 not started” pastes as truth. Phase 1–9 are on this branch.

If a task is not on the current phase in `docs/BUILD_PLAN.md`, it is not this phase.
