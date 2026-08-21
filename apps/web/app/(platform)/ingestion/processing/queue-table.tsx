"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  lifecycle_error: string | null;
  batch_label: string | null;
  sha256: string | null;
  storage_path: string | null;
  workflow_run_id: string | null;
  created_at: string;
};

type OperatorBadge = "QUEUED" | "PROCESSING" | "NEEDS_REVIEW" | "FAILED" | "OCR_REQUIRED" | "COMPLETE";

function computeOperatorBadge(row: QueueRow): OperatorBadge {
  const status = row.processing_status;
  const error = row.lifecycle_error ?? "";

  if (status === "VERIFIED") return "COMPLETE";
  if (error.startsWith("OCR_REQUIRED")) return "OCR_REQUIRED";
  if (error.toLowerCase().includes("ocr")) return "OCR_REQUIRED";
  if (status === "QUEUED") return "QUEUED";
  if (status === "PARSING" || status === "EXTRACTING" || status === "VALIDATING") return "PROCESSING";
  if (status === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  if (status === "FAILED") return "FAILED";
  return "QUEUED";
}

const badgeVariants: Record<OperatorBadge, { className: string }> = {
  QUEUED: { className: "bg-muted text-muted-foreground" },
  PROCESSING: { className: "bg-blue-100 text-blue-700" },
  NEEDS_REVIEW: { className: "bg-yellow-100 text-yellow-700" },
  FAILED: { className: "bg-red-100 text-red-700" },
  OCR_REQUIRED: { className: "bg-orange-100 text-orange-700" },
  COMPLETE: { className: "bg-green-100 text-green-700" },
};

function OperatorBadgeCell({ row }: { row: QueueRow }) {
  const badge = computeOperatorBadge(row);
  return (
    <Badge variant="outline" className={badgeVariants[badge].className}>
      {badge}
    </Badge>
  );
}

const filterChips: { label: string; filter: OperatorBadge | "ALL" }[] = [
  { label: "All", filter: "ALL" },
  { label: "Queued", filter: "QUEUED" },
  { label: "Processing", filter: "PROCESSING" },
  { label: "Needs Review", filter: "NEEDS_REVIEW" },
  { label: "Failed", filter: "FAILED" },
  { label: "OCR Required", filter: "OCR_REQUIRED" },
  { label: "Complete", filter: "COMPLETE" },
];

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, QueueRow>();

export function ProcessingQueueTable({ rows }: { rows: QueueRow[] }) {
  const [activeFilter, setActiveFilter] = useState<OperatorBadge | "ALL">("ALL");

  const filteredRows = useMemo(() => {
    if (activeFilter === "ALL") return rows;
    return rows.filter((row) => computeOperatorBadge(row) === activeFilter);
  }, [rows, activeFilter]);

  const columns = useMemo(() => helper.columns([
    helper.accessor("original_filename", {
      header: "Filename",
      cell: (ctx) => (
        <Link
          href={`/ingestion/verification/${ctx.row.original.id}`}
          className="font-medium underline hover:no-underline"
        >
          {ctx.getValue()}
        </Link>
      ),
    }),
    helper.accessor("batch_label", {
      header: "Batch",
      cell: (ctx) => ctx.getValue() ?? "—",
    }),
    helper.display({
      id: "operator_status",
      header: "Status",
      cell: (ctx) => <OperatorBadgeCell row={ctx.row.original} />,
    }),
    helper.accessor("lifecycle_error", {
      header: "Error",
      cell: (ctx) => {
        const error = ctx.getValue();
        if (!error) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="max-w-xs truncate text-xs text-red-600" title={error}>
            {error.length > 60 ? `${error.slice(0, 60)}…` : error}
          </span>
        );
      },
    }),
    helper.accessor("sha256", {
      header: "SHA-256",
      cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue()?.slice(0, 12) ?? "—"}</span>,
    }),
    helper.accessor("created_at", {
      header: "Created",
      cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
    }),
  ]), []);

  const table = useTable({
    features,
    columns,
    data: filteredRows,
  });

  const counts = useMemo(() => {
    const map: Record<OperatorBadge | "ALL", number> = {
      ALL: rows.length,
      QUEUED: 0,
      PROCESSING: 0,
      NEEDS_REVIEW: 0,
      FAILED: 0,
      OCR_REQUIRED: 0,
      COMPLETE: 0,
    };
    for (const row of rows) {
      map[computeOperatorBadge(row)]++;
    }
    return map;
  }, [rows]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents in the registry yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip) => (
          <Button
            key={chip.filter}
            size="sm"
            variant={activeFilter === chip.filter ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.filter)}
          >
            {chip.label} ({counts[chip.filter]})
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
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
      </div>

      {filteredRows.length === 0 && rows.length > 0 && (
        <p className="text-sm text-muted-foreground">No documents match this filter.</p>
      )}
    </div>
  );
}
