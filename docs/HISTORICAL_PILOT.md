# Historical Pilot (canonical Phase 2)

**Status: NOT STARTED as a scored corpus** — **0 / 20 packages ingested and human-verified.**  
A **public-records queue** is opened below. Do **not** wait for internal L&P Drive access to begin.

**Prerequisite for ingest into the app:** Foundation build green; Vercel/Supabase env; opportunity migrations applied. Tracker: [WORK_TRAIL.md](WORK_TRAIL.md). Queue detail: [pilot/PUBLIC_PACKAGE_QUEUE.md](pilot/PUBLIC_PACKAGE_QUEUE.md).

This phase validates the data model against **20–30 materially different real L&P procurement packages**.

**Start with public records. Supplement with internal L&P files later when access is available.**

See also: [BUILD_PLAN.md](BUILD_PLAN.md) (legacy engineering Phase 6), [ROUTING_POLICY.md](ROUTING_POLICY.md), [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md).

---

## Source policy (never guess)

| Grade | Meaning | May ingest as source file? | May promote to canonical? |
| --- | --- | --- | --- |
| **A — primary instrument** | Executed contract, PO, solicitation, official price list, board packet attachment we can download | Yes | Only after human VERIFY |
| **B — official award/listing** | Agency contract register, board agenda/minutes naming L&P, TxSmartBuy/GSA listing | Yes (the listing PDF/HTML) | Facts only as stated on that page; hunt the instrument |
| **C — press / secondary** | News, Scribd copies, aggregator pages | Keep as research notes only | **No** dollar/staffing facts |

News figures (Allen ~$694k, Wylie ~$534,170, Mesquite ~$1.9M) stay in notes until the **district packet or contract** is in hand.

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

Priority order for download + intake (not yet ingested):

| # | Buyer | Why it belongs | Grade now | Hunt next |
| --- | --- | --- | --- | --- |
| 1 | **Terrell ISD** 2025–26 Security Officer Services Agreement | Public executed contract: parties, license B06267001, POP 8/1/2025–7/31/2026, armed campus posts, **$29.35/hr** in the BoardBook text | **A** | Exhibits A/B (locations/hours), invoice/PO |
| 2 | **Terrell ISD** 2026–27 | BoardBook 2026-05-18 item: unarmed/armed services with L&P, NTE **$100,000**, ESR + contract attachments | **B** | Download those two attachments |
| 3 | **TXMAS vehicle** TXMAS-24-99003 | TxSmartBuy vendor list: Guard and Security Services through 8/29/2027 | **B** | Full TXMAS catalog / price pages |
| 4 | **GSA MAS** | HigherGov: MAS PoP 8/30/22–8/29/27, NAICS 561612. Number **47QSWA22D008W** reported on GSA contractor URL (eLibrary retrieve can fail) | **B** | SAM/eLibrary price list PDF |
| 5 | **Texas HHSC** HHS001540800001 | Official [contracts.hhs.texas.gov](https://contracts.hhs.texas.gov/) row: L&P GLOBAL SECURITY LLC, start **9/1/2024**, reason **TXMAS** | **B** | Posted contract PDF; Region 07 SOW |
| 6 | **Texas HHSC** 383549 | Same register: start **10/1/2025**, Statewide Contracting Authority | **B** | Instrument PDF |
| 7 | **Mesquite ISD** ~Aug 2023 | Official process described in contemporaneous reporting: RFP, 7 proposers, 2-year elementary armed posts. **Need board packet** | **C→A** | Swagit 2023-09-01 / Aug 2023 agenda attachments |
| 8 | **Allen ISD** 2023–24 | Board-approved armed coverage (17 campuses). Press ~$694k. Vendor list cites GSA `47QSWA22D008W` exp 8/29/2027 | **C / B** | Board packet + Thrillshare vendor PDF |
| 9 | **Wylie ISD** 2023–24 | Press: 13 officers + supervisor, ~$534,170. **Need district packet** | **C** | Board agenda/contract |
| 10 | **TxDMV PO #0000016167** | Cited as TXMAS-24-99003 PO. **Not confirmed** on TxDMV FTP this pass (no matching L&P PO found) | **unverified** | FTP `60800 0000016167.pdf` or Open Records |
| 11–12 | **Lancaster ISD 2025–26 / 2026–27** | Cited as L&P NTE $130k / $150k. **Not confirmed.** 2024–25 Lancaster BoardBook items name **Code 3 Security**, not L&P | **do not queue as L&P** until a primary names L&P | Confirm vendor on Diligent agendas |

Then keep filling to 20–30 with other ISD/city/state/federal/commercial public packets.

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
| 1 | Terrell ISD | 2025–26 security officer services | Win (public contract) | Contract text (BoardBook) | No | No | Queue #1; not in app yet |
| … | | | | | | | |

**L&P packages scored:** 0 / 20 minimum.

---

## Exit criteria (canonical Phase 2 complete)

- [ ] ≥20 packages ingested and **human-verified** (public + any internal)
- [ ] Production routing policy updated from **L&P evidence** (not fixtures only)
- [ ] Four-truth promotion proven on real pricing lines
- [ ] Eval scores for OCR/DOCX decision
- [ ] [PHASE6_ACCEPTANCE.md](PHASE6_ACCEPTANCE.md) corpus counts updated
- [ ] [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) — Phase 2 in progress / complete

---

## Out of scope

- Expanding Intelligence UX — **KEEP + FREEZE**
- Glide / Tiptap as Phase 8/9 complete
- Promoting news dollar amounts
- Fake or synthetic business rows

---

## After the pilot

Then expand canonical Phases 3–7 with confidence.
