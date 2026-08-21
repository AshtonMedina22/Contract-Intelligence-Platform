"use client";

import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/opportunity/pricing-math";

export type PricingLineRow = {
  id: string;
  labor_category: string;
  opportunity_title: string | null;
  opportunity_id: string;
  requested_rate: number | null;
  internal_cost_rate: number | null;
  proposed_rate: number | null;
  awarded_rate: number | null;
  current_rate: number | null;
  requested_source_fact_id: string | null;
  proposed_source_fact_id: string | null;
  awarded_source_fact_id: string | null;
  current_source_fact_id: string | null;
};

/**
 * One column per truth. A rate and its provenance are rendered together so the four commercial
 * truths can never be collapsed into a single "price" column.
 */
function TruthCell({ rate, factId }: { rate: number | null; factId: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <span className="tabular-nums">{formatMoney(rate)}</span>
      <span className="block text-[10px] text-muted-foreground">
        {rate == null ? "not on file" : factId ? `fact ${factId.slice(0, 8)}…` : "no source fact"}
      </span>
    </div>
  );
}

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, PricingLineRow>();
const columns = helper.columns([
  helper.accessor("labor_category", { header: "labor_category" }),
  helper.accessor("opportunity_title", {
    header: "pursuit",
    cell: (ctx) => {
      const row = ctx.row.original;
      return row.opportunity_title ? (
        <Link className="underline" href={`/procurement/opportunities/${row.opportunity_id}`}>
          {row.opportunity_title}
        </Link>
      ) : (
        "—"
      );
    },
  }),
  helper.accessor("requested_rate", {
    header: "requested (buyer)",
    cell: (ctx) => (
      <TruthCell rate={ctx.getValue()} factId={ctx.row.original.requested_source_fact_id} />
    ),
  }),
  helper.accessor("internal_cost_rate", {
    header: "internal_cost (planning)",
    cell: (ctx) => (
      <div className="space-y-0.5">
        <span className="tabular-nums">{formatMoney(ctx.getValue())}</span>
        <span className="block text-[10px] text-muted-foreground">planning only</span>
      </div>
    ),
  }),
  helper.accessor("proposed_rate", {
    header: "submitted (L&P)",
    cell: (ctx) => (
      <TruthCell rate={ctx.getValue()} factId={ctx.row.original.proposed_source_fact_id} />
    ),
  }),
  helper.accessor("awarded_rate", {
    header: "awarded (buyer)",
    cell: (ctx) => (
      <TruthCell rate={ctx.getValue()} factId={ctx.row.original.awarded_source_fact_id} />
    ),
  }),
  helper.accessor("current_rate", {
    header: "current / amended",
    cell: (ctx) => (
      <TruthCell rate={ctx.getValue()} factId={ctx.row.original.current_source_fact_id} />
    ),
  }),
  helper.accessor("id", {
    header: "price a live bid",
    cell: (ctx) => (
      <Link
        className="underline"
        href={`/procurement/opportunities/${ctx.row.original.opportunity_id}/pricing`}
      >
        Pursuit → Pricing
      </Link>
    ),
  }),
]);

export function PricingLinesTable({ rows }: { rows: PricingLineRow[] }) {
  const table = useTable({ features, columns, data: rows });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No promoted pricing lines yet. Verify pricing facts on source documents — AI staging never appears here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Table data-testid="pricing-lines-table">
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
                <TableCell key={cell.id} className="py-1.5 align-top text-sm">
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        The four commercial truths — <strong>requested</strong>, <strong>submitted</strong>,{" "}
        <strong>awarded</strong>, <strong>current/amended</strong> — stay in separate columns and are never
        merged into one price. <code>internal_cost</code> is a planning column, not a commercial truth.
        Source lineage: each commercial rate has a matching <code>*_source_fact_id</code> pointing to{" "}
        <code>extracted_facts</code> after HUMAN_VERIFIED promotion; a blank rate reads{" "}
        <code>not on file</code> rather than zero.
      </p>
    </div>
  );
}
