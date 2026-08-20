# Source precedence

See [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md), [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md), [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md). Promotion must follow these rules.

When two documents disagree, do not silently "fix" the difference. Record a conflict and keep both values with sources.

## Commercial-state precedence

Use the matching truth, not the newest file:

| Question | Authoritative sources (highest first) | Must not override with |
| --- | --- | --- |
| What did the customer request? | Latest applicable addendum / official Q&A / clarification → original RFP/RFQ/IFB | Later award, proposal, or amendment |
| What did L&P propose? | Final submitted proposal and pricing workbook | Drafts, awards, or current contract |
| What was awarded? | Award notice, PO, executed contract (at award) | Subsequent modifications |
| What is currently effective? | Latest executed amendment / modification / option exercise / renewal | Original award if later instruments exist |

Addenda and Q&A amend the solicitation. They do not amend the awarded contract.

## Document-type precedence within a truth

**Requirements (requested):**

```text
latest applicable addendum / clarification / Q&A
        >
original solicitation
```

**L&P submitted position (proposed):**

```text
final submitted proposal / pricing workbook
        >
draft proposal / working copy
```

**Current commercial terms (current):**

```text
latest executed amendment / modification / option / change order
        >
executed contract / PO
        >
award notice
        >
submitted proposal (never for current terms alone)
```

Historical source values must remain preserved. Lifecycle changes (proposal value A → contract B → amendment C) are legitimate differences, not one "correct" number to collapse.

## Version precedence

- Current-version flag is explicit (`is_current` on versions; `is_current_version` on chunks). Superseded versions remain readable.
- Checksum equality means "same bytes," not "same business meaning."
- A newer file in Drive does not replace a verified Storage copy until it is ingested as a new version and verified.

## Extraction vs verification

1. Parser/model output is staging evidence.
2. Automated validation can flag identity, math, date order, package completeness, and entity mismatches.
3. Human verification is the promotion gate for material facts.
4. Legitimate requested/proposed/awarded/current differences are not validation errors to collapse.

## Conflicts and reconciliation

Conflicts should create validation/reconciliation events (`validation_exceptions`), not silent overwrites.

Examples:

- proposal value = A, executed contract = B, amendment = C → three preserved truths with sources
- second requested rate on same line → `rate_conflict_requested` / exception, not overwrite
- award source attempting to write `requested_rate` → blocked with `precedence_award`

## Enforced today (RPC / code)

| Rule | Mechanism |
| --- | --- |
| Infer truth from document type / filename | `infer_commercial_truth()` |
| Write one rate column per truth | `promote_verified_fact()` |
| Refuse overwrite of different rate | `validation_exceptions` + no UPDATE |
| Requirements only from requested sources | `precedence_requirement` |
| Awards only from awarded sources | `precedence_award` |
| Contracts from awarded or current only | `promote_contract_from_fact()` |
| RFP/proposal cannot become contract without award path | `precedence_contract` |

## Intended later (not fully implemented)

- First-class `solicitation_addenda` table with explicit supersession chain
- Automated "latest applicable addendum" selection for requirement facts
- Package-completeness reconciliation (missing award doc when proposal exists)
- Source precedence dashboard in verification workbench

## Retrieval filters (search / AI)

AI and search must honor, in order:

1. Organization / RLS
2. Verification state (`HUMAN_VERIFIED` for canonical retrieval)
3. Reuse status (`DO_NOT_USE` and `SUPERSEDED` stay out of **drafting** retrieval)
4. Retrieval **purpose** (e.g. `LOSS_ANALYSIS` may include DO_NOT_USE; `PROPOSAL_DRAFTING` must not)
5. Outcome (won/lost used as context, never as automatic reuse)
6. Current vs historical version

**Enforced today:** items 1–3 and 6 partially via `search_verified_knowledge` + RLS. **Not enforced:** purpose (item 4), outcome (item 5).

## Public research

Every research fact keeps URL, organization, document, publication date, retrieval date, page/section, verification, and confidence. Research still passes through staging rules.
