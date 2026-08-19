# Other-device setup

Use this when you clone on a new computer. **Secrets are not in git.** Copy them from your password manager (or the chat where they were issued). Never commit `apps/web/.env.local`.

## Source of truth

- Repo: https://github.com/AshtonMedina22/Contract-Intelligence-Platform
- Branch: `main`
- Product spec: `docs/MASTER_PRODUCT_CONTEXT.md`
- Build order: `docs/BUILD_PLAN.md`
- Current phase: **Phase 2 complete** (see [PHASE2_ACCEPTANCE.md](PHASE2_ACCEPTANCE.md)). Do not start intake / OCR / Workflow / AI until Phase 3 is explicitly approved.

Requires **Node 24+** (`.nvmrc` / `.node-version`). npm workspaces (not pnpm).

## Accounts / dashboards

- GitHub: `AshtonMedina22/Contract-Intelligence-Platform`
- Supabase project: **Contract-Intelligence-Platform**
  - Project ref: `lhmurblikkcomdxcrymx`
  - Region: `us-west-2` (Oregon)
  - Dashboard: https://supabase.com/dashboard/project/lhmurblikkcomdxcrymx
  - API URL: `https://lhmurblikkcomdxcrymx.supabase.co`
- Vercel: Hobby team **Ashton Medina's projects**. Project name: `contract-intelligence-platform-web`.
  - Production: https://contract-intelligence-platform-web.vercel.app
  - Deploy **only** the Next.js `web` service (`vercel.json` at repo root). Do not deploy `services/processor`.
- Do **not** use Prisma or Drizzle.

## New machine commands

Requires **Node 24+**. npm workspaces (not pnpm).

```bash
git clone https://github.com/AshtonMedina22/Contract-Intelligence-Platform.git
cd Contract-Intelligence-Platform
git checkout main
git pull
npm install
cp apps/web/.env.example apps/web/.env.local
# paste real values into apps/web/.env.local
npm run dev
```

App: http://localhost:3000 → `/overview`. Auth: `/auth/sign-up` then `/system/settings` to create an org.

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

## `apps/web/.env.local` (gitignored)

Fill from `.env.example`. Real keys never go in git.

| Name | Public? | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Browser + server Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_...` |
| `SUPABASE_URL` | no (same URL, server alias) | Same host without relying on the Next public prefix |
| `SUPABASE_PUBLISHABLE_KEY` | no | Same publishable key, server alias |
| `SUPABASE_SECRET_KEY` | **never public** | `sb_secret_...` — server only, bypasses RLS |
| `SUPABASE_JWKS_URL` | yes (URL only) | Auth JWKS |
| `DATABASE_URL` | **never public** | Transaction pooler `:6543` + `pgbouncer=true` |
| `DIRECT_URL` | **never public** | Session pooler `:5432` for migrations |
| `POSTGRES_PASSWORD` | **never public** | Optional local helper for CLI |

Password encoding in URLs: encode `$` as `%24`. Leave `!` unencoded. Use the **session pooler** for `supabase db push`, not `db.*.supabase.co` (IPv6). Host: `aws-0-us-west-2.pooler.supabase.com`. User: `postgres.lhmurblikkcomdxcrymx`. Database: `postgres`.

Apply a new migration:

```bash
npx supabase db push --yes --db-url "$DIRECT_URL"
```

Phase 2 migration `20260819100000_phase2_tenancy_provenance.sql` is **already applied** on this project.

## Vercel env (Production + Preview)

Set the same `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Do not put the secret in a `NEXT_PUBLIC_` name. Database password is not required on Vercel until something uses `DATABASE_URL`.

Import: Root Directory = **repository root** (so root `vercel.json` is used), not `apps/web` alone. Application Preset **Services** is OK if `vercel.json` lists only `web`. Or preset **Next.js** with root `apps/web`.

## Agents / MCP / skills

Already in git:

- `.cursor/skills/supabase` and `.cursor/skills/supabase-postgres-best-practices`
- `.agents/skills/...` (same skills)
- `.mcp.json` — Supabase MCP for project `lhmurblikkcomdxcrymx` (OAuth in Cursor; no DB password in that file)

On a new Cursor window: clone repo, authenticate the Supabase MCP if tools are missing. Do not re-scaffold Phase 1.

## What is done vs not

**Done:** Phase 0 docs, Phase 1 `apps/web` scaffold, Phase 2 SQL + RLS + storage bucket policies, Settings org-create UI, processor empty `src/` + `tests/`, Vercel web-only `vercel.json`.

**Not done:** rotate chat-exposed privileged credentials, Phase 3 intake, Workflow, parsers, OCR, AI.

**Do not:** clone Prisma/Drizzle, deploy the empty Python folder, add FastAPI/Docling yet, put secrets in git.
