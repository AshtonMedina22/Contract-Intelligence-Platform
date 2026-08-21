import { tool } from "ai";
import { z } from "zod";
import { runStructuredAnalytics } from "@/lib/analytics/execute";
import { listMetricIds } from "@/lib/analytics/semantic-model";
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
import {
  collectSourceFactIds,
  filterRowsBySourceClassification,
  loadDocumentClassifications,
  loadSourceFactClassifications,
} from "@/lib/classification/source-filter";
import { isClassificationEligible } from "@/lib/classification/eligibility";

export type AskToolContext = {
  purpose: RetrievalPurpose;
  opportunityId: string | null;
  /** Mutable bag accumulated across tool calls in one turn. */
  evidenceBag: NormalizedEvidence[];
};

function fromKnowledgeHit(hit: KnowledgeHit): NormalizedEvidence {
  const isPublic = hit.data_classification === "verified_public";
  return {
    id: makeEvidenceId("chunk", hit.chunk_id),
    rail: "internal",
    evidence_class: isPublic ? "OFFICIAL_PUBLIC" : "INTERNAL_VERIFIED",
    source_authority: isPublic
      ? SOURCE_AUTHORITY.OFFICIAL_PUBLIC
      : SOURCE_AUTHORITY.INTERNAL_VERIFIED,
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
    data_classification: hit.data_classification,
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
        "CLASSIFIED corpus rail: search HUMAN_VERIFIED passages under org RLS, classification eligibility, and purpose drafting gates. verified_public stays public intelligence and is never stamped as L&P internal history. illustrative_demo is default-denied. Returns cited passages only (never full prior proposals).",
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
        "CLASSIFIED rail: read pricing_lines with four-truth columns separate (proposed/awarded/current). Every populated source must be purpose-eligible; never invent or average rates.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(40).optional(),
        query: z.string().optional(),
      }),
      execute: async ({ limit, query }) => {
        const supabase = await createClient();
        let q = supabase
          .from("pricing_lines")
          .select(
            "id, labor_category, rate_type, site_or_post, proposed_rate, awarded_rate, current_rate, requested_rate, unit, opportunity_id, created_at, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id",
          )
          .order("created_at", { ascending: false })
          .limit(limit ?? 20);
        if (query?.trim()) q = q.ilike("labor_category", `%${query.trim().replace(/[%_]/g, "")}%`);
        const { data, error } = await q;
        const sourceFields = [
          "requested_source_fact_id",
          "proposed_source_fact_id",
          "awarded_source_fact_id",
          "current_source_fact_id",
        ] as const;
        const factIds = collectSourceFactIds(
          (data ?? []) as unknown as Record<string, unknown>[],
          sourceFields,
        );
        const classifications = await loadSourceFactClassifications(supabase, factIds);
        const eligibleRows = filterRowsBySourceClassification(
          (data ?? []) as unknown as Record<string, unknown>[],
          { fields: sourceFields, classifications, purpose: ctx.purpose },
        ) as unknown as NonNullable<typeof data>;
        const evidence: NormalizedEvidence[] = eligibleRows.map((row) => {
          const classification = sourceFields
            .map((field) => row[field])
            .filter((id): id is string => typeof id === "string")
            .map((id) => classifications.get(id))
            .find((value) => value && isClassificationEligible(value, ctx.purpose));
          return {
          id: makeEvidenceId("price", row.id),
          rail: "internal",
          evidence_class:
            classification === "verified_public" ? "OFFICIAL_PUBLIC" : "INTERNAL_VERIFIED",
          source_authority:
            classification === "verified_public"
              ? SOURCE_AUTHORITY.OFFICIAL_PUBLIC
              : SOURCE_AUTHORITY.INTERNAL_VERIFIED,
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
          data_classification: classification ?? null,
        };
        });
        pushEvidence(ctx, evidence);
        return { ok: !error, error: error?.message ?? null, count: evidence.length, evidence };
      },
    }),

    lookup_contracts: tool({
      description:
        "CLASSIFIED rail: list purpose-eligible contracts (title/number) under org RLS. Public authority remains public and is never relabeled as L&P internal history.",
      inputSchema: z.object({
        query: z.string().optional(),
        limit: z.number().int().min(1).max(40).optional(),
      }),
      execute: async ({ query, limit }) => {
        const supabase = await createClient();
        let q = supabase
          .from("contracts")
          .select("id, title, contract_number, start_on, verified_end_on, source_document_id, source_fact_id, client_id")
          .order("updated_at", { ascending: false })
          .limit(limit ?? 20);
        if (query?.trim()) {
          const p = `%${query.trim().replace(/[%_]/g, "")}%`;
          q = q.or(`title.ilike.${p},contract_number.ilike.${p}`);
        }
        const { data, error } = await q;
        const factIds = collectSourceFactIds(
          (data ?? []) as unknown as Record<string, unknown>[],
          ["source_fact_id"],
        );
        const classifications = await loadSourceFactClassifications(supabase, factIds);
        const eligibleRows = filterRowsBySourceClassification(
          (data ?? []) as unknown as Record<string, unknown>[],
          { fields: ["source_fact_id"], classifications, purpose: ctx.purpose },
        ) as unknown as NonNullable<typeof data>;
        const evidence: NormalizedEvidence[] = eligibleRows.map((row) => {
          const classification = row.source_fact_id
            ? classifications.get(row.source_fact_id)
            : null;
          return {
          id: makeEvidenceId("contract", row.id),
          rail: "internal",
          evidence_class:
            classification === "verified_public" ? "OFFICIAL_PUBLIC" : "INTERNAL_VERIFIED",
          source_authority:
            classification === "verified_public"
              ? SOURCE_AUTHORITY.OFFICIAL_PUBLIC
              : SOURCE_AUTHORITY.INTERNAL_VERIFIED,
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
          data_classification: classification,
        };
        });
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
          .select("id, notice, winner_name, amount_nte, awarded_on, rank, source_document_id, source_fact_id, opportunity_id")
          .order("awarded_on", { ascending: false })
          .limit(limit ?? 20);
        const factIds = collectSourceFactIds(
          (data ?? []) as unknown as Record<string, unknown>[],
          ["source_fact_id"],
        );
        const classifications = await loadSourceFactClassifications(supabase, factIds);
        const eligibleRows = filterRowsBySourceClassification(
          (data ?? []) as unknown as Record<string, unknown>[],
          { fields: ["source_fact_id"], classifications, purpose: ctx.purpose },
        ) as unknown as NonNullable<typeof data>;
        const evidence: NormalizedEvidence[] = eligibleRows.map((row) => {
          const classification = row.source_fact_id
            ? classifications.get(row.source_fact_id)
            : null;
          return {
          id: makeEvidenceId("award", row.id),
          rail: "internal",
          evidence_class:
            classification === "verified_public" ? "OFFICIAL_PUBLIC" : "INTERNAL_VERIFIED",
          source_authority:
            classification === "verified_public"
              ? SOURCE_AUTHORITY.OFFICIAL_PUBLIC
              : SOURCE_AUTHORITY.INTERNAL_VERIFIED,
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
          data_classification: classification,
        };
        });
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
          reportRunId: report.reportRunId,
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
        "PUBLIC rail (cite-only): live web/procurement search. Results are OFFICIAL_PUBLIC or EXTERNAL_RESEARCH — never HUMAN_VERIFIED and never written to the verified corpus. Prefer search_verified_research_facts when durable HUMAN_VERIFIED research_facts exist. Requires TAVILY_API_KEY or BRAVE_SEARCH_API_KEY.",
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

    search_verified_research_facts: tool({
      description:
        "DURABLE research rail: search org HUMAN_VERIFIED research_facts only (verification_status=HUMAN_VERIFIED). Prefer this over live search_public_research when verified research exists. Never returns AI_EXTRACTED as verified. Public ≠ L&P truth until verified.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(30).optional(),
      }),
      execute: async ({ query, limit }) => {
        const supabase = await createClient();
        const q = query.trim();
        const { data, error } = await supabase
          .from("research_facts")
          .select(
            "id, title, claim, excerpt, source_url, source_document_id, verification_status, published_on, retrieved_at, provider, research_run_id",
          )
          .eq("verification_status", "HUMAN_VERIFIED")
          .or(
            `title.ilike.%${q}%,claim.ilike.%${q}%,excerpt.ilike.%${q}%,source_url.ilike.%${q}%`,
          )
          .order("retrieved_at", { ascending: false })
          .limit(limit ?? 20);

        if (error) {
          return { ok: false, error: error.message, count: 0, evidence: [] as NormalizedEvidence[] };
        }

        const documentIds = [
          ...new Set(
            (data ?? [])
              .map((row) => row.source_document_id)
              .filter((id): id is string => typeof id === "string"),
          ),
        ];
        const documentClassifications = await loadDocumentClassifications(supabase, documentIds);
        const eligibleRows = (data ?? []).filter((row) => {
          const classification = row.source_document_id
            ? documentClassifications.get(row.source_document_id)
            : null;
          return classification
            ? isClassificationEligible(classification, ctx.purpose)
            : false;
        });
        const evidence: NormalizedEvidence[] = eligibleRows.map((row) => {
          const classification = row.source_document_id
            ? documentClassifications.get(row.source_document_id)
            : null;
          return {
          id: makeEvidenceId("research_fact", row.id),
          rail: "internal" as const,
          evidence_class:
            classification === "verified_public"
              ? ("OFFICIAL_PUBLIC" as const)
              : ("INTERNAL_VERIFIED" as const),
          source_authority:
            classification === "verified_public"
              ? SOURCE_AUTHORITY.OFFICIAL_PUBLIC
              : SOURCE_AUTHORITY.INTERNAL_VERIFIED,
          title: row.claim || row.title || row.source_url,
          url: row.source_url,
          internal_ref: `/intelligence/research`,
          document_id: null,
          chunk_id: null,
          page: null,
          excerpt: row.excerpt || row.claim || row.title || "",
          published_date: row.published_on,
          retrieved_at: row.retrieved_at,
          verification_status: "HUMAN_VERIFIED",
          entity: null,
          topic: row.provider ?? "research_fact",
          data_classification: classification,
          research_run_id: row.research_run_id,
          research_fact_id: row.id,
        };
        });
        pushEvidence(ctx, evidence);
        return {
          ok: true,
          count: evidence.length,
          note:
            "HUMAN_VERIFIED research_facts with purpose-eligible document classification only — AI_EXTRACTED, internal_unverified, and illustrative_demo excluded.",
          evidence,
        };
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

    ask_structured_analytics: tool({
      description: `INTERNAL rail: governed structured analytics (counts, rates, medians, contract expirations, competitor frequency). Parameterized metric registry only — NEVER free SQL, NEVER market_share, NEVER invent win rates below the P9 sample gate (n>=20 decided). Route count/rate/median/expiration/competitor-frequency questions here. Registered metrics: ${listMetricIds().join(", ")}. Ambiguous questions are refused with a clarification message.`,
      inputSchema: z.object({
        question: z.string().min(1),
        metricId: z.string().optional(),
        dimensions: z.array(z.string()).optional(),
        filters: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]))
          .optional(),
        limit: z.number().int().min(1).max(500).optional(),
        /** If ever supplied, validateSql rejects — free SQL is never executed. */
        rawSql: z.string().optional(),
      }),
      execute: async ({ question, metricId, dimensions, filters, limit, rawSql }) => {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        let organizationId: string | null = null;
        if (user) {
          const { data: membership } = await supabase
            .from("memberships")
            .select("organization_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();
          organizationId = membership?.organization_id ?? null;
        }

        const result = await runStructuredAnalytics({
          supabase,
          question,
          metricId: metricId ?? null,
          dimensions,
          filters,
          limit,
          rawSql: rawSql ?? null,
          organizationId,
          userId: user?.id ?? null,
          persist: Boolean(organizationId),
        });

        const evidence: NormalizedEvidence[] = result.ok
          ? [
              {
                id: makeEvidenceId("analytics", result.planFingerprint ?? result.metricId ?? "run"),
                rail: "internal",
                evidence_class: "INTERNAL_VERIFIED",
                source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
                title: result.metricId
                  ? `Structured analytics: ${result.metricId}`
                  : "Structured analytics (refused)",
                url: null,
                internal_ref: "/intelligence/ask",
                document_id: null,
                chunk_id: null,
                page: null,
                excerpt: result.metricInterpretation,
                published_date: null,
                retrieved_at: result.dataCutoff,
                verification_status: "STRUCTURED_RECORD",
                entity: result.metricId,
                topic: "structured_analytics",
                analytical_run_id: result.runId,
                structured_ref: {
                  metric_id: result.metricId,
                  plan_fingerprint: result.planFingerprint,
                },
              },
            ]
          : [];
        if (evidence.length) pushEvidence(ctx, evidence);

        return {
          ...result,
          evidence,
          honesty:
            "Governed metric registry only. Not market share. Win rates withheld below n=20 decided. No free SQL to DB.",
        };
      },
    }),

    search_experience_records: tool({
      description:
        "INTERNAL rail (F14): typed experience_records. Types NEVER merge. For L&P corporate past performance use experience_type=L_AND_P_CORPORATE (or corporate_only=true) — returns only HUMAN_VERIFIED corporate rows. Management prior / key personnel / subcontractor stay separately attributed. References alone are not corporate PP. Never invents value/years.",
      inputSchema: z.object({
        experience_type: z
          .enum([
            "L_AND_P_CORPORATE",
            "MANAGEMENT_PRIOR_EXPERIENCE",
            "KEY_PERSONNEL_EXPERIENCE",
            "SUBCONTRACTOR_EXPERIENCE",
          ])
          .optional(),
        corporate_only: z
          .boolean()
          .optional()
          .describe("When true, only HUMAN_VERIFIED L_AND_P_CORPORATE — excludes all other types."),
        buyer_contains: z.string().optional(),
        limit: z.number().int().min(1).max(40).optional(),
      }),
      execute: async ({ experience_type, corporate_only, buyer_contains, limit }) => {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: membership } = user
          ? await supabase
              .from("memberships")
              .select("organization_id")
              .eq("user_id", user.id)
              .limit(1)
              .maybeSingle()
          : { data: null };
        if (!membership) {
          return { ok: false, error: "No organization membership.", count: 0, evidence: [] };
        }

        const { retrieveCorporatePastPerformance, retrieveExperienceByType } = await import(
          "@/lib/experience/retrieve"
        );
        const { EXPERIENCE_HARD_CAVEAT } = await import("@/lib/experience/types");

        const wantCorporate =
          corporate_only === true ||
          experience_type === "L_AND_P_CORPORATE" ||
          (!experience_type && /past\s+performance|corporate/i.test(ctx.purpose));

        let rows = wantCorporate
          ? await retrieveCorporatePastPerformance(supabase, membership.organization_id, {
              limit: limit ?? 20,
              buyerNameContains: buyer_contains,
            })
          : await retrieveExperienceByType(
              supabase,
              membership.organization_id,
              experience_type ?? "L_AND_P_CORPORATE",
              { limit: limit ?? 20, requireHumanVerified: true },
            );

        if (buyer_contains?.trim() && !wantCorporate) {
          const needle = buyer_contains.trim().toLowerCase();
          rows = rows.filter((r) => (r.buyer_name ?? "").toLowerCase().includes(needle));
        }

        const evidence: NormalizedEvidence[] = rows.map((r) => ({
          id: makeEvidenceId("experience", r.id),
          rail: "internal",
          evidence_class: "INTERNAL_VERIFIED",
          source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
          title: `${r.experience_type}: ${r.project_or_contract_name}`,
          url: null,
          internal_ref: r.source_document_id
            ? `/ingestion/verification/${r.source_document_id}`
            : "/intelligence/content",
          document_id: r.source_document_id ?? null,
          chunk_id: null,
          page: r.source_page ?? null,
          excerpt: r.attribution_language,
          published_date: null,
          retrieved_at: new Date().toISOString(),
          verification_status: r.verification_status,
          entity: r.experience_type,
          topic: "past_performance",
        }));
        pushEvidence(ctx, evidence);
        return {
          ok: true,
          count: evidence.length,
          evidence,
          honesty: EXPERIENCE_HARD_CAVEAT,
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
