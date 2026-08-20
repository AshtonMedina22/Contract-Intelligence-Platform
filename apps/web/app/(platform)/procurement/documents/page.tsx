import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LIBRARY_TABS, SectionTabs } from "@/components/section-tabs";
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
      "id, original_filename, mime_type, processing_status, document_versions(sha256, storage_path, byte_size, is_current, source_drive_file_id)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  const rows: DocumentRow[] = (data ?? []).map((doc) => {
    const versions = Array.isArray(doc.document_versions) ? doc.document_versions : [];
    const current = versions.find((version) => version.is_current) ?? versions[0];
    return {
      id: doc.id,
      original_filename: doc.original_filename,
      mime_type: doc.mime_type,
      sha256: current?.sha256 ?? null,
      storage_path: current?.storage_path ?? null,
      byte_size: current?.byte_size ?? null,
      source_drive_file_id: current?.source_drive_file_id ?? null,
      processing_status: doc.processing_status,
    };
  });

  return (
    <div className="space-y-4">
      <SectionTabs tabs={LIBRARY_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Historical library</h1>
        <p className="text-sm text-muted-foreground">
          Procurement corpus of ingested evidence. Group into packages as packages grow; verification stays the
          promotion gate.
        </p>
      </div>
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
