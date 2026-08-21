import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SubmissionWorkbench } from "@/components/opportunity-workspace/submission-workbench";
import {
  loadApprovalLayers,
  loadRequirementMatrix,
  loadRequirementResponses,
  loadSubmissionPacket,
} from "@/lib/opportunity/load-response";
import { computeResponseProgress } from "@/lib/opportunity/response";
import { resolveGoogleDocsAccessToken } from "@/lib/google/google-docs";

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

  const [
    { data: documents },
    submission,
    responses,
    requirements,
    approvals,
    { data: pricingDecision },
    { data: user },
    { data: latestArtifact },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id, original_filename, document_type, commercial_truth, processing_status, created_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false }),
    loadSubmissionPacket(opportunityId),
    loadRequirementResponses(opportunityId),
    loadRequirementMatrix(opportunityId),
    loadApprovalLayers(opportunityId),
    supabase
      .from("pricing_decisions")
      .select("status, final_bid_rate, final_bid_amount, decided_by, decided_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("submission_artifacts")
      .select("id, version, content_hash, approval_state, immutable, google_doc_url")
      .eq("opportunity_id", opportunityId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const exportHtml = responses
    .filter((r) => r.draft_html?.trim())
    .map((r) => r.draft_html)
    .join("\n<hr/>\n");

  const hasApprovedContent = responses.some(
    (r) => r.draft_status === "APPROVED" && r.draft_html?.trim(),
  );

  const packet = submission.packet as Parameters<typeof SubmissionWorkbench>[0]["packet"];
  const submittedBy = packet?.submitted_by ?? null;
  const submittedByLabel =
    submittedBy && user?.user?.id === submittedBy ? (user.user.email ?? submittedBy) : null;

  return (
    <SubmissionWorkbench
      opportunityId={opportunityId}
      packet={packet}
      checklist={submission.checklist}
      approvals={approvals.map((a) => ({
        layer_key: a.layer_key,
        enabled: a.enabled,
        status: a.status,
        decided_at: a.decided_at,
        notes: a.notes,
      }))}
      documents={(documents ?? []).map((d) => ({
        id: d.id,
        original_filename: d.original_filename,
        document_type: d.document_type,
        processing_status: d.processing_status,
      }))}
      exportHtml={exportHtml}
      responseProgress={computeResponseProgress(requirements, responses)}
      pricingDecision={pricingDecision ?? null}
      submittedByLabel={submittedByLabel}
      googleDocsConfigured={Boolean(resolveGoogleDocsAccessToken())}
      hasApprovedContent={hasApprovedContent}
      latestArtifact={latestArtifact ?? null}
    />
  );
}
