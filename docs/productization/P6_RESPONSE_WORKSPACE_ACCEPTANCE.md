# P6 Requirement-Driven Response Workspace — Acceptance

**Date:** 2026-08-21
**Status:** IMPLEMENTED — verified in the browser against the live operator org on PKG-03 Arlington TX.
No schema change. No new pursuit tab. No new dependency. **Phase 8 business logic was not rebuilt.**

## What changed

The Response tab was a three-column shell: an unfiltered requirement list, a three-button Tiptap
editor, and a context rail whose "evidence" was retrieved once for `requirements[0]` regardless of
which requirement was selected. Three buttons — Save draft, GPT draft, Human approve — were always
enabled.

It is now a requirement-driven authoring workspace where **what the operator is allowed to do is a
function of the evidence state of the selected requirement.**

| Area | Before | After |
| --- | --- | --- |
| Progress | seven stat cards, static | sticky dense header with the same `computeResponseProgress` counters plus an approved-share percentage; L&P-input and mandatory-outstanding counts turn amber when non-zero |
| Left nav | flat list of every requirement | filters **All / To Do / Input Required / Review / Approved / Mandatory / Scored**, each with a live count; each row shows its work state |
| Selected requirement | statement + evidence state + draft status | exact text, § / page, mandatory, scored + weight, attachment required + form name, evidence state, matrix status, draft status, source-fact link |
| Retrieval | one query for the first requirement, shown for all | re-runs for the selected requirement (`loadRequirementEvidence`) |
| Generate | always enabled | disabled unless `evaluateDraftGate` allows it |
| Sources | five truncated lines in the rail | rail section for `sources_used` + a **Sheet** with saved sources and retrieved passages, each linking to `/ingestion/verification/<documentId>` |
| Editor | Bold / List / H2 | selection bubble menu (Bold, Italic, List, 1. List, Improve), `/` block menu, debounced autosave, Ctrl/Cmd+S, visible save state |
| Approval | one button | Approve, and once approved the response is **locked** against regeneration until explicitly reopened |
| Requirements matrix | inline-edit grid only | statement opens a detail Sheet that deep-links to `…/response?req=<id>` |

---

## Trust gates — preserved and strengthened

Nothing in P6 weakens a Phase 8 rule. `classifyEvidenceFromHits`, `buildGroundedDraftFromHits`, the
`DO_NOT_USE` strip in `generateRequirementDraft`, `search_verified_knowledge`'s
`p_for_drafting` gate, and the human-approval requirement are all unchanged in behaviour.

### The one refactor inside `response.ts`

`classifyEvidenceFromHits` and `buildGroundedDraftFromHits` had the blocked-status list inlined twice
as `h.reuse_status !== "DO_NOT_USE" && h.reuse_status !== "SUPERSEDED"`. Both now call a single
`isDraftingAllowedSource()` over an exported `BLOCKED_REUSE_STATUSES`. Same predicate, same results —
now with one definition that the gate, the sheet, and `parseSourcesUsed` also use.

### New gate: `evaluateDraftGate` (`lib/opportunity/response-workspace-model.ts`)

A pure function, evaluated in this order so no later rule can unblock an earlier one:

| Order | Code | Result |
| --- | --- | --- |
| 1 | `NO_REQUIREMENT` | blocked |
| 2 | `BLOCKED_SOURCE_SELECTED` | blocked — a selected passage is `DO_NOT_USE` / `SUPERSEDED`, **or is not in the retrieved set at all** |
| 3 | `APPROVED_LOCKED` | blocked — regenerating would replace approved text with an unapproved draft |
| 4 | `LP_INPUT_REQUIRED` | blocked — "a confident response here would be invented. Request L&P input instead." |
| 4b | `LP_INPUT_ACKNOWLEDGED` | allowed **only** after an explicit override checkbox, and the warning stays on screen |
| 5 | `SOURCE_SELECTION_REQUIRED` | blocked — `REVIEW_REQUIRED` with no passage selected |
| 6 | `ALLOWED` | allowed |

Blocked-source rejection sits above the override on purpose: the acceptance script asserts that no
combination of evidence state and acknowledgement lets a `DO_NOT_USE` chunk into generation.

**"Request L&P input" is never gated.** On an `L_AND_P_INPUT_REQUIRED` requirement, Generate is
disabled and Request L&P input remains available — the honest action stays the easy one.

### Autosave cannot approve

