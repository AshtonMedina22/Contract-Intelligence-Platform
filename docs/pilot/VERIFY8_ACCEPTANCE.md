# VERIFY 8 — Proposal workflow acceptance

**Phase:** Canonical Phase 8 — Response / Submission / Result  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify8`  
**Artifact:** [verify8-results.json](../benchmarks/verify8-results.json)  
**Package shape:** V8-ARLINGTON-LOTTERY-SHAPE (RFP-22-0143-V8-mt1flnqa) — buyer solicitation patterns from SRC-06 Arlington + SRC-09 Lottery IFB (forms). No fabricated L&P historical rates/staffing/performance.

---

## Verdict

**PASS**

End-to-end pre-award flow: solicitation → Pursuit → Requirements → Pricing → Response → Approvals → Submission → Result → Contract/Intelligence.

---

## PASS / FAIL by step

| Step | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| 0 | Phase 8 Response/Submission/Result surfaces exist (not global Proposal app) | **PASS** | pursuit tabs + tiptap | apps/web |
| 1 | solicitation becomes a Pursuit | **PASS** | {"opportunityId":"aa4ca602-b2db-4a0f-8635-770aca5c4272","solicitation":"RFP-22-0143-V8-mt1flnqa","stage":"ANALYSIS"} | V8-ARLINGTON-LOTTERY-SHAPE |
| 2 | deadlines are visible | **PASS** | {"response_due_on":"2026-09-03","due_at":"2026-09-03T11:22:49.755+00:00","question_deadline_at":"2026-08-27T11:22:49.755+00:00"} | opportunities + submission_packets |
| 3 | Requirements matrix is source-backed | **PASS** | {"factId":"fe599410-5f99-48c3-bca1-977e6c002ffe","section":"3.2","page":12} | requirements.source_fact_id |
| 4 | required forms/attachments are tracked | **PASS** | {"form":"HUB / References / Cost Sheet (Lottery IFB-style)","attachment_required":true} | required_forms + requirements.attachment_required |
| 5 | Pricing uses verified evidence | **PASS** | {"id":"dc1bfce0-2e07-478d-8c76-c7814df69d90","requested_rate":28.5,"requested_source_fact_id":"f0511044-3a02-4510-a36f-92ad48da5302","proposed_rate":null} | pricing_lines.requested_source_fact_id |
| 6 | final pricing requires a human | **PASS** | {"autoBlocked":"HUMAN_APPROVED pricing_decisions require decided_by","decided_by":"b0a0db04-718f-4878-86f7-ec63383de064"} | pricing_decisions_require_human |
| 7 | Response uses requirement-level drafting | **PASS** | {"id":"9a7ce205-c329-4b25-a960-34be52fdd1c7","requirement_id":"f487a40b-7bde-4189-a07a-dae20f82be94","draft_status":"DRAFT"} | requirement_responses |
| 8 | approved/review/blocked reuse rules work | **PASS** | {"approvedState":"VERIFIED_DRAFT_AVAILABLE","reviewState":"REVIEW_REQUIRED","blockedState":"L_AND_P_INPUT_REQUIRED"} | classifyEvidenceFromHits |
| 9 | DO_NOT_USE cannot enter draft generation | **PASS** | {"draftingHits":["APPROVED"],"lossHasDoNotUse":true} | search_verified_knowledge PROPOSAL_DRAFTING |
| 10 | missing L&P facts produce L&P INPUT REQUIRED | **PASS** | {"evidence_state":"L_AND_P_INPUT_REQUIRED","missing_information":"L&P INPUT REQUIRED: staffing capacity, certifications"} | requirement_responses.evidence_state |
| 11 | generated response shows sources | **PASS** | {"n":1,"first":{"excerpt":"staffing_approach\nVerified prior response narrative mt1flnqa: describe post coverage by building using only confirmed ro","chunk_id":"1dfc1609-7609-4ae3-ad60-0a4505a04db0","reuse_status":"APPR | requirement_responses.sources_used |
| 12 | proposal progress is correct | **PASS** | {"totalRequirements":1,"verified":1,"drafted":1,"approved":0,"lpInputRequired":0,"mandatoryOutstanding":0,"requiredAttachmentsMissing":1} | computeResponseProgress |
| 13 | internal approvals are auditable | **PASS** | {"id":"dc61130f-199a-4d48-808f-6080e39f3139","layer_key":"content","status":"requested","enabled":true,"created_at":"2026-08-20T11:22:58.274877+00:00"} | pursuit_approval_layers |
| 14 | changes-requested/rejected approval state works | **PASS** | {"changes":"changes_requested","rejectedOk":true} | pursuit_approval_layers.status |
| 15 | submission checklist catches missing mandatory items | **PASS** | {"missing":["required_forms","signatures"]} | submission_checklist_items |
| 16 | submitted date/time is captured | **PASS** | {"submitted_at":"2026-08-20T11:22:58.783+00:00"} | submission_packets.submitted_at |
| 17 | submission confirmation is captured | **PASS** | {"confirmation_reference":"PORTAL-CONF-mt1flnqa"} | submission_packets.confirmation_reference |
| 18 | Result can remain Pending | **PASS** | {"id":"3e06de4c-0c56-4bb0-960b-cf171e5b2552","outcome":"PENDING"} | win_loss_reviews.outcome |
| 19 | Win/Loss/No Bid/etc. can be recorded | **PASS** | [{"outcome":"NO_BID","ok":true},{"outcome":"CANCELLED","ok":true},{"outcome":"NO_AWARD","ok":true},{"outcome":"LOST","ok":true},{"outcome":"WON","ok":true}] | opportunity_outcome enum |
| 20 | evaluator/competitor result data stays sourced | **PASS** | {"scoreFact":"a37b07b7-4257-45fb-91a5-8780a15bcd98","bidFact":"b7c0655c-9d34-4a1d-934d-9c061febbbb9"} | evaluation_scores + competitor_bids source_fact_id |
| 21 | a win creates/links the Contract | **PASS** | {"id":"e7a3f6f1-bd8f-4a76-870e-56bfe2bb5d70","opportunity_id":"aa4ca602-b2db-4a0f-8635-770aca5c4272","title":"Awarded — Armed Security Services — VERIFY8 mt1flnqa"} | contracts.opportunity_id |
| 22 | outcome feeds the intelligence corpus | **PASS** | {"outcome":"WON","contract":"e7a3f6f1-bd8f-4a76-870e-56bfe2bb5d70","competitorBids":1,"pricingLines":1,"revalidateWired":true} | win_loss_reviews + contracts + intel routes |

---

## Failures

_None._

---

## How to re-run

```bash
npm run test:verify8
```
