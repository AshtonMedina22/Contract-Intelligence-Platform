# F15 — Contract obligations (reference note)

**Date:** 2026-08-21  
**Upstream:** Public-Sector CLM · Whereas · OpenContracts — **pattern only** (no license copy; no generic CLM/task product).

## Adopted patterns

| Pattern | Source | How we use it |
| --- | --- | --- |
| Obligation entity on an active contract | Public-Sector CLM lifecycle vocabulary | `contract_obligations` keyed to `contracts` |
| Append-only change / supersession | Whereas timeline discipline | Amendment → insert successor + `SUPERSEDED` prior; never rewrite |
| Source clause ↔ document page | OpenContracts provenance | `source_clause_ref` / document / page / fact |

## Explicitly declined

- Generic task / work-item product (ClickUp-style)
- Infinite recurrence occurrence tables
- Opaque AI “risk scores”
- Auto-verify or auto-complete by extraction/automation
- Merging completion evidence into past-performance claims (F14)

## Local authority

Schema + RPCs in `supabase/migrations/20260821320000_f15_contract_obligations.sql`.  
Acceptance: [F15_CONTRACT_OBLIGATIONS_ACCEPTANCE.md](../functionality/F15_CONTRACT_OBLIGATIONS_ACCEPTANCE.md).
