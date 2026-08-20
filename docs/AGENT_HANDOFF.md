# Agent handoff (pick up here)

**Repo:** https://github.com/AshtonMedina22/Contract-Intelligence-Platform  
**Branch:** `main` — run `git log -1` for HEAD  
**Reconciled truth (read first):** [FOUNDATION_AUDIT_2026-08-20.md](FOUNDATION_AUDIT_2026-08-20.md)  
**Living trail:** [WORK_TRAIL.md](WORK_TRAIL.md)  
**Canonical pack:** [CANONICAL_PRODUCT_PACK.md](CANONICAL_PRODUCT_PACK.md)  
**Do not redesign the architecture.**

Secrets are **not** in git. Read `docs/DEVICE_SETUP.md`. Never commit `.env.local`.

**Operator login for agents:** `LP_OPERATOR_EMAIL` / `LP_OPERATOR_PASSWORD` in `apps/web/.env.local`. Run `node --env-file=apps/web/.env.local scripts/ensure-operator.mjs` if auth/org is broken. Local `npm run dev` auto-signs in with those vars. Do not create throwaway UI users.

**Authoritative blueprint:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). **Long-form domains/tables/Python:** [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). **Phase naming:** [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md). Phases: [BUILD_PLAN.md](BUILD_PLAN.md). UX: [UX_UI.md](UX_UI.md). Stack: [TECH_STACK.md](TECH_STACK.md).

**Foundation rollback branch:** `cursor-phase2-foundation` @ `8d2d031` (pre–Prompt 2C–9 expansion).

---

## What this product is

**Proposal-centered** Proposal, Contract & Procurement Intelligence for **L&P Global Security**, with **multi-tenant-ready architecture from day one**. Optional commercialization is **not** a core product phase.

Not a CRM, chatbot, client portal, or generic RFP tracker.

Historical files → staging → human verification → canonical Postgres. Four commercial truths: requested / proposed / awarded / current.

**Primary pursuit flow:** Pursuit → Requirements → Pricing → Response → Submission → Result.

---

## Phase status (honest — use this language)

| Phase | Status |
| --- | --- |
| **1 Foundation** | **Mostly real** (auth, RLS, staging defaults `AI_EXTRACTED`, verify→promote gates, FastAPI processor, intake/workbench). Confirm prod env + migrations. |
| **2 Real-Document Historical Pilot** | **Incomplete.** ~**7 A/B** packages through source→verify→promote (VERIFY 2B). Exit target **~20–30** unmet. |
| **3–8** | **Large code + acceptance harnesses exist** (Contracts, Intelligence, Ask, Pricing, Response). Corpus-thin / unvalidated for L&P daily use. Treat “PASS” in WORK_TRAIL as **script pass**, not product exit. |

**Wrong:** “Phase 2 complete because RLS 48/48.” RLS = Foundation, not Historical Pilot.  
**Wrong:** “Platform READY / Phases 3–8 complete” while pilot corpus and prod processor/`ASK_MODEL` are open.  
**Wrong:** “0 packages through pipeline” — that is stale; use **~7 A/B**, not zero and not 20–30.

**Next task:** Grow the public-first Historical Pilot corpus; confirm Vercel + migrations. Do not invent L&P prices. Do not auto-promote AI facts. Do not expand finished-product claims on empty screens.

---

## Status (engineering)

| Check | Result |
| --- | --- |
| Architecture | Locked stack largely preserved (no Prisma; web-only Vercel; promote requires `HUMAN_VERIFIED`) |
| VERIFY 9 | Engineering/trust harness: READY WITH NONBLOCKING LIMITATIONS — **not** full product exit |
| Production | Tenant/env/processor hosting still ops work |

---

## Six engines (canonical names)

1. Opportunity / Solicitation Intelligence  
2. Contract & Compliance Intelligence  
3. Pricing Intelligence  
4. Buyer / Market / Competitor Intelligence  
5. Proposal / Response Intelligence  
6. Executive / Business Intelligence  

Canonical IA: Home | Pursuits | Intelligence | Contracts | Data Ops | Settings.

---

## Do not

- Treat RLS tests or VERIFY scripts as Historical Pilot completion  
- Build CRM, client portal, or fake analytics  
- Auto-promote AI extraction to canonical  
- Collapse four commercial truths into one rate field  
- Invent L&P prices, staffing, or performance metrics  
- Delete useful early UI; freeze expansion until corpus validates  

---

## Useful commands

```bash
npm install
npm run dev
npm run build
npm run test:phase2-rls
npm run test:phase3-intake
```

Cursor slices: [CURSOR_PROMPTS.md](CURSOR_PROMPTS.md).
