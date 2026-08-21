# Docling

https://github.com/docling-project/docling

# Task that caused inspection

P2 Data Ops research: normalized doc model, tables, OCR routing vs local parser abstraction.

# Relevant upstream files inspected

- `LICENSE` (raw main, 2026-08-20) — MIT (IBM)
- Docs: DoclingDocument concept — https://docling-project.github.io/docling/concepts/docling_document/
- OCR configuration guides / full-page OCR examples (public docs)

# Relevant patterns found

- **`DoclingDocument`**: unified pydantic model — `texts` / `tables` / `pictures` / `key_value_items`; `body` vs `furniture`; `groups`; reading order via tree; layout bboxes + provenance when available.
- **Tables**: `TableItem` with structure / cell matching options (`do_table_structure`, `do_cell_matching`).
- **OCR routing**: `PdfPipelineOptions.do_ocr`; engines (EasyOCR, Tesseract, RapidOCR, …); hybrid page detection vs `force_full_page_ocr` / `OcrMode.FULL_PAGE` for scans.
- Heavyweight local ML stack; models carry **separate** licenses (often Apache-2.0 / CDLA-Permissive-2.0) — check model cards if ever installed.

# What maps to our codebase

`DocumentParser` / `NormalizedDocument` in `services/processor`; `DoclingParser` stub in `parsers/stubs.py`; `routing.py` refuses `PARSER_PDF=docling` until wired.

# What we are adopting

Nothing to install now. Keep Docling as a **candidate adapter** behind our abstraction if pilot benchmarks (nested tables / layout) beat native.

# What we are explicitly NOT adopting

- Wiring Docling as default PDF/DOCX parser without `PILOT_RESULTS` evidence.
- Replacing openpyxl for XLSX.
- Hard-coding Docling as product architecture.

# License/copy implications verified

**Codebase: MIT.** Model weights/packages: separate upstream licenses — verify before shipping weights. Library use behind our adapter is license-compatible once models are cleared.

# Local files affected

None this session (research only).

# Status

INSPECTED FOR TASK
