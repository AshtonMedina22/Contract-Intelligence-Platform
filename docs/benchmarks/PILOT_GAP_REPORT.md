# PILOT_GAP_REPORT — Real-Document Historical Pilot (Phase 2B)

**Generated:** 2026-08-20T06:59:27.175Z
**Corpus:** [PILOT_CORPUS_MANIFEST.md](../pilot/PILOT_CORPUS_MANIFEST.md) (18 USABLE files, 13 packages)
**Run artifact:** [pilot-run-results.json](pilot-run-results.json)
**Command:** `node --env-file=apps/web/.env.local scripts/phase2-pilot-run.mjs`

## Executive summary

| Metric | Result |
| --- | --- |
| Files attempted | 18 |
| Intake succeeded | 17 |
| Parse/extract succeeded | 16 |
| A/B pipeline-complete (VERIFY+promote) | **7** |
| Document status VERIFIED | 7 |
| Packages touched | 13 |
| Canonical pricing lines with page provenance | **3** |
| Class C canonical promotions | **0** |
| Precedence conflict exercised | YES |

**Verdict:** Representative A/B digital PDFs complete intake → structured extract → evidence-bound VERIFY → canonical promotion with page provenance. SRC-03 (25 MB) and SRC-19 (OCR) remain deferred. Phase 2 exit (~20–30 packages) is **not** met by count alone.

### Remaining gaps

| Gap | Severity | UX placement |
| --- | --- | --- |
| Full domain coverage (staffing matrix, cost-build rows, OT/holiday, evaluator scores as entities) | blocking for Phase 2 exit | Pricing; Requirements; Result |
| 25 MB intake gate blocks Allen full board packet (SRC-03) | deferred | Data Ops → Intake |
| OCR unwired — scanned PDFs fail routing (SRC-19) | deferred | Data Ops → Processing |
| Corpus depth ~13 packages vs ~20–30 exit | deferred | Data Ops |
| Standalone XLSX pricing workbook missing | deferred | Pricing |

---

## Domain coverage (corpus-wide)

Legend: **present** = regex signal in PDF text; **captured** = structured staging/promotion for rates/requirements/ids where extractor fires; **MISSING** = broader domain still incomplete.

### SOLICITATION

| Subdomain | In source (any file) | Structured capture | UX placement |
| --- | --- | --- | --- |
| metadata | yes | partial (ids/requirements) | Requirements |
| dates | yes | partial (ids/requirements) | Requirements |
| deadlines | yes | partial (ids/requirements) | Requirements |
| addenda/Q&A | yes | partial (ids/requirements) | Requirements |
| evaluation | yes | partial (ids/requirements) | Requirements |
| forms/signatures | yes | partial (ids/requirements) | Requirements |
| submission method | yes | partial (ids/requirements) | Requirements |

### SCOPE

| Subdomain | In source (any file) | Structured capture | UX placement |
| --- | --- | --- | --- |
| service | yes | **MISSING** | Requirements |
| sites/posts | yes | **MISSING** | Requirements |
| staffing | yes | **MISSING** | Requirements |
| schedules | yes | **MISSING** | Requirements |
| guard classifications | yes | **MISSING** | Requirements |
| personnel/training | yes | **MISSING** | Requirements |

### PRICING

| Subdomain | In source (any file) | Structured capture | UX placement |
| --- | --- | --- | --- |
| buyer-requested format | yes | partial (hourly rates) | Pricing |
| L&P proposed pricing | yes | partial (hourly rates) | Pricing |
| competitor pricing | yes | partial (hourly rates) | Pricing |
| awarded pricing | yes | partial (hourly rates) | Pricing |
| current pricing | yes | partial (hourly rates) | Pricing |
| component cost build-up | yes | partial (hourly rates) | Pricing |
| options/escalation | yes | partial (hourly rates) | Pricing |
| OT/holiday | yes | partial (hourly rates) | Pricing |
| equipment/vehicle | yes | partial (hourly rates) | Pricing |

