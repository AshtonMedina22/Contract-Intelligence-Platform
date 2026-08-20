import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RebidButton } from "@/components/opportunity-workspace/rebid-button";
import { loadContractRenewal } from "@/lib/contracts/load-workspace";

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
    .select("id, verified_end_on, opportunity_id")
    .eq("id", contractId)
    .maybeSingle();

  const data = await loadContractRenewal(contractId);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const expiredCompliance = data.compliance.filter((c) => {
    if (!c.expires_on) return false;
    return new Date(`${c.expires_on}T00:00:00Z`).getTime() < today.getTime();
  });
  const eligibility =
    data.compliance.length === 0
      ? "No compliance items on file — eligibility unknown"
      : expiredCompliance.length > 0
        ? `${expiredCompliance.length} expired item(s) — review before rebid`
        : "No expired compliance items on file";

  const openOptions = data.options.filter((o) => {
    if (!o.exercise_by) return true;
    return new Date(`${o.exercise_by}T00:00:00Z`).getTime() >= today.getTime();
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Expiration</h2>
        <p className="text-sm">Verified end: {dash(contract?.verified_end_on)}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Alert buckets (verified dates only)</h2>
        <p className="text-xs text-muted-foreground">180 / 120 / 90 / 60 / 30 / EXPIRED</p>
        {data.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None. Alerts require a verified_end_on and refresh_contract_alerts.
          </p>
        ) : (
          <ul className="text-sm">
            {data.alerts.map((alert) => (
              <li key={alert.id}>
                {alert.bucket} · {alert.days_until} days · end {alert.verified_end_on}
              </li>
            ))}
          </ul>
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
                  {row.exercise_by ? ` · exercise by ${row.exercise_by}` : ""}
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Internal review</h2>
        <p className="text-sm text-muted-foreground">No verified internal review record on file.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Rebid date / status</h2>
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
              </li>
            ))}
          </ul>
        )}
        <div className="pt-1">
          <RebidButton contractId={contractId} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Compliance eligibility (rebid)</h2>
        <p className="text-sm">{eligibility}</p>
        {data.compliance.length > 0 ? (
          <ul className="list-disc pl-5 text-sm">
            {data.compliance.map((row) => (
              <li key={row.id}>
                {row.kind}: {row.statement}
                {row.expires_on ? ` · expires ${row.expires_on}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="text-sm">
        <Link className="underline" href="/contracts/renewals">
          Portfolio renewal queue
        </Link>
      </p>
    </div>
  );
}
