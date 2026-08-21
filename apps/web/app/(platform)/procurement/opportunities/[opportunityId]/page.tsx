import { Suspense } from "react";
import Link from "next/link";
import { OpportunityMetadataForm } from "@/components/opportunity-workspace/metadata-form";
import { FulfillmentEconomicsPanel } from "@/components/opportunity-workspace/fulfillment-economics";
import { OverviewSections } from "@/components/opportunity-workspace/overview-sections";
import { FourTruthsTable } from "@/components/opportunity-workspace/four-truths-table";
import { ChangeImpactStrip } from "@/components/opportunity-workspace/change-impact-strip";
import { loadOverviewBundle } from "@/lib/opportunity/load-overview-bundle";
import { loadChangeImpactBundle } from "@/lib/solicitation/load-change-impact";

export default function OpportunityOverviewPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OpportunityOverviewContent params={params} />
    </Suspense>
  );
}

async function OpportunityOverviewContent({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const [bundle, changeImpact] = await Promise.all([
    loadOverviewBundle(opportunityId),
    loadChangeImpactBundle(opportunityId),
  ]);
  if (!bundle) return null;

  const { opportunity, summary } = bundle;

  return (
    <div className="space-y-3">
      {changeImpact && changeImpact.summary.items > 0 ? (
        <ChangeImpactStrip
          opportunityId={opportunityId}
          summary={changeImpact.summary}
          items={changeImpact.items}
          canVerify={changeImpact.canVerify}
        />
      ) : null}

      <OverviewSections bundle={bundle} />

      <details className="rounded-md border" id="pricing-planning">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          Pricing and fulfillment (planning)
        </summary>
        <div className="space-y-3 border-t p-3">
          <FulfillmentEconomicsPanel economics={bundle.economics} />
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Verified pricing snapshot</h3>
            <FourTruthsTable lines={bundle.pricingLines} factDocumentMap={bundle.factDocumentMap} />
            <Link
              className="text-sm underline"
              href={`/procurement/opportunities/${opportunityId}/pricing`}
            >
              Open pricing workbench →
            </Link>
          </section>
        </div>
      </details>

      <details className="rounded-md border" id="operational-metadata">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          Edit operational metadata
        </summary>
        <div className="border-t p-3">
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
        </div>
      </details>

      {summary.documentCount === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
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
