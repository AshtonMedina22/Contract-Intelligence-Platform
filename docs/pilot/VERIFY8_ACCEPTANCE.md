# VERIFY 8 — Proposal workflow acceptance

**Phase:** Canonical Phase 8 — Response / Submission / Result  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify8`  
**Artifact:** [verify8-results.json](../benchmarks/verify8-results.json)  
**Package shape:** V8-ARLINGTON-LOTTERY-SHAPE (RFP-22-0143-V8-mt3a1tus) — buyer solicitation patterns from SRC-06 Arlington + SRC-09 Lottery IFB (forms). No fabricated L&P historical rates/staffing/performance.

---

## Verdict

**PASS**

End-to-end pre-award flow: solicitation → Pursuit → Requirements → Pricing → Response → Approvals → Submission → Result → Contract/Intelligence.

---

## PASS / FAIL by step

| Step | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| 0 | Phase 8 Response/Submission/Result surfaces exist (not global Proposal app) | **PASS** | pursuit tabs + tiptap | apps/web |
| 1 | solicitation becomes a Pursuit | **PASS** | {"opportunityId":"e47f5599-c1b5-4290-b59d-4a8c9cf0fcad","solicitation":"RFP-22-0143-V8-mt3a1tus","stage":"ANALYSIS"} | V8-ARLINGTON-LOTTERY-SHAPE |
| 2 | deadlines are visible | **PASS** | {"response_due_on":"2026-09-04","due_at":"2026-09-04T18:22:58.852+00:00","question_deadline_at":"2026-08-28T18:22:58.852+00:00"} | opportunities + submission_packets |
| 3 | Requirements matrix is source-backed | **PASS** | {"factId":"3af352c1-1e18-4b9a-aa69-785d54c7ae88","section":"3.2","page":12} | requirements.source_fact_id |
| 4 | required forms/attachments are tracked | **PASS** | {"form":"HUB / References / Cost Sheet (Lottery IFB-style)","attachment_required":true} | required_forms + requirements.attachment_required |
| 5 | Pricing uses verified evidence | **PASS** | {"id":"beb4e339-c4ac-4b90-8bae-4c25dc4213a7","requested_rate":28.5,"requested_source_fact_id":"d0b93169-16d1-41d9-b76b-43bb5e184306","proposed_rate":null} | pricing_lines.requested_source_fact_id |
| 6 | final pricing requires a human | **PASS** | {"autoBlocked":"HUMAN_APPROVED pricing_decisions require decided_by","decided_by":"3e2480cc-43d9-4446-9433-31172339412e"} | pricing_decisions_require_human |
| 7 | Response uses requirement-level drafting | **PASS** | {"id":"f7d59105-44ef-4e91-9e92-b0b1eda7a241","requirement_id":"2adb8756-01c7-4aec-9726-37759ea58e1b","draft_status":"DRAFT"} | requirement_responses |
| 8 | approved/review/blocked reuse rules work | **PASS** | {"approvedState":"VERIFIED_DRAFT_AVAILABLE","reviewState":"REVIEW_REQUIRED","blockedState":"L_AND_P_INPUT_REQUIRED"} | classifyEvidenceFromHits |
| 9 | DO_NOT_USE cannot enter draft generation | **PASS** | {"draftingHits":["APPROVED"],"lossHasDoNotUse":true} | search_verified_knowledge PROPOSAL_DRAFTING |
| 10 | missing L&P facts produce L&P INPUT REQUIRED | **PASS** | {"evidence_state":"L_AND_P_INPUT_REQUIRED","missing_information":"L&P INPUT REQUIRED: staffing capacity, certifications"} | requirement_responses.evidence_state |
| 11 | generated response shows sources | **PASS** | {"n":1,"first":{"excerpt":"staffing_approach\nVerified prior response narrative mt3a1tus: describe post coverage by building using only confirmed ro","chunk_id":"c53af0fe-9c99-4b9c-8c24-629fe9861dfe","reuse_status":"APPR | requirement_responses.sources_used |
| 12 | proposal progress is correct | **PASS** | {"totalRequirements":1,"verified":1,"drafted":1,"approved":0,"lpInputRequired":0,"mandatoryOutstanding":0,"requiredAttachmentsMissing":1} | computeResponseProgress |
| 13 | internal approvals are auditable | **PASS** | {"id":"fc76a39b-0403-4aa8-9417-7d8e03694e6a","layer_key":"content","status":"requested","enabled":true,"created_at":"2026-08-21T18:23:08.107471+00:00"} | pursuit_approval_layers |
| 14 | changes-requested/rejected approval state works | **PASS** | {"changes":"changes_requested","rejectedOk":true} | pursuit_approval_layers.status |
| 15 | submission checklist catches missing mandatory items | **PASS** | {"missing":["required_forms","signatures"]} | submission_checklist_items |
| 16 | submitted date/time is captured and attributed to a human | **PASS** | {"anonymousSubmitBlocked":"new row for relation \"submission_packets\" violates check constraint \"submission_packets_submitted_requires_actor\"","submitted_at":"2026-08-21T18:23:08.778+00:00","submitted_by":"3e2480cc-43 | submission_packets.submitted_at + submitted_requires_actor |
| 17 | submission confirmation is captured | **PASS** | {"confirmation_reference":"PORTAL-CONF-mt3a1tus"} | submission_packets.confirmation_reference |
| 18 | Result can remain Pending | **PASS** | {"id":"d9abe52b-2c5b-4594-afbf-2b582945e95e","outcome":"PENDING"} | win_loss_reviews.outcome |
| 19 | Win/Loss/No Bid/etc. can be recorded | **PASS** | [{"outcome":"NO_BID","ok":true},{"outcome":"CANCELLED","ok":true},{"outcome":"NO_AWARD","ok":true},{"outcome":"LOST","ok":true},{"outcome":"WON","ok":true}] | opportunity_outcome enum |
| 20 | evaluator/competitor result data stays sourced | **PASS** | {"scoreFact":"8bb68b0b-db73-438a-bd13-58c4fbf8032a","bidFact":"74384d07-2615-4bd8-835e-628c25dfdf6d"} | evaluation_scores + competitor_bids source_fact_id |
| 21 | a win creates/links the Contract from a verified award fact (and blocks unsourced rows) | **PASS** | {"unsourcedBlocked":"contracts.source_fact_id is required (create via verified promotion, not blank insert)","contractId":"5470edca-1564-497a-a1f2-49c9b0672d65","source_fact_id":"75a82de7-6c1d-4def-a3d5-665ffc9a8483"} | contracts_require_verified_fact + createContractFromWin path |
| 22 | outcome feeds the intelligence corpus | **PASS** | {"outcome":"WON","contract":"5470edca-1564-497a-a1f2-49c9b0672d65","competitorBids":1,"pricingLines":1,"revalidateWired":true} | win_loss_reviews + contracts + intel routes |

---

## Failures

_None._

---

## How to re-run

```bash
npm run test:verify8
```
