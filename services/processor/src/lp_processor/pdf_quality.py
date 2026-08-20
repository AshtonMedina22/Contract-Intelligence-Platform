import io

from pypdf import PdfReader

from lp_processor.routing_policy import load_routing_policy


def pdf_chars_per_page(payload: bytes) -> list[int]:
    reader = PdfReader(io.BytesIO(payload))
    counts: list[int] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        counts.append(len(text.strip()))
    return counts


def classify_pdf(payload: bytes) -> tuple[str, float]:
    """Return (digital|scan, mean chars per page). Empty pages count as scan."""
    counts = pdf_chars_per_page(payload)
    if not counts:
        return "scan", 0.0
    mean = sum(counts) / len(counts)
    threshold = load_routing_policy().scan_min_chars_per_page
    if mean < threshold:
        return "scan", mean
    return "digital", mean
