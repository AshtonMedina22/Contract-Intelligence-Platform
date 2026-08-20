# Phase 10 acceptance

> **Legacy engineering Phase 10 → Canonical product Phase 6 (partial).** Tables + thin UX; **KEEP + FREEZE** — not operational market intelligence without verified corpus.

Evidence-backed win/loss, competitor bids, and research facts. Dashboard counts come from Postgres, not placeholders.

## What landed

- Tables: `win_loss_reviews`, `competitors`, `competitor_bids`, `research_facts`
- `documented_reason` cannot equal `internal_analysis`
- Competitor bids require a document, fact, or URL
- Research `HUMAN_VERIFIED` requires `verified_by` + `verified_at`
- `promote_intelligence_from_fact` — HUMAN_VERIFIED only; wired from the verification workbench
- UI: `/overview` KPIs, `/intelligence/win-loss`, `/intelligence/competitors`, `/intelligence/clients`, `/intelligence/analytics`

## Checks

```bash
npm run test:phase10-win-loss
npm run typecheck
```

## Out of scope (still true)

Chatbot, invented competitor prices, paid browser research, Glide, Tiptap, hybrid RAG (Phase 11).
