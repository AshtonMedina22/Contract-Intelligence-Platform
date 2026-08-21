"use client";

import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/opportunity/pricing-math";

export type CompetitorRateRow = {
  id: string;
  vendor_name: string;
  labor_category: string;
  rate_type: string | null;
  hourly_rate: number | null;
  opportunity_id: string | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, CompetitorRateRow>();
const columns = helper.columns([
  helper.accessor("vendor_name", { header: "Vendor", cell: (ctx) => ctx.getValue() }),
  helper.accessor("labor_category", { header: "Labor category", cell: (ctx) => ctx.getValue() }),
  helper.accessor("rate_type", {
    header: "Rate type",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("hourly_rate", {
    header: "Observed rate",
    cell: (ctx) => <span className="tabular-nums">{formatMoney(ctx.getValue())}</span>,
  }),
  helper.accessor("opportunity_id", {
    header: "Price a live bid",
    cell: (ctx) => {
      const id = ctx.getValue();
      return id ? (
        <Link className="underline" href={`/procurement/opportunities/${id}/pricing`}>
          Pursuit → Pricing
        </Link>
      ) : (
        <span className="text-muted-foreground">no pursuit linked</span>
      );
    },
  }),
]);

export function CompetitorRatesTable({ rows }: { rows: CompetitorRateRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sourced competitor_pricing_lines yet. A competitor rate only appears after a verified fact is
        promoted.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <Table data-testid="competitor-rates-table">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id} className="text-xs">
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className="py-1.5 text-sm">
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-[11px] text-muted-foreground">
        Competitor rates are comparables, never a target. The final bid is decided by a human in the
        pursuit&apos;s own pricing workbench.
      </p>
    </div>
  );
}
