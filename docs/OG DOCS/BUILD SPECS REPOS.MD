The useful version should look like this.

## Exact repo → what to borrow → where it goes in YOUR platform

| Public repo                          | **Specifically borrow / adapt**                                                                                                                                                                                                                    | Put it in your platform here                                                                             | Use code or just reference?                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **RFPilot**                          | RFP document → structured requirement extraction; deadline/evaluation/compliance extraction; capability-to-requirement matching; gap detection; response generation workflow; DOCX output patterns; audit/activity patterns                        | **Pursuit → Requirements**, **Response**, **Submission**, processor extraction schemas                   | **Adapt code/patterns** — MIT                               |
| **AutoRFP**                          | Project/RFP workspace structure; document knowledge sources; question extraction; answer-generation jobs; per-answer sources; source relevance; answer editing; organization isolation patterns                                                    | **Pursuit workspace**, especially **Requirements → Response → Evidence**                                 | **Adapt code/patterns** — MIT                               |
| **OpenContracts / cite**             | PDF text-coordinate mapping; selecting/highlighting source text; annotation objects; exact-page provenance; human review/annotation workflow; corpus/document versioning; extraction job architecture; vector + lexical search over annotated docs | **Data Ops → Verification**, source evidence drawer, `source_evidence`, document viewer, citation system | **Very strong code/reference source** — MIT                 |
| **Docling**                          | Normalized document object; page/layout hierarchy; tables; reading order; parser results with coordinates; OCR fallback; PDF/DOCX/XLSX handling                                                                                                    | Python **processor → parsers / normalized document representation**                                      | **Use library directly + adapt examples**                   |
| **Unstructured**                     | File-type dispatch; partitioning strategies; chunking strategies; metadata-preserving elements; preprocessing/cleanup pipeline; document-type-specific routing                                                                                     | Python **processor**, especially alternative parser route and RAG chunk production                       | **Benchmark + selective adaptation** — Apache               |
| **TenderRadar**                      | **Source-adapter architecture**; one adapter per procurement service; scheduled syncing; dedupe/upsert of opportunities; common normalized tender representation; filters by source/category/location/deadline; opportunity matching               | **Public Research / Buyer & Market Intelligence**, future public-opportunity discovery                   | **Adapt architecture/code where useful**                    |
| **OpenSAM**                          | SAM.gov request construction; pagination; NAICS filters; solicitation normalization; federal opportunity search UI; semantic opportunity matching concepts                                                                                         | **Government procurement research**, especially SAM.gov acquisition                                      | **Selective borrowing**                                     |
| **OCDS / Open Contracting Standard** | **Data vocabulary**, not application UI: tender, award, contract, implementation, amendment, parties/buyers/suppliers, identifiers, documents, milestones                                                                                          | Normalized **external procurement research schema** before promotion into your canonical tables          | **Schema/reference only**                                   |
| **USAspending API**                  | Federal award search/filter structure; recipient lookup; agency hierarchy; award IDs; NAICS/PSC; award values; dates; contract records; pagination/filtering conventions                                                                           | **Buyer / Competitor / Federal Market Intelligence**                                                     | Primarily **call/use the data**, borrow normalization ideas |
| **USAspending MCP Server**           | Prebuilt tools such as award search, recipient search, agency lookup, award detail and spending aggregation; tool input/output schemas                                                                                                             | Your future `public_research` / Ask-GPT **tool layer**                                                   | **Potentially reuse directly/adapt** — Apache               |
| **Public-Sector CLM**                | Contract entity relationships; obligation tracking; approval/audit model; amendment lineage; renewal lifecycle; contract event history; RBAC concepts                                                                                              | **Contracts → Commercial Terms / Changes / Renewal**                                                     | **Design/schema reference only**                            |
| **Whereas**                          | Contract intake/triage UX; contract record workspace; document-version timeline; review findings; approval surfaces; clause deviation/remediation UX                                                                                               | **Contracts workspace** and possibly Data Ops intake/review UX                                           | **Reference only** — AGPL                                   |
| **Wraft**                            | Structured document templates; reusable content blocks; document-generation pipeline; template → content → output lifecycle; collaboration/version ideas                                                                                           | **Response → Submission**, document/export generation                                                    | **Reference only** — AGPL                                   |
| **Glide Data Grid**                  | Custom editable cells; numeric/currency cells; validation feedback; frozen identifying columns; keyboard navigation; row selection; bulk paste; large-grid performance; custom renderers; cell update/invalidation                                 | Your existing `pricing-glide-grid.tsx` and **Pursuit → Pricing**                                         | **Use the actual library/examples** — MIT                   |
| **Novel**                            | Tiptap editor composition; bubble menu; slash commands; AI contextual actions; editor loading/saving; command UX; contextual rewrite/expand behavior                                                                                               | Existing **Pursuit → Response** Tiptap editor                                                            | **Adapt components/patterns** — Apache                      |
| **Morphic**                          | Search query → tools → results → cited answer flow; source cards; inline citations; streaming; provider abstraction; multiple search backends; research result UI; follow-up UX                                                                    | **Find/Ask GPT**, **Buyer Research**, **Competitor Research**, source presentation                       | **High-value code/pattern adaptation** — Apache             |
| **Open Deep Research**               | Query planning; research subquestions; parallel searches; iterative search; source dedupe; evidence compression; research state; final sourced synthesis                                                                                           | **Public Research engine** behind Buyer/Competitor/Bid Strategy reports                                  | **Borrow orchestration concepts/tool interfaces** — MIT     |
| **WrenAI**                           | Semantic model over relational DB; metrics/business definitions; approved relationships/joins; NL→SQL planning; query validation; governed SQL execution; explain generated SQL                                                                    | **Ask GPT structured-data analysis** and future Executive/Business Intelligence                          | **Adapt architecture; don't replace Supabase** — Apache     |

