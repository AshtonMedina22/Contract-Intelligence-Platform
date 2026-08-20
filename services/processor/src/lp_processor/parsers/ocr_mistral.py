from __future__ import annotations

import base64
import os

import httpx

from lp_processor.models import NormalizedDocument, PdfPage
from lp_processor.parsers.base import DocumentParser, ParserNotWiredError


class MistralOcrParser(DocumentParser):
    """
    Scanned-PDF OCR via Mistral Document OCR API when MISTRAL_API_KEY is set.
    Never used for clean XLSX. Without a key, escalate clearly (do not fake text).
    """

    parser_id = "ocr-mistral"
    API_URL = "https://api.mistral.ai/v1/ocr"

    def supports(self, mime_type: str | None, filename: str | None) -> bool:
        name = (filename or "").lower()
        return name.endswith(".pdf") or (mime_type or "") == "application/pdf"

    def parse(self, payload: bytes, *, mime_type: str | None, filename: str | None) -> NormalizedDocument:
        api_key = (os.environ.get("MISTRAL_API_KEY") or "").strip()
        if not api_key:
            raise ParserNotWiredError(
                "ocr-mistral requires MISTRAL_API_KEY. Scanned PDFs cannot be parsed without OCR credentials."
            )

        encoded = base64.b64encode(payload).decode("ascii")
        body = {
            "model": os.environ.get("MISTRAL_OCR_MODEL", "mistral-ocr-latest"),
            "document": {
                "type": "document_url",
                "document_url": f"data:application/pdf;base64,{encoded}",
            },
            "include_image_base64": False,
        }
        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                self.API_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=body,
            )
        if response.status_code >= 400:
            raise ParserNotWiredError(
                f"ocr-mistral API failed status={response.status_code} body={response.text[:400]}"
            )

        data = response.json()
        pages_out: list[PdfPage] = []
        raw_pages = data.get("pages") or []
        for index, page in enumerate(raw_pages, start=1):
            text = page.get("markdown") or page.get("text") or ""
            pages_out.append(PdfPage(page=index, text=text))

        if not pages_out:
            raise ParserNotWiredError("ocr-mistral returned no pages.")

        return NormalizedDocument(
            parser_id=self.parser_id,
            mime_type=mime_type,
            filename=filename,
            page_count=len(pages_out),
            sheet_count=None,
            sheets=[],
            pages=pages_out,
            warnings=[],
        )
