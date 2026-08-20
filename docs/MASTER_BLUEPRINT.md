# Master blueprint — L&P Proposal & Contract Intelligence Platform

**Single authoritative product blueprint.** Supersedes earlier overlapping drafts.  
Operational detail: [BUILD_PLAN.md](BUILD_PLAN.md). Current state: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md). Phase naming: [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md).

---

## 1. What you are building

One internal application for the full lifecycle:

**Opportunity → RFP/RFQ → Requirements → Research → Pricing → Proposal → Submission → Win/Loss → Contract → Renewal**

Uses L&P historical data to make future bids better.

It must answer (from verified evidence only):

- What is this customer asking for?
- Have we bid them before? Did we win or lose? Why?
- What did we charge? What did competitors charge/win at?
- What proposal sections performed well? What should not be reused?
- What certifications/contracts are expiring?
- What pricing range is supported by evidence?
- Where did every recommendation come from?

**Not:** CRM, document dump, spreadsheet replacement, generic RFP tracker, chatbot, autonomous proposal writer, invented pricing.

---

## 2. Technology (five pieces)

| Technology | Job |
| --- | --- |
| **Google Drive** | Original PDFs, RFPs, proposals, contracts, awards, certifications — import source + human workspace |
| **Python** | Bulk reads/processes thousands of historical documents |
| **Parsers + AI** | Extract text, tables, requirements, pricing, metadata → **staging only** |
| **Supabase / PostgreSQL** | Authoritative structured database + search/vector intelligence |
| **Next.js on Vercel** | Interface L&P users work in |

```text
Google Drive (import / workspace)
        ↓
Python document-processing pipeline
        ↓
OCR / parsing / AI extraction
        ↓
Staging + validation
        ↓
Human verification
        ↓
Supabase / PostgreSQL (canonical)
        ↓
Custom Next.js application
```

**Google Sheets** — export, bulk QA, analysis later. **Not** a second independently editable source of truth.

### Approved architecture deviation (documented)

Original text emphasized Drive as the document store. **Locked implementation:** Supabase Storage is the **immutable-by-policy evidence vault**; Drive retains `source_drive_file_id` + checksum; Drive files are not deleted on import. See [TECH_STACK.md](TECH_STACK.md) and [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md).

**Additional locked upgrade:** Vercel Workflow orchestrates document lifecycle (not in original one-pager). Queues = optional fan-out only.

---

## 3. Six product engines

Navigation and roadmap must preserve these **functional engines**, not “one nav item per table.”

| # | Engine | Think |
| --- | --- | --- |
| 1 | **Opportunity / Solicitation** | What are we trying to win? RFPs, RFQs, IFBs, deadlines, values, services, go/no-go, assignments, source documents |
| 2 | **Contract & Compliance** | What have we won, what is it worth, what needs action before expiry? |
| 3 | **Pricing Intelligence** | What pricing does **evidence** support? (Not a generic calculator.) |
| 4 | **Client / Competitor Intelligence** | Who are we bidding to/against; what does history say? **First-class module.** |
| 5 | **Proposal Intelligence** | What verified content supports the response? Section-level reuse controls. |
| 6 | **Executive Analytics** | Pipeline, wins, contracts, compliance risk, pricing/competition — **verified data only** |

All engines sit on top of:

```text
VERIFIED HISTORICAL PROCUREMENT DATABASE
(staging → human verify → canonical promotion)
```

---

## 4. Pricing intelligence (non-negotiable separation)

Every solicitation can require a **different pricing structure**. Capture separately:

1. **Client-requested format** — hourly, labor schedule, base+fringe+OH+profit, per site/shift, monthly/annual, base+options, OT, equipment, NTE, etc.
2. **L&P internal cost** — labor, fringe, burden, WC, insurance, supervision, equipment, vehicle, overhead, wage determination, target margin
3. **L&P submitted price**
4. **Customer awarded / current contract price**

```text
CLIENT REQUESTED FORMAT  ≠  L&P INTERNAL COST  ≠  L&P SUBMITTED  ≠  AWARDED/CURRENT
```

**Recommendations:** evidence-based review range only — never “AI recommends $38/hr.” Show included/excluded comparables. **Final price = human decision.**

---

## 5. Four commercial truths (historical + live)

For every opportunity, store four separate realities:

| Truth | Typical sources |
| --- | --- |
| Customer requested | RFP, RFQ, addenda, Q&A |
| L&P proposed | Final submitted proposal, pricing sheet |
| Customer awarded | Award notice, PO, executed contract |
| Current contract | Amendments, modifications, renewals, options |

Example: proposed $35.00 → awarded $34.50 → amended $36.25 → current $36.25. **Not one field called “rate.”**

**Implemented today:** `pricing_lines.requested_rate`, `proposed_rate`, `awarded_rate`, `current_rate` + `documents.commercial_truth` + promotion RPC conflict detection.

---

