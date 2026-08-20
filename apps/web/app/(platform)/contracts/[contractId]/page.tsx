import Link from "next/link";
import {
  deriveContractStatus,
  loadContractCore,
  loadContractOverviewExtras,
} from "@/lib/contracts/load-workspace";

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default async function ContractOverviewPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const contract = await loadContractCore(contractId);
  if (!contract) {
    return <p className="text-sm text-muted-foreground">Contract not found.</p>;
  }

  const client = Array.isArray(contract.clients) ? contract.clients[0] : contract.clients;
  const opportunity = Array.isArray(contract.opportunities)
    ? contract.opportunities[0]
    : contract.opportunities;
  const extras = await loadContractOverviewExtras(contractId, contract.opportunity_id);
  const status = deriveContractStatus({
    verifiedEndOn: contract.verified_end_on,
    alertBucket: extras.alert?.bucket ?? null,
  });

  const vehicle =
    extras.federal.find((f) => f.scheme === "contract_vehicle")?.identifier ??
    extras.federal[0]?.identifier ??
    null;

  const nextOption = extras.options.find((o) => o.exercise_by) ?? extras.options[0] ?? null;
  const nextAction =
    extras.alert != null
      ? `${extras.alert.bucket} bucket · ${extras.alert.days_until} days until verified end`
      : contract.verified_end_on
        ? "No active alert bucket (outside 180-day window or not refreshed)"
        : "No verified end date — alerts cannot fire";

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Buyer</dt>
          <dd>{dash(client?.name)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contract #</dt>
          <dd>{dash(contract.contract_number)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Linked pursuit / award</dt>
          <dd>
            {opportunity ? (
              <Link className="underline" href={`/procurement/opportunities/${opportunity.id}`}>
                {opportunity.title}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{status === "UNKNOWN" ? "—" : status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Original value</dt>
          <dd>—</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Current value</dt>
          <dd>—</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">NTE</dt>
          <dd>
            {extras.award?.amount_nte != null
              ? `$${Number(extras.award.amount_nte).toLocaleString()}`
              : "—"}
            <span className="text-muted-foreground"> (linked award only)</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dates</dt>
          <dd>
            {dash(contract.start_on)} → {dash(contract.verified_end_on)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vehicle / federal ID</dt>
          <dd>{dash(vehicle)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Current option state</dt>
          <dd>
            {nextOption
              ? `${nextOption.label}${nextOption.exercise_by ? ` · exercise by ${nextOption.exercise_by}` : ""}`
              : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Next action / risk</dt>
          <dd>{nextAction}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Compliance on this contract</h2>
        {extras.compliance.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {extras.compliance.map((row) => (
              <li key={row.id}>
                {row.kind}: {row.statement}
                {row.expires_on ? ` · expires ${row.expires_on}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm">
        <Link className="underline" href={`/contracts/${contractId}/renewal`}>
          Rebid / renewal workspace
        </Link>
      </p>
    </div>
  );
}
