# Master product context

**Canonical long-form spec for the L&P Proposal, Contract & Procurement Intelligence Platform.**

This file lives in git so it is available on any computer after clone/push. It supersedes Downloads-only drafts.

- Source merged: L&P Master Product Context — Final Updated 2026-08-19 (Downloads).
- Earlier draft filenames LP SETUP DRAFT.md and LP_MASTER_PRODUCT_CONTEXT_FINAL_UPDATED_2026-08-19.md were not present in Downloads at merge time.
- Locked architecture (Workflow, Storage-by-policy, Cron split, Excel/PDF, repo layout, pricing wording) is applied below. If an older paragraph still says Drive is the permanent vault or Queues are the lifecycle coordinator, the **Locked architecture** section wins.
- Operational checklist: [BUILD_PLAN.md](BUILD_PLAN.md). Short stack: [TECH_STACK.md](TECH_STACK.md).

**Do not start coding from this file until [BUILD_PLAN.md](BUILD_PLAN.md) Phase 1 is explicitly approved.** Understanding the product still comes first.

## Locked architecture (wins over any older wording in this file)

### Product

Verified procurement operating system. Historical files become staged, source-backed facts. Humans verify. Only then: contracts, four commercial truths, pricing evidence, grounded drafts. AI never auto-promotes to canonical.

Four truths, never collapsed: customer requested / L&P proposed / customer awarded / current contract.

### Document lifecycle

```text
UPLOAD / IMPORT
        ->
Supabase Storage
CANONICAL IMMUTABLE-BY-POLICY SOURCE COPY
        ->
Vercel Workflow
intake -> parse -> extract -> validate -> wait for human -> promote
```

Vercel Queues = optional fan-out only (embeddings, notifications, independent jobs). Keep a JobPort. No LangGraph. No eve.

### Evidence vault

Supabase Storage is the canonical **immutable-by-policy** ingested evidence vault. It is not magically WORM.

Path:

```text
org_id/document_id/version_id/sha256/original.<ext>
```

Never overwrite an original evidence object. New source file = new document_version + new object. Checksum before processing. Normal users cannot update/delete originals. Privileged delete/change requires an auditable privileged workflow. RLS enforces tenant ownership.

Google Drive = import/source + human workspace. Retain Drive file ID + SHA-256. Do not delete Drive files.

### Compute, cron, parsers

- Cloud Run Jobs: documented; deploy only at bulk migration (Phase 8).
- Supabase Cron / pg_cron: contract, renewal, compliance SQL (180/120/90/60/30/expired).
- Vercel Cron: later, application-level jobs only (syncs, digests). Failed Vercel Cron invocations are not retried.
- PDF.js source-page viewer in the verification workbench.
- Native XLSX via openpyxl (structure/cells/formulas). Do not OCR clean workbooks first.
- Do not lock OCR or model provider until the L&P benchmark.

### Repo

```text
apps/web
services/processor
packages/shared
packages/schemas
supabase/migrations
```

pnpm (or npm workspaces if pnpm is unavailable) for JS. Python owns pyproject.toml. Node 24 is Vercel default for new projects. `vercel.ts` is optional — do not create it in Phase 1 unless configuration-as-code is needed.

### Workflow cost (snapshot, recheck before bulk)

- Hobby: 50K Workflow events/month included.
- Pro: Workflow events usage-based (about $20 per 1M currently). Pro is $20/month and includes $20 general infrastructure credit that can absorb usage before extra charges.
- Do **not** claim Workflow automatically incurs separately billed Queue API operations unless Vercel billing docs say so. Functions still bill as compute.

---

# ---

**MASTER PRODUCT CONTEXT — L\&P Proposal, Contract & Procurement Intelligence Platform**

## **Before implementing anything**

Understand the complete product described below.  
**Do not start coding yet.**  
Your first responsibility is to understand:

> * what the finished product is;  
> * the business problem it solves;  
> * the full feature set;  
> * the data architecture;  
> * the technology/framework stack;  
> * ingestion and verification rules;  
> * AI/RAG architecture;  
> * pricing rules;  
> * contract lifecycle;  
> * proposal-generation rules;  
> * multi-tenancy;  
> * implementation sequence.

After reading this specification:

> 1. inspect the existing repository;  
> 2. identify what foundation already exists;  
> 3. create/update the canonical project documentation;  
> 4. identify conflicts or missing architectural decisions;  
> 5. recommend the minimum next implementation phase;  
> 6. **STOP before implementing.**

# ---

**1\. What I Am Building**

I am building a long-term **Proposal, Contract & Procurement Intelligence Platform**, initially for L\&P Global Security.  
It may later evolve into a **multi-tenant commercial PaaS** for organizations managing complex procurement and proposal lifecycles.  
The complete lifecycle is:  
**Historical Documents → Opportunity → RFP/RFQ/IFB → Requirements → Research → Pricing → Proposal → Submission → Win/Loss → Award → Contract → Amendments/Modifications → Options/Renewal → Rebid**  
The platform converts years of paper and digital procurement records into:  
**verified \+ source-backed \+ searchable \+ reusable structured intelligence.**  
This is **not**:

> * a generic CRM;  
> * a simple document repository;  
> * a spreadsheet replacement;  
> * a basic RFP tracker;  
> * a generic chatbot;  
> * an autonomous proposal writer;  
> * an AI that invents pricing;  
> * a system that blindly reuses old proposal language.

The core product is an **auditable procurement-intelligence platform with AI operating on top of verified business data**.

# ---

**2\. Primary Business Problem**

L\&P has information distributed across:

> * paper files;  
> * scans;  
> * PDFs;  
> * Word files;  
> * spreadsheets;  
> * RFPs/RFQs/IFBs;  
> * addenda;  
> * Q\&A;  
> * proposal drafts;  
> * final proposals;  
> * pricing schedules;  
> * awards;  
> * bid tabs;  
> * evaluator scorecards;  
> * purchase orders;  
> * contracts;  
> * amendments;  
> * modifications;  
> * renewals;  
> * licenses;  
> * insurance;  
> * certifications;  
> * resumes;  
> * personnel qualifications;  
> * past-performance records;  
> * public procurement records.

The platform must determine:

> * which client owns the information;  
> * which procurement opportunity/package it belongs to;  
> * document type;  
> * document version;  
> * what the customer requested;  
> * what L\&P proposed;  
> * what the customer awarded;  
> * what changed afterward;  
> * what is currently effective;  
> * whether L\&P won/lost/no-bid/pending;  
> * pricing submitted;  
> * pricing awarded;  
> * competitor pricing when evidenced;  
> * evaluator feedback;  
> * active contract terms;  
> * expirations and renewals;  
> * strong historical proposal content;  
> * content that should not be reused;  
> * the source supporting every important fact.

The first engineering priority is therefore:  
**Historical digitization → extraction → staging → validation → human verification → canonical data**  
Proposal generation is downstream.

# ---

**3\. FINAL Production Architecture & Locked Tool Stack**

The architecture is now locked at the **platform/framework level**. The document parser and AI model are intentionally provider-abstracted because actual L\&P document accuracy must be benchmarked before one provider is designated as the production default.  
PAPER \+ DIGITAL DOCUMENTS  
PDF / DOCX / XLSX / scans / forms / pricing matrices  
        ↓  
CANONICAL IMMUTABLE-BY-POLICY EVIDENCE VAULT
Supabase Storage
(org/document/version/sha256/original.ext)
        ↓
GOOGLE DRIVE
import/source + human workspace (retain Drive ID; do not delete)
        ↓
DOCUMENT INTAKE
upload/import into Storage  
        ↓  
DOCUMENT REGISTRY  
Supabase PostgreSQL  
        ↓  
VERCEL WORKFLOW (lifecycle)
intake → parse → extract → validate → wait for human → promote
        ↓  
QUEUES (optional fan-out only)
embeddings / notifications / independent jobs  
        ↓  
PYTHON PROCESSING SERVICE  
FastAPI \+ Pydantic  
        ↓  
DOCUMENT PARSER ADAPTER  
├── XlsxParser (openpyxl; not OCR first)  
├── Docling  
├── Mistral OCR 4  
├── Google Document AI  
└── Native multimodal PDF/model route  
        ↓  
NORMALIZED DOCUMENT REPRESENTATION  
layout \+ page \+ table \+ cell \+ text \+ source coordinates  
        ↓  
