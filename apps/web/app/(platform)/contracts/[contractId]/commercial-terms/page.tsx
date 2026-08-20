import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FourTruthsTable } from "@/components/opportunity-workspace/four-truths-table";
import { collectFactIdsFromPricingLines, loadFactDocumentMap, loadPricingLines } from "@/lib/opportunity/load-workspace";
import { loadContractCommercial } from "@/lib/contracts/load-workspace";

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default async function ContractCommercialTermsPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, opportunity_id, start_on, verified_end_on, contract_number")
    .eq("id", contractId)
    .maybeSingle();

  const commercial = await loadContractCommercial(contractId, contract?.opportunity_id ?? null);
  const pricingLines = contract?.opportunity_id ? await loadPricingLines(contract.opportunity_id) : [];
  const factDocumentMap =
    pricingLines.length > 0 ? await loadFactDocumentMap(collectFactIdsFromPricingLines(pricingLines)) : new Map();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Value & term</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Contract #</dt>
            <dd>{dash(contract?.contract_number)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Performance dates</dt>
            <dd>
              {dash(contract?.start_on)} → {dash(contract?.verified_end_on)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Award / NTE</dt>
            <dd>
              {commercial.award?.amount_nte != null
                ? `$${Number(commercial.award.amount_nte).toLocaleString()}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Award notice</dt>
            <dd>{dash(commercial.award?.notice)}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Contract vehicles / federal IDs</h2>
        {commercial.federal.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {commercial.federal.map((row) => (
              <li key={row.id}>
                {row.scheme}: {row.identifier}
                {row.notes ? ` — ${row.notes}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Purchase orders</h2>
        {commercial.purchaseOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {commercial.purchaseOrders.map((po) => {
              const lines = Array.isArray(po.purchase_order_lines)
                ? po.purchase_order_lines
                : po.purchase_order_lines
                  ? [po.purchase_order_lines]
                  : [];
              return (
                <li key={po.id} className="border-b border-border/60 pb-3">
                  <p className="font-medium">
                    PO {dash(po.po_number)}
                    {po.issued_on ? ` · ${po.issued_on}` : ""}
                    {po.total_amount != null ? ` · $${Number(po.total_amount).toLocaleString()}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Vehicle {dash(po.vehicle_ref)} · Payment {dash(po.payment_terms)}
                  </p>
                  {lines.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5">
                      {lines.map((line) => (
                        <li key={line.id}>
                          {dash(line.line_label)} · qty {dash(line.quantity)} {dash(line.unit)} · rate{" "}
                          {dash(line.unit_rate)} · ext {dash(line.extended_amount)}
                          {line.rate_type ? ` (${line.rate_type})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Options</h2>
        {commercial.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {commercial.options.map((row) => (
              <li key={row.id}>
                {row.label}
                {row.exercise_by ? ` by ${row.exercise_by}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Escalation & notices</h2>
        {commercial.renewals.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {commercial.renewals.map((row) => (
              <li key={row.id}>
                {row.notice ?? "Notice"}
                {row.notice_due_on ? ` · due ${row.notice_due_on}` : ""}
                {row.escalation_index ? ` · index ${row.escalation_index}` : ""}
                {row.escalation_pct != null ? ` · ${row.escalation_pct}%` : ""}
                {row.option_year != null ? ` · option year ${row.option_year}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Rates (linked pursuit — reference)</h2>
        {contract?.opportunity_id ? (
          <>
            <FourTruthsTable lines={pricingLines} factDocumentMap={factDocumentMap} />
            <Link
              className="text-sm underline"
              href={`/procurement/opportunities/${contract.opportunity_id}/pricing`}
            >
              Open pursuit pricing
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No linked pursuit with pricing lines.</p>
        )}
      </section>
    </div>
  );
}
