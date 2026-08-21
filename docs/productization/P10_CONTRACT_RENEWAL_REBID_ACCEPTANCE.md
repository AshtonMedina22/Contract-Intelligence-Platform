# P10 Contract Portfolio + Renewal / Rebid Command Center — Acceptance

**Date:** 2026-08-21
**Status:** IMPLEMENTED — verified in the browser against the live operator org (L&P Global Security).
**No migration. No schema change. No new dependency.** The Phase 9 `contracts` / `contract_alerts` /
`contract_options` / `renewals` schema and the `refresh-contract-alerts` cron were not rebuilt. P10
productizes the portfolio and the renewal/rebid decision surface on top of what already exists.

## What was actually wrong

The contract tables, the alert cron and the five workspace tabs all existed and read real rows, but
as an operator surface the Contracts area did not hold:

- `/contracts` was a flat list. It could not answer *how many contracts do we hold*, *which ones need
  a decision this quarter*, or *what is due next on this one* without opening every row.
- Status was derived inline in the loader, so the portfolio list, the renewal queue and the contract
  Overview tab could each disagree about whether a contract was active.
- There was no honest position on value. The schema has no contract-value column — it has an award
  NTE ceiling and obligated purchase orders, which are different quantities — and nothing said so.
- `/contracts/renewals` and `/contracts/compliance` were unreachable from `/contracts` and from each
  other. P1 correctly demoted them out of the global sidebar, and nothing replaced the link.
- The Changes tab listed amendments and options as two flat tables with no sequence, so an operator
  could not read what the contract said originally versus what it says now.
- "Start Rebid" was an unlabelled button with no statement of what it copies, which is exactly the
  place where stale pricing silently propagates into a new solicitation.
- Nothing on the page said what the nightly cron does, or — more importantly — what it does not do.

---

## 1. `lib/contracts/portfolio-model.ts` — one model, four rules

New, pure (no React, no Supabase), so the acceptance script bundles and runs the shipped code rather
than a copy of it. Every contracts surface now derives status, buckets, values, next action and risk
from this one module, so the portfolio, the renewal queue and the Overview tab cannot disagree.

The four rules the module is built to keep:

1. **A date is verified or it is absent.** Status, buckets, expirations and next actions come from
   `contracts.verified_end_on` and from dates recorded on option and renewal rows. A contract with no
   verified end date is `UNKNOWN`/undated — never assumed active, never given an end inferred from a
   term length, a start date, or a typical cycle.
2. **A value is a named instrument or it is a dash.** An award ceiling and an obligated purchase
   order are different things and are never added together. A portfolio total is withheld unless
   every contract in scope carries an amount.
3. **This is not the market radar.** `/contracts` is what L&P holds; the Intelligence Recompete Radar
   is what L&P does not hold. The two lists are never merged or counted together.
4. **Nothing here acts.** Buckets, readiness and next actions are advisory. No function in the module
   renews, extends, exercises an option, approves, or submits.

### Exports

| Export | Contract |
| --- | --- |
| `deriveContractStatus` | Moved here from `load-workspace.ts`, so there is exactly one definition. Returns `UNKNOWN` when `verified_end_on` is null, `EXPIRED` on a passed date or an `EXPIRED` bucket, the bucket itself when one exists, else `ACTIVE`. |
| `RENEWAL_BUCKETS` | `EXPIRED, 30, 60, 90, 120, 180` — exactly the six `refresh_contract_alerts` computes, ordered most urgent first. |
| `RENEWAL_BUCKET_DEFINITION` | States that buckets come from `(verified_end_on − current_date)` and that **a contract with no verified end date produces no bucket at all, so the queue under-reports rather than invents an expiration.** |
| `PORTFOLIO_FILTERS` | `ALL, ACTIVE, RENEWAL_REBID, EXPIRING, CLOSED, UNDATED`. A **partition**, not overlapping tags: every row lands in exactly one lane, so the lane counts always sum to the portfolio count and no row is unreachable from the filter bar. Asserted by check. |
| `portfolioFilterFromParam` | Normalises case, whitespace and hyphens onto a known lane; anything else (`expiring soon`, `../../etc`, `toString`, `__proto__`) becomes `ALL`. An arbitrary string never reaches the row filter. |
| `ContractValueKind` | `NTE_CEILING` (award) and `PO_OBLIGATED` (purchase orders) — the only two amount kinds this schema records. Each `ContractValue` carries its `kind` and the `basis` field it came from. |
| `totalActiveContractValue` | Returns `amount: null` plus a `withheldReason` naming the coverage gap unless **every** in-scope contract has an amount. Same gate the Intelligence win rate uses. |
| `buildContractPortfolio` | Rows sorted by soonest dated obligation, undated last, then alphabetically — deterministic. Also returns `counts`, `buckets`, `activeCount`, `undatedCount`, `expiredCount`, `activeContractValue` and `alertsComputedOn`. |
| `buildChangeTimeline` | Original → Amendment → Modification → Option → Renewal, chronological, undated instruments last. |
| `assessRebidReadiness` | Advisory read of `compliance_items`. An empty list is `UNKNOWN`, not clear. |
| `automationAudit` | Job name, schedule, last computed timestamp, whether this view refreshed, scope, and the no-auto-action guarantee. |
| `PORTFOLIO_HONESTY_TEXT` / `LP_PORTFOLIO_VS_MARKET_RADAR_NOTE` | The two strips rendered across the contracts area. |

