# F3 — Federal Award / Buyer / Competitor Data Engine

**Status:** Implemented 2026-08-21 · Ask research plane · Does **not** invent market share · Does **not** auto `HUMAN_VERIFIED` · Does **not** invent CRM buyers · Does **not** write canonical `awards` from USAspending

## Scope

Add a **separate** USAspending.gov award client under the Ask research plane (`lib/ask/research/usaspending.ts`). This is **not** a `PublicProcurementProvider` and does not extend the F2 opportunity sync path.

Optional persistence is `research_facts` with `verification_status=AI_EXTRACTED` and `provider=usa_spending` only — via an explicit helper that asserts unverified status. Search tools do **not** auto-persist every hit.

## Provider contract

| Method | Behavior |
| --- | --- |
| `searchAwards(query)` | POST `/api/v2/search/spending_by_award/` with agency, recipient/UEI, NAICS, PSC, award date range, place of performance, amount bounds, award type codes, award ID, pagination |
| `getAward(id)` | GET `/api/v2/awards/{id}/` — normalized detail or null |
| `searchByRecipient(name)` | Thin wrapper over `searchAwards({ recipient })` |
| `healthCheck()` | Live: ping `/api/v2/references/toptier_agencies/`. Fixture: healthy + honesty that `FIXTURE-USA-*` is unit-test only |
| `normalizeFederalAward` | award id, PIID if present, recipient (+ UEI), agency, amount, dates, NAICS/PSC, description, PoP, source URL, `retrieved_at` |

Caching: short-TTL in-memory Map keyed by query hash. Bounded backoff/retry on HTTP 429 / 5xx.

**Live failure:** honest error, empty results — **no silent fixture fallback**. Fixtures require `USA_SPENDING_USE_FIXTURES=1` or `forceFixture: true` (unit tests only). Never sync fixtures into DB as live awards (`buildResearchFactFromFederalAward` refuses `FIXTURE-USA-*`).

## Party normalization

`lib/ask/research/normalize-party.ts`:

- Normalize display name (corporate suffix strip) + optional UEI/CAGE
- `matchExistingClient` / `matchExistingCompetitor` — exact normalized name or UEI only
- Ambiguous → `{ match: null, ambiguity: true, candidates: [{ status: queued_identity, suggested_name, uei }] }` — **no auto-link, no invented clients/competitors**
- Prefer in-memory tool output over a migration

## Ask tools

Wired in `lib/ask/tools.ts` (+ `usaspending.gov` on official hosts in `research/provider.ts`):

| Tool | Rail |
| --- | --- |
| `search_federal_awards` | PUBLIC — OFFICIAL_PUBLIC / PUBLIC_UNVERIFIED |
| `get_federal_award` | PUBLIC + optional recipient reconciliation |
| `lookup_federal_recipient` | PUBLIC + soft identity check |

Evidence class is never `HUMAN_VERIFIED`. Amounts are never mixed into L&P proposed / buyer awarded / current `pricing_lines`.

## Intelligence thin wire

Market / Buyers / Competitors honesty strips include `FEDERAL_AWARD_RESEARCH_NOTE` (USAspending public API / `research_facts` `provider=usa_spending`). Ask chips launch federal-award purposes. No market-share KPI.

## Four truths

USAspending amounts are **public observations only**. They must not be written into or presented as L&P `proposed_rate` / `awarded_rate` / `current_rate` / `requested_rate`.

## Acceptance

```bash
npm run test:f3-federal-awards
npm run test:phase6-ask
```

Checks: request construction / filters (mocked fetch), pagination, normalization, duplicate-name soft-match, ambiguous recipient no auto-link, source preservation + AI_EXTRACTED-only persist helper, rate-limit backoff, no market-share UI greps, architecture separation from `PublicProcurementProvider`. Live health/search attempted when network allows; blockers are non-fatal (fixtures cover contracts).

## Honest limits / blockers

- Live USAspending needs outbound HTTPS; if blocked, acceptance still PASS on mocks/fixtures and documents the blocker.
- No UEI column on `clients` / `competitors` today — UEI match only when supplied on the in-memory party list (e.g. from an award payload).
- Optional persist is a **builder** only; operators / future actions must call insert explicitly.
- MCP server (cyanheads/usaspending-mcp-server) is **reference-only** for tool shape — not a runtime dependency.

## References

- [USAspending API notes](../reference-repos/usaspending-api.md)
- Registry: [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md) §9–10
