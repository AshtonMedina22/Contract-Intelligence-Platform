# P9 Full Intelligence Workbench Polish — Acceptance

**Date:** 2026-08-21
**Status:** IMPLEMENTED — verified in the browser against the live operator org (L&P Global Security).
**No migration. No new dependency. No second chatbot. No second research engine.** The Phase 5
intelligence loaders and the Phase 6 Ask/Reports engines were not rebuilt; P9 productizes the seven
secondary views on top of them and gives them one shared way to launch the existing Ask surface.

## What was actually wrong

The seven Intelligence views existed and read real tables, but as a workbench they did not hold:

- Every view invented its own numbers with no sample size beside them, so a `1` and a `2,000` looked
  equally load-bearing and nothing said the counts were not a share of a market.
- Nothing linked a view to Ask. An operator reading the Competitors table had to retype the question
  into the header and pick a purpose by hand, so the purpose was usually wrong.
- `/intelligence/buyers` was a dead URL that the data-model registry and the home Market snapshot
  both still pointed at. The live page is `/intelligence/clients`.
- The Market view had no recompete view at all, and the obvious way to build one — infer a rebid date
  from an award date plus a typical term — is a forecast, which this product may not make.
- Win/Loss showed no rate at all, which is honest, but it also never said *why* or what the rate
  would be, so the absence read as a missing feature rather than a deliberate gate.

---

## 1. `lib/intelligence/ask-launch.ts` — the one way to reach Ask

New, pure (no React, no Supabase), so the acceptance script bundles and runs the shipped code.

| Export | Contract |
| --- | --- |
| `ASK_LAUNCH_PATH` | `/intelligence/ask` — the single Ask surface. No view may build another. |
| `ASK_LAUNCH_VIEWS` | The seven launch slugs and their labels: `market`, `clients`, `competitors`, `pricing`, `win-loss`, `content`, `reports`. |
| `askLaunchViewFromParam` | Own-property lookup (`Object.hasOwn`) on that map. `toString`, `constructor`, `__proto__`, `Competitors` and `../../etc` all return `null`, so an arbitrary string can never be reflected into the Ask banner. |
| `buildAskHref` | The only href builder. Emits `mode`, `purpose`, then `q`, `opportunity`, `report`, `from`, `context` in a fixed order via `URLSearchParams`, so a chip href is stable and diffable. |
| `purposeFromParam` fallback | An unknown or absent purpose becomes `defaultPurposeForMode(mode)`. A bogus purpose never travels to the Ask page as-is, so a chip cannot widen retrieval past a purpose the model knows. |
| `ASK_CHIP_PURPOSE` | The purpose each view asks with: `market → REPORT_GENERATION`, `clients → GENERAL_QA`, `competitors → COMPETITOR_ANALYSIS`, `pricing → PRICING_ANALYSIS`, `win-loss → LOSS_ANALYSIS`, `content → LOCATE`, `reports → REPORT_GENERATION`. A chip with no explicit purpose inherits its view's. |
| `serializeAskContext` / `parseAskContext` | The view's displayed filters and counts round-trip as one `context` param (`key=value; key=value`, sorted). Blank and absent values are dropped rather than sent as empty params. |
| `ASK_LAUNCH_NOTE` | The sentence rendered under every chip group: the chips open the existing Ask surface, there is no second chatbot and no second research engine, and **the filters travel as displayed context only and do not narrow retrieval.** |

`context` is provenance, not a query. Retrieval scope is still the purpose plus RLS. The Ask banner
says exactly that, so an operator cannot read a context string as a filter that was applied.

**One Ask backend, asserted by grep:** no Intelligence view imports a chat client, a research
provider, or `tavily`/`exa.ai`/`serper`/`perplexity`, and no view builds an Ask URL by string
concatenation.

## 2. `lib/intelligence/observations.ts` — the honesty primitives

