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
import {
  RADAR_DATA_STATUS_LABELS,
  RADAR_HOLDER_LABELS,
  type RecompeteRadarRow,
} from "@/lib/intelligence/recompete-radar";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, RecompeteRadarRow>();

function Absent({ what }: { what: string }) {
  return (
    <span className="text-muted-foreground" title={`Not recorded: ${what}`}>
      —
    </span>
  );
}

const columns = helper.columns([
  helper.accessor("buyerName", {
    header: "Buyer",
    cell: (ctx) => {
      const value = ctx.getValue();
      return value ? (
        <Link className="underline" href="/intelligence/clients">
          {value}
        </Link>
      ) : (
        <Absent what="buyer" />
      );
    },
  }),
  helper.accessor("incumbent", {
    header: "Incumbent",
    cell: (ctx) => {
      const incumbent = ctx.getValue();
      if (!incumbent) return <Absent what="incumbent — no award notice names a winner" />;
      return (
        <span title={`Basis: ${incumbent.basis}`}>
          {incumbent.name}
          <span className="block text-[10px] text-muted-foreground">{incumbent.basis}</span>
        </span>
      );
    },
  }),
  helper.accessor("contractLabel", {
    header: "Contract / solicitation",
    cell: (ctx) => {
      const row = ctx.row.original;
      if (row.contractId) {
        return (
          <Link className="underline" href={`/contracts/${row.contractId}`}>
            {row.contractLabel}
          </Link>
        );
      }
      if (row.opportunityId) {
        return (
          <Link className="underline" href={`/procurement/opportunities/${row.opportunityId}`}>
            {row.contractLabel}
          </Link>
        );
      }
      return row.contractLabel;
    },
  }),
  helper.accessor("expirationOn", {
    header: "Expiration / options",
    cell: (ctx) => {
      const row = ctx.row.original;
      return (
        <div className="space-y-0.5">
          <span className="tabular-nums">
            {row.expirationOn ?? <Absent what="verified_end_on" />}
          </span>
          {row.options.length > 0 ? (
            <span className="block text-[10px] text-muted-foreground">
              {row.options
                .map((o) => `${o.label}${o.exerciseBy ? ` (by ${o.exerciseBy})` : ""}`)
                .join(" · ")}
            </span>
          ) : (
            <span className="block text-[10px] text-muted-foreground">no options on file</span>
          )}
        </div>
      );
    },
  }),
  helper.accessor("expectedRebid", {
    header: "Expected rebid",
    cell: (ctx) => {
      const rebid = ctx.getValue();
      return (
        <div className="space-y-0.5">
          <span className="tabular-nums">
            {rebid.on ?? <span className="text-muted-foreground">unknown</span>}
          </span>
          <span className="block text-[10px] text-muted-foreground">{rebid.basis}</span>
        </div>
      );
    },
  }),
  helper.accessor("sources", {
    header: "Source",
    cell: (ctx) => {
      const sources = ctx.getValue();
      if (sources.length === 0) return <Absent what="source record" />;
      return (
        <ul className="space-y-0.5 text-[11px]">
          {sources.map((source) => (
            <li key={source.label}>
              {source.href ? (
                <Link className="underline" href={source.href}>
                  {source.label}
                </Link>
              ) : (
                source.label
              )}
            </li>
          ))}
        </ul>
      );
    },
  }),
  helper.accessor("dataStatus", {
    header: "Data status",
    cell: (ctx) => {
      const row = ctx.row.original;
      return (
        <div className="space-y-0.5">
          <Badge variant="outline" title={RADAR_DATA_STATUS_LABELS[row.dataStatus]}>
            {row.dataStatus}
          </Badge>
          <span className="block text-[10px] text-muted-foreground">
            {RADAR_HOLDER_LABELS[row.holder]}
            {row.missing.length > 0 ? ` · missing: ${row.missing.join(", ")}` : ""}
          </span>
        </div>
      );
    },
  }),
]);

export function RecompeteRadarTable({ rows }: { rows: RecompeteRadarRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recompete observed. A radar row needs a verified award or contract record — nothing here is
        generated from an expected term length.
      </p>
    );
  }
  return (
    <Table data-testid="recompete-radar-table">
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
