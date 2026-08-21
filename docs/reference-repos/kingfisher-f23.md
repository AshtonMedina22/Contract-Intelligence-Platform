# Repository

Kingfisher (OCDS) — collection / transform patterns for open contracting data.

Related: TenderRadar (unlicensed — REFERENCE ONLY), USAspending API (public HTTP).

# Task that caused inspection

F23 Public Procurement Corpus Acquisition + Intelligence Enrichment Engine  
(`docs/functionality/F23_CORPUS_ACQUISITION_ACCEPTANCE.md`).

# Relevant patterns found

- Prefer **official primary documents** + open-data APIs over HTML scrape
- Keep a **registry of source URLs** with checksums and retrieval metadata
- Separate discovery leads from acquired evidence
- Do not invent awards from missing portal rows

# What maps to our codebase

| Pattern | Local |
| --- | --- |
| Source registry | `acquisition_candidates` + F23A seed txt |
| Open-data pull | F16 `socrata` + F23 TxDOT SODA attempt |
| Federal awards | F3 `usaspending.ts` (REFERENCE_DATA in F23) |
| Opportunity adapters | F2/F16 `PublicProcurementProvider` |

# What we are adopting

- Registry + checksum + primary-source preference (concept)
- Honest saturation logging when a query returns zero or is skipped

# What we are explicitly NOT adopting

- Kingfisher runtime / OCDS warehouse as our store
- TenderRadar scoring or unlicensed source copy
- Auto-`HUMAN_VERIFIED` or fabricated package PDFs

# License / copy

Kingfisher / OCDS tooling = pattern only. TenderRadar remains unlicensed → REFERENCE ONLY (see `tenderradar.md`). USAspending = public API client already in-repo under F3.

# Status

INSPECTED FOR TASK · CONCEPT ADOPTED · NO UPSTREAM CODE COPIED
