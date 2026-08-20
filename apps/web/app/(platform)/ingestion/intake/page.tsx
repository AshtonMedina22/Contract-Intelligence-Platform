import { Suspense } from "react";
import Link from "next/link";
import { INGESTION_TABS, SectionTabs } from "@/components/section-tabs";
import { IntakeForm } from "./intake-form";
import { getIntakeContext } from "@/lib/org/intake-context";

async function IntakeContent() {
  const { user, organizations, clients, opportunities } = await getIntakeContext();
  const driveConfigured = Boolean(process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim());

  return (
    <div className="space-y-6">
      <SectionTabs tabs={INGESTION_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Intake — step 1</h1>
        <p className="text-sm text-muted-foreground">
          Upload a new RFP/RFQ/IFB or historical package. After upload, continue to Processing → Verification
          before facts become searchable intelligence.
        </p>
      </div>

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
        />
      )}
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <IntakeContent />
    </Suspense>
  );
}
