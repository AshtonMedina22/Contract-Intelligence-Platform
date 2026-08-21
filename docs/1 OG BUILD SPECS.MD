L&P Proposal, Contract & Procurement Intelligence PaaS
FINAL MASTER BLUEPRINT
1. Product
One internal platform for L&P Global Security that may later become a multi-tenant PaaS for other government/enterprise contractors.
The lifecycle is:
Historical Records → Opportunity → RFP/RFQ/IFB → Requirements → Research → Bid Strategy → Pricing → Proposal → Submission → Win/Loss → Award → Contract → Amendments/Options/Renewal → Rebid → Intelligence improves
The system exists to answer:
What exactly is this solicitation asking for?
What must we submit and when?
How will we be evaluated?
Have we bid this buyer before?
What did we propose?
Did we win or lose?
What actually affected the result?
What did competitors bid/receive?
What pricing is supported by historical evidence?
What content performed well?
What content should not be reused?
What contracts/compliance items are expiring?
What information are we missing?
What source proves every important answer?
The original blueprint explicitly defines this intelligence loop and six-engine model.
It is not: CRM, customer portal, lead-nurture tool, generic document storage, generic ChatGPT clone, autonomous pricing engine, or autonomous proposal writer.

2. Final application architecture
INTERNAL FILES / GOOGLE DRIVE / PUBLIC PROCUREMENT RECORDS
                         ↓
               DOCUMENT INTAKE
                         ↓
              SUPABASE STORAGE
        canonical immutable-by-policy
                  evidence copy
                         ↓
                DOCUMENT REGISTRY
                         ↓
                VERCEL WORKFLOW
       lifecycle orchestration / resume
                         ↓
                PYTHON PROCESSOR
          FastAPI + Pydantic + parsers
                         ↓
       PDF / DOCX / XLSX / OCR / TABLES
                         ↓
           STRUCTURED AI EXTRACTION
                         ↓
                     STAGING
                         ↓
        VALIDATION + RECONCILIATION
                         ↓
              HUMAN VERIFICATION
                         ↓
             CANONICAL POSTGRESQL
                         ↓
       ┌─────────────────┼───────────────────┐
       ↓                 ↓                   ↓
 Structured Data     FTS + pgvector     Source Evidence
       ↓                 ↓                   ↓
       └─────────────────┼───────────────────┘
                         ↓
              PROCUREMENT INTELLIGENCE
                         ↓
  Ask / Market / Pricing / Proposal / Contracts / Reports
Google Drive: import/source integration and familiar human workspace.
Supabase Storage: canonical platform copy of ingested evidence.
Supabase/PostgreSQL: canonical structured system of record.
That is the newer approved architecture; it intentionally improves on the older Drive-as-only-vault design.

3. Final UX / information architecture
Keep the global interface compact. Do not turn every table into a sidebar item.
Main area
What lives inside
Home
Current pursuits, deadlines, contract risk, verification work, alerts
Ingestion
Intake, Processing, Verification, Exceptions, Historical Migration
Procurement / Pursuits
Opportunities, packages, requirements, source documents, proposal workspaces
Contracts
Portfolio, amendments, options, renewals, compliance
Intelligence
Ask Intelligence, Market & Competitors, Buyer Intelligence, Pricing, Win/Loss, Content, Reports
Proposals
Active pursuit workspaces and proposal drafting
System
Data Quality, Data Model/Admin, Settings

Within a pursuit, complexity belongs in contextual tabs:
Overview | Requirements | Research | Bid Strategy | Pricing | Evidence | Proposal | Compliance | Submission | Outcome
Current repo navigation is already moving toward this expandable-workflow model rather than the old giant flat sidebar.

4. The six core engines
Engine
Finished capability
1. Opportunity / Solicitation
Understand and manage everything L&P is pursuing
2. Contract & Compliance
Manage what L&P has won and every downstream obligation
3. Pricing Intelligence
Use real cost/history/competitor evidence to support pricing decisions
4. Buyer / Market / Competitor Intelligence
Understand the procurement environment and likely competition
5. Proposal Intelligence
Turn verified history into stronger, grounded proposal responses
6. Executive / Business Intelligence
Measure pipeline, outcomes, pricing, contract risk and performance

