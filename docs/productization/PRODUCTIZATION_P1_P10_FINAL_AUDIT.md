# Productization P1–P10 — Final Audit

**Audit date:** 2026-08-21
**Scope:** The ten productization passes only. This audit reports what the ten passes shipped, what
the regression suite says today, and what is still missing. It is **not** a claim that the platform
is finished or commercially ready.

**Authority:** [BUILD_PLAN.md](../BUILD_PLAN.md) (canonical product phases 1–8),
[CANONICAL_PRODUCT_PACK.md](../CANONICAL_PRODUCT_PACK.md),
[FOUNDATION_AUDIT_2026-08-20.md](../FOUNDATION_AUDIT_2026-08-20.md),
[WORK_TRAIL.md](../WORK_TRAIL.md), [RELEASE_READINESS_REPORT.md](../RELEASE_READINESS_REPORT.md), and
the ten `P*_ACCEPTANCE.md` documents in this directory.

---

## What P1–P10 was, and what it was not

Productization P1–P10 is a **UI/UX and operator-surface programme**, not the product phase plan.
The legacy engineering phases (0–14) built the schema, the trust model, the pipeline and the
business logic. P1–P10 made those reachable and honest for an operator.

Three things follow from that, and they are the most important sentences in this document:

1. **Passing P10 does not complete canonical Phase 8.** The canonical product phases are 1–8 and are
   gated on validated behaviour against a real corpus, not on the existence of a route.
2. **Canonical Phase 2 (Historical Pilot) has not exited.** See corpus maturity below.
3. **Commercialization is not a core product phase and is not started.** Stripe, MCP and agents are
   explicitly out of scope for P1–P10 and remain unbuilt.

---

## Phase-by-phase status

| Pass | Surface | Status | Acceptance |
| --- | --- | --- | --- |
| **P1** | UX foundation — sidebar IA, shell primitives | **IMPLEMENTED** | [P1](P1_UX_FOUNDATION_ACCEPTANCE.md) |
| **P2** | Real-corpus Data Ops — intake, queue, verification, exceptions | **IMPLEMENTED** | [P2](P2_REAL_CORPUS_DATA_OPS_ACCEPTANCE.md) |
| **P3** | Executive Home + Action Center | **IMPLEMENTED** | [P3](P3_EXECUTIVE_HOME_ACCEPTANCE.md) |
| **P4** | Public opportunity discovery + watchlist + Start Pursuit | **IMPLEMENTED**, independently verified — **fixture mode**, no live provider | [P4](P4_OPPORTUNITY_DISCOVERY_ACCEPTANCE.md) |
| **P5** | Pursuit Overview + bid strategy | **IMPLEMENTED**, browser-verified | [P5](P5_PURSUIT_STRATEGY_ACCEPTANCE.md) |
| **P6** | Requirement-driven Response workspace | **IMPLEMENTED**, browser-verified | [P6](P6_RESPONSE_WORKSPACE_ACCEPTANCE.md) |
| **P7** | Pricing workbench polish | **IMPLEMENTED**, browser-verified | [P7](P7_PRICING_WORKBENCH_ACCEPTANCE.md) |
| **P8** | Submission + outcome + contract handoff | **IMPLEMENTED**, browser-verified | [P8](P8_SUBMISSION_RESULT_HANDOFF_ACCEPTANCE.md) |
| **P9** | Full Intelligence workbench | **IMPLEMENTED**, browser-verified | [P9](P9_INTELLIGENCE_WORKBENCH_ACCEPTANCE.md) |
| **P10** | Contract portfolio + renewal/rebid command center | **IMPLEMENTED**, browser-verified | [P10](P10_CONTRACT_RENEWAL_REBID_ACCEPTANCE.md) |

### Capabilities delivered

**P1** — Five-job sidebar (Home · Pursuits · Intelligence · Contracts · Data Ops) with Settings in the
footer, Ask in the header, and shared `PageHeader` / `WorkspaceHeader` / `EmptyState` /
`CollectionPage` primitives. Deliberately demoted `CONTRACTS_TABS` to `Portfolio` alone.

**P2** — Client preflight and per-file status on intake, a processing queue that surfaces
`lifecycle_error` instead of failing silently, `OCR_REQUIRED` as a distinct operator state, a
re-extract guard that cannot overwrite `HUMAN_VERIFIED` facts, and a corpus funnel report.

**P3** — An executive home that states what is due and what is blocked, sourced from real rows.

