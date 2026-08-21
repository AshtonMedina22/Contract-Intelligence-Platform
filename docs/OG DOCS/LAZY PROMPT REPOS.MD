You are working in:

https://github.com/AshtonMedina22/Contract-Intelligence-Platform

TASK TYPE:
REFERENCE ARCHITECTURE / KNOWLEDGE REGISTRY ONLY.

DO NOT IMPLEMENT PRODUCT FEATURES IN THIS TASK.
DO NOT CHANGE DATABASE SCHEMA.
DO NOT CHANGE MIGRATIONS.
DO NOT REFACTOR WORKING APPLICATION CODE.
DO NOT CLONE OR DEEPLY ANALYZE ALL EXTERNAL REPOSITORIES.
DO NOT COMMIT OR PUSH.

==================================================
PURPOSE
==================================================

This platform should NOT reinvent mature open-source mechanics when a relevant public implementation already exists.

However, this repository remains the authoritative product.

External repositories are REFERENCE IMPLEMENTATIONS for specific subsystems.

They must NEVER silently replace:

- our product architecture
- our canonical Supabase/PostgreSQL data model
- our tenant/RLS model
- our provenance rules
- our human-verification boundary
- our four commercial truths
- our source-precedence rules
- our canonical UX / IA
- our final human pricing requirement
- our L&P INPUT REQUIRED behavior
- our purpose-aware retrieval/reuse controls

The goal of this task is to give future Cursor sessions a persistent map that answers:

1. What public reference repos exist?
2. Why do we care about each one?
3. What exact subsystem does each repo apply to?
4. What should we borrow or study from it?
5. What should we NOT borrow?
6. When should Cursor inspect that repo?
7. Where does the borrowed pattern belong in THIS repo?
8. Is it code we can potentially adapt, a library to use, a data/API source, or design/schema reference only?
9. How do we avoid loading/analyzing every repo on every task?

==================================================
FIRST — UNDERSTAND THIS PRODUCT
==================================================

Before creating the registry, read our canonical repository documentation:

- docs/MASTER_BLUEPRINT.md
- docs/PRODUCT_SPEC.md
- docs/TECH_STACK.md
- docs/DATA_ARCHITECTURE.md
- docs/BUILD_PLAN.md
- docs/CURRENT_STATE_AUDIT.md
- docs/UX_UI.md

Also inspect the current repository structure enough to understand which major product areas already exist.

Do NOT perform another giant product audit.

You only need enough local context to correctly map external references to the existing architecture.

The product is a:

PROPOSAL-CENTERED
CONTRACT
PROCUREMENT
INTELLIGENCE
PLATFORM

The complete business loop is approximately:

SOURCE DOCUMENTS / PUBLIC PROCUREMENT DATA
→ INGEST / PARSE / EXTRACT
→ HUMAN VERIFY + PROVENANCE
→ CANONICAL PROCUREMENT INTELLIGENCE
→ PURSUIT / RFP / RFQ / IFB
→ REQUIREMENTS
→ BUYER / COMPETITOR / MARKET RESEARCH
→ BID STRATEGY
→ PRICING
→ RESPONSE
→ SUBMISSION
→ RESULT / WIN-LOSS / EVALUATION
→ AWARD / CONTRACT
→ SERVICE PLAN / COMMERCIAL TERMS
→ CHANGES
→ RENEWAL / REBID
→ VERIFIED RESULT IMPROVES FUTURE BIDS

Major product areas include:

- Pursuits
- Requirements
- Pricing
- Response
- Submission
- Result
- Contracts
- Service Plan
- Commercial Terms
- Changes
- Renewals
- Buyer Intelligence
- Competitor Intelligence
- Market Intelligence
- Win/Loss
- Public Research
- Data Ops
- Intake
- Parsing / Extraction
- Human Verification
- Provenance / Evidence
- Search / RAG
- Find / Ask GPT
- Reports
- Structured analytics / Ask-the-Data

