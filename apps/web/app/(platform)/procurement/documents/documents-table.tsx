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

export type DocumentRow = {
  id: string;
  original_filename: string;
  mime_type: string | null;
  sha256: string | null;
  storage_path: string | null;
  byte_size: number | null;
  source_drive_file_id: string | null;
  processing_status: string;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, DocumentRow>();
const columns = helper.columns([
  helper.accessor("original_filename", { header: "Filename" }),
  helper.accessor("mime_type", {
    header: "Type",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("processing_status", {
    header: "Status",
    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
  }),
  helper.accessor("sha256", {
    header: "SHA-256",
    cell: (ctx) => <span className="break-all font-mono text-xs">{ctx.getValue() ?? "—"}</span>,
  }),
  helper.accessor("storage_path", {
    header: "Storage path",
    cell: (ctx) => <span className="break-all font-mono text-xs">{ctx.getValue() ?? "—"}</span>,
  }),
  helper.accessor("source_drive_file_id", {
    header: "Drive ID",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

export function DocumentsTable({ rows }: { rows: DocumentRow[] }) {
  const table = useTable({
    features,
    columns,
    data: rows,
  });

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No registered documents yet.</p>;
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
