from __future__ import annotations

import re

from lp_processor.models import ExtractedFactDraft, NormalizedDocument

_HOURLY = re.compile(r"\$\s*(\d{1,2}\.\d{2})\b")
_SOLICITATION = re.compile(
    r"\b(?:RFP|RFQ|IFB|RQ)\s*[#:]?\s*([A-Z0-9][A-Z0-9\-/.]{3,})\b|"
    r"\b(22-0143|18-009/?YS|RQ22-0480DP)\b",
    re.I,
)
_TXMAS = re.compile(r"\b(TXMAS-\d{2}-\d+)\b", re.I)
_GSA = re.compile(r"\b(GSA\s*(?:MAS\s*)?(?:Contract\s*)?(?:#\s*)?(47[A-Z0-9]{8,}))\b|" r"\b(47QSWA\d{2}[A-Z0-9]+)\b", re.I)
# Require a real PO token (not the letters "po" inside "political"/"positions")
# and a value that contains at least one digit.
_PO = re.compile(
    r"(?<![A-Za-z])(?:P\.O\.|PO|Purchase\s+Order)\s*(?:No\.?|Number|#|:)?\s*"
    r"([A-Z0-9\-]*\d[A-Z0-9\-]{3,})\b|"
    r"\b(00000\d{5,})\b|"
    r"\b(0000016167)\b",
    re.I,
)
_CONTRACT_NO = re.compile(
    r"\b(?:Contract|Agreement)\s*(?:No\.?|Number|#)\s*:?\s*([A-Z0-9][A-Z0-9\-/]{3,})\b|"
    r"\b(#?\d{5,6})\b(?=[^\n]{0,40}(?:contract|agreement))",
    re.I,
)
_AWARD = re.compile(
    r"(all bids rejected|notice of award|awarded to|award amount|minute order|\$\s*960,?343)",
    re.I,
)
_SHALL = re.compile(r"([^\n.]{0,80}\b(?:shall|must)\b[^\n.]{10,200})", re.I)
# Include glued BoardBook/OCR forms like "LandPGlobal Securities" / "GLOBALSECURITY".
_LP_NEAR = re.compile(
    r"L\s*[&+]\s*P|L\s*AND\s*P|LANDP(?:GLOBAL)?|GLOBAL\s*SECURITY",
    re.I,
)
_VSA_NEAR = re.compile(r"Vets\s+Securing|VSA\b|Veterans?\s+Securing", re.I)
_SCORE_ROW = re.compile(
    r"(\d{1,3}\.\d{2})\s+(\d{1,3}\.\d{2})\s+(\d{1,3}\.\d{2})\s+([A-Za-z][A-Za-z0-9 &.,'/+\-]{2,80})",
    re.I,
)
_AMEND = re.compile(r"\bAmend(?:ment)?\s*(?:No\.?|#)?\s*(\d+)\b", re.I)
_CPI = re.compile(r"\b(CPI-W|CPI-U|CPI)\b", re.I)
_LEVEL = re.compile(r"\b(Level\s+(?:I{1,3}|[123]))\b", re.I)
_SECTION = re.compile(
    r"^\s*((?:STAFFING|MANAGEMENT|TRANSITION|TRAINING|QUALITY|EMERGENCY|TECHNOLOGY|"
    r"PAST\s+PERFORMANCE|SCOPE\s+OF\s+WORK|PRICING)[^\n]{0,60})",
    re.I | re.M,
)
_ATTACHMENT_FORM = re.compile(
    r"\b(ATTACHMENT\s+[A-Z0-9\-]+)\s*[–—\-:.]?\s*([A-Za-z][A-Za-z0-9 /,&()\-]{3,80})",
    re.I,
)
_COST_LABEL = re.compile(
    r"\b(Direct Wages|Fed/State Unemp Tax, FICA, Med Tax|Workers Comp|"
    r"Med/Den/Life Insurance|Retirement/Pension|"
    r"Supplies, Equipment Cost/Upkeep/\s*Depreciation|Overhead/Profit|"
    r"Total Hourly Rate)\b",
    re.I,
)
_COST_AMOUNT = re.compile(r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\$")
_TERM_RANGE = re.compile(
    r"(?:commence|commencing|begin|beginning|start(?:s|ing)?|term)\s+(?:on\s+|as\s+of\s+)?"
    r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}).{0,80}?"
    r"(?:terminat\w+|end(?:s|ing)?|through|thru|until|to)\s+(?:on\s+)?"
    r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
    re.I | re.S,
)
_NTE = re.compile(
    r"(?:not\s*to\s*exceed|NTE)\s*(?:of\s*)?\$?\s*([\d,\s]+(?:\.\d{2})?)",
    re.I,
)
_LP_TOKEN = r"(?:L\s*[&+]\s*P|L\s*AND\s*P|LANDP(?:GLOBAL)?|GLOBAL\s*SECURITY)"
_LP_CONTRACT_ACTION = re.compile(
    rf"(?:approve|consider|authorization|negotiate|contract\s+(?:for|with)|armed\s+security|presentation|contractor).{{0,120}}"
    rf"{_LP_TOKEN}|"
    rf"{_LP_TOKEN}.{{0,120}}"
    rf"(?:contract|security\s+services|security\s+contractor|presentation|negotiate)",
    re.I | re.S,
)


