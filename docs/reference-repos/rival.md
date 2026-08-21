# Repository

Rival — https://github.com/tessak22/rival
"Open-source competitive intelligence dashboard powered entirely by the Tabstack API."

# Task that caused inspection

P9 Full Intelligence Workbench polish (2026-08-21) — specifically the Competitors view: how a
competitor-intelligence surface should be laid out, and how a "brief on this competitor" action
should be exposed.

# Relevant upstream material inspected

Public README and repository metadata (license, description, structure) only. Its competitor
profile / historical scan / change-summary / cited Deep Dive concept model, not its source.

# Relevant patterns found

- A competitor is a **first-class row you can open**, not a filter on a bid table.
- Each competitor carries a small set of dense evidence tables rather than one wide table.
- A per-entity "generate a brief on this one" action launches the app's existing answer surface with
  the entity already in scope, instead of asking the operator to retype the question.
- Change history is presented as *what a source said and when*, not as a computed trend.

# What maps to our codebase

`apps/web/app/(platform)/intelligence/competitors/page.tsx` and `competitors-table.tsx`; the
per-buyer brief chip in `clients/buyers-portfolio-table.tsx`; `lib/intelligence/ask-launch.ts`.

# What we are adopting

- **Pattern only:** density (three focused tables — bids, pricing lines, evaluation scores — each
  with its own source column) and the per-entity brief launch, implemented through our own
  `buildAskHref({ from: "competitors", purpose: "COMPETITOR_ANALYSIS" })` chip against the existing
  Phase 6 Ask surface.
- The idea that evidence is *stated with its source*, which we already enforce harder than upstream
  via `EvidenceBasisBadge` (`OBSERVED` vs `INFERENCE`) and a source cell that links to
  `/ingestion/verification/<documentId>`.

# What we are explicitly NOT adopting

- **The Tabstack-powered scan / Deep Dive research rail.** That is a second research engine. Our
  public rail is the existing Phase 6 dual-rail agent (`lib/ask/research/provider.ts`) and P9 added
  no provider, no key and no scan job.
- Scheduled competitor scans and change-diff summaries — they would write unverified public claims
  into a competitor record, and `research_facts` requires an actor for `HUMAN_VERIFIED`.
- Any scoring, ranking or threat-level treatment of a competitor. We hold counts of observed bids,
  pricing lines and evaluation scores, with sample sizes, and no corporate win rate.

# License/copy implications verified

**MIT** per GitHub license metadata, verified 2026-08-21 (`license.spdx_id = MIT`, not archived).
Copy-eligible with attribution. **No upstream source was copied** — the inspection produced layout
and interaction decisions only.

# Local files affected

`apps/web/app/(platform)/intelligence/competitors/page.tsx`,
`apps/web/app/(platform)/intelligence/competitors/competitors-table.tsx`,
`apps/web/app/(platform)/intelligence/clients/buyers-portfolio-table.tsx`,
`apps/web/lib/intelligence/ask-launch.ts`.

# Status

INSPECTED FOR TASK — layout/launch pattern adopted, research rail REJECTED.
