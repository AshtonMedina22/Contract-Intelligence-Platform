# F14 — Past Performance + Experience Integrity Acceptance

**Date:** 2026-08-21  
**Status:** SHIPPED (engineering gate). Corpus of typed experience rows remains thin until operators promote/verify real L&P contracts.

## Hard rules (enforced)

| Rule | Enforcement |
| --- | --- |
| NEVER merge experience types | Enum + CHECK `experience_records_type_attribution` + lib partition/match |
| NEVER rewrite prior-employer work as L&P performance | `attribution_language` frozen; `assertAttributionPreserved`; draft templates |
| NEVER invent contract value / years | CHECK + `assertNoInventedMetrics`; promote RPC leaves value/years null |
| AI cannot set HUMAN_VERIFIED | CHECK actor required; `assertAiCannotMarkVerified`; promote RPC writes `AI_EXTRACTED` |
| Only HUMAN_VERIFIED `L_AND_P_CORPORATE` (alias `lp_corporate`) = L&P past performance | `isEligibleCorporatePastPerformance` / `retrieveCorporatePastPerformance` |
| Subcontractor stays subcontractor; management/personnel stay person/employer | Type CHECKs + draft headings |
| Class C / competitor ≠ corporate | `promote_experience_from_contract` rejects `C_COMPETITOR_TEST` |
| References alone ≠ corporate PP | Separate `experience_references` table; acceptance proof |

OpenContracts / RFPilot / AutoRFP = **pattern only** (provenance / taxonomy / response match) — see [f14-past-performance-integrity.md](../reference-repos/f14-past-performance-integrity.md).

## Schema

Migration: `supabase/migrations/20260821310000_f14_experience_integrity.sql`

- Enum `experience_type`: `L_AND_P_CORPORATE | MANAGEMENT_PRIOR_EXPERIENCE | KEY_PERSONNEL_EXPERIENCE | SUBCONTRACTOR_EXPERIENCE`
- Table `experience_records` (org RLS) with sourced-only value/years, `attribution_language`, `contract_id`, `employer_name`, `performed_by_org`, `supersedes_id`
- Table `experience_references` FK → `experience_records`
- RPC `promote_experience_from_contract(uuid)` → `L_AND_P_CORPORATE` only, `AI_EXTRACTED`, rejects Class C

## Lib

`apps/web/lib/experience/` — `types`, `attribution`, `promote`, `match`, `retrieve`, `draft-attribution`

## Wire

- Response match/draft: `matchRequirementToProposalContent` prefers typed experience for past-performance requirements; preserves `attribution_language`
- Ask: `search_experience_records` tool + agent guidance (`corporate_only` / type filter)
- UI: Intelligence → Content experience library (type badges + View Source + verify.promote)
- F10: `markExperienceHumanVerified` / `promoteExperienceFromContract` require `verify.promote`

## Acceptance script

```bash
npm run test:f14-experience
```

Adversarial cases covered in `scripts/f14-past-performance-integrity-acceptance.mjs`.

## Honest limits

- Empty experience library until contracts are promoted and human-verified
- Value/years remain blank unless sourced evidence exists
- Class C corpus contracts cannot become corporate PP even if present in `contracts`
