# Build plan — product execution order

Synced August 2026 from the Canonical Product Pack.  
**Authoritative blueprint:** [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md).  
**Detailed phase plan:** [FULL_PHASE_BUILD_PLAN.md](FULL_PHASE_BUILD_PLAN.md).  
**Current maturity:** [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).  
**UX:** [UX_UI.md](UX_UI.md).  
**Pilot:** [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md).

Authoritative product flow:

```text
Historical Evidence → Pursuit → Requirements → Pricing → Response → Submission → Result
→ Award/Contract → Changes → Renewal/Rebid → Intelligence improves
```

Proposal work is central. Government/security procurement is a primary domain. Ask GPT, reports, and automation are first-class business outcomes built on verified data.

Canonical IA (do not invent peer globals): **Home | Pursuits | Intelligence | Contracts | Data Ops.** Settings separated. Find or Ask GPT in header. Pursuit tabs: Overview | Requirements | Pricing | Response | Submission | Result. See [UX_UI.md](UX_UI.md).

Legacy engineering IDs on migrations/`PHASE*_ACCEPTANCE.md` may remain. They do **not** redefine product phase completion. See [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md).

---

## Canonical product phases

### Phase 1 — Foundation

**Purpose:** secure, auditable system foundation.  
**Deliverables:** app shell and final IA foundation; Auth/organizations/memberships/RLS; canonical evidence Storage; document registry/version/checksum; staging/provenance/verification/audit; Workflow/processor interfaces; shared schemas; PDF/source review foundation.  
**Exit gate:** Tenant isolation + evidence handling + unverified staging + build/test baseline are proven.

**Honest status:** **Local exit gate proven (2026-08-20).** `npm run test:foundation` + lint/typecheck/build green. Production env, signed-in org, and opportunity migrations remain **ops blockers for using the app**, not missing Foundation tables. Do not rebuild working tenancy/evidence code.

### Phase 2 — Real-Document Historical Pilot

**Purpose:** validate product assumptions on real procurement packages.  
**Deliverables:** ~20–30 materially different packages/doc sets; public L&P records first; real L&P proposal/contract/PO/evaluation evidence wherever obtainable; non-L&P security docs only as **test corpus** for missing document types; `PILOT_GAP_REPORT`; parser/extractor/UX/schema recommendations.  
**Exit gate:** Representative real packages successfully complete source-to-canonical review and the gap report is actionable.

**Honest status:** **IN PROGRESS — VERIFY 2B PASS WITH NONBLOCKING GAPS.** 7 A/B packages source-to-canonical with page provenance. Deferred: SRC-03 25 MB, SRC-19 OCR, ~20–30 package exit count. Gap report: [benchmarks/PILOT_GAP_REPORT.md](benchmarks/PILOT_GAP_REPORT.md). Acceptance: [pilot/VERIFY2B_ACCEPTANCE.md](pilot/VERIFY2B_ACCEPTANCE.md).

### Phase 3 — Historical Ingestion & Migration

**Purpose:** productionize the validated trust pipeline and grow the corpus.  
**Deliverables:** parser/OCR routing; DOCX/PDF/XLSX/scan support as proven; package/version/dedupe; validation/reconciliation; Data Ops production UX; controlled batch migration; eligible verified search chunks/embeddings.  
**Exit gate:** Reliable repeatable ingestion at real corpus scale without bypassing verification.

**Honest status:** **PASS (2026-08-20).** Data Ops production path proven (`npm run test:phase3`). DOCX wired; openpyxl XLSX; OCR adapter key-gated; package grouping; resizable verification; bulk never bypasses human verify. Deferred: live OCR without `MISTRAL_API_KEY`; corpus scale growth.

### Phase 4 — Contract & Compliance Intelligence

**Purpose:** manage awarded work, service obligations, commercial terms, changes, expiration, and rebid.  
**Deliverables:** contract portfolio; Contract workspace Overview | Service Plan | Commercial Terms | Changes | Renewal; company compliance view; verified 180/120/90/60/30/expired checks; award/pursuit-to-contract linkage.  
**Exit gate:** Users can tell what L&P must deliver, what current commercial terms are, what changed, and what needs action before renewal/rebid.

**Honest status:** Workspace + portfolio + company compliance wired to verified tables ([PHASE4_ACCEPTANCE.md](PHASE4_ACCEPTANCE.md)). Still thin against a large real awarded-instrument corpus — absent terms stay blank.

### Phase 5 — Buyer / Competitor / Market / Win-Loss Intelligence

**Purpose:** make historical outcomes and public procurement evidence strategically usable.  
**Deliverables:** Buyer / Competitor / Market / Win-Loss; sourced public research; verified metrics and comparisons; report-ready structured facts.  
**Exit gate:** Cross-corpus intelligence is computed from canonical verified records and cites its sources.