==================================================
CREATE A PERSISTENT EXTERNAL REFERENCE REGISTRY
==================================================

Create:

docs/EXTERNAL_REFERENCE_REPOS.md

This is NOT another product specification.

It is a concise routing/index document telling future developers and agents:

WHEN WORKING ON X
→ CONSULT Y REPOSITORY
→ LOOK FOR Z PATTERNS
→ ADAPT THEM TO OUR ARCHITECTURE.

For EVERY repository below record:

- Repository name
- URL
- Reference category
- Why it matters to our product
- Exact patterns/components/mechanics to inspect
- Exact area(s) of our platform it maps to
- Trigger: when Cursor should consult it
- What NOT to copy/adopt
- Usage mode:
  - USE LIBRARY
  - ADAPT CODE/PATTERN
  - DATA/API SOURCE
  - SCHEMA REFERENCE
  - UX REFERENCE
  - ARCHITECTURE REFERENCE
  - BENCHMARK ONLY
- License/copy caution
- Analysis status:
  - REGISTERED ONLY
  - INSPECTED FOR TASK
  - ADOPTED PATTERN
  - REJECTED
  - SUPERSEDED

IMPORTANT:

At creation time, most repos should remain:

REGISTERED ONLY

Do NOT deeply analyze every repository now.

This registry is specifically intended to prevent context overload.

==================================================
REFERENCE REPOSITORIES
==================================================

--------------------------------------------------
1. RFPilot
--------------------------------------------------

URL:
https://github.com/valinorintelligence/rfpilot

REFERENCE FOR:
Overall RFP / proposal-response workflow.

WHY WE CARE:
This is one of the closest public product analogs to our PRE-AWARD workflow.

WHEN TO CONSULT:
- RFP intake
- solicitation extraction
- requirements
- evaluation extraction
- compliance extraction
- response generation
- response gaps
- submission outputs
- DOCX proposal generation
- capability matching

SPECIFICALLY INSPECT/BORROW:
- RFP document → structured requirements workflow
- deadline extraction
- evaluation criteria extraction
- compliance extraction
- capability-to-requirement matching
- gap detection
- proposal response generation flow
- structured Word/DOCX output patterns
- activity/audit patterns
- backend service separation for extraction, matching, AI and output

MAPS TO OUR:
Pursuit → Requirements
Pursuit → Response
Pursuit → Submission
Python extraction schemas/services

DO NOT:
- replace our four-truth model
- replace our verification/provenance model
- replace our downstream contract intelligence
- adopt its application architecture wholesale

USAGE:
ADAPT CODE/PATTERN

--------------------------------------------------
2. AutoRFP
--------------------------------------------------

URL:
https://github.com/run-llama/auto_rfp

REFERENCE FOR:
Pursuit / requirements / evidence / response workflow.

WHEN TO CONSULT:
- Pursuit workspace
- requirement decomposition
- response workflow
- evidence retrieval
- per-response citations
- answer editing
- project knowledge
- organization isolation

SPECIFICALLY INSPECT/BORROW:
- RFP project/workspace structure
- organization/multi-tenant patterns where applicable
- document knowledge sources
- automatic question extraction
- answer-generation jobs
- source retrieval
- source relevance presentation
- per-answer citations
- human response editing
- question → evidence → answer UX

MAPS TO:
Pursuit
Requirements
Response
Evidence / Sources

DO NOT:
replace our Supabase/RLS architecture or canonical schema.

USAGE:
ADAPT CODE/PATTERN

--------------------------------------------------
3. OpenContracts / cite
--------------------------------------------------

URL:
https://github.com/Open-Source-Legal/OpenContracts

REFERENCE FOR:
Human verification, source evidence and document-ground-truth architecture.

THIS IS A VERY HIGH PRIORITY REFERENCE.

