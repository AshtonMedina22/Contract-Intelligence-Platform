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
import {
  listConversations,
  loadConversationMessages,
  persistedMessagesToUi,
} from "@/lib/ask/conversations";
import { normalizeInternalHit, normalizeStructuredRow } from "@/lib/ask/evidence";
import { persistAiRun, type PendingToolTrace } from "@/lib/ask/persist-run";
import {
  askLaunchViewFromParam,
  askLaunchViewLabel,
  buildAskHref,
  parseAskContext,
  type AskLaunchView,
} from "@/lib/intelligence/ask-launch";

const EXAMPLE_QUERIES = [
  "Dallas ISD security contract",
  "evaluator weaknesses staffing",
  "transition plan",
] as const;

type AskSearchParams = {
  q?: string;
  opportunity?: string;
  mode?: string;
  purpose?: string;
  report?: string;
  /** Which Intelligence view launched this question. Provenance only. */
  from?: string;
  /** The filters that view had applied. Displayed, never used to narrow retrieval. */
  context?: string;
  conversation?: string;
};

function parseMode(raw: string | undefined): AskMode {
  if (raw === "locate" || raw === "report" || raw === "ask") return raw;
  return "ask";
}

async function AskIntelligence({
  searchParams,
}: {
  searchParams: Promise<AskSearchParams>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const opportunityId = params.opportunity?.trim() ?? "";
  const mode = parseMode(params.mode);
  const purpose: RetrievalPurpose =
    purposeFromParam(params.purpose) ?? defaultPurposeForMode(mode);
  const reportKind = (params.report as ReportKind | undefined) ?? "executive";
  const launchedFrom = askLaunchViewFromParam(params.from);
  const launchContext = parseAskContext(params.context);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to use Find or Ask GPT.</p>;
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.organization_id) return <p className="text-sm">No organization.</p>;

  const [conversations, recentRuns] = await Promise.all([
    listConversations(supabase),
    supabase
      .from("ai_runs")
      .select("id, mode, purpose, question, status, conversation_id, report_run_id, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const selectedConversationId = params.conversation?.trim() || null;
  const initialMessages = selectedConversationId
    ? persistedMessagesToUi(
        await loadConversationMessages(supabase, selectedConversationId),
      )
    : [];

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
        <AskPageHeader
          opportunityId={opportunityId}
          opportunityTitle={opportunityTitle}
          launchedFrom={launchedFrom}
          launchContext={launchContext}
        />
        <AskModeForm
          mode={mode}
          purpose={purpose}
          opportunityId={opportunityId}
        reportKind={reportKind}
        query={query}
        showQuery={false}
        launchedFrom={launchedFrom}
        launchContextRaw={params.context ?? null}
      />
        <AskChatClient
          purpose={purpose}
          opportunityId={opportunityId || null}
          dataScope={dataScope}
          initialQuery={query || undefined}
          conversationId={selectedConversationId}
          initialMessages={initialMessages}
        />
        <AskHistory
          conversations={conversations}
          runs={recentRuns.data ?? []}
          selectedConversationId={selectedConversationId}
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

  const startedAt = Date.now();
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

  if ((query && mode === "locate") || (mode === "report" && report)) {
    const now = new Date().toISOString();
    const traces: PendingToolTrace[] = [
      {
        toolCallId: null,
        toolName: mode === "locate" ? "locate_records_and_passages" : "generate_intelligence_report",
        safeParams:
          mode === "locate"
            ? { query, purpose, opportunityId: opportunityId || null }
            : { reportKind, query: query || null, opportunityId: opportunityId || null },
        resultRefs:
          mode === "locate"
            ? [
                ...locate.map((row) => ({ id: row.id, kind: row.kind, internal_ref: row.href })),
                ...hits.map((hit) => ({
                  document_id: hit.document_id,
                  chunk_id: hit.chunk_id,
                })),
              ]
            : report?.reportRunId
              ? [{ report_run_id: report.reportRunId }]
              : [],
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: now,
        latencyMs: Math.max(0, Date.now() - startedAt),
        status: "SUCCEEDED",
        errorMessage: null,
        analyticalRunId: null,
        researchRunId: null,
        reportRunId: report?.reportRunId ?? null,
      },
    ];
    const evidence = [
      ...hits.map(normalizeInternalHit),
      ...locate.map((row) =>
        normalizeStructuredRow({
          prefix: "locate",
          key: `${row.kind}:${row.id}`,
          title: row.title,
          excerpt: row.detail || row.title,
          internal_ref: row.href,
          entity: row.kind,
          data_classification: "verified_internal",
          structured_ref: { kind: row.kind, id: row.id },
        }),
      ),
    ];
    await persistAiRun(supabase, {
      organizationId: membership.organization_id,
      userId: user.id,
      mode: mode === "locate" ? "LOCATE" : "REPORT",
      purpose: mode === "report" && report ? report.purpose : purpose,
      question: query || (mode === "report" ? reportKind : null),
      answer,
      latencyMs: Date.now() - startedAt,
      status: insufficient ? "INSUFFICIENT" : "SUCCEEDED",
      traces,
      evidence,
      reportRunId: report?.reportRunId ?? null,
    });
  }

  return (
    <div className="space-y-4">
      <AskPageHeader
        opportunityId={opportunityId}
        opportunityTitle={opportunityTitle}
        launchedFrom={launchedFrom}
        launchContext={launchContext}
      />
      <AskModeForm
        mode={mode}
        purpose={purpose}
        opportunityId={opportunityId}
        reportKind={reportKind}
        query={query}
        showQuery
        launchedFrom={launchedFrom}
        launchContextRaw={params.context ?? null}
      />

      {!query && mode !== "report" ? (
        <ul className="flex flex-wrap gap-2 text-sm">
          {EXAMPLE_QUERIES.map((example) => (
            <li key={example}>
              <Link
                className="inline-block border px-2 py-1 text-xs hover:bg-muted"
                href={buildAskHref({ mode, purpose, q: example, opportunityId, from: launchedFrom })}
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
      <AskHistory
        conversations={conversations}
        runs={recentRuns.data ?? []}
        selectedConversationId={selectedConversationId}
      />

      {query && mode !== "locate" && hits.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Passage table</h2>
          <SearchHitsTable rows={hits} />
        </section>
      ) : null}
    </div>
  );
}

function AskHistory(props: {
  conversations: Array<{
    id: string;
    title: string;
    purpose: string;
    updated_at: string;
  }>;
  runs: Array<{
    id: string;
    mode: string;
    purpose: string;
    question: string | null;
    status: string;
    conversation_id: string | null;
    report_run_id: string | null;
    created_at: string;
  }>;
  selectedConversationId: string | null;
}) {
  return (
    <section className="max-w-3xl space-y-2 border-t pt-3" data-testid="ask-audit-history">
      <h2 className="text-sm font-medium">Ask & report history</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Conversations</p>
          <ul className="mt-1 space-y-1 text-xs">
            {props.conversations.length ? (
              props.conversations.slice(0, 10).map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    className={
                      conversation.id === props.selectedConversationId
                        ? "font-medium underline"
                        : "underline"
                    }
                    href={`/intelligence/ask?mode=ask&purpose=${conversation.purpose}&conversation=${conversation.id}`}
                  >
                    {conversation.title}
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No durable conversations yet.</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Recent runs</p>
          <ul className="mt-1 space-y-1 text-xs">
            {props.runs.length ? (
              props.runs.map((run) => (
                <li key={run.id}>
                  {run.conversation_id ? (
                    <Link
                      className="underline"
                      href={`/intelligence/ask?mode=ask&purpose=${run.purpose}&conversation=${run.conversation_id}`}
                    >
                      {run.mode}: {run.question || run.id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span>
                      {run.mode}: {run.question || run.id.slice(0, 8)}
                    </span>
                  )}{" "}
                  <span className="text-muted-foreground">· {run.status}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No audited runs yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function AskPageHeader(props: {
  opportunityId: string;
  opportunityTitle: string | null;
  launchedFrom: AskLaunchView | null;
  launchContext: { key: string; value: string }[];
}) {
  const fromLabel = askLaunchViewLabel(props.launchedFrom);
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
      {fromLabel ? (
        <div
          data-testid="ask-context-banner"
          className="space-y-1 border-l-2 border-muted-foreground/40 bg-muted/30 px-3 py-2 text-sm"
        >
          <p>
            Launched from{" "}
            <Link className="underline" href={`/intelligence/${props.launchedFrom}`}>
              {fromLabel}
            </Link>
            . The mode and purpose above came from that view.
          </p>
          {props.launchContext.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              View context:{" "}
              {props.launchContext.map((pair, index) => (
                <span key={pair.key}>
                  {index > 0 ? " · " : ""}
                  <span className="font-medium">{pair.key}</span>
                  {pair.value ? `=${pair.value}` : ""}
                </span>
              ))}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Context is shown for provenance only — it did not narrow retrieval. Retrieval scope is the
            purpose above, and the answer is still limited to verified evidence.
          </p>
        </div>
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
  launchedFrom: AskLaunchView | null;
  launchContextRaw: string | null;
}) {
  return (
    <form className="flex max-w-3xl flex-wrap items-end gap-3" method="get">
      {props.opportunityId ? <input type="hidden" name="opportunity" value={props.opportunityId} /> : null}
      {props.launchedFrom ? <input type="hidden" name="from" value={props.launchedFrom} /> : null}
      {props.launchContextRaw ? (
        <input type="hidden" name="context" value={props.launchContextRaw} />
      ) : null}
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

export default function Page({ searchParams }: { searchParams: Promise<AskSearchParams> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AskIntelligence searchParams={searchParams} />
    </Suspense>
  );
}
