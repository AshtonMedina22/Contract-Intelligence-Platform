# Master blueprint — L&P Global Security Proposal, Contract & Procurement Intelligence Platform

**STATUS:** Authoritative business/product blueprint.  
Source: approved [CANONICAL_PRODUCT_PACK.md](CANONICAL_PRODUCT_PACK.md) (Prompt 0A sync).  
It defines the finished product, lifecycle, trust model, UX, capability boundaries, and product phase order.

| Concern | Document |
| --- | --- |
| **Business / product truth** | **This file** |
| Concise product spec | [PRODUCT_SPEC.md](PRODUCT_SPEC.md) |
| Locked tech stack | [TECH_STACK.md](TECH_STACK.md) |
| Data / evidence architecture | [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) |
| Execution order | [BUILD_PLAN.md](BUILD_PLAN.md) |
| Detailed phase plan | [FULL_PHASE_BUILD_PLAN.md](FULL_PHASE_BUILD_PLAN.md) |
| What exists today | [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) |
| UX / IA | [UX_UI.md](UX_UI.md) |
| Living session trail | [WORK_TRAIL.md](WORK_TRAIL.md) |
| Historical pilot | [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md) |

Do not let older repo docs, routes, table names, or prototype navigation silently override this blueprint.

---

## Product north star

Build a **proposal-centered** procurement intelligence platform for L&P Global Security, **architected from day one for tenant isolation**, that helps L&P create more accurate and competitive proposals from verified historical procurement data, buyer/competitor intelligence, pricing evidence, evaluator/win-loss learning, contract changes, expirations/renewals, and source-backed AI.

- **Proposal work is central.**
- **Government/public procurement is a primary domain.**
- **Ask GPT, evidence-backed reports, and bounded automation are first-class capabilities.**

**Primary operational flow:**

```text
Pursuit
→ Requirements
→ Pricing
→ Response
→ Submission
→ Result
→ Award/Contract
→ Changes
→ Renewal/Rebid
→ verified result improves future bids
```

Pre-award workspace tabs match the first six steps (Overview sits on Pursuit). Post-award continues in Contracts.

**First-class capabilities:** verified historical L&P procurement intelligence; government/public procurement; buyer research; competitor bid/award intelligence; win/loss and evaluator analysis; pricing intelligence; proposal/response drafting; submission tracking; contract/current-term intelligence; expiration/renewal/rebid monitoring; Find / Ask GPT; AI-generated evidence-backed reports; bounded automation.

**Trust rule:** AI sits on verified evidence. AI extraction, analysis, and drafting never become unverified truth.

---

## 1. Product purpose

One **proposal-centered** Proposal, Contract & Procurement Intelligence Platform for L&P Global Security, with **multi-tenant-ready architecture from day one**.

The platform converts L&P historical records, current procurement opportunities, public procurement intelligence, and awarded contract evidence into:

**VERIFIED + SOURCE-BACKED + STRUCTURED + SEARCHABLE + ANALYZABLE + REUSABLE INTELLIGENCE.**

The primary business objective is **not** contract storage. It is to help L&P produce stronger, more accurate, and more competitive future responses using evidence from:

- prior proposals
- prior wins and losses
- evaluator feedback and scorecards
- buyer history
- competitor bids / awards / pricing
- public procurement records
- pricing history and internal costs
- contract changes and current rates
- compliance / renewal / rebid timing
- approved historical proposal content

---

## 2. Complete lifecycle

```text
Historical Procurement Evidence
→ Pursuit / Opportunity
→ RFP / RFQ / IFB / quote / task order
→ Requirements
→ Research / Bid Strategy
→ Pricing
→ Response
→ Submission
→ Result
→ Award
→ Contract
→ Changes / Amendments / Options
→ Renewal / Rebid
→ verified outcome improves future intelligence
```

Central pre-award UX: **Pursuits → Requirements → Pricing → Response → Submission → Result.**

---

## 3. Proposal work is central

For a new solicitation the platform must help L&P:

