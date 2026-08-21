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
import type { BuyerPortfolioRow } from "@/lib/intelligence/load-corpus";
import { buildAskHref } from "@/lib/intelligence/ask-launch";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, BuyerPortfolioRow>();

/** A count only becomes a link when there is a record to open. Zero stays a plain zero. */
function CountCell({ value, href }: { value: number; href: string | null }) {
  if (value === 0 || !href) return <span className="tabular-nums text-muted-foreground">{value}</span>;
  return (
    <Link className="tabular-nums underline" href={href}>
      {value}
    </Link>
  );
}

const columns = helper.columns([
  helper.accessor("name", {
    header: "Buyer / agency",
    cell: (ctx) => (
      <Link className="underline" href="/procurement/clients">
        {ctx.getValue()}
      </Link>
    ),
  }),
  helper.accessor("opportunity_count", {
    header: "Solicitations",
    cell: (ctx) => (
      <CountCell
        value={ctx.getValue()}
        href={
          ctx.row.original.latest_opportunity_id
            ? `/procurement/opportunities/${ctx.row.original.latest_opportunity_id}`
            : null
        }
      />
    ),
  }),
  helper.accessor("award_count", {
    header: "Awards",
    cell: (ctx) => (
      <CountCell
        value={ctx.getValue()}
        href={
          ctx.row.original.latest_opportunity_id
            ? `/procurement/opportunities/${ctx.row.original.latest_opportunity_id}/result`
            : null
        }
      />
    ),
  }),
  helper.accessor("contract_count", {
    header: "Contracts",
    cell: (ctx) => (
      <CountCell
        value={ctx.getValue()}
        href={
          ctx.row.original.latest_contract_id
            ? `/contracts/${ctx.row.original.latest_contract_id}`
            : null
        }
      />
    ),
  }),
  helper.accessor("win_loss_count", {
    header: "Win/Loss",
    cell: (ctx) => <CountCell value={ctx.getValue()} href="/intelligence/win-loss" />,
  }),
  helper.accessor("research_count", {
    header: "Public research",
    cell: (ctx) => <span className="tabular-nums">{ctx.getValue()}</span>,
  }),
  helper.accessor("latest_outcome", {
    header: "Latest outcome",
    cell: (ctx) => {
      const v = ctx.getValue();
      return v ? <Badge variant="outline">{v}</Badge> : "—";
    },
  }),
  helper.accessor("id", {
    header: "Ask",
    cell: (ctx) => {
      const row = ctx.row.original;
      return (
        <Link
          className="border px-1.5 py-0.5 text-xs hover:bg-muted"
          title="Buyer brief from verified records only (purpose=GENERAL_QA)"
          href={buildAskHref({
            mode: "report",
            purpose: "GENERAL_QA",
            report: "buyer",
            from: "clients",
            q: row.name,
            filters: {
              buyer: row.name,
              solicitations: row.opportunity_count,
              awards: row.award_count,
              contracts: row.contract_count,
            },
          })}
        >
          Buyer brief
        </Link>
      );
    },
  }),
]);

export function BuyerPortfolioTable({ rows }: { rows: BuyerPortfolioRow[] }) {
  const table = useTable({ features, columns, data: rows });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No buyers match. Register agencies from solicitations — this is procurement intelligence, not CRM.
      </p>
    );
  }
  return (
    <Table data-testid="buyer-portfolio-table">
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
              <TableCell key={cell.id} className="py-1.5">
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
