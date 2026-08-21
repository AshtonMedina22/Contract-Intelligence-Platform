import { createHash } from "node:crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany, type EmbeddingModel } from "ai";

export const EMBEDDING_DIM = 1536 as const;
export const EMBEDDING_VERSION = "1";
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

export type EmbeddingCompatibility = {
  model: string | null | undefined;
  dim: number | null | undefined;
};

export type EmbeddingProvider = {
  provider: "ai-gateway" | "openai";
  modelId: string;
  dim: typeof EMBEDDING_DIM;
  version: string;
  compatibilityId: string;
  configured: boolean;
  embedTexts: (texts: readonly string[]) => Promise<number[][] | null>;
  embedQuery: (query: string) => Promise<number[] | null>;
  contentHash: (content: string) => string;
  assertCompatible: (actual: EmbeddingCompatibility) => void;
};

function stripProviderPrefix(modelId: string): string {
  const slash = modelId.indexOf("/");
  return slash >= 0 ? modelId.slice(slash + 1) : modelId;
}

function configuredModelId(): string {
  return process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

function configuredVersion(): string {
  return process.env.EMBEDDING_VERSION?.trim() || EMBEDDING_VERSION;
}

function gatewayConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL?.trim(),
  );
}

function providerName(): EmbeddingProvider["provider"] {
  return gatewayConfigured() ? "ai-gateway" : "openai";
}

function resolveEmbeddingModel(modelId: string): EmbeddingModel | string | null {
  if (gatewayConfigured()) return modelId;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !/^openai\//i.test(modelId)) return null;
  return createOpenAI({ apiKey }).embeddingModel(
    stripProviderPrefix(modelId) || "text-embedding-3-small",
  );
}

export function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function embeddingCompatibilityId(
  modelId = configuredModelId(),
  version = configuredVersion(),
): string {
  return `${modelId}@${version}`;
}

export function assertCompatible(actual: EmbeddingCompatibility): void {
  const expectedModel = embeddingCompatibilityId();
  if (actual.model !== expectedModel || actual.dim !== EMBEDDING_DIM) {
    throw new Error(
      `Incompatible embedding metadata: expected ${expectedModel}/${EMBEDDING_DIM}, received ${actual.model ?? "null"}/${actual.dim ?? "null"}.`,
    );
  }
}

function validEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === EMBEDDING_DIM &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

export async function embedTexts(texts: readonly string[]): Promise<number[][] | null> {
  const values = texts.map((text) => text.trim());
  if (values.length === 0) return [];
  if (values.some((text) => !text)) return null;

  const model = resolveEmbeddingModel(configuredModelId());
  if (!model) return null;

  try {
    const { embeddings } = await embedMany({
      model,
      values,
      maxParallelCalls: 2,
    });
    return embeddings.length === values.length && embeddings.every(validEmbedding)
      ? embeddings
      : null;
  } catch {
    return null;
  }
}

export async function embedQuery(query: string): Promise<number[] | null> {
  const value = query.trim();
  if (!value) return null;
  const model = resolveEmbeddingModel(configuredModelId());
  if (!model) return null;

  try {
    const result = await embed({ model, value });
    return validEmbedding(result.embedding) ? result.embedding : null;
  } catch {
    return null;
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const modelId = configuredModelId();
  const version = configuredVersion();
  return {
    provider: providerName(),
    modelId,
    dim: EMBEDDING_DIM,
    version,
    compatibilityId: embeddingCompatibilityId(modelId, version),
    configured: Boolean(resolveEmbeddingModel(modelId)),
    embedTexts,
    embedQuery,
    contentHash,
    assertCompatible,
  };
}
