# F11 change detection — external refs (2026-08-21)

## SemanticDiff — rejected

**Do not adopt SemanticDiff** (or similarly named proprietary PR/code AST diff products) for solicitation addenda / Q&A change detection.

Reasons:

- Wrong domain (code/PR AST vs procurement text).
- Not registered in [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md).
- License / product fit unclear for our trust boundary.

Local F11 uses **pure TypeScript heuristics** in `apps/web/lib/solicitation/detect-changes.ts` (`f11-heuristics-v1`). Optional `diff-match-patch` (Apache-2.0) remains available later for long-text hunks only — **not** required for v1.

## OpenContracts — provenance pattern only

[OpenContracts](https://github.com/Open-Source-Legal/OpenContracts) stays a **provenance / human-verification pattern** reference (source↔fact navigation, human annotation as ground truth). See [opencontracts.md](opencontracts.md).

F11 does **not** import OpenContracts code, PAWLs coordinates, or its corpus/MCP stack. Change-impact runs still require `verify.promote` before material apply; AI drafts stay `AI_EXTRACTED`.

## Local authority

- Migration: `supabase/migrations/20260821290000_f11_solicitation_change_impact.sql`
- Acceptance: [F11_SOLICITATION_CHANGE_IMPACT_ACCEPTANCE.md](../functionality/F11_SOLICITATION_CHANGE_IMPACT_ACCEPTANCE.md)
