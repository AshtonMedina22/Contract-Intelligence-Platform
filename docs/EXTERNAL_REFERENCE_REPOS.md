# External reference repositories

**STATUS:** Routing / knowledge-registry index only. Not a product specification.  
**This repository remains the authoritative product.** External repos are reference implementations for specific subsystems. They never silently replace our architecture, canonical Supabase/PostgreSQL model, tenant/RLS model, provenance rules, human-verification boundary, four commercial truths, source-precedence rules, canonical UX/IA, human-final-pricing requirement, `L&P INPUT REQUIRED` behavior, or purpose-aware retrieval/reuse controls.

Authoritative local docs: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) · [PRODUCT_SPEC.md](PRODUCT_SPEC.md) · [TECH_STACK.md](TECH_STACK.md) · [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) · [BUILD_PLAN.md](BUILD_PLAN.md) · [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) · [UX_UI.md](UX_UI.md).

UX / shell routing (Plane, Twenty, shadcn, Documenso, etc.): [EXTERNAL_UX_REFERENCES.md](EXTERNAL_UX_REFERENCES.md).

Lazy inspection notes: [reference-repos/README.md](reference-repos/README.md). Cursor rule: `.cursor/rules/external-reference-repos.mdc`.

---

## How to use this registry

Do **not** analyze all registered repositories on every task.

For every implementation task:

1. Read the local canonical docs relevant to the task.
2. Read **this file**.
3. Identify the subsystem being changed.
4. Select **only** the reference repositories that apply to that subsystem.

**Default maximum: 3 external repositories per implementation task.** Use fewer whenever possible.

Then:

5. Inspect existing **local** implementation first. Prefer existing local code + a targeted upstream pattern + our business rules. Never rewrite from upstream.
6. Do **not** clone repositories into this repo. Browse GitHub, or clone to a temporary directory **outside** the project (e.g. `/tmp/contract-intelligence-references/<repo>`). Never commit external repos or their `.git` history.
7. Start with README, architecture/docs, LICENSE, and the specific source directories for the mechanism. Do not read an entire external repository merely because it exists.
8. If a material inspection happens, write `docs/reference-repos/<repo-slug>.md`. Do not create those notes in advance.
9. **Local architecture always wins** on conflict.

External repos provide patterns, implementation examples, UI mechanics, data-normalization ideas, reference schemas, and public data connectors. They do **not** define our product.

A registered repo existing does **not** mean we must adopt its approach.

---

## Routing table

| IF WORKING ON | CONSULT (max 3) |
| --- | --- |
| RFP intake / requirements / response / submission | **RFPilot** + **AutoRFP** |
| PDF evidence / annotations / human verification / provenance | **OpenContracts** |
| PDF / DOCX / XLSX parser | **Docling** first; **Unstructured** as benchmark/alternate |
| Public procurement ingestion / external opportunity sources | **TenderRadar** + **OpenSAM** + **OCDS** (**RFP Map** only for bulk-CSV acquisition; its map UX is declined) |
| Federal awards / federal competitors / federal buyer history | **USAspending API**; optionally **USAspending MCP** for tool architecture |
| Contract domain / changes / renewal / obligations | **Public-Sector CLM**; **Whereas** for UX; **CatalogIT** for renewal-queue mechanics |
| Document / proposal output | **RFPilot** DOCX patterns; **Wraft** where useful |
| Pricing grid mechanics | **Glide Data Grid** |
| Response editor mechanics | **Novel** |
| Find / Ask GPT citations / streaming / source UX | **Morphic** |
| Multi-source buyer / competitor / public research | **Open Deep Research** + **Morphic** |
| Structured analytical questions / NL→SQL | **WrenAI** |

If more than three rows apply, pick the **gap being solved**, not every adjacent analog.

---

## What local architecture always wins

Never replace or collapse:

- Four commercial truths: Buyer Requested · L&P Proposed · Buyer Awarded · Current/Amended
- Trust pipeline: source → staging → **human verification** → canonical promotion
- Provenance: `source_evidence`, `extracted_facts`, `verification_events`, page/sheet coordinates
- Tenant isolation: organizations + memberships + `organization_id` + Postgres RLS
- Canonical DB: Supabase PostgreSQL only
- Canonical evidence vault: Supabase Storage
- Lifecycle: Vercel Workflow (not queues-as-coordinator; not LangGraph-for-ingest)
- Parser abstraction: `DocumentParser` in `services/processor` (provider-abstracted; Docling stub exists, not wired)
- Human final price; `L&P INPUT REQUIRED`; reuse states (`APPROVED` / `REVIEW_REQUIRED` / `DO_NOT_USE` / `SUPERSEDED`)
- Purpose-aware retrieval (drafting must not use `DO_NOT_USE`)
- Canonical IA: Home \| Pursuits \| Intelligence \| Contracts \| Data Ops; Ask GPT in header
- Tiptap + Glide already chosen; Google Docs is working-proposal handoff, not canonical data

