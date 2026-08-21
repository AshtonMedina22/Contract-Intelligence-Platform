Yes. The UI should be organized around workflows, not around your database tables.
The mistake in the earlier layouts was treating Requirements, Documents, Pricing, Clients, Win/Loss, Verification, etc. like they all deserve global navigation. They don't. Most of those belong inside the thing the user is working on.
Your blueprint already says the product revolves around pursuits, historical evidence, contracts, intelligence, and verification—not raw tables.
Final global navigation
I would use five actual work areas, plus Settings:
L&P / Company ▼

HOME

PURSUITS

INTELLIGENCE

CONTRACTS

DATA OPS

────────────────

SETTINGS
That's it.
Ask Intelligence should NOT be buried in the sidebar. It should live persistently in the header as the system-wide GPT/search interface.

1. HOME
Purpose
What needs my attention right now?
Not a giant analytics dashboard.
Home combines work across the platform:
┌─────────────────────────────────────────────────────────────────┐
│ Good morning                     [ Find or ask anything... ]    │
├─────────────────────────────────────────────────────────────────┤
│ 8 Active Pursuits   3 Due Soon   6 Input Needed   4 Renewals    │
│                                                                 │
│ MY WORK                                                         │
│ Dallas ISD       Pricing required                 Due Sep 18    │
│ Arlington RFP    4 requirements need review       Due Sep 21    │
│                                                                 │
│ NEEDS ATTENTION                                                 │
│ 42 extracted facts awaiting verification                       │
│ 3 mandatory requirements unanswered                            │
│ 2 contracts inside 90-day renewal window                       │
│                                                                 │
│ RECENT                                                          │
│ Williamson proposal verified                                   │
│ Dallas ISD RFP analyzed                                        │
└─────────────────────────────────────────────────────────────────┘
Shadcn
Use:
Card for 4–6 actionable metrics
Table / TanStack for My Work
Badge for statuses
Progress where completion matters
Alert for critical items
No chart unless there is genuinely useful trend data.

2. PURSUITS
This is the main operational area.
Pursuits contains:
RFPs
RFQs
IFBs
bids
proposals in progress
submitted bids
pending awards
won/lost history
The global Pursuits page
One table:
PURSUITS                                      [+ New Solicitation]

[ Active ] [ Submitted ] [ Won ] [ Lost ] [ No Bid ] [ All ]

Buyer        Solicitation     Due       Stage          Completion
Dallas ISD   RFP-2026-318     Sep 18    Pricing        74%
Fort Worth   IFB-26-140       Sep 25    Requirements   41%
Arlington    RFP 22-0143      Closed    Lost           —
This replaces separate global nav items for:
Opportunities
Requirements
RFP Intake
Proposals
Buyer history
Pricing for a specific bid
Those are parts of a pursuit.

3. PURSUIT WORKSPACE
Click Dallas ISD.
Now the user enters the workspace.
This is where tabs belong:
Dallas ISD — Armed Security Services
RFP-2026-318                    Due Sep 18 • PREPARING

[ Overview ]
[ Requirements ]
[ Intelligence ]
[ Pricing ]
[ Proposal ]
[ Compliance ]
[ Submission ]
[ Outcome ]
Not 15 sidebar items.
Overview
One-screen summary:
RFP SUMMARY

Due date            Sep 18, 2:00 PM
Buyer               Dallas ISD
Contract             3 years + 2 options
Requirements         84
Proposal completion  71%
Mandatory missing    3
L&P input required   7
Pricing              Needs approval

NEXT ACTIONS
• Confirm staffing capacity
• Complete pricing
• Upload current COI
• Review transition response
Documents are shown contextually here.

Requirements
The RFP requirement matrix.
Use TanStack Table, not cards.
Requirement             Type       Weight   Owner    Status       Source
Transition Plan          Scored     20       Amy      Drafted      p.42
3 Gov References         Mandatory  —        Amy      Missing      p.18
Umbrella Insurance       Mandatory  —        Ops      Verified     p.27
Armed Guard Pricing      Pricing    25       Finance  In Progress  App C
Click a row → right-side Sheet:
REQUIREMENT DETAILS

Exact source text
Normalized interpretation
Page / section
Evaluation weight
Required attachment
Response
Evidence
Verification history

[View Source PDF]
The requirement itself does not need another page.

Intelligence
Everything relevant to this specific pursuit:
INTELLIGENCE

