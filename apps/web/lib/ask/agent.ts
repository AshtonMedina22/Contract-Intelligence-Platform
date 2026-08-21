import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { INSUFFICIENT } from "@/lib/ask/synthesize";
import { selectAskModelId, resolveChatModel } from "@/lib/ask/model";
import { createAskTools, type AskToolContext } from "@/lib/ask/tools";
import { purposeRequiresDraftingGates, type RetrievalPurpose } from "@/lib/retrieval/purpose";
import type { NormalizedEvidence } from "@/lib/ask/evidence";
import {
  collectResultRefs,
  traceLinksFromOutput,
  type PendingToolTrace,
} from "@/lib/ask/persist-run";
import { sanitizeAuditText, sanitizeToolParams } from "@/lib/ask/sanitize-tool-params";

export type StreamAskChatOpts = {
  messages: UIMessage[];
  purpose: RetrievalPurpose;
  opportunityId: string | null;
  dataScope: string;
};

export function buildAskSystemPrompt(opts: {
  purpose: RetrievalPurpose;
  dataScope: string;
}): string {
  const drafting = purposeRequiresDraftingGates(opts.purpose);
  return `You are the Contract Intelligence Ask agent for a multi-tenant L&P procurement platform.

You have TWO evidence rails — never conflate them:
1) INTERNAL_VERIFIED — HUMAN_VERIFIED corpus + structured DB (pricing four-truth, contracts, awards) + durable HUMAN_VERIFIED research_facts. Highest authority.
2) PUBLIC — Morphic-style live web/procurement research (OFFICIAL_PUBLIC / EXTERNAL_RESEARCH / UNVERIFIED), including USAspending federal award tools (search_federal_awards / get_federal_award / lookup_federal_recipient). Cite-only rail. NEVER write public results into the verified corpus. NEVER treat public web, live search hits, or USAspending amounts as L&P proposed/awarded/current rates. NEVER invent market share. AI_EXTRACTED research_facts are observations pending human review — not verified truth and not for reports as verified.

Workflow:
- Prefer tools. Retrieve internal evidence first for L&P history/pricing.
- Prefer search_verified_research_facts (HUMAN_VERIFIED only) before live search_public_research when durable research exists.
- For L&P corporate past performance, call search_experience_records with corporate_only=true (or experience_type=L_AND_P_CORPORATE). Types NEVER merge — prior-employer / personnel / subcontractor are not corporate PP. Preserve attribution_language; never invent value/years.
- Use live public research for buyer/competitor/market context when helpful — cite-only.
- For count / rate / median / contract-expiration / competitor-frequency analytics, call ask_structured_analytics (governed metric registry). Never invent SQL against the database. Never invent market share.
- Rerank internal passages before answering.
- Cite sources as [n] matching tool evidence order.
- Call validate_answer_citations before finishing when you cited sources.
- If evidence is insufficient, reply exactly: ${INSUFFICIENT}

Hard rules:
- Never invent market share, win rates, prices, or causation.
- Win rates come only from ask_structured_analytics (win_rate_decided / recompete_win_rate) which withholds below the P9 sample gate — never invent a percentage.
- Keep proposed_rate, awarded_rate, current_rate, requested_rate SEPARATE (four-truth).
- Purpose=${opts.purpose}. Drafting gates=${drafting ? "ON" : "OFF"}.
- Data scope: ${opts.dataScope}.
- DO_NOT_USE chunks are retrospective only — never recommend for new proposal drafting.
${drafting ? "- For PROPOSAL_DRAFTING / drafting purposes: public/unverified sources are context only, not L&P rate truth." : ""}`;
}

export async function streamAskChat(opts: StreamAskChatOpts) {
  const startedAtMs = Date.now();
  const modelId = selectAskModelId();
  if (!modelId) {
    throw new Error(
      "No Ask model configured. Set ASK_MODEL plus AI_GATEWAY_API_KEY, GROQ_API_KEY, OLLAMA_*, or OPENAI_API_KEY.",
    );
  }

  const ctx: AskToolContext = {
    purpose: opts.purpose,
    opportunityId: opts.opportunityId,
    evidenceBag: [] as NormalizedEvidence[],
  };
  const tools = createAskTools(ctx);
  const model = resolveChatModel(modelId);
  const modelMessages = await convertToModelMessages(opts.messages);
  const activeTools = new Map<
    string,
    { startedAtMs: number; toolName: string; input: Record<string, unknown> }
  >();
  const traces: PendingToolTrace[] = [];

  const result = streamText({
    model,
    system: buildAskSystemPrompt({ purpose: opts.purpose, dataScope: opts.dataScope }),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
    onToolExecutionStart({ toolCall }) {
      activeTools.set(toolCall.toolCallId, {
        startedAtMs: Date.now(),
        toolName: toolCall.toolName,
        input: sanitizeToolParams(toolCall.input),
      });
    },
    onToolExecutionEnd({ toolCall, toolExecutionMs, toolOutput }) {
      const active = activeTools.get(toolCall.toolCallId);
      const finishedAtMs = Date.now();
      const started = active?.startedAtMs ?? finishedAtMs - toolExecutionMs;
      const failed = toolOutput.type === "tool-error";
      const output = failed ? null : toolOutput.output;
      const links = traceLinksFromOutput(output);
      traces.push({
        toolCallId: toolCall.toolCallId,
        toolName: active?.toolName ?? toolCall.toolName,
        safeParams: active?.input ?? sanitizeToolParams(toolCall.input),
        resultRefs: collectResultRefs(output),
        startedAt: new Date(started).toISOString(),
        finishedAt: new Date(finishedAtMs).toISOString(),
        latencyMs: Math.max(0, Math.round(toolExecutionMs)),
        status: failed ? "FAILED" : "SUCCEEDED",
        errorMessage: failed ? sanitizeAuditText(toolOutput.error) : null,
        ...links,
      });
      activeTools.delete(toolCall.toolCallId);
    },
  });

  return {
    result,
    modelId,
    getEvidence: () => ctx.evidenceBag,
    getTraces: () => traces,
    startedAtMs,
  };
}
