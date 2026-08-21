import { tool } from "ai";
import { z } from "zod";
import {
  SOURCE_AUTHORITY,
  makeEvidenceId,
  mergeEvidenceBags,
  type NormalizedEvidence,
  validateCitations,
} from "@/lib/ask/evidence";
import { embedQuery } from "@/lib/ask/model";
import { fetchPublicSource, getPublicResearchProvider, toPublicEvidence } from "@/lib/ask/research/provider";
import { purposeRequiresDraftingGates, type RetrievalPurpose } from "@/lib/retrieval/purpose";
import { locateRecords, searchVerifiedKnowledge, type KnowledgeHit } from "@/lib/retrieval/search";
import { generateIntelligenceReport, type ReportKind } from "@/lib/reports/generate";
import { createClient } from "@/lib/supabase/server";

export type AskToolContext = {
  purpose: RetrievalPurpose;
  opportunityId: string | null;
  /** Mutable bag accumulated across tool calls in one turn. */
  evidenceBag: NormalizedEvidence[];
};

function fromKnowledgeHit(hit: KnowledgeHit): NormalizedEvidence {
  return {
    id: makeEvidenceId("chunk", hit.chunk_id),
    rail: "internal",
    evidence_class: "INTERNAL_VERIFIED",
    source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
    title: hit.storage_path || hit.field || "Verified passage",
    url: null,
    internal_ref: `/ingestion/verification/${hit.document_id}`,
    document_id: hit.document_id,
    chunk_id: hit.chunk_id,
    page: hit.source_page,
    excerpt: hit.content,
    published_date: null,
    retrieved_at: new Date().toISOString(),
    verification_status: "HUMAN_VERIFIED",
    entity: null,
    topic: hit.field,
  };
}

function pushEvidence(ctx: AskToolContext, items: NormalizedEvidence[]) {
  ctx.evidenceBag = mergeEvidenceBags(ctx.evidenceBag, items);
}

function lexicalScore(query: string, text: string): number {
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (!terms.length) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const t of terms) if (hay.includes(t)) hits += 1;
  return hits / terms.length;
}

