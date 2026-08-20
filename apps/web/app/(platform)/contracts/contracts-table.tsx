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

export type ContractRow = {
  id: string;
  title: string;
  contract_number: string | null;
  verified_end_on: string | null;
  client_name: string | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ContractRow>();
const columns = helper.columns([
  helper.accessor("title", {
    header: "Contract",
    cell: (ctx) => (
      <Link className="underline" href={`/contracts/${ctx.row.original.id}`}>
        {ctx.getValue()}
      </Link>
    ),
  }),
  helper.accessor("contract_number", {
    header: "Number",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("client_name", {
    header: "Client",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor("verified_end_on", {
    header: "Verified end",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

export function ContractsTable({ rows }: { rows: ContractRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No contracts yet. Verify a contract end date on an awarded/current document.
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

export type AlertRow = {
  id: string;
  bucket: string;
  days_until: number;
  verified_end_on: string;
  contract_title: string;
  contract_id: string;
};

const alertFeatures = tableFeatures({});
const alertHelper = createColumnHelper<typeof alertFeatures, AlertRow>();
const alertColumns = alertHelper.columns([
  alertHelper.accessor("bucket", {
    header: "Bucket",
    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
  }),
  alertHelper.accessor("days_until", { header: "Days" }),
  alertHelper.accessor("verified_end_on", { header: "Verified end" }),
  alertHelper.accessor("contract_title", {
    header: "Contract",
    cell: (ctx) => (
      <Link className="underline" href={`/contracts/${ctx.row.original.contract_id}`}>
        {ctx.getValue()}
      </Link>
    ),
  }),
]);

export function RenewalsTable({ rows }: { rows: AlertRow[] }) {
  const table = useTable({ features: alertFeatures, columns: alertColumns, data: rows });
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No renewal alerts. Buckets use verified_end_on only.</p>;
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
