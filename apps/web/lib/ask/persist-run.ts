import type { UIMessage } from "ai";
import type { NormalizedEvidence } from "@/lib/ask/evidence";
import { sanitizeAuditText, sanitizeToolParams } from "@/lib/ask/sanitize-tool-params";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiRunMode = "LOCATE" | "ASK_ANALYZE" | "REPORT";
export type AiRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED" | "INSUFFICIENT";

export type PendingToolTrace = {
  toolCallId: string | null;
  toolName: string;
  safeParams: Record<string, unknown>;
  resultRefs: Array<Record<string, unknown>>;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  status: "SUCCEEDED" | "FAILED";
  errorMessage: string | null;
  analyticalRunId: string | null;
  researchRunId: string | null;
  reportRunId: string | null;
};

function messageText(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function firstLink<T>(items: T[], pick: (item: T) => string | null | undefined): string | null {
  for (const item of items) {
    const value = pick(item);
    if (value) return value;
  }
  return null;
}

export function collectResultRefs(value: unknown): Array<Record<string, unknown>> {
  const refs: Array<Record<string, unknown>> = [];
  const seen = new WeakSet<object>();
  function visit(input: unknown, depth: number) {
    if (depth > 6 || input == null || typeof input !== "object") return;
    if (seen.has(input)) return;
    seen.add(input);
    if (Array.isArray(input)) {
      for (const child of input.slice(0, 100)) visit(child, depth + 1);
      return;
    }
    const row = input as Record<string, unknown>;
    const ref: Record<string, unknown> = {};
    for (const key of [
      "id",
      "document_id",
      "document_version_id",
      "chunk_id",
      "source_fact_id",
      "research_run_id",
      "research_fact_id",
      "analytical_run_id",
      "report_run_id",
      "runId",
      "reportRunId",
      "internal_ref",
      "url",
    ]) {
      const item = row[key];
      if (typeof item === "string" && item.length <= 500) ref[key] = item;
    }
    if (Object.keys(ref).length) refs.push(ref);
    for (const child of Object.values(row)) visit(child, depth + 1);
  }
  visit(value, 0);
  return refs.slice(0, 250);
}

export function traceLinksFromOutput(output: unknown): {
  analyticalRunId: string | null;
  researchRunId: string | null;
  reportRunId: string | null;
} {
  const refs = collectResultRefs(output);
  const pick = (keys: string[]) =>
    firstLink(refs, (ref) => {
      for (const key of keys) {
        if (typeof ref[key] === "string") return ref[key] as string;
      }
      return null;
    });
  return {
    analyticalRunId: pick(["analytical_run_id", "runId"]),
    researchRunId: pick(["research_run_id"]),
    reportRunId: pick(["report_run_id", "reportRunId"]),
  };
}

async function currentVersionMap(
  supabase: Supabase,
  evidence: NormalizedEvidence[],
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(evidence.map((item) => item.document_id).filter((id): id is string => Boolean(id))),
  ];
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("document_versions")
    .select("id, document_id")
    .in("document_id", ids)
    .eq("is_current", true);
  return new Map((data ?? []).map((row) => [row.document_id, row.id]));
}

