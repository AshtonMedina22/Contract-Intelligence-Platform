# openrfps (reference only)

**URL:** https://github.com/openprocurement/openrfps (and related forks)  
**License:** **GPL** — **REFERENCE ONLY. Do not copy source into this repository.**  
**Inspected for:** F16 Texas / state / local procurement connectors (2026-08-21)

## What we took

- Conceptual awareness that some TX/state scrapers exist in the wild
- Reminder that HTML portal scraping is legally/ToS-sensitive

## What we refused

- Any GPL source, scrapers, HTML parsers, or agency-specific crawl code
- Claiming Texas ESBD is automated because a scraper exists elsewhere

## Local landing

Our adapters are original code under `apps/web/lib/procurement/providers/` (`texas-esbd.ts`, `socrata.ts`, `rss.ts`, `json-feed.ts`, `html-listing.ts`) with honest LINK_ONLY / MANUAL_IMPORT for ESBD.
