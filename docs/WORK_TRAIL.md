# Work trail — living product vs required

**This is the operational tracker.** Update it at the end of every agent session that ships, blocks, or changes direction. Do not leave status only in chat.

| Field | Value |
| --- | --- |
| **Last updated** | 2026-08-19 (session: docs-only MASTER_BLUEPRINT product lock) |
| **Git HEAD on origin/main** | After this docs commit — run `git log -1` (feature Pass 3+4 = `547e16c`) |
| **Local uncommitted** | **No** (product/docs in this commit; local agent/IronBee files stay untracked) |
| **Product truth gate** | Canonical Phase 2 Historical Pilot — **0 / 20 L&P packages** |

Companion snapshot (capability matrix, freeze list): [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md). Required end-state: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md). Pilot: [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md).

---

## How to update this file (mandatory)

After any meaningful session, append a row to **Session log** and rewrite **Honest position**, **Blockers**, and **Next ordered work**. If a feature ships in git, move it from “in repo / unproven” to “on main.” If it only exists locally, say so.

Never claim:

- a route or table = the capability is complete
- RLS 48/48 = Historical Pilot
- Intelligence screens = grounded answers (corpus is empty)

---

## Honest position (one screen)

| Lens | Today | Required to be |
| --- | --- | --- |
| **What L&P can actually use** | App shell, login, intake/verify **code**, empty corpus, early proposal **workspace UI** | Verified historical packages answering new RFPs with citations |
| **Canonical Phase 1 Foundation** | Mostly built; local `npm run build` **PASS** (2026-08-19 after Pass 3) | Green **production** with real Supabase env + applied migrations |
| **Canonical Phase 2 Pilot** | **NOT STARTED** | 20–30 complete L&P packages human-verified |
| **Ops coordinator workflow** | Tabbed workspace + packet completeness + planning margin rollup **local** | Same workflow **backed by verified facts** + live renewals |
| **Intelligence (Ask/Market/Reports)** | KEEP + FREEZE surfaces; FTS only; 0 verified chunks in prod | Grounded Q&A + reports from HUMAN_VERIFIED evidence |
| **Pricing intelligence (Phase 8)** | Four-truth table + planning cost model + comparables **panel** | Glide grid, wage/labor model, human final price with evidence |
| **Proposal builder (Phase 9)** | Workspace tabs + competitor brief **template** | Section drafting, reuse library, Google Docs path |
| **Production (Vercel)** | Deployed; often **no org / sign-in**; env historically missing | Linked Supabase + migrations applied + authenticated org |

**Bottom line:** Engineering is ahead of evidence. The product is not usable as procurement intelligence until Historical Pilot has real L&P packages.

---

## Required end-state (ops questions the finished product must answer)

From [PRODUCT_SPEC.md](PRODUCT_SPEC.md) — **verified evidence only**, never guessed:

| Question class | Code today | Data today | Gap |
| --- | --- | --- | --- |
| Requirements, deadlines, submission | Opportunity metadata + requirements UI | Empty | Need verified extraction + pilot packages |
| Evaluation criteria | `evaluation_criteria` table + UI | Empty; apply `310000` | Fill from Section M |
| Staffing / post orders | `staffing_requirements` + `/staffing` | Empty | Same |
| Four commercial truths | `pricing_lines` + workbench | Empty | Pilot pricing workbooks |
| Comparables (same buyer / service) | Panel queries other pursuits | Empty (n=0) | Need ≥2 verified packages |
| Win/loss, competitor bids | Tables + intelligence tab + brief template | Empty | Pilot awards / bid tabs |
| Ask with citations | `search_verified_knowledge` + `p_opportunity_id` | 0 chunks | Ingest → verify → chunk |
| Renewal → rebid | Clone button | No contracts corpus | Pilot wins + contracts |
| Grounded proposal sections | Not built | — | Phase 9 after pilot |
| Wage determinations / NAICS relational | Not first-class | — | After pilot |
| PDF/export reports | Catalog cards only | — | FREEZE until corpus |

---

## What shipped vs what is still needed

### On `main` (Pass 2 workspace + Pass 3+4)

| Item | Status | Notes |
| --- | --- | --- |
| Auth, RLS, Storage vault, Workflow ingest, verification workbench | Code on main | Unproven on L&P files |
| Nav IA, breadcrumbs, workflow home, data-model UI | On main | |
| Vercel 500 guard when Supabase env missing | On main (`dcf473a`) | Pages load; data still empty without env |
| Opportunity workspace tabs | On main | Includes **Staffing** |
| `opportunities` stage / go_no_go / due / service_type / rail / kind | Migrations `300000`+`320000` | **Must be applied on Supabase** |
| `pricing_cost_models` planning-only rates + fulfillment rollup | On main | Not canonical `proposed_rate` |
| Staffing, eval criteria, comparables, rebid clone, competitor brief template | On main | Empty until corpus |
| Ask `p_opportunity_id` | On main | Apply RPC in `310000` |
| `/proposals` pursuits dashboard | On main | |
| Living trail `docs/WORK_TRAIL.md` | On main | Update every session |

### Explicitly not done (do not pretend)

- Historical Pilot (0 packages)
- Vercel production env confirmed complete (`NEXT_PUBLIC_SUPABASE_*` + service keys as required)
- Opportunity migrations `300000` / `310000` / `320000` applied on hosted Supabase
- OCR/DOCX production paths
- Glide pricing grid
- Tiptap / section-level proposal drafting
- LLM synthesis on Ask / AI competitor reports (KEEP + FREEZE — would guess without corpus)
- LOCATE vs ASK split
- Grounded PDF report generators
- Purpose-aware retrieval (`LOSS_ANALYSIS` vs `PROPOSAL_DRAFTING` beyond drafting flag)
- `past_performance`, `solicitation_addenda`, wage tables as live product
- CRM / client portal (**must never exist**)

