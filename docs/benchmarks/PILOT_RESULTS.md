# Pilot benchmark results

Generated **2026-08-19**. Routing policy **1.0.0** ([ROUTING_POLICY.md](../ROUTING_POLICY.md)).

L&P packages scored: **0** / target 20.
L&P documents scored: **0** / target 30.
Fixture cases: **5** (routes ok: 5).
Cloud Run required by this evidence: **False**.

These scores are the locked fixture baseline. They do not replace a 20-30 package L&P pilot. OCR/DOCX remain unwired because the fixture evidence does not justify paying those APIs yet.

## Fixture scores

| Case | Role | Parser | Route | Cells | Reqs | Entities | Dates | Provenance | Forms | Scan | Time ms | API $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| xlsx_pricing_workbook | proposal_pricing | `xlsx-openpyxl` | ok | 1.0 | 1.0 | 1.0 | 1.0 | True | 1.0 | n/a | 19.12 | 0.0 |
| digital_rfp_pdf | solicitation | `pdf-native` | ok | 1.0 | 1.0 | 1.0 | 1.0 | True | 1.0 | n/a | 9.15 | 0.0 |
| scanned_pdf_empty_text | scanned_contract | `ocr-mistral` | ok | 1.0 | 1.0 | 1.0 | 1.0 | True | 1.0 | escalated | 3.52 | 0.0 |
| docx_proposal | proposal_narrative | `docx-native` | ok | 1.0 | 1.0 | 1.0 | 1.0 | True | 1.0 | n/a | 0.03 | 0.0 |
| form_checkbox_unwired | scorecard_form | `pdf-native` | ok | 1.0 | 1.0 | 1.0 | 1.0 | True | n/a | n/a | 9.52 | 0.0 |

## Still missing before the routing table can claim a full L&P pilot

- wins / losses as complete packages
- RFP / RFQ / IFB originals (L&P)
- proposals + pricing workbooks from the same opportunity
- scorecards
- contracts / amendments / renewals
- nested government tables
- real scanned PDFs (not empty-page synthetic)
- real DOCX