**P4** — Public notice discovery, a watchlist, and Start Pursuit with one-pursuit-per-notice
enforcement and `AI_EXTRACTED` provenance on landing. **Runs in fixture mode**; no live public
provider is wired.

**P5** — Eleven dense read-first Overview sections with an openable citation behind every bullet,
`INSUFFICIENT` when there is no evidence, and bid/no-bid left to a person.

**P6** — A Response workspace where the allowed action follows the evidence state of the selected
requirement: Generate is gated on `L_AND_P_INPUT_REQUIRED`, `DO_NOT_USE` / `SUPERSEDED` chunks are
rejected above the override, and autosave can never approve.

**P7** — A five-truth Glide pricing matrix that is **read-only by design** — the grid declares no
`onCellEdited`, because a grid edit would create a rate with no `source_fact_id`. Final bid reads
*FINAL PRICE — HUMAN DECISION REQUIRED*.

**P8** — Submission packet and checklist, result capture, and contract-on-win handoff, with no
auto-submit path.

**P9** — Seven Intelligence views on one honesty contract: every tile carries `n=` and its source
table, the win rate is **withheld below 20 decided pursuits**, the Recompete Radar restates a
verified date and never infers one, and one Ask surface serves every view.

**P10** — The contract portfolio and renewal/rebid command center, on one shared
`portfolio-model.ts`: verified dates only, values as named instruments or a dash, an append-only
change timeline, advisory rebid readiness, a `Start Rebid Pursuit` CTA that copies no pricing, and an
automation strip that states what the cron does **and does not** do.

---

## Test evidence — full regression, run 2026-08-21

### Productization acceptance suites (pure; bundle and run shipped code)

| Suite | Result |
| --- | --- |
| `test:p4-discovery` | **PASS 8/8** |
| `test:p5-pursuit-strategy` | **PASS 26/26** |
| `test:p6-response-workspace` | **PASS 41/41** |
| `test:p7-pricing-workbench` | **PASS 35/35** |
| `test:p8-submission-result` | **PASS 44/44** |
| `test:p9-intelligence-workbench` | **PASS 40/40** |
| `test:p10-contracts-renewal` (new) | **PASS 29/29** |

**223/223.** P4 also has `test:p4-discovery-rls` (14/14, DB-backed).

### Engineering phase suites (DB-backed)

| Suite | Result |
| --- | --- |
| `test:phase2-rls` | **PASS 51/51** |
| `test:phase3-intake` | **PASS 9/9** |
| `test:phase5-verification` | **PASS 3/3** |
| `test:phase6-ask` | **PASS 46/46** |
| `test:phase7-four-truth` | **PASS 10/10** |
| `test:phase8-response` | **PASS 30/30** |
| `test:phase9-contracts` | **PASS 6/6** |
| `test:phase10-win-loss` | **PASS 13/13** |
| `test:phase11-hybrid-rag` | **PASS 10/10** |
| `test:phase4-contracts` | **47/48** — 1 pre-existing (was 44/46 before P10) |
| `test:phase5-intelligence` | **24/25** — 1 pre-existing |
| `test:phase7-pricing` | **12/13** — 1 pre-existing |

### VERIFY suites (independent lifecycle audits)

| Suite | Result |
| --- | --- |
| `test:verify1` | **PASS** — architecture 5/5, foundation runtime 21/21 |
| `test:verify3` | **PASS 26/26** |
| `test:verify8` | **PASS 23/23 — verdict PASS** |
| `test:verify2c` | **55/56** — 1 pre-existing harness fatal |
| `test:verify4` | **30/31** — 1 pre-existing |
| `test:verify5` | **22/24 — verdict FAIL** — 2 pre-existing |
| `test:verify6` | **23/24 — verdict FAIL** — 1 pre-existing |
| `test:verify7` | **19/22 — verdict FAIL** — 3 pre-existing |

### Build gates

`npm run lint` **PASS** · `npm run typecheck` **PASS** · `npm run build` **PASS**.

One known non-blocking advisory: in `next dev`, all five `/contracts/[contractId]/*` tabs log the
Next.js 16 *"uncached data during prerendering"* notice, because each tab awaits its loader in the
page body while the `Suspense` boundary sits in `[contractId]/layout.tsx`. **Pre-existing** — the same
page structure and the same top-level awaits are present at `HEAD`, and the production build
prerenders all five routes without error. It is a rendering-hygiene item, not a correctness one.

