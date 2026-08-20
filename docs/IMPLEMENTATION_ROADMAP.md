# Implementation roadmap

Index of phases. **Authoritative blueprint:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). **Phase naming:** [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md). Execute tasks in [BUILD_PLAN.md](BUILD_PLAN.md). Current state: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md). Pack: [CANONICAL_PRODUCT_PACK.md](CANONICAL_PRODUCT_PACK.md).

Do not reorder phases to create impressive screens earlier. **Legacy engineering phase numbers on migrations and acceptance files are not product maturity.**

---

## Current product position

**Phase 1 Foundation:** mostly built / needs hardening. Env + migrations still required for a working tenant.

**Phase 2 Real-Document Historical Pilot:** **ACTIVE NEXT — 0 packages through complete pipeline** (intake → verify → promote). Public queue: [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md).

**Next incomplete product phase:** Historical Pilot. Do not treat legacy engineering phases 7–11 as product-complete. Early pursuit/Ask/Intelligence UI shipped early — empty/unvalidated without packages.

Early Intelligence / Ask / Market / Reports surfaces are **early/partial** — do not expand as finished product before the pilot gap report. Reconcile IA to [UX_UI.md](UX_UI.md).

Living trail: [WORK_TRAIL.md](WORK_TRAIL.md).

---

## Canonical product phases (1–8 core)

| Phase | Name | Usable product outcome |
| --- | --- | --- |
| 1 | Foundation | App builds; org isolation; registry; staging; verification structure; Storage; Workflow skeleton; UX shell |
| 2 | Real-Document Historical Pilot | ~20–30 packages through trust pipeline; PILOT_GAP_REPORT |
| 3 | Historical Ingestion & Migration | Production ingest → verify → promote at corpus scale |
| 4 | Contract & Compliance Intelligence | Portfolio + Contract workspace (Service Plan / Commercial Terms / Changes / Renewal) |
| 5 | Buyer / Competitor / Market / Win-Loss | Evidence-backed cross-corpus intelligence |
| 6 | Search / Ask GPT / Reports / Automation | LOCATE vs ASK; reports; bounded automation |
| 7 | Pricing Intelligence | Glide workbench; four truths; human final price |
| 8 | Response Builder / Submission / Result | End-to-end proposal production without fabricated data |

**Core operational platform complete after Phase 8.**  
Optional commercialization (Stripe / selling to other tenants) is **not** a core product phase.

---

## Legacy engineering ID map

Keep these IDs on SQL migrations, npm scripts, and `PHASE*_ACCEPTANCE.md` filenames.

| Legacy ID | Name | Maps to canonical | Engineering status | Product maturity |
| --- | --- | --- | --- | --- |
| 0 | Docs in git | 1 | Done | — |
| 1 | Framework foundation | 1 | Done | Foundation partial |
| 2 | Schema / provenance / RLS | **1** (not pilot) | Done (48/48 RLS) | Foundation only |
| 3 | Intake + Workflow | 1 / 3 | Implemented | Unvalidated |
| 4 | Processor interfaces | 1 / 3 | Implemented | Unvalidated |
| 5 | Verification workbench | 1 / 3 | Implemented | Unvalidated |
| 6 | Pilot benchmarks | **2** | Fixtures only | Pilot not started |
| 7 | Four truths / promotion | 1 / 7 | Implemented | Unvalidated |
| 8 | Bulk migration | 3 | UI/RPC exists | No corpus |
| 9 | Contracts / renewals Cron | 4 | Early | Unvalidated |
| 10 | Win/loss / competitor | 5 | Early UX | Unvalidated |
| 11 | Hybrid RAG / Ask | 6 | Early UX | Unvalidated |
| 12 | Pricing Glide | 7 | Not Glide yet | Unvalidated |
| 13 | Proposal / Response | 8 | Shell only | Not complete |
| 14 | Commercialization | optional | Future | Not a core phase |

**RLS 48/48 = Phase 1 Foundation, not Phase 2.**
