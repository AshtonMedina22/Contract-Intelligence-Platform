/**
 * USAspending.gov federal award research client — Ask research plane only.
 *
 * NOT a PublicProcurementProvider. Observations may optionally persist as
 * research_facts with verification_status=AI_EXTRACTED. Never write canonical
 * `awards`, never invent market share, never auto HUMAN_VERIFIED.
 */

import fixtureFile from "./fixtures/usaspending.sample.json";
import {
  matchExistingClient,
  matchExistingCompetitor,
  normalizeParty,
  type PartyMatchResult,
  type PartyRecord,
} from "./normalize-party";
import type { FactVerificationStatus, PublicSourceProvider } from "@/lib/supabase/database.types";
import { SOURCE_AUTHORITY, makeEvidenceId, type NormalizedEvidence } from "@/lib/ask/evidence";

export const USA_SPENDING_API_BASE = "https://api.usaspending.gov/api/v2";
export const USA_SPENDING_SEARCH_PATH = "/search/spending_by_award/";
export const USA_SPENDING_AWARD_PATH = "/awards/";
export const USA_SPENDING_RECIPIENT_AUTOCOMPLETE_PATH = "/autocomplete/recipient/";
export const USA_SPENDING_HEALTH_PATH = "/references/toptier_agencies/";

export const USA_SPENDING_PROVIDER: PublicSourceProvider = "usa_spending";

const DEFAULT_TTL_MS = 60_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 200;

/** Contract-ish award type codes required by spending_by_award. */
export const DEFAULT_AWARD_TYPE_CODES = ["A", "B", "C", "D"] as const;

export const DEFAULT_AWARD_FIELDS = [
  "Award ID",
  "generated_unique_award_id",
  "Recipient Name",
  "recipient_id",
  "Awarding Agency",
  "Award Amount",
  "Start Date",
  "End Date",
  "Period of Performance Current End Date",
  "Award Date",
  "NAICS Code",
  "PSC Code",
  "Description",
  "Place of Performance State Code",
  "Place of Performance City Name",
  "Award Type",
  "Contract Award Type",
] as const;

export type FederalAwardQuery = {
  keywords?: string | null;
  agency?: string | null;
  recipient?: string | null;
  recipientUei?: string | null;
  naics?: string | null;
  psc?: string | null;
  awardId?: string | null;
  awardTypeCodes?: string[] | null;
  amountLower?: number | null;
  amountUpper?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  placeOfPerformanceState?: string | null;
  placeOfPerformanceCity?: string | null;
  limit?: number | null;
  page?: number | null;
};

export type NormalizedFederalAward = {
  award_id: string;
  external_id: string;
  piid: string | null;
  recipient_name: string | null;
  recipient_uei: string | null;
  agency: string | null;
  amount: number | null;
  start_date: string | null;
  end_date: string | null;
  award_date: string | null;
  naics: string | null;
  psc: string | null;
  description: string | null;
  place_of_performance: string | null;
  award_type: string | null;
  source_url: string;
  retrieved_at: string;
  provider: "usa_spending" | "fixture";
  raw: Record<string, unknown>;
};

export type FederalAwardSearchResult = {
  ok: boolean;
  mode: "live" | "fixture";
  error: string | null;
  page: number;
  limit: number;
  hasNext: boolean;
  results: NormalizedFederalAward[];
  /** True when results are FIXTURE-USA-* samples — never persist as live awards. */
  fixture: boolean;
};

export type FederalAwardProviderHealth = {
  ok: boolean;
  mode: "live" | "fixture";
  message: string;
  checked_at: string;
};

export type UsaSpendingProvider = {
  id: "usa_spending";
  mode: "live" | "fixture";
  searchAwards(query: FederalAwardQuery): Promise<FederalAwardSearchResult>;
  getAward(awardId: string): Promise<NormalizedFederalAward | null>;
  searchByRecipient(
    recipient: string,
    opts?: { limit?: number; page?: number },
  ): Promise<FederalAwardSearchResult>;
  healthCheck(): Promise<FederalAwardProviderHealth>;
};

