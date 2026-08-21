# F12 — Corporate Compliance + Government Registration / Eligibility Engine

**Status:** Implemented 2026-08-21 · Advisory eligibility only · Reuses F9 `compliance_expiration` · No second scheduler

## Intent

Track org SAM/UEI/CAGE/NAICS/PSC, licenses, COIs, certifications, and personnel qualifications with source evidence. Match solicitation requirements to inventory with honest statuses. Never invent credentials or declare legal eligibility.

## Hard rules

| Rule | Enforcement |
| --- | --- |
| Never fabricate certifications | No seed invent paths; inventory from evidence / human entry |
| AI cannot set `HUMAN_VERIFIED` | CHECK + trigger require `verified_by` + `verified_at`; app `evaluateHumanVerifyGate` |
| AI cannot set `VERIFIED_AVAILABLE` | Match rules + DB trigger on `requirement_compliance_matches` |
| Missing source ≠ `VERIFIED_AVAILABLE` | `hasComplianceSource` + trigger |
| Do not invent insurance limits | `coverage_json` opaque; compare only recorded values |
| No GPT legal eligibility | `rollupEligibility` → `legalEligibilityDeclared: false` + hard caveat |
| Reuse F9 expiry | Mirror SAM → `compliance_items` kind=`registration`; same `refresh_compliance_expiration_alerts` |

## Schema

Migration: `supabase/migrations/20260821300000_f12_compliance_eligibility.sql`

- **`organization_registrations`** — UEI, CAGE, SAM status/expiry, `naics[]`, `psc[]`, vehicles notes, sources, `verification_status`, `supersedes_id`, org RLS
- **`compliance_items` ALTER** — `verification_status`, `effective_on`, `issuer`, `credential_number`, `holder_name`, `coverage_json`, sources, `supersedes_id`; kinds +`registration` \| `personnel_qualification` \| `membership`
- **`requirement_compliance_matches`** — requirement ↔ item/registration; `match_status` enum; org RLS

## Match statuses (proven in acceptance)

| Status | When |
| --- | --- |
| `VERIFIED_AVAILABLE` | HUMAN_VERIFIED inventory/registration **with source**; in force; COI/NAICS sufficient |
| `EXPIRING` | Same as available but expiry ≤ 60 days |
| `MISSING` | No inventory, rejected, or expired |
| `INSUFFICIENT` | HUMAN_VERIFIED but limits/NAICS short |
| `UNKNOWN` | Not HUMAN_VERIFIED and/or missing source |
| `NOT_APPLICABLE` | Human marked N/A |

## Lib

`apps/web/lib/compliance/` — `types.ts`, `match-rules.ts`, `eligibility.ts`, `load-inventory.ts`, `promote.ts`

## Wire

- `/contracts/compliance` — org profile strip, inventory table, View Source, history/superseded, Mark HUMAN_VERIFIED (`verify.promote`)
- Pursuit Overview — prefers F12 match rollup when `requirement_compliance_matches` exist
- F9 — unchanged kind `compliance_expiration`; SAM mirrored into registration compliance rows

## Tests

```bash
npm run test:f12-compliance
```

Covers: active/expired/missing license; COI sufficient/insufficient; SAM active/expired; multiple NAICS; unknown cert; personnel qual; source gate; AI cannot mark verified; F9 reuse; RLS greps; overview MATCH_ROLLUP.

## References

[f12-compliance-eligibility.md](../reference-repos/f12-compliance-eligibility.md) — BidBridge / ExpiryGuard (MIT) / OpenContracts pattern-only.
