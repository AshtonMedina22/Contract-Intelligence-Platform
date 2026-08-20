# VERIFY 8 — Proposal workflow acceptance

**Phase:** Canonical Phase 8 — Response / Submission / Result  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify8`  
**Artifact:** [verify8-results.json](../benchmarks/verify8-results.json)  
**Package shape:** V8-ARLINGTON-LOTTERY-SHAPE (RFP-22-0143-V8-mt1ial1g) — buyer solicitation patterns from SRC-06 Arlington + SRC-09 Lottery IFB (forms). No fabricated L&P historical rates/staffing/performance.

---

## Verdict

**PASS**

End-to-end pre-award flow: solicitation → Pursuit → Requirements → Pricing → Response → Approvals → Submission → Result → Contract/Intelligence.

---

## PASS / FAIL by step

| Step | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| 0 | Phase 8 Response/Submission/Result surfaces exist (not global Proposal app) | **PASS** | pursuit tabs + tiptap | apps/web |
| 1 | solicitation becomes a Pursuit | **PASS** | {"opportunityId":"fa4d29fd-9371-44f6-aa9e-b2d0569db559","solicitation":"RFP-22-0143-V8-mt1ial1g","stage":"ANALYSIS"} | V8-ARLINGTON-LOTTERY-SHAPE |
| 2 | deadlines are visible | **PASS** | {"response_due_on":"2026-09-03","due_at":"2026-09-03T12:38:12.353+00:00","question_deadline_at":"2026-08-27T12:38:12.354+00:00"} | opportunities + submission_packets |
| 3 | Requirements matrix is source-backed | **PASS** | {"factId":"bc3b80b3-fdf7-47a8-a004-c1989cbf767b","section":"3.2","page":12} | requirements.source_fact_id |
| 4 | required forms/attachments are tracked | **PASS** | {"form":"HUB / References / Cost Sheet (Lottery IFB-style)","attachment_required":true} | required_forms + requirements.attachment_required |
| 5 | Pricing uses verified evidence | **PASS** | {"id":"cd8f8247-fad2-4c55-958f-b1f0bb089b16","requested_rate":28.5,"requested_source_fact_id":"8b22bc17-b15c-4b76-b0b6-96acb4515d4d","proposed_rate":null} | pricing_lines.requested_source_fact_id |
| 6 | final pricing requires a human | **PASS** | {"autoBlocked":"HUMAN_APPROVED pricing_decisions require decided_by","decided_by":"0f6f786e-caff-4d71-bc52-880827b5eb9f"} | pricing_decisions_require_human |
| 7 | Response uses requirement-level drafting | **PASS** | {"id":"f504b861-1f44-4b45-9732-e14f2c2bf373","requirement_id":"0b6757f4-dae9-43ee-81ee-89b6dac76f7b","draft_status":"DRAFT"} | requirement_responses |
| 8 | approved/review/blocked reuse rules work | **PASS** | {"approvedState":"VERIFIED_DRAFT_AVAILABLE","reviewState":"REVIEW_REQUIRED","blockedState":"L_AND_P_INPUT_REQUIRED"} | classifyEvidenceFromHits |
| 9 | DO_NOT_USE cannot enter draft generation | **PASS** | {"draftingHits":["APPROVED"],"lossHasDoNotUse":true} | search_verified_knowledge PROPOSAL_DRAFTING |
| 10 | missing L&P facts produce L&P INPUT REQUIRED | **PASS** | {"evidence_state":"L_AND_P_INPUT_REQUIRED","missing_information":"L&P INPUT REQUIRED: staffing capacity, certifications"} | requirement_responses.evidence_state |
| 11 | generated response shows sources | **PASS** | {"n":1,"first":{"excerpt":"staffing_approach\nVerified prior response narrative mt1ial1g: describe post coverage by building using only confirmed ro","chunk_id":"17107120-f346-4666-ab0b-787ab376db7b","reuse_status":"APPR | requirement_responses.sources_used |
| 12 | proposal progress is correct | **PASS** | {"totalRequirements":1,"verified":1,"drafted":1,"approved":0,"lpInputRequired":0,"mandatoryOutstanding":0,"requiredAttachmentsMissing":1} | computeResponseProgress |
| 13 | internal approvals are auditable | **PASS** | {"id":"cf63bf25-b173-4fc5-829c-38fa4797bad4","layer_key":"content","status":"requested","enabled":true,"created_at":"2026-08-20T12:38:21.443299+00:00"} | pursuit_approval_layers |
| 14 | changes-requested/rejected approval state works | **PASS** | {"changes":"changes_requested","rejectedOk":true} | pursuit_approval_layers.status |
| 15 | submission checklist catches missing mandatory items | **PASS** | {"missing":["required_forms","signatures"]} | submission_checklist_items |
| 16 | submitted date/time is captured | **PASS** | {"submitted_at":"2026-08-20T12:38:21.925+00:00"} | submission_packets.submitted_at |
| 17 | submission confirmation is captured | **PASS** | {"confirmation_reference":"PORTAL-CONF-mt1ial1g"} | submission_packets.confirmation_reference |
| 18 | Result can remain Pending | **PASS** | {"id":"4d366def-2af4-4951-946c-23d8bb978b0a","outcome":"PENDING"} | win_loss_reviews.outcome |
| 19 | Win/Loss/No Bid/etc. can be recorded | **PASS** | [{"outcome":"NO_BID","ok":true},{"outcome":"CANCELLED","ok":true},{"outcome":"NO_AWARD","ok":true},{"outcome":"LOST","ok":true},{"outcome":"WON","ok":true}] | opportunity_outcome enum |
| 20 | evaluator/competitor result data stays sourced | **PASS** | {"scoreFact":"9260c3fa-ec95-4583-a095-8d287691c89f","bidFact":"dba9b8e4-a452-4ee2-9e9e-29c7bbd892db"} | evaluation_scores + competitor_bids source_fact_id |
| 21 | a win creates/links the Contract | **PASS** | {"id":"20124eb2-2bed-482b-b24e-862b56edd294","opportunity_id":"fa4d29fd-9371-44f6-aa9e-b2d0569db559","title":"Awarded — Armed Security Services — VERIFY8 mt1ial1g"} | contracts.opportunity_id |
| 22 | outcome feeds the intelligence corpus | **PASS** | {"outcome":"WON","contract":"20124eb2-2bed-482b-b24e-862b56edd294","competitorBids":1,"pricingLines":1,"revalidateWired":true} | win_loss_reviews + contracts + intel routes |

---

## Failures

_None._

---

## How to re-run

```bash
npm run test:verify8
```
