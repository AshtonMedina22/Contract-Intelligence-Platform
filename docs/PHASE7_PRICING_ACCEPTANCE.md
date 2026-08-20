# Phase 7 acceptance — Pricing Intelligence

**Canonical product Phase 7** (Pursuit Pricing workbench + Intelligence Pricing).

Legacy engineering Phase 7 = four-truth promote (`test:phase7-four-truth`) — **related foundation**, not this exit.

## What landed

### A. Pursuit → Pricing
- Glide Data Grid workbench with five separate truths: Buyer requested · L&P internal cost · L&P submitted · Buyer awarded · Current/amended
- Structure grain: rate type, site/post, unit, quantity, extended
- Internal cost model: wage, fringe, H&W, burden, workers comp, insurance, supervision, equipment, vehicles, travel, overhead, wage determination, target margin, cost floor
- Comparables with include/exclude + required reason; observed range/median/avg; confidence/data sufficiency
- **Final bid = human decision** via `pricing_decisions` (`DRAFT` | `HUMAN_APPROVED` with `decided_by`)

### B. Intelligence → Pricing
- Cross-corpus L&P five-truth lines + sourced competitor lines + human-approved decision count
- Explicit guidance to price live solicitations on Pursuit → Pricing (not forced out of pursuit)

Migration: `supabase/migrations/20260820900000_phase7_pricing_intelligence.sql`

## Checks

```bash
node --env-file=apps/web/.env.local scripts/apply-phase7-pricing-migration.mjs
npm run test:phase7-pricing
npm run test:phase7-four-truth
npm run lint
npm run typecheck
npm run build
```

## Honesty rules

- AI never sets `HUMAN_APPROVED`
- Internal cost does not overwrite submitted/proposed rates
- Comparables never invent market medians without verified lines
- Blank cost fields stay blank
- Comparable include/exclude reasons must be non-blank at DB (`pricing_comparable_judgments_reason_nonblank`)
- Glide five-truth matrix exposes per-truth `source_fact` verification links

## VERIFY 7

**PASS** — [VERIFY7_ACCEPTANCE.md](pilot/VERIFY7_ACCEPTANCE.md) (`npm run test:verify7` 29/29).

## Out of scope (Phase 8+)

Response Builder / Tiptap drafting, submission authorization workflow, inventing absent wage determinations.
