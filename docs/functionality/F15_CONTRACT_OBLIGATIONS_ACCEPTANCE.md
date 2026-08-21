# F15 — Contract Obligations + Deliverables + Performance Compliance Engine

**Status:** Implemented 2026-08-21 · Contract-scoped only · Reuses F9 automation · No second scheduler · No opaque AI risk score

## Intent

Track contract-specific obligations, deliverables, and compliance due dates with source clauses, human verification, completion evidence, and amendment supersession. Not a generic task manager.

## Hard rules

| Rule | Enforcement |
| --- | --- |
| Not a ClickUp/task manager | Contract FK + obligation_type taxonomy; honesty copy |
| AI cannot auto-verify | CHECK + `refuse_ai` trigger + `evaluateHumanVerifyGate`; promote = `AI_EXTRACTED` only |
| AI cannot auto-complete | COMPLETED requires `completed_by` + `completed_at`; complete RPC requires evidence + HUMAN_VERIFIED |
| Never rewrite history | `supersede_obligation_from_amendment` inserts successor; prior → `SUPERSEDED` |
| Lazy recurrence | `recurrence_rule` + `next_due_on` only — no occurrences table |
| Reuse F9 | Extends `private.run_intelligence_automation`; same `intelligence-automation-daily` cron |
| Alerts HUMAN_VERIFIED only | `refresh_obligation_due_alerts` / `refresh_obligation_overdue_alerts` filter |
| No opaque risk score | Overview/Obligations strip = overdue / due / upcoming counts |
| Completion ≠ past performance | `completion_evidence_document_id` separate from F14 `experience_records` |

## Schema

Migration: `supabase/migrations/20260821320000_f15_contract_obligations.sql`

- **`contract_obligations`** — types, status, verification, dates, lazy recurrence, criticality, evidence, waive, supersede/amendment, org RLS
- **RPCs** — `promote_obligation_candidate`, `verify_contract_obligation`, `complete_contract_obligation`, `waive_contract_obligation`, `supersede_obligation_from_amendment`
- **Helpers** — `derive_obligation_status`, `advance_obligation_next_due`
- **F9 kinds** — `obligation_due`, `obligation_overdue`

## Lib

`apps/web/lib/obligations/` — `types.ts`, `status.ts`, `load.ts`, `promote.ts`, `risk-strip.ts`

## Wire

- Contract workspace **Obligations** tab
- Overview strip: overdue / due / upcoming (HUMAN_VERIFIED only)
- Actions: `verify.promote` for verify; `result.write` for complete/waive

## Tests

```bash
npm run test:f15-obligations
```

## References

[f15-contract-obligations.md](../reference-repos/f15-contract-obligations.md) — Public-Sector CLM / Whereas / OpenContracts pattern-only.
