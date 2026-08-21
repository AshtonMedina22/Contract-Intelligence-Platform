import fixtureFile from "./fixtures/json-feed.sample.json";
import {
  applyLocalFilters,
  documentsFromRawPayload,
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicOpportunityQuery,
  type PublicProcurementProvider,
  type PublicProviderSearchResult,
} from "./types";

const LIVE_NOTICE =
  "Live public JSON listing feed. Results are public notices — evidence only until ingested and verified.";
const FIXTURE_NOTICE =
  "Sample data — PROCUREMENT_JSON_FEED_URL is not set. FIXTURE-JSON-* rows are not live.";

function feedUrlFromEnv(): string | null {
  const url = (process.env.PROCUREMENT_JSON_FEED_URL ?? "").trim();
  return url.length > 0 ? url : null;
}

export function resolveJsonFeedUrl(override?: string | null): string | null {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return feedUrlFromEnv();
}

export function isJsonFeedLive(override?: string | null): boolean {
  return resolveJsonFeedUrl(override) != null;
}

type LooseItem = Record<string, unknown>;

function itemToNotice(item: LooseItem): NormalizedPublicOpportunity | null {
  return normalizePublicOpportunity({
    provider: "json_feed",
    external_id: item.id ?? item.external_id ?? item.guid,
    title: item.title ?? item.name,
    source_url: item.url ?? item.link ?? item.source_url,
    buyer_name: item.buyer ?? item.buyer_name ?? item.agency,
    solicitation_number: item.solicitationNumber ?? item.solicitation_number,
    procurement_type: item.type ?? item.procurement_type,
    posted_on: item.postedOn ?? item.posted_on ?? item.published,
    due_on: item.dueOn ?? item.due_on ?? item.deadline,
    naics: item.naics,
    geography: item.geography ?? item.place,
    estimated_value: item.estimated_value ?? item.estimatedValue,
    raw_payload: item,
  });
}

/** Normalize a public JSON listing document (array or `{ items: [] }` / `{ opportunities: [] }`). */
export function parseJsonFeedDocument(data: unknown): NormalizedPublicOpportunity[] {
  let items: unknown[] = [];
  if (Array.isArray(data)) items = data;
  else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) items = obj.items;
    else if (Array.isArray(obj.opportunities)) items = obj.opportunities;
    else if (Array.isArray(obj.results)) items = obj.results;
  }
  return items
    .filter((row): row is LooseItem => row != null && typeof row === "object")
    .map((row) => itemToNotice(row))
    .filter((row): row is NormalizedPublicOpportunity => row != null);
}

export function loadJsonFeedFixtures(): NormalizedPublicOpportunity[] {
  return parseJsonFeedDocument(fixtureFile);
}

/**
 * Build feed URL with optional offset/limit query params when the listing supports them.
 * Exported for pagination honesty tests — missing fields stay null after normalize.
 */
export function buildJsonFeedUrl(
  baseUrl: string,
  query: PublicOpportunityQuery,
): URL {
  const url = new URL(baseUrl);
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  if (!url.searchParams.has("limit")) url.searchParams.set("limit", String(limit));
  if (offset > 0 && !url.searchParams.has("offset")) {
    url.searchParams.set("offset", String(offset));
  }
  return url;
}

async function searchLive(
  feedUrl: string,
  query: PublicOpportunityQuery,
): Promise<PublicProviderSearchResult> {
  const url = buildJsonFeedUrl(feedUrl, query);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.status === 429) {
      return {
        provider: "json_feed",
        mode: "live",
        capability: "AUTOMATED",
        notice: LIVE_NOTICE,
        results: [],
        error: "JSON feed returned HTTP 429 (rate limited). Respect limits; no rows invented.",
        totalRecords: null,
      };
    }
    if (!res.ok) {
      return {
        provider: "json_feed",
        mode: "live",
        capability: "AUTOMATED",
        notice: LIVE_NOTICE,
        results: [],
        error: `JSON feed returned HTTP ${res.status}. No results retrieved.`,
        totalRecords: null,
      };
    }
    const data: unknown = await res.json();
    const results = applyLocalFilters(parseJsonFeedDocument(data), query);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    return {
      provider: "json_feed",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      results: results.slice(0, limit),
      error: null,
      totalRecords: null,
    };
  } catch (err) {
    return {
      provider: "json_feed",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      results: [],
      error:
        err instanceof Error
          ? `JSON feed request failed: ${err.message}`
          : "JSON feed request failed.",
      totalRecords: null,
    };
  }
}

/** Public JSON listing adapter. Live when PROCUREMENT_JSON_FEED_URL (or override) is set. */
export function createJsonFeedProvider(
  feedUrlOverride?: string | null,
): PublicProcurementProvider {
  const feedUrl = resolveJsonFeedUrl(feedUrlOverride);
  if (feedUrl) {
    const getOpportunity = async (externalId: string) => {
      const found = await searchLive(feedUrl, { limit: 100 });
      return found.results.find((row) => row.external_id === externalId) ?? null;
    };
    return {
      id: "json_feed",
      label: "JSON listing feed",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      search: (query) => searchLive(feedUrl, query),
      getOpportunity,
      getById: getOpportunity,
      getDocuments: async (id) => {
        const notice = await getOpportunity(id);
        return documentsFromRawPayload(notice?.raw_payload);
      },
      async healthCheck() {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(buildJsonFeedUrl(feedUrl, { limit: 1 }), {
            signal: controller.signal,
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          clearTimeout(timer);
          return {
            ok: res.ok,
            mode: "live",
            capability: "AUTOMATED",
            httpStatus: res.status,
            message: res.ok
              ? "JSON feed ping succeeded."
              : `JSON feed ping returned HTTP ${res.status}.`,
          };
        } catch (err) {
          return {
            ok: false,
            mode: "live",
            capability: "AUTOMATED",
            httpStatus: null,
            message:
              err instanceof Error
                ? `JSON feed health ping failed: ${err.message}`
                : "JSON feed health ping failed.",
          };
        }
      },
    };
  }

  const getOpportunity = async (externalId: string) =>
    loadJsonFeedFixtures().find((row) => row.external_id === externalId) ?? null;

  return {
    id: "json_feed",
    label: "JSON listing feed (sample)",
    mode: "fixture",
    capability: "AUTOMATED",
    notice: FIXTURE_NOTICE,
    async search(query) {
      const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
      return {
        provider: "json_feed",
        mode: "fixture",
        capability: "AUTOMATED",
        notice: FIXTURE_NOTICE,
        results: applyLocalFilters(loadJsonFeedFixtures(), query).slice(0, limit),
        error: null,
        totalRecords: null,
      };
    },
    getOpportunity,
    getById: getOpportunity,
    getDocuments: async (id) => {
      const notice = await getOpportunity(id);
      return documentsFromRawPayload(notice?.raw_payload);
    },
    async healthCheck() {
      return {
        ok: true,
        mode: "fixture",
        capability: "AUTOMATED",
        message: "Fixture adapter healthy. Set PROCUREMENT_JSON_FEED_URL for live JSON listing sync.",
      };
    },
  };
}