WHEN TO CONSULT:
- Data Ops
- Verification
- PDF viewer
- source highlighting
- source evidence
- citation architecture
- annotation
- document versioning
- extraction review
- lexical/vector search over evidence

SPECIFICALLY INSPECT/BORROW:
- PDF text-coordinate mapping
- exact source highlighting
- annotation objects
- page/layout provenance
- source-text selection
- human annotation as ground truth
- document corpus management
- document version history
- extraction-job structure
- human review mechanics
- vector + lexical search architecture
- relationships between source documents

COMPARE DIRECTLY AGAINST OUR:
source_evidence
extracted_facts
verification_events
document_chunks
PDF/source viewer
View Source
verification workbench

TARGET FLOW:

DOCUMENT
→ page/text coordinates
→ selected source evidence
→ extracted fact
→ human verify/edit/reject
→ source-linked ground truth

DO NOT:
replace our canonical procurement model.

USAGE:
ADAPT CODE/PATTERN

--------------------------------------------------
4. Docling
--------------------------------------------------

URL:
https://github.com/docling-project/docling

REFERENCE FOR:
Primary parser / normalized document representation.

WHEN TO CONSULT:
- PDF parsing
- DOCX parsing
- table extraction
- reading order
- page coordinates
- layout
- OCR
- normalized document objects

SPECIFICALLY USE/STUDY:
- document object model
- pages
- sections/headings
- tables
- cells
- coordinates
- reading order
- OCR fallback
- structured exports
- parser APIs

MAPS TO:
services/processor
parser adapters
normalized document representation

OUR ARCHITECTURE MUST REMAIN PROVIDER-ABSTRACTED.

USAGE:
USE LIBRARY + ADAPT EXAMPLES

--------------------------------------------------
5. Unstructured
--------------------------------------------------

URL:
https://github.com/Unstructured-IO/unstructured

REFERENCE FOR:
Alternative document ingestion / partitioning / preprocessing.

WHEN TO CONSULT:
- parser benchmarking
- document partitioning
- chunk generation
- metadata preservation
- preprocessing
- format-specific processing

SPECIFICALLY INSPECT:
- file-type dispatch
- partition strategies
- element model
- chunking
- metadata propagation
- preprocessing
- type-specific routing

MAPS TO:
Python processor
alternate parser route
RAG chunk-production pipeline

DO NOT:
replace Docling automatically.

Docling vs Unstructured must be benchmark-driven.

USAGE:
BENCHMARK + SELECTIVE ADAPTATION

--------------------------------------------------
6. TenderRadar
--------------------------------------------------

URL:
https://github.com/d4d0h/tenderradar

REFERENCE FOR:
Public procurement source-adapter architecture.

WHEN TO CONSULT:
- public RFP discovery
- external opportunity feeds
- government procurement source adapters
- opportunity synchronization
- dedupe/upsert
- external source normalization
- matching/filtering

SPECIFICALLY INSPECT/BORROW:
- one-adapter-per-procurement-source architecture
- SAM adapter
- other procurement-source adapters
- synchronization jobs
- common tender representation
- source normalization
- dedupe/upsert mechanics
- filters
- deadline tracking
- opportunity matching

MAPS TO:
Public Research
Buyer Intelligence
Market Intelligence
future opportunity discovery

EXPECTED LOCAL ABSTRACTION SHOULD LOOK LIKE:

PublicProcurementProvider
├── SamGovProvider
├── UsaSpendingProvider
├── StateProcurementProvider
├── LocalGovernmentProvider
├── ManualWebResearchProvider
└── FutureProvider

DO NOT:
adopt TenderRadar's database as our canonical database.

USAGE:
ADAPT ARCHITECTURE/CODE WHERE APPROPRIATE

--------------------------------------------------
7. OpenSAM
--------------------------------------------------

URL:
https://github.com/akshayakula/OpenSAM

REFERENCE FOR:
SAM.gov opportunity discovery/search concepts.

