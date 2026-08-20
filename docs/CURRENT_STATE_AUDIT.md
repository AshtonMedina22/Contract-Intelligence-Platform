# Current state audit

**Date:** 2026-08-19  
**HEAD (origin/main):** `ded2bee` (trail SHA stamp; feature Pass 3+4 is `547e16c`)  
**Vercel production build:** **green** on `main` after the login Partial Prerender fix (`8d083a5`); later commits including `213f951` and Pass 3+4 also targeted a successful web build. Live **tenant data** still requires env + applied SQL + sign-in.  
**Local product tree:** on origin  
**Living trail:** [WORK_TRAIL.md](WORK_TRAIL.md)  
**Purpose:** Canonical record of what exists today vs what the product must become. Read before implementing.

**Authoritative blueprint:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). **Phase naming:** [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md). **Phase 1 audit:** [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md).

Product definition: [PRODUCT_SPEC.md](PRODUCT_SPEC.md). Build order: [BUILD_PLAN.md](BUILD_PLAN.md).

---

## Phase status (original blueprint meanings)

| Original phase | Name | Status |
| --- | --- | --- |
| **1** | Foundation | **Mostly complete** — [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md) |
| **2** | Historical pilot (20–30 packages) | **NOT STARTED** — 0 L&P packages |
| **3** | Historical ingestion (scale) | **NOT STARTED** |
| **4–8** | Contracts → Analytics → Search → Pricing → Proposal | Partial code only; **unvalidated** |

**Wrong:** “Phase 2 complete because RLS 48/48 passed.” RLS = Foundation (Original Phase 1), not Historical Pilot.

---

## Canonical product position (repo naming)

| Canonical phase | Status |
| --- | --- |
| **1 — Foundation** | Mostly implemented; **Vercel production build green** after login fix; local build PASS |
| **2 — Historical Pilot** | **NOT STARTED** — 0 real L&P packages scored |
| **3 — Ingestion / processing** | Code exists; unproven on L&P |
| **4 — Broader migration** | RPC/UI exists; no corpus |
| **5 — Contracts / compliance** | Schema/UI early; unvalidated; rebid clone on main (needs corpus) |
| **6 — Market / buyer / competitor** | Thin UX; **KEEP + FREEZE** (empty-corpus banners only) |
| **7 — Search / Ask Intelligence** | FTS + Ask + optional `p_opportunity_id`; **KEEP + FREEZE**; corpus empty |
| **8 — Pricing intelligence** | Four-truth + planning cost model + comparables **panel** (not Glide) |
| **9 — Proposal builder** | Pursuit **workspace tabs** + competitor brief template (not section drafting) |

**Next correct product work:** apply opportunity migrations + Vercel env; **ingest public L&P packages** ([HISTORICAL_PILOT.md](HISTORICAL_PILOT.md)) — do not wait for internal files. Ops workspace UI is empty until those packages are verified.

---

## Classification summary

### Implemented + proven

- Org bootstrap `create_organization_with_admin` (SECURITY DEFINER RPC)
- RLS tenant isolation + composite same-org FKs
- `npm run test:phase2-rls` — **48/48** (tenancy/storage only; not product E2E)
- Evidence Storage path convention + append-only policies for `authenticated`
- `extracted_facts` defaults `AI_EXTRACTED`; `HUMAN_VERIFIED` requires verifier + timestamp
- Four-truth rate conflict detection in `promote_verified_fact` (acceptance script)

### Implemented but unvalidated

- Document intake + checksum + duplicate detection
- Vercel Workflow document lifecycle (+ inline fallback)
- Python processor (openpyxl XLSX, native PDF; OCR/DOCX **unwired**)
- Verification workbench + PDF.js source pane
- Four-truth `pricing_lines` + promotion RPCs
- Contracts / renewals / compliance schema + UI + pg_cron alerts
- Win/loss, competitors, competitor_bids, research_facts tables + list UIs
- `document_chunks` + `search_verified_knowledge` FTS RPC
- Bulk ingest RPCs + UI
- Routing policy v1.0.0 from **fixtures only** (0 L&P packages)
- Opportunity workspace (overview / requirements / staffing / pricing / docs / intel / contract)
- Pass 3+4 (staffing, evaluation criteria, comparables, rebid clone, competitor brief, packet rail, fulfillment economics) — **on main; SQL may be unapplied**

### Early / future-facing UX (KEEP + FREEZE)

- `/system/data-model` — table map + RFQ data flow (transparency; not a product engine)
- `/intelligence/ask`, `/intelligence/content` — verified FTS retrieval; not a chatbot
- `/intelligence/market` — document/entity counts; not canonical market facts
- `/intelligence/reports` — catalog cards; no PDF/export generator
- `/intelligence/win-loss`, `/intelligence/competitors`, `/intelligence/clients` — list views
- `/intelligence/pricing` — still thin; **do not expand Market/Ask/Reports product features**
- `/proposals` + `/procurement/opportunities/[id]` — **live workspace** (not a placeholder), but **unvalidated / empty corpus**
- Header search → always `/intelligence/ask` (no LOCATE path)

