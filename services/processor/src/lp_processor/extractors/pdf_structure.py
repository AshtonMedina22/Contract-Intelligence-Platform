from __future__ import annotations

import re

from lp_processor.models import ExtractedFactDraft, NormalizedDocument

_HOURLY = re.compile(r"\$\s*(\d{1,2}\.\d{2})\b")
_SOLICITATION = re.compile(
    r"\b(?:RFP|RFQ|IFB|RQ)\s*[#:]?\s*([A-Z0-9][A-Z0-9\-/.]{3,})\b|"
    r"\b(TXMAS-\d{2}-\d+)\b|"
    r"\b(22-0143|18-009/?YS|RQ22-0480DP|0000016167)\b",
    re.I,
)
_AWARD = re.compile(
    r"(all bids rejected|notice of award|awarded to|award amount|minute order)",
    re.I,
)
_SHALL = re.compile(r"([^\n.]{0,80}\b(?:shall|must)\b[^\n.]{10,200})", re.I)
_LP_NEAR = re.compile(r"L\s*[&+]\s*P|L\s+AND\s+P|GLOBAL SECURITY", re.I)


def rate_field_for_filename(filename: str | None) -> str:
    blob = (filename or "").lower()
    if any(token in blob for token in ("amend", "renewal", "option")):
        return "current_rate"
    if any(token in blob for token in ("proposal", "quote")):
        return "proposed_rate"
    if any(token in blob for token in ("rfp", "rfq", "ifb", "invitation", "solicitation")):
        return "requested_rate"
    if (
        re.search(r"\bpo\b", blob)
        or any(
            token in blob
            for token in (
                "purchase",
                "award",
                "tabulation",
                "bid tab",
                "contract",
                "agreement",
                "eval",
                "staff-report",
                "staff report",
            )
        )
    ):
        return "awarded_rate"
    return "proposed_rate"


def extract_pdf_structure(document: NormalizedDocument) -> list[ExtractedFactDraft]:
    drafts: list[ExtractedFactDraft] = []
    filename = document.filename
    rate_field = rate_field_for_filename(filename)
    rate_candidates: list[tuple[str, int, str, bool]] = []
    found_solicitation = False
    found_award = False
    requirement_count = 0

    for page in document.pages:
        text = page.text or ""
        if not text.strip():
            continue

        for match in _HOURLY.finditer(text):
            amount = match.group(1)
            value = float(amount)
            if value < 12 or value > 80:
                continue
            window = text[max(0, match.start() - 80) : match.end() + 80]
            rate_candidates.append((amount, page.page, window.strip()[:500], bool(_LP_NEAR.search(window))))

        if not found_solicitation:
            sol = _SOLICITATION.search(text)
            if sol:
                number = next(g for g in sol.groups() if g)
                found_solicitation = True
                start, end = sol.span()
                excerpt = text[max(0, start - 40) : end + 40].strip()[:500]
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"solicitation:{page.page}:{number}"[:200],
                        entity="solicitation",
                        field="solicitation_number",
                        raw_value=number,
                        normalized_value=number,
                        normalized_type="identifier",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=excerpt,
                        confidence=0.75,
                    )
                )

        if not found_award:
            award = _AWARD.search(text)
            if award:
                found_award = True
                start, end = award.span()
                excerpt = text[max(0, start - 60) : end + 80].strip()[:500]
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"award:{page.page}"[:200],
                        entity="award",
                        field="award",
                        raw_value=award.group(0),
                        normalized_value=award.group(0),
                        normalized_type="award",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=excerpt,
                        confidence=0.65,
                    )
                )

        if rate_field == "requested_rate" and requirement_count < 3:
            for req in _SHALL.finditer(text):
                statement = " ".join(req.group(1).split())
                if len(statement) < 24:
                    continue
                requirement_count += 1
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"requirement:{page.page}:{requirement_count}"[:200],
                        entity="requirement",
                        field="requirement",
                        raw_value=statement[:8000],
                        normalized_value=statement[:8000],
                        normalized_type="requirement",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=statement[:500],
                        confidence=0.55,
                    )
                )
                if requirement_count >= 3:
                    break

    preferred = [c for c in rate_candidates if c[3]] or rate_candidates
    limit = 3 if rate_field == "requested_rate" else 1
    seen: set[str] = set()
    for amount, page_no, excerpt, _lp in preferred:
        if amount in seen:
            continue
        seen.add(amount)
        drafts.insert(
            0,
            ExtractedFactDraft(
                idempotency_key=f"rate:{page_no}:{amount}"[:200],
                entity="hourly",
                field=rate_field,
                raw_value=f"${amount}",
                normalized_value=amount,
                normalized_type="rate",
                source_page=page_no,
                source_section=f"page {page_no}",
                source_excerpt=excerpt,
                confidence=0.7,
            ),
        )
        if len(seen) >= limit:
            break

    return drafts
