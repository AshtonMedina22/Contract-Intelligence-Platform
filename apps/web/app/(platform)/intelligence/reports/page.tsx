import { Suspense } from "react";
import Link from "next/link";
import { IntelligenceNav } from "@/components/section-tabs";
import { AskAnswerPanel } from "@/components/ask/answer-panel";
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

  return (
    <div className="space-y-4">
      <IntelligenceNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Evidence-backed intelligence reports from verified canonical records. Automation never invents market size
          or win rates. Final pricing and submission stay human.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {REPORT_CATALOG.map((item) => (
          <li key={item.kind} className="space-y-2 border p-3 text-sm">
            <h2 className="font-medium">{item.title}</h2>
            <p className="text-muted-foreground">{item.body}</p>
            <p className="text-xs text-muted-foreground">purpose={item.purpose}</p>
            <Link
              className="inline-block underline"
              href={`/intelligence/reports?kind=${item.kind}${opportunityId ? `&opportunity=${opportunityId}` : ""}`}
            >
              Generate
            </Link>
            {" · "}
            <Link
              className="inline-block underline"
              href={`/intelligence/ask?mode=report&report=${item.kind}&purpose=${item.purpose}`}
            >
              Open in Ask
            </Link>
          </li>
        ))}
      </ul>

      {report ? (
        <div className="space-y-4">
          <AskAnswerPanel
            answer={report.answer}
            insufficient={report.insufficient}
            dataScope={report.dataScope}
            limitations={report.limitations}
            purpose={REPORT_CATALOG.find((r) => r.kind === report.kind)?.purpose ?? "REPORT_GENERATION"}
            mode="report"
            sources={report.evidenceHits}
          />
          {!report.insufficient
            ? report.sections.map((s) => (
                <section key={s.heading} className="space-y-1 text-sm">
                  <h3 className="font-medium">{s.heading}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {s.bullets.map((b) => (
                      <li key={b.slice(0, 64)}>{b}</li>
                    ))}
                  </ul>
                </section>
              ))
            : null}
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