WHEN TO CONSULT:
- SAM.gov
- federal opportunity discovery
- NAICS filtering
- federal solicitation search
- opportunity matching
- federal opportunity UX

SPECIFICALLY INSPECT:
- SAM.gov request/API patterns
- opportunity normalization
- NAICS/category filters
- semantic matching concepts
- federal opportunity search UX

MAPS TO:
Government procurement research
Public Research
Buyer / Market Intelligence

DO NOT:
make OpenSAM our federal system of record.

USAGE:
SELECTIVE REFERENCE / ADAPTATION

--------------------------------------------------
8. Open Contracting Data Standard / OCDS
--------------------------------------------------

URL:
https://github.com/open-contracting/standard

REFERENCE FOR:
External procurement lifecycle vocabulary and normalization.

THIS IS NOT AN APPLICATION TO COPY.

WHEN TO CONSULT:
- external procurement schema
- public procurement normalization
- tender/award/contract relationships
- procurement lifecycle terminology
- amendments
- buyer/supplier/award relationships

SPECIFICALLY STUDY:
- planning
- tender
- tenderer
- award
- supplier
- contract
- implementation
- amendment
- buyer
- parties
- milestones
- documents
- identifiers

USE AS AN EXTERNAL NORMALIZATION REFERENCE.

EXAMPLE MAPPING:

OCDS Tender
→ our Solicitation/Pursuit

Tenderer
→ Bidder

Award
→ Award

Supplier
→ Awarded vendor / competitor

Contract
→ Contract

Amendment
→ Change

Implementation
→ current-performance evidence

Buyer
→ Buyer / Agency

Milestone
→ lifecycle event/deadline

Document
→ source evidence

DO NOT:
replace our L&P-specific schema.

Our schema still contains concepts such as:
- L&P proposed
- internal cost
- evaluator intelligence
- reuse status
- proposal responses
- L&P INPUT REQUIRED
- human price decisions

USAGE:
SCHEMA REFERENCE

--------------------------------------------------
9. USAspending API
--------------------------------------------------

URL:
https://github.com/fedspendingtransparency/usaspending-api

REFERENCE FOR:
Federal award / recipient / agency / spending intelligence.

WHEN TO CONSULT:
- federal awards
- incumbent/competitor evidence
- recipient/vendor profiles
- award amounts
- agency hierarchy
- NAICS / PSC
- federal market research
- historical contract searches

SPECIFICALLY USE/STUDY:
- award search/filter model
- recipient lookup
- agency hierarchy
- award IDs
- NAICS
- PSC
- award amounts
- dates
- contract records
- pagination
- API filtering
- normalization

MAPS TO:
Buyer Intelligence
Competitor Intelligence
Federal Market Intelligence
Public Research

PREFER USING THE ACTUAL PUBLIC DATA/API OVER RECREATING THE DATASET.

USAGE:
DATA/API SOURCE

--------------------------------------------------
10. USAspending MCP Server
--------------------------------------------------

URL:
https://github.com/cyanheads/usaspending-mcp-server

REFERENCE FOR:
Tool interface around USAspending data.

WHEN TO CONSULT:
- Ask GPT tools
- public research tools
- federal award lookup
- recipient lookup
- agency lookup
- award analytics

SPECIFICALLY INSPECT:
- award search tool
- award detail tool
- recipient search
- agency lookup
- spending aggregation
- normalized tool inputs/outputs
- MCP/API abstraction patterns

MAPS TO FUTURE:
public_research tool layer
Ask GPT controlled tools

DO NOT:
make MCP an initial hard dependency if a direct provider adapter is simpler.

USAGE:
ADAPT/REUSE TOOL PATTERNS

--------------------------------------------------
11. Public-Sector Contract Lifecycle Management
--------------------------------------------------

URL:
https://github.com/benjaminbellman/contract-lifecycle-management

REFERENCE FOR:
Government/public-sector CLM domain design.