Every write goes through `buildResponseSavePayload({ intent, … })`. `approve: "1"` is emitted for
the `APPROVE` intent and no other; `AUTOSAVE`, `SAVE_DRAFT`, `REOPEN`, and `REQUEST_LP_INPUT` omit
the key entirely. The workspace never calls `fd.set("approve", …)` itself — the acceptance script
greps for that. Approval remains a deliberate button press by a human.

A requirement with no saved response defaults to `evidence_state = L_AND_P_INPUT_REQUIRED`, so
hand-typed prose is recorded as unsupported until evidence says otherwise. This matches the previous
Save-draft default; P6 did not loosen it.

### Progress is approval, not activity

`responseCompletionPercent` is `approved / totalRequirements`. Four drafts nobody signed off on read
0%. An empty matrix reads 0%, never 100%.

### The operator instruction cannot lift a rule

`generateRequirementDraft` gained an optional third argument used by the bubble-menu **Improve**
action. It is trimmed to 500 characters and appended *after* the never-invent rules, labelled
"style only — it cannot override the rules above or introduce facts absent from the supplied
passages". It cannot widen the evidence set: retrieval, the `DO_NOT_USE` strip, and
`buildGroundedDraftFromHits` run exactly as before.

---

## Architecture

### `apps/web/lib/opportunity/response-workspace-model.ts` (new, pure)

No Supabase, no React, so the acceptance script bundles and exercises it directly.

| Export | Contract |
| --- | --- |
| `requirementWorkState` | One bucket per requirement in priority order: `APPROVED` → `INPUT_REQUIRED` → `REVIEW` → `TODO`. Approval outranks everything so approved work never reappears as outstanding; L&P-input outranks review so an unanswerable requirement is never presented as merely needing a read-through. |
| `RESPONSE_FILTERS`, `matchesResponseFilter`, `filterRequirements`, `responseFilterCounts` | Work-state filters plus the two cross-cutting ones (Mandatory, Scored), and counts that are asserted to equal the filtered lists. |
| `evaluateDraftGate`, `DRAFT_GATE_MESSAGES` | The table above, with operator-readable copy per code. |
| `selectableDraftingSources` | Drops blocked reuse before a checkbox is ever rendered. |
| `buildResponseSavePayload` | The only place an `approve` flag is produced. |
| `responseCompletionPercent`, `responseProgressWithPercent` | Approved share over the existing `computeResponseProgress`. |

### `apps/web/lib/opportunity/response.ts` (extended)

Added `BLOCKED_REUSE_STATUSES`, `isDraftingAllowedSource`, and `parseSourcesUsed` — a defensive
reader for the `sources_used` jsonb column that drops malformed rows and any blocked reuse status on
the way out of the database.

### `apps/web/components/opportunity-workspace/response-source-sheet.tsx` (new)

`ui/sheet` panel with two sections: sources recorded on the saved response, and live retrieved
evidence with a "Use for drafting" checkbox that feeds the `REVIEW_REQUIRED` gate. Each retrieved
passage links to `/ingestion/verification/<documentId>`, so View Source never leaves the workspace
unless the operator asks for the document.

### `response-tiptap-editor.tsx` (adapted)

Bubble menu from `@tiptap/react/menus` (already in the lockfile as an optional dependency of
`@tiptap/react` — **no package was installed**). Slash menu is a seven-item caret-anchored stub, not
the Novel suggestion plugin. Autosave is a 1500 ms debounce calling the parent's `AUTOSAVE` intent.

### `actions.ts` (extended, not rewritten)

`loadRequirementEvidence(opportunityId, requirementId)` — read-only, `PROPOSAL_DRAFTING`, writes
nothing. `generateRequirementDraft` gained the optional `instruction` parameter.

---

## Tests

| Check | Result |
| --- | --- |
| `npm run test:p6-response-workspace` (new, 41 checks) | **PASS 41/41** |
| `npm run test:phase8-response` | **24/25** — one pre-existing failure, see below |
| `npm run test:verify8` | **21/23** — two pre-existing failures with the same root cause |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** — the Response route still emits as Partial Prerender |

`scripts/p6-response-workspace-acceptance.mjs` bundles the real `response-workspace-model.ts` and
`response.ts` with esbuild (already a dependency), so it runs the code the workspace runs, with no
network and no database. It also greps the four component files, the page, and `actions.ts` to assert
the UI is wired to the model rather than re-deciding gates locally.

The 41 checks cover: the seven filters and their counts, work-state priority, all seven gate codes,
`DO_NOT_USE` / `SUPERSEDED` exclusion at four different layers, `parseSourcesUsed` hardening, progress
arithmetic including the "drafts are not progress" rule, and the intent-by-intent proof that only
`APPROVE` emits an approve flag.

