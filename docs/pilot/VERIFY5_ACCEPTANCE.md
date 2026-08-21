# VERIFY 5 — Intelligence acceptance

**Phase:** Canonical Phase 5 — Buyer / Competitor / Market / Win-Loss Intelligence  
**Audit date:** 2026-08-20  
**Command:** `npm run test:verify5`  
**Artifact:** [verify5-results.json](../benchmarks/verify5-results.json)

---

## Verdict

**FAIL**

Independent Intelligence acceptance against **verified canonical records only**. Raw document mentions must not become bids or awards. Market metrics must come from business records, not document counts. Reuse state is independent of win/loss outcome.

---

## PASS / FAIL by domain

| Domain | Result | Score |
| --- | --- | --- |
| market | **PASS** | 2/2 |
| buyer | **FAIL** | 4/5 |
| pursuit | **FAIL** | 1/2 |
| content | **PASS** | 5/5 |
| competitor | **PASS** | 4/4 |
| scores | **PASS** | 1/1 |
| winloss | **PASS** | 2/2 |
| honesty | **PASS** | 2/2 |
| research | **PASS** | 1/1 |

---

## Assertion matrix

| Domain | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
| market | Market metrics exclude documents count | **PASS** | awards/win_loss/bids/pricing_lines only | market/page.tsx |
| buyer | Buyers UI is procurement intelligence not CRM | **PASS** | portfolio + research | clients/page.tsx |
| pursuit | Pursuit Overview consumes intelligence summary | **FAIL** | wired | opportunities/[id]/page.tsx |
| content | Content UI surfaces reuse_status | **PASS** | Reuse column present | search-hits-table.tsx |
| buyer | Award promotes from verified award fact | **PASS** | {"ok":true,"action":"award"} | promote_verified_fact |
| buyer | Buyer history connects multiple pursuits | **PASS** | opps=2 | Westside ISD mt2yrva3 |
| buyer | Buyer history connects multiple contracts | **FAIL** | contracts=0 | Westside ISD mt2yrva3 |
| buyer | Buyer award links to pursuit under same buyer | **PASS** | [{"id":"2d1f9be0-e9eb-4e23-b0ff-8bdfd37ca014","opportunity_id":"fd7dc1f4-721f-4c41-8881-7987865a455d"}] | awards |
| competitor | Sourced competitor bid promotes | **PASS** | {"ok":true,"action":"competitor","competitor_id":"4f4a1dd2-54ba-47e7-95e1-669aef1ccefe"} | competitor_bids |
| competitor | L&P bids distinguishable from competitor bids | **PASS** | lp=125000 competitor=98000 | win_loss_reviews.lp_price vs competitor_bids |
| competitor | competitor_bids rejects unsourced insert | **PASS** | new row for relation "competitor_bids" violates check constraint "competitor_bids_has_source" | competitor_bids_has_source |
| competitor | competitor pricing is sourced | **PASS** | unsourced rejected; sourced={"id":"c5d7f783-6640-4b4c-b87a-9a60a5bc1754","source_fact_id":"acc770f6-b1cd-4055-9559-596cdc03ad91","source_document_id":"bc962b58-e150-4b22-af0b-7efb84d5be49","hourly_rate":18.75} | competitor_pricing_lines |
| scores | ranks/scores match source records | **PASS** | {"scoreRows":[{"respondent_name":"Acme Guard mt2yrva3","points":91,"max_points":100,"rank":1},{"respondent_name":"L&P Global","points":82,"max_points":100,"rank":2}],"bidRank":{"rank":1,"quoted_amount":98000}} | evaluation_scores + competitor_bids.rank |
| winloss | documented loss reason remains separate from internal analysis (constraint) | **PASS** | new row for relation "win_loss_reviews" violates check constraint "win_loss_reason_not_analysis" | win_loss_reason_not_analysis |
| winloss | documented reason stays distinct from internal analysis after promote | **PASS** | {"documented_reason":"Evaluator cited staffing depth","internal_analysis":"We understaffed the transition plan","lessons_learned":null,"outcome":"PENDING","lp_price":125000} | win_loss_reviews |
| honesty | raw document mention does not become a competitor bid | **PASS** | {"rawPromote":{"ok":true,"action":"skipped","message":"Not an intelligence field."},"aiPromote":{"ok":false,"action":"skipped","message":"Only HUMAN_VERIFIED facts promote."},"bidCountAfterMention":1,"bidCountAfterAi":1} | promote_intelligence_from_fact |
| honesty | raw mention does not become an award | **PASS** | {"awardBefore":1,"awardAfter":1,"rawAwardPromote":{"ok":true,"action":"skipped","message":"Value is not a rate."},"rawAwardError":null,"proposedAwardPromote":{"ok":false,"action":"conflict","message":"Award facts cannot  | promote_verified_fact |
| market | Market metrics are based on business records | **PASS** | {"documents":9,"awards":1,"reviews":1,"bids":1,"pricing_lines":0} | business tables ≠ documents |
| content | verified fact becomes knowledge chunk | **PASS** | {"ok":true,"action":"chunked"} | promote_knowledge_chunk_from_fact |
| content | WON does not automatically equal APPROVED | **PASS** | {"outcome":"WON","reuse":"REVIEW_REQUIRED"} | win_loss vs document_chunks.reuse_status |
| content | LOST does not automatically equal DO_NOT_USE | **PASS** | {"outcome":"LOST","reuse":"APPROVED"} | win_loss vs document_chunks.reuse_status |
| content | Content reuse state is enforced | **PASS** | {"draftingCount":0,"allCount":1,"draftingHas":false,"allHas":true} | search_verified_knowledge |
| research | public facts retain provenance | **PASS** | {"source_url":"https://example.com/board-minutes-westside","client_id":"d9dc9d0e-c878-4f63-9923-1527a88c4b47","opportunity_id":"fd7dc1f4-721f-4c41-8881-7987865a455d","source_document_id":"0be29820-e95c-4012-9fa0-a99a36c3 | research_facts |
| pursuit | current Pursuit can consume relevant intelligence | **PASS** | {"outcome":"WON","bids":1,"scores":2,"researchCount":1,"award":"2d1f9be0-e9eb-4e23-b0ff-8bdfd37ca014"} | opportunity fd7dc1f4-721f-4c41-8881-7987865a455d |

---

## Deferred / out of scope

- Phase 6 Ask GPT synthesis and AI report generators
- Inventing geography/services without evidence
- Market share from document corpus size

---

## How to re-run

```bash
npm run test:verify5
```
