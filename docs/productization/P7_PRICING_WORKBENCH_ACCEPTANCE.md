# P7 Pricing Workbench Polish — Acceptance

**Date:** 2026-08-21
**Status:** IMPLEMENTED — verified in the browser against the live operator org on PKG-03 Arlington TX.
No schema change. No new dependency. No migration. **Pricing domain logic, the four/five commercial
truths, and the human final gate were not rewritten.**

## What changed

The Pursuit → Pricing tab already held the five truths and the human final bid, but the Glide grid was
an undifferentiated wall of numbers: no column banding, no frozen identifiers, bare `67.34` values, a
source column you could see but not act on, and no statement anywhere of how many lines actually
carried each truth. The panels around it were equally quiet — comparables showed two rates and a
reason box, ranges showed a label with no sample size, and the final bid header was a normal-weight
sentence.

It is now a dense read-first workbench where **every number states which truth it is, how strong the
evidence behind it is, and which human path can change it.**

| Area | Before | After |
| --- | --- | --- |
| Grid columns | flat list, identifiers scroll away | `freezeColumns` pins `labor_category · site_or_post · unit`; Glide **group headers** name each truth |
| Truth identity | five similar numeric columns | per-truth **colour banding** on cell and header, drawn from one tint map shared with the HTML legend |
| Rates | `67.34` | `$67.34` via `Intl.NumberFormat` currency; a missing rate stays `—` and never becomes `0.00` |
| Coverage | unstated | sticky legend on the workbench **and** the grid: `Buyer awarded 8/8`, `Buyer requested 0/8`, … |
| Source cells | visible URI text | click opens `/ingestion/verification/<documentId>` for that fact |
| Rate cells | inert | click opens a provenance **Sheet**: rate, provenance, "how this changes", editable-in-grid = No, source fact id, View source document, and for internal cost an **Open cost model for \<category\>** jump |
| Selection | single cell | row markers + checkboxes, `rowSelect="multi"`, `rangeSelect="multi-rect"`, `copyHeaders`, and a live `N row(s) selected · Ctrl/Cmd+C copies` readout |
| Theme | Glide defaults | shadcn tokens resolved to concrete RGB and re-read when the theme class flips |
| Comparables | pursuit, category, proposed, awarded, reason | status badge, source pursuit + buyer, why-comparable (`match_basis` + service type), grain (rate type · unit · site), three rates, **which truths are sourced**, **recency**, and the judgment form |
| Ranges | `label` only | min–max, median, avg, a range bar **only** at n ≥ 3, and `n=… included verified rate(s)` on every card including the empty one |
| Final bid | `Final bid price — human decision required` | `FINAL PRICE — HUMAN DECISION REQUIRED` + a `No AI approval path` badge, sample count on the observed range, and client-side amount validation |
| Cost model | 12 `type=number` inputs, no feedback | shared validation per field, `aria-invalid`, submit disabled while invalid, and a save-status indicator (`No unsaved changes` / `Saving…` / `Saved 3:41:07 AM` / error) |
| Buyer format | static "Structures supported: …" list | observed labor categories / units / rate types / sites read off the promoted lines, observed vs **supported-but-not-observed** structures, and quantity / extended-amount coverage |
| Overview snapshot | four hand-written columns | the same five truth columns, labels, legend colours and currency formatter as the workbench |

---

## Trust rules — preserved, and two made harder to break

Nothing in P7 loosens a Phase 7 rule. `promote_pricing_fact`, `saveCostModel`,
`saveComparableJudgment`, `savePricingDecision`, the `pricing_decisions` trigger, and
`summarizeComparableRates` are unchanged in behaviour.

| Rule | How P7 keeps it |
| --- | --- |
| Five truths never collapse | `PRICING_TRUTH_COLUMNS` is the single definition. The grid, the workbench header, the overview snapshot and the acceptance script all map over it, and the grid **throws** if the frozen identifier count stops matching the leading columns. A truth with zero coverage still renders its column and says `0/8`. |
| `saveCostModel` → `internal_cost_rate` only | Unchanged action. The grid now *routes* to it: internal cost is the one truth whose provenance is `PLANNING_COST_MODEL`, its sheet says "Internal cost model below — `saveCostModel` is the only writer", and the jump link expands that category's editor. |
| Comparable judgment needs a reason | DB constraint + server trim are untouched; the UI now rejects a **whitespace-only** reason in the browser instead of firing a request that the action would throw on. |
| Human final gate | Save draft and Human-approve remain two separate explicit submits (`approve=""` vs `approve="1"`). Client validation can only *block* a submit; it never approves. |
| Competitor lines stay out | Untouched. P7 added no writer to `pricing_lines` at all. |
| Ranges from included comps only | Untouched `summarizeComparableRates(…, onlyIncluded)`. `rangeBarModel` is a pure display wrapper that refuses to draw below n = 3. |

