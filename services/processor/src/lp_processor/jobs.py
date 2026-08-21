from lp_processor.extractors.heuristic import HeuristicExtractor
from lp_processor.models import ProcessorJobRequest
from lp_processor.parsers.base import ParserNotWiredError
from lp_processor.parsers.routing import select_parser
from lp_processor.store import Store

OCR_REQUIRED_PREFIX = "OCR_REQUIRED:"

# Data Ops reads these as the error class on a failed document.
EXCEPTION_CODE_OCR_REQUIRED = "ocr_required"
EXCEPTION_CODE_PARSE_FAILED = "parse_failed"
EXCEPTION_CODE_EXTRACT_FAILED = "extract_failed"


def is_ocr_escalation(message: str) -> bool:
    lowered = (message or "").lower()
    return "ocr" in lowered or "mistral" in lowered


def parse_lifecycle_error(exc: BaseException) -> str:
    """Lifecycle error text for a parse-stage failure.

    Idempotent: re-applying it to an already-prefixed message keeps a single prefix, so an
    outer handler cannot blank the OCR badge by re-recording the same exception.
    """
    message = str(exc)
    if message.startswith(OCR_REQUIRED_PREFIX):
        return message[:500]
    if is_ocr_escalation(message):
        return f"{OCR_REQUIRED_PREFIX} {message[:480]}"[:500]
    return message[:500]


def parse_failure_reason(exc: BaseException) -> tuple[str, str]:
    """(error_class, human_reason) for a parse-stage failure."""
    message = str(exc)
    if is_ocr_escalation(message):
        return (
            EXCEPTION_CODE_OCR_REQUIRED,
            "This document needs OCR before facts can be extracted. Set MISTRAL_API_KEY on the "
            f"processor and re-run parse. Router said: {message[:300]}",
        )
    return (
        EXCEPTION_CODE_PARSE_FAILED,
        f"Parsing failed before any fact was written ({type(exc).__name__}): {message[:300]}",
    )


def _record_parse_failure(store: Store, req: ProcessorJobRequest, exc: BaseException) -> None:
    store.set_status(req.document_id, req.organization_id, "FAILED", parse_lifecycle_error(exc))
    code, reason = parse_failure_reason(exc)
    try:
        store.add_exception(req.organization_id, req.document_id, code, reason)
    except Exception:
        # The lifecycle status is the contract; a missing exception row must not mask the parse error.
        pass


def run_parse(req: ProcessorJobRequest, store: Store | None = None) -> dict:
    store = store or Store()
    ctx = store.load_job_context(req)
    version = ctx["version"]
    document = ctx["document"]
    store.set_status(req.document_id, req.organization_id, "PARSING")
    payload = store.download_evidence(version["storage_bucket"], version["storage_path"])
    try:
        parser = select_parser(document.get("mime_type"), document.get("original_filename"), payload)
    except ParserNotWiredError as exc:
        _record_parse_failure(store, req, exc)
        raise
    filename_hint = " ".join(
        part for part in (document.get("original_filename"), document.get("document_type")) if part
    )
    try:
        normalized = parser.parse(
            payload,
            mime_type=document.get("mime_type"),
            filename=filename_hint,
        )
    except Exception as exc:
        # Covers OCR credentials missing and Mistral unavailable, both of which must stay OCR_REQUIRED.
        _record_parse_failure(store, req, exc)
        raise
    run_id = store.ensure_run(req, parser.parser_id, "heuristic-structure")
    store.save_normalized(run_id, normalized, parser.parser_id, extractor_id="pending")
    return {
        "extraction_run_id": run_id,
        "parser_id": parser.parser_id,
        "normalized_document": normalized.model_dump(),
    }


def run_extract(req: ProcessorJobRequest, store: Store | None = None) -> dict:
    store = store or Store()
    extractor = HeuristicExtractor()
    ctx = store.load_job_context(req)
    if not req.extraction_run_id:
        raise ValueError("extraction_run_id is required for extract.")
    run = (
        store.client.table("extraction_runs")
        .select("id, normalized_document, parser_id")
        .eq("id", req.extraction_run_id)
        .eq("organization_id", req.organization_id)
        .single()
        .execute()
    )
    if not run.data or not run.data.get("normalized_document"):
        raise ValueError("Parse the document before extract.")
    from lp_processor.models import NormalizedDocument

    normalized = NormalizedDocument.model_validate(run.data["normalized_document"])
    store.set_status(req.document_id, req.organization_id, "EXTRACTING")
    drafts = extractor.extract(normalized)
    store.set_status(req.document_id, req.organization_id, "VALIDATING")
    count = store.upsert_facts(
        organization_id=req.organization_id,
        document_id=req.document_id,
        document_version_id=req.document_version_id,
        extraction_run_id=req.extraction_run_id,
        drafts=drafts,
    )
    if count == 0:
        store.add_exception(
            req.organization_id,
            req.document_id,
            "no_facts",
            "Parser produced structure but extractor wrote zero staging facts.",
        )
    store.finish_run(req.extraction_run_id)
    # AI completion is not VERIFIED.
    store.set_status(req.document_id, req.organization_id, "NEEDS_REVIEW")
    return {
        "extraction_run_id": req.extraction_run_id,
        "extractor_id": extractor.extractor_id,
        "fact_count": count,
        "verification_status": "AI_EXTRACTED",
        "document_status": "NEEDS_REVIEW",
    }


def run_parse_and_extract(req: ProcessorJobRequest, store: Store | None = None) -> dict:
    store = store or Store()
    try:
        parsed = run_parse(req, store=store)
    except Exception as exc:
        # run_parse already recorded the failure. Re-record through the same idempotent
        # formatter so the OCR_REQUIRED prefix survives, and cover the paths that fail
        # before parser selection (context load, evidence download).
        store.set_status(req.document_id, req.organization_id, "FAILED", parse_lifecycle_error(exc))
        if req.extraction_run_id:
            store.finish_run(req.extraction_run_id, str(exc)[:500])
        raise

    extract_req = req.model_copy(update={"extraction_run_id": parsed["extraction_run_id"]})
    try:
        extracted = run_extract(extract_req, store=store)
    except Exception as exc:
        store.set_status(req.document_id, req.organization_id, "FAILED", str(exc)[:500])
        try:
            store.add_exception(
                req.organization_id,
                req.document_id,
                EXCEPTION_CODE_EXTRACT_FAILED,
                f"Document parsed but extraction failed ({type(exc).__name__}): {str(exc)[:300]}",
            )
        except Exception:
            pass
        if extract_req.extraction_run_id:
            store.finish_run(extract_req.extraction_run_id, str(exc)[:500])
        raise
    return {**parsed, **extracted}