- understand exactly what the buyer asked
- identify deadlines, forms, signatures, attachments, and submission method
- structure all mandatory / scored requirements
- research the buyer and incumbent
- analyze prior L&P history with that buyer / service
- analyze relevant competitors, prior awards, and evaluation patterns
- build an evidence-backed Bid Strategy
- determine compliance readiness and missing L&P information
- compare verified historical pricing and current cost / wage evidence
- support a **human final pricing decision**
- retrieve approved historical response content
- generate grounded requirement-level drafts
- expose every source used
- flag **L&P INPUT REQUIRED** when facts are missing
- track proposal / submission completion
- produce the working / final proposal package
- capture result, evaluator feedback, and award
- feed what happened back into the intelligence corpus

---

## 4. Government / public procurement is a primary domain

Comfortable with: RFP/RFQ/IFB/task orders/quotes; addenda and Q&A; procurement portals; public bid tabs/evaluations; government/public buyer entities; NAICS/PSC/GSA SIN/UEI/CAGE/SAM/set-asides/contract vehicles; TXMAS/GSA and certifications; wage determinations/labor categories/fringe; required affidavits/forms/insurance/certifications; evaluator scoring/ranking; option years, renewals, and rebids.

Extensible enough for commercial procurement too.

---

## 5. This product is NOT

- CRM
- customer / client portal
- lead nurture / sales activity tracker
- generic document repository
- simple RFP tracker
- generic chatbot
- autonomous pricing engine
- blind AI proposal writer
- fake executive dashboard
- a system that treats AI extraction as verified truth

Buyer / agency / procurement customer is an **intelligence entity**, not a CRM account.

---

## 6. Six capability engines

| Engine | Role |
| --- | --- |
| **A. Opportunity / Solicitation Intelligence** | Current/historical pursuits, solicitation metadata, deadlines, requirements, evaluation, package completeness, assignment/status, result |
| **B. Contract & Compliance Intelligence** | Awarded work, service obligations, commercial terms, POs, changes, options, renewals, rebids, licenses, insurance, certifications, expiration risk |
| **C. Pricing Intelligence** | Buyer requested, L&P cost, L&P submitted, buyer awarded, current/amended; comparables and cost evidence; human final price |
| **D. Buyer / Market / Competitor Intelligence** | Buyer history, incumbents, solicitations, awards, scores, competitor bids/pricing/rank, public research, rebid timing |
| **E. Proposal / Response Intelligence** | Requirement-level authoring, approved historical content, evaluator/outcome intelligence, grounded GPT drafting, reuse controls, Google Docs handoff, submission |
| **F. Executive / Business Intelligence** | Pipeline, win/loss, contract value, renewal/compliance risk, pricing/competition/evaluation patterns, evidence-backed reports |

Ask GPT, Reports, and Automation **span** these engines and are first-class.

---

## 7. Canonical global UX

**Sidebar:** Home | Pursuits | Intelligence | Contracts | Data Ops  
**Settings:** separated at bottom/admin.

**Header:** Breadcrumbs | Find or Ask GPT… | + New | User

**Intelligence (secondary, not peer globals):** Buyers | Competitors | Market | Pricing | Win/Loss | Content | Reports

**Data Ops (secondary):** Intake | Processing | Verification | Exceptions | Historical Migration

Do **not** turn database entities or backend stages into peer global navigation. Detail: [UX_UI.md](UX_UI.md).

---

## 8. Home

Action center: “What needs attention now?”  
Surface due pursuits, missing mandatory items, L&P Input Required, approvals, pricing decisions, submission gaps, verification backlog, processing errors, contract renewal/rebid risk, and compliance expiration.

---

## 9. Pursuit workspace

**Tabs:** Overview | Requirements | Pricing | Response | Submission | Result

- **Overview** — buyer/solicitation/key dates/scope/evaluation, Bid Strategy, historical intelligence, compliance readiness, pricing/response status, risks
- **Requirements** — source-backed matrix of mandatory/scored/technical/operational/staffing/compliance/legal/pricing/forms/attachments
- **Pricing** — workbench separating Buyer Requested, L&P Internal Cost, L&P Submitted, Buyer Awarded, Current/Amended; historical and competitor evidence; human final pricing
- **Response** — proposal authoring: requirement navigation + Tiptap + Resizable evidence context
- **Submission** — full packet validation (forms, pricing, references, certifications, insurance, signatures, addenda, attachments, approvals, outputs, confirmation)
- **Result** — pending/won/lost/no-bid/cancelled/no-award; winner; prices; scores/rank; evaluator comments; documented reason; internal lessons; award/contract linkage

