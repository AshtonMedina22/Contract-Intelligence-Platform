Yes. Market analysis, competitor intelligence, contract-expiration/recompete tracking, win/loss analytics, buyer intelligence, pricing intelligence, content intelligence, and executive metrics all need real UI homes. My previous “one generic Intelligence page” simplification was wrong because those are recurring human analysis jobs, not backend steps.
I ignored the UI section of the original build spec as you instructed and rebuilt the IA from the capabilities themselves.
Your spec explicitly requires market analysis across service, geography, buyer type, contract size, award values, rates, competitor presence, win/loss outcomes, scoring patterns and rebid activity. It separately requires buyer profiles with solicitations, incumbents, awards, budgets, procurement plans, current contracts, expirations, options and rebid timing. And contracts must track expirations/options/rebids with 180/120/90/60/30-day alerts.
So this is the structure I would actually lock.
Final global UI
L&P GLOBAL SECURITY

HOME

PURSUITS

INTELLIGENCE

CONTRACTS

─────────────────
DATA MANAGEMENT      ← admin/ops role only
SETTINGS             ← bottom/admin
Header:
[Breadcrumbs]     [ Search / Ask Intelligence... ]     [+ New]     [Notifications] [User]
Only four major business areas in the primary sidebar.
But those areas absolutely have real internal navigation because Market Analysis, Competitor Intelligence, etc. are actual jobs.

1. HOME = executive dashboard + what needs attention
This is not just a landing page.
There should be two purposes on the same Home:
HOME

EXECUTIVE SNAPSHOT
─────────────────────────────────────────────

Active Pursuits      Pipeline Value       Win Rate
12                   $4.8M                41%

Awarded YTD          Active Contract $    Recompetes Next 12M
$1.7M                $3.4M                8


GROWTH / PIPELINE
[ Pursuit pipeline by stage ]
[ Upcoming deadlines ]
[ Recent wins/losses ]


CONTRACT / REBID RISK
180 days    120 days    90 days    60 days    30 days
    5           3          2          1          1


MARKET / COMPETITION
Top active buyers
Upcoming recompetes
Most-seen competitors


NEEDS ATTENTION
Dallas ISD response due in 4 days
Williamson contract hits 120-day renewal window
3 mandatory requirements need L&P input
COI expires in 27 days
This is directly supported by your original dashboard requirements: pipeline, contract value/options/expirations, compliance risk, win/loss, pricing and competitive observations.
For the owners, I would emphasize:
active pipeline and potential value;
submitted/awarded value;
win rate by count and value;
new-bid vs recompete win rate;
bids submitted;
bids due soon;
active contract value;
contracts entering renewal/rebid windows;
compliance at risk;
top buyers;
most frequent competitors;
pricing position versus winners;
documented loss reasons;
upcoming market opportunities/recompetes.
Those are not arbitrary dashboard filler. Proposal-industry research tracks win rate, RFP-sourced revenue, bid volume and completion speed, while government contractors also track new-bid/recompete win rates, bid/proposal costs and pipeline-to-win ratios. (Loopio) More recent Responsive research likewise says mature teams prioritize revenue impact and win rate. (Responsive)
UX/code references
Use Tremor for these analytics patterns. It is Apache-2.0, Tailwind/Radix based, and specifically provides reusable React components for analytical dashboards. (GitHub)
Tremor dashboard components
And the open-source Tremor Next.js dashboard template gives you an actual dashboard composition to mine. (GitHub)
Tremor dashboard template

2. PURSUITS = opportunity discovery through award decision
This is the entire pre-award operating flow.
The landing page should NOT immediately dump you into proposals.
I would make the Pursuits landing:
PURSUITS

[ Discover ] [ Watchlist ] [ Active ] [ Submitted ] [ Closed ]

Search...   Buyer   Geography   Service   Due Date   Value   Fit

────────────────────────────────────────────────────────────────

Dallas ISD
RFP 2026-318
Security Services
Sep 18
Fit 92%
[Review]

