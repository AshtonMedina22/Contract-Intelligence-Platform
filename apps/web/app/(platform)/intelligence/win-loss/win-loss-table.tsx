"use client";

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
import type { OpportunityOutcome } from "@/lib/supabase/database.types";

export type WinLossRow = {
  id: string;
  outcome: OpportunityOutcome;
  documented_reason: string | null;
  internal_analysis: string | null;
  lessons_learned: string | null;
  winner_name: string | null;
  lp_price: number | null;
  winning_price: number | null;
  opportunity_title: string | null;
  lp_score: string | null;
  winning_score: string | null;
  rank: number | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, WinLossRow>();
const columns = helper.columns([
  helper.accessor("opportunity_title", {
    header: "Opportunity",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("outcome", {
    header: "Outcome",
    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
  }),
  helper.accessor("winner_name", {
    header: "Winner",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("lp_price", {
    header: "L&P submitted price",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  helper.accessor("winning_price", {
    header: "Award price",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  helper.accessor("lp_score", {
    header: "L&P score",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("winning_score", {
    header: "Winning score",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("rank", {
    header: "Rank",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  helper.accessor("documented_reason", {
    header: "Documented reason",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("internal_analysis", {
    header: "Internal analysis",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("lessons_learned", {
    header: "Lessons",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

export function WinLossTable({ rows }: { rows: WinLossRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No win/loss reviews yet. Verify outcome, prices, scores, and reasons from source documents. Never infer
        causation without evidence.
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
