import { generateText, type LanguageModel } from "ai";
import type { KnowledgeHit } from "@/lib/retrieval/search";
import type { RetrievalPurpose } from "@/lib/retrieval/purpose";
import { ollamaEnabled, resolveChatModel, selectAskModelId, embedQuery } from "@/lib/ask/model";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const INSUFFICIENT = "Insufficient verified evidence to answer this reliably.";

export type GroundedAnswer = {
  answer: string;
  insufficient: boolean;
  limitations: string;
  modelUsed: string | null;
  usedLlm: boolean;
};

export { embedQuery, INSUFFICIENT };

/** Single-shot grounded synthesis (drafts + legacy callers). Prefer streamAskChat for Ask UI. */
export async function synthesizeGroundedAnswer(opts: {
  query: string;
  purpose: RetrievalPurpose;
  hits: KnowledgeHit[];
  dataScope: string;
}): Promise<GroundedAnswer> {
  if (opts.hits.length === 0) {
    return {
      answer: INSUFFICIENT,
      insufficient: true,
      limitations: "No HUMAN_VERIFIED passages matched under the active retrieval purpose and tenant scope.",
      modelUsed: null,
      usedLlm: false,
    };
  }

  const chatModel = selectAskModelId();
  const evidence = opts.hits
    .slice(0, 12)
    .map(
      (h, i) =>
        `[${i + 1}] reuse=${h.reuse_status} page=${h.source_page ?? "?"} path=${h.storage_path}\n${h.content.slice(0, 800)}`,
    )
    .join("\n\n");

  if (!chatModel) {
    return {
      answer: `Verified evidence retrieved (${opts.hits.length} passage(s)). Synthesis model not configured — review Sources below. Do not treat this as a completed analyst answer.`,
      insufficient: false,
      limitations:
        "ASK_MODEL / provider not set. Showing retrieval-only response. Never invent rates, win rates, or causation.",
      modelUsed: null,
      usedLlm: false,
    };
  }

  const system = `You are a procurement intelligence analyst for a multi-tenant verified corpus.
Only use the provided evidence. Cite sources as [n].
If evidence is insufficient, reply exactly: ${INSUFFICIENT}
Never invent market share, win rates, prices, or causal claims.
Keep proposed/awarded/current/requested rates separate.
Purpose: ${opts.purpose}. Data scope: ${opts.dataScope}.
DO_NOT_USE chunks are retrospective only — never recommend them for new proposal drafting.`;
  const prompt = `Question: ${opts.query}\n\nEvidence:\n${evidence}`;

  async function run(model: LanguageModel | string, label: string): Promise<GroundedAnswer> {
    const { text } = await generateText({ model, system, prompt });
    const answer = text.trim() || INSUFFICIENT;
    const insufficient = answer.includes(INSUFFICIENT) && answer.length < INSUFFICIENT.length + 40;
    return {
      answer,
      insufficient,
      limitations: insufficient
        ? "Model reported insufficient verified evidence."
        : "Grounded on retrieved HUMAN_VERIFIED chunks only. Human judgment still required for pricing and submission.",
      modelUsed: label,
      usedLlm: true,
    };
  }

  try {
    return await run(resolveChatModel(chatModel), chatModel);
  } catch (primaryErr) {
    if (ollamaEnabled()) {
      try {
        const ollama = createOpenAICompatible({
          name: "ollama",
          baseURL:
            process.env.OLLAMA_BASE_URL?.trim() ||
            process.env.OLLAMA_HOST?.trim() ||
            "http://127.0.0.1:11434/v1",
        });
        const label = `ollama/${process.env.OLLAMA_MODEL?.trim() || "llama3.2"}`;
        return await run(ollama.chatModel(process.env.OLLAMA_MODEL?.trim() || "llama3.2"), label);
      } catch {
        /* continue */
      }
    }
    const gKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    if (gKey) {
      try {
        return await run(createGoogleGenerativeAI({ apiKey: gKey })("gemini-3.6-flash"), "google/gemini-3.6-flash");
      } catch {
        /* continue */
      }
    }
    return {
      answer: `Verified evidence retrieved (${opts.hits.length} passage(s)), but synthesis failed. Review Sources. ${primaryErr instanceof Error ? primaryErr.message : ""}`,
      insufficient: false,
      limitations: "LLM synthesis unavailable; retrieval results remain trustworthy when cited.",
      modelUsed: chatModel,
      usedLlm: false,
    };
  }
}
