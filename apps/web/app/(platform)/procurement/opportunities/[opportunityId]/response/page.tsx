import { Suspense } from "react";
import { ResponseWorkspace } from "@/components/opportunity-workspace/response-workspace";
import { ProposalPacketGaps } from "@/components/opportunity-workspace/proposal-packet-gaps";
import {
  loadOpportunityHeader,
  loadWorkspaceSummary,
  loadStaffingRequirements,
  loadFactDocumentMap,
} from "@/lib/opportunity/load-workspace";
import { listProposalPacketGaps } from "@/lib/opportunity/proposal-packet";
import {
  loadRequirementMatrix,
  loadRequirementResponses,
  loadApprovalLayers,
  loadResponseContext,
} from "@/lib/opportunity/load-response";
import { searchVerifiedKnowledge } from "@/lib/retrieval/search";

export default function OpportunityResponsePage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OpportunityResponseContent params={params} />
    </Suspense>
  );
}

async function OpportunityResponseContent({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const [opportunity, summary, staffing, requirements, responses, approvals, context] =
    await Promise.all([
      loadOpportunityHeader(opportunityId),
      loadWorkspaceSummary(opportunityId),
      loadStaffingRequirements(opportunityId),
      loadRequirementMatrix(opportunityId),
      loadRequirementResponses(opportunityId),
      loadApprovalLayers(opportunityId),
      loadResponseContext(opportunityId),
    ]);
  if (!opportunity) return null;

  const gaps = listProposalPacketGaps({
    clientName: opportunity.client_name,
    procurementRail: opportunity.procurement_rail,
    solicitationKind: opportunity.solicitation_kind,
    responseDueOn: opportunity.response_due_on,
    serviceType: opportunity.service_type,
    siteLocation: opportunity.site_location,
    submissionMethod: opportunity.submission_method,
    coverageStartOn: opportunity.coverage_start_on,
    vehicleRef: opportunity.vehicle_ref,
    goNoGo: opportunity.go_no_go,
    documentCount: summary.documentCount,
    requirementCount: summary.requirementCount,
    evaluationCount: summary.evaluationCount,
    staffingCount: summary.staffingCount,
    staffingHoursEntered: staffing.some((s) => s.weekly_hours != null && Number(s.weekly_hours) > 0),
    pricingLineCount: summary.pricingLineCount,
    costModelCount: summary.costModelCount,
    competitorBidCount: summary.competitorBidCount,
    hasWinLoss: summary.hasWinLoss,
  });

  const sampleQuery = requirements[0]?.statement ?? opportunity.title;
  const { hits } = await searchVerifiedKnowledge({
    query: sampleQuery,
    purpose: "PROPOSAL_DRAFTING",
    opportunityId,
    limit: 8,
  });

  const factIds = requirements.map((r) => r.source_fact_id).filter(Boolean) as string[];
  const factDocumentMap = await loadFactDocumentMap(factIds);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Pursuit → Response stays on this opportunity. Left: requirements · Center: Tiptap · Right: evidence
        context. DO_NOT_USE never enters drafting.
      </p>
      <ResponseWorkspace
        opportunityId={opportunityId}
        requirements={requirements}
        responses={responses}
        approvals={approvals}
        context={context}
        factDocumentMap={factDocumentMap}
        knowledgeHits={hits.map((h) => ({
          chunk_id: h.chunk_id,
          reuse_status: h.reuse_status,
          content: h.content,
          document_id: h.document_id,
          source_page: h.source_page,
        }))}
      />
      <ProposalPacketGaps opportunityId={opportunityId} gaps={gaps} />
    </div>
  );
}
