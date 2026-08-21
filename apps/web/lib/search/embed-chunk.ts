import { createClient } from "@/lib/supabase/server";
import {
  EMBEDDING_DIM,
  contentHash,
  embedTexts,
  getEmbeddingProvider,
} from "@/lib/retrieval/embed";

export {
  EMBEDDING_DIM,
  assertCompatible,
  contentHash,
  embedQuery,
  embedTexts,
  getEmbeddingProvider,
} from "@/lib/retrieval/embed";

export async function embedVerifiedChunk(sourceFactId: string): Promise<void> {
  const supabase = await createClient();
  const { data: chunk, error } = await supabase
    .from("document_chunks")
    .select(
      "id, content, verification_status, reuse_status, is_current_version, data_classification, embedding, embedding_model, embedding_dim, embedding_content_hash",
    )
    .eq("source_fact_id", sourceFactId)
    .maybeSingle();
  if (error || !chunk) return;

  if (
    chunk.verification_status !== "HUMAN_VERIFIED" ||
    !["APPROVED", "REVIEW_REQUIRED"].includes(chunk.reuse_status) ||
    !chunk.is_current_version ||
    !["verified_public", "verified_internal"].includes(chunk.data_classification)
  ) {
    return;
  }

  const provider = getEmbeddingProvider();
  const hash = contentHash(chunk.content);
  if (
    chunk.embedding &&
    chunk.embedding_model === provider.compatibilityId &&
    chunk.embedding_dim === EMBEDDING_DIM &&
    chunk.embedding_content_hash === hash
  ) {
    return;
  }

  const embeddings = await embedTexts([chunk.content]);
  const embedding = embeddings?.[0];
  if (!embedding) return;

  const vectorLiteral = `[${embedding.join(",")}]`;
  await supabase
    .from("document_chunks")
    .update({
      embedding: vectorLiteral,
      embedding_model: provider.compatibilityId,
      embedding_dim: EMBEDDING_DIM,
      embedding_content_hash: hash,
      embedding_generated_at: new Date().toISOString(),
    })
    .eq("id", chunk.id)
    .eq("content", chunk.content)
    .eq("verification_status", "HUMAN_VERIFIED")
    .in("reuse_status", ["APPROVED", "REVIEW_REQUIRED"])
    .eq("is_current_version", true)
    .in("data_classification", ["verified_public", "verified_internal"]);
}
