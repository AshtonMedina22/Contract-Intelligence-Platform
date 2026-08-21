# P5 Pursuit Overview + Bid Strategy — Acceptance

**Date:** 2026-08-21
**Status:** IMPLEMENTED — verified against the live operator org on two pursuits (one with a real
ingested packet, one empty). No schema change. No new pursuit tab. No LLM call added.

## Overview

The pursuit Overview used to be a metadata form with a gaps list beside it. It now answers, in reading
order, the questions an operator actually opens a pursuit to ask:

| Section (anchor) | Answers |
| --- | --- |
| Solicitation summary (`#solicitation-summary`) | What is this, who is the buyer, when is it due |
| Scope and requirements (`#scope`) | What is required |
| How this is scored (`#evaluation`) | How it is scored, and who scored what |
| Bid / no-bid (`#bid-decision`) | Are we bidding |
| Buyer intelligence (`#buyer`) | Who the buyer is, in our own corpus |
| Competitive intelligence (`#competitive`) | Who else is bidding; who won if that is recorded |
| Prior L&P experience (`#prior-experience`) | What L&P has done that is comparable |
| Compliance readiness (`#compliance`) | Whether we are paperwork-ready |
| Risks and missing information (`#risks`) | What is missing or unresolved |
| Bid strategy (`#bid-strategy`) | What the evidence supports |
| Next actions (`#next-actions`) | What to do next, deep-linked |

Pricing/fulfillment planning and the metadata form are still on the page, demoted into collapsed
`<details>` blocks (`#pricing-planning`, `#operational-metadata`) so the read-first record comes first.

**The rule the whole feature is built on:** every value shown is read from a row the operator can
click through to, or it is explicitly unknown. Nothing is inferred, scored, averaged into a rate, or
generated as narrative.

---

## Architecture

Three files, one of which is pure.

### `apps/web/lib/opportunity/overview-model.ts` (new, pure)

No Supabase and no React imports, so the acceptance script can bundle and exercise it directly.

| Function | Contract |
| --- | --- |
| `rollupRequirements` | Counts by `matrix_status` (including `L_AND_P_INPUT_REQUIRED`), plus mandatory / scored / sourced / unsourced / response-required / attachment-required and distinct form names. Counts only. |
| `auditEvaluationWeights` | Returns `NO_CRITERIA` \| `NO_WEIGHTS` \| `PARTIAL_WEIGHTS` \| `SUMS_TO_100` \| `DOES_NOT_SUM_TO_100` with the entered total. Never normalizes, redistributes, or infers a missing weight. |
| `readEvaluationScores` | Reads recorded scores verbatim. Reports whether max points and rank were recorded at all, and attaches a caveat naming every gap. |
| `looksLikeLpRespondent` | Name-match only (`L&P`, `L and P`, `LP Global`), used for labelling. |
| `computeComplianceReadiness` | Buckets recorded `compliance_items` by recorded expiry (`expiring` = within 60 days; `missing` = expiry already passed; `unknown` = no expiry). With no contract linked, everything is Unknown. |
| `buildBidStrategy` | Assembles cited bullets from this pursuit's own rows, or returns `INSUFFICIENT` with the canonical reason. Also returns a `withheld` list naming what could not be said. |
| `buildNextActions` | Deep links derived from what is missing. A satisfied step produces no action. |

### `apps/web/lib/opportunity/load-overview-bundle.ts` (new)

`loadOverviewBundle(opportunityId)` runs one header read, then **20 parallel RLS-scoped queries**, then
a short second wave (fact counts, compliance items, fact→document map) that depends on ids from the
first. Tenancy comes from RLS on the request-scoped client, not from a filter in this file.

Composed from existing loaders: `loadOpportunityHeader`, `loadWorkspaceSummary`, `loadPricingLines`,
`loadCostModels`, `loadStaffingRequirements`, `loadRequirementMatrix`, `loadRequirementResponses`,
`computeResponseProgress`, `listProposalPacketGaps`, `computeFulfillmentEconomics`,
`loadPursuitIntelSummary`, `loadFactDocumentMap`, `searchVerifiedKnowledge`.

Read directly: `solicitations`, `evaluation_criteria`, `evaluation_scores`, `competitor_bids` +
`competitors`, `awards`, `contracts`, `submission_packets`, `documents`, `public_sources`,
`extracted_facts` (counts), `compliance_items`, buyer-scoped `opportunities` / `contracts` / `awards` /
`win_loss_reviews`, `research_facts`, and same-service-type pursuits.

`loadOpportunityHeader` was extended to select `client_id`, `external_provider`, `external_source_id`,
`source_url`, and `public_source_id` so provenance needs no second query and no type cast.

