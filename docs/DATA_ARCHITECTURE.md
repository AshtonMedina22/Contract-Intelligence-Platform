# Data architecture

See [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md) and [BUILD_PLAN.md](BUILD_PLAN.md). Vault rules below are the lock.

## Systems of record

| Concern | System | Rule |
| --- | --- | --- |
| Structured business data | Supabase PostgreSQL | Canonical tables receive only promoted, verification-gated facts where required |
| Original files | Supabase Storage | Canonical **immutable-by-policy** ingested evidence vault |
| Human file workspace | Google Drive | Import source and optional staff browsing. Not the application vault |
| Extraction truth | Staging tables | AI writes here, never directly to canonical business tables |
| Audit | `verification_events`, extraction runs, checksums | Every material verification action is attributable |

## Evidence vault (immutable-by-policy)

Supabase Storage is not WORM merely by naming it the vault. Make original evidence effectively append-only in our design.

Object path:

```text
org_id/
  document_id/
    version_id/
      sha256/
        original.<ext>
```

Rules (implement in Phase 3, not Phase 1):

- Never overwrite an existing source object.
- A new source file is a new `document_version` and a new object.
- Record SHA-256 before processing.
- Normal users cannot update or delete original evidence objects.
- RLS/storage policies enforce tenant ownership.
- Deletion or replacement requires an explicit privileged workflow plus an audit event.

Google Drive remains the original external source/import location for existing L&P files, plus a familiar human workspace. Import copies the exact version into tenant-isolated Storage and retains `source_drive_file_id` + checksum + source metadata. Do not delete the Drive file. If checksum matches an existing version, do not re-OCR or re-embed.

## Tenant model

- `organizations`
- `memberships`
- `organization_id` on every business table
- RLS on Postgres and on `storage.objects`
- Roles beyond membership: admin, importer, verifier, bidder, executive (Phase 2)

L&P is the first tenant. Stripe comes later.

## Phase 2 schema only

Create only the ingestion foundation before testing real packages:

- organizations
- memberships
- document_batches
- documents
- document_versions
- extraction_runs
- extracted_facts
- source_evidence
- verification_events
- validation_exceptions
- clients
- opportunities

## Extracted fact shape

Every extracted fact stores: extraction run, document, entity, field, raw value, normalized value, normalized type, source page, source section, source excerpt, confidence, verification status, verified value, verifier, verification timestamp.

Statuses: `AI_EXTRACTED`, `NEEDS_REVIEW`, `HUMAN_VERIFIED`, `REJECTED`, `CONFLICT`.

## Long-term domains (do not create all tables up front)

**Source / audit:** documents, document_versions, document_chunks, extraction_runs, extracted_facts, source_evidence, verification_events, validation_exceptions

**Procurement:** clients, contacts, opportunities, solicitations, solicitation_addenda, requirements, requirement_responses, evaluation_criteria, evaluation_scores, proposals, proposal_versions, proposal_sections, awards, win_loss_reviews

**Pricing:** pricing_structures, pricing_lines, labor_categories, wage_determinations, cost_models, competitors, competitor_bids, competitor_pricing_lines

**Contracts:** contracts, contract_rates, contract_sites, contract_options, contract_amendments, contract_modifications, purchase_orders, renewals

**Compliance / knowledge:** certifications, licenses, insurance_policies, company_documents, personnel_qualifications, past_performance, content_library

**Research:** public_sources, client_intelligence, research_facts

## Four-truth fields

Never overwrite `requested_rate`, `proposed_rate`, `awarded_rate`, and `current_rate` into one field.

## Search / RAG (Phase 11)

Hybrid retrieval = structured Postgres filters + full-text search + pgvector. Retrieval must enforce organization, permissions, verification state, outcome, reuse status, and current vs superseded version.

Text-to-SQL (later) is read-only, over approved views, with a semantic layer, RLS, timeouts, and no destructive SQL.

## Schema contract

`packages/schemas` holds JSON Schema / OpenAPI shared by Pydantic (processor) and Zod (web). Do not let the two drift.
