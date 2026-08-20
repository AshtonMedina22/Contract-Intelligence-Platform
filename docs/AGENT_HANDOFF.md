# Agent handoff (pick up here)

**Repo:** https://github.com/AshtonMedina22/Contract-Intelligence-Platform  
**Branch:** `main` — run `git log -1` for HEAD  
**Living trail (must update every session):** [WORK_TRAIL.md](WORK_TRAIL.md)  
**Do not redesign the architecture. Read [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) and [WORK_TRAIL.md](WORK_TRAIL.md) before implementing.**

Secrets are **not** in git. Read `docs/DEVICE_SETUP.md`. Ask the human for `apps/web/.env.local` values. Never commit `.env.local`.

**Authoritative blueprint:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). **Phase naming:** [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md). Phases: [BUILD_PLAN.md](BUILD_PLAN.md). Stack: [TECH_STACK.md](TECH_STACK.md).

---

## What this product is

Proposal, Contract & Procurement Intelligence for **L&P Global Security** (later possible multi-tenant for **contracting companies**). Not a CRM, chatbot, client portal, or generic RFP tracker.

Historical files → staging → human verification → canonical Postgres. Four commercial truths: requested / proposed / awarded / current. **Six engines:** see [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) and [PRODUCT_SPEC.md](PRODUCT_SPEC.md).

---

## Phase status (original blueprint — use this language)

| Original phase | Status |
| --- | --- |
| **1 Foundation** | Mostly complete — [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md) |
| **2 Historical pilot** | **NOT STARTED** (0 L&P packages) — [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md) |
| **3 Historical ingestion** | NOT STARTED |
| **4–8** | Partial early code only; unvalidated |

**Wrong:** “Phase 2 complete because RLS 48/48.” RLS = **Original Phase 1**, not Historical Pilot.

**Next task:** (1) Apply opportunity migrations `300000` / `310000` / `320000` on Supabase. (2) Confirm Vercel env. (3) **Historical Pilot**. Do **not** add LLM Ask/competitor reports.

---

## Status (engineering)

| Check | Result |
| --- | --- |
| `npm run lint` / `typecheck` / `build` | Build PASS locally after Pass 4 (2026-08-19) |
| origin/main | Pass 3+4 on `main` after this push — run `git log -1` |
| Vercel | Deploy follows push; tenant/env not confirmed; **apply migrations** |
| Legacy phases 3–11 | Code exists; **KEEP + FREEZE** Intelligence UX |

---

## Six engines (navigation must map to these)

1. Opportunity / Solicitation  
2. Contract & Compliance  
3. Pricing Intelligence  
4. Client / Competitor Intelligence  
5. Proposal Intelligence  
6. Executive Analytics  

Powered by verified historical database. Ingestion pipeline **feeds** all engines — it is not a seventh “product module.”

---

## Do not

- Treat RLS tests as Historical Pilot completion  
- Build CRM, client portal, or fake analytics  
- Reorder phases for demo screens  
- Auto-promote AI extraction to canonical  
- Collapse four commercial truths into one rate field  

---

## Useful commands

```bash
npm install
npm run dev
npm run build
npm run test:phase2-rls
npm run test:phase3-intake
```

Supabase project ref: `lhmurblikkcomdxcrymx` (Contract-Intelligence-Platform).
