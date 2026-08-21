# Section fix-pass — Terrell corpus / Renewals audit failures

**Role:** Fix only the FAILED items from the post-implementation verification audit of the Terrell + POP-dates section (not new product scope).  
**Date:** 2026-08-20  
**Prior verdict:** FAIL (false canonical POs; incomplete SRC-19 repair; duplicate term facts)

---

## Final result

# PASS WITH DEFERRED DEPENDENCY

All **in-scope engineering blockers** for this section are fixed and re-verified. SRC-19 remains FAILED pending OCR credentials (explicit deferred). Phase 2 corpus exit (~20–30) remains an acquisition dependency — live progress now **17 packages / 16 A/B harness-complete** after Wylie + Mesquite Grade B adds.

---

## Failures → disposition

| Failure | Root cause | Fix | Result |
| --- | --- | --- | --- |
| False `purchase_orders` (`litical`, `sitions`, `rtege`, …) | `_PO` regex matched `PO` prefix inside words like **political** / **positions** (case-insensitive), capturing alphabetic tails | Tighten `_PO` + `_plausible_po_number` (require digit); migration `20260821170000` CHECK `po_number ~ '[0-9]'`; delete bad rows; REJECT bad `extracted_facts` | **PASS** — live POs = `0000016167` only |
| Duplicate `HUMAN_VERIFIED` term/PO facts | Re-extract / double promote left duplicate rows per document+field+value | Reject duplicates keeping oldest; extractor already dedupes by idempotency_key within a run | **PASS** — 0 duplicate term groups |
| SRC-11 / SRC-18 / SRC-19 “repair” | SRC-11/18 were NEEDS_REVIEW (now VERIFIED); SRC-19 is empty native scan | SRC-11/18 already VERIFIED; SRC-19 **cannot** pass without OCR | **DEFERRED** — `MISTRAL_API_KEY` / OCR |
| Phase 2 exit ~20–30 | Acquisition shortfall (15 packages) | Out of this fix-pass scope; remains P0 next work | **DEFERRED** — external acquisition |

---

## Fixed this pass

| Item | Change |
| --- | --- |
| Extractor | `pdf_structure.py` — `_PO` lookbehind + digit-required capture; `_plausible_po_number` |
| Tests | `test_pdf_structure.py` — reject political fragments; accept real PO; term range once |
| DB | `20260821170000_purchase_orders_require_digit.sql` applied on live |
| Live data | Deleted 6 alphabetic POs; REJECTED 25 bad + 7 duplicate facts |

---

## Still failing

**None** as fixable engineering failures for this section.

---

## Deferred dependency (explicit)

1. **`MISTRAL_API_KEY`** — SRC-19 scanned amendment (`parser_id=ocr-mistral`, 0 extractable chars/page). Do not fabricate OCR text.  
2. **Corpus ~20–30 packages** — still **15** live; continue public acquisition (separate work order).

---

## Test evidence

| Check | Result |
| --- | --- |
| `pytest services/processor/tests/test_pdf_structure.py` | **6/6 PASS** |
| `test:verify2b` | **8/8 PASS** (16 A/B complete incl. SRC-22/23) |
| `pytest services/processor/tests/` | **17/17 PASS** |
| Live `purchase_orders` (org) | **`['0000016167']`** only; BAD=0 |
| Live bad HUMAN_VERIFIED `po_number` facts | **0** |
| Live duplicate term fact groups | **0** |
| Browser `/contracts/renewals` | **PASS** — Allen + Terrell SRC-20 EXPIRED; no garbage PO strings |
| SRC-19 status | **FAILED** (OCR deferred) — documented |
| Corpus after fix + next step | packages **17**; A/B complete **16** |

---

## STOP

Section audit blockers resolved or deferred. Next product work resumes at **grow pilot corpus toward ~20–30** (WORK_TRAIL P0 #4).