### The grid writes nothing — deliberately

The brief allowed a minimal `onCellEdited` wired to existing safe actions. There is no safe action to
wire it to:

- `requested` / `proposed` / `awarded` / `current` are canonical only because a human verified a
  document and promoted a fact. A grid edit would create a rate with no `source_fact_id` — exactly what
  the `pricing_lines_truth_requires_verified_fact` trigger exists to reject.
- `internal_cost_rate` **is** writable by a human, but `saveCostModel` derives it from a cost build-up
  per labor category (`base_wage`, fringe, H&W, burden, workers comp, insurance, supervision,
  equipment, vehicles, travel, overhead, target margin). Typing a number into one line's cell would
  write a cost floor that no build-up supports.

So the grid declares **no** `onCellEdited`, sets `onPaste={false}`, marks every cell `readonly`, shows a
`Read-only` badge, and each truth carries an `editPath` string that names the only human route that can
change it. `isGridEditableTruth()` returns false for all five and the acceptance script asserts it.
That is a deliberate product decision, not an omission — it is recorded in the honest limitations below.

---

## Architecture

### `apps/web/lib/opportunity/pricing-grid-model.ts` (new, pure)

No React, no Supabase, no canvas — so the acceptance script bundles and exercises the real module.

| Export | Contract |
| --- | --- |
| `PRICING_TRUTH_COLUMNS` | The five truths in operator reading order, each with `label`, `rateKey`, `factKey` (null for internal cost), `provenance`, `editPath`, `gridEditable: false`. |
| `truthRate` / `truthFactId` / `truthCoverage` / `truthColumn` | The only readers used by the grid, the header and the overview snapshot. |
| `PRICING_IDENTIFIER_COLUMN_IDS`, `PRICING_FREEZE_COLUMNS` | Pinned grain, and the count Glide freezes. |
| `formatCurrency` / `formatQuantity` / `EMPTY_CELL` | Currency and quantity display; absent stays `—`. |
| `parseRateInput` | Shared hand-typed-rate validation: accepts `$`, thousands separators and blanks; rejects text, negatives and 3+ decimals. **Blank stays `null`, never `0`** — zero is a claim. |
| `observeLineGrains` | Labor categories / rate types / units / sites, quantity and extended coverage, and canonical structure hints split into **observed** vs **unobserved**. |
| `MIN_COMPARABLE_SAMPLE_FOR_CHART`, `rangeBarModel`, `sampleCountLabel`, `recencyLabel` | Range-bar suppression below n = 3, honest `n=…` copy, and relative age for weighing a comparable. |
| `hslTripletToRgb`, `rgbToHex`, `blendRgb`, `PRICING_TRUTH_TINTS`, `PRICING_TRUTH_LEGEND_CLASS` | Canvas colouring, and the Tailwind classes that keep the HTML legend matching the canvas banding. |

### `pricing-glide-grid.tsx` (adapted)

`DataEditor` with `freezeColumns`, group headers per truth, `themeOverride` per column for banding,
`rowMarkers="both"`, `rowSelect="multi"`, `rangeSelect="multi-rect"`, `copyHeaders`,
`getCellsForSelection`, `onPaste={false}`, row hover theming, and 30 px dense rows. `onCellClicked`
opens the provenance sheet; source cells are `GridCellKind.Uri` with `onClickUri` navigating to
verification.

**Theming:** Glide paints on a canvas, so `hsl(var(--muted))` never resolves. `usePalette` reads the
shadcn HSL triplets with `getComputedStyle`, converts them to RGB, pre-blends the per-truth tints into
opaque hex (canvas alpha over painted cells is unreliable), and re-resolves under a `MutationObserver`
on `documentElement`'s `class`/`style` so light/dark switches repaint correctly.