### Documented only

- Six engines as named product model (now in PRODUCT_SPEC; was missing)
- Purpose-aware retrieval (`LOSS_ANALYSIS` vs `PROPOSAL_DRAFTING`)
- LOCATE vs ASK global search
- Grounded report generators (Bid Strategy, Market, Competitor, Pricing, Win/Loss, Executive)
- Proposal sections at section level + reuse library
- `past_performance` attribution (corporate vs management vs key personnel vs sub)
- `solicitation_addenda`, `proposal_sections`, wage determinations, labor categories as live tables
- Google Docs working-proposal collaboration path (product spec; not wired)
- NL-SQL "Ask the Data"
- Federal/security procurement taxonomy as relational schema

### Not started

- Real 20–30 package Historical Pilot on L&P files
- Production OCR/DOCX paths
- Glide pricing workbench (planning cost model UI is **not** Glide)
- Tiptap proposal builder / section-level drafting
- Stripe / commercial PaaS (legacy Phase 14)
- Hosted apply of `20260820300000` + `20260820310000` + `20260820320000` (confirm in Supabase dashboard)

### Conflicting / obsolete (corrected in this reconciliation)

- "Phase 11 implemented → next Glide" as product maturity — **obsolete**
- Legacy engineering Phase 2 (RLS) treated as product Phase 2 — **corrected**
- BUILD_PLAN Phase 9: 32 days → 30-day bucket — **contradicted PHASE9** (32 → 60-day)
- README / DEVICE_SETUP implying production-ready — **corrected**

---

## Capability matrix

| Capability | Required end state | Code | Data/schema | UX | Docs (pre-audit) | Canonical phase | Gap / conflict | Required action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Six engines** | Named engines in PRODUCT_SPEC | Partial routes per engine | Partial tables | Mixed real/placeholder | Missing as model | 1–9 | Docs did not name engines | **Done:** PRODUCT_SPEC + MASTER |
| **Historical pilot** | 20–30 complete packages verified | Harness + routing fixtures | Staging ready | Intake + verify exist | Phase 6 = fixtures | **2** | **0 scored;** public queue opened | Ingest Grade A/B public docs |
| **Ingestion pipeline** | Upload → Storage → Workflow → stage | Implemented | Registry + staging | Intake, processing | Claimed done | 3 | Unproven on L&P | Validate in pilot |
| **Four truths** | requested ≠ proposed ≠ awarded ≠ current | `promote_verified_fact` | `pricing_lines` 4 columns | Opportunity package view | Present | 3 | Future tables missing | Pilot proves mappings |
| **Source precedence** | No silent overwrite; conflicts logged | RPC logic | `validation_exceptions` | Exceptions placeholder | SOURCE_PRECEDENCE.md | 3 | No addenda table | Add when pilot proves |
| **Human verification** | VERIFY/EDIT/REJECT + audit | Workbench + events | Full staging | PDF.js workbench | Present | 1/3 | Role matrix unused | Enforce roles later |
| **Ask Intelligence** | Grounded Q&A with citations | `search_verified_knowledge` | `document_chunks` | Ask + Content | Partial | 7 | No LLM synthesis; FTS only in UI | FREEZE; add purpose later |
| **LOCATE vs ASK** | Structured/FTS locate without LLM | No locate route | FTS exists | Header → Ask only | Missing | 7 | All search routes to Ask | Implement after pilot |
| **Market intelligence** | Evidence-backed trends | Count queries | win_loss, bids | Market tiles | Under-specified | 6 | Counts ≠ verified facts | FREEZE |
| **Competitor intelligence** | Sourced bids/scores | List UI | `competitor_bids` | Competitors page | Partial | 6 | No line-level pricing | Pilot + verify |
| **Reports** | Grounded PDF/export briefs | None | Counts only | Catalog cards | Missing generators | 6–7 | Placeholder UX | FREEZE |
| **Pricing intelligence** | Glide + evidence + human price | Cost model + comparables panel | `pricing_lines` + `pricing_cost_models` | Opportunity pricing tab | Phase 12 | 8 | Not Glide; no corpus | After pilot |
| **Pursuit workspace** | Ops coordinator: staffing, eval, four truths, intel | Tabs + Pass 3 forms | staffing/eval migrations | `/procurement/opportunities/[id]` | PRODUCT_SPEC journeys | 8–9 early | Empty; migrations unapplied | Apply SQL; fill via pilot |
| **Proposal reuse** | Section-level APPROVED/DO_NOT_USE | Chunk promotion | `reuse_status` enum | Content search | Partial | 9 | No proposal_sections | Phase 9 |
| **Google Docs workflow** | In-app → Docs → final output | None | N/A | None | One MASTER bullet | 9 | Docs-only | Spec in PRODUCT_SPEC |
| **Federal/security domain** | NAICS, PSC, wage, set-asides relational | None | Not in schema | N/A | Buried in MASTER | 3+ | Not first-class | Expand after pilot |
| **Wage/labor intelligence** | WD, categories, burden model | None | Docs-only tables | N/A | Long-term list | 8 | Not started | Phase 8 |
| **Past performance** | Corp ≠ mgmt ≠ key personnel ≠ sub | None | No table | N/A | MASTER §11 | 3+ | Safeguard docs-only | Add schema when needed |
| **Contracts/compliance** | Portfolio + 180…expired alerts | Implemented | Phase 9 tables | Portfolio UI | Overclaimed complete | 5 | Unvalidated | Pilot verifies |
| **CRM / client portal** | Must NOT exist | None | `clients` = buyer only | No portal | Correct intent | N/A | Naming "client" | Document buyer/agency |
| **Build / deploy** | Green production with live data | Build PASS locally; Vercel app loads | Env + migrations | Deployed | DEVICE_SETUP | 1 | Prod often no org; new SQL unapplied | Env + SQL |