Fort Worth
Pre-RFP
Guard Services
Est. Q1 2027
Fit 84%
[Watch]
This fixes another omission from my last answer: opportunity identification exists before somebody uploads an RFP.
GovWin's own government-contracting workflow is explicitly about identifying opportunities, qualifying pursuits and using market/competitive information before committing capture resources; its users also value alerts on future and recompete opportunities. (Deltek)
Public repo: TenderRadar
This is extremely applicable here.
It already has:
procurement opportunity feed;
filters;
company-profile matching;
relevance ranking;
opportunity detail;
tracker;
stages New → Reviewing → Bid / No-Bid → Submitted.
(GitHub)
TenderRadar public repo
Borrow for:
Pursuits → Discover
Pursuits → Watchlist
Pursuits → Pipeline
Opportunity detail
Fit/relevance presentation
Bid / No-Bid tracking
Don't adopt its database.

Then click a Pursuit
Once an opportunity becomes something L&P is actively bidding:
Dallas ISD
RFP-2026-318

Due Sep 18      Stage: Response      Complete: 74%

[ Overview ] [ Strategy ] [ Pricing ] [ Response ] [ Submission ] [ Outcome ]
That is the actual work object.
Overview
SOLICITATION

Buyer
Solicitation #
Due date
Questions deadline
Performance dates
Scope
Evaluation weights
Required forms
Addenda

STATUS

Analysis complete
84 requirements
7 missing answers
3 L&P inputs required

NEXT ACTIONS
All the processor shit happens invisibly behind this:
upload
→ Storage
→ parse
→ OCR if required
→ extraction
→ staging
→ validation
→ source linking
The user sees results and exceptions, not pipeline architecture.
Your spec requires very detailed extraction of solicitation metadata, scope, staffing, compliance, pricing requirements, evaluation and submission items.

Pursuit → STRATEGY
This is where the pursuit-specific research belongs.
I would restore this as a real tab because someone actually has to evaluate and use this information, not simply have it generated in the background.
STRATEGY

Bid / No-Bid
[ BID ]

BUYER
Prior L&P bids
Prior wins/losses
Current incumbent
Current contract
Buyer evaluation history

COMPETITION
Likely competitors
Prior bid prices
Awarded prices
Scores / rankings

EVALUATION
Technical          35%
Price              30%
Experience         20%
Staffing            15%

WIN THEMES / RISKS
────────────────────────
✓ Strong prior ISD experience
⚠ Historic staffing score weakness
⚠ Incumbent observed below L&P pricing

BID STRATEGY
[Evidence-backed generated brief]
This combines:
research
+
buyer intelligence
+
competitor intelligence
+
prior L&P history
+
evaluation
+
bid/no-bid
+
bid strategy
for this particular pursuit.
It does not replace the cross-company Intelligence section.

Pursuit → RESPONSE
Requirements and proposal writing should remain one connected workspace.
Your data model says a requirement carries source, page, excerpt, response, evidence, status and approval.
So:
RESPONSE

All 84 | To Do 7 | L&P Input 3 | Review 12 | Approved 62

┌────────────────────────┬─────────────────────────────────────────┐
│ REQUIREMENTS           │ RESPONSE                                │
│                        │                                         │
│ ✓ Management Plan      │ [ Tiptap editor ]                       │
│ ✓ Training             │                                         │
│ ● Staffing Continuity  │ Draft / Edit / Improve / Approve        │
│ ○ Transition           │                                         │
│ ○ References           │                                         │
└────────────────────────┴─────────────────────────────────────────┘
                                      [ Evidence / Sources › ]
Your proposal spec is explicitly requirement-driven with historical intelligence, evidence and L&P INPUT REQUIRED inside that workflow.
AutoRFP is the strongest public UX reference here. It already combines extracted questions, answer status, source details, generated answers and editing inside the same project workspace. (GitHub)
AutoRFP repo
RFPilot is also useful for its RFP detail, repository, gap analysis and analytics. Its current README explicitly includes RFP analysis, proposal intelligence, searchable RFP repository, win-rate/pipeline analytics and capability gaps. (GitHub)
RFPilot repo

Pursuit → PRICING
Keep this distinct.
PRICING

[ Buyer Format ] [ Cost Model ] [ Comparables ]

Buyer-required pricing matrix
────────────────────────────────────

Internal cost / wage model
────────────────────────────────────

Comparable evidence
────────────────────────────────────
Same buyer
Similar ISDs
L&P wins
L&P losses
Competitor awards

Observed range
Median
Percentiles
Cost floor
Target margin

[Show Evidence]


