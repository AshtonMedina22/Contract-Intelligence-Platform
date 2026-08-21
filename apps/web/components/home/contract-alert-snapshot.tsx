"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell";
import type { ContractAlertBuckets } from "@/lib/home/types";

type Props = {
  buckets: ContractAlertBuckets;
};

const bucketLabels: Record<keyof ContractAlertBuckets, string> = {
  "180": "180 days",
  "120": "120 days",
  "90": "90 days",
  "60": "60 days",
  "30": "30 days",
  EXPIRED: "Expired",
};

const bucketColors: Record<keyof ContractAlertBuckets, string> = {
  "180": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  "120": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  "90": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  "60": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
  "30": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  EXPIRED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function ContractAlertSnapshot({ buckets }: Props) {
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="No contract renewal alerts"
        description="Contracts without verified_end_on dates don't appear here. Verify contract end dates to enable renewal alerts."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(buckets) as Array<keyof ContractAlertBuckets>).map(
          (bucket) =>
            buckets[bucket] > 0 && (
              <Link
                key={bucket}
                href="/contracts/renewals"
                className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm text-muted-foreground">{bucketLabels[bucket]}</span>
                <Badge className={bucketColors[bucket]} variant="outline">
                  {buckets[bucket]}
                </Badge>
              </Link>
            ),
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Based on verified_end_on dates only. Refreshed nightly and on page load.
      </p>
    </div>
  );
}
