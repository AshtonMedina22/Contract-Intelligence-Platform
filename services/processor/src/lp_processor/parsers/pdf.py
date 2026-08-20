import io

from pypdf import PdfReader

from lp_processor.models import NormalizedDocument, PdfPage
from lp_processor.parsers.base import DocumentParser


class PdfParser(DocumentParser):
    """Native digital-PDF text extraction. Not OCR."""

    parser_id = "pdf-native"

    def supports(self, mime_type: str | None, filename: str | None) -> bool:
        name = (filename or "").lower()
        return name.endswith(".pdf") or (mime_type or "") == "application/pdf"

    def parse(self, payload: bytes, *, mime_type: str | None, filename: str | None) -> NormalizedDocument:
        reader = PdfReader(io.BytesIO(payload))
        pages: list[PdfPage] = []
        warnings: list[str] = []
        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if not text.strip():
                warnings.append(f"Page {index} has no extractable text; scanned PDFs need a later OCR adapter.")
            pages.append(PdfPage(page=index, text=text))

        return NormalizedDocument(
            parser_id=self.parser_id,
            mime_type=mime_type,
            filename=filename,
            page_count=len(pages),
            sheet_count=None,
            sheets=[],
            pages=pages,
            warnings=warnings,
        )