| Export | Contract |
| --- | --- |
| `HONESTY_STRIP_TEXT` | "Verified observations only; not market share. Every figure is a count of records in this tenant's verified corpus, with its sample size stated. Nothing here is a forecast, an estimate of market size, or a claim about cause." Rendered on all seven views. |
| `NO_MARKET_SHARE_NOTE` | "Counts are observations in this corpus, not market share." |
| `observationTile` | Every tile gets `sample = "n=<value> <unit>"` and a named `source` table. A tile literally cannot be constructed without its own sample count, so no tile can read as a rate. |
| `EvidenceBasis` + `EVIDENCE_BASIS_NOTES` | `OBSERVED` = read directly from a verified record. `INFERENCE` = derived by joining verified records; the join is stated and the conclusion is in no single source. |
| `MIN_WIN_RATE_SAMPLE` = **20** | At n = 20 the widest 95% Wilson interval on a proportion is roughly ±21 points. Below that the interval is wider than the range an operator would act on, so the rate is withheld entirely rather than shown with a caveat nobody reads. |
| `summarizeWinLoss` | Counts by outcome, `won`, `lost`, `decided`, `undecided`, and either a rate with a 95% Wilson interval or `winRatePercent: null` plus a `withheldReason` naming the current decided count. Never a placeholder zero. |
| `observedSpan` | Min/max with `count`. There is no "typical", "median" or "expected" rate anywhere in P9. |

## 3. Every KPI definition on the workbench

Each tile is a `COUNT` over one RLS-scoped table in the current organization, rendered with its own
`n=` and its source. `basis` is `OBSERVED` unless stated.

### Market (`/intelligence/market`)

| KPI | Definition | Source | Basis |
| --- | --- | --- | --- |
| Verified awards | Rows in `awards` | `awards` | OBSERVED |
| Win/loss reviews | Rows in `win_loss_reviews` | `win_loss_reviews` | OBSERVED |
| Documented wins | Rows in `win_loss_reviews` with `outcome = 'WON'` | `win_loss_reviews.outcome=WON` | OBSERVED |
| Sourced competitor bids | Rows in `competitor_bids` (the `competitor_bids_has_source` check means each already carries a source) | `competitor_bids` | OBSERVED |
| Verified pricing lines | Rows in `pricing_lines` | `pricing_lines` | OBSERVED |
| Buyers on file | Rows in `clients` | `clients` | OBSERVED |
| Competitors named | Rows in `competitors` | `competitors` | OBSERVED |
| Market recompetes observed | Radar rows whose holder is **not** L&P | `awards ⋈ contracts ⋈ options` | **INFERENCE** |

**No market-share KPI exists**, and no document-count KPI was added — the Phase 5 rule that Market
counts verified records, never documents, is unchanged and asserted by grep.

### Buyers (`/intelligence/clients`)

| KPI | Definition | Source | Basis |
| --- | --- | --- | --- |
| Buyers on file | Rows in `clients` | `clients` | OBSERVED |
| Buyers with evidence | Buyers with at least one joined solicitation, award or contract | `clients ⋈ opportunities/awards/contracts` | **INFERENCE** |
| Buyers with a recorded outcome | Buyers with ≥ 1 `win_loss_reviews` row | `win_loss_reviews` | OBSERVED |
| Sourced research facts | Rows in `research_facts` for this org | `research_facts` | OBSERVED |

A buyer row counts records joined to that agency. It says nothing about relationship strength or
likelihood of award — stated on the page. **Not CRM:** no contacts, no cadence, no pipeline stage.

### Competitors (`/intelligence/competitors`)

| KPI | Definition | Source | Basis |
| --- | --- | --- | --- |
| Competitors named | Rows in `competitors` | `competitors` | OBSERVED |
| Observed bids | Rows in `competitor_bids` | `competitor_bids` | OBSERVED |
| Competitor pricing lines | Rows in `competitor_pricing_lines` | `competitor_pricing_lines` | OBSERVED |
| Competitors with a priced bid | Distinct competitors appearing in `competitor_bids` | `competitor_bids ⋈ competitors` | **INFERENCE** |

Not a corporate win rate. Geography and services appear only when those fields exist on the evidence.

### Pricing intelligence (`/intelligence/pricing`)

