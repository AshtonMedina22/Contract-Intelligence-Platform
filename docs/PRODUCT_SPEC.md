Short definition. **Business authority:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). Long-form: [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). How to build: [BUILD_PLAN.md](BUILD_PLAN.md). What exists today: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).

## What this is

An auditable **Proposal, Contract & Procurement Intelligence Platform** for L&P Global Security (later possible multi-tenant PaaS for **contracting companies**, not L&P's procurement customers).

It converts historical procurement records into **verified, source-backed, structured, searchable, analyzable, reusable** intelligence. That intelligence improves new bids. AI operates on verified data — it is not a generic chatbot, autonomous pricer, or autonomous proposal writer.

**Not:** a CRM, client/customer portal, customer self-service platform, sales activity tracker, generic document repository, basic RFP tracker, or system that blindly sends historical documents to an LLM.

Initial tenant: L&P internal users only. Multi-tenant commercial PaaS is later; tenant ownership and RLS are required from day one.

## Six product engines

Preserve these in all product and roadmap docs:

1. **Opportunity / Solicitation** — current pursuits (RFP, RFQ, IFB, quote): deadlines, requirements, evaluation, go/no-go, assignments, source documents. Buyer/agency is related procurement data, not a CRM account.
2. **Contract & Compliance** — won work, current terms, amendments, renewals, certifications, insurance, expirations (180/120/90/60/30/expired).
3. **Pricing Intelligence** — distinguish customer-requested structure, L&P cost model, L&P submitted price, awarded price, current/amended price. Evidence-backed comparables; **final price always requires human decision.**
4. **Buyer / Market / Competitor Intelligence** — prior L&P bids, wins/losses, incumbents, bid tabs, evaluator comments, competitor bids/awards, public procurement research. Statistics must be evidence-backed; do not infer unsupported causation.
5. **Proposal Intelligence** — section-level historical content (Staffing, Transition, Past Performance, etc.) with reuse status (`APPROVED`, `REVIEW`, `DO_NOT_USE`, `SUPERSEDED`). Won ≠ reusable; lost ≠ worthless; `DO_NOT_USE` never enters drafting retrieval.
6. **Executive / Business Intelligence** — pipeline, win rates, pricing trends, compliance risk, market performance — **only from verified data**; never fake analytics to fill UI.

## Lifecycle

Historical documents → Opportunity → RFP/RFQ/IFB → Requirements → Research → Pricing → Proposal → Submission → Win/Loss → Award → Contract → Amendments/Modifications → Options/Renewal → Rebid → (outcome feeds corpus)

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

Never collapse these into one rate or one "current price":

1. Customer requested (RFP/RFQ/IFB/addenda/Q&A)
2. L&P proposed (final submitted proposal/pricing)
3. Customer awarded (award notice/PO/executed contract)
4. Current contract (amendments/modifications/options/renewals)

## Source precedence

When sources conflict, record reconciliation work — do not silently overwrite:

- Requirements: latest applicable addendum/clarification > original solicitation
- L&P position: final submitted proposal/pricing > draft
- Current terms: latest executed amendment/modification/option > executed contract/PO > award notice > submitted proposal

See [SOURCE_PRECEDENCE.md](SOURCE_PRECEDENCE.md).

## Buyer / agency vs CRM

`clients` in the schema means **buyer, agency, or procurement customer** — an intelligence entity tied to opportunities, contracts, and research. It is **not** a CRM account requiring lead management, contact cadence, sales activities, or relationship scoring.

## Ask Intelligence and search

**LOCATE** — structured search, full-text search, direct record/document results. Must not require an LLM.

**ASK / ANALYZE** — structured queries, semantic retrieval, grounded synthesis with source evidence. Purpose-aware: e.g. `DO_NOT_USE` content may appear for loss analysis but not proposal drafting.

Ask Intelligence is part of the finished product; it is not a generic chatbot.

## AI intelligence reports

First-class derived outputs (when sufficient verified evidence exists):

- Bid Strategy Report
- Buyer / Agency Intelligence Brief
- Market Intelligence Report
- Competitor Intelligence Report
- Pricing Intelligence Report
- Win/Loss Analysis Report
- Proposal Improvement / Evaluator Analysis
- Executive Intelligence Brief

Withhold conclusions when evidence is insufficient. Do not manufacture polished reports because a route exists.

## Public research

Public procurement research retains URL, source organization, document, publication date, retrieval date, page/section, verification/confidence. Research is evidence, not unsourced AI summaries.

## Government / security procurement domain

Where applicable, the end-state product supports (relationally, not hardcoded): NAICS, PSC, GSA SIN, UEI, CAGE, SAM, set-asides, contract vehicles, TXMAS, WBE/MBE/HUB/WOSB, locality, wage determinations, labor categories, service taxonomy (armed, unarmed, PPO, patrol, etc.), screening and clearance requirements. Service taxonomy must be extensible — do not hardcode one NAICS or a fixed handful of service types.

## Past performance integrity

Explicitly distinct and never conflated by AI:

- L&P corporate past performance
- Management prior experience
- Key personnel experience
- Subcontractor experience

"An executive previously worked on Contract X" must never become "L&P performed Contract X."

## New RFP workflow (finished product)

NEW RFP → parse solicitation → extract requirements/pricing format → verify → research buyer → prior L&P history → win/loss/competitor analysis → **bid strategy** → compliance → pricing evidence → **human pricing decision** → retrieve approved content → grounded drafts → human edit → requirement coverage → approvals → final proposal → submit → capture outcome → update intelligence.

When evidence is missing: **L&P INPUT REQUIRED** — no fabricated business claims.

## Proposal output workflow

```text
IN-APP INTELLIGENCE / DRAFTING
        → Google Docs working proposal (collaboration where appropriate)
        → final procurement output
```

Possible outputs: Google Doc, PDF, DOCX, portal response fields, pricing workbook, copy/paste. Google Docs/Sheets are workspace/export — not competing canonical databases.

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

## Canonical build phases (product maturity)

| Phase | Name |
| --- | --- |
| 1 | Foundation |
| 2 | Historical Pilot (20–30 complete packages) |
| 3 | Historical ingestion / processing |
| 4 | Broader historical migration |
| 5 | Contracts / compliance / renewals |
| 6 | Analytics / market / buyer / competitor intelligence |
| 7 | Search / RAG / Ask Intelligence |
| 8 | Pricing intelligence |
| 9 | Proposal builder / grounded drafting |

Legacy engineering IDs (0–14) remain on migrations and acceptance files. See [BUILD_PLAN.md](BUILD_PLAN.md).

## First operational product

Historical digitization and verification:

scan/upload → batch → checksum → duplicate/version → classify → package association → parse → extract → stage → validate → human verify → canonical promotion

Proposal generation and advanced intelligence are downstream of verified data.

## Current implementation status

See [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) and the living [WORK_TRAIL.md](WORK_TRAIL.md). Summary: Foundation engineering mostly exists; **Historical Pilot has not started** (0 L&P packages); later Intelligence UX exists early and is **KEEP + FREEZE**; opportunity workspace exists as empty ops UI; production tenant/env not confirmed.

## Mature user journeys

**Historical migration:** import source files → queue/workflow → parse/OCR → extract → validate → verification workbench → canonical promotion → package grouping → contracts/intelligence/search.

**New RFP:** intake → extraction → human verification → opportunity → requirements/evaluation/pricing structure → buyer/competitor research → historical intelligence → compliance readiness → pricing evidence → human pricing → approved content retrieval → grounded drafting → requirement/compliance check → approval → submission → win/loss → award/contract → renewal/rebid.

## What the finished product must be able to answer

For a new RFP, from verified evidence only: requirements, deadlines, submission method/forms, required pricing structure, evaluation criteria, staffing/services, certifications/insurance, wage determination, prior bids with this buyer, win/loss, proposed vs awarded vs current terms, competitor evidence, evaluator comments, approved vs blocked reuse, compliance expirations, comparable pricing with include/exclude reasons, missing information, and the source that supports each answer.