`deriveContractStatus` and the `ContractStatus` type are re-exported from `load-workspace.ts` so no
existing caller broke.

## 2. Portfolio (`/contracts`)

### KPI strip

Rendered with the P9 `observationTile` / `ObservationTiles` primitives, so **every tile carries `n=`
and the table it was counted from** and a tile cannot be constructed without its sample.

| KPI | Definition | Source |
| --- | --- | --- |
| Contracts on file | Rows in `contracts` | `contracts` |
| Active (verified end ahead) | `ACTIVE + RENEWAL_REBID + EXPIRING` lanes | `contracts.verified_end_on` |
| In renewal window | `RENEWAL_REBID + EXPIRING` lanes; links to the renewal queue | `contract_alerts` |
| Expired on file | `CLOSED` lane | `contract_alerts.EXPIRED` |
| No verified end date | `UNDATED` lane | `contracts` with null `verified_end_on` |

**There is no value KPI tile.** Active Contract Value is a separate statement below the strip
(`data-testid="active-contract-value"`) precisely because it can be withheld, and a tile that
sometimes prints a number and sometimes prints a paragraph reads as a broken metric.

### Table

Buyer · Contract # · Status · Original value · Current value · Start · Expiration · Options ·
Next Action · Risk. Original value is the award NTE ceiling; current value is the obligated total
across recorded purchase orders; **both render an em dash with a title attribute naming the gap when
absent, never `$0`.** Amendments record no amount in this schema, so an amendment never changes a
value here — the row stays a dash rather than inheriting the original. Options render the count on
file and the next unpassed `exercise_by`; an option row **never implies it was exercised**, because
exercised-versus-remaining is not recorded.

Next Action always restates a recorded date and names the field it came from, or says no date is
recorded. Risk is a read of the verified date (`Overdue`, `Act now`, `Watch`, `No dated obligation`,
`Unknown`) — **not a score**, and `Unknown` is never rendered as low.

### Filters

`Active / Renewal-rebid / Expiring / Closed / No verified end`, each with its definition on hover,
each showing its own count. Filtering changes the table only; the KPI counts stay over the whole
portfolio, and the page says so.

## 3. Discoverability — P1 respected, not reverted

P1 deliberately reduced `CONTRACTS_TABS` to `Portfolio` alone and removed Renewals and Compliance as
global sidebar peers. **P10 keeps that.** The sidebar is unchanged, and `CONTRACTS_TABS` is still
`Portfolio` only.

Discoverability is restored *inside* the contracts area instead: Portfolio, Renewals and Compliance
each render header buttons to the other two. The link graph is complete in both directions and is
asserted by check, and `/intelligence/market` links back to `L&P-held renewals` from the opposite
side.

### `phase4-contracts` grep alignment

The suite's `[ui] ContractsNav Portfolio | Renewals | Compliance` check was written against the
pre-P1 shell and failed on `HEAD` for that reason. It was **not** relaxed. It now asserts the
intentional P1 demotion positively: `CONTRACTS_TABS` must contain `Portfolio` and must **not**
contain Renewals or Compliance as tabs, and all three pages must cross-link to the other two. The
Overview, Changes and Renewal greps were likewise updated to the P10 surface rather than deleted.

