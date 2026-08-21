# F16 provider registry — Texas / state / local sources

**Last updated:** 2026-08-21  
**Rule:** Reuse `PublicProcurementProvider`. Do not copy GPL `openrfps` source. Do not violate ToS/robots/auth/rate limits.

| Source | Provider id | Method | Capability | Terms / limitations | Last verified | Automated? |
| --- | --- | --- | --- | --- | --- | --- |
| SAM.gov | `sam_gov` / `fixture` | Official Opportunities API v2 | AUTOMATED | Requires API key; fixture fail-closed without key | 2026-08-21 (F2; live key still optional) | Yes when keyed |
| Texas ESBD (TxSmartBuy) | `texas_esbd` | Browser portal + operator paste | LINK_ONLY + MANUAL_IMPORT | **No public solicitation API.** CPA open-data ≠ ESBD feed. Never scrape. Never invent awards from delisted notices. | 2026-08-21 (portal URL + paste normalize) | **No** |
| Socrata / SODA | `socrata` | SODA JSON `$limit`/`$offset`/`$q` | AUTOMATED | Domain + dataset + optional app token; honor 429; missing fields stay null | 2026-08-21 (fixtures + URL builder) | Yes when configured |
| Agency RSS/Atom | `rss` | HTTP GET feed parse | AUTOMATED | Public feeds only; 429 honest; no invent | 2026-08-21 (fixture XML parse) | Yes when URL set |
| Public JSON listing | `json_feed` | HTTP GET JSON array / `{items}` | AUTOMATED | Public JSON only; pagination query params when supported | 2026-08-21 (fixtures) | Yes when URL set |
| HTML portal listing | `html_listing` | Portal bookmark / paste | LINK_ONLY | **No scrape** until ToS-safe allowlist exists | 2026-08-21 | **No** |
| Manual / state / local / ISD | `manual` / `state` / `local` | Operator paste | MANUAL_IMPORT | Exact fields as entered | 2026-08-21 | **No** |
| USAspending | *(Ask plane — not this registry)* | Awards research | n/a | F3 — not a `PublicProcurementProvider` | 2026-08-21 | Ask tools only |

## Env gates (live AUTOMATED)

| Env | Provider |
| --- | --- |
| `SAM_GOV_API_KEY` / `SAM_API_KEY` | SAM |
| `SOCRATA_DOMAIN` + `SOCRATA_DATASET_ID` (+ optional `SOCRATA_APP_TOKEN`) | Socrata |
| `PROCUREMENT_RSS_URL` | RSS |
| `PROCUREMENT_JSON_FEED_URL` | JSON feed |

## External references (no copy)

| Repo | License | Use |
| --- | --- | --- |
| [openrfps](https://github.com/openprocurement/openrfps) (and forks) | **GPL** | Reference-only architecture notes — **refuse source copy** |
| TenderRadar | Unlicensed | Adapter concept only (already F2/P4) |
| Kingfisher / OCDS tooling | Varies | OCDS vocabulary / collection patterns — not TX ESBD |
| OpenSAM | Unlicensed | SAM parameter conventions only |

## Sync policy

Cron `/api/cron/public-opportunity-sync` persists **AUTOMATED + live** hits only. Fixture mode → SKIP. LINK_ONLY / MANUAL_IMPORT → never cron-upserted.
