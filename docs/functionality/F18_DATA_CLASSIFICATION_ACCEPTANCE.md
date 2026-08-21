# F18 — Data Classification + Trust Authority acceptance

**Status:** IMPLEMENTED + ACCEPTANCE PROVEN on 2026-08-21
**Migration:** `20260821350000_f18_data_classification.sql` — applied to the linked database
**Acceptance:** `npm run test:f18-classification` — **16/16 PASS**

## What shipped

- Canonical `data_classification` enum:
  `verified_public | verified_internal | internal_unverified | illustrative_demo`.
- Non-null classification on `documents`, denormalized to `extracted_facts` and
  `document_chunks`, with safe default/backfill `internal_unverified`.
- Database triggers inherit document classification and refuse unauthorized changes.
- Human-gated `set_document_data_classification` RPC for `verify.promote` / admin;
  classification changes emit a verification event.
- `search_verified_knowledge` and chunk promotion enforce purpose eligibility and
  copy classification without upgrading it.
- Shared classification types, eligibility policy, human promotion wrapper, and
  explicit AI no-elevation assertion under `apps/web/lib/classification/`.
- Classification gates in retrieval, Ask evidence/tools, reports, governed
  analytics, Home aggregates, ingest/corpus paths, verification, and Content UI.
- Reports and analytics disclose the classifications eligible for their purpose.

## Independent axes

`data_classification` does not replace or derive from either:

- `verification_status` (`AI_EXTRACTED`, `NEEDS_REVIEW`, `HUMAN_VERIFIED`, etc.); or
- `corpus_class` (`A`, `B`, `C`).

A row must independently satisfy verification, classification, provenance, reuse,
tenancy, and purpose gates. `verified_public` remains public-market authority and is
never re-labelled as L&P internal history.

## Eligibility matrix

| Purpose | verified_public | verified_internal | internal_unverified | illustrative_demo |
| --- | --- | --- | --- | --- |
| `GENERAL_QA` | Yes | Yes | No | No |
| `LOCATE` | Yes | Yes | Yes | No |
| `LOSS_ANALYSIS` | No | Yes | No | No |
| `COMPETITOR_ANALYSIS` | Yes | Yes | No | No |
| `PRICING_ANALYSIS` | Yes | Yes | No | No |
| `BID_STRATEGY` | Yes | Yes | No | No |
| `PROPOSAL_DRAFTING` | No | Yes | No | No |
| `COMPLIANCE_REVIEW` | No | Yes | No | No |
| `REPORT_GENERATION` | Yes | Yes | No | No |
| `DEMO_TEST` | Yes | Yes | Yes | Yes |

`DEMO_TEST` is the only purpose that admits `illustrative_demo`; it must be selected
explicitly.

## Adversarial acceptance

The F18 suite proves:

1. canonical enum values only;
2. classification is independent from verification and corpus class;
3. demo data cannot change win rate;
4. demo pricing is not comparable, including mixed-source pricing rows;
5. verified public competitor evidence is not L&P history;
6. internal-unverified evidence is excluded from trusted reports;
7. verified public evidence is eligible for public intelligence;
8. verified internal evidence is eligible for drafting;
9. demo evidence requires explicit `DEMO_TEST`;
10. classification changes require the authorized RPC;
11. AI cannot elevate or reclassify;
12. facts/chunks inherit and chunk promotion never upgrades;
13. retrieval filters by purpose;
14. ingest defaults unverified and supports explicit demo;
15. reports disclose eligibility; and
16. the live database enforces an authorized classification transition.

## Verification record

| Check | Result |
| --- | --- |
| `test:f18-classification` | PASS — 16/16 |
| `test:phase2-rls` | PASS — 51/51 |
| `test:phase6-ask` | PASS — 47/47 |
| `test:f6-structured-analytics` | PASS — 34/34 |
| `test:p6-response-workspace` | PASS — 41/41 |
| `lint` | PASS |
| `typecheck` | PASS |
| `build` | PASS |
| IronBee browser verification | PASS — verification and Content badges visible; no console errors |

## Honest limitations / follow-up

- Migration backfill deliberately classifies every pre-F18 row as
  `internal_unverified`; it does not infer authority from verification or corpus
  class. At verification time, the linked database held 37 documents, 1,374 facts,
  and 230 chunks in that safe state.
- Trusted Ask/report/drafting paths can therefore return less or no historical
  evidence until an authorized operator classifies source documents.
- F18 supplies the human-gated RPC and badges, but not a bulk-classification UI.
  Existing documents require source-by-source human review; no automated backfill
  may elevate them.
- OpenContracts and Argilla remain design patterns only; neither is a runtime
  dependency or authority source.
