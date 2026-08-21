# F6 — Governed Structured Analytics + Natural-Language SQL

**Date:** 2026-08-21  
**Status:** SHIPPED (parameterized metric registry + Ask tool; no Wren stack; no free LLM SQL)  
**Test:** `npm run test:f6-structured-analytics`  
**Migration:** `20260821240000_f6_analytical_runs.sql`

## Architecture

WrenAI **pattern** only (semantic model → validated plan → read-only execution → explainable result). We do **not** run WrenAI, and we do **not** let an LLM emit SQL against Postgres.

| Step | Local module |
| --- | --- |
| Semantic model + metrics | `apps/web/lib/analytics/semantic-model.ts` |
| Zod plan | `apps/web/lib/analytics/query-plan.ts` |
| Question → metric (or refuse) | `apps/web/lib/analytics/resolve-question.ts` |
| PostgREST query builder | `apps/web/lib/analytics/build-query.ts` |
| Pure compute | `apps/web/lib/analytics/compute.ts` |
| Optional raw-SQL rejector | `apps/web/lib/analytics/validate-sql.ts` |
| Execute + result contract + persist | `apps/web/lib/analytics/execute.ts` |
| Ask tool | `ask_structured_analytics` in `apps/web/lib/ask/tools.ts` |

Ask remains the **only** chat surface. Analytics page still redirects to Reports.

## Hard rules

- No free LLM SQL to the database.
- `market_share` is **never** registered or computed.
- Win rates use the P9 gate (`n >= 20` decided WON+LOST); below that the rate is withheld (counts still shown).
- User RLS only (`createClient()`); no service-role analytics path.
- Ambiguous questions refuse with a clarification message (safe default).

## Entities + approved joins

Entities: Pursuit/opportunity, Buyer/client, Competitor, Award, Contract, PricingLine, Outcome/win_loss_review, Requirement, Proposal/content, Compliance.

Approved joins (documented in `APPROVED_JOINS`): pursuit↔buyer, pursuit↔outcome, pursuit↔award, pursuit↔pricing_line, pursuit↔requirement, pursuit↔proposal, pursuit↔contract, contract↔buyer, contract↔compliance, competitor↔pursuit (via `competitor_bids`), award↔buyer (via pursuit). Fabricated joins are refused.

## Metric definitions (every registered metric)

| metricId | Definition | Eligible statuses | Date field | Grain | Null policy | Support |
| --- | --- | --- | --- | --- | --- | --- |
| `pursuit_count` | Count of `opportunities` under org RLS | (all) | `created_at` | opportunity | exclude | supported |
| `submitted_count` | Union of `stage=SUBMITTED` and `submission_packets.submitted_at` (deduped by opportunity) | SUBMITTED | `submitted_at` | opportunity | exclude | supported |
| `won_count` | Count of `win_loss_reviews` with `outcome=WON` | WON | `updated_at` | opportunity | exclude | supported |
| `lost_count` | Count of `win_loss_reviews` with `outcome=LOST` | LOST | `updated_at` | opportunity | exclude | supported |
| `win_rate_decided` | `WON ÷ (WON + LOST)`; NO_BID/CANCELLED/NO_AWARD/PENDING excluded; **withheld when decided n < 20** | WON, LOST | `updated_at` | decided opportunity | exclude | supported (gated) |
| `submitted_value` | Sum of submitted bid dollars | SUBMITTED | `submitted_at` | none — unsupported | n/a | **withhold** — no verified submitted-dollar column |
| `awarded_value` | Sum of `awards.amount_nte` when **every** in-scope award has `amount_nte`; else withhold | (all with amount) | `awarded_on` | award | withhold_if_any_null | supported |
| `active_contract_value` | Portfolio active-contract dollars | — | `verified_end_on` | unsupported on `contracts` | n/a | **withhold** (P10 style — no contract value column) |
| `recompete_win_rate` | Among pursuits with `rebid_from_contract_id` or `rebid_from_opportunity_id`, same win-rate formula + P9 gate | WON, LOST | `updated_at` | rebid-linked opportunity | exclude | supported (gated) |
| `median_awarded_rate` | Median of `pricing_lines.awarded_rate` for **hourly** unit grain only; **refused if mixed** hourly/non-hourly | — | `updated_at` | hourly pricing_line | exclude | supported |
| `contract_expiration_count` | Count by `verified_end_on` window or `contract_alerts` bucket (180/120/90/60/30/EXPIRED); undated never assumed | — | `verified_end_on` | contract × bucket/window | exclude | supported |
| `competitor_frequency` | Count of `competitor_bids` appearances per competitor | — | `created_at` | competitor_bid | exclude | supported |

**Never registered:** `market_share`.

## Result contract

Every run returns: `question`, `metricInterpretation`, `scope`, `columns`, `rows`, `planFingerprint` / `explain`, `limitations`, `dataCutoff`, plus `status` / refuse message. Persisted to `analytical_runs` under org RLS when the Ask tool has an org membership.

## Ask routing

`buildAskSystemPrompt` routes count / rate / median / expiration / competitor-frequency analytics to `ask_structured_analytics`. Never invent share; never invent win-rate percentages outside the gated tool.

## Acceptance

```bash
npm run test:f6-structured-analytics
npm run test:phase6-ask
npm run lint -w web && npm run typecheck -w web && npm run build -w web
```

Checks include: win-rate withhold / zero denominator / n≥20; median hourly vs mixed refuse; expiration window; competitor frequency; buyer dimension; adversarial DROP/UPDATE/injection/unknown table/dangerous fn; unknown metric; fabricated join; `market_share` absent; raw SQL refused even when SELECT-shaped.

## Reference

[docs/reference-repos/wrenai.md](../reference-repos/wrenai.md)