STRUCTURED EXTRACTOR  
model/provider abstraction  
        ↓  
STAGING  
extracted\_facts \+ source\_evidence  
        ↓  
AUTOMATED VALIDATION / RECONCILIATION  
        ↓  
HUMAN VERIFICATION  
        ↓  
SUPABASE POSTGRESQL  
CANONICAL SYSTEM OF RECORD  
        ↓  
────────────────────────────────────────  
Contracts / Renewals / Compliance  
Win-Loss / Client / Competitor Intelligence  
Pricing Intelligence  
Structured Search / Full-Text Search  
pgvector Semantic Search / Hybrid RAG  
Analytics / Natural-Language Data Analysis  
Proposal Builder / Evidence-Backed AI

## **Final framework / systems**

| Layer | Final choice | Purpose / rule   |
| :---- | :---- | :---- |
| **Base application** | **Vercel Supabase Starter** | Starting project architecture |
| **Web framework** | **Next.js App Router \+ React \+ TypeScript** | Main production application |
| **Hosting** | **Vercel** | Web app, server routes/actions, light async consumers |
| **UI system** | **Tailwind CSS \+ shadcn/ui \+ Lucide** | One consistent enterprise UI system |
| **Normal data tables** | **TanStack Table** | Opportunities, documents, requirements, contracts, compliance, intelligence |
| **Spreadsheet-style workbenches** | **Glide Data Grid** | Pricing matrices, bulk data editing, cost models, competitor pricing, high-density QA where cell editing is genuinely useful |
| **Client/server state** | **TanStack Query** | Interactive server-state, polling/refresh, processing states |
| **Forms / schema validation** | **React Hook Form \+ Zod** | Structured forms and frontend validation |
| **Rich proposal editor** | **Tiptap OSS; borrow Novel interaction patterns** | Notion-style proposal drafting/editor experience |
| **Database** | **Supabase-hosted PostgreSQL** | Authoritative structured system of record |
| **Authentication / tenant security** | **Supabase Auth \+ PostgreSQL RLS** | Login, organization ownership, tenant isolation |
| **Drive** | **Import + human workspace** | Retain Drive ID + checksum; not the application vault |
| **Canonical evidence vault** | **Supabase Storage (immutable-by-policy)** | Ingested originals; never overwrite; new file = new version |
| **Scheduled alerts** | **Supabase Cron / pg_cron** | Contract/compliance/renewal SQL. Vercel Cron only later for app-level jobs |
| **Document lifecycle** | **Vercel Workflow** | intake → parse → extract → validate → wait for human → promote |
| **Fan-out** | **Vercel Queues behind JobPort** | Optional; not the lifecycle coordinator |
| **Processing code** | **Python \+ FastAPI \+ Pydantic** | OCR/parser orchestration, extraction, normalization, validation |
| **Light async processing** | **Vercel Functions** | Short orchestration and external API calls |
| **Heavy / bulk processing** | **Google Cloud Run Jobs** | Documented now; deploy only at bulk historical migration |
| **Config-as-code** | **vercel.ts optional** | Do not create in Phase 1 unless needed |
| **Document parser architecture** | **DocumentParser provider abstraction** | Never couple the product to one OCR/parser vendor |
| **Free/local parser candidate** | **Docling** | Low-cost local/self-hosted parsing, OCR, layout and tables |
| **Managed document-AI candidate** | **Mistral OCR 4 / Document AI** | Managed OCR, structural output, bounding boxes / annotations |
| **Enterprise extraction fallback** | **Google Document AI** | Use when benchmarked accuracy justifies the additional page cost |
| **Native multimodal PDF route** | **Benchmark current frontier PDF-capable models** | Whole-document contextual extraction / cross-checking |
| **AI application framework** | **Vercel AI SDK** | Streaming, structured outputs, tool calls, AI UI |
| **AI model router** | **Vercel AI Gateway** | Provider-neutral routing across Google/OpenAI/Anthropic/Mistral/etc. without hard-coding the application to one model |
| **High-volume model candidate** | **Gemini 3.5 Flash-Lite or benchmark winner** | Cheap structured extraction; not automatically assumed to be the most accurate |
| **Complex multimodal model candidate** | **Gemini 3.6 Flash or benchmark winner** | More complex PDF/reasoning/extraction work |
| **Historical bulk model calls** | **Provider Batch API when cheaper/supported** | Bulk jobs do not need to be forced through interactive inference |
| **Structured search** | **PostgreSQL queries/views** | Exact business filtering |
| **Keyword search** | **PostgreSQL full-text search** | Exact/lexical retrieval |
| **Semantic search** | **pgvector inside Supabase Postgres** | Embeddings/vector similarity |
| **Hybrid RAG** | **Postgres structured \+ FTS \+ pgvector** | No Pinecone/Qdrant initially |
| **Public research** | **AI Research Agent pattern, provider-adapted** | Source-backed research; avoid paid browser dependencies unless justified |
| **Analytics AI** | **OSS Data Analyst \+ Natural Language Postgres patterns** | Semantic layer \+ controlled read-only text-to-SQL |
| **Agent orchestration** | **LangGraph later only if needed** | Durable multi-step agents/human interrupts; not required for initial ingestion |
| **External AI/tool access** | **MCP later** | Optional external search/fetch/tool interface |
| **Realtime collaboration** | **Not initially** | Do not add Liveblocks until genuine realtime co-editing justifies another paid service/state layer |
| **Commercial billing** | **Stripe later** | Only when the platform is commercialized as PaaS |

## **The table / spreadsheet / Notion-style UI decision**

The product needs multiple data-work interfaces. Do not force every workflow into one table library.  
NORMAL BUSINESS TABLES  
→ TanStack Table

HIGH-VOLUME VERIFICATION  
→ TanStack Table \+ Forefront-style filtering/review UX

EXCEL / AIRTABLE-LIKE CELL EDITING  
→ Glide Data Grid

RICH PROPOSAL WRITING  
→ Tiptap \+ Novel-style editor UX

**Novel is a Notion-style rich-text editor pattern, not a Notion database/table.**  
**Liveblocks AI Spreadsheet is useful as a UX reference only.** Do not adopt Liveblocks Storage as a second business-data store, and do not adopt its Handsontable dependency merely to obtain spreadsheet behavior. Supabase remains the authoritative data store and Glide Data Grid provides the spreadsheet-style interface.

## **Document processing strategy — final architecture**

There is deliberately **no single hard-coded parser** yet.  
The production architecture uses a provider interface such as:  
DocumentParser  
├── DoclingParser  
├── MistralOcrParser  
├── GoogleDocumentAiParser  
└── NativeMultimodalPdfParser

StructuredExtractor  
├── AI-Gateway-backed interactive model  
└── direct provider batch model when appropriate

The first representative benchmark must determine routing based on actual L\&P documents.  
Benchmark at minimum:

> * clean digital PDFs;  
> * scanned PDFs;  
> * long contracts;  
> * RFPs/RFQs;  
> * multi-page and nested pricing tables;  
> * checkboxes/forms;  
> * addenda;  
> * scorecards;  
> * Word files;  
> * Excel pricing workbooks.

Measure:

> * pricing-table cell accuracy;  
> * requirement recall;  
> * date/entity accuracy;  
> * source-page/source-section preservation;  
> * checkbox/form accuracy;  
> * scanned-document accuracy;  
> * page/table structure accuracy;  
> * cross-document reconciliation accuracy;  
> * processing time;  
> * compute/API cost.

The expected outcome may be a **hybrid routing policy**, for example:  
LOW-COST / CLEAN DOCUMENT  
→ Docling or native parse  
→ structured AI extraction

DIFFICULT SCAN / TABLE / FORM  
→ managed OCR/Document AI provider  
→ structured AI extraction

LOW CONFIDENCE / CONFLICT  
→ alternate provider or stronger model  
→ human review

The benchmark decides the route. The architecture does not need to change afterward.

## **AI model strategy**

Do not hard-code Gemini, OpenAI, Anthropic or Mistral into core business logic.  
Use:  
Application  
→ Vercel AI SDK  
→ Vercel AI Gateway / provider adapter  
→ selected model

For large historical migrations, use direct provider Batch APIs when they materially lower cost and are operationally appropriate.  
Current **benchmark candidates** include:

