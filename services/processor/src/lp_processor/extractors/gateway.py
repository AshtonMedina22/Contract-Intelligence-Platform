from lp_processor.models import ExtractedFactDraft, NormalizedDocument
from lp_processor.extractors.base import StructuredExtractor


class GatewayStructuredExtractor(StructuredExtractor):
    """AI SDK / Gateway extractor. Not called in Phase 4 until a model is explicitly enabled."""

    extractor_id = "gateway-structured"

    def extract(self, document: NormalizedDocument) -> list[ExtractedFactDraft]:
        raise RuntimeError(
            "GatewayStructuredExtractor is not enabled. Phase 4 writes staging via HeuristicExtractor; "
            "do not lock a model vendor here."
        )