### PROPOSAL

| Subdomain | In source (any file) | Structured capture | UX placement |
| --- | --- | --- | --- |
| response sections | yes | **MISSING** | Response |
| commitments | yes | **MISSING** | Response |
| references | yes | **MISSING** | Response |
| certifications | yes | **MISSING** | Response |
| evidence/source pages | yes | **MISSING** | Response |

### RESULT

| Subdomain | In source (any file) | Structured capture | UX placement |
| --- | --- | --- | --- |
| award | yes | **MISSING** | Result |
| loss | yes | **MISSING** | Result |
| rank | yes | **MISSING** | Result |
| evaluator scoring | yes | **MISSING** | Result |
| competitor result | yes | **MISSING** | Result |

### CONTRACT

| Subdomain | In source (any file) | Structured capture | UX placement |
| --- | --- | --- | --- |
| service plan | yes | **MISSING** | Data Ops |
| commercial terms | yes | **MISSING** | Data Ops |
| PO | yes | **MISSING** | Data Ops |
| amendments | yes | **MISSING** | Data Ops |
| options | yes | **MISSING** | Data Ops |
| renewals | yes | **MISSING** | Data Ops |
| current terms | yes | **MISSING** | Data Ops |

### PROVENANCE

| Subdomain | Intake | Parse | Staging | Human verify | Canonical |
| --- | --- | --- | --- | --- | --- |
| page | SHA-256 + version YES | page index YES | structured + page_text | evidence-bound VERIFY | **YES via source_fact_id** |
| section | — | — | partial | — | — |
| sheet/cell | — | XLSX unwired | **MISSING** | — | — |
| source excerpt | — | in fact + source_evidence | YES | YES | YES when promoted |
| version | document_versions YES | — | — | — | — |
| verification | verification_events YES | — | AI_EXTRACTED | HUMAN_VERIFIED (structured only) | promote_verified_fact |

---

## Per-package records

### PKG-01 — Williamson County #202569

Classification: **A** | Expected outcome: Win | Primary UX: **Contract Commercial Terms / Response**

- **Files:** SRC-01
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 1/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| provenance_failure | 12 page_text facts for 19 pages — empty pages skipped; no section/cell granularity | deferrable | Data Ops |
| missing field | L&P hourly rate ($31.45 unarmed, golf cart $500/mo) not structured | blocking | Pricing |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-01 | contract+proposal | 19 | 12 | ok | VERIFIED |

---

### PKG-02 — Allen ISD 2024–25

Classification: **A/B** | Expected outcome: Win | Primary UX: **Contract Service Plan**

- **Files:** SRC-02, SRC-03
- **Ingested:** 1/2 | **Processed:** 1/2 | **Document VERIFIED:** 1/2

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| intake_blocked | exceeds 25MB intake limit | blocking | Data Ops |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-02 | agreement excerpt | 13 | 14 | ok | VERIFIED |
| SRC-03 | board packet | — | — | skip | — |

---

### PKG-03 — Arlington TX RFP 22-0143

Classification: **B** | Expected outcome: Loss (VSA awarded) | Primary UX: **Result / Requirements**

- **Files:** SRC-06, SRC-07
- **Ingested:** 2/2 | **Processed:** 2/2 | **Document VERIFIED:** 2/2

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| missing field | Building/post staffing matrix not in staffing_posts | blocking | Requirements |
| missing field | L&P 70.48 vs VSA 90.46 scores; award $960,343 not in evaluator_scores | blocking | Result |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-06 | solicitation | 35 | 40 | ok | VERIFIED |
| SRC-07 | eval/award | 3 | 5 | ok | VERIFIED |

---

### PKG-04 — TxDMV PO 0000016167

Classification: **A** | Expected outcome: Win (PO) | Primary UX: **Contract Commercial Terms**

- **Files:** SRC-04
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 1/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| missing field | PO line items (72 HR × $33.25, Extended Hours $445.55) not structured | blocking | Contract Commercial Terms |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-04 | PO | 2 | 3 | ok | VERIFIED |

