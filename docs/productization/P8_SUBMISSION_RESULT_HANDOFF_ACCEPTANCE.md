# P8 Submission + Outcome + Contract Handoff Polish — Acceptance

**Date:** 2026-08-21
**Status:** IMPLEMENTED — verified in the browser against the live operator org on PKG-03 Arlington TX.
One additive migration (`20260821200000_p8_submission_authorization.sql`). No new dependency. **No
Phase 8 trust rule was loosened, and two were made harder to break.**

## The workflow this closes

`readiness → outputs → mark submitted (human) → outcome → Create Contract (verified only)`

Every step of that chain existed before P8, but the chain did not hold: readiness was a checkbox
count, `saveSubmissionPacket` could stamp `submitted_at` from a form field with no actor and no
readiness check, the Outputs section offered a "DOCX" that is HTML in a `.doc` wrapper and a Google
Docs button with no integration behind it, and the contract CTA failed with a raw Postgres trigger
message. P8 makes each transition explicit, attributed, and honest about what it did not do.

---

## 1. Submission readiness — a computed model, not a checkbox count

`apps/web/lib/opportunity/submission-readiness.ts` (new, pure — no React, no Supabase, so the
acceptance script bundles and runs the shipped code).

| Export | Contract |
| --- | --- |
| `ReadinessStatus` | `COMPLETE`, `MISSING`, `NEEDS_SIGNATURE`, `NEEDS_APPROVAL`, `NOT_APPLICABLE`, `UNKNOWN` |
| `isSettledStatus` | Only `COMPLETE` and `NOT_APPLICABLE` are settled. **`UNKNOWN` is outstanding**, so an unmeasured packet can never read ready. |
| `computeSubmissionReadiness` | Merges the stored checklist, the enabled approval layers, the latest pricing decision, `computeResponseProgress`, and the packet logistics into one item list with counts, a required-only denominator, a `blocking` list, an `advisoryOutstanding` list, and an `overall` state. |
| `evaluateMarkSubmittedGate` | The hard gate: `ALREADY_SUBMITTED` → `NO_CHECKLIST` → `REQUIRED_ITEMS_INCOMPLETE` → `APPROVALS_OUTSTANDING` → `AUTHORIZATION_REQUIRED` → `ALLOWED`. Blocking reasons are evaluated **before** the authorization tick, so a tick can never buy past them. |
| `describeSubmissionOutputs` | One honest sentence per output, plus `available` / `unavailableReason`. |
| `evaluateContractHandoffGate` | The contract decision, stated once for both the panel and the action. |
| `isAwardishFact` / `AWARDISH_FACT_RE` | Award / contract / PO / NTE / agreement / ordering-vehicle shaped facts. |
| `RESULT_FIELD_SCOPE` | The two sentences that separate buyer-documented fields from internal analysis. |

Rules the model enforces, each covered by a check:

- **No checklist is `UNKNOWN`, never ready.** A pursuit with no seeded checklist produces one
  required `UNKNOWN` item that says so, and `overall = NO_CHECKLIST`.
- **A manual tick cannot fake an approval.** When any approval layer is enabled, the recorded layer
  status outranks the "Internal approvals" checkbox — ticking it while a layer is `requested` still
  reads `NEEDS_APPROVAL`. With **no** layer enabled, a tick reads `COMPLETE` but the detail says it
  is *an attestation, not a recorded approval*.
- **Signature items say so.** `sign|notar|seal|attest` items report `NEEDS_SIGNATURE` with "the
  platform does not sign anything", not a generic `MISSING`.
- **Pricing and response are advisory, never silently complete.** A missing pricing decision is
  `UNKNOWN`; `HUMAN_APPROVED` with no rate or amount is also `UNKNOWN`. Response coverage comes from
  the real `computeResponseProgress` and names `L&P INPUT REQUIRED` counts.
- **A confirmation gap only exists after submission.** The `logistics:confirmation` item is only
  created once `submitted_at` is set.
- The required denominator excludes `NOT_APPLICABLE` and never divides by zero.

## 2. `submission-workbench.tsx`

