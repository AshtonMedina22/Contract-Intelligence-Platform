# Phase 6 acceptance — Search / Ask GPT / Reports / Automation

**Canonical product Phase 6** (Find / Ask / Reports / Automation).

Legacy engineering Phase 6 = parser routing (`PHASE6_ACCEPTANCE.md` / `test:phase6-benchmark`) — **different**.

## Verdict

**PASS** (2026-08-20 Prompt 6 + fix pass)

No independent `VERIFY6_*` report existed on disk. Fix pass audited Prompt 6 exit criteria + `test:phase6-ask` against the live implementation.

## What landed

- **Header Ask** — `[Find or Ask GPT...]` routes to `/intelligence/ask` (not a sidebar app)
- **Modes:** LOCATE | ASK/ANALYZE | REPORT
- **LOCATE** — structured SQL + FTS + direct record/document lookup; no LLM
- **ASK/ANALYZE** — dual-rail streaming agent (`AskChatClient` → `POST /api/ask/chat` → `streamText` + tools): INTERNAL_VERIFIED corpus/structured reads + optional PUBLIC research (Tavily/Brave); authority-labeled source cards; ChatGPT Custom GPT Actions share the same tools. Single-shot `synthesizeGroundedAnswer` remains for drafts/legacy. Public results are cite-only and never written to `document_chunks` / HUMAN_VERIFIED.
- **REPORT** — eight generators: Bid Strategy, Buyer Intelligence Brief, Market Intelligence, Competitor Intelligence, Pricing Intelligence, Win/Loss Analysis, Proposal Improvement / Evaluator Analysis, Executive Intelligence Brief
- **Retrieval purposes** — `GENERAL_QA`, `LOCATE`, `LOSS_ANALYSIS`, `COMPETITOR_ANALYSIS`, `PRICING_ANALYSIS`, `BID_STRATEGY`, `PROPOSAL_DRAFTING`, `COMPLIANCE_REVIEW`, `REPORT_GENERATION`
- **DO_NOT_USE** — allowed for retrospective analysis purposes; **blocked** for `PROPOSAL_DRAFTING`
- **Answer contract** — Answer, Sources/Evidence, Data Scope, Limitations/confidence, View Source **always rendered** (empty-state copy when no evidence); insufficiency: `Insufficient verified evidence to answer this reliably.`
- **Automation (first-class)** — `automation_events` + `private.run_intelligence_automation` / service wrapper; pg_cron `intelligence-automation-daily`; Vercel Cron `/api/cron/intelligence-digest`; document lifecycle remains Vercel Workflow
- Human gates preserved: verification, final pricing, proposal approval, submission authorization, tenant boundaries

Migration: `supabase/migrations/20260820800000_phase6_ask_reports_automation.sql`

## Fix pass (2026-08-20)

| Item | Root cause | Fix | Status |
| --- | --- | --- | --- |
| Answer contract hid Sources / View Source when empty | `AskAnswerPanel` gated those sections on `sources.length > 0` | Always render all five contract headings; empty-state copy + locate links for View Source | **fixed** |
| VERIFY 6 approval reminder | No `approval_reminder` refresher | `20260820810000_verify6_approval_reminder.sql` — remind only when `go_no_go=PENDING` + pre-submit stage; clear when resolved; never auto-approve | **fixed** |

## Checks

```bash
npm run test:phase6-ask
npm run test:phase11-hybrid-rag
npm run lint
npm run typecheck
npm run build
```

Evidence (fix pass): `test:phase6-ask` **25/25 PASS**; `test:verify6` **24/24 PASS**; `test:phase11-hybrid-rag` **10/10 PASS**; browser LOCATE insufficient path shows Answer + Sources/Evidence + Data Scope + Limitations + View Source.

## Deferred dependency (explicit — not a FAIL)

- Live ASK LLM synthesis requires AI Gateway / `ASK_MODEL` env. Without it, ASK stays evidence-only (correct — never invents).
- Finer automation kinds (Q&A deadlines, internal approval reminders, missing submission checklist items) need Phase 8 submission schema fields before date-driven pg_cron checks; current runner covers pursuit `response_due_on`, verification backlog, compliance expirations, contract alerts, and digests.

## Honesty rules

- Never invent answers without verified evidence
- Never use DO_NOT_USE content for proposal drafting
- Automation never auto-approves verification, pricing, proposals, or submission

## Out of scope (Phase 7+)

Glide pricing workbench, finished Response Builder / Tiptap drafting workflow, inventing market share or causation.
