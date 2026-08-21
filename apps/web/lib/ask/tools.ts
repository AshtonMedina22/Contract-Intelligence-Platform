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
import {
  createUsaSpendingProvider,
  federalAwardToEvidence,
  reconcileFederalRecipient,
  type FederalAwardQuery,
} from "@/lib/ask/research/usaspending";
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

    search_federal_awards: tool({
      description:
        "PUBLIC rail: search USAspending.gov federal awards (agency, recipient, NAICS, PSC, dates, amount, award type). Results are OFFICIAL_PUBLIC / PUBLIC_UNVERIFIED — never HUMAN_VERIFIED, never market share, never mixed into L&P proposed/awarded/current pricing_lines, and never written to canonical awards. Does not auto-persist.",
      inputSchema: z.object({
        keywords: z.string().optional(),
        agency: z.string().optional(),
        recipient: z.string().optional(),
        recipient_uei: z.string().optional(),
        naics: z.string().optional(),
        psc: z.string().optional(),
        award_id: z.string().optional(),
        award_type_codes: z.array(z.string()).optional(),
        amount_lower: z.number().optional(),
        amount_upper: z.number().optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        place_of_performance_state: z.string().optional(),
        place_of_performance_city: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        page: z.number().int().min(1).max(100).optional(),
      }),
      execute: async (input) => {
        const provider = createUsaSpendingProvider();
        const query: FederalAwardQuery = {
          keywords: input.keywords,
          agency: input.agency,
          recipient: input.recipient,
          recipientUei: input.recipient_uei,
          naics: input.naics,
          psc: input.psc,
          awardId: input.award_id,
          awardTypeCodes: input.award_type_codes,
          amountLower: input.amount_lower,
          amountUpper: input.amount_upper,
          dateFrom: input.date_from,
          dateTo: input.date_to,
          placeOfPerformanceState: input.place_of_performance_state,
          placeOfPerformanceCity: input.place_of_performance_city,
          limit: input.limit ?? 10,
          page: input.page ?? 1,
        };
        const result = await provider.searchAwards(query);
        if (!result.ok) {
          return {
            ok: false,
            mode: result.mode,
            fixture: result.fixture,
            error: result.error,
            message:
              result.error ??
              "USAspending search failed. Do not invent federal award amounts or market share.",
            count: 0,
            awards: [],
            evidence: [] as NormalizedEvidence[],
            honesty:
              "Federal award observations are public research only — not L&P four-truth pricing and not canonical awards.",
          };
        }
        const evidence = result.results.map(federalAwardToEvidence);
        pushEvidence(ctx, evidence);
        return {
          ok: true,
          mode: result.mode,
          fixture: result.fixture,
          error: null,
          page: result.page,
          hasNext: result.hasNext,
          count: result.results.length,
          awards: result.results.map((a) => ({
            award_id: a.award_id,
            piid: a.piid,
            recipient_name: a.recipient_name,
            recipient_uei: a.recipient_uei,
            agency: a.agency,
            amount: a.amount,
            start_date: a.start_date,
            end_date: a.end_date,
            award_date: a.award_date,
            naics: a.naics,
            psc: a.psc,
            place_of_performance: a.place_of_performance,
            award_type: a.award_type,
            source_url: a.source_url,
            retrieved_at: a.retrieved_at,
            provider: a.provider,
          })),
          evidence,
          honesty:
            "OFFICIAL_PUBLIC / PUBLIC_UNVERIFIED from USAspending. Never treat amounts as L&P proposed/awarded/current rates. Never invent market share.",
        };
      },
    }),

    get_federal_award: tool({
      description:
        "PUBLIC rail: fetch one USAspending.gov award by Award ID / generated unique id. Cite-only; never promote to HUMAN_VERIFIED or canonical awards.",
      inputSchema: z.object({
        award_id: z.string().min(1),
      }),
      execute: async ({ award_id }) => {
        const provider = createUsaSpendingProvider();
        const award = await provider.getAward(award_id);
        if (!award) {
          return {
            ok: false,
            error: `No USAspending award found for id=${award_id}. Do not invent the award.`,
            award: null,
            evidence: [] as NormalizedEvidence[],
            recipient_match: null,
          };
        }
        const evidence = federalAwardToEvidence(award);
        pushEvidence(ctx, [evidence]);

        // Soft identity check against org clients/competitors — never invent a link.
        let recipient_match: {
          client: ReturnType<typeof reconcileFederalRecipient>["client"];
          competitor: ReturnType<typeof reconcileFederalRecipient>["competitor"];
        } | null = null;
        try {
          const supabase = await createClient();
          const [clientsRes, competitorsRes] = await Promise.all([
            supabase.from("clients").select("id, name").limit(500),
            supabase.from("competitors").select("id, name").limit(500),
          ]);
          const reconciled = reconcileFederalRecipient(award, {
            clients: clientsRes.data ?? [],
            competitors: competitorsRes.data ?? [],
          });
          recipient_match = {
            client: reconciled.client,
            competitor: reconciled.competitor,
          };
        } catch {
          recipient_match = {
            client: { match: null, ambiguity: false, candidates: [] },
            competitor: { match: null, ambiguity: false, candidates: [] },
          };
        }

        return {
          ok: true,
          award: {
            award_id: award.award_id,
            external_id: award.external_id,
            piid: award.piid,
            recipient_name: award.recipient_name,
            recipient_uei: award.recipient_uei,
            agency: award.agency,
            amount: award.amount,
            start_date: award.start_date,
            end_date: award.end_date,
            award_date: award.award_date,
            naics: award.naics,
            psc: award.psc,
            description: award.description,
            place_of_performance: award.place_of_performance,
            award_type: award.award_type,
            source_url: award.source_url,
            retrieved_at: award.retrieved_at,
            provider: award.provider,
          },
          evidence: [evidence],
          recipient_match,
          honesty:
            "Public federal award observation. Ambiguous recipient matches are returned as candidates — never auto-linked. Not L&P pricing truth.",
        };
      },
    }),

    lookup_federal_recipient: tool({
      description:
        "PUBLIC rail: search USAspending awards by recipient name (optional soft-match to existing competitors/clients by exact normalized name or UEI — never invents CRM buyers).",
      inputSchema: z.object({
        recipient: z.string().min(1),
        limit: z.number().int().min(1).max(25).optional(),
        page: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ recipient, limit, page }) => {
        const provider = createUsaSpendingProvider();
        const result = await provider.searchByRecipient(recipient, { limit: limit ?? 10, page: page ?? 1 });
        if (!result.ok) {
          return {
            ok: false,
            error: result.error,
            count: 0,
            awards: [],
            evidence: [] as NormalizedEvidence[],
            recipient_match: { match: null, ambiguity: false, candidates: [] },
          };
        }
        const evidence = result.results.map(federalAwardToEvidence);
        pushEvidence(ctx, evidence);

        let recipient_match: {
          match: { id: string; name: string } | null;
          ambiguity: boolean;
          candidates: Array<{
            status: "queued_identity";
            suggested_name: string;
            uei: string | null;
            party_id?: string;
            reason: string;
          }>;
        } = { match: null, ambiguity: false, candidates: [] };
        try {
          const supabase = await createClient();
          const [clientsRes, competitorsRes] = await Promise.all([
            supabase.from("clients").select("id, name").limit(500),
            supabase.from("competitors").select("id, name").limit(500),
          ]);
          const sample = result.results[0];
          if (sample) {
            const reconciled = reconcileFederalRecipient(sample, {
              clients: clientsRes.data ?? [],
              competitors: competitorsRes.data ?? [],
            });
            const pick = reconciled.competitor.match
              ? reconciled.competitor
              : reconciled.client.match
                ? reconciled.client
                : reconciled.competitor.ambiguity
                  ? reconciled.competitor
                  : reconciled.client;
            recipient_match = {
              match: pick.match ? { id: pick.match.id, name: pick.match.name } : null,
              ambiguity: pick.ambiguity,
              candidates: pick.candidates,
            };
          }
        } catch {
          recipient_match = { match: null, ambiguity: false, candidates: [] };
        }

        return {
          ok: true,
          fixture: result.fixture,
          count: result.results.length,
          page: result.page,
          hasNext: result.hasNext,
          awards: result.results.map((a) => ({
            award_id: a.award_id,
            recipient_name: a.recipient_name,
            recipient_uei: a.recipient_uei,
            agency: a.agency,
            amount: a.amount,
            source_url: a.source_url,
            retrieved_at: a.retrieved_at,
            provider: a.provider,
          })),
          evidence,
          recipient_match,
          honesty:
            "Recipient observations from USAspending. Exact name/UEI match only — ambiguous → candidates, never invent clients/competitors.",
        };
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
