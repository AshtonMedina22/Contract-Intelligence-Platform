import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RebidButton } from "@/components/opportunity-workspace/rebid-button";
import { loadContractRenewal } from "@/lib/contracts/load-workspace";
import {
  ALERT_DEDUPE_NOTE,
  assessOptionsRemaining,
  assessRebidReadiness,
  automationAudit,
  isRenewalBucket,
  LP_PORTFOLIO_VS_MARKET_RADAR_NOTE,
  MARKET_RADAR_CONTRAST_LABEL,
  MARKET_RADAR_ROUTE,
  NO_AUTO_ACTION_NOTE,
  OPTION_NOT_ASSUMED_EXERCISED_NOTE,
  REBID_CTA_LABEL,
  REBID_CTA_NOTE,
  REBID_NO_PRICING_OR_REQUIREMENTS_COPY,
  RENEWAL_BUCKET_DEFINITION,
  RENEWAL_BUCKET_LABELS,
  RENEWAL_OWNER_STATUS_UNKNOWN_NOTE,
  RENEWALS_ROUTE,
  summarizeRenewalBuckets,
} from "@/lib/contracts/portfolio-model";
import {
  AutomationAuditStrip,
  RenewalBucketStrip,
} from "@/components/contract-workspace/portfolio-strips";
import { loadCurrentOrgCapabilities } from "@/lib/auth/load-capabilities";

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
  const caps = await loadCurrentOrgCapabilities();
  const canRebidClone = caps?.canRebidClone ?? false;
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, title, verified_end_on, opportunity_id, client_id, source_document_id, source_fact_id")
    .eq("id", contractId)
    .maybeSingle();

  const [data, buyer, priorOpportunity, winLoss] = await Promise.all([
    loadContractRenewal(contractId),
    contract?.client_id
      ? supabase.from("clients").select("id, name").eq("id", contract.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    contract?.opportunity_id
      ? supabase
          .from("opportunities")
          .select("id, title, stage")
          .eq("id", contract.opportunity_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    contract?.opportunity_id
      ? supabase
          .from("win_loss_reviews")
          .select("id, outcome, winner_name")
          .eq("opportunity_id", contract.opportunity_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const readiness = assessRebidReadiness({ compliance: data.compliance, today });
  const optionsRemaining = assessOptionsRemaining(data.options);
  const buckets = summarizeRenewalBuckets(
    data.alerts.map((a) => ({ bucket: isRenewalBucket(a.bucket) ? a.bucket : null })),
  );
  const alertsComputedOn = data.alerts.reduce<string | null>(
    (latest, alert) => (alert.computed_on && (!latest || alert.computed_on > latest) ? alert.computed_on : latest),
    null,
  );

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

      <section className="space-y-2" data-testid="renewal-owner-status">
        <h2 className="text-sm font-medium">Owner / status</h2>
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Renewal owner</dt>
            <dd>UNKNOWN</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Renewal status</dt>
            <dd>UNKNOWN</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">{RENEWAL_OWNER_STATUS_UNKNOWN_NOTE}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Alert buckets (verified dates only)</h2>
        <RenewalBucketStrip buckets={buckets} linkToQueue={false} />
        <p className="text-xs text-muted-foreground">{RENEWAL_BUCKET_DEFINITION}</p>
        <p className="text-xs text-muted-foreground" data-testid="alert-dedupe-note">
          {ALERT_DEDUPE_NOTE}
        </p>
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

      <section className="space-y-2" data-testid="options-remaining">
        <h2 className="text-sm font-medium">Options on file</h2>
        <p className="text-sm">
          Remaining options:{" "}
          <span className="font-medium" data-testid="options-remaining-value">
            {optionsRemaining.remaining === "UNKNOWN" ? "UNKNOWN" : optionsRemaining.remaining}
          </span>
          {" · "}
          {optionsRemaining.onFile} option row(s) on file
        </p>
        <p className="text-xs text-muted-foreground">{OPTION_NOT_ASSUMED_EXERCISED_NOTE}</p>
        {data.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file — remaining/exercised not assumed.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {data.options.map((row) => (
              <li key={row.id}>
                {row.label}
                {row.exercise_by ? ` · exercise by ${row.exercise_by}` : " · no exercise-by date recorded"}
                {" · not assumed exercised"}
              </li>
            ))}
          </ul>
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

      <section className="space-y-2" data-testid="rebid-historical-evidence">
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

        <div className="space-y-1 rounded-md border p-3">
          <p className="text-xs font-medium text-foreground">Historical evidence (links only — not copied)</p>
          <ul className="list-disc pl-5 text-sm">
            <li>
              Prior contract:{" "}
              <Link className="underline" href={`/contracts/${contractId}`}>
                {contract?.title ?? contractId}
              </Link>
            </li>
            <li>
              Buyer:{" "}
              {buyer.data?.id ? (
                <Link className="underline" href="/intelligence/clients">
                  {buyer.data.name}
                </Link>
              ) : (
                <span className="text-muted-foreground">not recorded</span>
              )}
            </li>
            <li>
              Prior pursuit:{" "}
              {priorOpportunity.data?.id ? (
                <Link className="underline" href={`/procurement/opportunities/${priorOpportunity.data.id}`}>
                  {priorOpportunity.data.title} ({priorOpportunity.data.stage})
                </Link>
              ) : (
                <span className="text-muted-foreground">none linked</span>
              )}
            </li>
            <li>
              Evaluation / outcome:{" "}
              {winLoss.data?.id ? (
                <Link className="underline" href="/intelligence/win-loss">
                  {winLoss.data.outcome}
                  {winLoss.data.winner_name ? ` · ${winLoss.data.winner_name}` : ""}
                </Link>
              ) : (
                <span className="text-muted-foreground">no win/loss review on file</span>
              )}
            </li>
            <li>
              Source document:{" "}
              {contract?.source_document_id ? (
                <Link className="underline" href={`/ingestion/verification/${contract.source_document_id}`}>
                  verification {contract.source_document_id.slice(0, 8)}
                </Link>
              ) : (
                <span className="text-muted-foreground">none on file</span>
              )}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground" data-testid="rebid-no-pricing-copy">
            {REBID_NO_PRICING_OR_REQUIREMENTS_COPY}
          </p>
        </div>

        <div className="pt-1">
          <RebidButton contractId={contractId} canRebidClone={canRebidClone} />
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
