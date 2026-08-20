import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FactRef } from "@/components/opportunity-workspace/shared";
import { loadFactDocumentMap } from "@/lib/opportunity/load-workspace";

export default async function OpportunityContractPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, title, contract_number, start_on, verified_end_on, source_fact_id")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (!contract) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Contract</h2>
        <p className="text-sm text-muted-foreground">
          No contract promoted for this pursuit. After award, verify and promote contract facts from executed
          documents.
        </p>
        {(
          await supabase.from("awards").select("id, notice, awarded_on").eq("opportunity_id", opportunityId)
        ).data?.[0] ? (
          <p className="text-sm">An award record exists — promote contract terms from the executed agreement.</p>
        ) : null}
      </div>
    );
  }

  const [{ data: alerts }, { data: renewals }, { data: amendments }] = await Promise.all([
    supabase.from("contract_alerts").select("id, bucket, days_until").eq("contract_id", contract.id),
    supabase.from("renewals").select("id, notice, notice_due_on").eq("contract_id", contract.id),
    supabase.from("contract_amendments").select("id, note, effective_on").eq("contract_id", contract.id),
  ]);

  const factDocumentMap = contract.source_fact_id
    ? await loadFactDocumentMap([contract.source_fact_id])
    : new Map<string, string>();

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-md border p-4">
        <h2 className="text-sm font-medium">{contract.title}</h2>
        <p className="text-sm text-muted-foreground">{contract.contract_number ?? "No contract number"}</p>
        <p className="text-sm">
          {contract.start_on ?? "—"} → {contract.verified_end_on ?? "—"}
        </p>
        <FactRef
          factId={contract.source_fact_id}
          documentId={factDocumentMap.get(contract.source_fact_id ?? "")}
        />
        <Link className="text-sm underline" href={`/contracts/${contract.id}`}>
          Full contract record →
        </Link>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Renewal alerts</h3>
        {(alerts ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts until verified end date is set.</p>
        ) : (
          <ul className="text-sm">
            {(alerts ?? []).map((a) => (
              <li key={a.id}>
                {a.bucket}-day bucket · {a.days_until} days remaining
              </li>
            ))}
          </ul>
        )}
        <Link className="text-sm underline" href="/contracts/renewals">
          Renewals center →
        </Link>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Renewals & amendments</h3>
        {(renewals ?? []).length === 0 && (amendments ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <>
            {(renewals ?? []).map((r) => (
              <p key={r.id} className="text-sm">
                Renewal notice: {r.notice ?? "—"} · due {r.notice_due_on ?? "—"}
              </p>
            ))}
            {(amendments ?? []).map((a) => (
              <p key={a.id} className="text-sm">
                Amendment {a.effective_on ?? "—"}: {a.note ?? "—"}
              </p>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
