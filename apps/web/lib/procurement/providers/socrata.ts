import fixtureFile from "./fixtures/socrata.sample.json";
import {
  applyLocalFilters,
  documentsFromRawPayload,
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicOpportunityQuery,
  type PublicProcurementProvider,
  type PublicProviderSearchResult,
} from "./types";

export type SocrataFieldMap = {
  id?: string;
  title?: string;
  url?: string;
  buyer?: string;
  solicitationNumber?: string;
  type?: string;
  postedOn?: string;
  dueOn?: string;
  naics?: string;
  geography?: string;
  estimatedValue?: string;
};

export type SocrataSourceConfig = {
  domain: string;
  datasetId: string;
  appToken?: string | null;
  fieldMap?: SocrataFieldMap;
};

const DEFAULT_FIELD_MAP: Required<SocrataFieldMap> = {
  id: "id",
  title: "title",
  url: "url",
  buyer: "agency",
  solicitationNumber: "solicitation_number",
  type: "type",
  postedOn: "posted_date",
  dueOn: "due_date",
  naics: "naics",
  geography: "geography",
  estimatedValue: "estimated_value",
};

const LIVE_NOTICE =
  "Live Socrata / SODA JSON. Results are public open-data rows — evidence only until ingested and verified.";
const FIXTURE_NOTICE =
  "Sample data — SOCRATA_DOMAIN + SOCRATA_DATASET_ID are not set. FIXTURE-SOCRATA-* rows are not live.";

function envConfig(): SocrataSourceConfig | null {
  const domain = (process.env.SOCRATA_DOMAIN ?? "").trim().replace(/^https?:\/\//, "");
  const datasetId = (process.env.SOCRATA_DATASET_ID ?? "").trim();
  if (!domain || !datasetId) return null;
  const appToken = (process.env.SOCRATA_APP_TOKEN ?? "").trim() || null;
  return { domain, datasetId, appToken };
}

/** Resolve config from env or an explicit profile/criteria override. */
export function resolveSocrataConfig(
  override?: Partial<SocrataSourceConfig> | null,
): SocrataSourceConfig | null {
  if (override?.domain && override?.datasetId) {
    return {
      domain: String(override.domain).replace(/^https?:\/\//, "").trim(),
      datasetId: String(override.datasetId).trim(),
      appToken: override.appToken ?? envConfig()?.appToken ?? null,
      fieldMap: override.fieldMap,
    };
  }
  return envConfig();
}

export function isSocrataLive(override?: Partial<SocrataSourceConfig> | null): boolean {
  return resolveSocrataConfig(override) != null;
}

function pick(row: Record<string, unknown>, key: string): unknown {
  return row[key];
}

function rowToNotice(
  row: Record<string, unknown>,
  fieldMap: Required<SocrataFieldMap>,
  provider: "socrata",
): NormalizedPublicOpportunity | null {
  return normalizePublicOpportunity({
    provider,
    external_id: pick(row, fieldMap.id),
    title: pick(row, fieldMap.title),
    source_url: pick(row, fieldMap.url),
    buyer_name: pick(row, fieldMap.buyer),
    solicitation_number: pick(row, fieldMap.solicitationNumber),
    procurement_type: pick(row, fieldMap.type),
    posted_on: pick(row, fieldMap.postedOn),
    due_on: pick(row, fieldMap.dueOn),
    naics: pick(row, fieldMap.naics),
    geography: pick(row, fieldMap.geography),
    estimated_value: pick(row, fieldMap.estimatedValue),
    raw_payload: row,
  });
}

export function loadSocrataFixtures(): NormalizedPublicOpportunity[] {
  const rows = (fixtureFile as { rows?: Record<string, unknown>[] }).rows ?? [];
  return rows
    .map((row) => rowToNotice(row, DEFAULT_FIELD_MAP, "socrata"))
    .filter((row): row is NormalizedPublicOpportunity => row != null);
}

/**
 * Build the SODA resource URL. Exported for acceptance tests (pagination + rate-limit honesty).
 * `$limit` / `$offset` are standard SODA; missing mapped fields stay null after normalize.
 */
export function buildSocrataResourceUrl(
  config: SocrataSourceConfig,
  query: PublicOpportunityQuery,
): URL {
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const url = new URL(
    `https://${config.domain.replace(/\/$/, "")}/resource/${config.datasetId}.json`,
  );
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String(offset));
  if (query.keywords?.trim()) {
    url.searchParams.set("$q", query.keywords.trim());
  }
  return url;
}

async function searchLive(
  config: SocrataSourceConfig,
  query: PublicOpportunityQuery,
): Promise<PublicProviderSearchResult> {
  const fieldMap = { ...DEFAULT_FIELD_MAP, ...config.fieldMap };
  const url = buildSocrataResourceUrl(config, query);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.appToken) headers["X-App-Token"] = config.appToken;
    const res = await fetch(url, { signal: controller.signal, headers, cache: "no-store" });
    clearTimeout(timer);
    if (res.status === 429) {
      return {
        provider: "socrata",
        mode: "live",
        capability: "AUTOMATED",
        notice: LIVE_NOTICE,
        results: [],
        error:
          "Socrata returned HTTP 429 (rate limited). Respect SODA limits; retry later. No rows invented.",
        totalRecords: null,
      };
    }
    if (!res.ok) {
      return {
        provider: "socrata",
        mode: "live",
        capability: "AUTOMATED",
        notice: LIVE_NOTICE,
        results: [],
        error: `Socrata returned HTTP ${res.status}. No results retrieved.`,
        totalRecords: null,
      };
    }
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      return {
        provider: "socrata",
        mode: "live",
        capability: "AUTOMATED",
        notice: LIVE_NOTICE,
        results: [],
        error: "Socrata response was not a JSON array. Refusing to invent rows.",
        totalRecords: null,
      };
    }
    const results = data
      .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
      .map((row) => rowToNotice(row, fieldMap, "socrata"))
      .filter((row): row is NormalizedPublicOpportunity => row != null);
    return {
      provider: "socrata",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      results: applyLocalFilters(results, query),
      error: null,
      totalRecords: null,
    };
  } catch (err) {
    return {
      provider: "socrata",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      results: [],
      error:
        err instanceof Error
          ? `Socrata request failed: ${err.message}`
          : "Socrata request failed.",
      totalRecords: null,
    };
  }
}