Ask Intelligence / GPT is a cross-platform intelligence layer across all six engines, not a replacement for them.

5. Ask Intelligence — the GPT assistant
This needs to be a first-class finished feature.
The user opens Ask Intelligence and talks naturally to GPT:
“What did we bid the last three Texas ISD armed-security contracts?”
“Why did we lose the Arlington bid?”
“Find the most recent contract we have for this buyer.”
“What requirements in this RFP are still unanswered?”
“What competitors have we seen most often in North Texas?”
“Compare our proposed rate vs awarded rate across similar contracts.”
“What contracts expire in the next 12 months?”
“Build me a competitor intelligence report for this pursuit.”
The assistant then decides what kind of request it is.
LOCATE
Direct retrieval without needing AI reasoning:
documents
contracts
RFPs
proposals
buyers
awards
requirements
pricing records
Uses:
SQL + PostgreSQL FTS
ASK / ANALYZE
GPT synthesizes an answer using:
structured database queries
+
full-text retrieval
+
pgvector semantic retrieval
+
verified source documents
+
approved public research
REPORT
GPT may produce:
Bid Strategy Report
Buyer / Agency Intelligence Brief
Market Intelligence Report
Competitor Intelligence Report
Pricing Intelligence Report
Win/Loss Analysis
Proposal Improvement / Evaluator Analysis
Executive Intelligence Brief
GPT architecture
Ask Intelligence UI
        ↓
Vercel AI SDK
        ↓
Vercel AI Gateway
        ↓
GPT / OpenAI
(or alternate approved model when useful)
        ↓
controlled tools
├── structured_query
├── locate_record
├── search_documents
├── semantic_search
├── retrieve_evidence
├── pricing_analysis
├── public_research
└── generate_report
GPT can be the default interactive assistant. Do not hard-code business logic to a specific model API; AI Gateway preserves provider/model flexibility.
The source draft specifically identified Vercel AI SDK + Gateway, controlled natural-language SQL, a semantic business layer, and Morphic-style evidence-backed answer UX as the desired mature architecture.
Every AI answer must show
Answer
Evidence / Sources
Data scope
Confidence / limitations where relevant
View Source
If the evidence is insufficient:
Insufficient verified evidence to answer this reliably.
Not a fabricated answer.

6. Purpose-aware AI retrieval
This is critical.
The same information is not eligible for every AI task.
Example:
Proposal section:
HUMAN_VERIFIED
Outcome: LOST
Reuse: DO_NOT_USE
Allowed:
Ask:
"Why did this proposal lose?"
Not allowed:
Draft:
"Write the new response using this content."
Retrieval purpose should eventually support at least:
GENERAL_QA
LOCATE
LOSS_ANALYSIS
COMPETITOR_ANALYSIS
PRICING_ANALYSIS
BID_STRATEGY
PROPOSAL_DRAFTING
COMPLIANCE_REVIEW
REPORT_GENERATION
Filters can then enforce:
organization
verification
document version
source precedence
permissions
outcome
reuse status
retrieval purpose

