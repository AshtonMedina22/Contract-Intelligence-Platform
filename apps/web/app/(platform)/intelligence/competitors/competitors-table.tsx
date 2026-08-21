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
import { EvidenceBasisBadge } from "@/components/intelligence/honesty-strip";

/** Where a row's value can be checked. `documentId` opens the verification workspace. */
export type EvidenceSource = {
  url: string | null;
  documentId: string | null;
  factId: string | null;
};

export type CompetitorBidRow = {
  id: string;
  competitor_name: string | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  quoted_amount: number | null;
  rank: number | null;
  note: string | null;
  source: EvidenceSource;
};

export type CompetitorPricingLineRow = {
  id: string;
  vendor_name: string;
  labor_category: string;
  hourly_rate: number | null;
  extended_amount: number | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  source: EvidenceSource;
};

export type EvaluationScoreRow = {
  id: string;
  respondent_name: string;
  opportunity_id: string | null;
  opportunity_title: string | null;
  points: number;
  max_points: number | null;
  rank: number | null;
  notes: string | null;
};

function SourceCell({ source }: { source: EvidenceSource }) {
  if (source.documentId) {
    return (
      <Link className="underline" href={`/ingestion/verification/${source.documentId}`}>
        Verify document
        <span className="block font-mono text-[10px] text-muted-foreground">
          {source.documentId.slice(0, 8)}…
        </span>
      </Link>
    );
  }
  if (source.url) {
    return (
      <a className="break-all underline" href={source.url} rel="noreferrer noopener" target="_blank">
        Public source
      </a>
    );
  }
  if (source.factId) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground" title="Promoted from a verified fact">
        fact {source.factId.slice(0, 8)}…
      </span>
    );
  }
  return <span className="text-muted-foreground">no source recorded</span>;
}

function PursuitCell({ id, title }: { id: string | null; title: string | null }) {
  if (!title) return <span className="text-muted-foreground">—</span>;
  if (!id) return <>{title}</>;
  return (
    <Link className="underline" href={`/procurement/opportunities/${id}`}>
      {title}
    </Link>
  );
}

