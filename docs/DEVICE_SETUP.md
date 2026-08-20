# Other-device setup

Use this when you clone on a new computer. **Secrets are not in git.** Copy them from your password manager. Never commit `apps/web/.env.local`.

## Source of truth

- Repo: https://github.com/AshtonMedina22/Contract-Intelligence-Platform
- Branch: `main`
- Product spec: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md)
- Current state: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md)
- Build order: [BUILD_PLAN.md](BUILD_PLAN.md)
- Stack: [TECH_STACK.md](TECH_STACK.md)

**Current product position:** Foundation mostly built. **Historical Pilot (canonical Phase 2) NOT STARTED** — 0 L&P packages. Later Intelligence UX exists early and is frozen pending corpus validation.

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
# paste real values
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`. See [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) for last recorded results.

## Migrations applied

SQL through legacy Phase 11 exists in `supabase/migrations/`. Applied on project through at least `20260820220000_phase9_contracts_cron`; newer migrations may need `supabase db push`. **Migration presence ≠ product phase complete.**

```bash
npx supabase db push --yes --db-url "$DIRECT_URL"
```

## What is done vs not

**Foundation (mostly):** app, RLS (48/48), intake, processor, verification workbench, early schema, Intelligence shell (frozen).

**Not done:** Historical Pilot (0 packages), verified corpus, OCR/DOCX production paths, Glide pricing, Tiptap proposals, hosted apply of opportunity migrations, confirmed Vercel tenant/env. Tracker: [WORK_TRAIL.md](WORK_TRAIL.md).

**Do not:** clone Prisma/Drizzle, deploy processor on Vercel, put secrets in git, treat RLS as product Phase 2 complete.