| Area | Before | After |
| --- | --- | --- |
| Readiness | none | **sticky strip**: overall badge, `n/m required items complete (p%)`, all six status counts, and a `Blocking submission (n)` list naming every item, its status and its one-sentence detail |
| Checklist | plain checkboxes | per-item status badge from the model, `· required` / `· optional`, the detail sentence, and a `Seed default checklist` action |
| Approvals | absent | **read-only mirror** of enabled layers with `Configure / decide on Response →`, an explicit "nothing on this page can approve a layer", and a disabled-layers line |
| Pricing / Response | absent | two mirror cards with status, detail and `Open pricing →` / `Open response →` |
| Outputs | `Download .doc` labelled as an export | six rows, each with what the file **actually is**: HTML for print-to-PDF (`the app does not render PDFs`), *Word-compatible HTML (.doc)* (`not a native DOCX/OOXML file and no DOCX writer exists in this codebase`), plain-text copy (`formatting is lost`), Google Docs (`there is no Google Docs integration: nothing is created, pushed, or synced`), and links to Pricing / Response. Empty drafts **disable** the export and say why. |
| Method fields | method + recipient | method (portal / email / physical / other), portal URL, recipient, submission deadline, question deadline, final output version, buyer instructions, Google Docs URL, notes |
| Mark submitted | a `submitted_at` field on the details form | its own section: gate banner, optional timestamp and confirmation, a **human authorization checkbox** (`I submitted this response to the buyer myself and I am recording it now.`), and a `Mark SUBMITTED` button disabled until the gate allows. The checkbox itself is disabled while anything blocks. |
| After submission | — | who submitted and when, a confirmation / reference form, and "the submission timestamp and the human who recorded it are kept as an audit fact and are not editable here" |

The strip, the gate banner and every badge read from the same `computeSubmissionReadiness` result, so
the counts, the blocking list and the button state cannot disagree.

## 3. `result-capture-panel.tsx`

- **Six outcome states** — `PENDING | WON | LOST | NO_BID | CANCELLED | NO_AWARD` — each with a
  meaning line (`PENDING`: *"Submitted and no result published yet. This is not a loss."*).
- **Two labelled field groups.** *Buyer-documented* (rank, winner, winning price, winning score,
  quoted evaluator comments, the reason the buyer documented) vs *Internal only — never sent to a
  buyer* (L&P price, L&P score, internal analysis, lessons learned). No numeric field defaults to
  `0`; an absent number stays absent.
- **Award evidence for handoff** — the HUMAN_VERIFIED facts on this pursuit's documents, each tagged
  `Award-shaped` or `Other`, with entity, field, value, filename, page, and a link to the
  verification page. Arlington shows `4 award-shaped / 19 verified`.
- **Contract handoff** — the gate message renders before the click, in the same words the action
  would throw, and the CTA is disabled when blocked.

## 4. Server actions

| Action | Change |
| --- | --- |
| `saveSubmissionPacket` | **Can no longer submit.** It writes logistics only — no `submitted_at`, no `submitted_by`, no stage change. |
| `markSubmissionSubmitted` (new) | Re-loads the checklist, the approval layers and the packet **server-side**, recomputes readiness, runs the same gate, and throws its message on failure. `submitted_by` is always the calling `userId`, never a form value. Then sets the stage to `SUBMITTED` and revalidates the pursuit, the tab and the Submitted list. |
| `saveSubmissionConfirmation` (new) | Post-submission confirmation / notes only; refuses if nothing is marked submitted. The timestamp and actor are not editable. |
| `createContractFromWin` | Idempotent open of an existing contract (two operators clicking get the same row). Loads the pursuit's documents and their HUMAN_VERIFIED facts, filters with `isAwardishFact`, reads the recorded outcome, and runs `evaluateContractHandoffGate`. **It no longer writes a `WON` outcome** — the outcome must already be WON, recorded by a human. Links an `awards` row from the same verified fact with `notice` only; `amount_nte`, `winner_name`, `rank` and `awarded_on` stay null. |

### An award fact is not a win

