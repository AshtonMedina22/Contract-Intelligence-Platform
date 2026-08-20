# Master product context — full long-form specification

**Role:** Preserve the **complete product definition** (domains, verification, pricing, contracts, RAG, proposal rules, table maps, Python responsibilities).  
**Not** the short product authority.

| Concern | Wins |
| --- | --- |
| **Business / product truth** | [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) |
| **Concise product** | [PRODUCT_SPEC.md](PRODUCT_SPEC.md) |
| **Tech / architecture** | [TECH_STACK.md](TECH_STACK.md) |
| **Data / end-state domain map** | [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) |
| **Execution order** | [BUILD_PLAN.md](BUILD_PLAN.md) · [FULL_PHASE_BUILD_PLAN.md](FULL_PHASE_BUILD_PLAN.md) |
| **UX / IA** | [UX_UI.md](UX_UI.md) |
| **Current maturity** | [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) |
| **Pack reference** | [CANONICAL_PRODUCT_PACK.md](CANONICAL_PRODUCT_PACK.md) |

**Architecture decisions locked (human-confirmed 2026-08-20):**

- **Evidence vault** = Supabase Storage (immutable-by-policy). Google Drive = import/source/human workspace only — **not** the permanent canonical vault.
- **Lifecycle** = Vercel Workflow (`intake → parse → extract → validate → wait for human → promote`). Vercel Queues = fan-out only behind JobPort.
- **Product phases** = **1–8** (Historical Pilot = Phase 2). Core platform complete after Phase 8. Optional commercialization is not a core phase.
- **Global IA** = Home | Pursuits | Intelligence | Contracts | Data Ops | Settings. Ask GPT in header.

If any older paragraph below says Drive is the permanent vault, Queues are the lifecycle coordinator, Document AI is hard-required, LangGraph is required, Ingestion/Proposals are peer global nav, or phases are 1–14 with pilot as Phase 6 — **those lines are superseded**. Business capability detail remains.

Living trail: [WORK_TRAIL.md](WORK_TRAIL.md). Phase naming: [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md).

---

## Before implementing anything

Understand the complete product. Do not start coding from this file alone.

Understand: finished product; business problem; full feature set; data architecture; locked stack; ingestion/verification; AI/RAG; pricing; contract lifecycle; proposal-generation rules; multi-tenant-ready tenancy; implementation sequence (phases 1–8).

Then: inspect the repo; identify foundation that exists; update canonical docs; identify conflicts; recommend minimum next phase; **STOP** before implementing unless the user asked for a specific phase prompt ([CURSOR_PROMPTS.md](CURSOR_PROMPTS.md)).

---

## 1. What we are building

A long-term **Proposal, Contract & Procurement Intelligence Platform**, initially for L&P Global Security.

Architecture is **multi-tenant-ready from day one**. Optional future commercialization (selling to other contracting companies) does **not** define the core build.

Complete lifecycle:

```text
Historical Documents → Pursuit/Opportunity → RFP/RFQ/IFB → Requirements → Research
→ Pricing → Response/Proposal → Submission → Result/Win-Loss → Award → Contract
→ Amendments/Modifications → Options/Renewal → Rebid
→ verified outcome improves future intelligence
```

Central pre-award UX: **Pursuit → Requirements → Pricing → Response → Submission → Result.**

The platform converts years of paper and digital procurement records into:

**verified + source-backed + searchable + reusable structured intelligence.**

**This is not:** generic CRM; simple document repository; spreadsheet replacement; basic RFP tracker; generic chatbot; autonomous proposal writer; AI that invents pricing; system that blindly reuses old proposal language.

The core product is an **auditable procurement-intelligence platform** with AI operating on top of **verified** business data.

---

## 2. Primary business problem

L&P has information distributed across: paper; scans; PDFs; Word; spreadsheets; RFPs/RFQs/IFBs; addenda; Q&A; proposal drafts; final proposals; pricing schedules; awards; bid tabs; evaluator scorecards; POs; contracts; amendments; modifications; renewals; licenses; insurance; certifications; resumes; personnel qualifications; past-performance records; public procurement records.

The platform must determine:

- which **buyer/agency** owns the information (product language; physical table may be `clients`);
- which procurement opportunity/package it belongs to;
- document type and version;
- what the buyer **requested**;
- what L&P **proposed**;
- what the buyer **awarded**;
- what changed afterward;
- what is **currently** effective;
- whether L&P won / lost / no-bid / pending / cancelled / no-award;
- pricing submitted / awarded / competitor when evidenced;
- evaluator feedback;
- active contract terms; expirations and renewals;
- strong historical proposal content vs content that must not be reused;
- the **source** supporting every important fact.

