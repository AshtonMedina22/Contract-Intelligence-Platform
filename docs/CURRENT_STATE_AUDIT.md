# Current state audit — canonical product maturity snapshot

**Date context:** August 2026. Prompt 0A docs + Prompt 0B shell IA + VERIFY 0 + Prompt 1 Foundation gate + **P2 Data Ops productization** (2026-08-21).  
Living trail: [WORK_TRAIL.md](WORK_TRAIL.md). Blueprint: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). Pack: [CANONICAL_PRODUCT_PACK.md](CANONICAL_PRODUCT_PACK.md).

Purpose: distinguish what exists in code from what has been proven as a product. A route, table, migration, placeholder screen, or successful build does **not** equal phase completion.

---

## Canonical product position

| Phase | Status |
| --- | --- |
| **1 — Foundation** | **LOCAL EXIT GATE PROVEN (2026-08-20)** — production env still an ops blocker for live intake |
| **2 — Real-Document Historical Pilot** | VERIFY 2B PASS WITH NONBLOCKING GAPS + Prompt 2C schema + **VERIFY 2C PASS** ([VERIFY2C_ACCEPTANCE.md](pilot/VERIFY2C_ACCEPTANCE.md)). OCR/25MB/corpus-count deferred. |
| **3 — Historical Ingestion & Migration** | **PASS** — Prompt 3 + **VERIFY 3 PASS 26/26** ([VERIFY3_ACCEPTANCE.md](pilot/VERIFY3_ACCEPTANCE.md)). OCR live only with `MISTRAL_API_KEY`. |
| **4 — Contracts / Compliance** | Prompt 4 exit proven in app + acceptance; still thin vs large real awarded corpus |
| **5 — Buyer / Competitor / Market / Win-Loss** | **Prompt 5 exit proven** — still corpus-thin; no fabricated market share |
| **6 — Search / Ask / Reports / Automation** | EARLY/PARTIAL |
| **7 — Pricing Intelligence** | **PASS** (Prompt 7 + VERIFY 7) |
| **8 — Response Builder / Submission / Result** | **PASS** (Prompt 8 + VERIFY 8) |

The product remains in the transition from Foundation into the real-document Historical Pilot. That is the honest current maturity position.

---

## Phase notes

### Phase 1 — Foundation

**Proven locally (Prompt 1):** Auth + organizations/memberships + `organization_id` RLS (48/48 including Storage isolation and same-org integrity); SHA-256 registry/versions; batches; extraction runs; staging facts default `AI_EXTRACTED`; append-only source evidence; verification events; validation exceptions; Zod/Pydantic contracts; Vercel Workflow + JobPort; FastAPI processor (9 pytest); PDF review workbench; lint/typecheck/build. See [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md). Role enum is stored but not enforced in UI — not a tenancy hole. **Do not treat this as Historical Pilot completion.**

### Phase 2 — Real-Document Historical Pilot

A public-first L&P corpus strategy has been opened because the complete private historical library is not yet available. The correct next proof is **real L&P procurement evidence**, not more fixture/demo expansion.

Queue / verified primary sources (not yet ingested): [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md), [pilot/PUBLIC_PACKAGE_QUEUE.md](pilot/PUBLIC_PACKAGE_QUEUE.md).

Until a package completes source preservation → extraction → staging → validation → human verification → canonical promotion, it is **not** counted as a verified historical package. VERIFY 2B records **7 A/B** packages through that path with nonblocking gaps; Prompt **2C** expanded schema only where [PILOT_GAP_REPORT.md](benchmarks/PILOT_GAP_REPORT.md) proved need. Exit target ~20–30 packages remains unmet.

### Phase 3 — Historical Ingestion / Migration

Intake, checksum/versioning, parsing/extraction, staging, verification, and bulk-oriented pieces may exist, but must be validated and revised using the real-document pilot before being called production-ready.

### Phase 4 — Contracts / Compliance

**Canonical Phase 4 exit (Prompt 4):** Portfolio + Renewals + Compliance secondary nav; Contract workspace Overview | Service Plan | Commercial Terms | Changes | Renewal wired to verified tables (`contract_service_plans`, POs, federal IDs, amendments, alerts, compliance). Alert buckets 180/120/90/60/30/EXPIRED from `verified_end_on` only. See [PHASE4_ACCEPTANCE.md](PHASE4_ACCEPTANCE.md). Still corpus-thin for real awarded instruments — never fabricate absent terms.

### Phase 5 — Intelligence

**Canonical Phase 5 exit (Prompt 5):** Global Intelligence Buyers | Competitors | Market | Pricing | Win/Loss | Content | Reports wired to verified tables. Buyers = procurement portfolio (not CRM). Market tiles exclude document counts. Content shows reuse `APPROVED | REVIEW_REQUIRED | DO_NOT_USE | SUPERSEDED`. Pursuit Overview surfaces the cross-corpus summary — as of P5 that lives in its Buyer intelligence and Competitive intelligence sections rather than a standalone panel. See [PHASE5_INTELLIGENCE_ACCEPTANCE.md](PHASE5_INTELLIGENCE_ACCEPTANCE.md). Still corpus-thin — never invent share or causation.

