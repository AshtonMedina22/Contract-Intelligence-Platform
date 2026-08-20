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
import type { DocumentProcessingStatus } from "@/lib/supabase/database.types";

export type QueueRow = {
  id: string;
  original_filename: string;
  processing_status: DocumentProcessingStatus;
  batch_label: string | null;
  sha256: string | null;
  storage_path: string | null;
  workflow_run_id: string | null;
  created_at: string;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, QueueRow>();
const columns = helper.columns([
  helper.accessor("original_filename", { header: "Filename" }),
  helper.accessor("batch_label", {
    header: "Batch",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("processing_status", {
    header: "Status",
    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
  }),
  helper.accessor("sha256", {
    header: "SHA-256",
    cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue()?.slice(0, 12) ?? "—"}</span>,
  }),
  helper.accessor("workflow_run_id", {
    header: "Workflow",
    cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue() ?? "—"}</span>,
  }),
  helper.accessor("created_at", {
    header: "Created",
    cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
  }),
]);

export function ProcessingQueueTable({ rows }: { rows: QueueRow[] }) {
  const table = useTable({
    features,
    columns,
    data: rows,
  });

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents in the registry yet.</p>;
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