---

## License rule

Do **not** trust a remembered license indefinitely. Registry license notes are hints, not clearance.

**Before copying meaningful source code** from any repository:

1. Inspect its **current** `LICENSE` file.
2. Record the result in `docs/reference-repos/<repo-slug>.md`.
3. Determine whether direct adaptation is acceptable.
4. Preserve required attribution/notices.
5. If license is AGPL, restrictive, unclear, absent, or incompatible: use concepts/UX/schema as **REFERENCE ONLY** unless explicitly approved.

Never paste substantial external code into this project without provenance.

---

## Registered repositories

Analysis status at registry creation: **REGISTERED ONLY** for all 18. No deep inspection was performed in this task.

Local maps below are **where the borrowed pattern would land**, not a claim that the upstream code is already adopted.

---

### 1. RFPilot

| Field | Value |
| --- | --- |
| **URL** | https://github.com/valinorintelligence/rfpilot |
| **Reference category** | Pre-award RFP / proposal-response workflow |
| **Usage mode** | ADAPT CODE/PATTERN |
| **Analysis status** | INSPECTED (P5 Pursuit Overview, 2026-08-21) — see [reference-repos/rfpilot.md](reference-repos/rfpilot.md). Section taxonomy adopted; its generation method **rejected**. |
| **License / copy caution** | **MIT** per GitHub license metadata (verified 2026-08-21). Copy-eligible with attribution, but no upstream code has been copied. Its AI schema emits ungrounded scores and win themes — read it as a counter-example, not a template. |

**Why it matters:** Closest public analog to our **pre-award** workflow (intake → requirements → response → submission outputs).

**Consult when:** RFP intake; solicitation extraction; requirements; evaluation extraction; compliance extraction; response generation; response gaps; submission outputs; DOCX proposal generation; capability matching.

**Inspect / borrow:** RFP document → structured requirements; deadline extraction; evaluation-criteria extraction; compliance extraction; capability-to-requirement matching; gap detection; proposal response generation flow; structured Word/DOCX output; activity/audit patterns; backend service separation for extraction, matching, AI, and output.

**Maps to our platform:** Pursuit → Requirements → Response → Submission. Python extraction schemas/services.

**Local landing zones:** `apps/web/app/(platform)/procurement/opportunities/[opportunityId]/requirements/`; `.../response/`; `.../submission/`; `apps/web/components/opportunity-workspace/`; `services/processor/src/lp_processor/extractors/`.

**Do not:** replace our four-truth model; replace verification/provenance; replace downstream contract intelligence; adopt its application architecture wholesale.

---

### 2. AutoRFP

| Field | Value |
| --- | --- |
| **URL** | https://github.com/run-llama/auto_rfp |
| **Reference category** | Pursuit / requirements / evidence / response workflow |
| **Usage mode** | ADAPT CODE/PATTERN |
| **Analysis status** | **ADOPTED PATTERN (P6, 2026-08-21)** — see [reference-repos/auto-rfp.md](reference-repos/auto-rfp.md) |
| **License / copy caution** | **MIT** per upstream README, verified 2026-08-21. No source copied; question-scoped workflow shape only. LlamaCloud / Prisma explicitly declined. |

**Why it matters:** Public implementation of project-scoped RFP Q&A: question extraction, evidence retrieval, citations, and human answer editing.

**Consult when:** Pursuit workspace; requirement decomposition; response workflow; evidence retrieval; per-response citations; answer editing; project knowledge; organization isolation.

**Inspect / borrow:** RFP project/workspace structure; organization/multi-tenant patterns where applicable; document knowledge sources; automatic question extraction; answer-generation jobs; source retrieval; source relevance presentation; per-answer citations; human response editing; question → evidence → answer UX.

**Maps to our platform:** Pursuit; Requirements; Response; Evidence / Sources.

**Local landing zones:** Pursuit workspace under `apps/web/app/(platform)/procurement/opportunities/`; `apps/web/components/opportunity-workspace/response-tiptap-editor.tsx`; `apps/web/lib/ask/evidence.ts`; `source_evidence` / `document_chunks`; RLS tenancy already in Supabase — do not replace.

**Do not:** replace our Supabase/RLS architecture or canonical schema.

---

### 3. OpenContracts / cite

| Field | Value |
| --- | --- |
| **URL** | https://github.com/Open-Source-Legal/OpenContracts |
| **Reference category** | Human verification, source evidence, document ground-truth |
| **Usage mode** | ADAPT CODE/PATTERN |
| **Analysis status** | INSPECTED (P2 Data Ops, 2026-08-20; pattern reused P5 Pursuit Overview, 2026-08-21) — see [reference-repos/opencontracts.md](reference-repos/opencontracts.md) |
| **License / copy caution** | **MIT** on `main` LICENSE (verified 2026-08-20). Older AGPL forks exist — do not copy those. Prefer conceptual PAWLs/verify UX adaptation over wholesale paste. |

