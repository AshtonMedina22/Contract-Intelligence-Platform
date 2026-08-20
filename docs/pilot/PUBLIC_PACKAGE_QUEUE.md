# Public L&P package queue

Working list for canonical Phase 2. **Not ingested. Not verified in-app. 0 packages through intake → staging → verification → canonical promotion.**  
Policy: [HISTORICAL_PILOT.md](../HISTORICAL_PILOT.md).

**Rule:** prefer packets with structured facts (rates, scores, PO lines, contract numbers, proposal sections, eval scores) over minutes that only say “approved.”

Do not copy dollar amounts from this file into Postgres. Promote only from a human-verified source page.

## Live schema vs end-state domain concepts

For the pilot, map every fact onto the **current live schema** first:

| Live table / mechanism | What the packet should produce after VERIFY |
| --- | --- |
| `documents`, `document_versions`, `extracted_facts`, `source_evidence`, `verification_events` | Every value tied to a PDF page |
| `clients`, `opportunities` | Buyer + pursuit |
| `pricing_lines` | Hourly / line rates (four truths; only fill the truth the doc supports) |
| `contracts`, `awards` | Number, title, dates, award notice |
| `staffing_requirements` | Posts / hours when the instrument lists them |
| `evaluation_criteria` | Criteria + max points / weights from the RFP/eval report |
| `competitors`, `competitor_bids`, `win_loss_reviews` | Named rivals, scores/amounts in `note` if no bid $ |
| `research_facts` | Secondary listings (HigherGov, vendor registers) until primary SAM/eLibrary |
| Opportunity `procurement_rail` / `vehicle_ref` | TXMAS / GSA numbers as stated on the page |

Concepts such as `proposal_sections`, `purchase_orders`, invoice/payment evidence, `evaluation_scores`, and federal identifiers (NAICS/PSC/UEI/CAGE) are **canonical end-state domain entities** in [DATA_ARCHITECTURE.md](../DATA_ARCHITECTURE.md) — not fabricated data. They are **not all live tables today**. During the pilot:

1. Stage those facts on live tables (`extracted_facts` + `source_evidence`, etc.).
2. Record each unsupported concept as a **schema-gap finding**.
3. Do **not** add migrations until the verified corpus proves the gap.

**Known schema-gap findings these packets will surface:**

- Proposal section structure / TOC (Williamson) — stage as facts; gap = section library.
- Invoice / disbursement association (Williamson funding reports) — stage as facts; gap = payments/financial evidence model.
- PO as first-class instrument (TxDMV) — stage as `documents` + `contracts.contract_number`; gap = purchase_orders.
- NAICS / PSC / UEI / CAGE (GSA) — stage as facts / research; gap = federal_identifiers.
- Per-vendor evaluation scorecards (Arlington) — `evaluation_criteria` has weights only; scores on `competitor_bids.note` until a scorecard table is justified.
- Outcome beyond won/lost (Jefferson all-bids-rejected) — confirm `OpportunityOutcome` covers `ALL_BIDS_REJECTED` / no award.

## First wave (Grade A / B ready for ingest)

