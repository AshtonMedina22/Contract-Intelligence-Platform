# Full phase build plan

Detailed execution plan synced August 2026 from the Canonical Product Pack.  
Product maturity follows the original **eight-phase** business sequence. Concise checklist: [BUILD_PLAN.md](BUILD_PLAN.md). Legacy engineering/migration IDs may remain in code; they do not redefine product phase completion.

---

## Phase 1 — Foundation

**Goal:** trusted, tenant-safe platform foundation before depending on AI outputs.

Build/validate: Next.js App Router shell; Supabase Auth, organizations, memberships, tenant-scoped RLS; Supabase Storage evidence vault; document registry, versions, batches, checksums, processing status; staging facts, source evidence, verification events, validation exceptions; Vercel Workflow + JobPort; Python/FastAPI/Pydantic processor interfaces; PDF source viewer + verification workspace foundation; shared schemas/types; **final UX shell:** Home, Pursuits, Intelligence, Contracts, Data Ops; Settings separated; Find or Ask GPT in header.

**Acceptance:** tenant A cannot access tenant B; evidence never casually overwritten; AI-extracted facts default to unverified; source/page/cell provenance can be retained; lint/typecheck/build pass; no fake production data required to make UI look complete.

**Out of scope:** autonomous pricing; proposal drafting as production capability; unsupported analytics; commercial billing.

---

## Phase 2 — Real-Document Historical Pilot

**Goal:** prove the data model and document workflow against real procurement evidence before designing the rest from assumptions.

**Corpus strategy:** begin with verified public L&P procurement records and actual L&P-originated proposals/contracts/POs/evaluations; supplement with real security-industry solicitations/forms/workbooks only as **TEST CORPUS** when an L&P-specific document type is unavailable; never label another contractor’s content as L&P history; target ~20–30 materially different packages selected for coverage.

**First-wave package types should force understanding of:** solicitation/RFP/RFQ/IFB; addenda/Q&A; L&P proposal/response narrative; required forms/signatures; pricing schedule/workbook; staffing/sites/service plan; evaluation scorecard/bid tab; win/loss/award; executed contract; PO; amendment/change/option/renewal; compliance evidence.

**Process every pilot document through:** Intake → checksum/version → package association → parse/OCR → extraction → staging → validation/reconciliation → human verification → canonical promotion.

**Measure:** extraction accuracy; requirement recall; pricing-cell accuracy; entity/date accuracy; forms/checkbox/table capture; page/sheet/cell provenance; version/addendum handling; source precedence; verification usability; processing time/cost.

**Required deliverable:** `PILOT_GAP_REPORT` per package — what captured correctly; missing schema/entity/field; extraction/parser failure; provenance/verification problem; source-precedence issue; required schema change; UX placement; blocking vs deferrable.

**Acceptance:** real documents can be reviewed against source; representative package types complete the trust pipeline; gaps are evidence-backed; no later AI feature declared complete because a placeholder page exists.

---

## Phase 3 — Production Historical Ingestion & Migration

**Goal:** convert the pilot-proven process into a dependable ingestion/verification engine and scale the historical corpus.

Build/finish: robust PDF/DOCX/XLSX/scan routing; openpyxl-first workbook parser; parser/OCR benchmark routing; SHA-256 dedupe and versions; package grouping; retry/error handling; validation/reconciliation; verification role enforcement; canonical promotion; controlled batch migration; embeddings/chunks only after eligible content is verified; Data Ops views: Intake, Processing, Verification, Exceptions, Historical Migration.

Automation: Vercel Workflow coordinates lifecycle; Vercel Queues only for fan-out behind JobPort; no unverified fact auto-promotes because automation completed.

---

## Phase 4 — Contract & Compliance Intelligence

**Goal:** make awarded L&P work operationally useful.

Global Contracts portfolio + company compliance secondary view.  
Contract workspace: Overview | Service Plan | Commercial Terms | Changes | Renewal.