### The other four surfaces

- `pricing-workbench.tsx` — sticky header (line/category/included-comparable counts, per-truth coverage
  legend, `Final bid = human decision` badge), the new `BuyerFormatSection`, cost-model validation and
  save status, and `jumpToCostModel` scrolling to and expanding one category.
- `pricing-comparables.tsx` — dense ten-column table, `RangeCard` per truth, whitespace-reason guard.
- `final-bid-panel.tsx` — the explicit human-decision heading, badge, sample count, amount validation.
- `four-truths-table.tsx` — now derived from `PRICING_TRUTH_COLUMNS`, so the overview snapshot shows
  internal cost (labelled `planning`, no fact link) and formats rates the same way the grid does.

### `lib/opportunity/types.ts` + `comparables.ts` (extended)

`PricingComparableRow` gained `rate_type`, `unit`, `site_or_post`, the `requested`/`awarded`/`current`
source-fact ids, and `updated_at`; `loadPricingComparables` selects them. Read-only additions to an
existing loader — no new table, no new write path.

---

## Tests

| Check | Result |
| --- | --- |
| `npm run test:p7-pricing-workbench` (new, 35 checks) | **PASS 35/35** |
| `npm run test:phase7-four-truth` | **PASS 10/10** |
| `npm run test:phase7-pricing` | **12/13** — one pre-existing failure, proven below |
| `npm run test:verify7` | **19/22** — three pre-existing failures, proven below |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** — the Pricing route still emits as Partial Prerender |

`scripts/p7-pricing-workbench-acceptance.mjs` bundles the real `pricing-grid-model.ts`,
`pricing-math.ts` and `types.ts` with esbuild (already a dependency) so it exercises the shipped code
with no network and no database, then greps the five components and `actions.ts` to assert the UI is
wired to the model rather than re-deciding rules locally. The 35 checks cover: five distinct truths and
their distinct labels/rate columns/fact columns/legend colours; a five-different-rates line reading back
as five different truths; every column rendering at zero coverage; no truth editable and no
`onCellEdited`/`onPaste` in the grid at all; pinned identifiers leading the column order; source-click
and provenance-sheet wiring; multi-row selection and copy; banding from the shared tint map; canvas
colours resolved from tokens rather than left as `hsl(var(--x))`; currency formatting and the dash for
absent; `parseRateInput` accepting `$`/separators and rejecting text, negatives and 3-decimal input;
reason-required in both UI and action; comparable source/why/verification/recency; ranges from included
rows only; a sample count on every readout; no bar below n = 3; a degenerate min = max range not dividing
by zero; the human-only approval path in UI, action and trigger; `saveCostModel` writing
`internal_cost_rate` and never `proposed_rate`; buyer-format hints coming only from real grains; and
overview/workbench parity.

### Pre-existing failures (not caused by P7) — proven on a clean `HEAD` worktree

`test:verify7` and `test:phase7-pricing` were re-run from a detached `git worktree` at `HEAD`
(`c3eeb8f`, P7 absent) with the same env file. The results were **identical**, same checks, same
messages:

| Suite | At `HEAD` | With P7 |
| --- | --- | --- |
| `verify7` | 19/22 FAIL | 19/22 FAIL |
| `phase7-pricing` | 12/13 | 12/13 |

Root causes, neither of which P7 touches (`git diff HEAD --name-only` includes no
`supabase/migrations/` and no `scripts/` change):

1. **`[fatal] Cannot read properties of null` and `[periods] Base / options / escalation`** — both
   suites insert `pricing_lines` rows carrying `awarded_rate` with no `awarded_source_fact_id`. The
   trigger from commit `259fd9f` *Ship trust gates, lasting operator access, and honest pilot trail*
   (`20260821120000_trust_append_only_and_sourced_truth.sql`, an ancestor of `HEAD`) rejects that:
   `pricing_lines.awarded_rate requires HUMAN_VERIFIED awarded_source_fact_id`. The insert returns
   `null`, and the next line dereferences `.id`. **The trigger is right and the fixtures are stale.**
2. **`[human] Final bid UI requires explicit human action`** — the check greps `actions.ts` for
   `decided_by: approve ? user.id`, but that line became `decided_by: approve ? userId : null` in
   commit `c1747dd`. The rule it is testing still holds; the grep is stale. P7's panel independently
   satisfies the other three clauses of the same check (`human decision required`, `approve`, `AI and
   automation never approve`).