**Why it matters:** Strongest public analog for PDF coordinates → selected evidence → annotated ground truth → human review. Compare directly against our verification workbench.

**Consult when:** Data Ops; Verification; PDF viewer; source highlighting; source evidence; citation architecture; annotation; document versioning; extraction review; lexical/vector search over evidence.

**Inspect / borrow:** PDF text-coordinate mapping; exact source highlighting; annotation objects; page/layout provenance; source-text selection; human annotation as ground truth; document corpus management; document version history; extraction-job structure; human review mechanics; vector + lexical search; relationships between source documents.

**Maps to our platform:** Data Ops → Verification. Target flow: document → page/text coordinates → selected source evidence → extracted fact → human verify/edit/reject → source-linked ground truth.

**Local landing zones (compare, do not replace):** `apps/web/app/(platform)/ingestion/verification/` (`workbench-client.tsx`, `pdf-source-pane.tsx`); tables `source_evidence`, `extracted_facts`, `verification_events`, `document_chunks`; View Source.

**Do not:** replace our canonical procurement model.

---

### 4. Docling

| Field | Value |
| --- | --- |
| **URL** | https://github.com/docling-project/docling |
| **Reference category** | Primary parser / normalized document representation |
| **Usage mode** | USE LIBRARY + ADAPT EXAMPLES |
| **Analysis status** | INSPECTED (P2 Data Ops, 2026-08-20) — see [reference-repos/docling.md](reference-repos/docling.md) |
| **License / copy caution** | **MIT** codebase (verified 2026-08-20). Model packages have separate licenses — clear before install. Prefer library use behind our `DocumentParser` abstraction; **not wired**. |

**Why it matters:** Candidate primary parser for PDF/DOCX layout, tables, reading order, coordinates, OCR fallback, and a normalized document object model. Our architecture must remain **provider-abstracted**.

**Consult when:** PDF parsing; DOCX parsing; table extraction; reading order; page coordinates; layout; OCR; normalized document objects.

**Inspect / borrow:** Document object model; pages; sections/headings; tables; cells; coordinates; reading order; OCR fallback; structured exports; parser APIs.

**Maps to our platform:** `services/processor`; parser adapters; normalized document representation.

**Local landing zones:** `services/processor/src/lp_processor/parsers/base.py` (`DocumentParser`); `models.py` (`NormalizedDocument`); `routing.py` / `routing_policy.json` (DoclingParser **stub exists, not wired**); `pdf.py`, `docx.py`, `xlsx.py` (openpyxl remains XLSX primary).

**Do not:** hard-code Docling as the product architecture. Wire only if pilot benchmarks justify it.

---

### 5. Unstructured

| Field | Value |
| --- | --- |
| **URL** | https://github.com/Unstructured-IO/unstructured |
| **Reference category** | Alternate document ingestion / partitioning / preprocessing |
| **Usage mode** | BENCHMARK ONLY + SELECTIVE ADAPTATION |
| **Analysis status** | INSPECTED (P2 Data Ops, 2026-08-20) — see [reference-repos/unstructured.md](reference-repos/unstructured.md) |
| **License / copy caution** | **Apache-2.0** (verified 2026-08-20). Benchmark first; do not install as default parser. |

**Why it matters:** Alternate partition/chunk/metadata pipeline for parser benchmarking against Docling and our native adapters.

**Consult when:** Parser benchmarking; document partitioning; chunk generation; metadata preservation; preprocessing; format-specific processing.

**Inspect:** File-type dispatch; partition strategies; element model; chunking; metadata propagation; preprocessing; type-specific routing.

**Maps to our platform:** Python processor; alternate parser route; RAG chunk-production pipeline.

**Local landing zones:** `services/processor/src/lp_processor/parsers/`; `document_chunks` eligibility after verification; [benchmarks/PILOT_GAP_REPORT.md](benchmarks/PILOT_GAP_REPORT.md).

**Do not:** replace Docling (or native PDF) automatically. Docling vs Unstructured vs native must be **benchmark-driven**.

---

### 6. TenderRadar

| Field | Value |
| --- | --- |
| **URL** | https://github.com/d4d0h/tenderradar |
| **Reference category** | Public procurement source-adapter architecture |
| **Usage mode** | ADAPT ARCHITECTURE/CODE WHERE APPROPRIATE |
| **Analysis status** | INSPECTED (P4 Discovery, 2026-08-21) — metadata + license only; see [reference-repos/tenderradar.md](reference-repos/tenderradar.md) |
| **License / copy caution** | **UNLICENSED** — GitHub reports no license file (verified 2026-08-21). **REFERENCE ONLY**; do not copy source. Adapter concept adopted, no upstream code. Do not import its database. |

