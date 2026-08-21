# Repository

USAspending API — https://github.com/fedspendingtransparency/usaspending-api  
Public API base — https://api.usaspending.gov/api/v2/

Related (tool-shape reference only): USAspending MCP Server — https://github.com/cyanheads/usaspending-mcp-server (Apache; inspect LICENSE before any copy). **Not a runtime dependency** for F3 — we call the public HTTP API directly from Ask tools.

# Task that caused inspection

F3 Federal Award / Buyer / Competitor Data Engine
(`docs/functionality/F3_FEDERAL_AWARD_INTELLIGENCE_ACCEPTANCE.md`).

# Relevant upstream surfaces inspected

- `POST /api/v2/search/spending_by_award/` — Advanced Award Search (filters + fields + page/limit)
- `GET /api/v2/awards/{generated_unique_award_id}/` — award detail
- `GET /api/v2/references/toptier_agencies/` — lightweight health ping
- Filter vocabulary: agencies, recipient_search_text, naics_codes, psc_codes, award_amounts, time_period, place_of_performance_locations, award_ids, award_type_codes
- MCP server README/tool names (award search, award detail, recipient) — **pattern only**; no MCP client installed

No upstream server code was copied into this repository.

# Relevant patterns found

- Complex filter object + explicit field list (not open-ended SELECT *)
- Pagination via `page` / `limit` and `page_metadata.hasNext`
- Public data; no API key required for typical read endpoints
- Award portal URLs on `www.usaspending.gov/award/{id}` for human citation

# What maps to our codebase

| Upstream | Local |
| --- | --- |
| Award search / detail | `apps/web/lib/ask/research/usaspending.ts` |
| Recipient identity soft-match | `apps/web/lib/ask/research/normalize-party.ts` |
| Ask tools | `search_federal_awards`, `get_federal_award`, `lookup_federal_recipient` in `apps/web/lib/ask/tools.ts` |
| Optional store | `research_facts` with `provider=usa_spending`, `AI_EXTRACTED` only |

# What we are adopting

- Calling the **live public API** for federal award observations
- Filter/pagination conventions and normalized citation fields (id, recipient, agency, amount, dates, NAICS/PSC, PoP, source URL, retrieved_at)
- MCP-inspired **tool names/shapes** for Ask (search / get / recipient) without running MCP

**F23 (2026-08-21):** Acquisition run calls `spending_by_award` for L&P / NAICS 561612 and stores
hits as **REFERENCE_DATA** / LINK_ONLY candidates — never fabricated procurement packages, never
canonical `awards` rows from this path alone.

# What we are explicitly NOT adopting

- Writing USAspending rows into canonical `awards` or `pricing_lines`
- Auto-`HUMAN_VERIFIED` or market-share analytics
- Inventing `clients` / `competitors` from recipient names
- Installing or depending on the USAspending MCP server at runtime
- Treating USAspending as a `PublicProcurementProvider` (opportunity discovery stays F2/SAM)

# License / copy caution

Prefer the public API/dataset over copying service code. MCP server is Apache-licensed — still reference-only unless explicitly approved for adaptation. Our local client is original code under this repo's license.
