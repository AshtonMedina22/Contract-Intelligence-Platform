# Document taxonomy

See [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md) (§5–6, §11), [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md). Production routing: [ROUTING_POLICY.md](ROUTING_POLICY.md). Scores: [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md).

## Procurement package structure

Historical procurement documents are **not** unrelated files. Associate complete packages:

```text
BUYER / AGENCY (clients)
  └── PROCUREMENT OPPORTUNITY (opportunities)
       ├── Solicitation (RFP / RFQ / IFB)
       ├── Addenda
       ├── Q&A / clarifications
       ├── Proposal drafts
       ├── Final submitted proposal
       ├── Pricing workbook / schedule
       ├── Award notice
       ├── Bid tabulation
       ├── Evaluator scorecard
       ├── Purchase order
       ├── Executed contract
       ├── Amendments
       ├── Modifications
       ├── Option exercises
       ├── Renewals
       └── Compliance / past-performance evidence
```

Package association is required for validation, reconciliation, and intelligence — not optional filing.

## Document registry fields

Each `documents` row tracks at minimum: organization, batch, opportunity (when known), document type, filename, processing status, commercial truth (when inferable), checksum linkage via versions.

Processing statuses: `UPLOADED`, `QUEUED`, `PARSING`, `EXTRACTING`, `VALIDATING`, `NEEDS_REVIEW`, `VERIFIED`, `FAILED`.

AI completion ≠ `VERIFIED`. Only human verification completes the verification gate.

## Document types (extensible strings)

Examples — not a closed enum hardcoded to one NAICS or service line:

RFP, RFQ, IFB, solicitation, addendum, Q&A, proposal draft, final proposal, quote, pricing workbook, award notice, bid tab, evaluator scorecard, PO, contract, amendment, modification, option exercise, renewal, license, insurance, certification, resume, reference, past-performance evidence, public research capture, other.

`infer_commercial_truth(doc_type, filename)` maps types to commercial truths for promotion. Extend as the pilot discovers L&P naming patterns.

## Version rules

- Every new source file → new `document_version` + new Storage object (never overwrite original).
- `is_current` marks the active version for business logic; superseded versions remain readable.
- Checksum match → same bytes; may skip reprocessing but still record provenance.
- Chunks inherit `is_current_version` for retrieval filtering.

## Current-version selection

Authoritative "current" for retrieval and promotion:

- Solicitation side: latest verified addendum/Q&A chain for **requested** facts
- Proposal side: **final submitted** for **proposed** facts
- Contract side: latest verified amendment/modification/option for **current** facts

Conflicts between versions → `validation_exceptions`, not silent replacement.

## Source document relationships

Documents link to opportunities and buyers. Facts link to `source_evidence` (page, section, excerpt, bbox). Promotion maps verified facts to canonical entities (`requirements`, `pricing_lines`, `awards`, `contracts`, etc.) per [SOURCE_PRECEDENCE.md](SOURCE_PRECEDENCE.md).

## Reuse status (proposal content)

When proposal sections become searchable chunks:

- `APPROVED` — may enter drafting retrieval
- `REVIEW` — human review required before drafting use
- `DO_NOT_USE` — never enter drafting retrieval; may appear in loss/evaluator analysis when purpose-aware retrieval exists
- `SUPERSEDED` — replaced by newer approved content

Won ≠ automatically reusable. Lost ≠ automatically unusable.

## Service taxonomy and NAICS

Do **not** hardcode one NAICS code or a fixed handful of service types into the architecture. Service taxonomy (armed, unarmed, PPO, off-duty police, patrol, supervisor, etc.) and NAICS/PSC/GSA fields belong in **relational, extensible** tables added when the pilot proves need — not as application constants.

## Parser routing

See [ROUTING_POLICY.md](ROUTING_POLICY.md). XLSX → openpyxl first. Digital PDF → native parse. Scans → escalate (OCR not production-wired). DOCX → not production-wired until pilot justifies.

Legacy Phase 6 routing is locked from **fixtures only** — 0 real L&P packages scored.