**Why it matters:** One-adapter-per-source model for public RFP discovery, sync, normalize, dedupe/upsert.

**Consult when:** Public RFP discovery; external opportunity feeds; government procurement source adapters; opportunity synchronization; dedupe/upsert; external source normalization; matching/filtering.

**Inspect / borrow:** One-adapter-per-procurement-source; SAM adapter; other procurement-source adapters; synchronization jobs; common tender representation; source normalization; dedupe/upsert; filters; deadline tracking; opportunity matching.

**Maps to our platform:** Public Research; Buyer Intelligence; Market Intelligence; future opportunity discovery.

**Expected local abstraction (when we build it):**

```text
PublicProcurementProvider
├── SamGovProvider
├── UsaSpendingProvider
├── StateProcurementProvider
├── LocalGovernmentProvider
├── ManualWebResearchProvider
└── FutureProvider
```

**Local landing zones (built in P4, 2026-08-21):** `apps/web/lib/procurement/providers/` — `types.ts` (`PublicProcurementProvider`, `NormalizedPublicOpportunity`), `sam-gov.ts`, `manual.ts`, `index.ts`; `public_sources` table; Pursuits → Discover / Watchlist. `apps/web/lib/ask/research/provider.ts` remains the separate Ask/Tavily/Brave research rail. Do not make TenderRadar’s DB our canonical DB.

**Do not:** adopt TenderRadar’s database as our canonical database.

---

### 7. OpenSAM

| Field | Value |
| --- | --- |
| **URL** | https://github.com/akshayakula/OpenSAM |
| **Reference category** | SAM.gov opportunity discovery / search concepts |
| **Usage mode** | SELECTIVE REFERENCE / ADAPTATION |
| **Analysis status** | INSPECTED (P4 Discovery, 2026-08-21) — metadata + license only; see [reference-repos/opensam.md](reference-repos/opensam.md) |
| **License / copy caution** | **UNLICENSED** — GitHub reports no license file (verified 2026-08-21). **REFERENCE ONLY**; do not copy source. Only public SAM.gov API parameter/response conventions were used. |

**Why it matters:** Federal opportunity search UX and SAM.gov request/normalization ideas.

**Consult when:** SAM.gov; federal opportunity discovery; NAICS filtering; federal solicitation search; opportunity matching; federal opportunity UX.

**Inspect:** SAM.gov request/API patterns; opportunity normalization; NAICS/category filters; semantic matching concepts; federal opportunity search UX.

**Maps to our platform:** Government procurement research; Public Research; Buyer / Market Intelligence.

**Local landing zones (built in P4, 2026-08-21):** `apps/web/lib/procurement/providers/sam-gov.ts` — live when `SAM_GOV_API_KEY` / `SAM_API_KEY` is set, otherwise clearly labeled `FIXTURE-SAM-*` sample data. Live path is **unvalidated against a real response**. Ask `search_public_research` tools remain separate.

**Do not:** make OpenSAM our federal system of record. **Do not** add AI fit scoring or semantic ranking of public notices — a public listing is not a bid decision.

---

### 8. Open Contracting Data Standard (OCDS)

| Field | Value |
| --- | --- |
| **URL** | https://github.com/open-contracting/standard |
| **Reference category** | External procurement lifecycle vocabulary and normalization |
| **Usage mode** | SCHEMA REFERENCE |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | This is **not an application to copy**. Study vocabulary/schema. Inspect LICENSE before reproducing schema text. |

**Why it matters:** Shared public-procurement lifecycle terms for **external** normalization — not a replacement for L&P-specific schema.

**Consult when:** External procurement schema; public procurement normalization; tender/award/contract relationships; procurement lifecycle terminology; amendments; buyer/supplier/award relationships.

**Study:** planning; tender; tenderer; award; supplier; contract; implementation; amendment; buyer; parties; milestones; documents; identifiers.

**Example mapping (external vocab → ours):**

| OCDS | Ours |
| --- | --- |
| Tender | Solicitation / Pursuit |
| Tenderer | Bidder |
| Award | Award |
| Supplier | Awarded vendor / competitor |
| Contract | Contract |
| Amendment | Change |
| Implementation | Current-performance evidence |
| Buyer | Buyer / Agency |
| Milestone | Lifecycle event / deadline |
| Document | Source evidence |

**Maps to our platform:** Canonical domain language in [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md); public-source adapters.

**Do not:** replace our L&P-specific schema. We still own L&P proposed, internal cost, evaluator intelligence, reuse status, proposal responses, `L&P INPUT REQUIRED`, and human price decisions.

---

### 9. USAspending API

| Field | Value |
| --- | --- |
| **URL** | https://github.com/fedspendingtransparency/usaspending-api |
| **Reference category** | Federal award / recipient / agency / spending intelligence |
| **Usage mode** | DATA/API SOURCE |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Prefer calling the **public API/dataset**, not copying the service. Inspect LICENSE/terms before copying server code. |

