# OpenContracts

https://github.com/Open-Source-Legal/OpenContracts

# Task that caused inspection

P2 Data Ops research: PDF coords, annotation, human verify, source↔fact navigation (max 3 refs).

# Relevant upstream files inspected

- `LICENSE` (raw main, 2026-08-20) — MIT
- README / GitHub license badge — MIT
- Docs: About, PDF Data Layer (PAWLs) — https://open-source-legal.github.io/OpenContracts/

# Relevant patterns found

- **Human annotation as ground truth** for the citation/knowledge graph; AI builds on annotations rather than replacing them.
- **PAWLs layer**: per-page tokens with bounding boxes (`text` + `bbox`), page width/height — portable overlay for highlight/select.
- **Multi-layer model**: PAWLs → searchable text (char↔token map) → annotations → relationships.
- **Source↔fact UX**: precise multi-page spans, label schemas, relationships, notes; View-source style navigation against the same PDF.
- Parser pipeline is pluggable (they use Docling REST as primary PDF parser) — orthogonal to our Verification landing zone.

# What maps to our codebase

Data Ops → Verification: `source_evidence`, `extracted_facts`, `verification_events`; `apps/web/.../verification/` (`pdf-source-pane`, workbench).

# What we are adopting

**Conceptual patterns only:** token/page coords → selected evidence → fact → human verify/reject; never auto-promote AI extraction.

# What we are explicitly NOT adopting

- Whole OpenContracts product (corpuses, MCP, forum, agents stack).
- Their Django/Docling-microservice stack as our architecture.
- Replacing four commercial truths / RLS / promotion gate.

# License/copy implications verified

**MIT** (Copyright 2026 John Scrudato IV) on `main` LICENSE as of 2026-08-20. Docs site also states MIT. Older forks / historical AGPL badges exist elsewhere — **do not copy from AGPL forks**. MIT allows adaptation with attribution; still prefer conceptual adaptation over wholesale paste.

# Local files affected

None this session (research only).

# Status

INSPECTED FOR TASK
