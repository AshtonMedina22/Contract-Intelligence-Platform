import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EvaluationCriteriaPanel, type EvaluationCriterionRow } from "@/components/opportunity-workspace/evaluation-panel";
import { StaffingRequirementsPanel, type StaffingRow } from "@/components/opportunity-workspace/staffing-panel";
import { RequirementsMatrix } from "@/components/opportunity-workspace/requirements-matrix";
import { ChangeImpactStrip } from "@/components/opportunity-workspace/change-impact-strip";
import { loadFactDocumentMap, loadStaffingRequirements } from "@/lib/opportunity/load-workspace";
import { loadRequirementMatrix } from "@/lib/opportunity/load-response";
import { loadChangeImpactBundle } from "@/lib/solicitation/load-change-impact";

export default function OpportunityRequirementsPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OpportunityRequirementsContent params={params} />
    </Suspense>
  );
}

async function OpportunityRequirementsContent({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();

  const [{ data: solicitations }, { data: evalRows }, staffing, matrix, changeImpact] =
    await Promise.all([
      supabase
        .from("solicitations")
        .select("id, title, solicitation_number")
        .eq("opportunity_id", opportunityId),
      supabase
        .from("evaluation_criteria")
        .select("id, criterion, weight_pct, notes")
        .eq("opportunity_id", opportunityId)
        .order("created_at"),
      loadStaffingRequirements(opportunityId),
      loadRequirementMatrix(opportunityId),
      loadChangeImpactBundle(opportunityId),
    ]);

  const factIds = matrix.map((r) => r.source_fact_id).filter(Boolean) as string[];
  const factDocumentMap = await loadFactDocumentMap(factIds);

  const criteria: EvaluationCriterionRow[] = (evalRows ?? []).map((r) => ({
    id: r.id,
    criterion: r.criterion,
    weight_pct: r.weight_pct,
    notes: r.notes,
  }));

  return (
    <div className="space-y-8">
      {changeImpact && changeImpact.summary.items > 0 ? (
        <ChangeImpactStrip
          opportunityId={opportunityId}
          summary={changeImpact.summary}
          items={changeImpact.items}
          canVerify={changeImpact.canVerify}
        />
      ) : null}

      <EvaluationCriteriaPanel opportunityId={opportunityId} rows={criteria} />

      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Verified requirement matrix</h2>
          <p className="text-xs text-muted-foreground">
            Promoted from requested-source documents. Conflicts →{" "}
            <Link className="underline" href="/ingestion/exceptions">
              Exceptions
            </Link>
            . Draft answers on{" "}
            <Link className="underline" href={`/procurement/opportunities/${opportunityId}/response`}>
              Response
            </Link>
            .
          </p>
        </div>
        {(solicitations ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No solicitation linked. Verify identity and requirement facts on uploaded RFP documents.
          </p>
        ) : (
          (solicitations ?? []).map((sol) => (
            <p key={sol.id} className="text-xs text-muted-foreground">
              Solicitation: {sol.title}
              {sol.solicitation_number ? ` (${sol.solicitation_number})` : ""}
            </p>
          ))
        )}
        <RequirementsMatrix
          opportunityId={opportunityId}
          rows={matrix}
          factDocumentMap={factDocumentMap}
        />
      </div>

      <StaffingOnRequirements opportunityId={opportunityId} rows={staffing} />
    </div>
  );
}

function StaffingOnRequirements({
  opportunityId,
  rows,
}: {
  opportunityId: string;
  rows: Awaited<ReturnType<typeof loadStaffingRequirements>>;
}) {
  const mapped: StaffingRow[] = rows.map((r) => ({
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
  const hoursRows = mapped.filter((r) => r.weekly_hours != null);
  const totalWeekly = hoursRows.reduce((sum, r) => sum + Number(r.weekly_hours), 0);

  return (
    <section id="staffing" className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Staffing posts</h2>
        <p className="text-xs text-muted-foreground">
          Post orders for this pursuit. Hours stay on the pursuit, not as a global app.
        </p>
      </div>
      {hoursRows.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Total weekly hours (sum of entered values only):{" "}
          <span className="font-medium text-foreground">{totalWeekly}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No weekly hours entered yet.</p>
      )}
      <StaffingRequirementsPanel opportunityId={opportunityId} rows={mapped} />
    </section>
  );
}