Baseline `phase4-contracts` on `HEAD` is **44/46 (2 failures)**; with P10 it is **47/48 (1 failure)**
— the UI grep is genuinely fixed, and the remaining failure is the pre-existing trust-trigger one
documented below.

## 4. The five workspace tabs

**Overview** — buyer, contract number, status with days, performance dates, original and current
value with the absent-value note, vehicle / federal ID, options on file, risk, and next action with
its basis. Adds an **Award & pursuit lineage** block (linked pursuit, recorded result, award notice)
and a **Source evidence** block linking each backing document to `/ingestion/verification/<id>`.
Rows are built with `buildContractPortfolio`, so Overview and the portfolio list cannot diverge.

**Service Plan** — structure unchanged, as required. Each row gained a **Source** column linking to
the verification page for its document, or naming the fact when only a fact exists.

**Commercial Terms** — the four commercial truths are labelled in the heading itself: *requested
(buyer) · submitted (L&P) · awarded (buyer) · current / amended*. Current/amended is computed only
from verified instruments — the obligated purchase-order total — and **never defaults to the awarded
value**. A new **Instrument precedence** section lists the reading order (original → amendment →
exercised option → renewal notice → purchase order) with `COMMERCIAL_PRECEDENCE_NOTE`: precedence is
a reading order, not an automatic overwrite; both terms stay on the Changes timeline with their own
sources, and a term no instrument records stays absent rather than being carried forward.

**Changes** — a single `data-testid="change-timeline"` running Original award → Amendment →
Modification → Option → Renewal / notice, chronological with undated instruments last so nothing is
silently placed in sequence. Each entry carries its own `source_fact_id` / `source_document_id` link.
`CHANGE_HISTORY_APPEND_ONLY_NOTE` is rendered on the page: a later instrument is added as its own
entry and never overwrites, edits or hides the one before it. Amendment-versus-modification is
classified from the recorded label and is stated to be a reading aid, not a legal determination.

**Renewal** — bucket strip, options on file, renewal/termination notices, **Compliance readiness for
rebid (advisory)**, the **Rebid pursuit** block, internal review, and the automation strip. The
readiness read is explicitly advisory: it does not certify eligibility, does not gate the button, and
an empty compliance list means *nothing has been recorded*, not that the requirement does not exist.
`LP_PORTFOLIO_VS_MARKET_RADAR_NOTE` and a direct link to `Intelligence → Market` are rendered here so
the distinction is stated at the point of decision.

## 5. Start Rebid Pursuit

`cloneRebidFromContract` survives and was not rewritten. The CTA is now labelled **Start Rebid
Pursuit** (`data-testid="start-rebid-pursuit"`) and carries `REBID_CTA_NOTE` as its title, verified
in the browser:

> Creates a new pursuit workspace in INTAKE linked back to this contract (`rebid_from_contract_id`
> and `rebid_from_opportunity_id`). It carries over the buyer, the service type and a provenance note
> only — **no pricing is copied**, because prior rates were priced against a prior solicitation and
> must be re-verified.

The action writes only `opportunities` with `rebid_from_contract_id` and `rebid_from_opportunity_id`
set. It inserts no `pricing_lines`, no `pricing_decisions`, no `renewals` and no `contract_options` —
asserted by grep against the action source, so a future edit that starts copying rates fails the
suite. The generated pursuit note states that no pricing was copied.

## 6. Automation audit

`AutomationAuditStrip` renders on the portfolio, the renewal queue and the per-contract renewal tab:
the job (`refresh-contract-alerts`), the schedule (`15 6 * * *`, 06:15 UTC daily), when buckets were
last computed (`max(contract_alerts.computed_on)`), whether *this* view refreshed, the scope, and the
guarantee.

`/contracts/renewals` still calls `supabase.rpc("refresh_contract_alerts")` on load, as before, and
says so. `/contracts` and the per-contract renewal tab read buckets as last computed and say that too
— the strip never implies a refresh that did not happen.

The scope note is deliberately narrow: the job recomputes bucket rows from
`(verified_end_on − current_date)` and deletes stale ones. **That is its entire scope: it writes no
contract term, exercises no option, sends no notice, and approves nothing.** `NO_AUTO_ACTION_NOTE`
is rendered wherever an action is offered.

---

## Test evidence

