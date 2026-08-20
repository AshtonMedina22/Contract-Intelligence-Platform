"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PricingComparableRow } from "@/lib/opportunity/types";
import { formatMoney, summarizeComparableRates } from "@/lib/opportunity/pricing-math";
import { saveComparableJudgment } from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";
import { FactRef } from "./shared";

export function PricingComparablesPanel({
  opportunityId,
  comparables,
  factDocumentMap,
}: {
  opportunityId: string;
  comparables: PricingComparableRow[];
  factDocumentMap: Map<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const included = comparables.filter((c) => c.included);
  const excluded = comparables.filter((c) => !c.included);
  const proposedSummary = summarizeComparableRates(comparables, "proposed_rate");
  const awardedSummary = summarizeComparableRates(comparables, "awarded_rate");
  const currentSummary = summarizeComparableRates(comparables, "current_rate");

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div>
        <h2 className="text-sm font-medium">Comparable evidence (include / exclude)</h2>
        <p className="text-xs text-muted-foreground">
          Same buyer, similar service, L&P wins/losses, and other pursuits. Every include/exclude needs a reason.
          Decision support only — never invents market rates.
        </p>
      </div>

      {comparables.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comparable verified pricing lines yet. Ingest and verify historical packages.
        </p>
      ) : (
        <>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Proposed (included)</dt>
              <dd>{proposedSummary?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Awarded (included)</dt>
              <dd>{awardedSummary?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current (included)</dt>
              <dd>{currentSummary?.label ?? "—"}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Included {included.length} · Excluded {excluded.length}
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">Status</th>
                  <th className="p-2">Pursuit</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Proposed</th>
                  <th className="p-2">Awarded</th>
                  <th className="p-2">Reason / judgment</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    <td className="p-2 text-xs">{row.included ? "Included" : "Excluded"}</td>
                    <td className="p-2">
                      <Link className="underline" href={`/procurement/opportunities/${row.opportunity_id}/pricing`}>
                        {row.opportunity_title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {row.client_name ?? "—"} · {row.match_basis}
                      </div>
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
                    <td className="p-2">
                      <p className="mb-2 text-xs text-muted-foreground">{row.reason}</p>
                      <form
                        className="flex flex-wrap items-end gap-1"
                        action={(formData) => {
                          startTransition(async () => {
                            await saveComparableJudgment(opportunityId, formData);
                          });
                        }}
                      >
                        <input type="hidden" name="source_pricing_line_id" value={row.id} />
                        <input type="hidden" name="included" value={row.included ? "false" : "true"} />
                        <Input
                          name="reason"
                          required
                          placeholder={row.included ? "Why exclude?" : "Why include?"}
                          className="h-8 min-w-40 text-xs"
                          defaultValue=""
                        />
                        <Button type="submit" size="sm" variant="outline" disabled={pending}>
                          {row.included ? "Exclude" : "Include"}
                        </Button>
                      </form>
                    </td>
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
