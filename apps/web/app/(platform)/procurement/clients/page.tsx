import { Suspense } from "react";
import Link from "next/link";
import { PROCUREMENT_TABS, SectionTabs } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { createClient } from "@/lib/supabase/server";
import { registryEntry } from "@/lib/data-model/registry";

async function ClientsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view clients.</p>;

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, created_at")
    .order("name", { ascending: true })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const entry = registryEntry("clients");

  return (
    <div className="space-y-4">
      <SectionTabs tabs={PROCUREMENT_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Clients (buyers / agencies)</h1>
        <p className="text-sm text-muted-foreground">
          Procurement customers — not CRM accounts. Created during intake or identity promotion from verified
          facts.
        </p>
      </div>
      {entry ? <DataRegistryCallout entry={entry} /> : null}
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No clients yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2 font-mono text-xs">name</th>
                <th className="p-2 font-mono text-xs">id</th>
                <th className="p-2 font-mono text-xs">created_at</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.name}</td>
                  <td className="p-2 font-mono text-xs">{row.id}</td>
                  <td className="p-2 font-mono text-xs">{row.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Public research about buyers lives in{" "}
        <Link className="underline" href="/intelligence/clients">
          research_facts
        </Link>{" "}
        — separate from this registry.
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ClientsContent />
    </Suspense>
  );
}