> * Gemini 3.6 Flash for complex multimodal/PDF work;  
> * Gemini 3.5 Flash-Lite for high-volume structured extraction;  
> * current OpenAI frontier models through AI Gateway;  
> * current Anthropic frontier models through AI Gateway;  
> * Mistral models/OCR where document extraction is the primary task.

The winner must be selected with actual L\&P accuracy/cost measurements rather than vendor marketing.

## **Cost strategy — snapshot for August 19, 2026**

The architecture is designed to keep the permanent base cost low and make document/AI processing usage-based.

| Item | Current cost posture   |
| :---- | :---- |
| **Next.js / React / TypeScript / Tailwind / shadcn / TanStack / Zod** | Open-source / no software license fee |
| **Glide Data Grid** | MIT / no commercial license fee |
| **Docling** | MIT / no parser API fee; pay only for compute if hosted |
| **Vercel development** | Local development can be free |
| **Vercel commercial production** | Pro currently starts at **$20/month** and includes usage credit |
| **Supabase development/pilot** | Free tier available but limited |
| **Supabase production** | Pro currently starts at **$25/month** |
| **Base commercial infrastructure floor** | Approximately **$45/month** before variable compute/AI |
| **Vercel Queues** | 1M API operations/month currently included; then starts around **$0.60 per 1M operations**, plus invoked compute |
| **Vercel AI Gateway** | No model token markup; free accounts currently receive a small monthly credit until moved to paid credits |
| **Cloud Run Jobs** | Usage based; monthly CPU/RAM free allowance exists; appropriate for bulk/long-running jobs |
| **Mistral OCR 4** | Currently **$4/1,000 OCR pages** or **$5/1,000 Document-AI/annotated pages** |
| **80,000-page Mistral example** | Approximately **$320 OCR** or **$400 Document AI**, before other model/compute costs |
| **Google Document AI Enterprise OCR** | First 1,000 pages/month currently free, then $1.50/1,000 pages up to the published tier |
| **80,000-page Google OCR example** | About **$118.50** if processed in one month after the 1,000-page free amount |
| **Google Document AI Layout Parser** | Currently $10/1,000 pages → about **$800 for 80,000 pages** |
| **Google Form Parser / Custom Extractor** | Currently $30/1,000 pages → about **$2,400 for 80,000 pages** |
| **AI inference** | Usage based; use benchmark-selected model and batch inference where appropriate |

Prices are a planning snapshot, not architectural constants. They must be rechecked before committing a bulk migration.

### **Cost-control rules**

> * Do not pay Document AI Form Parser/Custom Extractor rates across the whole corpus unless the accuracy benchmark justifies it.  
> * Do not pay for Liveblocks, Handsontable, AG Grid Enterprise, Pinecone, Qdrant, or managed Tiptap collaboration unless a real product requirement requires them.  
> * Deduplicate and checksum documents before OCR/embedding.  
> * Do not re-OCR/re-embed an unchanged document version.  
> * Use cheap/local parsing first when it meets the accuracy threshold.  
> * Escalate only difficult/low-confidence pages/documents.  
> * Use batch inference for non-urgent historical processing.  
> * Keep human verification as the final trust boundary regardless of parser/model.

# ---

**4\. Historical Digitization**

The first real application workflow is:  
SCAN / UPLOAD  
→ Create Batch  
→ Create Document ID  
→ SHA-256 checksum  
→ Duplicate/version check  
→ Classify  
→ Identify procurement package  
→ OCR/parse  
→ Extract  
→ Stage  
→ Validate  
→ Human verify  
→ Canonical promotion  
→ Search / Analytics / AI  
Original documents are never replaced by extracted text.

# ---

**5\. Document Registry**

Every file needs a document record supporting:

> * organization;  
> * batch;  
> * internal document number;  
> * original filename;  
> * storage provider;  
> * storage path;  
> * Google Drive ID;  
> * checksum;  
> * MIME type;  
> * page count;  
> * document type/subtype;  
> * client;  
> * opportunity;  
> * solicitation;  
> * contract;  
> * date;  
> * version;  
> * current-version flag;  
> * processing status;  
> * extraction status;  
> * verification status;  
> * creator/importer;  
> * timestamps.

Document types include:  
RFP, RFQ, IFB, solicitation, addendum, Q\&A, proposal draft, final proposal, quote, pricing workbook, award notice, bid tab, evaluator scorecard, PO, contract, amendment, modification, option exercise, renewal, license, insurance, certification, resume, reference, past-performance evidence, other.

# ---

**6\. Procurement Packages**

The core unit is **the opportunity/package**, not a random PDF.  
Client  
└── Opportunity  
├── Original RFP  
├── Addenda  
├── Q\&A  
├── Proposal Draft  
├── Final Proposal  
├── Pricing  
├── Award  
├── Bid Tab  
├── PO  
├── Contract  
├── Amendment  
└── Renewal  
Every file retains its own identity/version while being linked to the same lifecycle.

# ---

**7\. Four Separate Business Truths**

Never collapse:

### **Customer Requested**

RFP/RFQ/IFB/addenda/Q\&A.

### **L\&P Proposed**

Final submitted proposal/pricing/forms.

### **Customer Awarded**

Award notice/PO/executed contract.

### **Current Contract**

Amendments/modifications/options/renewals.  
Never overwrite:  
requested\_rate  
proposed\_rate  
awarded\_rate  
current\_rate  
into one meaningless rate.  
This separation is already a core requirement of the original product definition.

# ---

**8\. Structured Extraction / Staging**

AI extraction NEVER writes directly to canonical business tables.  
Every extracted fact stores:

> * extraction run;  
> * document;  
> * entity;  
> * field;  
> * raw value;  
> * normalized value;  
> * normalized type;  
> * source page;  
> * source section;  
> * source excerpt;  
> * confidence;  
> * verification status;  
> * verified value;  
> * verifier;  
> * verification timestamp.

Statuses:  
AI\_EXTRACTED  
NEEDS\_REVIEW  
HUMAN\_VERIFIED  
REJECTED  
CONFLICT  
Only verified data is promoted where verification is required.

# ---

**9\. Automated Validation**

Validate:

### **Identity**

Client, solicitation, contract, PO, package association.

### **Pricing**

Quantity × rate, totals, proposal vs award, award vs amendment.

### **Dates**

Issue \< submission \< award, start \< expiration, amendment chronology.

### **Cross-document consistency**

Do not silently resolve legitimate differences between proposed/awarded/current values.

### **Entity conflicts**

Wrong client/company names.

### **Required package contents**

Required forms, references, COI, pricing workbook, etc.  
Unresolved issues become validation\_exceptions.

# ---

**10\. Human Verification Workbench**

First major operational UI:  
SOURCE DOCUMENT / PAGE  
↔  
EXTRACTED DATA  
Actions:  
VERIFY  
EDIT  
REJECT  
FLAG  
RESOLVE CONFLICT  
VERIFY GROUP  
VIEW SOURCE  
Borrow the useful **Forefront Dataset Filtering** UX concepts for fast/high-volume review.  
Every material verification action must be auditable.

# ---

**11\. Core Business Domains**

The long-term system includes:  
**Clients** — canonical customer history.  
**Opportunities/Solicitations** — RFP/RFQ/IFB, deadlines, services, pursuit status.  
**Requirements** — every meaningful requirement as its own sourced record.  
**Evaluation Criteria** — weights, points and scoring.  
**Proposals** — versions, sections, responses, commitments, assumptions, exceptions.  
**Awards/Outcomes** — winner, prices, scores, ranking, evaluator feedback.  
**Pricing** — requested format, internal cost, submitted, awarded, current, competitor.  
**Contracts** — terms, rates, sites, options, modifications, amendments and renewals.  
**Compliance** — licenses, insurance, SAM, GSA, TXMAS, certifications, expiration.  
**Personnel/Past Performance** — distinguish company experience, individual experience, key personnel and subcontractor experience.  
**Client Intelligence** — procurement history, awards, incumbent, evaluation behavior.  
**Competitor Intelligence** — bids, prices, scores, rankings and outcomes.  
**Content Library** — approved reusable proposal/company content.  
**Documents/Evidence** — source files, facts, chunks, citations and verification history.

# ---

**12\. Government Procurement Data**

Where applicable support:

> * NAICS;  
> * PSC;  
> * GSA SIN;  
> * UEI;  
> * CAGE;  
> * SAM;  
> * contract vehicle;  
> * GSA/TXMAS;  
> * set-aside;  
> * WBE/MBE/HUB/WOSB/etc.

