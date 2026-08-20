"use client";

import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BuyerPortfolioRow } from "@/lib/intelligence/load-corpus";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, BuyerPortfolioRow>();
const columns = helper.columns([
  helper.accessor("name", {
    header: "Buyer / agency",
    cell: (ctx) => (
      <Link className="underline" href={`/procurement/clients`}>
        {ctx.getValue()}
      </Link>
    ),
  }),
  helper.accessor("opportunity_count", {
    header: "Solicitations",
    cell: (ctx) => <span className="tabular-nums">{ctx.getValue()}</span>,
  }),
  helper.accessor("award_count", {
    header: "Awards",
    cell: (ctx) => <span className="tabular-nums">{ctx.getValue()}</span>,
  }),
  helper.accessor("contract_count", {
    header: "Contracts",
    cell: (ctx) => <span className="tabular-nums">{ctx.getValue()}</span>,
  }),
  helper.accessor("win_loss_count", {
    header: "Win/Loss",
    cell: (ctx) => <span className="tabular-nums">{ctx.getValue()}</span>,
  }),
  helper.accessor("research_count", {
    header: "Public research",
    cell: (ctx) => <span className="tabular-nums">{ctx.getValue()}</span>,
  }),
  helper.accessor("latest_outcome", {
    header: "Latest outcome",
    cell: (ctx) => {
      const v = ctx.getValue();
      return v ? <Badge variant="outline">{v}</Badge> : "—";
    },
  }),
]);

export function BuyerPortfolioTable({ rows }: { rows: BuyerPortfolioRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No buyers yet. Register agencies from solicitations — this is procurement intelligence, not CRM.
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
