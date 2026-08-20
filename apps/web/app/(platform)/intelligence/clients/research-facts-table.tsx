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
import type { FactVerificationStatus } from "@/lib/supabase/database.types";

export type ResearchFactRow = {
  id: string;
  source_url: string;
  title: string | null;
  excerpt: string | null;
  published_on: string | null;
  retrieved_at: string;
  verification_status: FactVerificationStatus;
  client_name: string | null;
  competitor_name: string | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ResearchFactRow>();
const columns = helper.columns([
  helper.accessor("client_name", {
    header: "Client",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("competitor_name", {
    header: "Competitor",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("title", {
    header: "Title",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("source_url", {
    header: "URL",
    cell: (ctx) => (
      <a className="underline" href={ctx.getValue()} target="_blank" rel="noreferrer">
        {ctx.getValue()}
      </a>
    ),
  }),
  helper.accessor("published_on", {
    header: "Published",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("verification_status", {
    header: "Status",
    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
  }),
]);

export function ResearchFactsTable({ rows }: { rows: ResearchFactRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No research facts yet. Verify a research_url or source_url fact, including the URL and date.
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
