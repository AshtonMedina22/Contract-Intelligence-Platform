import {
  applyLocalFilters,
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicOpportunityQuery,
  type PublicProcurementProvider,
  type PublicProviderSearchResult,
} from "./types";

const LIVE_NOTICE =
  "Live RSS/Atom procurement feed. Items are public notices — evidence only until ingested and verified.";
const FIXTURE_NOTICE =
  "Sample data — PROCUREMENT_RSS_URL is not set. FIXTURE-RSS-* items are not live.";

/** Inline fixture XML so the adapter stays browser/server-safe (no node:fs). */
export const RSS_FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>SAMPLE FIXTURE — Procurement RSS</title>
    <link>https://fixture.invalid/rss</link>
    <description>Sample data only. Not a live agency feed.</description>
    <item>
      <title>SAMPLE FIXTURE — ISD Security Services RFP</title>
      <link>https://fixture.invalid/rss/FIXTURE-RSS-001</link>
      <guid>FIXTURE-RSS-001</guid>
      <pubDate>Mon, 04 Aug 2026 12:00:00 GMT</pubDate>
      <description>Buyer: SAMPLE ISD (FIXTURE). Solicitation: FIXTURE-ISD-24-009. Due: 2026-09-20. Place: Collin County, TX.</description>
    </item>
    <item>
      <title>SAMPLE FIXTURE — Municipal Patrol RFQ</title>
      <link>https://fixture.invalid/rss/FIXTURE-RSS-002</link>
      <guid>FIXTURE-RSS-002</guid>
      <pubDate>Wed, 13 Aug 2026 15:30:00 GMT</pubDate>
      <description>Buyer: SAMPLE CITY (FIXTURE). Solicitation: FIXTURE-CITY-RFQ-88. Due: 2026-09-10.</description>
    </item>
  </channel>