### `apps/web/components/opportunity-workspace/overview-sections.tsx` (new)

Eleven sections over three shared primitives (`Section`, `Field`, `Value`). Dense definition lists and
tables, no cards-in-cards, no chart, no hero. Each section header carries one deep link out.

`apps/web/app/(platform)/procurement/opportunities/[opportunityId]/page.tsx` was rewritten to load the
bundle once and render `<OverviewSections>`, with pricing planning and the metadata form collapsed
below. `ProposalPacketGaps` and `PursuitIntelligenceSummary` are no longer mounted here — their content
is now the Risks and Buyer/Competitive sections. Neither component was deleted.

---

## Evidence rules

These are the rules a reviewer should hold the code to. Each is enforced in `overview-model.ts` and
asserted in `scripts/p5-pursuit-strategy-acceptance.mjs`.

1. **A blank field means "not recorded", and says so.** Every empty value renders `Not recorded` /
   `Unknown`, and the Solicitation summary states outright: *"Every blank field below means the value
   is not in the corpus, not that it is zero or absent from the solicitation."*
2. **Every bid-strategy bullet carries at least one citation.** Where a real target exists the citation
   links to it (`/ingestion/verification/<documentId>`, a competitor `source_url`, a pursuit tab);
   otherwise it names the table it came from rather than faking a link.
3. **No bullet from an absent record.** Missing evidence produces a `withheld` line naming what is
   unknown — e.g. *"No evaluation criteria recorded — the award basis is unknown."*
4. **Zero bullets means `INSUFFICIENT`, not a thinner answer.** The exact copy is: *"Insufficient
   verified, pursuit-scoped evidence to state a bid strategy. Nothing below is asserted because nothing
   above supports it."*
5. **No score, rate, share, probability, or causal claim.** The test greps generated bullets for
   `market share`, `win rate`, `market rate`, `probability`, `likely to win`, `we will win`,
   `recommend bid`, `because we`, `competitive advantage`, and `industry average`. The only permitted
   appearances are inside an explicit negation ("not a win rate").
6. **Buyer history is a count of records.** *"3 other pursuit(s), 1 award record(s), 0 contract(s),
   2 win/loss review(s). Counts of records held, not a win rate."*
7. **Competitor amounts are observed quotes.** Range and median are computed only over
   `competitor_bids` rows that actually carry a `quoted_amount`, and are labelled *"Observed quotes
   only — not a market rate and not a price recommendation."*
8. **Point totals are not an outcome.** `readEvaluationScores` states when max points and official rank
   were never recorded. `higherThanLp` is arithmetic over recorded points, described as such, and is
   refused entirely when more than one respondent name matches L&P.
9. **The incumbent is never inferred.** An `awards` row with a null `winner_name` renders *"The award
   record names no winner. The awardee and the incumbent stay unknown — neither is inferred from scores
   or amounts."*
10. **Weights are never repaired.** Partial weights report the entered total and the number of
    unweighted criteria; they are not redistributed. An empty criteria list is explicitly *not* read as
    price-only award.
11. **Compliance Unknown is the answer, not a placeholder.** With no contract linked, all four buckets
    read `unknown` and the section explains that pre-award pursuits hold no insurance/license records,
    then offers what it *can* count: requirements needing an attachment. A linked contract with zero
    items reads *"Readiness is Unknown, not compliant."*
12. **Verification status is displayed, never upgraded.** `research_facts` render with the status they
    were stored with. Staged `extracted_facts` appear only as a count in Risks, labelled *"staged, not
    canonical."* Narrative quotes come from `searchVerifiedKnowledge({ purpose: "BID_STRATEGY" })` and
    show their `reuse_status` and page.
13. **Bid/no-bid is human.** The section renders `go_no_go` and links to the form. Nothing in P5 writes
    it. Copy: *"A human decision. This platform records it and shows what is missing; it never sets
    it."*
14. **Public vs internal provenance is labelled.** A pursuit with `public_source_id` / `source_url`
    shows provider, external id, and a link to the notice; one without shows *"No public-listing
    provenance on this pursuit — it was created by an operator, not from a public notice."*

### Evaluation math audit

Requested explicitly, so: the only arithmetic P5 performs on evaluation data is (a) summing entered
`weight_pct` values and comparing the total to 100 within 0.01, and (b) counting recorded point totals
strictly greater than L&P's recorded total. Both are reported as arithmetic over recorded values with
the caveat attached. No weighted score is computed, no criterion score is derived, and no missing
weight is imputed — including the tempting `100 / n` default, which `auditEvaluationWeights never
treats unweighted criteria as equally weighted` exists to prevent.

---

## Tests

