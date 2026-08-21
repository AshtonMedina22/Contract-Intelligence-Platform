"""Contract tests for the Mistral OCR adapter.

These run without credentials and must never touch the network. The point is to prove the
adapter escalates instead of inventing text, since a fabricated page would flow straight
into staging facts as if it had been read off the source.
"""

from __future__ import annotations

import pytest

from lp_processor.evals.fixtures import _pdf
from lp_processor.parsers import ocr_mistral
from lp_processor.parsers.base import ParserNotWiredError
from lp_processor.parsers.ocr_mistral import MistralOcrParser


@pytest.fixture
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def explode(*args: object, **kwargs: object) -> None:
        raise AssertionError("OCR adapter must not open an HTTP client without credentials")

    monkeypatch.setattr(ocr_mistral.httpx, "Client", explode)


def test_missing_key_escalates_without_calling_the_api(
    monkeypatch: pytest.MonkeyPatch, no_network: None
) -> None:
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    with pytest.raises(ParserNotWiredError) as excinfo:
        MistralOcrParser().parse(_pdf(None), mime_type="application/pdf", filename="scan.pdf")
    assert "MISTRAL_API_KEY" in str(excinfo.value)


def test_blank_key_is_treated_as_absent(monkeypatch: pytest.MonkeyPatch, no_network: None) -> None:
    monkeypatch.setenv("MISTRAL_API_KEY", "   ")
    with pytest.raises(ParserNotWiredError):
        MistralOcrParser().parse(_pdf(None), mime_type="application/pdf", filename="scan.pdf")


def test_adapter_claims_pdf_support_only() -> None:
    parser = MistralOcrParser()
    assert parser.supports("application/pdf", "scan.pdf") is True
    assert parser.supports("image/tiff", "scan.tiff") is False
    assert (
        parser.supports("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "p.xlsx")
        is False
    ), "pricing workbooks must never reach OCR"


def test_empty_ocr_response_escalates_instead_of_returning_a_blank_document(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An OCR call that returns no pages is a failure, not an empty success."""
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key")

    class Response:
        status_code = 200

        @staticmethod
        def json() -> dict:
            return {"pages": []}

    class Client:
        def __enter__(self) -> "Client":
            return self

        def __exit__(self, *exc: object) -> None:
            return None

        def post(self, *args: object, **kwargs: object) -> Response:
            return Response()

    monkeypatch.setattr(ocr_mistral.httpx, "Client", lambda **kwargs: Client())
    with pytest.raises(ParserNotWiredError) as excinfo:
        MistralOcrParser().parse(_pdf(None), mime_type="application/pdf", filename="scan.pdf")
    assert "no pages" in str(excinfo.value).lower()


def test_api_failure_escalates_and_stays_recognisable_as_ocr(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key")

    class Response:
        status_code = 429
        text = "rate limited"

    class Client:
        def __enter__(self) -> "Client":
            return self

        def __exit__(self, *exc: object) -> None:
            return None

        def post(self, *args: object, **kwargs: object) -> Response:
            return Response()

    monkeypatch.setattr(ocr_mistral.httpx, "Client", lambda **kwargs: Client())
    with pytest.raises(ParserNotWiredError) as excinfo:
        MistralOcrParser().parse(_pdf(None), mime_type="application/pdf", filename="scan.pdf")
    message = str(excinfo.value)
    assert "ocr-mistral" in message
    # jobs.parse_lifecycle_error keys the OCR badge off this substring.
    assert "ocr" in message.lower()


def test_successful_ocr_keeps_page_provenance(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key")

    class Response:
        status_code = 200

        @staticmethod
        def json() -> dict:
            return {"pages": [{"markdown": "Armed officer $33.25"}, {"markdown": "Page two"}]}

    class Client:
        def __enter__(self) -> "Client":
            return self

        def __exit__(self, *exc: object) -> None:
            return None

        def post(self, *args: object, **kwargs: object) -> Response:
            return Response()

    monkeypatch.setattr(ocr_mistral.httpx, "Client", lambda **kwargs: Client())
    parsed = MistralOcrParser().parse(_pdf(None), mime_type="application/pdf", filename="scan.pdf")
    assert parsed.parser_id == "ocr-mistral"
    assert parsed.page_count == 2
    assert [page.page for page in parsed.pages] == [1, 2]
    assert "Armed officer $33.25" in parsed.pages[0].text
