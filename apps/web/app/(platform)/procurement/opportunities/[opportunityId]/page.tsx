import Link from "next/link";
import { OpportunityMetadataForm } from "@/components/opportunity-workspace/metadata-form";
import { ProposalPacketGaps } from "@/components/opportunity-workspace/proposal-packet-gaps";
import { FulfillmentEconomicsPanel } from "@/components/opportunity-workspace/fulfillment-economics";
import {
  loadOpportunityHeader,
  loadWorkspaceSummary,
  loadPricingLines,
  loadCostModels,
  loadStaffingRequirements,
  collectFactIdsFromPricingLines,
  loadFactDocumentMap,
} from "@/lib/opportunity/load-workspace";
import { listProposalPacketGaps, computeFulfillmentEconomics } from "@/lib/opportunity/proposal-packet";
import { FourTruthsTable } from "@/components/opportunity-workspace/four-truths-table";

export default async function OpportunityOverviewPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const [opportunity, summary, pricingLines, costModels, staffing] = await Promise.all([
    loadOpportunityHeader(opportunityId),
    loadWorkspaceSummary(opportunityId),
    loadPricingLines(opportunityId),
    loadCostModels(opportunityId),
    loadStaffingRequirements(opportunityId),
  ]);
  if (!opportunity) return null;

  const factDocumentMap = await loadFactDocumentMap(collectFactIdsFromPricingLines(pricingLines));
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
  const economics = computeFulfillmentEconomics(staffing, costModels);

  return (
    <div className="space-y-6">
      <OpportunityMetadataForm
        opportunityId={opportunityId}
        stage={opportunity.stage}
        goNoGo={opportunity.go_no_go}
        responseDueOn={opportunity.response_due_on}
        serviceType={opportunity.service_type}
        notes={opportunity.notes}
        procurementRail={opportunity.procurement_rail}
        solicitationKind={opportunity.solicitation_kind}
        siteLocation={opportunity.site_location}
        submissionMethod={opportunity.submission_method}
        coverageStartOn={opportunity.coverage_start_on}
        vehicleRef={opportunity.vehicle_ref}
      />

      <ProposalPacketGaps opportunityId={opportunityId} gaps={gaps} />
      <FulfillmentEconomicsPanel economics={economics} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Verified pricing snapshot</h2>
        <FourTruthsTable lines={pricingLines} factDocumentMap={factDocumentMap} />
        <Link className="text-sm underline" href={`/procurement/opportunities/${opportunityId}/pricing`}>
          Open pricing workbench →
        </Link>
      </section>

      {summary.documentCount === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Upload the buyer packet (quote request, RFP/RFQ, pricing schedule, addenda) via{" "}
          <Link className="underline" href={`/ingestion/intake?opportunity=${opportunityId}`}>
            Intake
          </Link>
          . Extraction stays staged until you verify. Ask Intelligence will not invent answers from an empty
          corpus.
        </p>
      ) : null}
    </div>
  );
}