| Check | Result |
| --- | --- |
| `npm run test:p5-pursuit-strategy` (new, 26 checks) | **PASS 26/26** |
| `npm run test:phase5-intelligence` | **24/25** — one pre-existing failure, see below |
| `npm run test:phase5-verification` | **PASS 3/3** |
| `npm run test:phase6-ask` | **PASS 46/46** |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** — the pursuit Overview route still emits as Partial Prerender |

`scripts/p5-pursuit-strategy-acceptance.mjs` bundles the real `overview-model.ts` with esbuild (already
a dependency), so it exercises the same code the app runs, with no network and no database.

Two existing tests were touched:

- `scripts/phase5-intelligence-acceptance.mjs` — the check `[ui] Pursuit Overview surfaces intelligence
  summary` asserted the presence of the `PursuitIntelligenceSummary` component. Since P5 moved that
  content into the Overview bundle, the check now follows the composition: the page renders
  `OverviewSections`, the bundle calls `loadPursuitIntelSummary`, and the sections file contains both
  *Buyer intelligence* and *Competitive intelligence*. Same intent, current architecture.
- No other test file changed.

### Pre-existing failure (not caused by P5)

`[schema] reuse_status accepts REVIEW_REQUIRED` fails with *"document_chunks.source_fact_id must
reference a HUMAN_VERIFIED fact"*. Confirmed pre-existing twice: first by stashing every P5 change,
then independently by checking `HEAD` out into a separate git worktree and running that tree's own
copy of the script — **24/25 with the identical single failure**.

It is a fixture problem in that script, not a regression. `20260821090000_trust_require_verified_canonical_sources.sql`
made `document_chunks.source_fact_id` `not null` and added a trigger requiring it to reference a
`HUMAN_VERIFIED` fact; the script's chunk insert predates that migration and supplies no
`source_fact_id` at all. Fixing it means giving the fixture a verified fact to cite, which belongs
with that script rather than here.

---

## Browser verification (IronBee DevTools, `localhost:3000`, live operator org)

### Pursuit with a real packet — PKG-03 Arlington TX (`b937b54c-70d5-468e-97cf-803d2a69e5a9`)

2 documents · 12 requirements · 0 staffing · 8 pricing lines · 0 competitor bids.

Observed, and each of these is the honest reading rather than the flattering one:

- Solicitation summary shows buyer *Arlington TX*, solicitation *22-0143* with a link to its source
  document, and `Not recorded` on nine fields that genuinely are not recorded.
- No public-listing provenance — correctly reported as operator-created.
- Scope: 12 requirements, 12 mandatory, 12 carrying a source fact, 0 scored, 0 attachment-required,
  0 staffing posts with no hours entered.
- **Evaluation criteria are absent but 8 respondent scores are recorded.** The section says both:
  *"No evaluation criteria recorded… An empty criteria list is not the same as price-only award"*, and
  then shows the score table with *"maximum points not recorded; official rank not recorded. Point
  totals are not a scoring outcome."*
- The L&P row is labelled *"name matches L&P"* rather than asserted as L&P.
- An `awards` row exists with notice *Minute Order*, no `awarded_on`, and no `winner_name`. The section
  shows it and states the awardee and incumbent stay unknown. **This is the case most likely to
  produce an invented incumbent, and it does not.**
- Bid strategy returned `AVAILABLE` with 2 cited bullets (requirements obligation → Requirements
  matrix; recorded scores → the source document) and 5 withheld lines.
- Next actions: Verification (6 staged facts) → Requirements (criteria) → Response (12 mandatory
  without a draft) → Submission.
- Risks: 5 blocking, 1 check, 1 evidence line — every one a live deep link.

### Empty pursuit — PKG-05 Jefferson County (`2ea6f404-8028-46a0-8940-e4a5bacd22d0`)

0 documents · 0 requirements · 0 staffing · 0 pricing lines · 0 bids.

Every section rendered its honest empty state rather than disappearing or showing a zero as a finding:

- *"No scope captured"*, *"No respondent scores recorded. Nothing here states who scored what."*
- *"Nothing on file for Jefferson County — this is the first record we hold for this buyer. Absence of
  history is not evidence about the buyer."*
- *"No competitive evidence on this pursuit… The incumbent is unknown — it is not inferred."*
- Compliance: all buckets `unknown`, with the pre-award explanation.
- Bid strategy: `INSUFFICIENT`, with all 7 withheld lines.
- Next actions began at Intake and ran through Result — 6 actions, each with its reason.

### Functional exercise

On the empty pursuit, the collapsed metadata form was opened, **Procurement rail** set to
*TX city / county / ISD*, and saved. The read-first summary re-rendered with the new value, confirming
the form still round-trips from inside the `<details>` block and that the Overview reads the mutation
back. The change was then reverted to unset, and the summary returned to `Not recorded` with Risks back
at 7 blocking gaps — **no test data left in the live operator org.**

