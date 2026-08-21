# F11 — Solicitation Change-Impact Acceptance

**Status:** Implemented (2026-08-21) — engineering gate via `npm run test:f11-solicitation-change`.  
**Not** Historical Pilot exit. Corpus may still lack discrete addendum/Q&A PDFs.

## Goal

Detect buyer addenda / Q&A deltas against the prior solicitation truth, draft an AI impact run, and apply **only** after human `verify.promote`. Never silently overwrite APPROVED responses, HUMAN_APPROVED prices, deadlines, or checklist history from AI.

## Hard rules

| Rule | Enforcement |
| --- | --- |
| Detected changes start `AI_EXTRACTED` / `NEEDS_REVIEW` / `CONFLICT` | `detect-changes.ts` + `solicitation_change_items` default |
| Material apply only after `HUMAN_VERIFIED` | `evaluateApplyGate` + `apply_solicitation_change_item` RPC |
| Never set `HUMAN_APPROVED` or `draft_status=APPROVED` from apply | SQL + greps in acceptance script |
| Preserve old truth; link new truth to evidence | `requirements.superseded_by_id`, addenda supersession chain |
| Response invalidation = stale flag, not text wipe | `requirement_responses.stale_reason` / `pricing_decisions.stale_reason` |
| Ambiguous Q&A conflicts never auto-apply | `ambiguity_reason` blocks apply |
| F9 deadline rekey | Same `dedupe_key`; update `due_on` in place (`shouldRekeyOnDeadlineChange.rekey === false`) |
| SemanticDiff | **Rejected** — see [f11-change-detection.md](../reference-repos/f11-change-detection.md) |
| OpenContracts | **Provenance pattern only** |

## Schema (`20260821290000_f11_solicitation_change_impact.sql`)

- **ALTER** `solicitation_addenda`: `supersedes_addendum_id`, `source_document_version_id`, `verification_status` (default `AI_EXTRACTED`), `is_latest` (partial unique per solicitation), optional `effective_on`
- **CREATE** `solicitation_q_and_a` — question/answer, issued_on, section_ref, verification, supersedes_qa_id, source links, org RLS
- **CREATE** `solicitation_change_runs` + `solicitation_change_items` — change types include deadline/requirement/pricing/form/evaluation/scope/staffing/compliance/submission method/Q&A/other
- **ALTER** `requirement_responses.stale_reason`, `pricing_decisions.stale_reason`, `requirements.superseded_by_id`
- **RPCs** `promote_addendum_from_fact`, `promote_qa_from_fact`, `apply_solicitation_change_item`

## Lib (`apps/web/lib/solicitation/`)

| File | Role |
| --- | --- |
| `change-types.ts` | Enums + default impact flags |
| `detect-changes.ts` | Pure heuristics + honest summary counts |
| `impact-summary.ts` | Counts from stored items; readiness advisory |
| `apply-change.ts` | Verified apply gate + deadline plan + F9 rekey notes |
| `runs.ts` / `create-run.ts` | AI draft run after addendum/Q&A promote |
| `load-change-impact.ts` | RLS-scoped UI loader |

## Wire

- Verification `HUMAN_VERIFIED` → promote addendum/Q&A → `createChangeRunAfterPromote` (AI draft)
- Actions: `verifySolicitationChangeItem` / `reject` / `apply` with `requirePermission(..., "verify.promote")`
- UI: `ChangeImpactStrip` on pursuit Overview + Requirements
- Submission readiness optional `solicitationImpact` advisory (stale / addendum acknowledgement)

## Acceptance script

```bash
npm run test:f11-solicitation-change
```

Covers: original→addendum; multiple addenda; Q&A; deadline/req add/mod/remove/pricing/form; conflicting clarification → ambiguous; stale flag not text wipe; no AI auto-promotion greps; tenant RLS greps; F9 deadline rekey unit.

## Honest limits

- Detector is heuristic (`f11-heuristics-v1`), not semantic equality.
- Candidate snapshots from promote may be thin until extractors emit structured addendum/Q&A facts.
- Apply of deadline writes `opportunities.response_due_on` / packet `due_at` from verified item JSON only — never invents dates.
- Checklist reset of `addendum_acknowledgements` happens only after human apply of material items.
