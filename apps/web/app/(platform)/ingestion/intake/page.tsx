import { Suspense } from "react";
import Link from "next/link";
import { DataOpsNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { IntakeForm } from "./intake-form";
import { getIntakeContext } from "@/lib/org/intake-context";

async function IntakeContent({ defaultOpportunityId }: { defaultOpportunityId?: string }) {
  const { user, organizations, clients, opportunities } = await getIntakeContext();
  const driveConfigured = Boolean(process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim());

  return (
    <div className="space-y-4">
      <DataOpsNav />
      <PageHeader
        title="Intake"
        description={
          <>
            Upload a new RFP/RFQ/IFB or historical package. Continue to Processing → Verification before facts become searchable.
            {defaultOpportunityId ? (
              <>
                {" "}
                Linking to{" "}
                <Link className="underline" href={`/procurement/opportunities/${defaultOpportunityId}`}>
                  pursuit
                </Link>
                .
              </>
            ) : null}
          </>
        }
      />

      {!user ? (
        <p className="text-sm">
          Sign in at{" "}
          <Link className="underline" href="/auth/login">
            /auth/login
          </Link>{" "}
          first.
        </p>
      ) : organizations.length === 0 ? (
        <p className="text-sm">
          Create an organization in{" "}
          <Link className="underline" href="/system/settings">
            Settings
          </Link>{" "}
          before uploading.
        </p>
      ) : (
        <IntakeForm
          organizations={organizations}
          clients={clients}
          opportunities={opportunities}
          driveConfigured={driveConfigured}
          defaultOpportunityId={defaultOpportunityId}
        />
      )}
    </div>
  );
}

export default function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ opportunity?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <IntakeFromParams searchParams={searchParams} />
    </Suspense>
  );
}

async function IntakeFromParams({
  searchParams,
}: {
  searchParams: Promise<{ opportunity?: string }>;
}) {
  const params = await searchParams;
  return <IntakeContent defaultOpportunityId={params.opportunity?.trim()} />;
}
