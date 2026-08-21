# VERIFY 8 — Proposal workflow acceptance

**Phase:** Canonical Phase 8 — Response / Submission / Result  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify8`  
**Artifact:** [verify8-results.json](../benchmarks/verify8-results.json)  
**Package shape:** V8-ARLINGTON-LOTTERY-SHAPE (RFP-22-0143-V8-mt2shsp2) — buyer solicitation patterns from SRC-06 Arlington + SRC-09 Lottery IFB (forms). No fabricated L&P historical rates/staffing/performance.

---

## Verdict

**PASS**

End-to-end pre-award flow: solicitation → Pursuit → Requirements → Pricing → Response → Approvals → Submission → Result → Contract/Intelligence.

---

## PASS / FAIL by step

| Step | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| 0 | Phase 8 Response/Submission/Result surfaces exist (not global Proposal app) | **PASS** | pursuit tabs + tiptap | apps/web |
| 1 | solicitation becomes a Pursuit | **PASS** | {"opportunityId":"f23a8f80-7551-4c62-980a-8baebf4696af","solicitation":"RFP-22-0143-V8-mt2shsp2","stage":"ANALYSIS"} | V8-ARLINGTON-LOTTERY-SHAPE |
| 2 | deadlines are visible | **PASS** | {"response_due_on":"2026-09-04","due_at":"2026-09-04T10:11:30.7+00:00","question_deadline_at":"2026-08-28T10:11:30.7+00:00"} | opportunities + submission_packets |
| 3 | Requirements matrix is source-backed | **PASS** | {"factId":"a7df62fb-9235-4a4d-bc30-153ec22d3326","section":"3.2","page":12} | requirements.source_fact_id |
| 4 | required forms/attachments are tracked | **PASS** | {"form":"HUB / References / Cost Sheet (Lottery IFB-style)","attachment_required":true} | required_forms + requirements.attachment_required |
| 5 | Pricing uses verified evidence | **PASS** | {"id":"3dc2f6cb-917b-4de1-b893-7686ba76caae","requested_rate":28.5,"requested_source_fact_id":"251b9b9c-b18c-4acd-9dfc-5ac9039b609b","proposed_rate":null} | pricing_lines.requested_source_fact_id |
| 6 | final pricing requires a human | **PASS** | {"autoBlocked":"HUMAN_APPROVED pricing_decisions require decided_by","decided_by":"426f4a73-1fb0-41eb-92f8-f4ceef1ee5d1"} | pricing_decisions_require_human |
| 7 | Response uses requirement-level drafting | **PASS** | {"id":"b49498b9-38ff-4963-bd96-931d86005b87","requirement_id":"6ad0c172-2c63-4640-89d7-7a84d06b0aed","draft_status":"DRAFT"} | requirement_responses |
| 8 | approved/review/blocked reuse rules work | **PASS** | {"approvedState":"VERIFIED_DRAFT_AVAILABLE","reviewState":"REVIEW_REQUIRED","blockedState":"L_AND_P_INPUT_REQUIRED"} | classifyEvidenceFromHits |
| 9 | DO_NOT_USE cannot enter draft generation | **PASS** | {"draftingHits":["APPROVED"],"lossHasDoNotUse":true} | search_verified_knowledge PROPOSAL_DRAFTING |
| 10 | missing L&P facts produce L&P INPUT REQUIRED | **PASS** | {"evidence_state":"L_AND_P_INPUT_REQUIRED","missing_information":"L&P INPUT REQUIRED: staffing capacity, certifications"} | requirement_responses.evidence_state |
| 11 | generated response shows sources | **PASS** | {"n":1,"first":{"excerpt":"staffing_approach\nVerified prior response narrative mt2shsp2: describe post coverage by building using only confirmed ro","chunk_id":"b85041b8-027f-43ef-8af0-a7e4c8a51575","reuse_status":"APPR | requirement_responses.sources_used |
| 12 | proposal progress is correct | **PASS** | {"totalRequirements":1,"verified":1,"drafted":1,"approved":0,"lpInputRequired":0,"mandatoryOutstanding":0,"requiredAttachmentsMissing":1} | computeResponseProgress |
| 13 | internal approvals are auditable | **PASS** | {"id":"5132c1b7-c5d8-4865-aad0-4b3173311dc0","layer_key":"content","status":"requested","enabled":true,"created_at":"2026-08-21T10:11:39.499499+00:00"} | pursuit_approval_layers |
| 14 | changes-requested/rejected approval state works | **PASS** | {"changes":"changes_requested","rejectedOk":true} | pursuit_approval_layers.status |
| 15 | submission checklist catches missing mandatory items | **PASS** | {"missing":["required_forms","signatures"]} | submission_checklist_items |
| 16 | submitted date/time is captured and attributed to a human | **PASS** | {"anonymousSubmitBlocked":"new row for relation \"submission_packets\" violates check constraint \"submission_packets_submitted_requires_actor\"","submitted_at":"2026-08-21T10:11:40.075+00:00","submitted_by":"426f4a73-1f | submission_packets.submitted_at + submitted_requires_actor |
| 17 | submission confirmation is captured | **PASS** | {"confirmation_reference":"PORTAL-CONF-mt2shsp2"} | submission_packets.confirmation_reference |
| 18 | Result can remain Pending | **PASS** | {"id":"ac1b971d-09b8-4166-836d-66f1f9725ab7","outcome":"PENDING"} | win_loss_reviews.outcome |
| 19 | Win/Loss/No Bid/etc. can be recorded | **PASS** | [{"outcome":"NO_BID","ok":true},{"outcome":"CANCELLED","ok":true},{"outcome":"NO_AWARD","ok":true},{"outcome":"LOST","ok":true},{"outcome":"WON","ok":true}] | opportunity_outcome enum |
| 20 | evaluator/competitor result data stays sourced | **PASS** | {"scoreFact":"cbd38b31-4e1a-43fa-912a-0b1f08de4508","bidFact":"3964a84a-1ae2-4b03-bde8-951fe128b618"} | evaluation_scores + competitor_bids source_fact_id |
| 21 | a win creates/links the Contract from a verified award fact (and blocks unsourced rows) | **PASS** | {"unsourcedBlocked":"contracts.source_fact_id is required (create via verified promotion, not blank insert)","contractId":"c6f15d37-42ed-4a97-be70-12b16e0ae09f","source_fact_id":"ee504163-f4cd-4c8b-97d8-a1d1f5aa3bf6"} | contracts_require_verified_fact + createContractFromWin path |
| 22 | outcome feeds the intelligence corpus | **PASS** | {"outcome":"WON","contract":"c6f15d37-42ed-4a97-be70-12b16e0ae09f","competitorBids":1,"pricingLines":1,"revalidateWired":true} | win_loss_reviews + contracts + intel routes |

---

## Failures

_None._

---

## How to re-run

```bash
npm run test:verify8
```
