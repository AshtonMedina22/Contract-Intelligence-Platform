# Canonical Phase 1 — Foundation audit

**Canonical Phase 1 — Foundation:** tenant isolation, evidence vault, document identity, staging/verification/audit, Workflow/JobPort/processor interfaces, shared schemas, app shell + source/PDF review.

**Audit date:** 2026-08-20 (Prompt 1 — Foundation hardening)  
**Verdict:** **Local exit gate proven.** Do not rebuild working foundation code. **Canonical Phase 2 (Historical Pilot) has not started** (0 packages through the complete pipeline).

Cross-check: [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md), [BUILD_PLAN.md](BUILD_PLAN.md), [PHASE_RECONCILIATION.md](PHASE_RECONCILIATION.md).  
Single test command: `npm run test:foundation` (includes `npm run test:verify1`). Also run `npm run lint`, `npm run typecheck`, `npm run build`.

---

## Checklist (Prompt 1)

| # | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| 1 | Next.js / React / TypeScript application shell | `apps/web`; canonical IA Home \| Pursuits \| Intelligence \| Contracts \| Data Ops | ✅ |
| 2 | Supabase Auth | Auth routes; `apps/web/proxy.ts` session | ✅ |
| 3 | organizations | `organizations` table + bootstrap RPC | ✅ |
| 4 | memberships | `memberships` + `memberships.role` enum stored | ✅ |
| 5 | `organization_id` tenancy | Tenant columns + RLS on operational tables | ✅ |
| 6 | PostgreSQL RLS | `npm run test:phase2-rls` **48/48** | ✅ |
| 7 | same-organization relationship integrity | Same suite (same-org FK / integrity cases) | ✅ |
| 8 | tenant-scoped Storage | Storage isolation cases in Phase 2 RLS suite | ✅ |
| 9 | canonical evidence vault | Supabase Storage; Drive = import/source only | ✅ |
| 10 | SHA-256 document identity | Intake checksum; duplicate skip | ✅ |
| 11 | document registry | `documents` | ✅ |
| 12 | document versions | `document_versions` | ✅ |
| 13 | batches / packages | Intake batches / package grouping | ✅ |
| 14 | extraction runs | `extraction_runs` | ✅ |
| 15 | staging facts | `extracted_facts` default **`AI_EXTRACTED`** | ✅ |
| 16 | source evidence | `source_evidence` append-only (no upsert/update/delete in tests) | ✅ |
| 17 | verification events | `verification_events`; HUMAN_VERIFIED requires actor + timestamp | ✅ |
| 18 | validation exceptions | `validation_exceptions`; promotion path | ✅ |
| 19 | shared schema contracts | `packages/schemas` Zod ↔ `lp_processor.models` Pydantic | ✅ |
| 20 | Vercel Workflow document-lifecycle | `apps/web/workflows/document-lifecycle.ts` | ✅ |
| 21 | JobPort fan-out abstraction | `packages/shared` JobPort + Vercel Workflow adapter | ✅ |
| 22 | Python / FastAPI / Pydantic processor | `services/processor`; **9 pytest passed** | ✅ |
| 23 | source / PDF review foundation | Verification workbench + PDF.js | ✅ |
| 24 | Multi-tenant from day one | Not deferred to a PaaS phase | ✅ |
| 25 | AI-extracted data defaults unverified | DB default + processor writes `AI_EXTRACTED` | ✅ |
| 26 | Original evidence not casually overwritten | Evidence vault policy + RLS suite | ✅ |

---

## Explicitly NOT Phase 1 (do not block this gate)

| Item | Canonical phase | Today |
| --- | --- | --- |
| 20–30 packages through complete pipeline | **2** | **0** |
| OCR/DOCX production routing | 3 | Stubs / unwired |
| Role enum enforced in every UI/workflow | later ops | Stored; not UI-gated |
| Opportunity / contract / intelligence product completeness | 4–8 | Early/partial code must not be called complete |
| 25 MB intake vs large board packets | 2/3 ingest | Ops limit, not missing Foundation tables |

---

## Gaps that block the **pilot**, not Foundation rebuild

- [ ] Operator smoke: **1 real package** source → extract → stage → human verify → canonical (not done)  
- [ ] Vercel production + signed-in org + processor running for live intake  
- [ ] Opportunity migrations on remote if still missing (`20260820300000` / `310000` / `320000`)  
- [ ] L&P selects first pilot packages from [HISTORICAL_PILOT.md](HISTORICAL_PILOT.md)

**Must NOT do as “Foundation work”:** expand Ask/Pricing/Response; invent schema from PDFs without PILOT_GAP_REPORT; treat RLS 48/48 as Historical Pilot complete.

---

## VERIFY 1 (2026-08-20)

Independent live proofs: `npm run test:verify1` — architecture **5/5**, runtime **21/21**. Failures found in audit were fixed (append-version RPC, actor NOT NULL, append-only provenance, immutable version identity, processor VERIFIED guard). Opportunity migrations `20260820300000` / `310000` / `320000` were applied to the linked remote as part of this push.

## Recommendation

**Canonical Phase 1:** Accept as **complete for the local/code exit gate** (2026-08-20).  
**Next product work:** **Canonical Phase 2 — Real-Document Historical Pilot.**
