# RFPilot

https://github.com/valinorintelligence/rfpilot

# Task that caused inspection

P5 Pursuit Overview + Bid Strategy (2026-08-21). Looking for the question set an operator expects a
pre-award workspace to answer, and for how an existing implementation derives "strategy" from a
solicitation.

# Relevant upstream files inspected

- GitHub repository metadata (2026-08-21) — MIT, Python, last push 2026-04-11, 0 stars/forks
- `backend/app/services/ai_service.py` — `RFP_ANALYSIS_PROMPT`, `CAPABILITY_MATCH_PROMPT`
- `backend/app/services/match_service.py` — `run_capability_match`
- repository tree (FastAPI + Celery backend, React/Vite frontend, single `alembic` schema)

# Relevant patterns found

**The section taxonomy is genuinely useful.** `RFP_ANALYSIS_PROMPT` asks for the same list an
operator wants on an overview screen: issuing organization, scope summary, submission deadline,
evaluation criteria with weights, key requirements, compliance requirements, and red flags.
`CAPABILITY_MATCH_PROMPT` adds a per-requirement gap state (`none|partial|missing`).

**The derivation method is the opposite of ours.** Both prompts ask a single LLM call to emit, from
raw document text and with no citation anywhere in the schema:

- `overall_match_score` (0-100) and a per-requirement `match_score` (0-100)
- `win_strategy_tips` — invented win themes
- `complexity_rating` (Low/Medium/High/Very High) and `estimated_contract_value`
- `differentiators`, `strengths`, `risks`, per-gap `mitigation`
- `ai_written_response`, `executive_summary_draft`, `cover_letter_draft` — drafted prose promoted
  straight into the record

There is no verification state, no source page, no provenance, and no way for an operator to open the
evidence behind a number. A `match_score` of 82 is model output presented as a measurement. The one
honesty habit worth keeping is the `budget_range` fallback of `"Not specified"` — an explicit unknown
rather than a zero.

Architecturally, "Engine A" (analyze) and "Engine B" (cross-match) are separate services over a
shared text extractor, with a token-budget chunk-then-summarize step before the analysis call.

# What maps to our codebase

Pursuit Overview (`apps/web/lib/opportunity/load-overview-bundle.ts`,
`components/opportunity-workspace/overview-sections.tsx`), Requirements matrix,
`evaluation_criteria`, `compliance_items`, packet gaps.

# What we are adopting

**The question list, not the generator.** P5 answers the same operator questions RFPilot's prompt
enumerates — scope, deadline, evaluation criteria and weights, requirement obligation, compliance,
risks — and derives every one of them from rows in Postgres via `overview-model.ts`, deterministically,
with a clickable citation per bullet.

Its per-requirement gap state maps onto our existing `matrix_status` (including
`L_AND_P_INPUT_REQUIRED`), which already carries the same information with a human owner attached.

Its explicit "Not specified" habit matches our `Not recorded` / `Unknown` rendering.

# What we are explicitly NOT adopting

- **Any score.** No `overall_match_score`, no per-requirement match percentage, no
  `complexity_rating`. `buildBidStrategy` emits no number that is not read from a recorded row.
- **LLM-generated win themes.** `win_strategy_tips` / `differentiators` / `mitigation` are exactly
  the invented strategy P5 forbids; ours is a `withheld` list naming what is missing instead.
- **`estimated_contract_value`.** We never invent an amount; competitor amounts appear only when a
  sourced `competitor_bids` row carries one.
- Prose promoted into the record without human approval (`ai_written_response`,
  `executive_summary_draft`, `cover_letter_draft`). Our narrative passages are quoted verbatim from
  verified chunks with a page citation, never rewritten.
- Its stack: FastAPI + Celery + Alembic + direct Anthropic SDK, and a second frontend.

# License/copy implications verified

**MIT** per GitHub repository license metadata on `main`, 2026-08-21. Copy-eligible with attribution.
**No upstream code was copied** — the value here was the prompt schema as a checklist of operator
questions, and as a concrete example of the ungrounded-generation approach we reject.

# Local files affected

None directly. Informed the section set in
`apps/web/components/opportunity-workspace/overview-sections.tsx` and the withheld-evidence
discipline in `apps/web/lib/opportunity/overview-model.ts`.

# P8 addendum — proposal output / completion (2026-08-21)

No clone. Re-confirmed **MIT** via `LICENSE` + GitHub SPDX.

**Completion workflow shape (adapt):** explicit operator steps — upload → analyze → match → **`POST …/generate`** (versioned Proposal) → **download** → separate **`PATCH …/status`** (`draft` | `in_progress` | `submitted` | `won` | `lost`). Generate does **not** set `submitted`; status change is a distinct human action. Audit log on generate/download/status_change. Proposal versions increment.

**Adopt for Submission:** versioned output artifacts + download + checklist readiness gating generate; **manual** Mark submitted / Record result (no auto-submit). Reject inventing scores/prose into the packet (same as P5).

# Status

INSPECTED FOR TASK — taxonomy adopted, generation method REJECTED; P8 completion workflow shape noted (MIT)

# F7 addendum — proposal content / section reuse (2026-08-21)

No clone. Pattern only: RFPilot’s useful **section taxonomy** (staffing, management, transition, training, past performance, …) informs `apps/web/lib/content/taxonomy.ts`.

**Adopted:** canonical section keys + heading aliases for heuristic extraction into existing `proposal_sections` (not a new `content_blocks` store).

**Rejected:** ungrounded LLM scores, invented win tips, auto-promoting AI prose to reusable library, dumping full proposals into the model. Local reuse stays purpose-aware (`APPROVED` / `REVIEW_REQUIRED` / `DO_NOT_USE` / `SUPERSEDED`) with human verification gates — Won ≠ APPROVED, Lost ≠ DO_NOT_USE.

Also pattern-noted (no copy): AutoRFP requirement↔evidence matching shape; OpenContracts provenance/verify discipline (already in local notes).

# F8 addendum — proposal output / Docs pipeline (2026-08-21)

Reference-only. RFPilot’s DOCX / working-doc habits informed honesty labels and assembly-before-export —
**not** its LLM cover-letter dumps. Local F8: deterministic APPROVED assembly, native `docx` OOXML,
Google Docs provider when token set, versioned immutable `submission_artifacts`. See
[F8_PROPOSAL_OUTPUT_ACCEPTANCE.md](../functionality/F8_PROPOSAL_OUTPUT_ACCEPTANCE.md).
