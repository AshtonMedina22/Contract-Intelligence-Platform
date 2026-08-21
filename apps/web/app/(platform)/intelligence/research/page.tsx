import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  IntelligenceHonestyStrip,
  ObservationTiles,
} from "@/components/intelligence/honesty-strip";
import { observationTile } from "@/lib/intelligence/observations";
import { startResearchRun } from "./actions";

const RESEARCH_TYPES = [
  "BUYER",
  "COMPETITOR",
  "MARKET",
  "PURSUIT",
  "RECOMPETE",
  "PRICING_CONTEXT",
] as const;

const HONESTY =
  "Public research is cite-only until a human verifies each fact. Live Ask search is a separate rail; AI_EXTRACTED research_facts are never auto HUMAN_VERIFIED and are not L&P truth.";

async function ResearchList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to run public research.</p>;

  const { data: runs, error } = await supabase
    .from("research_runs")
    .select("id, research_type, status, query, created_at, completed_at, last_error")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  const rows = runs ?? [];
  const reviewReady = rows.filter((r) => r.status === "REVIEW_READY").length;
  const verified = rows.filter((r) => r.status === "VERIFIED").length;

  const tiles = [
    observationTile({ label: "Research runs", value: rows.length, source: "research_runs", unit: "runs" }),
    observationTile({
      label: "Review ready",
      value: reviewReady,
      source: "research_runs.status",
      unit: "runs",
    }),
    observationTile({
      label: "Verified runs",
      value: verified,
      source: "research_runs.status",
      unit: "runs",
    }),
  ];

  return (
    <div className="space-y-6">
      <IntelligenceHonestyStrip extra={HONESTY} />
      <ObservationTiles tiles={tiles} />

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-medium">New research run</h2>
        <p className="text-xs text-muted-foreground">
          Creates a bounded plan, searches public providers, and stores AI_EXTRACTED facts for human review.
          Does not invent buyers or promote to HUMAN_VERIFIED.
        </p>
        <form action={startResearchRun} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="research_type">Type</Label>
            <select
              id="research_type"
              name="research_type"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              defaultValue="BUYER"
            >
              {RESEARCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="entity_name">Entity name (optional)</Label>
            <Input id="entity_name" name="entity_name" placeholder="Exact buyer/competitor name if known" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="query">Query / purpose seed</Label>
            <Input id="query" name="query" required placeholder="e.g. Allen ISD guard services recompete" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="purpose">Purpose note (optional)</Label>
            <Input id="purpose" name="purpose" placeholder="Why this run exists" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Start research</Button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Runs</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No research runs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Type</th>
                  <th className="p-2">Query</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Created</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((run) => (
                  <tr key={run.id} className="border-b last:border-0">
                    <td className="p-2 font-mono text-xs">{run.research_type}</td>
                    <td className="p-2 max-w-md truncate">{run.query}</td>
                    <td className="p-2">
                      <Badge variant="outline">{run.status}</Badge>
                      {run.last_error ? (
                        <span className="ml-2 text-xs text-red-600">{run.last_error}</span>
                      ) : null}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="p-2">
                      <Link className="underline" href={`/intelligence/research/${run.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ResearchPage() {
  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <PageHeader
        title="Research"
        description="Public research acquisition → AI_EXTRACTED facts → human verify. Public ≠ L&P truth until verified."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ResearchList />
      </Suspense>
    </div>
  );
}