### The eleven open failures, and why they are not P10 regressions

**Every one was re-run on a clean `HEAD` worktree, and failed identically.** They fall into two
families: nine fixture/trust-trigger failures and two stale UI greps.

**Family 1 — fixture-versus-trust-trigger drift (9 failures).** Phase 9's trust triggers
(`20260821120000` and siblings) require a `source_fact_id` referencing a `HUMAN_VERIFIED` fact before
a row may be written to `awards`, `contracts`, `document_chunks` and `pricing_lines.awarded_rate`.
Several older fixtures still do a bare insert. The trigger rejects it, the insert returns null, and
the fixture then dereferences `.id` on null — which is where the opaque
`Cannot read properties of null (reading 'id')` fatals in `verify2c`, `phase7-pricing` and `verify7`
come from.

| Failure | Suite |
| --- | --- |
| `[commercial] award NTE stored for linked pursuit` | `phase4-contracts` |
| `[linkage] linked pursuit/award remains traceable` | `verify4` |
| `[buyer] Buyer history connects multiple contracts — contracts=0` | `verify5` |
| `[automation] Renewal/compliance checks use verified dates` | `verify6` |
| `[periods] Base / options / escalation coexist` + `[fatal] suite error` | `verify7` |
| `[schema] reuse_status accepts REVIEW_REQUIRED` | `phase5-intelligence` |
| `[harness] suite execution` / `[fatal] suite error` | `verify2c`, `phase7-pricing` |

**These are correct database behaviour meeting stale test data.** They must be re-earned by sourcing
the fixtures through verified promotion — **never** by weakening a `*_require_verified_fact` trigger.

**Family 2 — stale UI greps against surfaces a later pass recomposed (2 failures).**

| Failure | Suite | Note |
| --- | --- | --- |
| `[pursuit] Pursuit Overview consumes intelligence summary` | `verify5` | P5 recomposed that page; the `phase5` equivalent was updated, `verify5` was not |
| `[human] Final bid UI requires explicit human action` | `verify7` | greps `decided_by: approve ? user.id`, renamed to `userId` in `c1747dd`; the human gate itself is intact and `phase7-four-truth` passes 10/10 |

**P10 fixed one of this family** rather than leaving it: `phase4-contracts`
`[ui] ContractsNav Portfolio | Renewals | Compliance` was written against the pre-P1 shell. It was
rewritten to assert the intentional P1 demotion positively, taking the suite from 44/46 to 47/48.

**Re-earning VERIFY 5 / 6 / 7 and the four phase-suite fixtures is its own task**, and it is a
prerequisite for any future release claim. It was not in P10's scope.

---

## Corpus maturity — the real constraint

Measured 2026-08-21 via `scripts/corpus-funnel-report.mjs` and the live operator org.

| Stage | Count |
| --- | --- |
| Discovered (manifest) | 46 sources |
| Ingested documents | 34 |
| Documents with ≥ 1 fact | 33 |
| Documents `VERIFIED` | 33 |
| `HUMAN_VERIFIED` facts | 204 |
| Procurement packages | 22 |
| A/B packages fully `VERIFIED` | **15** |
| Sourced `pricing_lines` | 34 |
| Contracts | **12** |
| Contracts with a `verified_end_on` | **3** (1 active, 2 expired) |
| Contracts with an award NTE or a purchase order | **0** |
| `win_loss_reviews` decided | **0** |

**Canonical Phase 2 (Historical Pilot) has not exited.** The target is ~20–30 packages through
verify→promote; 15 A/B packages are fully verified. The lower bound is approached, not met, and the
[FOUNDATION_AUDIT](../FOUNDATION_AUDIT_2026-08-20.md) exit criteria are still open.

This is the single biggest limitation on the whole programme, and it shows up as the same symptom in
pass after pass:

- **P7:** `pricing_lines.labor_category` on Arlington holds bidder names, and `observedSpan` across
  the corpus runs `$6.00 – $4,722,008.00 (n=31)` because hourly rates and annual totals share one
  column. The workbench displays what was promoted; **the promoter's grain mapping is the defect.**
- **P9:** the win rate has **never been displayed** — 0 decided pursuits against a threshold of 20 —
  and all four Market radar rows are `PARTIAL` with no named incumbent.
- **P10:** 9 of 12 contracts have no verified end date, every renewal bucket except `EXPIRED` is
  zero, and Active Contract Value has only ever rendered in its withheld state.

