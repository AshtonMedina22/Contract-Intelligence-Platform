# Repository

Glide Data Grid — https://github.com/glideapps/glide-data-grid
Installed here as `@glideapps/glide-data-grid` **6.0.3** (already a dependency; nothing was added).

# Task that caused inspection

**P7 Pricing Workbench polish** (2026-08-21) — make the Pursuit → Pricing five-truth matrix read like a
professional workbench (pinned identifiers, per-truth banding, currency, clickable source evidence,
multi-row selection, dense chrome) **without** giving the grid a write path.

# Relevant upstream files inspected

Local installed copy rather than a clone (`node_modules/@glideapps/glide-data-grid/`):

- `dist/dts/data-editor/data-editor.d.ts` — the `DataEditorProps` surface
- `dist/dts/internal/data-grid/data-grid-types.d.ts` — `GridCellKind`, `UriCell`, `NumberCell`, `GridColumn`
- `dist/dts/common/styles.d.ts` — the `Theme` shape and which keys are canvas-painted
- `dist/index.css` — the one stylesheet the component needs

# Relevant patterns found

| Prop / type | What it gives |
| --- | --- |
| `freezeColumns` | Pins the leading N columns while the rest scroll horizontally. |
| `GridColumn.group` | Renders a second header row grouping adjacent columns under one title. |
| `GridColumn.themeOverride` | Per-column theme patch — the supported way to band a column. |
| `getRowThemeOverride` | Per-row theme patch, used here for hover. |
| `GridCellKind.Uri` + `onClickUri` | A link cell whose click can be intercepted (`args.preventDefault()`). |
| `GridCellKind.Number` + `displayData` | Right-shaped numeric cell that still shows our own formatted string. |
| `rowMarkers`, `rowSelect`, `rangeSelect`, `columnSelect` | Selection model; `rowMarkers: "both"` gives number + checkbox. |
| `getCellsForSelection` + `copyHeaders` | Enables Ctrl/Cmd+C of a selection with header names. |
| `onCellsEdited` / `onCellEdited` / `onPaste` / `onRowAppended` | The editing surface. `onPaste` accepts `false` to disable paste outright. |
| `Theme` | Canvas-painted colours: **must be concrete colour strings.** `hsl(var(--x))` does not resolve on a canvas. |

# What maps to our codebase

`apps/web/components/opportunity-workspace/pricing-glide-grid.tsx` is the only Glide consumer. It is
loaded through `dynamic(..., { ssr: false })` because the grid touches `window`.

Our five commercial truths map onto `GridColumn.group` (one group per truth, each over a `Rate ($)` +
`Source` pair), our pinned grain onto `freezeColumns`, our source facts onto `Uri` cells pointing at
`/ingestion/verification/<documentId>`, and our shadcn tokens onto `Theme` via
`getComputedStyle` → HSL-triplet → RGB conversion in `lib/opportunity/pricing-grid-model.ts`.

# What we are adopting

- `freezeColumns` for `labor_category · site_or_post · unit`
- `group` headers named from `PRICING_TRUTH_COLUMNS`, plus per-column `themeOverride` banding
- `GridCellKind.Uri` with `onClickUri` for source-fact navigation
- `GridCellKind.Number` with our own `displayData` currency string (absent stays `—`, never `0.00`)
- `rowMarkers: "both"`, `rowSelect: "multi"`, `rangeSelect: "multi-rect"`, `columnSelect: "none"`
- `getCellsForSelection` + `copyHeaders` for keyboard copy
- `getRowThemeOverride` for hover; dense `headerHeight`/`groupHeaderHeight`/`rowHeight`
- Concrete-colour `Theme` resolved from CSS tokens, re-resolved under a `MutationObserver`

# What we are explicitly NOT adopting

- **The entire editing surface**: no `onCellEdited` / `onCellsEdited`, no overlay editors, no
  `onRowAppended`, and `onPaste={false}`. Every canonical rate in `pricing_lines` exists only because a
  human verified a document and promoted a fact; a grid edit would produce a rate with no
  `source_fact_id`, which the `pricing_lines_truth_requires_verified_fact` trigger rejects. Internal cost
  *is* human-writable but is derived by `saveCostModel` from a cost build-up per labor category, not
  per line. Each truth therefore carries an `editPath` string and the grid routes to that human path
  instead of writing.
- Custom cell renderers / `@glideapps/glide-data-grid-cells` — not installed, not needed.
- Search overlay, column resizing/reordering persistence, row grouping, and trailing "add row" affordances.
- Glide's default theme, which does not match our shadcn tokens in either light or dark mode.

# License/copy implications verified

`package.json` of the installed 6.0.3 declares **`"license": "MIT"`** (the npm tarball ships no separate
LICENSE file). MIT is permissive and copy-eligible, but **no upstream source was copied** — only the
documented public API was used from the already-installed dependency.

# Local files affected

- `apps/web/components/opportunity-workspace/pricing-glide-grid.tsx`
- `apps/web/lib/opportunity/pricing-grid-model.ts` (new — column model, formatting, canvas colour maths)
- `scripts/p7-pricing-workbench-acceptance.mjs` (asserts no edit/paste handler is ever added back)
- `docs/productization/P7_PRICING_WORKBENCH_ACCEPTANCE.md`

# Status

ADOPTED PATTERN — display, selection, theming and source-navigation APIs adopted; the editing API
deliberately rejected for trust reasons.
