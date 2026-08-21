"""Routing classes locked by docs/ROUTING_POLICY.md.

Every document class the router can return is asserted here so a parser change cannot
silently reroute pricing workbooks to OCR or accept an empty native parse of a scan.
"""

from __future__ import annotations

import pytest

from lp_processor.evals.fixtures import _pdf, pricing_workbook, sample_docx, DIGITAL_RFP_TEXT
from lp_processor.parsers.base import ParserNotWiredError
from lp_processor.parsers.docx import DocxParser
from lp_processor.parsers.pdf import PdfParser
from lp_processor.parsers.routing import routing_health, select_parser
from lp_processor.parsers.xlsx import XlsxParser
from lp_processor.routing_policy import decide_route

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@pytest.fixture(autouse=True)
def _no_ocr_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default posture: no OCR credentials, so scans must fail closed."""
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)


# --- XLSX -----------------------------------------------------------------


def test_xlsx_is_selected_without_ocr() -> None:
    parser = select_parser(XLSX_MIME, "book.xlsx")
    assert isinstance(parser, XlsxParser)
    assert decide_route(XLSX_MIME, "book.xlsx").document_class == "xlsx"


def test_xlsx_bytes_never_route_to_ocr() -> None:
    decision = decide_route(XLSX_MIME, "pricing.xlsx", pricing_workbook())
    assert decision.parser_id == "xlsx-openpyxl"
    assert decision.escalate is False


# --- DIGITAL_PDF ----------------------------------------------------------


def test_digital_pdf_routes_native() -> None:
    payload = _pdf(DIGITAL_RFP_TEXT)
    decision = decide_route("application/pdf", "rfp.pdf", payload)
    assert decision.document_class == "digital_pdf"
    assert decision.parser_id == "pdf-native"
    assert decision.escalate is False
    assert isinstance(select_parser("application/pdf", "rfp.pdf", payload), PdfParser)


def test_pdf_without_bytes_defaults_to_native_not_ocr() -> None:
    decision = decide_route("application/pdf", "unknown.pdf", None)
    assert decision.parser_id == "pdf-native"
    assert decision.escalate is False


# --- SCANNED_PDF ----------------------------------------------------------


def test_scanned_pdf_escalates_to_ocr_and_fails_closed() -> None:
    payload = _pdf(None)
    decision = decide_route("application/pdf", "scan.pdf", payload)
    assert decision.document_class == "scanned_pdf"
    assert decision.parser_id == "ocr-mistral"
    assert decision.escalate is True
    with pytest.raises(ParserNotWiredError) as excinfo:
        select_parser("application/pdf", "scan.pdf", payload)
    assert "ocr" in str(excinfo.value).lower(), "reason must be recognisable as an OCR escalation"


def test_scanned_pdf_is_wired_when_key_present(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key-not-used-for-network")
    parser = select_parser("application/pdf", "scan.pdf", _pdf(None))
    assert parser.parser_id == "ocr-mistral"


# --- DOCX -----------------------------------------------------------------


def test_docx_routes_native_and_is_wired() -> None:
    payload = sample_docx()
    decision = decide_route(DOCX_MIME, "proposal.docx", payload)
    assert decision.document_class == "docx"
    assert decision.parser_id == "docx-native"
    assert decision.escalate is False
    assert isinstance(select_parser(DOCX_MIME, "proposal.docx", payload), DocxParser)


def test_docx_is_never_treated_as_a_scanned_pdf() -> None:
    decision = decide_route(DOCX_MIME, "proposal.docx", sample_docx())
    assert decision.parser_id != "ocr-mistral"


# --- UNSUPPORTED ----------------------------------------------------------


def test_raster_image_escalates_to_unwired_managed_ocr() -> None:
    decision = decide_route("image/tiff", "scan.tiff")
    assert decision.document_class == "raster_image"
    assert decision.parser_id == "ocr-document-ai"
    assert decision.escalate is True


def test_unknown_type_is_not_silently_ocr() -> None:
    with pytest.raises(ParserNotWiredError):
        select_parser("image/tiff", "scan.tiff")


def test_unrecognised_type_fails_closed_as_unknown() -> None:
    decision = decide_route("text/plain", "notes.txt")
    assert decision.document_class == "unknown"
    assert decision.escalate is True
    assert "ocr" not in decision.reason.lower(), "unknown types are not an OCR problem"
    with pytest.raises(ParserNotWiredError):
        select_parser("text/plain", "notes.txt")


# --- health reporting -----------------------------------------------------


def test_health_reports_ocr_not_ready_without_key() -> None:
    health = routing_health()
    assert health["ocr_ready"] is False
    assert "ocr-mistral" in health["escalate_unwired"]
    assert "docx-native" in health["wired"]
    assert "pdf-native" in health["wired"]
    assert "xlsx-openpyxl" in health["wired"]


def test_health_reports_ocr_ready_with_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key-not-used-for-network")
    health = routing_health()
    assert health["ocr_ready"] is True
    assert "ocr-mistral" in health["wired"]
    assert "ocr-mistral" not in health["escalate_unwired"]