In every case the surface is behaving correctly by refusing to invent the missing value. **A correct
refusal is not a working feature.** These views become useful when the corpus does.

---

## Production readiness

**Not production-ready for live L&P daily use.** The last full release audit
([RELEASE_READINESS_REPORT.md](../RELEASE_READINESS_REPORT.md), VERIFY 9 fix pass) recorded *READY
WITH NONBLOCKING LIMITATIONS* on engineering gates while listing external blockers. P1–P10 did not
close those blockers, and three VERIFY suites currently return **verdict FAIL**.

### Blockers

| Blocker | Why it blocks | Owner |
| --- | --- | --- |
| Historical Pilot exit unmet (15 of ~20–30) | Every intelligence, pricing and renewal surface is thin or withheld | Corpus acquisition + verify→promote |
| VERIFY 5 / 6 / 7 verdict **FAIL** | Independent lifecycle audits do not pass; no release claim is defensible while they are red | Fixture repair through verified promotion |
| Promoter grain mapping | Bidder names in `labor_category`, totals in a rate column, page markers in `site_or_post` — pricing intelligence is not trustworthy until fixed | Extraction / promote |
| Production runtime unproven | FastAPI processor is not hosted; Vercel prod processing path unproven end to end | Ops |
| `ASK_MODEL` / Gateway | Ask synthesis proven locally only; retrieval and refusal paths proven, full synthesis in prod is not | Ops / billing |
| Role permissions not UI-gated | The role enum is stored but not enforced in the UI | Engineering |
| P4 discovery is fixture mode | No live public notice provider is wired | Engineering |

### What is genuinely solid

Tenant isolation (`phase2-rls` 51/51), provenance and versioning, the four commercial truths, the
human-decision gates on pricing and submission, purpose-aware retrieval with tenant isolation, and
the trust triggers — which are strict enough that they are currently failing our own stale fixtures.
That is the correct direction for that failure to point.

---

## Remaining scope — explicitly not built

**Commercialization is not a core product phase and none of it exists.** Do not read P10 as
completing the platform.

| Area | Status |
| --- | --- |
| **Stripe** / billing / plans / metering | **NOT STARTED.** No billing tables, no checkout, no entitlement gating. |
| **MCP server** / external tool surface | **NOT STARTED.** Registered as a later, optional reference; not a Phase 1–8 dependency. |
| **Agents** / autonomous execution | **NOT STARTED**, and constrained by design: nothing may auto-promote an AI extraction, auto-approve a bid, auto-submit, or auto-renew. |
| Canonical **Phase 8** (Response / Submission / Result) product validation | Surfaces exist and are browser-verified; **validation against a mature corpus does not** |
| Public sign-up / client portal / CRM | **Out of scope by product rule** — this is not a CRM. |
| Live public-notice provider | Not wired; P4 runs in fixture mode. |
| OCR (`MISTRAL_API_KEY`) | Deferred external. Scanned documents escalate honestly rather than silently failing. |

### Recommended next work order

1. Repair the fixtures behind VERIFY 5 / 6 / 7 and the four phase-suite failures **through verified
   promotion**, and re-earn those verdicts.
2. Fix the promoter grain mapping (rate versus total, labor category versus bidder, site versus page
   marker). Until this lands, pricing intelligence is not trustworthy.
3. Grow the Historical Pilot toward ~20–30 packages, prioritising documents that carry
   `verified_end_on`, award NTE amounts, and decided outcomes — those three fields are what unblock
   the renewal queue, Active Contract Value and the win rate simultaneously.
4. Only then treat later phases as product-validated, and only then reopen the release question.

---

## Reference notes recorded this programme

Under the external-reference rules: maximum three inspections per task, license verified before any
copy, and local canonical docs override upstream. **No upstream source has been copied in any of the
ten passes.**

P10 added [catalogit.md](../reference-repos/catalogit.md) (MIT, renewal-queue pattern adopted,
notification dispatch declined), [public-sector-clm.md](../reference-repos/public-sector-clm.md)
(**no license** — reference-only; lifecycle vocabulary adopted, everything before *Active* declined)
and [whereas.md](../reference-repos/whereas.md) (GPL-3.0 — reference-only; append-only timeline
pattern adopted, clause extraction and e-signature declined). The Whereas registry entry recorded
AGPL; the live license is GPL-3.0 and the registry was corrected.

**This product is not a CLM.** It records what a buyer awarded and what L&P must decide next. It does
not author, redline, route or execute contracts.
