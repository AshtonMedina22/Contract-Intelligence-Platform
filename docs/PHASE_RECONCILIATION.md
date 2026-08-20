# Phase reconciliation — product phases vs legacy engineering IDs

**Purpose:** Stop phase-label confusion. Product maturity uses the Canonical Product Pack’s **eight core phases**. Legacy engineering IDs stay on migrations and `PHASE*_ACCEPTANCE.md`.

Read with: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md), [BUILD_PLAN.md](BUILD_PLAN.md), [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md), [CANONICAL_PRODUCT_PACK.md](CANONICAL_PRODUCT_PACK.md).

---

## The error we corrected

| Wrong (do not say) | Correct |
| --- | --- |
| “Legacy/engineering Phase 2 complete = product ready for intake at scale” | Engineering Phase 2 = **RLS/tenancy** = **Product Phase 1 (Foundation)** |
| “Phase 1 done, Phase 2 done, ready for Phase 3” | Phase 1 mostly done; **Phase 2 Historical Pilot NOT STARTED (0 packages through complete pipeline)** |
| “RLS 48/48 = Historical Pilot complete” | RLS proves Foundation only |
| “Canonical phases 1–9” / “Phase 9 = Proposal builder” | Core product phases are **1–8**; Response/Submission/Result is **Phase 8**. Commercialization is **optional**, not a numbered core phase |
| “Later Commercial PaaS is a product phase” | Optional future commercialization — **not** part of core product build |

---

## Canonical product phases (pack — use for maturity)

| Phase | Name | Done when |
| --- | --- | --- |
| 1 | Foundation | Tenant isolation, evidence vault, staging/verification structure, Workflow/processor interfaces, UX shell foundation |
| 2 | **Real-Document Historical Pilot** | ~20–30 real packages through source → verify → promote; PILOT_GAP_REPORT actionable |
| 3 | Historical Ingestion & Migration | Production ingest + batch migration at corpus scale |
| 4 | Contract & Compliance Intelligence | Contract workspace Overview/Service Plan/Commercial Terms/Changes/Renewal from verified data |
| 5 | Buyer / Competitor / Market / Win-Loss | Cross-corpus intelligence from canonical verified records |
| 6 | Search / Ask GPT / Reports / Automation | LOCATE + ASK + reports + bounded automation |
| 7 | Pricing Intelligence | Glide workbench; four truths; human final price |
| 8 | Response Builder / Submission / Result | End-to-end pursuit proposal production without fabricated data |

**Core operational platform is complete after Phase 8.**

Optional commercialization (Stripe / selling to other contracting companies) is **not** a core phase. Architecture is **multi-tenant-ready from day one**; that is not the same as “build a PaaS product phase.”

---

## Engine names (canonical)

1. Opportunity / Solicitation Intelligence  
2. Contract & Compliance Intelligence  
3. Pricing Intelligence  
4. Buyer / Market / Competitor Intelligence  
5. Proposal / Response Intelligence  
6. Executive / Business Intelligence  

Do not use outdated labels like “Client / Competitor” or “Executive Analytics” as product engine names.

---

## Legacy engineering IDs (keep filenames; do not rename)

Legacy phases 0–14 on migrations and acceptance scripts map **into** Foundation through early Intelligence/Pricing/Proposal **code**, not product completion. Passing `test:phase2-rls` ≠ Historical Pilot.

Early Intelligence / Ask / Market / Reports UI may exist. Prefer pack language: they are **early/partial / unvalidated** — do not expand as finished product before the pilot proves the data foundation. Do not treat “KEEP + FREEZE” as an alternate phase system; reconcile to canonical IA ([UX_UI.md](UX_UI.md)).

---

## Navigation note

Canonical IA: **Home | Pursuits | Intelligence | Contracts | Data Ops | Settings.**  
Ask GPT = header capability.  
Older peer modules (Ingestion, Proposals as global peers, etc.) are **to reconcile**, not product truth.