type CacheEntry = { expires: number; value: unknown };

const responseCache = new Map<string, CacheEntry>();

export function clearUsaSpendingCache(): void {
  responseCache.clear();
}

export function usaSpendingFixturesEnabled(): boolean {
  const flag = (process.env.USA_SPENDING_USE_FIXTURES ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stable hash for cache keys — not cryptographic. */
export function hashQuery(payload: unknown): string {
  const json = JSON.stringify(payload);
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function cacheGet<T>(key: string): T | undefined {
  const hit = responseCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    responseCache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
  responseCache.set(key, { expires: Date.now() + ttlMs, value });
}

export type FetchLike = typeof fetch;

export type UsaSpendingClientOptions = {
  fetchImpl?: FetchLike;
  /** Injected clock for tests. */
  now?: () => Date;
  ttlMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  /** Force fixture responses (unit tests). Never sync these into DB as live awards. */
  forceFixture?: boolean;
};

function awardPortalUrl(awardId: string): string {
  const id = encodeURIComponent(awardId.trim());
  return `https://www.usaspending.gov/award/${id}`;
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function pickNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/[$,]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function placeOfPerformanceFromRow(row: Record<string, unknown>): string | null {
  const city = pickString(row, "Place of Performance City Name", "pop_city_name");
  const state = pickString(row, "Place of Performance State Code", "pop_state_code");
  const parts = [city, state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Normalize a spending_by_award row or awards/{id} payload into our research shape.
 * Source URL + retrieved_at always preserved.
 */
export function normalizeFederalAward(
  row: Record<string, unknown>,
  opts?: { retrieved_at?: string; provider?: "usa_spending" | "fixture" },
): NormalizedFederalAward | null {
  const awardId =
    pickString(
      row,
      "Award ID",
      "award_id",
      "generated_unique_award_id",
      "piid",
      "fain",
      "uri",
    ) ?? null;
  if (!awardId) return null;

  const generated =
    pickString(row, "generated_unique_award_id", "generatedUniqueAwardId") ?? awardId;
  const isFixture = awardId.startsWith("FIXTURE-USA-") || generated.startsWith("FIXTURE-USA-");
  const provider = opts?.provider ?? (isFixture ? "fixture" : "usa_spending");
  const retrieved_at = opts?.retrieved_at ?? new Date().toISOString();

  const piid =
    pickString(row, "piid", "PIID") ??
    (/^CONT_AWD_/i.test(generated) ? awardId : awardId.startsWith("FIXTURE-") ? pickString(row, "piid") : null);

  return {
    award_id: awardId,
    external_id: generated,
    piid: piid && piid !== awardId ? piid : pickString(row, "piid", "PIID"),
    recipient_name: pickString(row, "Recipient Name", "recipient_name", "recipient"),
    recipient_uei: pickString(row, "recipient_uei", "Recipient UEI", "uei"),
    agency: pickString(row, "Awarding Agency", "awarding_agency", "agency"),
    amount: pickNumber(row, "Award Amount", "award_amount", "total_obligation", "amount"),
    start_date: pickString(row, "Start Date", "start_date", "period_of_performance_start_date"),
    end_date: pickString(
      row,
      "End Date",
      "Period of Performance Current End Date",
      "end_date",
      "period_of_performance_current_end_date",
    ),
    award_date: pickString(row, "Award Date", "date_signed", "award_date"),
    naics: pickString(row, "NAICS Code", "naics_code", "naics"),
    psc: pickString(row, "PSC Code", "psc_code", "product_or_service_code", "psc"),
    description: pickString(row, "Description", "description", "award_description"),
    place_of_performance: placeOfPerformanceFromRow(row),
    award_type: pickString(row, "Contract Award Type", "Award Type", "type_description", "award_type"),
    source_url: awardPortalUrl(generated),
    retrieved_at,
    provider,
    raw: row,
  };
}

/** Build the POST body for /search/spending_by_award/. Exported for request-construction tests. */
export function buildSpendingByAwardRequest(query: FederalAwardQuery): {
  url: string;
  body: Record<string, unknown>;
} {
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const filters: Record<string, unknown> = {
    award_type_codes: query.awardTypeCodes?.length
      ? query.awardTypeCodes
      : [...DEFAULT_AWARD_TYPE_CODES],
  };

  if (query.keywords?.trim()) {
    filters.keywords = [query.keywords.trim()];
  }
  if (query.agency?.trim()) {
    filters.agencies = [
      {
        type: "awarding",
        tier: "toptier",
        name: query.agency.trim(),
      },
    ];
  }
  if (query.recipient?.trim() || query.recipientUei?.trim()) {
    const texts: string[] = [];
    if (query.recipient?.trim()) texts.push(query.recipient.trim());
    if (query.recipientUei?.trim()) texts.push(query.recipientUei.trim());
    filters.recipient_search_text = texts;
  }
  if (query.naics?.trim()) {
    filters.naics_codes = [query.naics.trim()];
  }
  if (query.psc?.trim()) {
    filters.psc_codes = [query.psc.trim()];
  }
  if (query.awardId?.trim()) {
    filters.award_ids = [query.awardId.trim()];
  }
  if (query.amountLower != null || query.amountUpper != null) {
    const bound: Record<string, number> = {};
    if (query.amountLower != null) bound.lower_bound = query.amountLower;
    if (query.amountUpper != null) bound.upper_bound = query.amountUpper;
    filters.award_amounts = [bound];
  }
  if (query.dateFrom?.trim() || query.dateTo?.trim()) {
    filters.time_period = [
      {
        start_date: query.dateFrom?.trim() || "2000-01-01",
        end_date: query.dateTo?.trim() || new Date().toISOString().slice(0, 10),
      },
    ];
  }
  if (query.placeOfPerformanceState?.trim() || query.placeOfPerformanceCity?.trim()) {
    const loc: Record<string, string> = { country: "USA" };
    if (query.placeOfPerformanceState?.trim()) {
      loc.state = query.placeOfPerformanceState.trim().toUpperCase();
    }
    if (query.placeOfPerformanceCity?.trim()) {
      loc.city = query.placeOfPerformanceCity.trim();
    }
    filters.place_of_performance_locations = [loc];
  }

  return {
    url: `${USA_SPENDING_API_BASE}${USA_SPENDING_SEARCH_PATH}`,
    body: {
      filters,
      fields: [...DEFAULT_AWARD_FIELDS],
      limit,
      page,
      sort: "Award Amount",
      order: "desc",
      subawards: false,
    },
  };
}

function loadFixtureAwards(retrieved_at: string): NormalizedFederalAward[] {
  const rows = (fixtureFile as { awards?: Record<string, unknown>[] }).awards ?? [];
  return rows
    .map((row) => normalizeFederalAward(row, { retrieved_at, provider: "fixture" }))
    .filter((a): a is NormalizedFederalAward => a != null);
}

function filterFixtures(awards: NormalizedFederalAward[], query: FederalAwardQuery): NormalizedFederalAward[] {
  return awards.filter((a) => {
    if (query.awardId?.trim()) {
      const id = query.awardId.trim().toUpperCase();
      if (
        a.award_id.toUpperCase() !== id &&
        a.external_id.toUpperCase() !== id &&
        (a.piid ?? "").toUpperCase() !== id
      ) {
        return false;
      }
    }
    if (query.recipient?.trim()) {
      const needle = query.recipient.trim().toLowerCase();
      if (!(a.recipient_name ?? "").toLowerCase().includes(needle)) return false;
    }
    if (query.agency?.trim()) {
      const needle = query.agency.trim().toLowerCase();
      if (!(a.agency ?? "").toLowerCase().includes(needle)) return false;
    }
    if (query.naics?.trim() && a.naics !== query.naics.trim()) return false;
    if (query.psc?.trim() && a.psc !== query.psc.trim()) return false;
    if (query.keywords?.trim()) {
      const needle = query.keywords.trim().toLowerCase();
      const hay = `${a.description ?? ""} ${a.recipient_name ?? ""} ${a.agency ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

async function fetchWithBackoff(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  opts: { maxRetries: number; baseBackoffMs: number },
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const res = await fetchImpl(url, init);
      if (res.status === 429 || res.status >= 500) {
        if (attempt === opts.maxRetries) return res;
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : opts.baseBackoffMs * 2 ** attempt;
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === opts.maxRetries) throw lastError;
      await sleep(opts.baseBackoffMs * 2 ** attempt);
    }
  }
  throw lastError ?? new Error("USAspending request failed");
}

export function createUsaSpendingProvider(options: UsaSpendingClientOptions = {}): UsaSpendingProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const baseBackoffMs = options.baseBackoffMs ?? BASE_BACKOFF_MS;
  const forceFixture = options.forceFixture ?? usaSpendingFixturesEnabled();

  async function searchAwards(query: FederalAwardQuery): Promise<FederalAwardSearchResult> {
    const retrieved_at = now().toISOString();
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const page = Math.max(query.page ?? 1, 1);

    if (forceFixture) {
      const all = filterFixtures(loadFixtureAwards(retrieved_at), query);
      const start = (page - 1) * limit;
      const slice = all.slice(start, start + limit);
      return {
        ok: true,
        mode: "fixture",
        error: null,
        page,
        limit,
        hasNext: start + limit < all.length,
        results: slice,
        fixture: true,
      };
    }

    const { url, body } = buildSpendingByAwardRequest({ ...query, limit, page });
    const cacheKey = `search:${hashQuery(body)}`;
    const cached = cacheGet<FederalAwardSearchResult>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetchWithBackoff(
        fetchImpl,
        url,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "LP-Contract-Intelligence/1.0 (federal-award-research; cite-only)",
          },
          body: JSON.stringify(body),
        },
        { maxRetries, baseBackoffMs },
      );

      if (!res.ok) {
        return {
          ok: false,
          mode: "live",
          error: `USAspending search failed: HTTP ${res.status}`,
          page,
          limit,
          hasNext: false,
          results: [],
          fixture: false,
        };
      }

      const data = (await res.json()) as {
        results?: Record<string, unknown>[];
        page_metadata?: { hasNext?: boolean; page?: number };
      };
      const results = (data.results ?? [])
        .map((row) => normalizeFederalAward(row, { retrieved_at, provider: "usa_spending" }))
        .filter((a): a is NormalizedFederalAward => a != null);

      const out: FederalAwardSearchResult = {
        ok: true,
        mode: "live",
        error: null,
        page,
        limit,
        hasNext: Boolean(data.page_metadata?.hasNext),
        results,
        fixture: false,
      };
      cacheSet(cacheKey, out, ttlMs);
      return out;
    } catch (err) {
      return {
        ok: false,
        mode: "live",
        error: err instanceof Error ? err.message : String(err),
        page,
        limit,
        hasNext: false,
        results: [],
        fixture: false,
      };
    }
  }

  async function getAward(awardId: string): Promise<NormalizedFederalAward | null> {
    const id = awardId.trim();
    if (!id) return null;
    const retrieved_at = now().toISOString();

    if (forceFixture) {
      return (
        loadFixtureAwards(retrieved_at).find(
          (a) =>
            a.award_id === id ||
            a.external_id === id ||
            a.piid === id ||
            a.award_id.toUpperCase() === id.toUpperCase(),
        ) ?? null
      );
    }

    const cacheKey = `award:${id}`;
    const cached = cacheGet<NormalizedFederalAward | null>(cacheKey);
    if (cached !== undefined) return cached;

    const url = `${USA_SPENDING_API_BASE}${USA_SPENDING_AWARD_PATH}${encodeURIComponent(id)}/`;
    try {
      const res = await fetchWithBackoff(
        fetchImpl,
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "LP-Contract-Intelligence/1.0 (federal-award-research; cite-only)",
          },
        },
        { maxRetries, baseBackoffMs },
      );
      if (!res.ok) {
        cacheSet(cacheKey, null, Math.min(ttlMs, 15_000));
        return null;
      }
      const data = (await res.json()) as Record<string, unknown>;
      // Flatten common nested shapes onto a single row for normalizeFederalAward.
      const flat: Record<string, unknown> = { ...data };
      if (data.recipient && typeof data.recipient === "object") {
        const r = data.recipient as Record<string, unknown>;
        flat["Recipient Name"] = r.recipient_name ?? r.name;
        flat.recipient_uei = r.recipient_uei ?? r.uei;
      }
      if (data.awarding_agency && typeof data.awarding_agency === "object") {
        const a = data.awarding_agency as Record<string, unknown>;
        const toptier = a.toptier_agency as Record<string, unknown> | undefined;
        flat["Awarding Agency"] = toptier?.name ?? a.name;
      }
      flat["Award Amount"] = data.total_obligation ?? data.base_and_all_options_value;
      flat["Award ID"] = data.piid ?? data.fain ?? data.uri ?? data.generated_unique_award_id ?? id;
      flat.generated_unique_award_id = data.generated_unique_award_id ?? id;
      flat.piid = data.piid;
      flat.Description = data.description;
      flat["NAICS Code"] =
        (data.latest_transaction_contract_data as Record<string, unknown> | undefined)?.naics ??
        data.naics_code;
      flat["PSC Code"] =
        (data.latest_transaction_contract_data as Record<string, unknown> | undefined)
          ?.product_or_service_code ?? data.product_or_service_code;

      const normalized = normalizeFederalAward(flat, { retrieved_at, provider: "usa_spending" });
      cacheSet(cacheKey, normalized, ttlMs);
      return normalized;
    } catch {
      return null;
    }
  }

  async function searchByRecipient(
    recipient: string,
    opts?: { limit?: number; page?: number },
  ): Promise<FederalAwardSearchResult> {
    return searchAwards({
      recipient: recipient.trim(),
      limit: opts?.limit,
      page: opts?.page,
    });
  }

  async function healthCheck(): Promise<FederalAwardProviderHealth> {
    const checked_at = now().toISOString();
    if (forceFixture) {
      return {
        ok: true,
        mode: "fixture",
        message:
          "Fixture adapter healthy — USA_SPENDING_USE_FIXTURES is set. FIXTURE-USA-* samples are for unit tests only and must never sync into DB as live awards.",
        checked_at,
      };
    }
    try {
      const res = await fetchWithBackoff(
        fetchImpl,
        `${USA_SPENDING_API_BASE}${USA_SPENDING_HEALTH_PATH}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "LP-Contract-Intelligence/1.0 (federal-award-research; health)",
          },
        },
        { maxRetries: 1, baseBackoffMs },
      );
      if (!res.ok) {
        return {
          ok: false,
          mode: "live",
          message: `USAspending health ping failed: HTTP ${res.status}. Search will return honest errors (no silent fixture fallback).`,
          checked_at,
        };
      }
      return {
        ok: true,
        mode: "live",
        message: "USAspending API reachable. Results are OFFICIAL_PUBLIC / PUBLIC_UNVERIFIED research only.",
        checked_at,
      };
    } catch (err) {
      return {
        ok: false,
        mode: "live",
        message: `USAspending unavailable: ${err instanceof Error ? err.message : String(err)}. Use USA_SPENDING_USE_FIXTURES=1 for labeled unit-test fixtures only.`,
        checked_at,
      };
    }
  }

  return {
    id: "usa_spending",
    mode: forceFixture ? "fixture" : "live",
    searchAwards,
    getAward,
    searchByRecipient,
    healthCheck,
  };
}

let defaultProvider: UsaSpendingProvider | null = null;

export function getUsaSpendingProvider(): UsaSpendingProvider {
  if (!defaultProvider) defaultProvider = createUsaSpendingProvider();
  return defaultProvider;
}

/** Reset singleton (tests). */
export function resetUsaSpendingProvider(): void {
  defaultProvider = null;
  clearUsaSpendingCache();
}

export function federalAwardToEvidence(award: NormalizedFederalAward): NormalizedEvidence {
  const evidence_class = award.provider === "fixture" ? "UNVERIFIED" : "OFFICIAL_PUBLIC";
  return {
    id: makeEvidenceId("usa", award.external_id),
    rail: "public",
    evidence_class,
    source_authority: SOURCE_AUTHORITY[evidence_class],
    title: `${award.award_id} — ${award.recipient_name ?? "recipient unknown"}`,
    url: award.source_url,
    internal_ref: null,
    document_id: null,
    chunk_id: null,
    page: null,
    excerpt: [
      `agency=${award.agency ?? "—"}`,
      `amount=${award.amount ?? "—"}`,
      `dates=${award.start_date ?? "—"}–${award.end_date ?? "—"}`,
      `naics=${award.naics ?? "—"}`,
      `psc=${award.psc ?? "—"}`,
      `pop=${award.place_of_performance ?? "—"}`,
      award.description ?? "",
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 2000),
    published_date: award.award_date,
    retrieved_at: award.retrieved_at,
    verification_status: award.provider === "fixture" ? "PUBLIC_UNVERIFIED" : "OFFICIAL_PUBLIC",
    entity: award.recipient_name,
    topic: "federal_award",
  };
}

function assertUnverified<T extends { verification_status: FactVerificationStatus }>(row: T): T {
  if (row.verification_status !== "AI_EXTRACTED") {
    throw new Error("Federal award research cannot write verified facts. Verify in Data Ops instead.");
  }
  return row;
}

/**
 * Optional persist helper — AI_EXTRACTED only. Does not insert; callers decide.
 * Never call for fixture awards. Never writes canonical `awards`.
 */
export function buildResearchFactFromFederalAward(opts: {
  organizationId: string;
  award: NormalizedFederalAward;
  clientId?: string | null;
  competitorId?: string | null;
  opportunityId?: string | null;
}): {
  organization_id: string;
  client_id: string | null;
  competitor_id: string | null;
  opportunity_id: string | null;
  source_url: string;
  title: string;
  excerpt: string;
  published_on: string | null;
  retrieved_at: string;
  verification_status: "AI_EXTRACTED";
  provider: PublicSourceProvider;
  external_id: string;
} {
  if (opts.award.provider === "fixture" || opts.award.award_id.startsWith("FIXTURE-USA-")) {
    throw new Error("Refusing to build research_facts from FIXTURE-USA-* samples — unit tests only.");
  }
  return assertUnverified({
    organization_id: opts.organizationId,
    client_id: opts.clientId ?? null,
    competitor_id: opts.competitorId ?? null,
    opportunity_id: opts.opportunityId ?? null,
    source_url: opts.award.source_url,
    title: `${opts.award.award_id} — ${opts.award.recipient_name ?? "Federal award"}`,
    excerpt: [
      `USAspending observation (not L&P pricing truth).`,
      `agency=${opts.award.agency ?? "—"}`,
      `amount=${opts.award.amount ?? "—"}`,
      `naics=${opts.award.naics ?? "—"}`,
      `psc=${opts.award.psc ?? "—"}`,
      opts.award.description ?? "",
    ]
      .join(" ")
      .slice(0, 4000),
    published_on: opts.award.award_date,
    retrieved_at: opts.award.retrieved_at,
    verification_status: "AI_EXTRACTED" as const,
    provider: USA_SPENDING_PROVIDER,
    external_id: opts.award.external_id,
  });
}

/** Reconcile a recipient against existing clients/competitors without inventing rows. */
export function reconcileFederalRecipient(
  award: Pick<NormalizedFederalAward, "recipient_name" | "recipient_uei">,
  existing: { clients?: PartyRecord[]; competitors?: PartyRecord[] },
): {
  normalized: ReturnType<typeof normalizeParty>;
  client: PartyMatchResult;
  competitor: PartyMatchResult;
} {
  const needle = { name: award.recipient_name, uei: award.recipient_uei };
  return {
    normalized: normalizeParty(needle),
    client: matchExistingClient(needle, existing.clients ?? []),
    competitor: matchExistingCompetitor(needle, existing.competitors ?? []),
  };
}
