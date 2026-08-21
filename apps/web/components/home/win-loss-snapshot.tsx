"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell";
import type { WinLossSnapshot } from "@/lib/home/types";

type Props = {
  data: WinLossSnapshot;
};

const outcomeColors: Record<string, string> = {
  WON: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  LOST: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  NO_BID: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  NO_AWARD: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function WinLossSnapshotCard({ data }: Props) {
  const totalOutcomes =
    data.wonCount +
    data.lostCount +
    data.pendingCount +
    data.cancelledCount +
    data.noBidCount +
    data.noAwardCount;

  if (totalOutcomes === 0) {
    return (
      <EmptyState
        title="No win/loss outcomes recorded"
        description="Outcome data comes from verified win_loss_reviews. Record results after pursuits complete."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Won:</span>
          <Badge className={outcomeColors.WON} variant="outline">
            {data.wonCount}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Lost:</span>
          <Badge className={outcomeColors.LOST} variant="outline">
            {data.lostCount}
          </Badge>
        </div>
        {data.pendingCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Pending:</span>
            <Badge className={outcomeColors.PENDING} variant="outline">
              {data.pendingCount}
            </Badge>
          </div>
        )}
        {data.noBidCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">No bid:</span>
            <Badge className={outcomeColors.NO_BID} variant="outline">
              {data.noBidCount}
            </Badge>
          </div>
        )}
        {data.cancelledCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Cancelled:</span>
            <Badge className={outcomeColors.CANCELLED} variant="outline">
              {data.cancelledCount}
            </Badge>
          </div>
        )}
        {data.noAwardCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">No award:</span>
            <Badge className={outcomeColors.NO_AWARD} variant="outline">
              {data.noAwardCount}
            </Badge>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Observed outcomes only — not a corporate win-rate trend.
      </p>

      {data.recentOutcomes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Recent outcomes
          </p>
          {data.recentOutcomes.map((outcome) => (
            <Link
              key={outcome.id}
              href={`/procurement/opportunities/${outcome.opportunityId}/result`}
              className="flex items-center gap-2 text-sm hover:bg-muted/50 rounded px-2 py-1 -mx-2"
            >
              <Badge className={outcomeColors[outcome.outcome] ?? ""} variant="outline">
                {outcome.outcome}
              </Badge>
              <span className="truncate">{outcome.opportunityTitle}</span>
              {outcome.winnerName && outcome.outcome === "LOST" && (
                <span className="text-muted-foreground text-xs">
                  → {outcome.winnerName}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
