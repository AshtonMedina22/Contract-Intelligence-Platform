# P4 Public Opportunity Discovery + Watchlist + Start Pursuit — Acceptance

**Date:** 2026-08-21  
**Status:** IMPLEMENTED · **INDEPENDENTLY VERIFIED 2026-08-21** — fixture mode verified end to end;
live SAM.gov path unexercised (no API key)

## Overview

Pursuits gained a front door. Operators can search public procurement providers, track notices on a
watchlist, and start a pursuit from a public notice with provenance recorded — without any of that
public data being treated as L&P truth.

Three non-negotiables held throughout:

1. **Nothing is persisted on view.** Discover search results live only in the response. A row reaches
   `public_sources` only when the operator clicks Watch, Dismiss, or Start pursuit.
2. **Public facts are never HUMAN_VERIFIED.** The notice metadata written to `research_facts` is
   `AI_EXTRACTED` with null `verified_by` / `verified_at`. Guarded in code *and* at the database.
3. **No AI fit score.** No match percentage, no ranking, no "recommended" flag. The table shows
   provider fields verbatim and nothing else.

---

## Providers

`apps/web/lib/procurement/providers/`

| Adapter | id | Mode | Behavior |
| --- | --- | --- | --- |
| SAM.gov | `sam_gov` | live | Used when `SAM_GOV_API_KEY` or `SAM_API_KEY` is set. Queries `api.sam.gov/opportunities/v2/search` with `postedFrom`/`postedTo` (MM/dd/yyyy), `title`, `ncode`, `organizationName`, `limit`. 15s timeout; HTTP failures surface as an operator-visible error, never as empty-but-fine. |
| SAM.gov fixtures | `fixture` | fixture | Fallback when no key is set. Serves 5 sample security-services notices from `fixtures/sam-gov.sample.json`. |
| Manual research | `manual` | live | Thin adapter for an operator-pasted URL/title (state portal, ESBD, buyer website). No search surface — the operator supplies the record. |

Registered but not implemented in P4: `usa_spending`, `state`, `local` (accepted by the
`public_sources.provider` check constraint so adapters can land without a migration).

### Fixture honesty

Fixtures are deliberately impossible to mistake for live notices, and this is enforced by test:

- ids are `FIXTURE-SAM-001` … `FIXTURE-SAM-005`
- every title starts `SAMPLE FIXTURE — `
- every buyer reads `SAMPLE AGENCY (FIXTURE)` / `SAMPLE MUNICIPAL BUYER (FIXTURE)`
- every URL uses the reserved `.invalid` TLD (`https://fixture.invalid/sam-gov/…`)
- `estimated_value` is null on all five — no invented dollar figures
- Discover renders an amber **SAMPLE DATA · FIXTURE** banner explaining that `SAM_GOV_API_KEY` is
  unset and that these are not live public notices

Ask/Tavily/Brave public research (`lib/ask/research/provider.ts`) was left untouched. Discovery is a
separate rail.

### External references consulted

| Repo | License (verified 2026-08-21) | Outcome |
| --- | --- | --- |
| [TenderRadar](../reference-repos/tenderradar.md) | unlicensed | Reference only. One-adapter-per-source concept adopted; no upstream code. |
| [OpenSAM](../reference-repos/opensam.md) | unlicensed | Reference only. SAM.gov v2 parameter/response conventions only. |
| [RFP Map](../reference-repos/rfp-map.md) | **MIT** | Copy-eligible but **pattern declined**: its map-first / mobile-first UX conflicts with our desktop-first table chrome, and its approximate "market-gravity" dollar values conflict with never inventing a value. Its public bulk-CSV acquisition is recorded as a future option. |

---

## Schema

`supabase/migrations/20260821180000_p4_public_opportunity_discovery.sql` — **applied** to remote
Postgres on 2026-08-21.

### `public_sources` (new)

External public procurement notices. Columns: `provider`, `external_id`, `source_url`, `title`,
`buyer_name`, `solicitation_number`, `procurement_type`, `posted_on`, `due_on`, `naics`, `psc`,
`set_aside`, `geography`, `estimated_value`, `raw_payload`, `retrieved_at`, `watchlisted_at`,
`dismissed_at`, `created_by`.

- `unique (organization_id, provider, external_id)` — one row per notice per tenant
- `unique (id, organization_id)` — parent key for same-org composite FKs
- provider check constraint over the six allowed adapters
- non-blank `title` and `external_id`
- RLS `is_org_member(organization_id)` on select / insert / update / delete
- `estimated_value` is populated **only** when the provider supplies an amount

### `opportunities` (altered)

Added `external_provider`, `external_source_id`, `source_url`, `public_source_id`.

