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

## F4 follow-up (2026-08-21)

Same human-verify ground-truth rule applied to public `research_facts`: F4 acquisition writes
`AI_EXTRACTED` only; Verify/Reject require an actor and write `verification_events.research_fact_id`.
Never auto-promote public research to `HUMAN_VERIFIED`.

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

---

# Addendum — P5 Pursuit Overview + Bid Strategy (2026-08-21)

**No new upstream inspection.** This records where the pattern already captured above was reused, and
one place it did not fit.

**Reused.** "Human annotation as ground truth; AI builds on annotations rather than replacing them" is
now the rule the Overview's Bid Strategy runs on. Narrative bullets come from
`searchVerifiedKnowledge({ purpose: "BID_STRATEGY" })`, which only returns approved chunks, and each
one is quoted verbatim with its `reuse_status` and `source_page` shown. Nothing on the Overview
promotes an `AI_EXTRACTED` fact: staged facts appear only as a count in Risks with a link to
Verification, labelled *"staged, not canonical."*

**Reused.** Source↔fact navigation is the Overview's citation target. Solicitation records, award
records, evaluation scores, competitor amounts, and quoted passages all cite
`/ingestion/verification/<documentId>` — the same View Source destination as the verification
workbench, so a claim on the Overview lands on the page where a human accepted or rejected it.

**Did not fit.** PAWLs-style page/token coordinates are not carried into the Overview. A bullet cites
a document (and a page where the chunk recorded one), not a bounding box. Span-precise highlighting
stays in the verification workbench; adding it to a summary screen would imply a precision the rollup
counts do not have.

# Local files affected (P5)

`apps/web/lib/opportunity/load-overview-bundle.ts`,
`apps/web/lib/opportunity/overview-model.ts`,
`apps/web/components/opportunity-workspace/overview-sections.tsx`.
