"use client";

import { useCallback, useMemo, useState } from "react";
import DataEditor, {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { PricingLineRow } from "@/lib/opportunity/types";
import { formatMoney } from "@/lib/opportunity/pricing-math";

const COLUMNS: GridColumn[] = [
  { title: "Labor category", id: "labor_category", width: 180 },
  { title: "Rate type", id: "rate_type", width: 100 },
  { title: "Site/post", id: "site_or_post", width: 110 },
  { title: "Unit", id: "unit", width: 80 },
  { title: "Qty", id: "quantity", width: 70 },
  { title: "Buyer requested", id: "requested_rate", width: 120 },
  { title: "Req source_fact", id: "requested_source_fact_id", width: 110 },
  { title: "L&P internal cost", id: "internal_cost_rate", width: 130 },
  { title: "L&P submitted", id: "proposed_rate", width: 120 },
  { title: "Sub source_fact", id: "proposed_source_fact_id", width: 110 },
  { title: "Buyer awarded", id: "awarded_rate", width: 120 },
  { title: "Awd source_fact", id: "awarded_source_fact_id", width: 110 },
  { title: "Current/amended", id: "current_rate", width: 120 },
  { title: "Cur source_fact", id: "current_source_fact_id", width: 110 },
  { title: "Extended", id: "extended_amount", width: 100 },
];

function cellText(value: string | number | null | undefined): GridCell {
  const display =
    typeof value === "number"
      ? formatMoney(value)
      : value == null || value === ""
        ? "—"
        : String(value);
  return {
    kind: GridCellKind.Text,
    data: display,
    displayData: display,
    allowOverlay: false,
    readonly: true,
  };
}

/** Source evidence cell — links to verification workbench when document is known. */
function cellSourceFact(
  factId: string | null | undefined,
  documentId: string | null | undefined,
): GridCell {
  if (!factId) {
    return cellText(null);
  }
  const label = `${factId.slice(0, 8)}…`;
  if (documentId) {
    return {
      kind: GridCellKind.Uri,
      data: `/ingestion/verification/${documentId}`,
      displayData: label,
      allowOverlay: false,
      readonly: true,
      hoverEffect: true,
    };
  }
  return {
    kind: GridCellKind.Text,
    data: factId,
    displayData: label,
    allowOverlay: false,
    readonly: true,
  };
}

/** Read-only Glide workbench for five commercial truths + structure grain + source_fact links. */
export function PricingGlideGrid({
  lines,
  factDocumentMap,
}: {
  lines: PricingLineRow[];
  factDocumentMap?: Map<string, string>;
}) {
  const [hoverRow, setHoverRow] = useState<number | undefined>();
  const docFor = useCallback(
    (factId: string | null | undefined) =>
      factId && factDocumentMap ? (factDocumentMap.get(factId) ?? null) : null,
    [factDocumentMap],
  );

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const line = lines[row];
      if (!line) {
        return { kind: GridCellKind.Loading, allowOverlay: false };
      }
      switch (COLUMNS[col]?.id) {
        case "labor_category":
          return cellText(line.labor_category);
        case "rate_type":
          return cellText(line.rate_type);
        case "site_or_post":
          return cellText(line.site_or_post);
        case "unit":
          return cellText(line.unit);
        case "quantity":
          return cellText(line.quantity);
        case "requested_rate":
          return cellText(line.requested_rate);
        case "requested_source_fact_id":
          return cellSourceFact(line.requested_source_fact_id, docFor(line.requested_source_fact_id));
        case "internal_cost_rate":
          return cellText(line.internal_cost_rate);
        case "proposed_rate":
          return cellText(line.proposed_rate);
        case "proposed_source_fact_id":
          return cellSourceFact(line.proposed_source_fact_id, docFor(line.proposed_source_fact_id));
        case "awarded_rate":
          return cellText(line.awarded_rate);
        case "awarded_source_fact_id":
          return cellSourceFact(line.awarded_source_fact_id, docFor(line.awarded_source_fact_id));
        case "current_rate":
          return cellText(line.current_rate);
        case "current_source_fact_id":
          return cellSourceFact(line.current_source_fact_id, docFor(line.current_source_fact_id));
        case "extended_amount":
          return cellText(line.extended_amount);
        default:
          return cellText(null);
      }
    },
    [lines, docFor],
  );

  const empty = lines.length === 0;
  const height = useMemo(() => Math.min(420, 36 + Math.max(lines.length, 1) * 34), [lines.length]);

  if (empty) {
    return (
      <p className="text-sm text-muted-foreground">
        No verified pricing lines yet. Promote HUMAN_VERIFIED rates from intake — AI staging never appears here.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <DataEditor
        getCellContent={getCellContent}
        columns={COLUMNS}
        rows={lines.length}
        height={height}
        width="100%"
        rowMarkers="number"
        smoothScrollX
        smoothScrollY
        getCellsForSelection
        onItemHovered={(args) => {
          setHoverRow(args.kind === "cell" ? args.location[1] : undefined);
        }}
        getRowThemeOverride={(row) =>
          row === hoverRow ? { bgCell: "hsl(var(--muted))" } : undefined
        }
      />
    </div>
  );
}