**First engineering priority:**

```text
Historical digitization → extraction → staging → validation → human verification → canonical data
```

Proposal generation is **downstream**.

---

## 3. FINAL production architecture (locked)

```text
PAPER + DIGITAL DOCUMENTS
PDF / DOCX / XLSX / scans
        ↓
DOCUMENT INTAKE (upload / Drive import)
        ↓
SUPABASE STORAGE
CANONICAL IMMUTABLE-BY-POLICY EVIDENCE COPY
        ↓
DOCUMENT REGISTRY
Supabase PostgreSQL
        ↓
VERCEL WORKFLOW
(lifecycle coordinator)
        ↓
PYTHON PROCESSING
FastAPI + Pydantic (services/processor)
        ↓
DocumentParser abstraction
(digital PDF / OCR / DOCX / XLSX — route from pilot benchmarks)
        ↓
STRUCTURED AI EXTRACTION
schema-constrained outputs
        ↓
STAGING (extracted_facts + source_evidence)
        ↓
AUTOMATED VALIDATION / RECONCILIATION
        ↓
HUMAN VERIFICATION
        ↓
SUPABASE POSTGRESQL
CANONICAL SYSTEM OF RECORD
        ↓
Contracts / Renewals / Compliance
Win-Loss / Buyer / Competitor Intelligence
Pricing Intelligence
Structured Search + FTS + pgvector Hybrid RAG
Response Builder / Ask GPT / Reports / Analytics
```

| Layer | Technology |
| --- | --- |
| Web | Next.js App Router + React + TypeScript on Vercel |
| UI | Tailwind + shadcn/ui + Lucide |
| Tables | TanStack Table |
| Client/server state | TanStack Query |
| Forms | React Hook Form + Zod |
| Pricing grid | Glide Data Grid (when Phase 7) |
| Response editor | Tiptap / Novel patterns (when Phase 8) |
| Evidence viewer | PDF.js / react-pdf |
| Database | Supabase-hosted PostgreSQL |
| Auth | Supabase Auth + RLS |
| Evidence vault | **Supabase Storage** |
| Import/source | Google Drive (IDs/metadata; not canonical vault) |
| Lifecycle | **Vercel Workflow** |
| Fan-out jobs | Vercel Queues behind JobPort only |
| Processing | Python + FastAPI + Pydantic |
| Heavy bulk | Cloud Run Jobs only when pilot proves need |
| OCR/layout | Behind `DocumentParser` abstraction — **do not hard-lock Document AI** until benchmarks |
| AI app | Vercel AI SDK + AI Gateway |
| Search | Postgres FTS + pgvector + hybrid retrieval |
| Cron (dates) | Supabase Cron / pg_cron |
| Cron (app) | Vercel Cron optional |
| Billing | Stripe **optional later** — not a core phase |
| LangGraph / MCP | Only when a proven workflow requires it — not assumed |

Repo:

```text
apps/web
services/processor
packages/shared
packages/schemas
supabase/migrations
docs
```

---

## 4. Historical digitization workflow

```text
SCAN / UPLOAD / IMPORT
→ Create Batch
→ Create Document ID
→ SHA-256 checksum
→ Duplicate/version check
→ Classify
→ Identify procurement package
→ Parse/OCR (routed)
→ Extract
→ Stage
→ Validate
→ Human verify
→ Canonical promotion
→ Search / Analytics / AI
```

Original evidence objects are **never** replaced by extracted text.

---

## 5. Document registry

Every file needs a document record supporting at minimum:

organization; batch; internal document number; original filename; storage provider; Storage path; Google Drive ID (when imported); checksum; MIME type; page count; document type/subtype; buyer (`clients`); opportunity; solicitation; contract; date; version; current-version flag; processing status; extraction status; verification status; commercial truth; creator/importer; timestamps.

**Document types** (extensible): RFP, RFQ, IFB, solicitation, addendum, Q&A, proposal draft, final proposal, quote, pricing workbook, award notice, bid tab, evaluator scorecard, PO, contract, amendment, modification, option exercise, renewal, license, insurance, certification, resume, reference, past-performance evidence, public research capture, other.

Detail: [DOCUMENT_TAXONOMY.md](DOCUMENT_TAXONOMY.md).

---

## 6. Procurement packages

The core unit is the **opportunity/package**, not a random PDF.

