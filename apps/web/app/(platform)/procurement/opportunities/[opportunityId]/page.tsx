import Link from "next/link";
import { OpportunityMetadataForm } from "@/components/opportunity-workspace/metadata-form";
import {
  loadOpportunityHeader,
  loadWorkspaceSummary,
  loadPricingLines,
  collectFactIdsFromPricingLines,
  loadFactDocumentMap,
} from "@/lib/opportunity/load-workspace";
import { FourTruthsTable } from "@/components/opportunity-workspace/four-truths-table";

export default async function OpportunityOverviewPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const [opportunity, summary, pricingLines] = await Promise.all([
    loadOpportunityHeader(opportunityId),
    loadWorkspaceSummary(opportunityId),
    loadPricingLines(opportunityId),
  ]);
  if (!opportunity) return null;

  const factDocumentMap = await loadFactDocumentMap(collectFactIdsFromPricingLines(pricingLines));

  const steps = [
    {
      label: "Documents ingested",
      done: summary.documentCount > 0,
      href: `/procurement/opportunities/${opportunityId}/documents`,
    },
    {
      label: "Requirements verified",
      done: summary.requirementCount > 0,
      href: `/procurement/opportunities/${opportunityId}/requirements`,
    },
    {
      label: "Pricing modeled",
      done: summary.pricingLineCount > 0,
      href: `/procurement/opportunities/${opportunityId}/pricing`,
    },
    {
      label: "Outcome captured",
      done: summary.hasWinLoss,
      href: `/procurement/opportunities/${opportunityId}/intelligence`,
    },
    {
      label: "Contract on file",
      done: summary.hasContract,
      href: `/procurement/opportunities/${opportunityId}/contract`,
    },
  ];

  return (
    <div className="space-y-6">
      <OpportunityMetadataForm
        opportunityId={opportunityId}
        stage={opportunity.stage}
        goNoGo={opportunity.go_no_go}
        responseDueOn={opportunity.response_due_on}
        serviceType={opportunity.service_type}
        notes={opportunity.notes}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Proposal readiness</h2>
        <ol className="space-y-1 text-sm">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center gap-2">
              <span className={step.done ? "text-green-600" : "text-muted-foreground"}>
                {step.done ? "✓" : "○"}
              </span>
              <Link className="underline" href={step.href}>
                {step.label}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Pricing snapshot</h2>
        <FourTruthsTable lines={pricingLines} factDocumentMap={factDocumentMap} />
        <Link className="text-sm underline" href={`/procurement/opportunities/${opportunityId}/pricing`}>
          Open pricing workbench →
        </Link>
      </section>

      {summary.documentCount === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Start by uploading the solicitation and historical comparables via{" "}
          <Link className="underline" href={`/ingestion/intake?opportunity=${opportunityId}`}>
            Intake
          </Link>
          . AI extraction stays in staging until you verify in the workbench.
        </p>
      ) : null}
    </div>
  );
}
