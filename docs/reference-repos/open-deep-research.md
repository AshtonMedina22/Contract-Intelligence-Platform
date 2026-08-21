# Open Deep Research

https://github.com/langchain-ai/open_deep_research

# Task that caused inspection

P5 Pursuit Overview + Bid Strategy (2026-08-21). Question: should the Bid Strategy section be a
research agent, and what citation discipline should a sourced synthesis enforce?

# Relevant upstream files inspected

- GitHub repository metadata (2026-08-21) — MIT, Python, 12.6k stars, last push 2026-08-10
- `src/open_deep_research/prompts.py` — clarify-with-user, research brief, supervisor, researcher,
  compress-research, and final-report prompts

# Relevant patterns found

**Citation discipline, stated as a hard rule.** The report prompts require every unique source to get
a citation number, sequentially numbered without gaps, listed in a trailing `### Sources` section, and
cited against the statement it supports — *"Citations are extremely important… Users will often use
these citations to look into more information."* The compression prompt goes further and insists no
source may be dropped when findings are merged.

**Do not invent.** The research-brief prompt says plainly: *"If the user has not provided a particular
detail, do not invent one."*

**Attribution over assertion.** *"if three sources all say 'X', you could say 'These three sources all
stated X'"* — a claim is framed as what the sources recorded, not as fact.

**Orchestration.** Clarify → written research brief → supervisor delegating parallel `ConductResearch`
calls → per-researcher tool loop → compression → final synthesis, with iteration caps
(`max_researcher_iterations`) and heuristic stop conditions such as *"stop after 5 search tool calls"*
or *"you have 3+ relevant examples/sources."* The whole thing runs on LangGraph.

# What maps to our codebase

`apps/web/lib/opportunity/overview-model.ts` (`buildBidStrategy`),
`apps/web/lib/ask/research/provider.ts`, `apps/web/lib/reports/generate.ts`, and the
Answer / Sources / Data Scope / Limitations / View Source answer contract.

# What we are adopting

**One citation per claim, no exceptions.** Every `EvidenceBullet` from `buildBidStrategy` carries at
least one `Citation`, and the acceptance script asserts it (`buildBidStrategy gives every bullet at
least one citation`). Where a real href exists — a verification document, a competitor source URL, a
pursuit tab — the citation links to it; where only a row exists, the citation names the table rather
than pretending to a link.

**Attribution phrasing.** Bullets read as what the corpus recorded: "8 respondent score(s) recorded
for this solicitation", "Counts of records held, not a win rate". No bullet asserts a fact in the
platform's own voice.

**Never invent a missing detail**, which we implement structurally rather than as a prompt
instruction: absent rows produce a `withheld` entry naming what is unknown.

# What we are explicitly NOT adopting

- **LangGraph, and the agent loop itself.** Confirmed against the architecture lock — no LangGraph
  for ingest, and no durable agent framework introduced for this. `buildBidStrategy` is a pure
  synchronous function over rows already fetched by `load-overview-bundle.ts`; it makes no model call
  at all, so there is nothing to orchestrate.
- **LLM-written narrative.** Their final report is model prose with citations attached afterward.
  Ours is deterministic sentences built from counts, plus verified chunks quoted verbatim with a page
  number.
- **Heuristic sufficiency stops.** "3+ relevant sources" is a confidence guess. We use a hard
  predicate instead: zero bullets means `status: "INSUFFICIENT"` with the canonical reason, never a
  thinner answer.
- Public web search inside the pursuit Overview. The bid strategy reads this pursuit's own records
  only; public research stays on the Ask / Intelligence rail where its evidence class is labelled.

# License/copy implications verified

**MIT** per GitHub repository license metadata on `main`, 2026-08-21. Copy-eligible with attribution.
**No upstream code was copied** — prompt text was read for its citation and non-invention rules, which
we reimplemented as type-level and test-level constraints rather than as instructions to a model.

# Local files affected

None directly. Informed the citation requirement and the `INSUFFICIENT` contract in
`apps/web/lib/opportunity/overview-model.ts`, and the corresponding checks in
`scripts/p5-pursuit-strategy-acceptance.mjs`.

# Status

INSPECTED FOR TASK — citation discipline adopted, orchestration DECLINED
