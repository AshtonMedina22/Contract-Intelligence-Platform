import type { EvidenceClass, NormalizedEvidence } from "@/lib/ask/evidence";
import { SOURCE_AUTHORITY, makeEvidenceId } from "@/lib/ask/evidence";

export type PublicSearchHit = {
  title: string;
  url: string;
  snippet: string;
  published_date?: string | null;
};

export type PublicResearchProvider = {
  id: string;
  search(query: string, limit?: number): Promise<PublicSearchHit[]>;
};

const OFFICIAL_HOST_HINTS = [
  ".gov",
  ".gov.tx",
  "texas.gov",
  "esbd",
  "sam.gov",
  "gsa.gov",
  "txsmartbuy",
  "hhsc.",
  "tea.texas.gov",
];

export function classifyPublicUrl(url: string): EvidenceClass {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (OFFICIAL_HOST_HINTS.some((h) => host.includes(h.replace(/^\./, "")) || host.endsWith(h))) {
      return "OFFICIAL_PUBLIC";
    }
  } catch {
    return "UNVERIFIED";
  }
  return "EXTERNAL_RESEARCH";
}

export function toPublicEvidence(hit: PublicSearchHit, topic?: string | null): NormalizedEvidence {
  const evidence_class = classifyPublicUrl(hit.url);
  const now = new Date().toISOString();
  return {
    id: makeEvidenceId("pub", hit.url),
    rail: "public",
    evidence_class,
    source_authority: SOURCE_AUTHORITY[evidence_class],
    title: hit.title || hit.url,
    url: hit.url,
    internal_ref: null,
    document_id: null,
    chunk_id: null,
    page: null,
    excerpt: hit.snippet || "",
    published_date: hit.published_date ?? null,
    retrieved_at: now,
    verification_status: evidence_class === "OFFICIAL_PUBLIC" ? "OFFICIAL_PUBLIC" : "PUBLIC_UNVERIFIED",
    entity: null,
    topic: topic ?? null,
  };
}

/** Tavily adapter when TAVILY_API_KEY is set. */
export function createTavilyProvider(): PublicResearchProvider | null {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return null;
  return {
    id: "tavily",
    async search(query, limit = 8) {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: "basic",
          max_results: Math.min(limit, 10),
          include_answer: false,
        }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        results?: { title?: string; url?: string; content?: string; published_date?: string }[];
      };
      return (data.results ?? [])
        .filter((r) => r.url)
        .map((r) => ({
          title: r.title || r.url!,
          url: r.url!,
          snippet: r.content || "",
          published_date: r.published_date ?? null,
        }));
    },
  };
}

/** Brave Search adapter when BRAVE_SEARCH_API_KEY is set. */
export function createBraveProvider(): PublicResearchProvider | null {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) return null;
  return {
    id: "brave",
    async search(query, limit = 8) {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(Math.min(limit, 10)));
      const res = await fetch(url, {
        headers: { Accept: "application/json", "X-Subscription-Token": key },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        web?: { results?: { title?: string; url?: string; description?: string }[] };
      };
      return (data.web?.results ?? [])
        .filter((r) => r.url)
        .map((r) => ({
          title: r.title || r.url!,
          url: r.url!,
          snippet: r.description || "",
          published_date: null,
        }));
    },
  };
}

export function getPublicResearchProvider(): PublicResearchProvider | null {
  return createTavilyProvider() || createBraveProvider();
}

export async function fetchPublicSource(url: string): Promise<NormalizedEvidence> {
  const evidence_class = classifyPublicUrl(url);
  const now = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LP-Contract-Intelligence/1.0 (public-research; cite-only)" },
    });
    clearTimeout(timer);
    const text = (await res.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      id: makeEvidenceId("fetch", url),
      rail: "public",
      evidence_class: res.ok ? evidence_class : "UNVERIFIED",
      source_authority: SOURCE_AUTHORITY[res.ok ? evidence_class : "UNVERIFIED"],
      title: url,
      url,
      internal_ref: null,
      document_id: null,
      chunk_id: null,
      page: null,
      excerpt: text.slice(0, 2000),
      published_date: null,
      retrieved_at: now,
      verification_status: res.ok ? evidence_class : "FETCH_FAILED",
      entity: null,
      topic: null,
    };
  } catch {
    return {
      id: makeEvidenceId("fetch", url),
      rail: "public",
      evidence_class: "UNVERIFIED",
      source_authority: SOURCE_AUTHORITY.UNVERIFIED,
      title: url,
      url,
      internal_ref: null,
      document_id: null,
      chunk_id: null,
      page: null,
      excerpt: "Fetch failed or timed out.",
      published_date: null,
      retrieved_at: now,
      verification_status: "FETCH_FAILED",
      entity: null,
      topic: null,
    };
  }
}
