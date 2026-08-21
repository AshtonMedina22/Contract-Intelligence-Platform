# F2 — Public Procurement Opportunity Discovery Engine

**Status:** Implemented 2026-08-21 · Extends P4 · Does **not** invent live public notices · Does **not** mark public records `HUMAN_VERIFIED`

## Scope

Harden the existing `PublicProcurementProvider` surface, add an explicit lifecycle `status` on `public_sources`, org-scoped search profiles with a secured daily sync cron, wire manual paste entry on Discover, and keep Start Pursuit trust identical to P4.

## Provider contract (extends P4)

| Method | Behavior |
| --- | --- |
| `search(query)` | Unchanged entry point; query may include `setAside`, `state`, `offset` |
| `getOpportunity(id)` | Preferred fetch-by-id; `getById` remains as alias |
| `getDocuments(id)` | Returns `[]` or links present on `raw_payload` — **never invents** |
| `healthCheck()` | Fixture: healthy + honesty message. Live: key present + lightweight ping; failure reported honestly |
| `normalizePublicOpportunity` | Shared helper (unchanged contract) |

SAM.gov (`sam-gov.ts`): improved PoP flattening; attachment extraction when `resourceLinks` / `attachments` exist; `buildSamSearchUrl` + `offset` pagination for request construction tests; fixture mode when `SAM_GOV_API_KEY` / `SAM_API_KEY` unset.

## Status model

`public_sources.status` check enum:

`NEW` \| `WATCHING` \| `DISMISSED` \| `REVIEWING` \| `CONVERTED_TO_PURSUIT` \| `CLOSED`

Backfill (migration `20260821210000`):

1. `dismissed_at` → `DISMISSED`
2. linked pursuit → `CONVERTED_TO_PURSUIT`
3. `watchlisted_at` → `WATCHING`
4. past `due_on` → `CLOSED`
5. else → `NEW`

`content_hash` (nullable) stores a stable FNV-1a of normalized fields for sync change detection.

Operator actions set status via `statusForOperatorAction`. Sync uses `statusAfterSync` so WATCHING / DISMISSED / CONVERTED / REVIEWING are preserved; past-due NEW rows become CLOSED.

## Search profiles + sync

Table `opportunity_search_profiles` (org RLS via `is_org_member`):

- `name`, `enabled`, `criteria` jsonb, optional `schedule_cron`, `last_run_at`, `last_error`

Server: `lib/procurement/sync/run-profile-sync.ts` — enabled profiles → `provider.search` → dedupe `(provider, external_id)` → upsert `public_sources` (unique key) updating `retrieved_at` / `content_hash` / status. **Never invents rows.** **Fixture/sample mode is skipped (fail closed)** — sync persists live provider hits only. Ad-hoc Discover may still show labeled fixtures in the UI without writing on view (P4).

Cron: `GET /api/cron/public-opportunity-sync` — `CRON_SECRET` Bearer gate (same pattern as intelligence-digest). `vercel.json` daily at `0 14 * * *`.

UI: Discover page dense forms for manual entry + list/create/edit/disable/delete profiles (org only).

## Start Pursuit trust (P4 preserved)

- `research_facts.verification_status = AI_EXTRACTED` only (`assertUnverified`)
- Buyer linked by **name match only** — no client invented
- Provenance columns on `opportunities`
- No auto-ingest of solicitation documents

## Manual entry

Discover → “Manual public notice entry” → `normalizeManualEntry` → Watch or Start pursuit.

## Acceptance

```bash
npm run test:f2-opportunity-engine
npm run test:p4-discovery
npm run test:p4-discovery-rls
```

Checks cover: normalize/dedupe/hash, status transitions, fixture healthCheck, mocked SAM request construction/pagination, sync upsert plan (no invent / no duplicate), **fixture sync skip (zero upserts)**, start-pursuit never HUMAN_VERIFIED, migration/cron greps, live RLS on `opportunity_search_profiles` when env present.

## Honest limits / blockers

- Live SAM.gov against a **real** response still unproven when no key is set (fixture mode).
- Mocked-fetch proves request shape only — not SAM.gov schema drift.
- Sync **skips** fixture mode when no API key — profile `last_error` records SKIP; no sample rows are written to `public_sources`.
- Profile `schedule_cron` is documentation/ops metadata; the bounded Vercel cron is what actually runs.

## References

- TenderRadar / OpenSAM — adapter + SAM parameter conventions (reference-only; unlicensed upstream). Notes updated under `docs/reference-repos/`.
- OCDS — external lifecycle vocabulary only; not our schema of record.