```text
BUYER / AGENCY (clients)
└── Opportunity / Pursuit
    ├── Original RFP / RFQ / IFB
    ├── Addenda
    ├── Q&A
    ├── Proposal Draft
    ├── Final Proposal
    ├── Pricing workbook / schedule
    ├── Award
    ├── Bid Tab / evaluator scorecard
    ├── PO
    ├── Contract
    ├── Amendment / modification / option
    └── Renewal / compliance evidence
```

Every file retains its own identity/version while linked to the same lifecycle.

---

## 7. Four separate business truths

Never collapse:

1. **Buyer Requested** — RFP/RFQ/IFB/addenda/Q&A  
2. **L&P Proposed** — final submitted proposal/pricing/forms  
3. **Buyer Awarded** — award notice/PO/executed contract  
4. **Current / Amended** — amendments/modifications/options/renewals  

Never overwrite `requested_rate` / `proposed_rate` / `awarded_rate` / `current_rate` into one meaningless rate.

Precedence: [SOURCE_PRECEDENCE.md](SOURCE_PRECEDENCE.md).

---

## 8. Structured extraction / staging

**AI extraction NEVER writes directly to canonical business tables.**

Every extracted fact should retain: extraction run; document/version; entity; field; raw value; normalized value/type; source page/sheet/cell; section; excerpt; confidence; verification status; verified value; verifier; verification timestamp.

Statuses: `AI_EXTRACTED` · `NEEDS_REVIEW` · `HUMAN_VERIFIED` · `REJECTED` · `CONFLICT`

Only verified data is promoted where verification is required.

Live staging tables today include: `extraction_runs`, `extracted_facts`, `source_evidence`, `verification_events`, `validation_exceptions`.

---

## 9. Automated validation

Validate:

- **Identity** — buyer, solicitation, contract, PO, package association  
- **Pricing** — quantity × rate, totals, proposal vs award, award vs amendment  
- **Dates** — issue < submission < award; start < expiration; amendment chronology  
- **Cross-document consistency** — do not silently resolve legitimate proposed/awarded/current differences  
- **Entity conflicts** — wrong buyer/company names  
- **Required package contents** — forms, references, COI, pricing workbook, etc.  

Unresolved issues → `validation_exceptions`.

---

## 10. Human verification workbench

First major operational UI (under **Data Ops → Verification**):

```text
SOURCE DOCUMENT / PAGE  ↔  EXTRACTED DATA
```

Actions: VERIFY · EDIT · REJECT · FLAG CONFLICT · RESOLVE CONFLICT · VERIFY GROUP · VIEW SOURCE

Borrow Forefront Dataset Filtering UX concepts for fast/high-volume review. Every material verification action must be auditable (`verification_events`).

---

## 11. Core business domains → Supabase mapping

These domains must exist in the finished product. **Do not blindly create all tables before the pilot.** Map facts to **live** tables first; record schema-gap findings.

| Domain | Product meaning | Live / end-state tables (see DATA_ARCHITECTURE) |
| --- | --- | --- |
| Buyers/agencies | Canonical buyer history (not CRM) | `clients` (legacy name OK) |
| Opportunities / solicitations | RFP/RFQ/IFB, deadlines, services, pursuit status | `opportunities`, `solicitations`, addenda/Q&A (gaps) |
| Requirements | Every meaningful requirement as sourced record | `requirements` (+ forms/submission gaps) |
| Evaluation | Weights, points, scoring | `evaluation_criteria`, `evaluation_scores` (gap), `competitor_bids.note` interim |
| Proposals | Versions, sections, responses, commitments | `proposals` / `proposal_sections` (end-state gaps); stage as facts until proven |
| Awards / outcomes | Winner, prices, scores, ranking, feedback | `awards`, `win_loss_reviews` |
| Pricing | Requested / cost / submitted / awarded / current / competitor | `pricing_lines`, cost models, wage_determinations (gaps) |
| Contracts | Terms, rates, sites, options, amendments, renewals | `contracts`, amendments, options, renewals, alerts; PO/rates/sites gaps |
| Compliance | Licenses, insurance, SAM, GSA, TXMAS, certifications | `compliance_items` + end-state license/insurance tables |
| Personnel / past performance | Company ≠ management ≠ key personnel ≠ subcontractor | End-state + integrity rules; stage carefully |
| Buyer intelligence | Procurement history, awards, incumbent, eval behavior | Derived + `research_facts` |
| Competitor intelligence | Bids, prices, scores, rankings, outcomes | `competitors`, `competitor_bids` |
| Content library | Approved reusable proposal/company content | End-state reuse records; chunks with reuse status |
| Documents / evidence | Source files, facts, chunks, citations, verification | `documents`, `document_versions`, staging, chunks |