---

### PKG-05 — Jefferson IFB 18-009 tab

Classification: **B** | Expected outcome: All bids rejected | Primary UX: **Result / Pricing**

- **Files:** SRC-08
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 1/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| missing field | Multi-vendor hourly rows (incl. L&P $18.75 Jefferson) not in pricing_lines | blocking | Pricing |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-08 | bid tab | 1 | 5 | ok | VERIFIED |

---

### PKG-06 — Texas Lottery RQ22-0480DP

Classification: **B** | Expected outcome: Unknown | Primary UX: **Requirements / Submission**

- **Files:** SRC-09
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 1/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| missing field | 149-pp IFB forms/HUB/references/cost sheet not decomposed into requirements or pricing grid | blocking | Requirements |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-09 | solicitation | 149 | 153 | ok | VERIFIED |

---

### PKG-07 — Dallas 16-0219 tab

Classification: **C test** | Expected outcome: Competitor | Primary UX: **Pricing / Intelligence**

- **Files:** SRC-10
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 0/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| schema_gap | 1 page_text facts verified but 0 promoted to canonical (no entity mapping for page blobs) | blocking | Data Ops |
| missing field | Multi-vendor hourly rows (incl. L&P $18.75 Jefferson) not in pricing_lines | blocking | Pricing |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-10 | bid tab | 3 | 4 | ok | NEEDS_REVIEW |

---

### PKG-08 — Dallas 2014-036 synopsis

Classification: **C test** | Expected outcome: Competitor | Primary UX: **Pricing**

- **Files:** SRC-11
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 0/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| schema_gap | Extractor emits page_text blobs only — no solicitation/pricing/scope entities | blocking | Data Ops |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-11 | synopsis | 1 | 1 | ok | NEEDS_REVIEW |

---

### PKG-09 — Tarrant 2018-092 cost build

Classification: **C test** | Expected outcome: Competitor | Primary UX: **Pricing**

- **Files:** SRC-12
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 0/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| schema_gap | 1 page_text facts verified but 0 promoted to canonical (no entity mapping for page blobs) | blocking | Data Ops |
| missing field | Wage/FICA/WC/OH/profit stack not in cost_build_components | blocking | Pricing |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-12 | cost build | 2 | 3 | ok | NEEDS_REVIEW |

---

### PKG-10 — MHMR 25-003 tab

Classification: **C test** | Expected outcome: Competitor | Primary UX: **Pricing / Result**

- **Files:** SRC-13
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 0/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| schema_gap | 2 page_text facts verified but 0 promoted to canonical (no entity mapping for page blobs) | blocking | Data Ops |
| missing field | Multi-vendor hourly rows (incl. L&P $18.75 Jefferson) not in pricing_lines | blocking | Pricing |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-13 | bid tab | 3 | 5 | ok | NEEDS_REVIEW |

---

### PKG-11 — Harris 26-0534 renewal

Classification: **C test** | Expected outcome: Competitor renewal | Primary UX: **Contract Renewal**

- **Files:** SRC-14
- **Ingested:** 1/1 | **Processed:** 1/1 | **Document VERIFIED:** 0/1

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| schema_gap | Extractor emits page_text blobs only — no solicitation/pricing/scope entities | blocking | Data Ops |
| missing field | CPI-W renewal terms not in contract_renewal_options | blocking | Contract Renewal |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-14 | renewal | 1 | 1 | ok | NEEDS_REVIEW |

---

### PKG-12 — TFC 24-001-000 + Amend 4

Classification: **C test** | Expected outcome: Competitor | Primary UX: **Contract Service Plan / Changes**