**Why it matters:** Authoritative public federal awards, recipients, agencies, NAICS/PSC, amounts, dates. Prefer using the actual public data/API over recreating the dataset.

**Consult when:** Federal awards; incumbent/competitor evidence; recipient/vendor profiles; award amounts; agency hierarchy; NAICS / PSC; federal market research; historical contract searches.

**Inspect / use:** Award search/filter model; recipient lookup; agency hierarchy; award IDs; NAICS; PSC; award amounts; dates; contract records; pagination; API filtering; normalization.

**Maps to our platform:** Buyer Intelligence; Competitor Intelligence; Federal Market Intelligence; Public Research.

**Local landing zones:** Future `UsaSpendingProvider`; Intelligence Buyers / Competitors / Market; Ask public-research tools. Persist only as `research_sources` / `research_facts` with provenance — never as unverified canonical L&P truth.

---

### 10. USAspending MCP Server

| Field | Value |
| --- | --- |
| **URL** | https://github.com/cyanheads/usaspending-mcp-server |
| **Reference category** | Tool interface around USAspending data |
| **Usage mode** | ADAPT/REUSE TOOL PATTERNS |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Inspect current LICENSE before copying. MCP is optional; a direct provider adapter may be simpler. |

**Why it matters:** Normalized tool inputs/outputs for award search, recipient, agency, and spending aggregation — useful for Ask GPT tool design.

**Consult when:** Ask GPT tools; public research tools; federal award lookup; recipient lookup; agency lookup; award analytics.

**Inspect:** Award search tool; award detail tool; recipient search; agency lookup; spending aggregation; normalized tool inputs/outputs; MCP/API abstraction patterns.

**Maps to our platform:** Future `public_research` tool layer; Ask GPT controlled tools.

**Local landing zones:** `apps/web/lib/ask/tools.ts`; `apps/web/lib/ask/research/provider.ts`. TECH_STACK: MCP is later/optional, not a core Phase 1–8 dependency.

**Do not:** make MCP an initial hard dependency if a direct provider adapter is simpler.

---

### 11. Public-Sector Contract Lifecycle Management

| Field | Value |
| --- | --- |
| **URL** | https://github.com/benjaminbellman/contract-lifecycle-management |
| **Reference category** | Government / public-sector CLM domain design |
| **Usage mode** | ARCHITECTURE / SCHEMA REFERENCE |
| **Analysis status** | INSPECTED FOR TASK (P10) — see [reference-repos/public-sector-clm.md](reference-repos/public-sector-clm.md) |
| **License / copy caution** | **No license file** (verified 2026-08-21). REFERENCE ONLY — do not copy code, schema DDL or documentation text. Use to check missing standard CLM mechanics. |

**Why it matters:** Checklist of standard CLM mechanics (obligations, amendments, approvals, renewals, events, audit, RBAC) against our contract workspace.

**Consult when:** Contract lifecycle; obligations; amendments; approvals; renewals; document versions; contract events; audit; RBAC concepts.

**Study:** Contract entity relationships; obligation tracking; approval/audit model; amendment lineage; renewal lifecycle; contract event history; document/version relationships.

**Maps to our platform:** Contracts → Commercial Terms; Contracts → Changes; Contracts → Renewal.

**Local landing zones:** `apps/web/app/(platform)/contracts/`; `[contractId]/service-plan`, `commercial-terms`, `changes`, `renewal`; tables `contracts`, `contract_amendments`, `contract_options`, `renewals`, `contract_alerts`.

**Do not:** replace our contract workspace design.

---

### 12. Whereas

| Field | Value |
| --- | --- |
| **URL** | https://github.com/zgbrenner/whereas |
| **Reference category** | Modern contract repository / CLM UX |
| **Usage mode** | UX REFERENCE |
| **Analysis status** | ADOPTED PATTERN (P10) — see [reference-repos/whereas.md](reference-repos/whereas.md) |
| **License / copy caution** | **GPL-3.0** (verified 2026-08-21 — previously recorded here as AGPL). **REFERENCE ONLY**; copyleft, not approved for copy. Do not copy source. |

**Why it matters:** Guided intake, triage, workspace, findings, approvals, and version-timeline UX for contracts.

**Consult when:** Contract intake; triage; contract workspace; review findings; approvals; contract document history; clause findings; remediation UX.

**Study:** Guided intake; inbox/triage; request → repository workflow; contract record workspace; version timeline; review findings; approval surfaces; human review after automated extraction.

**Maps to our platform:** Contracts UX; possibly Data Ops intake/review UX.

**Local landing zones:** Contract workspace tabs; Data Ops Intake / Verification. Canonical IA stays Home \| Pursuits \| Intelligence \| Contracts \| Data Ops.

---

