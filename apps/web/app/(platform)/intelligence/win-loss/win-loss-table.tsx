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
import { formatMoney } from "@/lib/opportunity/pricing-math";
import type { OpportunityOutcome } from "@/lib/supabase/database.types";

export type WinLossRow = {
  id: string;
  opportunity_id: string;
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
    header: "Pursuit",
    cell: (ctx) => {
      const row = ctx.row.original;
      const label = ctx.getValue() ?? row.opportunity_id.slice(0, 8);
      return (
        <Link className="underline" href={`/procurement/opportunities/${row.opportunity_id}/result`}>
          {label}
        </Link>
      );
    },
  }),
  helper.accessor("outcome", {
    header: "Outcome",
    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
  }),
  helper.accessor("winner_name", {
    header: "Winner (buyer-documented)",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("lp_price", {
    header: "L&P submitted price",
    cell: (ctx) => <span className="tabular-nums">{formatMoney(ctx.getValue())}</span>,
  }),
  helper.accessor("winning_price", {
    header: "Award price",
    cell: (ctx) => <span className="tabular-nums">{formatMoney(ctx.getValue())}</span>,
  }),
  helper.accessor("lp_score", {
    header: "L&P score",
    cell: (ctx) => <span className="tabular-nums">{ctx.getValue() ?? "—"}</span>,
  }),
  helper.accessor("winning_score", {
    header: "Winning score",
    cell: (ctx) => <span className="tabular-nums">{ctx.getValue() ?? "—"}</span>,
  }),
  helper.accessor("rank", {
    header: "Rank",
    cell: (ctx) => (
      <span className="tabular-nums">{ctx.getValue() == null ? "—" : String(ctx.getValue())}</span>
    ),
  }),
  helper.accessor("documented_reason", {
    header: "Documented reason (buyer)",
    cell: (ctx) => (
      <span className="line-clamp-3 whitespace-pre-wrap">{ctx.getValue() ?? "—"}</span>
    ),
  }),
  helper.accessor("internal_analysis", {
    header: "Internal analysis (never sent)",
    cell: (ctx) => (
      <span className="line-clamp-3 whitespace-pre-wrap">{ctx.getValue() ?? "—"}</span>
    ),
  }),
  helper.accessor("lessons_learned", {
    header: "Lessons (internal)",
    cell: (ctx) => (
      <span className="line-clamp-3 whitespace-pre-wrap">{ctx.getValue() ?? "—"}</span>
    ),
  }),
]);

export function WinLossTable({ rows }: { rows: WinLossRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No win/loss reviews match. Verify outcome, prices, scores, and reasons from source documents. Never
        infer causation without evidence.
      </p>
    );
  }
  return (
    <Table data-testid="win-loss-table">
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
              <TableCell key={cell.id} className="py-1.5 align-top text-sm">
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