[ Bid Strategy ]
[ Buyer History ]
[ Win/Loss ]
[ Competitors ]
[ Research ]
Bid Strategy
This is the synthesized strategy.
Buyer History
Prior bids, awards, incumbent, evaluation history.
Win/Loss
Relevant prior L&P results.
Competitors
Who has bid similar work.
Research
Actual sourced public procurement intelligence.
Those are local tabs, not sidebar routes.

Pricing
This is pursuit pricing.
Use Glide Data Grid.
CLIENT REQUIRED PRICING

Labor Category      Base Yr    Option 1    Option 2    OT      Holiday
Armed Officer
Supervisor
Mobile Patrol
Below/context panel:
EVIDENCE

L&P Wins
L&P Losses
Same Buyer
Competitor Awards
Wage Data
Internal Cost

Observed range      $—
Cost floor          $—
Target threshold    $—

[Show Evidence]

FINAL BID
$ __________
HUMAN APPROVAL REQUIRED
Do not make users leave the pursuit and go to a random global Pricing page to price the pursuit.

4. PROPOSAL IS INSIDE THE PURSUIT
This is especially important.
Proposal should not be its own global app section.
The proposal exists because the pursuit exists.
Use Shadcn Resizable + Tiptap:
┌──────────────────────────────┬─────────────────────────────────┐
│ REQUIREMENTS                 │ RESPONSE EDITOR                 │
│                              │                                 │
│ ✓ Company Overview           │ [Tiptap editor]                 │
│ ✓ Training                   │                                 │
│ ● Staffing Continuity        │ GPT draft...                    │
│ ○ Transition                 │                                 │
│ ⚠ References                 │                                 │
│                              │                                 │
├──────────────────────────────┼─────────────────────────────────┤
│ Requirement Intelligence     │ Sources                         │
│ 15 points                    │ ✓ Approved prior response       │
│ Prior buyer weakness         │ ✓ Current policy               │
│                              │ ⚠ Prior lost proposal           │
└──────────────────────────────┴─────────────────────────────────┘
Actions:
[Generate]
[Improve]
[Compare]
[Edit]
[Approve]
[View Evidence]
At the top:
84 Requirements
72 Verified
51 Drafted
38 Approved
7 Input Required
3 Mandatory Outstanding
That directly preserves your original proposal-progress requirement.

5. INTELLIGENCE
This is cross-company / cross-corpus intelligence, not a place for working an individual RFP.
Global Intelligence should open into:
INTELLIGENCE

[ Overview ]
[ Buyers ]
[ Competitors ]
[ Market ]
[ Pricing ]
[ Win/Loss ]
[ Content ]
[ Reports ]
These are tabs/subnavigation inside Intelligence, not eight sidebar items.
Example
You want:
How often does Allied Universal appear in Texas school bids?
That's Intelligence → Competitors.
You want:
What should we price Dallas ISD?
That's Dallas ISD Pursuit → Pricing.
Same data domain. Different workflow.
That distinction is important.

6. ASK INTELLIGENCE / GPT
Don't make this a sidebar destination users have to hunt for.
Put this in the global header:
┌────────────────────────────────────────────────────┐
│ 🔍 Find or ask anything...                         │
└────────────────────────────────────────────────────┘
Clicking it opens a large command/assistant interface:
Ask Intelligence

What do you want to know?

> Why did we lose Arlington?

> Find Williamson's current contract.

> Compare awarded armed-guard rates for Texas ISDs.

> Which Dallas requirements still need responses?

> Generate a buyer intelligence brief.
It intelligently routes:
Find Williamson contract
        ↓
LOCATE

Why did Arlington lose?
        ↓
ASK / ANALYZE

Create Dallas bid strategy
        ↓
REPORT / ANALYZE
Use Shadcn:
Command
Dialog
or full-width search experience
Sheet for sources
table/chart components inside the response where useful
The blueprint already defines Ask as a cross-platform layer rather than the product architecture itself.

7. CONTRACTS
Contracts do deserve global navigation because they are a separate lifecycle after pursuit.
Main page:
CONTRACTS

[ Active ] [ Renewal Planning ] [ Expiring ] [ Rebid ] [ Closed ]

Buyer          Contract      Value    Expiration    Action
Williamson     202569        $—       Aug 2027      Active
Allen ISD      ...           $—       Aug 2027      Review
Click a contract:
Williamson County — Contract 202569

