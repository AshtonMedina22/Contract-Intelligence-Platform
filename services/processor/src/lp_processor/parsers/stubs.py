from lp_processor.models import NormalizedDocument
from lp_processor.parsers.base import DocumentParser, ParserNotWiredError


class _StubParser(DocumentParser):
    def supports(self, mime_type: str | None, filename: str | None) -> bool:
        return False

    def parse(self, payload: bytes, *, mime_type: str | None, filename: str | None) -> NormalizedDocument:
        raise ParserNotWiredError(f"{self.parser_id} is not wired in Phase 3.")


class DoclingParser(_StubParser):
    parser_id = "pdf-docling"


class GoogleDocumentAiParser(_StubParser):
    parser_id = "ocr-document-ai"


class NativeMultimodalPdfParser(_StubParser):
    parser_id = "pdf-multimodal"
