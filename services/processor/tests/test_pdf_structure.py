from lp_processor.extractors.pdf_structure import extract_pdf_structure, rate_field_for_filename
from lp_processor.models import NormalizedDocument, PdfPage
from lp_processor.parsers.pdf import PdfParser
from test_pdf_parser import _pdf_with_text


def test_rate_field_follows_filename_truth() -> None:
    assert rate_field_for_filename("proposal_Final.pdf") == "proposed_rate"
    assert rate_field_for_filename("22-0143-bid-invitation.pdf") == "requested_rate"
    assert rate_field_for_filename("60800 0000016167.pdf purchase order") == "awarded_rate"
    assert rate_field_for_filename("VSA 24-001 Amend 4.pdf") == "current_rate"


def test_structured_extractor_emits_hourly_rate_with_page_provenance() -> None:
    parsed = PdfParser().parse(
        _pdf_with_text("Unarmed officer $31.45 /hr L&P Global Security"),
        mime_type="application/pdf",
        filename="Services_Contract_with_proposal_Final.pdf",
    )
    drafts = extract_pdf_structure(parsed)
    rates = [d for d in drafts if d.field == "proposed_rate"]
    assert len(rates) == 1
    assert rates[0].normalized_value == "31.45"
    assert rates[0].source_page == 1
    assert "$31.45" in (rates[0].source_excerpt or "")
    assert rates[0].normalized_type == "rate"


def test_structured_extractor_ignores_non_hourly_amounts() -> None:
    doc = NormalizedDocument(
        parser_id="pdf-native",
        filename="award.pdf",
        pages=[PdfPage(page=1, text="Total award $960343.00 and score 90.46")],
    )
    drafts = extract_pdf_structure(doc)
    assert not [d for d in drafts if d.normalized_type == "rate"]
