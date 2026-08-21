"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell";
import type { MarketSnapshot } from "@/lib/home/types";

type Props = {
  data: MarketSnapshot;
};

export function MarketSnapshotCard({ data }: Props) {
  if (data.clientCount === 0 && data.competitorCount === 0) {
    return (
      <EmptyState
        title="No market intelligence data"
        description="Clients and competitors are populated from verified procurement evidence. Ingest and verify documents to build market intelligence."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        {data.clientCount > 0 && (
          <Link
            href="/intelligence/buyers"
            className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm text-muted-foreground">Buyers/agencies</span>
            <Badge variant="outline" className="tabular-nums">
              {data.clientCount}
            </Badge>
          </Link>
        )}
        {data.competitorCount > 0 && (
          <Link
            href="/intelligence/competitors"
            className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm text-muted-foreground">Competitors</span>
            <Badge variant="outline" className="tabular-nums">
              {data.competitorCount}
            </Badge>
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Counts from verified procurement evidence — see Intelligence for details.
      </p>
    </div>
  );
}