| ID | Buyer | Proven on primary | Grade | Source file / URL |
| --- | --- | --- | --- | --- |
| **P01** | **Williamson County** | **19-page Services Contract with Proposal** (public). Proposal dated **November 7, 2024**; sections include Transmittal / Executive Summary / Emergency Action Plan / Pricing / Summary; **Unarmed Security Officer $31.45/hr**; **Golf Cart $500/month**; GSA **47QSWA22D008W**; TXMAS **TXMAS-24-99003**. Later award: Contract **#202569**, Lake Creek Annex, NTE **$300,000**, TXMAS 24-99003 (minutes). Funding reports associate disbursements to **202569**. Tests proposal content + pricing + award + contract association + payment **facts** + attribution (historical-performance language). | **A** | Local: `Downloads/1770_43.35658_Services_Contract_with_proposal_Final.pdf`. Public: https://public.destinyhosted.com/wilcomindocs/2024/COM/20241126_1872/1770_43.35658_Services_Contract_with_proposal_Final.pdf. Minutes: https://public.destinyhosted.com/wilcomindocs/2024/COM/20241210_1874/1771_11-26-2024_Commissioners_Court_Minutes.pdf |
| **P01b** | Williamson (same POP) | Disbursements tied to **202569** / Lake Creek (e.g. **$23,133.99** + **$500.00**; **$23,398.80** + **$274.19**; **$23,304.45** + **$500.00**). Map to live facts; record **payments** as schema-gap. | **B** | Funding report PDFs on DestinyHosted (see WORK_TRAIL / prior fetch notes) |
| **P02** | **Allen ISD** | Embedded security agreement: **$32.28 per hour per officer** (actual production hours); term **08/01/2024–07/31/2025**; **thirty (30) days** written notice. Board record also cites approved probable cost **$584,138** for 2024–25 (promote only from that page after VERIFY). Full packet is **~31 MB** — exceeds Phase 3 **25 MB** intake limit; use contract-page excerpt or raise limit before ingest. | **A** | Local: `Downloads/5-21_AllenISD.pdf`. Public: https://swagit-attachments.granicus.com/uploads/video/agenda_file/306017/5-21_AllenISD.pdf |
| **P03** | **City of Arlington** | **RFP 22-0143** bid invitation (~35 pp) + staff eval/award report (3 pp). L&P **loss**: Operational **41.48/55**, Price/Refs/Staff **29.00/45**, total **70.48**. Winner **Vets Securing America**: **50.00 / 40.46 / 90.46**, estimated award **$960,343**. Nine respondents; documented criteria only — do not invent “lost on price.” | **A** | Local: `Downloads/22-0143-bid-invitation.pdf`, `Downloads/22-0143-staff-report.pdf`. Staff report: https://www.arlingtontx.gov/files/assets/city/v/1/finance/documents/financial-transparency/contracts-and-procurement/bid-documents/goods-and-services/2022/22-0143-staff-report.pdf |
| **P04** | **TxDMV** | PO **0000016167**; vendor L&P GLOBAL SECURITY, LLC; **TXMAS-24-99003**; PO date **06/23/2025**; PO end **08/31/2025**; service term **06/30/2025–07/11/2025**; NET30; Dallas North RSC ship-to. **Armed Security Guard = 72 HR × $33.25 = $2,394.00**; separate **Extended Hours** line = **$445.55**; **Total PO = $2,839.55**. | **A** | Local: `Downloads/60800 0000016167.pdf`. Public: https://ftp.txdmv.gov/pub/txdmv-info/fas/contract_reporting/60800%200000016167.pdf |
| **P05** | **Jefferson County** IFB **18-009/YS** | Bid tab: L&P **$18.75/hr** among competitors (Blackstone $14.97, Janissary $16.52, Allied $19.31, …). Listing: **all bids rejected**. Tests competitor pricing + outcome ≠ won/lost only. | **A** (tab) / **B** (outcome listing) | Local tab: `Downloads/12.pdf`. IFB: https://jeffersoncountytx.gov/Purchasing/Bid_Notices/20180430_IFB18-009YS_SecurityPersonnelServices.pdf |
| **P06** | **Texas Lottery** IFB **RQ22-0480DP** | **149-page** security IFB: forms, cost sheet, references (≥5), HUB, scoring matrix, submission rules. L&P appears on vendor distribution data in package — **not verified that L&P submitted a bid**. Use to discover required-form / reference fields as schema-gap findings. | **A** (solicitation) | Local: `Downloads/IFB_for_Security_Officer_Services_RQ22-0480DP_FINAL.pdf`. Public: https://www.texaslottery.com/export/sites/lottery/Documents/procurement/IFB_for_Security_Officer_Services_RQ22-0480DP_FINAL.pdf |
| **P07** | GSA MAS **47QSWA22D008W** | HigherGov: NAICS 561612, PSC S206, UEI/CAGE, PoP; cancellation note Nov 2025 — confirm on SAM/eLibrary before treating as active. | **B** | https://www.highergov.com/idv/47QSWA22D008W/ |

## Still useful after first wave

| ID | Buyer | Notes | Grade |
| --- | --- | --- | --- |
| **P08** | Terrell ISD 2025–26 | BoardBook contract: B06267001, POP 8/1/2025–7/31/2026, **$29.35/hr** | **A** |
| **P09** | Terrell ISD 2026–27 | BoardBook NTE $100,000 + attachments | **B** |
| **P10** | TxSmartBuy / HHSC | TXMAS-24-99003 listing; HHSC register rows | **B** |

## Hold / Grade C

| Item | Why |
| --- | --- |
| Lancaster ISD as L&P | 2024–25 BoardBook named **Code 3**, not L&P |
| Mesquite / Wylie / Allen **press-only** dollars | Grade C until district packet page is verified |
| Inventing loss reasons for Arlington | Only store documented scores/award facts |

## Source files ready for ingestion (local Downloads)

| File | Package | Intake note |
| --- | --- | --- |
| `1770_43.35658_Services_Contract_with_proposal_Final.pdf` | P01 Williamson | **Ready** (~4 MB, 19 pp) |
| `22-0143-bid-invitation.pdf` | P03 Arlington solicitation | **Ready** (~0.3 MB, 35 pp) |
| `22-0143-staff-report.pdf` | P03 Arlington eval/award | **Ready** (~0.2 MB, 3 pp) |
| `60800 0000016167.pdf` | P04 TxDMV PO | **Ready** (~38 KB, 2 pp) |
| `12.pdf` | P05 Jefferson bid tab | **Ready** (~31 KB, 1 pp) |
| `IFB_for_Security_Officer_Services_RQ22-0480DP_FINAL.pdf` | P06 Texas Lottery IFB | **Ready** (~6 MB, 149 pp) |
| `5-21_AllenISD.pdf` | P02 Allen | **Blocked at 25 MB limit** (~32 MB) — extract contract pages or raise `MAX_INTAKE_BYTES` before intake |

**Ingested / verified / promoted:** **0**.

## Next download / prep (not blockers for Grade A list above)

1. Jefferson full IFB PDF if not already local.
2. Allen contract-page excerpt under 25 MB, or raise intake limit for pilot.
3. Official GSA eLibrary / SAM for 47QSWA22D008W.
4. One Williamson funding-report PDF into the same package as P01.
5. Do **not** promote HigherGov or press as canonical.