WHEN TO CONSULT:
- contract lifecycle
- obligations
- amendments
- approvals
- renewals
- document versions
- contract events
- audit
- RBAC concepts

SPECIFICALLY STUDY:
- contract entity relationships
- obligation tracking
- approval/audit model
- amendment lineage
- renewal lifecycle
- contract event history
- document/version relationships

MAPS TO:
Contracts → Commercial Terms
Contracts → Changes
Contracts → Renewal

USE THIS TO CHECK WHETHER WE ARE MISSING STANDARD CLM MECHANICS.

DO NOT:
replace our contract workspace design.

DO NOT COPY CODE unless license is explicitly verified as compatible.

USAGE:
ARCHITECTURE / SCHEMA REFERENCE

--------------------------------------------------
12. Whereas
--------------------------------------------------

URL:
https://github.com/zgbrenner/whereas

REFERENCE FOR:
Modern contract repository / CLM UX.

WHEN TO CONSULT:
- contract intake
- triage
- contract workspace
- review findings
- approvals
- contract document history
- clause findings
- remediation UX

SPECIFICALLY STUDY:
- guided intake
- inbox/triage
- request → repository workflow
- contract record workspace
- version timeline
- review findings
- approval surfaces
- human review after automated extraction

MAPS TO:
Contracts UX
possibly Data Ops intake/review UX

LICENSE CAUTION:
Treat as REFERENCE ONLY unless current license obligations have been explicitly reviewed and approved.

USAGE:
UX REFERENCE

--------------------------------------------------
13. Wraft
--------------------------------------------------

URL:
https://github.com/wraft/wraft

REFERENCE FOR:
Structured document creation / lifecycle / output patterns.

WHEN TO CONSULT:
- document generation
- proposal output
- reusable structured content
- templates
- document versioning
- export workflows
- collaboration concepts

SPECIFICALLY STUDY:
- structured templates
- reusable content blocks
- template → content → output pipeline
- document lifecycle
- versioning
- document generation

MAPS TO:
Response
Submission
DOCX/PDF generation
future output workflows

DO NOT:
replace Tiptap/Google Docs architecture.

LICENSE CAUTION:
REFERENCE ONLY unless current license obligations are reviewed.

USAGE:
UX / ARCHITECTURE REFERENCE

--------------------------------------------------
14. Glide Data Grid
--------------------------------------------------

URL:
https://github.com/glideapps/glide-data-grid

REFERENCE FOR:
Our pricing spreadsheet mechanics.

WE ALREADY USE GLIDE.

WHEN TO CONSULT:
BEFORE writing custom spreadsheet/grid behavior.

SPECIFICALLY FIND EXISTING GLIDE EXAMPLES FOR:
- currency cells
- percentages
- dropdowns
- custom cells
- validation
- read-only cells
- computed cells
- paste ranges
- bulk editing
- selection
- frozen columns
- column resize
- keyboard navigation
- tooltips
- context menus
- custom headers
- summaries
- high-volume rendering

MAPS DIRECTLY TO:
pricing-glide-grid.tsx
pricing-workbench.tsx
Pursuit → Pricing

RULE:
Do not manually reimplement a grid interaction Glide already supplies.

USAGE:
USE LIBRARY + ADAPT OFFICIAL EXAMPLES

--------------------------------------------------
15. Novel
--------------------------------------------------

URL:
https://github.com/steven-tey/novel

REFERENCE FOR:
Tiptap/Notion-style response-editor interaction patterns.

WE ALREADY USE TIPTAP.

WHEN TO CONSULT:
BEFORE manually creating editor mechanics such as:
- slash commands
- bubble menus
- selection menus
- toolbar interactions
- AI editing commands
- contextual rewrite/expand
- streaming insertion
- rich block UX
- keyboard behaviors

MAPS TO:
Pursuit → Response
Tiptap editor components

