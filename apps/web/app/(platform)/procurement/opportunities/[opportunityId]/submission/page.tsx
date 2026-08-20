import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SubmissionWorkbench } from "@/components/opportunity-workspace/submission-workbench";
import { loadSubmissionPacket, loadRequirementResponses } from "@/lib/opportunity/load-response";

export default function OpportunitySubmissionPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OpportunitySubmissionContent params={params} />
    </Suspense>
  );
}

async function OpportunitySubmissionContent({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();

  const [{ data: documents }, submission, responses] = await Promise.all([
    supabase
      .from("documents")
      .select("id, original_filename, document_type, commercial_truth, processing_status, created_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false }),
    loadSubmissionPacket(opportunityId),
    loadRequirementResponses(opportunityId),
  ]);

  const exportHtml = responses
    .filter((r) => r.draft_html?.trim())
    .map((r) => r.draft_html)
    .join("\n<hr/>\n");

  return (
    <SubmissionWorkbench
      opportunityId={opportunityId}
      packet={submission.packet as Parameters<typeof SubmissionWorkbench>[0]["packet"]}
      checklist={submission.checklist}
      documents={(documents ?? []).map((d) => ({
        id: d.id,
        original_filename: d.original_filename,
        document_type: d.document_type,
        processing_status: d.processing_status,
      }))}
      exportHtml={exportHtml}
    />
  );
}