7. New solicitation ingestion
When a real RFP/RFQ/IFB arrives, the platform must extract substantially more than title + due date.
Solicitation metadata
buyer / agency
title
solicitation number
solicitation type
issue date
questions deadline
pre-bid / pre-proposal date
mandatory conference?
submission deadline
anticipated award date
performance start/end
base term
option periods
estimated value if stated
submission method
portal
required physical/electronic copies
contacts
procurement vehicle
NAICS
PSC
set-aside
Scope
service types
armed / unarmed / PPO / police
sites
posts
guard counts
hours
shifts
24/7 coverage
supervisor requirements
vehicles
equipment
uniforms
technology
reporting
patrol
special duties
Personnel
experience
licenses
DPS requirements
firearm requirements
background screening
fingerprinting
drug testing
driver requirements
training
law-enforcement experience
military experience
security clearances
agency suitability
key personnel
Compliance
insurance limits
COI
bonding if applicable
licenses
certifications
SAM
GSA
TXMAS
HUB / MWBE / WBE / WOSB
references
financial documents
legal forms
Pricing requirement
The system captures what the buyer requests, not a price invented by AI:
pricing type
pricing instructions
labor categories
rows
columns
unit
hourly / fixed / site / shift / monthly
base year
option years
OT
holiday
vehicle/equipment
travel
reimbursables
wage determination
NTE
escalation rules
Evaluation
evaluation category
points / percentage
pass/fail
technical weight
price weight
staffing weight
experience weight
references
interview/oral presentation
other factors
Required submission items
Real public RFPs prove this must be structured:
cover sheet
bid/proposal form
pricing form
references
W-9
certifications
affidavits
HUB/MWBE forms
conflict disclosures
insurance
signatures
notarization
addendum acknowledgments
bonds
required attachments

8. Requirement matrix
Every meaningful requirement becomes an individual record.
Requirement
Normalized title
Category
Mandatory?
Scored?
Points / weight
Response required?
Attachment required?
Owner
Status
Source document
Page
Section
Excerpt
Confidence
Verification status
Response
Evidence
Approval state
Categories include:
Administrative, Technical, Operational, Staffing, Pricing, Compliance, Legal, Insurance, Personnel, Past Performance, Reference, Transition, Technology, Forms/Attachments.

9. Verification and provenance
Verification statuses:
AI_EXTRACTED
NEEDS_REVIEW
HUMAN_VERIFIED
REJECTED
CONFLICT
User actions:
Verify
Edit
Reject
Flag Conflict
Resolve
Verify Group
View Source
Every important fact retains:
raw value
normalized value
document/version
page/sheet/cell
section
excerpt
confidence
extraction run
verification status
verified value
verifier
verified timestamp
AI never directly writes trusted business truth.
The original source repeatedly makes staging → validation → human verification → canonical promotion non-negotiable.

10. Document intelligence
Every document has:
document ID
batch
organization
source provider
source URL / Drive ID
Storage path
SHA-256
original filename
MIME type
pages
document type/subtype
buyer
opportunity
solicitation
contract
document date
version
current-version flag
commercial truth
processing status
verification status
Document types:
RFP, RFQ, IFB, solicitation, addendum, Q&A, proposal draft, final proposal, quote, pricing workbook, award notice, bid tabulation, evaluator scorecard, PO, contract, amendment, modification, option exercise, renewal, license, insurance, certification, resume, reference, past-performance evidence, public research record.
Documents belong to procurement packages, not isolated file lists.

11. Four business truths
Never collapse:
Truth
Example source
Buyer Requested
Solicitation/addendum
L&P Proposed
Final proposal/pricing
Buyer Awarded
Award/PO/contract
Current / Amended
Amendment/modification/option/renewal

So:
requested pricing
≠
proposed pricing
≠
awarded pricing
≠
current pricing
The original blueprint explicitly treats this separation as mandatory.

12. Source precedence
When records disagree:
Requirements
latest applicable addendum / clarification
>
original solicitation
L&P submitted position
final submitted proposal/pricing
>
draft
Current terms
latest executed amendment/modification/option
>
executed contract / PO
>
award
>
proposal
Never delete the earlier facts.
Create a reconciliation event when ambiguity remains.

13. Buyer / agency intelligence
Buyer profiles are procurement intelligence, not CRM.
Track:
prior solicitations
L&P bid history
wins/losses
awards
incumbents
contractors
pricing history
bid tabs
evaluation criteria
scorecards/comments
board/council documents
budgets
procurement plans
contract vehicles
current contract
expiration
options
rebid timing
procurement priorities
relevant sourced initiatives/events

