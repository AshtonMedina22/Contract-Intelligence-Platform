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
      <ExceptionsTable rows={data ?? []} />
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
