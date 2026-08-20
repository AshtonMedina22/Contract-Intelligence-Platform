# Phase 4 acceptance — Contract & Compliance Intelligence

> **Canonical product Phase 4.** Legacy engineering Phase 9 schema/cron remain the foundation; this acceptance proves the Contract workspace + company compliance surface wired to verified tables only.

## Purpose

Awarded work becomes future bidding intelligence: portfolio, per-contract workspace, company compliance, and verified-date alert buckets — without fabricating absent terms or overwriting historical contract truth.

## Surfaces

| Surface | Route | Evidence sources |
| --- | --- | --- |
| Portfolio | `/contracts` | `contracts`, `contract_alerts` |
| Renewals | `/contracts/renewals` | `contract_alerts` via `verified_end_on` only |
| Company compliance | `/contracts/compliance` | `compliance_items` (org + contract scoped) |
| Overview | `/contracts/[id]` | buyer, linked pursuit, award NTE, federal IDs, options, alerts |
| Service Plan | `/contracts/[id]/service-plan` | `contract_service_plans` (+ pursuit staffing as reference) |
| Commercial Terms | `/contracts/[id]/commercial-terms` | awards, POs/lines, federal IDs, options, renewals escalation |
| Changes | `/contracts/[id]/changes` | `contract_amendments` (number/title/effective/note) |
| Renewal | `/contracts/[id]/renewal` | alerts, options, notices, compliance eligibility |

Alert buckets (verified dates only): **180 / 120 / 90 / 60 / 30 / EXPIRED**.

## Checks

```bash
npm run test:phase4-contracts
npm run test:phase9-contracts
npm run lint
npm run typecheck
npm run build
```

## Exit gate (this prompt)

- Users can open Portfolio / Renewals / Compliance secondary nav.
- Contract workspace tabs match Overview | Service Plan | Commercial Terms | Changes | Renewal.
- Absent fields render as blank (`—`); RFP/requested facts cannot overwrite verified contract end.
- Amendments append; historical rows remain.
- Acceptance script passes.

## Honest limits

Still unvalidated against a large real L&P awarded-instrument corpus. Do not invent licenses/COI schemas beyond `compliance_items` without pilot evidence. Phase 5+ out of scope.

## Verification

Independent exit + lifecycle audits: [pilot/VERIFY4_ACCEPTANCE.md](pilot/VERIFY4_ACCEPTANCE.md).

### Latest evidence (2026-08-20)

| Command | Result |
| --- | --- |
| `npm run test:verify4` | **31/31 PASS** (real SRC-02/04/14/15/16 lifecycle + promote instruments) |
| `npm run test:phase4-contracts` | **46/46 PASS** |
| `npm run test:phase9-contracts` | **6/6 PASS** |
| `npm run typecheck` | **PASS** |
