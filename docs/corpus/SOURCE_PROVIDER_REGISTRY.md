# Source Provider Registry (F23)

| Provider | Plane | Capability | Live gate | Notes |
| --- | --- | --- | --- | --- |
| f23a_registry | Acquisition | Seed URLs | Always | Exact URLs from F23A registry — never invented |
| usa_spending | F3 research / F23 REFERENCE_DATA | AUTOMATED | Public API | spending_by_award; not fake packages |
| sam_gov | F2/F16 | AUTOMATED or MANUAL | `SAM_GOV_API_KEY` | Without key → MANUAL/LINK only |
| socrata | F16 | AUTOMATED | Domain + dataset | TxDOT bid tabs `de7b-7dna` attempted |
| texas_esbd | F16 | LINK_ONLY / MANUAL | Portal | No public solicitation API |
| tops / dps | Acquisition | LINK_ONLY + PDF seed | Public | Current license vs historical disciplinary |
| web_discovery | Authority 3 | Discovery lead | Manual | Never primary until official URL found |

## F9 hook (no second scheduler)

Idempotent CLI: `npm run corpus:acquire`. Optional future F9 cue: extend `run_intelligence_automation` with a non-mutating `corpus_acquisition_backlog` notification kind — **not** a new pg_cron job. Same rails as [F9_AUTOMATION_NOTIFICATIONS_ACCEPTANCE.md](../functionality/F9_AUTOMATION_NOTIFICATIONS_ACCEPTANCE.md).

## Trust

- Acquire path → `AI_EXTRACTED` only via F1 `register_ingested_document`
- Never `HUMAN_VERIFIED` from this path
- Authority 3 = discovery lead only
