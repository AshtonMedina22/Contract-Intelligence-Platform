import type { PricingLineRow } from "@/lib/opportunity/types";
import { formatMoney } from "@/lib/opportunity/pricing-math";
import { FactRef } from "./shared";

export function FourTruthsTable({
  lines,
  factDocumentMap,
}: {
  lines: PricingLineRow[];
  factDocumentMap: Map<string, string>;
}) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No verified pricing lines promoted yet. Verify pricing facts in the verification workbench.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="p-2 font-medium">Labor category</th>
            <th className="p-2 font-mono text-xs">requested</th>
            <th className="p-2 font-mono text-xs">proposed</th>
            <th className="p-2 font-mono text-xs">awarded</th>
            <th className="p-2 font-mono text-xs">current</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b align-top">
              <td className="p-2">{line.labor_category}</td>
              {(
                [
                  ["requested_rate", "requested_source_fact_id"],
                  ["proposed_rate", "proposed_source_fact_id"],
                  ["awarded_rate", "awarded_source_fact_id"],
                  ["current_rate", "current_source_fact_id"],
                ] as const
              ).map(([rateKey, factKey]) => (
                <td key={rateKey} className="p-2">
                  {formatMoney(line[rateKey] as number | null)}
                  <div className="text-muted-foreground">
                    <FactRef
                      factId={line[factKey]}
                      documentId={factDocumentMap.get(line[factKey] ?? "")}
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
