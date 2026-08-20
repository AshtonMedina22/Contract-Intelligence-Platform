from lp_processor.parsers.routing import select_parser
from lp_processor.parsers.xlsx import XlsxParser
from lp_processor.parsers.base import ParserNotWiredError
import pytest


def test_xlsx_is_selected_without_ocr() -> None:
    parser = select_parser(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "book.xlsx",
    )
    assert isinstance(parser, XlsxParser)


def test_unknown_type_is_not_silently_ocr() -> None:
    with pytest.raises(ParserNotWiredError):
        select_parser("image/tiff", "scan.tiff")
