# Historical Pilot (canonical Phase 2)

**Status: NOT STARTED** — 0 real L&P packages scored.  
**Prerequisite:** Foundation lint + typecheck + build green locally; Vercel env + opportunity migrations applied. Tracker: [WORK_TRAIL.md](WORK_TRAIL.md).

This phase validates the data model, extraction, verification, and promotion assumptions against **20–30 materially different complete L&P procurement packages** — not fixture files alone.

See also: [BUILD_PLAN.md](BUILD_PLAN.md) (legacy engineering Phase 6), [ROUTING_POLICY.md](ROUTING_POLICY.md), [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md).

---

## What counts as one package

A **complete procurement package** is tied to one buyer/agency + one opportunity and includes as many of these as exist for that pursuit:

- Solicitation (RFP / RFQ / IFB) + addenda / Q&A
- Proposal draft(s) and **final submitted** proposal
- Pricing workbook / schedule
- Award notice, bid tab, evaluator scorecard (if available)
- PO / executed contract / amendments / renewals (for wins)

Target cross-section:

| Dimension | Include |
| --- | --- |
| Outcomes | wins, losses, no-bid where available |
| Solicitation types | RFP, RFQ, IFB, short quotes |
| Sectors | government, ISD, county/municipal/state/federal, commercial |
| Formats | DOCX, XLSX, clean PDF, scans, complex tables/forms |

**Minimum:** ~20–30 packages, ~30–50 individual documents total.

---

## Pilot workflow (use existing app — no new features)

For each package:

1. **Register** — intake or bulk ingest; assign buyer + opportunity; checksum + version.
2. **Process** — Workflow parse → extract → stage (`AI_EXTRACTED`).
3. **Verify** — verification workbench; human VERIFY/EDIT/REJECT with source page.
4. **Promote** — canonical promotion; confirm four truths do not overwrite.
5. **Score** — run processor eval harness; record in [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md).

Commands:

```bash
npm run test:phase3-intake      # after each intake pattern
npm run test:phase6-benchmark   # routing regression
cd services/processor && pytest && python -m lp_processor.evals.harness
```

---

## Package manifest (fill as packages are ingested)

| # | Buyer / agency | Opportunity | Outcome | Doc types present | Verified | Scored | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | |
| … | | | | | | | |

**L&P packages scored:** 0 / 20 minimum.

---

## Exit criteria (canonical Phase 2 complete)

- [ ] ≥20 complete packages ingested and **human-verified**
- [ ] Production routing policy updated from **L&P evidence** (not fixtures only)
- [ ] Four-truth promotion proven on real pricing lines (requested ≠ proposed ≠ awarded ≠ current)
- [ ] Eval scores checked in for OCR/DOCX decision (wire only if pilot justifies cost)
- [ ] [PHASE6_ACCEPTANCE.md](PHASE6_ACCEPTANCE.md) honest corpus section updated with real counts
- [ ] [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) updated — Phase 2 → in progress / complete

---

## Out of scope for this phase

- Expanding Intelligence UX (Ask, Market, Reports) — **KEEP + FREEZE**
- Glide pricing workbench, Tiptap proposal builder (the existing opportunity **workspace tabs** are allowed; do not treat them as Phase 8/9 complete)
- Full corpus bulk migration (canonical Phase 4)
- Fake or synthetic business data in production tables

---

## After the pilot

Only then expand canonical Phases 3–7 with confidence: broader migration, contracts validation, and thawing frozen Intelligence surfaces.
