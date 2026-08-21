# Unstructured

https://github.com/Unstructured-IO/unstructured

# Task that caused inspection

P2 Data Ops research: partitioning/routing as **benchmark only**.

# Relevant upstream files inspected

- `LICENSE.md` (raw main, 2026-08-20) — Apache-2.0
- Partitioning docs — https://docs.unstructured.io/open-source/core-functionality/partitioning

# Relevant patterns found

- **`partition()` auto-route**: filetype detect (`libmagic` → extension fallback) then type-specific partitioner.
- **PDF/image strategies**: `auto` | `fast` | `hi_res` | `ocr_only` — useful benchmark axes against our `digital_pdf` vs `scanned_or_empty_pdf` (chars/page threshold).
- Element taxonomy (`Title`, `NarrativeText`, `ListItem`, …) + optional table inference — chunk/metadata pipeline analog, not our canonical fact model.
- Broad format matrix (email, PPT, etc.) beyond our procurement focus.

# What maps to our codebase

Optional future alternate parser route / eval harness comparison only; `document_chunks` after verification; gap reports under `docs/benchmarks/`.

# What we are adopting

Benchmark framing only: strategy names and filetype dispatch as comparison dimensions. No install.

# What we are explicitly NOT adopting

- Default parser.
- Replacing native pypdf / openpyxl / docx-native routes.
- Auto-promoting Unstructured elements to canonical facts.

# License/copy implications verified

**Apache-2.0** (Copyright 2022 Unstructured Technologies, Inc). Copy of substantial code would need NOTICE/attribution; not needed for benchmark-only conceptual use.

# Local files affected

None this session (research only).

# Status

INSPECTED FOR TASK
