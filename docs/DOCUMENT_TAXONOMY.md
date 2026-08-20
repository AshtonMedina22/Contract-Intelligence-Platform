# Document taxonomy

See [MASTER_PRODUCT_CONTEXT.md](MASTER_PRODUCT_CONTEXT.md). Production routing is locked in [ROUTING_POLICY.md](ROUTING_POLICY.md) (Phase 6). Fixture scores: [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md).

Every file is a document record linked to an organization, optional batch, optional client/opportunity/solicitation/contract, and a version chain. Original files are never replaced by extracted text.

## Registry fields (minimum)

organization, batch, internal document number, original filename, storage provider, storage path, Google Drive ID (when imported), checksum, MIME type, page/sheet count, document type/subtype, client, opportunity, solicitation, contract, date, version, current-version flag, processing status, extraction status, verification status, creator/importer, timestamps.

## Types

RFP, RFQ, IFB, solicitation, addendum, Q&A, proposal draft, final proposal, quote, pricing workbook, award notice, bid tab, evaluator scorecard, PO, contract, amendment, modification, option exercise, renewal, license, insurance, certification, resume, reference, past-performance evidence, other.

## Parser routing by type

Locked in [ROUTING_POLICY.md](ROUTING_POLICY.md). Summary:

| Input | Default path | Do not |
| --- | --- | --- |
| XLSX / XLSM pricing workbooks | `XlsxParser` via openpyxl (sheets, merged cells, number formats, formulas as stored values + formula text) | Send the whole workbook through OCR or an LLM first |
| DOCX | Native/Docling text+structure path | Treat as a scanned PDF |
| Clean digital PDF | `pdf-native` (pypdf) | Pay Document AI / Mistral OCR by default |
| Scanned PDF / forms / nested tables | Escalate to managed OCR / Document AI / stronger multimodal model | Assume one parser wins every document |
| Low confidence / conflict | Alternate provider or human review | Silently pick a value |

## Processing statuses

`UPLOADED`, `QUEUED`, `PARSING`, `EXTRACTING`, `VALIDATING`, `NEEDS_REVIEW`, `VERIFIED`, `FAILED`

AI completion is never `VERIFIED`.

## Package grouping

The core unit is the opportunity/package, not a random PDF:

Client → Opportunity → original RFP, addenda, Q&A, proposal draft, final proposal, pricing, award, bid tab, PO, contract, amendment, renewal

Each file keeps its own identity and version while linking to the same lifecycle.

## Content reuse statuses (later)

`APPROVED`, `REVIEW_REQUIRED`, `DO_NOT_USE`, `SUPERSEDED`

Won content is not automatically approved. Lost content is not automatically discarded.
