# Release readiness report — Prompt 9 final production acceptance

**Audit date:** 2026-08-20  
**Scope:** End-to-end hardening only. No new product scope.  
**Authority:** Canonical pack + [BUILD_PLAN.md](BUILD_PLAN.md) (phases **1–8**), [WORK_TRAIL.md](WORK_TRAIL.md), [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md), all PHASE\* / VERIFY\* acceptance reports, live regression + browser IA smoke this session.

---

## Executive verdict

### Is the platform production-ready for live L&P daily use?

**READY WITH NONBLOCKING LIMITATIONS** (VERIFY 9 fix pass — see [pilot/VERIFY9_ACCEPTANCE.md](pilot/VERIFY9_ACCEPTANCE.md)).

Engineering/trust/security/workflow gates PASS. Remaining limits are **external**: corpus acquisition (~20–30 packages), Vercel CLI login + prod processor proof, `ASK_MODEL` / Gateway for LLM Ask.

---

## Representative lifecycle (evidence)

| Stage | Evidence this session | Classification |
| --- | --- | --- |
| REAL SOURCE EVIDENCE → Data Ops | VERIFY 2B **8/8**; VERIFY 3 **26/26**; phase3-intake **9/9**; browser Intake/Processing/Verification/Exceptions/Bulk render | **PASS WITH KNOWN LIMITATION** (OCR key; 25 MB; corpus thin) |
| Verification → canonical data | VERIFY1 runtime **21/21**; promote only `HUMAN_VERIFIED`; AI cannot mark VERIFIED | **PASS** |
| Pursuit → Requirements | VERIFY 8 + phase8-response; Requirements matrix UI | **PASS** |
| Buyer / competitor intelligence | VERIFY 5 **24/24**; phase5-intelligence **25/25**; Market tiles exclude doc counts | **PASS WITH KNOWN LIMITATION** (corpus thin) |
| Pricing | VERIFY 7 **29/29**; phase7-pricing **17/17**; human final bid required | **PASS** |
| Response → approvals | phase8-response **25/25**; configurable layers; DO_NOT_USE blocked from drafting | **PASS** |
| Submission | VERIFY 8 steps; checklist/packet; no auto-submit RPC | **PASS** |
| Result → Contract | VERIFY 8 win → contract link; Result capture UI | **PASS WITH KNOWN LIMITATION** (live org has 0 contracts) |
| Changes / Renewal | VERIFY 4 **31/31**; phase4-contracts **46/46**; Renewals/Compliance pages | **PASS WITH KNOWN LIMITATION** (awarded corpus thin) |
| Intelligence feedback | VERIFY 8 outcome feeds corpus; revalidate wired | **PASS WITH KNOWN LIMITATION** |
| Find / Ask GPT | VERIFY 6 **24/24**; phase6-ask **25/25**; hybrid-rag **10/10**; header + Ask page | **PASS WITH KNOWN LIMITATION** (no live `ASK_MODEL` → retrieval/refusal path proven; full synthesis unproven in prod) |
| Reports | Eight generators + honesty contract; Reports UI | **PASS WITH KNOWN LIMITATION** |
| Automation | Deadline / approval / compliance / idempotency / no human-gate bypass | **PASS** |

---

## Capability classification matrix

Legend: **PASS** · **PASS WITH KNOWN LIMITATION** · **FAIL / BLOCKER**

### SECURITY

| Capability | Class | Evidence |
| --- | --- | --- |
| Tenant isolation (Postgres) | **PASS** | `test:phase2-rls` **48/48**; VERIFY1 cross-org **PASS** |
| RLS on business tables | **PASS** | Same; phase4/5/11 RLS assertions |
| Storage isolation (evidence/intake) | **PASS** | RLS storage suite; cross-org list/download blocked |
| AI retrieval isolation | **PASS** | hybrid-rag org B cannot retrieve org A; VERIFY 6 tenancy |
| Role permissions (UI/workflow) | **PASS WITH KNOWN LIMITATION** | Role enum stored; **not** UI-gated ([PHASE1_FOUNDATION_AUDIT.md](PHASE1_FOUNDATION_AUDIT.md)) |

### TRUST