---

## 10. Proposal grounding

Before generation, classify each requirement:

- `VERIFIED_DRAFT_AVAILABLE`
- `REVIEW_REQUIRED`
- `L&P_INPUT_REQUIRED`

Historical content reuse: `APPROVED` | `REVIEW_REQUIRED` | `DO_NOT_USE` | `SUPERSEDED`

Won ≠ automatically reusable. Lost ≠ automatically worthless. `DO_NOT_USE` may support retrospective analysis but never drafting.

GPT may use only allowed verified/approved evidence and must return: `draft_response`, `sources_used`, `assumptions`, `missing_information`, `confidence`.

When required L&P facts are not verified → **L&P INPUT REQUIRED**, not fabrication.

---

## 11–12. Proposal progress and output

Track at minimum: Total Requirements · Verified · Drafted · Approved · L&P Input Required · Mandatory Outstanding · Required Attachments Missing.

Path: in-app intelligence/drafting → human review/approval → Google Docs working proposal where useful → final PDF/DOCX/portal fields/pricing workbook/copy-paste.

Google Docs is collaborative human workspace, **not** canonical structured truth.

---

## 13. Contract workspace

Global Contracts = portfolio + company compliance secondary view.

**Tabs:** Overview | Service Plan | Commercial Terms | Changes | Renewal

- **Service Plan** — sites/posts/staffing/schedules/substitutes/additional staffing/training/equipment/guard classifications/operational obligations
- **Commercial Terms** — original/current/NTE value, rates, quantities, PO, contract vehicle, payment/invoicing, performance dates, notices/termination/escalation
- **Changes** — amendments, modifications, change orders, option exercises, rate/value/site/staffing/scope changes (never overwrite historical values)
- **Renewal** — expiration, option state, notice deadlines, internal review, rebid planning, compliance eligibility

---

## 14. Intelligence

**Subviews:** Buyers | Competitors | Market | Pricing | Win/Loss | Content | Reports

Pursuit-specific intelligence is summarized in Pursuit Overview. Global Intelligence is cross-corpus analysis.

Buyer intelligence is procurement intelligence, **NOT CRM**. Competitor/Market claims require verified observations. Win/Loss keeps documented reason separate from internal analysis.

---

## 15. Ask Intelligence / Find

Ask GPT is a **persistent global header capability**, not a standalone sidebar app.

- **LOCATE** — structured SQL / FTS / direct record lookup. No LLM required.
- **ASK / ANALYZE** — structured + FTS + pgvector + verified evidence + grounded GPT synthesis.
- **REPORT** — evidence-backed report generation.

Retrieval enforces organization, permissions, verification, version, source precedence, outcome, reuse status, and purpose.

Every answer: Answer, Sources/Evidence, Data Scope, limitations/confidence, View Source.  
If insufficient: “Insufficient verified evidence to answer this reliably.”

---

## 16. Reports

Bid Strategy · Buyer Intelligence Brief · Market Intelligence · Competitor Intelligence · Pricing Intelligence · Win/Loss Analysis · Proposal Improvement / Evaluator Analysis · Executive Intelligence Brief

Disclose source/data scope; withhold unsupported conclusions.

---

## 17. Automation

Expected business outcome, not optional. Categories: document-processing workflows; ingestion retry/error handling; verification queues/exceptions; contract renewal/compliance alerts; scheduled digests/reports/research refresh where justified; future bounded agent workflows.

Automation never bypasses: human verification; final pricing decision; proposal approval; submission authorization; tenant/security boundaries.

---

## 18. Historical data trust pipeline

```text
Source → inventory/checksum/dedupe/version → classify/package → parse/OCR
→ extract → staging → validation/reconciliation → human verification
→ canonical promotion → approved search/chunks/embeddings/intelligence
```

AI extraction never automatically becomes canonical truth.

