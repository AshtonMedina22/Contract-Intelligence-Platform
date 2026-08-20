from lp_processor.config import settings
from lp_processor.parsers.base import DocumentParser, ParserNotWiredError
from lp_processor.parsers.docx import DocxParser
from lp_processor.parsers.ocr_mistral import MistralOcrParser
from lp_processor.parsers.pdf import PdfParser
from lp_processor.parsers.stubs import (
    DoclingParser,
    GoogleDocumentAiParser,
    NativeMultimodalPdfParser,
)
from lp_processor.parsers.xlsx import XlsxParser
from lp_processor.routing_policy import RouteDecision, decide_route, load_routing_policy
import os

WIRED_PARSERS: list[DocumentParser] = [XlsxParser(), PdfParser(), DocxParser()]
STUB_PARSERS: list[DocumentParser] = [
    DoclingParser(),
    GoogleDocumentAiParser(),
    NativeMultimodalPdfParser(),
]

_OCR = MistralOcrParser()
_BY_ID: dict[str, DocumentParser] = {
    parser.parser_id: parser for parser in [*WIRED_PARSERS, *STUB_PARSERS, _OCR]
}


def select_parser(
    mime_type: str | None,
    filename: str | None,
    payload: bytes | None = None,
) -> DocumentParser:
    decision = decide_route(mime_type, filename, payload)
    if settings.parser_pdf == "docling" and decision.parser_id == "pdf-native":
        raise ParserNotWiredError("DoclingParser is listed but not wired; keep PARSER_PDF=native.")
    if decision.parser_id == "ocr-mistral" and (os.environ.get("MISTRAL_API_KEY") or "").strip():
        decision = RouteDecision(
            parser_id=decision.parser_id,
            document_class=decision.document_class,
            reason=decision.reason + " MISTRAL_API_KEY present — OCR adapter wired.",
            wired=True,
            escalate=False,
            policy_version=decision.policy_version,
            scan_chars_per_page=decision.scan_chars_per_page,
        )
    return parser_for_decision(decision, mime_type, filename)


def parser_for_decision(
    decision: RouteDecision,
    mime_type: str | None,
    filename: str | None,
) -> DocumentParser:
    if not decision.wired or decision.escalate:
        raise ParserNotWiredError(
            f"{decision.reason} parser_id={decision.parser_id} class={decision.document_class} "
            f"policy={decision.policy_version} mime={mime_type!r} filename={filename!r}."
        )
    parser = _BY_ID.get(decision.parser_id)
    if parser is None:
        raise ParserNotWiredError(f"Policy named unknown parser {decision.parser_id}.")
    return parser


def routing_health() -> dict:
    policy = load_routing_policy()
    ocr_ready = bool((os.environ.get("MISTRAL_API_KEY") or "").strip())
    return {
        "version": policy.version,
        "locked_at": policy.locked_at,
        "cloud_run_required": policy.cloud_run_required,
        "wired": [parser.parser_id for parser in WIRED_PARSERS] + (["ocr-mistral"] if ocr_ready else []),
        "escalate_unwired": [parser.parser_id for parser in STUB_PARSERS]
        + ([] if ocr_ready else ["ocr-mistral"]),
        "ocr_ready": ocr_ready,
    }
