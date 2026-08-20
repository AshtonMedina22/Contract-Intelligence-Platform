from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files
from typing import Any


@dataclass(frozen=True)
class RoutingPolicy:
    version: str
    locked_at: str
    evidence: str
    cloud_run_required: bool
    scan_min_chars_per_page: int
    low_confidence: str
    rules: list[dict[str, Any]]


@dataclass(frozen=True)
class RouteDecision:
    parser_id: str
    document_class: str
    reason: str
    wired: bool
    escalate: bool
    policy_version: str
    scan_chars_per_page: float | None = None


XLSX_MIME = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/vnd.ms-excel",
}

DOCX_MIME = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

IMAGE_MIME_PREFIXES = ("image/",)
IMAGE_EXTS = (".tif", ".tiff", ".png", ".jpg", ".jpeg", ".webp")


@lru_cache(maxsize=1)
def load_routing_policy() -> RoutingPolicy:
    raw = json.loads(files("lp_processor").joinpath("routing_policy.json").read_text(encoding="utf-8"))
    return RoutingPolicy(
        version=raw["version"],
        locked_at=raw["locked_at"],
        evidence=raw["evidence"],
        cloud_run_required=bool(raw["cloud_run_required"]),
        scan_min_chars_per_page=int(raw["scan_min_chars_per_page"]),
        low_confidence=raw["low_confidence"],
        rules=list(raw["rules"]),
    )


def decide_route(
    mime_type: str | None,
    filename: str | None,
    payload: bytes | None = None,
) -> RouteDecision:
    policy = load_routing_policy()
    name = (filename or "").lower()
    mime = (mime_type or "").lower()

    if name.endswith((".xlsx", ".xlsm", ".xls")) or mime in XLSX_MIME:
        return RouteDecision(
            parser_id="xlsx-openpyxl",
            document_class="xlsx",
            reason="Checked-in policy: pricing workbooks always use openpyxl, never OCR.",
            wired=True,
            escalate=False,
            policy_version=policy.version,
        )

    if name.endswith(".docx") or mime in DOCX_MIME:
        return RouteDecision(
            parser_id="docx-native",
            document_class="docx",
            reason="Checked-in policy: DOCX is a native/Docling path. Adapter is not wired; escalate, do not OCR as PDF.",
            wired=False,
            escalate=True,
            policy_version=policy.version,
        )

    if name.endswith(IMAGE_EXTS) or any(mime.startswith(prefix) for prefix in IMAGE_MIME_PREFIXES):
        return RouteDecision(
            parser_id="ocr-document-ai",
            document_class="raster_image",
            reason="Checked-in policy: raster images escalate to managed OCR. Adapter is not wired.",
            wired=False,
            escalate=True,
            policy_version=policy.version,
        )

    is_pdf = name.endswith(".pdf") or mime == "application/pdf"
    if is_pdf:
        if payload is None:
            return RouteDecision(
                parser_id="pdf-native",
                document_class="digital_pdf",
                reason="PDF with no bytes yet; default is native text (not OCR).",
                wired=True,
                escalate=False,
                policy_version=policy.version,
            )
        from lp_processor.pdf_quality import classify_pdf

        kind, density = classify_pdf(payload)
        if kind == "digital":
            return RouteDecision(
                parser_id="pdf-native",
                document_class="digital_pdf",
                reason="Checked-in policy: extractable PDF text uses pdf-native. Do not pay OCR by default.",
                wired=True,
                escalate=False,
                policy_version=policy.version,
                scan_chars_per_page=density,
            )
        return RouteDecision(
            parser_id="ocr-mistral",
            document_class="scanned_pdf",
            reason=(
                f"Checked-in policy: mean extractable chars/page={density:.1f} "
                f"(threshold {policy.scan_min_chars_per_page}). Escalate to OCR; do not accept empty native parse."
            ),
            wired=False,
            escalate=True,
            policy_version=policy.version,
            scan_chars_per_page=density,
        )

    return RouteDecision(
        parser_id="unknown",
        document_class="unknown",
        reason=f"No routing rule for mime={mime_type!r} filename={filename!r}.",
        wired=False,
        escalate=True,
        policy_version=policy.version,
    )
