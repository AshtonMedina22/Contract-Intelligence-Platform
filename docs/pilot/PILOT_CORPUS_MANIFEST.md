# Pilot corpus manifest (canonical Phase 2)

**Task:** Prompt 2A — usable source files only.  
**Date:** 2026-08-20  
**Ingested / verified / promoted in the app:** **17 files pilot-processed; VERIFY 2B fix pass = 7 A/B `pipelineComplete` (not 0 promotion)**  
**Schema changes this task:** none  
**Policy:** [HISTORICAL_PILOT.md](../HISTORICAL_PILOT.md)

A record is **USABLE** only if the **actual bytes** were opened on this machine (`%PDF` header + SHA-256).  
A **URL without a retrievable file is UNAVAILABLE and is not counted.**

## Classification (do not mix)

| Class | Meaning | Canonical use |
| --- | --- | --- |
| **A — L&P ORIGINATED** | L&P proposal, pricing, contract, PO, amendment, submission, or other L&P-originated instrument | L&P historical truth after VERIFY |
| **B — L&P-TIED PROCUREMENT EVIDENCE** | Buyer solicitation, evaluation, award, bid tab, board record, or contract evidence **directly tied to an L&P pursuit** | L&P-tied facts after VERIFY; **not** L&P-authored history |
| **C — COMPETITOR TEST CORPUS** | Real competitor contract, bid, pricing, amendment, renewal, or evaluation used to test schema/document coverage | **Test corpus only.** Never call this L&P history |

---

## Acquisition totals (countable)

| | Count |
| --- | --- |
| **USABLE source files (counted)** | **18** |
| UNAVAILABLE (not counted) | 6 hunt rows below |
| Distinct procurement packages with ≥1 usable file | **13** |
| Class A usable | **3** |
| Class B usable | **5** |
| Class C usable | **10** |
| XLSX / pricing workbook usable | **0** (coverage hole) |

