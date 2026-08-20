from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from lp_processor.config import settings
from lp_processor.models import ExtractedFactDraft, NormalizedDocument, ProcessorJobRequest


class Store:
    def __init__(self, client: Client | None = None) -> None:
        self.client = client or create_client(settings.resolved_supabase_url, settings.resolved_secret_key)

    def load_job_context(self, req: ProcessorJobRequest) -> dict[str, Any]:
        version = (
            self.client.table("document_versions")
            .select("id, organization_id, document_id, storage_bucket, storage_path, sha256")
            .eq("id", req.document_version_id)
            .eq("organization_id", req.organization_id)
            .eq("document_id", req.document_id)
            .single()
            .execute()
        )
        if not version.data:
            raise ValueError("document_version not found for organization.")
        document = (
            self.client.table("documents")
            .select("id, original_filename, mime_type, processing_status")
            .eq("id", req.document_id)
            .eq("organization_id", req.organization_id)
            .single()
            .execute()
        )
        if not document.data:
            raise ValueError("document not found for organization.")
        return {"version": version.data, "document": document.data}

    def download_evidence(self, bucket: str, path: str) -> bytes:
        return self.client.storage.from_(bucket).download(path)

    def set_status(self, document_id: str, organization_id: str, status: str, error: str | None = None) -> None:
        payload: dict[str, Any] = {
            "processing_status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if error is not None:
            payload["lifecycle_error"] = error[:500]
        elif status != "FAILED":
            payload["lifecycle_error"] = None
        result = (
            self.client.table("documents")
            .update(payload)
            .eq("id", document_id)
            .eq("organization_id", organization_id)
            .execute()
        )
        if getattr(result, "error", None):
            raise RuntimeError(str(result.error))

    def ensure_run(
        self,
        req: ProcessorJobRequest,
        parser_id: str,
        extractor_id: str,
    ) -> str:
        if req.extraction_run_id:
            existing = (
                self.client.table("extraction_runs")
                .select("id")
                .eq("id", req.extraction_run_id)
                .eq("organization_id", req.organization_id)
                .eq("document_version_id", req.document_version_id)
                .execute()
            )
            if existing.data:
                return existing.data[0]["id"]
        inserted = (
            self.client.table("extraction_runs")
            .insert(
                {
                    "organization_id": req.organization_id,
                    "document_version_id": req.document_version_id,
                    "parser_id": parser_id,
                    "extractor_id": extractor_id,
                }
            )
            .execute()
        )
        return inserted.data[0]["id"]

    def save_normalized(self, run_id: str, document: NormalizedDocument, parser_id: str, extractor_id: str) -> None:
        self.client.table("extraction_runs").update(
            {
                "normalized_document": document.model_dump(),
                "parser_id": parser_id,
                "extractor_id": extractor_id,
                "error": None,
            }
        ).eq("id", run_id).execute()

    def upsert_facts(
        self,
        *,
        organization_id: str,
        document_id: str,
        document_version_id: str,
        extraction_run_id: str,
        drafts: list[ExtractedFactDraft],
    ) -> int:
        if not drafts:
            return 0
        rows = [
            {
                "organization_id": organization_id,
                "extraction_run_id": extraction_run_id,
                "document_id": document_id,
                "document_version_id": document_version_id,
                "idempotency_key": draft.idempotency_key,
                "entity": draft.entity,
                "field": draft.field,
                "raw_value": draft.raw_value,
                "normalized_value": draft.normalized_value,
                "normalized_type": draft.normalized_type,
                "source_page": draft.source_page,
                "source_section": draft.source_section,
                "source_excerpt": draft.source_excerpt,
                "confidence": draft.confidence,
                "verification_status": "AI_EXTRACTED",
            }
            for draft in drafts
        ]
        self.client.table("extracted_facts").upsert(
            rows,
            on_conflict="extraction_run_id,idempotency_key",
        ).execute()

        stored = (
            self.client.table("extracted_facts")
            .select("id, idempotency_key, source_page, source_section, source_excerpt")
            .eq("extraction_run_id", extraction_run_id)
            .execute()
        )
        evidence_rows = []
        for fact in stored.data or []:
            evidence_rows.append(
                {
                    "organization_id": organization_id,
                    "extracted_fact_id": fact["id"],
                    "document_version_id": document_version_id,
                    "page": fact.get("source_page"),
                    "section": fact.get("source_section"),
                    "excerpt": fact.get("source_excerpt"),
                }
            )
        if evidence_rows:
            existing = (
                self.client.table("source_evidence")
                .select("extracted_fact_id")
                .eq("document_version_id", document_version_id)
                .execute()
            )
            have = {row["extracted_fact_id"] for row in existing.data or []}
            fresh = [row for row in evidence_rows if row["extracted_fact_id"] not in have]
            if fresh:
                self.client.table("source_evidence").insert(fresh).execute()
        return len(rows)

    def add_exception(self, organization_id: str, document_id: str, code: str, message: str) -> None:
        self.client.table("validation_exceptions").insert(
            {
                "organization_id": organization_id,
                "document_id": document_id,
                "code": code,
                "message": message,
            }
        ).execute()

    def finish_run(self, run_id: str, error: str | None = None) -> None:
        self.client.table("extraction_runs").update(
            {
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "error": error,
            }
        ).eq("id", run_id).execute()