FINAL PROPOSED PRICE

$_____________

HUMAN DECISION REQUIRED
Your spec explicitly defines those three layers and requires final pricing to remain a human decision.
Glide Data Grid remains the right implementation reference.

Pursuit → SUBMISSION
SUBMISSION READINESS

✓ 84/84 requirements addressed
✓ Pricing workbook
✓ References
✓ W-9
✓ Insurance
⚠ Conflict disclosure needs signature
✓ Certifications
✓ Addendum acknowledgments

Approvals
3 / 3

[Open Working Google Doc]
[Generate Package]
[Export DOCX]
[Export PDF]

Submission Portal
Bonfire

Deadline
Sep 18 — 2:00 PM

[Mark Submitted]
Compliance is part of readiness; it is not another global module.

Pursuit → OUTCOME
OUTCOME

Won | Lost | No Bid | Cancelled | No Award

L&P proposed     $42.50
Winner           Allied
Winner price     $39.75

L&P rank         2
L&P score        88
Winning score    93

Evaluation breakdown
Price            25 / 30
Technical        34 / 35
Staffing         12 / 15

Evaluator Feedback
...

Documented Reason
...

Internal Analysis
...

Lessons Learned
...
Your spec explicitly requires those outcome fields and requires documented reasons to remain separate from internal interpretation.

3. INTELLIGENCE — YES, MARKET ANALYSIS IS HERE
This is where the previous answer really screwed up.
This should have permanent internal navigation:
INTELLIGENCE

[ Overview ]
[ Market ]
[ Buyers ]
[ Competitors ]
[ Pricing ]
[ Win / Loss ]
[ Content ]
[ Reports ]
These are not random pages.
They're different questions a BD/owner/proposal person deliberately investigates.

Intelligence → MARKET
This is your cross-market research/analysis area.
MARKET

Filters:
Texas | ISD | Armed Security | 500k–5M | Last 3 Years

MARKET SNAPSHOT
$ Awarded
# Solicitations
# Awards
Median award
Active buyers
Known recompetes

Opportunity trend
[chart]

Award value trend
[chart]

Rates / pricing trend
[chart]

TOP BUYERS
Dallas ISD
Fort Worth ISD
Plano ISD

TOP COMPETITORS
Allied
GardaWorld
...

RECOMPETE RADAR
─────────────────────────────────
Buyer          Incumbent    Expiration
Dallas ISD     Allied       Jan 2027
Plano ISD      Garda        Mar 2027

[Start Pursuit]
This directly implements your required analysis by service, geography, buyer type, contract size, award values, rates, competition and rebid activity.
GovWin validates this exact concept commercially: its market tooling includes opportunity filtering, agency spending, contractors and spending trends, and its customers use contract/recompete intelligence to prepare before solicitations release. (Deltek Education)



Public repos to mine
TenderRadar
→ opportunity feed/filter/matching.
RFP Map
→ optional geographical market exploration. It is Next.js 16, MIT, and specifically visualizes SAM.gov opportunities as agency/category/individual-RFP drilldowns. (GitHub)
RFP Map repo
Tremor
→ market charts/KPIs.

Intelligence → BUYERS
BUYER: Dallas ISD

Overview
Spend / Awards
L&P History
Solicitations
Contracts
Evaluation History
Recompetes
Sources
Show:
past solicitations;
L&P bids;
wins/losses;
incumbent;
awarded vendors;
pricing;
evaluation history;
budgets/procurement plans;
current contract;
expiration/options;
rebid timing.
That's literally the buyer-intelligence scope from your build specification.

Intelligence → COMPETITORS
COMPETITORS

Allied Universal
GardaWorld
Securitas
...

Click Allied:

OVERVIEW
Observed in 31 bids
Won 12
Most common buyer: ISDs
Primary region: North Texas

PRICING
Observed bid/award rates

BID HISTORY
Buyer | Bid | Submitted | Awarded | Rank

HEAD-TO-HEAD WITH L&P
L&P wins
Competitor wins
Price deltas
Score deltas

