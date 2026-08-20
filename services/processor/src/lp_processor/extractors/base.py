from abc import ABC, abstractmethod

from lp_processor.models import ExtractedFactDraft, NormalizedDocument


class StructuredExtractor(ABC):
    extractor_id: str

    @abstractmethod
    def extract(self, document: NormalizedDocument) -> list[ExtractedFactDraft]:
        raise NotImplementedError