| KPI | Definition | Source | Basis |
| --- | --- | --- | --- |
| Verified L&P lines | Rows in `pricing_lines` | `pricing_lines` | OBSERVED |
| Lines with an awarded rate | `pricing_lines` where `awarded_rate IS NOT NULL` | `pricing_lines.awarded_rate` | OBSERVED |
| Sourced competitor rates | Rows in `competitor_pricing_lines` | `competitor_pricing_lines` | OBSERVED |
| Human-approved bid decisions | `pricing_decisions` where `status = 'HUMAN_APPROVED'` | `pricing_decisions.status=HUMAN_APPROVED` | OBSERVED |
| Observed rate span | `min`/`max` of present rates with `n` stated | `observedSpan` | OBSERVED |

A rate span is the observed minimum and maximum with `n` stated. It is **not** a recommendation and
not a typical rate.

### Win/Loss (`/intelligence/win-loss`)

| KPI | Definition | Source |
| --- | --- | --- |
| Reviews on file | Rows in `win_loss_reviews` | `win_loss_reviews` |
| Documented wins | `outcome = 'WON'` | `outcome=WON` |
| Documented losses | `outcome = 'LOST'` | `outcome=LOST` |
| Not decided (excluded from any rate) | `outcome ∈ {NO_BID, CANCELLED, NO_AWARD, PENDING}` | same |
| **Win rate** | `WON ÷ (WON + LOST)` over `win_loss_reviews` in this tenant. `NO_BID`, `CANCELLED`, `NO_AWARD` and `PENDING` are excluded from **both** sides, so the denominator is decided pursuits, not all pursuits. **Shown only at ≥ 20 decided pursuits**, and then with a 95% Wilson interval. Below the threshold the view prints the observed counts, the reason, and the current decided count. | `win_loss_reviews.outcome` |

The rate is computed over the **whole corpus**, never over the filtered table — the outcome filter
changes the table only, and the page says so. Asserted by check.

### Content (`/intelligence/content`)

| KPI | Definition | Source |
| --- | --- | --- |
| Hits returned | Passages returned by the current purpose-aware search | `document_chunks` |
| APPROVED | Hits with `reuse_status = 'APPROVED'` | `reuse_status` |
| REVIEW_REQUIRED | Hits with `reuse_status = 'REVIEW_REQUIRED'` | `reuse_status` |
| DO_NOT_USE + SUPERSEDED | Hits in either excluded state | `reuse_status` |

These count the **current result set**, not the corpus, so the tiles move with the query — the tile
sample makes that visible. Drafting gates are unchanged and restated on the page:
`PROPOSAL_DRAFTING` excludes `DO_NOT_USE`, `SUPERSEDED` and non-current versions.

### Reports (`/intelligence/reports`)

Not a metric surface. All **eight** report kinds are exposed, each with its purpose, its data cutoff
(`generatedAt`), the scope it queried, its sources, its limitations, and an `Open in Ask` launch:
executive, market, competitor, pricing, buyer, win/loss, bid strategy, proposal improvement.

## 4. Recompete Radar — `lib/intelligence/recompete-radar.ts`

Built only from `awards`, `contracts`, `contract_options`, `renewals`, `opportunities`, `clients` and
`win_loss_reviews`. **There is no prediction model.**

| Column | Definition |
| --- | --- |
| Buyer | `contracts.client_id` or `opportunities.client_id` → `clients.name` |
| Incumbent | `awards.winner_name` (basis: *buyer award notice*), else `win_loss_reviews.winner_name` (basis: *recorded outcome*). **Only named when a record names it**, and the basis is always printed. |
| Contract | `contracts.contract_number` → `contracts.title` → `opportunities.title` → `Unlabelled contract` |
| Expiration | `contracts.verified_end_on` only |
| Options | `contract_options.label` + `exercise_by`; next date is the earliest of `contract_options.exercise_by` and `renewals.notice_due_on` |
| **Expected rebid** | `contracts.verified_end_on`, else the earliest option exercise-by / renewal notice date, else **`null` with the reason printed**. It restates a verified date and names the field. It is **never** inferred from a term length, a typical cycle, or an award date. |
| Source | Link to `/ingestion/verification/<documentId>` for the award or contract document, or the fact id when only a fact exists, or the solicitation `source_url`. When there is none the row says so. |
| Data status | `VERIFIED` needs incumbent **and** expiration **and** a source together; `PARTIAL` = any one of them; `UNKNOWN` = only buyer and contract. |

