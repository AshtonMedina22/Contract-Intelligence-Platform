import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ContractsNav } from "@/components/section-tabs";
import { ContractsTable, type ContractRow } from "./contracts-table";
import { deriveContractStatus } from "@/lib/contracts/load-workspace";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/shell";

async function ContractsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view contracts.</p>;

  const { data, error } = await supabase
    .from("contracts")
    .select("id, title, contract_number, verified_end_on, clients(name), contract_alerts(bucket, days_until)")
    .order("verified_end_on", { ascending: true })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: ContractRow[] = (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const alerts = Array.isArray(row.contract_alerts) ? row.contract_alerts : row.contract_alerts ? [row.contract_alerts] : [];
    const alert = alerts[0] ?? null;
    const status = deriveContractStatus({
      verifiedEndOn: row.verified_end_on,
      alertBucket: alert?.bucket ?? null,
    });
    return {
      id: row.id,
      title: row.title,
      contract_number: row.contract_number,
      verified_end_on: row.verified_end_on,
      client_name: client?.name ?? null,
      status,
      alert_bucket: alert?.bucket ?? null,
      days_until: alert?.days_until ?? null,
    };
  });

  return (
    <div className="space-y-3">
      <ContractsNav />
      <PageHeader
        title="Contracts"
        description="Awarded portfolio from verified facts only. Open a contract for Overview, Service Plan, Commercial Terms, Changes, and Renewal."
      />
      {rows.length > 0 ? (
        <ContractsTable rows={rows} />
      ) : (
        <EmptyState
          title="No contracts yet"
          description="Verify a contract end date on an awarded/current document to populate this portfolio."
        />
      )}
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