Usable files live under `C:\Users\Ashto\Downloads\` unless noted. They are **not** copied into git (Allen full packet is ~32 MB). Repo copy: `docs/pilot/source-pdfs/Allen_ISD_LP_security_agreement_excerpt.pdf`.

---

## Diversity coverage (usable files only)

| Intended type | Covered by usable file? | Record |
| --- | --- | --- |
| L&P proposal / response | YES | SRC-01 Williamson 19-pp services contract **with proposal** |
| L&P bid / pricing | YES | SRC-01 pricing section; SRC-08 Jefferson tab (L&P hourly as **B**); SRC-04 TxDMV PO lines |
| L&P contract / PO | YES | SRC-01; SRC-02 excerpt + SRC-03 packet; SRC-04 PO |
| Buyer solicitation | YES | SRC-06 Arlington RFP; SRC-09 Lottery IFB |
| Evaluation / scorecard | YES | SRC-07 Arlington staff report (L&P vs VSA scores) |
| Multi-vendor bid tab | YES | SRC-08 Jefferson (B); SRC-10 Dallas 16-0219 (C); SRC-13 MHMR 25-003 (C) |
| Competitor cost build-up | YES | SRC-12 Tarrant 2018-092 |
| Executed competitor contract | YES | SRC-15 TFC 24-001-000; SRC-17 VA 19-264-R |
| Amendment | YES | SRC-16 TFC Amend 4; SRC-18 / SRC-19 VA amends |
| Renewal / option / CPI | YES | SRC-14 Harris 26-0534 (CPI-W) |
| Staffing / service-plan contract | YES | SRC-06 Arlington posts; SRC-15 TFC sites / Level II vs III |
| Government forms | YES | SRC-09 Lottery IFB (forms, HUB, references, cost sheet **inside PDF**) |
| Pricing workbook / XLSX | **NO** | No `.xlsx` acquired |
| Scanned / image-heavy PDF | YES | SRC-19 `19-264-RA3Final.pdf` (openable; text extract poor) |
| Frisco L&P bid tab | **NO — UNAVAILABLE** | See HUNT-01 |

---

## Counted source records

Checksums are SHA-256 of the local file. Intake filename is the local name to use at ingest.

### PKG-01 — Williamson County / Lake Creek Annex / Contract #202569

| Field | SRC-01 |
| --- | --- |
| Source organization | Williamson County, Texas (Commissioners Court / DestinyHosted) |
| Buyer | Williamson County |
| Contractor / vendor | L&P Global Security, LLC |
| Solicitation / contract ID | Contract **#202569**; TXMAS-24-99003; GSA 47QSWA22D008W (as stated on packet) |
| Source URL | https://public.destinyhosted.com/wilcomindocs/2024/COM/20241126_1872/1770_43.35658_Services_Contract_with_proposal_Final.pdf (**HTTP 200**, PDF) |
| Actual local / intake filename | `1770_43.35658_Services_Contract_with_proposal_Final.pdf` |
| Document type | Executed services contract **bound with L&P proposal** (19 pp) |
| Classification | **A** |
| Package | PKG-01 |
| Checksum | `0a3e3762d64da3cd074ed8fb1678528f499d18fc9fc75f2d86fca732040024fa` |
| Usable / openable | **YES** (4,169,850 bytes, `%PDF-1.7`) |
| Intended coverage | L&P proposal sections, submitted pricing, vehicle IDs, award/contract association |
| Notes | Strongest **A** packet. Buyer org confirmed by source URL / filename (`wilcomindocs` Williamson package), not by the word “Williamson” in extracted text. Full-doc extract confirms L&P, TXMAS, pricing. **Not ingested.** |

Minutes / funding-report URLs from the old queue were **not** re-acquired as files this session → not counted.

---

### PKG-02 — Allen ISD security services 2024–25

| Field | SRC-02 | SRC-03 |
| --- | --- | --- |
| Source organization | Allen ISD (board packet via Granicus) | same |
| Buyer | Allen ISD | Allen ISD |
| Contractor / vendor | L&P Global Security (agreement in packet) | same |
| Solicitation / contract ID | Security officer agreement; POP 08/01/2024–07/31/2025 (on agreement pages) | Board item 5-21 |
| Source URL | Derived from SRC-03 | https://swagit-attachments.granicus.com/uploads/video/agenda_file/306017/5-21_AllenISD.pdf (**HTTP 200**) |
| Actual local / intake filename | `docs/pilot/source-pdfs/Allen_ISD_LP_security_agreement_excerpt.pdf` | `5-21_AllenISD.pdf` |
| Document type | Executed agreement excerpt | Full board packet (agenda + attachments) |
| Classification | **A** | **B** (board record containing the A instrument) |
| Package | PKG-02 | PKG-02 |
| Checksum | `44497b51d423b4f282a58fb217caff64271ca7097a6317fa347a6c3019a2c658` | `2521a6b57c017ca2b735cc0ae7484ef957b0a2162592c9ec46965c7b514520de` |
| Usable / openable | **YES** (334,504 bytes) | **YES** (32,599,851 bytes, `%PDF-1.7`) |
| Intended coverage | Hourly rate, term, termination; board probable-cost page after VERIFY | Package grouping / board provenance |
| Notes | Full packet exceeds Phase 3 **25 MB** intake limit — use SRC-02 for ingest until the limit is raised. Duplicate Downloads copies `(1)` / `(2)` are the same packet; **not counted twice**. |

---

### PKG-03 — City of Arlington, TX RFP 22-0143 (L&P scored; VSA awarded)

| Field | SRC-06 | SRC-07 |
| --- | --- | --- |
| Source organization | City of Arlington, TX | City of Arlington, TX |
| Buyer | City of Arlington, TX | City of Arlington, TX |
| Contractor / vendor | Buyer solicitation (multi-respondent; **L&P not named in this PDF**) | L&P Global Security (scored); Vets Securing America (awarded) |
| Solicitation / contract ID | **RFP 22-0143** | 22-0143 staff report / minute order 09-27-2022 |
| Source URL | Official CDN **HTTP 403** this session | Official CDN **HTTP 403** this session |
| Actual local / intake filename | `22-0143-bid-invitation.pdf` | `22-0143-staff-report.pdf` |
| Document type | Buyer solicitation / addendum (staffing by building) | Evaluation / award staff report (scorecard) |
| Classification | **B** | **B** |
| Package | PKG-03 | PKG-03 |
| Checksum | `98efc54a7659afc29d12932559c9fbcb0e9a1844c9de45f77860bf6851a6127f` | `855ff7cd00d2f5d5cf1d5ceb7be177850e1a6e43cc99529c50a500fc7093490d` |
| Usable / openable | **YES** (290,544 bytes) | **YES** (165,355 bytes) |
| Intended coverage | Solicitation, posts/hours, eval weights | L&P vs VSA scores, estimated award $; **do not invent loss reason** |
| Notes | Local bytes are the originals. Public URL is **not** currently retrievable (403). **B** because this is the L&P-tied pursuit solicitation; L&P bid/scores are in SRC-07. |

---

### PKG-04 — TxDMV Purchase Order 0000016167

| Field | SRC-04 |
| --- | --- |
| Source organization | Texas Department of Motor Vehicles |
| Buyer | TxDMV |
| Contractor / vendor | L&P Global Security, LLC |
| Solicitation / contract ID | PO **0000016167**; **TXMAS-24-99003**; BU 60800 |
| Source URL | https://ftp.txdmv.gov/pub/txdmv-info/fas/contract_reporting/60800%200000016167.pdf (**HTTP 200**) |
| Actual local / intake filename | `60800 0000016167.pdf` |
| Document type | Purchase order (government form + line items) |
| Classification | **A** (L&P PO / awarded work instrument) |
| Package | PKG-04 |
| Checksum | `e1f3f631bdc5efa30b08a4201a08ef1977698ef7300a07c5534c6c4892704a0a` |
| Usable / openable | **YES** (38,345 bytes) |
| Intended coverage | PO as instrument; 72 HR × $33.25 and separate Extended Hours line; NET30; vehicle |
| Notes | Text extract confirms L&P / PO number. **Not ingested.** |

---

### PKG-05 — Jefferson County IFB 18-009/YS

| Field | SRC-08 |
| --- | --- |
| Source organization | Jefferson County, Texas Purchasing |
| Buyer | Jefferson County |
| Contractor / vendor | Multi-vendor tab including **L&P** (hourly) |
| Solicitation / contract ID | **IFB 18-009/YS** |
| Source URL | Tab: local only. IFB URL in old queue **HTTP 404** (see HUNT-02) |
| Actual local / intake filename | `12.pdf` |
| Document type | Multi-vendor bid tabulation (1 p) |
| Classification | **B** |
| Package | PKG-05 |
| Checksum | `72fbde263e5deae24c643042946ac013cab672c9365779652d8aab6c2ad976fd` |
| Usable / openable | **YES** (31,322 bytes) |
| Intended coverage | Competitor + L&P proposed hourly; outcome **all bids rejected** (listing — confirm on this page at VERIFY) |
| Notes | Filename is opaque; treat as Jefferson tab at ingest. Full IFB **not counted**. |

---

### PKG-06 — Texas Lottery IFB RQ22-0480DP

| Field | SRC-09 |
| --- | --- |
| Source organization | Texas Lottery Commission |
| Buyer | Texas Lottery Commission |
| Contractor / vendor | Buyer solicitation (**L&P submission not verified** in extracted PDF text) |
| Solicitation / contract ID | **RQ22-0480DP** |
| Source URL | https://www.texaslottery.com/export/sites/lottery/Documents/procurement/IFB_for_Security_Officer_Services_RQ22-0480DP_FINAL.pdf (**HTTP 200**) |
| Actual local / intake filename | `IFB_for_Security_Officer_Services_RQ22-0480DP_FINAL.pdf` |
| Document type | Buyer solicitation (149 pp) with forms / cost sheet / HUB / scoring |
| Classification | **B** |
| Package | PKG-06 |
| Checksum | `d0a7069266a158657dfb72d25d1ac72c1eab3eb534ae468f72be24688613bb40` |
| Usable / openable | **YES** (6,261,092 bytes) |
| Intended coverage | Government forms, required references, cost sheet **inside PDF** (not a standalone XLSX) |
| Notes | Do **not** treat as an L&P bid unless a submitted response file is acquired. |

---

### PKG-07 — Dallas County Bid 16-0219 (competitor tab)

| Field | SRC-10 |
| --- | --- |
| Source organization | Dallas County Purchasing |
| Buyer | Dallas County |
| Contractor / vendor | Multi-vendor (VSA and others). **L&P not in extracted tab text** |
| Solicitation / contract ID | **16-0219** |
| Source URL | Not re-fetched this session; local file is the original |
| Actual local / intake filename | `BID TAB 16-0219.PDF` |
| Document type | Multi-vendor bid tab (site × hours × unit × extended) |
| Classification | **C** |
| Package | PKG-07 |
| Checksum | `6a6e13e8151922c7fac8f7f126d4939c1b53c779430b20af6777c93b2f92c3a6` |
| Usable / openable | **YES** (23,687 bytes) |
| Intended coverage | Submitted competitor pricing; site-varying rates |
| Notes | **Not L&P history.** |

---

### PKG-08 — Dallas County Bid 2014-036 (competitor synopsis / pay vs bill)

| Field | SRC-11 |
| --- | --- |
| Source organization | Dallas County Purchasing |
| Buyer | Dallas County |
| Contractor / vendor | Vets Securing America (synopsis) |
| Solicitation / contract ID | **2014-036-6418** |
| Source URL | Local original |
| Actual local / intake filename | `2014-036-6418SecurityGuard.pdf` |
| Document type | Bid synopsis (pay vs bill, hours, headcount) |
| Classification | **C** |
| Package | PKG-08 |
| Checksum | `eebc7e7232a27e922ed4480d78a586f88c3b117bef146fa17aaa28ccdbc28962` |
| Usable / openable | **YES** (18,541 bytes) |
| Intended coverage | Pay vs bill; weekly hours |
| Notes | **Not L&P history.** |

---

### PKG-09 — Tarrant County 2018-092 (competitor cost build-up)

| Field | SRC-12 |
| --- | --- |
| Source organization | Tarrant County |
| Buyer | Tarrant County |
| Contractor / vendor | VSA primary (per packet); cost-stack rows |
| Solicitation / contract ID | **2018-092** Annual Contract for Security Guard Services |
| Source URL | Local original |
| Actual local / intake filename | `2018-092_AnnualContractforSecurityGuardServices.pdf` |
| Document type | Award rec + **cost build-up** (wage, FICA, WC, OH/profit → hourly) |
| Classification | **C** |
| Package | PKG-09 |
| Checksum | `8008be838b0502d6957c3cdec9c13991ea6e3fc76a005ff006eb9764169f1be6` |
| Usable / openable | **YES** (23,572 bytes) |
| Intended coverage | Competitor cost build-up / burden stack |
| Notes | **Not L&P history.** |

---

### PKG-10 — MHMR of Tarrant County 25-003 (competitor tab)

| Field | SRC-13 |
| --- | --- |
| Source organization | MHMR of Tarrant County |
| Buyer | MHMR Tarrant |
| Contractor / vendor | Multi-vendor tab; **VSA awarded** in packet; **L&P not in extracted tab text** |
| Solicitation / contract ID | **25-003** Security Guard Services |
| Source URL | Local original |
| Actual local / intake filename | `25-003-Security-Guard-Services-Tabulation.pdf` |
| Document type | Bid tabulation (std / OT / holiday; HUB; COI/W-9 flags) |
| Classification | **C** |
| Package | PKG-10 |
| Checksum | `5ebf4975b592d381f48a6f0623d703bbd2170bd35f0160b80ae6d18d2e2f7b45` |
| Usable / openable | **YES** (643,286 bytes) |
| Intended coverage | Rate trio; responsiveness flags |
| Notes | **Not L&P history.** |

---

### PKG-11 — Harris County Job 220401 / 26-0534 (competitor renewal + CPI)

| Field | SRC-14 |
| --- | --- |
| Source organization | Harris County Commissioners Court |
| Buyer | Harris County |
| Contractor / vendor | Vets Securing America |
| Solicitation / contract ID | Job **220401**; item **26-0534** |
| Source URL | Local original |
| Actual local / intake filename | `26-0534 Renewal Job No. 220401 - Vets Securing America.pdf` |
| Document type | Renewal agenda (option year, CPI-W, bond, amount) |
| Classification | **C** |
| Package | PKG-11 |
| Checksum | `21a3f215cf8bca032692fc3fd40cc522a12d07e62297a34aba9901b5c9692cdd` |
| Usable / openable | **YES** (80,083 bytes) |
| Intended coverage | Renewal / option / CPI escalation / current terms |
| Notes | **Not L&P history.** |

---

### PKG-12 — Texas Facilities Commission 24-001-000 (competitor executed contract + amendment)

| Field | SRC-15 | SRC-16 |
| --- | --- | --- |
| Source organization | Texas Facilities Commission | TFC |
| Buyer | TFC | TFC |
| Contractor / vendor | Vets Securing America, Inc. | VSA |
| Solicitation / contract ID | **24-001-000** | 24-001 Amend 4 |
| Source URL | Index: https://www.tfc.texas.gov/sb20/co-list.cfm?yr=2024 (listing). File bytes = local download | same listing |
| Actual local / intake filename | `Vets Securing 24-001-000 Redacted Original.pdf` | `VSA 24-001 Amend 4.pdf` |
| Document type | Executed competitor contract (redacted) | Amendment (NTE, option years, funding) |
| Classification | **C** | **C** |
| Package | PKG-12 | PKG-12 |
| Checksum | `8f80d1b9461174abcf2898e0d45d16e96c945051dadb6a3e1523ee9008cb0d4a` | `b91a8441f18f1a3f5409750acbed97c223194670cd5a39a1d1ff27cef575e0f4` |
| Usable / openable | **YES** (3,887,551 bytes) | **YES** (976,191 bytes) |
| Intended coverage | Staffing / sites / Level II vs III / current NTE | Amendment + option / current terms |
| Notes | **Not L&P history.** Official TFC “VIEW” links are portal-gated; **counted from local originals**. |

---

### PKG-13 — Arlington County, VA 19-264-R (competitor rider / amendments)

| Field | SRC-17 | SRC-18 | SRC-19 |
| --- | --- | --- | --- |
| Source organization | Arlington County, VA | same | same |
| Buyer | Arlington County, VA | same | same |
| Contractor / vendor | SOS Security LLC (Fairfax piggyback) | SOS | SOS |
| Solicitation / contract ID | **19-264-R** | Amend 2 | A3 Final |
| Source URL | Local originals | local | local |
| Actual local / intake filename | `Contract19-264-RFullyExecuted&NOA.pdf` | `19-264-RAmendment2signed.pdf` | `19-264-RA3Final.pdf` |
| Document type | Executed contract + NOA | Signed amendment | Signed amendment (image-heavy) |
| Classification | **C** | **C** | **C** |
| Package | PKG-13 | PKG-13 | PKG-13 |
| Checksum | `bb2658f90ec690cc005112c2447150d1622a208085d20e2a877d6588cb591fe6` | `831ece226849794a07c6ff64aead2e2d3f507b94b2593cf59d15e62f9fd95eeb` | `4f05f6ecdced56b8fa5eaccae5abba34ad32a06e0f22a61edc7591f6411b22c6` |
| Usable / openable | **YES** | **YES** | **YES** (1,984,573 bytes; scan / poor text) |
| Intended coverage | Rider/piggyback; commodity codes; PO gate | Amendment | Amendment (needs visual VERIFY) |
| Notes | **Not L&P history.** Non-L&P **test corpus** for missing instrument types. |

---

## UNAVAILABLE (not counted)

| ID | What was hunted | URL / location tried | Why unavailable |
| --- | --- | --- | --- |
| **HUNT-01** | **City of Frisco L&P security-guard bid tab** (user-priority) | Bonfire portal https://friscotexas.bonfirehub.com/portal/ (JS shell only, no file); Frisco DocumentCenter bid tabs retrieved were **custodial / fire / PPE / CMAR**, not L&P; GovCB notice for **2509-115** Security Guard Services (due 2025-09-29) has **no downloadable tab**; **no matching file in Downloads** | **UNAVAILABLE.** Do not count. Do not treat aggregator notices as a tab. |
| **HUNT-02** | Jefferson County full IFB 18-009/YS | https://jeffersoncountytx.gov/Purchasing/Bid_Notices/20180430_IFB18-009YS_SecurityPersonnelServices.pdf | **HTTP 404** |
| **HUNT-03** | Arlington TX 22-0143 **remote** re-download | arlingtontx.gov finance CDN paths | **HTTP 403** (local copies still counted above) |
| **HUNT-04** | Official GSA eLibrary / SAM file for **47QSWA22D008W** | HigherGov HTML **200** is an aggregator page, not saved instrument bytes | **UNAVAILABLE** as a source file. Do not promote HigherGov dollars. |
| **HUNT-05** | Terrell ISD 2025–26 BoardBook contract PDF | Listed in old queue; **no local file this session** | **UNAVAILABLE** |
| **HUNT-06** | Standalone **XLSX pricing workbook** | Downloads since 2026-08-19: PDFs only | **UNAVAILABLE** — coverage hole for “pricing workbook/XLSX” |

---

## What this corpus is allowed to prove later (Prompt 2B+)

- **A/B usable set** is enough to start **L&P-tied** ingest (Williamson, Allen excerpt, TxDMV, Arlington local pair, Jefferson tab, Lottery IFB).
- **C set** is for schema/workflow stress: cost build, CPI renewal, executed competitor contract, amendments, site-varying tabs, scan OCR.
- **Frisco bid tab is not in the countable corpus** until a real PDF/XLSX is on disk and opens.

**Next (not this prompt):** Prompt 2B ingest/process/verify against this manifest — still **0 through pipeline** today.
