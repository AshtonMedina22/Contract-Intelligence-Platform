# Source precedence

See [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). Promotion must follow these rules (Phase 7+).

When two documents disagree, do not silently “fix” the difference. Record a conflict and keep both values with sources.

## Commercial-state precedence

Use the matching truth, not the newest file:

| Question | Authoritative sources | Must not override with |
| --- | --- | --- |
| What did the customer request? | RFP/RFQ/IFB, addenda, Q&A | Later award or amendment |
| What did L&P propose? | Final submitted proposal and pricing workbook | Drafts, awards, or current contract |
| What was awarded? | Award notice, PO, executed contract | Subsequent modifications |
| What is currently effective? | Latest executed amendment/modification/option/renewal | Original award if later instruments exist |

Addenda and Q&A amend the solicitation. They do not amend the awarded contract.

## Version precedence

- Current-version flag is explicit. Superseded versions remain readable.
- Checksum equality means “same bytes,” not “same business meaning.”
- A newer file in Drive does not replace a verified Storage copy until it is ingested as a new version and verified.

## Extraction vs verification

1. Parser/model output is staging evidence.
2. Automated validation can flag identity, math, date order, package completeness, and entity mismatches.
3. Human verification is the promotion gate for material facts.
4. Legitimate requested/proposed/awarded/current differences are not validation errors to collapse.

## Retrieval filters

AI and search must honor, in order:

1. Organization / RLS
2. Verification state
3. Reuse status (`DO_NOT_USE` and `SUPERSEDED` stay out of drafting retrieval)
4. Outcome (won/lost used as context, never as automatic reuse)
5. Current vs historical version

## Public research

Every research fact keeps URL, organization, document, publication date, retrieval date, page/section, verification, and confidence. Research still passes through staging rules.