**Honest status:** **PASS (2026-08-20 Prompt 5).** Buyers/Competitors/Market/Pricing/Win-Loss/Content/Reports wired to verified corpus; Pursuit Overview intelligence summary; reuse `REVIEW_REQUIRED`; `lessons_learned`. [PHASE5_INTELLIGENCE_ACCEPTANCE.md](PHASE5_INTELLIGENCE_ACCEPTANCE.md). Still corpus-thin — no document-count market share; no invented causation.

### Phase 6 — Search / Ask GPT / Reports / Automation

**Purpose:** turn the verified corpus into a grounded analyst and proactive operating layer.  
**Deliverables:** LOCATE; ASK/ANALYZE; hybrid structured + FTS + pgvector; purpose-aware filtering; evidence-backed GPT; Bid Strategy / Buyer / Market / Competitor / Pricing / Win/Loss / Proposal Improvement / Executive reports; bounded automation.  
**Exit gate:** AI responses/reports are source-backed, scoped, permission-safe, and explicit about insufficiency. Automation respects human approval gates.

**Honest status:** **PASS (2026-08-20 Prompt 6).** Header Find/Ask; LOCATE/ASK/REPORT modes; purpose-aware retrieval (DO_NOT_USE blocked for drafting); eight reports; pg_cron + Vercel digest; [PHASE6_ASK_REPORTS_AUTOMATION_ACCEPTANCE.md](PHASE6_ASK_REPORTS_AUTOMATION_ACCEPTANCE.md). ASK LLM synthesis needs Gateway/`ASK_MODEL` when configured — otherwise evidence-only.

### Phase 7 — Pricing Intelligence

**Purpose:** support better human pricing decisions using verified evidence.  
**Deliverables:** pursuit-specific Glide workbench; requested vs cost vs submitted vs awarded vs current; dynamic pricing structures; wage/labor/cost model; comparable evidence; include/exclude rationale; decision-support range/statistics; human final price.  
**Exit gate:** Pricing is explainable, sourced, and human-approved.

**Honest status:** **PASS (2026-08-20 Prompt 7).** Pursuit Glide five-truth workbench; cost model + comps with include/exclude; human final bid gate; Intelligence cross-corpus pricing. [PHASE7_PRICING_ACCEPTANCE.md](PHASE7_PRICING_ACCEPTANCE.md). Still corpus-thin for rich comps.

### Phase 8 — Response Builder / Submission / Result

**Purpose:** build winning, evidence-grounded proposals as the central pre-award production workflow.  
**Deliverables:** Pursuit flow Overview → Requirements → Pricing → Response → Submission → Result; Tiptap requirement-driven editor; three evidence states; reuse controls; grounded GPT; proposal progress; Google Docs working proposal; PDF/DOCX/portal/pricing outputs; submission checklist; result/evaluation capture; contract link on win; feedback to corpus.  
**Exit gate:** A real solicitation can be analyzed, priced, drafted, approved, submitted, resulted, and learned from end to end without fabricated data.

**Honest status:** **PASS (2026-08-20 Prompt 8).** Pursuit Requirements matrix; Tiptap Response workspace (evidence states + reuse gates); configurable approvals; submission packet/checklist/exports; result capture + contract-on-win. [PHASE8_RESPONSE_ACCEPTANCE.md](PHASE8_RESPONSE_ACCEPTANCE.md). Still corpus-thin.

### Optional future commercialization — not part of core product build

Only if L&P later chooses to sell the platform to other contracting companies: tenant admin · usage/seat controls · Stripe · commercial onboarding · optional MCP/agent integrations. Preserve the same procurement model and trust rules. **Not required to call the operational platform complete after Phase 8.**

---

## Execution discipline

- One phase/slice at a time.  
- Test → fix → document → commit → next.  
- Do not call a later phase complete because early code exists.  
- Do not expand AI/proposal/pricing as “complete” before the real-document pilot proves the data foundation.  
- Keep current working code where useful, but reconcile it to the **canonical UX** rather than preserving obsolete navigation.  

## Current correct next work

1. Treat this canonical pack as product truth (this sync).  
2. Reconcile app IA to final UX ([UX_UI.md](UX_UI.md)).  
3. Finish environment/migration prerequisites needed to run real documents.  
4. Execute the real-document Historical Pilot using verified public L&P packages first.  
5. Let the pilot prove schema/parser/UX gaps before expanding later features.  

Cursor slices: [CURSOR_PROMPTS.md](CURSOR_PROMPTS.md).

---

## Legacy engineering checklist

Older detailed engineering checklists (legacy Phase 0–14 acceptance scripts, migration filenames) remain useful for implementation tasks. Prefer **canonical product phases** above for product maturity claims. Do not rename migration IDs. RLS 48/48 proves Foundation tenancy only — **not** Phase 2.
