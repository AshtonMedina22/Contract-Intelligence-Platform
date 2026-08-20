import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FactRef } from "@/components/opportunity-workspace/shared";
import { loadFactDocumentMap } from "@/lib/opportunity/load-workspace";

export default async function OpportunityRequirementsPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();

  const { data: solicitations } = await supabase
    .from("solicitations")
    .select("id, title, solicitation_number")
    .eq("opportunity_id", opportunityId);

  const solicitationIds = (solicitations ?? []).map((s) => s.id);
  const { data: requirements } =
    solicitationIds.length > 0
      ? await supabase
          .from("requirements")
          .select("id, statement, solicitation_id, source_fact_id")
          .in("solicitation_id", solicitationIds)
          .order("created_at")
      : { data: [] };

  const factIds = (requirements ?? []).map((r) => r.source_fact_id).filter(Boolean) as string[];
  const factDocumentMap = await loadFactDocumentMap(factIds);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Verified requirements</h2>
        <p className="text-xs text-muted-foreground">
          Promoted from requested-source documents only. Addenda override original solicitation per source
          precedence — resolve conflicts in{" "}
          <Link className="underline" href="/ingestion/exceptions">
            Exceptions
          </Link>
          .
        </p>
      </div>

      {(solicitations ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No solicitation linked. Verify identity and requirement facts on uploaded RFP documents.
        </p>
      ) : (
        (solicitations ?? []).map((sol) => {
          const reqs = (requirements ?? []).filter((r) => r.solicitation_id === sol.id);
          return (
            <section key={sol.id} className="space-y-2 rounded-md border p-3">
              <h3 className="text-sm font-medium">
                {sol.title}
                {sol.solicitation_number ? ` (${sol.solicitation_number})` : ""}
              </h3>
              {reqs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No promoted requirements yet.</p>
              ) : (
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {reqs.map((req) => (
                    <li key={req.id}>
                      {req.statement}{" "}
                      <FactRef
                        factId={req.source_fact_id}
                        documentId={factDocumentMap.get(req.source_fact_id ?? "")}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
