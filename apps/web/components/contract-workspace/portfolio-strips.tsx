import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_SCOPE_NOTE,
  LP_PORTFOLIO_VS_MARKET_RADAR_NOTE,
  MARKET_RADAR_CONTRAST_LABEL,
  MARKET_RADAR_ROUTE,
  NO_AUTO_ACTION_NOTE,
  PORTFOLIO_HONESTY_TEXT,
  RENEWAL_BUCKETS,
  RENEWAL_BUCKET_DEFINITION,
  RENEWAL_BUCKET_LABELS,
  RENEWALS_ROUTE,
  type AutomationAudit,
  type RenewalBucket,
} from "@/lib/contracts/portfolio-model";

/**
 * The one honesty strip every Contracts view renders under its PageHeader. It carries the verified-
 * dates-only claim and the sentence that separates this portfolio from the Intelligence radar, so
 * the two claims cannot drift apart across five pages.
 */
export function ContractHonestyStrip({
  extra,
  className,
}: {
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      data-testid="contracts-honesty-strip"
      className={cn(
        "border-l-2 border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="font-medium text-foreground">{PORTFOLIO_HONESTY_TEXT}</span>{" "}
      <span>
        <span className="font-medium text-foreground">{MARKET_RADAR_CONTRAST_LABEL}:</span>{" "}
        {LP_PORTFOLIO_VS_MARKET_RADAR_NOTE}{" "}
        <Link className="underline hover:text-foreground" href={MARKET_RADAR_ROUTE}>
          Open the Market Recompete Radar
        </Link>
        .
      </span>
      {extra ? <span> {extra}</span> : null}
    </p>
  );
}

/** The six renewal buckets with their counts. Links into the queue filtered nowhere — one queue. */
export function RenewalBucketStrip({
  buckets,
  className,
  linkToQueue = true,
}: {
  buckets: Record<RenewalBucket, number>;
  className?: string;
  linkToQueue?: boolean;
}) {
  const total = RENEWAL_BUCKETS.reduce((sum, b) => sum + (buckets[b] ?? 0), 0);
  return (
    <div data-testid="renewal-bucket-strip" className={cn("space-y-1", className)}>
      <dl className="grid grid-cols-3 gap-px border bg-border text-sm sm:grid-cols-6">
        {RENEWAL_BUCKETS.map((bucket) => (
          <div key={bucket} className="bg-background px-2.5 py-2" data-bucket={bucket}>
            <dt className="truncate text-xs text-muted-foreground">{RENEWAL_BUCKET_LABELS[bucket]}</dt>
            <dd className="text-base font-semibold tabular-nums">{buckets[bucket] ?? 0}</dd>
            <dd className="text-[11px] tabular-nums text-muted-foreground">
              n={buckets[bucket] ?? 0} contracts
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-muted-foreground">
        n={total} bucketed contract{total === 1 ? "" : "s"} · {RENEWAL_BUCKET_DEFINITION}
        {linkToQueue ? (
          <>
            {" "}
            <Link className="underline hover:text-foreground" href={RENEWALS_ROUTE}>
              Open the renewal queue
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}

/**
 * Thin audit strip for the only automation that touches contracts. It states when buckets were last
 * computed, on what schedule, and what the job is not allowed to do.
 */
export function AutomationAuditStrip({ audit, className }: { audit: AutomationAudit; className?: string }) {
  return (
    <p
      data-testid="contracts-automation-audit"
      className={cn("border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground", className)}
    >
      <span className="font-medium text-foreground">Automation:</span> <code>{audit.job}</code> ·{" "}
      {audit.schedule} · {audit.lastRefreshLabel}. {audit.onLoadNote} {AUTOMATION_SCOPE_NOTE}{" "}
      <span className="font-medium text-foreground">{NO_AUTO_ACTION_NOTE}</span>
    </p>
  );
}
