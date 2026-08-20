# Foundation vs later-agent audit (2026-08-20)

**Auditor machine:** Cursor session that owned original Phase 0–2 foundation.  
**Baseline branch (do not delete):** `cursor-phase2-foundation` @ `8d2d031`  
**Remote tag:** `phase-2-baseline` @ `7e02e9a` (RLS freeze)  
**Audited HEAD:** `f1f16ea` on `main`  
**Detailed explore:** [Audit agent phase claims](e3dff353-d9dc-42b5-971c-03b711346f38)

## Why this file exists

After the other computer shipped Prompts 2C–9, **entry docs disagreed**:

- `AGENT_HANDOFF` / `DEVICE_SETUP` / cursor rules said **Phase 2 = 0 packages / next**
- `WORK_TRAIL` / several acceptance files said **Phases 3–8 PASS** and VERIFY 9 **READY WITH NONBLOCKING LIMITATIONS**

That split-brain poisons the next agent. This file is the reconciled product truth.

## Architecture (accurate)

| Lock | Status |
| --- | --- |
| No Prisma / Drizzle | OK |
| Supabase SQL + RLS + Storage vault | OK |
| Vercel deploys **web only** (`vercel.json`) | OK — processor not a Vercel service |
| FastAPI processor local (openpyxl, DOCX, Mistral OCR key-gated; Docling stub) | OK |
| Promote requires `HUMAN_VERIFIED` | OK in SQL/RPC + processor status guard |
| AI auto-promote to canonical | **Not found** |

## Product maturity (honest)

| Claim | Verdict |
| --- | --- |
| Foundation (auth, tenancy, staging, verify gate, processor, intake) | **Mostly real in code + local scripts** — still confirm prod env/migrations |
| Historical Pilot exit (~20–30 packages source→verify→promote) | **Not met** — VERIFY 2B documents **~7 A/B** through pipeline |
| Later surfaces (Contracts, Intelligence, Ask, Pricing, Response) | **Large code + harnesses exist**; corpus-thin; do **not** equal L&P-ready product |
| VERIFY 9 “READY WITH NONBLOCKING LIMITATIONS” | Means **engineering/trust harness green** with corpus / prod processor / `ASK_MODEL` deferred — **not** original Phase 2–8 product exit |

**One line:** Trust *mechanism* is largely built; verified L&P *corpus* and production ops are not. Treat `PHASE*_ACCEPTANCE` / `VERIFY*` “PASS” as **script pass**, not “operators can run the business on this.”

## Naming (do not confuse)

| Original Cursor language (foundation branch) | Later “canonical” language |
| --- | --- |
| Phase 1 = Next.js shell | Phase 1 = Foundation (RLS + intake/verify/processor) |
| Phase 2 = tenancy/provenance schema | Phase 2 = Historical Pilot |
| Phases 3–14 engineering | Product phases 1–8 |

Legacy migration filenames (`phase9_contracts`, `phase11_hybrid_rag`) are **engineering IDs**, not product maturity.

## Next work (ordered)

1. Keep this file + [WORK_TRAIL.md](WORK_TRAIL.md) aligned when status changes.  
2. Confirm Vercel env + apply any pending migrations on `lhmurblikkcomdxcrymx`.  
3. Grow real public L&P packages through intake → verify → promote toward ~20–30.  
4. Only then treat Intelligence / Ask / Pricing / Response as validated product.  
5. Do not expand “complete” claims, invent metrics, or weaken `HUMAN_VERIFIED` gates.

## Rollback

```bash
git checkout cursor-phase2-foundation
```
