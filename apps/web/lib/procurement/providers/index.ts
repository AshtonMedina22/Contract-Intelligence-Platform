import { createManualProvider } from "./manual";
import { createSamGovProvider } from "./sam-gov";
import type {
  NormalizedPublicOpportunity,
  PublicOpportunityQuery,
  PublicProcurementProvider,
  PublicProviderSearchResult,
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
export { createManualProvider, normalizeManualEntry, documentsForManual } from "./manual";
export * from "./types";

/** Searchable public procurement adapters, in the order Discover should query them. */
export function getPublicProcurementProviders(): PublicProcurementProvider[] {
  return [createSamGovProvider()];
}

/** All adapters including non-search ones (manual entry). */
export function getAllPublicProcurementProviders(): PublicProcurementProvider[] {
  return [...getPublicProcurementProviders(), createManualProvider()];
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
