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
  rank: number | null;
  note: string | null;
  source: string | null;
};

export type CompetitorPricingLineRow = {
  id: string;
  vendor_name: string;
  labor_category: string;
  hourly_rate: number | null;
  extended_amount: number | null;
  opportunity_title: string | null;
  source: string | null;
};

export type EvaluationScoreRow = {
  id: string;
  respondent_name: string;
  opportunity_title: string | null;
  points: number;
  max_points: number | null;
  rank: number | null;
  notes: string | null;
};

const features = tableFeatures({});
const bidHelper = createColumnHelper<typeof features, CompetitorBidRow>();
const bidColumns = bidHelper.columns([
  bidHelper.accessor("competitor_name", {
    header: "Competitor",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  bidHelper.accessor("opportunity_title", {
    header: "Opportunity",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  bidHelper.accessor("quoted_amount", {
    header: "Submitted / observed price",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  bidHelper.accessor("rank", {
    header: "Rank",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  bidHelper.accessor("source", {
    header: "Source",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  bidHelper.accessor("note", {
    header: "Note",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

const lineHelper = createColumnHelper<typeof features, CompetitorPricingLineRow>();
const lineColumns = lineHelper.columns([
  lineHelper.accessor("vendor_name", {
    header: "Vendor",
    cell: (ctx) => ctx.getValue(),
  }),
  lineHelper.accessor("labor_category", {
    header: "Labor category",
    cell: (ctx) => ctx.getValue(),
  }),
  lineHelper.accessor("hourly_rate", {
    header: "Hourly",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  lineHelper.accessor("extended_amount", {
    header: "Extended",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  lineHelper.accessor("opportunity_title", {
    header: "Opportunity",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  lineHelper.accessor("source", {
    header: "Source",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

const scoreHelper = createColumnHelper<typeof features, EvaluationScoreRow>();
const scoreColumns = scoreHelper.columns([
  scoreHelper.accessor("respondent_name", {
    header: "Respondent",
    cell: (ctx) => ctx.getValue(),
  }),
  scoreHelper.accessor("opportunity_title", {
    header: "Opportunity",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  scoreHelper.accessor("points", {
    header: "Points / technical·price score",
    cell: (ctx) => {
      const row = ctx.row.original;
      return row.max_points != null ? `${row.points} / ${row.max_points}` : String(row.points);
    },
  }),
  scoreHelper.accessor("rank", {
    header: "Rank",
    cell: (ctx) => (ctx.getValue() == null ? "—" : String(ctx.getValue())),
  }),
  scoreHelper.accessor("notes", {
    header: "Notes",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

function EmptyTable({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

export function CompetitorBidsTable({ rows }: { rows: CompetitorBidRow[] }) {
  const table = useTable({ features, columns: bidColumns, data: rows });
  if (rows.length === 0) {
    return <EmptyTable message="No sourced competitor bids yet. Verify a competitor_bid fact with a document, fact, or URL." />;
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

export function CompetitorPricingLinesTable({ rows }: { rows: CompetitorPricingLineRow[] }) {
  const table = useTable({ features, columns: lineColumns, data: rows });
  if (rows.length === 0) {
    return <EmptyTable message="No competitor pricing lines promoted yet." />;
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

export function EvaluationScoresTable({ rows }: { rows: EvaluationScoreRow[] }) {
  const table = useTable({ features, columns: scoreColumns, data: rows });
  if (rows.length === 0) {
    return <EmptyTable message="No evaluation scores promoted yet. Scores require verified scorecard facts." />;
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
