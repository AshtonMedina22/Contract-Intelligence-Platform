# Lazy external-repo notes

This directory holds **focused inspection notes**, created only when an agent actually inspects an upstream repository for an implementation task.

The routing index is [docs/EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md). Do **not** put 18 analysis files here in advance. Do **not** clone upstream repos into this repository.

## When to create a note

Create or update `docs/reference-repos/<repo-slug>.md` only after a **material** inspection (README + LICENSE + the specific files for the mechanism being implemented).

A registered URL existing is not enough. Browsing a README without taking patterns into our work does not require a note.

## File naming (slugs)

Use these slugs when a note is needed:

| Slug | Repository |
| --- | --- |
| `rfpilot` | RFPilot |
| `auto-rfp` | AutoRFP |
| `opencontracts` | OpenContracts |
| `docling` | Docling |
| `unstructured` | Unstructured |
| `tenderradar` | TenderRadar |
| `opensam` | OpenSAM |
| `rfp-map` | RFP Map |
| `ocds` | Open Contracting Data Standard |
| `usaspending-api` | USAspending API |
| `usaspending-mcp-server` | USAspending MCP Server |
| `public-sector-clm` | Public-Sector CLM |
| `whereas` | Whereas |
| `wraft` | Wraft |
| `glide-data-grid` | Glide Data Grid |
| `novel` | Novel |
| `morphic` | Morphic |
| `open-deep-research` | Open Deep Research |
| `wrenai` | WrenAI |

## Note template

Keep the note short. Record only what was inspected for that task:

```markdown
# Repository
Name and URL

# Task that caused inspection

# Relevant upstream files inspected

# Relevant patterns found

# What maps to our codebase

# What we are adopting

# What we are explicitly NOT adopting

# License/copy implications verified
(current LICENSE text/status as of inspection date; copy vs reference-only)

# Local files affected

# Status
INSPECTED FOR TASK | ADOPTED PATTERN | REJECTED | SUPERSEDED
```

Then set the matching entry’s **Analysis status** in [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md).

## Inspection limits

- Default **maximum 3** external repositories per implementation task.
- Inspect LICENSE **before** copying source.
- Local canonical docs and existing local code override upstream.
- Temporary clones belong **outside** this repo (e.g. `/tmp/contract-intelligence-references/<repo>`).