14. Competitor & market intelligence
Competitor records support:
competitor
opportunity
buyer
date
service
region
submitted price
awarded price
pricing lines
technical score
price score
total score
rank
award result
certifications
source evidence
Market analysis can compare:
service
geography
buyer type
contract size
award values
rates
competitor presence
win/loss outcomes
scoring patterns
rebid activity
Allowed:
Allied was observed 5.8% below L&P across 8 verified comparable records.
Not automatically allowed:
Allied wins because it underprices us.
Observed evidence and causal inference remain separate. The original blueprint explicitly requires this distinction.

15. Win / loss intelligence
Outcome states should support:
PENDING
WON
LOST
NO_BID
CANCELLED
ALL_BIDS_REJECTED / NO_AWARD
Store:
L&P submitted price
winner
winning price
L&P total score
winning score
rank
category scores
evaluator comments
documented outcome reason
internal analysis
lessons learned
Documented reason and internal interpretation are separate.
If the buyer only provides score differences, the platform records the score differences. It does not manufacture “we lost because of price.”

16. Proposal intelligence
Historical proposals become section-level intelligence:
Staffing
Management
Transition
Recruiting
Training
Quality Control
Emergency Response
Technology
Incident Reporting
Past Performance
Business Continuity
Background Screening
Customer Service
etc.
Each section:
proposal
version
buyer
opportunity
source page
source section
text
overall bid outcome
evaluation category
score
verification
human approval
reuse status
embedding
Canonical reuse:
APPROVED
REVIEW_REQUIRED
DO_NOT_USE
SUPERSEDED
WON ≠ automatically approved.
LOST ≠ automatically worthless.

17. Proposal workspace
The finished proposal workspace is requirement-driven.
┌──────────────────────────┬──────────────────────────────┐
│ REQUIREMENT              │ RESPONSE EDITOR              │
│ exact source text        │ Tiptap rich-text drafting    │
│ page / section           │ GPT draft / human editing    │
│ score / mandatory        │                              │
├──────────────────────────┼──────────────────────────────┤
│ HISTORICAL INTELLIGENCE  │ EVIDENCE                     │
│ prior wins/losses        │ approved sources             │
│ evaluator history        │ buyer research               │
│ lessons                  │ certifications               │
├──────────────────────────┼──────────────────────────────┤
│ MISSING INFO             │ ACTIONS                      │
│ L&P INPUT REQUIRED       │ Generate / Edit / Approve    │
│                          │ View Sources                 │
└──────────────────────────┴──────────────────────────────┘
AI receives only:
current requirement
verified L&P facts
approved content
selected REVIEW_REQUIRED content
relevant outcome intelligence
verified buyer research
current source evidence
If it cannot support a claim:
L&P INPUT REQUIRED

18. Proposal output
In-app intelligence + Tiptap drafting
              ↓
Google Docs working proposal
              ↓
human collaboration / comments / revision
              ↓
final procurement output
Outputs:
Google Doc, PDF, DOCX, procurement portal answers, pricing workbook, structured copy/paste.

19. Pricing Intelligence
Three operational layers:
A. Buyer pricing requirement
What format must L&P complete?
B. Internal cost model
wage
fringe/H&W
payroll burden
workers comp
insurance
supervision
equipment
vehicle
travel
overhead
wage determination
margin target
C. Historical/competitive evidence
same-buyer bids
similar buyers
comparable L&P wins
comparable L&P losses
competitor awards
service
geography
staffing
size
recency
Output:
Comparable records: 17
Included: 11
Excluded: 6

Observed range
Median
Percentiles
Cost floor
Target-margin threshold
Confidence

[Show Evidence]
Then:
FINAL PRICE — HUMAN DECISION REQUIRED
Glide Data Grid is the final spreadsheet-style pricing UI.

20. Wage / government procurement intelligence
Support relationally:
NAICS
PSC
GSA SIN
UEI
CAGE
SAM
set-aside
contract vehicle
GSA
TXMAS
WBE / MBE / HUB / WOSB
Wage data:
wage determination ID
locality
labor category
base wage
H&W / fringe
CBA
OT
holiday
effective date
revision
source
verification

