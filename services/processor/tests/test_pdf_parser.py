from lp_processor.extractors.heuristic import HeuristicExtractor
from lp_processor.parsers.pdf import PdfParser


def _pdf_with_text(text: str) -> bytes:
    stream = f"BT /F1 12 Tf 40 140 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{index} 0 obj\n".encode("ascii"))
        out.extend(body)
        out.extend(b"\nendobj\n")
    xref_start = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        out.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    out.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n".encode(
            "ascii"
        )
    )
    return bytes(out)


def test_pdf_native_parser_extracts_page_text() -> None:
    payload = _pdf_with_text("Hello Phase 4 native parse")
    parsed = PdfParser().parse(payload, mime_type="application/pdf", filename="note.pdf")
    assert parsed.parser_id == "pdf-native"
    assert parsed.page_count == 1
    joined = " ".join(page.text for page in parsed.pages)
    assert "Hello Phase 4 native parse" in joined
    drafts = HeuristicExtractor().extract(parsed)
    page_facts = [d for d in drafts if d.field == "page_1_text"]
    assert page_facts and page_facts[0].source_page == 1