Do not hard-code one classification to every opportunity.

### **Wage determinations**

Support:

> * determination ID;  
> * locality;  
> * labor category;  
> * base wage;  
> * H\&W;  
> * benefits;  
> * CBA;  
> * overtime/holiday;  
> * revision/effective date;  
> * source;  
> * verification.

# ---

**13\. Win/Loss Intelligence**

Statuses:  
WON  
LOST  
PENDING  
CANCELLED  
NO\_BID  
Store when available:

> * L\&P price;  
> * winner;  
> * winning price;  
> * rank;  
> * L\&P score;  
> * winning score;  
> * category scores;  
> * evaluator feedback;  
> * strengths;  
> * weaknesses;  
> * documented reason;  
> * internal analysis;  
> * lessons learned.

**Documented reason and internal inference are different fields.**  
Never claim a loss occurred because of price unless evidence supports that conclusion.

# ---

**14\. Proposal Content Reuse**

Segment historical proposals into sections such as:  
Staffing, Management, Transition, Recruiting, Training, QC, Emergency Response, Technology, Incident Reporting, Past Performance.  
Each retains:

> * proposal;  
> * client;  
> * opportunity;  
> * source;  
> * outcome;  
> * evaluator performance;  
> * verification;  
> * human approval;  
> * reuse status;  
> * embedding later.

Statuses:  
APPROVED  
REVIEW\_REQUIRED  
DO\_NOT\_USE  
SUPERSEDED  
Rules:  
**WON ≠ automatically reusable.**  
**LOST ≠ automatically worthless.**  
DO\_NOT\_USE content must never enter drafting retrieval.

# ---

**15\. Contracts / Renewals / Compliance**

Track:

> * original/current contract;  
> * original/current value;  
> * NTE;  
> * effective/expiration;  
> * services;  
> * locations;  
> * rates;  
> * options;  
> * exercised/remaining options;  
> * amendments;  
> * modifications;  
> * renewal notice;  
> * termination notice;  
> * internal review deadline;  
> * notice deadline;  
> * expected rebid;  
> * owner;  
> * status.

Alerts:  
180  
120  
90  
60  
30  
EXPIRED  
Apply similar expiration handling to insurance, licenses and certifications.

# ---

**16\. Pricing Intelligence**

Support:

> * hourly;  
> * labor-category hourly;  
> * component pricing;  
> * shift/post/site;  
> * day/week/month/year;  
> * fixed fee;  
> * patrol/trip;  
> * event/unit;  
> * NTE;  
> * option-year pricing;  
> * escalation;  
> * overtime;  
> * holiday;  
> * equipment;  
> * vehicle;  
> * travel/pass-through.

Evaluate evidence from:

> * L\&P wins;  
> * L\&P losses;  
> * same client;  
> * comparable clients;  
> * service;  
> * geography;  
> * staffing;  
> * contract size;  
> * recency;  
> * competitor awards;  
> * wage determinations;  
> * cost floor;  
> * target margin.

Show:

> * included records;  
> * excluded records;  
> * reasons;  
> * range;  
> * median/statistics;  
> * confidence;  
> * source evidence.

**FINAL PRICE \= HUMAN DECISION.**

# ---

**17\. Public Client / Competitor Intelligence**

Sources may include:

> * public solicitations;  
> * award notices;  
> * contracts;  
> * bid tabs;  
> * board/council agendas;  
> * budgets;  
> * procurement plans;  
> * evaluator reports;  
> * amendments;  
> * incumbent records;  
> * expiration/options;  
> * public-record responses.

Every research fact retains:

> * URL;  
> * organization;  
> * document;  
> * publication date;  
> * retrieval date;  
> * page/section;  
> * verification;  
> * confidence.

Borrow the **AI Research Agent** concept for parallel source-backed research.  
Research still passes through provenance/staging rules.

# ---

**18\. Search / RAG**

Use:  
Structured PostgreSQL filters  
\+  
PostgreSQL Full-Text Search  
\+  
pgvector Semantic Search  
\=  
Hybrid Retrieval  
Supabase currently supports hybrid search using Postgres tsvector \+ pgvector. (see Supabase hybrid search docs)  
Retrieval must enforce:

> * organization;  
> * permissions;  
> * verification state;  
> * outcome;  
> * reuse status;  
> * current/superseded version.

Use checksum/change detection so unchanged documents do not needlessly OCR/extract/embed again.

# ---

**19\. Analytics / Natural Language Analysis**

Analytics eventually include:

> * pipeline;  
> * win rates;  
> * win rates by service/client/geography;  
> * pricing trends;  
> * evaluator weaknesses;  
> * competitors;  
> * active contract value;  
> * renewal value at risk;  
> * compliance risk.

Borrow:  
**OSS Data Analyst** → semantic business layer.  
**Natural Language Postgres** → controlled text-to-SQL.  
Text-to-SQL must use:

> * read-only access;  
> * approved views;  
> * business semantic layer;  
> * RLS/tenant controls;  
> * query validation;  
> * timeouts;  
> * no destructive SQL.

# ---

**20\. Future Proposal Builder**

For each new requirement:  
CURRENT REQUIREMENT  
\+  
VERIFIED COMPANY DATA  
\+  
APPROVED CONTENT  
\+  
RELEVANT HISTORICAL RESULTS  
\+  
CLIENT INTELLIGENCE  
\+  
CURRENT EVIDENCE  
↓  
GROUNDED DRAFT  
If data is missing:  
**L\&P INPUT REQUIRED**  
Never invent:

> * staffing capacity;  
> * employee counts;  
> * turnover;  
> * contracts;  
> * references;  
> * certifications;  
> * capabilities;  
> * response times;  
> * prices;  
> * margins;  
> * performance statistics.

Use **Tiptap / Novel-style rich editing**, evidence panels, requirement mapping, source access and human approval.

# ---

**21\. AI Framework, Model Routing & Agent Strategy**

### **Vercel AI SDK**

Use Vercel AI SDK for application-facing AI functionality:

> * structured outputs;  
> * streaming;  
> * model/tool invocation;  
> * AI-assisted UI;  
> * evidence/citation presentation;  
> * proposal-drafting interactions.

The AI SDK is the application abstraction. Business rules must not depend on one model vendor.

### **Vercel AI Gateway / model abstraction**

Use Vercel AI Gateway as the default interactive model-routing layer so the application can use and compare models from multiple providers without rewriting business logic.  
The model layer should support:  
AIProvider / ModelRouter  
├── Google  
├── OpenAI  
├── Anthropic  
├── Mistral  
└── additional approved providers

Reasons:

> * provider flexibility;  
> * model comparison;  
> * fallback/routing;  
> * cost/latency observability;  
> * no need to bake one model ID through the application.

Do **not** call Gemini “the permanent AI engine.” It is one candidate/provider.

### **Initial model candidates**

Use actual benchmark data before locking the model routing policy.  
Current candidates include:

> * **Gemini 3.6 Flash** for complex multimodal/PDF reasoning;  
> * **Gemini 3.5 Flash-Lite** for high-volume structured extraction where its accuracy is sufficient;  
> * current OpenAI frontier models for difficult reasoning/extraction cross-checks;  
> * current Anthropic frontier models for difficult reasoning/extraction cross-checks;  
> * Mistral models where they benchmark well with OCR/document outputs.

Historical bulk work should use provider Batch APIs when they materially reduce cost.

### **Structured extraction rule**

The AI receives normalized document content/source evidence and returns schema-constrained data.  
Pydantic/Zod schemas validate shape.  
AI output goes to staging.  
AI confidence is useful for triage, **not proof of correctness**.

### **LangGraph later**

Use LangGraph only when the application genuinely requires durable multi-step workflows such as:

> * persistent state;  
> * pause/resume;  
> * explicit human interrupts;  
> * multi-tool research;  
> * multi-step proposal workflows;  
> * long-running approval-aware agents.

Do not install it merely because the platform uses AI.

### **MCP later**

Potential external tools may include:  
search\_procurement\_history  
get\_contract  
search\_proposal\_content  
get\_client\_history  
get\_pricing\_evidence  
search\_public\_procurement\_sources

MCP is not an initial ingestion dependency.

# ---

**22\. Multi-Tenant Architecture**