21. Past-performance integrity
Never collapse:
L&P CORPORATE PAST PERFORMANCE
MANAGEMENT PRIOR EXPERIENCE
KEY PERSONNEL EXPERIENCE
SUBCONTRACTOR EXPERIENCE
This prevents:
Executive X previously worked on an FBI contract
from becoming:
L&P performed the FBI contract.
This safeguard was explicitly identified in the original design.

22. Contracts & compliance
Contracts track:
contract #
buyer
opportunity
award
PO
vehicle
executed date
start/end
base term
options
original value
current value
NTE
services
sites
staffing
rates
renewal notice
termination notice
internal review
rebid
owner
status
Connected lifecycle:
Original Contract
→ Amendment
→ Modification
→ Option Exercise
→ Renewal
→ Rebid
Compliance:
licenses
insurance / COIs
certifications
SAM
GSA
TXMAS
corporate registrations
personnel qualifications
training
references
Verified dates drive:
180 → 120 → 90 → 60 → 30 → EXPIRED
using Supabase Cron / pg_cron.

23. Reports and dashboards
AI reports
Bid Strategy
Buyer Intelligence Brief
Market Intelligence
Competitor Intelligence
Pricing Intelligence
Win/Loss
Proposal Improvement / Evaluator Analysis
Executive Intelligence Brief
Every report must preserve the data cutoff, query/filter set and supporting evidence.
Dashboard domains
Pipeline: active pursuits, deadlines, value, approval bottlenecks.
Contracts: active value, options, expirations, renewal/rebid risk.
Compliance: missing/expiring evidence.
Win/Loss: results, category scores, documented reasons, competitor frequency.
Pricing/Competition: historical ranges, competitive observations, cost/margin context.
No fake KPI simply because the UI needs a chart.

24. Supabase canonical domain model
Do not create all of these blindly before the pilot, but this is the intended end-state relational model.
Domain
Core entities
Platform
organizations, memberships, roles, approvals, activity_log
Evidence
document_batches, documents, document_versions, document_chunks, extraction_runs, extracted_facts, source_evidence, verification_events, validation_exceptions
Buyers/Pursuits
clients/buyers, procurement_contacts, opportunities, opportunity_services, sites
Solicitations
solicitations, addenda/versions, Q&A, submission_requirements, required_forms
Requirements
requirements, requirement_responses, requirement_evidence
Evaluation
evaluation_criteria, evaluation_scores, evaluator_feedback
Proposal
proposals, proposal_versions, proposal_sections, content_library
Pricing
pricing_structures, pricing_lines, cost_models, cost_components, labor_categories, wage_determinations, pricing_evidence
Competition
competitors, competitor_bids, competitor_pricing_lines, competitor_scores
Outcome
awards, win_loss_reviews
Contracts
contracts, contract_sites, contract_services, contract_rates, purchase_orders, amendments, modifications, options, renewals, alerts
Compliance
licenses, insurance_policies, certifications, registrations, personnel_qualifications
Experience
past_performance, references, personnel experience
Research
public_sources, research_runs, research_facts, buyer_intelligence
AI
AI conversations/runs, citations/tool traces, report_runs/outputs


25. Final tech stack
Layer
Locked choice
Base
Vercel Supabase Starter
Web
Next.js App Router + React + TypeScript
Hosting
Vercel
UI
Tailwind + shadcn/ui + Lucide
Tables
TanStack Table
Spreadsheet UX
Glide Data Grid
Forms
React Hook Form + Zod
State/query
TanStack Query
Proposal editor
Tiptap OSS + Novel UX patterns
PDF source viewer
PDF.js / react-pdf
Database
Supabase PostgreSQL
Auth
Supabase Auth
Security
PostgreSQL RLS
Evidence vault
Supabase Storage, immutable-by-policy
Drive
Import/source + human workspace
Workflow
Vercel Workflow
Fan-out
Vercel Queues behind JobPort
Processor
Python + FastAPI + Pydantic
XLSX
openpyxl
Heavy bulk runtime
Cloud Run Jobs only when needed
Scheduling
Supabase Cron / pg_cron
AI
Vercel AI SDK
Model routing
Vercel AI Gateway
Interactive assistant
GPT as default if desired, provider-abstracted
Search
PostgreSQL SQL + FTS + pgvector
Analytics AI
controlled Text-to-SQL + semantic layer later
External research
source-backed research tools later
External AI access
MCP later
Billing
Stripe when commercialized

