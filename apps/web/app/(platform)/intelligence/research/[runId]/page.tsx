import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IntelligenceHonestyStrip } from "@/components/intelligence/honesty-strip";
import { generateResearchBrief } from "@/lib/ask/research/synthesize-brief";
import { refreshResearchRun } from "../actions";
import { ResearchFactReviewActions } from "../fact-review-actions";

const HONESTY =
  "Sources and facts below are public observations. Verify each fact before treating it as durable intelligence. Ask live public search remains cite-only.";

async function RunDetail({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in required.</p>;

  const { data: run, error } = await supabase
    .from("research_runs")
    .select(
      "id, research_type, status, query, purpose, plan, created_at, completed_at, last_error",
    )
    .eq("id", runId)
    .maybeSingle();

  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  if (!run) notFound();

  const [{ data: sources }, { data: facts }] = await Promise.all([
    supabase
      .from("research_sources")
      .select("id, url, title, domain, provider, retrieved_at, excerpt")
      .eq("research_run_id", runId)
      .order("retrieved_at", { ascending: false }),
    supabase
      .from("research_facts")
      .select(
        "id, title, claim, excerpt, source_url, verification_status, provider, published_on, confidence",
      )
      .eq("research_run_id", runId)
      .order("retrieved_at", { ascending: false }),
  ]);

  const brief = generateResearchBrief(runId, facts ?? []);
  const plan = run.plan as { subquestions?: { id: string; text: string; provider_hint: string }[] };

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <PageHeader
        title="Research run"
        description="Review sources and facts. Public ≠ L&P truth until verified."
      />
      <div className="space-y-6">
      <IntelligenceHonestyStrip extra={HONESTY} />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">{run.research_type}</Badge>
        <Badge variant="outline">{run.status}</Badge>
        <span className="text-xs text-muted-foreground">
          Created {new Date(run.created_at).toLocaleString()}
        </span>
        <form action={refreshResearchRun}>
          <input type="hidden" name="run_id" value={run.id} />
          <Button type="submit" size="sm" variant="secondary">
            Re-research (append)
          </Button>
        </form>
        <Link className="text-sm underline" href="/intelligence/research">
          All runs
        </Link>
      </div>

      <p className="text-sm">
        <span className="font-medium">Query:</span> {run.query}
      </p>
      {run.purpose ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Purpose:</span> {run.purpose}
        </p>
      ) : null}
      {run.last_error ? <p className="text-sm text-red-600">{run.last_error}</p> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Plan subquestions</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(plan.subquestions ?? []).map((sq) => (
            <li key={sq.id}>
              <span className="font-mono text-xs text-muted-foreground">[{sq.provider_hint}]</span>{" "}
              {sq.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Brief</h2>
        <p className="text-sm">{brief.summary}</p>
        <p className="text-xs text-muted-foreground">{brief.disclosure}</p>
        {brief.verifiedClaims.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide">HUMAN_VERIFIED</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {brief.verifiedClaims.map((c) => (
                <li key={c.fact_id}>
                  {c.claim}{" "}
                  <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">
                    source
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {brief.unverifiedClaims.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide">Unverified (disclose)</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {brief.unverifiedClaims.map((c) => (
                <li key={c.fact_id}>
                  <Badge variant="outline" className="mr-1">
                    {c.status}
                  </Badge>
                  {c.claim}{" "}
                  <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">
                    source
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Sources ({sources?.length ?? 0})</h2>
        {(sources ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No sources captured.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(sources ?? []).map((s) => (
              <li key={s.id} className="rounded border p-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{s.provider}</Badge>
                  <span className="text-xs text-muted-foreground">{s.domain}</span>
                </div>
                <a className="font-medium underline" href={s.url} target="_blank" rel="noreferrer">
                  {s.title || s.url}
                </a>
                {s.excerpt ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.excerpt}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Facts ({facts?.length ?? 0})</h2>
        {(facts ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No facts yet.</p>
        ) : (
          <ul className="space-y-3">
            {(facts ?? []).map((f) => (
              <li key={f.id} className="space-y-2 rounded border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{f.verification_status}</Badge>
                  {f.provider ? <Badge variant="outline">{f.provider}</Badge> : null}
                </div>
                <p className="text-sm font-medium">{f.claim || f.title || "—"}</p>
                {f.excerpt ? <p className="text-xs text-muted-foreground">{f.excerpt}</p> : null}
                <a className="text-xs underline" href={f.source_url} target="_blank" rel="noreferrer">
                  View source
                </a>
                <ResearchFactReviewActions
                  factId={f.id}
                  claim={f.claim || f.title || ""}
                  excerpt={f.excerpt || ""}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    </div>
  );
}

export default function ResearchRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading research run…</p>}>
      <RunDetail params={params} />
    </Suspense>
  );
}