Build tenant ownership from day one:  
organizations  
memberships  
organization\_id  
RLS  
tenant-aware storage/retrieval  
L\&P is initially one tenant.  
Stripe/billing comes later.

# ---

**23\. Frontend / UX & Data-Work Interfaces**

Framework:  
Next.js App Router  
React  
TypeScript  
Tailwind CSS  
shadcn/ui  
Lucide  
TanStack Table  
Glide Data Grid  
TanStack Query  
React Hook Form  
Zod  
Tiptap

The UI should be:

> * enterprise;  
> * information dense;  
> * audit oriented;  
> * desktop first;  
> * responsive;  
> * table/grid-centric where appropriate;  
> * source/evidence aware.

Do not build the product around a generic chatbot.

## **Use the correct interface for each job**

### **Normal application tables — TanStack Table**

Use for:

> * opportunities;  
> * clients;  
> * documents;  
> * requirements lists;  
> * contracts;  
> * renewals;  
> * compliance;  
> * win/loss;  
> * intelligence indexes;  
> * processing queues.

### **Verification Workbench — Forefront-style review pattern**

Use TanStack Table plus purpose-built review UX for:

> * filters;  
> * status queues;  
> * rapid field review;  
> * keyboard-friendly approval where appropriate;  
> * source document alongside extracted facts;  
> * verify/edit/reject/conflict actions.

### **Spreadsheet-style workbenches — Glide Data Grid**

Use only where actual cell-oriented editing is beneficial:

> * dynamic client pricing matrices;  
> * internal cost-model lines;  
> * competitor pricing matrices;  
> * bulk extracted-fact QA;  
> * large requirements QA;  
> * other controlled bulk-edit workflows.

Glide renders the UI. Supabase/Postgres still owns the data.

### **Proposal writing — Tiptap / Novel pattern**

Novel is a reference for a **Notion-style rich-text editing experience**.  
Use Tiptap for:

> * rich proposal content;  
> * headings/lists/tables;  
> * requirement-linked drafting;  
> * evidence panels;  
> * AI rewrite/expand actions;  
> * human edits/approval.

Do not treat Novel as a database/table engine.

## **Main navigation**

INGESTION  
  Document Intake  
  Processing Queue  
  Verification Queue  
  Exceptions

PROCUREMENT  
  Clients  
  Opportunities  
  Requirements  
  Documents

CONTRACTS  
  Contracts  
  Renewals  
  Compliance

INTELLIGENCE  
  Win/Loss  
  Pricing  
  Clients  
  Competitors  
  Content Library  
  Analytics

PROPOSALS  
  Proposal Workspaces

SYSTEM  
  Data Quality  
  Settings

Avoid:

> * marketing-site layouts;  
> * giant hero sections;  
> * decorative illustrations;  
> * excessive gradients;  
> * fake AI effects;  
> * unnecessary animation;  
> * excessive whitespace;  
> * multiple competing UI component libraries.

# ---

**24\. Reference Templates / Extensions — Final Usage Decisions**

These references are **patterns/components to borrow**, not applications to merge wholesale.

| Template / reference | Decision | What we use   |
| :---- | :---- | :---- |
| **Vercel Supabase Starter** | **USE AS BASE** | Next.js \+ Supabase foundation |
| **Forefront AI Dataset Filtering** | **USE PATTERN** | Verification/review/filter UX |
| **Novel** | **USE PATTERN** | Notion-style Tiptap proposal editor UX |
| **Next.js OpenAI Doc Search Starter** | **USE PATTERN** | Checksums/change detection, chunks, pgvector/RAG concepts |
| **Morphic** | **USE PATTERN** | Evidence/citation-rich AI answers and generative result UI |
| **AI Research Agent** | **USE LATER PATTERN** | Parallel source-backed client/competitor research; do not automatically adopt paid browser dependencies |
| **Natural Language Postgres** | **USE LATER PATTERN** | Controlled “ask the database” experience |
| **OSS Data Analyst Agent** | **USE LATER PATTERN** | Semantic/business analytics layer |
| **Liveblocks AI Spreadsheet** | **UX REFERENCE ONLY** | Spreadsheet interaction ideas; replace storage/grid stack with Supabase \+ Glide Data Grid |
| **Python Queue Subscribers Starter** | **USE PATTERN** | Vercel Queue \+ Python consumer structure |
| **SaaS Microservices** | **USE PATTERN** | Web/processing service separation |
| **OpenAI Deep Research-compatible MCP** | **LATER** | External search/fetch/tool interface concepts |
| **Azure AI RAG Chatbot** | **PATTERN ONLY** | AI SDK streaming/tool patterns; do not adopt Azure Search as the core search system |
| **WeatherGPT** | **NO** | Irrelevant weather/plugin architecture |
| **Chatbot UI** | **NO** | Generic chat product; wrong application architecture |
| **AssistLoop** | **NO** | Customer support product; unrelated |
| **v0 Platform API Demo** | **NO** | App-generation demo; unrelated to procurement operations |

## **Do not add these initially**

> * Liveblocks persistent storage;  
> * Handsontable commercial dependency;  
> * AG Grid Enterprise;  
> * Pinecone;  
> * Qdrant;  
> * Azure AI Search;  
> * second relational database;  
> * second editable Google Sheets database;  
> * Redux/Zustand unless a demonstrated client-state problem later requires one;  
> * another component/design system.

## **Why**

The product needs specialized interfaces, but it still needs:  
**one authoritative backend, one UI system, one provenance model, and one trust boundary.**

# ---

**25\. Core Data Integrity Rules**

> 1. Never fabricate data.  
> 2. Unknown remains unknown.  
> 3. AI-extracted ≠ verified.  
> 4. Preserve provenance.  
> 5. Preserve originals.  
> 6. Preserve versions.  
> 7. Preserve historical values.  
> 8. Requested ≠ proposed ≠ awarded ≠ current.  
> 9. Never overwrite historical states.  
> 10. Canonical ≠ staging.  
> 11. Recommendations require explainability.  
> 12. Pricing requires evidence.  
> 13. Final pricing requires human approval.  
> 14. Proposal reuse requires approval/status.  
> 15. Loss content is not automatically reusable.  
> 16. Public research requires sources.  
> 17. Documented reason ≠ internal analysis.  
> 18. Verification is auditable.  
> 19. Tenant boundaries are mandatory.  
> 20. Blocked/superseded content must not silently enter AI retrieval.

# ---

**26\. Database Strategy**

### **Start with only:**

organizations  
memberships  
document\_batches  
documents  
document\_versions  
extraction\_runs  
extracted\_facts  
source\_evidence  
verification\_events  
validation\_exceptions  
clients  
opportunities

### **Long-term domains include:**

SOURCE / AUDIT  
documents  
document\_versions  
document\_chunks  
extraction\_runs  
extracted\_facts  
source\_evidence  
verification\_events  
validation\_exceptions  
PROCUREMENT  
clients  
contacts  
opportunities  
solicitations  
solicitation\_addenda  
requirements  
requirement\_responses  
evaluation\_criteria  
evaluation\_scores  
proposals  
proposal\_versions  
proposal\_sections  
awards  
win\_loss\_reviews  
PRICING  
pricing\_structures  
pricing\_lines  
labor\_categories  
wage\_determinations  
cost\_models  
competitors  
competitor\_bids  
competitor\_pricing\_lines  
CONTRACTS  
contracts  
contract\_rates  
contract\_sites  
contract\_options  
contract\_amendments  
contract\_modifications  
purchase\_orders  
renewals  
COMPLIANCE / KNOWLEDGE  
certifications  
licenses  
insurance\_policies  
company\_documents  
personnel\_qualifications  
past\_performance  
content\_library  
RESEARCH  
public\_sources  
client\_intelligence  
research\_facts  
Do **not** blindly create all tables before testing real packages.

# ---

**27\. FINAL Correct Build Order**

This is the build sequence to follow.

### **Phase 1 — Repository / Framework Foundation**

Establish:

> * Vercel Supabase Starter;  
> * Next.js App Router;  
> * React/TypeScript;  
> * Tailwind/shadcn/Lucide;  
> * TanStack Table;  
> * Glide Data Grid dependency/foundation;  
> * TanStack Query;  
> * React Hook Form/Zod;  
> * Supabase client/server/auth structure;  
> * web \+ processing service repo structure;  
> * lint/test/build foundation.

### **Phase 2 — Core Database / Staging / Provenance**