The Arlington award notice names **Securitas** (90.46 vs L&P's 82.39). A verified award-shaped fact
proves an award was *published*, not that L&P won it, so the handoff gate refuses an unrecorded
outcome with its own code (`OUTCOME_NOT_RECORDED`) and its own sentence: *"A verified award fact can
name any bidder, including a competitor, so record the outcome as WON above before creating a
contract."* Previously the action inferred `WON` from the click.

## 5. Migration `20260821200000_p8_submission_authorization.sql`

Additive: `submission_packets.submitted_by` (FK `auth.users`), `submission_url`,
`submission_instructions`, plus

```sql
constraint submission_packets_submitted_requires_actor
check (submitted_at is null or submitted_by is not null) not valid
```

`NOT VALID` because pre-P8 rows (including old acceptance-run rows) carry a timestamp with no actor.
The constraint is still **enforced on every insert and update**, so a submission can never again be
recorded anonymously. Applied to the live project and confirmed present with `convalidated = f`.

---

## Trust rules — preserved

| Rule | How P8 keeps it |
| --- | --- |
| No auto-submit | The only writer of `submitted_at` is `markSubmissionSubmitted`, which requires `submission_authorized=1` *and* a settled readiness. No timer, cron, workflow step or model call reaches it — asserted by the acceptance script against `actions.ts`. |
| No auto-sign | There is no signing code. Signature checklist items report `NEEDS_SIGNATURE` and say the platform does not sign. |
| No auto-approve | Approvals are mirrored read-only on Submission; the decision stays on Response. An enabled outstanding layer blocks marking submitted. |
| Pricing human final | Untouched. Pricing appears only as an advisory readiness item that links to the Pricing tab. |
| `createContractFromWin` verified-fact gate | Kept and now stated in words before the click, with the outcome requirement added. |
| `contracts_require_verified_fact` | Untouched, and still the backstop: the action supplies `source_fact_id` / `source_document_id` from the chosen verified fact. |
| Never invent | The Result panel repeats "never invent a score, price, rank, or loss reason", no numeric default is `0`, and the awards link carries no amount. |

---

## Tests

| Check | Result |
| --- | --- |
| `npm run test:p8-submission-result` (new, 44 checks) | **PASS 44/44** |
| `npm run test:phase8-response` | **PASS 30/30** |
| `npm run test:verify8` | **PASS 23/23 — verdict PASS** (was 21/23) |
| `npm run test:phase4-contracts` | **44/46** — two pre-existing failures, unrelated (see below) |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** — Submission and Result still emit as Partial Prerender |

`scripts/p8-submission-result-acceptance.mjs` bundles the real `submission-readiness.ts` and
`response.ts` with esbuild (already a dependency), exercises the model with no network and no
database, then greps the workbench, the result panel, both page loaders, `actions.ts`, the two
migrations and the two older acceptance scripts to assert the UI is wired to the model rather than
re-deciding rules locally. Coverage: the six statuses and which two are settled; no-checklist →
`UNKNOWN`; an incomplete required item cannot read complete; counts that add up; an empty denominator
that does not divide by zero; signature vs missing; a tick that cannot fake an approval; only enabled
layers becoming required; advisory pricing and response; unknown logistics; the confirmation gap only
after submission; every mark-submitted gate code including "a tick cannot buy past a blocker" and
"re-marking is refused"; the server recomputing readiness and demanding the authorization field; the
logistics save having no path to `submitted_at` or stage `SUBMITTED`; no model or scheduler on the
submission path; exactly one authorization control; honest output labels and the disabled-empty-export
path; the six outcome states with meanings; documented vs internal field separation; award-shaped fact
recognition; every contract gate code including `OUTCOME_NOT_RECORDED`; the action reading the
recorded outcome and never writing one; the awards link carrying no invented amount; and both older
scripts no longer inserting an unsourced contract.

### P0 fixed: the two older acceptance scripts

`verify8-proposal-workflow-acceptance.mjs` and `phase8-response-submission-acceptance.mjs` both did a
bare `contracts.insert`, which `contracts_require_verified_fact` has rejected since the trust
migration — that is why VERIFY8 sat at 21/23 with a stale committed PASS. Both now mirror
`createContractFromWin`: verify an award fact, **assert that the unsourced insert is refused**, then
insert citing that fact. VERIFY8 step 16 additionally asserts the new actor constraint by attempting
an anonymous `submitted_at` first and expecting
`violates check constraint "submission_packets_submitted_requires_actor"`. **VERIFY8 is 23/23 on
evidence, not by weakening a gate.**

### Pre-existing failures, not caused by P8

`test:phase4-contracts` fails two checks, neither in P8's diff (`git status` shows no change to
`scripts/phase4-contracts-acceptance.mjs`, `components/section-tabs.tsx`, or any migration other than
the additive P8 one):

1. **`[ui] ContractsNav Portfolio | Renewals | Compliance`** — the check greps
   `components/section-tabs.tsx` for a `ContractsNav` symbol that the shell no longer defines. Stale
   grep, not a missing route: all four contract routes exist and the other contract UI checks pass.
2. **`[commercial] award NTE stored for linked pursuit`** — the fixture inserts an `awards` row with
   no `source_fact_id`, which the trust migration
   (`20260821120000_trust_append_only_and_sourced_truth.sql`) correctly rejects. Same
   trigger-vs-stale-fixture drift already recorded for `verify7` / `phase7-pricing` in
   [P7 acceptance](P7_PRICING_WORKBENCH_ACCEPTANCE.md).

Both belong to the fixture-modernization task already in `WORK_TRAIL`.

---

## Browser verification (IronBee DevTools, `localhost:3000`, live operator org)

**PKG-03 Arlington TX** (`b937b54c-70d5-468e-97cf-803d2a69e5a9`) — 2 verified documents, 12
requirements, 8 promoted pricing lines, no approval layer enabled, no outcome recorded.

### Submission, with no checklist

- Strip: `Readiness unknown — no checklist` · `0/1 required items complete (0%)` ·
  `Missing 1 · Unknown 4`, and `Blocking submission (1): Submission checklist — Unknown. No
  submission checklist exists on this pursuit.`