</rss>`;

function feedUrlFromEnv(): string | null {
  const url = (process.env.PROCUREMENT_RSS_URL ?? "").trim();
  return url.length > 0 ? url : null;
}

export function resolveRssFeedUrl(override?: string | null): string | null {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return feedUrlFromEnv();
}

export function isRssLive(override?: string | null): boolean {
  return resolveRssFeedUrl(override) != null;
}

function textBetween(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  if (!m) return null;
  return (
    m[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .trim() || null
  );
}

function attr(xml: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = re.exec(xml);
  return m?.[1]?.trim() || null;
}

/** Parse RSS 2.0 or Atom entries into normalized notices. Missing fields stay null. */
export function parseRssOrAtom(xml: string): NormalizedPublicOpportunity[] {
  const out: NormalizedPublicOpportunity[] = [];
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const entryBlocks =
    itemBlocks.length > 0 ? itemBlocks : (xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []);

  for (const block of entryBlocks) {
    const title = textBetween(block, "title");
    const link =
      textBetween(block, "link") ??
      attr(block, "href") ??
      textBetween(block, "id") ??
      textBetween(block, "guid");
    const guid = textBetween(block, "guid") ?? textBetween(block, "id") ?? link;
    const pub =
      textBetween(block, "pubDate") ??
      textBetween(block, "published") ??
      textBetween(block, "updated");
    const description =
      textBetween(block, "description") ??
      textBetween(block, "summary") ??
      textBetween(block, "content");

    let buyer_name: string | null = null;
    let solicitation_number: string | null = null;
    let due_on: string | null = null;
    let geography: string | null = null;
    if (description) {
      const buyer = /Buyer:\s*([^.\n]+)/i.exec(description);
      if (buyer) buyer_name = buyer[1].trim();
      const sol = /Solicitation:\s*([^\s.]+)/i.exec(description);
      if (sol) solicitation_number = sol[1].trim();
      const due = /Due:\s*(\d{4}-\d{2}-\d{2})/i.exec(description);
      if (due) due_on = due[1];
      const place = /Place:\s*([^.\n]+)/i.exec(description);
      if (place) geography = place[1].trim();
    }

    const notice = normalizePublicOpportunity({
      provider: "rss",
      external_id: guid,
      title,
      source_url: link,
      buyer_name,
      solicitation_number,
      procurement_type: null,
      posted_on: pub,
      due_on,
      naics: null,
      geography,
      estimated_value: null,
      raw_payload: { xml_snippet: block.slice(0, 2000), description },
    });
    if (notice) out.push(notice);
  }
  return out;
}

export function loadRssFixtures(): NormalizedPublicOpportunity[] {
  return parseRssOrAtom(RSS_FIXTURE_XML);
}

async function searchLive(
  feedUrl: string,
  query: PublicOpportunityQuery,
): Promise<PublicProviderSearchResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.status === 429) {
      return {
        provider: "rss",
        mode: "live",
        capability: "AUTOMATED",
        notice: LIVE_NOTICE,
        results: [],
        error: "RSS feed returned HTTP 429 (rate limited). Respect feed limits; no rows invented.",
        totalRecords: null,
      };
    }
    if (!res.ok) {
      return {
        provider: "rss",
        mode: "live",
        capability: "AUTOMATED",
        notice: LIVE_NOTICE,
        results: [],
        error: `RSS feed returned HTTP ${res.status}. No results retrieved.`,
        totalRecords: null,
      };
    }
    const xml = await res.text();
    const results = applyLocalFilters(parseRssOrAtom(xml), query);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    return {
      provider: "rss",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      results: results.slice(0, limit),
      error: null,
      totalRecords: null,
    };
  } catch (err) {
    return {
      provider: "rss",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      results: [],
      error: err instanceof Error ? `RSS request failed: ${err.message}` : "RSS request failed.",
      totalRecords: null,
    };
  }
}

/** RSS/Atom adapter. Live when PROCUREMENT_RSS_URL (or override) is set. */
export function createRssProvider(feedUrlOverride?: string | null): PublicProcurementProvider {
  const feedUrl = resolveRssFeedUrl(feedUrlOverride);
  if (feedUrl) {
    const getOpportunity = async (externalId: string) => {
      const found = await searchLive(feedUrl, { limit: 100 });
      return found.results.find((row) => row.external_id === externalId) ?? null;
    };
    return {
      id: "rss",
      label: "RSS / Atom feed",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      search: (query) => searchLive(feedUrl, query),
      getOpportunity,
      getById: getOpportunity,
      getDocuments: async () => [],
      async healthCheck() {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(feedUrl, {
            signal: controller.signal,
            headers: { Accept: "application/rss+xml, application/xml, text/xml" },
            cache: "no-store",
          });
          clearTimeout(timer);
          return {
            ok: res.ok,
            mode: "live",
            capability: "AUTOMATED",
            httpStatus: res.status,
            message: res.ok
              ? "RSS/Atom feed ping succeeded."
              : `RSS/Atom feed ping returned HTTP ${res.status}.`,
          };
        } catch (err) {
          return {
            ok: false,
            mode: "live",
            capability: "AUTOMATED",
            httpStatus: null,
            message:
              err instanceof Error
                ? `RSS health ping failed: ${err.message}`
                : "RSS health ping failed.",
          };
        }
      },
    };
  }

  const getOpportunity = async (externalId: string) =>
    loadRssFixtures().find((row) => row.external_id === externalId) ?? null;

  return {
    id: "rss",
    label: "RSS / Atom feed (sample)",
    mode: "fixture",
    capability: "AUTOMATED",
    notice: FIXTURE_NOTICE,
    async search(query) {
      const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
      return {
        provider: "rss",
        mode: "fixture",
        capability: "AUTOMATED",
        notice: FIXTURE_NOTICE,
        results: applyLocalFilters(loadRssFixtures(), query).slice(0, limit),
        error: null,
        totalRecords: null,
      };
    },
    getOpportunity,
    getById: getOpportunity,
    getDocuments: async () => [],
    async healthCheck() {
      return {
        ok: true,
        mode: "fixture",
        capability: "AUTOMATED",
        message: "Fixture adapter healthy. Set PROCUREMENT_RSS_URL for live feed sync.",
      };
    },
  };
}
