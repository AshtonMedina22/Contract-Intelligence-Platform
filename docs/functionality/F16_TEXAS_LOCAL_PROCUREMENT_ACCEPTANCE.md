# F16 — Texas / State / Local Procurement Source Connectors

**Status:** Implemented 2026-08-21 · Extends F2/P4 `PublicProcurementProvider` · **No second framework** · Does **not** scrape ESBD · Does **not** invent awards · Does **not** auto `HUMAN_VERIFIED` / Start Pursuit ingest

## Scope

Add honest capability modes and state/local adapters on the existing opportunity provider stack: Texas ESBD (LINK_ONLY + MANUAL_IMPORT), Socrata SODA, RSS/Atom, JSON listing feeds, optional HTML LINK_ONLY, and local/ISD manual paste. Soft cross-source dedupe and watchlist addendum-refresh cues. Cron sync remains **AUTOMATED + live only** (fixture fail-closed).

## Capability model

| Capability | Meaning | Cron sync |
| --- | --- | --- |
| `AUTOMATED` | Public API / allowlisted feed | Yes when `mode=live` |
| `MANUAL_IMPORT` | Operator paste / URL normalize | Never |
| `LINK_ONLY` | Portal bookmark; operator opens portal | Never |

## Providers

See [F16_PROVIDER_REGISTRY.md](../reference-repos/F16_PROVIDER_REGISTRY.md) for method, terms, last verified, and status.

| Provider id | Capability | Live gate |
| --- | --- | --- |
| `sam_gov` / fixture | AUTOMATED | `SAM_GOV_API_KEY` |
| `socrata` | AUTOMATED | `SOCRATA_DOMAIN` + `SOCRATA_DATASET_ID` |
| `rss` | AUTOMATED | `PROCUREMENT_RSS_URL` |
| `json_feed` | AUTOMATED | `PROCUREMENT_JSON_FEED_URL` |
| `texas_esbd` | LINK_ONLY (+ MANUAL_IMPORT paste) | Portal bookmark only |
| `html_listing` | LINK_ONLY | No scrape |
| `manual` / `state` / `local` | MANUAL_IMPORT | Operator paste |

## Schema (`20260821330000_f16_state_local_sources.sql`)

- Widen `public_sources.provider` for `texas_esbd|socrata|rss|json_feed|html_listing` (keeps `state|local`)
- Columns: `capability`, `content_changed_at`, `addendum_refresh_needed`, `duplicate_of_id`, `source_health`
- `opportunity_search_profiles.source_health` + criteria docs for agency/source config (reuse profiles — no second profile table)

## Sync behavior

- `isLiveSyncProvider`: requires `capability=AUTOMATED` and `mode=live`
- Fixture / LINK_ONLY / MANUAL → SKIP + zero upserts
- `content_hash` change on WATCHING / REVIEWING / CONVERTED → `addendum_refresh_needed=true` + `content_changed_at` — **does not** auto-create F11 runs
- Soft dedupe: same `solicitation_number` + buyer → `duplicate_of_id` hint only
- Persist provider/profile `source_health` jsonb

## UI

- Discover: capability badges on provider banners; Texas ESBD link + paste form; manual kind = Manual / Local·ISD / State
- Watchlist: “Listing changed — ingest addendum” cue; soft-duplicate note; capability badge

## Trust rules (unchanged)

- Start Pursuit → `AI_EXTRACTED` only
- No auto document ingest
- Never invent awards from a solicitation that disappears from a portal
- openrfps = **GPL reference only — no source copy**

## Agency profile criteria (documented)

Reuse `opportunity_search_profiles.criteria` jsonb:

```json
{
  "keywords": "security",
  "state": "TX",
  "agencyType": "ISD",
  "provider": "socrata",
  "socrata": { "domain": "data.example.gov", "datasetId": "abcd-1234" },
  "rssUrl": "https://example.gov/procure.rss",
  "jsonFeedUrl": "https://example.gov/opportunities.json",
  "portalUrl": "https://www.txsmartbuy.com/esbd"
}
```

## Acceptance

```bash
npm run test:f16-texas-local
npm run test:f2-opportunity-engine
npm run test:f4-research-pipeline   # spot
npm run test:f11-solicitation-change
npm run test:phase2-rls
npm run lint && npm run typecheck && npm run build
```

## Honest limits

- Texas ESBD has **no** public solicitation API — LINK_ONLY / MANUAL only
- Socrata/RSS/JSON live paths unproven until env URLs/tokens are set
- HTML listing never scrapes; allowlist automation is future work
- Soft dedupe is a hint, not a merge
- Addendum cue does not run F11 detection — operator must ingest the PDF