| Suite | Result |
| --- | --- |
| `npm run test:p10-contracts-renewal` (new, 29 checks) | **PASS 29/29** |
| `npm run test:phase9-contracts` | **PASS 6/6** |
| `npm run test:phase4-contracts` | **47/48** (was 44/46 on `HEAD`) — 1 pre-existing, see below |
| `npm run test:verify4` | **30/31** — 1 pre-existing, see below |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** — all six contracts routes Partial Prerender |

Full P1–P10 regression is tabulated in
[PRODUCTIZATION_P1_P10_FINAL_AUDIT.md](PRODUCTIZATION_P1_P10_FINAL_AUDIT.md).

### What `test:p10-contracts-renewal` actually asserts

Same shape as P9: `esbuild` bundles the shipped module, `node:assert/strict` runs it, and UI claims
are greps against the real page sources. No network, no database.

Buckets and status · undated contracts stay visible, uncounted and told to go get a date · a value is
a named instrument or nothing · a null or non-numeric amount is absent, never coerced to zero · the
active total is withheld unless coverage is complete, and the page prints the reason · next action
restates a date and names its field · risk is a read, not a score · the lanes partition the portfolio
and add up · an unknown filter param never reaches the query · every KPI tile carries `n=` and a
source · the portfolio states it is not the Market Recompete Radar and links to it · Portfolio,
Renewals and Compliance are reachable from each other · all five tabs survive and render · the
timeline is append-only and an undated instrument is not silently placed · an option row never
implies it was exercised · readiness is advisory and an empty list is unknown rather than clear · the
CTA is `Start Rebid Pursuit` and copies no pricing forward · `cloneRebidFromContract` links lineage
and inserts no rate · no automation renews, approves or submits, and the app says so.

### Browser verification (IronBee, live operator org)

Every contracts route returned **200 with no error overlay**. The live corpus is 12 contracts.

- **Portfolio:** five tiles with `n=` — `Contracts on file 12`, `Active 1`, `In renewal window 0`,
  `Expired on file 2`, `No verified end date 9`.
- **Active Contract Value was withheld on screen**, printing *"only 0 of 1 active contracts record an
  award NTE ceiling. A partial sum would read as the whole portfolio."* No number was shown.
- **Filters partition the live data:** `ALL 12`, `ACTIVE 1`, `EXPIRING 0`, `CLOSED 2`, `UNDATED 9`,
  `RENEWAL_REBID 0` — `1 + 0 + 0 + 2 + 9 = 12`. A lowercase hand-typed `?filter=undated` resolved to
  the `UNDATED` lane rather than silently falling back.
- **Every value cell on the live corpus rendered an em dash**, not `$0` — correct, since no contract
  in the pilot corpus yet carries an award NTE or a purchase order.
- **Renewals:** bucket strip `Expired 2`, all other buckets `0`, `n=2 bucketed contracts`; both rows
  present with their next dated obligation.
- **All five tabs of `ea615b3b` (Allen ISD) rendered**, including the Overview lineage and source
  evidence blocks, the four-truths heading, the change timeline, and the renewal readiness block.
- **`Start Rebid Pursuit` rendered enabled with the full no-pricing-copied title.** The mutation was
  **deliberately not fired** — it creates a permanent `opportunities` row in the operator org, which
  is not a clean, reversible browser step. Its behaviour is covered by the acceptance script's grep
  over the action source.
- **Market radar contrast confirmed from both sides:** `/contracts` renders *"Not the Market
  Recompete Radar"* and links to it; `/intelligence/market` renders *"Market radar — recompetes
  observed in the corpus"* and links back to `L&P-held renewals`.

**Zero writes.** Every browser step was a read.

### Two real defects found and fixed during verification

1. **`/contracts/[contractId]` returned a 500** — `Could not embed because more than one relationship
   was found for 'contracts' and 'opportunities'`. The Overview lineage block added an
   `opportunities(id, title)` embed, but `opportunities.rebid_from_contract_id` points back at
   `contracts`, so PostgREST saw two relationships. Fixed by hinting the constraint explicitly:
   `opportunities!contracts_opportunity_same_org_fkey(id, title)`. This was a P10 regression, caught
   only because the tab was opened in a browser — the build and typecheck both passed with it.
