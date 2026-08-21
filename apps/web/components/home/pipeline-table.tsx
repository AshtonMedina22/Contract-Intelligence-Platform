"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PipelinePursuit } from "@/lib/home/types";

type Props = {
  pursuits: PipelinePursuit[];
  showValue?: boolean;
};

const stageColors: Record<string, string> = {
  INTAKE: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  ANALYSIS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  PRICING: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  DRAFTING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  SUBMITTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
};

export function PipelineTable({ pursuits, showValue = false }: Props) {
  if (pursuits.length === 0) {
    return (
      <EmptyState
        title="No active pursuits"
        description="Start a new solicitation from intake to track it here."
      />
    );
  }

  const hasAnyValue = showValue && pursuits.some((p) => p.verifiedAmount !== null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pursuit</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Buyer</TableHead>
          <TableHead>Due</TableHead>
          {hasAnyValue && <TableHead className="text-right">Value</TableHead>}
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pursuits.map((pursuit) => (
          <TableRow key={pursuit.id}>
            <TableCell>
              <Link
                href={`/procurement/opportunities/${pursuit.id}`}
                className="font-medium hover:underline"
              >
                {pursuit.title}
              </Link>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={stageColors[pursuit.stage] ?? ""}
              >
                {pursuit.stage}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {pursuit.clientName ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap">
              {pursuit.responseDueOn ?? "—"}
            </TableCell>
            {hasAnyValue && (
              <TableCell className="text-right tabular-nums">
                {pursuit.verifiedAmount !== null
                  ? `$${pursuit.verifiedAmount.toLocaleString()}`
                  : "—"}
              </TableCell>
            )}
            <TableCell>
              <Link
                href={`/procurement/opportunities/${pursuit.id}`}
                className="text-sm text-primary hover:underline"
              >
                Open
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
