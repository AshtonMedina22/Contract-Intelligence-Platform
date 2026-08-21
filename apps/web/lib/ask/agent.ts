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
1) INTERNAL_VERIFIED — HUMAN_VERIFIED corpus + structured DB (pricing four-truth, contracts, awards). Highest authority.
2) PUBLIC — Morphic-style web/procurement research (OFFICIAL_PUBLIC / EXTERNAL_RESEARCH / UNVERIFIED), including USAspending federal award tools (search_federal_awards / get_federal_award / lookup_federal_recipient). Cite-only. NEVER write public results into the verified corpus. NEVER treat public web or USAspending amounts as L&P proposed/awarded/current rates. NEVER invent market share.

Workflow:
- Prefer tools. Retrieve internal evidence first for L&P history/pricing.
- Use public research for buyer/competitor/market context when helpful.
- Rerank internal passages before answering.
- Cite sources as [n] matching tool evidence order.
- Call validate_answer_citations before finishing when you cited sources.
- If evidence is insufficient, reply exactly: ${INSUFFICIENT}

Hard rules:
- Never invent market share, win rates, prices, or causation.
- Keep proposed_rate, awarded_rate, current_rate, requested_rate SEPARATE (four-truth).
- Purpose=${opts.purpose}. Drafting gates=${drafting ? "ON" : "OFF"}.
- Data scope: ${opts.dataScope}.
- DO_NOT_USE chunks are retrospective only — never recommend for new proposal drafting.
${drafting ? "- For PROPOSAL_DRAFTING / drafting purposes: public/unverified sources are context only, not L&P rate truth." : ""}`;
}

export async function streamAskChat(opts: StreamAskChatOpts) {
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

  const result = streamText({
    model,
    system: buildAskSystemPrompt({ purpose: opts.purpose, dataScope: opts.dataScope }),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
  });

  return {
    result,
    modelId,
    getEvidence: () => ctx.evidenceBag,
  };
}
