# P3 Executive Home + Action Center Acceptance

**Date:** 2026-08-21  
**Status:** IMPLEMENTED  

## Overview

Replaced `/overview` with an owner command center: "What matters right now?" — surfacing real queues, deadlines, and verified intelligence with no fake metrics, demo numbers, or filler charts.

---

## KPI Strip Metrics

### IMPLEMENTED (schema-backed)

| Metric | Table/Query | Definition |
| --- | --- | --- |
| **Active pursuits** | `opportunities.stage NOT IN ('CLOSED', 'AWARDED')` | Count of opportunities in active workflow stages |
| **Pursuits due ≤14 days** | `opportunities.response_due_on` within 14 days from today | Pursuits with upcoming deadlines |
| **Verification backlog** | `extracted_facts.verification_status IN ('AI_EXTRACTED', 'NEEDS_REVIEW', 'CONFLICT')` | Facts awaiting human verification |
| **Processing failures** | `documents.processing_status = 'FAILED' OR documents.lifecycle_error IS NOT NULL` | Documents that failed parsing/extraction |
| **Open exceptions** | `validation_exceptions.resolved = false` | Unresolved validation exceptions |
| **Contract alerts** | `contract_alerts` count after `refresh_contract_alerts()` | Contracts in renewal review window (180/120/90/60/30/EXPIRED buckets) |
| **L&P input required** | `requirements.matrix_status = 'L_AND_P_INPUT_REQUIRED'` | Requirements needing operator input (shown only if > 0) |
| **Pricing drafts** | `pricing_decisions.status = 'DRAFT'` | Pricing decisions awaiting human approval (shown only if > 0) |
| **Approvals requested** | `pursuit_approval_layers.enabled = true AND status = 'requested'` | Pending internal approvals (shown only if > 0) |
| **Active contracts** | `contracts` with `verified_end_on` and no EXPIRED alert bucket | Active contracts (shown only if > 0) |

### WITHHELD (honest empty states)

| Metric | Reason |
| --- | --- |
| **Pipeline Value ($)** | No `HUMAN_APPROVED` or verified sourced amounts column on opportunities — cannot safely sum |
| **Submitted Value ($)** | Same — no verified $ amounts |
| **Awarded YTD ($)** | Same — no verified $ amounts |
| **Win Rate (%)** | Only observed WON/LOST counts shown; no corporate win-rate trend claimed |

---

## Needs Attention Queue

Consolidated priority list merging ranked items with deep links:

| Category | Source | Link |
| --- | --- | --- |
| Due pursuits | `opportunities` with `response_due_on` ≤14 days, stage active | `/procurement/opportunities/[id]` |
| Verification backlog | `extracted_facts` status IN AI_EXTRACTED/NEEDS_REVIEW/CONFLICT | `/ingestion/verification` |
| Processing failures | `documents` FAILED or lifecycle_error | `/ingestion/processing` |
| Open exceptions | `validation_exceptions` unresolved | `/ingestion/exceptions` |
| Contract renewals | `contract_alerts` count | `/contracts/renewals` |
| L&P input required | `requirements` with L_AND_P_INPUT_REQUIRED | `/procurement/opportunities` |
| Pricing drafts | `pricing_decisions` DRAFT | `/procurement/opportunities` |
| Approvals requested | `pursuit_approval_layers` requested | `/procurement/opportunities` |

Priority sorting: urgent > high > medium > low (based on days until due, backlog size, failure presence).

---

## Pipeline Table

| Column | Source |
| --- | --- |
| Pursuit | `opportunities.title` → link to `/procurement/opportunities/[id]` |
| Stage | `opportunities.stage` (INTAKE, ANALYSIS, PRICING, DRAFTING, SUBMITTED) |
| Buyer | `clients.name` via `opportunities.client_id` |
| Due | `opportunities.response_due_on` |
| Value | OMITTED — no verified amount column; would require HUMAN_APPROVED sourced amounts |

Limited to 20 rows ordered by `response_due_on ASC`.

---

## Win/Loss Snapshot

