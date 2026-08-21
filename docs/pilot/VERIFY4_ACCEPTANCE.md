# VERIFY 4 — Contract lifecycle acceptance

**Phase:** Canonical Phase 4 — Contract & Compliance Intelligence  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify4`  
**Artifact:** [verify4-results.json](../benchmarks/verify4-results.json)

---

## Verdict

**FAIL**

Independent lifecycle acceptance against **real pilot instruments** (TxDMV PO, Allen agreement excerpt, TFC 24-001-000 + Amend 4, Harris 26-0534 CPI-W renewal). C-class packages used only as schema/workflow stress — never claimed as L&P history.

---

## Real sources used

| SRC | Package | Class | Role | Local evidence |
| --- | --- | --- | --- | --- |
| SRC-02 | PKG-02 | A | Service plan / original POP | `docs/pilot/source-pdfs/Allen_ISD_LP_security_agreement_excerpt.pdf` |
| SRC-04 | PKG-04 | A | PO / commercial terms | `60800 0000016167.pdf` |
| SRC-14 | PKG-11 | C | Renewal / CPI-W / option | `26-0534 Renewal Job No. 220401 - Vets Securing America.pdf` |
| SRC-15 | PKG-12 | C | Executed contract / sites | `Vets Securing 24-001-000 Redacted Original.pdf` |
| SRC-16 | PKG-12 | C | Amendment lineage / current terms | `VSA 24-001 Amend 4.pdf` |

---

## PASS / FAIL by domain

| Domain | Result | Score |
| --- | --- | --- |
| corpus | **PASS** | 6/6 |
| linkage | **FAIL** | 0/1 |
| promote | **PASS** | 7/7 |
| truth | **PASS** | 3/3 |
| changes | **PASS** | 2/2 |
| commercial | **PASS** | 4/4 |
| service-plan | **PASS** | 1/1 |
| renewal | **PASS** | 4/4 |
| alerts | **PASS** | 1/1 |
| compliance | **PASS** | 1/1 |
| ui | **PASS** | 1/1 |

---

## Assertion matrix

| Domain | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| corpus | SRC-02 bytes present + SHA | **PASS** | 334504 sha=44497b51d423… ok | PKG-02 SRC-02 |
| corpus | SRC-04 bytes present + SHA | **PASS** | 38345 sha=e1f3f631bdc5… ok | PKG-04 SRC-04 |
| corpus | SRC-14 bytes present + SHA | **PASS** | 80083 sha=21a3f215cf8b… ok | PKG-11 SRC-14 |
| corpus | SRC-15 bytes present + SHA | **PASS** | 3887551 sha=8f80d1b94611… ok | PKG-12 SRC-15 |
| corpus | SRC-16 bytes present + SHA | **PASS** | 976191 sha=b91a8441f18f… ok | PKG-12 SRC-16 |
| corpus | five real instruments registered with vault SHA paths | **PASS** | orig=dd84c375 amend=a636b4b6 po=c18ff738 | SRC-15/16/04 |
| linkage | linked pursuit/award remains traceable | **FAIL** | awards requires source_fact_id (promote from HUMAN_VERIFIED only) | SRC-16 PKG-12 |
| promote | original contract end/start/number promote | **PASS** | {"end":{"ok":true,"action":"contract_end","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a","verified_end_on":"2025-08-31"},"start":{"ok":true,"action":"contract_start","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a"},"num":{"ok":true,"action":"contract_number","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a"}} | SRC-15 |
| truth | original terms seeded on contract | **PASS** | {"id":"e2e9693d-fd44-4172-860e-7281bc4dda7a","verified_end_on":"2025-08-31","start_on":"2024-09-01","contract_number":"24-001-000","opportunity_id":"3208e221-a91b-4146-b9d5-7bd463b97f00","source_fact_id":"60c2229c-3b82-4bef-8fd7-0a96e6af9734","source_document_id":"dd84c375-1798-48ca-b353-e91716ad0c61"} | SRC-15 |
| changes | amendment promote appends note row | **PASS** | {"ok":true,"action":"amendment","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a"} | SRC-16 |
| promote | promote writes amendment_number (Amend 4 grain) | **PASS** | {"ok":true,"action":"amendment","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a","amendment_number":"4"} | SRC-16 |
| promote | promote writes purchase_order from verified PO fact | **PASS** | {"ok":true,"action":"purchase_order","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a","purchase_order_id":"140a5219-314f-4e7e-b5d1-1cfe3c19c537"} | SRC-04 |
| promote | promote writes payment_terms onto PO | **PASS** | {"ok":true,"action":"payment_terms","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a","purchase_order_id":"140a5219-314f-4e7e-b5d1-1cfe3c19c537"} | SRC-04 |
| promote | promote writes federal/TXMAS identifier | **PASS** | {"ok":true,"action":"federal_identifier","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a"} | SRC-04 |
| promote | promote writes contract_service_plans from site fact | **PASS** | {"ok":true,"action":"service_plan","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a"} | SRC-02 |
| promote | promote writes guard_classification service-plan row | **PASS** | {"ok":true,"action":"service_plan","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a"} | SRC-15 |
| truth | latest change drives current verified_end_on | **PASS** | {"promote":{"ok":true,"action":"contract_end","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a","verified_end_on":"2026-11-24"},"contract":{"verified_end_on":"2026-11-24","start_on":"2024-09-01","contract_number":"24-001-000","source_fact_id":"b6d9bffa-9b98-4a71-930f-93ad34dddd36","source_document_id":"a636b4b6-0bc2-4cd6-8897-932d4dbe16ae"}} | SRC-16 |
| truth | original terms remain preserved (start + number + amd0 after later end) | **PASS** | {"start":"2024-09-01","number":"24-001-000","amd0":"2d101fbc-4ba7-485c-8068-e9f796beef12"} | SRC-15→SRC-16 |
| changes | amendment lineage works (original + Amend 4 retained) | **PASS** | [{"n":"0","title":"Executed original 24-001-000"},{"n":"4","title":null},{"n":"4-manual","title":"Amend 4 — NTE / option years / funding"},{"n":null,"title":null}] | SRC-15+SRC-16 |
| commercial | PO retains source evidence (document + fact) | **PASS** | {"id":"2d56e5ea-93e9-4048-a43a-068c12b0b8f0","source_document_id":"c18ff738-b385-4848-b602-283acc4a5694","source_fact_id":"e23d5973-fb84-4ba3-a79e-8e0b2bff0d3e","po_number":"0000016167"} | SRC-04 PKG-04 |
| commercial | PO lines match TxDMV pilot grain (72×$33.25 + Extended Hours) | **PASS** | [{"id":"938e7839-d561-4025-8f1d-7db59a780f07","line_label":"Security hours","unit_rate":33.25,"quantity":72},{"id":"b68280f4-4aa2-4ee9-b6d0-addcc7b018d7","line_label":"Extended Hours","unit_rate":445.55,"quantity":1}] | SRC-04 |
| commercial | rates/current value update without erasing history | **PASS** | po_lines=2 amendments=5 | SRC-04+SRC-16 |
| commercial | federal/vehicle identifier retains PO source | **PASS** | TXMAS-24-99003 | SRC-04 |
| service-plan | Service Plan reflects source obligations (Allen + Level II/III) | **PASS** | [{"site":"Allen ISD promote-path site","class":null},{"site":"contract","class":"Level II"},{"site":"Allen ISD campus (excerpt)","class":"Unarmed"},{"site":"TFC Level II site","class":"Level II"},{"site":"TFC Level III site","class":"Level III"}] | SRC-02+SRC-15 |
| renewal | option exercise works (promote + row) | **PASS** | {"promote":{"ok":true,"action":"option","contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a"},"options":[{"id":"7d1057dd-e065-4e28-9016-51bd7338a337","label":"option_year_1","exercise_by":"2026-10-20","source_fact_id":"0ac9d4f0-3eb4-4819-907b-d599e410e9bf"}]} | SRC-14 |
| renewal | renewal state works (notice + CPI-W + option year) | **PASS** | [{"id":"73ac2ba1-5c0d-4459-a90e-9817b5eac182","notice":"Harris 26-0534 / Job 220401 CPI-W renewal notice","escalation_index":"CPI-W","option_year":1,"notice_due_on":"2026-10-05","source_fact_id":"4b05ca44-a309-4ce7-9317-644483f78c48"}] | SRC-14 PKG-11 |
| alerts | alert buckets 180/120/90/60/30/EXPIRED from verified dates | **PASS** | {"alert":{"bucket":"120","days_until":95,"verified_end_on":"2026-11-24"},"bucketsOk":true} | verified_end_on only |
| renewal | rebid risk is visible (alert bucket + days_until) | **PASS** | {"bucket":"120","days_until":95,"verified_end_on":"2026-11-24"} | contract_alerts |
| renewal | rebid pursuit linkable from contract | **PASS** | {"id":"247fd1d0-cd69-4031-85c7-5aff95acc443","rebid_from_contract_id":"e2e9693d-fd44-4172-860e-7281bc4dda7a"} | opportunities.rebid_from_contract_id |
| compliance | compliance eligibility affects Renewal readiness | **PASS** | expired=1 of 2; blocked=true | compliance_items |
| ui | Renewal UI surfaces rebid + eligibility + buckets | **PASS** | workspace loader + renewal page | apps/web |

---

## Prove checklist (Prompt VERIFY 4)

| Prove | Result |
| --- | --- |
| original terms remain preserved | **PASS** |
| latest executed change drives current truth | **PASS** |
| rates/current value update without erasing history | **PASS** |
| Service Plan reflects source obligations | **PASS** |
| PO/commercial terms retain source evidence | **PASS** |
| amendment lineage works | **PASS** |
| option exercise works | **PASS** |
| renewal state works | **PASS** |
| 180/120/90/60/30/EXPIRED from verified dates | **PASS** |
| rebid risk is visible | **PASS** |
| compliance eligibility affects Renewal readiness | **PASS** |
| linked pursuit/award remains traceable | **FAIL** |

---

## Deferred / honest limits

| Item | Status |
| --- | --- |
| C packages as L&P history | Never — schema stress only |
| Live OCR of scan amendments | External `MISTRAL_API_KEY` (VERIFY 3 deferred) — not a Phase 4 lifecycle blocker |

Promote RPC now writes PO / service_plan / federal / amendment_number (migration 20260820600000).

---

## Test evidence

```text
npm run test:verify4  → 30 passed, 1 failed, 31 total
```

---

## STOP
