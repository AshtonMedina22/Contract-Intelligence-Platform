# VERIFY 7 — Pricing acceptance

**Phase:** Canonical Phase 7 — Pricing Intelligence  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify7`  
**Artifact:** [verify7-results.json](../benchmarks/verify7-results.json)

---

## Verdict

**FAIL**

Independent acceptance that buyer requested ≠ submitted ≠ awarded ≠ current; formats/cost build/base-options-escalation; competitor isolation; comps rationale; source reachability; missing cost stays missing; observed ranges from included verified records; human-only final bid; Pursuit vs Intelligence distinct.

---

## PASS / FAIL by domain

| Domain | Result | Score |
| --- | --- | --- |
| surface | **PASS** | 8/8 |
| distinct | **PASS** | 1/1 |
| human | **PASS** | 2/2 |
| comps | **PASS** | 1/1 |
| ranges | **PASS** | 1/1 |
| truths | **PASS** | 1/1 |
| formats | **PASS** | 1/1 |
| periods | **FAIL** | 1/2 |
| cost | **PASS** | 2/2 |
| missing | **PASS** | 1/1 |
| competitor | **PASS** | 1/1 |
| fatal | **FAIL** | 0/1 |

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
| truths | buyer requested != submitted != awarded != current (+ internal cost distinct) | **PASS** | {"id":"fe7bcff4-4a43-405c-a1fe-0b80852b71ff","requested_rate":28,"internal_cost_rate":24.1,"proposed_rate":31.5,"awarded_rate":30.25,"current_rate":30.75,"requested_source_fact_id":"77003c4f-ba9c-400b-a04b-cf588c998ab7", | pricing_lines five columns |
| formats | Different pricing formats can coexist on one opportunity | **PASS** | {"inserted":4,"rateTypes":["standard","overtime","holiday","equipment","extended_hours"]} | PKG-01/10-style grain |
| periods | Base / options / escalation work as coexisting verified structures | **FAIL** | {"sites":[],"err":"pricing_lines.awarded_rate requires HUMAN_VERIFIED awarded_source_fact_id"} | site_or_post grain + structure hints |
| periods | Structure hints declare base/options and escalation | **PASS** | PRICING_STRUCTURE_HINTS | types.ts / workbench |
| cost | Labor/component cost build-up works (cost model + internal cost != submitted) | **PASS** | {"direct":25.55,"loaded":30.9053,"planned":36.3592,"line":{"internal_cost_rate":30.9053,"proposed_rate":null}} | pricing_cost_models + internal_cost_rate |
| cost | PKG-09-style cost_build_components stack persists with source linkage | **PASS** | {"n":4,"sum":24.970000000000002} | cost_build_components |
| missing | Missing cost data remains missing (nulls not fabricated) | **PASS** | {"base_wage":15,"fringe":null,"health_welfare":null,"vehicles":null,"travel":null,"workers_comp":null,"insurance":null,"overhead_pct":null} | pricing_cost_models null columns |
| competitor | Competitor pricing does not become L&P pricing_lines | **PASS** | {"compLine":"b70934b4-b50a-4a1a-8561-59aa75104b0f","newLp":0,"proposedDelta":0,"unsourcedBlocked":true} | competitor_pricing_lines isolation |
| fatal | suite error | **FAIL** | Cannot read properties of null (reading 'id') | — |

---

## Failures

- **[periods] Base / options / escalation work as coexisting verified structures** — {"sites":[],"err":"pricing_lines.awarded_rate requires HUMAN_VERIFIED awarded_source_fact_id"}
- **[fatal] suite error** — Cannot read properties of null (reading 'id')

---

## Corpus note

Live Supabase had **0** `pricing_lines` / verified price facts at audit time. Fixtures use HUMAN_VERIFIED facts shaped like pilot packages (PKG-05/10 rate grain, PKG-09 cost build, PKG-11 option/escalation labels).

---

## How to re-run

```bash
npm run test:verify7
```