That is the list I should have given you.

---

# More importantly: what I would actually steal first

There are a few areas where your repo would benefit **materially right now** from existing implementations.

### 1. OpenContracts → your Verification system

This may save you the most custom engineering on the **Data Ops** side.

Borrow:

```text
Document
    ↓
page/text coordinates
    ↓
annotation / selected evidence
    ↓
structured extracted value
    ↓
human verify / correct / reject
    ↓
source-linked ground truth
```

Your platform requires exact provenance and human verification; that's a first-class requirement in your product, not secondary functionality. 

I would compare OpenContracts directly against your:

```text
source_evidence
extracted_facts
verification_events
document_chunks
PDF viewer
View Source
```

and identify pieces you can stop reinventing.

---

### 2. RFPilot + AutoRFP → your Pursuit/Response workflow

Don't use either one as your whole platform.

Use them as a giant pile of working examples for:

```text
UPLOAD RFP
↓
extract questions/requirements
↓
organize response work
↓
find supporting knowledge
↓
show supporting sources
↓
generate response
↓
human edit
↓
produce output
```

Your product goes considerably further into pricing, outcomes, contracts and historical intelligence, but that **core proposal-response mechanism already exists publicly**.

Your previous list identified both as the closest RFP-specific references. 

---

### 3. TenderRadar + OpenSAM + USAspending → your PUBLIC PROCUREMENT engine

This should become a combined reference architecture.

Instead of Cursor inventing:

```text
search government stuff somehow()
```

build:

```text
PublicProcurementProvider

├── SamGovProvider
├── UsaSpendingProvider
├── StateProcurementProvider
├── LocalGovernmentProvider
├── ManualWebResearchProvider
└── FutureOtherProvider
```

Each returns a normalized object:

```text
source
source_record_id
source_url

buyer
solicitation_number
title
procurement_type

posted_date
due_date
award_date

NAICS
PSC

vendor
awardee
award_amount

contract_number
period_of_performance

documents[]

retrieved_at
```

Then:

```text
EXTERNAL SOURCE
      ↓
public_sources / research run
      ↓
research facts
      ↓
verification/provenance
      ↓
buyer / competitor / market intelligence
```

**That** is what I mean by borrowing TenderRadar/OCDS/USAspending—not merely “look at them.”

---

### 4. OCDS → stop inventing procurement terminology unnecessarily

Not your business schema.

Your **external normalization layer**.

For example:

```text
OCDS idea                 YOUR DOMAIN

Tender                  → Solicitation / Pursuit
Tenderer                → Bidder
Award                   → Award
Supplier                → Awarded competitor/vendor
Contract                → Contract
Amendment               → Change
Implementation          → Current-performance evidence
Buyer                   → Buyer / Agency
Milestone               → Deadline / lifecycle event
Document                → Source evidence
```

Then your L&P-specific schema adds things OCDS doesn't know about:

```text
L&P proposed
internal cost
evaluator weakness
reuse status
proposal response
L&P_INPUT_REQUIRED
human price decision
etc.
```

---

### 5. Public-Sector CLM + Whereas → your Contracts area

Not to create a generic legal CLM.

Use them to audit whether you've forgotten established contract-lifecycle mechanics:

