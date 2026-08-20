import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROCUREMENT_TABS, SectionTabs } from "@/components/section-tabs";
import { DataRegistryCallout } from "@/components/data-registry-callout";
import { registryEntry } from "@/lib/data-model/registry";

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function FactRef({ factId, documentId }: { factId: string | null; documentId?: string | null }) {
  if (!factId) return <>—</>;
  if (documentId) {
    return (
      <Link className="font-mono text-xs underline" href={`/ingestion/verification/${documentId}`} title={factId}>
        {factId.slice(0, 8)}…
      </Link>
    );
  }
  return <span className="font-mono text-xs">{factId.slice(0, 8)}…</span>;
}

async function PackageContent({ opportunityId }: { opportunityId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view this package.</p>;

  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .select("id, title, clients(name)")
    .eq("id", opportunityId)
    .maybeSingle();
  if (error || !opportunity) {
    return <p className="text-sm text-red-600">{error?.message ?? "Opportunity not found."}</p>;
  }

  const [{ data: lines }, { data: solicitations }, { data: awards }, { data: relatedDocs }] = await Promise.all([
    supabase.from("pricing_lines").select("*").eq("opportunity_id", opportunityId),
    supabase.from("solicitations").select("id, title, solicitation_number").eq("opportunity_id", opportunityId),
    supabase.from("awards").select("id, notice, awarded_on, source_fact_id").eq("opportunity_id", opportunityId),
    supabase
      .from("documents")
      .select("id, original_filename, commercial_truth, processing_status")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false }),
  ]);

  const factIds = new Set<string>();
  for (const line of lines ?? []) {
    for (const key of [
      "requested_source_fact_id",
      "proposed_source_fact_id",
      "awarded_source_fact_id",
      "current_source_fact_id",
    ] as const) {
      const id = line[key];
      if (id) factIds.add(id);
    }
  }
  for (const award of awards ?? []) {
    if (award.source_fact_id) factIds.add(award.source_fact_id);
  }

  const { data: factDocs } =
    factIds.size > 0
      ? await supabase.from("extracted_facts").select("id, document_id").in("id", [...factIds])
      : { data: [] as { id: string; document_id: string }[] };

  const factDocumentMap = new Map((factDocs ?? []).map((f) => [f.id, f.document_id]));

  const solicitationIds = (solicitations ?? []).map((row) => row.id);
  const { data: requirements } =
    solicitationIds.length > 0
      ? await supabase.from("requirements").select("id, statement, solicitation_id, source_fact_id").in("solicitation_id", solicitationIds)
      : { data: [] as { id: string; statement: string; solicitation_id: string; source_fact_id: string | null }[] };

  const client = Array.isArray(opportunity.clients) ? opportunity.clients[0] : opportunity.clients;
  const pricingEntry = registryEntry("pricing_lines");

  return (
    <div className="space-y-6">
      <SectionTabs tabs={PROCUREMENT_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{opportunity.title}</h1>
        <p className="text-sm text-muted-foreground">
          Canonical package — tables <code className="text-xs">opportunities</code>,{" "}
          <code className="text-xs">pricing_lines</code>, <code className="text-xs">requirements</code>,{" "}
          <code className="text-xs">awards</code>. Fed only by HUMAN_VERIFIED promotion.
        </p>
        <p className="text-sm text-muted-foreground">{client?.name ?? "No client"}</p>
      </div>

      {pricingEntry ? <DataRegistryCallout entry={pricingEntry} /> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">pricing_lines — four commercial truths</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2 font-mono text-xs">labor_category</th>
                <th className="p-2 font-mono text-xs">requested_rate</th>
                <th className="p-2 font-mono text-xs">proposed_rate</th>
                <th className="p-2 font-mono text-xs">awarded_rate</th>
                <th className="p-2 font-mono text-xs">current_rate</th>
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="p-2">{line.labor_category}</td>
                  <td className="p-2">
                    {money(line.requested_rate)}
                    <div className="text-muted-foreground">
                      <FactRef
                        factId={line.requested_source_fact_id}
                        documentId={factDocumentMap.get(line.requested_source_fact_id ?? "")}
                      />
                    </div>
                  </td>
                  <td className="p-2">
                    {money(line.proposed_rate)}
                    <div className="text-muted-foreground">
                      <FactRef
                        factId={line.proposed_source_fact_id}
                        documentId={factDocumentMap.get(line.proposed_source_fact_id ?? "")}
                      />
                    </div>
                  </td>
                  <td className="p-2">
                    {money(line.awarded_rate)}
                    <div className="text-muted-foreground">
                      <FactRef
                        factId={line.awarded_source_fact_id}
                        documentId={factDocumentMap.get(line.awarded_source_fact_id ?? "")}
                      />
                    </div>
                  </td>
                  <td className="p-2">
                    {money(line.current_rate)}
                    <div className="text-muted-foreground">
                      <FactRef
                        factId={line.current_source_fact_id}
                        documentId={factDocumentMap.get(line.current_source_fact_id ?? "")}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(lines ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No promoted rates. Verify pricing facts on source documents in{" "}
            <Link className="underline" href="/ingestion/verification">
              Verification
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">requirements (from solicitations)</h2>
        {(solicitations ?? []).map((sol) => (
          <div key={sol.id}>
            <p className="text-sm">
              {sol.title}
              {sol.solicitation_number ? ` (${sol.solicitation_number})` : ""}
            </p>
            <ul className="list-disc pl-5 text-sm">
              {(requirements ?? [])
                .filter((req) => req.solicitation_id === sol.id)
                .map((req) => (
                  <li key={req.id}>
                    {req.statement}
                    {req.source_fact_id ? (
                      <>
                        {" "}
                        <FactRef
                          factId={req.source_fact_id}
                          documentId={factDocumentMap.get(req.source_fact_id)}
                        />
                      </>
                    ) : null}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">awards</h2>
        {(awards ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">None promoted.</p>
        ) : (
          (awards ?? []).map((award) => (
            <p key={award.id} className="text-sm">
              {award.notice ?? "Award"} {award.awarded_on ? `on ${award.awarded_on}` : ""}{" "}
              <FactRef factId={award.source_fact_id} documentId={factDocumentMap.get(award.source_fact_id ?? "")} />
            </p>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">documents linked to this opportunity</h2>
        {(relatedDocs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents linked yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(relatedDocs ?? []).map((doc) => (
              <li key={doc.id}>
                <Link className="underline" href={`/ingestion/verification/${doc.id}`}>
                  {doc.original_filename}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  · {doc.commercial_truth ?? "no truth tag"} · {doc.processing_status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Ask Intelligence searches <code className="text-xs">document_chunks</code> promoted from verified facts on
        these documents —{" "}
        <Link className="underline" href="/intelligence/ask">
          try a query
        </Link>
        .
      </p>
    </div>
  );
}

export default function OpportunityPackagePage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading package…</p>}>
      <PackageFromParams params={params} />
    </Suspense>
  );
}

async function PackageFromParams({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = await params;
  return <PackageContent opportunityId={opportunityId} />;
}
