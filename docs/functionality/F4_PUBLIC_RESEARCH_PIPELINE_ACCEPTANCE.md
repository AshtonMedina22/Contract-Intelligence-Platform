# F4 — Public Research Acquisition + Verified Research Fact Pipeline

**Status:** Implemented 2026-08-21 · Ask research plane + Intelligence Research UI · Does **not** auto `HUMAN_VERIFIED` · No LangGraph · No second chatbot

## Scope

Bounded public research runs produce `research_sources` + `research_facts` (`AI_EXTRACTED` only). Humans verify/reject/edit/conflict each fact. Ask keeps two rails:

| Rail | Role |
| --- | --- |
| Live public (`search_public_research` / USAspending tools) | Cite-only — never durable truth |
| Durable `research_facts` (`search_verified_research_facts`) | Prefer **HUMAN_VERIFIED** only; AI_EXTRACTED excluded by design |

Reports already filter `research_facts` to `HUMAN_VERIFIED` — F4 does not weaken that.

## Lifecycle

```
QUEUED → RESEARCHING → REVIEW_READY | FAILED
                         ↓ (all facts HUMAN_VERIFIED or REJECTED)
                      VERIFIED (any verified) | REJECTED (all rejected)
```

Refresh (`Re-research`) sets `RESEARCHING` again and **appends** new sources/facts; historical rows are never deleted.

## Schema

Migration `supabase/migrations/20260821220000_f4_research_pipeline.sql`:

- `research_runs` — type, status, query/purpose, plan jsonb, optional entity FKs, created_by, errors
- `research_sources` — per-run URL capture; unique `(research_run_id, url)`; `url_hash` for org-level lookup
- `research_facts` — adds `research_run_id`, `research_source_id`, `claim`, `confidence` (claim ↔ title)
- `verification_events.research_fact_id` — audit for research-fact review
- RLS `is_org_member` on new tables
- **Preserves** `research_facts_verified_requires_actor` (asserted in migration)

## Tools / modules

| Module | Role |
| --- | --- |
| `lib/ask/research/plan.ts` | Deterministic `buildResearchPlan(type, seed)` subquestions |
| `lib/ask/research/persist-run.ts` | create / recordSources / insert AI_EXTRACTED / complete / refresh / status sync |
| `lib/ask/research/execute-run.ts` | Bounded execute: web provider + USAspending per hint; soft party link |
| `lib/ask/research/synthesize-brief.ts` | `generateResearchBrief` — verified vs unverified disclosed separately |
| `intelligence/research/actions.ts` | start / refresh / verify / reject / edit / conflict (actor required) |
| Ask `search_verified_research_facts` | Durable HUMAN_VERIFIED retrieval |

Fixture providers / `FIXTURE-*` external ids are refused at persist.

## UI

Intelligence → **Research**: create run (type + query), list runs, open run → sources/facts, Verify/Reject/Conflict/Edit, Re-research, brief with honesty disclosure. Buyers page links to Research runs.

## Acceptance

```bash
npm run test:f4-research-pipeline
npm run test:phase6-ask
npm run test:phase5-intelligence   # if feasible
```

Checks: plan subquestions; persist AI_EXTRACTED only; fixture refuse; verify requires actor (grep + constraint); duplicate source refresh retains history; ambiguous entity no invent; status transitions; Ask/report never auto-promote; no LangGraph / no AskChatClient on Research pages.

## Honest limits / blockers

- Live web search needs `TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`; without keys, web subquestions return empty (USAspending still usable).
- Soft party link is exact normalized name/UEI only — ambiguous duplicates stay unlinked.
- Brief is deterministic (no LLM synthesis).
- Migration must be applied on the target DB before UI writes succeed.

## References

- [open_deep_research](../reference-repos/open-deep-research.md) — citation discipline adopted; LangGraph orchestration **declined**
- [morphic](../reference-repos/morphic.md) — single Ask surface; second chatbot **declined**; live public = cite-only rail
- [opencontracts](../reference-repos/opencontracts.md) — human verify as ground truth; never auto-promote AI extraction
