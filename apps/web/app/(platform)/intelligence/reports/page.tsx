import { Suspense } from "react";
import Link from "next/link";
import { IntelligenceNav } from "@/components/section-tabs";
import { PageHeader } from "@/components/shell";
import { AskAnswerPanel } from "@/components/ask/answer-panel";
import { AskAboutThis, IntelligenceHonestyStrip } from "@/components/intelligence/honesty-strip";
import { askChip, buildAskHref } from "@/lib/intelligence/ask-launch";
import { generateIntelligenceReport, REPORT_CATALOG, type ReportKind } from "@/lib/reports/generate";
import { createClient } from "@/lib/supabase/server";

async function ReportsContent({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; opportunity?: string }>;
}) {
  const params = await searchParams;
  const kind = (params.kind as ReportKind | undefined) ?? null;
  const opportunityId = params.opportunity?.trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to open reports.</p>;

  const report = kind ? await generateIntelligenceReport(kind, { opportunityId }) : null;
  const generatedAt = new Date().toISOString();
  const reportMeta = report ? REPORT_CATALOG.find((r) => r.kind === report.kind) : null;

  return (
    <div className="space-y-3">
      <IntelligenceNav />
      <PageHeader
        title="Reports"
        description={`${REPORT_CATALOG.length} evidence-backed intelligence reports assembled from verified canonical records. Automation never invents market size or win rates. Final pricing and submission stay human.`}
      />
      <IntelligenceHonestyStrip extra="Every report states its own data cutoff, the scope it queried, its sources, and its limitations. A report with no verified evidence returns an explicit refusal instead of a narrative." />
      <AskAboutThis
        chips={[
          askChip({
            label: "Executive brief",
            mode: "report",
            report: "executive",
            from: "reports",
            filters: { catalog: REPORT_CATALOG.length },
          }),
          askChip({
            label: "Ask across the corpus",
            mode: "ask",
            purpose: "REPORT_GENERATION",
            from: "reports",
            q: "What can be stated from verified records across the whole corpus right now?",
          }),
        ]}
      />

      <p className="text-xs text-muted-foreground">
        Data cutoff for anything generated on this load: <code>{generatedAt}</code>
        {opportunityId ? (
          <>
            {" · scoped to pursuit "}
            <Link className="underline" href={`/procurement/opportunities/${opportunityId}`}>
              {opportunityId.slice(0, 8)}…
            </Link>
          </>
        ) : (
          " · cross-corpus (no pursuit filter)"
        )}
      </p>

      <ul className="grid gap-2 sm:grid-cols-2" data-testid="report-catalog">
        {REPORT_CATALOG.map((item) => (
          <li key={item.kind} className="space-y-1.5 border p-2.5 text-sm">
            <h2 className="font-medium">{item.title}</h2>
            <p className="text-xs text-muted-foreground">{item.body}</p>
            <p className="text-[11px] text-muted-foreground">
              <code>kind={item.kind}</code> · <code>purpose={item.purpose}</code>
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link
                className="border px-1.5 py-0.5 hover:bg-muted"
                href={`/intelligence/reports?kind=${item.kind}${opportunityId ? `&opportunity=${opportunityId}` : ""}`}
              >
                Generate here
              </Link>
              <Link
                className="border px-1.5 py-0.5 hover:bg-muted"
                href={buildAskHref({
                  mode: "report",
                  purpose: item.purpose,
                  report: item.kind,
                  opportunityId,
                  from: "reports",
                  filters: { report: item.title },
                })}
              >
                Open in Ask
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {report ? (
        <div className="space-y-3" data-testid="generated-report">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3">
            <h2 className="text-sm font-medium">{report.title}</h2>
            <p className="text-xs text-muted-foreground">
              generated <code>{generatedAt}</code> · purpose{" "}
              <code>{reportMeta?.purpose ?? "REPORT_GENERATION"}</code>
            </p>
          </div>
          <AskAnswerPanel
            answer={report.answer}
            insufficient={report.insufficient}
            dataScope={`${report.dataScope}; data cutoff ${generatedAt}`}
            limitations={report.limitations}
            purpose={reportMeta?.purpose ?? "REPORT_GENERATION"}
            mode="report"
            sources={report.evidenceHits}
          />
          {!report.insufficient
            ? report.sections.map((s) => (
                <section key={s.heading} className="space-y-1 text-sm">
                  <h3 className="font-medium">{s.heading}</h3>
                  <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {s.bullets.map((b) => (
                      <li key={b.slice(0, 64)}>{b}</li>
                    ))}
                  </ul>
                </section>
              ))
            : null}
          {report.sources.length > 0 ? (
            <section className="space-y-1 text-sm">
              <h3 className="font-medium">Report sources</h3>
              <ul className="list-disc space-y-0.5 pl-5">
                {report.sources.map((s) => (
                  <li key={s.label}>
                    {s.href ? (
                      <Link className="underline" href={s.href}>
                        {s.label}
                      </Link>
                    ) : (
                      s.label
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; opportunity?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}
