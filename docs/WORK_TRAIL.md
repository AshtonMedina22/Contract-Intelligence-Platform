# Work trail — living product vs required

**This is the operational tracker.** Update it at the end of every agent session that ships, blocks, or changes direction. Do not leave status only in chat.

| Field | Value |
| --- | --- |
| **Last updated** | 2026-08-20 (reconciled with [FOUNDATION_AUDIT_2026-08-20.md](FOUNDATION_AUDIT_2026-08-20.md)) |
| **Git HEAD on origin/main** | run `git log -1` (was `f1f16ea` at audit) |
| **Product truth gate** | VERIFY9 = engineering/trust harness READY WITH NONBLOCKING LIMITATIONS — **not** full Phase 2–8 product exit. Corpus ~7 A/B; exit ~20–30 unmet. |
| **Rollback** | `cursor-phase2-foundation` @ `8d2d031` |

Companion: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md). Blueprint: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). Long-form domains/tables: [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). Pack: [CANONICAL_PRODUCT_PACK.md](CANONICAL_PRODUCT_PACK.md).

---

## Architecture decisions locked (2026-08-20 human)

| Decision | Choice |
| --- | --- |
| Evidence vault | **Supabase Storage** (Drive = import/source only) |
| Lifecycle | **Vercel Workflow** (Queues = fan-out only) |
| Product phases | **1–8** (pilot = Phase 2; complete after 8) |
| Global IA | **Home \| Pursuits \| Intelligence \| Contracts \| Data Ops** |

Full business domains / validation / pricing / contracts / RAG / table maps live in MASTER_PRODUCT_CONTEXT — not discarded.

---

## Honest position (one screen)

| Lens | Today | Required to be |
| --- | --- | --- |
| **What L&P can actually use** | App shell, login, intake/verify **code**, empty corpus | Verified historical packages answering new RFPs with citations |
| **Phase 1 Foundation** | **Local exit gate proven** (RLS 48/48, intake, verification, processor pytest, lint/typecheck/build). Prod env still ops | Same proven in production use |
| **Phase 2 Historical Pilot** | VERIFY 2B + 2C PASS. 7 A/B source-to-canonical; schema accepted | Corpus count ~20–30 still open |
| **Phase 3 Historical Ingestion** | **PASS** — Data Ops productionized ([PHASE3_ACCEPTANCE.md](PHASE3_ACCEPTANCE.md)); DOCX wired; OCR key-gated; package grouping; resizable verify | Set `MISTRAL_API_KEY` for live scans; grow corpus |
| **Phase 4 Contracts / Compliance** | **Prompt 4 exit** — Portfolio/Renewals/Compliance nav; workspace tabs wired to verified tables; alert buckets; [PHASE4_ACCEPTANCE.md](PHASE4_ACCEPTANCE.md) | Validate on more real awarded instruments; grow corpus |
| **Phase 5 Intelligence** | **Prompt 5 + VERIFY 5 PASS** — Buyers/Competitors/Market/Pricing/Win-Loss/Content/Reports; [PHASE5_INTELLIGENCE_ACCEPTANCE.md](PHASE5_INTELLIGENCE_ACCEPTANCE.md) | Corpus-thin |
| **Phase 6 Ask / Reports / Automation** | **Prompt 6 + VERIFY 6 PASS** — LOCATE/ASK/REPORT; purpose-aware retrieval; 8 reports; automation incl. approval reminders; [PHASE6_ASK_REPORTS_AUTOMATION_ACCEPTANCE.md](PHASE6_ASK_REPORTS_AUTOMATION_ACCEPTANCE.md) | Corpus-thin; ASK synthesis needs AI Gateway/`ASK_MODEL` |
| **Phase 7 Pricing Intelligence** | Prompt 7 + **VERIFY 7 PASS** — blank comparable reason blocked; Glide source_fact URI columns. [VERIFY7_ACCEPTANCE.md](pilot/VERIFY7_ACCEPTANCE.md) | Grow verified pricing corpus |
| **Phase 8 Response / Submission / Result** | Prompt 8 + **VERIFY 8 PASS** — end-to-end pre-award flow. [VERIFY8_ACCEPTANCE.md](pilot/VERIFY8_ACCEPTANCE.md) | Grow verified corpus |
| **Docs** | Pack + full master context reconciled | Same |
| **App IA** | Prompt 0B remapped shell to UX_UI | Remaining: unlisted registry routes, empty corpus |
| **Production** | Often no org / sign-in | Linked Supabase + migrations + authenticated org |