| Element | Source |
| --- | --- |
| WON count | `win_loss_reviews.outcome = 'WON'` |
| LOST count | `win_loss_reviews.outcome = 'LOST'` |
| PENDING count | `win_loss_reviews.outcome = 'PENDING'` |
| CANCELLED count | `win_loss_reviews.outcome = 'CANCELLED'` |
| NO_BID count | `win_loss_reviews.outcome = 'NO_BID'` |
| NO_AWARD count | `win_loss_reviews.outcome = 'NO_AWARD'` |
| Recent outcomes | 5 most recent `win_loss_reviews` with opportunity title, outcome, winner_name |

**Honest copy:** "Observed outcomes only — not a corporate win-rate trend."

Empty state: "No win/loss outcomes recorded. Outcome data comes from verified win_loss_reviews. Record results after pursuits complete."

---

## Contract Alert Snapshot

| Bucket | Source |
| --- | --- |
| 180 days | `contract_alerts.bucket = '180'` count |
| 120 days | `contract_alerts.bucket = '120'` count |
| 90 days | `contract_alerts.bucket = '90'` count |
| 60 days | `contract_alerts.bucket = '60'` count |
| 30 days | `contract_alerts.bucket = '30'` count |
| EXPIRED | `contract_alerts.bucket = 'EXPIRED'` count |

**Honest copy:** "Based on verified_end_on dates only. Refreshed nightly and on page load."

Empty state: "No contract renewal alerts. Contracts without verified_end_on dates don't appear here."

`refresh_contract_alerts()` is called on page load (same as `/contracts/renewals`).

---

## Market/Competitor Snapshot

| Element | Source |
| --- | --- |
| Buyers/agencies | `clients` count |
| Competitors | `competitors` count |

**Honest copy:** "Counts from verified procurement evidence — see Intelligence for details."

Empty state: "No market intelligence data. Clients and competitors are populated from verified procurement evidence."

No charts. No fake trends. No market share claims.

---

## Files Changed

### Created

- `apps/web/lib/home/types.ts` — Type definitions for all action center data
- `apps/web/lib/home/load-action-center.ts` — Parallel Supabase queries, RLS-scoped, no fake fallbacks
- `apps/web/components/home/kpi-strip.tsx` — Compact metric chips with links
- `apps/web/components/home/needs-attention-queue.tsx` — Priority-ranked attention items
- `apps/web/components/home/pipeline-table.tsx` — Active pursuits table
- `apps/web/components/home/win-loss-snapshot.tsx` — Outcome counts and recent list
- `apps/web/components/home/contract-alert-snapshot.tsx` — Bucket counts
- `apps/web/components/home/market-snapshot.tsx` — Client/competitor counts
- `apps/web/components/home/action-center.tsx` — Main composition component
- `apps/web/components/home/index.ts` — Exports

### Modified

- `apps/web/app/(platform)/overview/page.tsx` — Rewritten to use ActionCenter with PageHeader

### Documentation

- `docs/productization/P3_EXECUTIVE_HOME_ACCEPTANCE.md` — This file

---

## Empty States

All sections use `components/shell/EmptyState` with honest language:

- **Needs Attention:** "Nothing needs immediate attention. All queues are clear."
- **Pipeline:** "No active pursuits. Start a new solicitation from intake."
- **Win/Loss:** "No win/loss outcomes recorded."
- **Contract Alerts:** "No contract renewal alerts. Contracts without verified_end_on dates don't appear here."
- **Market:** "No market intelligence data."

---

## UI/UX

- Enterprise dense layout using shell `PageHeader`
- Compact tables (same style as `contracts-table`)
- No giant card grids
- Responsive design with `lg:grid-cols-2` for win/loss and contract sections
- Brief operational guidance at bottom (minimized, not dominating)

---

## Test Requirements

1. `npm run lint` — PASS
2. `npm run typecheck` — PASS  
3. `npm run build` — PASS
4. Browser verification at `/overview`:
   - No fake numbers (all metrics from real RLS-scoped queries)
   - Click-throughs work (KPI chips, attention items, pipeline rows, snapshot links)
   - Responsive layout
   - Empty states render correctly when data is absent
