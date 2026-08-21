# Repository

Morphic — https://github.com/miurla/morphic
"An AI-powered search engine with a generative UI."

# Task that caused inspection

P9 Full Intelligence Workbench polish (2026-08-21) — how a data view should hand a question to an
existing answer surface, and how that surface should disclose where the question came from.

Registry entry: [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md) #16 (also registered as
a UX reference, [EXTERNAL_UX_REFERENCES.md](../EXTERNAL_UX_REFERENCES.md) #11).

# Relevant upstream material inspected

Public README and repository metadata. Its question → tool state → streamed answer → citations →
source cards → follow-up interaction model, at the level of *what the surface tells the user about
its own scope*. No source files were taken.

# Relevant patterns found

- A single answer surface owns every question; other views hand off to it rather than each growing
  their own chat.
- A query arrives with its **mode/scope already set**, so the user never has to configure retrieval
  before asking.
- The surface is explicit about what it searched, and citations are part of the answer contract
  rather than a footer.

# What maps to our codebase

`apps/web/app/(platform)/intelligence/ask/page.tsx` (existing Phase 6 page),
`apps/web/lib/intelligence/ask-launch.ts` (new), `components/ask/ask-chat.tsx`,
`components/ask/answer-panel.tsx`.

# What we are adopting

- **Pattern only:** the single-surface handoff. All seven Intelligence views launch
  `/intelligence/ask` through one builder (`buildAskHref`) with `mode` and `purpose` pre-set, and
  `ASK_LAUNCH_PATH` is the only Ask path any view may reference.
- Explicit scope disclosure on arrival: the new context banner names the view the question came from
  and states that **the carried context is provenance only and did not narrow retrieval** — retrieval
  scope stays the purpose plus RLS.

# What we are explicitly NOT adopting

- **Any second chat surface.** P9 mounted no new chat client; `AskChatClient` and the dual-rail agent
  were not touched. The acceptance script greps every Intelligence view to prove none imports a chat
  client or a research provider.
- Its search-provider abstraction and any of its backends (Tavily / Exa / SearXNG / Serper). Our
  public rail remains `lib/ask/research/provider.ts` and P9 added no provider and no key. The
  acceptance script fails the build if `tavily`, `exa.ai`, `serper` or `perplexity` appears in an
  Intelligence view.
- Generative UI that composes answer widgets from model output. Our answer contract is fixed —
  Answer / Sources / Data Scope / Limitations / View Source — and a model may not invent a component.
- Treating public research as equal to verified internal evidence. That separation is a Phase 6
  invariant (`INTERNAL_VERIFIED` vs `PUBLIC`, never written into `document_chunks`) and P9 preserves it.

# License/copy implications verified

**Apache-2.0** per GitHub license metadata, verified 2026-08-21 (`license.spdx_id = Apache-2.0`, not
archived). Copy-eligible with attribution and NOTICE obligations. **No upstream source was copied** —
patterns only, so no NOTICE obligation was incurred.

# Local files affected

`apps/web/lib/intelligence/ask-launch.ts`, `apps/web/app/(platform)/intelligence/ask/page.tsx`,
`apps/web/components/intelligence/honesty-strip.tsx` (the `AskAboutThis` chip group).

# Status

INSPECTED FOR TASK — handoff + scope-disclosure pattern adopted; second surface and provider
abstraction REJECTED.

## F4 follow-up (2026-08-21)

F4 Public Research Pipeline reaffirmed Morphic's single Ask surface: live `search_public_research`
remains the **cite-only** public rail. Durable observations live in `research_facts` and are
reachable from Ask only via `search_verified_research_facts` (**HUMAN_VERIFIED** filter). No second
chatbot and no Morphic-style provider abstraction were added; Research UI is a review workbench, not
a chat.
