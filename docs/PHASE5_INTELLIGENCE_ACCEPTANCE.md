# Phase 5 acceptance — Cross-corpus Intelligence

**Canonical product Phase 5** (Buyer / Competitor / Market / Pricing / Win-Loss / Content / Reports).

Legacy engineering Phase 5 = verification (`PHASE5_ACCEPTANCE.md` / `test:phase5-verification`) — **different**. Legacy Phase 10 win/loss tables remain the promote foundation (`test:phase10-win-loss`).

## What landed

- Global Intelligence tabs: Buyers | Competitors | Market | Pricing | Win/Loss | Content | Reports
- **Buyers** = procurement portfolio (solicitations, awards, contracts, win/loss, research) — **not CRM**
- **Competitors** = sourced bids + pricing lines + evaluation scores/rank
- **Market** = verified awards / win-loss / bids / pricing lines / alerts — **no document-count market share**
- **Win/Loss** = prices, scores (joined), rank, documented reason ≠ internal analysis, `lessons_learned`
- **Content** = verified chunks with reuse `APPROVED | REVIEW_REQUIRED | DO_NOT_USE | SUPERSEDED`
- **Public research** retains URL / org / document / date / excerpt / verification
- **Pursuit Overview** surfaces `PursuitIntelligenceSummary` from the same verified tables
- Migration `20260820700000_phase5_intelligence_honesty.sql`

## Checks

```bash
node --env-file=apps/web/.env.local scripts/apply-phase5-intelligence-migration.mjs
npm run test:phase5-intelligence
npm run test:phase10-win-loss
npm run lint
npm run typecheck
npm run build
```

## Honesty rules

- Never treat document counts as market share
- Never infer causation without evidence
- Blank when evidence is missing

## Out of scope (Phase 6+)

AI report generators, Ask GPT synthesis expansion, inventing geo/services without evidence.
