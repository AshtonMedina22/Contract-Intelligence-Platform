# Repository

TenderRadar — https://github.com/d4d0h/tenderradar

# Task that caused inspection

P4 productization: public opportunity discovery + watchlist + start pursuit
(`docs/productization/P4_OPPORTUNITY_DISCOVERY_ACCEPTANCE.md`).

# Relevant upstream files inspected

Repository metadata only (GitHub API, 2026-08-21): description, language, license field, activity.
**No source files were read and the repository was not cloned.** The adapter architecture we
implemented came from the abstraction already written down in
[EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md) §6, not from upstream code.

# Relevant patterns found

- Repo is TypeScript, described as "Public procurement intelligence — find RFPs before your
  competition does". Confirms the one-adapter-per-source registry framing in our own registry entry.
- Registry-documented shape (`PublicProcurementProvider` → `SamGovProvider`, `UsaSpendingProvider`,
  `StateProcurementProvider`, `LocalGovernmentProvider`, `ManualWebResearchProvider`) is what we
  built against.

# What maps to our codebase

`apps/web/lib/procurement/providers/` — provider interface, per-source adapters, normalized notice
type, dedupe/upsert on `(organization_id, provider, external_id)`.

# What we are adopting

The **concept only**: one adapter per public procurement source behind a single
`PublicProcurementProvider` interface returning a normalized notice, with tenant-scoped
dedupe/upsert. No upstream code, schema, or naming was copied.

# What we are explicitly NOT adopting

- Any upstream database as our canonical store — `public_sources` is ours, RLS-scoped, and holds only
  what an operator explicitly watched or started.
- Background synchronization jobs. P4 is operator-initiated search; Discover persists nothing on view.
- Opportunity matching / scoring / fit ranking. We deliberately show provider fields verbatim with no
  AI fit percentage.

# License/copy implications verified

GitHub API reports **`license: null`** as of 2026-08-21 — no license file detected. Per
`.cursor/rules/external-reference-repos.mdc`, unlicensed projects are **REFERENCE ONLY**. Copying
source is not permitted without explicit approval. Nothing was copied.

# Local files affected

- `apps/web/lib/procurement/providers/{types,index,sam-gov,manual}.ts`
- `supabase/migrations/20260821180000_p4_public_opportunity_discovery.sql`

# Status

INSPECTED FOR TASK (metadata + license only) · CONCEPT ADOPTED · CODE REFERENCE-ONLY (unlicensed)
