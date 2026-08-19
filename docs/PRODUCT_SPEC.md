Short definition. Full spec: [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). How to build: [BUILD_PLAN.md](BUILD_PLAN.md).

## What this is

An auditable **Proposal, Contract & Procurement Intelligence Platform**.

It converts paper and digital procurement records into verified, source-backed, searchable, reusable structured intelligence. AI operates on top of verified business data. It is not a CRM, document dump, spreadsheet replacement, generic RFP tracker, chatbot, autonomous proposal writer, or a system that invents pricing.

Initial tenant: L&P Global Security. Multi-tenant commercial PaaS is a later phase, so tenant ownership and RLS are required from day one.

## Lifecycle

Historical documents → Opportunity → RFP/RFQ/IFB → Requirements → Research → Pricing → Proposal → Submission → Win/Loss → Award → Contract → Amendments/Modifications → Options/Renewal → Rebid

## Non-negotiable data flow

```text
UPLOAD / IMPORT
        ↓
Supabase Storage
CANONICAL IMMUTABLE-BY-POLICY SOURCE COPY
        ↓
Vercel Workflow
        ↓
parse → extract → validate
        ↓
STAGING
        ↓
WAIT FOR HUMAN VERIFICATION
        ↓
resume Workflow
        ↓
PROMOTE TO CANONICAL POSTGRES
```

AI-extracted information never becomes trusted canonical business data automatically.

## Four commercial truths

Never collapse these into one rate or one “current price”:

1. Customer requested (RFP/RFQ/IFB/addenda/Q&A)
2. L&P proposed (final submitted proposal/pricing)
3. Customer awarded (award notice/PO/executed contract)
4. Current contract (amendments/modifications/options/renewals)

## Trust rules

1. Never fabricate data. Unknown remains unknown.
2. AI-extracted ≠ verified. AI confidence is triage, not proof.
3. Preserve originals, versions, provenance, and historical values.
4. Canonical tables are not staging tables.
5. Pricing recommendations require evidence. Final price is a human decision.
6. Proposal reuse requires approval status. Won ≠ reusable. Lost ≠ worthless. `DO_NOT_USE` never enters drafting retrieval.
7. Documented win/loss reason ≠ internal analysis.
8. Public research requires sources.
9. Tenant boundaries are mandatory.
10. Blocked or superseded content must not silently enter AI retrieval.

## First operational product

The first engineering priority is historical digitization:

scan/upload → batch → checksum → duplicate/version check → classify → package association → parse → extract → stage → validate → human verify → canonical promotion

Proposal generation is downstream of verified data.

## Mature user journeys

**Historical migration:** import source files → queue/workflow → parse/OCR → extract → validate → verification workbench → canonical promotion → package grouping → contracts/intelligence/search.

**New RFP:** intake → extraction → human verification → opportunity → requirements/evaluation/pricing structure → client/competitor research → historical intelligence → compliance readiness → pricing evidence → human pricing → approved content retrieval → grounded drafting → requirement/compliance check → approval → submission → win/loss → award/contract → renewal/rebid.

## What the finished product must be able to answer

For a new RFP, from verified evidence only: requirements, deadlines, submission method/forms, required pricing structure, evaluation criteria, staffing/services, certifications/insurance, wage determination, prior bids with this client, win/loss, proposed vs awarded vs current terms, competitor evidence, evaluator comments, approved vs blocked reuse, compliance expirations, comparable pricing with include/exclude reasons, missing information, and the source that supports each answer.
