# Phase 8 acceptance — Response / Submission / Result

**Canonical product Phase 8** (central proposal workflow inside Pursuit).

## Central flow

**Pursuit → Requirements → Pricing → Response → Submission → Result**

No separate global Proposal application.

## What landed

### Requirements
- Verified requirement matrix with source, page/section, mandatory/scored, weight, response/form/attachment flags, owner, status, verification note, evidence (`FactRef`)

### Response (`Pursuit → Response`)
- Desktop workspace: left requirement nav · center Tiptap editor · right resizable context (source req, historical content, buyer, competitors, win/loss, sources, missing L&P facts, GPT actions, configurable approvals)
- Evidence classification: `VERIFIED_DRAFT_AVAILABLE` | `REVIEW_REQUIRED` | `L_AND_P_INPUT_REQUIRED`
- Reuse gates: `APPROVED` | `REVIEW_REQUIRED` | `DO_NOT_USE` | `SUPERSEDED` — DO_NOT_USE never enters `PROPOSAL_DRAFTING`
- Grounded GPT draft returns draft/sources/assumptions/missing/confidence; never invents L&P pricing/staffing/certs/etc.
- Progress: Total · Verified · Drafted · Approved · L&P Input Required · Mandatory Outstanding · Required Attachments Missing

### Approvals
- Configurable layers: content · operations · pricing · compliance · executive (enable per pursuit; status requested/approved/changes_requested/rejected)

### Submission
- Packet: due/question deadlines, method, portal/recipient, version, Google Docs URL, submitted_at, confirmation #
- Checklist: forms, pricing schedules, references, insurance, certifications, affidavits, signatures, notarization, addenda, attachments, approvals
- Outputs: HTML/print, DOCX-compatible download, copy/paste, pricing workbook link, Response fields, Google Docs link

### Result
- Outcomes: Pending · Won · Lost/Not Selected · No Bid · Cancelled · No Award
- Captures winner, L&P/winning price & scores, rank, evaluator comments, documented reason, internal lessons
- Create/link Contract on win; revalidates Intelligence surfaces

Migration: `supabase/migrations/20260820920000_phase8_response_submission_result.sql`

## Checks

```bash
node --env-file=apps/web/.env.local scripts/apply-phase8-response-migration.mjs
npm run test:phase8-response
npm run lint
npm run typecheck
npm run build
```

## VERIFY 8

**PASS** — [VERIFY8_ACCEPTANCE.md](pilot/VERIFY8_ACCEPTANCE.md) (`npm run test:verify8` 23/23).

## Honesty rules

- AI never invents L&P facts listed in `NEVER_INVENT_LP_FACTS`
- Unsupported → `L_AND_P_INPUT_REQUIRED`
- Human approves response content and enabled approval layers
- Won ≠ automatically reusable; Lost ≠ automatically worthless
