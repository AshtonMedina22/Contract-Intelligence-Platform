# Phase 7 acceptance

Canonical four-truth schema. AI still never auto-promotes. Contracts/renewals UI is Phase 9. Bulk corpus is Phase 8.

## What landed

- Tables: `solicitations`, `requirements`, `pricing_lines` (four rate columns), `awards`
- `documents.commercial_truth` — award sources cannot write `requested_rate`
- RPC `promote_verified_fact` (SECURITY INVOKER): HUMAN_VERIFIED only; conflicts write `validation_exceptions` and **do not overwrite**
- Verification VERIFY/EDIT calls the RPC after identity promotion
- Package UI: `/procurement/opportunities` and `/procurement/opportunities/[opportunityId]`

## Checks

```bash
npm run test:phase7-four-truth
npm run typecheck
```

One package must show requested ≠ proposed ≠ awarded ≠ current. A second requested value must not overwrite the first.

## Out of scope (still true)

Contract amendments UI, Cron, Glide, proposal editor, bulk migration, every table in MASTER’s long-term list.
