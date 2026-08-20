import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CONTRACT_TABS, SectionTabs } from "@/components/section-tabs";
import { ContractsTable, type ContractRow } from "./contracts-table";

async function ContractsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view contracts.</p>;

  const { data, error } = await supabase
    .from("contracts")
    .select("id, title, contract_number, verified_end_on, clients(name)")
    .order("verified_end_on", { ascending: true })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: ContractRow[] = (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      id: row.id,
      title: row.title,
      contract_number: row.contract_number,
      verified_end_on: row.verified_end_on,
      client_name: client?.name ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <SectionTabs tabs={CONTRACT_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Contracts & compliance</h1>
        <p className="text-sm text-muted-foreground">
          Awarded and current truths that feed future pricing and rebid intelligence. Expiration uses
          verified_end_on only.
        </p>
      </div>
      <ContractsTable rows={rows} />
    </div>
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ContractsContent />
    </Suspense>
  );
}
