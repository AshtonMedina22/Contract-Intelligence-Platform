import { embed, generateText } from "ai";
import type { KnowledgeHit } from "@/lib/retrieval/search";
import type { RetrievalPurpose } from "@/lib/retrieval/purpose";

const EMBEDDING_DIM = 1536;
const INSUFFICIENT = "Insufficient verified evidence to answer this reliably.";

export type GroundedAnswer = {
  answer: string;
  insufficient: boolean;
  limitations: string;
  modelUsed: string | null;
  usedLlm: boolean;
};

export async function embedQuery(query: string): Promise<number[] | null> {
  const model = process.env.EMBEDDING_MODEL?.trim() || "openai/text-embedding-3-small";
  try {
    const { embedding } = await embed({ model, value: query });
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

  const chatModel = process.env.ASK_MODEL?.trim() || process.env.AI_GATEWAY_MODEL?.trim() || "";
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

  try {
    const { text } = await generateText({
      model: chatModel,
      system: `You are a procurement intelligence analyst for a multi-tenant verified corpus.
Only use the provided evidence. Cite sources as [n].
If evidence is insufficient, reply exactly: ${INSUFFICIENT}
Never invent market share, win rates, prices, or causal claims.
Purpose: ${opts.purpose}. Data scope: ${opts.dataScope}.
DO_NOT_USE chunks are retrospective only — never recommend them for new proposal drafting.`,
      prompt: `Question: ${opts.query}\n\nEvidence:\n${evidence}`,
    });
    const answer = text.trim() || INSUFFICIENT;
    const insufficient = answer.includes(INSUFFICIENT) && answer.length < INSUFFICIENT.length + 40;
    return {
      answer,
      insufficient,
      limitations: insufficient
        ? "Model reported insufficient verified evidence."
        : "Grounded on retrieved HUMAN_VERIFIED chunks only. Human judgment still required for pricing and submission.",
      modelUsed: chatModel,
      usedLlm: true,
    };
  } catch (e) {
    return {
      answer: `Verified evidence retrieved (${opts.hits.length} passage(s)), but synthesis failed. Review Sources. ${e instanceof Error ? e.message : ""}`,
      insufficient: false,
      limitations: "LLM synthesis unavailable; retrieval results remain trustworthy when cited.",
      modelUsed: chatModel,
      usedLlm: false,
    };
  }
}

export { INSUFFICIENT };
