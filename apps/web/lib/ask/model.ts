import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embed, type EmbeddingModel, type LanguageModel } from "ai";

const EMBEDDING_DIM = 1536;

/**
 * Swappable AI provider layer (no Grok).
 * Preference: ASK_MODEL explicit → Gateway → Groq → Ollama → Google (public-ok) → OpenAI optional.
 */
export function stripProviderPrefix(modelId: string): string {
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

export function ollamaEnabled(): boolean {
  const flag = process.env.OLLAMA_ENABLED?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;
  if (process.env.OLLAMA_MODEL?.trim()) return true;
  if (/^ollama\//i.test(process.env.ASK_MODEL?.trim() || "")) return true;
  return false;
}

export function selectAskModelId(): string {
  const explicit = process.env.ASK_MODEL?.trim() || process.env.AI_GATEWAY_MODEL?.trim();
  if (explicit) return explicit;
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return "openai/gpt-4o-mini";
  if (process.env.GROQ_API_KEY?.trim()) return "groq/llama-3.3-70b-versatile";
  if (ollamaEnabled()) return `ollama/${process.env.OLLAMA_MODEL?.trim() || "llama3.2"}`;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) {
    return "google/gemini-3.6-flash";
  }
  if (process.env.OPENAI_API_KEY?.trim()) return "openai/gpt-4o";
  return "";
}

export function resolveChatModel(chatModel: string): LanguageModel | string {
  const id = chatModel.trim();
  if (!id) return id;

  if (/^ollama\//i.test(id) || (ollamaEnabled() && !id.includes("/"))) {
    const name = stripProviderPrefix(id) || process.env.OLLAMA_MODEL?.trim() || "llama3.2";
    const ollama = createOpenAICompatible({ name: "ollama", baseURL: ollamaBaseUrl() });
    return ollama.chatModel(name === "ollama" ? process.env.OLLAMA_MODEL?.trim() || "llama3.2" : name);
  }

  if (/^groq\//i.test(id) && process.env.GROQ_API_KEY?.trim()) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY.trim() });
    return groq(stripProviderPrefix(id));
  }

  if (/^(google\/)?gemini/i.test(id) || /^google\//i.test(id)) {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    if (key) {
      const google = createGoogleGenerativeAI({ apiKey: key });
      const mid = stripProviderPrefix(id);
      return google(mid.startsWith("gemini") ? mid : "gemini-3.6-flash");
    }
  }

  if (process.env.AI_GATEWAY_API_KEY?.trim() && /^(openai|anthropic|google)\//i.test(id)) {
    return id;
  }

  if (/^openai\//i.test(id) && process.env.OPENAI_API_KEY?.trim()) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });
    return openai(stripProviderPrefix(id) || "gpt-4o");
  }

  if (process.env.AI_GATEWAY_API_KEY?.trim()) return id;

  if (process.env.GROQ_API_KEY?.trim()) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY.trim() });
    return groq("llama-3.3-70b-versatile");
  }

  if (ollamaEnabled()) {
    const ollama = createOpenAICompatible({ name: "ollama", baseURL: ollamaBaseUrl() });
    return ollama.chatModel(process.env.OLLAMA_MODEL?.trim() || "llama3.2");
  }

  const gKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (gKey) {
    return createGoogleGenerativeAI({ apiKey: gKey })("gemini-3.6-flash");
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() })("gpt-4o");
  }

  return id;
}

function resolveEmbeddingModel(modelId: string): EmbeddingModel | string {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return modelId;
  if (process.env.OPENAI_API_KEY?.trim()) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });
    return openai.embedding(stripProviderPrefix(modelId) || "text-embedding-3-small");
  }
  return modelId;
}

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

export { EMBEDDING_DIM };
