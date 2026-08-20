import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { registryEntry } from "@/lib/data-model/registry";
import { DocumentsTable, type DocumentRow } from "./documents-table";

async function DocumentsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm">Sign in to view the document registry.</p>;
  }

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, original_filename, mime_type, document_type, commercial_truth, processing_status, opportunity_id, opportunities(title), document_versions(sha256, storage_path, byte_size, is_current, source_drive_file_id)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  const rows: DocumentRow[] = (data ?? []).map((doc) => {
    const versions = Array.isArray(doc.document_versions) ? doc.document_versions : [];
    const current = versions.find((version) => version.is_current) ?? versions[0];
    const opportunity = Array.isArray(doc.opportunities) ? doc.opportunities[0] : doc.opportunities;
    return {
      id: doc.id,
      original_filename: doc.original_filename,
      mime_type: doc.mime_type,
      document_type: doc.document_type,
      commercial_truth: doc.commercial_truth,
      processing_status: doc.processing_status,
      opportunity_id: doc.opportunity_id,
      opportunity_title: opportunity?.title ?? null,
      sha256: current?.sha256 ?? null,
      storage_path: current?.storage_path ?? null,
      byte_size: current?.byte_size ?? null,
      source_drive_file_id: current?.source_drive_file_id ?? null,
    };
  });

  const entry = registryEntry("documents");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Document registry</h1>
        <p className="text-sm text-muted-foreground">
          Evidence vault index — not a global app. Intake and verification live under Data Ops.{" "}
          <Link className="underline" href="/ingestion/intake">
            Intake
          </Link>
        </p>
      </div>
      {entry ? <DataRegistryCallout entry={entry} /> : null}
      <DocumentsTable rows={rows} />
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <DocumentsContent />
    </Suspense>
  );
}
