# VERIFY 2C — Schema acceptance

**Phase:** Canonical Phase 2 — post-pilot schema expansion  
**Audit date:** 2026-08-20 (fix pass)  
**Evidence authority:** [PILOT_GAP_REPORT.md](../benchmarks/PILOT_GAP_REPORT.md)  
**Migrations audited:**
- `20260820500000_prompt2c_pilot_schema.sql`
- `20260820510000_prompt2c_promote_pricing_grain.sql`
- `20260820520000_verify2c_schema_gap_fixes.sql`  
**Command:** `npm run test:verify2c`

---

## Verdict

**PASS**

All prior nonblocking VERIFY 2C gaps are closed. Every Prompt 2C table/column maps to pilot evidence. Tenancy, RLS, same-org FKs, provenance, four commercial truths, and non-duplicated competitor rate ownership hold under re-run acceptance.

**2026-08-20 Prompt 9 note:** Phase 8 mandated `requirement_responses`. VERIFY 2C no longer treats that table as forbidden; it asserts Phase 8 presence + `organization_id` (**66/66**).

---

## PASS / FAIL by schema domain

| Domain | Result | What was checked |
| --- | --- | --- |
| **Package / corpus** | **PASS** | `procurement_packages` + `corpus_class` A/B/C; `documents.procurement_package_id` same-org FK |
| **Solicitation** | **PASS** | `solicitation_addenda` (PKG-03); `required_forms` + `requirements.mandatory/section_ref` (PKG-06); no `solicitation_q_and_a` |
| **Scope / staffing** | **PASS** | `staffing_requirements` site/building/classification/schedule (PKG-03); no separate theoretical `schedules` / `staffing_posts` tables |
| **Pricing / four truths** | **PASS** | `pricing_lines` rate_type + site grain; four rate columns distinct; promote ON CONFLICT aligned; competitor lines separate from L&P truths |
| **Cost build** | **PASS** | `cost_build_components` (PKG-09) |
| **Proposal / response** | **PASS** | `proposal_sections` + `source_page` (PKG-01); no `proposal_versions` / `requirement_responses` |
| **Result / award** | **PASS** | `evaluation_scores` (PKG-03); `awards` amount_nte/winner/rank; `NO_AWARD` outcome (PKG-05) |
| **Contract / instruments** | **PASS** | `purchase_orders` + lines (PKG-04); `contract_service_plans` (PKG-02/12); `renewals` CPI (PKG-11); `contract_amendments` amendment_number/title (PKG-12/13) |
| **Identifiers** | **PASS** | `federal_identifiers` TXMAS/GSA (PKG-01/04) |
| **Tenancy / RLS / integrity** | **PASS** | All new tables `organization_id` + RLS; cross-tenant insert/select blocked; composite same-org FKs |
| **Provenance** | **PASS** | Canonical tables keep `source_fact_id` + `source_document_id` (incl. `required_forms`); proposal sections keep `source_page` |
| **Duplication ownership** | **PASS** | `competitor_bids` = outcome summary only; hourly/OT/holiday live solely on `competitor_pricing_lines` |

---

## Flag audit (required checklist)

| Flag | Finding | Severity |
| --- | --- | --- |
| Theoretical tables with no pilot evidence | **None created.** Deferred absences verified. | — |
| Duplicated entities | **Closed.** Dropped `competitor_bids.hourly_rate` / `rate_type`. Line rates only on `competitor_pricing_lines`. | — |
| Four-truth collapse | **Not found.** | — |
| Missing tenant ownership | **Not found.** | — |
| Missing RLS | **Not found.** | — |
| Weak same-org foreign keys | **Not found.** | — |
| Provenance lost during normalization | **Closed.** `required_forms.source_document_id` added with same-org FK. | — |
| UI-driven rather than evidence-driven | **Closed.** `contract_service_plans` comment is evidence-only (PKG-02/12). | — |

---

## Fixes applied (this pass)

| Gap | Root cause | Fix |
| --- | --- | --- |
| `required_forms` fact-only provenance | Column omitted in 2C migration | Add `source_document_id` + same-org FK |
| Competitor rate duplication | 2C enriched `competitor_bids` with hourly/rate_type overlapping tab lines | Drop those columns; keep `quoted_amount` + `rank` on bids |
| “No amendments table” | Audit missed existing `contract_amendments` (phase9); grain too thin for PKG-12 Amend 4 | Enrich `amendment_number` + `title`; assert in VERIFY 2C |
| UI-driven comment smell | Migration comment mentioned “service-plan UX” | Replace with PKG-02/12 evidence comment |

---

## Intentionally deferred (later/external — not schema blockers)

| Item | Why deferred |
| --- | --- |
| OCR / 25 MB intake | Ops/parser — not schema (SRC-03, SRC-19) |
| XLSX cell provenance | No XLSX acquired |
| `solicitation_q_and_a`, `wage_determinations`, `past_performance`, `proposal_versions`, standalone `schedules` | No discrete structured pilot mandate as first-class tables |
| `requirement_responses` | **No longer deferred** — Phase 8 (Prompt 8) mandated Response drafts; VERIFY 2C asserts presence |

---

## Test evidence (fix pass)

```text
supabase db push — 20260820520000_verify2c_schema_gap_fixes.sql applied
npm run test:verify2c           65/65 PASS
npm run test:phase2c-schema     17/17 PASS
npm run test:phase2-rls         48/48 PASS
npm run test:phase7-four-truth  10/10 PASS
npm run typecheck               PASS
npm run lint                    PASS
npm run build -w web            PASS
```

---

## STOP

No Phase 3 work. Schema acceptance for VERIFY 2C is complete.
