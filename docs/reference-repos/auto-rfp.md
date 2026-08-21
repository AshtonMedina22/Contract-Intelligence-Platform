# Repository

AutoRFP — https://github.com/run-llama/auto_rfp

# Task that caused inspection

Productization P6 — requirement-driven Response workspace: left requirement navigation with work-state
filters, per-requirement evidence retrieval, per-response source attribution, and human editing of a
generated answer.

# Relevant upstream files inspected

- `README.md` — feature set, data model, AI pipeline, API surface (fetched 2026-08-21).
- `LICENSE` status as declared in the README.

# Relevant patterns found

AutoRFP is the closest public implementation of the question → evidence → answer loop:

- **Question-scoped answering.** `Question` and `Answer` are separate models; an answer belongs to
  exactly one extracted question. Response work is a list of questions, not one long document.
- **Sources attached to the answer row.** `Answer` carries its sources; the UI has a "Source Details"
  view with relevance scores rather than an unattributed paragraph.
- **Multi-step generation surfaced to the operator.** `/api/generate-response-multistep` exposes
  analyze → search → extract → synthesize as visible steps instead of one opaque call.
- **Human editing after generation.** Generated answers are editable; generation is a starting point.
- **Organization isolation as a first-class model** (`Organization`, `OrganizationUser`, roles).

# What maps to our codebase

- `apps/web/components/opportunity-workspace/response-workspace.tsx` — requirement list + editor +
  evidence, the same three concerns.
- `requirement_responses.sources_used` — our equivalent of AutoRFP's answer-attached sources.
- `loadRequirementEvidence` — per-requirement retrieval, our equivalent of question-scoped search.

# What we are adopting

1. **Requirement-scoped retrieval follows the selection.** Previously the Response page ran one
   retrieval for `requirements[0]` and showed it beside whatever requirement was selected. Now the
   selected requirement drives retrieval (`loadRequirementEvidence`), which is AutoRFP's
   question-scoped model.
2. **Sources belong to the saved response, and are shown as such.** The right rail and the new
   source sheet render `sources_used` from the stored row separately from live retrieval, so an
   operator can tell what the draft was actually built from.
3. **Answer-level work state drives the list.** Filters (To Do / Input Required / Review / Approved /
   Mandatory / Scored) come from the response state per requirement.

# What we are explicitly NOT adopting

- **Prisma + LlamaCloud + LlamaIndex.** Our architecture lock keeps Supabase/RLS and pgvector in
  Postgres. AutoRFP's `ProjectIndex` / LlamaCloud connection model has no place here.
- **Its multi-tenancy.** We already have Supabase RLS; `OrganizationUser` is a parallel invention.
- **"Respond 80% faster" generation semantics.** AutoRFP generates an answer for every extracted
  question. We refuse to: `classifyEvidenceFromHits` returns `L_AND_P_INPUT_REQUIRED` when no allowed
  passage supports the requirement, and the Generate button is disabled in that state. Relevance
  scores are also not adopted — reuse status (`APPROVED` / `REVIEW_REQUIRED` / `DO_NOT_USE`) is a
  human verification decision, not a similarity number.
- **Chat-style response generation.** Our generation is a single gated server action per
  requirement.

# License/copy implications verified

**MIT** as declared in the upstream README (checked 2026-08-21). Copying source would be permitted
with attribution; none was copied — only the question-scoped workflow shape was reused.

# Local files affected

- `apps/web/components/opportunity-workspace/response-workspace.tsx`
- `apps/web/components/opportunity-workspace/response-source-sheet.tsx`
- `apps/web/lib/opportunity/response-workspace-model.ts`
- `apps/web/app/(platform)/procurement/opportunities/[opportunityId]/actions.ts`

# Status

ADOPTED PATTERN (no code copied)
