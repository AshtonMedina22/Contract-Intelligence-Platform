# Contract Intelligence Platform

Proposal, Contract & Procurement Intelligence Platform for L&P Global Security.

Historical procurement files become staged, source-backed facts. Humans verify them. Only then does the system support contracts, four commercial truths (requested / proposed / awarded / current), pricing evidence, and grounded proposal drafts. AI never auto-promotes facts to canonical data.

## Current product position

| Status | Detail |
| --- | --- |
| **Canonical Phase 1 — Foundation** | Mostly implemented (app, RLS, intake, processor, verification workbench). Build green locally; verify Vercel after push. |
| **Canonical Phase 2 — Historical Pilot** | **NOT STARTED** — 0 real L&P packages ingested and scored. |
| **Later Intelligence UX** | Ask, Market, Reports, etc. exist early — **KEEP + FREEZE** pending corpus validation. |

**Do not read "legacy engineering Phase 11" or "Phase 2 RLS complete" as product maturity.**

```bash
npm install
npm run dev
```

Requires Node 24+. New machines: [docs/DEVICE_SETUP.md](docs/DEVICE_SETUP.md).

SQL migrations through legacy Phase 11 exist in `supabase/migrations/` — that is **engineering artifact**, not proof that Search/Ask or Market intelligence is production-ready.

## Read these first

| Doc | What it is |
| --- | --- |
| [docs/MASTER_BLUEPRINT.md](docs/MASTER_BLUEPRINT.md) | **Single authoritative product blueprint** |
| [docs/PHASE_RECONCILIATION.md](docs/PHASE_RECONCILIATION.md) | Original vs legacy vs canonical phase names |
| [docs/PHASE1_FOUNDATION_AUDIT.md](docs/PHASE1_FOUNDATION_AUDIT.md) | Original Phase 1 checklist |
| [docs/HISTORICAL_PILOT.md](docs/HISTORICAL_PILOT.md) | Original Phase 2 — 20–30 packages |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Product definition + six engines |
| [docs/CURRENT_STATE_AUDIT.md](docs/CURRENT_STATE_AUDIT.md) | What exists today vs gaps |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | Canonical phases + legacy engineering checklist |
| [docs/MASTER_PRODUCT_CONTEXT.md](docs/MASTER_PRODUCT_CONTEXT.md) | Full product context |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Locked stack |
| [docs/DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md) | Vault, tenancy, live vs future schema |
| [docs/SOURCE_PRECEDENCE.md](docs/SOURCE_PRECEDENCE.md) | Four truths and conflict rules |
| [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md) | Agent continuation snapshot |

Repo: [https://github.com/AshtonMedina22/Contract-Intelligence-Platform](https://github.com/AshtonMedina22/Contract-Intelligence-Platform)

## How to run

```text
apps/web              Next.js (npm workspaces)
services/processor    Python FastAPI (parse/extract staging)
packages/shared       TS (JobPort, checksum, evidence path)
packages/schemas      Zod contracts for NormalizedDocument / facts
supabase/migrations   SQL through legacy Phase 11
```

## Locked architecture (one screen)

- **Lifecycle:** Storage copy → Vercel Workflow (parse → extract → validate → wait for human → promote). Queues = optional fan-out only.
- **Vault:** Supabase Storage, immutable-by-policy (`org_id/document_id/version_id/sha256/original.ext`). Drive = import + human workspace.
- **Cron:** Supabase Cron for expirations. Vercel Cron only for later app jobs.
- **Excel/PDF:** openpyxl first; PDF.js in verification. Do not lock OCR/model vendors yet.
- **Not a CRM or client portal.** Buyers/agencies are procurement intelligence entities.
