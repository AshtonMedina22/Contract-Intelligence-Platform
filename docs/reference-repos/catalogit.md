# Repository

CatalogIT — https://github.com/jonymaster/catalogIT

Not previously registered in [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md); it is
named in `docs/OG DOCS/APPLICATION SPECS.MD` as the closest public UI reference for the
renewal-date-risk layer.

# Task that caused inspection

Productization P10 — Contract Portfolio + Renewal / Rebid Command Center. Specifically: how to shape
a renewal queue that is an action list rather than a calendar widget.

# Relevant upstream material inspected

Repository metadata and README feature description (2026-08-21). License field confirmed via the
GitHub API. **No source files were read or copied.**

# Relevant patterns found

- Renewal dates are a first-class field on the record, not a derived display value.
- A renewal calendar and a reminder dispatch are separate concerns: reminders are fired by a daily
  scheduled call to a dedicated endpoint, not computed at page render.
- Renewal reminders, audit history and file attachments live on the same record, so an operator can
  see the obligation, its evidence and its change history without leaving the row.
- Exposure summaries (what expires in the next N days) sit above the individual contracts.

# What maps to our codebase

`contract_alerts` + the `refresh-contract-alerts` Supabase cron already implement the "scheduled
recompute, not render-time compute" split. `/contracts` is the exposure summary; `/contracts/renewals`
is the action queue; `contract_documents` / `source_document_id` is the attachment-and-evidence side.

# What we are adopting

Pattern only:

- Bucket-and-queue framing — exposure counts above, individual contracts underneath.
- A visible statement of when the scheduled job last ran, rendered next to the numbers it produced
  (`AutomationAuditStrip`).
- Audit-trail-adjacent reading of change history (our `buildChangeTimeline`).

# What we are explicitly NOT adopting

- Its domain model (SaaS subscriptions, seats, vendors, hardware assets). L&P holds awarded
  government service contracts, not licences.
- **Auto-renewal and renewal reminders as notifications.** CatalogIT dispatches renewal reminders via
  Gmail / Slack / Telegram / webhooks. P10 sends nothing and renews nothing; alerts are advisory and
  every decision is taken by a person in the app.
- Cost tracking and per-seat spend analysis. Our schema records an award NTE ceiling and obligated
  purchase orders and refuses to synthesise a "contract value" from them.
- OIDC/SCIM provisioning and its RBAC model — we already have Supabase auth plus org-scoped RLS.

# License/copy implications verified

**MIT** as of 2026-08-21 (confirmed via GitHub API `license.spdx_id = MIT`). MIT would permit copying
with attribution, but nothing was copied — the adoption is conceptual only, so no attribution
obligation arises.

# Local files affected

`apps/web/lib/contracts/portfolio-model.ts`,
`apps/web/components/contract-workspace/portfolio-strips.tsx`,
`apps/web/app/(platform)/contracts/page.tsx`,
`apps/web/app/(platform)/contracts/renewals/page.tsx`,
`docs/functionality/F5_RECOMPETE_RADAR_ACCEPTANCE.md` (F5 re-confirmed: queue + advisory alerts; still no notification dispatch)

# Status

ADOPTED PATTERN · F5 (2026-08-21) re-confirmed — still no Gmail/Slack renewal reminders

**F9 (2026-08-21):** Operational automation delivers **in-app + digest** renewal_notice /
contract_review_window reminders via the existing `intelligence-automation-daily` /
`/api/cron/intelligence-digest` rails. CatalogIT’s Gmail/Slack/Telegram webhook spam stack
remains **explicitly not adopted**.
