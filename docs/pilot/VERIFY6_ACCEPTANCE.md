# VERIFY 6 — Ask / Reports / Automation acceptance

**Phase:** Canonical Phase 6 — Find / Ask GPT / Reports / Automation  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify6`  
**Artifact:** [verify6-results.json](../benchmarks/verify6-results.json)

---

## Verdict

**FAIL**

Independent acceptance of LOCATE (no LLM), ASK (verified + cites + refuse), purpose filtering, tenancy, report honesty, and bounded automation gates.

---

## PASS / FAIL by domain

| Domain | Result | Score |
| --- | --- | --- |
| locate | **PASS** | 3/3 |
| ask | **PASS** | 5/5 |
| reports | **PASS** | 4/4 |
| automation | **FAIL** | 7/8 |
| purpose | **PASS** | 2/2 |
| tenancy | **PASS** | 2/2 |

---

## Assertion matrix

| Domain | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| locate | LOCATE implementation does not require LLM | **PASS** | SQL/ilike only in locateRecords | lib/retrieval/search.ts |
| locate | Ask page wires LOCATE mode without synthesis | **PASS** | mode=locate path | intelligence/ask/page.tsx |
| ask | ASK refuses unsupported answer with canonical copy | **PASS** | empty hits → INSUFFICIENT | lib/ask/synthesize.ts |
| ask | Answer UI cites Sources / Evidence and View Source | **PASS** | contract headings always present | components/ask/answer-panel.tsx |
| reports | Reports disclose data scope and withhold fabrication | **PASS** | generateIntelligenceReport honesty | lib/reports/generate.ts |
| automation | Automation never auto-approves pricing/proposal/submission (documented + no approve RPCs) | **PASS** | migration comment + no approve/submit RPC | phase6 + verify6 approval migrations |
| locate | LOCATE finds records directly | **PASS** | ["V6 Locate Target mt2u5yse"] | opportunities.ilike |
| ask | ASK answers from verified sources | **PASS** | {"n":1,"reuse":"APPROVED","path":"e09be04d-c12f-4732-923e-5c5d424cc698/4ed70a21-1a"} | search_verified_knowledge |
| ask | ASK cites evidence (storage path + fact linkage) | **PASS** | {"storage_path":"e09be04d-c12f-4732-923e-5c5d424cc698/4ed70a21-1aa4-41c2-8ab1-ad75178e03bf/v/5503487b0cd60242cf169661b3fece95885eb77afb597aacd823665c09514c3b/original.pdf","source_fact_id":"4cae08b2-09e7-4533-8684-af47c4 | search_verified_knowledge |
| ask | ASK refuses unsupported answer when no verified hits | **PASS** | {"emptyHits":0,"canonicalCopy":true} | search + synthesize.ts |
| purpose | DO_NOT_USE cannot enter drafting retrieval | **PASS** | [] | PROPOSAL_DRAFTING |
| purpose | DO_NOT_USE appears in loss analysis where relevant | **PASS** | ["DO_NOT_USE"] | LOSS_ANALYSIS |
| tenancy | Cross-org evidence cannot leak | **PASS** | {"n":0,"err":null} | org B search |
| tenancy | Cross-org structured records cannot leak (LOCATE) | **PASS** | [] | clients RLS |
| reports | Empty/insufficient corpus does not produce fabricated conclusions | **PASS** | {"awards":0,"reviews":0,"bids":0,"pricing":0} | org B + generate.ts |
| reports | Report source scope disclosed | **PASS** | dataScope string built in generateIntelligenceReport | lib/reports/generate.ts |
| reports | Unsupported statistics withheld | **PASS** | honesty copy present; no fabricated share UI | reports/page.tsx + generate.ts |
| automation | Submission deadline reminder fires correctly | **PASS** | {"run":{"ok":true,"note":"No human gates bypassed","compliance":0,"contract_alerts":1,"pursuit_deadlines":2,"approval_reminders":2,"verification_backlog":2},"events":[{"kind":"pursuit_deadline","due_on":"2026-08-23","tit | pursuit_deadline on response_due_on |
| automation | Approval reminder respects state | **PASS** | {"refresher":true,"pendingOpen":1,"openAfterGo":0} | approval_reminder + go_no_go |
| automation | Duplicate execution is idempotent | **PASS** | {"before":["aaae0832-87a1-46d4-8a70-d8bfbd878e7b"],"after":["aaae0832-87a1-46d4-8a70-d8bfbd878e7b"]} | ensure_automation_event |
| automation | Renewal/compliance checks use verified dates | **FAIL** | contracts.source_fact_id is required (create via verified promotion, not blank insert) | contracts.verified_end_on → contract_alerts |
| automation | Compliance expiration automation uses expires_on | **PASS** | [{"kind":"compliance_expiration","due_on":"2026-08-31","entity_id":"51cfb313-ebe2-4a24-8d46-7baa0ca48987"}] | compliance_expiration |
| automation | Processing failure is visible/retriable | **PASS** | {"failed":{"id":"a3065b09-5f2a-4701-a7bc-c0ff7ba17853","processing_status":"FAILED","lifecycle_error":"parser boom"},"retried":{"processing_status":"QUEUED"}} | documents FAILED → QUEUED + processing UI |
| automation | Pursuit deadline respects closed stage (no new open alert) | **PASS** | [] | refresh_pursuit_deadline_alerts stage filter |

---

## Failures

- **[automation] Renewal/compliance checks use verified dates** — contracts.source_fact_id is required (create via verified promotion, not blank insert)

---

## Deferred / external (not counted as FAIL unless asserted)

- Live ASK LLM synthesis requires AI Gateway / `ASK_MODEL` — retrieval-only path must still refuse empty evidence.

---

## How to re-run

```bash
npm run test:verify6
```
