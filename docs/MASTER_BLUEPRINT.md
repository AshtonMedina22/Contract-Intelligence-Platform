# Master blueprint — L&P Proposal, Contract & Procurement Intelligence

**This is the authoritative BUSINESS PRODUCT blueprint.** It does not redefine the locked tech stack.

| Concern | Document |
| --- | --- |
| **Business / product truth** | **This file** |
| Technical architecture | [TECH_STACK.md](TECH_STACK.md) |
| Current reality vs required | [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) |
| Living session trail | [WORK_TRAIL.md](WORK_TRAIL.md) |
| Execution order | [BUILD_PLAN.md](BUILD_PLAN.md) |
| Phase naming | [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md) |
| Long-form merged spec | [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md) |

Do not treat a route, table, or early Intelligence screen as phase completion.

---

## 1. Product purpose

One **internal** Proposal, Contract & Procurement Intelligence Platform. It uses **L&P historical procurement data** to improve **future bids**.

### Full lifecycle

```text
Historical Procurement Records
→ Opportunity
→ RFP / RFQ / IFB / quote / task order
→ Requirements
→ Research
→ Pricing
→ Proposal
→ Submission
→ Win/Loss
→ Contract
→ Amendments
→ Options / Renewal / Rebid
→ result feeds future intelligence
```

### This is NOT

- CRM
- client portal / customer self-service
- generic document repository
- simple RFP tracker
- generic chatbot
- autonomous pricing engine
- autonomous proposal writer

`clients` = buyer / agency procurement intelligence, never a sales account.

---

## 2. Central product loop

```text
Historical documents
→ extraction (staging only)
→ reconciliation / validation
→ human verification
→ canonical intelligence
→ new-bid intelligence
→ outcome capture
→ historical intelligence grows
```

AI never auto-promotes extraction to canonical truth.

---

## 3. Six product engines

Navigation must map **to** these engines. Ingestion is the feed, not a seventh product module.

### A. Opportunity / Solicitation

**Purpose:** Run the current pursuit: what the buyer asked, when it is due, whether L&P will bid, and what packet is required.

**Capabilities:** RFP/RFQ/IFB/quote/task order/rebid; deadlines; submission method; estimated value when evidenced; services; staffing; evaluation criteria; go/no-go; assignments; source documents; missing-packet list.

**Historical intelligence:** prior packages with this buyer, similar service, and outcome.

### B. Contract & Compliance

**Purpose:** What L&P won, what it is worth now, and what expires.

**Capabilities:** executed terms, amendments, options, renewals, rebids, certifications, insurance, SAM/GSA/TXMAS, 180→expired alerts.

**Historical intelligence:** prior POP, amendments, and rebid lineage.

### C. Pricing Intelligence

**Purpose:** What pricing **evidence** supports. Not a calculator that invents a bid.

**Capabilities:** customer-required format; internal cost model; submitted vs awarded vs current; comparables with include/exclude; ranges; Glide workbench (canonical Phase 8). **Final price = human.**

**Historical intelligence:** verified four-truth lines, wage/cost facts, competitor awards.

### D. Buyer / Market / Competitor Intelligence

**Purpose:** Who we bid to and against, with sources. No unsupported causation.

**Capabilities:** buyer history, incumbents, bid tabs, budgets, board/council records, competitor bids/scores/rank/geo/service, market patterns, upcoming rebids.

**Historical intelligence:** only HUMAN_VERIFIED promotion and sourced research facts.

### E. Proposal Intelligence

**Purpose:** Section-level reuse of verified content. RAG is infrastructure, not this engine.

**Capabilities:** taxonomy (Staffing, Transition, Training, Recruiting, Management, Technology, QC, Emergency Response, Past Performance, …); source page; outcome; evaluator score; verification; reuse state; approvals; grounded drafting; Google Docs handoff (canonical Phase 9).

**Historical intelligence:** approved vs `DO_NOT_USE` vs superseded sections.

### F. Executive / Business Intelligence

**Purpose:** Pipeline, contracts, compliance risk, win/loss, pricing/competition — **verified data only**. Never fake KPIs.

**Historical intelligence:** same canonical store; empty corpus ⇒ empty dashboards.

---

## 4. Four commercial truths

Never collapse or overwrite:

| Truth | Typical sources |
| --- | --- |
| **CUSTOMER REQUESTED** | RFP, RFQ, addenda, Q&A |
| **L&P PROPOSED** | Final submitted proposal / pricing sheet |
| **CUSTOMER AWARDED** | Award notice, PO, executed contract |
| **CURRENT / AMENDED** | Amendments, modifications, renewals, options |

Example: proposed $35.00 → awarded $34.50 → amended $36.25. Not one field named “rate.”

---

## 5. Complete new-RFP workflow (finished product)

```text
New RFP
→ extraction
→ human verification
→ buyer research
→ prior L&P history
→ prior win analysis
→ prior loss analysis
→ competitor / prior award analysis
→ BID STRATEGY
→ compliance readiness
→ pricing evidence
→ HUMAN PRICING DECISION
→ approved content retrieval
→ grounded drafting
→ human editing
→ requirements validation
→ operations / content approval
→ pricing approval
→ compliance approval
→ executive approval
→ final proposal
→ submission
→ outcome capture
→ scorecard / evaluator feedback
→ intelligence update
```

