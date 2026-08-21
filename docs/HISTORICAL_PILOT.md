# Historical Pilot (canonical Phase 2 — Real-Document Historical Pilot)

**Status: IN PROGRESS — 13 packages pilot-processed; 0 structured canonical promotion; gap report filed**  
(source preservation → extraction → staging → validation → human verification → canonical promotion).

A **public-records queue** is opened. Do **not** wait for internal L&P Drive access to begin.

**Prerequisite for ingest into the app:** Foundation build green; Vercel/Supabase env; processor for parse/extract. Tracker: [WORK_TRAIL.md](WORK_TRAIL.md). Queue: [pilot/PUBLIC_PACKAGE_QUEUE.md](pilot/PUBLIC_PACKAGE_QUEUE.md). Gap report target: `docs/benchmarks/PILOT_GAP_REPORT.md` (create when first packages run).

This phase validates the data model against **~20–30 materially different real procurement packages/doc sets**.

**Corpus strategy (Canonical Product Pack):**

- Start with verified **public L&P** records and actual L&P proposals/contracts/POs/evaluations where obtainable.
- Supplement with internal L&P files later.
- Use **non-L&P** security procurement documents only as explicitly labeled **TEST CORPUS** for missing document/schema types — never call them L&P history.

See also: [BUILD_PLAN.md](BUILD_PLAN.md), [FULL_PHASE_BUILD_PLAN.md](FULL_PHASE_BUILD_PLAN.md), [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md), [ROUTING_POLICY.md](ROUTING_POLICY.md).

---

## Source policy (never guess)

| Grade | Meaning | May ingest as source file? | May promote to canonical? |
| --- | --- | --- | --- |
| **A — primary instrument** | Executed contract, PO, solicitation, official price list, board packet attachment we can download | Yes | Only after human VERIFY |
| **B — official award/listing** | Agency contract register, board agenda/minutes naming L&P, TxSmartBuy/GSA listing | Yes (the listing PDF/HTML) | Facts only as stated on that page; hunt the instrument |
| **C — press / secondary** | News, Scribd copies, aggregator pages | Keep as research notes only | **No** dollar/staffing facts |

News / secondary figures stay in notes until the **district packet or contract** is in hand. Allen board packet cites probable cost **$584,138** for 2024–25 — promote only after VERIFY on that page.

---

## What counts as one package

Tied to one buyer/agency + one opportunity/POP, with as many of these as exist:

- Solicitation (RFP / RFQ / IFB) + addenda / Q&A
- Proposal draft(s) and **final submitted** proposal
- Pricing workbook / schedule
- Award notice, bid tab, evaluator scorecard
- PO / executed contract / amendments / renewals

A **public executed contract or PO alone** is a valid **first document** for a package. It is not a complete package until related solicitation/pricing/outcome docs are found or marked missing.

Target cross-section: wins and losses; RFP/RFQ/IFB/quotes/task orders; ISD / municipal / state / federal / commercial; PDF/DOCX/XLSX/scans.

**Minimum to complete Phase 2:** ~20–30 packages, ~30–50 documents, **human-verified**.

---

## First wave (assemble now)

**Start with lifecycle packets** (solicitation → proposal → evaluation → award/contract), not minutes that only say “approved.” Detail + URLs + local files: [pilot/PUBLIC_PACKAGE_QUEUE.md](pilot/PUBLIC_PACKAGE_QUEUE.md).

**Ingested / verified / promoted: 0.** Files may be downloaded locally and still count as 0 until they pass intake → staging → verification → canonical promotion.

Priority order (not yet ingested):

| # | Buyer | Why it belongs | Grade now | Prep / hunt |
| --- | --- | --- | --- | --- |
| 1 | **Williamson County** — **Services Contract with Proposal** (19 pp) + #202569 lifecycle | **Grade A primary found.** Proposal **November 7, 2024**; sections (Exec Summary, EAP, Pricing, …); **Unarmed $31.45/hr**; **Golf Cart $500/month**; GSA **47QSWA22D008W**; TXMAS **TXMAS-24-99003**. Award: #202569 Lake Creek Annex NTE **$300k**. Later disbursements cite 202569. Strongest first package for proposal + pricing + award + payment **facts** + attribution. | **A** | Ingest proposal/contract PDF first; attach minutes + one funding report as same package |
| 2 | **Allen ISD** security agreement in board packet | **$32.28/hr**, POP **8/1/2024–7/31/2025**, **30-day** termination; board probable cost **$584,138** (verify on packet page). | **A** | Full PDF 31.1 MB — **within the 50 MB intake limit and ingested**; the old "> 25 MB" note was stale |
| 3 | **Arlington RFP 22-0143** invitation + staff report | Bid invitation (~35 pp) + eval: L&P **70.48** vs Vets **90.46**, award **$960,343**. Documented criteria only — do not invent loss reason. | **A** | Both PDFs ready in Downloads |
| 4 | **TxDMV PO #0000016167** | **Armed Security Guard = 72 HR × $33.25 = $2,394.00**; separate **Extended Hours = $445.55**; **Total PO = $2,839.55**. TXMAS-24-99003; site/dates. | **A** | Ready |
| 5 | **Jefferson County IFB 18-009** + bid tab | Competitor hourly rates (L&P **$18.75/hr**); **all bids rejected** — outcome model stress test. | **A** / **B** | Tab ready (`12.pdf`); keep IFB URL |
| 6 | **Texas Lottery IFB RQ22-0480DP** (149 pp) | Monster solicitation: forms, cost sheet, ≥5 references, HUB, scoring. L&P on vendor list — **bid submission not verified**. | **A** (solicitation) | Ready; use for required-form schema-gap findings |
| 7 | **GSA MAS 47QSWA22D008W** | Identifiers via HigherGov; confirm status on SAM/eLibrary. Map to live facts; **federal_identifiers** = schema-gap. | **B** | Official eLibrary / SAM |
| 8 | **Terrell ISD** 2025–26 agreement | B06267001, POP 8/1/2025–7/31/2026, **$29.35/hr** | **A** | BoardBook download |
| 9–10 | Terrell 2026–27 / TXMAS / HHSC | Listings + NTE attachments | **B** | Posted PDFs |

