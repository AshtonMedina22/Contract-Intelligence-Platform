# Lazy UX-reference notes

This directory holds **focused UX inspection notes**, created only when an agent actually inspects an upstream UI/shell reference for an implementation task.

The routing index is [docs/EXTERNAL_UX_REFERENCES.md](../EXTERNAL_UX_REFERENCES.md). Subsystem mechanic notes stay in [docs/reference-repos/](../reference-repos/).

Do **not** create 12 analysis files in advance. Do **not** clone upstream repos into this repository. Do **not** install `dashboard-01` wholesale.

## When to create a note

Create or update `docs/reference-ux/<slug>.md` only after a **material** inspection (README/docs/LICENSE + the specific layout files, or a shadcn `--dry-run`).

A registered URL existing is not enough.

If the same repo is inspected for **mechanics** (e.g. OpenContracts PDF coordinates), prefer `docs/reference-repos/<slug>.md` and cross-link from here.

## File naming (slugs)

| Slug | Reference |
| --- | --- |
| `plane` | Plane |
| `twenty` | Twenty |
| `next-shadcn-admin-dashboard` | Studio Admin |
| `shadcn-blocks` | Official shadcn blocks (`sidebar-07`, `sidebar-16`, `dashboard-01`) |
| `opencontracts` | OpenContracts verification UX (or cross-link mechanic note) |
| `documenso-design` | Documenso design repo |
| `documenso` | Documenso app |
| `glide-data-grid` | Glide Data Grid |
| `novel` | Novel |
| `morphic` | Morphic |
| `tanstack-table` | TanStack Table |
| `tremor` | Tremor (KPI cards / dashboard grid) |

## Note template

```markdown
# Repository / block
Name and URL

# Task that caused inspection

# Relevant upstream files / blocks inspected
(include `npx shadcn@latest add <name> --dry-run` output summary if used)

# Relevant UX/shell patterns found

# What maps to our codebase

# What we are adopting

# What we are explicitly NOT adopting
(especially charts, fake dashboards, CRM objects, AGPL source)

# License/copy implications verified

# Local files affected

# Status
INSPECTED FOR TASK | ADOPTED PATTERN | REJECTED | SUPERSEDED
```

Then update **Analysis status** in [EXTERNAL_UX_REFERENCES.md](../EXTERNAL_UX_REFERENCES.md).

## Inspection limits

- Default **maximum 3** external UX references per task.
- AGPL (Plane, Twenty, Documenso app, …) = visual reference unless copy is approved.
- Prefer official shadcn + MIT Studio Admin for **code**.
- Inspect LICENSE **before** copying source.
- Local [UX_UI.md](../UX_UI.md) and existing shell override upstream.
- Temporary clones belong **outside** this repo.