RECENT INTELLIGENCE
...
The source spec explicitly needs submitted prices, awarded prices, bid lines, scores, ranks, services/geography and source evidence.
Public repo: Rival
This is actually relevant—not random.
Rival is an MIT-licensed Next.js competitive-intelligence dashboard with competitor profiles, historical scans, change summaries, cited Deep Dive research and competitor intelligence briefs. (GitHub)
You wouldn't use its website-pricing data model, but its competitor-profile / change-history / deep-research presentation is directly reusable UX.
Rival competitor-intelligence repo

Intelligence → PRICING
This is different from Pursuit → Pricing.
INTELLIGENCE → PRICING

Historical L&P rates
Awarded market rates
Competitor rates
Buyer-specific pricing
Wage determinations
Trend by geography
Trend by service
Distribution / percentiles
This is the cross-corpus benchmark workspace.
The pursuit Pricing tab answers:
“What should we price THIS bid?”
Intelligence Pricing answers:
“What has the market historically looked like?”

Intelligence → WIN / LOSS
This is the full analytical dashboard—not just the Outcome tab on one pursuit.
WIN / LOSS

Win Rate               41%
Awarded Value           $1.7M
Submitted Value         $4.3M
Recompete Win Rate      62%

[win-rate trend]

BY BUYER TYPE
ISD        52%
County     38%
Federal    27%

BY SERVICE
Armed      ...
Unarmed    ...

COMMON COMPETITORS

PRICE POSITION VS WINNER

SCORE DIFFERENCES

DOCUMENTED LOSS REASONS

EVALUATOR THEMES

[View all pursuits]
RFPilot itself already includes an analytics dashboard for win rates, pipeline value and capability gaps, which is useful here. (GitHub)
Tremor gives us the chart/KPI components instead of writing this visualization layer from scratch. (GitHub)

Intelligence → CONTENT
This is your historical proposal intelligence.
CONTENT LIBRARY

Search approved proposal content...

Staffing
Training
Transition
Quality Control
Technology
Past Performance
...

Filters:
Approved
Review Required
Do Not Use
Superseded

Historical outcome
Buyer
Evaluation score
Last verified
Your spec explicitly requires proposal sections, outcomes, evaluation linkage and the APPROVED / REVIEW_REQUIRED / DO_NOT_USE / SUPERSEDED reuse states.

Intelligence → REPORTS
REPORTS

Bid Strategy
Buyer Intelligence
Market Intelligence
Competitor Intelligence
Pricing Intelligence
Win/Loss Analysis
Proposal Improvement
Executive Intelligence

Saved Reports
Scheduled Reports
Those are explicitly named outputs in the specification.

4. CONTRACTS
Global contract landing:
CONTRACTS

[ Active ] [ Renewal / Rebid ] [ Expiring ] [ Closed ]

Active value      $3.4M
Expiring <180d    5
Options Available 7
Compliance Risk   2

Buyer        Contract      Value      Expires       Next Action
Williamson   202569        $850k      Jan 2027      Review
Dallas       ...           ...        Mar 2027      Option

CONTRACTS → Renewal / Rebid is CRITICAL
This is where you prepare before an L&P-held contract ends.
RENEWAL / REBID

180 DAYS     120 DAYS     90 DAYS     60 DAYS     30 DAYS

Williamson County
Expires Jan 14, 2027

Base term
Option remaining
Notice deadline
Internal review date
Expected rebid
Compliance readiness

[Prepare Renewal]
[Start Rebid Pursuit]
The background system calculates the dates and sends alerts.
The human only sees the action queue.
Public repo: CatalogIT
This is one of the best direct UI references I found for this mechanics layer.
It's MIT licensed and already implements:
renewal dates;
renewal calendar;
reminders;
dashboards;
ownership;
attachments;
audit history;
notifications.
(GitHub)
Its domain is IT services, not government contracts, but the date-risk/calendar/reminder UX transfers almost perfectly.
CatalogIT renewal UI reference
And this is consistent with real commercial CLM dashboards that surface contracts expiring in 90 days/year and put individual contracts underneath those exposure summaries.

Important: TWO different recompete concepts
This is where the architecture gets useful:
L&P's own contract is expiring
Contracts → Renewal / Rebid
because L&P already holds it.
A competitor's/current buyer contract is expiring
Intelligence → Market → Recompete Radar
because that's a future market opportunity.
Either one can produce:
[Start Pursuit]
Then it enters the Pursuits pipeline.
That creates the closed loop you actually want.

