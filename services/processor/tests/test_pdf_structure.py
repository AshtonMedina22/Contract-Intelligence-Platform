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


def test_po_extractor_rejects_political_word_fragments() -> None:
    doc = NormalizedDocument(
        parser_id="pdf-native",
        filename="SRC-20_Terrell_ISD_LP_Security_Officer_Agreement.pdf",
        pages=[
            PdfPage(
                page=1,
                text="political subdivision of the State. positions identified in Exhibit A. possible action.",
            )
        ],
    )
    drafts = extract_pdf_structure(doc)
    assert not [d for d in drafts if d.field == "po_number"]


def test_po_extractor_accepts_real_po_number() -> None:
    doc = NormalizedDocument(
        parser_id="pdf-native",
        filename="TxDMV_PO.pdf",
        pages=[PdfPage(page=1, text="Purchase Order #0000016167 for armed security")],
    )
    drafts = extract_pdf_structure(doc)
    pos = [d for d in drafts if d.field == "po_number"]
    assert len(pos) == 1
    assert pos[0].normalized_value == "0000016167"


def test_term_range_emits_start_and_end_once() -> None:
    doc = NormalizedDocument(
        parser_id="pdf-native",
        filename="agreement.pdf",
        pages=[
            PdfPage(
                page=1,
                text="The term of this contract shall commence on 08/01/2025 and automatically terminate on 07/31/2026.",
            )
        ],
    )
    drafts = extract_pdf_structure(doc)
    starts = [d for d in drafts if d.field == "contract_start"]
    ends = [d for d in drafts if d.field == "contract_end"]
    assert len(starts) == 1 and starts[0].normalized_value == "2025-08-01"
    assert len(ends) == 1 and ends[0].normalized_value == "2026-07-31"


def test_lp_named_on_board_agenda_emits_award_vendor() -> None:
    doc = NormalizedDocument(
        parser_id="pdf-native",
        filename="SRC-23_Mesquite_agenda.pdf",
        pages=[
            PdfPage(
                page=1,
                text="II.A. Action - Approve Armed Security Services Contract with L&P Global Security, LLC",
            )
        ],
    )
    drafts = extract_pdf_structure(doc)
    awards = [d for d in drafts if d.field == "awarded_vendor"]
    assert len(awards) == 1
    assert awards[0].normalized_value == "L&P Global Security"


def test_glued_boardbook_esr_emits_nte_and_lp_award() -> None:
    doc = NormalizedDocument(
        parser_id="pdf-native",
        filename="SRC-24_Terrell_ISD_2023_LP_Negotiate_ESR.pdf",
        pages=[
            PdfPage(
                page=1,
                text=(
                    "Consider authorization of Superintendent to negotiate contract for unarmed and "
                    "armed security guard services with LandPGlobal Securities, LLC nottoexceed$300, 000"
                ),
            )
        ],
    )
    drafts = extract_pdf_structure(doc)
    awards = [d for d in drafts if d.field == "awarded_vendor"]
    ntes = [d for d in drafts if d.field == "contract_nte"]
    assert len(awards) == 1
    assert awards[0].normalized_value == "L&P Global Security"
    assert len(ntes) == 1
    assert ntes[0].normalized_value == "300000"
