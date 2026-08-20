import { Suspense } from "react";
import { StaffingRequirementsPanel, type StaffingRow } from "@/components/opportunity-workspace/staffing-panel";
import { loadStaffingRequirements } from "@/lib/opportunity/load-workspace";

export default function OpportunityStaffingPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OpportunityStaffingContent params={params} />
    </Suspense>
  );
}

async function OpportunityStaffingContent({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const data = await loadStaffingRequirements(opportunityId);

  const rows: StaffingRow[] = data.map((r) => ({
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

  const hoursRows = rows.filter((r) => r.weekly_hours != null);
  const totalWeekly = hoursRows.reduce((sum, r) => sum + Number(r.weekly_hours), 0);

  return (
    <div className="space-y-4">
      {hoursRows.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Total weekly hours (sum of entered values only):{" "}
          <span className="font-medium text-foreground">{totalWeekly}</span>
          {hoursRows.length !== rows.length ? ` · ${rows.length - hoursRows.length} posts have no hours` : ""}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No weekly hours entered yet — fulfillment margin cannot run.</p>
      )}
      <StaffingRequirementsPanel opportunityId={opportunityId} rows={rows} />
    </div>
  );
}