---

## 12. Government procurement data

Where applicable support relationally: NAICS; PSC; GSA SIN; UEI; CAGE; SAM; contract vehicle; GSA/TXMAS; set-aside; WBE/MBE/HUB/WOSB/etc.

Do **not** hard-code one classification to every opportunity.

**Wage determinations** support: determination ID; locality; labor category; base wage; H&W; benefits; CBA; overtime/holiday; revision/effective date; source; verification.

---

## 13. Win/loss intelligence

Statuses: `WON` · `LOST` · `PENDING` · `CANCELLED` · `NO_BID` · (also support **no-award / all-bids-rejected** as evidenced).

Store when available: L&P price; winner; winning price; rank; L&P score; winning score; category scores; evaluator feedback; strengths; weaknesses; **documented reason**; **internal analysis**; lessons learned.

Documented reason ≠ internal inference. Never claim a loss occurred because of price unless evidence supports that conclusion.

---

## 14. Proposal content reuse

Segment historical proposals into sections such as: Staffing, Management, Transition, Recruiting, Training, QC, Emergency Response, Technology, Incident Reporting, Past Performance.

Each retains: proposal; buyer; opportunity; source; outcome; evaluator performance; verification; human approval; reuse status; embedding later.

Reuse statuses: `APPROVED` · `REVIEW_REQUIRED` · `DO_NOT_USE` · `SUPERSEDED`

Rules: WON ≠ automatically reusable; LOST ≠ automatically worthless; `DO_NOT_USE` must never enter drafting retrieval.

Drafting evidence states: `VERIFIED_DRAFT_AVAILABLE` · `REVIEW_REQUIRED` · `L&P_INPUT_REQUIRED`

---

## 15. Contracts / renewals / compliance

Track: original/current contract; original/current/NTE value; effective/expiration; services; locations/sites/posts; rates; options exercised/remaining; amendments; modifications; renewal/termination notice; internal review deadline; expected rebid; owner; status.

**Service Plan** (security ops): sites/posts; staffing; schedules; substitutes; training; equipment/vehicles; guard classifications; operational obligations.

Alerts: 180 / 120 / 90 / 60 / 30 / EXPIRED (Supabase Cron on verified dates). Same pattern for insurance, licenses, certifications.

Canonical Contract workspace tabs: Overview | Service Plan | Commercial Terms | Changes | Renewal.

---

## 16. Pricing intelligence

Support structures: hourly; labor-category hourly; component; shift/post/site; day/week/month/year; fixed fee; patrol/trip; event/unit; NTE; option-year; escalation; overtime; holiday; equipment; vehicle; travel/pass-through.

Evidence from: L&P wins/losses; same buyer; comparable buyers; service; geography; staffing; contract size; recency; competitor awards; wage determinations; cost floor; target margin.

Show: included/excluded records; reasons; range; median/statistics; confidence; source evidence.

**FINAL PRICE = HUMAN DECISION.**

Pursuit Pricing = Glide workbench for this solicitation. Intelligence → Pricing = cross-corpus analysis only.

---

## 17. Public buyer / competitor intelligence

Sources may include: public solicitations; award notices; contracts; bid tabs; board/council agendas; budgets; procurement plans; evaluator reports; amendments; incumbent records; expiration/options; public-record responses.

Every research fact retains: URL; organization; document; publication date; retrieval date; page/section; verification; confidence.

Parallel source-backed research is fine; research still passes provenance/staging rules. Unsourced AI summaries are not truth.

---

## 18. Search / RAG

```text
Structured PostgreSQL filters
+ PostgreSQL Full-Text Search
+ pgvector Semantic Search
= Hybrid Retrieval
```

Retrieval must enforce: organization; permissions; verification state; outcome; reuse status; current/superseded version; **purpose** (e.g. `DO_NOT_USE` may support loss analysis, never drafting).

Checksum/change detection: unchanged documents do not needlessly OCR/extract/embed again.

Ask GPT is a **header** capability: LOCATE (no LLM) vs ASK/ANALYZE (grounded synthesis) vs REPORT.

---

## 19. Analytics / natural language analysis

Eventually: pipeline; win rates; win rates by service/buyer/geography; pricing trends; evaluator weaknesses; competitors; active contract value; renewal value at risk; compliance risk.