---

## 19. Four commercial truths

1. **Buyer Requested** — RFP/RFQ/IFB/addenda/Q&A  
2. **L&P Proposed** — final submitted proposal/pricing/forms  
3. **Buyer Awarded** — award notice/PO/executed contract  
4. **Current/Amended** — amendments/modifications/options/renewals  

Never collapse into one generic rate/value.

---

## 20. Source precedence

- Requirements: latest applicable addendum/official clarification > original solicitation  
- L&P submitted position: final submitted proposal/pricing > draft  
- Current terms: latest executed amendment/modification/option > executed contract/PO > award > proposal  
- Conflicts remain visible and auditable until resolved  

---

## 21. Provenance / verification

Every material fact should be traceable to document/version/page or sheet/cell/section/excerpt, extraction run, confidence, verification state, verifier/date.

States: `AI_EXTRACTED`, `NEEDS_REVIEW`, `HUMAN_VERIFIED`, `REJECTED`, `CONFLICT`.  
Unknown remains unknown.

---

## 22. Public research

Retain source URL/organization/document/publication/retrieval/page or section/verification/confidence. Unsourced AI summaries are not public intelligence truth.

---

## 23. Pricing principles

Dynamic structures: hourly, labor category, site/post/shift, fixed fee, NTE, base/options, escalation, OT/holiday, vehicle/equipment, travel/reimbursables, and other buyer formats.

Internal cost may include wage/fringe/H&W/payroll burden/workers comp/insurance/supervision/equipment/vehicle/travel/overhead/wage determination/target margin.

Comparables show included/excluded records and reasons, descriptive range/statistics, cost floor/threshold, confidence, and source evidence.

**FINAL PRICE = HUMAN DECISION REQUIRED.**

---

## 24. Past performance integrity

Never conflate: L&P Corporate Past Performance · Management Prior Experience · Key Personnel Experience · Subcontractor Experience.

---

## 25. Multi-tenant-ready architecture

L&P is the first tenant. From day one, tenant-owned records/files/retrieval/reports are isolated by organization/RLS. Future tenants are contracting companies. Their procurement buyers are **not** platform tenant users merely because they appear in records.

**Optional** future commercialization may add plans/seats/usage/Stripe without changing the procurement model. This is **separate from and does not define** the core product build.

---

## 26. Historical Pilot

Before declaring later features complete, validate approximately **20–30** materially different real procurement packages/doc sets.

Start with **verified public L&P records** and actual L&P proposals/contracts/POs/evaluations where obtainable. Supplement internal L&P files later. Use non-L&P security procurement documents only as **explicitly labeled test corpus** for missing document/schema types.

Pilot purpose: prove extraction, schema coverage, source precedence, provenance, verification UX, parser routing, and canonical promotion using real evidence.

Detail: [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md) · [pilot/PUBLIC_PACKAGE_QUEUE.md](pilot/PUBLIC_PACKAGE_QUEUE.md)

---

## 27. Product phases

1. Foundation  
2. Real-Document Historical Pilot  
3. Historical Ingestion & Migration  
4. Contract & Compliance Intelligence  
5. Buyer / Competitor / Market / Win-Loss Intelligence  
6. Search / Ask GPT / Reports / Automation  
7. Pricing Intelligence  
8. Response Builder / Submission / Result  

**Core operational platform is complete after Phase 8.**  
Optional future commercialization (Stripe / tenant admin / selling to other contracting companies) is **not** a core product phase.

Legacy engineering migration IDs may remain on SQL/scripts; they do **not** redefine product phase completion.

---

## 28. Finished-product definition

A user uploads a new solicitation. The platform preserves the source, extracts/structures the buyer request, requires human verification, creates the pursuit, identifies requirements, builds buyer/competitor/historical intelligence and Bid Strategy, checks compliance, supports evidence-backed pricing with human final decision, retrieves approved historical content, produces grounded response drafts with sources, flags missing L&P facts, tracks submission completeness, supports final proposal output, records the result/evaluation/award, creates or updates the contract, tracks service/commercial/change/renewal obligations, and feeds the verified outcome back into the next pursuit.

**That is the product.**
