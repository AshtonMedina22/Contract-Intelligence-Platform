# Document → table mapping

**Authority:** code in `apps/web/lib/data-model/document-table-map.ts` + Settings → Data model.  
**Product end-state:** [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md) §§11–17, [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md).  
**Pilot schema:** [PHASE2C_SCHEMA.md](PHASE2C_SCHEMA.md).

This file is the operator/agent-facing map from **source document kinds** to **Postgres tables** the finished platform needs. It does **not** invent tables ahead of evidence — statuses mark what is live vs schema-ready vs deferred.

---

## Lifecycle (required order)

```text
document (typed + commercial_truth + procurement_package)
  → extracted_facts (staging)
  → HUMAN_VERIFIED
  → promote_verified_fact
  → promote_contract_from_fact
  → promote_intelligence_from_fact
  → promote_knowledge_chunk_from_fact
  → product surfaces (Pursuits / Contracts / Intelligence / Ask)
```

Verification workbench already runs the full chain. Pilot harness must match (not `promote_verified_fact` alone).

---

## Four commercial truths

| Truth | Document kinds (examples) | Primary columns / tables |
| --- | --- | --- |
| **requested** | RFP / RFQ / IFB / addendum / Q&A | `pricing_lines.requested_rate`, `requirements`, `solicitations` |
| **proposed** | L&P proposal / quote / pricing workbook | `pricing_lines.proposed_rate`, `proposal_sections` |
| **awarded** | Award / PO / bid tab / executed contract | `pricing_lines.awarded_rate`, `awards`, `purchase_orders`, `contracts` |
| **current** | Amendment / option / renewal | `pricing_lines.current_rate`, `contract_amendments`, `renewals` |

Never collapse these into one rate field.

---

## Document kind → tables (summary)

| Document kind | Truth | Promote RPCs | Target tables | Status |
| --- | --- | --- | --- | --- |
| Solicitation (RFP/RFQ/IFB) | requested | verified + chunk | solicitations, requirements, required_forms, pricing_lines | partial |
| Addendum / Q&A | requested | verified + chunk | solicitation_addenda, requirements | schema_ready |
| Proposal / quote | proposed | verified + contract + chunk | pricing_lines, proposal_sections, federal_identifiers | partial |
| Award / board / staff report | awarded | verified + intel + chunk | awards, evaluation_scores, pricing_lines, win_loss_reviews | partial |
| Bid tab / tabulation | awarded | verified + intel + chunk | pricing_lines (L&P), competitor_pricing_lines, competitor_bids | partial |
| Purchase order | awarded | verified + contract + chunk | purchase_orders, purchase_order_lines, pricing_lines | partial |
| Contract / agreement | awarded | verified + contract + chunk | contracts, contract_service_plans, federal_identifiers | partial |
| Amendment | current | contract + chunk | contract_amendments, pricing_lines | partial |
| Renewal / option | current | contract + chunk | renewals, contract_options | schema_ready |
| Cost build / workbook | awarded (comp) | intel + chunk | cost_build_components, competitor_pricing_lines | schema_ready |
| Scorecard / synopsis | awarded | intel + chunk | evaluation_scores, evaluation_criteria, win_loss_reviews | schema_ready |

Full typed rows: `DOCUMENT_TABLE_MAP` in `document-table-map.ts`.

---

## Pilot packages → corpus class

| Package | Class | Buyer | SRC IDs |
| --- | --- | --- | --- |
| PKG-01 | A | Williamson County | SRC-01 |
| PKG-02 | A | Allen ISD | SRC-02, SRC-03 |
| PKG-03 | B | Arlington TX | SRC-06, SRC-07 |
| PKG-04 | A | TxDMV | SRC-04 |
| PKG-05 | B | Jefferson County | SRC-08 |
| PKG-06 | B | Texas Lottery | SRC-09 |
| PKG-07…13 | C | Dallas / Tarrant / MHMR / Harris / TFC / Arlington VA | SRC-10…19 |

**Class C** may populate intelligence / coverage tables. It must **never** be labeled L&P historical truth.

Every ingested pilot file must set `documents.procurement_package_id` → `procurement_packages.package_key`.

---

## Staging fact fields → promote targets

| Fact field / entity | RPC | Table |
| --- | --- | --- |
| `requirement` | promote_verified_fact | `requirements` |
| `solicitation_number` | promote_verified_fact | `solicitations` |
| `*_rate` (hourly) | promote_verified_fact | `pricing_lines` (truth column) |
| `award` | promote_verified_fact | `awards` |
| `po_number`, `payment_terms` | promote_contract_from_fact | `purchase_orders` |
| `contract_*`, `site_name`, `amendment_*`, `txmas`/`gsa` | promote_contract_from_fact | contracts / service plans / amendments / federal_identifiers |
| `competitor_price`, `competitor_name` | promote_intelligence_from_fact | `competitors`, `competitor_bids`, `competitor_pricing_lines` |
| `outcome`, `documented_reason`, `lp_price` | promote_intelligence_from_fact | `win_loss_reviews` |
| any HUMAN_VERIFIED | promote_knowledge_chunk_from_fact | `document_chunks` |

---

## Desired end-state vs live (honest)

| End-state concept | Live table? | Blocker |
| --- | --- | --- |
| Package as core unit | `procurement_packages` YES | Must be linked on intake (was 0 until backfill) |
| Q&A clarifications | deferred | No discrete Q&A PDF in USABLE corpus |
| Wage determinations | deferred | No structured WD evidence acquired |
| Standalone XLSX workbook | deferred | HUNT-06 unavailable |
| proposals / proposal_versions | deferred | `proposal_sections` sufficient for SRC-01 |
| Past performance integrity tables | deferred | Not in gap blocking list |

---

## Ops scripts

```bash
# Ensure packages + link documents + re-run full promote chain on HV facts
node --env-file=apps/web/.env.local scripts/backfill-document-table-map.mjs
```

---

## Governance

- Evidence-driven schema only ([PHASE2C_SCHEMA.md](PHASE2C_SCHEMA.md)).
- AI never writes trusted truth; promote requires `HUMAN_VERIFIED`.
- Update this file + `document-table-map.ts` together when a new document kind is proven.
