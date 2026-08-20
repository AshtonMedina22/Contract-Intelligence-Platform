# Other-device setup

Use this when you clone on a new computer. **Secrets are not in git.** Copy them from your password manager. Never commit `apps/web/.env.local`.

## Source of truth

- Repo: https://github.com/AshtonMedina22/Contract-Intelligence-Platform
- Branch: `main`
- Product spec: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md)
- Current state: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md)
- Build order: [BUILD_PLAN.md](BUILD_PLAN.md)
- Stack: [TECH_STACK.md](TECH_STACK.md)

**Current product position:** see [FOUNDATION_AUDIT_2026-08-20.md](FOUNDATION_AUDIT_2026-08-20.md). Foundation mostly real. Historical Pilot **~7 A/B** through pipeline (exit ~20–30 unmet). Later UI exists but is corpus-thin. Core phases **1–8**. Rollback: `cursor-phase2-foundation`.

Requires **Node 24+** (`.nvmrc` / `.node-version`). npm workspaces (not pnpm).

## Accounts / dashboards

- GitHub: `AshtonMedina22/Contract-Intelligence-Platform`
- Supabase project ref: `lhmurblikkcomdxcrymx` — https://supabase.com/dashboard/project/lhmurblikkcomdxcrymx
- Vercel: project `contract-intelligence-platform-web` — deploy may **not** be green; verify before claiming production-ready.

## New machine commands

```bash
git clone https://github.com/AshtonMedina22/Contract-Intelligence-Platform.git
cd Contract-Intelligence-Platform
git checkout main && git pull
npm install
cp apps/web/.env.example apps/web/.env.local
# paste real Supabase/Vercel values
# set LP_OPERATOR_EMAIL + LP_OPERATOR_PASSWORD (lasting global admin for agents + you)
node --env-file=apps/web/.env.local scripts/ensure-operator.mjs
npm run dev
```

Local middleware auto-signs in with `LP_OPERATOR_*` in development. Agents must use that account — not ephemeral pilot users.

**Cross-device secrets (not in git):** after `vercel link`, pull env into the web app:

```bash
cd apps/web
npx vercel env pull .env.local --yes --environment=development
# or: production — includes Supabase + LP_OPERATOR_* when synced from this machine
node --env-file=.env.local ../../scripts/ensure-operator.mjs
```

From repo root you can re-push local secrets to Vercel with `python scripts/sync-vercel-env-from-local.py` (never prints values).

Checks: `npm run typecheck`, `npm run lint`, `npm run build`. See [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) for last recorded results.

## Migrations applied

SQL through legacy Phase 11 exists in `supabase/migrations/`. Applied on project through at least `20260820220000_phase9_contracts_cron`; newer migrations may need `supabase db push`. **Migration presence ≠ product phase complete.**

```bash
npx supabase db push --yes --db-url "$DIRECT_URL"
```

## What is done vs not

**Foundation (mostly):** app, RLS, intake, FastAPI processor (DOCX wired; OCR key-gated), verification workbench, promote-on-`HUMAN_VERIFIED`.

**Not done as product:** Historical Pilot exit (~20–30 packages), rich verified corpus, confirmed Vercel tenant/env + hosted processor, `ASK_MODEL`. Later phase UIs exist — do not treat VERIFY PASS as operator-ready. Tracker: [WORK_TRAIL.md](WORK_TRAIL.md) + [FOUNDATION_AUDIT_2026-08-20.md](FOUNDATION_AUDIT_2026-08-20.md).

**Do not:** clone Prisma/Drizzle, deploy processor on Vercel, put secrets in git, treat RLS as product Phase 2 complete, treat commercialization as a required product phase.