### Phase 6 — Search / Ask / Reports / Automation

**Canonical Phase 6 exit (Prompt 6):** Header `[Find or Ask GPT...]` with LOCATE | ASK/ANALYZE | REPORT. Purpose-aware hybrid retrieval (SQL/FTS/pgvector); eight report generators; Answer/Sources/Data Scope/Limitations/View Source contract; `automation_events` via Supabase pg_cron + Vercel Cron digest; human gates never bypassed. See [PHASE6_ASK_REPORTS_AUTOMATION_ACCEPTANCE.md](PHASE6_ASK_REPORTS_AUTOMATION_ACCEPTANCE.md). Still corpus-thin — insufficient evidence returns the canonical refusal sentence.

### Phase 7 — Pricing

**Canonical Phase 7 exit (Prompt 7):** Pursuit → Pricing Glide workbench with five truths (requested / internal cost / submitted / awarded / current), dynamic structure grain, cost model, include/exclude comparables with reasons, observed range + cost floor + target-margin threshold + confidence, and human-required final bid (`pricing_decisions`). Intelligence → Pricing is cross-corpus only and points operators back to the Pursuit workbench for live bids. See [PHASE7_PRICING_ACCEPTANCE.md](PHASE7_PRICING_ACCEPTANCE.md).

**VERIFY 7:** **PASS** (29/29). Blank comparable reasons rejected at DB; Glide five-truth matrix exposes per-truth `source_fact` verification links. See [VERIFY7_ACCEPTANCE.md](pilot/VERIFY7_ACCEPTANCE.md).

### Phase 8 — Response / Submission / Result

**Canonical Phase 8 exit (Prompt 8):** Pursuit-central Requirements matrix → Tiptap Response workspace (left/center/right) with evidence states, reuse gates (DO_NOT_USE blocked for drafting), progress counters, configurable approvals, submission packet/checklist/exports, result capture (incl. NO_AWARD), contract-on-win, Intelligence revalidation. No global Proposal app. See [PHASE8_RESPONSE_ACCEPTANCE.md](PHASE8_RESPONSE_ACCEPTANCE.md). Still corpus-thin for rich grounded drafts.

**VERIFY 8:** **PASS** (23/23). End-to-end pre-award flow on Arlington/Lottery-shaped package; steps 1–22 all PASS. See [VERIFY8_ACCEPTANCE.md](pilot/VERIFY8_ACCEPTANCE.md).

---

## Current correct next work

1. Grow verified historical corpus (~20–30 packages) — live org now **22 packages / 15 A/B harness-complete**; lower bound met.  
2. Confirm Vercel prod processor + set `ASK_MODEL` / `MISTRAL_API_KEY` as needed.  
3. Keep [WORK_TRAIL.md](WORK_TRAIL.md) honest.  

**P2 productization (2026-08-21):** Data Ops hardening complete. Intake UX preflight validation, processing queue lifecycle_error badges/filters, OCR_REQUIRED semantics, re-extract guard for HUMAN_VERIFIED facts, verification workbench keyboard/optimistic/auto-advance, exceptions disposition notes, corpus funnel report script. See [P2_REAL_CORPUS_DATA_OPS_ACCEPTANCE.md](productization/P2_REAL_CORPUS_DATA_OPS_ACCEPTANCE.md).

**P4 productization (2026-08-21):** Public opportunity discovery complete. Pursuits gained Discover | Watchlist | Active | Submitted | Closed tabs; `public_sources` table with RLS; SAM.gov adapter (live with `SAM_GOV_API_KEY`, otherwise clearly labeled `FIXTURE-SAM-*` sample data with an honesty banner); Watch / Dismiss / Start pursuit. Discovery results are **not persisted on view**, public notice facts land **`AI_EXTRACTED`** only, and there is **no AI fit score**. Starting a pursuit does not ingest the solicitation — documents and verified truth still come from Data Ops. **The live SAM.gov request path has never been exercised against a real response.** Fixture notices are sample data and count toward nothing in the Historical Pilot. See [P4_OPPORTUNITY_DISCOVERY_ACCEPTANCE.md](productization/P4_OPPORTUNITY_DISCOVERY_ACCEPTANCE.md).