`docs/pilot/VERIFY7_ACCEPTANCE.md` and `docs/benchmarks/verify7-results.json` are regenerated on every
`test:verify7` run. They were **restored to `HEAD`** rather than carried in this change: the committed
copies claim 29/29 PASS, and overwriting them here would silently attribute a pre-existing
trigger-vs-fixture drift to P7. **The committed VERIFY 7 PASS is stale and should be re-earned by
fixing those fixtures — that is a separate task, recorded in `WORK_TRAIL`.**

---

## Browser verification (IronBee DevTools, `localhost:3000`, live operator org)

**PKG-03 Arlington TX** (`b937b54c-70d5-468e-97cf-803d2a69e5a9`) — 8 promoted pricing lines, 26
comparable rows, 0 included.

### The grid

- Sticky header: `8 verified lines · 8 labor categories · 0 included comparable(s)` +
  `Final bid = human decision`.
- Coverage legend, colour-chipped: `Buyer requested 0/8 · L&P internal cost 0/8 · L&P submitted 0/8 ·
  Buyer awarded 8/8 · Current/amended 0/8`. **The four empty truths still render their columns** —
  which is the rule this task existed to protect.
- Group headers read `Buyer requested | L&P internal cost | L&P submitted | Buyer awarded |
  Current/amended`, each over a `Rate ($)` + `Source` pair, with visible per-truth banding.
- `Labor category · Site / post · Unit` stayed pinned while the truths scrolled.
- Awarded rates rendered `$67.34`, `$63.89`, `$40.60`, … ; every empty truth cell rendered `—`.

### Click behaviour

| Action | Result |
| --- | --- |
| Click an awarded **rate** cell | Sheet: *Buyer awarded* / `Security Engineers, Inc. · page 2`, rate `$67.34`, provenance *Promoted from a HUMAN_VERIFIED extracted fact*, how-this-changes *Verify the award document, then promote it. Never typed here.*, **Editable in grid: No**, source fact `0dec3c9e-…`, and a working **View source document** link |
| Click an awarded **Source** cell | navigated to `/ingestion/verification/3ad07085-ed3e-481b-b252-855e0164cbfd` |
| Click row marker, shift-click the next | `2 row(s) selected · Ctrl/Cmd+C copies` |

### Honesty of the panels

- **Comparables:** each row showed the source pursuit + buyer, why-comparable, grain, three currency
  rates, which truths were sourced, and recency. All three range cards read
  `n=0 — no included verified rate` with **no bar drawn** — correct, since nothing is included yet.
- **Blank reason:** submitting a whitespace-only reason produced
  *"A reason is required — include/exclude is a recorded human judgment."*, marked the field
  `aria-invalid`, and **sent no request** (counts stayed 0 included / 26 excluded).
- **Cost model:** typing `31.555` into `base_wage` produced *"Use at most two decimal places"*,
  disabled **Save cost model**, and showed *"Fix the highlighted fields to save."* while the status
  stayed `No unsaved changes`. Clearing the field re-enabled the button.
- **Final bid:** heading `FINAL PRICE — HUMAN DECISION REQUIRED` with the `No AI approval path` badge,
  observed range `n=0 — no included verified rate`, and both submits still separate.
- **Buyer format (observed):** *"Read from the 8 promoted line grains on this pursuit. No requested
  cell is invented for a structure with no verified line."* — 8 labor categories, rate type
  `standard`, sites `page 1 · page 2`, observed `labor category · site/post/shift`, and an explicit
  **supported-but-not-observed** list (hourly, component build-up, daily/weekly/monthly/annual, fixed
  fee, NTE, base/options, escalation, OT, holiday, vehicles/equipment, travel/reimbursables).
- **Overview snapshot:** same five columns, `planning` under internal cost, awarded rates linking to
  the same verification document, plus **Open pricing workbench →**.

### Writes and console

**No write was performed.** Every save path was exercised only up to its validation block: the
comparable judgment was rejected client-side, the cost model submit stayed disabled, and the final bid
form was never submitted. Comparable counts and line coverage were re-read afterwards and were
unchanged.

