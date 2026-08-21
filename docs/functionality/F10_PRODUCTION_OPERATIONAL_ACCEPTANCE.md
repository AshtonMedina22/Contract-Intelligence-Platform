# F10 — RBAC + Production Security + Live Operational Acceptance

**Date:** 2026-08-21  
**Status:** Shipped in code (`test:f10-production`). Does **not** complete Historical Pilot or claim production-ready. **No Stripe.**

## RBAC matrix (`memberships.role`)

Existing roles kept: `admin | importer | verifier | bidder | executive` (no viewer).

| Permission | Roles |
| --- | --- |
| `intake.write` | admin, importer, verifier |
| `verify.promote` | admin, verifier |
| `research.verify` | admin, verifier |
| `pricing.edit` | admin, bidder, executive |
| `pricing.approve` | admin, bidder, executive |
| `proposal.approve` | admin, bidder, executive |
| `pursuit.submit` | admin, bidder, executive |
| `result.write` | admin, bidder, executive |
| `contract.create` | admin, bidder, executive |
| `rebid.clone` | admin, bidder, executive |
| `org.admin` | admin |
| `ask.use` | any member |

Helpers: `apps/web/lib/auth/permissions.ts` → `requirePermission` wraps `requireOrgRole`. Legacy sets in `lib/org/roles.ts` remain the source for intake/verify/pricing approve role lists.

## Server wiring

| Action | Permission | Audit |
| --- | --- | --- |
| Intake / bulk | `intake.write` | — (existing) |
| Verification promote | `verify.promote` | — (existing events) |
| Research verify/reject/edit/conflict | `research.verify` | `audit_log` |
| Research start/refresh | `ask.use` + rate limit | — |
| Pricing draft/cost/comps | `pricing.edit` | `audit_log` |
| Final price approve | `pricing.approve` | `audit_log` |
| Requirement response approve / approval layers | `proposal.approve` | `audit_log` |
| Mark submitted | `pursuit.submit` | `audit_log` |
| Save pursuit result | `result.write` | `audit_log` |
| Create contract from win | `contract.create` | `audit_log` |
| Clone rebid | `rebid.clone` | `audit_log` |
| Update membership role | `org.admin` | `audit_log` |
| Ask chat | `ask.use` + rate limit | — |

UI: controls hide/disable when unauthorized (pricing, response approve, mark submitted, result/contract, research verify, rebid, settings member roles).

## Migration

`supabase/migrations/20260821280000_f10_rbac_audit_security.sql` — `audit_log` + RLS (member SELECT; INSERT same-org + `actor_user_id = auth.uid()`) + `write_audit_log` security definer. **Applied** to live DB (2026-08-21) via `scripts/apply-f10-rbac-audit-migration.mjs`.

## Health + env

- `GET /api/health` — booleans/status only (`supabase`, `processor`, `ai_gateway`, `ask_model`, `ocr`, `google`, `research_providers`). Never secret values.
- `scripts/env-check.mjs` — critical fail vs optional feature-disabled messages; blocks `NEXT_PUBLIC_*` secret/service_role exposure.

## Rate limiting

In-memory Map on `/api/ask/chat` and research start/refresh. **429** on exceed.  
**Limitation:** not shared across multi-instance / multi-region runtimes — use Redis/Upstash before multi-node production.

## Secret audit

Acceptance greps: `.env.local` not git-tracked; no `NEXT_PUBLIC_*SERVICE_ROLE` in web source. Values never printed. No historical NEXT_PUBLIC secret exposure found in this pass — if one is later discovered, **rotate Supabase keys** immediately.

## Verify

```bash
npm run test:f10-production
npm run env:check
npm run lint && npm run typecheck && npm run build
```

## Blockers (external / ops)

- Historical Pilot corpus / human verification still open (see WORK_TRAIL).
- Prod processor + `ASK_MODEL` / OCR / Google / research provider keys remain feature-gated.
- In-memory rate limits are single-node only.
- Stripe / commercialization **not** in scope.
