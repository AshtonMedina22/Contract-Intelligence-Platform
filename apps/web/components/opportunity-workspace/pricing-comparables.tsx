import Link from "next/link";
import type { PricingComparableRow } from "@/lib/opportunity/types";
import { formatMoney, summarizeComparableRates } from "@/lib/opportunity/pricing-math";
import { FactRef } from "./shared";

export function PricingComparablesPanel({
  comparables,
  factDocumentMap,
}: {
  comparables: PricingComparableRow[];
  factDocumentMap: Map<string, string>;
}) {
  const proposedSummary = summarizeComparableRates(comparables, "proposed_rate");
  const awardedSummary = summarizeComparableRates(comparables, "awarded_rate");
  const currentSummary = summarizeComparableRates(comparables, "current_rate");

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div>
        <h2 className="text-sm font-medium">Verified comparables (other pursuits)</h2>
        <p className="text-xs text-muted-foreground">
          Same buyer and/or service type when known. Only HUMAN_VERIFIED promoted rates — never inferred market
          medians.
        </p>
      </div>

      {comparables.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comparable verified pricing lines yet. Ingest and verify historical packages with the same buyer or
          service type.
        </p>
      ) : (
        <>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Proposed</dt>
              <dd>{proposedSummary?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Awarded</dt>
              <dd>{awardedSummary?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current</dt>
              <dd>{currentSummary?.label ?? "—"}</dd>
            </div>
          </dl>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">Pursuit</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Proposed</th>
                  <th className="p-2">Awarded</th>
                  <th className="p-2">Current</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    <td className="p-2">
                      <Link className="underline" href={`/procurement/opportunities/${row.opportunity_id}/pricing`}>
                        {row.opportunity_title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.client_name ?? "—"}</div>
                    </td>
                    <td className="p-2">{row.labor_category}</td>
                    <td className="p-2">
                      {formatMoney(row.proposed_rate)}
                      <div className="text-muted-foreground">
                        <FactRef
                          factId={row.proposed_source_fact_id}
                          documentId={factDocumentMap.get(row.proposed_source_fact_id ?? "")}
                        />
                      </div>
                    </td>
                    <td className="p-2">{formatMoney(row.awarded_rate)}</td>
                    <td className="p-2">{formatMoney(row.current_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