## 6. Client / competitor intelligence (first-class)

**Competitors:** name, opportunity, customer, date, service, geography, submitted/awarded price, hourly rates, technical/price scores, rank, award result, certifications, **source record**.

**Client intelligence:** prior L&P bids, wins/losses, incumbent, awards, historical prices, solicitations, scoring criteria, evaluator comments, board/council docs, procurement records, budgets, expirations, priorities. **Every public fact has a source.**

**Buyer/agency is procurement intelligence — not CRM** (no lead nurture, contact cadence, customer portal).

---

## 7. Proposal intelligence

Historical proposals decomposed into sections (Staffing, Transition, Training, Past Performance, etc.). Each section stores: source proposal, client, opportunity, won/lost, evaluator score, source page, text, **reuse status**, human approval, embedding.

- Won ≠ automatically reusable  
- Lost ≠ worthless (loss analysis)  
- `DO_NOT_USE` never enters **drafting** retrieval  

---

## 8. Historical migration (before intelligent drafting)

```text
Drive files → inventory → dedupe/versions → classify → group by opportunity
→ extract → AI structure → STAGING → cross-validate → HUMAN VERIFY → CANONICAL → chunks/embeddings
```

**AI extraction does not automatically become trusted data.**

---

## 9. New RFP workflow (finished product)

```text
NEW RFP → read solicitation → extract requirements + pricing format → human verify
→ research buyer → L&P history → prior wins → prior losses → competitors/awards
→ BUILD BID STRATEGY → compliance check → pricing evidence → HUMAN FINAL PRICING
→ retrieve approved content → generate drafts → human edit → requirement validation
→ executive approval → final proposal → submit → capture award/loss → feed intelligence
```

**Bid Strategy** is an explicit product output/workspace — not an implicit side effect of search.

---

## 10. Proposal drafting screen (Phase 9 target)

Split view: client requirement ↔ draft response; scoring ↔ sources; prior history ↔ actions (edit, regenerate, approve, show evidence).

---

## 11. Final proposal output

```text
In-app intelligence / drafting → Google Docs working proposal → final procurement output
```

Outputs: Google Doc, PDF, DOCX, portal fields, pricing workbook, copy/paste. **Google Docs is the collaborative handoff** — Tiptap/Novel patterns are in-app UX only, not a replacement for Docs collaboration.

---

## 12. Executive dashboards (five areas)

1. **Pipeline** — active opportunities, due dates, pipeline $, submitted $, waiting on pricing/approval  
2. **Contracts** — active value, expiring 30/60/90/180, renewal value at risk, options, rebids  
3. **Compliance** — expired/expiring licenses, insurance, certifications, SAM/GSA/TXMAS, missing docs  
4. **Win/Loss** — win rates (evidence-backed), by customer/service/geo/size/type, loss reasons, evaluator weaknesses  
5. **Pricing/Competition** — winning/losing rate trends, competitor pricing, margin scenarios, price bands vs outcomes  

**Never fabricate KPIs to fill empty UI.**

---

## 13. Build order (original — do not reorder for demos)

| Original phase | Name | Product milestone |
| --- | --- | --- |
| **1** | Foundation | Supabase, schema, auth, Drive refs, document registry, staging/verification |
| **2** | **Historical pilot** | **20–30 real L&P packages validate the data model** |
| **3** | Historical ingestion | Automated pipeline + migrate remaining history |
| **4** | Contract/compliance | Contracts, renewals, expiration alerts, certifications |
| **5** | Analytics | Win/loss, pricing, competitor, contract dashboards |
| **6** | Search/AI | Embeddings, semantic search, historical retrieval |
| **7** | Pricing intelligence | Dynamic client pricing + internal cost + comparables (Glide) |
| **8** | Proposal builder | Evidence-backed generation + Google Docs path |

**Do not start with the proposal generator.**

Map to repo engineering IDs: [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md).

---

## 14. Current honest status (original phase meanings)

| Original phase | Status |
| --- | --- |
| **1 — Foundation** | **Mostly complete** — see [PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md) |
| **2 — Historical pilot** | **NOT STARTED** (0 L&P packages) |
| **3 — Historical ingestion** | **NOT STARTED** (no production corpus migration) |
| **4–8** | Engineering artifacts exist early for some areas — **unvalidated**; see [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) |

**Wrong statement to avoid:** “Phase 2 complete because RLS passed.” Tenant isolation is **Foundation**, not Historical Pilot.

---

## 15. Questions the platform must answer for a new RFP

From verified evidence only: requirements, deadlines, submission method, pricing structure, evaluation criteria, staffing/services, certifications/insurance, wage determination, prior bids with this buyer, win/loss, proposed vs awarded vs current terms, competitor evidence, evaluator comments, approved vs blocked reuse, compliance expirations, comparable pricing with include/exclude reasons, missing information, and **source for each answer**.

See [PRODUCT_SPEC.md](PRODUCT_SPEC.md).
