# Prompt 2C — Pilot-proven schema expansion

**Date:** 2026-08-20  
**Migrations:**
- `supabase/migrations/20260820500000_prompt2c_pilot_schema.sql`
- `supabase/migrations/20260820510000_prompt2c_promote_pricing_grain.sql` (align `promote_verified_fact` ON CONFLICT with rate_type + site grain)
- `supabase/migrations/20260820520000_verify2c_schema_gap_fixes.sql` (VERIFY 2C gap close: provenance, no rate duplication, amendment grain)
**Evidence authority:** [PILOT_GAP_REPORT.md](benchmarks/PILOT_GAP_REPORT.md)

Only structures justified by real-document pilot findings were added. Existing tenancy, RLS, provenance, verification, four commercial truths, and audit tables were preserved.

---

## Schema changes

### New tables

| Table | Pilot evidence |
| --- | --- |
| `procurement_packages` | Manifest PKG-01..13; package is the core data unit ([DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md)); `corpus_class` A/B/C |
| `solicitation_addenda` | PKG-03 SRC-06 — “22-0143 Addendum 1” |
| `required_forms` | PKG-06 Lottery IFB — forms / HUB / references / cost sheet |
| `evaluation_scores` | PKG-03 SRC-07 — L&P 70.48 vs VSA 90.46 |
| `competitor_pricing_lines` | PKG-05 Jefferson multi-vendor tab (L&P $18.75); PKG-07/10 C tabs — separate from L&P four-truth lines |
| `cost_build_components` | PKG-09 Tarrant wage/FICA/WC/OH/profit stack |
| `purchase_orders` | PKG-04 TxDMV PO 0000016167 |
| `purchase_order_lines` | PKG-04 — 72 HR × $33.25; Extended Hours $445.55 |
| `proposal_sections` | PKG-01 Williamson proposal sections + source page |
| `federal_identifiers` | PKG-01/04 TXMAS-24-99003; GSA 47QSWA22D008W |
| `contract_service_plans` | PKG-02 Allen / PKG-12 TFC Level II vs III sites |

### Altered existing

| Change | Pilot evidence |
| --- | --- |
| `documents.procurement_package_id` | Link versions into packages |
| `requirements.mandatory`, `section_ref` | PKG-06 mandatory forms/reqs |
| `pricing_lines.rate_type`, `site_or_post`, `unit`, `quantity`, `extended_amount` | PKG-01 golf cart; PKG-05 site tabs; PKG-10 OT/holiday |
| `pricing_lines` unique → include rate_type + site | Same |
| `awards.amount_nte`, `winner_name`, `rank` | PKG-03 award $960,343 |
| `staffing_requirements.site_name`, `building`, `guard_classification`, `schedule_note` | PKG-03 building/post matrix |
| `renewals.escalation_index`, `escalation_pct`, `option_year` | PKG-11 Harris CPI-W |
| `competitor_bids.rank` | Outcome summary only — hourly rates live on `competitor_pricing_lines` |
| `opportunity_outcome` + `NO_AWARD` | PKG-05 all bids rejected |
| `contract_amendments.amendment_number`, `title` | PKG-12 Amend 4 / PKG-13 (existing table enriched) |
| `required_forms.source_document_id` | PKG-06 document provenance |
| Enums `corpus_class`, `pricing_rate_type` | Classification + rate grain |

### Preserved (unchanged contracts)

organizations/memberships · RLS · tenant composite FKs · `extracted_facts` / `source_evidence` / `verification_events` · `document_versions` · four-truth columns on `pricing_lines` · promote precedence RPCs · audit history

---

## Intentionally deferred

| Concept | Why deferred |
| --- | --- |
| `solicitation_q_and_a` | No discrete Q&A PDF in USABLE corpus (regex-only “present”) |
| `requirement_responses` / `submission_items` | No L&P submission packet beyond SRC-01 sections |
| `wage_determinations` | Not on acquired instruments as structured evidence |
| `proposals` / `proposal_versions` tables | SRC-01 is bound contract+proposal; `proposal_sections` sufficient |
| `past_performance` | Not extracted / not in gap blocking list as a table |
| Separate `schedules` table | Covered as `schedule_note` on staffing / service plans |
| OCR / 25 MB intake | Ops/parser — not schema |
| Standalone XLSX workbook tables | No XLSX acquired (HUNT-06) |

---

## Tests (2026-08-20 — VERIFY 2C fix pass)

| Suite | Result |
| --- | --- |
| `supabase db push` (2C + VERIFY fix migrations) | Applied |
| `npm run test:verify2c` | **65/65 PASS** |
| `npm run test:phase2c-schema` | **17/17 PASS** |
| `npm run test:phase2-rls` | **48/48 PASS** |
| `npm run test:phase7-four-truth` | **10/10 PASS** |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build -w web` | PASS |

Types: `apps/web/lib/supabase/database.types.ts` updated (`CorpusClass`, `PricingRateType`, new tables/columns; competitor_bids rate columns removed).
