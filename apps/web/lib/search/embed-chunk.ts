import { embed } from "ai";
import { createClient } from "@/lib/supabase/server";

const EMBEDDING_DIM = 1536;

export async function embedVerifiedChunk(sourceFactId: string): Promise<void> {
  const model = process.env.EMBEDDING_MODEL?.trim() || "openai/text-embedding-3-small";
  const supabase = await createClient();
  const { data: chunk, error } = await supabase
    .from("document_chunks")
    .select("id, content")
    .eq("source_fact_id", sourceFactId)
    .maybeSingle();
  if (error || !chunk) return;

  const { embedding } = await embed({
    model,
    value: chunk.content,
  });
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) return;

  const vectorLiteral = `[${embedding.join(",")}]`;
  await supabase.from("document_chunks").update({ embedding: vectorLiteral }).eq("id", chunk.id);
}