Text-to-SQL / semantic analytics (if added) must use: read-only access; approved views; business semantic layer; RLS/tenant controls; query validation; timeouts; **no destructive SQL**.

Never fake KPIs to fill UI.

---

## 20. Response / proposal builder (Phase 8)

For each new requirement:

```text
CURRENT REQUIREMENT
+ VERIFIED COMPANY DATA
+ APPROVED CONTENT
+ RELEVANT HISTORICAL RESULTS
+ BUYER INTELLIGENCE
+ CURRENT EVIDENCE
↓
GROUNDED DRAFT
```

If data is missing: **L&P INPUT REQUIRED**.

Never invent: staffing capacity; employee counts; turnover; contracts; references; certifications; capabilities; response times; prices; margins; performance statistics.

Use Tiptap / Novel-style editing, evidence panels, requirement mapping, source access, human approval. Google Docs = working collaboration, not canonical structured truth.

---

## 21. AI framework

**Vercel AI SDK + Gateway:** provider abstraction; streaming; structured output; tool calls; AI UI.

Controlled tools may include: `structured_query`, `locate_record`, `search_documents`, `semantic_search`, `retrieve_evidence`, `pricing_analysis`, `public_research`, `generate_report`.

**LangGraph / durable agents:** only when a proven business workflow requires durable multi-step execution, persistence, human interrupts — **not** assumed architecture.

**MCP later:** optional external interoperability (`search_procurement_history`, `get_contract`, etc.) — not core Phase 1–8.

AI never receives unrestricted authority to mutate canonical truth.

---

## 22. Multi-tenant-ready architecture

From day one: `organizations`; `memberships`; `organization_id`; RLS; tenant-aware storage/retrieval/AI/reports.

L&P is the first tenant. Procurement buyers are **data entities**, not platform tenants. Stripe/billing is optional later.

---

## 23. Frontend / UX (canonical)

Framework as in TECH_STACK. UI: enterprise; information dense; audit-oriented; desktop-first; table-centric.

**Global sidebar:** Home · Pursuits · Intelligence · Contracts · Data Ops · Settings  

**Header:** Breadcrumbs | Find or Ask GPT… | + New | User  

**Pursuit tabs:** Overview | Requirements | Pricing | Response | Submission | Result  

**Contract tabs:** Overview | Service Plan | Commercial Terms | Changes | Renewal  

**Data Ops:** Intake | Processing | Verification | Exceptions | Historical Migration  

**Intelligence:** Buyers | Competitors | Market | Pricing | Win/Loss | Content | Reports  

Do **not** build peer global modules for Ingestion / Proposals / Data Quality as the finished IA. The authenticated shell was remapped to [UX_UI.md](UX_UI.md) (Prompt 0B). Legacy routes may still exist as redirects/remounts.

---

## 24. Reference patterns we may borrow (not replace Supabase)

| Reference | Borrow |
| --- | --- |
| Forefront Dataset Filtering | Verification workbench UX |
| OpenAI Doc Search | Checksums/chunks/pgvector patterns |
| Morphic | Evidence/citation AI UX |
| AI Research Agent | Public research patterns |
| OSS Data Analyst | Semantic analytics ideas |
| Natural Language Postgres | Controlled text-to-SQL ideas |
| Novel | Proposal editor patterns |
| SaaS Microservices | Monorepo/service separation ideas |

We are **not** replacing Supabase/Postgres with those templates.

---

## 25. Core data integrity rules

- Never fabricate data. Unknown remains unknown.  
- AI-extracted ≠ verified.  
- Preserve provenance, originals, versions, historical values.  
- Requested ≠ proposed ≠ awarded ≠ current. Never overwrite historical states.  
- Canonical ≠ staging.  
- Recommendations require explainability. Pricing requires evidence. Final pricing requires human approval.  
- Proposal reuse requires approval/status. Loss content is not automatically reusable.  
- Public research requires sources. Documented reason ≠ internal analysis.  
- Verification is auditable. Tenant boundaries are mandatory.  
- Blocked/superseded content must not silently enter AI retrieval.  
- Past performance: corporate ≠ management ≠ key personnel ≠ subcontractor.  

---

## 26. Database strategy

### Start / Foundation minimum (already largely present)

`organizations`, `memberships`, `document_batches`, `documents`, `document_versions`, `extraction_runs`, `extracted_facts`, `source_evidence`, `verification_events`, `validation_exceptions`, `clients`, `opportunities`

### Long-term domain map (pilot may validate/refine — do not create all upfront)