OUR CUSTOM VALUE IS AROUND THE EDITOR:

LEFT:
Requirements

CENTER:
Tiptap/Novel-derived editor

RIGHT:
Evidence
Sources
Historical answers
Evaluator feedback
Missing information
Reuse status

DO NOT:
turn Novel into our application architecture.

USAGE:
ADAPT UI COMPONENT/PATTERN

--------------------------------------------------
16. Morphic
--------------------------------------------------

URL:
https://github.com/miurla/morphic

REFERENCE FOR:
Grounded search/answer UX AND public-research presentation.

WHEN TO CONSULT:
- Find / Ask GPT
- citations
- streaming answer UX
- source cards
- follow-up questions
- public research
- buyer intelligence briefs
- competitor research
- research result UI

SPECIFICALLY INSPECT:
ASK EXPERIENCE:
question
→ tool/search state
→ streaming answer
→ citations
→ source cards
→ follow-up

PUBLIC RESEARCH EXPERIENCE:
research query
→ multiple sources
→ source retrieval
→ synthesis
→ citation-rich result

ALSO STUDY:
- provider abstraction
- multiple search backends
- model routing patterns
- answer history
- source presentation
- streaming generative UI

MAPS TO:
Global Find / Ask GPT
Public Research
Buyer Research
Competitor Research
Sources / Evidence presentation

DO NOT:
turn the entire platform into Morphic.

USAGE:
HIGH-VALUE CODE/PATTERN REFERENCE

--------------------------------------------------
17. Open Deep Research
--------------------------------------------------

URL:
https://github.com/langchain-ai/open_deep_research

REFERENCE FOR:
Multi-step public buyer/competitor/market research orchestration.

WHEN TO CONSULT:
- Research this buyer
- Research this competitor
- Bid Strategy research
- multi-source public research
- report research
- iterative research

SPECIFICALLY STUDY:
- query planning
- research subquestions
- parallel search
- iterative search
- source dedupe
- source summarization
- evidence compression
- research state
- final sourced synthesis
- evaluation
- search-tool abstraction

TARGET CONCEPT:

Research Buyer
→ plan research
→ search awards
→ search contracts
→ search procurement records
→ search board/council material
→ search budgets/plans
→ dedupe
→ extract useful evidence
→ synthesize
→ save sources/facts

MAPS TO:
Public Research engine
Buyer Intelligence
Competitor Intelligence
Bid Strategy
Research-backed Reports

IMPORTANT:
Do not install LangGraph merely because this repo uses it.

Borrow the orchestration concepts/interfaces first.
Only introduce a durable agent framework if our product genuinely requires it.

USAGE:
ARCHITECTURE / ORCHESTRATION REFERENCE

--------------------------------------------------
18. WrenAI
--------------------------------------------------

URL:
https://github.com/Canner/WrenAI

REFERENCE FOR:
Governed natural-language structured analytics / NL→SQL.

WHEN TO CONSULT:
Questions such as:
- How many ISD bids did we lose?
- What is median awarded pricing?
- Which competitors appear most often?
- What contracts expire next year?
- What is our observed win rate by buyer type?

These are STRUCTURED ANALYTICS questions, not ordinary RAG.

SPECIFICALLY STUDY:
- semantic/business model
- metric definitions
- entity relationships
- dimensions
- approved joins
- business terminology
- NL→SQL planning
- SQL validation
- governed execution
- result explanation
- reproducible query definitions

TARGET FLOW:

QUESTION
→ semantic business model
→ validated read-only SQL
→ Supabase/PostgreSQL
→ real result
→ optional LLM explanation

MAPS TO:
Ask GPT structured-data tools
Executive / Business Intelligence
Analytics
Reports

DO NOT:
replace Supabase/Postgres.

DO NOT:
allow unrestricted/destructive LLM-generated SQL.

USAGE:
ARCHITECTURE / PATTERN REFERENCE