def _plausible_po_number(raw: str | None) -> str | None:
    """Reject alphabetic fragments captured from words like political/positions."""
    if not raw:
        return None
    val = raw.strip()
    if len(val) < 5:
        return None
    if not re.search(r"\d", val):
        return None
    if not re.fullmatch(r"[A-Z0-9\-]+", val, re.I):
        return None
    return val


def _to_iso_date(raw: str) -> str | None:
    parts = re.split(r"[/-]", raw.strip())
    if len(parts) != 3:
        return None
    try:
        mm, dd, yy = (int(parts[0]), int(parts[1]), int(parts[2]))
    except ValueError:
        return None
    if yy < 100:
        yy += 2000
    if not (1 <= mm <= 12 and 1 <= dd <= 31 and 1990 <= yy <= 2100):
        return None
    return f"{yy:04d}-{mm:02d}-{dd:02d}"


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


def _is_bid_tab(filename: str | None) -> bool:
    blob = (filename or "").lower()
    return any(t in blob for t in ("tabulation", "bid tab", "bid_tab", "_tab_", "tab."))


def extract_pdf_structure(document: NormalizedDocument) -> list[ExtractedFactDraft]:
    drafts: list[ExtractedFactDraft] = []
    filename = document.filename
    rate_field = rate_field_for_filename(filename)
    rate_candidates: list[tuple[str, int, str, bool]] = []
    found_solicitation = False
    found_award = False
    found_po = False
    found_contract = False
    found_txmas = False
    found_gsa = False
    found_amend = False
    found_cpi = False
    requirement_count = 0
    score_count = 0
    section_count = 0
    level_count = 0
    form_count = 0
    cost_count = 0
    found_term = False
    found_nte = False
    found_lp_action = False

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

        if not found_txmas:
            tx = _TXMAS.search(text)
            if tx:
                found_txmas = True
                val = tx.group(1)
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"txmas:{val}"[:200],
                        entity="federal",
                        field="txmas",
                        raw_value=val,
                        normalized_value=val,
                        normalized_type="identifier",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=text[max(0, tx.start() - 30) : tx.end() + 30].strip()[:500],
                        confidence=0.85,
                    )
                )

        if not found_gsa:
            gsa = _GSA.search(text)
            if gsa:
                found_gsa = True
                val = next(g for g in gsa.groups() if g)
                val = re.sub(r"\s+", "", val.upper().replace("GSA", "").replace("MAS", "").replace("CONTRACT", "").replace("#", ""))
                if not val.startswith("47"):
                    val = gsa.group(0)
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"gsa:{val}"[:200],
                        entity="federal",
                        field="gsa",
                        raw_value=val,
                        normalized_value=val,
                        normalized_type="identifier",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=text[max(0, gsa.start() - 30) : gsa.end() + 30].strip()[:500],
                        confidence=0.8,
                    )
                )

        if not found_po:
            po = _PO.search(text) or _PO.search(filename or "")
            if po:
                po_num = _plausible_po_number(next(g for g in po.groups() if g))
                if po_num:
                    found_po = True
                    drafts.append(
                        ExtractedFactDraft(
                            idempotency_key=f"po:{po_num}"[:200],
                            entity="purchase_order",
                            field="po_number",
                            raw_value=po_num,
                            normalized_value=po_num,
                            normalized_type="identifier",
                            source_page=page.page,
                            source_section=f"page {page.page}",
                            source_excerpt=text[max(0, (po.start() if po.start() < len(text) else 0) - 20) : (po.end() if po.end() < len(text) else 40) + 20].strip()[:500]
                            or (filename or po_num),
                            confidence=0.85,
                        )
                    )

        if not found_contract and ("contract" in (filename or "").lower() or "agreement" in (filename or "").lower()):
            cn = _CONTRACT_NO.search(text)
            if cn:
                found_contract = True
                num = next(g for g in cn.groups() if g)
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"contract_number:{num}"[:200],
                        entity="contract",
                        field="contract_number",
                        raw_value=num,
                        normalized_value=num,
                        normalized_type="identifier",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=text[max(0, cn.start() - 40) : cn.end() + 40].strip()[:500],
                        confidence=0.7,
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

        if score_count < 8 and (
            "staff" in (filename or "").lower()
            or "eval" in (filename or "").lower()
            or "award" in (filename or "").lower()
            or "report" in (filename or "").lower()
        ):
            for sc in _SCORE_ROW.finditer(text):
                total = sc.group(3)
                vendor = " ".join(sc.group(4).split())[:80]
                val = float(total)
                if val < 20 or val > 100:
                    continue
                score_count += 1
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"eval:{page.page}:{vendor}:{total}"[:200],
                        entity=vendor[:80],
                        field="evaluation_score",
                        raw_value=total,
                        normalized_value=total,
                        normalized_type="number",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=sc.group(0).strip()[:500],
                        confidence=0.75,
                    )
                )
                if score_count >= 8:
                    break

        if not found_amend and ("amend" in (filename or "").lower() or "amend" in text.lower()[:500]):
            am = _AMEND.search(text) or _AMEND.search(filename or "")
            if am:
                found_amend = True
                num = am.group(1)
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"amendment:{num}"[:200],
                        entity="amendment",
                        field="amendment_number",
                        raw_value=num,
                        normalized_value=num,
                        normalized_type="identifier",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=text[max(0, am.start() - 30) : am.end() + 30].strip()[:500] if am.start() < len(text) else filename or num,
                        confidence=0.8,
                    )
                )

        blob_l = (filename or "").lower()
        renewish = "renew" in blob_l or "cpi" in text.lower() or "consumer price index" in text.lower()
        if not found_cpi and renewish:
            cpi = _CPI.search(text)
            if cpi:
                found_cpi = True
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"escalation:{cpi.group(1)}"[:200],
                        entity="escalation",
                        field="escalation_index",
                        raw_value=cpi.group(1),
                        normalized_value=cpi.group(1),
                        normalized_type="identifier",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=text[max(0, cpi.start() - 40) : cpi.end() + 40].strip()[:500],
                        confidence=0.75,
                    )
                )

        if form_count < 12 and (
            "ifb" in blob_l
            or "solicitation" in blob_l
            or "rq22" in blob_l
            or "lottery" in blob_l
            or "attachment" in text.lower()[:2000]
        ):
            for att in _ATTACHMENT_FORM.finditer(text):
                code = " ".join(att.group(1).split()).upper()
                title = " ".join(att.group(2).split())[:120]
                if re.search(r"\b(page|section|see)\b", title, re.I):
                    continue
                label = f"{code} — {title}"
                form_count += 1
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"form:{code}"[:200],
                        entity="required_form",
                        field="required_form",
                        raw_value=label,
                        normalized_value=label,
                        normalized_type="text",
                        source_page=page.page,
                        source_section=code,
                        source_excerpt=att.group(0).strip()[:500],
                        confidence=0.7,
                    )
                )
                if form_count >= 12:
                    break

        if cost_count < 10 and (
            "cost" in blob_l
            or "tarrant" in blob_l
            or "2018-092" in blob_l
            or "direct wages" in text.lower()
        ):
            seen_labels: set[str] = set()
            for lab in _COST_LABEL.finditer(text):
                label = " ".join(lab.group(1).split())
                key = label.lower()
                if key in seen_labels:
                    continue
                seen_labels.add(key)
                window = text[lab.end() : lab.end() + 80]
                am = _COST_AMOUNT.search(window) or re.search(r"\$\s*(\d{1,3}(?:\.\d{2}))", window)
                amount = am.group(1).replace(",", "") if am else None
                cost_count += 1
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"cost:{page.page}:{key}"[:200],
                        entity=label[:80],
                        field="cost_component",
                        raw_value=amount or label,
                        normalized_value=amount or label,
                        normalized_type="number" if amount else "text",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=text[max(0, lab.start() - 20) : lab.end() + 40].strip()[:500],
                        confidence=0.65 if amount else 0.55,
                    )
                )
                if cost_count >= 10:
                    break

        if not found_term and (
            "contract" in blob_l
            or "agreement" in blob_l
            or "commence" in text.lower()
            or "term" in text.lower()[:800]
        ):
            term = _TERM_RANGE.search(text)
            if term:
                start_iso = _to_iso_date(term.group(1))
                end_iso = _to_iso_date(term.group(2))
                if start_iso and end_iso:
                    found_term = True
                    drafts.append(
                        ExtractedFactDraft(
                            idempotency_key=f"term-start:{start_iso}"[:200],
                            entity="contract",
                            field="contract_start",
                            raw_value=term.group(1),
                            normalized_value=start_iso,
                            normalized_type="identifier",
                            source_page=page.page,
                            source_section=f"page {page.page}",
                            source_excerpt=text[max(0, term.start() - 20) : term.end() + 20].strip()[:500],
                            confidence=0.8,
                        )
                    )
                    drafts.append(
                        ExtractedFactDraft(
                            idempotency_key=f"term-end:{end_iso}"[:200],
                            entity="contract",
                            field="contract_end",
                            raw_value=term.group(2),
                            normalized_value=end_iso,
                            normalized_type="identifier",
                            source_page=page.page,
                            source_section=f"page {page.page}",
                            source_excerpt=text[max(0, term.start() - 20) : term.end() + 20].strip()[:500],
                            confidence=0.8,
                        )
                    )

        if not found_nte:
            nte = _NTE.search(text)
            if nte:
                amount = re.sub(r"[,\s]", "", nte.group(1))
                if amount and re.fullmatch(r"\d+(?:\.\d{2})?", amount):
                    found_nte = True
                    drafts.append(
                        ExtractedFactDraft(
                            idempotency_key=f"nte:{amount}"[:200],
                            entity="contract",
                            field="contract_nte",
                            raw_value=f"${nte.group(1).strip()}",
                            normalized_value=amount,
                            normalized_type="number",
                            source_page=page.page,
                            source_section=f"page {page.page}",
                            source_excerpt=nte.group(0).strip()[:500],
                            confidence=0.75,
                        )
                    )

        if not found_lp_action and _LP_CONTRACT_ACTION.search(text):
            found_lp_action = True
            m = _LP_CONTRACT_ACTION.search(text)
            drafts.append(
                ExtractedFactDraft(
                    idempotency_key="award:lp_named_on_record"[:200],
                    entity="award",
                    field="awarded_vendor",
                    raw_value="L&P Global Security",
                    normalized_value="L&P Global Security",
                    normalized_type="award",
                    source_page=page.page,
                    source_section=f"page {page.page}",
                    source_excerpt=(m.group(0) if m else text[:200]).strip()[:500],
                    confidence=0.7,
                )
            )

        if level_count < 3 and ("contract" in (filename or "").lower() or "vsa" in (filename or "").lower() or "tfc" in (filename or "").lower()):
            for lv in _LEVEL.finditer(text):
                level_count += 1
                label = lv.group(1)
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"site:{page.page}:{label}"[:200],
                        entity="service_plan",
                        field="guard_classification",
                        raw_value=label,
                        normalized_value=label,
                        normalized_type="text",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=text[max(0, lv.start() - 40) : lv.end() + 60].strip()[:500],
                        confidence=0.65,
                    )
                )
                if level_count >= 3:
                    break

        if section_count < 4 and "proposal" in (filename or "").lower():
            for sec in _SECTION.finditer(text):
                label = " ".join(sec.group(1).split())[:120]
                section_count += 1
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"section:{page.page}:{section_count}"[:200],
                        entity="proposal",
                        field="proposal_section",
                        raw_value=label,
                        normalized_value=label,
                        normalized_type="text",
                        source_page=page.page,
                        source_section=f"page {page.page}",
                        source_excerpt=label[:500],
                        confidence=0.55,
                    )
                )
                if section_count >= 4:
                    break

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

    bid_tab = _is_bid_tab(filename)
    if bid_tab:
        preferred = rate_candidates
    else:
        preferred = [c for c in rate_candidates if c[3]] or rate_candidates
    limit = 6 if bid_tab else (3 if rate_field == "requested_rate" else 2)
    seen: set[str] = set()
    for amount, page_no, excerpt, lp_near in preferred:
        if amount in seen:
            continue
        seen.add(amount)
        if bid_tab and not lp_near:
            drafts.insert(
                0,
                ExtractedFactDraft(
                    idempotency_key=f"competitor-rate:{page_no}:{amount}"[:200],
                    entity="competitor",
                    field="competitor_price",
                    raw_value=f"${amount}",
                    normalized_value=amount,
                    normalized_type="rate",
                    source_page=page_no,
                    source_section=f"page {page_no}",
                    source_excerpt=excerpt,
                    confidence=0.65,
                ),
            )
        else:
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

    if not found_po:
        po_match = _PO.search(filename or "")
        if po_match:
            po_num = _plausible_po_number(next(g for g in po_match.groups() if g))
            if po_num:
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=f"po:{po_num}"[:200],
                        entity="purchase_order",
                        field="po_number",
                        raw_value=po_num,
                        normalized_value=po_num,
                        normalized_type="identifier",
                        source_page=1,
                        source_section="filename",
                        source_excerpt=filename or po_num,
                        confidence=0.8,
                    )
                )

    # Deduplicate by idempotency_key (Postgres upsert cannot update same key twice).
    deduped: dict[str, ExtractedFactDraft] = {}
    for draft in drafts:
        deduped[draft.idempotency_key] = draft
    return list(deduped.values())
