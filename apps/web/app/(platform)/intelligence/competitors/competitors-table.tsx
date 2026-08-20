"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CompetitorBidRow = {
  id: string;
  competitor_name: string | null;
  opportunity_title: string | null;
  quoted_amount: number | null;
  note: string | null;
  source: string | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, CompetitorBidRow>();
const columns = helper.columns([
  helper.accessor("competitor_name", {
    header: "Competitor",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("opportunity_title", {
    header: "Opportunity",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("quoted_amount", {
    header: "Quoted amount",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  helper.accessor("source", {
    header: "Source",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("note", {
    header: "Note",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

export function CompetitorBidsTable({ rows }: { rows: CompetitorBidRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sourced competitor bids yet. Verify a competitor_bid or competitor_name fact.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
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
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
