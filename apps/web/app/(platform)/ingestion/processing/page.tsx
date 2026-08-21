import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DataOpsNav } from "@/components/section-tabs";
import { ProcessingQueueTable, type QueueRow } from "./queue-table";

async function ProcessingQueueContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm">Sign in to view the processing queue.</p>;
  }

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, original_filename, processing_status, lifecycle_error, workflow_run_id, created_at, document_batches(label), document_versions(sha256, storage_path, is_current)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  const rows: QueueRow[] = (data ?? []).map((doc) => {
    const versions = Array.isArray(doc.document_versions) ? doc.document_versions : [];
    const current = versions.find((version) => version.is_current) ?? versions[0];
    const batch = Array.isArray(doc.document_batches) ? doc.document_batches[0] : doc.document_batches;
    return {
      id: doc.id,
      original_filename: doc.original_filename,
      processing_status: doc.processing_status,
      lifecycle_error: doc.lifecycle_error,
      batch_label: batch?.label ?? null,
      sha256: current?.sha256 ?? null,
      storage_path: current?.storage_path ?? null,
      workflow_run_id: doc.workflow_run_id,
      created_at: doc.created_at,
    };
  });

  return (
    <div className="space-y-3">
      <DataOpsNav />
      <div className="space-y-0.5">
        <h1 className="text-base font-semibold tracking-tight sm:text-lg">Processing queue</h1>
        <p className="text-sm text-muted-foreground">
          Intake and parse/extract status. Human review is on Verification. AI completion is not VERIFIED.
        </p>
      </div>
      <ProcessingQueueTable rows={rows} />
    </div>
  );
}

export default function ProcessingQueuePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ProcessingQueueContent />
    </Suspense>
  );
}
