# Phase 9 acceptance

> **Legacy engineering Phase 9 → Canonical product Phase 4 foundation.** Schema/cron remain; full Phase 4 workspace exit is [PHASE4_ACCEPTANCE.md](PHASE4_ACCEPTANCE.md). Expiration buckets: 32 days → **60-day**; 20 days → **30-day**.

Operational contract portfolio from **verified** dates. Alerts are SQL (Supabase Cron / pg_cron), not Vercel Cron.

## What landed

- Tables: `contracts`, `contract_amendments`, `contract_options`, `renewals`, `compliance_items`, `contract_alerts`
- `promote_contract_from_fact` — HUMAN_VERIFIED only; awarded/current sources; RFP cannot write a contract
- `verified_end_on` is the only date Cron uses
- Buckets: EXPIRED / 30 / 60 / 90 / 120 / 180 (nested). **32 days → 60-day bucket**; 20 days → 30-day bucket
- Nightly job `refresh-contract-alerts` (`15 6 * * *`) when `pg_cron` is available
- UI: `/contracts`, `/contracts/[id]`, `/contracts/renewals`, `/contracts/compliance`

## Checks

```bash
npm run test:phase9-contracts
npm run typecheck
```

## Out of scope (still true)

Win/loss intelligence (Phase 10), Glide, Tiptap, Vercel Cron email, Stripe.