**P5 productization (2026-08-21):** Pursuit Overview + Bid Strategy complete. The Overview is now eleven read-first sections (solicitation summary, scope, how this is scored, bid/no-bid, buyer, competitive, prior L&P experience, compliance readiness, risks, bid strategy, next actions) composed from one RLS-scoped bundle; pricing planning and the metadata form are demoted into collapsed blocks. **No schema change, no new pursuit tab, no LLM call, no LangGraph.** Bid strategy is a pure function over this pursuit's own rows: every bullet carries an openable citation, absent evidence produces a named withheld line, and zero bullets returns **INSUFFICIENT** rather than a thinner answer. No score, win rate, market share, probability, or causal claim is generated; **the incumbent is never inferred** — an award row with a null winner says so. Bid/no-bid stays a human decision the platform records and never sets. Compliance readiness is honestly **Unknown** pre-award because `compliance_items` hang off contracts, not pursuits. See [P5_PURSUIT_STRATEGY_ACCEPTANCE.md](productization/P5_PURSUIT_STRATEGY_ACCEPTANCE.md).

**P3 productization (2026-08-21):** Executive Home + Action Center complete. Replaced `/overview` with owner command center: KPI strip (10 real metrics), Needs Attention queue, Pipeline table, Win/Loss snapshot, Contract alerts by bucket, Market intelligence. All RLS-scoped queries; no fake metrics; honest empty states. See [P3_EXECUTIVE_HOME_ACCEPTANCE.md](productization/P3_EXECUTIVE_HOME_ACCEPTANCE.md).

**Prompt 9 / VERIFY 9 (2026-08-20):** Fix pass → **READY WITH NONBLOCKING LIMITATIONS**. Deferred: corpus acquisition ~20–30, Vercel login + prod processor, `ASK_MODEL`. See [VERIFY9_ACCEPTANCE.md](pilot/VERIFY9_ACCEPTANCE.md).

---

## Known product / UX reconciliation required

**Final IA:**

- Global = Home | Pursuits | Intelligence | Contracts | Data Ops | Settings  
- Pursuit = Overview | Requirements | Pricing | Response | Submission | Result  
- Contract = Overview | Service Plan | Commercial Terms | Changes | Renewal  
- Intelligence = Buyers | Competitors | Market | Pricing | Win/Loss | Content | Reports  
- Data Ops = Intake | Processing | Verification | Exceptions | Historical Migration  
- Ask GPT = persistent global header capability  

Any older navigation that exposes Ingestion, Proposals, Data Quality, Requirements, Pricing, Renewals, Compliance, Buyers, Market, Reports, etc. as **unrelated peer global modules** must be reorganized rather than treated as canonical IA.

**Code today (P1 UX Foundation):** authenticated shell matches canonical IA — global **Home | Pursuits | Intelligence | Contracts | Data Ops** as **five single sidebar links** (Intelligence/Data Ops no longer expandable submenus) with Settings in the footer; Ask GPT in the header; Pursuit tabs **Overview | Requirements | Pricing | Response | Submission | Result**; Contract tabs **Overview | Service Plan | Commercial Terms | Changes | Renewal**; horizontal section tabs appear **after entering** Intelligence or Data Ops. Shell primitives: `PageHeader`, `WorkspaceHeader`, `EmptyState`, `CollectionPage` under `components/shell/`. CONTRACTS_TABS demoted Renewals/Compliance (pages still work via breadcrumb back to Portfolio). Legacy URLs (`/proposals`, `/ingestion/*`) remain as remounts/redirects, not peer global apps. Intelligence / Ask / Response surfaces stay **early/partial / unvalidated** until the Historical Pilot.

---

## Implemented / proven vs unvalidated labels

- **IMPLEMENTED + PROVEN** — passed relevant tests and proven on the intended real workflow/data  
- **IMPLEMENTED, UNVALIDATED** — code exists but has not been proven on the target corpus/workflow  
- **PARTIAL** — meaningful pieces exist but the end-to-end capability is incomplete  
- **DOCUMENTED ONLY** — specified but not built  
- **NOT STARTED** — no meaningful implementation  

---

## Non-negotiable audit warnings

- RLS/tenancy success is Foundation, not completion of the Historical Pilot.  
- A green build does not prove procurement correctness.  
- A parser that works on fixtures does not prove real L&P extraction quality.  
- A table/route does not prove a business capability.  
- A dashboard with empty/fake numbers is not intelligence.  
- An FTS result page is not the finished Ask GPT experience.  
- A planning pricing panel is not the finished Glide pricing workbench.  
- An opportunity/proposal shell is not the finished Response Builder.  
- Public non-L&P documents may validate document types, but they are **test corpus**, not L&P historical truth.  

---

## Ops / environment blockers (still true)

1. Confirm Vercel env + signed-in org for real intake.  
2. Processor running for parse → `extracted_facts`.  
3. Allen full board packet (~32 MB) is within the **50 MB** intake limit when the local file is present; re-ingest when Downloads corpus is restored. 

Opportunity migrations `20260820300000` / `310000` / `320000` plus VERIFY 1 hardening `20260820400000` were applied to remote Postgres on 2026-08-20. Migrations `20260821160000`, `20260821170000`, and P4 `20260821180000_p4_public_opportunity_discovery` were applied on 2026-08-21.  

Detail: [WORK_TRAIL.md](WORK_TRAIL.md).
