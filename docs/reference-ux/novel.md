# Repository / block

Novel — https://github.com/steven-tey/novel

# Task that caused inspection

Productization P6 — turning the pursuit Response editor
(`apps/web/components/opportunity-workspace/response-tiptap-editor.tsx`) from a three-button toolbar
into a proposal-authoring surface: selection bubble menu, slash blocks, autosave, keyboard save.

# Relevant upstream files / blocks inspected

- `LICENSE` — verified 2026-08-21.
- `packages/headless/src/index.ts` — the public surface of `novel`'s headless package.
- Repository README / positioning ("Notion-style WYSIWYG editor with AI-powered autocompletion").

# Relevant UX/shell patterns found

`novel` is a thin composition layer over Tiptap, not a new editor. Its headless package exports:

- `EditorRoot` / `EditorContent` — provider + content, same Tiptap `useEditor` underneath.
- `EditorBubble` / `EditorBubbleItem` — selection-anchored formatting menu.
- `EditorCommand` / `EditorCommandList` / `EditorCommandItem` / `EditorCommandEmpty` plus
  `Command`, `createSuggestionItems`, `renderItems`, `handleCommandNavigation` — the slash-command
  stack, implemented as a Tiptap suggestion plugin with a `cmdk`-style list and keyboard routing.
- `AIHighlight` / `addAIHighlight` / `removeAIHighlight` — a mark applied to the range an AI action
  is operating on, so the operator sees exactly what the model was given.
- Jotai atoms (`queryAtom`, `rangeAtom`) holding the slash query and its document range.

# What maps to our codebase

Only `response-tiptap-editor.tsx`. The three-panel Response layout (LEFT requirements / CENTER
editor / RIGHT evidence) is ours and unchanged.

# What we are adopting

Patterns, re-implemented against our own `@tiptap/react` v3 dependency:

1. **Selection bubble menu** — via `@tiptap/react/menus` `BubbleMenu` (already an optional dependency
   of `@tiptap/react` in our lockfile), not `novel`'s `EditorBubble`.
2. **Slash blocks** — a deliberately smaller stub: a caret-anchored list of heading / list / quote /
   paragraph commands driven by a regex on the text before the cursor, positioned with
   `view.coordsAtPos`. Seven block types, no suggestion plugin, no Jotai, no `cmdk`.
3. **AI action reachable from the selection** — our bubble menu carries `Improve`, which re-runs
   `generateRequirementDraft` with the selected text as a style instruction.
4. **Debounced autosave with a visible state** — idle → "Unsaved changes" → "Saving draft…" →
   "Draft saved <time>".

# What we are explicitly NOT adopting

- **The `novel` package itself.** No new dependency; we already have Tiptap.
- **`AIHighlight` and inline AI autocompletion.** Novel's AI is free continuation over arbitrary
  text. Ours may only assemble from retrieved, drafting-allowed passages, and generation is gated by
  `evaluateDraftGate` before the button is even enabled. Free-form completion in the editor would be
  an unsourced-text hole straight through the Phase 8 evidence rules.
- **Images, uploads, drag handles, Youtube/Twitter/Mathematics nodes, character count.** A
  procurement response is text, lists, and headings.
- **Jotai.** Slash state is component state.

# License/copy implications verified

**Apache-2.0** (fetched `LICENSE` 2026-08-21). Copying would be permitted with attribution and a
change notice. We copied no source — the bubble menu and slash list were written against our own
Tiptap version — so no NOTICE obligation arises.

# Local files affected

- `apps/web/components/opportunity-workspace/response-tiptap-editor.tsx`

# Status

ADOPTED PATTERN (no code copied)