A fresh reload of the Pricing page produced **zero console warnings or errors**. The buffer's older
errors are dev-server noise: `127.0.0.1:3000` HMR WebSocket handshakes, 403s on stale Fast-Refresh
chunk URLs, `DOMMatrix is not defined` from PDF.js server-rendering on the *verification* page, and a
sidebar hydration mismatch on `/overview` — all outside P7's files and all present before it.

---

## External references consulted

| Reference | License (verified 2026-08-21) | Outcome |
| --- | --- | --- |
| [Glide Data Grid](../reference-repos/glide-data-grid.md) | **MIT** | Already a dependency. Adopted from its documented API: `freezeColumns`, column `group` headers, per-column `themeOverride`, `GridCellKind.Uri` + `onClickUri`, `rowMarkers`/`rowSelect`/`rangeSelect`, `getCellsForSelection` + `copyHeaders`, `getRowThemeOverride`. Its editing surface (`onCellEdited`, `onPaste`, `onRowAppended`, overlay editors) was **deliberately declined** — see the read-only decision above. No code copied. |
| Tremor | — | **Not used, nothing installed.** The only chart P7 needs is a one-dimensional min/median/avg/max marker bar, which is four positioned `div`s over `components/ui` primitives and Tailwind tokens. Adding a charting dependency for that would have violated the "no new dependency" constraint and produced chart chrome that implies more data than an n = 0…8 corpus has. The bar is suppressed entirely below n = 3. |

One repository inspected, under the per-task limit of three.

---

## Honest limitations

- **The grid is read-only, permanently by design.** An operator who wants to change a rate must go to
  verification and promote, or edit the cost build-up. That is the correct trust model, but it does mean
  the "spreadsheet" cannot be typed into, and bulk correction of 20 promoted lines is 20 verification
  visits. `onPaste` is off for the same reason.
- **Client-side validation is convenience, not enforcement.** `parseRateInput` and the whitespace-reason
  guard shape what the UI offers. The server actions and the DB constraints remain the enforcing
  boundary; a crafted request still hits `saveComparableJudgment`'s trim/throw and the
  `pricing_comparable_judgments_reason_nonblank` constraint.
- **Range bars were never seen with data.** Arlington has 0 included comparables, so the browser proved
  the honest-empty path only. `rangeBarModel` at n = 3, n = 4 and min = max was proven by the acceptance
  script, not on screen.
- **Structure hints are keyword matching over line grains.** `observeLineGrains` regex-matches labor
  category / rate type / unit / site text. It cannot see a structure the promoted lines do not name, and
  a labor category containing the word "holiday" would report a holiday grain. It is honest about
  absence, not clever about presence.
- **Arlington's `site_or_post` values are page markers.** The observed sites read `page 1 · page 2`
  because that is what the promoter wrote when those award rates were extracted. The workbench displays
  the grain it was given; it does not clean it. This is a corpus-quality finding, not a UI bug.
- **Arlington's `labor_category` values are bidder names.** The eight promoted lines carry
  `Security Engineers, Inc.,`, `Texas Industrial Security,`, `Blackstone Security`, `Bid closed`, and
  similar — an award-summary table of competing bids, not a labor-category rate schedule. So the header
  honestly says `8 labor categories`, the cost-model section honestly renders eight editors, and the
  buyer-format panel honestly lists those strings; all of it faithfully reflects rows that were promoted
  with the wrong grain. `unit` is null on all eight, which is why `hourly` correctly does **not** appear
  as an observed structure. **The extraction/promotion mapping for award-summary tables is the fix, not
  the workbench.**
- **Recency is `pricing_lines.updated_at`**, i.e. the last change to the row — not the age of the
  underlying award document. A re-promoted 2019 rate reads as recent. The label says "unknown" when the
  timestamp is missing, and never guesses.
- **Coverage counts are per line, not per rate.** `Buyer awarded 8/8` means eight lines carry an awarded
  rate; it says nothing about whether those eight lines are the whole bid tab.
- **Canvas theming is read at mount and on theme-class changes.** A CSS token changed by some other
  mechanism (a stylesheet swap that does not touch `documentElement`'s `class`/`style`) would leave the
  grid painted with the old palette until remount.
- **The overview snapshot lists every line.** It is a full mirror, not a summary, so a pursuit with a
  large bid tab makes the Overview page long. Deep-linking to the workbench is offered but the table is
  not truncated.