### 13. Wraft

| Field | Value |
| --- | --- |
| **URL** | https://github.com/wraft/wraft |
| **Reference category** | Structured document creation / lifecycle / output |
| **Usage mode** | UX / ARCHITECTURE REFERENCE |
| **Analysis status** | INSPECTED (P8 Submission/Result, 2026-08-21) — see [reference-repos/wraft.md](reference-repos/wraft.md) |
| **License / copy caution** | **AGPL-3.0** verified (`LICENSE.md`). **REFERENCE ONLY.** Do not replace Tiptap/Google Docs. |

**Why it matters:** Template → reusable content → versioned output pipeline ideas for proposal packages.

**Consult when:** Document generation; proposal output; reusable structured content; templates; document versioning; export workflows; collaboration concepts.

**Study:** Structured templates; reusable content blocks; template → content → output pipeline; document lifecycle; versioning; document generation.

**Maps to our platform:** Response; Submission; DOCX/PDF generation; future output workflows.

**Local landing zones:** `apps/web/components/opportunity-workspace/submission-workbench.tsx` (Google Docs URL + DOCX-compatible export); Response Tiptap; content reuse library. Google Docs remains working-proposal handoff, not canonical data.

**Do not:** replace Tiptap / Google Docs architecture.

---

### 14. Glide Data Grid

| Field | Value |
| --- | --- |
| **URL** | https://github.com/glideapps/glide-data-grid |
| **Reference category** | Pricing spreadsheet mechanics |
| **Usage mode** | USE LIBRARY + ADAPT OFFICIAL EXAMPLES |
| **Analysis status** | **ADOPTED PATTERN** (P7, 2026-08-21) — [glide-data-grid.md](reference-repos/glide-data-grid.md) |
| **License / copy caution** | We already depend on `@glideapps/glide-data-grid` (installed **6.0.3**, `"license": "MIT"` in the npm package; no separate LICENSE file ships in the tarball). No upstream source has been copied — only the public API is used. |

**Why it matters:** **We already use Glide.** Do not manually reimplement a grid interaction Glide already supplies.

**Consult when:** **Before** writing custom spreadsheet/grid behavior.

**Find existing Glide examples for:** currency cells; percentages; dropdowns; custom cells; validation; read-only cells; computed cells; paste ranges; bulk editing; selection; frozen columns; column resize; keyboard navigation; tooltips; context menus; custom headers; summaries; high-volume rendering.

**Maps to our platform:** Pursuit → Pricing.

**Local landing zones:** `apps/web/components/opportunity-workspace/pricing-glide-grid.tsx`; `pricing-workbench.tsx`. Five commercial truths stay visually distinct; human final bid remains required.

**Adopted in P7:** `freezeColumns`, `GridColumn.group` + per-column `themeOverride` banding, `GridCellKind.Uri` + `onClickUri` → verification, `GridCellKind.Number` with our own currency `displayData`, `rowMarkers`/`rowSelect`/`rangeSelect`, `getCellsForSelection` + `copyHeaders`, `getRowThemeOverride`, and a `Theme` resolved from shadcn tokens (canvas cannot resolve `hsl(var(--x))`). **Its editing surface is deliberately declined** — no `onCellEdited`, `onPaste={false}` — because a grid edit would create a rate with no `source_fact_id`. Grid cells route to the human write path instead.

---

### 15. Novel

| Field | Value |
| --- | --- |
| **URL** | https://github.com/steven-tey/novel |
| **Reference category** | Tiptap / Notion-style response-editor interaction |
| **Usage mode** | ADAPT UI COMPONENT/PATTERN |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Inspect current LICENSE before copying. We already use Tiptap; borrow UX patterns, not the app shell. |

**Why it matters:** **We already use Tiptap.** Novel is the proven slash-command / bubble-menu / AI-edit pattern source named in TECH_STACK.

**Consult when:** **Before** manually creating editor mechanics such as slash commands, bubble menus, selection menus, toolbar interactions, AI editing commands, contextual rewrite/expand, streaming insertion, rich block UX, keyboard behaviors.

**Maps to our platform:** Pursuit → Response. Custom value is layout, not the editor kernel:

- LEFT: Requirements
- CENTER: Tiptap / Novel-derived editor
- RIGHT: Evidence, sources, historical answers, evaluator feedback, missing information, reuse status

**Local landing zones:** `apps/web/components/opportunity-workspace/response-tiptap-editor.tsx`; Pursuit `.../response/`.

**Do not:** turn Novel into our application architecture.

---

### 16. Morphic