export function createAskTools(ctx: AskToolContext) {
  return {
    search_verified_passages: tool({
      description:
        "INTERNAL rail: search HUMAN_VERIFIED L&P corpus (hybrid FTS/vector) under org RLS and purpose drafting gates. Returns up to 50 candidates.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ query, limit }) => {
        const embedding = await embedQuery(query);
        const { hits, error } = await searchVerifiedKnowledge({
          query,
          purpose: ctx.purpose,
          opportunityId: ctx.opportunityId,
          queryEmbedding: embedding,
          limit: limit ?? 50,
        });
        const evidence = hits.map(fromKnowledgeHit);
        pushEvidence(ctx, evidence);
        return { ok: !error, error, count: evidence.length, evidence };
      },
    }),

    rerank_passages: tool({
      description:
        "Rerank INTERNAL verified passages already retrieved (or provided ids) down to top ~12 using hybrid rank + lexical overlap. Does not invent content.",
      inputSchema: z.object({
        query: z.string().min(1),
        top_k: z.number().int().min(3).max(20).optional(),
      }),
      execute: async ({ query, top_k }) => {
        const internal = ctx.evidenceBag.filter((e) => e.rail === "internal");
        const scored = internal
          .map((e) => ({
            e,
            score: (e.source_authority / 100) * 0.4 + lexicalScore(query, e.excerpt) * 0.6,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, top_k ?? 12)
          .map((s) => s.e);
        return { count: scored.length, evidence: scored };
      },
    }),

    locate_records: tool({
      description: "INTERNAL rail: structured LOCATE across opportunities, buyers, contracts, documents, competitors (SQL ILIKE). No LLM.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const records = await locateRecords(query);
        const evidence: NormalizedEvidence[] = records.map((r) => ({
          id: makeEvidenceId("locate", `${r.kind}:${r.id}`),
          rail: "internal",
          evidence_class: "INTERNAL_VERIFIED",
          source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
          title: r.title,
          url: null,
          internal_ref: r.href,
          document_id: r.kind === "document" ? r.id : null,
          chunk_id: null,
          page: null,
          excerpt: r.detail || r.title,
          published_date: null,
          retrieved_at: new Date().toISOString(),
          verification_status: "STRUCTURED_RECORD",
          entity: r.kind,
          topic: null,
        }));
        pushEvidence(ctx, evidence);
        return { count: records.length, records, evidence };
      },
    }),

    lookup_pricing_truth: tool({
      description:
        "INTERNAL rail: read pricing_lines with four-truth columns separate (proposed/awarded/current). Never invent or average rates.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(40).optional(),
        query: z.string().optional(),
      }),
      execute: async ({ limit, query }) => {
        const supabase = await createClient();
        let q = supabase
          .from("pricing_lines")
          .select(
            "id, labor_category, rate_type, site_or_post, proposed_rate, awarded_rate, current_rate, requested_rate, unit, opportunity_id, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(limit ?? 20);
        if (query?.trim()) q = q.ilike("labor_category", `%${query.trim().replace(/[%_]/g, "")}%`);
        const { data, error } = await q;
        const evidence: NormalizedEvidence[] = (data ?? []).map((row) => ({
          id: makeEvidenceId("price", row.id),
          rail: "internal",
          evidence_class: "INTERNAL_VERIFIED",
          source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
          title: row.labor_category || "Pricing line",
          url: null,
          internal_ref: row.opportunity_id
            ? `/procurement/opportunities/${row.opportunity_id}`
            : null,
          document_id: null,
          chunk_id: null,
          page: null,
          excerpt: `requested=${row.requested_rate ?? "—"} proposed=${row.proposed_rate ?? "—"} awarded=${row.awarded_rate ?? "—"} current=${row.current_rate ?? "—"} unit=${row.unit ?? "—"} site=${row.site_or_post ?? "—"} type=${row.rate_type}`,
          published_date: null,
          retrieved_at: new Date().toISOString(),
          verification_status: "HUMAN_VERIFIED",
          entity: null,
          topic: "pricing",
        }));
        pushEvidence(ctx, evidence);
        return { ok: !error, error: error?.message ?? null, count: evidence.length, evidence };
      },
    }),

    lookup_contracts: tool({
      description: "INTERNAL rail: list contracts (title/number) under org RLS.",
      inputSchema: z.object({
        query: z.string().optional(),
        limit: z.number().int().min(1).max(40).optional(),
      }),
      execute: async ({ query, limit }) => {
        const supabase = await createClient();
        let q = supabase
          .from("contracts")
          .select("id, title, contract_number, start_on, verified_end_on, source_document_id, client_id")
          .order("updated_at", { ascending: false })
          .limit(limit ?? 20);
        if (query?.trim()) {
          const p = `%${query.trim().replace(/[%_]/g, "")}%`;
          q = q.or(`title.ilike.${p},contract_number.ilike.${p}`);
        }
        const { data, error } = await q;
        const evidence: NormalizedEvidence[] = (data ?? []).map((row) => ({
          id: makeEvidenceId("contract", row.id),
          rail: "internal",
          evidence_class: "INTERNAL_VERIFIED",
          source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
          title: row.title || row.contract_number || row.id,
          url: null,
          internal_ref: `/contracts`,
          document_id: row.source_document_id,
          chunk_id: null,
          page: null,
          excerpt: `number=${row.contract_number ?? "—"} ${row.start_on ?? ""}–${row.verified_end_on ?? ""}`,
          published_date: null,
          retrieved_at: new Date().toISOString(),
          verification_status: "STRUCTURED_RECORD",
          entity: null,
          topic: "contract",
        }));
        pushEvidence(ctx, evidence);
        return { ok: !error, error: error?.message ?? null, count: evidence.length, evidence };
      },
    }),

    get_win_loss_history: tool({
      description: "INTERNAL rail: observed win/loss outcomes from awards / packages where available.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(40).optional() }),
      execute: async ({ limit }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("awards")
          .select("id, notice, winner_name, amount_nte, awarded_on, rank, source_document_id, opportunity_id")
          .order("awarded_on", { ascending: false })
          .limit(limit ?? 20);
        const evidence: NormalizedEvidence[] = (data ?? []).map((row) => ({
          id: makeEvidenceId("award", row.id),
          rail: "internal",
          evidence_class: "INTERNAL_VERIFIED",
          source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
          title: row.notice || row.winner_name || "Award",
          url: null,
          internal_ref: row.source_document_id
            ? `/ingestion/verification/${row.source_document_id}`
            : row.opportunity_id
              ? `/procurement/opportunities/${row.opportunity_id}`
              : null,
          document_id: row.source_document_id,
          chunk_id: null,
          page: null,
          excerpt: `winner=${row.winner_name ?? "—"} amount_nte=${row.amount_nte ?? "—"} rank=${row.rank ?? "—"} awarded_on=${row.awarded_on ?? "—"}`,
          published_date: row.awarded_on,
          retrieved_at: new Date().toISOString(),
          verification_status: "STRUCTURED_RECORD",
          entity: row.winner_name,
          topic: "win_loss",
        }));
        pushEvidence(ctx, evidence);
        return { ok: !error, error: error?.message ?? null, count: evidence.length, evidence };
      },
    }),

    run_intelligence_report: tool({
      description: "INTERNAL rail: run an evidence-backed SQL intelligence report (not free-form LLM).",
      inputSchema: z.object({
        kind: z.enum([
          "bid_strategy",
          "buyer",
          "market",
          "competitor",
          "pricing",
          "win_loss",
          "proposal_improvement",
          "executive",
        ]),
        query: z.string().optional(),
      }),
      execute: async ({ kind, query }) => {
        const report = await generateIntelligenceReport(kind as ReportKind, {
          opportunityId: ctx.opportunityId,
          query,
        });
        const evidence = (report.evidenceHits ?? []).map(fromKnowledgeHit);
        pushEvidence(ctx, evidence);
        return {
          title: report.title,
          answer: report.answer,
          sections: report.sections,
          insufficient: report.insufficient,
          limitations: report.limitations,
          evidence,
        };
      },
    }),

    search_public_research: tool({
      description:
        "PUBLIC rail (Morphic-style): web/procurement search. Results are OFFICIAL_PUBLIC or EXTERNAL_RESEARCH — never HUMAN_VERIFIED and never written to the verified corpus. Requires TAVILY_API_KEY or BRAVE_SEARCH_API_KEY.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async ({ query, limit }) => {
        if (purposeRequiresDraftingGates(ctx.purpose) && ctx.purpose === "PROPOSAL_DRAFTING") {
          // Still allow search for context, but flag for the model.
        }
        const provider = getPublicResearchProvider();
        if (!provider) {
          return {
            ok: false,
            configured: false,
            message:
              "Public research not configured. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY. Do not invent public facts.",
            evidence: [] as NormalizedEvidence[],
          };
        }
        const hits = await provider.search(query, limit ?? 8);
        const evidence = hits.map((h) => toPublicEvidence(h, query));
        pushEvidence(ctx, evidence);
        return { ok: true, configured: true, provider: provider.id, count: evidence.length, evidence };
      },
    }),

    fetch_public_source: tool({
      description: "PUBLIC rail: fetch a URL and extract a text excerpt for citation. Cite-only; never promote.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => {
        const evidence = await fetchPublicSource(url);
        pushEvidence(ctx, [evidence]);
        return { evidence };
      },
    }),

    validate_answer_citations: tool({
      description:
        "Validate that [n] citations in a draft answer map to the evidence bag. Flags drafting misuse of public/unverified sources.",
      inputSchema: z.object({ answer: z.string().min(1) }),
      execute: async ({ answer }) => {
        const result = validateCitations(answer, ctx.evidenceBag, {
          draftingPurpose: ctx.purpose === "PROPOSAL_DRAFTING",
        });
        return { ...result, evidence_count: ctx.evidenceBag.length };
      },
    }),
  };
}

export type AskTools = ReturnType<typeof createAskTools>;