---

## Intelligence audit

### Ask Intelligence

- **RPC:** `search_verified_knowledge(..., p_opportunity_id?)` — apply `20260820310000` on hosted DB
- **Enforced today:** `HUMAN_VERIFIED` only; org via RLS on `document_chunks`; drafting mode excludes `DO_NOT_USE`, `SUPERSEDED`, non-current versions
- **UI:** Always `p_for_drafting: true`; no query embeddings (FTS only); optional pursuit scope from `?opportunity=`
- **Missing:** retrieval purpose, outcome filter, LOCATE path, grounded synthesis, explicit org predicate in RPC; **corpus is empty**

### Market / competitor

- **Market page:** counts `documents`, `clients`, `competitors`, `win_loss_reviews`, `competitor_bids`, `contract_alerts` — not verified-only
- **Canonical facts:** `competitor_bids`, `research_facts`, `win_loss_reviews` when populated from verified promotion
- **Gap:** document counts presented alongside structured facts

### Reports

- **Real:** evidence count gate; links to live views
- **Placeholder:** no assembler, PDF, or export; cards are product catalog copy
- **Guardrails:** withhold message when zero chunks/reviews/bids

### Search (LOCATE vs ASK)

- **LOCATE:** not implemented as separate UX (no `/search`, no structured record lookup without Ask route)
- **ASK:** `/intelligence/ask` — verified chunk FTS retrieval with citations

---

## CRM / client portal audit

| Item | Present? |
| --- | --- |
| Lead management | **No** |
| Contact cadence / sales activities | **No** |
| Sales communications | **No** |
| Client-facing authentication | **No** |
| Client portal / customer self-service | **No** |
| Buyer/agency entity | **Yes** — `clients` table (minimal); procurement intelligence, not CRM |

Leftover Supabase starter `/protected` is tutorial residue, not a product portal.

---

## Build / deployment health

Recorded 2026-08-19 after foundation fixes:

| Check | Result |
| --- | --- |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** locally — `/auth/login` uses Suspense around cookie read (Partial Prerender) |
| Vercel production | **Build green** on `main` after login Suspense/`8d083a5`. Last functional check: sign-in / “No organization” without env. Apply opportunity SQL before Pass 3+4 tables exist in hosted DB. |

---

## Later features built early — disposition

| Surface | Action |
| --- | --- |
| Ask / Content search | **KEEP + FREEZE** |
| Market / Reports | **KEEP + FREEZE** |
| Win/Loss, Competitors, research | **KEEP + FREEZE** |
| Pricing, Proposals placeholders | **KEEP** — `/proposals` is now a real list; opportunity workspace is real UI, still unvalidated |
| Contracts UI | **KEEP + FREEZE expansion** |
| Intelligence shell (sidebar) | **KEEP** — do not remove |

---

## Legacy engineering → canonical mapping

| Legacy ID | Canonical product phase |
| --- | --- |
| 0–1 | 1 Foundation (docs, app scaffold) |
| 2 | 1 Foundation (RLS/tenancy — **not** Historical Pilot) |
| 3–5 | 1 Foundation + 3 Ingestion (code) |
| 6 | **2 Historical Pilot** |
| 7 | 3 Ingestion (promotion schema) |
| 8 | 4 Broader migration |
| 9 | 5 Contracts |
| 10 | 6 Market/buyer/competitor |
| 11 | 7 Search/Ask |
| 12 | 8 Pricing |
| 13 | 9 Proposal builder |
| 14 | Commercial PaaS |
