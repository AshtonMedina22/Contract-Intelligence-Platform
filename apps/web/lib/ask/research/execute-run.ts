/**
 * F4 bounded research run execution.
 * Calls getPublicResearchProvider and/or USAspending per subquestion.
 * Soft entity link via normalize-party exact match only — ambiguous ⇒ null.
 * Never writes HUMAN_VERIFIED.
 */

import { getPublicResearchProvider, type PublicSearchHit } from "@/lib/ask/research/provider";
import {
  createUsaSpendingProvider,
  buildResearchFactFromFederalAward,
  type NormalizedFederalAward,
} from "@/lib/ask/research/usaspending";
import {
  matchExistingClient,
  matchExistingCompetitor,
  type PartyRecord,
} from "@/lib/ask/research/normalize-party";
import {
  buildResearchPlan,
  type ResearchPlan,
  type ResearchSubquestion,
  type ResearchType,
} from "@/lib/ask/research/plan";
import {
  beginRefreshRun,
  completeRun,
  createResearchRun,
  domainFromUrl,
  insertAiExtractedFacts,
  recordSources,
  type ResearchDb,
  type ResearchFactInput,
  type ResearchSourceInput,
} from "@/lib/ask/research/persist-run";

const WEB_HITS_PER_QUESTION = 5;
const USA_HITS_PER_QUESTION = 5;

export type ExecuteResearchRunOpts = {
  organizationId: string;
  createdBy: string;
  researchType: ResearchType;
  query: string;
  purpose?: string | null;
  entityName?: string | null;
  clientId?: string | null;
  competitorId?: string | null;
  opportunityId?: string | null;
  contractId?: string | null;
  /** Existing parties for soft exact-match linking only. */
  clients?: PartyRecord[];
  competitors?: PartyRecord[];
  /** When set, refresh this run (append) instead of creating a new one. */
  refreshRunId?: string | null;
  /** Injected for tests. */
  webSearch?: (query: string, limit?: number) => Promise<PublicSearchHit[]>;
  usaSearch?: (query: string) => Promise<NormalizedFederalAward[]>;
  webProviderId?: string;
};

export type ExecuteResearchRunResult = {
  runId: string;
  plan: ResearchPlan;
  sourceCount: number;
  factCount: number;
  status: "REVIEW_READY" | "FAILED";
  error?: string;
};

function softLinks(
  entityName: string | null | undefined,
  clients: PartyRecord[],
  competitors: PartyRecord[],
): { client_id: string | null; competitor_id: string | null } {
  if (!entityName?.trim()) return { client_id: null, competitor_id: null };
  const needle = { name: entityName };
  const client = matchExistingClient(needle, clients);
  const competitor = matchExistingCompetitor(needle, competitors);
  return {
    client_id: client.ambiguity ? null : (client.match?.id ?? null),
    competitor_id: competitor.ambiguity ? null : (competitor.match?.id ?? null),
  };
}

function hitToSource(hit: PublicSearchHit, provider: string): ResearchSourceInput {
  return {
    url: hit.url,
    title: hit.title,
    domain: domainFromUrl(hit.url),
    publisher: domainFromUrl(hit.url),
    published_on: hit.published_date ?? null,
    source_type: "web",
    excerpt: hit.snippet,
    provider,
    retrieved_at: new Date().toISOString(),
  };
}

function hitToFact(
  hit: PublicSearchHit,
  provider: string,
  links: { client_id: string | null; competitor_id: string | null },
  opportunityId: string | null,
): ResearchFactInput {
  const claim = `${hit.title}`.trim() || hit.url;
  return {
    source_url: hit.url,
    title: hit.title || claim,
    claim,
    excerpt: hit.snippet || null,
    published_on: hit.published_date ?? null,
    provider,
    confidence: null,
    client_id: links.client_id,
    competitor_id: links.competitor_id,
    opportunity_id: opportunityId,
  };
}

