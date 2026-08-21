import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embed, generateText, type EmbeddingModel, type LanguageModel } from "ai";
import type { KnowledgeHit } from "@/lib/retrieval/search";
import type { RetrievalPurpose } from "@/lib/retrieval/purpose";

const EMBEDDING_DIM = 1536;
const INSUFFICIENT = "Insufficient verified evidence to answer this reliably.";

function stripProviderPrefix(modelId: string): string {
  const trimmed = modelId.trim();
  const slash = trimmed.indexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

function ollamaBaseUrl(): string {
  return (
    process.env.OLLAMA_BASE_URL?.trim() ||
    process.env.OLLAMA_HOST?.trim() ||
    "http://127.0.0.1:11434/v1"
  );
}

function ollamaEnabled(): boolean {
  const flag = process.env.OLLAMA_ENABLED?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  // On when explicitly enabled, or when ASK_MODEL targets ollama, or OLLAMA_MODEL set.
  if (flag === "1" || flag === "true" || flag === "on") return true;
  if (process.env.OLLAMA_MODEL?.trim()) return true;
  if (/^ollama\//i.test(process.env.ASK_MODEL?.trim() || "")) return true;
  return false;
}

function ollamaChatModel(chatModel: string): LanguageModel | null {
  if (!ollamaEnabled() && !/^ollama\//i.test(chatModel)) return null;
  const name = stripProviderPrefix(chatModel) || process.env.OLLAMA_MODEL?.trim() || "llama3.2";
  const modelId = name === "ollama" ? process.env.OLLAMA_MODEL?.trim() || "llama3.2" : name;
  const ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: ollamaBaseUrl(),
  });
  return ollama.chatModel(modelId);
}

function googleChatModel(chatModel: string): LanguageModel | null {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!googleKey) return null;
  const google = createGoogleGenerativeAI({ apiKey: googleKey });
  const id = stripProviderPrefix(chatModel);
  const modelId = id.startsWith("gemini") ? id : "gemini-3.6-flash";
  return google(modelId);
}

/**
 * Auth order:
 * 1) Ollama (local, free) when enabled / ASK_MODEL=ollama/...
 * 2) Explicit Gemini → Google
 * 3) AI Gateway
 * 4) Google fallback
 * 5) OpenAI
 */
function resolveChatModel(chatModel: string): LanguageModel | string {
  if (/^ollama\//i.test(chatModel.trim()) || ollamaEnabled()) {
    const local = ollamaChatModel(chatModel);
    if (local && /^ollama\//i.test(chatModel.trim())) return local;
    if (local && !/^(google\/)?gemini/i.test(chatModel) && !/^openai\//i.test(chatModel)) {
      return local;
    }
  }

  const wantsGoogle = /^(google\/)?gemini/i.test(chatModel.trim()) || /^google\//i.test(chatModel.trim());
  if (wantsGoogle) {
    const g = googleChatModel(chatModel);
    if (g) return g;
  }

  if (process.env.AI_GATEWAY_API_KEY?.trim() && !/^ollama\//i.test(chatModel)) {
    return chatModel;
  }

  const g = googleChatModel(chatModel);
  if (g) return g;

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return openai(stripProviderPrefix(chatModel) || "gpt-4o");
  }

  const local = ollamaChatModel(chatModel);
  if (local) return local;

  return chatModel;
}

function resolveEmbeddingModel(modelId: string): EmbeddingModel | string {
  // Corpus vectors are 1536-d (text-embedding-3-small). Local Ollama dims usually differ — keep cloud/gateway.
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return modelId;
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return openai.embedding(stripProviderPrefix(modelId) || "text-embedding-3-small");
  }

  return modelId;
}

export type GroundedAnswer = {
  answer: string;
  insufficient: boolean;
  limitations: string;
  modelUsed: string | null;
  usedLlm: boolean;
};

export async function embedQuery(query: string): Promise<number[] | null> {
  const modelId = process.env.EMBEDDING_MODEL?.trim() || "openai/text-embedding-3-small";
  try {
    const { embedding } = await embed({ model: resolveEmbeddingModel(modelId), value: query });
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) return null;
    return embedding;
  } catch {
    return null;
  }
}

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

  const hasOllama = ollamaEnabled();
  const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
  const hasGoogle = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim(),
  );
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());

  // Prefer local Ollama for free verify when configured; else Google (also free-tier).
  const chatModel =
    process.env.ASK_MODEL?.trim() ||
    process.env.AI_GATEWAY_MODEL?.trim() ||
    (hasOllama ? `ollama/${process.env.OLLAMA_MODEL?.trim() || "llama3.2"}` : "") ||
    (hasGoogle ? "google/gemini-3.6-flash" : "") ||
    (hasGateway ? "openai/gpt-4o-mini" : "") ||
    (hasOpenAI ? "openai/gpt-4o" : "");

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
        "ASK_MODEL / AI Gateway not set. Showing retrieval-only response. Never invent rates, win rates, or causation.",
      modelUsed: null,
      usedLlm: false,
    };
  }

  const system = `You are a procurement intelligence analyst for a multi-tenant verified corpus.
Only use the provided evidence. Cite sources as [n].
If evidence is insufficient, reply exactly: ${INSUFFICIENT}
Never invent market share, win rates, prices, or causal claims.
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
    // Fallbacks: Ollama → Google → done
    if (!/^ollama\//i.test(chatModel)) {
      const local = ollamaChatModel(`ollama/${process.env.OLLAMA_MODEL?.trim() || "llama3.2"}`);
      if (local) {
        try {
          return await run(local, `ollama/${process.env.OLLAMA_MODEL?.trim() || "llama3.2"}`);
        } catch {
          /* continue */
        }
      }
    }
    if (!/gemini/i.test(chatModel)) {
      const fallback = googleChatModel("google/gemini-3.6-flash");
      if (fallback) {
        try {
          return await run(fallback, "google/gemini-3.6-flash");
        } catch {
          /* continue */
        }
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

export { INSUFFICIENT };