==================================================
REFERENCE ROUTING TABLE
==================================================

The registry must contain an easy routing table similar to:

IF WORKING ON:
RFP intake / requirements / response / submission
→ RFPilot + AutoRFP

IF WORKING ON:
PDF evidence / annotations / human verification / provenance
→ OpenContracts

IF WORKING ON:
PDF/DOCX/XLSX parser
→ Docling first
→ Unstructured as benchmark/alternate

IF WORKING ON:
public procurement ingestion / external opportunity sources
→ TenderRadar + OpenSAM + OCDS

IF WORKING ON:
federal awards / federal competitors / federal buyer history
→ USAspending API
→ optionally USAspending MCP for tool architecture

IF WORKING ON:
contract domain / changes / renewal / obligations
→ Public-Sector CLM
→ Whereas for UX reference

IF WORKING ON:
document/proposal output
→ RFPilot DOCX patterns
→ Wraft reference where useful

IF WORKING ON:
pricing grid mechanics
→ Glide Data Grid

IF WORKING ON:
Response editor mechanics
→ Novel

IF WORKING ON:
Find/Ask GPT citations/streaming/source UX
→ Morphic

IF WORKING ON:
multi-source buyer/competitor/public research
→ Open Deep Research + Morphic

IF WORKING ON:
structured analytical questions / NL→SQL
→ WrenAI

==================================================
CRITICAL CONTEXT-LOAD RULE
==================================================

DO NOT ANALYZE ALL REFERENCE REPOSITORIES AT ONCE.

For every future implementation task:

1. Read the local canonical docs relevant to the task.

2. Read:
   docs/EXTERNAL_REFERENCE_REPOS.md

3. Identify the subsystem being changed.

4. Select ONLY the reference repositories applicable to that subsystem.

DEFAULT MAXIMUM:
3 external repositories per implementation task.

Use fewer whenever possible.

5. Do NOT clone repositories into this repository.

If code-level inspection is required:
- browse GitHub directly, OR
- use a temporary directory outside the project such as:
  /tmp/contract-intelligence-references/<repo>
- never commit external repositories or their .git history

6. Start by inspecting ONLY:
- README
- architecture/docs relevant to the task
- LICENSE
- the specific source directories/files relevant to the mechanism being implemented

Do not read an entire external repository merely because it exists.

7. Only after the relevant pattern has been understood should implementation begin.

8. Our local architecture ALWAYS wins when there is a conflict.

External repositories provide:
PATTERNS
IMPLEMENTATION EXAMPLES
UI MECHANICS
DATA NORMALIZATION IDEAS
REFERENCE SCHEMAS
PUBLIC DATA CONNECTORS

They do NOT define our product.

==================================================
LAZY REPO-NOTE SYSTEM
==================================================

Create directory:

docs/reference-repos/

Create ONLY:

docs/reference-repos/README.md

at this time.

DO NOT create 18 detailed repo-analysis files now.

The README should explain:

Detailed notes are created lazily only when a repository is actually inspected for an implementation task.

When Cursor materially inspects an external repo later, create/update:

docs/reference-repos/<repo-slug>.md

That focused note should contain ONLY:

# Repository
URL

# Task that caused inspection

# Relevant upstream files inspected

# Relevant patterns found

# What maps to our codebase

# What we are adopting

# What we are explicitly NOT adopting

# License/copy implications verified

# Local files affected

# Status
INSPECTED / ADOPTED / REJECTED / SUPERSEDED

This prevents future agents from having to rediscover the same upstream implementation repeatedly.

==================================================
CREATE A PERMANENT CURSOR RULE
==================================================

Create:

.cursor/rules/external-reference-repos.mdc

Keep it SHORT.

Do NOT duplicate the entire registry inside the rule.

The rule should state approximately:

- Before inventing significant new mechanics, check docs/EXTERNAL_REFERENCE_REPOS.md.
- Select references by subsystem.
- Inspect no more than 3 external repositories by default.
- Never analyze every registered repo on every task.
- Prefer existing proven implementations/patterns over unnecessary greenfield reinvention.
- Preserve the Contract Intelligence Platform's canonical architecture and business rules.
- Local canonical docs override external examples.
- Never wholesale merge an external application.
- Never copy code without checking the repository's current license.
- AGPL/non-permissive/unlicensed projects are reference-only unless explicitly approved.
- Record material upstream research lazily under docs/reference-repos/.
- Reuse existing local code before importing external patterns.
- A reference repo existing does not mean we must adopt its approach.

Also make the rule tell Cursor to read:

docs/MASTER_BLUEPRINT.md
docs/PRODUCT_SPEC.md
docs/CURRENT_STATE_AUDIT.md
docs/EXTERNAL_REFERENCE_REPOS.md

before major subsystem implementation.

==================================================
LICENSE RULE
==================================================

Do NOT trust a remembered license indefinitely.

The registry may record the currently known license/status, but BEFORE COPYING meaningful source code from any repository:

1. inspect its CURRENT LICENSE file;
2. record the result in its focused repo note;
3. determine whether direct adaptation is acceptable;
4. preserve required attribution/notices;
5. if license is AGPL, restrictive, unclear, absent, or incompatible:
   use concepts/UX/schema as REFERENCE ONLY unless explicitly approved.

Never paste substantial external code into this project without provenance.

==================================================
DO NOT OVERWRITE WORK WE ALREADY HAVE
==================================================

Before borrowing anything, inspect the existing local implementation.

The question is NEVER:

"How would this external repo build this feature?"

The correct question is:

"What do we already have, what problem remains, and does this external repo already contain a proven implementation pattern that solves that specific gap better than inventing another custom solution?"

Prefer:

EXISTING LOCAL IMPLEMENTATION
+
TARGETED UPSTREAM PATTERN
+
OUR BUSINESS RULES

over:

REWRITE EVERYTHING FROM UPSTREAM.

==================================================
OPTIONAL AGENT HANDOFF POINTER
==================================================

If docs/AGENT_HANDOFF.md exists, add ONLY a concise pointer such as:

"Before implementing substantial new subsystem mechanics, consult docs/EXTERNAL_REFERENCE_REPOS.md and the external-reference-repos Cursor rule. External repos are inspected lazily by subsystem, not loaded globally."

Do not paste the registry into AGENT_HANDOFF.md.

==================================================
QUALITY CHECK
==================================================

After creating the registry/rule:

Verify that docs/EXTERNAL_REFERENCE_REPOS.md contains ALL 18 registered references:

1. RFPilot
2. AutoRFP
3. OpenContracts / cite
4. Docling
5. Unstructured
6. TenderRadar
7. OpenSAM
8. OCDS / Open Contracting Standard
9. USAspending API
10. USAspending MCP Server
11. Public-Sector CLM
12. Whereas
13. Wraft
14. Glide Data Grid
15. Novel
16. Morphic
17. Open Deep Research
18. WrenAI

Verify every entry includes:

URL
purpose
consult trigger
what to inspect/borrow
where it maps locally
what not to adopt
usage mode
license caution
analysis status

Verify the rule DOES NOT make Cursor automatically load all 18 repositories.

Verify no product code/schema/migrations were changed.

==================================================
STOP
==================================================

When finished, report ONLY:

1. Files created
2. Files modified
3. Confirmation all 18 repositories are registered
4. Confirmation external repos are routed by subsystem
5. Confirmation max-3 lazy inspection rule exists
6. Confirmation detailed repo notes are created only when actually needed
7. Confirmation license verification is required before source copying
8. Confirmation local architecture overrides external references
9. Confirmation no application code/database/schema/migrations were changed
10. Confirmation nothing was committed or pushed

STOP.

Do not start analyzing the external repositories in depth.
Do not begin implementing features.