**The two lists never merge.** A `contracts` row in this tenant is L&P's own contract, so the row is
`L_AND_P` and is excluded from `market`; a `win_loss_reviews.outcome = 'WON'` does the same; and
`L_AND_P_NAME_RE` catches L&P named in a buyer's own winner field. The Market view renders
`Market radar — recompetes observed in the corpus` and links `L&P-held renewals` →
`/contracts/renewals` as a separate queue with its own scope note.

Filters offer only values the corpus actually has (`facets` is computed from present rows) over the
two fields the schema already carries — `opportunities.service_type` and `opportunities.site_location`
— plus an expected-rebid date window. **A date filter drops rows whose rebid timing is unknown rather
than assuming one.** Rows sort by the soonest known date with unknowns last.

## 5. Ask page — context, not a rebuild

`mode`, `purpose` and `q` are honored from the query string; an unknown purpose falls back to the
mode default. When `from` is a registered view the page renders a `data-testid="ask-context-banner"`
naming the view, linking back to it, listing the view context, and stating that **context is shown
for provenance only — it did not narrow retrieval.** `from` and `context` survive a resubmit of the
mode form as hidden inputs. The dual-rail agent, `AskChatClient`, LOCATE's no-LLM path and REPORT's
SQL path are untouched.

## 6. `/intelligence/buyers`

Now a `permanentRedirect` to `/intelligence/clients`, and the two live pointers were corrected:
`lib/data-model/registry.ts` (`clients` and `research_facts` rows) and
`components/home/market-snapshot.tsx`. Old bookmarks keep working; nothing still treats
`/intelligence/buyers` as a live route.

---

## Test evidence

| Suite | Result |
| --- | --- |
| `npm run test:p9-intelligence-workbench` (new) | **40/40 PASS** |
| `npm run test:phase6-ask` | **46/46 PASS** |
| `npm run test:phase10-win-loss` | **13/13 PASS** |
| `npm run test:phase11-hybrid-rag` | **10/10 PASS** |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — all nine Intelligence routes Partial Prerender |
| `npm run test:phase5-intelligence` | 24/25 — **pre-existing**, see below |
| `npm run test:verify5` | 22/24 — **pre-existing**, see below |
| `npm run test:verify6` | 23/24 — **pre-existing**, see below |

### Browser verification (IronBee, live operator org)

All nine routes returned **200 with no error overlay and no app console errors**:

- `/intelligence/buyers` resolved to `/intelligence/clients` (redirect proven in the browser, not
  just in code).
- The honesty strip rendered on all seven data views; the market-share grep found nothing on any.
- Market: eight tiles each with `n=`, `Market recompetes observed` correctly tagged `INFERENCE`,
  `Market radar` labelled separately from the `L&P-held renewals` link, and radar status
  `verified 0 · partial 4 · unknown 0` on the live corpus. `?service=Unarmed+Guard&geo=TX&window=365`
  filtered `4 → 0 of 4 rows` and printed the honest empty state instead of widening the match.
- Win/Loss: **`Win rate withheld — sample too thin … Decided so far: 0`** with no percentage anywhere
  on the page, the four counts including `Not decided (excluded from any rate) n=1`, and
  `Filtering changes the table only`.
- Ask: `from=competitors&context=bids%3D21%3B+scores%3D8` rendered
  *"Launched from Intelligence · Competitors … View context: bids=21 · scores=8 … Context is shown for
  provenance only — it did not narrow retrieval"*, with `purpose=COMPETITOR_ANALYSIS` selected and
  both values preserved as hidden inputs.
- `from=toString` rendered **no banner and did not crash** (the `Object.hasOwn` guard).
- `purpose=NOT_A_PURPOSE` on `mode=locate` fell back to `LOCATE`.

**Zero writes.** Every browser step was a read; no row was created, updated or deleted.

### Pre-existing failures, reproduced not caused