**Do not start with:** Lancaster-as-L&P (unproven), or press-only Mesquite/Wylie dollar amounts.

Map pilot facts to the **current live schema** first. Treat `proposal_sections`, `payments`, `purchase_orders`, `federal_identifiers`, etc. as **proposed end-state domain entities** — record **schema-gap findings**; do not add migrations until the corpus proves need.

Then keep filling to 20–30 by missing instrument types (amendment, pricing workbook, evaluator scorecard, renewal, long RFP with L&P submission).

---

## Pilot workflow (existing app — no new product features)

For each **Grade A/B** file:

1. **Register** — intake; buyer + opportunity; checksum + version; set procurement rail (TX municipal / TXMAS / GSA).
2. **Process** — parse → extract → stage (`AI_EXTRACTED`).
3. **Verify** — VERIFY/EDIT/REJECT with source page. Do not promote press numbers.
4. **Promote** — four truths do not overwrite.
5. **Score** — [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md).

```bash
npm run test:phase3-intake
npm run test:phase6-benchmark
cd services/processor && pytest && python -m lp_processor.evals.harness
```

---

## Package manifest (ingest status)

| # | Buyer / agency | Opportunity | Outcome | Doc types present | Verified | Scored | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Williamson County | Lake Creek / #202569 | Win | **19-pp proposal+contract PDF found**; minutes; funding reports | Pilot (page_text) | No | P01 Grade A; SRC-01 through pipeline |
| 2 | Allen ISD | Security services 2024–25 | Win | Board packet w/ embedded contract (31.1 MB) | Pilot (page_text) | No | P02; SRC-03 ingests — 25MB block was stale |
| 3 | Arlington | RFP 22-0143 | **Loss** | Bid invitation + staff eval/award | Pilot (page_text) | No | P03; scores not structured |
| 4 | TxDMV | PO 0000016167 | Win (PO) | PO: 72×$33.25=$2,394 + Extended Hours $445.55 = **$2,839.55** total | Pilot (page_text) | No | P04 |
| 5 | Jefferson County | IFB 18-009/YS | All bids rejected | Bid tab (+ IFB) | Pilot (page_text) | No | P05 |
| 6 | Texas Lottery | RQ22-0480DP | Unknown (vendor list only) | 149-pp IFB | Pilot (page_text) | No | P06 |
| 7 | GSA | MAS 47QSWA22D008W | Vehicle listing | HigherGov | No | No | P07 |
| 8 | Terrell ISD | 2025–26 security officer services | Win | BoardBook contract text | No | No | P08 |
| … | | | | | | | |

**L&P packages ingested / scored:** **6 A/B packages through pilot pipeline (page_text only) / 0 structured scored** minimum.

---

## Exit criteria (canonical Phase 2 complete)

- [ ] ≥20 packages ingested and **human-verified** (public + any internal)
- [ ] Production routing policy updated from **L&P evidence** (not fixtures only)
- [ ] Four-truth promotion proven on real pricing lines
- [ ] Eval scores for OCR/DOCX decision
- [ ] [PHASE6_ACCEPTANCE.md](PHASE6_ACCEPTANCE.md) corpus counts updated
- [ ] [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) — Phase 2 in progress / complete

---

## Out of scope (this phase)

- Declaring later phases complete because early code/UI exists  
- Expanding Ask/Pricing AI/Response AI as finished product before gap report  
- Promoting news dollar amounts or unsourced summaries  
- Fake or synthetic business rows  
- Labeling non-L&P test-corpus docs as L&P history  

Canonical IA for later work: Home | Pursuits | Intelligence | Contracts | Data Ops ([UX_UI.md](UX_UI.md)).

---

## After the pilot

Then expand canonical Phases 3–8 with confidence per [BUILD_PLAN.md](BUILD_PLAN.md).
