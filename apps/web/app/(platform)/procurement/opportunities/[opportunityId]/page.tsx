import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
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

  const [{ data: lines }, { data: solicitations }, { data: awards }] = await Promise.all([
    supabase.from("pricing_lines").select("*").eq("opportunity_id", opportunityId),
    supabase.from("solicitations").select("id, title, solicitation_number").eq("opportunity_id", opportunityId),
    supabase.from("awards").select("id, notice, awarded_on").eq("opportunity_id", opportunityId),
  ]);

  const solicitationIds = (solicitations ?? []).map((row) => row.id);
  const { data: requirements } =
    solicitationIds.length > 0
      ? await supabase.from("requirements").select("id, statement, solicitation_id").in("solicitation_id", solicitationIds)
      : { data: [] as { id: string; statement: string; solicitation_id: string }[] };

  const client = Array.isArray(opportunity.clients) ? opportunity.clients[0] : opportunity.clients;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link className="underline" href="/procurement/opportunities">
            Opportunities
          </Link>
        </p>
        <h1 className="text-lg font-semibold tracking-tight">{opportunity.title}</h1>
        <p className="text-sm text-muted-foreground">{client?.name ?? "No client"}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Four commercial truths</h2>
        <p className="text-sm text-muted-foreground">
          Requested, proposed, awarded, and current stay in separate columns. Promotion never overwrites a filled
          truth with a different value.
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Labor category</th>
                <th className="p-2">Requested</th>
                <th className="p-2">Proposed</th>
                <th className="p-2">Awarded</th>
                <th className="p-2">Current</th>
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="p-2">{line.labor_category}</td>
                  <td className="p-2">{money(line.requested_rate)}</td>
                  <td className="p-2">{money(line.proposed_rate)}</td>
                  <td className="p-2">{money(line.awarded_rate)}</td>
                  <td className="p-2">{money(line.current_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(lines ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No promoted rates yet. Verify HUMAN_VERIFIED facts on source documents.</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Solicitation / requirements</h2>
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
                  <li key={req.id}>{req.statement}</li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Award</h2>
        {(awards ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">None promoted.</p>
        ) : (
          (awards ?? []).map((award) => (
            <p key={award.id} className="text-sm">
              {award.notice ?? "Award"} {award.awarded_on ? `on ${award.awarded_on}` : ""}
            </p>
          ))
        )}
      </section>
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