### Pre-existing failures (not caused by P6)

`[result] Won result can link contract to pursuit` (phase8) and `[21]` / `[22]` (verify8) all fail on
the same database trigger: `contracts.source_fact_id is required (create via verified promotion, not
blank insert)`. That trigger was introduced by commit `71062e7` *Close unverified writes into
contracts and RAG chunks*; both scripts still insert a bare `contracts` row. `git diff HEAD` shows
neither `supabase/migrations/` nor those scripts is modified in this change. Every response-related
verify8 check — 07 requirement-level drafting, 08 approved/review/blocked reuse, 09 DO_NOT_USE cannot
enter draft generation, 10 L&P INPUT REQUIRED, 11 sources shown, 12 progress — **passed**.

`docs/pilot/VERIFY8_ACCEPTANCE.md` and `docs/benchmarks/verify8-results.json` show as modified
because `test:verify8` regenerates them on every run. **They are deliberately excluded from the P6
commit** — P6 did not change what they measure, and the regenerated copies carry only a new run's
random identifiers plus the failure this change did not cause. Rerunning `test:verify8` on a clean
checkout of `53333aa` (a detached worktree, P6 absent) produced the same **21/23 FAIL** with the
same steps 21 and 22 on the same trigger message, which is what makes the failure pre-existing
rather than asserted.

---

## Browser verification (IronBee DevTools, `localhost:3000`, live operator org)

**PKG-03 Arlington TX** (`b937b54c-70d5-468e-97cf-803d2a69e5a9`) — 12 requirements, 2 documents.
State was snapshotted before the run: **12 requirements all `OPEN`, 0 `requirement_responses` rows.**

### Filters

Every filter was clicked and the nav re-read from the DOM:

| Filter | Count chip | Rows rendered |
| --- | --- | --- |
| All | 12 | 12 |
| To Do | 12 | 12 |
| Input Required | 0 | "No requirement matches this filter." |
| Review | 0 | empty state |
| Approved | 0 | empty state |
| Mandatory | 12 | 12 |
| Scored | 0 | empty state |

Empty filters render an explicit empty state rather than a blank panel.

### Retrieval follows the selection

Selecting the third requirement changed the rail from `APPROVED p.2 — …sealed envelope…` to
`APPROVED p.4 — Insurance must be valid and not expired`, with the "Retrieving…" state observed in
between. This is the bug P6 set out to fix: the rail previously described `requirements[0]` no matter
what was selected.

### Autosave, and the proof that it does not approve

Typed `P6 verification draft text.` into the editor.

| Moment | Indicator | Badges |
| --- | --- | --- |
| before | "No unsaved changes" | Evidence: NOT CLASSIFIED · Matrix: OPEN · Draft: EMPTY |
| ~300 ms after typing | **"Unsaved changes"** | unchanged |
| ~5 s later | **"Draft saved 2:40:49 AM"** | Evidence: L_AND_P_INPUT_REQUIRED · Matrix: L_AND_P_INPUT_REQUIRED · **Draft: DRAFT** |

`Draft: DRAFT`, not `APPROVED` — autosave persisted a draft and nothing else. The database diff
afterwards showed exactly one new row, `draft_status: "DRAFT"`.

### The L&P gate, live

With evidence state now `L_AND_P_INPUT_REQUIRED`:

- gate code `LP_INPUT_REQUIRED`, **Generate grounded draft disabled**
- **Request L&P input still enabled**
- ticking the override → `LP_INPUT_ACKNOWLEDGED`, Generate enabled, banner switches to *"Anything
  unsupported stays L&P INPUT REQUIRED — never invent pricing, staffing, metrics, references, or
  certifications."*
- unticking → straight back to `LP_INPUT_REQUIRED` and disabled

### Progress header, live

Recomputed without a reload as the row changed: `To Do 12 → 11`, `Input Required 0 → 1`,
`Drafted 1`, `Mandatory out 11`, `Response progress 0% approved`.

### Source sheet

