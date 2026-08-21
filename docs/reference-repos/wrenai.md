# Repository

WrenAI — https://github.com/Canner/WrenAI

# Task that caused inspection

F6 Governed Structured Analytics + Natural-Language SQL  
(`docs/functionality/F6_STRUCTURED_ANALYTICS_ACCEPTANCE.md`).

# Relevant upstream surfaces inspected

- Semantic / business model: entities, relationships, metrics, dimensions
- NL → planned SQL with validation before execution
- Governed read-only execution against a warehouse/DB
- Reproducible query definitions and result explanation

No WrenAI server, MDL compiler, or UI was installed. Upstream LICENSE often restrictive/AGPL-class — **REFERENCE ONLY**.

# Relevant patterns found

- Separate **semantic layer** from free-form SQL generation
- Metrics carry business definitions (not ad-hoc SELECT *)
- Validate before execute; prefer read-only paths
- Explain / fingerprint results for auditability

# What maps to our codebase

| Upstream idea | Local |
| --- | --- |
| Semantic model | `apps/web/lib/analytics/semantic-model.ts` |
| Metric definitions | same — `METRICS` registry (no `market_share`) |
| Approved joins | `APPROVED_JOINS` |
| Plan validation | `query-plan.ts` (Zod) + `validate-sql.ts` rejector |
| Execution | `build-query.ts` → PostgREST via user `createClient()` RLS + `compute.ts` |
| Ask entry | `ask_structured_analytics` in `lib/ask/tools.ts` |
| Audit | `analytical_runs` migration |

# What we are adopting

- Semantic metric registry + parameterized plans (metricId, dimensions, filters, limit)
- Fail-closed SQL rejector if any raw SQL string appears
- Result contract with fingerprint / limitations / dataCutoff
- Ambiguous NL → clarification refuse (safe default)

# What we are explicitly NOT adopting

- The WrenAI stack, UI, or MDL runtime
- Unrestricted LLM-generated SQL against Supabase/Postgres
- Market-share metrics
- A second chat / analytics chatbot surface
- Service-role bypass of RLS for analytics

# License / copy caution

Treat WrenAI as **architecture/pattern reference only** until LICENSE is verified and copy is explicitly approved. Local code is original under this repository's license.
