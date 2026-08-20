# Phase 1 foundation audit (original blueprint)

**Original Phase 1 — Foundation:** Supabase/Postgres, database schema, authentication/security, Google Drive references, document registry, staging/verification structure.

**Audit date:** 2026-08-19  
**Repo HEAD:** `ded2bee` on `main` (see `git log -1`). Foundation login/build issue closed as of `8d083a5` / `213f951`.  
**Verdict:** **Mostly complete** — sufficient to **begin Original Phase 2 (Historical Pilot)** after any open ⚠️ items are accepted or closed.

Cross-check: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) §13–14, [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md).

---

## Checklist

| # | Original Phase 1 requirement | Evidence | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Supabase project + PostgreSQL | Project `lhmurblikkcomdxcrymx`; migrations through legacy Phase 11 | ✅ | Engineering ahead of product validation |
| 2 | Multi-tenant schema (`organizations`, `memberships`, RLS) | `20260819100000_phase2_tenancy_provenance.sql`; `npm run test:phase2-rls` 48/48 | ✅ | **This is Foundation, NOT Historical Pilot** |
| 3 | Authentication / security | Supabase Auth; org bootstrap RPC; middleware session | ✅ | Operator login on Vercel after login Suspense fix |
| 4 | Document registry | `documents`, `document_versions`; `/procurement/documents` | ✅ | Shows `commercial_truth`, `document_type` |
| 5 | Staging structure | `extracted_facts`, `extraction_runs`, `source_evidence` | ✅ | Processor writes staging only |
| 6 | Human verification structure | Workbench, `verification_events`, statuses | ✅ | PDF.js pane; XLSX normalized view |
| 7 | Validation / exceptions on promotion | `validation_exceptions`; `promote_verified_fact` | ✅ | Exceptions page wired to table |
| 8 | Google Drive references | `source_drive_file_id`; import token in intake | ✅ | Drive not deleted on import |
| 9 | Evidence vault (approved deviation) | Supabase Storage immutable-by-policy path | ✅ | Documented vs original Drive-as-vault |
| 10 | Workflow orchestration (upgrade) | `document-lifecycle` Workflow + statuses | ✅ | Not in original one-pager |
| 11 | Python processing pipeline interface | `services/processor`; JobPort | ✅ | OCR/DOCX stubs unwired |
| 12 | Checksum + duplicate detection | SHA-256 before process; duplicate skip | ✅ | Phase 3 acceptance |
| 13 | Four-truth **schema** (minimal) | `pricing_lines` 4 columns; `commercial_truth` on documents | ✅ | **Pilot must prove on real packages** |
| 14 | Canonical promotion RPCs | Phase 7 SQL; identity + four-truth promotion | ✅ | Unvalidated on L&P corpus |
| 15 | Role storage (admin/importer/verifier/bidder/executive) | `memberships.role` enum | ⚠️ | Stored; not enforced in UI/workflows yet |
| 16 | Production build deployable | `npm run build` green; login Partial Prerender | ✅ | Verify Vercel after each push |
| 17 | Lint + typecheck | Pass locally (2026-08-19) | ✅ | |
| 18 | Honest phase documentation | MASTER_BLUEPRINT, PHASE_RECONCILIATION, this file | ✅ | This audit |

---

## Explicitly NOT Phase 1 (do not block pilot for these)

These belong to **Original Phase 2+** but exist as early engineering:

| Item | Original phase | Today |
| --- | --- | --- |
| 20–30 package pilot corpus | **Phase 2** | **0 packages** |
| Full opportunity fields (deadlines, go/no-go, $) | 2 validates schema | Ops metadata + rail/packet exist on main; **unvalidated**; still not a complete engine |
| Contracts portfolio operational | Phase 4 | Schema + UI early |
| Win/loss / competitor dashboards | Phase 5 | List views only |
| Embeddings + Ask Intelligence | Phase 6 | RPC + UI; empty corpus |
| Glide pricing workbench | Phase 7 | Not started |
| Proposal builder + Google Docs | Phase 8 | Placeholder |
| `proposal_sections`, cost model, pricing structures tables | 7–8 | Documented future in DATA_ARCHITECTURE |

---

## Gaps before Historical Pilot (Original Phase 2)

**Must have (Foundation):**

- [x] Ingest path: upload → Storage → registry → Workflow → staging  
- [x] Verification workbench usable on real files  
- [x] Promotion path to canonical tables  
- [ ] **Operator can run end-to-end on 1 package manually** (smoke test — do before scaling to 20–30)  
- [ ] Vercel production confirmed green after latest `main`  

**Should document before pilot:**

- [x] Phase naming reconciled (RLS ≠ Phase 2 pilot)  
- [x] Package manifest template in HISTORICAL_PILOT.md  
- [ ] L&P selects first 3 pilot packages (buyer + file list from Drive)  

**Must NOT do before pilot completes:**

- Expand Intelligence UX (Ask/Market/Reports) beyond FREEZE  
- Build proposal builder or Glide pricing  
- Add opportunity CRM fields without pilot evidence  

---

## Four truths verification (Foundation schema)

| Rule | Implemented? | Where |
| --- | --- | --- |
| Separate requested/proposed/awarded/current columns | ✅ | `pricing_lines` |
| Document tagged by commercial truth | ✅ | `documents.commercial_truth` |
| Promotion refuses silent overwrite | ✅ | `promote_verified_fact` → `validation_exceptions` |
| Requirements from requested sources only | ✅ | Promotion logic + SOURCE_PRECEDENCE |
| UI shows four columns on package | ✅ | `/procurement/opportunities/[id]` |
| Dynamic pricing **structure** per solicitation | ❌ | Future `pricing_structures` |
| L&P internal **cost model** | ❌ | Future Phase 7 tables |

---

## Recommendation

**Original Phase 1:** Accept as **mostly complete**.  
**Next task:** **Original Phase 2 — Historical Pilot** per [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md).

Do **not** interpret legacy engineering Phase 3–11 completion as permission to skip the pilot or build proposal/pricing UX first.