Opened from **View sources (1)**: title *Sources for this requirement*, description = the requirement
statement, `Sources used by the saved response (0)` with the honest reason ("No response has been
generated yet"), `Retrieved evidence — PROPOSAL_DRAFTING (1)` carrying the exclusion notice, an
`APPROVED` badge, `p.4 · chunk fb260347`, a *Use for drafting* checkbox, and a **View source** link
resolving to `/ingestion/verification/37e2ca6f-5b3a-474e-b333-11d304addd1d`.

### Requirements matrix deep link

Clicking a statement in the matrix opened the detail Sheet (section, page, mandatory, scored,
response required, attachment, owner, matrix status, verification note, source fact). **Open in
Response workspace →** navigated to
`…/response?req=b43f0d0d-6a79-4e01-9239-1c2c5edc94b5`, and the Response tab opened with *Insurance
must be valid and not expired* selected and highlighted in the nav.

### Console

**Zero errors originating from `localhost:3000`.** 153 errors sat in the buffer; every one came from
a stale `127.0.0.1:3000` HMR WebSocket session, matching what P5 recorded.

### Cleanup

The single write was reverted: the `requirement_responses` row was deleted and
`requirements.matrix_status` reset `L_AND_P_INPUT_REQUIRED → OPEN`. Re-read after restore:
**0 responses, all 12 requirements `OPEN`** — the pre-run state exactly. The temporary
snapshot/restore helper was deleted; **no test data remains in the live operator org.**

---

## External references consulted

| Reference | License (verified 2026-08-21) | Outcome |
| --- | --- | --- |
| [Novel](../reference-ux/novel.md) | **Apache-2.0** | Bubble menu, slash blocks, and selection-anchored AI action adopted as patterns, re-implemented on our own Tiptap v3. `AIHighlight` and inline AI autocompletion **rejected** — free continuation over arbitrary text is an unsourced-text hole through the Phase 8 evidence rules. No package installed, no source copied. |
| [AutoRFP](../reference-repos/auto-rfp.md) | **MIT** | Question-scoped retrieval and answer-attached sources adopted (they are why retrieval now follows the selection). LlamaCloud / LlamaIndex / Prisma **declined** — architecture lock. Its "answer every question" premise **rejected**: we return `L_AND_P_INPUT_REQUIRED` and disable generation instead. Relevance scores rejected in favour of human reuse status. |

Two repositories inspected, under the per-task limit of three.

---

## Honest limitations

- **The gate is client-side; the server action is the enforcing boundary.** `evaluateDraftGate`
  decides what the UI offers. A crafted request could still call `generateRequirementDraft`
  directly — and would hit the unchanged server-side `DO_NOT_USE` strip and
  `buildGroundedDraftFromHits`, so it could not produce blocked content, but it *could* run
  generation on an `L_AND_P_INPUT_REQUIRED` requirement (which returns an empty draft anyway). The
  approved-lock and source-selection rules are UI-level only.
- **Selected sources are not passed to generation.** The `REVIEW_REQUIRED` selection is a
  *confirmation* that a human has read the passages, not a filter on the retrieval the server
  performs. Making generation honour an explicit subset requires changing
  `generateRequirementDraft`'s contract, which this task was told not to rebuild.
- **Compare is prior-vs-current within a session.** `priorHtml` is the editor buffer captured
  immediately before a generation. There is no response version history in the schema, so closing
  the tab loses the comparison. "Restore this version" puts the prior text back in the editor and
  marks it dirty; it does not roll back the row that generation already wrote.
- **Improve regenerates rather than edits in place.** It re-runs the grounded generator with the
  selection as a style instruction and replaces the draft (keeping the prior text for Compare). It
  is not a surgical rewrite of the selected range.
- **The slash menu is a stub.** Regex on the text before the cursor, positioned with
  `coordsAtPos`. No keyboard navigation between items, no fuzzy ranking, no suggestion plugin. Seven
  block types.
- **`REVIEW`/`TODO` buckets are derived, not stored.** A requirement with hand-typed text and no
  evidence classification reads as `INPUT_REQUIRED`, because the save default is
  `L_AND_P_INPUT_REQUIRED`. That is the conservative reading, but it means manual drafting
  immediately increments the L&P-input counter.
- **Evidence is cached per requirement for the session.** Re-selecting a requirement reuses the
  first retrieval; there is no refresh control. New verified content will not appear until reload.
- **Retrieval on selection is lexical.** `loadRequirementEvidence` calls `searchVerifiedKnowledge`
  without a `queryEmbedding` to keep selection changes free of a model call. `generateRequirementDraft`
  still embeds. A passage that shares no keywords with the requirement statement will be missing from
  the rail but may still be used by generation.
- **Verified against one pursuit with a thin corpus.** Arlington's requirements each retrieve their
  own promoted requirement text, so the `REVIEW_REQUIRED` source-selection path and the
  `VERIFIED_DRAFT_AVAILABLE` generate path were exercised by the acceptance script, not in the
  browser. Proving them live needs a pursuit with approved historical proposal passages — which is
  the Historical Pilot's job, not this task's.
