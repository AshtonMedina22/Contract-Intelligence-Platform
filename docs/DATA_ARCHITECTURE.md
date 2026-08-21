# Data architecture — verified procurement intelligence

Synced with Canonical Product Pack + full domain map from [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md).  
Business rules: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). Stack: [TECH_STACK.md](TECH_STACK.md).

**Document kind → table → promote RPC map:** [DOCUMENT_TABLE_MAPPING.md](DOCUMENT_TABLE_MAPPING.md) (code: `apps/web/lib/data-model/document-table-map.ts`).

This file owns **data/evidence architecture**, not navigation. UX/IA: [UX_UI.md](UX_UI.md).

## Core principle

The system must distinguish **source evidence**, **extracted staging data**, and **canonical verified business records**. AI never writes trusted truth directly.

## Systems of record

| Role | System |
| --- | --- |
| Structured business data | Supabase PostgreSQL — canonical tenant-scoped procurement data |
| Original/ingested evidence | Supabase Storage — canonical immutable-by-policy evidence copy |
| External/human file source | Google Drive — import/source and human workspace; not a second canonical database |
| Proposal collaboration/output | Google Docs — working proposal handoff; not canonical structured data |
| Controlled spreadsheet export/QA | Google Sheets — import/export/QA where useful; not a bidirectional second database |
| AI/extraction working truth | Staging tables — AI-extracted facts, confidence, and source coordinates await verification |
| Audit | verification events, extraction runs, checksums, workflow events, validation exceptions |

## Canonical document lifecycle

```text
Upload/import
→ exact evidence copy to Supabase Storage
→ document registry/version/checksum
→ Vercel Workflow
→ parser/OCR route
→ structured extraction
→ staging
→ automated validation/reconciliation
→ HUMAN verification
→ Workflow resume
→ canonical promotion
→ eligible FTS/chunks/embeddings/intelligence
```

## Evidence vault

Recommended object pattern: `organization_id/document_id/version_id/sha256/original.ext`

Rules: never overwrite original evidence; revision = new document version/object; SHA-256 before expensive processing; normal users cannot casually update/delete evidence objects; tenant-scoped Storage/RLS; retain original source URL/Drive ID and acquisition metadata; matching checksum avoids unnecessary OCR/extraction/embedding.

## Tenancy

From day one: organizations; memberships; `organization_id` on tenant-owned records; Postgres RLS; Storage tenant isolation; same-organization foreign-key integrity; tenant-scoped retrieval, AI context, and reports.

L&P is initial tenant. Future tenants are contracting companies. Procurement buyers/customers are **data entities**, not platform tenants merely because L&P serves them.

## Buyer / agency entity

Buyer/agency/procurement customer is **not CRM**. It connects solicitations, pursuits, proposals, awards, contracts, and public intelligence. No lead nurture/contact cadence/customer portal is implied.

Physical table may remain `clients` if migration cost is not justified; product language is **buyers/agencies**.

## Procurement package as the core data unit

Documents should be grouped around the same real procurement lifecycle. A package can include:

solicitation/RFP/RFQ/IFB · addenda · Q&A/clarifications · required forms · pricing workbook · proposal drafts · final submitted response · references/certifications · award notice · bid tab/evaluation · PO · executed contract · amendments/modifications · option/renewal documents · invoices/payment evidence when useful · public research records.

## Document registry

Each document/version should retain: organization; package/batch; document and version IDs; source provider/URL/Drive ID; original filename; Storage object; checksum; MIME type; page/workbook structure; document type/subtype; buyer; pursuit/solicitation/contract association; document date; version/current-version state; commercial truth; processing/extraction/verification status; timestamps.

## Staging fact shape

Every material extracted fact should be capable of retaining: extraction run; document/version; target entity/field; raw value; normalized value/type; source page/sheet/cell; section; excerpt; confidence; verification state; verified value; verifier/timestamp.

## Verification states

`AI_EXTRACTED` · `NEEDS_REVIEW` · `HUMAN_VERIFIED` · `REJECTED` · `CONFLICT`