[ Overview ]
[ Terms & Rates ]
[ Sites & Services ]
[ Amendments ]
[ Options / Renewal ]
[ Compliance ]
[ Documents ]
Again: tabs inside one contract workspace.
Do not make Amendments, Sites, Rates, Options, Documents global navigation.

8. DATA OPS
This is where all the ugly backend-ish operational stuff belongs.
Most normal proposal users may barely enter here.
DATA OPS

[ Intake ]
[ Processing ]
[ Verification ]
[ Exceptions ]
[ Historical Migration ]
Intake
Upload/import documents.
Processing
What's parsing/extracting/failing.
Verification
Human verification workbench.
Exceptions
Conflicts/unresolved source problems.
Historical Migration
Batch progress across historical corpus.
That collapses five random sidebar destinations into one coherent workflow:
INTAKE
  ↓
PROCESS
  ↓
VERIFY
  ↓
RESOLVE EXCEPTIONS
  ↓
CANONICAL DATA
That's exactly what the product architecture says should happen.

9. VERIFICATION UI
This should be a specialized full-width workspace, not another standard table page.
┌────────────────────────────────┬────────────────────────────────┐
│ SOURCE PDF                     │ EXTRACTED FACTS                │
│                                │                                │
│ Page 17                        │ Buyer: Dallas ISD       ✓      │
│                                │ Due: 9/18/26            ✓      │
│ [highlighted source]           │ Option years: 2         ?      │
│                                │ Price weight: 25%       ⚠      │
│                                │                                │
│                                │ [Verify] [Edit] [Reject]       │
└────────────────────────────────┴────────────────────────────────┘
Use:
Shadcn Resizable
PDF.js
TanStack list/table
Badge
Keyboard controls
Sheet only when supplemental details are needed
This should optimize for speed of verification, not aesthetics.

10. SETTINGS
Settings actually belongs in global navigation/footer.
Inside:
SETTINGS

Organization
Members & Roles
AI / Models
Integrations
Document Processing
Taxonomies
Notifications
Billing        ← future
Audit / Security
Don't put Data Model in the normal employee navigation.
That's an admin/developer concern, not a business workflow.

The final sidebar
So instead of this:
Home
Intake
Processing
Verification
Exceptions
Bulk Migration
Documents
Opportunities
Clients
Requirements
Contracts
Renewals
Compliance
Ask
Market
Pricing
Win/Loss
Content
Reports
Proposals
Data Model
Data Quality
Settings
which is way too much...
Use this:
┌──────────────────────┐
│ Company ▼            │
│                      │
│ 🏠 Home              │
│                      │
│ 🎯 Pursuits          │
│                      │
│ ◈ Intelligence       │
│                      │
│ 📑 Contracts         │
│                      │
│ ⚙ Data Ops           │
│                      │
│ ──────────────────── │
│ ⚙ Settings           │
└──────────────────────┘
And header:
[ breadcrumbs ]              [ 🔍 Find or ask anything... ] [ + New ] [ User ]
+ New dropdown:
New Solicitation
Import Historical Package
Add Contract
Add Public Research

Shadcn component rules for your platform
Component
Use
Sidebar
ONLY the 5 major product work areas
Tabs
Context inside a Pursuit, Contract, Intelligence, Data Ops
TanStack Table + shadcn Table
lists, requirements, bids, contracts, sources
Sheet
evidence, source details, row details without losing context
Dialog
focused create/edit/approve actions
AlertDialog
destructive or consequential decisions
Resizable
verification + proposal drafting
Command
global Find / Ask / quick navigation
Badge
statuses, never giant cards
Progress
proposal/verification completeness
Accordion/Collapsible
detailed secondary information
Card
KPI summaries only
Glide Data Grid
serious pricing/spreadsheet work
PDF.js
evidence/source review
Tiptap
proposal content editing
Charts
analytics only when real data justifies them


The UX rule Cursor should follow
This is the rule I would put directly into your product spec:
Global navigation represents major jobs. Tabs represent stages or perspectives within that job. Tables represent collections of records. Sheets/drawers represent record detail. Dialogs represent actions. Database tables never determine navigation.
And:
A user working a pursuit should be able to go from RFP → requirements → intelligence → pricing → proposal → compliance → submission without leaving that pursuit workspace.
That's the UX architecture I would lock. It solves the exact problem you're pointing out.

