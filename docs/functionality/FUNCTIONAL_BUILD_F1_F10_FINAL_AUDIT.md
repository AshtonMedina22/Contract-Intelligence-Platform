# Functional Build F1–F10 — Final Audit

**Date:** 2026-08-21  
**Authority:** This file + [WORK_TRAIL.md](../WORK_TRAIL.md) + per-Fx acceptance docs.  
**No Stripe.** Commercialization is not a core product phase and is not claimed here.

## Buckets

### IMPLEMENTED + PROVEN

| Build | Proof |
| --- | --- |
| **F1** Production ingestion routing / OCR fail-closed / size / integrity | `test:f1-ingestion` **37/37** |
| **F2** Public opportunity engine | `test:f2-opportunity-engine` **16/16** |
| **F3** Federal award intelligence (USAspending) | `test:f3-federal-awards` **17/17** |
| **F4** Public research pipeline | `test:f4-research-pipeline` **22/22** |
| **F5** Recompete radar / expiration opportunity | `test:f5-recompete-radar` **16/16** |
| **F6** Governed structured analytics (no free SQL) | `test:f6-structured-analytics` **34/34** |
| **F7** Proposal content intelligence / reuse | `test:f7-proposal-content` **18/18** |
| **F8** Proposal output (DOCX / portal / Docs provider) | `test:f8-proposal-output` **24/24** |
| **F9** Automation + notifications (same scheduler) | `test:f9-automation` **23/23** |
| **F10** RBAC + audit_log + health/env + rate limits | `test:f10-production` **28/28**; migration `20260821280000` applied |

Supporting regressions this session: `test:phase2-rls` **51/51**, `test:foundation` (env + RLS + intake + verification + processor **45** + verify1), `test:phase6-ask` **47/47**, `test:phase8-response` **30/30**, `test:p8-submission-result` **44/44**, lint / typecheck / build **PASS**.

### IMPLEMENTED, LIVE EXTERNAL PROOF BLOCKED

| Area | Blocker |
| --- | --- |
| OCR on real scanned L&P evidence | Needs `MISTRAL_API_KEY` + real scan path; never run live |
| Google Docs create/sync | Needs `GOOGLE_DRIVE_ACCESS_TOKEN` / `GOOGLE_DOCS_ACCESS_TOKEN` |
| Public research live providers | Needs `TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY` |
| Automation email digest | Needs Resend/SendGrid |
| Custom GPT Actions | Needs `GPT_ACTIONS_SECRET` + ops wiring |
| Hosted processor in prod | `PROCESSOR_URL` + secret on Vercel |
| Ask synthesis in prod | `ASK_MODEL` + provider key / Gateway card |
| Multi-instance rate limits | In-memory Map is single-node only |

### PARTIAL

| Area | Honesty |
| --- | --- |
| Historical Pilot corpus | Packages ingested; **human** workbench verification still thin (harness stamps dominate `HUMAN_VERIFIED`) |
| VERIFY 5 / 6 / 7 | Still **verdict FAIL** on stale fixtures / trust-trigger fixture gaps (not F10 regressions). VERIFY7 human-grep updated for `userId`. |
| VERIFY 4 | **30/31** — unsourced award insert correctly blocked |
| Role enforcement in every UI control | Consequential gates shipped; not every read-only chrome is capability-aware |

### NOT BUILT

- Stripe / billing / SaaS commercialization pack
- New auth framework (Clerk/Auth0/etc.) — **intentionally not**
- Redis/Upstash shared rate limiter
- Viewer membership role
- Client portal / CRM

### FUTURE OPTIONAL

- Shared distributed rate limiting
- Live email digest channel
- Broader org-admin member invite UX beyond role update
- Secret rotation playbooks if historical exposure ever confirmed (none found in F10 greps)

## F10 RBAC matrix (shipped)

| Permission | Roles |
| --- | --- |
| intake.write | admin, importer, verifier |
| verify.promote | admin, verifier |
| research.verify | admin, verifier |
| pricing.edit / pricing.approve | admin, bidder, executive |
| proposal.approve / pursuit.submit / result.write / contract.create / rebid.clone | admin, bidder, executive |
| org.admin | admin |
| ask.use | any member |

## Remaining external blockers (ordered)

1. Grow **human-verified** Historical Pilot toward ~20–30 trusted packages  
2. Prod processor + Ask model env  
3. Optional OCR / Drive / research / email keys when those paths are exercised  
4. Repair VERIFY 5/6/7 fixtures against trust triggers (separate task)  
5. Multi-instance rate limits before multi-region production  

## Doc index

- [F1_PRODUCTION_INGESTION_ACCEPTANCE.md](F1_PRODUCTION_INGESTION_ACCEPTANCE.md) … [F10_PRODUCTION_OPERATIONAL_ACCEPTANCE.md](F10_PRODUCTION_OPERATIONAL_ACCEPTANCE.md)
- [CURRENT_STATE_AUDIT.md](../CURRENT_STATE_AUDIT.md) · [RELEASE_READINESS_REPORT.md](../RELEASE_READINESS_REPORT.md) · [WORK_TRAIL.md](../WORK_TRAIL.md)
