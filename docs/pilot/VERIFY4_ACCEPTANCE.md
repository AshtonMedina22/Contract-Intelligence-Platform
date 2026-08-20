# VERIFY 4 — Contract lifecycle acceptance

**Phase:** Canonical Phase 4 — Contract & Compliance Intelligence  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify4`  
**Artifact:** [verify4-results.json](../benchmarks/verify4-results.json)

---

## Verdict

**PASS**

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
| linkage | **PASS** | 1/1 |
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
| corpus | five real instruments registered with vault SHA paths | **PASS** | orig=6a4be858 amend=1be5caa0 po=a8a93c52 | SRC-15/16/04 |
| linkage | linked pursuit/award remains traceable | **PASS** | award=0fbca1f7-1ffd-4be2-93d7-16cde89b4a3f nte=12500000 | SRC-16 PKG-12 |
| promote | original contract end/start/number promote | **PASS** | {"end":{"ok":true,"action":"contract_end","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c","verified_end_on":"2025-08-31"},"start":{"ok":true,"action":"contract_start","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c"},"num":{"ok":true,"action":"contract_number","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c"}} | SRC-15 |
| truth | original terms seeded on contract | **PASS** | {"id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c","verified_end_on":"2025-08-31","start_on":"2024-09-01","contract_number":"24-001-000","opportunity_id":"d9b834d5-6d2f-4bc8-9fd2-551eb172ec8e","source_fact_id":"8fdb6e42-ff6f-40a2-859b-19bac863aeae","source_document_id":"6a4be858-8e39-4d38-99bb-3310634f5a5b"} | SRC-15 |
| changes | amendment promote appends note row | **PASS** | {"ok":true,"action":"amendment","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c"} | SRC-16 |
| promote | promote writes amendment_number (Amend 4 grain) | **PASS** | {"ok":true,"action":"amendment","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c","amendment_number":"4"} | SRC-16 |
| promote | promote writes purchase_order from verified PO fact | **PASS** | {"ok":true,"action":"purchase_order","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c","purchase_order_id":"93b5a3c1-e4a5-4f40-81c9-0fb145aba42d"} | SRC-04 |
| promote | promote writes payment_terms onto PO | **PASS** | {"ok":true,"action":"payment_terms","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c","purchase_order_id":"93b5a3c1-e4a5-4f40-81c9-0fb145aba42d"} | SRC-04 |
| promote | promote writes federal/TXMAS identifier | **PASS** | {"ok":true,"action":"federal_identifier","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c"} | SRC-04 |
| promote | promote writes contract_service_plans from site fact | **PASS** | {"ok":true,"action":"service_plan","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c"} | SRC-02 |
| promote | promote writes guard_classification service-plan row | **PASS** | {"ok":true,"action":"service_plan","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c"} | SRC-15 |
| truth | latest change drives current verified_end_on | **PASS** | {"promote":{"ok":true,"action":"contract_end","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c","verified_end_on":"2026-11-23"},"contract":{"verified_end_on":"2026-11-23","start_on":"2024-09-01","contract_number":"24-001-000","source_fact_id":"c47baf17-d455-4fc4-8511-3fa4e096f738","source_document_id":"1be5caa0-8203-4a05-80bf-6c238e4cd299"}} | SRC-16 |
| truth | original terms remain preserved (start + number + amd0 after later end) | **PASS** | {"start":"2024-09-01","number":"24-001-000","amd0":"0dd67b64-7670-46da-890b-c03597f0dcb8"} | SRC-15→SRC-16 |
| changes | amendment lineage works (original + Amend 4 retained) | **PASS** | [{"n":"0","title":"Executed original 24-001-000"},{"n":"4","title":null},{"n":"4-manual","title":"Amend 4 — NTE / option years / funding"},{"n":null,"title":null}] | SRC-15+SRC-16 |
| commercial | PO retains source evidence (document + fact) | **PASS** | {"id":"ba2e53b2-c87f-4997-ae64-5ac0e6e81002","source_document_id":"a8a93c52-9d73-49b6-91bb-9c912d92e2f5","source_fact_id":"12ef1afc-c41c-49e4-b744-c96734754823","po_number":"0000016167"} | SRC-04 PKG-04 |
| commercial | PO lines match TxDMV pilot grain (72×$33.25 + Extended Hours) | **PASS** | [{"id":"b068f9d6-f07d-49ff-91fa-4059de32adbe","line_label":"Security hours","unit_rate":33.25,"quantity":72},{"id":"68930e5c-0ff0-47e3-8682-9c1198ef6e06","line_label":"Extended Hours","unit_rate":445.55,"quantity":1}] | SRC-04 |
| commercial | rates/current value update without erasing history | **PASS** | po_lines=2 amendments=5 | SRC-04+SRC-16 |
| commercial | federal/vehicle identifier retains PO source | **PASS** | TXMAS-24-99003 | SRC-04 |
| service-plan | Service Plan reflects source obligations (Allen + Level II/III) | **PASS** | [{"site":"Allen ISD promote-path site","class":null},{"site":"contract","class":"Level II"},{"site":"Allen ISD campus (excerpt)","class":"Unarmed"},{"site":"TFC Level II site","class":"Level II"},{"site":"TFC Level III site","class":"Level III"}] | SRC-02+SRC-15 |
| renewal | option exercise works (promote + row) | **PASS** | {"promote":{"ok":true,"action":"option","contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c"},"options":[{"id":"1e978e89-41f5-49dd-8091-9b778869f0c2","label":"option_year_1","exercise_by":"2026-10-19","source_fact_id":"ad3ae598-2f5b-4c1e-ad5e-441663caef1a"}]} | SRC-14 |
| renewal | renewal state works (notice + CPI-W + option year) | **PASS** | [{"id":"e748af12-0042-4e46-99cc-589eff4e3b74","notice":"Harris 26-0534 / Job 220401 CPI-W renewal notice","escalation_index":"CPI-W","option_year":1,"notice_due_on":"2026-10-04","source_fact_id":"2492e2ea-6a77-44e9-b0c6-b2a761f265ab"}] | SRC-14 PKG-11 |
| alerts | alert buckets 180/120/90/60/30/EXPIRED from verified dates | **PASS** | {"alert":{"bucket":"120","days_until":95,"verified_end_on":"2026-11-23"},"bucketsOk":true} | verified_end_on only |
| renewal | rebid risk is visible (alert bucket + days_until) | **PASS** | {"bucket":"120","days_until":95,"verified_end_on":"2026-11-23"} | contract_alerts |
| renewal | rebid pursuit linkable from contract | **PASS** | {"id":"d80cb9ad-516e-42fc-9bfe-d1ada6f795c8","rebid_from_contract_id":"55ecf64e-5b4c-4ff8-9d99-41343ff5198c"} | opportunities.rebid_from_contract_id |
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
| linked pursuit/award remains traceable | **PASS** |

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
npm run test:verify4  → 31 passed, 0 failed, 31 total
```

---

## STOP
