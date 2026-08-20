from lp_processor.evals.harness import run_benchmark
from lp_processor.parsers.base import ParserNotWiredError
from lp_processor.parsers.routing import select_parser
from lp_processor.parsers.xlsx import XlsxParser
from lp_processor.routing_policy import decide_route, load_routing_policy


def test_xlsx_never_routes_to_ocr() -> None:
    decision = decide_route(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "book.xlsx",
        b"unused",
    )
    assert decision.parser_id == "xlsx-openpyxl"
    assert decision.wired is True
    assert isinstance(
        select_parser(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "book.xlsx",
        ),
        XlsxParser,
    )


def test_empty_pdf_escalates_to_unwired_ocr() -> None:
    from lp_processor.evals.fixtures import fixture_cases

    scan = next(case for case in fixture_cases() if case.case_id == "scanned_pdf_empty_text")
    decision = decide_route(scan.mime_type, scan.filename, scan.payload)
    assert decision.parser_id == "ocr-mistral"
    assert decision.escalate is True
    try:
        select_parser(scan.mime_type, scan.filename, scan.payload)
        raise AssertionError("scan must not silently use pdf-native")
    except ParserNotWiredError as exc:
        assert "ocr-mistral" in str(exc)


def test_tiff_still_does_not_guess_ocr_success() -> None:
    decision = decide_route("image/tiff", "scan.tiff")
    assert decision.escalate is True
    try:
        select_parser("image/tiff", "scan.tiff")
        raise AssertionError("expected escalate")
    except ParserNotWiredError:
        pass


def test_fixture_benchmark_routes_and_xlsx_cells() -> None:
    report = run_benchmark()
    assert report["lp_packages_scored"] == 0
    assert report["cloud_run_required"] is False
    assert report["fixture_routes_ok"] == report["fixture_cases"]
    by_id = {row["case_id"]: row for row in report["rows"]}
    assert by_id["xlsx_pricing_workbook"]["table_cell_accuracy"] == 1.0
    assert by_id["digital_rfp_pdf"]["requirement_recall"] == 1.0
    assert by_id["scanned_pdf_empty_text"]["scan_quality"] == "escalated"
    assert by_id["form_checkbox_unwired"]["forms"] is None
    assert load_routing_policy().version == report["policy_version"]
