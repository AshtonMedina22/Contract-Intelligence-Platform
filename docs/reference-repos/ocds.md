# Repository / standard

Open Contracting Data Standard (OCDS) — https://github.com/open-contracting/standard

# Task that caused inspection

F2 Public Procurement Opportunity Discovery Engine
(`docs/functionality/F2_PUBLIC_OPPORTUNITY_ENGINE_ACCEPTANCE.md`).

# Relevant upstream files inspected

Registry entry in [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md) §8 only.
**No OCDS schema text was copied into this repository.**

# Relevant patterns found

Shared public-procurement lifecycle vocabulary for *external* normalization: tender, award,
contract, amendment, buyer/parties, documents, milestones, identifiers.

# What maps to our codebase

- External notice normalization fields on `NormalizedPublicOpportunity` / `public_sources`
  (title, buyer, dates, documents when present).
- Document links via `getDocuments` / `documentsFromRawPayload` — only when the provider
  supplies them (OCDS “documents” idea, not a schema import).

# What we are adopting

Vocabulary awareness only. Status labels on `public_sources` remain our operator lifecycle
(`NEW` / `WATCHING` / …), not OCDS tender status codes.

# What we are explicitly NOT adopting

- Replacing L&P canonical tables with OCDS release packages.
- Importing OCDS JSON Schema or codelists wholesale.
- Treating a public tender as verified L&P truth.

# License/copy implications verified

Study schema/LICENSE before reproducing schema text. This note records **reference use only**;
no schema files were vendored.

# Local files affected

- `apps/web/lib/procurement/providers/types.ts` (document extraction helper)
- `docs/functionality/F2_PUBLIC_OPPORTUNITY_ENGINE_ACCEPTANCE.md`
- `docs/functionality/F5_RECOMPETE_RADAR_ACCEPTANCE.md` (Market watches use `recompete_watches` statuses, not OCDS tender codes)

# Status

INSPECTED FOR TASK (registry + vocabulary) · SCHEMA REFERENCE ONLY · NOTHING COPIED · F5 (2026-08-21) reconfirmed