- partial unique index `(organization_id, external_provider, external_source_id)` where both
  provenance columns are non-null — one pursuit per external notice per tenant
- composite same-org FK `(public_source_id, organization_id) → public_sources (id, organization_id)`
  with **`on delete restrict`**: a pursuit's public provenance must not be silently severed, and
  `on delete set null` would attempt to null the NOT NULL `organization_id`. Operators dismiss
  notices; they do not delete them.

### `research_facts` (altered)

Added nullable `provider` and `external_id` so a public-notice fact can be traced to its adapter.

Types were hand-extended in `apps/web/lib/supabase/database.types.ts` (this repo does not generate
them), including a new `PublicSourceProvider` union.

---

## Server actions

`apps/web/app/(platform)/procurement/opportunities/discover/actions.ts`

| Action | Behavior |
| --- | --- |
| `watchOpportunity` | Upserts the notice with `watchlisted_at = now()`, clears `dismissed_at`. |
| `dismissOpportunity` | Sets `dismissed_at`, clears `watchlisted_at`. Works from a `public_source_id` or from a fresh Discover row. |
| `undismissOpportunity` | Clears `dismissed_at` so the notice returns to Discover. |
| `startPursuitFromPublicSource` | Returns the pursuit id. Creates `stage = INTAKE`, `go_no_go = PENDING`, copies title / `due_on` → `response_due_on` / `geography` → `site_location`, records all four provenance fields, upserts and links the `public_sources` row, and inserts one `AI_EXTRACTED` `research_facts` row. Reuses the existing pursuit if the notice was already started. |
| `startPursuitAndOpen` | Form wrapper that redirects to the new pursuit workspace. |

**Buyer handling.** `matchExistingClient` links `client_id` only when a `clients` row already matches
the listed buyer name (case-insensitive). No client record is created from a public notice — a
listing names a buyer, it does not tell us anything about them. Unmatched pursuits show
"No buyer linked", which is the honest state.

**Verification guard.** `assertUnverified` throws if any discovery write carries a
`verification_status` other than `AI_EXTRACTED`. The pre-existing
`research_facts_verified_requires_actor` constraint independently rejects `HUMAN_VERIFIED` without an
actor, so the guard is defense in depth rather than the only barrier.

**Pursuit notes** contain provider fields verbatim plus the line *"Public record only — ingest and
verify the solicitation before relying on any of these values."* Nothing is interpreted.

---

## Routes and IA

`PURSUITS_TABS` in `components/section-tabs.tsx`, wired via `PursuitsNav` on all five pages:

| Tab | Route | Content |
| --- | --- | --- |
| Discover | `/procurement/opportunities/discover` | Provider search + dense results table |
| Watchlist | `/procurement/opportunities/watchlist` | Watched notices (`?dismissed=1` for dismissed) |
| Active | `/procurement/opportunities` | Stages INTAKE, ANALYSIS, PRICING, DRAFTING |
| Submitted | `/procurement/opportunities/submitted` | Stage SUBMITTED |
| Closed | `/procurement/opportunities/closed` | Stages AWARDED, CLOSED |

`PursuitsList` was parameterized by `view` rather than duplicated. It gained an **Origin** column
(`fixture` / `sam_gov` / `manual` / `operator`) linking to the public notice when there is one.

Supporting changes:

- `SectionTabs` treats `/procurement/opportunities` as exact-match so Active does not stay lit on
  the sub-tabs.
- `lib/shell/nav.ts` recognizes `discover` / `watchlist` / `submitted` / `closed` as section tabs so
  they are not mislabeled "Overview" by the pursuit-id breadcrumb rule.
- Header **+ New** gained "Discover opportunities"; "New solicitation" still points at Intake.
- Both new pages follow the Cache Components convention: `searchParams` promise passed into a
  Suspense-wrapped async content component (no `export const dynamic`).

### Discover table columns

Notice (title → source URL, solicitation number) · Buyer as listed · Type · NAICS / PSC · Set-aside ·
Place · Posted · Due · Value (`not published` when absent) · Actions.

Filters: keywords, agency/buyer, NAICS prefix, due-within-days, posted from/to. Applied uniformly to
live and fixture results by `applyLocalFilters`.

Row state badges: **Watching** / **Dismissed** / **Pursuit started**. Dismissed rows are hidden.

---

## Tests

| Check | Result |
| --- | --- |
| `npm run test:p4-discovery` (8 checks) | **PASS** — date/amount coercion, normalization nulls, filters, fixture labeling, fixture↔live mode switch, manual entry |
| `npm run test:p4-discovery-rls` (14 checks) | **PASS** — cross-org select/insert/update/delete denial, provider enum, notice uniqueness, one-pursuit-per-notice, INTAKE/PENDING provenance, `AI_EXTRACTED` landing, `HUMAN_VERIFIED`-without-actor rejection, referenced-notice delete blocked |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** — all five routes emitted as Partial Prerender |