- **Files:** SRC-15, SRC-16
- **Ingested:** 2/2 | **Processed:** 2/2 | **Document VERIFIED:** 0/2

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| schema_gap | 2 page_text facts verified but 0 promoted to canonical (no entity mapping for page blobs) | blocking | Data Ops |
| schema_gap | 4 page_text facts verified but 0 promoted to canonical (no entity mapping for page blobs) | blocking | Data Ops |
| missing field | Level II vs III site staffing not in service_plan_sites | blocking | Contract Service Plan |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-15 | contract | 74 | 76 | ok | NEEDS_REVIEW |
| SRC-16 | amendment | 6 | 10 | ok | NEEDS_REVIEW |

---

### PKG-13 — Arlington VA 19-264-R

Classification: **C test** | Expected outcome: Competitor | Primary UX: **Contract Changes**

- **Files:** SRC-17, SRC-18, SRC-19
- **Ingested:** 3/3 | **Processed:** 2/3 | **Document VERIFIED:** 0/3

#### Captured correctly

- SHA-256 checksum, evidence vault path, document_versions row
- document_batches package label association
- pdf-native parse + page-level staging facts
- Human verification events + document VERIFIED status (pilot batch)

#### Gaps

| Type | Detail | Severity | UX placement |
| --- | --- | --- | --- |
| schema_gap | 1 page_text facts verified but 0 promoted to canonical (no entity mapping for page blobs) | blocking | Data Ops |
| provenance_failure | 3 page_text facts for 13 pages — empty pages skipped; no section/cell granularity | deferrable | Data Ops |
| schema_gap | Extractor emits page_text blobs only — no solicitation/pricing/scope entities | blocking | Data Ops |
| parser_extraction_failure | Checked-in policy: mean extractable chars/page=0.0 (threshold 40). Escalate to OCR; do not accept empty native parse. parser_id=ocr-mistral class=scanned_pdf policy=1.0.0 mime='application/pdf' filename='19-264-RA3Final.pdf'. | blocking | Data Ops |
| parser_extraction_failure | Scanned/image PDF — no extractable text (OCR unwired) | blocking | Data Ops |
| parser failure | OCR policy blocks parse; 0 chars extracted | blocking | Data Ops |

#### File detail

| SRC | Type | Pages | Facts | Process | Status |
| --- | --- | --- | --- | --- | --- |
| SRC-17 | contract+NOA | 13 | 3 | ok | NEEDS_REVIEW |
| SRC-18 | amendment | 2 | 2 | ok | NEEDS_REVIEW |
| SRC-19 | amendment scan | 9 | 0 | fail | FAILED |

---

## Recommended schema additions (evidence-backed — do not migrate until reviewed)

From this pilot only — all are **blocking** for Phase 2 exit:

1. **`pricing_lines`** — row grain: vendor × site/post × rate type (std/OT/holiday) × unit × extended; source page + cell/table provenance.
2. **`requirements`** — solicitation requirement text, mandatory flag, section ref; links to response status.
3. **`evaluator_scores`** — respondent × criterion × points; ties to pursuit result.
4. **`pursuit_outcomes`** — award/loss/no-award/rejected bids; amount; rank; **no invented loss reason**.
5. **`staffing_posts`** — site/building × hours × classification × schedule.
6. **`cost_build_components`** — wage, burden, OH, profit rows (Tarrant-style).
7. **`contract_instruments`** — PO, amendment, renewal, option; NTE; POP dates.
8. **`federal_identifiers`** — TXMAS, GSA MAS (Williamson/TxDMV cite these).
9. **`proposal_sections`** — exec summary, pricing, attachments with source page.
10. **Structured extractor** — replace page_text-only heuristic with table/form/section-aware extraction + optional gateway.

## Test evidence

```text
Pilot run: 17/18 ingested, 16 processed, 7 VERIFIED
npm run test:verify2a  — corpus local verification
npm run test:phase3-intake — intake infrastructure
npm run test:phase6-benchmark — processor pytest
```

## Out of scope (this prompt)

- New global navigation or Ask GPT / Reports / Pricing AI / Response AI expansion
- Migrations (findings only)
- Frisco L&P tab (UNAVAILABLE per manifest)
- Labeling competitor **C** corpus as L&P history