2. **`portfolioFilterFromParam` was case-sensitive**, so a hand-typed `?filter=expiring` silently fell
   back to `ALL` and looked like a broken filter. It now normalises case, whitespace and hyphens; a
   genuine near-miss like `expiring soon` still falls back to `ALL`. The acceptance check was updated
   to assert normalisation and still assert that an unknown value never reaches the query.

### Pre-existing failures, reproduced not caused

Both were re-run on a clean `HEAD` worktree (P10 changes stashed) and **failed identically**:

1. **`phase4-contracts` `[commercial] award NTE stored for linked pursuit`** — *"awards requires
   `source_fact_id` (promote from HUMAN_VERIFIED only)"*. The fixture does a bare `awards.insert`,
   which the trust trigger correctly rejects.
2. **`verify4` `[linkage] linked pursuit/award remains traceable`** — same cause, same message, on
   `{SRC-16 PKG-12}`.

This is the same fixture-versus-trust-trigger drift already recorded for verify5 / verify6 / verify7
/ phase5-intelligence / phase7-pricing in [WORK_TRAIL.md](../WORK_TRAIL.md). Re-earning them must be
done by sourcing the fixtures through verified promotion, **never** by weakening
`awards_require_verified_fact` or `contracts_require_verified_fact`.

---

## Blockers and honest limits

- **The command center is correct and nearly empty, because the corpus is.** Of 12 contracts, **9
  have no `verified_end_on` at all**, 2 are expired and exactly 1 is active. Every renewal bucket
  except `EXPIRED` is zero, so the 180/120/90/60/30 queue — the actual point of the feature — has
  **never been exercised against real data in the browser**. Those branches are proven by the
  acceptance script only. Growing `verified_end_on` coverage through verify→promote is what turns
  this from a correct surface into a useful one.
- **Active Contract Value has never been displayed.** Zero contracts carry an award NTE ceiling and
  zero carry a purchase order, so the total has only ever been exercised in its withheld state, and
  every value cell in the portfolio is a dash. This is the honest output, not a rendering bug.
- **Options and exercised status are not modelled.** `contract_options` records a label and an
  `exercise_by` date. Whether an option was *exercised* is not recorded anywhere, so the UI counts
  options on file and refuses to say how many remain. "Option remaining" from the original spec
  cannot be built without a schema change, and P10 did not make one.
- **Amendments carry no amount.** `contract_amendments` has no value column, so an amendment can
  never move Original or Current value. Current value moves only when a purchase order is recorded.
  If L&P's real amendments change contract value, that is a genuine schema gap to raise from pilot
  evidence — not something to infer.
- **Readiness reads `compliance_items` only.** It is company-level compliance, not
  solicitation-specific eligibility, and it does not know what a given rebid will require.
- **The rebid clone path has not been executed end to end in this session.** The code is unchanged
  from its previously working state and the no-pricing-copy guarantee is grep-asserted, but the
  button itself was not clicked here.
- **`refresh_contract_alerts` runs under the caller's RLS on the renewals view and on the cron
  schedule.** A contract in an org nobody visits gets its buckets refreshed by the cron only.

## External references

Consulted for this task under the three-repo limit. **No upstream source was copied from any of
them.** Licenses were checked against the live repository metadata on 2026-08-21.

| Reference | License (verified 2026-08-21) | Outcome |
| --- | --- | --- |
| [CatalogIT](https://github.com/jonymaster/catalogIT) | **MIT** | Renewal-date-risk, bucket-and-queue and audit-trail framing adopted as a **pattern** — see [reference-repos/catalogit.md](../reference-repos/catalogit.md) |
| [Public-Sector CLM](https://github.com/benjaminbellman/contract-lifecycle-management) | **No license file** — reference-only | Amendment / option / renewal / closeout lifecycle vocabulary used as a **checklist**; its request→draft→approval→signature stages **declined** — see [reference-repos/public-sector-clm.md](../reference-repos/public-sector-clm.md) |
| [Whereas](https://github.com/zgbrenner/whereas) | **GPL-3.0** (registry said AGPL; corrected) | Append-only version-timeline and explicit-human-review framing adopted as a **pattern**; clause extraction, playbook deviation and embedded e-signature **declined** — see [reference-repos/whereas.md](../reference-repos/whereas.md) |

**This is not a CLM.** P10 deliberately did not adopt drafting, redlining, clause libraries, approval
routing or e-signature. This product records what a buyer awarded and what L&P must decide next; it
does not author or execute contracts.
