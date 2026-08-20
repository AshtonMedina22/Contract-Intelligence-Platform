# VERIFY 2B — Historical Pilot acceptance

**Phase:** Canonical Phase 2 — Real-Document Historical Pilot  
**Audit date:** 2026-08-20 (fix pass)  
**Evidence:** [pilot-run-results.json](../benchmarks/pilot-run-results.json), [PILOT_GAP_REPORT.md](../benchmarks/PILOT_GAP_REPORT.md), `npm run test:verify2b`

---

## Verdict

**PASS WITH NONBLOCKING GAPS**

VERIFY 2B trust-pipeline failures from the prior audit are closed for representative A/B digital packages. Remaining Phase 2 exit work (OCR, 25 MB packet, ~20–30 package count, full domain schema) is **deferred** — not Phase 3.

---

## Assertion results

| Assertion | Result | Evidence |
| --- | --- | --- |
| Representative real documents completed the actual trust pipeline | **PASS** | **7** A/B files `pipelineComplete=true` (SRC-01, 02, 04, 06, 07, 08, 09) |
| No package counted complete before HUMAN verification + canonical promotion | **PASS** | `pipelineComplete` requires structured VERIFY + promote; SRC-19 stays **FAILED**; zero-fact VERIFIED = none |
| A/B/C classifications remained intact | **PASS** | Labels preserved; C never `pipelineComplete` |
| Competitor records never became L&P history | **PASS** | Class C canonical promote actions = **0** |
| Source/page provenance survived promotion | **PASS** | **3/3** pricing-line `source_fact_id` rows retain `source_page` + excerpt + `source_evidence.page` |
| Four commercial truths stayed distinct | **PASS** | Proposed vs awarded columns written separately; overwrite refused |
| Addenda/source precedence behaved correctly | **PASS** | `requested_rate` on awarded doc → `conflict` / `precedence_requested` (SRC-02 probe) |
| Real parser failures documented | **PASS** | SRC-03 25 MB; SRC-19 OCR 422 / FAILED |
| Real schema gaps documented | **PASS** | Updated gap report |
| No unsupported AI fact became canonical | **PASS** | Page blobs **REJECTED**; only structured fields VERIFY+promote |
| PILOT_GAP_REPORT is evidence-backed | **PASS** | Regenerated from run JSON |

---

## Fixes applied (this pass)

| Failure | Root cause | Fix |
| --- | --- | --- |
| 0 structured facts / 0 promotion | Heuristic emitted only `page_N_text` | Deterministic PDF structure extractor (rates, solicitation id, requirements, award) |
| Promotion skipped | No `opportunity_id` | Pilot creates client+opportunity per package; sets `document_type` / `commercial_truth` |
| Batch `HUMAN_VERIFIED` on page blobs | Harness stamped everything | VERIFY only structured facts with excerpt-on-page; REJECT page blobs |
| VERIFIED with 0 facts (SRC-19) | Harness + UI allowed empty complete | Harness never completes failed/empty; `completeDocumentVerification` requires ≥1 HUMAN_VERIFIED and blocks FAILED |
| Provenance never reached canonical | No promotion | Rates promote to `pricing_lines` with `*_source_fact_id` + `source_evidence` |
| Precedence untested | Never exercised | Probe `requested_rate` on awarded document → conflict |
| C counted as promoted | Skip path marked `ok: true` | Class C skips RPC; counters only canonical actions |

---

## Deferred dependency (explicit)

| Item | Why deferred |
| --- | --- |
| SRC-03 Allen full packet (~32 MB) | Intake size gate; excerpt SRC-02 completes PKG-02 |
| SRC-19 scanned amendment OCR | OCR adapters unwired (Phase 3 production OCR) |
| ≥20–30 packages Phase 2 exit count | Corpus acquisition / HUNT rows; not a VERIFY 2B trust-pipeline fix |
| Full staffing / cost-build / OT matrix / XLSX | Schema breadth beyond smallest path that unblocks source-to-canonical |

---

## Test evidence

```text
npm run test:verify2b
8 passed, 0 failed

python -m pytest (processor)  13 passed
# plus phase regression below
```

Pipeline sample: Williamson `$31.45` proposed (page 17); Allen `$32.28` awarded (page 3); precedence conflict on SRC-02.
