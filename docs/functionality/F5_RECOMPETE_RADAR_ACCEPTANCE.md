# F5 — Recompete Radar + Contract Expiration Opportunity Engine

**Date:** 2026-08-21  
**Status:** HARDENED / WIRED on top of P9 `recompete-radar.ts` + P10 `portfolio-model` + Phase 9 `refresh_contract_alerts`.  
**Test:** `npm run test:f5-recompete-radar`  
**Migration:** `20260821230000_f5_recompete_watches.sql` (applied)

## Two concepts (hard split)

| Surface | What it is | What it is not |
| --- | --- | --- |
| **L&P renewals** `/contracts/renewals` + contract Renewal tab | Contracts this org **holds**, bucketed from `contracts.verified_end_on` only (180/120/90/60/30/EXPIRED) | Market radar; competitor awards; auto-created pursuits |
| **Market recompete radar** `/intelligence/market` | Observed recompetes on work L&P does **not** hold (`buildRecompeteRadar` → `market`) | L&P renewal queue; invented expected-rebid dates; market share |

Cross-links and contrast copy live on both pages. L&P rows never enter `radar.market`; market awards never inflate renewal KPI buckets.

## Internal renewal (kept + hardened)

- Buckets still from `verified_end_on` only via `refresh_contract_alerts` upsert.
- Options listed with **"not assumed exercised"**; remaining = **UNKNOWN** (`assessOptionsRemaining`) because `contract_options` has no exercised status.
- Owner / renewal status = **UNKNOWN** (not columns on `contracts`).
- Rebid readiness strip = existing `assessRebidReadiness` (empty compliance → unknown, not clear).
- **Start Rebid** keeps `cloneRebidFromContract` — buyer/service/provenance only. UI shows historical evidence links (prior contract, buyer, prior pursuit, win/loss, source document) and states **pricing/requirements are not copied as new truth**.
- On `verified_end_on` change: promote path already called `refresh_contract_alerts`; F5 adds trigger `contracts_verified_end_refresh_alerts` so any end-date write refreshes alerts.

## Alert dedupe

- Unique key: `(organization_id, contract_id, bucket)`.
- `refresh_contract_alerts` **upserts** on conflict and deletes stale buckets ⇒ **one row per bucket**, no daily duplicate inserts.
- No `alert_events` / `last_notified_at` table — acceptance asserts upsert semantics = dedupe.
- Automation **never** auto-creates pursuits.

## External Market Radar (wired)

- Kept `buildRecompeteRadar` market vs `lpHeld` split.
- New thin table `recompete_watches` with statuses `WATCHING | READY_FOR_CAPTURE | PURSUIT_STARTED | DISMISSED | STALE`, unique `(organization_id, candidate_key)`.
- CTAs on market rows: **Watch** (upsert), **Start Pursuit**, **Dismiss**.
- `startPursuitFromRecompeteCandidate`: creates INTAKE pursuit with provenance; inserts `research_facts` as **AI_EXTRACTED** only; **never** `cloneRebidFromContract`; **never** invents `response_due_on`; sets `rebid_from_*` null.
- Optional enrich from HUMAN_VERIFIED `research_facts` / awards with recorded end dates: **not applied** — `research_facts` has no end-date column; expected rebid still only restates verified contract/option/renewal dates.

## Acceptance checks (`test:f5-recompete-radar`)

1. Bucket set + missing date → unknown expected rebid (never invented)
2. L&P excluded from market list
3. Market excluded from renewals KPI / portfolio
4. Start Rebid no pricing copy (grep)
5. Alert upsert dedupe unique key (+ F5 end-date trigger)
6. External Start Pursuit never HUMAN_VERIFIED
7. Option not assumed exercised → remaining UNKNOWN

## Reference notes (light)

- [catalogit.md](../reference-repos/catalogit.md) — renewal queue pattern; notification dispatch still declined
- [public-sector-clm.md](../reference-repos/public-sector-clm.md) — Active→Renewals vocabulary; not a CLM
- [ocds.md](../reference-repos/ocds.md) — external lifecycle vocabulary only; watches use our statuses, not OCDS tender codes

## Honest limits / blockers

- Corpus still thin: few `verified_end_on` values ⇒ renewal queue and dated market rows under-report rather than invent.
- Options remaining cannot become a number without an exercised-status schema field (pilot gap).
- Browser Start Rebid / Start Pursuit create permanent opportunity rows — not exercised in automated UI smoke; trust proven by acceptance greps.
- Dirty `docs/benchmarks/_verify3_pricing.xlsx` left alone (unrelated).
