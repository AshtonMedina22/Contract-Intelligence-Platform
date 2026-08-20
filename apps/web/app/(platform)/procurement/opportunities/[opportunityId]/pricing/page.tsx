import {
  loadPricingLines,
  loadCostModels,
  collectFactIdsFromPricingLines,
  loadFactDocumentMap,
} from "@/lib/opportunity/load-workspace";
import { PricingWorkbench } from "@/components/opportunity-workspace/pricing-workbench";

export default async function OpportunityPricingPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const [pricingLines, costModels] = await Promise.all([
    loadPricingLines(opportunityId),
    loadCostModels(opportunityId),
  ]);
  const factDocumentMap = await loadFactDocumentMap(collectFactIdsFromPricingLines(pricingLines));

  return (
    <PricingWorkbench
      opportunityId={opportunityId}
      pricingLines={pricingLines}
      costModels={costModels}
      factDocumentMap={factDocumentMap}
    />
  );
}