The current repo's technical lock already reflects most of this.

26. Multi-tenant PaaS
L&P is tenant #1.
Later:
Organization A — L&P
Organization B — Contractor B
Organization C — Contractor C
Each gets:
memberships
roles
RLS
tenant-scoped Storage
tenant-scoped search/vector retrieval
tenant-scoped AI context
tenant-scoped reports
L&P's buyers do not become tenants or portal users.
Later commercialization adds:
tenant admin → plans → quotas → AI/storage usage → Stripe
without redesigning core procurement tables.

27. Historical Pilot — corrected for the data you actually have
You do not currently have a complete internal L&P historical corpus.
Therefore Phase 2 should use:
PUBLIC L&P PROCUREMENT RECORDS where available
+
REAL SECURITY RFP / RFQ / IFB PACKAGES
+
REAL BID FORMS
+
REAL PRICING FORMS
+
REAL AWARD / SCORECARD RECORDS
+
REAL CONTRACT / PO / AMENDMENT DOCUMENTS
Target 20–30 materially different procurement packages/doc sets covering:
long RFP, short RFQ, IFB, proposal, contract, award, loss, pricing table, XLSX, addenda, scorecard, renewal, government, ISD, county, state, federal, commercial.
Do not pretend comparable security-company records are L&P history.
Their purpose is to test:
document taxonomy;
table design;
required fields;
parser accuracy;
pricing structures;
forms;
scoring;
source precedence;
verification UX.
When actual internal L&P history becomes available, the same pipeline ingests it.

28. Final build sequence
Phase
Deliverable
1
Foundation / tenancy / evidence / ingestion / verification framework
2
Real-document Historical Pilot
3
Production historical ingestion + parser routing
4
Broader historical migration
5
Contract / compliance / renewal operations
6
Win/Loss + buyer/market/competitor intelligence
7
Ask Intelligence / GPT + hybrid search + AI reports
8
Pricing Intelligence / Glide workbench
9
Proposal Intelligence / grounded drafting / Google Docs output
Later
Commercial PaaS, Stripe, MCP, advanced agents

Later-phase screens already built early can remain, but a route existing does not mean that phase is complete.

29. Definition of the finished product
A user uploads a 120-page RFP.
The platform:
reads it
→ identifies the buyer
→ identifies deadlines
→ identifies all required forms
→ extracts requirements
→ extracts evaluation criteria
→ extracts pricing structure
→ identifies scope/staffing/compliance requirements
→ human verifies the extraction
→ researches buyer history
→ finds prior L&P history
→ analyzes wins/losses
→ analyzes competitors
→ creates Bid Strategy
→ evaluates compliance readiness
→ builds pricing evidence
→ human selects pricing
→ finds approved historical proposal content
→ GPT drafts requirement-level responses
→ cites every supporting source
→ identifies unsupported information as L&P INPUT REQUIRED
→ tracks proposal completion
→ routes approvals
→ outputs final proposal
→ captures award/loss
→ creates/updates contract
→ monitors amendments/options/renewals
→ feeds the result back into intelligence
At any point the user can open Ask Intelligence and ask GPT a question in plain English, request a comparison, locate a document, analyze a loss, review pricing, or generate an evidence-backed report.
That is the finished product.
The current MASTER_BLUEPRINT.md is directionally correct, but this is the fuller canonical version because it explicitly restores the conversational GPT/Ask Intelligence experience, reports, detailed real-solicitation extraction, purpose-aware AI retrieval, market research, the final locked technical architecture, and the realistic public-document pilot strategy.