**SOURCE / AUDIT:** documents, document_versions, document_chunks, extraction_runs, extracted_facts, source_evidence, verification_events, validation_exceptions, processing_jobs, procurement_packages  

**PROCUREMENT:** clients (buyers), opportunities/pursuits, solicitations, solicitation_addenda, solicitation_q_and_a, requirements, required_forms, requirement_responses, evaluation_criteria, evaluation_scores, proposals, proposal_versions, proposal_sections, awards, win_loss_reviews, submission_items  

**SERVICES / STAFFING:** service_types, sites, posts, staffing_requirements, schedules, personnel_requirements, training_requirements  

**PRICING:** pricing_structures, pricing_lines, labor_categories, wage_determinations, cost_models, competitors, competitor_bids, competitor_pricing_lines, comparable_sets  

**CONTRACTS:** contracts, contract_service_plans, contract_rates, contract_sites, contract_options, contract_amendments, contract_modifications, purchase_orders, renewals, contract_alerts  

**COMPLIANCE / KNOWLEDGE:** certifications, licenses, insurance_policies, company_documents, personnel_qualifications, past_performance (typed), content_library / reuse records  

**RESEARCH:** research_sources, research_facts, buyer_intelligence derived views  

**SEARCH / AI:** document_chunks / embeddings, Ask/report audit records  

See [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md). Schema changes after Phase 2 only with **PILOT_GAP_REPORT** evidence ([CURSOR_PROMPTS.md](CURSOR_PROMPTS.md) Prompt 2).

---

## 27. Python processor responsibilities (`services/processor`)

- Receive parse/extract jobs from the web app / Workflow step (`PROCESSOR_URL`).  
- Download evidence from Supabase Storage (service role).  
- Route via `DocumentParser` (PDF digital / OCR / DOCX / openpyxl XLSX).  
- Emit schema-constrained extractions into staging (`extracted_facts` + `source_evidence`).  
- Never mark facts `HUMAN_VERIFIED`. Never promote to canonical.  
- Benchmarks/evals drive OCR/provider routing — do not hard-code Document AI as product architecture.  

---

## 28. FINAL correct build order (canonical product phases 1–8)

| Phase | Name |
| --- | --- |
| 1 | Foundation |
| 2 | Real-Document Historical Pilot |
| 3 | Historical Ingestion & Migration |
| 4 | Contract & Compliance Intelligence |
| 5 | Buyer / Competitor / Market / Win-Loss Intelligence |
| 6 | Search / Ask GPT / Reports / Automation |
| 7 | Pricing Intelligence |
| 8 | Response Builder / Submission / Result |

**Core operational platform complete after Phase 8.**

Older “Phase 1–14 with pilot as Phase 6” engineering sequences described foundation slices that are now **inside** Phase 1 / early Phase 3 **code**. They do **not** redefine product maturity. Legacy migration IDs remain on SQL/scripts only.

---

## 29. Finished product checklist

When mature, uploading a new solicitation should let the system answer (from verified evidence):

What is required? Deadlines? Submission method/forms? Pricing structure? Evaluation criteria? Services/staffing? Certifications/insurance? Wage determination? Have we bid this buyer before? Win/loss? What did we propose? What was awarded? What changed later? Current contract terms? Competitor bids/awards? Evaluator comments? Which proposal content performed well? What is approved for reuse? What must not be reused? Compliance expirations? Comparable pricing evidence? Cost floor? Evidence-backed pricing range? Included/excluded records? Missing information? What requires human approval? What source supports the answer?

Then it helps create the compliant proposal. The result becomes new verified intelligence for the next pursuit.

---

## 30. Paste-ready first Cursor posture (docs-aligned)

You are working on the L&P Proposal, Contract & Procurement Intelligence Platform — production procurement intelligence, not CRM/chatbot/demo/basic RFP tracker.

Non-negotiable data flow: SOURCE → extraction → STAGING → validation → HUMAN VERIFICATION → canonical database. AI extraction never auto-becomes trusted truth. Preserve four commercial truths.

Final technology and IA are in TECH_STACK / UX_UI / CANONICAL_PRODUCT_PACK — **not** Drive-as-vault, Queues-as-lifecycle, or Ingestion/Proposals peer nav.

Do not implement yet unless given a phase prompt. Inspect repo; identify what exists; update docs; recommend smallest next phase; STOP.

---

## Capability inventory note

Long numbered “workspace” inventories in older drafts are **feature inventories**, not sitemap instructions. Prefer [UX_UI.md](UX_UI.md) for navigation.