const features = tableFeatures({});
const bidHelper = createColumnHelper<typeof features, CompetitorBidRow>();
const bidColumns = bidHelper.columns([
  bidHelper.accessor("competitor_name", {
    header: "Competitor",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  bidHelper.accessor("opportunity_title", {
    header: "Pursuit",
    cell: (ctx) => (
      <PursuitCell id={ctx.row.original.opportunity_id} title={ctx.getValue()} />
    ),
  }),
  bidHelper.accessor("quoted_amount", {
    header: "Submitted / observed price",
    cell: (ctx) => (
      <span className="tabular-nums">{ctx.getValue() == null ? "—" : String(ctx.getValue())}</span>
    ),
  }),
  bidHelper.accessor("rank", {
    header: "Rank",
    cell: (ctx) => (
      <span className="tabular-nums">{ctx.getValue() == null ? "—" : String(ctx.getValue())}</span>
    ),
  }),
  bidHelper.accessor("source", {
    header: "Source → verification",
    cell: (ctx) => <SourceCell source={ctx.getValue()} />,
  }),
  bidHelper.accessor("note", {
    header: "Note",
    cell: (ctx) => (
      <span className="line-clamp-2 whitespace-pre-wrap">{ctx.getValue() ?? "—"}</span>
    ),
  }),
]);

const lineHelper = createColumnHelper<typeof features, CompetitorPricingLineRow>();
const lineColumns = lineHelper.columns([
  lineHelper.accessor("vendor_name", { header: "Vendor", cell: (ctx) => ctx.getValue() }),
  lineHelper.accessor("labor_category", { header: "Labor category", cell: (ctx) => ctx.getValue() }),
  lineHelper.accessor("hourly_rate", {
    header: "Hourly",
    cell: (ctx) => (
      <span className="tabular-nums">{ctx.getValue() == null ? "—" : String(ctx.getValue())}</span>
    ),
  }),
  lineHelper.accessor("extended_amount", {
    header: "Extended",
    cell: (ctx) => (
      <span className="tabular-nums">{ctx.getValue() == null ? "—" : String(ctx.getValue())}</span>
    ),
  }),
  lineHelper.accessor("opportunity_title", {
    header: "Pursuit",
    cell: (ctx) => (
      <PursuitCell id={ctx.row.original.opportunity_id} title={ctx.getValue()} />
    ),
  }),
  lineHelper.accessor("source", {
    header: "Source → verification",
    cell: (ctx) => <SourceCell source={ctx.getValue()} />,
  }),
]);

const scoreHelper = createColumnHelper<typeof features, EvaluationScoreRow>();
const scoreColumns = scoreHelper.columns([
  scoreHelper.accessor("respondent_name", { header: "Respondent", cell: (ctx) => ctx.getValue() }),
  scoreHelper.accessor("opportunity_title", {
    header: "Pursuit",
    cell: (ctx) => (
      <PursuitCell id={ctx.row.original.opportunity_id} title={ctx.getValue()} />
    ),
  }),
  scoreHelper.accessor("points", {
    header: "Points (as scored)",
    cell: (ctx) => {
      const row = ctx.row.original;
      return (
        <span className="tabular-nums">
          {row.max_points != null ? `${row.points} / ${row.max_points}` : String(row.points)}
        </span>
      );
    },
  }),
  scoreHelper.accessor("rank", {
    header: "Rank",
    cell: (ctx) => (
      <span className="tabular-nums">{ctx.getValue() == null ? "—" : String(ctx.getValue())}</span>
    ),
  }),
  scoreHelper.accessor("notes", {
    header: "Evaluator notes (quoted)",
    cell: (ctx) => (
      <span className="line-clamp-2 whitespace-pre-wrap">{ctx.getValue() ?? "—"}</span>
    ),
  }),
]);

function EmptyTable({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

export function CompetitorBidsTable({ rows }: { rows: CompetitorBidRow[] }) {
  const table = useTable({ features, columns: bidColumns, data: rows });
  if (rows.length === 0) {
    return (
      <EmptyTable message="No sourced competitor bids yet. Verify a competitor_bid fact with a document, fact, or URL." />
    );
  }
  return (
    <div className="space-y-1">
      <Table data-testid="competitor-bids-table">
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
      <p className="text-[11px] text-muted-foreground">
        <EvidenceBasisBadge basis="OBSERVED" /> Each row is one buyer-published or document-sourced bid.
        Rank is the buyer&apos;s rank on that pursuit, not a standing.
      </p>
    </div>
  );
}

export function CompetitorPricingLinesTable({ rows }: { rows: CompetitorPricingLineRow[] }) {
  const table = useTable({ features, columns: lineColumns, data: rows });
  if (rows.length === 0) {
    return <EmptyTable message="No competitor pricing lines promoted yet." />;
  }
  return (
    <div className="space-y-1">
      <Table data-testid="competitor-pricing-lines-table">
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
      <p className="text-[11px] text-muted-foreground">
        <EvidenceBasisBadge basis="OBSERVED" /> Rates are as published on that pursuit. They are not
        normalised across years, scopes or wage determinations.
      </p>
    </div>
  );
}

export function EvaluationScoresTable({ rows }: { rows: EvaluationScoreRow[] }) {
  const table = useTable({ features, columns: scoreColumns, data: rows });
  if (rows.length === 0) {
    return (
      <EmptyTable message="No evaluation scores promoted yet. Scores require verified scorecard facts." />
    );
  }
  return (
    <div className="space-y-1">
      <Table data-testid="evaluation-scores-table">
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
      <p className="text-[11px] text-muted-foreground">
        <EvidenceBasisBadge basis="OBSERVED" /> Points and rank are copied from the buyer&apos;s
        scorecard. Comparing scores across pursuits is an{" "}
        <EvidenceBasisBadge basis="INFERENCE" /> — rubrics and weights differ by solicitation.
      </p>
    </div>
  );
}
