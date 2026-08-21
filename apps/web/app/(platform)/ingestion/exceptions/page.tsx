import { Suspense } from "react";
import { DataOpsNav } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { createClient } from "@/lib/supabase/server";
import { registryEntry } from "@/lib/data-model/registry";
import { ExceptionsTable } from "./exceptions-table";

async function ExceptionsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view validation exceptions.</p>;

  const { data, error } = await supabase
    .from("validation_exceptions")
    .select("id, code, message, document_id, resolved, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const docIds = [...new Set((data ?? []).map((r) => r.document_id).filter(Boolean))] as string[];
  const { data: docs } = docIds.length > 0
    ? await supabase
        .from("documents")
        .select("id, original_filename, processing_status")
        .in("id", docIds)
    : { data: [] };

  const docMap = new Map((docs ?? []).map((d) => [d.id, d]));

  const rows = (data ?? []).map((row) => {
    const doc = row.document_id ? docMap.get(row.document_id) : null;
    return {
      id: row.id,
      code: row.code,
      message: row.message,
      document_id: row.document_id,
      document_filename: doc?.original_filename ?? null,
      processing_status: doc?.processing_status ?? null,
      resolved: row.resolved,
      created_at: row.created_at,
    };
  });

  const entry = registryEntry("validation_exceptions");

  return (
    <div className="space-y-4">
      <DataOpsNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Exceptions</h1>
        <p className="text-sm text-muted-foreground">
          Written when promotion refuses a silent overwrite (e.g. conflicting rate). Resolve audits the
          decision; never bypasses human verification of source facts.
        </p>
      </div>
      {entry ? <DataRegistryCallout entry={entry} /> : null}
      <ExceptionsTable rows={rows} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ExceptionsContent />
    </Suspense>
  );
}
