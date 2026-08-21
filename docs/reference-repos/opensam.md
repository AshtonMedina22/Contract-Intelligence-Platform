# Repository

OpenSAM — https://github.com/akshayakula/OpenSAM

# Task that caused inspection

P4 productization: public opportunity discovery + watchlist + start pursuit
(`docs/productization/P4_OPPORTUNITY_DISCOVERY_ACCEPTANCE.md`).

# Relevant upstream files inspected

Repository metadata only (GitHub API, 2026-08-21): description ("Open Source Tool for going through
SAM.gov with AI"), TypeScript, license field, last push 2025-08-16. **No source files were read and
the repository was not cloned.**

# Relevant patterns found

Our `SamGovProvider` request shape was written from the **documented SAM.gov v2 search API** plus the
OpenSAM-style parameter conventions already summarized in our registry entry:

- `GET api.sam.gov/opportunities/v2/search` with `api_key`, `postedFrom`, `postedTo`, `limit`
- `postedFrom` / `postedTo` in `MM/dd/yyyy`
- keyword filter as `title`, NAICS as `ncode`, agency as `organizationName`
- results under `opportunitiesData[]`, notices keyed by `noticeId`, with `fullParentPathName`,
  `responseDeadLine`, `classificationCode`, `typeOfSetAside`, `placeOfPerformance`, `uiLink`

# What maps to our codebase

`apps/web/lib/procurement/providers/sam-gov.ts` — live adapter, plus `placeOfPerformance` flattening
to "City, ST" and the fixture fallback.

# What we are adopting

Request parameter naming and response-field mapping conventions for SAM.gov. Nothing else.

# What we are explicitly NOT adopting

- OpenSAM as a federal system of record.
- Semantic/AI matching of notices to our capabilities. No fit score, no embedding-based ranking of
  public notices — a public listing is not a bid decision.
- Any persistence of search results. Discover writes nothing until an operator acts.

# License/copy implications verified

GitHub API reports **`license: null`** as of 2026-08-21 — no license file detected. Per
`.cursor/rules/external-reference-repos.mdc`, unlicensed projects are **REFERENCE ONLY**. Nothing was
copied. The parameter names we use are facts about a public government API, not upstream authorship.

# Open risk

The live SAM.gov path has **never been exercised against a real response** (no `SAM_GOV_API_KEY` in
this environment). Parameter names and the `opportunitiesData` shape are unvalidated in practice.
First live run should be treated as unverified and reconciled against the actual payload.

# Local files affected

- `apps/web/lib/procurement/providers/sam-gov.ts`
- `apps/web/lib/procurement/providers/fixtures/sam-gov.sample.json`
- `apps/web/.env.example` (`SAM_GOV_API_KEY`)

# Status

INSPECTED FOR TASK (metadata + license only) · API CONVENTIONS ADOPTED · CODE REFERENCE-ONLY (unlicensed)
