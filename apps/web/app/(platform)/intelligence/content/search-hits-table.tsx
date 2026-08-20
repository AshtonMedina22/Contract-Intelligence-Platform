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
import type { ReuseStatus } from "@/lib/supabase/database.types";

export type SearchHitRow = {
  chunk_id: string;
  document_id: string;
  source_fact_id: string | null;
  storage_path: string;
  source_page: number | null;
  field: string | null;
  content: string;
  reuse_status: ReuseStatus;
  rank: number;
  match_kind: string;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, SearchHitRow>();
const columns = helper.columns([
  helper.accessor("field", {
    header: "field",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("content", {
    header: "document_chunks.content",
    cell: (ctx) => <span className="line-clamp-3 whitespace-pre-wrap">{ctx.getValue()}</span>,
  }),
  helper.accessor("chunk_id", {
    header: "document_chunks.id",
    cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue().slice(0, 8)}…</span>,
  }),
  helper.accessor("storage_path", {
    header: "Storage original",
    cell: (ctx) => (
      <code className="break-all text-xs">{ctx.getValue()}</code>
    ),
  }),
  helper.accessor("source_page", {
    header: "Page",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("match_kind", {
    header: "Match",
    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
  }),
  helper.accessor("source_fact_id", {
    header: "source_fact_id",
    cell: (ctx) => {
      const v = ctx.getValue();
      return v ? <span className="font-mono text-xs">{String(v).slice(0, 8)}…</span> : "—";
    },
  }),
  helper.accessor("document_id", {
    header: "documents.id",
    cell: (ctx) => (
      <Link className="underline" href={`/ingestion/verification/${ctx.getValue()}`}>
        Verify doc
      </Link>
    ),
  }),
]);

export function SearchHitsTable({ rows }: { rows: SearchHitRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No verified chunks matched. Unverified staging is never returned as truth.
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
