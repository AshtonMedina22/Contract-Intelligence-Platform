# Repository

RFP Map — https://github.com/EthanHNguyen/rfp-map

# Task that caused inspection

P4 productization: public opportunity discovery + watchlist + start pursuit
(`docs/productization/P4_OPPORTUNITY_DISCOVERY_ACCEPTANCE.md`). The work order named `rfp-map`
alongside TenderRadar and OpenSAM as a discovery reference.

An earlier version of this note recorded `rfp-map` as REJECTED for having no identifiable upstream.
That was wrong: the repository is named and linked in our own `docs/OG DOCS/COMPONENTS REPOS.MD`,
and it is a live public repository. Corrected on re-verification (2026-08-21).

# Relevant upstream files inspected

README and license metadata only (GitHub API + raw README, 2026-08-21): description
("Mobile-first SAM.gov market intelligence radar"), Next.js 16 / React 19 / TypeScript with a Python
ingest script, `license.spdx_id = MIT`, last push 2026-08-21, static export to GitHub Pages.
**No source files were read and the repository was not cloned.**

# Relevant patterns found

- **Bulk CSV instead of the API.** It ingests the public SAM.gov Contract Opportunities bulk CSV
  (`ContractOpportunitiesFullCSV.csv`, ~74k open rows) via a scheduled job and precomputes compact
  payloads, rather than calling `opportunities/v2/search` per request. That is a genuinely different
  acquisition strategy from ours and is worth revisiting if per-request SAM.gov search proves too
  slow or rate-limited.
- **Every record links back to its SAM.gov source notice** — the same source-linked discipline our
  Discover table uses for `source_url`.

# What maps to our codebase

Nothing was taken into code. The bulk-CSV acquisition idea is recorded here as a future option for
`apps/web/lib/procurement/providers/sam-gov.ts` only.

# What we are adopting

Nothing. No upstream code, no UI, no data model.

# What we are explicitly NOT adopting

- **The map / radar UX.** RFP Map is deliberately map-first and mobile-first (agencies as regions,
  categories as neighborhoods, RFPs as tappable pins). Our canonical discovery chrome is
  desktop-first and table/grid-centric per [UX_UI.md](../UX_UI.md) and
  `.cursor/rules/external-ux-references.mdc`; P4 shipped a dense sortable notice table with verbatim
  provider fields instead. Geographic exploration is not the operator's job — deciding whether to
  pursue a specific solicitation is.
- **"Market-gravity" dollar estimates.** Its README states dollar amounts are approximations, not
  official values. We never invent or infer a contract value: `estimated_value` is populated only
  when the provider itself supplies an amount, and it renders as "not published" otherwise.
- Category/agency clustering as intelligence. Grouping public notices is not evidence about a buyer.

# License/copy implications verified

GitHub API reports **MIT** (`license.spdx_id = MIT`, verified 2026-08-21), and the README ends with
`License: MIT`. MIT is permissive, so copying with attribution *would* be allowed — but nothing was
copied, so no attribution obligation was incurred. This is a permissive-license, deliberate-skip
outcome, not a license block.

# Local files affected

None.

# Status

INSPECTED FOR TASK (README + license only) · MIT / copy-eligible · **PATTERN DECLINED** — map UX
skipped in favor of a dense desktop discovery table; bulk-CSV ingest recorded as a future option.
