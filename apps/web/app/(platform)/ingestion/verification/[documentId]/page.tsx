import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { WorkbenchClient, type WorkbenchFact, type WorkbenchSheet } from "../workbench-client";

async function WorkbenchContent({ documentId }: { documentId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <p className="text-sm">Sign in to verify this document.</p>;
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, original_filename, mime_type, processing_status")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !document) {
    return <p className="text-sm text-red-600">{error?.message ?? "Document not found."}</p>;
  }

  const { data: version } = await supabase
    .from("document_versions")
    .select("id, storage_bucket, storage_path, is_current")
    .eq("document_id", documentId)
    .eq("is_current", true)
    .maybeSingle();

  let pdfUrl: string | null = null;
  const isPdf =
    (document.mime_type ?? "").includes("pdf") || document.original_filename.toLowerCase().endsWith(".pdf");
  if (isPdf && version) {
    const signed = await supabase.storage
      .from(version.storage_bucket)
      .createSignedUrl(version.storage_path, 300);
    pdfUrl = signed.data?.signedUrl ?? null;
  }

  const { data: facts, error: factError } = await supabase
    .from("extracted_facts")
    .select(
      "id, field, entity, raw_value, normalized_value, verified_value, verification_status, confidence, source_page, source_section, source_excerpt",
    )
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (factError) return <p className="text-sm text-red-600">{factError.message}</p>;

  let sheets: WorkbenchSheet[] = [];
  if (version) {
    const { data: runs } = await supabase
      .from("extraction_runs")
      .select("normalized_document")
      .eq("document_version_id", version.id)
      .order("started_at", { ascending: false })
      .limit(1);
    const normalized = runs?.[0]?.normalized_document as { sheets?: WorkbenchSheet[] } | null;
    sheets = normalized?.sheets ?? [];
  }

  return (
    <WorkbenchClient
      documentId={document.id}
      filename={document.original_filename}
      mimeType={document.mime_type}
      pdfUrl={pdfUrl}
      sheets={sheets}
      facts={(facts ?? []) as WorkbenchFact[]}
      processingStatus={document.processing_status}
    />
  );
}

async function WorkbenchFromParams({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  return <WorkbenchContent documentId={documentId} />;
}

export default function WorkbenchPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading workbench…</p>}>
      <WorkbenchFromParams params={params} />
    </Suspense>
  );
}