async function gatherForSubquestion(
  sq: ResearchSubquestion,
  opts: ExecuteResearchRunOpts,
): Promise<{ sources: ResearchSourceInput[]; facts: ResearchFactInput[] }> {
  const sources: ResearchSourceInput[] = [];
  const facts: ResearchFactInput[] = [];
  const links = softLinks(opts.entityName, opts.clients ?? [], opts.competitors ?? []);
  const opportunityId = opts.opportunityId ?? null;

  const wantWeb = sq.provider_hint === "web" || sq.provider_hint === "both";
  const wantUsa = sq.provider_hint === "usa_spending" || sq.provider_hint === "both";

  if (wantWeb) {
    const search =
      opts.webSearch ??
      (async (q: string, limit?: number) => {
        const provider = getPublicResearchProvider();
        if (!provider) return [];
        return provider.search(q, limit);
      });
    const providerId =
      opts.webProviderId ?? getPublicResearchProvider()?.id ?? "web";
    const hits = await search(sq.text, WEB_HITS_PER_QUESTION);
    for (const hit of hits) {
      if (!hit.url) continue;
      sources.push(hitToSource(hit, providerId));
      facts.push(hitToFact(hit, providerId, links, opportunityId));
    }
  }

  if (wantUsa) {
    const searchUsa =
      opts.usaSearch ??
      (async (q: string) => {
        const provider = createUsaSpendingProvider();
        const result = await provider.searchAwards({
          keywords: q,
          recipient: opts.entityName ?? undefined,
          limit: USA_HITS_PER_QUESTION,
        });
        if (!result.ok) return [];
        return result.results;
      });

    const awards = await searchUsa(sq.text);
    for (const award of awards) {
      if (award.provider === "fixture" || award.award_id.startsWith("FIXTURE-")) continue;
      sources.push({
        url: award.source_url,
        title: `${award.award_id} — ${award.recipient_name ?? "Federal award"}`,
        domain: "api.usaspending.gov",
        publisher: "USAspending.gov",
        published_on: award.award_date,
        source_type: "federal_award",
        excerpt: award.description,
        provider: "usa_spending",
        external_id: award.external_id,
        retrieved_at: award.retrieved_at,
      });

      // Soft-link recipient when exact match only.
      const recipientLinks = softLinks(
        award.recipient_name,
        opts.clients ?? [],
        opts.competitors ?? [],
      );
      const built = buildResearchFactFromFederalAward({
        organizationId: opts.organizationId,
        award,
        clientId: recipientLinks.client_id ?? links.client_id,
        competitorId: recipientLinks.competitor_id ?? links.competitor_id,
        opportunityId,
      });
      facts.push({
        source_url: built.source_url,
        title: built.title,
        claim: built.title,
        excerpt: built.excerpt,
        published_on: built.published_on,
        provider: built.provider,
        external_id: built.external_id,
        client_id: built.client_id,
        competitor_id: built.competitor_id,
        opportunity_id: built.opportunity_id,
        retrieved_at: built.retrieved_at,
      });
    }
  }

  return { sources, facts };
}

/**
 * Create (or refresh) a research run, execute subquestions, persist AI_EXTRACTED facts.
 */
export async function executeResearchRun(
  client: ResearchDb,
  opts: ExecuteResearchRunOpts,
): Promise<ExecuteResearchRunResult> {
  const plan = buildResearchPlan(opts.researchType, {
    query: opts.query,
    entityName: opts.entityName,
    clientId: opts.clientId,
    competitorId: opts.competitorId,
    opportunityId: opts.opportunityId,
    contractId: opts.contractId,
  });

  let runId: string;
  if (opts.refreshRunId) {
    runId = opts.refreshRunId;
    await beginRefreshRun(client, {
      organizationId: opts.organizationId,
      researchRunId: runId,
    });
  } else {
    const created = await createResearchRun(client, {
      organizationId: opts.organizationId,
      createdBy: opts.createdBy,
      researchType: opts.researchType,
      query: opts.query,
      purpose: opts.purpose,
      plan,
      clientId: opts.clientId,
      competitorId: opts.competitorId,
      opportunityId: opts.opportunityId,
      contractId: opts.contractId,
    });
    runId = created.id;
  }

  try {
    const allSources: ResearchSourceInput[] = [];
    const allFacts: ResearchFactInput[] = [];

    for (const sq of plan.subquestions) {
      const { sources, facts } = await gatherForSubquestion(sq, opts);
      allSources.push(...sources);
      allFacts.push(...facts);
    }

    const urlToSourceId = await recordSources(client, {
      organizationId: opts.organizationId,
      researchRunId: runId,
      sources: allSources,
    });

    const factsWithSource = allFacts.map((f) => ({
      ...f,
      research_source_id: urlToSourceId.get(f.source_url.trim()) ?? null,
    }));

    const factIds = await insertAiExtractedFacts(client, {
      organizationId: opts.organizationId,
      researchRunId: runId,
      facts: factsWithSource,
    });

    await completeRun(client, {
      organizationId: opts.organizationId,
      researchRunId: runId,
      status: "REVIEW_READY",
    });

    return {
      runId,
      plan,
      sourceCount: urlToSourceId.size,
      factCount: factIds.length,
      status: "REVIEW_READY",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeRun(client, {
      organizationId: opts.organizationId,
      researchRunId: runId,
      status: "FAILED",
      lastError: message,
    });
    return {
      runId,
      plan,
      sourceCount: 0,
      factCount: 0,
      status: "FAILED",
      error: message,
    };
  }
}
