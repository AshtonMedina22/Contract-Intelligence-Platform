# Repository

Whereas — https://github.com/zgbrenner/whereas

Registered as **#12** in [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md) as a
"Modern contract repository / CLM UX" reference.

# Task that caused inspection

Productization P10 — Contract Portfolio + Renewal / Rebid Command Center. Consulted for the Changes
tab: how a contract record surfaces its own document history without letting the newest version hide
what came before.

# Relevant upstream material inspected

Repository metadata, description and topics (2026-08-21). License confirmed via the GitHub API.
**No source files were read or copied.**

# Relevant patterns found

- A contract record has a **version / document timeline** as a primary surface, not a buried tab.
- Machine extraction is explicitly separated from human review — extracted findings are proposals
  until a person accepts them.
- Organization-scoped row-level security as the tenancy primitive.
- Guided intake and triage feed a repository, and the repository record keeps its provenance.

# What maps to our codebase

The human-review principle is already ours and is stronger here: `HUMAN_VERIFIED` promotion plus the
`*_require_verified_fact` trust triggers mean an AI extraction physically cannot land as canonical.
Org-scoped RLS is already the tenancy model (Phase 2). Intake and triage are Data Ops, not Contracts.

# What we are adopting

Pattern only:

- The **append-only document/version timeline** framing on the Changes tab — every amendment,
  modification, option and renewal is its own entry with its own source link, chronological, and an
  instrument with no recorded date is placed last rather than silently sequenced.
- Stating the human-review boundary *on the surface itself* rather than only in the schema
  (`NO_AUTO_ACTION_NOTE`, `READINESS_ADVISORY_NOTE`).

# What we are explicitly NOT adopting

- **Clause extraction and playbook deviation analysis.** Both would produce assertions about contract
  language with no verified source record behind them, which our provenance model forbids.
- **Embedded e-signature (DocuSeal).** We do not execute contracts.
- Guided intake / inbox triage as a Contracts surface — Data Ops owns intake in our IA.
- Any of its implementation. See license below.

# License/copy implications verified

**GPL-3.0** as of 2026-08-21 (GitHub API `license.spdx_id = GPL-3.0`).

Note: [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md) and
`docs/OG DOCS/Untitled` both describe this repo as AGPL-3.0. The current live license is GPL-3.0.
Either way it is **REFERENCE ONLY** — copyleft, not approved for copy into this codebase. Nothing was
copied.

# Local files affected

`apps/web/lib/contracts/portfolio-model.ts`,
`apps/web/app/(platform)/contracts/[contractId]/changes/page.tsx`,
`apps/web/app/(platform)/contracts/[contractId]/renewal/page.tsx`

# Status

ADOPTED PATTERN (reference-only; no source copied)