Create only the safe ingestion foundation:

> * organizations;  
> * memberships;  
> * document batches;  
> * documents;  
> * document versions;  
> * extraction runs;  
> * extracted facts;  
> * source evidence;  
> * verification events;  
> * validation exceptions;  
> * clients;  
> * opportunities;  
> * tenant ownership/RLS;  
> * audit timestamps/indexes.

### **Phase 3 — Document Intake \+ Queue**

Implement:

> * batch creation;  
> * Supabase Storage intake;  
> * SHA-256 checksum;  
> * duplicate/version foundation;  
> * document registry;  
> * processing statuses;  
> * Vercel Queue publishing through JobQueue.

### **Phase 4 — Python Processing Service \+ Provider Interfaces**

Implement:

> * FastAPI/Pydantic processing service;  
> * Workflow/JobPort worker calls (not Queues as the lifecycle);  
> * DocumentParser interface including XlsxParser (openpyxl);  
> * Docling adapter;  
> * managed OCR adapters behind interfaces;  
> * native multimodal-PDF adapter;  
> * StructuredExtractor model/provider interface;  
> * normalized document representation;  
> * staging writes;  
> * validation interface;  
> * idempotency.

Do not call one parser/model the production winner yet.

### **Phase 5 — Human Verification Workbench**

Build:

> * verification queue;  
> * source/evidence viewer;  
> * extracted-fact editing;  
> * verify/edit/reject;  
> * group verification;  
> * conflict resolution;  
> * verification audit events;  
> * canonical promotion boundary.

### **Phase 6 — Representative Procurement Pilot \+ Accuracy/Cost Benchmark**

Use approximately **20–30 materially different complete procurement packages** and at least **30–50 representative individual documents**.  
Include:

> * wins;  
> * losses;  
> * RFP/RFQ/IFB;  
> * proposals;  
> * pricing sheets/workbooks;  
> * scorecards;  
> * contracts;  
> * amendments;  
> * renewals;  
> * clean digital PDFs;  
> * ugly scans;  
> * multi-page/nested tables;  
> * forms/checkboxes;  
> * DOCX;  
> * XLSX;  
> * government/ISD/commercial.

Compare parser/model pipelines on:

> * table-cell accuracy;  
> * requirement recall;  
> * dates/entities;  
> * page/section provenance;  
> * checkbox/forms;  
> * scan quality;  
> * cross-document reconciliation;  
> * time;  
> * API cost;  
> * compute cost.

This phase locks the production routing policy **from evidence**, not assumption.

### **Phase 7 — Expand Canonical Procurement / Contract / Pricing Schema**

Apply the domain tables/relationships that the pilot proves are required.  
Lock:

> * document routing rules;  
> * parser/model escalation rules;  
> * source precedence;  
> * four-truth mappings;  
> * canonical promotion mappings.

### **Phase 8 — Bulk Historical Migration**

Run the larger historical corpus in controlled batches.  
Use:

> * checksums/dedupe;  
> * Cloud Run Jobs for heavy workloads;  
> * local/self-hosted Docling where economical;  
> * managed OCR only where justified;  
> * Batch model inference where appropriate;  
> * staging;  
> * validation;  
> * verification queues.

### **Phase 9 — Contracts / Renewals / Compliance**

Operationalize verified:

> * contracts;  
> * amendments;  
> * modifications;  
> * options;  
> * renewals;  
> * compliance;  
> * Supabase Cron alert logic.

### **Phase 10 — Win/Loss \+ Client/Competitor Intelligence**

Build:

> * evaluator intelligence;  
> * client history;  
> * competitor bids/awards;  
> * public-source research;  
> * source-backed strategy analysis;  
> * analytics foundation.

### **Phase 11 — Full-Text \+ pgvector Hybrid RAG**

Add:

> * approved chunks;  
> * full-text indexes;  
> * embeddings;  
> * pgvector;  
> * hybrid retrieval;  
> * tenant/verification/reuse filters.

### **Phase 12 — Pricing Intelligence**

Build:

> * dynamic client-required pricing structures;  
> * Glide spreadsheet-style pricing workbench;  
> * internal cost models;  
> * comparable selection;  
> * included/excluded evidence;  
> * ranges/statistics;  
> * human price decision.

### **Phase 13 — Proposal Builder**

Build:

> * Tiptap rich proposal editor;  
> * requirement-by-requirement drafting;  
> * evidence/source panel;  
> * approved/review/do-not-use retrieval controls;  
> * L\&P INPUT REQUIRED;  
> * grounded AI drafting;  
> * approval flow.

### **Phase 14 — Commercial Multi-Tenant Product**

Only when appropriate:

> * subscription/billing;  
> * tenant administration;  
> * usage controls;  
> * optional realtime collaboration.

Do not reorder the phases simply to create visually impressive screens earlier.

**Operational checklist with files, packages, exit criteria, and out-of-scope lists:** [BUILD_PLAN.md](BUILD_PLAN.md). Section 27 here is the sequence; BUILD_PLAN is what to actually execute.

# ---

**28\. Finished Product**

When mature, uploading a new RFP should let the system answer:

> * What is required?  
> * What are the deadlines?  
> * What submission method/forms are required?  
> * What pricing structure is required?  
> * What evaluation criteria matter?  
> * What services/staffing are required?  
> * What certifications/insurance apply?  
> * What wage determination applies?  
> * Have we bid this client before?  
> * Did we win or lose?  
> * What did we propose?  
> * What was awarded?  
> * What changed later?  
> * What are the current contract terms?  
> * What did competitors bid/win at?  
> * What did evaluators say?  
> * Which proposal content performed well?  
> * What is approved for reuse?  
> * What must not be reused?  
> * What compliance items are expiring?  
> * What comparable pricing evidence exists?  
> * What cost floor applies?  
> * What pricing range does evidence support?  
> * Which records were included/excluded?  
> * What information is missing?  
> * What requires human approval?  
> * What source supports the answer?

Then it helps create the compliant proposal.  
The result of that opportunity becomes new verified intelligence for the next one.

## 29. Finished UX / UI, features, and functional outcome

This section defines what the mature L\&P platform should actually look like and what a user should be able to do inside it. The earlier sections define the architecture and business rules; this section consolidates the final user-facing product experience.

Application shell and navigation

Use the shadcn dashboard application shell as the base. The product should feel like enterprise procurement/contract operations software: information-dense, desktop-first, source-aware, audit-oriented, and fast for users working with large volumes of records.

Primary navigation:

OVERVIEW

\- Dashboard

INGESTION

\- Document Intake

\- Processing Queue

\- Verification Queue

\- Exceptions

PROCUREMENT

\- Clients

\- Opportunities

\- Requirements

\- Documents

CONTRACTS

\- Contracts

\- Renewals

\- Compliance

INTELLIGENCE

\- Win/Loss

\- Pricing Intelligence

\- Client Intelligence

\- Competitors

\- Content Library

\- Analytics

PROPOSALS

\- Proposal Workspaces

SYSTEM

\- Data Quality

\- Settings / Administration

Final pages / workspaces

1\. Executive / Operations Dashboard

Purpose: give leadership and operators one current view of pipeline, active contracts, upcoming deadlines, risk, and performance.

UI:

\- KPI cards;

\- compact trend charts only when supported by real data;

\- TanStack data tables;

\- urgency/status badges;

\- drill-down links rather than giant decorative cards.

Capabilities:

\- open opportunities;

\- pipeline value;

\- submitted value;

\- awarded value;

\- win rate;

\- active contract value;

\- contracts expiring in 180/120/90/60/30 days;

\- renewal value at risk;

\- compliance expirations;

\- outstanding proposal requirements;

\- pricing/operations/executive approval bottlenecks.

2\. Document Intake

Purpose: controlled entry point for paper scans and digital procurement files.

UI:

\- drag/drop upload;

\- batch ID;

\- source type;

\- optional client/opportunity/package association;

\- upload progress;

\- processing status.

Capabilities:

\- PDF/DOCX/XLSX intake;

\- checksum generation;

\- duplicate/version detection;

\- document registry creation;

\- queue processing;

\- automatic/manual package assignment;

\- original-file preservation.

3\. Processing Queue

Purpose: operational visibility into large-scale document processing.

UI:

\- TanStack queue table;

\- filters by batch, type, client, stage, status, failure reason;

\- retry/open-source actions.

Statuses include:

UPLOADED, QUEUED, PARSING, EXTRACTING, VALIDATING, NEEDS\_REVIEW, VERIFIED, FAILED.

AI completion must never equal VERIFIED.

4\. Human Verification Workbench

Purpose: fastest possible source-backed review of AI-extracted facts before canonical promotion.

Primary UX:

SOURCE DOCUMENT / PAGE  ↔  EXTRACTED FACTS

Use a Forefront-style review/filter workflow with TanStack tables and purpose-built review interactions.

Capabilities:

\- inspect exact source page/section/excerpt;

\- see raw and normalized values;

\- confidence/status;

\- VERIFY;

\- EDIT;

\- REJECT;

\- FLAG CONFLICT;

\- RESOLVE;

\- VERIFY GROUP;

\- keyboard-efficient review where appropriate;

\- exception queue;

\- full verification audit trail;

\- promote accepted facts to canonical records.

5\. Documents / Evidence Registry

Purpose: master index of every source document and version.

Capabilities:

\- search/filter by client, opportunity, contract, type, date, batch, status;

\- document version history;

\- checksum/duplicate status;

\- original source link;

\- extraction history;

\- verification history;

\- source-evidence drill-down;

\- current/superseded version status.

6\. Opportunity Workspace

Purpose: central operating record for every RFP/RFQ/IFB/quote pursuit.

Use tabs such as:

Overview | Requirements | Evaluation | Pricing | Client Intelligence | Competitors | Historical Matches | Proposal | Sources

Capabilities:

\- solicitation metadata and deadlines;

\- go/no-go/status/owner;

\- requirements completion;

\- evaluation/scoring criteria;

\- requested pricing structure;

\- same-client history;

\- similar prior opportunities;

\- win/loss intelligence;

\- public research evidence;

\- compliance readiness;

\- proposal progress;

\- source documents.

7\. Requirements Matrix

Purpose: turn large solicitations into actionable requirement-level work.

Default UI: TanStack Table.

For very large QA/bulk-edit cases, use Glide Data Grid selectively.

Each requirement can show:

\- exact wording;

\- normalized title/interpretation;

\- category;

\- mandatory/scored;

\- points/weight;

\- owner;

\- response status;

\- evidence status;

\- verification status;

\- source page/section;

\- required attachment/form;

\- proposal response link.

8\. Pricing Intelligence Workbench

Purpose: spreadsheet-like analysis without turning Google Sheets into the system of record.

Primary UI: Glide Data Grid backed by Supabase/PostgreSQL.

Work areas:

A. Client-required pricing structure

B. Internal cost model

C. Historical L\&P pricing evidence

D. Competitor/award evidence

E. Comparable selection

F. Review range / statistics

G. Human final price decision

Capabilities:

\- dynamic client-defined matrices;

\- hourly/labor category/component/site/shift/fixed/NTE/option-year structures;

\- wage/fringe/cost-floor inputs;

\- selectable comparable records;

\- included/excluded records and reason;

\- win/loss comparison;

\- competitor pricing;

\- ranges/median/statistics;

\- confidence/data-sufficiency indicator;

\- Show Evidence drawer;

\- final bid-price approval.

The system must never automatically fill the final bid price.

9\. Client Intelligence Workspace

Purpose: one evidence-backed profile of the customer and its procurement history.

Capabilities:

\- prior L\&P opportunities;

\- wins/losses;

\- incumbent vendors;

\- previous solicitations/awards;

\- prior pricing;

\- evaluation criteria;

\- evaluator comments;

\- contract expirations/options;

\- public board/council/procurement records;

\- current client-related contracts;

\- documented patterns with confidence/source evidence.

10\. Competitor Intelligence Workspace

Purpose: build a structured competitor evidence base, not unsupported competitive guesses.

Capabilities:

\- competitor profiles;

\- opportunities encountered;

\- submitted/awarded prices;

\- pricing lines/rates;

\- scores/rankings;

\- award results;

\- service/geography/client-type filters;

\- source documents/URLs;

\- comparative trends;

\- confidence/sample-size display.

11\. Win/Loss Intelligence

Purpose: explain performance from evidence and preserve lessons for future bids.

Capabilities:

\- WON / LOST / PENDING / CANCELLED / NO\_BID;

\- L\&P price vs winning price;

\- winner/rank;

\- total and category scores;

\- evaluator feedback;

\- strengths/weaknesses;

\- documented reason;

\- separate internal analysis;

\- lessons learned;

\- section-level performance;

\- reuse implications.

12\. Contract Portfolio & Contract Detail

Purpose: convert awarded work into an operational lifecycle record.

Capabilities:

\- original/current value;

\- NTE;

\- start/expiration;

\- sites/services/rates;

\- PO/vehicle;

\- amendment/modification timeline;

\- option years;

\- renewals;

\- notice deadlines;

\- expected rebid;

\- source evidence;

\- owner/status;

\- linked originating opportunity.

13\. Renewals & Compliance Center

Purpose: ensure contracts and compliance do not expire unnoticed.

Capabilities:

\- 180/120/90/60/30-day and expired states;

\- renewal/option/rebid deadlines;

\- license/insurance/certification/SAM/GSA/TXMAS tracking;

\- missing required evidence;

\- owner/action status;

\- scheduled alerts driven from verified dates.

14\. Content Library & Reusable Proposal Knowledge

Purpose: controlled source for reusable company/proposal content.

Capabilities:

\- section/category taxonomy;

\- source proposal/opportunity/client;

\- WON/LOST outcome;

\- evaluator score when available;

\- human approval;

\- APPROVED / REVIEW\_REQUIRED / DO\_NOT\_USE / SUPERSEDED;

\- source evidence;

\- full-text/semantic retrieval;

\- review date/owner;

\- usage history.

15\. Analytics / Ask the Data

Purpose: executive and operational analysis over controlled business semantics.

Capabilities:

\- dashboards and filters;

\- pipeline/win-rate/contract/renewal/pricing/competitor/evaluator trends;

\- semantic business layer;

\- read-only natural-language-to-SQL over approved views;

\- tables/charts generated only from real query results;

\- source/query transparency.

16\. Proposal Workspace / Builder

Purpose: requirement-driven proposal drafting grounded in verified L\&P evidence.

Primary UX: Tiptap rich editor using Novel-style interaction patterns, not a generic chatbot.

Recommended layout:

LEFT: current requirement, scoring, instructions, client history, warnings.

CENTER: rich proposal response editor.

RIGHT: sources/evidence, approved historical sections, reuse status, missing information.

Capabilities:

\- requirement-by-requirement drafting;

\- approved historical retrieval;

\- same-client intelligence;

\- loss warnings;

\- evaluator intelligence;

\- source citations;

\- AI rewrite/expand actions;

\- draft/approve/review states;

\- L\&P INPUT REQUIRED when evidence is missing;

\- gap/compliance check;

\- final human approvals;

\- future Google Docs working-document/export flow.

17\. Data Quality / Exceptions

Purpose: central control surface for integrity issues across the corpus.

Capabilities:

\- conflicting values;

\- missing source evidence;

\- duplicate documents;

\- failed extraction;

\- unresolved entities;

\- stale/superseded records;

\- low-confidence facts;

\- incomplete procurement packages;

\- canonical/staging discrepancies.

18\. Settings / Administration

Purpose: controlled platform configuration.

Capabilities eventually include:

\- organization/tenant;

\- memberships/roles;

\- RLS-aware permissions;

\- service taxonomy;

\- document taxonomy;

\- parser/provider configuration;

\- model routing configuration;

\- alert settings;

\- source-precedence rules;

\- integrations;

\- future billing/tenant administration.

Cross-application UX rules

Every relevant screen should visibly expose the record's trust state and source lineage.

Shared UI components/statuses should include:

\- VerificationBadge;

\- OutcomeBadge;

\- ReuseStatusBadge;

\- ExpirationStatusBadge;

\- ProcessingStatusBadge;

\- SourceEvidenceDrawer;

\- DataTable;

\- SpreadsheetGrid;

\- EmptyState;

\- AuditHistory.

The interface must make distinctions such as these obvious rather than hiding them in tooltips:

\- AI EXTRACTED — NOT VERIFIED

\- HUMAN VERIFIED

\- CONFLICT

\- WON

\- LOST

\- REVIEW REQUIRED

\- DO NOT USE

\- SUPERSEDED