/**
 * Socrata / SODA adapter. Live when domain+datasetId are configured (env or profile criteria);
 * otherwise labeled fixtures for Discover only — sync fails closed on fixture mode.
 */
export function createSocrataProvider(
  override?: Partial<SocrataSourceConfig> | null,
): PublicProcurementProvider {
  const config = resolveSocrataConfig(override);
  if (config) {
    const getOpportunity = async (externalId: string) => {
      const found = await searchLive(config, { keywords: externalId, limit: 25 });
      return found.results.find((row) => row.external_id === externalId) ?? null;
    };
    return {
      id: "socrata",
      label: "Socrata open data",
      mode: "live",
      capability: "AUTOMATED",
      notice: LIVE_NOTICE,
      search: (query) => searchLive(config, query),
      getOpportunity,
      getById: getOpportunity,
      getDocuments: async (id) => {
        const notice = await getOpportunity(id);
        return documentsFromRawPayload(notice?.raw_payload);
      },
      async healthCheck() {
        const url = buildSocrataResourceUrl(config, { limit: 1, offset: 0 });
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const headers: Record<string, string> = { Accept: "application/json" };
          if (config.appToken) headers["X-App-Token"] = config.appToken;
          const res = await fetch(url, { signal: controller.signal, headers, cache: "no-store" });
          clearTimeout(timer);
          return {
            ok: res.ok,
            mode: "live",
            capability: "AUTOMATED",
            httpStatus: res.status,
            message: res.ok
              ? `Socrata SODA ping succeeded for ${config.domain}/${config.datasetId}.`
              : `Socrata SODA ping returned HTTP ${res.status}.`,
          };
        } catch (err) {
          return {
            ok: false,
            mode: "live",
            capability: "AUTOMATED",
            httpStatus: null,
            message:
              err instanceof Error
                ? `Socrata health ping failed: ${err.message}`
                : "Socrata health ping failed.",
          };
        }
      },
    };
  }

  const getOpportunity = async (externalId: string) =>
    loadSocrataFixtures().find((row) => row.external_id === externalId) ?? null;

  return {
    id: "socrata",
    label: "Socrata open data (sample)",
    mode: "fixture",
    capability: "AUTOMATED",
    notice: FIXTURE_NOTICE,
    async search(query) {
      const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
      return {
        provider: "socrata",
        mode: "fixture",
        capability: "AUTOMATED",
        notice: FIXTURE_NOTICE,
        results: applyLocalFilters(loadSocrataFixtures(), query).slice(0, limit),
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
        message:
          "Fixture adapter healthy. Set SOCRATA_DOMAIN + SOCRATA_DATASET_ID (and optional SOCRATA_APP_TOKEN) for live SODA sync.",
      };
    },
  };
}
