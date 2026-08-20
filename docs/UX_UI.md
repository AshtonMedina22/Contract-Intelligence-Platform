# Canonical UX / UI architecture

Source: approved Canonical Product Pack (Prompt 0A).  
Business authority: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md).

## Canonical IA (lock)

**Global sidebar:** Home | Pursuits | Intelligence | Contracts | Data Ops  
**Settings:** separated at bottom/admin.  
**Header:** Breadcrumbs | Find or Ask GPT… | + New | User  

**Pursuit:** Overview | Requirements | Pricing | Response | Submission | Result  

**Contract:** Overview | Service Plan | Commercial Terms | Changes | Renewal  

**Intelligence:** Buyers | Competitors | Market | Pricing | Win/Loss | Content | Reports  

**Data Ops:** Intake | Processing | Verification | Exceptions | Historical Migration  

Primary operational flow: Pursuit → Requirements → Pricing → Response → Submission → Result → Award/Contract → Changes → Renewal/Rebid → verified result improves future bids.

## Design principle

The product is a **procurement/proposal operating system**, not a collection of database pages. Navigation represents major jobs. Contextual work remains inside the thing the user is working on.

## Global sidebar

- Home  
- Pursuits  
- Intelligence  
- Contracts  
- Data Ops  

Settings is separated at the bottom/admin area.

## Global header

Breadcrumbs | Find or Ask GPT… | + New | User

Ask GPT is **not** a normal sidebar destination. It is a persistent cross-platform capability.

**+ New** may expose: New Solicitation · Import Historical Package · Add Existing Contract · Add Research Source

## Home — action center

Question: What needs attention right now?

Surface: pursuits due soon; mandatory requirements outstanding; L&P Input Required; pricing awaiting human decision; response approvals; submission items missing; contracts entering renewal/rebid windows; compliance expirations; verification backlog; failed processing/exceptions; recent work.

Use cards only for actionable summaries. Use tables for work queues. Do not fabricate charts/KPIs to fill space.

## Pursuits — central pre-award work area

Global Pursuits page = one searchable/filterable TanStack table of active and historical pursuits.

Typical statuses may include New/Reviewing, Requirements, Pricing, Response, Approval, Submitted, Pending Result, Won, Lost, No Bid, Cancelled, No Award. Exact status model should be validated against real workflow.

### Open Pursuit workspace — canonical tabs

1. Overview  
2. Requirements  
3. Pricing  
4. Response  
5. Submission  
6. Result  

Core flow: **Pursuit → Requirements → Pricing → Response → Submission → Result.**

### Pursuit Overview

Buyer/agency; solicitation/title/type; key deadlines; contract term/options; scope/service summary; sites/posts/staffing summary; evaluation criteria/weights; buyer/L&P history; competitor observations; Bid Strategy; compliance readiness; pricing status; response progress; next actions/risks; source links.

### Pursuit Requirements

TanStack Table as dense requirement matrix. Selecting a row opens Sheet/Drawer with exact text, source, verification, response status, View Source.

### Pursuit Pricing

Glide Data Grid for the real pricing workbench. Visually distinct: Buyer Requested | Internal Cost | Submitted | Awarded | Current/Amended. Human-entered/approved final bid price remains explicit.

### Pursuit Response

LEFT: requirement/section navigation and status. CENTER: Tiptap. RIGHT/lower Resizable: source requirement, approved historical content, prior outcomes/evaluator intelligence, sources, missing L&P information, GPT controls.

Evidence state: `VERIFIED_DRAFT_AVAILABLE` | `REVIEW_REQUIRED` | `L&P_INPUT_REQUIRED`.

### Pursuit Submission

Checklist/table for narrative sections, pricing forms, addendum acknowledgement, references, insurance/certifications, affidavits, signatures/notarization, attachments, approvals, output version, portal/email method, submission timestamp/confirmation.

### Pursuit Result

pending/won/lost/no-bid/cancelled/no-award; winner; L&P price; award price; scores/rank/category scores; evaluator feedback; documented reason; internal analysis/lessons; award/contract link.

## Intelligence — cross-corpus analysis

One global Intelligence area with secondary views: Buyers · Competitors · Market · Pricing · Win/Loss · Content · Reports.

These are **not** peer global sidebar modules.

## Contracts — post-award work area

Global Contracts = portfolio table.

Open Contract tabs: Overview | Service Plan | Commercial Terms | Changes | Renewal

Service Plan is security-operations oriented (sites/posts/staffing/schedules/substitutes/training/equipment/guard classifications/operational obligations).

## Data Ops — trusted data workflow

Secondary views: Intake · Processing · Verification · Exceptions · Historical Migration

Verification = specialized full-width Resizable source-vs-fact workspace (PDF.js/react-pdf + TanStack).

## Settings

Organization · members/roles · integrations · AI/model/provider configuration · taxonomies · notifications · security/audit · future billing.

## Component rules

- Sidebar: only major jobs  
- Tabs/secondary nav: views inside a workspace  
- TanStack Table: collections, requirement matrices, portfolios, queues  
- Sheet/Drawer: row detail, evidence, source context  
- Dialog: create/edit/approve  
- AlertDialog: destructive/consequential  
- Resizable: verification and Response authoring  
- Command/global search: Find or Ask GPT  
- Badge: state/outcome/verification/reuse  
- Progress: response/completion/verification  
- Glide Data Grid: pricing only where spreadsheet behavior is needed  
- PDF.js/react-pdf: source evidence  
- Tiptap: response editing  
- Charts: only evidence-backed comparisons/trends  

## Responsive behavior

Desktop-first. Tablet/mobile support read/review/approve/alerts without destroying desktop efficiency for pricing or source verification.

## UX lock

Sidebar = major jobs. Workspace tabs = flow inside the job. Tables = collections. Sheets/drawers = details/evidence. Dialogs = actions. Database tables/backend stages do **not** become navigation. **Proposal work is central.**

## Code reconciliation note

Current app navigation and pursuit tabs still reflect an earlier prototype IA. Treat that as **IMPLEMENTED, UNVALIDATED / to reconcile**, not as canonical product UX.
