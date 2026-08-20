import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SettingsNav } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { registryEntry } from "@/lib/data-model/registry";

async function DataQualityContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view data quality.</p>;

  const [openFacts, openExceptions, rejectedFacts] = await Promise.all([
    supabase
      .from("extracted_facts")
      .select("*", { count: "exact", head: true })
      .in("verification_status", ["AI_EXTRACTED", "NEEDS_REVIEW"]),
    supabase.from("validation_exceptions").select("*", { count: "exact", head: true }).eq("resolved", false),
    supabase.from("extracted_facts").select("*", { count: "exact", head: true }).eq("verification_status", "REJECTED"),
  ]);

  const exceptionEntry = registryEntry("validation_exceptions");

  return (
    <div className="max-w-3xl space-y-6">
      <SettingsNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Data quality</h1>
        <p className="text-sm text-muted-foreground">
          Staging vs canonical health — what still blocks trustworthy RFQ outputs.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-px border text-sm sm:grid-cols-3">
        <div className="bg-background p-3">
          <dt className="text-muted-foreground">extracted_facts (open)</dt>
          <dd className="text-lg font-semibold tabular-nums">{openFacts.count ?? 0}</dd>
          <Link className="text-xs underline" href="/ingestion/verification">
            Verification queue
          </Link>
        </div>
        <div className="bg-background p-3">
          <dt className="text-muted-foreground">validation_exceptions (open)</dt>
          <dd className="text-lg font-semibold tabular-nums">{openExceptions.count ?? 0}</dd>
          <Link className="text-xs underline" href="/ingestion/exceptions">
            Exceptions
          </Link>
        </div>
        <div className="bg-background p-3">
          <dt className="text-muted-foreground">extracted_facts (REJECTED)</dt>
          <dd className="text-lg font-semibold tabular-nums">{rejectedFacts.count ?? 0}</dd>
        </div>
      </dl>

      {exceptionEntry ? <DataRegistryCallout entry={exceptionEntry} /> : null}

      <p className="text-sm text-muted-foreground">
        Full table map and RFQ data flow:{" "}
        <Link className="underline" href="/system/data-model">
          Data model
        </Link>
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <DataQualityContent />
    </Suspense>
  );
}
