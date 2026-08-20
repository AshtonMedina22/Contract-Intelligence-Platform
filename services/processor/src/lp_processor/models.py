from pydantic import BaseModel, Field


class CellValue(BaseModel):
    sheet: str
    coordinate: str
    row: int
    column: int
    data_type: str
    number_format: str | None = None
    formula: str | None = None
    cached_value: str | None = None
    display_value: str | None = None
    merged_range: str | None = None


class SheetStructure(BaseModel):
    name: str
    index: int
    max_row: int
    max_column: int
    merged_ranges: list[str] = Field(default_factory=list)
    cells: list[CellValue] = Field(default_factory=list)


class PdfPage(BaseModel):
    page: int
    text: str


class NormalizedDocument(BaseModel):
    parser_id: str
    mime_type: str | None = None
    filename: str | None = None
    page_count: int | None = None
    sheet_count: int | None = None
    sheets: list[SheetStructure] = Field(default_factory=list)
    pages: list[PdfPage] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ExtractedFactDraft(BaseModel):
    idempotency_key: str
    entity: str | None = None
    field: str
    raw_value: str | None = None
    normalized_value: str | None = None
    normalized_type: str | None = None
    source_page: int | None = None
    source_section: str | None = None
    source_excerpt: str | None = None
    confidence: float | None = None


class ProcessorJobRequest(BaseModel):
    organization_id: str
    document_id: str
    document_version_id: str
    extraction_run_id: str | None = None