## Data classification (separate from verification)

`verified_public` · `verified_internal` · `internal_unverified` · `illustrative_demo`

## Four commercial truths

1. **BUYER REQUESTED** — solicitation/addenda/Q&A/requested pricing  
2. **L&P PROPOSED** — final submitted proposal/pricing/forms  
3. **BUYER AWARDED** — award notice/PO/executed contract  
4. **CURRENT/AMENDED** — executed amendments/modifications/options/renewals  

Never collapse requested/proposed/awarded/current into a generic `rate` or overwrite history.

## Source precedence

- Requirements: latest applicable addendum/official clarification > original solicitation  
- L&P submitted position: final submitted proposal/pricing > draft  
- Current commercial terms: latest executed amendment/modification/option > executed contract/PO > award > proposal  

If sources still conflict, preserve both and create a validation/reconciliation exception.

## Canonical end-state domain model

**Do not blindly create all tables before the pilot.** This is the domain map the pilot may validate/refine. Proposed end-state entities that are not live yet are **schema-gap findings**, not “invented tables.”

### Tenancy

`organizations`, `memberships`

### Evidence / processing

`document_batches`, `procurement_packages`, `documents`, `document_versions`, `extraction_runs`, `extracted_facts`, `source_evidence`, `verification_events`, `validation_exceptions`, `processing_jobs`

### Buyers / pursuits

buyers/agencies (legacy `clients` may remain), pursuits/opportunities, solicitations, solicitation_addenda, solicitation_q_and_a, pursuit_milestones/deadlines

### Requirements / submission

`requirements`, `required_forms`, `requirement_responses`, `submission_items`, `submission_events`/confirmations

### Evaluation / result

`evaluation_criteria`, `evaluation_scores`, `awards`, `win_loss_reviews`

### Services / staffing

`service_types`, sites, posts, `staffing_requirements`, schedules, personnel_requirements, training_requirements

### Pricing

`pricing_structures`, `pricing_lines`, labor_categories, wage_determinations, cost_models, comparable_sets, competitor_pricing_lines

### Proposal / content

`proposals`, `proposal_versions`, `proposal_sections`, content_library/reuse records, approvals

### Contracts

`contracts`, `contract_service_plans`, contract_sites/posts, contract_rates, `purchase_orders`, `contract_amendments`, contract_modifications/change records, `contract_options`, `renewals`, `contract_alerts`

### Compliance

licenses, insurance_policies/COIs, certifications, company_documents, personnel_qualifications

### Intelligence

`competitors`, `competitor_bids`, research_sources, `research_facts`, buyer_intelligence facts/derived views, report records where reports are persisted

### Search / AI

document_chunks/eligible embeddings, Ask/report audit records as needed

### Federal / vehicle identifiers (when relationally justified)

NAICS · PSC · GSA SIN · UEI · CAGE · SAM · set-aside · contract vehicle · GSA/TXMAS · WBE/MBE/HUB/WOSB · wage determination/locality · armed/unarmed/PPO/patrol service taxonomy · screening/background/fingerprint/drug/driver/firearm/security-clearance/training requirements

## Past performance integrity

Never conflate: L&P corporate past performance; management prior experience; key personnel experience; subcontractor experience.

## Search / RAG

Hybrid retrieval = structured Postgres queries + PostgreSQL FTS + pgvector.  
No separate vector database unless measured scale/performance proves Postgres insufficient.

Retrieval must be: tenant-aware · permission-aware · verification-aware · version-aware · source-precedence-aware · outcome-aware · reuse-aware · purpose-aware.

Purpose matters. Example: `DO_NOT_USE` losing proposal content may support loss analysis, but not proposal drafting.

## Schema governance

- shared JSON Schema/OpenAPI/Pydantic/Zod contracts must stay aligned  
- migrations must be additive/safe and **evidence-driven**  
- UI sections do not automatically justify tables  
- source documents remain the audit root  
- canonical business data must always be traceable back to evidence  
- map pilot facts to **live** tables first; record unsupported end-state concepts as **schema-gap findings**; do not create migrations prematurely  
