import { Suspense } from "react";
import Link from "next/link";
import { INGESTION_TABS, SectionTabs } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { registryEntry } from "@/lib/data-model/registry";

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
      <SectionTabs tabs={INGESTION_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Validation exceptions</h1>
        <p className="text-sm text-muted-foreground">
          Written when <code className="text-xs">promote_verified_fact</code> refuses a silent overwrite (e.g.
          conflicting rate on an existing pricing line). Resolve by re-verifying the source fact or correcting
          canonical data.
        </p>
      </div>
      {entry ? <DataRegistryCallout entry={entry} /> : null}
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No exceptions recorded.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2 font-mono text-xs">code</th>
                <th className="p-2 font-mono text-xs">message</th>
                <th className="p-2 font-mono text-xs">document_id</th>
                <th className="p-2 font-mono text-xs">resolved</th>
                <th className="p-2 font-mono text-xs">created_at</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.code}</td>
                  <td className="p-2">{row.message}</td>
                  <td className="p-2">
                    {row.document_id ? (
                      <Link className="underline" href={`/ingestion/verification/${row.document_id}`}>
                        {row.document_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2">
                    <Badge variant="outline">{row.resolved ? "yes" : "open"}</Badge>
                  </td>
                  <td className="p-2 font-mono text-xs">{row.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
