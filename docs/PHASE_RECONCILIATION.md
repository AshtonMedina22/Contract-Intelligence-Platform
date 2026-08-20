# Phase reconciliation — original blueprint vs repo naming

**Purpose:** Stop phase-label confusion. One place that explains what “Phase 2” means in each system.

Read with: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md), [BUILD_PLAN.md](BUILD_PLAN.md), [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md).

---

## The error we corrected

| Wrong (do not say) | Correct |
| --- | --- |
| “Legacy/engineering Phase 2 complete = product ready for intake at scale” | Engineering Phase 2 = **RLS/tenancy** = **Original Phase 1 (Foundation)** |
| “Phase 1 done, Phase 2 done, ready for Phase 3” | Original Phase 1 **mostly** done; Original Phase 2 **NOT STARTED**; Original Phase 3 **NOT STARTED** |
| “Phase 11 implemented → next is Glide” | Legacy Phase 11 = hybrid RAG **code** exists; Original Phase 6/7 not product-complete without corpus |

The **48/48 RLS tests** prove tenant isolation. They do **not** prove the historical data model on 20–30 L&P packages.

---

## Three naming systems

### A. Original master blueprint (product truth)

| Phase | Name | Done when |
| --- | --- | --- |
| 1 | Foundation | DB, auth, registry, staging/verification structure, Drive references |
| 2 | **Historical pilot** | 20–30 complete L&P packages verified; routing locked from real evidence |
| 3 | Historical ingestion | Production pipeline + bulk migration of remaining history |
| 4 | Contract/compliance | Operational contracts, renewals, certifications from verified data |
| 5 | Analytics | Win/loss, pricing, competitor, contract dashboards (verified only) |
| 6 | Search/AI | Embeddings, semantic retrieval |
| 7 | Pricing intelligence | Dynamic structure, cost model, Glide, evidence ranges |
| 8 | Proposal builder | Grounded drafts, Google Docs handoff, final outputs |

### B. Canonical product phases (BUILD_PLAN — use for maturity)

| Canonical | Maps from original | Notes |
| --- | --- | --- |
| 1 Foundation | Original 1 | Includes RLS — **not** pilot |
| 2 Historical Pilot | Original 2 | **Blocking milestone** |
| 3 Ingestion/processing | Original 3 (partial) | Code exists; unproven on L&P |
| 4 Broader migration | Original 3 (scale) | After pilot |
| 5 Contracts | Original 4 | |
| 6 Market/buyer/competitor | Original 5 (partial) | + intelligence tables |
| 7 Search/Ask | Original 6 | |
| 8 Pricing | Original 7 | |
| 9 Proposal builder | Original 8 | |

### C. Legacy engineering IDs (migrations, scripts only)

| Legacy ID | What it is | Original phase | Product maturity today |
| --- | --- | --- | --- |
| 0 | Docs in git | 1 | Done |
| 1 | Next.js scaffold | 1 | Done |
| **2** | **Tenancy / RLS** | **1 (Foundation)** | **Proven (48/48)** — **NOT Original Phase 2** |
| 3 | Intake + Workflow | 1 | Implemented, unvalidated |
| 4 | Processor | 1 / 3 | Implemented, unvalidated |
| 5 | Verification workbench | 1 | Implemented, unvalidated |
| **6** | Pilot benchmark harness | **2 (Pilot)** | **Fixtures only — 0 L&P packages** |
| 7 | Four-truth schema + promotion | 2 validates | Implemented, unvalidated |
| 8 | Bulk migration | 3 | RPC/UI exists, no corpus |
| 9 | Contracts + cron | 4 | Early, unvalidated |
| 10 | Win/loss + competitor tables | 5 / engine 4 | Early UX — FREEZE |
| 11 | Hybrid RAG | 6 / engine 5 | Early UX — FREEZE |
| 12 | Glide pricing | 7 | Not started |
| 13 | Proposal builder | 8 | Not started |
| 14 | Commercial PaaS | Later | Not started |

---

## Six engines vs sidebar navigation

**Engines** = functional product domains (blueprint §3).  
**Navigation** = how users reach workflows — must map **to** engines, not replace them.

Current app sidebar (post IA fix):

| Sidebar group | Primary engine(s) |
| --- | --- |
| Ingestion | Foundation for all engines (historical migration) |
| Procurement | Opportunity + package registry |
| Contracts | Contract & Compliance |
| Intelligence | Pricing + Client/Competitor + Proposal (search) + partial Executive |
| Proposals | Opportunity (active pursuit) → Phase 8 workspace |
| System / Data model | Transparency + admin |

**Do not** confuse ingestion pipeline steps with the six engines. Ingestion **feeds** all engines.

---

## ChatGPT audit items — disposition

| Audit finding | Status in repo docs |
| --- | --- |
| Phase 2 mislabeled as RLS | ✅ Corrected in BUILD_PLAN, PRODUCT_SPEC, this file |
| Historical corpus should drive schema validation | ✅ HISTORICAL_PILOT.md; canonical Phase 2 NOT STARTED |
| Six engines blurred | ✅ PRODUCT_SPEC, MASTER_BLUEPRINT, MASTER locked header |
| Opportunity over-downgraded | ✅ MASTER_BLUEPRINT engine 1; opportunity fields = pilot-driven schema |
| Client = intelligence not CRM | ✅ PRODUCT_SPEC, DATA_ARCHITECTURE |
| Competitor/client first-class module | ✅ Engine 4; tables exist; UX early |
| Executive Analytics underplayed | ✅ Engine 6 in PRODUCT_SPEC; dashboards not built |
| Bid Strategy explicit | ✅ MASTER_BLUEPRINT §9; not yet a route/workspace |
| Google Docs handoff | ✅ PRODUCT_SPEC proposal output workflow |
| Drive → Storage vault deviation | ✅ MASTER_BLUEPRINT §2 + TECH_STACK |
| POC sidebar ≠ architecture | ✅ IA reconciled to workflows; six engines preserved in docs |
| Intelligence before pilot | ✅ KEEP + FREEZE in BUILD_PLAN / CURRENT_STATE_AUDIT |

---

## What to do next (strict order)

1. Finish [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md) open items (if any).  
2. Run [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md) — **Original Phase 2**.  
3. Only then: Original Phase 3 scale migration.  
4. Thaw frozen Intelligence UX when corpus exists.  
5. Original Phases 7–8 last (pricing workbench, proposal builder).
