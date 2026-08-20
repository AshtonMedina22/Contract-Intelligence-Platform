# VERIFY 7 — Pricing acceptance

**Phase:** Canonical Phase 7 — Pricing Intelligence  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify7`  
**Artifact:** [verify7-results.json](../benchmarks/verify7-results.json)

---

## Verdict

**PASS**

Independent acceptance that buyer requested ≠ submitted ≠ awarded ≠ current; formats/cost build/base-options-escalation; competitor isolation; comps rationale; source reachability; missing cost stays missing; observed ranges from included verified records; human-only final bid; Pursuit vs Intelligence distinct.

---

## PASS / FAIL by domain

| Domain | Result | Score |
| --- | --- | --- |
| surface | **PASS** | 8/8 |
| distinct | **PASS** | 2/2 |
| human | **PASS** | 3/3 |
| comps | **PASS** | 3/3 |
| ranges | **PASS** | 2/2 |
| truths | **PASS** | 2/2 |
| formats | **PASS** | 1/1 |
| periods | **PASS** | 2/2 |
| cost | **PASS** | 2/2 |
| missing | **PASS** | 1/1 |
| competitor | **PASS** | 1/1 |
| source | **PASS** | 2/2 |

---

## Assertion matrix

| Domain | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| surface | exists pricing-glide-grid.tsx | **PASS** | apps/web/components/opportunity-workspace/pricing-glide-grid.tsx | — |
| surface | exists pricing-workbench.tsx | **PASS** | apps/web/components/opportunity-workspace/pricing-workbench.tsx | — |
| surface | exists pricing-comparables.tsx | **PASS** | apps/web/components/opportunity-workspace/pricing-comparables.tsx | — |
| surface | exists final-bid-panel.tsx | **PASS** | apps/web/components/opportunity-workspace/final-bid-panel.tsx | — |
| surface | exists page.tsx | **PASS** | apps/web/app/(platform)/procurement/opportunities/[opportunityId]/pricing/page.tsx | — |
| surface | exists page.tsx | **PASS** | apps/web/app/(platform)/intelligence/pricing/page.tsx | — |
| surface | exists pricing-math.ts | **PASS** | apps/web/lib/opportunity/pricing-math.ts | — |
| surface | exists 20260820900000_phase7_pricing_intelligence.sql | **PASS** | supabase/migrations/20260820900000_phase7_pricing_intelligence.sql | — |
| distinct | Pursuit Pricing and Intelligence Pricing are distinct surfaces | **PASS** | separate routes + copy | pricing pages |
| human | Final bid UI requires explicit human action | **PASS** | FinalBidPanel + savePricingDecision | final-bid-panel + actions |
| human | No LLM/automation path sets HUMAN_APPROVED final bid | **PASS** | ask/cron lack pricing_decisions writes; trigger + actions require human | synthesize + cron + migration + actions |
| comps | Comparables UI requires include/exclude rationale | **PASS** | reason input + FactRef | pricing-comparables.tsx |
| ranges | Observed ranges computed from included comparable rows only | **PASS** | summarizeComparableRates defaults onlyIncluded | pricing-math.ts |
| truths | buyer requested != submitted != awarded != current (+ internal cost distinct) | **PASS** | {"id":"4813cde2-a035-44ec-a7de-b69cd6fdb521","requested_rate":28,"internal_cost_rate":24.1,"proposed_rate":31.5,"awarded_rate":30.25,"current_rate":30.75,"requested_source_fact_id":"5c7adcba-b2b6-443a-9a8b-f6568a6575e1", | pricing_lines five columns |
| formats | Different pricing formats can coexist on one opportunity | **PASS** | {"inserted":4,"rateTypes":["standard","overtime","holiday","equipment","extended_hours"]} | PKG-01/10-style grain |
| periods | Base / options / escalation work as coexisting verified structures | **PASS** | {"sites":["Base Year 1","Option Year 1","Year 2 CPI-W escalation"],"rates":[["Base Year 1",64000],["Option Year 1",65280],["Year 2 CPI-W escalation",66585.6]]} | site_or_post grain + structure hints |
| periods | Structure hints declare base/options and escalation | **PASS** | PRICING_STRUCTURE_HINTS | types.ts / workbench |
| cost | Labor/component cost build-up works (cost model + internal cost != submitted) | **PASS** | {"direct":25.55,"loaded":30.9053,"planned":36.3592,"line":{"internal_cost_rate":30.9053,"proposed_rate":null}} | pricing_cost_models + internal_cost_rate |
| cost | PKG-09-style cost_build_components stack persists with source linkage | **PASS** | {"n":4,"sum":24.970000000000002} | cost_build_components |
| missing | Missing cost data remains missing (nulls not fabricated) | **PASS** | {"base_wage":15,"fringe":null,"health_welfare":null,"vehicles":null,"travel":null,"workers_comp":null,"insurance":null,"overhead_pct":null} | pricing_cost_models null columns |
| competitor | Competitor pricing does not become L&P pricing_lines | **PASS** | {"compLine":"60a3e18c-df15-49e7-b5c8-aabd3ccc310f","newLp":0,"proposedDelta":0,"unsourcedBlocked":true} | competitor_pricing_lines isolation |
| comps | Comparables show inclusion/exclusion rationale | **PASS** | {"judgments":[{"source_pricing_line_id":"4813cde2-a035-44ec-a7de-b69cd6fdb521","included":true,"reason":"Same buyer class and armed category — include as comparable win"},{"source_pricing_line_id":"9e3936d3-1205-4eeb-ba1 | pricing_comparable_judgments |
| comps | Empty comparable reason rejected at persistence layer | **PASS** | new row for relation "pricing_comparable_judgments" violates check constraint "pricing_comparable_judgments_reason_nonblank" | pricing_comparable_judgments.reason |
| ranges | Observed ranges calculated from selected (included) verified records | **PASS** | {"awardedObs":{"n":2,"min":29,"max":30.25,"median":29.625},"proposedIncludedOnly":[31.5,29.5],"proposedAll":[31.5,40,29.5]} | include/exclude filter |
| source | Source evidence is reachable (fact → document → verification UI) | **PASS** | {"factId":"5f964a97-ab70-407b-90b1-0e37f0824784","documentId":"26b84237-666b-44b4-a088-268bcb00fdad","lineFact":"5f964a97-ab70-407b-90b1-0e37f0824784","uiFactRef":true} | pricing_lines.*_source_fact_id + FactRef |
| source | Glide five-truth matrix exposes source fact links | **PASS** | Glide links sources | pricing-glide-grid.tsx |
| human | Final price requires explicit human action (trigger + actor) | **PASS** | {"autoBlocked":"HUMAN_APPROVED pricing_decisions require decided_by","noRateBlocked":"HUMAN_APPROVED pricing_decisions require final_bid_rate or final_bid_amount","draft":"DRAFT","approved":"HUMAN_APPROVED"} | pricing_decisions_require_human |
| distinct | Pursuit pricing decisions stay opportunity-scoped; Intelligence sees cross-corpus lines | **PASS** | {"pursuitApproved":1,"distinctOppsInLines":3} | pricing_decisions vs pricing_lines aggregate |
| truths | Internal cost planning does not collapse submitted/awarded truths | **PASS** | {"proposed_rate":31.5,"internal_cost_rate":24.1,"awarded_rate":30.25} | fiveTruth line unchanged |

---

## Failures

_None._

---

## Corpus note

Live Supabase had **0** `pricing_lines` / verified price facts at audit time. Fixtures use HUMAN_VERIFIED facts shaped like pilot packages (PKG-05/10 rate grain, PKG-09 cost build, PKG-11 option/escalation labels).

---

## How to re-run

```bash
npm run test:verify7
```