Service Plan: sites/locations/posts; guard classifications; staffing; schedules/hours; supervisors; substitutes; temporary/additional coverage; training; equipment/vehicles; uniforms/reporting; patrol/access-control/operational obligations.

Commercial Terms: original/current/NTE; rates/quantities; POs; vehicles; start/end/performance dates; invoice/payment; termination/notice; escalation.

Changes: amendments; modifications; change orders; option exercises; rate/value/site/staffing/scope changes.

Renewal: expiration; options; notice deadlines; internal review; rebid; compliance eligibility.

Automation: Supabase Cron/pg_cron at 180/120/90/60/30/expired on verified dates.

---

## Phase 5 — Buyer, Competitor, Market & Win/Loss Intelligence

**Goal:** turn verified history into procurement intelligence that improves future bidding.

Buyer: prior solicitations; L&P bids/results; incumbents; awards; historical pricing; evaluation criteria/comments; contracts/options/rebids; sourced public research.

Competitor: observed bids; submitted/awarded pricing; pricing lines; technical/price/total scores; rank/outcome; geography/services; source evidence.

Win/Loss: L&P price and score; winner/award price/score; category scoring; rank; evaluator comments; documented reason; separate internal analysis; lessons learned.

Market: verified observations only; no market share from raw mentions; no unsupported causation.

---

## Phase 6 — Search, Ask GPT, AI Reports & Automation

**Goal:** make the verified corpus usable conversationally and proactively without a generic chatbot shell.

Find or Ask GPT in authenticated header. Modes: LOCATE · ASK/ANALYZE · REPORT.

Purpose-aware retrieval purposes include: GENERAL_QA, LOCATE, LOSS_ANALYSIS, COMPETITOR_ANALYSIS, PRICING_ANALYSIS, BID_STRATEGY, PROPOSAL_DRAFTING, COMPLIANCE_REVIEW, REPORT_GENERATION.

Reports: Bid Strategy; Buyer Intelligence Brief; Market; Competitor; Pricing; Win/Loss; Proposal Improvement/Evaluator; Executive.

Automation is first-class but bounded; never autonomously set final bid price or submit a proposal without explicit workflow approval.

---

## Phase 7 — Pricing Intelligence

**Goal:** use verified historical/commercial evidence to support a human pricing decision.

Pursuit Pricing: buyer-required format; L&P internal cost; L&P submitted; buyer awarded; current/amended; wage determinations; burden/equipment/vehicle/travel/overhead; comparables; include/exclude; range/statistics; cost floor/target margin; confidence; sources. Use Glide Data Grid.

Intelligence → Pricing = cross-corpus analysis, not bid entry.  
**FINAL BID PRICE = HUMAN DECISION REQUIRED.**

---

## Phase 8 — Response Builder, Submission & Result Loop

**Goal:** make proposal work a central production workflow using verified intelligence.

Pursuit: Overview → Requirements → Pricing → Response → Submission → Result.

Response: requirement navigation; Tiptap; Resizable evidence; approved historical content; grounded GPT; human edit/approval; proposal progress.

Evidence states: `VERIFIED_DRAFT_AVAILABLE` | `REVIEW_REQUIRED` | `L&P_INPUT_REQUIRED`.  
Reuse: `APPROVED` | `REVIEW_REQUIRED` | `DO_NOT_USE` | `SUPERSEDED`.

GPT output: `draft_response`, `sources_used`, `assumptions`, `missing_information`, `confidence`. Never invent L&P business facts.

Submission and Result as defined in [UX_UI.md](UX_UI.md) / [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). Feedback loop to historical intelligence on outcome.

---

## Optional future commercialization — not part of core product build

Only if L&P later chooses to sell the platform to other contracting companies: tenant administration; plans/seats; Stripe; commercial onboarding; optional MCP/agent integrations. Preserve the same procurement model and trust rules.

**Core operational platform is complete after Phase 8.** Commercialization is optional and separate.
