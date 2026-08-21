"""Failure semantics for parse/extract jobs.

The OCR_REQUIRED prefix on documents.lifecycle_error is a UI contract: the Data Ops
processing queue renders the OCR badge from it. A regression let the parse-and-extract
catch-all re-record the same exception without the prefix, blanking the badge, so these
tests assert the prefix on EVERY FAILED write, not just the first one.
"""

from __future__ import annotations

import pytest

from lp_processor.evals.fixtures import _pdf, pricing_workbook
from lp_processor.jobs import (
    EXCEPTION_CODE_OCR_REQUIRED,
    EXCEPTION_CODE_PARSE_FAILED,
    OCR_REQUIRED_PREFIX,
    parse_lifecycle_error,
    run_parse,
    run_parse_and_extract,
)
from lp_processor.models import ProcessorJobRequest
from lp_processor.parsers.base import ParserNotWiredError

ORG = "11111111-1111-1111-1111-111111111111"
DOC = "22222222-2222-2222-2222-222222222222"
VERSION = "33333333-3333-3333-3333-333333333333"


class FakeStore:
    """Records what the processor would write. Mirrors the real Store's status guard."""

    _ALLOWED_STATUSES = frozenset(
        {"UPLOADED", "QUEUED", "PARSING", "EXTRACTING", "VALIDATING", "NEEDS_REVIEW", "FAILED"}
    )

    def __init__(self, payload: bytes, *, filename: str, mime_type: str) -> None:
        self.payload = payload
        self.filename = filename
        self.mime_type = mime_type
        self.statuses: list[tuple[str, str | None]] = []
        self.exceptions: list[tuple[str, str]] = []
        self.normalized: list[object] = []
        self.finished: list[tuple[str, str | None]] = []
        self.downloads = 0

    def load_job_context(self, req: ProcessorJobRequest) -> dict:
        return {
            "version": {"storage_bucket": "intake", "storage_path": f"{ORG}/{DOC}/{VERSION}/x.pdf"},
            "document": {
                "original_filename": self.filename,
                "mime_type": self.mime_type,
                "document_type": None,
            },
        }

    def download_evidence(self, bucket: str, path: str) -> bytes:
        self.downloads += 1
        return self.payload

    def set_status(
        self, document_id: str, organization_id: str, status: str, error: str | None = None
    ) -> None:
        assert status != "VERIFIED", "processor must never write VERIFIED"
        assert status in self._ALLOWED_STATUSES, f"unexpected status {status}"
        if error is not None:
            assert len(error) <= 500, "lifecycle_error must fit the column budget"
        self.statuses.append((status, error))

    def add_exception(self, organization_id: str, document_id: str, code: str, message: str) -> None:
        self.exceptions.append((code, message))

    def ensure_run(self, req: ProcessorJobRequest, parser_id: str, extractor_id: str) -> str:
        return "44444444-4444-4444-4444-444444444444"

    def save_normalized(self, run_id, document, parser_id, extractor_id) -> None:
        self.normalized.append(document)

    def finish_run(self, run_id: str, error: str | None = None) -> None:
        self.finished.append((run_id, error))

    # -- assertions helpers ------------------------------------------------
    @property
    def failed_errors(self) -> list[str]:
        return [error or "" for status, error in self.statuses if status == "FAILED"]


def request() -> ProcessorJobRequest:
    return ProcessorJobRequest(organization_id=ORG, document_id=DOC, document_version_id=VERSION)


def scanned_store() -> FakeStore:
    return FakeStore(_pdf(None), filename="scan.pdf", mime_type="application/pdf")


# --- formatter ------------------------------------------------------------


def test_ocr_escalation_message_gets_prefix() -> None:
    error = parse_lifecycle_error(
        ParserNotWiredError("Escalate to OCR; do not accept empty native parse. parser_id=ocr-mistral")
    )
    assert error.startswith(OCR_REQUIRED_PREFIX)


def test_prefix_application_is_idempotent() -> None:
    once = parse_lifecycle_error(ParserNotWiredError("needs OCR"))
    twice = parse_lifecycle_error(ParserNotWiredError(once))
    assert once == twice
    assert twice.count(OCR_REQUIRED_PREFIX) == 1


def test_non_ocr_message_is_not_relabelled() -> None:
    error = parse_lifecycle_error(ValueError("document_version not found for organization."))
    assert not error.startswith(OCR_REQUIRED_PREFIX)


def test_long_ocr_message_stays_prefixed_and_within_budget() -> None:
    error = parse_lifecycle_error(ParserNotWiredError("ocr-mistral " + "x" * 5000))
    assert error.startswith(OCR_REQUIRED_PREFIX)
    assert len(error) <= 500


# --- scanned PDF without credentials -------------------------------------


def test_scanned_pdf_without_key_escalates_from_run_parse(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    store = scanned_store()
    with pytest.raises(ParserNotWiredError):
        run_parse(request(), store=store)
    assert store.failed_errors, "a scanned PDF with no OCR key must be recorded FAILED"
    assert all(error.startswith(OCR_REQUIRED_PREFIX) for error in store.failed_errors)


def test_parse_and_extract_never_strips_the_ocr_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression: the catch-all used to overwrite lifecycle_error with an unprefixed copy."""
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    store = scanned_store()
    with pytest.raises(ParserNotWiredError):
        run_parse_and_extract(request(), store=store)
    assert len(store.failed_errors) >= 1
    unprefixed = [error for error in store.failed_errors if not error.startswith(OCR_REQUIRED_PREFIX)]
    assert not unprefixed, f"OCR badge lost by a later write: {unprefixed}"


def test_scanned_pdf_records_ocr_error_class_and_human_reason(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    store = scanned_store()
    with pytest.raises(ParserNotWiredError):
        run_parse_and_extract(request(), store=store)
    codes = [code for code, _ in store.exceptions]
    assert EXCEPTION_CODE_OCR_REQUIRED in codes
    reason = next(message for code, message in store.exceptions if code == EXCEPTION_CODE_OCR_REQUIRED)
    assert "MISTRAL_API_KEY" in reason, "the human reason must say how to unblock the document"


def test_scanned_pdf_never_fabricates_text(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    store = scanned_store()
    with pytest.raises(ParserNotWiredError):
        run_parse_and_extract(request(), store=store)
    assert store.normalized == [], "an unreadable scan must not be stored as a successful parse"
    assert not any(status == "NEEDS_REVIEW" for status, _ in store.statuses)


# --- other failure classes stay distinguishable ---------------------------


def test_unsupported_type_is_not_labelled_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    store = FakeStore(b"plain text", filename="notes.txt", mime_type="text/plain")
    with pytest.raises(ParserNotWiredError):
        run_parse_and_extract(request(), store=store)
    assert store.failed_errors
    assert all(not error.startswith(OCR_REQUIRED_PREFIX) for error in store.failed_errors)
    assert EXCEPTION_CODE_PARSE_FAILED in [code for code, _ in store.exceptions]


# --- happy path still parses and stages ----------------------------------


def test_digital_workbook_parses_without_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    store = FakeStore(
        pricing_workbook(),
        filename="pricing.xlsx",
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    result = run_parse(request(), store=store)
    assert result["parser_id"] == "xlsx-openpyxl"
    assert store.failed_errors == []
    assert len(store.normalized) == 1