None of these touch a file P9 changed, and all three are the same fixture-versus-trust-trigger drift
already recorded for verify7 / phase7 / phase4 in [WORK_TRAIL.md](../WORK_TRAIL.md).

1. **`verify6` `[automation] Renewal/compliance checks use verified dates`** — the failure message is
   literally *"contracts.source_fact_id is required (create via verified promotion, not blank
   insert)"*. The fixture does a bare `contracts.insert`, which the `20260821120000` trust trigger
   correctly rejects.
2. **`verify5` `[buyer] Buyer history connects multiple contracts — contracts=0`** — same cause: two
   bare `contracts.insert` calls at `scripts/verify5-intelligence-acceptance.mjs:299` and `:309` with
   no `source_fact_id`, so both return null and the buyer has no contracts to join.
3. **`verify5` `[pursuit] Pursuit Overview consumes intelligence summary`** — a stale grep against
   `opportunities/[opportunityId]/page.tsx`, which P5 recomposed and whose `phase5` equivalent was
   already updated. That file is untouched by P9.
4. **`phase5-intelligence` `[schema] reuse_status accepts REVIEW_REQUIRED`** — already recorded as
   reproducing identically on a clean `HEAD` worktree; its fixture chunk points at a
   non-`HUMAN_VERIFIED` fact.

The committed `docs/benchmarks/verify5-results.json` and `verify6-results.json` said **PASS**; both
scripts rewrote themselves to **FAIL** on this run. The regenerated files are the honest current
state and were kept. **Fixing those fixtures and re-earning VERIFY 5 / VERIFY 6 is its own task** —
it must be done by sourcing the fixture contracts through verified promotion, never by weakening
`contracts_require_verified_fact`.

---

## Blockers and honest limits

- **The radar is only as good as the corpus.** On the live org all four market rows are `PARTIAL`,
  and each one earns that on the strength of an award-document source alone: the incumbent is **not**
  named on any row and `contracts.verified_end_on` is absent on all four, so `expected rebid` reads
  `unknown` on every row and each row prints `missing: incumbent, verified expiration, options`. That
  is the correct output, not a bug — the radar refuses to guess a holder or a date it has no record
  for — but it means the radar cannot yet be used to plan a pursuit calendar. Growing
  `awards.winner_name` and `verified_end_on` coverage through verify→promote is what makes it useful.
- **The win rate has never been shown.** The corpus has 1 review and 0 decided pursuits, so the gate
  has only ever been exercised in its withholding state in the browser; the rate-and-interval branch
  is proven by the acceptance script only.
- **`observedSpan` on the live corpus spans `6.00 – 4,722,008.00 (n=31)`**, which is a corpus-quality
  finding, not a pricing insight: `pricing_lines` on the pilot packages mixes hourly rates with
  annual contract totals in one column. The span is reported honestly with its `n`, and no median or
  typical rate is derived from it, but **the promoter's rate-versus-total mapping needs fixing**
  before this number means anything to an operator.
- **Content tiles count the result set, not the corpus.** Correct and labelled, but an operator
  comparing two searches is comparing two samples.
- Reports still generate from the existing Phase 6 SQL generators. P9 polished their catalog,
  cutoff and Ask launch; it did not audit the eight generators' internals.

## External references

| Reference | License (verified 2026-08-21) | Outcome |
| --- | --- | --- |
| [Rival](https://github.com/tessak22/rival) | **MIT** | Competitor-view density and per-competitor brief launch adopted as a **pattern**; its Tabstack-powered scan/Deep-Dive research rail **declined** — see [reference-repos/rival.md](../reference-repos/rival.md) |
| [Morphic](https://github.com/miurla/morphic) | **Apache-2.0** | Contextual-launch and provenance-banner framing adopted as a **pattern**; no second Ask surface, no second research engine — see [reference-repos/morphic.md](../reference-repos/morphic.md) |
| [Tremor](https://github.com/tremorlabs/tremor) | **Apache-2.0** | **Declined again, nothing installed** — see [reference-ux/tremor.md](../reference-ux/tremor.md) |

No upstream source was copied from any of the three.
