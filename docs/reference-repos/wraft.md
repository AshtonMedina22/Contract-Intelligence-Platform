# Wraft

https://github.com/wraft/wraft

# Task that caused inspection

P8 Submission/Result — document lifecycle UX only if license permits (2026-08-21). No clone.

# License/copy implications verified

**AGPL-3.0** — GitHub SPDX + `LICENSE.md` on `main`; README states AGPLv3. **REFERENCE ONLY.** Do not install, vendor, or copy source. UX/architecture ideas from public docs only.

# Relevant patterns (docs)

From [docs.wraft.app](https://docs.wraft.app/users) document creation / lifecycle:

- Pipeline: Theme → Layout → **Flow** (approval) → Variant → Document.
- Create: pick template → fill **required fields** (blocked until complete) → review/edit → **Generate** (explicit) → download / share / route to Flow.
- Lifecycle states: **Draft → Review → Approval → Final → Archived**.
- Activity log: actor, timestamp, workflow status, pending approvals.
- Variants attach Flows so generated docs inherit review path.

# Adapt for P8 (ideas only)

- Readiness = required fields / checklist items gate **Generate / Mark ready**, not portal submit.
- Separate **generate output** from **record submitted** / **Result**.
- Optional internal Review → Approval before Final; Final maps to frozen submission packet.
- Do not replace Tiptap + Google Docs working proposal with Wraft’s Markdown/Pandoc stack.

# F8 addendum (2026-08-21)

Reference-only for versioned generate → freeze. We ship native OOXML via `docx`, Google Docs
provider when token set, and `submission_artifacts` immutability — **no Wraft dependency** (AGPL).

# What we are NOT adopting

- Elixir/Phoenix app, their template/variant engine, AGPL code, or auto-distribution as our submit path.

# Status

INSPECTED FOR TASK — AGPL confirmed; UX reference only; F8 noted