---

## Blockers (do these before claiming “live”)

1. **Apply SQL on project `lhmurblikkcomdxcrymx`:**
   - `supabase/migrations/20260820300000_opportunity_workspace.sql`
   - `supabase/migrations/20260820310000_ops_p1_staffing_eval_rebid.sql`
   - `supabase/migrations/20260820320000_ops_p4_procurement_rail.sql`
2. **Vercel env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and server secrets per DEVICE_SETUP). Production last checked: “No organization” / sign-in — not a working ops tenant.
3. **Code is on GitHub `main`** after this push — still apply SQL and env before claiming live.
4. **Human supplies real L&P packages** (Drive or files). Agents cannot invent the corpus.

---

## Next ordered work

1. Keep this trail + [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) current (this file).
2. Apply migrations + confirm Vercel env (ops / human).
3. **Canonical Phase 2 — Historical Pilot** on 5 then 20–30 complete L&P packages ([HISTORICAL_PILOT.md](HISTORICAL_PILOT.md)).
4. Do **not** add LLM competitor reports or Ask synthesis until verified chunks exist (KEEP + FREEZE). Glide and section drafting wait on the same gate.

Pass 3 ops UI was built **early** because L&P coordination needed a pursuit workspace. That does **not** complete Phase 8/9 and does **not** thaw KEEP + FREEZE Intelligence expansion (no new Ask/Market/Reports product features until corpus).

---

## L&P Global Security (external profile — not in-app data)

Use for domain context and UX labels only. **Do not insert these as canonical facts in Postgres.**

Verified 2026-08-19 from public sources (company site, Texas DPS TOPS, TxSmartBuy vendor list, HigherGov entity page):

| Fact | Value | Source class |
| --- | --- | --- |
| Legal | L&P Global Security, LLC (dba L & P Global Security LLC) | SAM/HigherGov |
| HQ / mail | Frisco TX; TOPS mailing 16910 Dallas Pkwy Ste 208, Dallas 75248 | TOPS |
| UEI / CAGE | `QYMAGLQY6MJ4` / `82J20` | SAM/HigherGov |
| NAICS | **561612** Security Guards and Patrol Services | SAM |
| TX DPS Class B | License **B06267001**, active; license exp **01/31/2027**; insurance exp **03/06/2027** | TOPS |
| Stakeholders (TOPS) | Sharma, Lalit M; Kumar, Prashant; Harkins, Fredrick D | TOPS |
| TXMAS | **TXMAS-24-99003** Guard and Security Services through **8/29/2027** | TxSmartBuy vendor list |
| GSA MAS | Multiple Award Schedule PoP **8/30/22–8/29/27** | HigherGov schedule row |
| Geography (marketing) | Dallas, Frisco, Houston, Austin, San Antonio + other TX by site | lpglobalsecurity.com |
| Quote intake (marketing) | Armed vs unarmed vs PPO; weekly hours / schedule; site location; ongoing vs event | company FAQ |

**What they actually prepare (ops model):**

1. **Commercial quotes** — private/multifamily/retail/warehouse/construction/event. Inputs: site, armed/unarmed, weekly hours, start date, insurance. Not a sealed RFP.
2. **TX municipal / ISD / county** — ESBD or local portals; RFQ/RFP/IFB packets with eval criteria, addenda, bid forms.
3. **TXMAS / TxSmartBuy** — use listed vehicle when the buyer buys off schedule; still need a task/quote packet.
4. **GSA / federal** — MAS vehicle for task orders; labor categories + any SCA wage determination **from that solicitation**, never a guessed wage.
5. **Rebids** — expiring contracts (own TX DPS/insurance dates are company compliance, separate from buyer POP).

**Not verified this pass:** individual award amounts, bid tabs, GSA labor-category price list line items (HigherGov lists the vehicle but did not expose line prices in the fetch). Do not invent competitor rates or “typical Texas guard bill rates.”

---

## Session log

| When | What happened | Outcome | Follow-up |
| --- | --- | --- | --- |
| 2026-08-19 | Docs reconciliation; phase naming locked | `6a727c7`, `e329408` | Agents must use original Phase 2 = pilot |
| 2026-08-19 | Nav IA, login Suspense, data-model UI | `8d083a5`, `213f951` | |
| 2026-08-19 | Vercel 500s without Supabase env | `dcf473a` | Still need real env for data |
| 2026-08-19 | Opportunity workspace Pass 2 | `40c9218` on main | Apply `20260820300000` |
| 2026-08-19 | LPGS research Pass 1–2 (analysis) | Prioritized P0–P3 gaps | P0 = migrations + pilot |
| 2026-08-19 | Pass 3 P1 implementation | Staffing, eval, comparables, rebid, brief | Apply `310000` |
| 2026-08-19 | This work trail created | Living scoreboard | |
| 2026-08-19 | Pass 4 packet + economics | Rail/kind/missing list/fulfillment math | Apply `320000` |
| 2026-08-19 | Commit + push Pass 3+4 | `547e16c` on origin/main | Apply all three opportunity migrations; confirm env |
| 2026-08-19 | Docs-only product lock | `MASTER_BLUEPRINT.md` is business authority; no app/schema change | Historical Pilot still not started |

Older engineering history: `git log`. Capability freeze list: [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md).
