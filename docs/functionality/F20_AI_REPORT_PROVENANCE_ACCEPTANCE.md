# F20 — AI / Report Provenance & Audit History acceptance

**Status:** IMPLEMENTED + ACCEPTANCE-PROVEN (2026-08-21).
**Migration:** `20260821370000_f20_ai_audit_history.sql` — applied to the reachable Supabase Postgres project.

## Shipped

- Durable org-scoped `ask_conversations` and append-only `ask_messages`; the Ask UI reopens database history and no longer uses `sessionStorage` as truth.
- Immutable completed `ai_runs` for `LOCATE | ASK_ANALYZE | REPORT`, including purpose, model, latency, cutoff, outcome and optional links to F4 `research_runs`, F6 `analytical_runs`, and immutable `report_runs`.
- Append-only `ai_tool_traces` with sanitized parameters, result references, timing, success/failure, and linked F4/F6/report run IDs.
- `ai_citations` supports document, current version, extracted fact, chunk, research run/fact, analytical run and structured-record references.
- `report_runs` stores immutable JSON bodies. Every rerun inserts a new row and may point to `parent_report_run_id`; no report update path exists.
- Retention is configuration only (`ai_audit_retention_config`, default 2,555 days). F20 installs no purge function or cron.
- RLS permits org-member SELECT/INSERT; conversation UPDATE is trigger-limited to title; authenticated DELETE is revoked on every F20 table.

## Runtime wiring

- `/api/ask/chat` attaches a UUID conversation, collects AI SDK tool lifecycle events, and persists final UI messages, the AI run, traces and citations from the stream completion callback.
- Tool parameters pass through a recursive sanitizer that redacts auth headers, cookies, passwords, API keys, client secrets and tokens, including credential-shaped string values.
- `ask_structured_analytics` exposes its F6 `analytical_runs.id`; verified research evidence exposes its F4 `research_run_id` / `research_fact_id`; report tools expose `reportRunId`.
- LOCATE and REPORT server paths write their own `ai_runs`; all `generateIntelligenceReport` calls insert `report_runs`.
- The existing CIP Ask surface remains the only chat product.

## Acceptance

`npm run test:f20-ai-audit` — **15/15 PASS**

Adversarial coverage:

1. all six audit/history tables and append-only grants
2. no deletion cron and no authenticated DELETE
3. streaming finish wiring
4. durable history replacing `sessionStorage`
5. INSERT-only reports and parent lineage
6. secret/header/cookie/password/token sanitization
7. immutable rerun bodies
8. LOCATE / ASK / REPORT / insufficient-evidence outcomes
9. multi-tool success plus failed tool
10. F4 and F6 links
11. ordered follow-up messages
12. structured/research citations
13. cross-tenant denial
14. title-only conversation UPDATE

Regression evidence completed in this session: lint PASS; TypeScript PASS. Full build and requested F6/Phase 6/RLS regression results are recorded in `WORK_TRAIL.md`. IronBee browser verification found and fixed a draft-conversation hydration mismatch, then proved a real Ask exchange persisted and reopened with no new console errors.

## Honest limits

- Retention is only a stored policy value; no destructive retention worker exists in F20.
- Tool outputs are represented by bounded references, not complete raw provider payloads.
- Existing F4/F6 rows are linked, never copied into a mega-run table.
- Historical pilot and corpus limitations remain unchanged; durable history does not make thin evidence sufficient.