| Capability | Class | Evidence |
| --- | --- | --- |
| Provenance (fact → evidence → storage) | **PASS** | VERIFY1; VERIFY2C provenance **9/9**; Glide source_fact links |
| Versioning / immutability | **PASS** | Append v2 retains v1; SHA identity immutable; duplicate checksum |
| Source precedence | **PASS** | VERIFY2B addenda conflict → exception |
| Four commercial truths | **PASS** | four-truth **10/10**; VERIFY7 five-truth + internal cost distinct |
| Verification gates | **PASS** | AI_EXTRACTED cannot promote; HUMAN_VERIFIED requires actor |
| Audit / verification events | **PASS** | Actor required; member delete blocked |

### UX

| Capability | Class | Evidence |
| --- | --- | --- |
| Final global IA | **PASS** | Sidebar Home \| Pursuits \| Intelligence \| Contracts \| Data Ops + Settings; Ask in header; browser smoke all section homes |
| No duplicate global modules | **PASS WITH KNOWN LIMITATION** | Legacy URLs remount/redirect (`/proposals`, `/ingestion/*`); Settings still hosts data-model/data-quality (intentional) |
| Dense desktop Pursuit workflow | **PASS** | Overview \| Requirements \| Pricing \| Response \| Submission \| Result |
| Contract workspace tabs | **PASS** | Overview \| Service Plan \| Commercial Terms \| Changes \| Renewal |
| Responsive / accessible states | **PASS WITH KNOWN LIMITATION** | Loading Suspense on Pursuit pages; empty honesty copy everywhere; full a11y audit not formalized |
| Error / empty / loading | **PASS** | Empty corpus messaging on Home/Market/Contracts; Cache Components Suspense; Glide client-only load |

### AI

| Capability | Class | Evidence |
| --- | --- | --- |
| Grounded sources + View Source | **PASS** | Answer contract always present; citations with storage path |
| Purpose filtering | **PASS** | DO_NOT_USE excluded from PROPOSAL_DRAFTING; allowed in LOSS_ANALYSIS |
| Insufficiency behavior | **PASS** | Canonical refusal when no verified hits |
| No fabricated business data | **PASS** | Market excludes doc counts; reports disclose scope; VERIFY suites refuse invention |

### AUTOMATION

| Capability | Class | Evidence |
| --- | --- | --- |
| Idempotency | **PASS** | VERIFY6 duplicate execution |
| Retries (processing failure) | **PASS** | FAILED → QUEUED visible/retriable |
| Date / renewal / compliance alerts | **PASS** | verified_end_on buckets; compliance expires_on |
| Approval reminders | **PASS** | Respects go_no_go / stage; auto-clears |
| Submission / pursuit deadline reminders | **PASS** | response_due_on; closed stage suppresses |
| No bypass of human gates | **PASS** | Documented + no approve/submit RPCs; runner note |

### PERFORMANCE / RELIABILITY

| Capability | Class | Evidence |
| --- | --- | --- |
| Representative PDF package | **PASS WITH KNOWN LIMITATION** | VERIFY2B **7** A/B complete; not 20–30 |
| Workbook (XLSX) | **PASS WITH KNOWN LIMITATION** | openpyxl fixtures / VERIFY3; live XLSX cell provenance deferred |
| Multi-document package | **PASS** | Bulk migration + package grouping |
| Ingestion failure / OCR escalate | **PASS WITH KNOWN LIMITATION** | SRC-19 FAILED not VERIFIED; live OCR needs `MISTRAL_API_KEY` |
| Retry | **PASS** | Processing queue |
| Duplicate / version update | **PASS** | Checksum dedupe; v2 append |

### DEPLOYMENT

| Capability | Class | Evidence |
| --- | --- | --- |
| Lint | **PASS** | `npm run lint` clean |
| Typecheck | **PASS** | `npm run typecheck` (after Prompt 9 redirect fix) |
| Unit / integration | **PASS** | Processor **13**; phase/VERIFY suites listed below |
| RLS tests | **PASS** | **48/48** |
| Production build | **PASS** | `npm run build` succeeded this session |
| Production environment variables | **PASS WITH KNOWN LIMITATION** | `env:check` required Supabase keys **PASS**; ASK/OCR/Drive/Vercel secrets not all present locally; prod Vercel not re-proven |
| Required migrations applied | **PASS WITH KNOWN LIMITATION** | Phase 7/8 + VERIFY migrations applied remotely earlier 2026-08-20; this pass did not re-run `db push` inventory |

