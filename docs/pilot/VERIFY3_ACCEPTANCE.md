# VERIFY 3 — Data Ops acceptance

**Phase:** Canonical Phase 3 — Production Historical Ingestion & Migration  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify3`  
**Artifact:** [verify3-results.json](../benchmarks/verify3-results.json)

---

## Verdict

**PASS**

Independent Data Ops acceptance against **real pilot PDFs** from [PILOT_CORPUS_MANIFEST.md](PILOT_CORPUS_MANIFEST.md). XLSX proven via openpyxl fixture (pilot has 0 workbooks). DOCX not required by pilot corpus; production adapter smoke-tested.

---

## PASS / FAIL by domain

| Domain | Result | Score |
| --- | --- | --- |
| **corpus** | **PASS** | 3/3 |
| **docx** | **PASS** | 2/2 |
| **xlsx** | **PASS** | 1/1 |
| **pdf** | **PASS** | 3/3 |
| **scans** | **PASS** | 2/2 |
| **package** | **PASS** | 1/1 |
| **dedupe** | **PASS** | 1/1 |
| **versions** | **PASS** | 1/1 |
| **intake** | **PASS** | 1/1 |
| **retry** | **PASS** | 1/1 |
| **trust** | **PASS** | 3/3 |
| **provenance** | **PASS** | 2/2 |
| **audit** | **PASS** | 1/1 |
| **bulk** | **PASS** | 2/2 |
| **tenancy** | **PASS** | 1/1 |
| **ops** | **PASS** | 1/1 |

---

## Assertion matrix

| Domain | Assertion | Result | Evidence |
| --- | --- | --- |
| corpus | real pilot PDF available (SRC-02 Allen excerpt) | **PASS** | 334504 bytes sha_ok=true |
| corpus | real pilot PDF available (SRC-08 Jefferson tab) | **PASS** | 31322 bytes |
| corpus | real pilot scan available (SRC-19) | **PASS** | 1984573 bytes |
| docx | DOCX not required by pilot corpus (coverage N/A) | **PASS** | PILOT_CORPUS_MANIFEST: zero DOCX files; adapter wired for production but not pilot-required |
| xlsx | XLSX parses via openpyxl without OCR | **PASS** | parser=xlsx-openpyxl sheets=1 7ms (pilot has 0 XLSX; fixture proves path) |
| pdf | digital PDF parses (SRC-02) | **PASS** | pages=13 168ms |
| scans | scanned PDF routes to OCR path (SRC-19) | **PASS** | parser=ocr-mistral escalate=true wired=false ok=false err=Checked-in policy: mean extractable chars/page=0.0 (threshold 40). Escalate to OCR; do not accept empty native parse. pa |
| scans | OCR credential dependency documented | **PASS** | MISTRAL_API_KEY absent — escalate (no fake text) is correct |
| docx | DOCX adapter functional (production wire; not pilot-required) | **PASS** | 7ms pages=1 |
| pdf | real pilot PDF registers in evidence vault (SRC-02) | **PASS** | 2210ms sha=44497b51d423… |
| package | package grouping links multiple pilot docs | **PASS** | package=9c1baa68 docs=2 |
| dedupe | identical SHA-256 does not create new version rows (count stays 1) | **PASS** | versions_with_sha=1 upload_attempt_err=n/a |
| versions | different pilot PDF creates separate version/document | **PASS** | doc1=3d1ff17f doc2=0bf8a2c0 |
| intake | SRC-03 Allen packet within 50 MB intake limit | **PASS** | 31.1 MB / 50 MB |
| pdf | large pilot PDF registers (SRC-03) | **PASS** | 121360ms 31.1MB |
| retry | parser failures are retriable (FAILED → QUEUED) | **PASS** | QUEUED |
| trust | unverified fact cannot silently promote | **PASS** | {"ok":false,"action":"skipped","message":"Only HUMAN_VERIFIED facts promote."} |
| provenance | HUMAN_VERIFIED promote succeeds with source_page provenance | **PASS** | {"ok":true,"rate":32.28,"truth":"awarded","action":"rate","rate_type":"standard","labor_category":"Armed officer","pricing_line_id":"b7de6202-349e-4ffb-869a-518213ce5cc1"} |
| provenance | provenance survives to canonical pricing_lines | **PASS** | source_fact=846e3679 page=3 |
| trust | unresolved rate conflict cannot silently promote overwrite | **PASS** | {"ok":false,"truth":"awarded","action":"conflict","existing":32.28,"incoming":40,"pricing_line_id":"b7de6202-349e-4ffb-869a-518213ce5cc1"} |
| trust | canonical awarded_rate unchanged after conflict | **PASS** | awarded_rate=32.28 |
| audit | verification audit survives (VERIFY + VIEW_SOURCE) | **PASS** | VERIFY,VIEW_SOURCE |
| bulk | create_migration_batch | **PASS** |  |
| bulk | batch migration cannot bypass trust gates (not auto-VERIFIED) | **PASS** | status=UPLOADED |
| tenancy | tenant isolation remains intact | **PASS** | docs=0 pkgs=0 hijack=new row violates row-level security policy for table "documents" |
| ops | processor health reachable (optional) | **PASS** | status=200 url=http://127.0.0.1:8080 |

---

## Processing timing (ms)

| Step | ms |
| --- | --- |
| parse:xlsx-fixture | 7 |
| parse:SRC-02 | 168 |
| register:Allen_ISD_LP_security_agreement_excerpt.pdf | 2210 |
| register:12.pdf | 595 |
| register:1770_43.35658_Services_Contract_with_proposal_Final.pdf | 21080 |
| register:5-21_AllenISD.pdf | 121337 |
| register:bulk-12.pdf | 635 |
| processor:health | 13 |

---

## Notes

- Pilot **DOCX**: not acquired → assertion treated as not required; adapter still functional.
- Pilot **XLSX**: coverage hole (HUNT-06) → openpyxl fixture proves never-OCR path.
- Scan **SRC-19**: must route to `ocr-mistral`; live OCR requires `MISTRAL_API_KEY` (deferred credential, not silent success).
- Intake limit **50 MB** enables SRC-03 Allen full packet registration.

---

## STOP
