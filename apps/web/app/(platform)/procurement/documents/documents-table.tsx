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

export type DocumentRow = {
  id: string;
  original_filename: string;
  mime_type: string | null;
  document_type: string | null;
  commercial_truth: string | null;
  processing_status: string;
  opportunity_id: string | null;
  opportunity_title: string | null;
  sha256: string | null;
  storage_path: string | null;
  byte_size: number | null;
  source_drive_file_id: string | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, DocumentRow>();
const columns = helper.columns([
  helper.accessor("original_filename", { header: "original_filename" }),
  helper.accessor("document_type", {
    header: "document_type",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("commercial_truth", {
    header: "commercial_truth",
    cell: (ctx) => {
      const v = ctx.getValue();
      return v ? <Badge variant="outline">{v}</Badge> : "—";
    },
  }),
  helper.accessor("processing_status", {
    header: "processing_status",
    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
  }),
  helper.accessor("opportunity_title", {
    header: "opportunity_id",
    cell: (ctx) => {
      const row = ctx.row.original;
      if (!row.opportunity_id) return "—";
      return (
        <Link className="underline" href={`/procurement/opportunities/${row.opportunity_id}`}>
          {row.opportunity_title ?? row.opportunity_id.slice(0, 8)}
        </Link>
      );
    },
  }),
  helper.accessor("sha256", {
    header: "sha256",
    cell: (ctx) => <span className="break-all font-mono text-xs">{ctx.getValue() ?? "—"}</span>,
  }),
  helper.accessor("id", {
    header: "actions",
    cell: (ctx) => (
      <Link className="text-xs underline" href={`/ingestion/verification/${ctx.getValue()}`}>
        Verify
      </Link>
    ),
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
  );
}
