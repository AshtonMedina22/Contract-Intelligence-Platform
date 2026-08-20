import { Suspense } from "react";
import {
  loadPricingLines,
  loadCostModels,
  loadStaffingRequirements,
  collectFactIdsFromPricingLines,
  loadFactDocumentMap,
} from "@/lib/opportunity/load-workspace";
import { loadPricingComparables, loadPricingDecisions } from "@/lib/opportunity/comparables";
import { computeFulfillmentEconomics } from "@/lib/opportunity/proposal-packet";
import { PricingWorkbench } from "@/components/opportunity-workspace/pricing-workbench";
import { PRICING_STRUCTURE_HINTS, type PricingDecisionRow } from "@/lib/opportunity/types";

export default function OpportunityPricingPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OpportunityPricingContent params={params} />
    </Suspense>
  );
}

async function OpportunityPricingContent({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const [pricingLines, costModels, comparables, staffing, decisionsRaw] = await Promise.all([
    loadPricingLines(opportunityId),
    loadCostModels(opportunityId),
    loadPricingComparables(opportunityId),
    loadStaffingRequirements(opportunityId),
    loadPricingDecisions(opportunityId),
  ]);

  const factIds = [
    ...collectFactIdsFromPricingLines(pricingLines),
    ...comparables.map((c) => c.proposed_source_fact_id).filter(Boolean),
  ] as string[];
  const factDocumentMap = await loadFactDocumentMap(factIds);
  const economics = computeFulfillmentEconomics(staffing, costModels);
  const decisions = decisionsRaw as PricingDecisionRow[];

  return (
    <PricingWorkbench
      opportunityId={opportunityId}
      pricingLines={pricingLines}
      costModels={costModels}
      comparables={comparables}
      decisions={decisions}
      factDocumentMap={factDocumentMap}
      economics={economics}
      structureHints={PRICING_STRUCTURE_HINTS}
    />
  );
}