### Independent re-verification (2026-08-21, before commit)

Both routes reloaded clean and read back by DOM query rather than by screenshot. Arlington rendered
all eleven `section` ids in order plus the two collapsed `details` blocks; nine fields read
`Not recorded`; the `awards` row with a null winner still stated the awardee and incumbent stay
unknown; bid strategy was `AVAILABLE` with 2 bullets whose citations resolved to
`/procurement/opportunities/…/requirements` and `/ingestion/verification/3ad07085…`, plus 5 withheld
lines; 5 blocking / 1 check gaps; 4 next actions (no Result action, because an award row exists).
Jefferson County rendered the same eleven sections with every honest empty state, `INSUFFICIENT`
strategy, all 7 withheld lines, 7 blocking gaps, and 6 next actions from Intake through Result.

The pursuit tab set was read from the rendered nav on both routes: **Overview | Requirements |
Pricing | Response | Submission | Result** — six, unchanged.

### Console

**Zero errors** from either route after a clean reload, checked by sequence number so stale buffer
entries could not mask a new one. The 284 errors sitting in the buffer beforehand were 403/WebSocket
HMR noise from an earlier `127.0.0.1` dev session; 0 originated from `localhost:3000`.

---

## External references consulted

| Repo | License (verified 2026-08-21) | Outcome |
| --- | --- | --- |
| [RFPilot](../reference-repos/rfpilot.md) | **MIT** | Section taxonomy adopted (scope, deadline, criteria + weights, requirements, compliance, red flags). Generation method **rejected**: its prompts emit `overall_match_score`, `match_score`, `win_strategy_tips`, `complexity_rating`, and `estimated_contract_value` with no citation or verification state anywhere. Read as a counter-example. |
| [Open Deep Research](../reference-repos/open-deep-research.md) | **MIT** | Citation discipline adopted (one citation per claim; never invent a missing detail; attribute to sources rather than assert). Orchestration **declined** — no LangGraph, no agent loop, no model call in the Overview; `buildBidStrategy` is a pure function. Its heuristic "3+ sources" sufficiency stop was replaced with a hard zero-bullet predicate. |
| [OpenContracts](../reference-repos/opencontracts.md) | **MIT** | Already-recorded pattern reused: human verification as ground truth, and source↔fact navigation as the citation target. PAWLs coordinates deliberately not carried onto a summary screen. |

No upstream code was copied. Three repositories inspected, which is the per-task limit.

---

## Honest limitations

- **`buildBidStrategy` is composition, not analysis.** It reports what the corpus holds and links to
  it. It does not tell an operator how to win, and on a thin pursuit it correctly says nothing at all.
  That is the intended ceiling, not an unfinished state.
- **`generateIntelligenceReport("bid_strategy")` was not wired in.** The brief allowed it only if it
  returned evidence-backed content without inventing. It is a page-level narrative generator; on the
  pursuits available it would have had to write prose over the same thin rows the deterministic path
  already reports honestly. Declined rather than shipped with a caveat.
- **Narrative retrieval is lexical, not semantic.** `searchVerifiedKnowledge` is called without a
  `queryEmbedding`, so the `search_verified_knowledge` RPC runs its text path only. This is what keeps
  the Overview free of any model call, but it means a relevant verified passage that shares no keywords
  with the pursuit title / buyer / service type will be missed, and the section will honestly report
  no passages rather than the ones a vector search would have found.
- **L&P identification in `evaluation_scores` is name-matching.** `looksLikeLpRespondent` is a
  labelling aid, not an identity. Multiple matches suppress the position claim entirely, but a
  misspelled respondent name would still go unmatched.
- **Compliance readiness cannot be truthful pre-award.** There is no pursuit-level compliance store;
  `compliance_items` hang off contracts. Until that exists, Unknown is the only honest answer, and the
  section says so rather than implying readiness.
- **Buyer history is our corpus only.** Zero records means we hold nothing, not that the buyer has no
  procurement history. The section states this.
- **Prior-experience matching is exact `service_type` equality.** With `service_type` unrecorded — true
  on both verification pursuits — no similar pursuit can be matched, and the section says that instead
  of matching on title similarity.
- **Section visibility is not permissioned.** Every org member with pursuit access sees every section;
  RLS controls the rows, not which sections render.
- **20 parallel queries per Overview load.** Correct under RLS and fast enough in dev, but it is more
  round-trips than any other page in the app. If it becomes slow on a large tenant, the buyer-history
  and research-digest reads are the ones to defer.
