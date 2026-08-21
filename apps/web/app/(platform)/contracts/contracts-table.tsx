"use client";

import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { RebidButton } from "@/components/opportunity-workspace/rebid-button";
import {
  CONTRACT_RISK_LABELS,
  CONTRACT_VALUE_KIND_LABELS,
  RENEWAL_BUCKET_LABELS,
  type ContractPortfolioRow,
  type ContractValue,
} from "@/lib/contracts/portfolio-model";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** An absent field reads as absent, and says which field is missing on hover. */
function Absent({ what }: { what: string }) {
  return (
    <span className="text-muted-foreground" title={`Not recorded: ${what}`}>
      —
    </span>
  );
}

function Money({ value, what }: { value: ContractValue | null; what: string }) {
  if (!value) return <Absent what={what} />;
  return (
    <span className="tabular-nums" title={`${CONTRACT_VALUE_KIND_LABELS[value.kind]} · ${value.basis}`}>
      ${value.amount.toLocaleString()}
      <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {value.kind === "NTE_CEILING" ? "NTE" : "PO"}
      </span>
    </span>
  );
}

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ContractPortfolioRow>();

const columns = helper.columns([
  helper.accessor("buyerName", {
    header: "Buyer",
    cell: (ctx) => ctx.getValue() ?? <Absent what="clients.name — no buyer linked" />,
  }),
  helper.accessor("title", {
    header: "Contract",
    cell: (ctx) => (
      <Link className="underline" href={`/contracts/${ctx.row.original.id}`}>
        {ctx.getValue()}
      </Link>
    ),
  }),
  helper.accessor("contractNumber", {
    header: "Contract #",
    cell: (ctx) => ctx.getValue() ?? <Absent what="contracts.contract_number" />,
  }),
  helper.accessor("status", {
    header: "Status",
    cell: (ctx) => {
      const row = ctx.row.original;
      if (row.status === "UNKNOWN") return <Absent what="contracts.verified_end_on" />;
      const label =
        row.bucket != null ? RENEWAL_BUCKET_LABELS[row.bucket] : row.status === "EXPIRED" ? "Expired" : "Active";
      return (
        <Badge variant="outline" title={`Derived from contracts.verified_end_on and contract_alerts.bucket`}>
          {label}
        </Badge>
      );
    },
  }),
  helper.display({
    id: "originalValue",
    header: "Original value",
    cell: (ctx) => <Money value={ctx.row.original.originalValue} what="awards.amount_nte" />,
  }),
  helper.display({
    id: "currentValue",
    header: "Current value",
    cell: (ctx) => <Money value={ctx.row.original.currentValue} what="purchase_orders.total_amount" />,
  }),
  helper.accessor("startOn", {
    header: "Start",
    cell: (ctx) => ctx.getValue() ?? <Absent what="contracts.start_on" />,
  }),
  helper.accessor("expirationOn", {
    header: "Expiration",
    cell: (ctx) => ctx.getValue() ?? <Absent what="contracts.verified_end_on" />,
  }),
  helper.display({
    id: "options",
    header: "Options",
    cell: (ctx) => {
      const row = ctx.row.original;
      if (row.options.length === 0) return <Absent what="contract_options" />;
      return (
        <span title="Exercised vs remaining is not recorded and is not assumed.">
          {row.options.length} on file
          {row.nextOptionExerciseBy ? ` · next ${row.nextOptionExerciseBy}` : ""}
        </span>
      );
    },
  }),
  helper.display({
    id: "nextAction",
    header: "Next action",
    cell: (ctx) => (
      <span title={ctx.row.original.nextAction.basis}>{ctx.row.original.nextAction.label}</span>
    ),
  }),
  helper.display({
    id: "risk",
    header: "Risk",
    cell: (ctx) => {
      const risk = ctx.row.original.risk;
      return (
        <span
          data-risk={risk.level}
          title={risk.note}
          className="inline-block border px-1 py-px text-[10px] uppercase tracking-wide"
        >
          {CONTRACT_RISK_LABELS[risk.level]}
        </span>
      );
    },
  }),
]);

export function ContractsTable({ rows }: { rows: ContractPortfolioRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No contracts match this filter. Portfolio rows appear once a contract end date is verified from an
        awarded or current instrument.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto" data-testid="contract-portfolio-table">
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
  );
}

export type AlertRow = {
  id: string;
  bucket: string;
  days_until: number | null;
  verified_end_on: string | null;
  contract_title: string;
  contract_id: string;
  buyer_name: string | null;
  next_action: string;
  next_action_basis: string;
  options_on_file: number;
  next_option_exercise_by: string | null;
};

const alertFeatures = tableFeatures({});
const alertHelper = createColumnHelper<typeof alertFeatures, AlertRow>();
const alertColumns = alertHelper.columns([
  alertHelper.accessor("bucket", {
    header: "Bucket",
    cell: (ctx) => {
      const bucket = ctx.getValue();
      const label = RENEWAL_BUCKET_LABELS[bucket as keyof typeof RENEWAL_BUCKET_LABELS] ?? bucket;
      return <Badge variant="outline">{label}</Badge>;
    },
  }),
  alertHelper.accessor("days_until", {
    header: "Days",
    cell: (ctx) => ctx.getValue() ?? <Absent what="contract_alerts.days_until" />,
  }),
  alertHelper.accessor("verified_end_on", {
    header: "Verified end",
    cell: (ctx) => ctx.getValue() ?? <Absent what="contracts.verified_end_on" />,
  }),
  alertHelper.accessor("buyer_name", {
    header: "Buyer",
    cell: (ctx) => ctx.getValue() ?? <Absent what="clients.name" />,
  }),
  alertHelper.accessor("contract_title", {
    header: "Contract",
    cell: (ctx) => (
      <Link className="underline" href={`/contracts/${ctx.row.original.contract_id}`}>
        {ctx.getValue()}
      </Link>
    ),
  }),
  alertHelper.display({
    id: "options",
    header: "Options",
    cell: (ctx) => {
      const row = ctx.row.original;
      if (row.options_on_file === 0) return <Absent what="contract_options" />;
      return (
        <span title="Exercised vs remaining is not recorded and is not assumed.">
          {row.options_on_file} on file
          {row.next_option_exercise_by ? ` · next ${row.next_option_exercise_by}` : ""}
        </span>
      );
    },
  }),
  alertHelper.display({
    id: "nextAction",
    header: "Next action",
    cell: (ctx) => <span title={ctx.row.original.next_action_basis}>{ctx.row.original.next_action}</span>,
  }),
  alertHelper.display({
    id: "rebid",
    header: "Rebid",
    cell: (ctx) => (
      <div className="flex items-center gap-2">
        <RebidButton contractId={ctx.row.original.contract_id} />
        <Link
          className="text-xs underline text-muted-foreground hover:text-foreground"
          href={`/contracts/${ctx.row.original.contract_id}/renewal`}
        >
          Renewal tab
        </Link>
      </div>
    ),
  }),
]);

export function RenewalsTable({ rows }: { rows: AlertRow[] }) {
  const table = useTable({ features: alertFeatures, columns: alertColumns, data: rows });
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No renewal alerts. Buckets use verified_end_on only.</p>;
  }
  return (
    <div className="overflow-x-auto" data-testid="renewal-queue-table">
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
  );
}
