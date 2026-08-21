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
| corpus | five real instruments registered with vault SHA paths | **PASS** | orig=f3d8f219 amend=0691d5f6 po=ce484283 | SRC-15/16/04 |
| linkage | linked pursuit/award remains traceable | **FAIL** | awards requires source_fact_id (promote from HUMAN_VERIFIED only) | SRC-16 PKG-12 |
| promote | original contract end/start/number promote | **PASS** | {"end":{"ok":true,"action":"contract_end","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd","verified_end_on":"2025-08-31"},"start":{"ok":true,"action":"contract_start","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd"},"num":{"ok":true,"action":"contract_number","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd"}} | SRC-15 |
| truth | original terms seeded on contract | **PASS** | {"id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd","verified_end_on":"2025-08-31","start_on":"2024-09-01","contract_number":"24-001-000","opportunity_id":"162bc6a3-80c8-4017-88a9-1c0bd29fb3f6","source_fact_id":"27ef64da-cd07-4347-bdeb-eec3bb66ebb7","source_document_id":"f3d8f219-0064-4da0-9b7b-dee68129bd3b"} | SRC-15 |
| changes | amendment promote appends note row | **PASS** | {"ok":true,"action":"amendment","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd"} | SRC-16 |
| promote | promote writes amendment_number (Amend 4 grain) | **PASS** | {"ok":true,"action":"amendment","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd","amendment_number":"4"} | SRC-16 |
| promote | promote writes purchase_order from verified PO fact | **PASS** | {"ok":true,"action":"purchase_order","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd","purchase_order_id":"15ff45f1-3af7-44db-9c7c-afe0b6dfa9d2"} | SRC-04 |
| promote | promote writes payment_terms onto PO | **PASS** | {"ok":true,"action":"payment_terms","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd","purchase_order_id":"15ff45f1-3af7-44db-9c7c-afe0b6dfa9d2"} | SRC-04 |
| promote | promote writes federal/TXMAS identifier | **PASS** | {"ok":true,"action":"federal_identifier","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd"} | SRC-04 |
| promote | promote writes contract_service_plans from site fact | **PASS** | {"ok":true,"action":"service_plan","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd"} | SRC-02 |
| promote | promote writes guard_classification service-plan row | **PASS** | {"ok":true,"action":"service_plan","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd"} | SRC-15 |
| truth | latest change drives current verified_end_on | **PASS** | {"promote":{"ok":true,"action":"contract_end","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd","verified_end_on":"2026-11-24"},"contract":{"verified_end_on":"2026-11-24","start_on":"2024-09-01","contract_number":"24-001-000","source_fact_id":"45ec5656-e58d-4fa8-a046-d55998f794e0","source_document_id":"0691d5f6-6fef-4639-909e-6454f475b718"}} | SRC-16 |
| truth | original terms remain preserved (start + number + amd0 after later end) | **PASS** | {"start":"2024-09-01","number":"24-001-000","amd0":"d04c886d-9d23-41d3-9b20-a82b619801ec"} | SRC-15→SRC-16 |
| changes | amendment lineage works (original + Amend 4 retained) | **PASS** | [{"n":"0","title":"Executed original 24-001-000"},{"n":"4","title":null},{"n":"4-manual","title":"Amend 4 — NTE / option years / funding"},{"n":null,"title":null}] | SRC-15+SRC-16 |
| commercial | PO retains source evidence (document + fact) | **PASS** | {"id":"4a7da16a-575f-43ee-b206-91b721af0e6f","source_document_id":"ce484283-f15e-4b78-aa6c-64c7a65ce317","source_fact_id":"c582ff58-0a82-43dd-b5ae-78c24a615185","po_number":"0000016167"} | SRC-04 PKG-04 |
| commercial | PO lines match TxDMV pilot grain (72×$33.25 + Extended Hours) | **PASS** | [{"id":"ec2bc966-3e2e-4ece-886f-9ac71c5d34be","line_label":"Security hours","unit_rate":33.25,"quantity":72},{"id":"8e1c8c2f-d904-4108-a609-63f3ef1515a0","line_label":"Extended Hours","unit_rate":445.55,"quantity":1}] | SRC-04 |
| commercial | rates/current value update without erasing history | **PASS** | po_lines=2 amendments=5 | SRC-04+SRC-16 |
| commercial | federal/vehicle identifier retains PO source | **PASS** | TXMAS-24-99003 | SRC-04 |
| service-plan | Service Plan reflects source obligations (Allen + Level II/III) | **PASS** | [{"site":"Allen ISD promote-path site","class":null},{"site":"contract","class":"Level II"},{"site":"Allen ISD campus (excerpt)","class":"Unarmed"},{"site":"TFC Level II site","class":"Level II"},{"site":"TFC Level III site","class":"Level III"}] | SRC-02+SRC-15 |
| renewal | option exercise works (promote + row) | **PASS** | {"promote":{"ok":true,"action":"option","contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd"},"options":[{"id":"c0daf96f-71c4-4693-9b0e-40331f0c760b","label":"option_year_1","exercise_by":"2026-10-20","source_fact_id":"c731b9e7-259a-455d-9000-d6168d92e8cc"}]} | SRC-14 |
| renewal | renewal state works (notice + CPI-W + option year) | **PASS** | [{"id":"d61745e7-e9e3-4bfd-8e48-69482598e670","notice":"Harris 26-0534 / Job 220401 CPI-W renewal notice","escalation_index":"CPI-W","option_year":1,"notice_due_on":"2026-10-05","source_fact_id":"5dfd0b07-e1d7-45ea-b626-a61d3749a905"}] | SRC-14 PKG-11 |
| alerts | alert buckets 180/120/90/60/30/EXPIRED from verified dates | **PASS** | {"alert":{"bucket":"120","days_until":95,"verified_end_on":"2026-11-24"},"bucketsOk":true} | verified_end_on only |
| renewal | rebid risk is visible (alert bucket + days_until) | **PASS** | {"bucket":"120","days_until":95,"verified_end_on":"2026-11-24"} | contract_alerts |
| renewal | rebid pursuit linkable from contract | **PASS** | {"id":"b7956e81-fc6f-4952-88e3-c6eb0e443fea","rebid_from_contract_id":"56a81bae-9a60-4ebd-9080-f59eef56f2dd"} | opportunities.rebid_from_contract_id |
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
