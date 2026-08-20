import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

async function ContractDetail({ contractId }: { contractId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view this contract.</p>;

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id, title, contract_number, start_on, verified_end_on, source_fact_id, clients(name)")
    .eq("id", contractId)
    .maybeSingle();
  if (error || !contract) {
    return <p className="text-sm text-red-600">{error?.message ?? "Contract not found."}</p>;
  }

  const [{ data: amendments }, { data: options }, { data: renewals }, { data: alerts }] = await Promise.all([
    supabase.from("contract_amendments").select("id, note, effective_on").eq("contract_id", contractId),
    supabase.from("contract_options").select("id, label, exercise_by").eq("contract_id", contractId),
    supabase.from("renewals").select("id, notice, notice_due_on").eq("contract_id", contractId),
    supabase.from("contract_alerts").select("id, bucket, days_until").eq("contract_id", contractId),
  ]);

  const client = Array.isArray(contract.clients) ? contract.clients[0] : contract.clients;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Use breadcrumbs above to navigate back. Phase 13 adds tabbed workspaces per solicitation.
      </p>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{contract.title}</h1>
        <p className="text-sm text-muted-foreground">
          {client?.name ?? "No client"} · {contract.contract_number ?? "no number"}
        </p>
        <p className="text-sm">
          Start {contract.start_on ?? "—"} · Verified end {contract.verified_end_on ?? "—"}
        </p>
        {contract.source_fact_id ? (
          <p className="text-xs text-muted-foreground">Source fact {contract.source_fact_id}</p>
        ) : null}
      </div>
      <section>
        <h2 className="text-sm font-medium">Renewal buckets</h2>
        {(alerts ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">None. Run after a verified end date is promoted.</p>
        ) : (
          <ul className="text-sm">
            {(alerts ?? []).map((alert) => (
              <li key={alert.id}>
                {alert.bucket}-day · {alert.days_until} days
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-sm font-medium">Amendments</h2>
        <ul className="list-disc pl-5 text-sm">
          {(amendments ?? []).map((row) => (
            <li key={row.id}>
              {row.note} {row.effective_on ? `(${row.effective_on})` : ""}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-medium">Options</h2>
        <ul className="list-disc pl-5 text-sm">
          {(options ?? []).map((row) => (
            <li key={row.id}>
              {row.label} {row.exercise_by ? `by ${row.exercise_by}` : ""}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-medium">Renewal notices</h2>
        <ul className="list-disc pl-5 text-sm">
          {(renewals ?? []).map((row) => (
            <li key={row.id}>{row.notice ?? "Notice"} {row.notice_due_on ?? ""}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function FromParams({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  return <ContractDetail contractId={contractId} />;
}

export default function ContractPage({ params }: { params: Promise<{ contractId: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading contract…</p>}>
      <FromParams params={params} />
    </Suspense>
  );
}
