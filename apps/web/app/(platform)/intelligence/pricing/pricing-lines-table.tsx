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

export type PricingLineRow = {
  id: string;
  labor_category: string;
  opportunity_title: string | null;
  opportunity_id: string;
  requested_rate: number | null;
  internal_cost_rate: number | null;
  proposed_rate: number | null;
  awarded_rate: number | null;
  current_rate: number | null;
  requested_source_fact_id: string | null;
  proposed_source_fact_id: string | null;
  awarded_source_fact_id: string | null;
  current_source_fact_id: string | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, PricingLineRow>();
const columns = helper.columns([
  helper.accessor("labor_category", { header: "labor_category" }),
  helper.accessor("opportunity_title", {
    header: "opportunity",
    cell: (ctx) => {
      const row = ctx.row.original;
      return row.opportunity_title ? (
        <Link className="underline" href={`/procurement/opportunities/${row.opportunity_id}`}>
          {row.opportunity_title}
        </Link>
      ) : (
        "—"
      );
    },
  }),
  helper.accessor("requested_rate", {
    header: "requested",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("internal_cost_rate", {
    header: "internal_cost",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("proposed_rate", {
    header: "submitted",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("awarded_rate", {
    header: "awarded",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("current_rate", {
    header: "current",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

export function PricingLinesTable({ rows }: { rows: PricingLineRow[] }) {
  const table = useTable({ features, columns, data: rows });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No promoted pricing lines yet. Verify pricing facts on source documents — AI staging never appears here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id} className="font-mono text-xs">
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
                <TableCell key={cell.id} className="text-sm">
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Source lineage: each rate column has a matching <code>*_source_fact_id</code> pointing to{" "}
        <code>extracted_facts</code> after HUMAN_VERIFIED promotion.
      </p>
    </div>
  );
}
