import type { PricingLineRow } from "@/lib/opportunity/types";
import {
  formatCurrency,
  PRICING_TRUTH_COLUMNS,
  PRICING_TRUTH_LEGEND_CLASS,
  truthFactId,
  truthRate,
} from "@/lib/opportunity/pricing-grid-model";
import { FactRef } from "./shared";

/**
 * Compact read-only mirror of the pricing workbench matrix. Column set and labels come from
 * `PRICING_TRUTH_COLUMNS`, so this snapshot shows the same five truths the workbench does —
 * including L&P internal cost, which is planning rather than promoted buyer evidence.
 */
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
            {PRICING_TRUTH_COLUMNS.map((truth) => (
              <th key={truth.id} className="p-2 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={`inline-block size-2 rounded-sm ${PRICING_TRUTH_LEGEND_CLASS[truth.id]}`}
                  />
                  {truth.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b align-top">
              <td className="p-2">{line.labor_category}</td>
              {PRICING_TRUTH_COLUMNS.map((truth) => (
                <td key={truth.id} className="p-2 tabular-nums">
                  {formatCurrency(truthRate(line, truth.id))}
                  <div className="text-muted-foreground">
                    {truth.factKey ? (
                      <FactRef
                        factId={truthFactId(line, truth.id)}
                        documentId={factDocumentMap.get(truthFactId(line, truth.id) ?? "")}
                      />
                    ) : (
                      <span className="text-xs">planning</span>
                    )}
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
