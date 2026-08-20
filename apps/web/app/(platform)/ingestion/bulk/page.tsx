import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { getIntakeContext } from "@/lib/org/intake-context";
import { LIBRARY_TABS, SectionTabs } from "@/components/section-tabs";
import { BulkMigrationForm } from "./bulk-migration-form";

async function BatchList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: batches, error } = await supabase
    .from("document_batches")
    .select(
      "id, label, status, file_count, ingested_count, duplicate_count, failed_count, processed_count, api_cost_usd, compute_cost_usd, bytes_ingested, started_at, finished_at, last_error",
    )
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  if (!batches?.length) {
    return <p className="text-sm text-muted-foreground">No migration batches yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Label</th>
            <th className="p-2">Status</th>
            <th className="p-2">Files</th>
            <th className="p-2">Dupes</th>
            <th className="p-2">Failed</th>
            <th className="p-2">API $</th>
            <th className="p-2">Compute $</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id} className="border-b">
              <td className="p-2">
                <Link className="underline" href={`/ingestion/processing?batch=${batch.id}`}>
                  {batch.label ?? batch.id.slice(0, 8)}
                </Link>
              </td>
              <td className="p-2">
                <Badge variant="outline">{batch.status ?? "OPEN"}</Badge>
              </td>
              <td className="p-2">
                {batch.ingested_count ?? 0}/{batch.file_count ?? 0}
              </td>
              <td className="p-2">{batch.duplicate_count ?? 0}</td>
              <td className="p-2">{batch.failed_count ?? 0}</td>
              <td className="p-2">{batch.api_cost_usd ?? 0}</td>
              <td className="p-2">{batch.compute_cost_usd ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function BulkPageContent() {
  const context = await getIntakeContext();
  if (!context.user) {
    return <p className="text-sm">Sign in to run bulk migration.</p>;
  }

  return (
    <div className="space-y-8">
      <BulkMigrationForm
        organizations={context.organizations}
        clients={context.clients}
        opportunities={context.opportunities}
      />
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Recent batches</h2>
        <BatchList />
      </section>
    </div>
  );
}

export default function BulkMigrationPage() {
  return (
    <div className="space-y-4">
      <SectionTabs tabs={LIBRARY_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Bulk migration</h1>
        <p className="text-sm text-muted-foreground">
          Phase 8 — controlled corpus batches. Duplicates skip re-OCR.{" "}
          <Link className="underline" href="/ingestion/verification">
            Verification
          </Link>{" "}
          remains the gate.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <BulkPageContent />
      </Suspense>
    </div>
  );
}
