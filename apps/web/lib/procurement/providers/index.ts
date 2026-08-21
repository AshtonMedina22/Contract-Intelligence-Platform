import { createHtmlListingProvider } from "./html-listing";
import { createJsonFeedProvider } from "./json-feed";
import { createManualProvider } from "./manual";
import { createRssProvider } from "./rss";
import { createSamGovProvider } from "./sam-gov";
import { createSocrataProvider } from "./socrata";
import { createTexasEsbdProvider } from "./texas-esbd";
import type {
  NormalizedPublicOpportunity,
  PublicOpportunityQuery,
  PublicProcurementProvider,
  PublicProviderSearchResult,
  ProviderCapability,
} from "./types";

export {
  isSamGovLive,
  createSamGovProvider,
  loadSamFixtures,
  buildSamSearchUrl,
  toSamDate,
  samGeography,
  SAM_SEARCH_URL,
} from "./sam-gov";
export {
  createManualProvider,
  normalizeManualEntry,
  normalizeLocalManualEntry,
  documentsForManual,
} from "./manual";
export {
  createTexasEsbdProvider,
  normalizeTexasEsbdEntry,
  documentsForTexasEsbd,
  TEXAS_ESBD_PORTAL_URL,
} from "./texas-esbd";
export {
  createSocrataProvider,
  loadSocrataFixtures,
  buildSocrataResourceUrl,
  isSocrataLive,
  resolveSocrataConfig,
} from "./socrata";
export {
  createRssProvider,
  loadRssFixtures,
  parseRssOrAtom,
  isRssLive,
  resolveRssFeedUrl,
  RSS_FIXTURE_XML,
} from "./rss";
export {
  createJsonFeedProvider,
  loadJsonFeedFixtures,
  parseJsonFeedDocument,
  buildJsonFeedUrl,
  isJsonFeedLive,
  resolveJsonFeedUrl,
} from "./json-feed";
export {
  createHtmlListingProvider,
  normalizeHtmlListingEntry,
} from "./html-listing";
export * from "./types";

/**
 * Searchable / discoverable adapters (Discover queries these).
 * LINK_ONLY adapters are included so operators see honest capability banners.
 * Fixture-mode AUTOMATED adapters may return sample rows for Discover only —
 * sync still fails closed (see isLiveSyncProvider).
 */
export function getPublicProcurementProviders(): PublicProcurementProvider[] {
  return [
    createSamGovProvider(),
    createSocrataProvider(),
    createRssProvider(),
    createJsonFeedProvider(),
    createTexasEsbdProvider(),
    createHtmlListingProvider(),
  ];
}

/** All adapters including non-search ones (manual entry). */
export function getAllPublicProcurementProviders(): PublicProcurementProvider[] {
  return [...getPublicProcurementProviders(), createManualProvider()];
}

/** Providers eligible for cron sync: AUTOMATED capability only (caller still checks live mode). */
export function getAutomatedSyncProviders(): PublicProcurementProvider[] {
  return getPublicProcurementProviders().filter((p) => p.capability === "AUTOMATED");
}

export function capabilityLabel(capability: ProviderCapability): string {
  switch (capability) {
    case "AUTOMATED":
      return "Automated";
    case "MANUAL_IMPORT":
      return "Manual import";
    case "LINK_ONLY":
      return "Link only";
  }
}

export type PublicDiscoveryResult = {
  searches: PublicProviderSearchResult[];
  results: NormalizedPublicOpportunity[];
};

/** Query every searchable adapter and merge results, newest posting first. */
export async function searchPublicOpportunities(
  query: PublicOpportunityQuery,
): Promise<PublicDiscoveryResult> {
  const searches = await Promise.all(
    getPublicProcurementProviders().map((provider) => provider.search(query)),
  );
  const results = searches
    .flatMap((search) => search.results)
    .sort((a, b) => (b.posted_on ?? "").localeCompare(a.posted_on ?? ""));
  return { searches, results };
}
