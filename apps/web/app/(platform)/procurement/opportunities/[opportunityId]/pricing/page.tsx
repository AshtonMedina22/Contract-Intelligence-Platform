import {
  loadPricingLines,
  loadCostModels,
  loadStaffingRequirements,
  collectFactIdsFromPricingLines,
  loadFactDocumentMap,
} from "@/lib/opportunity/load-workspace";
import { loadPricingComparables } from "@/lib/opportunity/comparables";
import { computeFulfillmentEconomics } from "@/lib/opportunity/proposal-packet";
import { PricingWorkbench } from "@/components/opportunity-workspace/pricing-workbench";

export default async function OpportunityPricingPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const [pricingLines, costModels, comparables, staffing] = await Promise.all([
    loadPricingLines(opportunityId),
    loadCostModels(opportunityId),
    loadPricingComparables(opportunityId),
    loadStaffingRequirements(opportunityId),
  ]);

  const factIds = [
    ...collectFactIdsFromPricingLines(pricingLines),
    ...comparables.map((c) => c.proposed_source_fact_id).filter(Boolean),
  ] as string[];
  const factDocumentMap = await loadFactDocumentMap(factIds);
  const economics = computeFulfillmentEconomics(staffing, costModels);

  return (
    <PricingWorkbench
      opportunityId={opportunityId}
      pricingLines={pricingLines}
      costModels={costModels}
      comparables={comparables}
      factDocumentMap={factDocumentMap}
      economics={economics}
    />
  );
}
