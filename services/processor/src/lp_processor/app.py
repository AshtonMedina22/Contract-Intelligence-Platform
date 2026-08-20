import hmac
import traceback

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from lp_processor.config import settings
from lp_processor.extractors.heuristic import HeuristicExtractor
from lp_processor.jobs import run_extract, run_parse, run_parse_and_extract
from lp_processor.models import ProcessorJobRequest
from lp_processor.parsers.routing import routing_health
from lp_processor.parsers.base import ParserNotWiredError

app = FastAPI(title="L&P processor", version="0.0.1")


def require_secret(x_processor_secret: str | None = Header(default=None)) -> None:
    expected = settings.processor_shared_secret
    if not expected:
        raise HTTPException(status_code=503, detail="PROCESSOR_SHARED_SECRET is not configured.")
    if not x_processor_secret or not hmac.compare_digest(x_processor_secret, expected):
        raise HTTPException(status_code=401, detail="Invalid processor secret.")


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "parsers": routing_health()["wired"],
        "parser_stubs": routing_health()["escalate_unwired"],
        "routing_policy": routing_health(),
        "extractors": [HeuristicExtractor.extractor_id],
        "writes_canonical_contracts": False,
    }


@app.post("/jobs/parse", dependencies=[Depends(require_secret)])
def parse_job(req: ProcessorJobRequest) -> dict:
    try:
        return run_parse(req)
    except ParserNotWiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/jobs/extract", dependencies=[Depends(require_secret)])
def extract_job(req: ProcessorJobRequest) -> dict:
    try:
        return run_extract(req)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/jobs/parse-and-extract", dependencies=[Depends(require_secret)])
def parse_and_extract_job(req: ProcessorJobRequest) -> dict:
    try:
        result = run_parse_and_extract(req)
        if result.get("document_status") == "VERIFIED":
            return JSONResponse(status_code=500, content={"detail": "Processor must never mark VERIFIED."})
        return result
    except ParserNotWiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
