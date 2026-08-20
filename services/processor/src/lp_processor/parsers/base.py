from abc import ABC, abstractmethod

from lp_processor.models import NormalizedDocument


class ParserNotWiredError(RuntimeError):
    pass


class DocumentParser(ABC):
    parser_id: str

    @abstractmethod
    def supports(self, mime_type: str | None, filename: str | None) -> bool:
        raise NotImplementedError

    @abstractmethod
    def parse(self, payload: bytes, *, mime_type: str | None, filename: str | None) -> NormalizedDocument:
        raise NotImplementedError
