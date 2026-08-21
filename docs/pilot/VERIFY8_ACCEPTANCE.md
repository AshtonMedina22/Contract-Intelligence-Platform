# VERIFY 8 — Proposal workflow acceptance

**Phase:** Canonical Phase 8 — Response / Submission / Result  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify8`  
**Artifact:** [verify8-results.json](../benchmarks/verify8-results.json)  
**Package shape:** V8-ARLINGTON-LOTTERY-SHAPE (RFP-22-0143-V8-mt2zbqg0) — buyer solicitation patterns from SRC-06 Arlington + SRC-09 Lottery IFB (forms). No fabricated L&P historical rates/staffing/performance.

---

## Verdict

**PASS**

End-to-end pre-award flow: solicitation → Pursuit → Requirements → Pricing → Response → Approvals → Submission → Result → Contract/Intelligence.

---

## PASS / FAIL by step

| Step | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| 0 | Phase 8 Response/Submission/Result surfaces exist (not global Proposal app) | **PASS** | pursuit tabs + tiptap | apps/web |
| 1 | solicitation becomes a Pursuit | **PASS** | {"opportunityId":"de084468-888e-4a36-b34d-3a9adb5231af","solicitation":"RFP-22-0143-V8-mt2zbqg0","stage":"ANALYSIS"} | V8-ARLINGTON-LOTTERY-SHAPE |
| 2 | deadlines are visible | **PASS** | {"response_due_on":"2026-09-04","due_at":"2026-09-04T13:22:45.218+00:00","question_deadline_at":"2026-08-28T13:22:45.218+00:00"} | opportunities + submission_packets |
| 3 | Requirements matrix is source-backed | **PASS** | {"factId":"b6c9c167-ae2e-48fc-b7c7-eeb221564b76","section":"3.2","page":12} | requirements.source_fact_id |
| 4 | required forms/attachments are tracked | **PASS** | {"form":"HUB / References / Cost Sheet (Lottery IFB-style)","attachment_required":true} | required_forms + requirements.attachment_required |
| 5 | Pricing uses verified evidence | **PASS** | {"id":"70e62a1e-18c1-4ca1-bc8d-461ffc915163","requested_rate":28.5,"requested_source_fact_id":"1238d342-54d3-4c75-ae90-478aa4a34185","proposed_rate":null} | pricing_lines.requested_source_fact_id |
| 6 | final pricing requires a human | **PASS** | {"autoBlocked":"HUMAN_APPROVED pricing_decisions require decided_by","decided_by":"97ce930d-7414-4b28-9811-d9de6dc2a8ac"} | pricing_decisions_require_human |
| 7 | Response uses requirement-level drafting | **PASS** | {"id":"8716fb7f-831f-4934-9213-d2a4c12dfe22","requirement_id":"1f1b1654-9316-4231-a130-a97102570114","draft_status":"DRAFT"} | requirement_responses |
| 8 | approved/review/blocked reuse rules work | **PASS** | {"approvedState":"VERIFIED_DRAFT_AVAILABLE","reviewState":"REVIEW_REQUIRED","blockedState":"L_AND_P_INPUT_REQUIRED"} | classifyEvidenceFromHits |
| 9 | DO_NOT_USE cannot enter draft generation | **PASS** | {"draftingHits":["APPROVED"],"lossHasDoNotUse":true} | search_verified_knowledge PROPOSAL_DRAFTING |
| 10 | missing L&P facts produce L&P INPUT REQUIRED | **PASS** | {"evidence_state":"L_AND_P_INPUT_REQUIRED","missing_information":"L&P INPUT REQUIRED: staffing capacity, certifications"} | requirement_responses.evidence_state |
| 11 | generated response shows sources | **PASS** | {"n":1,"first":{"excerpt":"staffing_approach\nVerified prior response narrative mt2zbqg0: describe post coverage by building using only confirmed ro","chunk_id":"2ddb3317-49e9-46a7-84d8-b43515b1addc","reuse_status":"APPR | requirement_responses.sources_used |
| 12 | proposal progress is correct | **PASS** | {"totalRequirements":1,"verified":1,"drafted":1,"approved":0,"lpInputRequired":0,"mandatoryOutstanding":0,"requiredAttachmentsMissing":1} | computeResponseProgress |
| 13 | internal approvals are auditable | **PASS** | {"id":"aed7474c-06ea-4225-b3e5-f8aa796c1dac","layer_key":"content","status":"requested","enabled":true,"created_at":"2026-08-21T13:22:54.690625+00:00"} | pursuit_approval_layers |
| 14 | changes-requested/rejected approval state works | **PASS** | {"changes":"changes_requested","rejectedOk":true} | pursuit_approval_layers.status |
| 15 | submission checklist catches missing mandatory items | **PASS** | {"missing":["required_forms","signatures"]} | submission_checklist_items |
| 16 | submitted date/time is captured and attributed to a human | **PASS** | {"anonymousSubmitBlocked":"new row for relation \"submission_packets\" violates check constraint \"submission_packets_submitted_requires_actor\"","submitted_at":"2026-08-21T13:22:55.443+00:00","submitted_by":"97ce930d-74 | submission_packets.submitted_at + submitted_requires_actor |
| 17 | submission confirmation is captured | **PASS** | {"confirmation_reference":"PORTAL-CONF-mt2zbqg0"} | submission_packets.confirmation_reference |
| 18 | Result can remain Pending | **PASS** | {"id":"78ad7a79-c158-420c-b608-c5a1b2b450f5","outcome":"PENDING"} | win_loss_reviews.outcome |
| 19 | Win/Loss/No Bid/etc. can be recorded | **PASS** | [{"outcome":"NO_BID","ok":true},{"outcome":"CANCELLED","ok":true},{"outcome":"NO_AWARD","ok":true},{"outcome":"LOST","ok":true},{"outcome":"WON","ok":true}] | opportunity_outcome enum |
| 20 | evaluator/competitor result data stays sourced | **PASS** | {"scoreFact":"70dd135b-5a4f-48e5-87cc-44e72f3e5d63","bidFact":"8a432c95-5b10-464c-9e68-1105355afc5e"} | evaluation_scores + competitor_bids source_fact_id |
| 21 | a win creates/links the Contract from a verified award fact (and blocks unsourced rows) | **PASS** | {"unsourcedBlocked":"contracts.source_fact_id is required (create via verified promotion, not blank insert)","contractId":"f31f4230-6083-4ef7-a375-8c3557a9f34c","source_fact_id":"d32fba7e-6857-4bf5-a6ed-a2c2a12dd1c0"} | contracts_require_verified_fact + createContractFromWin path |
| 22 | outcome feeds the intelligence corpus | **PASS** | {"outcome":"WON","contract":"f31f4230-6083-4ef7-a375-8c3557a9f34c","competitorBids":1,"pricingLines":1,"revalidateWired":true} | win_loss_reviews + contracts + intel routes |

---

## Failures

_None._

---

## How to re-run

```bash
npm run test:verify8
```
