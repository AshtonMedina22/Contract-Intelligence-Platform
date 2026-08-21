import fixtureFile from "./fixtures/sam-gov.sample.json";
import {
  applyLocalFilters,
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicOpportunityQuery,
  type PublicProcurementProvider,
  type PublicProviderSearchResult,
} from "./types";

const SAM_SEARCH_URL = "https://api.sam.gov/opportunities/v2/search";

const LIVE_NOTICE =
  "Live SAM.gov search. Results are public notices — evidence only until the solicitation is ingested and verified.";
const FIXTURE_NOTICE =
  "Sample data — SAM_GOV_API_KEY is not set, so this adapter returns clearly labeled FIXTURE-SAM-* records. These are not live public notices.";

type SamNotice = {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  organizationName?: string;
  type?: string;
  postedDate?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  classificationCode?: string;
  typeOfSetAside?: string;
  typeOfSetAsideDescription?: string;
  placeOfPerformance?: unknown;
  uiLink?: string;
  estimatedValue?: unknown;
  awardAmount?: unknown;
};

function samApiKey(): string | null {
  const key = (process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY ?? "").trim();
  return key.length > 0 ? key : null;
}

export function isSamGovLive(): boolean {
  return samApiKey() != null;
}

/** SAM.gov nests place of performance; flatten to "City, ST" when the fields are present. */
function samGeography(place: unknown): string | null {
  if (!place || typeof place !== "object") return null;
  const p = place as {
    city?: { name?: string } | string;
    state?: { code?: string; name?: string } | string;
    country?: { code?: string };
  };
  const city = typeof p.city === "string" ? p.city : p.city?.name;
  const state = typeof p.state === "string" ? p.state : (p.state?.code ?? p.state?.name);
  return [city, state].filter(Boolean).join(", ") || null;
}

function toNormalized(notice: SamNotice, provider: "sam_gov" | "fixture") {
  return normalizePublicOpportunity({
    provider,
    external_id: notice.noticeId,
    title: notice.title,
    source_url: notice.uiLink,
    buyer_name: notice.fullParentPathName ?? notice.organizationName,
    solicitation_number: notice.solicitationNumber,
    procurement_type: notice.type,
    posted_on: notice.postedDate,
    due_on: notice.responseDeadLine,
    naics: notice.naicsCode,
    psc: notice.classificationCode,
    set_aside: notice.typeOfSetAsideDescription ?? notice.typeOfSetAside,
    geography:
      typeof notice.placeOfPerformance === "string"
        ? notice.placeOfPerformance
        : samGeography(notice.placeOfPerformance),
    estimated_value: notice.estimatedValue ?? notice.awardAmount,
    raw_payload: notice as unknown as Record<string, unknown>,
  });
}

/** MM/dd/yyyy is what the SAM.gov v2 search endpoint expects for postedFrom/postedTo. */
function toSamDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[2]}/${m[3]}/${m[1]}` : null;
}

function defaultPostedWindow(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function loadSamFixtures(): NormalizedPublicOpportunity[] {
  const notices = (fixtureFile as { notices?: SamNotice[] }).notices ?? [];
  return notices
    .map((notice) => toNormalized(notice, "fixture"))
    .filter((row): row is NormalizedPublicOpportunity => row != null);
}

async function searchLive(
  key: string,
  query: PublicOpportunityQuery,
): Promise<PublicProviderSearchResult> {
  const window = defaultPostedWindow();
  const url = new URL(SAM_SEARCH_URL);
  url.searchParams.set("api_key", key);
  url.searchParams.set("limit", String(Math.min(Math.max(query.limit ?? 25, 1), 100)));
  url.searchParams.set("postedFrom", toSamDate(query.postedFrom ?? window.from) ?? toSamDate(window.from)!);
  url.searchParams.set("postedTo", toSamDate(query.postedTo ?? window.to) ?? toSamDate(window.to)!);
  if (query.keywords?.trim()) url.searchParams.set("title", query.keywords.trim());
  if (query.naics?.trim()) url.searchParams.set("ncode", query.naics.trim());
  if (query.buyer?.trim()) url.searchParams.set("organizationName", query.buyer.trim());

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        provider: "sam_gov",
        mode: "live",
        notice: LIVE_NOTICE,
        results: [],
        error: `SAM.gov returned ${res.status}. No results retrieved.`,
      };
    }
    const data = (await res.json()) as { opportunitiesData?: SamNotice[] };
    const results = (data.opportunitiesData ?? [])
      .map((notice) => toNormalized(notice, "sam_gov"))
      .filter((row): row is NormalizedPublicOpportunity => row != null);
    return {
      provider: "sam_gov",
      mode: "live",
      notice: LIVE_NOTICE,
      results: applyLocalFilters(results, { dueWithinDays: query.dueWithinDays }),
      error: null,
    };
  } catch (err) {
    return {
      provider: "sam_gov",
      mode: "live",
      notice: LIVE_NOTICE,
      results: [],
      error: err instanceof Error ? `SAM.gov request failed: ${err.message}` : "SAM.gov request failed.",
    };
  }
}

/**
 * SAM.gov adapter. Live when `SAM_GOV_API_KEY` (or `SAM_API_KEY`) is set; otherwise it serves
 * clearly labeled sample fixtures so Discover is demonstrable without pretending the notices
 * are real.
 */
export function createSamGovProvider(): PublicProcurementProvider {
  const key = samApiKey();
  if (key) {
    return {
      id: "sam_gov",
      label: "SAM.gov",
      mode: "live",
      notice: LIVE_NOTICE,
      search: (query) => searchLive(key, query),
      async getById(externalId) {
        const found = await searchLive(key, { keywords: externalId, limit: 25 });
        return found.results.find((row) => row.external_id === externalId) ?? null;
      },
    };
  }

  return {
    id: "fixture",
    label: "SAM.gov (sample fixtures)",
    mode: "fixture",
    notice: FIXTURE_NOTICE,
    async search(query) {
      const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
      return {
        provider: "fixture",
        mode: "fixture",
        notice: FIXTURE_NOTICE,
        results: applyLocalFilters(loadSamFixtures(), query).slice(0, limit),
        error: null,
      };
    },
    async getById(externalId) {
      return loadSamFixtures().find((row) => row.external_id === externalId) ?? null;
    },
  };
}
