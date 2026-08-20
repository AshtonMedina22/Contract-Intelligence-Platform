# Implementation roadmap

Index of phases. **Authoritative blueprint:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). **Phase naming:** [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md). Execute tasks in [BUILD_PLAN.md](BUILD_PLAN.md). Current state: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).

Do not reorder phases to create impressive screens earlier. **Legacy engineering phase numbers on migrations and acceptance files are not product maturity.**

---

## Current product position

**Foundation (canonical Phase 1 / Original Phase 1):** mostly built. Local lint/typecheck/build green. **Vercel production build green** after login Partial Prerender fix (`8d083a5` / `213f951`+). Env + migrations still required for a working tenant.

**Historical Pilot (canonical Phase 2 / Original Phase 2):** **NOT STARTED** — 0 real L&P packages scored.

**Next incomplete product phase:** Historical Pilot. Do not treat legacy engineering phases 7–11 as product-complete. Ops workspace UI shipped early — empty without packages.

Later Intelligence UX (Ask, Market, Reports) is **KEEP + FREEZE** until the pilot validates the corpus.

Living trail: [WORK_TRAIL.md](WORK_TRAIL.md).

---

## Canonical product phases

| Canonical phase | Name | Usable product outcome |
| --- | --- | --- |
| 1 | Foundation | App builds; org isolation; registry; staging; verification structure; Storage; Workflow skeleton |
| 2 | Historical Pilot | 20–30 complete L&P packages verified; routing locked from real evidence |
| 3 | Historical ingestion / processing | Production ingest → verify → promote loop proven on L&P |
| 4 | Broader historical migration | Controlled corpus batches with failure isolation |
| 5 | Contracts / compliance / renewals | Portfolio, renewals, compliance from verified data |
| 6 | Market / buyer / competitor intelligence | Evidence-backed win/loss, competitor, research |
| 7 | Search / RAG / Ask Intelligence | LOCATE vs ASK; purpose-aware verified retrieval |
| 8 | Pricing intelligence | Glide workbench; human final price |
| 9 | Proposal builder | Grounded drafts; Google Docs collab; procurement outputs |
| Later | Commercial PaaS | Stripe / tenant admin (legacy Phase 14) |

---

## Legacy engineering ID map

Keep these IDs on SQL migrations, npm scripts, and `PHASE*_ACCEPTANCE.md` filenames.

| Legacy ID | Name | Maps to canonical | Engineering status | Product maturity |
| --- | --- | --- | --- | --- |
| 0 | Docs in git | 1 | Done | — |
| 1 | Framework foundation | 1 | Done | Foundation partial |
| 2 | Schema / provenance / RLS | **1** (not pilot) | Done (48/48 RLS) | Foundation partial |
| 3 | Intake + Workflow | 1 / 3 | Implemented | Unvalidated |
| 4 | Processor interfaces | 1 / 3 | Implemented | Unvalidated |
| 5 | Verification workbench | 1 / 3 | Implemented | Unvalidated |
| 6 | Pilot benchmark | **2** | Fixtures only | **Not started** |
| 7 | Expand canonical schema | 3 | Implemented | Unvalidated |
| 8 | Bulk migration | 4 | Implemented | No corpus |
| 9 | Contracts / Cron | 5 | Implemented | Unvalidated |
| 10 | Win/loss intelligence | 6 | Implemented | Early UX; FREEZE |
| 11 | Hybrid RAG | 7 | Implemented | Early UX; FREEZE |
| 12 | Pricing intelligence | 8 | Early workbench (not Glide) | Unvalidated |
| 13 | Proposal builder | 9 | Workspace tabs, not builder | Unvalidated |
| 14 | Commercial | Later | Not started | — |

Passing a legacy acceptance script does **not** mean the corresponding canonical product phase is complete.

Execute using [BUILD_PLAN.md](BUILD_PLAN.md). Setup: [DEVICE_SETUP.md](DEVICE_SETUP.md).
