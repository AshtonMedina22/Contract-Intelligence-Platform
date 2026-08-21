"use client";

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
import {
  MARKET_START_PURSUIT_NOTE,
  RADAR_DATA_STATUS_LABELS,
  RADAR_HOLDER_LABELS,
  type RecompeteRadarRow,
  type RecompeteWatchStatus,
} from "@/lib/intelligence/recompete-radar";
import {
  dismissRecompeteCandidate,
  startPursuitFromRecompeteAndOpen,
  watchRecompeteCandidate,
} from "./actions";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, RecompeteRadarRow & { watchStatus?: RecompeteWatchStatus | null }>();

function Absent({ what }: { what: string }) {
  return (
    <span className="text-muted-foreground" title={`Not recorded: ${what}`}>
      —
    </span>
  );
}

function CandidateFields({ row }: { row: RecompeteRadarRow }) {
  const sourceUrl = row.sources.find((s) => s.href?.startsWith("http"))?.href ?? null;
  return (
    <>
      <input type="hidden" name="candidate_key" value={row.key} />
      <input type="hidden" name="title" value={row.contractLabel} />
      <input type="hidden" name="buyer_id" value={row.buyerId ?? ""} />
      <input type="hidden" name="buyer_name" value={row.buyerName ?? ""} />
      <input type="hidden" name="contract_id" value={row.contractId ?? ""} />
      <input type="hidden" name="opportunity_id" value={row.opportunityId ?? ""} />
      <input type="hidden" name="incumbent_name" value={row.incumbent?.name ?? ""} />
      <input type="hidden" name="source_url" value={sourceUrl ?? ""} />
      <input type="hidden" name="award_id" value="" />
    </>
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
          {row.watchStatus ? (
            <span className="block text-[10px] text-muted-foreground">Watch: {row.watchStatus}</span>
          ) : null}
        </div>
      );
    },
  }),
  helper.display({
    id: "actions",
    header: "Actions",
    cell: (ctx) => {
      const row = ctx.row.original;
      const watching = row.watchStatus === "WATCHING" || row.watchStatus === "READY_FOR_CAPTURE";
      const started = row.watchStatus === "PURSUIT_STARTED";
      return (
        <div className="flex flex-col gap-1" data-testid="radar-row-actions">
          <form action={watchRecompeteCandidate}>
            <CandidateFields row={row} />
            <Button type="submit" size="sm" variant="outline" disabled={watching || started}>
              {watching ? "Watching" : "Watch"}
            </Button>
          </form>
          <form action={startPursuitFromRecompeteAndOpen}>
            <CandidateFields row={row} />
            <Button
              type="submit"
              size="sm"
              variant="default"
              title={MARKET_START_PURSUIT_NOTE}
              disabled={started}
              data-testid="radar-start-pursuit"
            >
              {started ? "Pursuit started" : "Start Pursuit"}
            </Button>
          </form>
          {watching ? (
            <form action={dismissRecompeteCandidate}>
              <CandidateFields row={row} />
              <Button type="submit" size="sm" variant="ghost">
                Dismiss
              </Button>
            </form>
          ) : null}
        </div>
      );
    },
  }),
]);

export type RadarTableRow = RecompeteRadarRow & { watchStatus?: RecompeteWatchStatus | null };

export function RecompeteRadarTable({ rows }: { rows: RadarTableRow[] }) {
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