**Bid Strategy** is an explicit product output, not a side effect of search.

Ingestion that exists today (intake → extract → stage → verify → some promotion) is the **engine room**, not this operating workflow.

---

## 6. Pricing intelligence principles

```text
customer-required pricing format
≠ internal L&P cost
≠ submitted pricing
≠ awarded pricing
≠ current amended pricing
```

Formats are dynamic (hourly, labor schedule, site/shift, monthly, base+options, OT, equipment, NTE, SCA WD, etc.).

**Evidence:** comparable wins, losses, same buyer, similar buyer, competitor awards, wage/cost, geography, staffing, contract size, recency.

**Output:** included/excluded records, reasoning, statistics/range, confidence, sources.

**Final pricing: HUMAN DECISION REQUIRED.** Never “AI recommends $X/hr.”

---

## 7. Buyer / market / competitor intelligence

**Buyer / agency:** prior solicitations, L&P bid history, awards, incumbents, pricing, evaluator behavior, bid tabs, budgets, board/council records, procurement plans, expiration/options/rebids.

**Competitor:** bids, awards, pricing, technical/price scores, rank, services, geography, source evidence.

**Market:** pricing trends, competitor presence, win/loss patterns, evaluator patterns, upcoming rebids.

No unsupported causation. Counts of documents are not market facts.

---

## 8. Ask Intelligence

Ask is a **product surface**, not the application architecture.

| Mode | Meaning |
| --- | --- |
| **LOCATE** | Records, documents, contracts, proposals via structured + full-text retrieval. No LLM required. |
| **ASK / ANALYZE** | Grounded analysis using structured + semantic retrieval, with citations. |

Purpose-aware retrieval:

- **Loss analysis** may see losing / `DO_NOT_USE` material.
- **Drafting** must **not** use `DO_NOT_USE` material.

---

## 9. AI report outputs (evidence-backed only)

- Bid Strategy Report
- Buyer Intelligence Brief
- Market Intelligence Report
- Competitor Intelligence Report
- Pricing Intelligence Report
- Win/Loss Analysis
- Proposal Improvement / Evaluator Analysis
- Executive Intelligence Brief

Withhold or show empty when evidence is missing. Do not invent.

---

## 10. Proposal intelligence (section-level)

Examples: Staffing, Transition, Training, Recruiting, Management, Technology, Quality Control, Emergency Response, Past Performance.

Track: source proposal, source page, outcome, evaluator score, verification, reuse status, approval.

Reuse states:

- `APPROVED`
- `REVIEW_REQUIRED`
- `DO_NOT_USE`
- `SUPERSEDED`

**WON does not automatically mean approved. LOST does not automatically mean unusable.**

Verified chunk search + embeddings + Ask ≠ this engine. That requires a `proposal_sections` (or equivalent) business model.

---

## 11. Proposal output

```text
In-app intelligence / drafting
→ Google Docs collaborative working proposal where appropriate
→ required procurement output
```

Outputs may include: Google Doc, PDF, DOCX, portal response, pricing workbook, copy/paste.

---

## 12. Historical-pilot-first build order

| Canonical phase | Name |
| --- | --- |
| **1** | Foundation |
| **2** | **Historical Pilot** (20–30 complete L&P packages) |
| **3** | Historical ingestion / processing |
| **4** | Broader migration |
| **5** | Contracts / compliance |
| **6** | Analytics / market / buyer / competitor |
| **7** | Search / RAG / Ask |
| **8** | Pricing Intelligence |
| **9** | Proposal Builder |

Do not start with the proposal generator. Do not reorder for demos.

Original blueprint phases 1–8 map here via [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md). Legacy engineering IDs 0–14 stay on migrations only.

### CURRENT POSITION

- **Canonical Phase 1 — Foundation:** mostly built. Login Partial Prerender fix is on `main`. Local `npm run build` is green. Vercel production **build** has been green since that fix (`8d083a5` / `213f951` and later). Live **data** still needs Supabase env + applied migrations + a signed-in org.
- **Canonical Phase 2 — Historical Pilot: NOT STARTED.**
- **0 real complete L&P procurement packages validated.**
- Later-phase UX/code exists early (Ask, Market, Reports, opportunity workspace tabs, planning cost model). **KEEP + FREEZE** Intelligence expansion until the pilot validates the corpus. Early ops UI does **not** complete Phases 8–9.

Snapshot: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md). Trail: [WORK_TRAIL.md](WORK_TRAIL.md).

---

## 13. Questions the finished product must answer (new RFP)

From **verified evidence only**: requirements, deadlines, submission method/forms, required pricing structure, evaluation criteria, staffing/services, certifications/insurance, wage determination, prior bids with this buyer, win/loss, proposed vs awarded vs current terms, competitor evidence, evaluator comments, approved vs blocked reuse, compliance expirations, comparable pricing with include/exclude reasons, missing information, and **the source that supports each answer**.

---

## 14. Locked technical architecture (pointer only)

Do not redefine here. [TECH_STACK.md](TECH_STACK.md) and [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) own:

Supabase Storage vault (immutable-by-policy), Vercel Workflow lifecycle, JobPort, Supabase Cron for expirations, PDF.js, openpyxl, AI Gateway abstraction, pgvector in Postgres.

Approved deviation from older Drive-as-vault wording: Drive remains import + human workspace; Storage is the ingested original.
