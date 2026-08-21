import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContractsNav } from "@/components/section-tabs";
import { ContractHonestyStrip } from "@/components/contract-workspace/portfolio-strips";
import { PORTFOLIO_ROUTE, RENEWALS_ROUTE } from "@/lib/contracts/portfolio-model";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  loadComplianceInventory,
  loadLatestOrganizationRegistration,
  loadOrganizationRegistrationHistory,
} from "@/lib/compliance/load-inventory";
import { ELIGIBILITY_HARD_CAVEAT, hasComplianceSource } from "@/lib/compliance/types";
import { memberHasPermission } from "@/lib/auth/permissions";
import { MarkCredentialVerifiedButton } from "./mark-verified-button";

function sourceHref(row: {
  source_document_id?: string | null;
  source_url?: string | null;
}): string | null {
  if (row.source_document_id) return `/ingestion/verification/${row.source_document_id}`;
  if (row.source_url) return row.source_url;
  return null;
}

async function ComplianceContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view compliance.</p>;

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return <p className="text-sm text-muted-foreground">No organization membership.</p>;
  }

  const orgId = membership.organization_id;
  const canVerify = memberHasPermission(membership.role, "verify.promote");

  const [registration, regHistory, inventory] = await Promise.all([
    loadLatestOrganizationRegistration(supabase, orgId),
    loadOrganizationRegistrationHistory(supabase, orgId, 8),
    loadComplianceInventory(supabase, orgId, { limit: 200 }),
  ]);

  const supersededIds = new Set(
    inventory.map((i) => i.supersedes_id).filter(Boolean) as string[],
  );
  const activeInventory = inventory.filter((i) => !supersededIds.has(i.id));
  const historyInventory = inventory.filter((i) => supersededIds.has(i.id));

  return (
    <div className="space-y-4">
      <ContractsNav />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={PORTFOLIO_ROUTE} className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Portfolio
        </Link>
        <span>/</span>
        <span>Compliance</span>
      </div>
      <PageHeader
        title="Company compliance"
        description="Licenses, COIs/insurance, SAM/GSA/TXMAS, certifications, and personnel qualification evidence — never invented."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={PORTFOLIO_ROUTE}>Portfolio</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={RENEWALS_ROUTE}>Renewal & rebid center</Link>
            </Button>
          </>
        }
      />
      <ContractHonestyStrip
        extra={`${ELIGIBILITY_HARD_CAVEAT} Match statuses are advisory. F9 compliance_expiration reuses mirrored registration rows — no second scheduler.`}
      />

      {/* Org profile strip */}
      <section className="space-y-2 border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Organization registration profile</h2>
          {registration && canVerify && registration.verification_status !== "HUMAN_VERIFIED" ? (
            <MarkCredentialVerifiedButton
              kind="registration"
              id={registration.id}
              disabled={!hasComplianceSource(registration)}
            />
          ) : null}
        </div>
        {registration ? (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">UEI</dt>
              <dd>{registration.uei ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">CAGE</dt>
              <dd>{registration.cage ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">SAM status</dt>
              <dd>
                {registration.sam_status ?? "—"}
                {registration.sam_expiration_on
                  ? ` · exp ${registration.sam_expiration_on}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">NAICS</dt>
              <dd>{registration.naics.length ? registration.naics.join(", ") : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">PSC</dt>
              <dd>{registration.psc.length ? registration.psc.join(", ") : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Verification</dt>
              <dd>
                <Badge variant="outline">{registration.verification_status}</Badge>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Vehicles / notes</dt>
              <dd className="text-muted-foreground">{registration.vehicles_notes ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Source</dt>
              <dd>
                {sourceHref(registration) ? (
                  <Link className="underline" href={sourceHref(registration)!}>
                    View Source
                  </Link>
                ) : (
                  <span className="text-muted-foreground">No source on file</span>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No organization registration recorded. UEI/CAGE/SAM/NAICS are unknown — not eligible by silence.
          </p>
        )}
        {regHistory.length > 1 ? (
          <div className="pt-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Registration history (superseded)
            </h3>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {regHistory.slice(1).map((r) => (
                <li key={r.id}>
                  {r.as_of ?? r.created_at?.slice(0, 10) ?? "—"} · {r.verification_status}
                  {r.uei ? ` · UEI ${r.uei}` : ""}
                  {r.supersedes_id ? " · supersedes prior" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Inventory */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Compliance inventory</h2>
        {activeInventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Kind</th>
                  <th className="py-1.5 pr-2 font-medium">Statement</th>
                  <th className="py-1.5 pr-2 font-medium">Expires</th>
                  <th className="py-1.5 pr-2 font-medium">Status</th>
                  <th className="py-1.5 pr-2 font-medium">Holder</th>
                  <th className="py-1.5 pr-2 font-medium">Source</th>
                  <th className="py-1.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeInventory.map((row) => {
                  const href = sourceHref(row);
                  return (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="py-1.5 pr-2">
                        <span className="text-xs uppercase text-muted-foreground">{row.kind}</span>
                      </td>
                      <td className="py-1.5 pr-2">
                        {row.statement}
                        {row.issuer ? (
                          <div className="text-xs text-muted-foreground">Issuer: {row.issuer}</div>
                        ) : null}
                        {row.credential_number ? (
                          <div className="text-xs text-muted-foreground">#{row.credential_number}</div>
                        ) : null}
                        {row.coverage_json ? (
                          <div className="text-xs text-muted-foreground">
                            Coverage recorded (opaque) — limits not invented
                          </div>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{row.expires_on ?? "—"}</td>
                      <td className="py-1.5 pr-2">
                        <Badge variant="outline">{row.verification_status}</Badge>
                      </td>
                      <td className="py-1.5 pr-2">{row.holder_name ?? "—"}</td>
                      <td className="py-1.5 pr-2">
                        {href ? (
                          <Link className="underline" href={href}>
                            View Source
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">No source</span>
                        )}
                      </td>
                      <td className="py-1.5">
                        {canVerify && row.verification_status !== "HUMAN_VERIFIED" ? (
                          <MarkCredentialVerifiedButton
                            kind="item"
                            id={row.id}
                            disabled={!hasComplianceSource(row)}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No compliance items"
            description="Compliance items appear here after human verification from contract documents or registration entry. Empty means unknown — not clear."
          />
        )}
        {historyInventory.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Superseded inventory
            </h3>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {historyInventory.map((row) => (
                <li key={row.id}>
                  <span className="uppercase">{row.kind}</span> — {row.statement}
                  {row.expires_on ? ` · expired/ends ${row.expires_on}` : ""} · {row.verification_status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function CompliancePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ComplianceContent />
    </Suspense>
  );
}