\- L\&P INPUT REQUIRED

No screen may fabricate data merely to avoid an empty state.

Primary finished user journeys

Historical migration journey:

Upload/import source files → queue → parse/OCR → extract → validate → verification queue → canonical promotion → package/opportunity grouping → contracts/intelligence/search.

New RFP journey:

New RFP → intake → extraction → human verification → opportunity → requirements/evaluation/pricing structure → client/competitor research → historical intelligence → compliance readiness → pricing evidence → human pricing → approved content retrieval → grounded drafting → requirement/compliance check → approval → submission → win/loss → award/contract → renewal/rebid → intelligence updated for next bid.

Finished-product outcome

The finished product is one integrated procurement operating system where users can:

\- digitize and verify historical procurement records at scale;

\- trace every material fact back to evidence;

\- work opportunities requirement-by-requirement;

\- understand prior client and competitor history;

\- compare requested, proposed, awarded and current commercial terms without overwriting history;

\- build evidence-backed pricing decisions in an Excel-like workbench without creating a second database;

\- manage active contracts, amendments, renewals and compliance;

\- search verified knowledge structurally, lexically and semantically;

\- analyze win/loss and evaluator performance;

\- safely reuse approved proposal knowledge;

\- create source-grounded proposal drafts in a rich editor;

\- explicitly identify missing L\&P information rather than inventing it;

\- feed each new outcome back into the corpus so the platform becomes more useful over time.

---

**30\. Paste-Ready FIRST Cursor Prompt**

You are working on the L\&P Proposal, Contract & Procurement Intelligence Platform.

This is a production procurement-intelligence platform, not a CRM, chatbot, demo, document repository, or basic RFP tracker.

Its purpose is to convert paper and digital procurement history into verified, source-backed structured data and then use that data for procurement management, contracts, renewals, compliance, win/loss analysis, pricing intelligence, client/competitor intelligence, search/RAG, analytics, and evidence-backed proposal drafting.

CORE LIFECYCLE

Historical Documents  
→ Opportunity  
→ RFP/RFQ/IFB  
→ Requirements  
→ Research  
→ Pricing  
→ Proposal  
→ Submission  
→ Win/Loss  
→ Award  
→ Contract  
→ Amendment/Modification  
→ Renewal/Rebid

NON-NEGOTIABLE DATA FLOW

SOURCE  
→ extraction  
→ STAGING  
→ automated validation/reconciliation  
→ HUMAN VERIFICATION  
→ canonical database

AI-extracted information must never automatically become trusted canonical business data.

Preserve separately:  
1\. customer requested  
2\. L\&P proposed  
3\. customer awarded  
4\. current/amended contract

LOCKED PLATFORM / FRAMEWORK

\- Vercel Supabase Starter  
\- Next.js App Router \+ React \+ TypeScript  
\- Vercel hosting  
\- Tailwind \+ shadcn/ui \+ Lucide  
\- TanStack Table for normal application tables  
\- Glide Data Grid for genuine spreadsheet-style pricing/bulk-edit workbenches  
\- TanStack Query  
\- React Hook Form \+ Zod  
\- Tiptap for the future rich proposal editor; borrow Novel UX patterns  
\- Supabase-hosted PostgreSQL as the authoritative structured system of record  
\- Supabase Auth \+ PostgreSQL RLS  
\- Supabase Storage as canonical immutable-by-policy evidence vault  
\- Google Drive as import/source + human workspace (retain Drive ID; do not delete)  
\- Supabase Cron/pg_cron for renewal/compliance SQL  
\- Vercel Workflow for document lifecycle; Queues optional fan-out behind JobPort  
\- Python \+ FastAPI \+ Pydantic processing service  
\- Vercel Functions for light async/orchestration work  
\- Google Cloud Run Jobs documented for heavy/bulk processing (defer deploy)  
\- vercel.ts optional (not Phase 1 unless needed)  
\- PostgreSQL full-text search \+ pgvector \+ hybrid retrieval  
\- Vercel AI SDK  
\- Vercel AI Gateway/provider abstraction for interactive model routing  
\- LangGraph later only if durable multi-step agent workflows actually require it  
\- MCP later  
\- Stripe later

DOCUMENT PROCESSING ARCHITECTURE

Do NOT hard-code a single OCR/parser vendor into the application.

Create a DocumentParser provider interface supporting adapters such as:  
\- Docling  
\- Mistral OCR 4  
\- Google Document AI  
\- native multimodal PDF/model processing

Create a separate StructuredExtractor/model interface.

The production parser/model routing policy will be selected after benchmarking real L\&P documents for:  
\- pricing-table accuracy  
\- requirement recall  
\- source-page/section preservation  
\- scanned-document accuracy  
\- forms/checkboxes  
\- dates/entities  
\- cross-document reconciliation  
\- processing time  
\- actual cost

Do NOT state that Gemini, Docling, Mistral or Google Document AI is permanently “the parser” before that benchmark.

AI MODEL ARCHITECTURE

Do not hard-code one AI provider into business logic.

Use:  
Application  
→ Vercel AI SDK  
→ AI Gateway/provider abstraction  
→ selected model

Current benchmark candidates may include Gemini 3.6 Flash, Gemini 3.5 Flash-Lite, current OpenAI/Anthropic frontier models, and Mistral models.

Use provider Batch APIs directly for large historical jobs when that is more economical.

UI WORKBENCH RULES

\- Standard records/lists: TanStack Table.  
\- High-volume verification: Forefront-style filtering/review UX.  
\- Excel/Airtable-like pricing or bulk editing: Glide Data Grid backed by Supabase.  
\- Proposal drafting: Tiptap / Novel-style rich editor.  
\- Liveblocks AI Spreadsheet is a UX reference only; do not make Liveblocks Storage another source of truth.  
\- Do not add Handsontable, AG Grid Enterprise, Pinecone, Qdrant, Azure AI Search or another component library without an approved requirement.

REFERENCE TEMPLATE PATTERNS

Use as references rather than wholesale code merges:  
\- Forefront Dataset Filtering → verification UX  
\- Next.js OpenAI Doc Search → checksum/chunk/pgvector patterns  
\- Morphic → evidence/citation AI UX  
\- AI Research Agent → public research architecture  
\- OSS Data Analyst → semantic analytics layer  
\- Natural Language Postgres → controlled text-to-SQL  
\- Novel → Tiptap proposal editor UX  
\- Python Queue Subscribers → Python queue-consumer pattern  
\- SaaS Microservices → web/processor separation  
\- Deep Research MCP → later external search/fetch tool pattern  
\- Azure RAG → AI SDK patterns only

Do not use WeatherGPT, generic Chatbot UI, AssistLoop, or v0 Platform API Demo as product foundations.

COST / SCALE PRINCIPLES

The historical corpus may contain hundreds/thousands of proposals/contracts and tens of thousands of pages.

\- Dedupe/checksum before OCR, extraction or embeddings.  
\- Do not reprocess unchanged document versions.  
\- Keep cheap/local parsing available.  
\- Escalate difficult/low-confidence documents to managed OCR/stronger models.  
\- Use Batch inference for non-urgent historical work.  
\- Run heavy bulk processing on Cloud Run Jobs rather than forcing everything through Vercel Functions.  
\- Avoid paid secondary systems unless they solve a measured requirement.  
\- Human verification remains the final trust boundary.

YOUR TASK RIGHT NOW

DO NOT IMPLEMENT FEATURES YET.

1\. Inspect the existing repository.  
2\. Identify what already exists.  
3\. Identify conflicts with this architecture.  
4\. Create/update the canonical repo documentation:  
   \- docs/PRODUCT\_SPEC.md  
   \- docs/TECH\_STACK.md  
   \- docs/DATA\_ARCHITECTURE.md  
   \- docs/DOCUMENT\_TAXONOMY.md  
   \- docs/SOURCE\_PRECEDENCE.md  
   \- docs/IMPLEMENTATION\_ROADMAP.md  
5\. In TECH\_STACK.md, document:  
   \- locked platform choices  
   \- parser/model provider abstractions  
   \- benchmark candidates  
   \- interface choices (TanStack vs Glide vs Tiptap)  
   \- cost-control principles  
6\. Recommend the smallest correct Phase 1 implementation.  
7\. Do not simplify this into a mockup/generic SaaS/CRM/chatbot.  
8\. STOP.

Return a concise architecture/readiness report for approval.  