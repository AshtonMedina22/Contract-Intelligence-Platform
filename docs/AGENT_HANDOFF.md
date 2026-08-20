# Agent handoff (pick up here)

**Repo:** https://github.com/AshtonMedina22/Contract-Intelligence-Platform  
**Branch:** `main` — run `git log -1` for HEAD  
**Living trail (must update every session):** [WORK_TRAIL.md](WORK_TRAIL.md)  
**Canonical pack:** [CANONICAL_PRODUCT_PACK.md](CANONICAL_PRODUCT_PACK.md)  
**Do not redesign the architecture. Read [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) and [WORK_TRAIL.md](WORK_TRAIL.md) before implementing.**

Secrets are **not** in git. Read `docs/DEVICE_SETUP.md`. Ask the human for `apps/web/.env.local` values. Never commit `.env.local`.

**Authoritative blueprint:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). **Long-form domains/tables/Python:** [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). **Phase naming:** [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md). Phases: [BUILD_PLAN.md](BUILD_PLAN.md). UX: [UX_UI.md](UX_UI.md). Stack: [TECH_STACK.md](TECH_STACK.md).

---

## What this product is

**Proposal-centered** Proposal, Contract & Procurement Intelligence for **L&P Global Security**, with **multi-tenant-ready architecture from day one**. Optional commercialization (selling to other contracting companies) is **not** a core product phase.

Not a CRM, chatbot, client portal, or generic RFP tracker.

Historical files → staging → human verification → canonical Postgres. Four commercial truths: requested / proposed / awarded / current.

**Primary pursuit flow:** Pursuit → Requirements → Pricing → Response → Submission → Result.

---

## Phase status (canonical — use this language)

| Phase | Status |
| --- | --- |
| **1 Foundation** | Mostly complete / needs hardening — [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md) |
| **2 Real-Document Historical Pilot** | **ACTIVE NEXT — 0 packages through complete pipeline** — [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md) |
| **3 Historical Ingestion & Migration** | Code exists in parts; unproven at corpus scale |
| **4–8** | Early/partial code only; unvalidated |

**Wrong:** “Phase 2 complete because RLS 48/48.” RLS = **Foundation (Phase 1)**, not Historical Pilot.  
**Wrong:** “Canonical phases 1–9” — core phases are **1–8**; platform complete after Phase 8.

**Next task:** Env + migrations as needed. **Historical Pilot is public-first** — [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md). Do not wait for internal Drive. Do not promote news dollars. Do not declare Ask/Pricing/Response complete before the pilot gap report.

---

## Status (engineering)

| Check | Result |
| --- | --- |
| origin/main | Feature code ahead of evidence; run `git log -1` |
| Vercel | Deploy may exist; tenant/env not confirmed; **apply migrations** as needed |
| Early Intelligence / Ask / pursuit shell | Code exists; **early/partial / unvalidated** — reconcile to [UX_UI.md](UX_UI.md) |

---

## Six engines (canonical names)

1. Opportunity / Solicitation Intelligence  
2. Contract & Compliance Intelligence  
3. Pricing Intelligence  
4. Buyer / Market / Competitor Intelligence  
5. Proposal / Response Intelligence  
6. Executive / Business Intelligence  

These engines do **not** dictate sidebar navigation. Canonical IA: Home | Pursuits | Intelligence | Contracts | Data Ops | Settings. Data Ops owns Intake/Processing/Verification — not a peer “Ingestion product.”

---

## Do not

- Treat RLS tests as Historical Pilot completion  
- Build CRM, client portal, or fake analytics  
- Treat commercialization/PaaS as a required numbered phase  
- Auto-promote AI extraction to canonical  
- Collapse four commercial truths into one rate field  
- Invent L&P prices, staffing, or performance metrics  

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