| Field | Value |
| --- | --- |
| **URL** | https://github.com/miurla/morphic |
| **Reference category** | Grounded search/answer UX and public-research presentation |
| **Usage mode** | HIGH-VALUE CODE/PATTERN REFERENCE |
| **Analysis status** | INSPECTED (P9 Intelligence Workbench, 2026-08-21) — see [reference-repos/morphic.md](reference-repos/morphic.md). Single-surface handoff + scope disclosure adopted; second chat surface and provider abstraction **rejected**. |
| **License / copy caution** | **Apache-2.0** (verified 2026-08-21). Copy-eligible with attribution + NOTICE; no upstream source has been copied, so no NOTICE obligation is owed. UX/streaming/citation patterns only. |

**Why it matters:** Ask experience (question → tool state → streaming answer → citations → source cards → follow-up) and public-research presentation.

**Consult when:** Find / Ask GPT; citations; streaming answer UX; source cards; follow-up questions; public research; buyer intelligence briefs; competitor research; research result UI.

**Inspect:** Ask flow above; research query → multiple sources → retrieval → synthesis → citation-rich result; provider abstraction; multiple search backends; model routing; answer history; source presentation; streaming generative UI.

**Maps to our platform:** Global Find / Ask GPT; Public Research; Buyer Research; Competitor Research; Sources / Evidence presentation.

**Local landing zones:** `apps/web/components/ask/ask-chat.tsx`; `apps/web/app/(platform)/intelligence/ask/page.tsx`; `apps/web/lib/ask/tools.ts`; `apps/web/lib/ask/evidence.ts`; `apps/web/lib/ask/research/provider.ts`; header Ask in `app-shell-header.tsx`. Answer contract remains Answer / Sources / Data Scope / Limitations / View Source.

**Do not:** turn the entire platform into Morphic.

---

### 17. Open Deep Research

| Field | Value |
| --- | --- |
| **URL** | https://github.com/langchain-ai/open_deep_research |
| **Reference category** | Multi-step public buyer / competitor / market research orchestration |
| **Usage mode** | ARCHITECTURE / ORCHESTRATION REFERENCE |
| **Analysis status** | INSPECTED (P5 Pursuit Overview, 2026-08-21) — see [reference-repos/open-deep-research.md](reference-repos/open-deep-research.md). Citation discipline adopted; orchestration **declined** for the Overview. |
| **License / copy caution** | **MIT** per GitHub license metadata (verified 2026-08-21). Copy-eligible with attribution; no upstream code copied. **LangGraph was not installed** and the architecture lock still forbids it here. |

**Why it matters:** Query planning, parallel/iterative search, source dedupe, compression, and sourced synthesis for “research this buyer/competitor.”

**Consult when:** Research this buyer; research this competitor; Bid Strategy research; multi-source public research; report research; iterative research.

**Study:** Query planning; research subquestions; parallel search; iterative search; source dedupe; source summarization; evidence compression; research state; final sourced synthesis; evaluation; search-tool abstraction.

**Target concept:** Research Buyer → plan → search awards/contracts/procurement records/board material/budgets → dedupe → extract useful evidence → synthesize → save sources/facts.

**Maps to our platform:** Public Research engine; Buyer Intelligence; Competitor Intelligence; Bid Strategy; research-backed Reports.

**Local landing zones:** `apps/web/lib/ask/research/provider.ts`; Intelligence Buyers / Competitors / Reports (`apps/web/lib/reports/generate.ts`). TECH_STACK: no LangGraph-for-ingest; durable agents only if a proven workflow requires them.

**Do not:** introduce a durable agent framework unless the product genuinely requires it.

---

### 18. WrenAI

| Field | Value |
| --- | --- |
| **URL** | https://github.com/Canner/WrenAI |
| **Reference category** | Governed natural-language structured analytics / NL→SQL |
| **Usage mode** | ARCHITECTURE / PATTERN REFERENCE |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Inspect current LICENSE before copying. Often restrictive/AGPL-class — treat as REFERENCE ONLY until verified and approved. |

**Why it matters:** Structured-analytics questions are **not** ordinary RAG. WrenAI is a pattern for a semantic business model → validated read-only SQL → real Postgres result → optional LLM explanation.

**Consult when:** questions such as: How many ISD bids did we lose? What is median awarded pricing? Which competitors appear most often? What contracts expire next year? What is our observed win rate by buyer type?

**Study:** Semantic/business model; metric definitions; entity relationships; dimensions; approved joins; business terminology; NL→SQL planning; SQL validation; governed execution; result explanation; reproducible query definitions.

**Target flow:** QUESTION → semantic business model → validated **read-only** SQL → Supabase/PostgreSQL → real result → optional LLM explanation.

**Maps to our platform:** Ask GPT structured-data tools; Executive / Business Intelligence; Analytics; Reports.

**Local landing zones:** Ask `structured_query` / locate tools in `apps/web/lib/ask/tools.ts`; `apps/web/lib/reports/generate.ts`; `apps/web/app/(platform)/intelligence/analytics/`. AI never receives unrestricted authority to mutate canonical truth.

**Do not:** replace Supabase/Postgres. **Do not** allow unrestricted or destructive LLM-generated SQL.

