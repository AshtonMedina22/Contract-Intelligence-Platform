import Link from "next/link";
import {
  loadContractCore,
  loadContractOverviewExtras,
} from "@/lib/contracts/load-workspace";
import {
  buildContractPortfolio,
  CONTRACT_RISK_LABELS,
  CONTRACT_VALUE_ABSENT_NOTE,
  CONTRACT_VALUE_KIND_LABELS,
  RENEWAL_BUCKET_LABELS,
  type ContractValue,
} from "@/lib/contracts/portfolio-model";
import { ContractHonestyStrip } from "@/components/contract-workspace/portfolio-strips";

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function Absent({ what }: { what: string }) {
  return (
    <span className="text-muted-foreground" title={`Not recorded: ${what}`}>
      —
    </span>
  );
}

function Value({ value, what }: { value: ContractValue | null; what: string }) {
  if (!value) return <Absent what={what} />;
  return (
    <span className="tabular-nums" title={value.basis}>
      ${value.amount.toLocaleString()}{" "}
      <span className="text-xs text-muted-foreground">({CONTRACT_VALUE_KIND_LABELS[value.kind]})</span>
    </span>
  );
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

  // The same pure model that builds the portfolio row builds this header, so a contract can never
  // read one way on `/contracts` and another way on its own page.
  const row = buildContractPortfolio({
    contracts: [
      {
        id: contract.id,
        client_id: contract.client_id,
        opportunity_id: contract.opportunity_id,
        title: contract.title,
        contract_number: contract.contract_number,
        start_on: contract.start_on,
        verified_end_on: contract.verified_end_on,
        source_fact_id: contract.source_fact_id,
        source_document_id: contract.source_document_id,
      },
    ],
    alerts: extras.alerts.map((a) => ({ ...a, contract_id: contractId })),
    options: extras.options,
    renewalNotices: extras.renewals,
    purchaseOrders: extras.purchaseOrders,
    awards: extras.award ? [extras.award] : [],
    buyers: client?.name && contract.client_id ? [{ id: contract.client_id, name: client.name }] : [],
  }).rows[0];

  const vehicle =
    extras.federal.find((f) => f.scheme === "contract_vehicle")?.identifier ??
    extras.federal[0]?.identifier ??
    null;

  return (
    <div className="space-y-5">
      <ContractHonestyStrip />

      <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Buyer</dt>
          <dd>{client?.name ?? <Absent what="clients.name — no buyer linked" />}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contract #</dt>
          <dd>{contract.contract_number ?? <Absent what="contracts.contract_number" />}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            {row.status === "UNKNOWN" ? (
              <Absent what="contracts.verified_end_on" />
            ) : row.bucket ? (
              `${RENEWAL_BUCKET_LABELS[row.bucket]} · ${row.daysUntil ?? "?"} days`
            ) : row.status === "EXPIRED" ? (
              "Expired"
            ) : (
              "Active"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Performance dates</dt>
          <dd>
            {dash(contract.start_on)} → {dash(contract.verified_end_on)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Original value</dt>
          <dd>
            <Value value={row.originalValue} what="awards.amount_nte on the linked award" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Current value</dt>
          <dd>
            <Value value={row.currentValue} what="purchase_orders.total_amount" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vehicle / federal ID</dt>
          <dd>{vehicle ?? <Absent what="federal_identifiers" />}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Options on file</dt>
          <dd title="Exercised vs remaining is not recorded and is not assumed.">
            {row.options.length === 0 ? (
              <Absent what="contract_options" />
            ) : (
              `${row.options.length} · next ${row.nextOptionExerciseBy ?? "no unpassed exercise-by date"}`
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Risk</dt>
          <dd title={row.risk.note}>{CONTRACT_RISK_LABELS[row.risk.level]}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-muted-foreground">Next action</dt>
          <dd title={row.nextAction.basis}>
            {row.nextAction.label}{" "}
            <span className="text-xs text-muted-foreground">({row.nextAction.basis})</span>
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">{CONTRACT_VALUE_ABSENT_NOTE}</p>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Award & pursuit lineage</h2>
        <ul className="list-disc pl-5 text-sm">
          <li>
            Linked pursuit:{" "}
            {opportunity ? (
              <Link className="underline" href={`/procurement/opportunities/${opportunity.id}`}>
                {opportunity.title}
              </Link>
            ) : (
              <Absent what="contracts.opportunity_id" />
            )}
          </li>
          <li>
            Recorded result:{" "}
            {contract.opportunity_id ? (
              <Link className="underline" href={`/procurement/opportunities/${contract.opportunity_id}/result`}>
                Submission & outcome
              </Link>
            ) : (
              <Absent what="no linked pursuit to carry a result" />
            )}
          </li>
          <li>
            Award notice: {extras.award?.notice ?? <Absent what="awards.notice" />}
            {extras.award?.winner_name ? ` · winner ${extras.award.winner_name}` : ""}
            {extras.award?.awarded_on ? ` · awarded ${extras.award.awarded_on}` : ""}
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Source evidence</h2>
        {row.sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No source document or fact is recorded on this contract. It cannot be traced back to an
            instrument from here.
          </p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {row.sources.map((source) => (
              <li key={source.label}>
                {source.href ? (
                  <Link className="underline" href={source.href}>
                    {source.label}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{source.label} (fact only — no document link)</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {row.missing.length > 0 ? (
          <p className="text-xs text-muted-foreground">Not recorded on this contract: {row.missing.join(", ")}.</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Compliance on this contract</h2>
        {extras.compliance.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {extras.compliance.map((item) => (
              <li key={item.id}>
                {item.kind}: {item.statement}
                {item.expires_on ? ` · expires ${item.expires_on}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm">
        <Link className="underline" href={`/contracts/${contractId}/renewal`}>
          Renewal & rebid workspace
        </Link>
      </p>
    </div>
  );
}
