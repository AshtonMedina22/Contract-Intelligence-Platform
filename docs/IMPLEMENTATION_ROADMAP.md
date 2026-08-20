# Implementation roadmap

Index of phases. **Execute using [BUILD_PLAN.md](BUILD_PLAN.md)** (tasks, files, acceptance, out of scope). Product rules: [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md).

Do not reorder phases to create impressive screens earlier.

| Phase | Name | Usable outcome |
| --- | --- | --- |
| 0 | Docs in git | Spec + plan cloneable from GitHub |
| 1 | Framework foundation | Next.js app builds; empty processor/packages/supabase folders |
| 2 | Schema / provenance | RLS org isolation; staging tables |
| 3 | Intake + Workflow start | Upload/import, checksum, registry, lifecycle run |
| 4 | Processor interfaces | Parse/extract to staging; XLSX via openpyxl |
| 5 | Verification workbench | PDF.js + human verify/promote |
| 6 | Pilot benchmark | Routing policy from L&P documents |
| 7 | Expand canonical schema | Four-truth mappings the pilot proved |
| 8 | Bulk migration | **Implemented.** [PHASE8_ACCEPTANCE.md](PHASE8_ACCEPTANCE.md) |
| 9 | Contracts / Cron | **Implemented.** [PHASE9_ACCEPTANCE.md](PHASE9_ACCEPTANCE.md) |
| 10 | Intelligence | Win/loss, client, competitor evidence |
| 11 | Hybrid RAG | SQL + FTS + pgvector on verified content |
| 12 | Pricing intelligence | Glide workbench; human final price |
| 13 | Proposal builder | Tiptap; grounded drafts |
| 14 | Commercial | Stripe / tenant admin |

## Current status

**Phase 9 implemented** — contracts, renewals center, compliance, pg_cron buckets ([PHASE9_ACCEPTANCE.md](PHASE9_ACCEPTANCE.md)). Next: Phase 10 win/loss.

Execute using [BUILD_PLAN.md](BUILD_PLAN.md). Setup on a new machine: [DEVICE_SETUP.md](DEVICE_SETUP.md).
