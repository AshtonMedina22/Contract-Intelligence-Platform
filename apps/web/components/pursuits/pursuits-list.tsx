import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/shell";
import { OPPORTUNITY_STAGES, GO_NO_GO_OPTIONS } from "@/lib/opportunity/types";
import type { OpportunityStage, GoNoGo } from "@/lib/opportunity/types";

export type PursuitView = "active" | "submitted" | "closed";

const VIEW_STAGES: Record<PursuitView, OpportunityStage[]> = {
  active: ["INTAKE", "ANALYSIS", "PRICING", "DRAFTING"],
  submitted: ["SUBMITTED"],
  closed: ["AWARDED", "CLOSED"],
};

const VIEW_COPY: Record<PursuitView, { title: string; description: string; empty: string }> = {
  active: {
    title: "Active pursuits",
    description:
      "Pre-award workspaces still in progress. Open a row for Overview, Requirements, Pricing, Response, Submission, and Result.",
    empty: "No active pursuits. Upload a solicitation via Data Ops → Intake, or start one from Discover.",
  },
  submitted: {
    title: "Submitted pursuits",
    description: "Responses that have been submitted and are awaiting an award decision.",
    empty: "No submitted pursuits. A pursuit lands here once its submission is recorded.",
  },
  closed: {
    title: "Closed pursuits",
    description: "Awarded, lost, cancelled, and no-bid pursuits. Outcome detail lives on each Result tab.",
    empty: "No closed pursuits. Record a result on a pursuit to close it out.",
  },
};

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

export async function PursuitsList({ view = "active" }: { view?: PursuitView } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view pursuits.</p>;

  const copy = VIEW_COPY[view];
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, title, stage, go_no_go, response_due_on, service_type, external_provider, source_url, updated_at, clients(name)",
    )
    .in("stage", VIEW_STAGES[view])
    .order("response_due_on", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/procurement/opportunities/discover">Discover opportunities</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/ingestion/intake">New solicitation</Link>
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={`No ${view} pursuits`}
          description={copy.empty}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={view === "active" ? "/procurement/opportunities/discover" : "/procurement/opportunities"}>
                {view === "active" ? "Find public opportunities" : "View active pursuits"}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-1.5">Pursuit ({rows.length})</th>
                <th className="px-2 py-1.5">Buyer</th>
                <th className="px-2 py-1.5">Stage</th>
                <th className="px-2 py-1.5">Due</th>
                <th className="px-2 py-1.5">Go</th>
                <th className="px-2 py-1.5">Origin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
                const stage = (row.stage ?? "INTAKE") as OpportunityStage;
                const go = (row.go_no_go ?? "PENDING") as GoNoGo;
                const dueSoon = view !== "closed" && isDueSoon(row.response_due_on);
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
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {row.external_provider ? (
                        row.source_url ? (
                          <a className="underline" href={row.source_url} target="_blank" rel="noreferrer">
                            {row.external_provider}
                          </a>
                        ) : (
                          row.external_provider
                        )
                      ) : (
                        "operator"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
