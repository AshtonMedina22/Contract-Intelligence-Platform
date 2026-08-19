# Contract Intelligence Platform

Proposal, Contract & Procurement Intelligence Platform for L&P Global Security.

Historical procurement files become staged, source-backed facts. Humans verify them. Only then does the system run contracts, four commercial truths (requested / proposed / awarded / current), pricing evidence, and grounded proposal drafts. AI never auto-promotes facts to canonical data.

## Current phase

**Phase 1 — Framework foundation in this git repo.**  
Official Next.js + Supabase starter lives in `apps/web`. Nav shell is placeholders only. No intake, parsers, or Workflow yet.

```bash
npm install
npm run dev
```

Requires Node 24+. Copy `apps/web/.env.example` to `apps/web/.env.local` when you have a real Supabase project (Phase 2). The app typechecks without secrets.

## Read these first

| Doc | What it is |
| --- | --- |
| [docs/MASTER_PRODUCT_CONTEXT.md](docs/MASTER_PRODUCT_CONTEXT.md) | Full product context (portable source of truth) |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | Phase-by-phase operational checklist, files, exit criteria |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Short product definition |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Locked stack, cost notes, what not to add |
| [docs/DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md) | Vault paths, tenancy, schema order |
| [docs/DOCUMENT_TAXONOMY.md](docs/DOCUMENT_TAXONOMY.md) | Document types and parser defaults |
| [docs/SOURCE_PRECEDENCE.md](docs/SOURCE_PRECEDENCE.md) | Four truths and conflict rules |
| [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) | Phase index (points at BUILD_PLAN) |

Repo: [https://github.com/AshtonMedina22/Contract-Intelligence-Platform](https://github.com/AshtonMedina22/Contract-Intelligence-Platform)

## How to run (later)

After Phase 1 exists:

```text
apps/web          Next.js (npm or pnpm)
services/processor   Python (own venv)
```

Until Phase 2, `npm run dev` works without Supabase env vars (auth proxy is skipped).

## Locked architecture (one screen)

- **Lifecycle:** Storage copy → Vercel Workflow (parse → extract → validate → wait for human → promote). Queues = optional fan-out only.
- **Vault:** Supabase Storage, immutable-by-policy (`org_id/document_id/version_id/sha256/original.ext`). Drive = import + human workspace.
- **Cron:** Supabase Cron for expirations. Vercel Cron only for later app jobs.
- **Excel/PDF:** openpyxl first; PDF.js in verification. Do not lock OCR/model vendors yet.
