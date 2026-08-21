import fixtureFile from "./fixtures/sam-gov.sample.json";
import {
  applyLocalFilters,
  documentsFromRawPayload,
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicOpportunityDocument,
  type PublicOpportunityQuery,
  type PublicProcurementProvider,
  type PublicProviderHealth,
  type PublicProviderSearchResult,
} from "./types";

export const SAM_SEARCH_URL = "https://api.sam.gov/opportunities/v2/search";

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
  pointOfContact?: unknown;
  uiLink?: string;
  estimatedValue?: unknown;
  awardAmount?: unknown;
  resourceLinks?: unknown;
  attachments?: unknown;
  additionalInfoLink?: unknown;
  description?: unknown;
};

function samApiKey(): string | null {
  const key = (process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY ?? "").trim();
  return key.length > 0 ? key : null;
}

export function isSamGovLive(): boolean {
  return samApiKey() != null;
}

/** SAM.gov nests place of performance; flatten to "City, ST" when the fields are present. */
export function samGeography(place: unknown): string | null {
  if (!place) return null;
  if (typeof place === "string") {
    const trimmed = place.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof place !== "object") return null;
  const p = place as {
    city?: { name?: string; code?: string } | string;
    state?: { code?: string; name?: string } | string;
    zip?: string | { code?: string };
    country?: { code?: string; name?: string } | string;
    streetAddress?: string;
  };
  const city =
    typeof p.city === "string" ? p.city : (p.city?.name ?? p.city?.code ?? null);
  const state =
    typeof p.state === "string" ? p.state : (p.state?.code ?? p.state?.name ?? null);
  const zip = typeof p.zip === "string" ? p.zip : (p.zip?.code ?? null);
  const country =
    typeof p.country === "string" ? p.country : (p.country?.code ?? p.country?.name ?? null);
  const parts = [city, state, zip].filter((part): part is string => Boolean(part && String(part).trim()));
  if (parts.length === 0 && country) return String(country).trim() || null;
  if (parts.length === 0) return null;
  const base = parts.join(", ");
  // Omit USA-ish country noise; keep non-US country codes when that is all we have above.
  if (country && !/^US(A)?$/i.test(String(country))) return `${base} (${country})`;
  return base;
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
    geography: samGeography(notice.placeOfPerformance),
    estimated_value: notice.estimatedValue ?? notice.awardAmount,
    raw_payload: notice as unknown as Record<string, unknown>,
  });
}

/** MM/dd/yyyy is what the SAM.gov v2 search endpoint expects for postedFrom/postedTo. */
export function toSamDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[2]}/${m[3]}/${m[1]}` : null;
}

function defaultPostedWindow(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Build the SAM.gov v2 search URL. Exported so acceptance tests can assert request
 * construction and pagination without inventing live notices.
 */
export function buildSamSearchUrl(
  key: string,
  query: PublicOpportunityQuery,
): URL {
  const window = defaultPostedWindow();
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const url = new URL(SAM_SEARCH_URL);
  url.searchParams.set("api_key", key);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set(
    "postedFrom",
    toSamDate(query.postedFrom ?? window.from) ?? toSamDate(window.from)!,
  );
  url.searchParams.set(
    "postedTo",
    toSamDate(query.postedTo ?? window.to) ?? toSamDate(window.to)!,
  );
  if (query.keywords?.trim()) url.searchParams.set("title", query.keywords.trim());
  if (query.naics?.trim()) url.searchParams.set("ncode", query.naics.trim());
  if (query.buyer?.trim()) url.searchParams.set("organizationName", query.buyer.trim());
  if (query.setAside?.trim()) url.searchParams.set("typeOfSetAside", query.setAside.trim());
  if (query.state?.trim()) url.searchParams.set("state", query.state.trim());
  return url;
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
  const url = buildSamSearchUrl(key, query);

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
        totalRecords: null,
      };
    }
    const data = (await res.json()) as {
      opportunitiesData?: SamNotice[];
      totalRecords?: number;
    };
    const results = (data.opportunitiesData ?? [])
      .map((notice) => toNormalized(notice, "sam_gov"))
      .filter((row): row is NormalizedPublicOpportunity => row != null);
    return {
      provider: "sam_gov",
      mode: "live",
      notice: LIVE_NOTICE,
      results: applyLocalFilters(results, {
        dueWithinDays: query.dueWithinDays,
        setAside: query.setAside,
        state: query.state,
      }),
      error: null,
      totalRecords:
        typeof data.totalRecords === "number" && Number.isFinite(data.totalRecords)
          ? data.totalRecords
          : null,
    };
  } catch (err) {
    return {
      provider: "sam_gov",
      mode: "live",
      notice: LIVE_NOTICE,
      results: [],
      error: err instanceof Error ? `SAM.gov request failed: ${err.message}` : "SAM.gov request failed.",
      totalRecords: null,
    };
  }
}

async function documentsFor(
  load: (id: string) => Promise<NormalizedPublicOpportunity | null>,
  externalId: string,
): Promise<PublicOpportunityDocument[]> {
  const notice = await load(externalId);
  if (!notice) return [];
  return documentsFromRawPayload(notice.raw_payload);
}

async function liveHealthCheck(key: string): Promise<PublicProviderHealth> {
  // Lightweight ping: one-row search over the default window. Failure is reported honestly.
  const url = buildSamSearchUrl(key, { limit: 1, offset: 0 });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        ok: false,
        mode: "live",
        message: `SAM.gov health ping returned HTTP ${res.status}. Key is present but the endpoint did not respond successfully.`,
      };
    }
    return {
      ok: true,
      mode: "live",
      message: "SAM.gov API key present; lightweight search ping succeeded.",
    };
  } catch (err) {
    return {
      ok: false,
      mode: "live",
      message:
        err instanceof Error
          ? `SAM.gov health ping failed: ${err.message}`
          : "SAM.gov health ping failed.",
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
    const getOpportunity = async (externalId: string) => {
      const found = await searchLive(key, { keywords: externalId, limit: 25 });
      return found.results.find((row) => row.external_id === externalId) ?? null;
    };
    return {
      id: "sam_gov",
      label: "SAM.gov",
      mode: "live",
      notice: LIVE_NOTICE,
      search: (query) => searchLive(key, query),
      getOpportunity,
      getById: getOpportunity,
      getDocuments: (id) => documentsFor(getOpportunity, id),
      healthCheck: () => liveHealthCheck(key),
    };
  }

  const getOpportunity = async (externalId: string) =>
    loadSamFixtures().find((row) => row.external_id === externalId) ?? null;

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
        totalRecords: null,
      };
    },
    getOpportunity,
    getById: getOpportunity,
    getDocuments: (id) => documentsFor(getOpportunity, id),
    async healthCheck() {
      return {
        ok: true,
        mode: "fixture",
        message:
          "Fixture adapter healthy. SAM_GOV_API_KEY is not set — serving labeled sample data only.",
      };
    },
  };
}