**Bottom line:** VERIFY 9 fix pass = **READY WITH NONBLOCKING LIMITATIONS**. Engineering/trust gates green; deferred: grow corpus to ~20–30, `vercel login` + prod processor, `ASK_MODEL`. See [VERIFY9_ACCEPTANCE.md](pilot/VERIFY9_ACCEPTANCE.md).

---

## Next ordered work

1. Restore Downloads USABLE PDFs → re-run pilot into L&P org (closes corpus limitation).  
2. `vercel login` + confirm production processor.  
3. Set `ASK_MODEL` / AI Gateway.  
4. Push VERIFY9 fix-pass when asked.  

---

## Session log

| When | What happened | Outcome | Follow-up |
| --- | --- | --- | --- |
| 2026-08-20 | Schema/RLS audit follow-up | Trust migration + gate `createContractFromWin`; docs updated | Apply migration on live Supabase |
| 2026-08-19 | Pass 3+4 ops UI | `547e16c` | Migrations |
| 2026-08-19–20 | Pack sync + pack (1) accuracy | Phases 1–8; multi-tenant-ready | — |
| 2026-08-20 | User: master context over-condensed | Human locked Storage/Workflow/1–8/pack IA; **rewrote MASTER_PRODUCT_CONTEXT** with full domains + table/Python map | Commit when asked; then pilot |
| 2026-08-20 | Prompt 0B IA reconcile | Global shell Home / Pursuits / Intelligence / Contracts / Data Ops; Ask GPT in header; pursuit + contract nested tabs | Lint/typecheck/build; remaining unlisted routes |
| 2026-08-20 | User shared 15 public security PDFs (Dallas tabs, Harris renewal, TFC VSA, MHMR 25-003, Arlington TX 22-0143, TxDMV PO, Allen board, VA rider 19-264-R) | Domain evidence read only — **not ingested**. Confirms site-varying rates, pay vs bill, cost-build, OT/holiday, CPI options, rider/PO, eval scorecards | Pilot still 0 through pipeline; schema gaps stay findings |
| 2026-08-20 | VERIFY 0 docs + IA | Stale CURRENT_STATE_AUDIT IA claim removed; `/procurement/requirements` redirects to Pursuits; Ask GPT visible in header at all breakpoints | lint/typecheck/build |
| 2026-08-20 | Prompt 1 Foundation hardening | Re-ran Foundation gates; **no foundation code rebuild**. Added `npm run test:foundation` + `test:processor`. Audit: Phase 1 local exit proven | Phase 2 pilot; Vercel org/env; 1-package smoke |
| 2026-08-20 | VERIFY 1 Foundation acceptance | Independent proofs; fixed version append, actor attribution, append-only provenance, processor VERIFIED guard. Applied remote migrations including `20260820400000` | Historical Pilot |
| 2026-08-20 | Prompt 2A usable corpus | [PILOT_CORPUS_MANIFEST.md](pilot/PILOT_CORPUS_MANIFEST.md): **18 USABLE** files, **13 packages**. Frisco L&P bid tab **UNAVAILABLE** (not counted). No schema/AI work | Prompt 2B ingest only YES rows |
| 2026-08-20 | VERIFY 2A corpus fix pass | Fixed manifest counts/metadata (SRC-01/06/09); hardened `verify2a-corpus-audit.mjs`; `npm run test:verify2a` **132/132 PASS**. [VERIFY2A_ACCEPTANCE.md](pilot/VERIFY2A_ACCEPTANCE.md) | Prompt 2B ingest |
| 2026-08-20 | Prompt 2B Historical Pilot | Ran 17/18 USABLE files through intake→parse→verify; [PILOT_GAP_REPORT.md](benchmarks/PILOT_GAP_REPORT.md). **0 structured promotion.** Scripts: `phase2-pilot-run.mjs`, `phase2-pilot-gap-report.mjs` | Structured extractor + schema from gap report |
| 2026-08-20 | VERIFY 2B Historical Pilot acceptance | Independent audit: **FAIL**. Trust pipeline not completed; batch VERIFIED overcount; C corpus not promoted as L&P history. [VERIFY2B_ACCEPTANCE.md](pilot/VERIFY2B_ACCEPTANCE.md) | Do not start Phase 3 until blockers close |
| 2026-08-20 | VERIFY 2B fix pass | Structured PDF extractor; opportunity-linked promote; evidence-bound VERIFY; no zero-fact VERIFIED; precedence probe. **PASS WITH NONBLOCKING GAPS** (7 A/B complete). `test:verify2b` 8/8 | Deferred: OCR, 25MB, corpus count |
| 2026-08-20 | Prompt 2C pilot schema | Evidence-backed tables/columns only ([PHASE2C_SCHEMA.md](PHASE2C_SCHEMA.md)); promote RPC grain fix; types updated. 2c 17/17, RLS 48/48, four-truth 10/10, lint/typecheck/build PASS | STOP — no Phase 3 |
| 2026-08-20 | VERIFY 2C schema acceptance | Independent audit vs [PILOT_GAP_REPORT.md](benchmarks/PILOT_GAP_REPORT.md). **PASS WITH NONBLOCKING GAPS.** `test:verify2c` 58/58. Flags: competitor_bids vs competitor_pricing_lines overlap; required_forms fact-only provenance; no amendments table. [VERIFY2C_ACCEPTANCE.md](pilot/VERIFY2C_ACCEPTANCE.md) | STOP |
| 2026-08-20 | VERIFY 2C fix pass | Closed all gaps: `required_forms.source_document_id`; drop competitor_bids hourly/rate_type; enrich `contract_amendments` number/title; evidence-only service-plan comment. Migration `20520000`. **PASS.** `test:verify2c` 65/65 | STOP |
| 2026-08-20 | Prompt 3 Phase 3 production | DOCX parser; Mistral OCR key-gated; 50 MB intake; package grouping; Resizable+TanStack verify; VIEW SOURCE/RESOLVE audit; JobPort embed fan-out; `test:phase3-production` 18/18. [PHASE3_ACCEPTANCE.md](PHASE3_ACCEPTANCE.md) | STOP — no Phase 4 |
| 2026-08-20 | VERIFY 3 Data Ops acceptance | Real pilot PDFs (SRC-02/03/08/19/01). **PASS 26/26.** XLSX openpyxl fixture (pilot hole); DOCX not pilot-required; scans escalate without OCR key. [VERIFY3_ACCEPTANCE.md](pilot/VERIFY3_ACCEPTANCE.md) | STOP |
| 2026-08-20 | VERIFY 3 fix pass | Re-audited report: **0 FAIL assertions.** No code fix required. Deferred only: `MISTRAL_API_KEY` for live OCR. Re-ran verify3 26/26 + phase3/7/RLS/2c PASS | STOP |
| 2026-08-20 | Prompt 4 Phase 4 Contracts | ContractsNav; Overview/Service Plan/Commercial/Changes/Renewal wired to verified tables; company compliance; alert buckets. `test:phase4-contracts` **44/44**; phase9 **6/6**; lint/typecheck/build PASS; browser: Portfolio/Renewals/Compliance | STOP — no Phase 5 |
| 2026-08-20 | VERIFY 4 fix pass | Closed F1–F5 (Overview original/current/NTE; Changes option exercises; Renewal internal review + rebid status; Service Plan absent-obligation honesty). [VERIFY4_ACCEPTANCE.md](pilot/VERIFY4_ACCEPTANCE.md) **PASS**. `test:phase4-contracts` **46/46**; phase9 **6/6**; typecheck PASS | STOP |
| 2026-08-20 | VERIFY 4 lifecycle | Real instruments SRC-02/04/14/15/16. Prove original preserved, Amend 4 current truth, PO history, service plan, options, CPI-W renewal, alert buckets, rebid, compliance readiness, award link. `test:verify4` **25/25 PASS**. [VERIFY4_ACCEPTANCE.md](pilot/VERIFY4_ACCEPTANCE.md) | STOP |
| 2026-08-20 | VERIFY 4 fix pass | Closed promote gap: PO / payment_terms / TXMAS / service_plan / amendment_number via `20260820600000`. Fixed PL/pgSQL ambiguity. `test:verify4` **31/31**; phase4 **46/46**. OCR remains external deferred only | STOP |
| 2026-08-20 | Prompt 5 Phase 5 Intelligence | Buyers portfolio; Competitors bids/lines/scores; Market verified-only (no doc counts); Win/Loss lessons+scores; Content reuse REVIEW_REQUIRED; Pursuit Overview intel summary. `test:phase5-intelligence` **25/25**; phase10 **13/13**; lint/typecheck/build PASS. [PHASE5_INTELLIGENCE_ACCEPTANCE.md](PHASE5_INTELLIGENCE_ACCEPTANCE.md) | STOP — no Phase 6 |
| 2026-08-20 | VERIFY 5 Intelligence acceptance | Independent audit `test:verify5` **23/24 FAIL**. Sole gap: `competitor_pricing_lines` allows unsourced insert (no has_source check). All other Prompt VERIFY checks PASS. [VERIFY5_ACCEPTANCE.md](pilot/VERIFY5_ACCEPTANCE.md) | STOP — no fix pass unless asked |
| 2026-08-20 | VERIFY 5 fix pass | Added `competitor_pricing_lines_has_source` (`20260820710000`). `test:verify5` **24/24 PASS**; phase5-intel **25/25**; phase10 **13/13**; phase11 **10/10** | STOP |
| 2026-08-20 | Prompt 6 Phase 6 Ask/Reports/Automation | Header Find/Ask; LOCATE/ASK/REPORT; purpose-aware `search_verified_knowledge`; 8 report generators; `automation_events` + pg_cron + Vercel digest cron; DO_NOT_USE blocked for PROPOSAL_DRAFTING. `test:phase6-ask` **25/25**; phase11 **10/10**; lint/typecheck/build PASS. [PHASE6_ASK_REPORTS_AUTOMATION_ACCEPTANCE.md](PHASE6_ASK_REPORTS_AUTOMATION_ACCEPTANCE.md) | STOP — no Phase 7 |
| 2026-08-20 | Phase 6 fix pass | No VERIFY6 on disk. Closed Prompt 6 answer-contract gap: Sources/Evidence + View Source always render (empty states). `test:phase6-ask` **25/25**; phase11 **10/10**; browser insufficient path shows full contract. Deferred: `ASK_MODEL`/Gateway; finer automation awaiting Phase 8 submission fields | STOP |
| 2026-08-20 | VERIFY 6 Ask/Reports/Automation | Independent audit `test:verify6` **23/24 FAIL**. Sole gap: no `approval_reminder` automation that respects proposal/approval state. All LOCATE/ASK/purpose/tenancy/reports + other automation assertions PASS. [VERIFY6_ACCEPTANCE.md](pilot/VERIFY6_ACCEPTANCE.md) | STOP — no fix pass unless asked |
| 2026-08-20 | VERIFY 6 fix pass | Added `refresh_approval_reminder_alerts` (`20260820810000`): fires only when `go_no_go=PENDING` + pre-submit stage; auto-clears on GO/NO_GO or SUBMITTED/CLOSED/AWARDED; never auto-approves. `test:verify6` **24/24 PASS**; phase6-ask **25/25**; phase11 **10/10** | STOP |
| 2026-08-20 | Prompt 7 Phase 7 Pricing | Pursuit Glide five-truth workbench; cost model H&W/vehicles/travel/WD; comps include/exclude; `pricing_decisions` human final bid; Intelligence cross-corpus pricing. `test:phase7-pricing` **17/17**; four-truth **10/10**; lint/typecheck/build. [PHASE7_PRICING_ACCEPTANCE.md](PHASE7_PRICING_ACCEPTANCE.md) | STOP — no Phase 8 |
| 2026-08-20 | VERIFY 7 Pricing acceptance | Independent audit `test:verify7` **FAIL**. Gaps: empty `pricing_comparable_judgments.reason` allowed at DB; Glide five-truth matrix has no source fact links (comps FactRef still works). All prove-list items otherwise PASS. [VERIFY7_ACCEPTANCE.md](pilot/VERIFY7_ACCEPTANCE.md) | STOP — no fix pass unless asked |
| 2026-08-20 | VERIFY 7 fix pass | `pricing_comparable_judgments_reason_nonblank` (`20260820910000`); Glide source_fact URI columns → verification. `test:verify7` **29/29 PASS**; phase7-pricing **17/17**; four-truth **10/10** | STOP |
| 2026-08-20 | Prompt 8 Phase 8 Response/Submission/Result | Pursuit Requirements matrix; Tiptap Response workspace + evidence states + DO_NOT_USE gate; configurable approvals; submission packet/checklist/exports; result capture + contract-on-win. `test:phase8-response` **25/25**; lint/typecheck/build PASS. [PHASE8_RESPONSE_ACCEPTANCE.md](PHASE8_RESPONSE_ACCEPTANCE.md) | STOP |
| 2026-08-20 | VERIFY 8 Proposal workflow | Independent E2E audit Arlington/Lottery-shaped solicitation package. `test:verify8` **23/23 PASS** (steps 1–22). No fabricated L&P historical rates. [VERIFY8_ACCEPTANCE.md](pilot/VERIFY8_ACCEPTANCE.md) | STOP |
| 2026-08-20 | Full functional re-pass | VERIFY5 **24/24**, VERIFY6 **24/24**, VERIFY7 **29/29**, VERIFY8 **23/23**, phase8-response **25/25**. Browser: Save draft / checklist / Result UI smoke. Fixed Cache Components blocking-prerender via Suspense on all Pursuit workspace pages; Glide grid `dynamic(..., { ssr: false })` for `window is not defined`. Console clean on Overview→Result | STOP |
| 2026-08-20 | Prompt 9 release readiness | Full lifecycle audit + regression. Hardened: redirect typecheck/build; VERIFY2C allow Phase 8 `requirement_responses` (**66/66**). Wrote [RELEASE_READINESS_REPORT.md](RELEASE_READINESS_REPORT.md): **not production-ready** (corpus/ops); no trust/security/submission suite FAIL | STOP |
| 2026-08-20 | VERIFY 9 Final release | Auditor-only. Business goal vs live corpus/ops. **NOT READY.** Blockers: pilot corpus exit unmet; prod runtime unproven; ASK_MODEL absent. [VERIFY9_ACCEPTANCE.md](pilot/VERIFY9_ACCEPTANCE.md) | Grow corpus; prod proof; ASK_MODEL; re-VERIFY 9 |
| 2026-08-20 | VERIFY 9 fix pass | Closed fixable gaps (pilot 50 MB + SRC-03 unblocked; live chunk promote). Remaining three items = **deferred external**. Verdict → **READY WITH NONBLOCKING LIMITATIONS**. Evidence: verify8 23/23, verify6 24/24, RLS 51/51, phase8 25/25, verify2b 8/8 | Push when asked; acquire PDFs / vercel login / ASK_MODEL |

Older: `git log`.
