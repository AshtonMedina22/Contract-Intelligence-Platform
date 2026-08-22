# F22 — Similar Historical Pursuit + Comparable Matching Engine

**Status:** implemented, fixture-proven; live usefulness remains constrained by F18 classification and corpus quality.

## One engine

`apps/web/lib/comparables/` is the only pursuit-comparison engine. It serves:

- `BID_STRATEGY`
- `PRICING_COMPARABLE`
- `PROPOSAL_CONTENT`
- `WIN_LOSS_ANALYSIS`

`ALGORITHM_VERSION = f22-structured-v1.0.0`. No comparable-set table was added, so there is no new
saved set on which to persist the version. Pricing judgments remain in the existing
`pricing_comparable_judgments` table and remain authoritative over an engine proposal.

## Formula

```text
total score (0–100)
  = Σ(structured feature value 0..1 × purpose weight; max 85)
  + compatible F21 semantic similarity 0..1 × 15 (optional; max 15)
```

Missing structured values are `null`, receive zero points, and produce a named missing-field
rationale. They are never replaced with a guessed match. The result reports weighted coverage out of
85. Semantic similarity can never become the whole score or outrank trust gates.

## Purpose-versioned weights

| Feature | Bid strategy | Pricing comparable | Proposal content | Win/loss analysis |
| --- | ---: | ---: | ---: | ---: |
| Buyer | 18 | 12 | 8 | 13 |
| Service | 20 | 20 | 23 | 18 |
| Geography | 8 | 10 | 5 | 7 |
| Procurement rail | 8 | 5 | 9 | 8 |
| Solicitation kind | 7 | 4 | 9 | 7 |
| Recorded weekly-hours scale | 8 | 16 | 5 | 7 |
| Recency | 7 | 10 | 7 | 8 |
| Recorded outcome | 5 | 2 | 3 | 12 |
| Pricing coverage | 2 | 6 | 0 | 3 |
| Reusable proposal-content coverage | 2 | 0 | 16 | 2 |
| **Structured maximum** | **85** | **85** | **85** | **85** |
| Optional semantic maximum | 15 | 15 | 15 | 15 |

Service and geography use deterministic normalized token overlap. Buyer, procurement rail, and
solicitation kind use exact recorded values. Scale is the smaller/larger ratio of recorded weekly
hours. Recency decays linearly to zero at eight years. Availability features state whether a recorded
outcome, pricing line, or HUMAN_VERIFIED reusable proposal section exists.

## Authority

- RLS is the database boundary; the engine also rejects a candidate whose `organizationId` differs.
- `illustrative_demo` is always excluded.
- a candidate needs `verified_public` or `verified_internal` source classification.
- `A_LP_ORIGINATED` may be labeled **L&P historical**.
- `B_LP_TIED` is labeled **L&P-tied buyer evidence**, not L&P-delivered performance.
- `C_COMPETITOR_TEST` is labeled **Non-L&P test corpus**, never L&P historical performance, and is
  excluded from `PROPOSAL_CONTENT`.

Similarity describes recorded peer characteristics. It does not establish causation, win
probability, or a winning price.

## Wires

- Pursuit Overview: ranked peers and top component reasons above Bid Strategy.
- Pursuit Pricing: F22 proposes include/exclude and orders lines; a recorded human judgment overrides
  it and still requires a reason. Final pricing remains human-only.
- Pursuit Response: optional authority-eligible peer filter narrows the existing F7
  `PROPOSAL_DRAFTING` passage search. It does not replace F7, reuse status, or `DO_NOT_USE` gates.
- Intelligence → Win/Loss: selecting a pursuit shows purpose-specific peer ranking.
- Reports were not expanded; report generators remain corpus-thin and no extra narrative claim was
  justified.

## Acceptance

Run:

```bash
npm run test:f22-comparables
```

Fixtures cover same buyer, same service, different geography/service/scale, recent versus stale,
missing fields, non-L&P Class C, illustrative demo, semantic paraphrase, pricing coverage, proposal
content coverage, and wrong tenant. The suite verifies ordering, authority labels/exclusions,
component rationale, semantic cap, every purpose weight total, purpose differences, and all four
primary wires.

## External references

RFPilot and AutoRFP remain pattern-only. F22 adopts question/evidence scoping, not their opaque
model-generated fit scores. No upstream source was copied and no second retrieval or application
stack was introduced.
