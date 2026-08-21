import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RebidButton } from "@/components/opportunity-workspace/rebid-button";
import { loadContractRenewal } from "@/lib/contracts/load-workspace";
import {
  assessRebidReadiness,
  automationAudit,
  isRenewalBucket,
  LP_PORTFOLIO_VS_MARKET_RADAR_NOTE,
  MARKET_RADAR_CONTRAST_LABEL,
  MARKET_RADAR_ROUTE,
  NO_AUTO_ACTION_NOTE,
  REBID_CTA_LABEL,
  REBID_CTA_NOTE,
  RENEWAL_BUCKET_DEFINITION,
  RENEWAL_BUCKET_LABELS,
  RENEWALS_ROUTE,
  summarizeRenewalBuckets,
} from "@/lib/contracts/portfolio-model";
import {
  AutomationAuditStrip,
  RenewalBucketStrip,
} from "@/components/contract-workspace/portfolio-strips";

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default async function ContractRenewalPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, title, verified_end_on, opportunity_id")
    .eq("id", contractId)
    .maybeSingle();

  const data = await loadContractRenewal(contractId);
  const today = new Date().toISOString().slice(0, 10);

  const readiness = assessRebidReadiness({ compliance: data.compliance, today });
  const buckets = summarizeRenewalBuckets(
    data.alerts.map((a) => ({ bucket: isRenewalBucket(a.bucket) ? a.bucket : null })),
  );
  const alertsComputedOn = data.alerts.reduce<string | null>(
    (latest, alert) => (alert.computed_on && (!latest || alert.computed_on > latest) ? alert.computed_on : latest),
    null,
  );

  const openOptions = data.options.filter((o) => !o.exercise_by || o.exercise_by >= today);

  return (
    <div className="space-y-6">
      <p
        data-testid="renewal-vs-market-radar"
        className="border-l-2 border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground"
      >
        <span className="font-medium text-foreground">{MARKET_RADAR_CONTRAST_LABEL}:</span>{" "}
        {LP_PORTFOLIO_VS_MARKET_RADAR_NOTE} A rebid started here defends work L&P already holds; the radar is
        work L&P would be entering for the first time.{" "}
        <Link className="underline hover:text-foreground" href={MARKET_RADAR_ROUTE}>
          Intelligence → Market
        </Link>
        {" · "}
        <Link className="underline hover:text-foreground" href={RENEWALS_ROUTE}>
          Portfolio renewal queue
        </Link>
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Expiration</h2>
        <p className="text-sm">Verified end: {dash(contract?.verified_end_on)}</p>
        {!contract?.verified_end_on ? (
          <p className="text-sm text-muted-foreground">
            No verified end date on file, so no bucket can be computed. This contract is not assumed active
            and not assumed expiring.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Alert buckets (verified dates only)</h2>
        <RenewalBucketStrip buckets={buckets} linkToQueue={false} />
        <p className="text-xs text-muted-foreground">{RENEWAL_BUCKET_DEFINITION}</p>
        {data.alerts.length > 0 ? (
          <ul className="list-disc pl-5 text-sm">
            {data.alerts.map((alert) => (
              <li key={alert.id}>
                {isRenewalBucket(alert.bucket) ? RENEWAL_BUCKET_LABELS[alert.bucket] : alert.bucket} ·{" "}
                {alert.days_until} days · end {alert.verified_end_on}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            None. Alerts require a verified_end_on and refresh_contract_alerts.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Options on file</h2>
        {data.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file — remaining/exercised not assumed.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {data.options.length} option row(s) · {openOptions.length} with open or unstated exercise-by
              (not inferred as exercised).
            </p>
            <ul className="list-disc pl-5 text-sm">
              {data.options.map((row) => (
                <li key={row.id}>
                  {row.label}
                  {row.exercise_by ? ` · exercise by ${row.exercise_by}` : " · no exercise-by date recorded"}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Renewal / termination notices</h2>
        {data.renewals.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {data.renewals.map((row) => (
              <li key={row.id}>
                {row.notice ?? "Notice"} {row.notice_due_on ?? ""}
                {row.option_year != null ? ` · option year ${row.option_year}` : ""}
                {row.escalation_index ? ` · index ${row.escalation_index}` : ""}
                {row.escalation_pct != null ? ` · ${row.escalation_pct}%` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Compliance readiness for rebid (advisory)</h2>
        <p className="text-sm" data-testid="rebid-readiness" data-level={readiness.level}>
          {readiness.headline}
        </p>
        <p className="text-xs text-muted-foreground">{readiness.note}</p>
        {data.compliance.length > 0 ? (
          <ul className="list-disc pl-5 text-sm">
            {data.compliance.map((row) => (
              <li key={row.id}>
                {row.kind}: {row.statement}
                {row.expires_on ? ` · expires ${row.expires_on}` : " · no expiry recorded"}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Rebid pursuit</h2>
        {data.rebids.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rebid pursuit linked from this contract.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {data.rebids.map((row) => (
              <li key={row.id}>
                <Link className="underline" href={`/procurement/opportunities/${row.id}`}>
                  {row.title}
                </Link>
                {` · ${row.stage}`}
                {row.response_due_on ? ` · due ${row.response_due_on}` : ""}
                <span className="text-muted-foreground"> · linked by rebid_from_contract_id</span>
              </li>
            ))}
          </ul>
        )}
        <div className="pt-1">
          <RebidButton contractId={contractId} />
        </div>
        <p className="text-xs text-muted-foreground">{REBID_CTA_NOTE}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{REBID_CTA_LABEL}</span> is the only write on this
          page. {NO_AUTO_ACTION_NOTE}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Internal review</h2>
        <p className="text-sm text-muted-foreground">No verified internal review record on file.</p>
      </section>

      <AutomationAuditStrip audit={automationAudit({ alertsComputedOn, refreshedOnLoad: false })} />
    </div>
  );
}
