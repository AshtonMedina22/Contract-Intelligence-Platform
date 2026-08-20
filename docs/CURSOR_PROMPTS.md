# Cursor execution prompts — small, phase-scoped, canonical

Rule: the canonical docs contain the full requirements. Each Cursor prompt should work on **one bounded slice**, test it, report, then stop. Do not paste the entire blueprint into every task.

Synced August 2026 from the Canonical Product Pack.

**Execution order:** 0 Docs Sync → 1 Historical Pilot → 2 Pilot-Proven Schema → 3 Data Ops/Ingestion → 4 Contracts → 5 Intelligence → 6 Ask/Reports/Automation → 7 Pricing → 8 Response/Submission/Result.

---

## Prompt 0 — Sync canonical docs

Read the canonical product pack and existing repo docs.

For this task ONLY, reconcile:

- `docs/MASTER_BLUEPRINT.md`
- `docs/PRODUCT_SPEC.md`
- `docs/TECH_STACK.md`
- `docs/DATA_ARCHITECTURE.md`
- `docs/BUILD_PLAN.md`
- `docs/CURRENT_STATE_AUDIT.md`
- `docs/UX_UI.md` (create if missing)

The canonical product is proposal-centered government/security procurement intelligence. Primary pursuit flow: **Pursuits → Requirements → Pricing → Response → Submission → Result.** Ask GPT, Reports, Automation, historical intelligence, contracts/renewals, win/loss, buyer/competitor research are first-class.

Do not implement features. Do not commit unless explicitly asked.  
Report files changed, contradictions corrected, remaining code/UX conflicts, current product phase. **STOP.**

---

## Prompt 1 — Real-document Historical Pilot

Read MASTER_BLUEPRINT, PRODUCT_SPEC, DATA_ARCHITECTURE, BUILD_PLAN, UX_UI.

Execute Phase 2 only.  
Use verified public L&P procurement records and actual L&P proposals/contracts/POs/evaluations where obtainable. Use non-L&P security procurement documents only as **TEST CORPUS** for missing document types; never call them L&P history.

Run representative packages through intake → checksum/version → parse → extraction → staging → validation → human verification → canonical promotion.

Update `PILOT_GAP_REPORT` with captured fields, missing schema, parser/extraction failures, provenance/verification problems, source-precedence conflicts, required schema change, and UX placement.  
Do not expand Ask/Pricing AI/Response AI. Run tests/build. **STOP.**

---

## Prompt 2 — Schema from pilot evidence

Read MASTER_BLUEPRINT, DATA_ARCHITECTURE, and PILOT_GAP_REPORT.

For this task ONLY, change Supabase/Postgres where the real-document pilot proved structure is required. Preserve tenancy/RLS, provenance, verification, versions, source precedence, four commercial truths, and audit history.

Add/expand only evidence-backed needs: solicitations/addenda/Q&A, requirements/forms, evaluation, services/sites/posts/staffing/schedules, personnel/training/compliance, pricing structures/lines, proposals/sections, competitor bids/scores, awards/outcomes, contracts/POs/rates/service plans, changes/options/renewals, wage determinations, past performance.

Do not create tables because a UI tab exists. Run RLS/integrity/typecheck/lint/build. Report changes + evidence. **STOP.**

---

## Prompt 3 — Production Data Ops / ingestion

Read canonical docs and validated pilot/schema.

For this task ONLY, productionize: Upload/import → Supabase Storage evidence → document registry → Vercel Workflow → parser/extractor → staging → validation/reconciliation → HUMAN verification → resume Workflow → canonical promotion.

Queues are fan-out only behind JobPort. Support PDF/DOCX/XLSX/scans as proven, SHA-256 dedupe, versions, package grouping, source precedence, and page/sheet/cell provenance. openpyxl first for normal XLSX.

All operational UI belongs under Data Ops: Intake, Processing, Verification, Exceptions, Historical Migration. Verification is a Resizable source-vs-fact workspace.  
Run acceptance tests/build. **STOP** when source-to-canonical is proven.

---

## Prompt 4 — Contracts / compliance / renewals

Read MASTER_BLUEPRINT, PRODUCT_SPEC, DATA_ARCHITECTURE, UX_UI.

For this task ONLY, complete verified-data Contracts.  
Contract workspace: Overview | Service Plan | Commercial Terms | Changes | Renewal.

Use Supabase Cron for 180/120/90/60/30/expired verified-date checks. Do not fabricate absent terms. Run tests/build. **STOP.**

---

## Prompt 5 — Buyer / competitor / market / win-loss

Read canonical docs.

For this task ONLY, complete cross-corpus Intelligence using verified canonical records. Buyer is procurement intelligence, **NOT CRM**. Pursuit-specific intelligence is summarized in Pursuit Overview; cross-corpus views live under Intelligence. Never infer causation without evidence. Never treat a document mention as a bid/award/market fact. Run tests/build. **STOP.**

---

## Prompt 6 — Find / Ask GPT + reports + automation

Read canonical docs.

For this task ONLY, complete global Find or Ask GPT and evidence-backed reports/automation. Ask is a persistent **header** capability, not a sidebar app. LOCATE = SQL/FTS/direct retrieval, no LLM required. ASK/ANALYZE = structured + FTS + pgvector + verified evidence + AI SDK/Gateway synthesis.

Every answer shows sources/data scope/limitations/View Source; insufficient evidence must be explicit. Automation must not bypass human verification, final pricing, proposal approval, or submission authorization. Run tests/build. **STOP.**

---

## Prompt 7 — Pricing Intelligence

Read canonical docs.

For this task ONLY, complete Pricing in two UX contexts.  
Pursuit → Pricing = Glide workbench for THIS solicitation (four commercial truths distinct).  
Intelligence → Pricing = cross-corpus analysis, not bid entry.  
Do not create Pricing as a separate global sidebar item. **FINAL PRICE = HUMAN DECISION REQUIRED.** Run tests/build. **STOP.**

---

## Prompt 8 — Response / Submission / Result

Read canonical docs and drafting/grounding rules.

For this task ONLY, complete the proposal-centered Pursuit workflow: Overview → Requirements → Pricing → Response → Submission → Result.

Response lives inside the Pursuit. Evidence states before generation: `VERIFIED_DRAFT_AVAILABLE` | `REVIEW_REQUIRED` | `L&P_INPUT_REQUIRED`. Reuse: `APPROVED` | `REVIEW_REQUIRED` | `DO_NOT_USE` | `SUPERSEDED`. GPT never invents L&P business facts. Run end-to-end QA. **STOP.**
