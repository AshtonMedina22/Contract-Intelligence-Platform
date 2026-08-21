import type { IntelligenceReport } from "@/lib/reports/generate";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function actorContext(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to persist a report run.");
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error || !membership?.organization_id) throw new Error("No organization for report run.");
  return { userId: user.id, organizationId: membership.organization_id };
}

/** INSERT-only immutable report snapshot. */
export async function persistReportRun(
  report: IntelligenceReport,
  opts?: {
    supabase?: Supabase;
    query?: string | null;
    opportunityId?: string | null;
    parentReportRunId?: string | null;
    dataCutoff?: string;
  },
): Promise<string> {
  const supabase = opts?.supabase ?? (await createClient());
  const actor = await actorContext(supabase);
  const dataCutoff = opts?.dataCutoff ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("report_runs")
    .insert({
      organization_id: actor.organizationId,
      created_by: actor.userId,
      parent_report_run_id: opts?.parentReportRunId ?? null,
      report_kind: report.kind,
      purpose: report.purpose,
      title: report.title,
      query: opts?.query ?? null,
      opportunity_id: opts?.opportunityId ?? null,
      body: {
        answer: report.answer,
        sections: report.sections,
        sources: report.sources,
        dataScope: report.dataScope,
        limitations: report.limitations,
        insufficient: report.insufficient,
        evidenceHits: report.evidenceHits,
      },
      data_cutoff: dataCutoff,
      status: report.insufficient ? "INSUFFICIENT" : "SUCCEEDED",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Unable to persist report run: ${error?.message}`);
  return data.id;
}

/**
 * Record a report rerun as a new immutable row. The prior body is never updated.
 * The caller supplies the freshly generated report and its parent lineage.
 */
export async function persistReportRerun(
  parentReportRunId: string,
  freshReport: IntelligenceReport,
  opts?: {
    supabase?: Supabase;
    query?: string | null;
    opportunityId?: string | null;
    dataCutoff?: string;
  },
): Promise<string> {
  return persistReportRun(freshReport, {
    ...opts,
    parentReportRunId,
  });
}
