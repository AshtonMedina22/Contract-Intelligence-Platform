import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AskAnswerPanel } from "@/components/ask/answer-panel";
import { AskChatClient } from "@/components/ask/ask-chat";
import { SearchHitsTable, type SearchHitRow } from "../content/search-hits-table";
import { createClient } from "@/lib/supabase/server";
import {
  defaultPurposeForMode,
  purposeFromParam,
  type AskMode,
  type RetrievalPurpose,
  RETRIEVAL_PURPOSES,
} from "@/lib/retrieval/purpose";
import { locateRecords, searchVerifiedKnowledge } from "@/lib/retrieval/search";
import { INSUFFICIENT } from "@/lib/ask/synthesize";
import { generateIntelligenceReport, REPORT_CATALOG, type ReportKind } from "@/lib/reports/generate";

const EXAMPLE_QUERIES = [
  "Dallas ISD security contract",
  "evaluator weaknesses staffing",
  "transition plan",
] as const;

function parseMode(raw: string | undefined): AskMode {
  if (raw === "locate" || raw === "report" || raw === "ask") return raw;
  return "ask";
}

async function AskIntelligence({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    opportunity?: string;
    mode?: string;
    purpose?: string;
    report?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const opportunityId = params.opportunity?.trim() ?? "";
  const mode = parseMode(params.mode);
  const purpose: RetrievalPurpose =
    purposeFromParam(params.purpose) ?? defaultPurposeForMode(mode);
  const reportKind = (params.report as ReportKind | undefined) ?? "executive";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to use Find or Ask GPT.</p>;

  let opportunityTitle: string | null = null;
  if (opportunityId) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("title")
      .eq("id", opportunityId)
      .maybeSingle();
    opportunityTitle = opp?.title ?? null;
  }

  const dataScope = [
    "organization (RLS)",
    mode === "ask" ? "INTERNAL_VERIFIED + optional PUBLIC research" : "HUMAN_VERIFIED only",
    `purpose=${purpose}`,
    purpose === "PROPOSAL_DRAFTING" ? "excludes DO_NOT_USE/SUPERSEDED/non-current" : null,
    opportunityId ? `pursuit=${opportunityId}` : "cross-corpus",
  ]
    .filter(Boolean)
    .join(" · ");

  // mode=ask uses the dual-rail streaming agent (AskChatClient). LOCATE / REPORT stay GET.
  if (mode === "ask") {
    return (
      <div className="space-y-4">
        <AskPageHeader opportunityId={opportunityId} opportunityTitle={opportunityTitle} />
        <AskModeForm
          mode={mode}
          purpose={purpose}
          opportunityId={opportunityId}
          reportKind={reportKind}
          query={query}
          showQuery={false}
        />
        <AskChatClient
          purpose={purpose}
          opportunityId={opportunityId || null}
          dataScope={dataScope}
          initialQuery={query || undefined}
        />
      </div>
    );
  }

  const locate = query && mode === "locate" ? await locateRecords(query) : [];
  let hits: SearchHitRow[] = [];
  let errorMessage: string | null = null;
  let answer = "";
  let insufficient = false;
  let limitations = "";
  const modelUsed: string | null = null;

  if (query && mode === "locate") {
    const { hits: knowledgeHits, error } = await searchVerifiedKnowledge({
      query,
      purpose,
      opportunityId,
      queryEmbedding: null,
      limit: 25,
    });
    if (error) errorMessage = error;
    hits = knowledgeHits;
    answer =
      locate.length + hits.length === 0
        ? INSUFFICIENT
        : `Located ${locate.length} structured record(s) and ${hits.length} verified passage(s). No LLM used.`;
    insufficient = locate.length + hits.length === 0;
    limitations =
      "LOCATE uses structured SQL + FTS only. Open View Source / record links to inspect evidence.";
  }

  let report = null;
  if (mode === "report") {
    report = await generateIntelligenceReport(reportKind, {
      opportunityId: opportunityId || null,
      query: query || undefined,
    });
    answer = report.answer;
    insufficient = report.insufficient;
    limitations = report.limitations;
    hits = report.evidenceHits;
  }

  return (
    <div className="space-y-4">
      <AskPageHeader opportunityId={opportunityId} opportunityTitle={opportunityTitle} />
      <AskModeForm
        mode={mode}
        purpose={purpose}
        opportunityId={opportunityId}
        reportKind={reportKind}
        query={query}
        showQuery
      />

      {!query && mode !== "report" ? (
        <ul className="flex flex-wrap gap-2 text-sm">
          {EXAMPLE_QUERIES.map((example) => (
            <li key={example}>
              <Link
                className="inline-block border px-2 py-1 text-xs hover:bg-muted"
                href={`/intelligence/ask?mode=${mode}&purpose=${purpose}&q=${encodeURIComponent(example)}`}
              >
                {example}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {query || mode === "report" ? (
        <AskAnswerPanel
          answer={answer}
          insufficient={insufficient}
          dataScope={mode === "report" && report ? report.dataScope : dataScope}
          limitations={limitations}
          purpose={purpose}
          mode={mode}
          sources={hits}
          locate={locate}
          modelUsed={modelUsed}
        />
      ) : null}

      {report && !report.insufficient ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">{report.title}</h2>
          {report.sections.map((s) => (
            <div key={s.heading} className="space-y-1 text-sm">
              <h3 className="font-medium">{s.heading}</h3>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {s.bullets.map((b) => (
                  <li key={b.slice(0, 48)}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="text-sm">
            <h3 className="font-medium">Report sources</h3>
            <ul className="list-disc pl-5">
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
          </div>
        </section>
      ) : null}

      {query && mode !== "locate" && hits.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Passage table</h2>
          <SearchHitsTable rows={hits} />
        </section>
      ) : null}
    </div>
  );
}

function AskPageHeader(props: {
  opportunityId: string;
  opportunityTitle: string | null;
}) {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Find or Ask GPT</h1>
        <p className="text-sm text-muted-foreground">
          Global header capability — not a sidebar app. Modes: LOCATE (no LLM) · ASK/ANALYZE (dual-rail
          agent) · REPORT (SQL evidence briefs).
        </p>
      </div>
      {props.opportunityId && props.opportunityTitle ? (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          Scoped to pursuit:{" "}
          <Link className="underline" href={`/procurement/opportunities/${props.opportunityId}`}>
            {props.opportunityTitle}
          </Link>
        </p>
      ) : null}
    </>
  );
}

function AskModeForm(props: {
  mode: AskMode;
  purpose: RetrievalPurpose;
  opportunityId: string;
  reportKind: ReportKind;
  query: string;
  showQuery: boolean;
}) {
  return (
    <form className="flex max-w-3xl flex-wrap items-end gap-3" method="get">
      {props.opportunityId ? <input type="hidden" name="opportunity" value={props.opportunityId} /> : null}
      <div className="space-y-1">
        <Label htmlFor="mode">Mode</Label>
        <select
          id="mode"
          name="mode"
          defaultValue={props.mode}
          className="flex h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="locate">LOCATE</option>
          <option value="ask">ASK / ANALYZE</option>
          <option value="report">REPORT</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="purpose">Purpose</Label>
        <select
          id="purpose"
          name="purpose"
          defaultValue={props.purpose}
          className="flex h-9 rounded-md border bg-background px-2 text-sm"
        >
          {RETRIEVAL_PURPOSES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {props.mode === "report" ? (
        <div className="space-y-1">
          <Label htmlFor="report">Report</Label>
          <select
            id="report"
            name="report"
            defaultValue={props.reportKind}
            className="flex h-9 rounded-md border bg-background px-2 text-sm"
          >
            {REPORT_CATALOG.map((r) => (
              <option key={r.kind} value={r.kind}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {props.showQuery ? (
        <div className="min-w-72 flex-1 space-y-1">
          <Label htmlFor="q">Query</Label>
          <Input id="q" name="q" defaultValue={props.query} placeholder="Find or Ask GPT..." />
        </div>
      ) : null}
      <Button type="submit">{props.mode === "report" ? "Generate" : props.mode === "ask" ? "Apply" : "Run"}</Button>
    </form>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    opportunity?: string;
    mode?: string;
    purpose?: string;
    report?: string;
  }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AskIntelligence searchParams={searchParams} />
    </Suspense>
  );
}
