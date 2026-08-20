# Phase 11 acceptance

> **Legacy engineering Phase 11 → Canonical product Phase 6 (partial).** FTS RPC + Ask/Content UI; early/partial / unvalidated. Not purpose-aware; not product-complete Search/Ask.

Hybrid retrieval over **verified** knowledge: SQL filters + Postgres FTS + optional pgvector. No Pinecone/Qdrant. No chatbot.

## What landed

- `document_chunks` — HUMAN_VERIFIED only (CHECK). Citations store Storage `storage_path` + `source_fact_id`
- Generated `tsvector` + GIN; optional `vector(1536)` + HNSW
- `promote_knowledge_chunk_from_fact` — skips AI_EXTRACTED
- `search_verified_knowledge` — drafting mode excludes `DO_NOT_USE`, `SUPERSEDED`, and non-current versions
- Embeddings via AI Gateway (`EMBEDDING_MODEL`, default `openai/text-embedding-3-small`) when configured; FTS works without it
- UI: `/intelligence/content`

## Checks

```bash
npm run test:phase11-hybrid-rag
npm run typecheck
```

## Out of scope (still true)

Chatbot, Pinecone, Qdrant, Glide pricing (Phase 12), Tiptap (Phase 13).
