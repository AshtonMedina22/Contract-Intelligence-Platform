from lp_processor.extractors.heuristic import HeuristicExtractor
from lp_processor.models import ProcessorJobRequest
from lp_processor.parsers.routing import select_parser
from lp_processor.store import Store


def run_parse(req: ProcessorJobRequest, store: Store | None = None) -> dict:
    store = store or Store()
    ctx = store.load_job_context(req)
    version = ctx["version"]
    document = ctx["document"]
    store.set_status(req.document_id, req.organization_id, "PARSING")
    payload = store.download_evidence(version["storage_bucket"], version["storage_path"])
    parser = select_parser(document.get("mime_type"), document.get("original_filename"), payload)
    normalized = parser.parse(
        payload,
        mime_type=document.get("mime_type"),
        filename=document.get("original_filename"),
    )
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
        extract_req = req.model_copy(update={"extraction_run_id": parsed["extraction_run_id"]})
        extracted = run_extract(extract_req, store=store)
        return {**parsed, **extracted}
    except Exception as exc:
        store.set_status(req.document_id, req.organization_id, "FAILED", str(exc)[:500])
        if req.extraction_run_id:
            store.finish_run(req.extraction_run_id, str(exc)[:500])
        raise

