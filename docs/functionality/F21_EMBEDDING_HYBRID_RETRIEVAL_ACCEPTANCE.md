# F21 — Real Embedding + Hybrid Semantic Retrieval Lifecycle

**Date:** 2026-08-21  
**Verdict:** **PASS — lifecycle active; live retrieval currently FTS fallback**

## Activation

- Migration `20260821380000_f21_embedding_lifecycle.sql` applied to the reachable Supabase database.
- Store: PostgreSQL + pgvector only (`vector(1536)`); no external vector database.
- Configured model identity: `openai/text-embedding-3-small@1`, dimension `1536`.
- The live query-embedding smoke returned `null`, so retrieval correctly used FTS. The provider is configured through the AI Gateway path, but a usable embedding response was not available in this run.
- Bounded backfill (`limit=10`, `batch=5`) scanned **0** eligible rows: F18 currently leaves the legacy chunk corpus `internal_unverified`, so F21 did not embed or elevate it.

Semantic similarity is a retrieval signal, not verified truth. Verification, F18 classification, tenant RLS, purpose, current-version, and reuse gates run before similarity can affect a result.

## Lifecycle shipped

- Shared `EmbeddingProvider` exposes provider/model/version identity, 1536-d validation, batch/query embedding, SHA-256 content hashes, and fail-closed compatibility checks.
- Chunk writes persist model identity, dimension, content hash, and generation timestamp.
- Matching hash + model skips regeneration. A content change or trust/reuse/version ineligibility clears the vector and all metadata.
- Hybrid SQL compares a vector only when query and chunk metadata have the exact same model/version identity and dimension. Missing, failed, or incompatible vectors remain FTS-only and report `match_kind=fts`.
- Ask, Response evidence/drafting, F7 matching, Reports, Pursuit strategy, and Content search use the shared retrieval path. LOCATE intentionally remains structured SQL + FTS and states that limitation.
- `scripts/backfill-chunk-embeddings.mjs` is bounded, idempotent, cursor-resumable (`--after=<uuid>`), and fail-soft.

## Evaluation results

Command: `npm run test:f21-hybrid` — **11/11 PASS**

| Case | Score | Match kind / outcome |
| --- | ---: | --- |
| Exact lexical | 0.233333 | `fts` |
| Paraphrase | — | semantic skipped; FTS fallback active |
| Synonym | — | semantic skipped; FTS fallback active |
| Buyer | 0.257143 | `fts` |
| Pricing | 0.084286 | `fts` |
| Drafting | 0.125758 | `fts` |
| Loss analysis | 0.088889 | `fts` (`DO_NOT_USE` retrospective only) |
| `DO_NOT_USE` drafting | — | excluded |
| Superseded drafting | — | excluded |
| Missing embedding | 0.233333 | `fts` |
| Incompatible model | 0.250000 | `fts` |
| Wrong tenant | — | excluded |

The acceptance suite requires non-null query embeddings for paraphrase/synonym assertions whenever the provider smoke succeeds. In this run it did not, so those semantic-only assertions were explicitly skipped rather than represented as passing semantic retrieval.

## Verification

- `test:f21-hybrid` — **11/11 PASS**
- `test:phase11-hybrid-rag` — **10/10 PASS** (fixture updated to obey F18 classification)
- `test:phase6-ask` — **47/47 PASS**
- `test:p6-response-workspace` — **41/41 PASS**
- `test:phase2-rls` — **51/51 PASS**
- Lint — PASS
- TypeScript — PASS
- Next.js 16.3.1 production build — PASS (78/78 static generation)
- IronBee browser — Content search submitted on the lasting operator org, returned the honest zero-hit/F18-gated state, screenshot captured, and a clean reload emitted **0 new console errors**

## Honest blockers

1. A live embedding response was unavailable, so no semantic score is claimed.
2. The current live corpus has zero F21-eligible chunks after F18 classification gates; an authorized human must classify source documents before bounded backfill can embed them.
3. Historical Pilot trust/corpus limitations remain unchanged. F21 does not convert harness verification or similarity into source authority.
