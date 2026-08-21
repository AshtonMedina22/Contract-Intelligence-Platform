import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StaffingRequirementsPanel, type StaffingRow } from "@/components/opportunity-workspace/staffing-panel";
import { loadStaffingRequirements } from "@/lib/opportunity/load-workspace";
import { loadContractServicePlans } from "@/lib/contracts/load-workspace";

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default async function ContractServicePlanPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, opportunity_id")
    .eq("id", contractId)
    .maybeSingle();

  const plans = await loadContractServicePlans(contractId);

  let pursuitRows: StaffingRow[] = [];
  if (contract?.opportunity_id) {
    const data = await loadStaffingRequirements(contract.opportunity_id);
    pursuitRows = data.map((r) => ({
      id: r.id,
      post_label: r.post_label,
      armed: r.armed,
      shift_hours: r.shift_hours,
      posts_count: r.posts_count,
      weekly_hours: r.weekly_hours,
      clearance_note: r.clearance_note,
      notes: r.notes,
      labor_category: r.labor_category,
    }));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Contract service plan</h2>
          <p className="text-sm text-muted-foreground">
            Sites, posts, classifications, and hours from verified contract facts. Fields without evidence
            stay blank.
          </p>
        </div>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contract_service_plans rows on file.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Site</th>
                  <th className="py-2 pr-3 font-medium">Post</th>
                  <th className="py-2 pr-3 font-medium">Classification</th>
                  <th className="py-2 pr-3 font-medium">Hours/wk</th>
                  <th className="py-2 pr-3 font-medium">Schedule</th>
                  <th className="py-2 pr-3 font-medium">Notes</th>
                  <th className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{dash(row.site_name)}</td>
                    <td className="py-2 pr-3">{dash(row.post_label)}</td>
                    <td className="py-2 pr-3">{dash(row.guard_classification)}</td>
                    <td className="py-2 pr-3">{dash(row.hours_per_week)}</td>
                    <td className="py-2 pr-3">{dash(row.schedule_note)}</td>
                    <td className="py-2 pr-3">{dash(row.notes)}</td>
                    <td className="py-2">
                      {row.source_document_id ? (
                        <Link className="underline" href={`/ingestion/verification/${row.source_document_id}`}>
                          document {row.source_document_id.slice(0, 8)}
                        </Link>
                      ) : row.source_fact_id ? (
                        <span className="text-muted-foreground">fact {row.source_fact_id.slice(0, 8)}</span>
                      ) : (
                        <span className="text-muted-foreground" title="Not recorded: source_fact_id">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Supervisors, substitutes, additional staffing, training, equipment/vehicles, uniform/reporting,
          and other operational obligations: no verified columns on file beyond the fields above — not
          invented.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Pursuit staffing (reference)</h2>
          <p className="text-sm text-muted-foreground">
            Remounted from the linked pursuit when present — not a substitute for contract service-plan
            truth.
          </p>
        </div>
        {!contract?.opportunity_id ? (
          <p className="text-sm text-muted-foreground">No linked pursuit.</p>
        ) : (
          <>
            <StaffingRequirementsPanel opportunityId={contract.opportunity_id} rows={pursuitRows} />
            <Link
              className="text-sm underline"
              href={`/procurement/opportunities/${contract.opportunity_id}/requirements`}
            >
              Open on pursuit
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
