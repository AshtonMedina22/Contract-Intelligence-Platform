# F7 — Historical Proposal Content Intelligence + Reuse Engine

**Date:** 2026-08-21  
**Status:** SHIPPED (extends `proposal_sections` + `document_chunks` + purpose-aware retrieval; no `content_blocks`)  
**Test:** `npm run test:f7-proposal-content`  
**Migration:** `20260821250000_f7_proposal_content.sql`

## Architecture

Reuse the existing verified-knowledge path. Do **not** invent a parallel `content_blocks` table.

| Piece | Local |
| --- | --- |
| Taxonomy | `apps/web/lib/content/taxonomy.ts` |
| Reuse policy (pure) | `apps/web/lib/content/reuse-policy.ts` |
| Heuristic extraction | `apps/web/lib/content/extract-sections.ts` |
| Promote gates | `apps/web/lib/content/promote.ts` |
| Requirement → passages | `apps/web/lib/content/match-requirement.ts` |
| Run persistence (RLS) | `apps/web/lib/content/runs.ts` |
| Chunk promote default | `promote_knowledge_chunk_from_fact` → `REVIEW_REQUIRED` |
| Retrieval | existing `search_verified_knowledge` / `searchVerifiedKnowledge` |

## Hard rules

- Won ≠ auto-approve. Lost ≠ auto-reject / auto `DO_NOT_USE`.
- `outcome_snapshot` is **display only** — never drives `reuse_status` or drafting eligibility.
- Extraction emits **AI_EXTRACTED** only; `reuse_status` stays null until human/policy.
- Promote / APPROVED requires **HUMAN_VERIFIED**.
- Fresh chunk promote defaults to **REVIEW_REQUIRED** (never `APPROVED` from WON).
- Embeddings only from HUMAN_VERIFIED eligible text via existing pgvector path.
- User `createClient()` RLS only — never `createAdminClient` for content paths.
- Never dump full prior proposals into GPT; cite matched passages (limit ≤12 for drafting match).
- Supersede preserves history (no deletes); marks related chunk `is_current_version=false` when linked.
- Ask: no second chat surface — existing `search_verified_passages` stays purpose-bound.

## Schema

- `proposal_content_runs` — QUEUED | EXTRACTING | REVIEW_READY | FAILED | DONE; org RLS SELECT/INSERT/UPDATE
- `proposal_sections` columns: `body_text`, `verification_status`, `reuse_status` (nullable), `superseded_by_id`, `content_run_id`, `outcome_snapshot`, `buyer_name`, `page_start`, `page_end`
- RPCs: `supersede_proposal_section`, `set_proposal_section_reuse` (APPROVED gated on HUMAN_VERIFIED)

## Wire

- Response draft / evidence → `matchRequirementToProposalContent` (`PROPOSAL_DRAFTING`, limit ≤12)
- Intelligence → Content: taxonomy / verification / reuse filters + section catalog
- Ask: purpose-aware `search_verified_passages` (no new tool)

## Acceptance

```bash
npm run test:f7-proposal-content
npm run test:phase6-ask
npm run test:p6-response-workspace
npm run lint -w web && npm run typecheck -w web && npm run build -w web
```

Checks include: taxonomy heading extraction, page provenance, human gate before APPROVED, WON not auto-approved, LOST not auto-rejected, DO_NOT_USE excluded from drafting / included for LOSS_ANALYSIS, SUPERSEDED excluded, embed eligibility, tenant org checks, migration/wiring greps.

## Reference

Pattern only: [rfpilot.md](../reference-repos/rfpilot.md) (section taxonomy). AutoRFP / OpenContracts consulted as pattern references — no AGPL copy.