5. DATA MANAGEMENT — still exists, but role-limited
The backend capabilities do need operational UI somewhere.
Just not next to Market and Pursuits.
DATA MANAGEMENT

Historical Imports
Verification Queue
Exceptions
Processing Failures
Data Quality
The normal executive/proposal user may never touch it.
Public repo: OpenContracts
Use this for:
source document
↔
extracted fact
↔
human verification
OpenContracts is MIT and explicitly treats human annotation as ground truth, preserves precise source locations and puts extraction/search/annotation against the same source documents. (GitHub)
OpenContracts repo

6. ASK INTELLIGENCE
Still global.
Not a navigation page users have to hunt for.
[ Search or Ask Intelligence... ]
Examples:
What contracts expire in the next 12 months?

Which competitors appear most often in Texas ISD bids?

Show awarded armed guard rates for similar contracts.

What caused our score gap in Arlington?

Find Dallas ISD's current contract.

Build a market intelligence report.
Morphic is still the right UX reference for this because it already handles cited answers, rich source-backed results, provider abstraction and streamed/generative result presentation. (GitHub)
Morphic repo

So THIS is the actual application map
HOME
│
├── Executive Dashboard
├── Needs Attention
├── Upcoming Deadlines
├── Renewal/Rebid Alerts
└── Market/Pipeline Snapshot


PURSUITS
│
├── Discover
├── Watchlist
├── Active
├── Submitted
├── Closed
│
└── PURSUIT
    ├── Overview
    ├── Strategy
    ├── Pricing
    ├── Response
    ├── Submission
    └── Outcome


INTELLIGENCE
│
├── Overview
├── Market
│   └── Recompete Radar
├── Buyers
├── Competitors
├── Pricing
├── Win/Loss
├── Content
└── Reports


CONTRACTS
│
├── Active
├── Renewal / Rebid
├── Expiring
├── Closed
│
└── CONTRACT
    ├── Overview
    ├── Service Plan
    ├── Commercial Terms
    ├── Changes
    └── Renewal & Compliance


DATA MANAGEMENT — ROLE LIMITED
│
├── Historical Imports
├── Verification
├── Exceptions
├── Processing Failures
└── Data Quality


GLOBAL HEADER
├── Search / Ask Intelligence
├── + New
├── Notifications
└── User / Organization
That covers the whole product instead of just the bidding flow.
The UX repo pack I would actually give Cursor
UI area
Primary public reference
What Cursor should steal/study
Overall Next.js shell / executive dashboard / tables
Kiranism Next Shadcn Dashboard Starter
shell, sidebar, page container, real data tables, filters, dashboard/card/chart composition. MIT. (GitHub)
Procurement discovery / watchlist / bid pipeline
TenderRadar
tender feed, filters, matching, opportunity detail, bid/no-bid pipeline. (GitHub)
Market geography / opportunity exploration
RFP Map
market → agency → category → opportunity drilldown/map. MIT. (GitHub)
RFP response workspace
AutoRFP
requirements/questions + response + sources in one workspace. (GitHub)
RFP analytics / repository / gaps
RFPilot
RFP dashboard, repository, win/pipeline/gap analytics. MIT. (GitHub)
Competitor intelligence
Rival
competitor detail, research brief, change history, cited Deep Dive. MIT. (GitHub)
Renewal / expiration / rebid UX
CatalogIT
renewal calendar, upcoming renewals, dashboard alerts, owner, audit/history. MIT. (GitHub)
Executive + market analytics visuals
Tremor
KPI cards, time series, bars, categories, dashboard layouts. Apache-2.0. (GitHub)
Verification/evidence
OpenContracts
source viewer, annotations, evidence, human verification. MIT. (GitHub)
Ask Intelligence
Morphic
cited/streaming search and rich source result UI. (GitHub)
Response editor
Novel/Tiptap
actual editor interactions
Pricing
Glide Data Grid
actual spreadsheet mechanics

And for the base UI, I would use Kiranism's public Next.js/shadcn starter as a code reference rather than loading another random entire SaaS template. It is especially relevant because it already has working TanStack tables, URL-synced filters, charts, sidebar/header, React Query and feature-based modules. (GitHub)
Kiranism Next.js/shadcn dashboard repo
This is now the UI architecture I would give Cursor to lock into the repo before it touches the visual build.

