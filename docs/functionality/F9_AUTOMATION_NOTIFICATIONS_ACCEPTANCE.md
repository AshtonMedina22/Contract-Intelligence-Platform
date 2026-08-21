# F9 — Operational Automation + Notification Delivery Engine

**Date:** 2026-08-21  
**Status:** Shipped in code (acceptance `test:f9-automation`). Extends Phase 6 automation — does **not** complete Historical Pilot.

## Scheduler confirmation (no second job)

| Rail | Name / path | Change |
| --- | --- | --- |
| Supabase pg_cron | `intelligence-automation-daily` | **Same job** — still `select private.run_intelligence_automation();` |
| Vercel Cron | `/api/cron/intelligence-digest` | **Same path** — richer digest payload + email stub + notification mirror |
| New cron / job | — | **None** |

## Kinds matrix

| Kind | Status | Source |
| --- | --- | --- |
| `pursuit_deadline` | **Have — hardened** | `opportunities.response_due_on` (≤30d + overdue) |
| `questions_deadline` | **New** | `opportunities.questions_due_on` (nullable; fire only when set) |
| `mandatory_conference` | **New** | `opportunities.conference_due_on` |
| `prebid_deadline` | **New** | `opportunities.prebid_due_on` |
| `pricing_approval_pending` | **New** | `pricing_decisions` status `DRAFT` |
| `response_approval_pending` | **Have — hardened** | Replaces/clears legacy `approval_reminder`; go_no_go PENDING + approval layers |
| `lp_input_required_outstanding` | **New** | `requirement_responses` / `requirements` L&P input |
| `mandatory_requirement_outstanding` | **New** | Mandatory (`scored=false`, `response_required`) not APPROVED |
| `submission_checklist_incomplete` | **New** | Required checklist items incomplete |
| `submission_deadline` | **New** (companion) | Same due as pursuit; clear kind + `/submission` deep link |
| `verification_backlog` | **Have — split** | `documents` `NEEDS_REVIEW` only |
| `processing_failure` | **New** (split) | `FAILED` / `lifecycle_error` |
| `compliance_expiration` | **Have — hardened** | `compliance_items.expires_on` |
| `contract_review_window` | **New** | Bridge from `contract_alerts` 90/60/30/EXPIRED |
| `renewal_notice` | **New** | `renewals.notice_due_on` — **notify only, never renew** |
| `rebid_planning` | **New** | `contract_alerts` 180/120 advisory |
| `option_decision` | **New** | `contract_options.exercise_by` dated — **never exercise** |
| `research_refresh` | **New / gated** | Org flag **or** stale `REVIEW_READY` ≥14d — **never auto-verify** |
| Gmail/Slack webhook spam | **Deferred / declined** | CatalogIT pattern reference only |

## Human gates (hard)

Automation **MUST NEVER**: verify evidence, select final price, approve proposal, submit bid, renew contract, exercise options.

## What shipped

1. **Migration** `supabase/migrations/20260821270000_f9_automation_notifications.sql`  
   - Extends `automation_events`: `dedupe_key`, `deep_link`, `owner_user_id`, `first_triggered_at`, `last_triggered_at`, `resolved_at` (Phase 6 `acknowledged_at` preserved; open = both null).  
   - `ensure_automation_event` upserts by `dedupe_key`; bumps `last_triggered_at`; no duplicate open rows.  
   - `notifications` table + org RLS (select own-org; update read/resolve for self or org broadcast).  
   - Opportunity cols: `questions_due_on`, `conference_due_on`, `prebid_due_on`.  
   - Org flag: `automation_research_refresh_enabled`.

2. **Lib** `apps/web/lib/automation/` — `kinds.ts`, `digest.ts`, `email-channel.ts` (stub `NOT_CONFIGURED`; optional Resend/SendGrid if env present), `resolve-policy.ts`.

3. **Digest route** — calls existing RPC; `buildDailyDigestPayload` buckets; email stub; mirrors `channel=digest` notifications.

4. **Home Action Center** — Notifications panel with deep links + read/resolve (`overview/actions.ts`). Not a second app.

## CatalogIT

See [catalogit.md](../reference-repos/catalogit.md) — renewal **reminder queue** pattern only. F9 in-app/digest notifications; **no** Gmail/Slack/Telegram webhook spam stack.

## Verify

```bash
npm run test:f9-automation      # 23/23
npm run test:phase6-ask         # 47/47
npm run test:phase8-response    # 30/30
npm run lint && npm run typecheck && npm run build
```

Migration `20260821270000_f9_automation_notifications` **applied** to live DB (2026-08-21).

## Blockers

- Live email needs `RESEND_API_KEY` or `SENDGRID_API_KEY` (+ from/to). Default: stub `NOT_CONFIGURED`.
- Research refresh stays quiet unless org flag is on or a `REVIEW_READY` run is ≥14 days old.
- Corpus-thin: most kinds stay empty until real pursuits/contracts carry dates and DRAFT pricing.