The provider unit script bundles the real TypeScript modules with esbuild (already a dependency), so
it exercises the same code the app runs. It needs no network and no database.

### Browser verification (IronBee DevTools, `localhost:3000`)

1. `/procurement/opportunities/discover` — 5 fixture rows, amber SAMPLE DATA banner, Pursuits tabs present
2. **Watch** on FIXTURE-SAM-002 → appears on Watchlist as provider `sample`
3. **Start pursuit** from Watchlist → redirected to the pursuit workspace showing *Intake · Pending ·
   Fort Worth, TX · Due 2026-09-02 · No buyer linked*
4. Database confirmed `stage=INTAKE`, `go_no_go=PENDING`, `external_provider=fixture`,
   `external_source_id=FIXTURE-SAM-002`, `public_source_id` linked, and the `research_facts` row
   `AI_EXTRACTED` with null `verified_by` / `verified_at`
5. **Dismiss** on FIXTURE-SAM-004 → Discover dropped from 5 to 4 rows
6. Active / Submitted / Closed tabs each render their own stage slice with honest empty states
7. Zero console errors

Fixture rows, the fixture pursuit, and its research fact were deleted afterward so no sample data
remains in the live operator org.

---

## Independent verification (2026-08-21, second agent)

Re-run from a clean shell against the same remote Postgres and the local dev server:

| Check | Result |
| --- | --- |
| `npm run test:p4-discovery` | **PASS 8/8** |
| `npm run test:p4-discovery-rls` | **PASS 14/14** |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** — `discover`, `watchlist`, `submitted`, `closed` all emitted Partial Prerender |

Browser (IronBee DevTools, `localhost:3000`):

1. `/procurement/opportunities/discover` — 5 fixture rows, amber **SAMPLE DATA · FIXTURE** banner,
   Pursuits tabs present, breadcrumb reads *Home › Pursuits › Discover*, every Value cell reads
   "not published".
2. **Nothing persisted on view, measured:** after repeated Discover loads, `public_sources` held
   **0 rows**.
3. **Watch** on FIXTURE-SAM-002 → exactly one `public_sources` row appeared
   (`provider=fixture`, `watchlisted_at` set, `estimated_value` null, `created_by` = operator); the
   row's Watch button was replaced by a **Watching** badge and the Watchlist showed it as provider
   `sample`.
4. Active / Submitted / Closed each rendered their own stage slice; Submitted and Closed showed
   honest empty states; the Origin column read `operator` for pre-existing pursuits.
5. Zero console errors from the app origin. (Stale 403/HMR errors in the buffer originated from an
   earlier `127.0.0.1` session, not from these routes.)
6. Fixture row deleted afterward — `public_sources` back to **0**, `research_facts` with a provider
   **0**, pursuits with public provenance **0**.

Two code claims were re-checked directly rather than trusted: `startPursuitFromPublicSource` writes
`verification_status: "AI_EXTRACTED"` through `assertUnverified` and never sets `verified_by` /
`verified_at`, and the independent database guard is
`research_facts_verified_requires_actor` (migration `20260820240000_phase10_win_loss_intelligence.sql`),
which the RLS script exercises live.

One documentation error was found and corrected: the `rfp-map` reference note claimed the upstream
repository could not be identified. It is [EthanHNguyen/rfp-map](https://github.com/EthanHNguyen/rfp-map),
**MIT**, and linked from our own `docs/OG DOCS/COMPONENTS REPOS.MD`. The note, the registry, and
`WORK_TRAIL.md` now record it as a licensed-but-**declined** pattern rather than an unidentifiable
repo. No code changed.

---

## Honest limitations

- **The live SAM.gov path has never made a real request.** Parameter names, the `opportunitiesData`
  response shape, and `placeOfPerformance` flattening are written from the documented v2 search API
  and OpenSAM patterns, not from an observed response. First run with a real key should be treated as
  unvalidated.
- Fixture notices are **sample data**. They validate the flow, not the corpus. Nothing derived from
  them counts toward the Historical Pilot's ~20–30 verified packages.
- Starting a pursuit from a notice does **not** ingest the solicitation. The pursuit has zero
  documents until Data Ops → Intake runs, and every downstream truth still requires human
  verification.
- `usa_spending`, `state`, and `local` are reserved provider values with no adapter behind them.
- Discover cannot show notices the provider does not return. Absence in the table is not evidence
  that no such solicitation exists.
