# Agent handoff (pick up here)

**Repo:** https://github.com/AshtonMedina22/Contract-Intelligence-Platform  
**Branch:** `main` (HEAD `02d8879` at last audit)  
**Do not redesign the architecture. Read [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) before implementing.**

Secrets are **not** in git. Read `docs/DEVICE_SETUP.md`. Ask the human for `apps/web/.env.local` values. Never commit `.env.local`.

Canonical product: [PRODUCT_SPEC.md](PRODUCT_SPEC.md). Phases: [BUILD_PLAN.md](BUILD_PLAN.md). Stack: [TECH_STACK.md](TECH_STACK.md).

---

## What this product is

Proposal, Contract & Procurement Intelligence for **L&P Global Security** (later possible multi-tenant for **contracting companies**). Not a CRM, chatbot, client portal, or generic RFP tracker.

Historical files → staging → human verification → canonical Postgres. Four commercial truths: requested / proposed / awarded / current. Six engines: see [PRODUCT_SPEC.md](PRODUCT_SPEC.md).

---

## Canonical vs legacy phase numbers

| Term | Meaning |
| --- | --- |
| **Canonical Phase 2 — Historical Pilot** | 20–30 complete L&P packages verified — **NOT STARTED** (0 packages) |
| **Legacy engineering Phase 2** | RLS/tenancy in Postgres — **Foundation work**, not the Historical Pilot |

**Do not say "Phase 2 complete" for product maturity** when you mean RLS (48/48 isolation tests).

**Current product position:** Foundation mostly built → **Historical Pilot is next**. Intelligence UX (Ask, Market, Reports) is **KEEP + FREEZE**.

---

## Status (honest)

| Canonical phase | Status |
| --- | --- |
| 1 Foundation | Mostly built; lint fails; Vercel deploy not verified green |
| 2 Historical Pilot | **NOT STARTED** |
| 3–7 | Engineering code/UX exists early; **unvalidated** on L&P corpus |
| 8–9 | Placeholders |

Legacy engineering acceptance scripts (Phase 2–11) may pass without proving product maturity. See [BUILD_PLAN.md](BUILD_PLAN.md) mapping table.

---

## Locked architecture (do not change)

- **Web:** Next.js App Router, React 19, TypeScript, Tailwind, shadcn, Lucide. Vercel, Node 24. npm workspaces.
- **Data:** Supabase Postgres + Auth + RLS. No Prisma/Drizzle.
- **Storage:** Supabase Storage = canonical evidence vault by policy. Drive = import + workspace. **Not** Drive-only vault.
- **Orchestration:** Vercel **Workflow** = document lifecycle. Queues = fan-out only via JobPort. No LangGraph/eve for ingest.
- **Cron:** Supabase Cron for contract SQL. Vercel Cron for later app jobs only.
- **Search:** Postgres FTS + pgvector. No Pinecone/Qdrant.
- **Buyers:** `clients` = buyer/agency — not CRM accounts.

Full list: [TECH_STACK.md](TECH_STACK.md).

---

## What you should do next (in order)

1. Read [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).
2. After docs reconciliation: fix Foundation build/lint if asked (`/auth/login`, eslint).
3. Confirm lint + typecheck + build + Vercel deploy green.
4. **Begin Canonical Phase 2 — Historical Pilot:** 20–30 complete L&P packages through intake → verify.
5. **Do not** expand Intelligence UX, Glide, or Tiptap until the pilot validates the model.
6. Rotate Supabase secrets before importing real L&P data.

---

## Explicit do-nots

- Do not treat legacy "Phase 11 implemented" as product-ready Search/Ask.
- Do not build CRM, client portal, lead management, or fake analytics.
- Do not scaffold another Next.js template or add Prisma/Drizzle.
- Do not commit secrets.
- If a task is not on the current canonical phase in BUILD_PLAN, it is not this phase.