```text
Contract
├── Parties
├── Terms
├── Service obligations
├── Commercial terms
├── Documents/versions
├── Approval history
├── Amendments
├── Obligations
├── Notices
├── Options
├── Renewal
├── Termination
├── Compliance
└── Audit trail
```

Then preserve your domain-specific structure:

```text
Overview
Service Plan
Commercial Terms
Changes
Renewal
```

Your current repo already implements precisely those contextual contract workspaces. 

So here we're mostly **hardening**, not rebuilding.

---

### 6. Glide → your Pricing UI

This one should be extremely concrete.

Before writing any custom grid behavior, look for an existing Glide implementation of:

```text
currency cell
percentage cell
dropdown cell
custom validation
read-only cell
computed cell
paste range
multi-row selection
frozen column
row groups
column resizing
keyboard nav
cell tooltip
context menus
custom header
footer/summary
```

Then adapt those implementations into:

```text
pricing-glide-grid.tsx
pricing-workbench.tsx
```

Your previous output mentioned these capabilities, but I should have explicitly said **mine Glide's examples instead of hand-coding them**. 

---

### 7. Novel → your Response editor

Same concept.

Don't let Cursor manually invent:

* slash commands
* selection menus
* AI edit menu
* editor toolbar behavior
* keyboard commands
* bubble menus
* streaming AI insertion
* rich block interactions

Novel already solved that layer.

**Your custom work should be around the editor:**

```text
LEFT
Requirements

CENTER
Novel/Tiptap-derived editor

RIGHT
Evidence
Sources
Historical answers
Evaluator feedback
Missing information
Reuse status
```

---

### 8. Morphic → Ask GPT **AND** public research UX

There are actually two borrow targets here.

**Ask GPT:**

```text
question
↓
tool/search state
↓
streaming response
↓
citation objects
↓
source cards
↓
follow-up
```

**Research:**

```text
research query
↓
multiple sources
↓
fetch results
↓
source extraction
↓
synthesis
↓
citation-rich research report
```

You need both.

Your current Ask implementation is weak largely because it's still essentially retrieve-once → generate-once. Morphic gives you an example of what the **interaction layer** should feel like.

---

### 9. Open Deep Research → the engine behind “Research this buyer”

This is different from Morphic.

Morphic helps with the **answer/search experience**.

Open Deep Research gives you patterns for:

```text
Research Dallas ISD for this bid
          ↓
plan research
          ↓
┌─────────┼───────────┐
↓         ↓           ↓
awards   board docs   budgets
↓         ↓           ↓
contracts incidents   procurement
└─────────┼───────────┘
          ↓
dedupe sources
          ↓
extract useful facts
          ↓
synthesize findings
          ↓
save sources + facts
```

That's extremely relevant to your envisioned **Bid Strategy / Buyer Intelligence** engine.

---

### 10. WrenAI → structured intelligence questions

You shouldn't use RAG for:

> “How many ISD security bids did we lose in 2025?”

or:

> “What is the median awarded armed rate for North Texas ISDs?”

Those should become:

```text
question
↓
semantic business model
↓
validated SQL
↓
Supabase/Postgres
↓
actual result
↓
optional LLM explanation
```

Borrow from WrenAI:

```text
Metric definitions
Entity relationships
Allowed joins
Dimensions
Business terminology
SQL validation
Result explanation
```

Not its entire database stack.

---

# And then there are the parser repos

### Docling

Use its implementation directly where it proves good enough for:

```text
PDF
DOCX
XLSX
tables
headings
layout
coordinates
reading order
```

### Unstructured

Use it as the **second implementation to benchmark against** for:

```text
partitioning
document cleanup
metadata
chunk generation
type-specific processing
```

Your provider abstraction should mean you can do:

```text
DocumentParser

DoclingParser
UnstructuredParser
MistralOcrParser
NativePdfParser
...
```

without rewriting downstream extraction.

---

# What NOT to copy

Three categories:

**Reference only because of licensing:**

* Whereas — AGPL
* Wraft — AGPL
* Public-Sector CLM — no normal permissive OSS license identified

**Don't replace your architecture with:**

* OCDS
* USAspending
* WrenAI
* Morphic
* Open Deep Research

They solve **pieces**, not your product.

**Most directly reusable/adaptable:**

* RFPilot
* AutoRFP
* OpenContracts
* TenderRadar
* USAspending MCP
* Glide
* Novel
* Morphic
* Open Deep Research
* Docling
* Unstructured

So yes: **your instinct was correct.** The last answer identified the right neighborhood of repos, but it did **not** consistently go the final mile of saying exactly what Cursor should inspect and transplant from every one. This matrix is the actual **repo → borrowable subsystem → destination in your codebase** plan.
