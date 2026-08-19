# Contract Intelligence Platform

Proposal, Contract & Procurement Intelligence Platform for L&P Global Security.

Historical procurement files become staged, source-backed facts. Humans verify them. Only then does the system run contracts, four commercial truths (requested / proposed / awarded / current), pricing evidence, and grounded proposal drafts. AI never auto-promotes facts to canonical data.

## Current phase

**Phase 2 — Provenance schema is on the live Supabase project.**  
On a **new computer**, follow [docs/DEVICE_SETUP.md](docs/DEVICE_SETUP.md). Copy `apps/web/.env.example` → `apps/web/.env.local` and paste secrets from your password manager (never commit `.env.local`).

```bash
npm install
npm run dev
```

Requires Node 24+. New machines: [docs/DEVICE_SETUP.md](docs/DEVICE_SETUP.md). Phase 2 SQL is already applied on project `lhmurblikkcomdxcrymx`.

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
| [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md) | Status snapshot for another agent (Codex/Cursor) to continue |

Repo: [https://github.com/AshtonMedina22/Contract-Intelligence-Platform](https://github.com/AshtonMedina22/Contract-Intelligence-Platform)

## How to run

```text
apps/web          Next.js (npm workspaces)
services/processor   Python (own venv; empty src/tests until Phase 4)
packages/shared      TS (empty)
packages/schemas     TS (empty)
supabase/migrations  Phase 2 SQL — apply to project lhmurblikkcomdxcrymx
```

Until Phase 2, `npm run dev` works without Supabase env vars (auth proxy is skipped).

## Locked architecture (one screen)

- **Lifecycle:** Storage copy → Vercel Workflow (parse → extract → validate → wait for human → promote). Queues = optional fan-out only.
- **Vault:** Supabase Storage, immutable-by-policy (`org_id/document_id/version_id/sha256/original.ext`). Drive = import + human workspace.
- **Cron:** Supabase Cron for expirations. Vercel Cron only for later app jobs.
- **Excel/PDF:** openpyxl first; PDF.js in verification. Do not lock OCR/model vendors yet.
