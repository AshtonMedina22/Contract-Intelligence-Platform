# Repository / block

Tremor — https://github.com/tremorlabs/tremor
Dashboard template — https://github.com/tremorlabs/template-dashboard-oss

# Task that caused inspection

P9 Full Intelligence Workbench polish (2026-08-21) — the "dense verified observation tiles with
sample counts" requirement on Market, Buyers, Competitors, Pricing, Win/Loss and Content.

Previously considered and declined for P7 Pricing (range bars) — see
[P7_PRICING_WORKBENCH_ACCEPTANCE.md](../productization/P7_PRICING_WORKBENCH_ACCEPTANCE.md).

# Relevant upstream material inspected

Public README, component catalog and repository metadata for both repos. KPI-card and dashboard-grid
composition patterns only.

# Relevant patterns found

- KPI cards as a fixed grid of `label / value / delta`, with consistent numeric typography.
- Category bars and spark visuals that read a metric against a range.
- A dashboard grid convention that keeps tile heights uniform regardless of content.

# What we are adopting

- **Nothing installed.** The `label / value / grid` composition was reproduced with existing
  `components/ui` primitives and Tailwind tokens in
  `apps/web/components/intelligence/honesty-strip.tsx` (`ObservationTiles`), which is a `div` grid
  plus a `Badge`.

# What we are explicitly NOT adopting

- **The dependency.** P9 shipped with no new package. A tile here is a count, a `n=` sample line, a
  source table name and an `OBSERVED`/`INFERENCE` badge; that does not justify a charting library.
- **The delta / trend affordance**, which is the actual reason Tremor was declined. A Tremor KPI card
  wants a period-over-period delta, and on a 26-buyer / 1-review corpus a delta is either noise or a
  claim about a trend we cannot evidence. Our tile carries a **sample size** where Tremor carries a
  **delta** — that substitution is deliberate and is enforced by `observationTile`, which cannot
  construct a tile without `n=`.
- Category / donut / share visuals. Any share-of-total chart on this data would read as market share,
  which the workbench forbids outright; the acceptance script greps for market-share language across
  all seven views.
- Charts of any kind on the workbench. Nothing here has enough n to plot honestly, and a chart
  implies more data than the corpus has.

# License/copy implications verified

**Apache-2.0** per GitHub license metadata, verified 2026-08-21 (`license.spdx_id = Apache-2.0`, not
archived). Copy-eligible with attribution, but **nothing was installed and no source was copied**, so
no attribution or NOTICE obligation was incurred.

# Local files affected

`apps/web/components/intelligence/honesty-strip.tsx` (own implementation, no upstream code).

# Status

REJECTED (second time) — pattern reproduced locally, dependency and delta/share affordances declined.
