import { createClient } from "@/lib/supabase/server";
import type { RetrievalPurpose } from "@/lib/retrieval/purpose";
import { purposeRequiresDraftingGates } from "@/lib/retrieval/purpose";
import type { DataClassification, ReuseStatus } from "@/lib/supabase/database.types";
import {
  EMBEDDING_DIM,
  embedQuery,
  getEmbeddingProvider,
} from "@/lib/retrieval/embed";

export type KnowledgeHit = {
  chunk_id: string;
  document_id: string;
  source_fact_id: string | null;
  storage_path: string;
  source_page: number | null;
  field: string | null;
  content: string;
  reuse_status: ReuseStatus;
  data_classification: DataClassification;
  rank: number;
  match_kind: string;
};

export type LocateRecord = {
  kind: "opportunity" | "buyer" | "contract" | "document" | "competitor";
  id: string;
  title: string;
  href: string;
  detail: string | null;
};

export async function searchVerifiedKnowledge(opts: {
  query: string;
  purpose: RetrievalPurpose;
  opportunityId?: string | null;
  limit?: number;
  queryEmbedding?: number[] | null;
}): Promise<{ hits: KnowledgeHit[]; error: string | null }> {
  const supabase = await createClient();
  const queryEmbedding =
    opts.queryEmbedding === undefined ? await embedQuery(opts.query) : opts.queryEmbedding;
  const provider = getEmbeddingProvider();
  const vectorLiteral =
    queryEmbedding && queryEmbedding.length === EMBEDDING_DIM
      ? `[${queryEmbedding.join(",")}]`
      : null;

  const { data, error } = await supabase.rpc("search_verified_knowledge", {
    p_query: opts.query,
    p_query_embedding: vectorLiteral,
    p_embedding_model: vectorLiteral ? provider.compatibilityId : null,
    p_embedding_dim: vectorLiteral ? EMBEDDING_DIM : null,
    p_for_drafting: purposeRequiresDraftingGates(opts.purpose),
    p_limit: opts.limit ?? 20,
    p_opportunity_id: opts.opportunityId || null,
    p_purpose: opts.purpose,
  });

  if (error) return { hits: [], error: error.message };
  return {
    hits: (data ?? []).map((hit) => ({
      chunk_id: hit.chunk_id,
      document_id: hit.document_id,
      source_fact_id: hit.source_fact_id,
      storage_path: hit.storage_path,
      source_page: hit.source_page,
      field: hit.field,
      content: hit.content,
      reuse_status: hit.reuse_status,
      data_classification: hit.data_classification,
      rank: hit.rank,
      match_kind: hit.match_kind,
    })),
    error: null,
  };
}

/** LOCATE — structured SQL + FTS. No LLM. */
export async function locateRecords(query: string, limit = 12): Promise<LocateRecord[]> {
  const q = query.trim();
  if (!q) return [];
  const supabase = await createClient();
  const pattern = `%${q.replace(/[%_]/g, "")}%`;
  const results: LocateRecord[] = [];

  const [opps, buyers, contractsByTitle, contractsByNumber, docs, competitors] = await Promise.all([
    supabase.from("opportunities").select("id, title, stage").ilike("title", pattern).limit(limit),
    supabase.from("clients").select("id, name").ilike("name", pattern).limit(limit),
    supabase.from("contracts").select("id, title, contract_number").ilike("title", pattern).limit(limit),
    supabase
      .from("contracts")
      .select("id, title, contract_number")
      .ilike("contract_number", pattern)
      .limit(limit),
    supabase
      .from("documents")
      .select("id, original_filename, opportunity_id")
      .ilike("original_filename", pattern)
      .limit(limit),
    supabase.from("competitors").select("id, name").ilike("name", pattern).limit(limit),
  ]);

  for (const row of opps.data ?? []) {
    results.push({
      kind: "opportunity",
      id: row.id,
      title: row.title,
      href: `/procurement/opportunities/${row.id}`,
      detail: row.stage,
    });
  }
  for (const row of buyers.data ?? []) {
    results.push({
      kind: "buyer",
      id: row.id,
      title: row.name,
      href: `/procurement/clients`,
      detail: "Buyer / agency",
    });
  }
  const contractSeen = new Set<string>();
  for (const row of [...(contractsByTitle.data ?? []), ...(contractsByNumber.data ?? [])]) {
    if (contractSeen.has(row.id)) continue;
    contractSeen.add(row.id);
    results.push({
      kind: "contract",
      id: row.id,
      title: row.title,
      href: `/contracts/${row.id}`,
      detail: row.contract_number,
    });
  }
  for (const row of docs.data ?? []) {
    results.push({
      kind: "document",
      id: row.id,
      title: row.original_filename,
      href: `/ingestion/verification/${row.id}`,
      detail: row.opportunity_id ? `opportunity ${row.opportunity_id.slice(0, 8)}` : null,
    });
  }
  for (const row of competitors.data ?? []) {
    results.push({
      kind: "competitor",
      id: row.id,
      title: row.name,
      href: `/intelligence/competitors`,
      detail: "Competitor",
    });
  }

  return results.slice(0, limit);
}
