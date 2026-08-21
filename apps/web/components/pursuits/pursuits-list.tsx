import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/shell";
import { OPPORTUNITY_STAGES, GO_NO_GO_OPTIONS } from "@/lib/opportunity/types";
import type { OpportunityStage, GoNoGo } from "@/lib/opportunity/types";

function stageLabel(stage: OpportunityStage) {
  return OPPORTUNITY_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

function goLabel(go: GoNoGo) {
  return GO_NO_GO_OPTIONS.find((g) => g.value === go)?.label ?? go;
}

function isDueSoon(due: string | null): boolean {
  if (!due) return false;
  const days = (new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 14;
}

export async function PursuitsList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view pursuits.</p>;

  const { data, error } = await supabase
    .from("opportunities")
    .select("id, title, stage, go_no_go, response_due_on, service_type, updated_at, clients(name)")
    .order("response_due_on", { ascending: true, nullsFirst: false })
    .limit(100);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const active = (data ?? []).filter((row) => row.stage !== "CLOSED" && row.stage !== "AWARDED");
  const closed = (data ?? []).filter((row) => row.stage === "CLOSED" || row.stage === "AWARDED");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pursuits"
        description="Pre-award workspaces. Open a row for Overview, Requirements, Pricing, Response, Submission, and Result."
        actions={
          <Button asChild size="sm">
            <Link href="/ingestion/intake">New solicitation</Link>
          </Button>
        }
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Active ({active.length})</h2>
        {active.length === 0 ? (
          <EmptyState
            title="No active pursuits"
            description="Upload a solicitation via Data Ops → Intake."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/ingestion/intake">Start intake</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-2 py-1.5">Pursuit</th>
                  <th className="px-2 py-1.5">Buyer</th>
                  <th className="px-2 py-1.5">Stage</th>
                  <th className="px-2 py-1.5">Due</th>
                  <th className="px-2 py-1.5">Go</th>
                </tr>
              </thead>
              <tbody>
                {active.map((row) => {
                  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
                  const stage = (row.stage ?? "INTAKE") as OpportunityStage;
                  const go = (row.go_no_go ?? "PENDING") as GoNoGo;
                  const dueSoon = isDueSoon(row.response_due_on);
                  return (
                    <tr key={row.id} className="border-b">
                      <td className="px-2 py-1.5">
                        <Link className="font-medium underline" href={`/procurement/opportunities/${row.id}`}>
                          {row.title}
                        </Link>
                        {row.service_type ? (
                          <p className="text-xs text-muted-foreground">{row.service_type}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{client?.name ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline">{stageLabel(stage)}</Badge>
                      </td>
                      <td className={`px-2 py-1.5 ${dueSoon ? "font-medium text-amber-700" : "text-muted-foreground"}`}>
                        {row.response_due_on ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={go === "NO_GO" ? "destructive" : "secondary"}>{goLabel(go)}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <section className="space-y-1.5">
          <h2 className="text-sm font-medium text-muted-foreground">Awarded / closed ({closed.length})</h2>
          <ul className="space-y-0.5 text-sm">
            {closed.map((row) => (
              <li key={row.id}>
                <Link className="underline" href={`/procurement/opportunities/${row.id}`}>
                  {row.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