---

### 19. RFP Map

| Field | Value |
| --- | --- |
| **URL** | https://github.com/EthanHNguyen/rfp-map |
| **Reference category** | SAM.gov bulk-data acquisition (map UX declined) |
| **Usage mode** | SELECTIVE REFERENCE — acquisition strategy only |
| **Analysis status** | INSPECTED (P4 Discovery, 2026-08-21) — README + license only; see [reference-repos/rfp-map.md](reference-repos/rfp-map.md) |
| **License / copy caution** | **MIT** (verified 2026-08-21) — permissive, copy-eligible with attribution. Nothing was copied, so nothing is owed. |

**Why it matters:** It acquires SAM.gov opportunities from the **public bulk CSV** on a schedule and
precomputes compact payloads, instead of calling the v2 search API per request. That is a real
alternative if per-request search proves rate-limited or slow.

**Consult when:** SAM.gov bulk-feed ingestion; scheduled refresh of a public notice corpus.

**Inspect:** its ingest script's normalization of the bulk CSV columns. Nothing else.

**Maps to our platform:** a possible future acquisition mode for
`apps/web/lib/procurement/providers/sam-gov.ts`.

**Do not:** adopt its **map / radar UX** — our discovery chrome is desktop-first and table-centric
(P4 shipped a dense notice table). **Do not** adopt its "market-gravity" approximate dollar values;
we populate `estimated_value` only when the provider supplies an amount.

---

### 20. Rival

| Field | Value |
| --- | --- |
| **URL** | https://github.com/tessak22/rival |
| **Reference category** | Competitor-intelligence view density and per-competitor brief launch |
| **Usage mode** | SELECTIVE REFERENCE — layout / launch pattern only |
| **Analysis status** | INSPECTED (P9 Intelligence Workbench, 2026-08-21) — README + license only; see [reference-repos/rival.md](reference-repos/rival.md). Density + per-entity brief launch adopted as a pattern; research rail **rejected**. |
| **License / copy caution** | **MIT** (verified 2026-08-21) — permissive, copy-eligible with attribution. Nothing was copied, so nothing is owed. |

**Why it matters:** It treats a competitor as a first-class row you open, backed by several focused
evidence tables, with a per-competitor "brief" action that launches the app's existing answer surface
with that entity already in scope.

**Consult when:** Competitors view layout; per-entity brief launch; buyer/competitor detail density.

**Inspect:** its competitor-profile composition and the brief-launch affordance. Nothing else.

**Maps to our platform:** `apps/web/app/(platform)/intelligence/competitors/` and the per-buyer brief
chip on `/intelligence/clients`.

**Do not:** adopt its **Tabstack-powered scan / Deep Dive research rail** — that is a second research
engine, and our public rail is the existing Phase 6 dual-rail agent. **Do not** adopt scheduled
competitor scans, change-diff summaries, or any competitor score / rank / threat level.

---

### 21. CatalogIT

| Field | Value |
| --- | --- |
| **URL** | https://github.com/jonymaster/catalogIT |
| **Reference category** | Renewal-date risk, renewal queue and scheduled-reminder mechanics |
| **Usage mode** | SELECTIVE REFERENCE — queue / exposure-summary pattern only |
| **Analysis status** | ADOPTED PATTERN (P10 Contract Portfolio + Renewal/Rebid, 2026-08-21) — README + license metadata only; see [reference-repos/catalogit.md](reference-repos/catalogit.md) |
| **License / copy caution** | **MIT** (verified 2026-08-21) — permissive, copy-eligible with attribution. Nothing was copied, so nothing is owed. |

**Why it matters:** The clearest public implementation of the date-risk layer — renewal dates as a
first-class field, an exposure summary above the individual records, and reminders fired by a daily
scheduled job rather than computed at render.

**Consult when:** Renewal queue shape; expiry bucket / exposure summary; surfacing when a scheduled
recompute last ran.

**Inspect:** the renewal calendar / queue composition and the scheduled reminder-dispatch split.
Nothing else.

**Maps to our platform:** `/contracts` exposure strip, `/contracts/renewals` action queue,
`contract_alerts` + the `refresh-contract-alerts` Supabase cron.

**Do not:** adopt its **notification dispatch** (Gmail / Slack / Telegram / webhooks) — P10 sends
nothing and renews nothing. **Do not** adopt its SaaS/seat/vendor cost model or per-seat spend
analysis; our schema records an award NTE ceiling and obligated purchase orders and refuses to
synthesise a single "contract value" from them.

---

## Registry completeness

Registered (21/21):

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
19. RFP Map  
20. Rival  
21. CatalogIT  

Adding a new reference: append an entry with the same fields, add a routing-table row, keep status **REGISTERED ONLY** until a task inspects it, and do not create a `docs/reference-repos/<slug>.md` until that inspection happens.