---

## Regression battery (this session)

| Suite | Result |
| --- | --- |
| `env:check` | PASS |
| `test:phase2-rls` | **48/48** |
| `test:foundation` / VERIFY1 arch+runtime | **5/5** + **21/21** |
| `test:verify2b` | **8/8** |
| `test:verify2c` | **66/66** (after Phase 8 `requirement_responses` allowlist) |
| `test:verify3` … `test:verify8` | **26 / 31 / 24 / 24 / 29 / 23** PASS |
| `test:phase3-intake` | **9/9** |
| `test:phase4-contracts` | **46/46** |
| `test:phase5-intelligence` | **25/25** |
| `test:phase6-ask` | **25/25** |
| `test:phase7-pricing` | **17/17** |
| `test:phase8-response` | **25/25** |
| `test:phase11-hybrid-rag` | **10/10** |
| `test:processor` | **13** PASS |
| `lint` / `typecheck` / `build` | PASS |

### Hardening fixes performed under Prompt 9 (no new product scope)

1. **Typecheck/build blocker** — redirect pages under Pursuit (`documents` / `intelligence` / `contract`) no longer wrap `redirect()` in Suspense children typed as `Promise<void>`.
2. **VERIFY 2C stale assertion** — `requirement_responses` was forbidden as “theoretical” after Phase 8 legitimately created it; script now asserts Phase 8 presence + tenancy (**66/66**).
3. **Prior session (carried):** Pursuit page Suspense for Cache Components; Glide grid `dynamic(..., { ssr: false })`.

---

## Phase exit roll-up

| Canonical phase | Prior acceptance | Re-confirmed | Class for release |
| --- | --- | --- | --- |
| 1 Foundation | Local exit proven | RLS + VERIFY1 + build | **PASS WITH KNOWN LIMITATION** (ops/RBAC UI) |
| 2 Historical Pilot | 2A PASS; 2B PASS WITH GAPS; 2C PASS | 2B/2C re-run | **PASS WITH KNOWN LIMITATION** (package count) |
| 3 Data Ops | PASS | VERIFY3 + intake | **PASS WITH KNOWN LIMITATION** (OCR; 25 MB) |
| 4 Contracts | PASS | VERIFY4 + phase4 | **PASS WITH KNOWN LIMITATION** (corpus) |
| 5 Intelligence | PASS | VERIFY5 + phase5 | **PASS WITH KNOWN LIMITATION** (corpus) |
| 6 Ask/Reports/Automation | PASS | VERIFY6 + phase6 + RAG | **PASS WITH KNOWN LIMITATION** (`ASK_MODEL`) |
| 7 Pricing | PASS | VERIFY7 + phase7 | **PASS** (corpus thin for comps, not a gate fail) |
| 8 Response/Submission/Result | PASS | VERIFY8 + phase8 | **PASS** |

Optional commercialization (Stripe / multi-tenant selling) is **out of scope** and **not** a core phase ([BUILD_PLAN.md](BUILD_PLAN.md)).

---

## What would flip this to production-ready

1. Grow verified historical corpus to the pilot exit band (~20–30 packages) with L&P-truth packages through the full pipeline.  
2. Confirm Vercel production env + signed-in org + processor for live intake.  
3. Set `ASK_MODEL` / AI Gateway (and `MISTRAL_API_KEY` if scans are in-scope).  
4. Decide RBAC: enforce roles in UI/server actions or formally defer as org-policy.  
5. Align large-file policy (keep 25 MB and excerpt, or raise `bodySizeLimit` + UI together).  
6. Rotate secrets before loading private L&P libraries.

Until then: **operational platform gates are held; production use on real private corpus is not declared ready.**

---

## STOP

Prompt 9 complete. No further product scope started. Living status continues in [WORK_TRAIL.md](WORK_TRAIL.md).