- Gate banner: *"No submission checklist exists on this pursuit. Seed the checklist and work it
  before recording a submission."*
- **The authorization checkbox and `Mark SUBMITTED` were both `disabled` in the DOM** (read back via
  the page, not inferred from the screenshot).
- Outputs read exactly as designed: the `.doc` row states *"not a native DOCX/OOXML file and no DOCX
  writer exists in this codebase"*, the Google Docs row states *"there is no Google Docs
  integration"*, and all three exports were disabled with *"the export would be an empty file."*

### Submission, after seeding the checklist

`Not ready to submit` · `0/11 required items complete (0%)` · `Missing 9 · Needs signature 2 ·
Needs approval 1 · Unknown 3`, with all 11 named in the blocking list — signatures and notarization
as *Needs signature*, and `Internal approvals — Needs approval. Not ticked, and no approval layer is
enabled to prove an approval happened.` The gate banner listed the 10 document items and added
*"Also outstanding: 1 approval item(s), decided by a human on the Response tab."* so the banner total
matches the list.

### Result

- Six outcome options with meanings, the two labelled field groups, and
  `Award evidence for handoff (4 award-shaped / 19 verified)` — the `award / Minute Order` and
  `award / awarded to` facts tagged `Award-shaped`, the seven competitor `evaluation_score` facts
  tagged `Other`.
- Contract handoff: *"No outcome is recorded for this pursuit. A verified award fact can name any
  bidder, including a competitor, so record the outcome as WON above before creating a contract."*
  with `Create contract from win` **disabled**. On this pursuit that is the correct answer — the
  award went to Securitas.

### Writes

The only write was `ensureSubmissionChecklist` (11 rows), which is the product's own seeding action.
It was **deleted afterwards** and the pursuit re-verified at `chk 0 · pkt 0 · wl 0 · ct 0`. No
submission was recorded, no outcome was written, no contract or award row was created.

---

## External references consulted

| Reference | License (verified 2026-08-21) | Outcome |
| --- | --- | --- |
| [Documenso (app)](../reference-ux/documenso.md) | **AGPL-3.0** | UX reference only, from public docs. Adapted: explicit state transitions (nothing auto-completes when the checklist goes green), a required-action checklist whose progress is a count of required items rather than a score, and a post-complete freeze (timestamp + actor not editable). Declined: e-sign, recipient portal, certificate sealing. No source read or copied. |
| [Wraft](../reference-repos/wraft.md) | see note | Document-generation pipeline reviewed for the Outputs section. Confirmed our honest position: no DOCX writer, so no DOCX claim. Nothing adopted. |
| [RFPilot](../reference-repos/rfpilot.md) | see note | Re-read for submission-packet shape and outcome capture. Reinforced the separation of buyer-documented fields from internal analysis. Nothing adopted. |

Three references, at the per-task limit.

---

## Honest limitations

- **"Mark submitted" is a record, not a submission.** Nothing uploads to a portal, sends an email or
  produces a delivery receipt. The operator submits; the platform records that they did.
- **The `.doc` export is HTML in a `.doc` wrapper.** Word and Google Docs open it; it is not OOXML.
  A real DOCX writer is a separate decision with a dependency attached.
- **There is no Google Docs integration.** The field stores a URL an operator pasted. Nothing is
  created, pushed or synced, and the button is disabled until a URL exists.
- **The submitted-actor constraint is `NOT VALID`.** Pre-P8 rows with an anonymous `submitted_at`
  still exist and are not retro-attributed. New and updated rows are enforced.
- **`submitted_at` is operator-supplied.** A human may back-date the record; the row keeps who
  recorded it and when the row changed, which is attribution, not proof of the buyer's receipt time.
  The buyer confirmation / reference field is the closest thing to proof and is optional at mark time.
- **The approval mirror is only as strong as the layer configuration.** With no layer enabled, the
  "Internal approvals" checklist item can be ticked as an attestation. The detail sentence says so,
  but it is a claim, not a recorded approval.
- **Readiness cannot see an unlisted requirement.** It measures the seeded checklist, the enabled
  layers, the promoted requirements and the packet fields. A buyer form nobody added to the checklist
  is invisible to it — `NO_CHECKLIST` and `UNKNOWN` exist so that invisibility never reads as ready.
- **Award-shaped is keyword matching.** `AWARDISH_FACT_RE` matches field and entity text; a fact
  about a "contract manager" reads as award-shaped, and an award fact worded unusually may not. It
  gates *which fact may be cited*; the human WON outcome and the DB trigger are the real gates.
- **The awards row carries only a notice string.** No amount, winner, rank or award date is written
  from a win click, so the linked award is a pointer to the verified fact, not a commercial record.
- **Result-panel evidence is capped** at the 40 most recently verified facts per pursuit, newest
  first.