export async function persistAiRun(
  supabase: Supabase,
  opts: {
    organizationId: string;
    userId: string;
    conversationId?: string | null;
    mode: AiRunMode;
    purpose: string;
    model?: string | null;
    question?: string | null;
    answer?: string | null;
    latencyMs?: number | null;
    dataCutoff?: string;
    status: AiRunStatus;
    errorMessage?: string | null;
    messages?: UIMessage[];
    traces?: PendingToolTrace[];
    evidence?: NormalizedEvidence[];
    reportRunId?: string | null;
  },
): Promise<string> {
  const traces = opts.traces ?? [];
  const evidence = opts.evidence ?? [];
  const analyticalRunId =
    firstLink(traces, (trace) => trace.analyticalRunId) ??
    firstLink(evidence, (item) => item.analytical_run_id);
  const researchRunId =
    firstLink(traces, (trace) => trace.researchRunId) ??
    firstLink(evidence, (item) => item.research_run_id);
  const reportRunId =
    opts.reportRunId ?? firstLink(traces, (trace) => trace.reportRunId);

  const { data: run, error: runError } = await supabase
    .from("ai_runs")
    .insert({
      organization_id: opts.organizationId,
      conversation_id: opts.conversationId ?? null,
      created_by: opts.userId,
      mode: opts.mode,
      purpose: opts.purpose,
      model: opts.model ?? null,
      question: sanitizeAuditText(opts.question, 20_000),
      answer: sanitizeAuditText(opts.answer, 100_000),
      latency_ms: opts.latencyMs == null ? null : Math.max(0, Math.round(opts.latencyMs)),
      data_cutoff: opts.dataCutoff ?? new Date().toISOString(),
      status: opts.status,
      error_message: sanitizeAuditText(opts.errorMessage),
      analytical_run_id: analyticalRunId,
      research_run_id: researchRunId,
      report_run_id: reportRunId,
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error(`Unable to persist AI run: ${runError?.message}`);

  if (opts.conversationId && opts.messages?.length) {
    const { data: existing, error: existingError } = await supabase
      .from("ask_messages")
      .select("client_message_id, sequence")
      .eq("conversation_id", opts.conversationId)
      .order("sequence", { ascending: false });
    if (existingError) throw new Error(`Unable to inspect Ask messages: ${existingError.message}`);
    const known = new Set((existing ?? []).map((row) => row.client_message_id).filter(Boolean));
    let sequence = (existing?.[0]?.sequence ?? -1) + 1;
    const rows = opts.messages
      .filter((message) => !known.has(message.id))
      .map((message) => ({
        organization_id: opts.organizationId,
        conversation_id: opts.conversationId!,
        ai_run_id: run.id,
        created_by: message.role === "user" ? opts.userId : null,
        client_message_id: message.id,
        role: message.role,
        content: messageText(message) || null,
        parts: message.parts ?? [],
        sequence: sequence++,
      }));
    if (rows.length) {
      const { error } = await supabase.from("ask_messages").insert(rows);
      if (error) throw new Error(`Unable to persist Ask messages: ${error.message}`);
    }
  }

  if (traces.length) {
    const { error } = await supabase.from("ai_tool_traces").insert(
      traces.map((trace) => ({
        organization_id: opts.organizationId,
        ai_run_id: run.id,
        tool_call_id: trace.toolCallId,
        tool_name: trace.toolName,
        safe_params: sanitizeToolParams(trace.safeParams),
        result_refs: trace.resultRefs,
        started_at: trace.startedAt,
        finished_at: trace.finishedAt,
        latency_ms: Math.max(0, Math.round(trace.latencyMs)),
        status: trace.status,
        error_message: sanitizeAuditText(trace.errorMessage),
        analytical_run_id: trace.analyticalRunId,
        research_run_id: trace.researchRunId,
        report_run_id: trace.reportRunId,
      })),
    );
    if (error) throw new Error(`Unable to persist AI tool traces: ${error.message}`);
  }

  if (evidence.length) {
    const versions = await currentVersionMap(supabase, evidence);
    const rows = evidence.map((item, index) => ({
      organization_id: opts.organizationId,
      ai_run_id: run.id,
      citation_index: index + 1,
      title: item.title,
      excerpt: item.excerpt,
      source_url: item.url,
      internal_ref: item.internal_ref,
      document_id: item.document_id,
      document_version_id:
        item.document_version_id ?? (item.document_id ? versions.get(item.document_id) ?? null : null),
      extracted_fact_id: item.extracted_fact_id ?? null,
      chunk_id: item.chunk_id,
      research_run_id: item.research_run_id ?? null,
      research_fact_id: item.research_fact_id ?? null,
      analytical_run_id: item.analytical_run_id ?? null,
      structured_ref:
        item.structured_ref ??
        (!item.document_id &&
        !item.chunk_id &&
        !item.research_run_id &&
        !item.research_fact_id &&
        !item.analytical_run_id
          ? { evidence_id: item.id, entity: item.entity, topic: item.topic }
          : null),
    }));
    const { error } = await supabase.from("ai_citations").insert(rows);
    if (error) throw new Error(`Unable to persist AI citations: ${error.message}`);
  }

  return run.id;
}

export function latestUserQuestion(messages: UIMessage[]): string | null {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest ? messageText(latest) || null : null;
}

export function latestAssistantAnswer(messages: UIMessage[]): string | null {
  const latest = [...messages].reverse().find((message) => message.role === "assistant");
  return latest ? messageText(latest) || null : null;
}
