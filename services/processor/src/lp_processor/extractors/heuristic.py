from lp_processor.config import settings
from lp_processor.models import ExtractedFactDraft, NormalizedDocument
from lp_processor.extractors.base import StructuredExtractor


class HeuristicExtractor(StructuredExtractor):
    """Structure-to-fact mapping with no model call. Status remains AI_EXTRACTED in the DB default."""

    extractor_id = "heuristic-structure"

    def extract(self, document: NormalizedDocument) -> list[ExtractedFactDraft]:
        drafts: list[ExtractedFactDraft] = []
        for sheet in document.sheets:
            for cell in sheet.cells:
                value = cell.display_value or cell.cached_value or cell.formula
                if value is None or str(value).strip() == "":
                    continue
                key = f"cell:{sheet.name}:{cell.coordinate}"
                drafts.append(
                    ExtractedFactDraft(
                        idempotency_key=key[:200],
                        entity="workbook",
                        field=f"{sheet.name}!{cell.coordinate}",
                        raw_value=str(value)[:8000],
                        normalized_value=str(value)[:8000],
                        normalized_type="formula" if cell.formula else "cell",
                        source_page=None,
                        source_section=f"{sheet.name}!{cell.coordinate}",
                        source_excerpt=(cell.formula or str(value))[:500],
                        confidence=0.4,
                    )
                )
                if len(drafts) >= settings.max_facts:
                    return drafts

        for page in document.pages:
            text = (page.text or "").strip()
            if not text:
                continue
            drafts.append(
                ExtractedFactDraft(
                    idempotency_key=f"page:{page.page}:text",
                    entity="document",
                    field=f"page_{page.page}_text",
                    raw_value=text[:8000],
                    normalized_value=text[:8000],
                    normalized_type="page_text",
                    source_page=page.page,
                    source_section=f"page {page.page}",
                    source_excerpt=text[:500],
                    confidence=0.4,
                )
            )
            if len(drafts) >= settings.max_facts:
                return drafts
        return drafts
